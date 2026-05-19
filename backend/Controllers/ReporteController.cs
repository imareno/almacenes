using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Almacen.Controllers;

[ApiController]
[Route("api/reportes")]
[Authorize(Roles = "admin,almacenero,readonly")]
public class ReporteController : ControllerBase
{
    private readonly Db _db;

    public ReporteController(Db db) => _db = db;

    // GET /api/reportes/existencias?almacenId=&categoria=&soloConStock=true
    [HttpGet("existencias")]
    public async Task<IActionResult> Existencias(
        [FromQuery] int?    almacenId    = null,
        [FromQuery] string? categoria    = null,
        [FromQuery] bool    soloConStock = true)
    {
        using var conn = _db.CreateConnection();

        var where = new List<string> { "m.active = true" };
        var p     = new DynamicParameters();

        if (almacenId.HasValue) { where.Add("mv.almacen_id = @almacenId"); p.Add("almacenId", almacenId.Value); }
        if (!string.IsNullOrWhiteSpace(categoria)) { where.Add("LOWER(m.categoria) = @cat"); p.Add("cat", categoria.ToLower().Trim()); }

        var having = soloConStock ? "HAVING SUM(CASE WHEN mv.tipo = 'ingreso' THEN mv.cantidad ELSE -mv.cantidad END) > 0" : "";

        var filas = await conn.QueryAsync<ExistenciaReporteRow>(
            $@"SELECT
                 mv.material_id,
                 m.codigo,
                 m.nombre        AS material_nombre,
                 m.unidad_medida,
                 m.categoria,
                 mv.almacen_id,
                 a.nombre        AS almacen_nombre,
                 SUM(CASE WHEN mv.tipo = 'ingreso' THEN mv.cantidad ELSE -mv.cantidad END) AS existencia
               FROM movimientos mv
               JOIN materiales m ON m.id = mv.material_id
               JOIN almacenes  a ON a.id = mv.almacen_id
               WHERE {string.Join(" AND ", where)}
               GROUP BY mv.material_id, m.codigo, m.nombre, m.unidad_medida, m.categoria,
                        mv.almacen_id, a.nombre
               {having}
               ORDER BY m.nombre, a.nombre", p);

        return Ok(filas);
    }

    // GET /api/reportes/kardex/{materialId}?almacenId=&desde=&hasta=
    [HttpGet("kardex/{materialId:int}")]
    public async Task<IActionResult> Kardex(
        int               materialId,
        [FromQuery] int?      almacenId = null,
        [FromQuery] DateOnly? desde     = null,
        [FromQuery] DateOnly? hasta     = null)
    {
        using var conn = _db.CreateConnection();

        var material = await conn.QuerySingleOrDefaultAsync<MaterialResumen>(
            "SELECT id, codigo, nombre, unidad_medida FROM materiales WHERE id = @id",
            new { id = materialId });

        if (material is null) return NotFound(new { error = "Material no encontrado" });

        var where = new List<string> { "mv.material_id = @materialId" };
        var p     = new DynamicParameters();
        p.Add("materialId", materialId);

        if (almacenId.HasValue) { where.Add("mv.almacen_id = @almacenId"); p.Add("almacenId", almacenId.Value); }
        if (desde.HasValue) { where.Add("mv.fecha >= @desde"); p.Add("desde", desde.Value.ToDateTime(TimeOnly.MinValue)); }
        if (hasta.HasValue) { where.Add("mv.fecha <= @hasta"); p.Add("hasta", hasta.Value.ToDateTime(TimeOnly.MaxValue)); }

        var clausula = "WHERE " + string.Join(" AND ", where);

        // Saldo acumulado con window function OVER (PARTITION BY almacén ORDER BY fecha, id)
        var movimientos = await conn.QueryAsync<KardexRow>(
            $@"SELECT
                 mv.id,
                 mv.tipo,
                 mv.almacen_id,
                 a.nombre          AS almacen_nombre,
                 mv.fecha,
                 mv.cantidad,
                 mv.costo_unitario,
                 mv.cantidad * mv.costo_unitario                            AS total,
                 mv.lote_ref,
                 mv.solicitud_id,
                 mv.compra_item_id,
                 u.username         AS usuario,
                 mv.observacion,
                 SUM(CASE WHEN mv.tipo = 'ingreso' THEN mv.cantidad ELSE -mv.cantidad END)
                   OVER (PARTITION BY mv.almacen_id ORDER BY mv.fecha, mv.id
                         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS saldo
               FROM movimientos mv
               JOIN almacenes a ON a.id = mv.almacen_id
               JOIN users     u ON u.id = mv.user_id
               {clausula}
               ORDER BY mv.almacen_id, mv.fecha, mv.id", p);

        return Ok(new { material, movimientos });
    }

    // GET /api/reportes/valorizado?almacenId=&categoria=
    [HttpGet("valorizado")]
    public async Task<IActionResult> Valorizado(
        [FromQuery] int?    almacenId = null,
        [FromQuery] string? categoria = null)
    {
        using var conn = _db.CreateConnection();

        var where = new List<string> { "l.cantidad_disponible > 0", "m.active = true" };
        var p     = new DynamicParameters();

        if (almacenId.HasValue) { where.Add("l.almacen_id = @almacenId"); p.Add("almacenId", almacenId.Value); }
        if (!string.IsNullOrWhiteSpace(categoria)) { where.Add("LOWER(m.categoria) = @cat"); p.Add("cat", categoria.ToLower().Trim()); }

        var clausula = "WHERE " + string.Join(" AND ", where);

        var filas = await conn.QueryAsync<ValorizadoRow>(
            $@"SELECT
                 l.material_id,
                 m.codigo,
                 m.nombre        AS material_nombre,
                 m.unidad_medida,
                 m.categoria,
                 l.almacen_id,
                 a.nombre        AS almacen_nombre,
                 SUM(l.cantidad_disponible)                          AS cantidad,
                 SUM(l.cantidad_disponible * l.costo_unitario)       AS valor_total,
                 CASE WHEN SUM(l.cantidad_disponible) = 0 THEN 0
                      ELSE SUM(l.cantidad_disponible * l.costo_unitario)
                           / SUM(l.cantidad_disponible) END          AS costo_promedio
               FROM lotes l
               JOIN materiales m ON m.id = l.material_id
               JOIN almacenes  a ON a.id = l.almacen_id
               {clausula}
               GROUP BY l.material_id, m.codigo, m.nombre, m.unidad_medida, m.categoria,
                        l.almacen_id, a.nombre
               ORDER BY m.nombre, a.nombre", p);

        var total = filas.Sum(f => f.ValorTotal);
        return Ok(new { total, items = filas });
    }

    // GET /api/reportes/compras?estado=&desde=&hasta=
    [HttpGet("compras")]
    public async Task<IActionResult> Compras(
        [FromQuery] string?   estado = null,
        [FromQuery] DateOnly? desde  = null,
        [FromQuery] DateOnly? hasta  = null)
    {
        using var conn = _db.CreateConnection();

        var where = new List<string>();
        var p     = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(estado)) { where.Add("c.estado = @estado"); p.Add("estado", estado.ToLower().Trim()); }
        if (desde.HasValue) { where.Add("c.fecha >= @desde"); p.Add("desde", desde.Value.ToDateTime(TimeOnly.MinValue)); }
        if (hasta.HasValue) { where.Add("c.fecha <= @hasta"); p.Add("hasta", hasta.Value.ToDateTime(TimeOnly.MaxValue)); }

        var clausula = where.Count > 0 ? "WHERE " + string.Join(" AND ", where) : "";

        var filas = await conn.QueryAsync<CompraReporteRow>(
            $@"SELECT
                 c.id,
                 c.numero,
                 c.proveedor,
                 c.fecha,
                 c.estado,
                 u.username        AS usuario,
                 COUNT(ci.id)      AS total_items,
                 SUM(ci.cantidad * ci.precio_unitario) AS monto_total
               FROM compras c
               JOIN users       u  ON u.id  = c.user_id
               LEFT JOIN compra_items ci ON ci.compra_id = c.id
               {clausula}
               GROUP BY c.id, c.numero, c.proveedor, c.fecha, c.estado, u.username
               ORDER BY c.fecha DESC, c.id DESC", p);

        var montoTotal = filas.Sum(f => f.MontoTotal ?? 0);
        return Ok(new { montoTotal, items = filas });
    }

    // GET /api/reportes/movimientos?almacenId=&materialId=&tipo=&desde=&hasta=
    [HttpGet("movimientos")]
    public async Task<IActionResult> Movimientos(
        [FromQuery] int?      almacenId  = null,
        [FromQuery] int?      materialId = null,
        [FromQuery] string?   tipo       = null,
        [FromQuery] DateOnly? desde      = null,
        [FromQuery] DateOnly? hasta      = null)
    {
        using var conn = _db.CreateConnection();

        var where = new List<string>();
        var p     = new DynamicParameters();

        if (almacenId.HasValue)  { where.Add("mv.almacen_id  = @almacenId");  p.Add("almacenId",  almacenId.Value); }
        if (materialId.HasValue) { where.Add("mv.material_id = @materialId"); p.Add("materialId", materialId.Value); }
        if (!string.IsNullOrWhiteSpace(tipo)) { where.Add("mv.tipo = @tipo"); p.Add("tipo", tipo.ToLower().Trim()); }
        if (desde.HasValue) { where.Add("mv.fecha >= @desde"); p.Add("desde", desde.Value.ToDateTime(TimeOnly.MinValue)); }
        if (hasta.HasValue) { where.Add("mv.fecha <= @hasta"); p.Add("hasta", hasta.Value.ToDateTime(TimeOnly.MaxValue)); }

        var clausula = where.Count > 0 ? "WHERE " + string.Join(" AND ", where) : "";

        var filas = await conn.QueryAsync<MovimientoReporteRow>(
            $@"SELECT
                 mv.id,
                 mv.tipo,
                 mv.fecha,
                 mv.material_id,
                 m.codigo,
                 m.nombre        AS material_nombre,
                 m.unidad_medida,
                 mv.almacen_id,
                 a.nombre        AS almacen_nombre,
                 mv.cantidad,
                 mv.costo_unitario,
                 mv.cantidad * mv.costo_unitario AS total,
                 mv.observacion,
                 u.username      AS usuario
               FROM movimientos mv
               JOIN materiales m ON m.id = mv.material_id
               JOIN almacenes  a ON a.id = mv.almacen_id
               JOIN users      u ON u.id = mv.user_id
               {clausula}
               ORDER BY mv.fecha DESC, mv.id DESC", p);

        var resumen = filas
            .GroupBy(f => f.Tipo)
            .Select(g => new
            {
                tipo          = g.Key,
                totalCantidad = g.Sum(x => x.Cantidad),
                totalValor    = g.Sum(x => x.Total)
            });

        return Ok(new { resumen, movimientos = filas });
    }

    // ── Tipos internos ─────────────────────────────────────────
    private record ExistenciaReporteRow(
        int MaterialId, string Codigo, string MaterialNombre, string UnidadMedida, string? Categoria,
        int AlmacenId, string AlmacenNombre, decimal Existencia);

    private record MaterialResumen(int Id, string Codigo, string Nombre, string UnidadMedida);

    private record KardexRow(
        int Id, string Tipo,
        int AlmacenId, string AlmacenNombre,
        DateTime Fecha, decimal Cantidad, decimal CostoUnitario, decimal Total,
        string? LoteRef, int? SolicitudId, int? CompraItemId,
        string Usuario, string? Observacion, decimal Saldo);

    private record ValorizadoRow(
        int MaterialId, string Codigo, string MaterialNombre, string UnidadMedida, string? Categoria,
        int AlmacenId, string AlmacenNombre,
        decimal Cantidad, decimal ValorTotal, decimal CostoPromedio);

    private record CompraReporteRow(
        int Id, string Numero, string Proveedor, DateTime Fecha, string Estado,
        string Usuario, int TotalItems, decimal? MontoTotal);

    private record MovimientoReporteRow(
        int Id, string Tipo, DateTime Fecha,
        int MaterialId, string Codigo, string MaterialNombre, string UnidadMedida,
        int AlmacenId, string AlmacenNombre,
        decimal Cantidad, decimal CostoUnitario, decimal Total,
        string? Observacion, string Usuario);
}
