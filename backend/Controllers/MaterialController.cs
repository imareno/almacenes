using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Almacen.Controllers;

[ApiController]
[Route("api/materiales")]
[Authorize]
public class MaterialController : ControllerBase
{
    private readonly Db _db;

    public MaterialController(Db db) => _db = db;

    // GET /api/materiales?almacenId=&buscar=&categoria=&page=1&pageSize=20
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int?    almacenId   = null,
        [FromQuery] string? buscar      = null,
        [FromQuery] string? categoria   = null,
        [FromQuery] bool    soloActivos = true,
        [FromQuery] int     page        = 1,
        [FromQuery] int     pageSize    = 20)
    {
        if (page < 1)     page     = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 1000) pageSize = 1000;

        using var conn = _db.CreateConnection();

        var where = new List<string>();
        var p     = new DynamicParameters();

        if (soloActivos)
            where.Add("m.active = true");

        if (almacenId.HasValue)
        {
            where.Add("m.almacen_id = @almacenId");
            p.Add("almacenId", almacenId.Value);
        }

        if (!string.IsNullOrWhiteSpace(buscar))
        {
            where.Add("(LOWER(m.nombre) LIKE @buscar OR LOWER(m.codigo) LIKE @buscar)");
            p.Add("buscar", $"%{buscar.ToLower().Trim()}%");
        }

        if (!string.IsNullOrWhiteSpace(categoria))
        {
            where.Add("LOWER(m.categoria) = @categoria");
            p.Add("categoria", categoria.ToLower().Trim());
        }

        var clausula = where.Count > 0 ? "WHERE " + string.Join(" AND ", where) : "";

        var total = await conn.ExecuteScalarAsync<int>(
            $"SELECT COUNT(*) FROM materiales m {clausula}", p);

        p.Add("limit",  pageSize);
        p.Add("offset", (page - 1) * pageSize);

        var items = await conn.QueryAsync<MaterialRow>(
            $@"SELECT m.id, m.codigo, m.nombre, m.descripcion,
                      m.categoria, m.almacen_id, a.nombre AS almacen_nombre,
                      m.active, m.created_at
               FROM materiales m
               LEFT JOIN almacenes a ON a.id = m.almacen_id
               {clausula}
               ORDER BY m.nombre
               LIMIT @limit OFFSET @offset", p);

        return Ok(new { total, page, pageSize, items });
    }

    // GET /api/materiales/{id}
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        using var conn = _db.CreateConnection();

        var material = await conn.QuerySingleOrDefaultAsync<MaterialRow>(
            @"SELECT m.id, m.codigo, m.nombre, m.descripcion,
                     m.categoria, m.almacen_id, a.nombre AS almacen_nombre,
                     m.active, m.created_at
              FROM materiales m
              LEFT JOIN almacenes a ON a.id = m.almacen_id
              WHERE m.id = @id",
            new { id });

        if (material is null) return NotFound(new { error = "Material no encontrado" });
        return Ok(material);
    }

    // GET /api/materiales/{id}/existencia?almacenId=
    [HttpGet("{id:int}/existencia")]
    public async Task<IActionResult> GetExistencia(int id, [FromQuery] int? almacenId = null)
    {
        using var conn = _db.CreateConnection();

        var existe = await conn.ExecuteScalarAsync<int?>(
            "SELECT id FROM materiales WHERE id = @id AND active = true", new { id });

        if (existe is null) return NotFound(new { error = "Material no encontrado" });

        var where = new List<string> { "mv.material_id = @materialId" };
        var p     = new DynamicParameters();
        p.Add("materialId", id);

        if (almacenId.HasValue)
        {
            where.Add("mv.almacen_id = @almacenId");
            p.Add("almacenId", almacenId.Value);
        }

        var clausula = "WHERE " + string.Join(" AND ", where);

        var filas = await conn.QueryAsync<ExistenciaRow>(
            $@"SELECT
                 mv.almacen_id,
                 a.nombre AS almacen_nombre,
                 SUM(CASE WHEN mv.tipo = 'ingreso' THEN mv.cantidad ELSE -mv.cantidad END) AS existencia
               FROM movimientos mv
               JOIN almacenes a ON a.id = mv.almacen_id
               {clausula}
               GROUP BY mv.almacen_id, a.nombre
               HAVING SUM(CASE WHEN mv.tipo = 'ingreso' THEN mv.cantidad ELSE -mv.cantidad END) <> 0
               ORDER BY a.nombre", p);

        return Ok(filas);
    }

    // POST /api/materiales
    [HttpPost]
    [Authorize(Roles = "admin,almacenero")]
    public async Task<IActionResult> Create([FromBody] MaterialUpsertRequest req)
    {
        var err = ValidarRequest(req);
        if (err is not null) return BadRequest(new { error = err });

        using var conn = _db.CreateConnection();

        var codigoExiste = await CodigoDuplicado(conn, req.Codigo, req.AlmacenId, null);
        if (codigoExiste)
            return Conflict(new { error = "Ya existe un material con ese código en este almacén" });

        var almacenExiste = await conn.ExecuteScalarAsync<int?>(
            "SELECT id FROM almacenes WHERE id = @id AND active = true",
            new { id = req.AlmacenId });
        if (almacenExiste is null)
            return BadRequest(new { error = "El almacén especificado no existe" });

        var id = await conn.ExecuteScalarAsync<int>(
            @"INSERT INTO materiales (codigo, nombre, descripcion, categoria, almacen_id)
              VALUES (@codigo, @nombre, @descripcion, @categoria, @almacenId)
              RETURNING id",
            new
            {
                codigo      = req.Codigo.Trim().ToUpper(),
                nombre      = req.Nombre.Trim(),
                descripcion = req.Descripcion?.Trim(),
                categoria   = req.Categoria?.Trim(),
                almacenId   = req.AlmacenId
            });

        return CreatedAtAction(nameof(GetById), new { id }, new { id });
    }

    // PUT /api/materiales/{id}
    [HttpPut("{id:int}")]
    [Authorize(Roles = "admin,almacenero")]
    public async Task<IActionResult> Update(int id, [FromBody] MaterialUpsertRequest req)
    {
        var err = ValidarRequest(req);
        if (err is not null) return BadRequest(new { error = err });

        using var conn = _db.CreateConnection();

        var existe = await conn.ExecuteScalarAsync<int?>(
            "SELECT id FROM materiales WHERE id = @id", new { id });

        if (existe is null) return NotFound(new { error = "Material no encontrado" });

        var codigoDup = await CodigoDuplicado(conn, req.Codigo, req.AlmacenId, id);
        if (codigoDup)
            return Conflict(new { error = "Ya existe otro material con ese código en este almacén" });

        var almacenExiste = await conn.ExecuteScalarAsync<int?>(
            "SELECT id FROM almacenes WHERE id = @id AND active = true",
            new { id = req.AlmacenId });
        if (almacenExiste is null)
            return BadRequest(new { error = "El almacén especificado no existe" });

        await conn.ExecuteAsync(
            @"UPDATE materiales
              SET codigo      = @codigo,
                  nombre      = @nombre,
                  descripcion = @descripcion,
                  categoria   = @categoria,
                  almacen_id  = @almacenId,
                  active      = @active
              WHERE id = @id",
            new
            {
                codigo      = req.Codigo.Trim().ToUpper(),
                nombre      = req.Nombre.Trim(),
                descripcion = req.Descripcion?.Trim(),
                categoria   = req.Categoria?.Trim(),
                almacenId   = req.AlmacenId,
                active      = req.Active,
                id
            });

        return NoContent();
    }

    private static async Task<bool> CodigoDuplicado(
        System.Data.IDbConnection conn, string codigo, int almacenId, int? excludeId)
    {
        var codigoNorm = codigo.Trim().ToLower();

        var sql = "SELECT id FROM materiales WHERE LOWER(codigo) = @codigo AND almacen_id = @almacenId";
        var p = new DynamicParameters();
        p.Add("codigo", codigoNorm);
        p.Add("almacenId", almacenId);

        if (excludeId.HasValue)
        {
            sql += " AND id <> @excludeId";
            p.Add("excludeId", excludeId.Value);
        }

        var found = await conn.ExecuteScalarAsync<int?>(sql, p);
        return found is not null;
    }

    private static string? ValidarRequest(MaterialUpsertRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Codigo)) return "El código es requerido";
        if (string.IsNullOrWhiteSpace(req.Nombre)) return "El nombre es requerido";
        if (req.AlmacenId <= 0) return "El almacén es requerido";
        return null;
    }

    private class MaterialRow
    {
        public int Id { get; set; }
        public string Codigo { get; set; } = "";
        public string Nombre { get; set; } = "";
        public string? Descripcion { get; set; }
        public string? Categoria { get; set; }
        public int AlmacenId { get; set; }
        public string? AlmacenNombre { get; set; }
        public bool Active { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    private record ExistenciaRow(int AlmacenId, string AlmacenNombre, decimal Existencia);
}

public record MaterialUpsertRequest(
    string  Codigo,
    string  Nombre,
    string? Descripcion,
    string? Categoria,
    int     AlmacenId,
    bool    Active = true);
