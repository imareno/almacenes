using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Almacen.Controllers;

[ApiController]
[Route("api/almacenes")]
[Authorize]
public class AlmacenController : ControllerBase
{
    private readonly Db _db;

    public AlmacenController(Db db) => _db = db;

    // GET /api/almacenes/asignados → almacenes con sub-almacenes según rol
    // admin: todos | almacenero: solo los asignados en almacen_encargado
    [HttpGet("asignados")]
    public async Task<IActionResult> GetAsignados()
    {
        using var conn = _db.CreateConnection();
        var role = User.FindFirstValue("role") ?? "";
        var userId = int.Parse(User.FindFirstValue("sub") ?? "0");

        string sqlAlmacenes;
        object paramAlmacenes;

        if (role == "admin")
        {
            sqlAlmacenes = "SELECT id, nombre, descripcion, active FROM almacenes WHERE active = true ORDER BY nombre";
            paramAlmacenes = new { };
        }
        else
        {
            sqlAlmacenes = @"SELECT DISTINCT a.id, a.nombre, a.descripcion, a.active
                             FROM almacenes a
                             JOIN almacen_encargado ae ON ae.almacen_id = a.id
                             WHERE ae.user_id = @userId AND ae.active = true AND a.active = true
                             ORDER BY a.nombre";
            paramAlmacenes = new { userId };
        }

        var almacenes = (await conn.QueryAsync<AlmacenRow>(sqlAlmacenes, paramAlmacenes)).ToList();

        if (almacenes.Count == 0)
            return Ok(Array.Empty<object>());

        var almacenIds = almacenes.Select(a => a.Id).ToList();

        var subAlmacenes = await conn.QueryAsync<SubAlmacenRow>(
            "SELECT id, almacen_id, nombre, sigla, descripcion, active FROM sub_almacenes WHERE almacen_id = ANY(@ids) AND active = true ORDER BY nombre",
            new { ids = almacenIds.ToArray() });

        var subsByAlmacen = subAlmacenes.GroupBy(s => s.AlmacenId).ToDictionary(g => g.Key, g => g.ToList());

        var result = almacenes.Select(a => new
        {
            a.Id,
            a.Nombre,
            a.Descripcion,
            subAlmacenes = subsByAlmacen.GetValueOrDefault(a.Id, new List<SubAlmacenRow>())
                .Select(s => new { s.Id, s.Nombre, s.Sigla })
        });

        return Ok(result);
    }

    // ─── ALMACENES ────────────────────────────────────────────────────────────

