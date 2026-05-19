using Almacen.Helpers;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Almacen.Controllers;

[ApiController]
[Route("api/solicitudes")]
[Authorize]
public class SolicitudController : ControllerBase
{
    private readonly Db _db;

    public SolicitudController(Db db) => _db = db;

    // GET /api/solicitudes?estado=&almacenId=&solicitanteId=&page=1&pageSize=20
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? estado       = null,
        [FromQuery] int?    almacenId    = null,
        [FromQuery] int?    solicitanteId = null,
        [FromQuery] int     page         = 1,
        [FromQuery] int     pageSize     = 20)
    {
        if (page < 1)       page     = 1;
        if (pageSize < 1)   pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var role   = User.FindFirstValue(ClaimTypes.Role)!;

        using var conn = _db.CreateConnection();

        var where = new List<string>();
        var p     = new DynamicParameters();

        // Solicitante solo ve sus propias solicitudes
        if (role == "solicitante")
        {
            where.Add("s.solicitante_id = @userId");
            p.Add("userId", userId);
        }
        else if (solicitanteId.HasValue)
        {
            where.Add("s.solicitante_id = @solicitanteId");
            p.Add("solicitanteId", solicitanteId.Value);
        }

        if (!string.IsNullOrWhiteSpace(estado))
        {
            where.Add("s.estado = @estado");
            p.Add("estado", estado.ToLower().Trim());
        }

        if (almacenId.HasValue)
        {
            where.Add("s.almacen_id = @almacenId");
            p.Add("almacenId", almacenId.Value);
        }

        var clausula = where.Count > 0 ? "WHERE " + string.Join(" AND ", where) : "";

        var total = await conn.ExecuteScalarAsync<int>(
            $"SELECT COUNT(*) FROM solicitudes s {clausula}", p);

        p.Add("limit",  pageSize);
        p.Add("offset", (page - 1) * pageSize);

        var items = await conn.QueryAsync<SolicitudRow>(
            $@"SELECT s.id, s.numero, s.estado,
                      s.solicitante_id, us.username AS solicitante,
                      s.almacen_id, a.nombre AS almacen_nombre,
                      s.aprobador_id, ua.username AS aprobador,
                      s.almacenero_id, ual.username AS almacenero,
                      s.fecha_solicitud, s.fecha_aprobacion, s.fecha_despacho, s.fecha_entrega,
                      s.observacion, s.created_at
               FROM solicitudes s
               JOIN users    us  ON us.id  = s.solicitante_id
               JOIN almacenes a  ON a.id   = s.almacen_id
               LEFT JOIN users ua  ON ua.id  = s.aprobador_id
               LEFT JOIN users ual ON ual.id = s.almacenero_id
               {clausula}
               ORDER BY s.created_at DESC
               LIMIT @limit OFFSET @offset", p);

        return Ok(new { total, page, pageSize, items });
    }

    // GET /api/solicitudes/{id}
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var role   = User.FindFirstValue(ClaimTypes.Role)!;

        using var conn = _db.CreateConnection();

        var solicitud = await conn.QuerySingleOrDefaultAsync<SolicitudRow>(
            @"SELECT s.id, s.numero, s.estado,
                     s.solicitante_id, us.username AS solicitante,
                     s.almacen_id, a.nombre AS almacen_nombre,
                     s.aprobador_id, ua.username AS aprobador,
                     s.almacenero_id, ual.username AS almacenero,
                     s.fecha_solicitud, s.fecha_aprobacion, s.fecha_despacho, s.fecha_entrega,
                     s.observacion, s.created_at
              FROM solicitudes s
              JOIN users     us  ON us.id  = s.solicitante_id
              JOIN almacenes a   ON a.id   = s.almacen_id
              LEFT JOIN users ua  ON ua.id  = s.aprobador_id
              LEFT JOIN users ual ON ual.id = s.almacenero_id
              WHERE s.id = @id",
            new { id });

        if (solicitud is null) return NotFound(new { error = "Solicitud no encontrada" });

        if (role == "solicitante" && solicitud.SolicitanteId != userId)
            return Forbid();

        var items = await conn.QueryAsync<SolicitudItemRow>(
            @"SELECT si.id, si.material_id, m.codigo, m.nombre AS material_nombre, m.unidad_medida,
                     si.cantidad_solicitada, si.cantidad_despachada, si.cantidad_entregada
              FROM solicitud_items si
              JOIN materiales m ON m.id = si.material_id
              WHERE si.solicitud_id = @id
              ORDER BY m.nombre",
            new { id });

        return Ok(new { solicitud, items });
    }

    // POST /api/solicitudes
    [HttpPost]
    [Authorize(Roles = "admin,solicitante")]
    public async Task<IActionResult> Create([FromBody] SolicitudCreateRequest req)
    {
        if (req.Items is null || req.Items.Count == 0)
            return BadRequest(new { error = "La solicitud debe tener al menos un ítem" });

        using var conn = _db.CreateConnection();
        conn.Open();
        using var tx = conn.BeginTransaction();

        try
        {
            var almacenExiste = await conn.ExecuteScalarAsync<int?>(
                "SELECT id FROM almacenes WHERE id = @id AND active = true",
                new { id = req.AlmacenId }, tx);

            if (almacenExiste is null)
                return BadRequest(new { error = "Almacén no encontrado o inactivo" });

            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            // Insertar con numero temporal; actualizar con ID formateado
            var solId = await conn.ExecuteScalarAsync<int>(
                @"INSERT INTO solicitudes (numero, solicitante_id, almacen_id, observacion)
                  VALUES ('TEMP', @userId, @almacenId, @obs)
                  RETURNING id",
                new { userId, almacenId = req.AlmacenId, obs = req.Observacion?.Trim() }, tx);

            var numero = $"SOL-{DateTime.UtcNow:yyyy}-{solId:D6}";
            await conn.ExecuteAsync(
                "UPDATE solicitudes SET numero = @numero WHERE id = @id",
                new { numero, id = solId }, tx);

            foreach (var item in req.Items)
            {
                if (item.Cantidad <= 0)
                    return BadRequest(new { error = "La cantidad solicitada debe ser mayor a cero" });

                var matExiste = await conn.ExecuteScalarAsync<int?>(
                    "SELECT id FROM materiales WHERE id = @id AND active = true",
                    new { id = item.MaterialId }, tx);

                if (matExiste is null)
                    return BadRequest(new { error = $"Material {item.MaterialId} no encontrado o inactivo" });

                await conn.ExecuteAsync(
                    @"INSERT INTO solicitud_items (solicitud_id, material_id, cantidad_solicitada)
                      VALUES (@solId, @materialId, @cantidad)",
                    new { solId, materialId = item.MaterialId, cantidad = item.Cantidad }, tx);
            }

            tx.Commit();
            return CreatedAtAction(nameof(GetById), new { id = solId }, new { id = solId, numero });
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    // PUT /api/solicitudes/{id}/aprobar
    [HttpPut("{id:int}/aprobar")]
    [Authorize(Roles = "admin,aprobador")]
    public async Task<IActionResult> Aprobar(int id)
    {
        using var conn = _db.CreateConnection();

        var sol = await conn.QuerySingleOrDefaultAsync<SolEstado>(
            "SELECT id, estado FROM solicitudes WHERE id = @id", new { id });

        if (sol is null) return NotFound(new { error = "Solicitud no encontrada" });
        if (sol.Estado != "pendiente")
            return BadRequest(new { error = $"Solo se puede aprobar una solicitud pendiente. Estado actual: {sol.Estado}" });

        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        await conn.ExecuteAsync(
            @"UPDATE solicitudes
              SET estado = 'aprobada', aprobador_id = @userId, fecha_aprobacion = CURRENT_DATE
              WHERE id = @id",
            new { userId, id });

        return NoContent();
    }

    // PUT /api/solicitudes/{id}/rechazar
    [HttpPut("{id:int}/rechazar")]
    [Authorize(Roles = "admin,aprobador")]
    public async Task<IActionResult> Rechazar(int id, [FromBody] ObservacionRequest req)
    {
        using var conn = _db.CreateConnection();

        var sol = await conn.QuerySingleOrDefaultAsync<SolEstado>(
            "SELECT id, estado FROM solicitudes WHERE id = @id", new { id });

        if (sol is null) return NotFound(new { error = "Solicitud no encontrada" });
        if (sol.Estado != "pendiente")
            return BadRequest(new { error = $"Solo se puede rechazar una solicitud pendiente. Estado actual: {sol.Estado}" });

        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        await conn.ExecuteAsync(
            @"UPDATE solicitudes
              SET estado = 'rechazada', aprobador_id = @userId,
                  fecha_aprobacion = CURRENT_DATE, observacion = @obs
              WHERE id = @id",
            new { userId, obs = req.Observacion?.Trim(), id });

        return NoContent();
    }

    // PUT /api/solicitudes/{id}/despachar
    [HttpPut("{id:int}/despachar")]
    [Authorize(Roles = "admin,almacenero")]
    public async Task<IActionResult> Despachar(int id, [FromBody] DespachoRequest req)
    {
        if (req.Items is null || req.Items.Count == 0)
            return BadRequest(new { error = "Debe indicar los ítems a despachar" });

        using var conn = _db.CreateConnection();
        conn.Open();
        using var tx = conn.BeginTransaction();

        try
        {
            var sol = await conn.QuerySingleOrDefaultAsync<SolConAlmacen>(
                "SELECT id, estado, almacen_id FROM solicitudes WHERE id = @id", new { id }, tx);

            if (sol is null) return NotFound(new { error = "Solicitud no encontrada" });
            if (sol.Estado != "aprobada")
                return BadRequest(new { error = $"Solo se puede despachar una solicitud aprobada. Estado actual: {sol.Estado}" });

            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            foreach (var itemReq in req.Items)
            {
                if (itemReq.CantidadDespachada <= 0)
                    return BadRequest(new { error = "La cantidad despachada debe ser mayor a cero" });

                var solItem = await conn.QuerySingleOrDefaultAsync<SolItem>(
                    @"SELECT id, material_id, cantidad_solicitada, cantidad_despachada
                      FROM solicitud_items
                      WHERE id = @id AND solicitud_id = @solId",
                    new { id = itemReq.SolicitudItemId, solId = id }, tx);

                if (solItem is null)
                    return BadRequest(new { error = $"Ítem {itemReq.SolicitudItemId} no pertenece a esta solicitud" });

                if (itemReq.CantidadDespachada > solItem.CantidadSolicitada)
                    return BadRequest(new { error = $"No se puede despachar más de lo solicitado para el ítem {itemReq.SolicitudItemId}" });

                // Consumir lotes PEPS y registrar salida
                List<LoteConsumo> consumos;
                try
                {
                    consumos = await PepsHelper.ConsumirLotesAsync(
                        conn, tx, solItem.MaterialId, sol.AlmacenId, itemReq.CantidadDespachada);
                }
                catch (InvalidOperationException ex)
                {
                    tx.Rollback();
                    return BadRequest(new { error = ex.Message });
                }

                var costo = PepsHelper.CostoPonderado(consumos);

                await conn.ExecuteAsync(
                    @"INSERT INTO movimientos
                        (tipo, material_id, almacen_id, cantidad, costo_unitario, fecha, solicitud_id, user_id, observacion)
                      VALUES
                        ('salida', @materialId, @almacenId, @cantidad, @costo, @fecha, @solId, @userId, @obs)",
                    new
                    {
                        materialId = solItem.MaterialId,
                        almacenId  = sol.AlmacenId,
                        cantidad   = itemReq.CantidadDespachada,
                        costo,
                        fecha      = req.Fecha,
                        solId      = id,
                        userId,
                        obs        = $"Despacho solicitud {sol.Id}"
                    }, tx);

                await conn.ExecuteAsync(
                    "UPDATE solicitud_items SET cantidad_despachada = @cantidad WHERE id = @id",
                    new { cantidad = itemReq.CantidadDespachada, id = solItem.Id }, tx);
            }

            await conn.ExecuteAsync(
                @"UPDATE solicitudes
                  SET estado = 'despachada', almacenero_id = @userId, fecha_despacho = @fecha
                  WHERE id = @id",
                new { userId, fecha = req.Fecha, id }, tx);

            tx.Commit();
            return NoContent();
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    // PUT /api/solicitudes/{id}/entregar
    [HttpPut("{id:int}/entregar")]
    [Authorize(Roles = "admin,almacenero")]
    public async Task<IActionResult> Entregar(int id, [FromBody] EntregaRequest req)
    {
        if (req.Items is null || req.Items.Count == 0)
            return BadRequest(new { error = "Debe indicar los ítems entregados" });

        using var conn = _db.CreateConnection();
        conn.Open();
        using var tx = conn.BeginTransaction();

        try
        {
            var sol = await conn.QuerySingleOrDefaultAsync<SolEstado>(
                "SELECT id, estado FROM solicitudes WHERE id = @id", new { id }, tx);

            if (sol is null) return NotFound(new { error = "Solicitud no encontrada" });
            if (sol.Estado != "despachada")
                return BadRequest(new { error = $"Solo se puede registrar entrega de una solicitud despachada. Estado actual: {sol.Estado}" });

            foreach (var itemReq in req.Items)
            {
                if (itemReq.CantidadEntregada < 0)
                    return BadRequest(new { error = "La cantidad entregada no puede ser negativa" });

                var solItem = await conn.QuerySingleOrDefaultAsync<SolItem>(
                    @"SELECT id, material_id, cantidad_solicitada, cantidad_despachada
                      FROM solicitud_items
                      WHERE id = @id AND solicitud_id = @solId",
                    new { id = itemReq.SolicitudItemId, solId = id }, tx);

                if (solItem is null)
                    return BadRequest(new { error = $"Ítem {itemReq.SolicitudItemId} no pertenece a esta solicitud" });

                if (itemReq.CantidadEntregada > solItem.CantidadDespachada)
                    return BadRequest(new { error = $"No se puede entregar más de lo despachado para el ítem {itemReq.SolicitudItemId}" });

                await conn.ExecuteAsync(
                    "UPDATE solicitud_items SET cantidad_entregada = @cantidad WHERE id = @id",
                    new { cantidad = itemReq.CantidadEntregada, id = solItem.Id }, tx);
            }

            await conn.ExecuteAsync(
                "UPDATE solicitudes SET estado = 'entregado', fecha_entrega = @fecha WHERE id = @id",
                new { fecha = req.Fecha, id }, tx);

            tx.Commit();
            return NoContent();
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    // PUT /api/solicitudes/{id}/cancelar  (solo solicitante dueño o admin, si está pendiente)
    [HttpPut("{id:int}/cancelar")]
    [Authorize(Roles = "admin,solicitante")]
    public async Task<IActionResult> Cancelar(int id)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var role   = User.FindFirstValue(ClaimTypes.Role)!;

        using var conn = _db.CreateConnection();

        var sol = await conn.QuerySingleOrDefaultAsync<SolConSolicitante>(
            "SELECT id, estado, solicitante_id FROM solicitudes WHERE id = @id", new { id });

        if (sol is null) return NotFound(new { error = "Solicitud no encontrada" });
        if (sol.Estado != "pendiente")
            return BadRequest(new { error = "Solo se puede cancelar una solicitud en estado pendiente" });

        if (role != "admin" && sol.SolicitanteId != userId)
            return Forbid();

        await conn.ExecuteAsync(
            "UPDATE solicitudes SET estado = 'rechazada', observacion = 'Cancelada por el solicitante' WHERE id = @id",
            new { id });

        return NoContent();
    }

    // ── Tipos internos ────────────────────────────────────────
    private record SolicitudRow(
        int Id, string Numero, string Estado,
        int SolicitanteId, string Solicitante,
        int AlmacenId, string AlmacenNombre,
        int? AprobadorId, string? Aprobador,
        int? AlmaceneroId, string? Almacenero,
        DateTime FechaSolicitud, DateTime? FechaAprobacion,
        DateTime? FechaDespacho, DateTime? FechaEntrega,
        string? Observacion, DateTime CreatedAt);

    private record SolicitudItemRow(
        int Id, int MaterialId, string Codigo, string MaterialNombre, string UnidadMedida,
        decimal CantidadSolicitada, decimal CantidadDespachada, decimal CantidadEntregada);

    private record SolEstado(int Id, string Estado);
    private record SolConAlmacen(int Id, string Estado, int AlmacenId);
    private record SolConSolicitante(int Id, string Estado, int SolicitanteId);
    private record SolItem(int Id, int MaterialId, decimal CantidadSolicitada, decimal CantidadDespachada);
}

// ── Request DTOs ──────────────────────────────────────────────
public record SolicitudItemRequest(int MaterialId, decimal Cantidad);
public record SolicitudCreateRequest(int AlmacenId, List<SolicitudItemRequest> Items, string? Observacion = null);
public record ObservacionRequest(string? Observacion);
public record DespachoItemRequest(int SolicitudItemId, decimal CantidadDespachada);
public record DespachoRequest(DateOnly Fecha, List<DespachoItemRequest> Items);
public record EntregaItemRequest(int SolicitudItemId, decimal CantidadEntregada);
public record EntregaRequest(DateOnly Fecha, List<EntregaItemRequest> Items);
