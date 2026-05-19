using Almacen.Helpers;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Almacen.Controllers;

[ApiController]
[Route("api/movimientos")]
[Authorize(Roles = "admin,almacenero,readonly")]
public class MovimientoController : ControllerBase
{
    private readonly Db _db;

    public MovimientoController(Db db) => _db = db;

    // GET /api/movimientos?materialId=&almacenId=&tipo=&desde=&hasta=&page=1&pageSize=20
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int?      materialId = null,
        [FromQuery] int?      almacenId  = null,
        [FromQuery] string?   tipo       = null,
        [FromQuery] DateOnly? desde      = null,
        [FromQuery] DateOnly? hasta      = null,
        [FromQuery] int       page       = 1,
        [FromQuery] int       pageSize   = 20)
    {
        if (page < 1)       page     = 1;
        if (pageSize < 1)   pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        using var conn = _db.CreateConnection();

        var where = new List<string>();
        var p     = new DynamicParameters();

        if (materialId.HasValue) { where.Add("mv.material_id = @materialId"); p.Add("materialId", materialId); }
        if (almacenId.HasValue)  { where.Add("mv.almacen_id  = @almacenId");  p.Add("almacenId",  almacenId); }
        if (!string.IsNullOrWhiteSpace(tipo)) { where.Add("mv.tipo = @tipo"); p.Add("tipo", tipo.ToLower().Trim()); }
        if (desde.HasValue) { where.Add("mv.fecha >= @desde"); p.Add("desde", desde.Value.ToDateTime(TimeOnly.MinValue)); }
        if (hasta.HasValue) { where.Add("mv.fecha <= @hasta"); p.Add("hasta", hasta.Value.ToDateTime(TimeOnly.MaxValue)); }

        var clausula = where.Count > 0 ? "WHERE " + string.Join(" AND ", where) : "";

        var total = await conn.ExecuteScalarAsync<int>(
            $"SELECT COUNT(*) FROM movimientos mv {clausula}", p);

        p.Add("limit",  pageSize);
        p.Add("offset", (page - 1) * pageSize);

        var items = await conn.QueryAsync<MovimientoRow>(
            $@"SELECT mv.id, mv.tipo,
                      mv.material_id, mat.codigo, mat.nombre AS material_nombre, mat.unidad_medida,
                      mv.almacen_id, alm.nombre AS almacen_nombre,
                      mv.cantidad, mv.costo_unitario,
                      mv.cantidad * mv.costo_unitario AS total,
                      mv.lote_ref, mv.fecha,
                      mv.solicitud_id, mv.compra_item_id,
                      mv.user_id, u.username AS usuario,
                      mv.observacion, mv.created_at
               FROM movimientos mv
               JOIN materiales mat ON mat.id = mv.material_id
               JOIN almacenes  alm ON alm.id = mv.almacen_id
               JOIN users      u   ON u.id   = mv.user_id
               {clausula}
               ORDER BY mv.fecha DESC, mv.id DESC
               LIMIT @limit OFFSET @offset", p);

        return Ok(new { total, page, pageSize, items });
    }

    // POST /api/movimientos/ingreso
    [HttpPost("ingreso")]
    [Authorize(Roles = "admin,almacenero")]
    public async Task<IActionResult> Ingreso([FromBody] IngresoRequest req)
    {
        var err = ValidarMovimiento(req.MaterialId, req.AlmacenId, req.Cantidad);
        if (err is not null) return BadRequest(new { error = err });
        if (req.CostoUnitario < 0) return BadRequest(new { error = "El costo unitario no puede ser negativo" });

        using var conn = _db.CreateConnection();
        conn.Open();
        using var tx = conn.BeginTransaction();

        try
        {
            var (matOk, almOk) = await ValidarExistenciaAsync(conn, tx, req.MaterialId, req.AlmacenId);
            if (!matOk) return BadRequest(new { error = "Material no encontrado o inactivo" });
            if (!almOk) return BadRequest(new { error = "Almacén no encontrado o inactivo" });

            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            var movId = await conn.ExecuteScalarAsync<int>(
                @"INSERT INTO movimientos
                    (tipo, material_id, almacen_id, cantidad, costo_unitario, lote_ref, fecha, user_id, observacion)
                  VALUES
                    ('ingreso', @materialId, @almacenId, @cantidad, @costoUnitario, @loteRef, @fecha, @userId, @obs)
                  RETURNING id",
                new
                {
                    materialId    = req.MaterialId,
                    almacenId     = req.AlmacenId,
                    cantidad      = req.Cantidad,
                    costoUnitario = req.CostoUnitario,
                    loteRef       = req.LoteRef?.Trim(),
                    fecha         = req.Fecha,
                    userId,
                    obs           = req.Observacion?.Trim()
                }, tx);

            // Crear lote PEPS para el ingreso manual
            await conn.ExecuteAsync(
                @"INSERT INTO lotes
                    (material_id, almacen_id, cantidad_inicial, cantidad_disponible, costo_unitario, fecha_ingreso)
                  VALUES
                    (@materialId, @almacenId, @cantidad, @cantidad, @costoUnitario, @fecha)",
                new
                {
                    materialId    = req.MaterialId,
                    almacenId     = req.AlmacenId,
                    cantidad      = req.Cantidad,
                    costoUnitario = req.CostoUnitario,
                    fecha         = req.Fecha
                }, tx);

            tx.Commit();
            return Ok(new { id = movId });
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    // POST /api/movimientos/salida
    [HttpPost("salida")]
    [Authorize(Roles = "admin,almacenero")]
    public async Task<IActionResult> Salida([FromBody] SalidaRequest req)
    {
        var err = ValidarMovimiento(req.MaterialId, req.AlmacenId, req.Cantidad);
        if (err is not null) return BadRequest(new { error = err });

        using var conn = _db.CreateConnection();
        conn.Open();
        using var tx = conn.BeginTransaction();

        try
        {
            var (matOk, almOk) = await ValidarExistenciaAsync(conn, tx, req.MaterialId, req.AlmacenId);
            if (!matOk) return BadRequest(new { error = "Material no encontrado o inactivo" });
            if (!almOk) return BadRequest(new { error = "Almacén no encontrado o inactivo" });

            List<LoteConsumo> consumos;
            try
            {
                consumos = await PepsHelper.ConsumirLotesAsync(conn, tx, req.MaterialId, req.AlmacenId, req.Cantidad);
            }
            catch (InvalidOperationException ex)
            {
                tx.Rollback();
                return BadRequest(new { error = ex.Message });
            }

            var costoPromedio = PepsHelper.CostoPonderado(consumos);
            var userId        = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            var movId = await conn.ExecuteScalarAsync<int>(
                @"INSERT INTO movimientos
                    (tipo, material_id, almacen_id, cantidad, costo_unitario, lote_ref, fecha, user_id, observacion)
                  VALUES
                    ('salida', @materialId, @almacenId, @cantidad, @costoUnitario, @loteRef, @fecha, @userId, @obs)
                  RETURNING id",
                new
                {
                    materialId    = req.MaterialId,
                    almacenId     = req.AlmacenId,
                    cantidad      = req.Cantidad,
                    costoUnitario = costoPromedio,
                    loteRef       = req.LoteRef?.Trim(),
                    fecha         = req.Fecha,
                    userId,
                    obs           = req.Observacion?.Trim()
                }, tx);

            tx.Commit();
            return Ok(new { id = movId, costoUnitario = costoPromedio });
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    private static string? ValidarMovimiento(int materialId, int almacenId, decimal cantidad)
    {
        if (materialId <= 0) return "Material inválido";
        if (almacenId <= 0)  return "Almacén inválido";
        if (cantidad <= 0)   return "La cantidad debe ser mayor a cero";
        return null;
    }

    private static async Task<(bool matOk, bool almOk)> ValidarExistenciaAsync(
        System.Data.IDbConnection conn, System.Data.IDbTransaction tx, int materialId, int almacenId)
    {
        var matOk = await conn.ExecuteScalarAsync<int?>(
            "SELECT id FROM materiales WHERE id = @id AND active = true", new { id = materialId }, tx) is not null;

        var almOk = await conn.ExecuteScalarAsync<int?>(
            "SELECT id FROM almacenes WHERE id = @id AND active = true", new { id = almacenId }, tx) is not null;

        return (matOk, almOk);
    }

    private record MovimientoRow(
        int Id, string Tipo,
        int MaterialId, string Codigo, string MaterialNombre, string UnidadMedida,
        int AlmacenId, string AlmacenNombre,
        decimal Cantidad, decimal CostoUnitario, decimal Total,
        string? LoteRef, DateTime Fecha,
        int? SolicitudId, int? CompraItemId,
        int UserId, string Usuario,
        string? Observacion, DateTime CreatedAt);
}

public record IngresoRequest(
    int      MaterialId,
    int      AlmacenId,
    decimal  Cantidad,
    decimal  CostoUnitario,
    DateOnly Fecha,
    string?  LoteRef      = null,
    string?  Observacion  = null);

public record SalidaRequest(
    int      MaterialId,
    int      AlmacenId,
    decimal  Cantidad,
    DateOnly Fecha,
    string?  LoteRef     = null,
    string?  Observacion = null);
