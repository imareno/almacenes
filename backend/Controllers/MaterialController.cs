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

    // GET /api/materiales?buscar=&categoria=&page=1&pageSize=20
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string?  buscar     = null,
        [FromQuery] string?  categoria  = null,
        [FromQuery] bool     soloActivos = true,
        [FromQuery] int      page       = 1,
        [FromQuery] int      pageSize   = 20)
    {
        if (page < 1)     page     = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        using var conn = _db.CreateConnection();

        var where = new List<string>();
        var p     = new DynamicParameters();

        if (soloActivos)
            where.Add("active = true");

        if (!string.IsNullOrWhiteSpace(buscar))
        {
            where.Add("(LOWER(nombre) LIKE @buscar OR LOWER(codigo) LIKE @buscar)");
            p.Add("buscar", $"%{buscar.ToLower().Trim()}%");
        }

        if (!string.IsNullOrWhiteSpace(categoria))
        {
            where.Add("LOWER(categoria) = @categoria");
            p.Add("categoria", categoria.ToLower().Trim());
        }

        var clausula = where.Count > 0 ? "WHERE " + string.Join(" AND ", where) : "";

        var total = await conn.ExecuteScalarAsync<int>(
            $"SELECT COUNT(*) FROM materiales {clausula}", p);

        p.Add("limit",  pageSize);
        p.Add("offset", (page - 1) * pageSize);

        var items = await conn.QueryAsync<MaterialRow>(
            $@"SELECT id, codigo, nombre, descripcion, unidad_medida, categoria, active, created_at
               FROM materiales {clausula}
               ORDER BY nombre
               LIMIT @limit OFFSET @offset", p);

        return Ok(new { total, page, pageSize, items });
    }

    // GET /api/materiales/{id}
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        using var conn = _db.CreateConnection();

        var material = await conn.QuerySingleOrDefaultAsync<MaterialRow>(
            "SELECT id, codigo, nombre, descripcion, unidad_medida, categoria, active, created_at FROM materiales WHERE id = @id",
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

        var where = new List<string> { "m.material_id = @materialId" };
        var p     = new DynamicParameters();
        p.Add("materialId", id);

        if (almacenId.HasValue)
        {
            where.Add("m.almacen_id = @almacenId");
            p.Add("almacenId", almacenId.Value);
        }

        var clausula = "WHERE " + string.Join(" AND ", where);

        var filas = await conn.QueryAsync<ExistenciaRow>(
            $@"SELECT
                 m.almacen_id,
                 a.nombre AS almacen_nombre,
                 SUM(CASE WHEN m.tipo = 'ingreso' THEN m.cantidad ELSE -m.cantidad END) AS existencia
               FROM movimientos m
               JOIN almacenes a ON a.id = m.almacen_id
               {clausula}
               GROUP BY m.almacen_id, a.nombre
               HAVING SUM(CASE WHEN m.tipo = 'ingreso' THEN m.cantidad ELSE -m.cantidad END) <> 0
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

        var codigoExiste = await conn.ExecuteScalarAsync<int?>(
            "SELECT id FROM materiales WHERE LOWER(codigo) = LOWER(@codigo)",
            new { codigo = req.Codigo.Trim() });

        if (codigoExiste is not null)
            return Conflict(new { error = "Ya existe un material con ese código" });

        var id = await conn.ExecuteScalarAsync<int>(
            @"INSERT INTO materiales (codigo, nombre, descripcion, unidad_medida, categoria)
              VALUES (@codigo, @nombre, @descripcion, @unidadMedida, @categoria)
              RETURNING id",
            new
            {
                codigo       = req.Codigo.Trim().ToUpper(),
                nombre       = req.Nombre.Trim(),
                descripcion  = req.Descripcion?.Trim(),
                unidadMedida = req.UnidadMedida.Trim().ToUpper(),
                categoria    = req.Categoria?.Trim()
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

        var codigoDuplicado = await conn.ExecuteScalarAsync<int?>(
            "SELECT id FROM materiales WHERE LOWER(codigo) = LOWER(@codigo) AND id <> @id",
            new { codigo = req.Codigo.Trim(), id });

        if (codigoDuplicado is not null)
            return Conflict(new { error = "Ya existe otro material con ese código" });

        await conn.ExecuteAsync(
            @"UPDATE materiales
              SET codigo        = @codigo,
                  nombre        = @nombre,
                  descripcion   = @descripcion,
                  unidad_medida = @unidadMedida,
                  categoria     = @categoria,
                  active        = @active
              WHERE id = @id",
            new
            {
                codigo       = req.Codigo.Trim().ToUpper(),
                nombre       = req.Nombre.Trim(),
                descripcion  = req.Descripcion?.Trim(),
                unidadMedida = req.UnidadMedida.Trim().ToUpper(),
                categoria    = req.Categoria?.Trim(),
                active       = req.Active,
                id
            });

        return NoContent();
    }

    private static string? ValidarRequest(MaterialUpsertRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Codigo))      return "El código es requerido";
        if (string.IsNullOrWhiteSpace(req.Nombre))      return "El nombre es requerido";
        if (string.IsNullOrWhiteSpace(req.UnidadMedida)) return "La unidad de medida es requerida";
        return null;
    }

    private record MaterialRow(int Id, string Codigo, string Nombre, string? Descripcion,
                               string UnidadMedida, string? Categoria, bool Active, DateTime CreatedAt);

    private record ExistenciaRow(int AlmacenId, string AlmacenNombre, decimal Existencia);
}

public record MaterialUpsertRequest(
    string  Codigo,
    string  Nombre,
    string? Descripcion,
    string  UnidadMedida,
    string? Categoria,
    bool    Active = true);
