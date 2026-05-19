using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Almacen.Controllers;

[ApiController]
[Route("api/almacenes")]
[Authorize]
public class AlmacenController : ControllerBase
{
    private readonly Db _db;

    public AlmacenController(Db db) => _db = db;

    // GET /api/almacenes
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] bool soloActivos = true)
    {
        using var conn = _db.CreateConnection();

        var sql = soloActivos
            ? "SELECT id, nombre, descripcion, parent_id, active FROM almacenes WHERE active = true ORDER BY nombre"
            : "SELECT id, nombre, descripcion, parent_id, active FROM almacenes ORDER BY nombre";

        var almacenes = await conn.QueryAsync<AlmacenRow>(sql);
        return Ok(almacenes);
    }

    // GET /api/almacenes/{id}
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        using var conn = _db.CreateConnection();

        var almacen = await conn.QuerySingleOrDefaultAsync<AlmacenRow>(
            "SELECT id, nombre, descripcion, parent_id, active FROM almacenes WHERE id = @id",
            new { id });

        if (almacen is null) return NotFound(new { error = "Almacén no encontrado" });
        return Ok(almacen);
    }

    // POST /api/almacenes
    [HttpPost]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Create([FromBody] AlmacenUpsertRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Nombre))
            return BadRequest(new { error = "El nombre es requerido" });

        using var conn = _db.CreateConnection();

        if (req.ParentId.HasValue)
        {
            var padre = await conn.ExecuteScalarAsync<int?>(
                "SELECT id FROM almacenes WHERE id = @id AND active = true",
                new { id = req.ParentId.Value });

            if (padre is null)
                return BadRequest(new { error = "El almacén padre no existe o está inactivo" });
        }

        var id = await conn.ExecuteScalarAsync<int>(
            @"INSERT INTO almacenes (nombre, descripcion, parent_id)
              VALUES (@nombre, @descripcion, @parentId)
              RETURNING id",
            new { nombre = req.Nombre.Trim(), descripcion = req.Descripcion?.Trim(), parentId = req.ParentId });

        return CreatedAtAction(nameof(GetById), new { id }, new { id });
    }

    // PUT /api/almacenes/{id}
    [HttpPut("{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Update(int id, [FromBody] AlmacenUpsertRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Nombre))
            return BadRequest(new { error = "El nombre es requerido" });

        using var conn = _db.CreateConnection();

        var existe = await conn.ExecuteScalarAsync<int?>(
            "SELECT id FROM almacenes WHERE id = @id",
            new { id });

        if (existe is null) return NotFound(new { error = "Almacén no encontrado" });

        // Evitar ciclos: el parent no puede ser el mismo almacén ni un descendiente
        if (req.ParentId.HasValue)
        {
            if (req.ParentId.Value == id)
                return BadRequest(new { error = "Un almacén no puede ser su propio padre" });

            var esDescendiente = await EsDescendienteAsync(conn, req.ParentId.Value, id);
            if (esDescendiente)
                return BadRequest(new { error = "El padre seleccionado es un descendiente del almacén actual" });
        }

        await conn.ExecuteAsync(
            @"UPDATE almacenes
              SET nombre      = @nombre,
                  descripcion = @descripcion,
                  parent_id   = @parentId
              WHERE id = @id",
            new { nombre = req.Nombre.Trim(), descripcion = req.Descripcion?.Trim(), parentId = req.ParentId, id });

        return NoContent();
    }

    // DELETE /api/almacenes/{id}  → baja lógica
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Delete(int id)
    {
        using var conn = _db.CreateConnection();

        var existe = await conn.ExecuteScalarAsync<int?>(
            "SELECT id FROM almacenes WHERE id = @id AND active = true",
            new { id });

        if (existe is null) return NotFound(new { error = "Almacén no encontrado o ya inactivo" });

        // No borrar si tiene movimientos o solicitudes asociadas
        var tieneMovimientos = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM movimientos WHERE almacen_id = @id", new { id });

        if (tieneMovimientos > 0)
            return Conflict(new { error = "No se puede eliminar un almacén con movimientos registrados" });

        var tieneSolicitudes = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM solicitudes WHERE almacen_id = @id", new { id });

        if (tieneSolicitudes > 0)
            return Conflict(new { error = "No se puede eliminar un almacén con solicitudes registradas" });

        // Desactivar también los hijos directos
        await conn.ExecuteAsync(
            "UPDATE almacenes SET active = false WHERE id = @id OR parent_id = @id",
            new { id });

        return NoContent();
    }

    // Comprueba si candidatoId es descendiente de raizId
    private static async Task<bool> EsDescendienteAsync(System.Data.IDbConnection conn, int candidatoId, int raizId)
    {
        var parentId = await conn.ExecuteScalarAsync<int?>(
            "SELECT parent_id FROM almacenes WHERE id = @id",
            new { id = candidatoId });

        while (parentId.HasValue)
        {
            if (parentId.Value == raizId) return true;
            parentId = await conn.ExecuteScalarAsync<int?>(
                "SELECT parent_id FROM almacenes WHERE id = @id",
                new { id = parentId.Value });
        }
        return false;
    }

    private record AlmacenRow(int Id, string Nombre, string? Descripcion, int? ParentId, bool Active);
}

public record AlmacenUpsertRequest(string Nombre, string? Descripcion, int? ParentId);