    // GET /api/almacenes
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] bool soloActivos = true)
    {
        using var conn = _db.CreateConnection();

        var sql = soloActivos
            ? "SELECT id, nombre, descripcion, active FROM almacenes WHERE active = true ORDER BY nombre"
            : "SELECT id, nombre, descripcion, active FROM almacenes ORDER BY nombre";

        var almacenes = await conn.QueryAsync<AlmacenRow>(sql);
        return Ok(almacenes);
    }

    // GET /api/almacenes/{id}
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        using var conn = _db.CreateConnection();

        var almacen = await conn.QuerySingleOrDefaultAsync<AlmacenRow>(
            "SELECT id, nombre, descripcion, active FROM almacenes WHERE id = @id",
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

        var id = await conn.ExecuteScalarAsync<int>(
            @"INSERT INTO almacenes (nombre, descripcion)
              VALUES (@nombre, @descripcion)
              RETURNING id",
            new { nombre = req.Nombre.Trim(), descripcion = req.Descripcion?.Trim() });

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

        await conn.ExecuteAsync(
            @"UPDATE almacenes
              SET nombre      = @nombre,
                  descripcion = @descripcion
              WHERE id = @id",
            new { nombre = req.Nombre.Trim(), descripcion = req.Descripcion?.Trim(), id });

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

        var tieneSubAlmacenes = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM sub_almacenes WHERE almacen_id = @id AND active = true", new { id });

        if (tieneSubAlmacenes > 0)
            return Conflict(new { error = "No se puede eliminar un almacén que tiene sub-almacenes activos" });

        await conn.ExecuteAsync(
            "UPDATE almacenes SET active = false WHERE id = @id",
            new { id });

        return NoContent();
    }

    // ─── SUB-ALMACENES ────────────────────────────────────────────────────────

    // GET /api/almacenes/{almacenId}/sub-almacenes
    [HttpGet("{almacenId:int}/sub-almacenes")]
    public async Task<IActionResult> GetSubAlmacenes(int almacenId, [FromQuery] bool soloActivos = true)
    {
        using var conn = _db.CreateConnection();

        var sql = soloActivos
            ? "SELECT id, almacen_id, nombre, sigla, descripcion, active FROM sub_almacenes WHERE almacen_id = @almacenId AND active = true ORDER BY nombre"
            : "SELECT id, almacen_id, nombre, sigla, descripcion, active FROM sub_almacenes WHERE almacen_id = @almacenId ORDER BY nombre";

        var subs = await conn.QueryAsync<SubAlmacenRow>(sql, new { almacenId });
        return Ok(subs);
    }

    // POST /api/almacenes/{almacenId}/sub-almacenes
    [HttpPost("{almacenId:int}/sub-almacenes")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> CreateSubAlmacen(int almacenId, [FromBody] SubAlmacenUpsertRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Nombre))
            return BadRequest(new { error = "El nombre es requerido" });

        using var conn = _db.CreateConnection();

        var padre = await conn.ExecuteScalarAsync<int?>(
            "SELECT id FROM almacenes WHERE id = @almacenId AND active = true",
            new { almacenId });

        if (padre is null)
            return NotFound(new { error = "Almacén padre no encontrado" });

        try
        {
            var id = await conn.ExecuteScalarAsync<int>(
                @"INSERT INTO sub_almacenes (almacen_id, nombre, sigla, descripcion)
                  VALUES (@almacenId, @nombre, @sigla, @descripcion)
                  RETURNING id",
                new { almacenId, nombre = req.Nombre.Trim(), sigla = req.Sigla?.Trim(), descripcion = req.Descripcion?.Trim() });

            return Created($"/api/almacenes/{almacenId}/sub-almacenes/{id}", new { id });
        }
        catch (Npgsql.PostgresException ex) when (ex.SqlState == "23505")
        {
            return Conflict(new { error = "Ya existe un sub-almacén con esa sigla en este almacén" });
        }
    }

    // PUT /api/almacenes/{almacenId}/sub-almacenes/{id}
    [HttpPut("{almacenId:int}/sub-almacenes/{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> UpdateSubAlmacen(int almacenId, int id, [FromBody] SubAlmacenUpsertRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Nombre))
            return BadRequest(new { error = "El nombre es requerido" });

        using var conn = _db.CreateConnection();

        var existe = await conn.ExecuteScalarAsync<int?>(
            "SELECT id FROM sub_almacenes WHERE id = @id AND almacen_id = @almacenId",
            new { id, almacenId });

        if (existe is null) return NotFound(new { error = "Sub-almacén no encontrado" });

        await conn.ExecuteAsync(
            @"UPDATE sub_almacenes
              SET nombre      = @nombre,
                  sigla       = @sigla,
                  descripcion = @descripcion
              WHERE id = @id",
            new { nombre = req.Nombre.Trim(), sigla = req.Sigla?.Trim(), descripcion = req.Descripcion?.Trim(), id });

        return NoContent();
    }

    // DELETE /api/almacenes/{almacenId}/sub-almacenes/{id}  → baja lógica
    [HttpDelete("{almacenId:int}/sub-almacenes/{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> DeleteSubAlmacen(int almacenId, int id)
    {
        using var conn = _db.CreateConnection();

        var existe = await conn.ExecuteScalarAsync<int?>(
            "SELECT id FROM sub_almacenes WHERE id = @id AND almacen_id = @almacenId AND active = true",
            new { id, almacenId });

        if (existe is null) return NotFound(new { error = "Sub-almacén no encontrado o ya inactivo" });

        var tieneCompras = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM compras WHERE sub_almacen_id = @id AND active = true", new { id });

        if (tieneCompras > 0)
            return Conflict(new { error = "No se puede eliminar un sub-almacén que tiene compras registradas" });

        var tieneSolicitudes = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM solicitudes WHERE sub_almacen_id = @id AND active = true", new { id });

        if (tieneSolicitudes > 0)
            return Conflict(new { error = "No se puede eliminar un sub-almacén que tiene solicitudes registradas" });

        await conn.ExecuteAsync(
            "UPDATE sub_almacenes SET active = false WHERE id = @id",
            new { id });

        return NoContent();
    }

    private record AlmacenRow(int Id, string Nombre, string? Descripcion, bool Active);
    private record SubAlmacenRow(int Id, int AlmacenId, string Nombre, string? Sigla, string? Descripcion, bool Active);
}

public record AlmacenUpsertRequest(string Nombre, string? Descripcion);
public record SubAlmacenUpsertRequest(string Nombre, string? Sigla, string? Descripcion);
