using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Almacen.Controllers;

[ApiController]
[Route("api/compras")]
[Authorize(Roles = "admin,almacenero")]
public class CompraController : ControllerBase
{
    private readonly Db _db;

    public CompraController(Db db) => _db = db;

    // GET /api/compras?subAlmacenId=&estado=&page=1&pageSize=20
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int?    subAlmacenId = null,
        [FromQuery] string? estado       = null,
        [FromQuery] int     page         = 1,
        [FromQuery] int     pageSize     = 20)
    {
        if (page < 1)       page     = 1;
        if (pageSize < 1)   pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        using var conn = _db.CreateConnection();

        var where = new List<string> { "c.active = true" };
        var p     = new DynamicParameters();

        if (subAlmacenId.HasValue)
        {
            where.Add("c.sub_almacen_id = @subAlmacenId");
            p.Add("subAlmacenId", subAlmacenId.Value);
        }

        if (!string.IsNullOrWhiteSpace(estado))
        {
            where.Add("c.estado = @estado");
            p.Add("estado", estado.ToLower().Trim());
        }

        var clausula = "WHERE " + string.Join(" AND ", where);

        var total = await conn.ExecuteScalarAsync<int>(
            $"SELECT COUNT(*) FROM compras c JOIN sub_almacenes sa ON sa.id = c.sub_almacen_id {clausula}", p);

        p.Add("limit",  pageSize);
        p.Add("offset", (page - 1) * pageSize);

        var items = await conn.QueryAsync<CompraListRow>(
            $@"SELECT c.id, c.numero, c.proveedor, c.detalle, c.fecha, c.estado,
                      c.sub_almacen_id, sa.nombre AS sub_almacen_nombre,
                      c.created_at
               FROM compras c
               JOIN sub_almacenes sa ON sa.id = c.sub_almacen_id
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

        var compra = await conn.QuerySingleOrDefaultAsync<CompraDetailRow>(
            @"SELECT c.id, c.numero, c.proveedor, c.detalle, c.fecha, c.estado,
                     c.sub_almacen_id, sa.nombre AS sub_almacen_nombre,
                     a.id AS almacen_id, a.nombre AS almacen_nombre,
                     c.created_at
              FROM compras c
              JOIN sub_almacenes sa ON sa.id = c.sub_almacen_id
              JOIN almacenes a ON a.id = sa.almacen_id
              WHERE c.id = @id",
            new { id });

        if (compra is null) return NotFound(new { error = "Compra no encontrada" });

        var items = await conn.QueryAsync<CompraItemRow>(
            @"SELECT ci.id, ci.material_id, m.codigo, m.nombre AS material_nombre,
                     ci.unidad_medida, ci.cantidad, ci.precio_unitario,
                     ci.cantidad * ci.precio_unitario AS subtotal
              FROM compra_items ci
              JOIN materiales m ON m.id = ci.material_id
              WHERE ci.compra_id = @id
              ORDER BY ci.id",
            new { id });

        return Ok(new { compra, items });
    }

    // POST /api/compras
    [HttpPost]
    [Authorize(Roles = "admin,almacenero")]
    public async Task<IActionResult> Create([FromBody] CompraCreateRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Proveedor)) return BadRequest(new { error = "El proveedor es requerido" });
        if (string.IsNullOrWhiteSpace(req.Detalle))   return BadRequest(new { error = "El detalle es requerido" });

        using var conn = _db.CreateConnection();

        var subAlmacenExiste = await conn.ExecuteScalarAsync<int?>(
            "SELECT id FROM sub_almacenes WHERE id = @id AND active = true",
            new { id = req.SubAlmacenId });

        if (subAlmacenExiste is null)
            return BadRequest(new { error = "Sub-almacén no encontrado o inactivo" });

        var userId = int.Parse(User.FindFirstValue("sub")!);

        var compraId = await conn.ExecuteScalarAsync<int>(
            @"INSERT INTO compras (proveedor, detalle, fecha, sub_almacen_id, user_id)
              VALUES (@proveedor, @detalle, @fecha, @subAlmacenId, @userId)
              RETURNING id",
            new
            {
                proveedor = req.Proveedor.Trim(),
                detalle = req.Detalle.Trim(),
                fecha = req.Fecha,
                subAlmacenId = req.SubAlmacenId,
                userId
            });

        return Ok(new { id = compraId });
    }

    // PUT /api/compras/{id}
    [HttpPut("{id:int}")]
    [Authorize(Roles = "admin,almacenero")]
    public async Task<IActionResult> Update(int id, [FromBody] CompraCreateRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Proveedor)) return BadRequest(new { error = "El proveedor es requerido" });
        if (string.IsNullOrWhiteSpace(req.Detalle))   return BadRequest(new { error = "El detalle es requerido" });

        using var conn = _db.CreateConnection();

        var compra = await conn.QuerySingleOrDefaultAsync<EstadoRow>(
            "SELECT id, estado FROM compras WHERE id = @id AND active = true", new { id });

        if (compra is null) return NotFound(new { error = "Compra no encontrada" });
        if (compra.Estado != "pendiente")
            return BadRequest(new { error = "Solo se puede editar una compra en estado pendiente" });

        await conn.ExecuteAsync(
            @"UPDATE compras
              SET proveedor = @proveedor, detalle = @detalle, fecha = @fecha, sub_almacen_id = @subAlmacenId
              WHERE id = @id",
            new
            {
                proveedor = req.Proveedor.Trim(),
                detalle = req.Detalle.Trim(),
                fecha = req.Fecha,
                subAlmacenId = req.SubAlmacenId,
                id
            });

        return NoContent();
    }

    // PUT /api/compras/{id}/concluir
    [HttpPut("{id:int}/concluir")]
    [Authorize(Roles = "admin,almacenero")]
    public async Task<IActionResult> Concluir(int id)
    {
        using var conn = _db.CreateConnection();
        conn.Open();
        using var tx = conn.BeginTransaction();

        try
        {
            var compra = await conn.QuerySingleOrDefaultAsync<CompraConSubAlmacen>(
                "SELECT id, estado, sub_almacen_id FROM compras WHERE id = @id AND active = true",
                new { id }, tx);

            if (compra is null) return NotFound(new { error = "Compra no encontrada" });
            if (compra.Estado != "pendiente")
                return BadRequest(new { error = $"Solo se puede concluir una compra en estado 'pendiente'. Estado actual: {compra.Estado}" });

            var tieneItems = await conn.ExecuteScalarAsync<int>(
                "SELECT COUNT(*) FROM compra_items WHERE compra_id = @id", new { id }, tx);

            if (tieneItems == 0)
                return BadRequest(new { error = "No se puede concluir una compra sin ítems" });

            // Incrementar secuencia_ingresos (reinicia por año) y generar número
            var sigla = await conn.ExecuteScalarAsync<string?>(
                "SELECT sigla FROM sub_almacenes WHERE id = @id",
                new { id = compra.SubAlmacenId }, tx);

            var anio = DateTime.Now.Year;

            var secuencia = await conn.ExecuteScalarAsync<int>(
                @"UPDATE sub_almacenes
                  SET secuencia_ingresos = CASE WHEN anio_ingresos = @anio THEN secuencia_ingresos + 1 ELSE 1 END,
                      anio_ingresos = @anio
                  WHERE id = @id
                  RETURNING secuencia_ingresos",
                new { id = compra.SubAlmacenId, anio }, tx);

            var prefijo = string.IsNullOrWhiteSpace(sigla) ? "C" : sigla;
            var numero = $"{prefijo}-{anio}-{secuencia:D6}";

            await conn.ExecuteAsync(
                "UPDATE compras SET estado = 'concluido', numero = @numero WHERE id = @id",
                new { id, numero }, tx);

            tx.Commit();
            return Ok(new { numero });
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    // DELETE /api/compras/{id} → baja lógica
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Delete(int id)
    {
        using var conn = _db.CreateConnection();

        var compra = await conn.QuerySingleOrDefaultAsync<EstadoRow>(
            "SELECT id, estado FROM compras WHERE id = @id AND active = true", new { id });

        if (compra is null) return NotFound(new { error = "Compra no encontrada o ya inactiva" });
        if (compra.Estado != "pendiente")
            return BadRequest(new { error = "Solo se puede eliminar una compra en estado pendiente" });

        await conn.ExecuteAsync(
            "UPDATE compras SET active = false WHERE id = @id", new { id });

        return NoContent();
    }

    // ─── COMPRA ITEMS ─────────────────────────────────────────────────────────

    // POST /api/compras/{compraId}/items
    [HttpPost("{compraId:int}/items")]
    [Authorize(Roles = "admin,almacenero")]
    public async Task<IActionResult> AddItem(int compraId, [FromBody] CompraItemUpsertRequest req)
    {
        if (req.Cantidad <= 0)       return BadRequest(new { error = "La cantidad debe ser mayor a cero" });
        if (req.PrecioUnitario < 0)  return BadRequest(new { error = "El precio unitario no puede ser negativo" });
        if (string.IsNullOrWhiteSpace(req.UnidadMedida)) return BadRequest(new { error = "La unidad de medida es requerida" });

        using var conn = _db.CreateConnection();

        var compra = await conn.QuerySingleOrDefaultAsync<EstadoRow>(
            "SELECT id, estado FROM compras WHERE id = @compraId AND active = true", new { compraId });

        if (compra is null) return NotFound(new { error = "Compra no encontrada" });
        if (compra.Estado != "pendiente")
            return BadRequest(new { error = "Solo se pueden agregar ítems a una compra en estado pendiente" });

        var materialExiste = await conn.ExecuteScalarAsync<int?>(
            "SELECT id FROM materiales WHERE id = @id AND active = true",
            new { id = req.MaterialId });

        if (materialExiste is null)
            return BadRequest(new { error = "Material no encontrado o inactivo" });

        var id = await conn.ExecuteScalarAsync<int>(
            @"INSERT INTO compra_items (compra_id, material_id, cantidad, precio_unitario, unidad_medida)
              VALUES (@compraId, @materialId, @cantidad, @precioUnitario, @unidadMedida)
              RETURNING id",
            new
            {
                compraId,
                materialId = req.MaterialId,
                cantidad = req.Cantidad,
                precioUnitario = req.PrecioUnitario,
                unidadMedida = req.UnidadMedida.Trim()
            });

        return Created($"/api/compras/{compraId}/items/{id}", new { id });
    }

    // PUT /api/compras/{compraId}/items/{id}
    [HttpPut("{compraId:int}/items/{id:int}")]
    [Authorize(Roles = "admin,almacenero")]
    public async Task<IActionResult> UpdateItem(int compraId, int id, [FromBody] CompraItemUpsertRequest req)
    {
        if (req.Cantidad <= 0)       return BadRequest(new { error = "La cantidad debe ser mayor a cero" });
        if (req.PrecioUnitario < 0)  return BadRequest(new { error = "El precio unitario no puede ser negativo" });
        if (string.IsNullOrWhiteSpace(req.UnidadMedida)) return BadRequest(new { error = "La unidad de medida es requerida" });

        using var conn = _db.CreateConnection();

        var compra = await conn.QuerySingleOrDefaultAsync<EstadoRow>(
            "SELECT id, estado FROM compras WHERE id = @compraId AND active = true", new { compraId });

        if (compra is null) return NotFound(new { error = "Compra no encontrada" });
        if (compra.Estado != "pendiente")
            return BadRequest(new { error = "Solo se pueden editar ítems de una compra en estado pendiente" });

        var existe = await conn.ExecuteScalarAsync<int?>(
            "SELECT id FROM compra_items WHERE id = @id AND compra_id = @compraId", new { id, compraId });

        if (existe is null) return NotFound(new { error = "Ítem no encontrado" });

        await conn.ExecuteAsync(
            @"UPDATE compra_items
              SET material_id = @materialId, cantidad = @cantidad,
                  precio_unitario = @precioUnitario, unidad_medida = @unidadMedida
              WHERE id = @id",
            new
            {
                materialId = req.MaterialId,
                cantidad = req.Cantidad,
                precioUnitario = req.PrecioUnitario,
                unidadMedida = req.UnidadMedida.Trim(),
                id
            });

        return NoContent();
    }

    // DELETE /api/compras/{compraId}/items/{id}
    [HttpDelete("{compraId:int}/items/{id:int}")]
    [Authorize(Roles = "admin,almacenero")]
    public async Task<IActionResult> DeleteItem(int compraId, int id)
    {
        using var conn = _db.CreateConnection();

        var compra = await conn.QuerySingleOrDefaultAsync<EstadoRow>(
            "SELECT id, estado FROM compras WHERE id = @compraId AND active = true", new { compraId });

        if (compra is null) return NotFound(new { error = "Compra no encontrada" });
        if (compra.Estado != "pendiente")
            return BadRequest(new { error = "Solo se pueden eliminar ítems de una compra en estado pendiente" });

        var deleted = await conn.ExecuteAsync(
            "DELETE FROM compra_items WHERE id = @id AND compra_id = @compraId", new { id, compraId });

        if (deleted == 0) return NotFound(new { error = "Ítem no encontrado" });

        return NoContent();
    }

    // ─── Records internos ─────────────────────────────────────────────────────

    private class CompraListRow
    {
        public int Id { get; set; }
        public string? Numero { get; set; }
        public string Proveedor { get; set; } = "";
        public string Detalle { get; set; } = "";
        public DateOnly Fecha { get; set; }
        public string Estado { get; set; } = "";
        public int SubAlmacenId { get; set; }
        public string SubAlmacenNombre { get; set; } = "";
        public DateTime CreatedAt { get; set; }
    }

    private record CompraConSubAlmacen(int Id, string Estado, int SubAlmacenId);

    private class CompraDetailRow
    {
        public int Id { get; set; }
        public string? Numero { get; set; }
        public string Proveedor { get; set; } = "";
        public string Detalle { get; set; } = "";
        public DateOnly Fecha { get; set; }
        public string Estado { get; set; } = "";
        public int SubAlmacenId { get; set; }
        public string SubAlmacenNombre { get; set; } = "";
        public int AlmacenId { get; set; }
        public string AlmacenNombre { get; set; } = "";
        public DateTime CreatedAt { get; set; }
    }

    private record CompraItemRow(int Id, int MaterialId, string Codigo, string MaterialNombre,
                                 string UnidadMedida, decimal Cantidad, decimal PrecioUnitario, decimal Subtotal);

    private record EstadoRow(int Id, string Estado);
}

public record CompraCreateRequest(string Proveedor, string Detalle, DateOnly Fecha, int SubAlmacenId);
public record CompraItemUpsertRequest(int MaterialId, decimal Cantidad, decimal PrecioUnitario, string UnidadMedida);
