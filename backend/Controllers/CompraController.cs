using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Almacen.Controllers;

[ApiController]
[Route("api/compras")]
[Authorize(Roles = "admin,almacenero,readonly")]
public class CompraController : ControllerBase
{
    private readonly Db _db;

    public CompraController(Db db) => _db = db;

    // GET /api/compras?estado=&page=1&pageSize=20
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? estado   = null,
        [FromQuery] int     page     = 1,
        [FromQuery] int     pageSize = 20)
    {
        if (page < 1)       page     = 1;
        if (pageSize < 1)   pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        using var conn = _db.CreateConnection();

        var where = new List<string>();
        var p     = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(estado))
        {
            where.Add("c.estado = @estado");
            p.Add("estado", estado.ToLower().Trim());
        }

        var clausula = where.Count > 0 ? "WHERE " + string.Join(" AND ", where) : "";

        var total = await conn.ExecuteScalarAsync<int>(
            $"SELECT COUNT(*) FROM compras c {clausula}", p);

        p.Add("limit",  pageSize);
        p.Add("offset", (page - 1) * pageSize);

        var items = await conn.QueryAsync<CompraRow>(
            $@"SELECT c.id, c.numero, c.proveedor, c.fecha, c.estado,
                      c.user_id, u.username AS usuario, c.created_at
               FROM compras c
               JOIN users u ON u.id = c.user_id
               {clausula}
               ORDER BY c.created_at DESC
               LIMIT @limit OFFSET @offset", p);

        return Ok(new { total, page, pageSize, items });
    }

    // GET /api/compras/{id}
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        using var conn = _db.CreateConnection();

        var compra = await conn.QuerySingleOrDefaultAsync<CompraRow>(
            @"SELECT c.id, c.numero, c.proveedor, c.fecha, c.estado,
                     c.user_id, u.username AS usuario, c.created_at
              FROM compras c
              JOIN users u ON u.id = c.user_id
              WHERE c.id = @id",
            new { id });

        if (compra is null) return NotFound(new { error = "Compra no encontrada" });

        var items = await conn.QueryAsync<CompraItemRow>(
            @"SELECT ci.id, ci.material_id, m.codigo, m.nombre AS material_nombre,
                     m.unidad_medida, ci.cantidad, ci.precio_unitario,
                     ci.cantidad * ci.precio_unitario AS subtotal
              FROM compra_items ci
              JOIN materiales m ON m.id = ci.material_id
              WHERE ci.compra_id = @id
              ORDER BY m.nombre",
            new { id });

        return Ok(new { compra, items });
    }

    // POST /api/compras
    [HttpPost]
    [Authorize(Roles = "admin,almacenero")]
    public async Task<IActionResult> Create([FromBody] CompraCreateRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Numero))    return BadRequest(new { error = "El número es requerido" });
        if (string.IsNullOrWhiteSpace(req.Proveedor)) return BadRequest(new { error = "El proveedor es requerido" });
        if (req.Items is null || req.Items.Count == 0) return BadRequest(new { error = "La compra debe tener al menos un ítem" });

        using var conn = _db.CreateConnection();
        conn.Open();
        using var tx = conn.BeginTransaction();

        try
        {
            var numeroDuplicado = await conn.ExecuteScalarAsync<int?>(
                "SELECT id FROM compras WHERE numero = @numero",
                new { numero = req.Numero.Trim() }, tx);

            if (numeroDuplicado is not null)
                return Conflict(new { error = "Ya existe una compra con ese número" });

            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            var compraId = await conn.ExecuteScalarAsync<int>(
                @"INSERT INTO compras (numero, proveedor, fecha, estado, user_id)
                  VALUES (@numero, @proveedor, @fecha, 'borrador', @userId)
                  RETURNING id",
                new { numero = req.Numero.Trim(), proveedor = req.Proveedor.Trim(), fecha = req.Fecha, userId }, tx);

            foreach (var item in req.Items)
            {
                if (item.Cantidad <= 0)      return BadRequest(new { error = "La cantidad debe ser mayor a cero" });
                if (item.PrecioUnitario < 0) return BadRequest(new { error = "El precio unitario no puede ser negativo" });

                var materialExiste = await conn.ExecuteScalarAsync<int?>(
                    "SELECT id FROM materiales WHERE id = @id AND active = true",
                    new { id = item.MaterialId }, tx);

                if (materialExiste is null)
                    return BadRequest(new { error = $"Material {item.MaterialId} no encontrado o inactivo" });

                await conn.ExecuteAsync(
                    @"INSERT INTO compra_items (compra_id, material_id, cantidad, precio_unitario)
                      VALUES (@compraId, @materialId, @cantidad, @precioUnitario)",
                    new { compraId, materialId = item.MaterialId, cantidad = item.Cantidad, precioUnitario = item.PrecioUnitario }, tx);
            }

            tx.Commit();
            return CreatedAtAction(nameof(GetById), new { id = compraId }, new { id = compraId });
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    // PUT /api/compras/{id}/confirmar
    [HttpPut("{id:int}/confirmar")]
    [Authorize(Roles = "admin,almacenero")]
    public async Task<IActionResult> Confirmar(int id)
    {
        using var conn = _db.CreateConnection();

        var compra = await conn.QuerySingleOrDefaultAsync<EstadoRow>(
            "SELECT id, estado FROM compras WHERE id = @id", new { id });

        if (compra is null) return NotFound(new { error = "Compra no encontrada" });
        if (compra.Estado != "borrador")
            return BadRequest(new { error = $"Solo se puede confirmar una compra en estado 'borrador'. Estado actual: {compra.Estado}" });

        await conn.ExecuteAsync(
            "UPDATE compras SET estado = 'confirmada' WHERE id = @id", new { id });

        return NoContent();
    }

    // POST /api/compras/{id}/recibir
    [HttpPost("{id:int}/recibir")]
    [Authorize(Roles = "admin,almacenero")]
    public async Task<IActionResult> Recibir(int id, [FromBody] CompraRecibirRequest req)
    {
        using var conn = _db.CreateConnection();
        conn.Open();
        using var tx = conn.BeginTransaction();

        try
        {
            var compra = await conn.QuerySingleOrDefaultAsync<EstadoRow>(
                "SELECT id, estado FROM compras WHERE id = @id", new { id }, tx);

            if (compra is null) return NotFound(new { error = "Compra no encontrada" });
            if (compra.Estado != "confirmada")
                return BadRequest(new { error = $"Solo se puede recibir una compra en estado 'confirmada'. Estado actual: {compra.Estado}" });

            var almacenExiste = await conn.ExecuteScalarAsync<int?>(
                "SELECT id FROM almacenes WHERE id = @id AND active = true",
                new { id = req.AlmacenId }, tx);

            if (almacenExiste is null)
                return BadRequest(new { error = "Almacén no encontrado o inactivo" });

            var items = (await conn.QueryAsync<CompraItemSimple>(
                "SELECT id, material_id, cantidad, precio_unitario FROM compra_items WHERE compra_id = @compraId",
                new { compraId = id }, tx)).ToList();

            if (items.Count == 0)
                return BadRequest(new { error = "La compra no tiene ítems" });

            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            foreach (var item in items)
            {
                // Movimiento de ingreso
                await conn.ExecuteAsync(
                    @"INSERT INTO movimientos
                        (tipo, material_id, almacen_id, cantidad, costo_unitario, fecha, compra_item_id, user_id, observacion)
                      VALUES
                        ('ingreso', @materialId, @almacenId, @cantidad, @costoUnitario, @fecha, @compraItemId, @userId, @obs)",
                    new
                    {
                        materialId    = item.MaterialId,
                        almacenId     = req.AlmacenId,
                        cantidad      = item.Cantidad,
                        costoUnitario = item.PrecioUnitario,
                        fecha         = req.Fecha,
                        compraItemId  = item.Id,
                        userId,
                        obs           = $"Recepción compra #{id}"
                    }, tx);

                // Lote PEPS
                await conn.ExecuteAsync(
                    @"INSERT INTO lotes
                        (material_id, almacen_id, cantidad_inicial, cantidad_disponible, costo_unitario, fecha_ingreso, compra_item_id)
                      VALUES
                        (@materialId, @almacenId, @cantidad, @cantidad, @costoUnitario, @fecha, @compraItemId)",
                    new
                    {
                        materialId    = item.MaterialId,
                        almacenId     = req.AlmacenId,
                        cantidad      = item.Cantidad,
                        costoUnitario = item.PrecioUnitario,
                        fecha         = req.Fecha,
                        compraItemId  = item.Id
                    }, tx);
            }

            await conn.ExecuteAsync(
                "UPDATE compras SET estado = 'recibida' WHERE id = @id", new { id }, tx);

            tx.Commit();
            return Ok(new { message = $"Compra recibida. {items.Count} ítem(s) ingresados al almacén." });
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    private record CompraRow(int Id, string Numero, string Proveedor, DateTime Fecha,
                             string Estado, int UserId, string Usuario, DateTime CreatedAt);

    private record CompraItemRow(int Id, int MaterialId, string Codigo, string MaterialNombre,
                                 string UnidadMedida, decimal Cantidad, decimal PrecioUnitario, decimal Subtotal);

    private record CompraItemSimple(int Id, int MaterialId, decimal Cantidad, decimal PrecioUnitario);

    private record EstadoRow(int Id, string Estado);
}

public record CompraItemRequest(int MaterialId, decimal Cantidad, decimal PrecioUnitario);

public record CompraCreateRequest(string Numero, string Proveedor, DateOnly Fecha, List<CompraItemRequest> Items);

public record CompraRecibirRequest(int AlmacenId, DateOnly Fecha);
