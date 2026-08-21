using Almacen.Helpers;
using Almacen.Models;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text;
using System.Text.Json;

namespace Almacen.Controllers;

[ApiController]
[Route("api/solicitudes")]
[Authorize]
public class SolicitudController : ControllerBase
{
    private readonly Db                 _db;
    private readonly IHttpClientFactory _httpFactory;

    private const string UrlGetUsuario = "https://hades.oopp.gob.bo/seguridad/api/get_usuario/";

    public SolicitudController(Db db, IHttpClientFactory httpFactory)
    {
        _db          = db;
        _httpFactory = httpFactory;
    }

    // GET /api/solicitudes?estado=&solicitanteId=&page=1&pageSize=20
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? estado        = null,
        [FromQuery] int?    solicitanteId = null,
        [FromQuery] int     page          = 1,
        [FromQuery] int     pageSize      = 20)
    {
        if (page < 1)       page     = 1;
        if (pageSize < 1)   pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var role   = User.FindFirstValue(ClaimTypes.Role)!;
        var ci     = User.FindFirstValue("ci");

        using var conn = _db.CreateConnection();

        var where = new List<string> { "s.active = true" };
        var p     = new DynamicParameters();

        // Visibilidad por rol
        switch (role)
        {
            case "admin":
                // Ve todas; filtro opcional por solicitante
                if (solicitanteId.HasValue)
                {
                    where.Add("s.solicitante_id = @solicitanteId");
                    p.Add("solicitanteId", solicitanteId.Value);
                }
                break;

            case "aprobador":
                // Sus propias solicitudes + las que debe aprobar (por CI)
                where.Add("(s.solicitante_id = @userId OR s.aprobador_ci = @ci)");
                p.Add("userId", userId);
                p.Add("ci", ci);
                break;

            case "almacenero":
                // Sus propias solicitudes + las de sus sub-almacenes asignados (almacen_encargado)
                where.Add(@"(s.solicitante_id = @userId OR s.sub_almacen_id IN (
                    SELECT sa2.id FROM sub_almacenes sa2
                    JOIN almacen_encargado ae ON ae.almacen_id = sa2.almacen_id
                    WHERE ae.user_id = @userId AND ae.active = true))");
                p.Add("userId", userId);
                break;

            default:
                // solicitante (y demás) solo ven sus propias solicitudes
                where.Add("s.solicitante_id = @userId");
                p.Add("userId", userId);
                break;
        }

        if (!string.IsNullOrWhiteSpace(estado))
        {
            where.Add("s.estado = @estado");
            p.Add("estado", estado.ToLower().Trim());
        }

        var clausula = "WHERE " + string.Join(" AND ", where);

        var total = await conn.ExecuteScalarAsync<int>(
            $"SELECT COUNT(*) FROM solicitudes s {clausula}", p);

        p.Add("limit",  pageSize);
        p.Add("offset", (page - 1) * pageSize);

        var items = await conn.QueryAsync<SolicitudRow>(
            $@"SELECT s.id, s.numero, s.estado,
                      s.solicitante_id, s.solicitante_nombre AS solicitante,
                      s.sub_almacen_id, sa.nombre AS sub_almacen_nombre, sa.sigla,
                      a.id AS almacen_id, a.nombre AS almacen_nombre,
                      s.aprobador_id, s.aprobador_nombre AS aprobador,
                      s.almacenero_id, s.almacenero_nombre AS almacenero,
                      s.fecha_solicitud, s.fecha_aprobacion, s.fecha_despacho, s.fecha_entrega,
                      s.observacion, s.created_at
               FROM solicitudes s
               JOIN sub_almacenes  sa  ON sa.id  = s.sub_almacen_id
               JOIN almacenes      a   ON a.id   = sa.almacen_id
               {clausula}
               ORDER BY s.created_at DESC
               LIMIT @limit OFFSET @offset", p);

        return Ok(new { total, page, pageSize, items });
    }

    // GET /api/solicitudes/mis-aprobaciones?estado=&page=1&pageSize=20
    // Solicitudes asignadas al usuario actual como aprobador (por CI del JWT).
    // Sin filtro de estado: pendientes (enviado) + histórico (aprobado/rechazado).
    [HttpGet("mis-aprobaciones")]
    public async Task<IActionResult> MisAprobaciones(
        [FromQuery] string? estado   = null,
        [FromQuery] int     page     = 1,
        [FromQuery] int     pageSize = 20)
    {
        if (page < 1)       page     = 1;
        if (pageSize < 1)   pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        var ci = User.FindFirstValue("ci");

        if (string.IsNullOrWhiteSpace(ci))
            return Ok(new { total = 0, page, pageSize, items = Array.Empty<SolicitudRow>() });

        using var conn = _db.CreateConnection();

        var where = new List<string> { "s.active = true", "s.aprobador_ci = @ci" };
        var p     = new DynamicParameters();
        p.Add("ci", ci);

        if (!string.IsNullOrWhiteSpace(estado))
        {
            where.Add("s.estado = @estado");
            p.Add("estado", estado.ToLower().Trim());
        }

        var clausula = "WHERE " + string.Join(" AND ", where);

        var total = await conn.ExecuteScalarAsync<int>(
            $"SELECT COUNT(*) FROM solicitudes s {clausula}", p);

        p.Add("limit",  pageSize);
        p.Add("offset", (page - 1) * pageSize);

        var items = await conn.QueryAsync<SolicitudRow>(
            $@"SELECT s.id, s.numero, s.estado,
                      s.solicitante_id, s.solicitante_nombre AS solicitante,
                      s.sub_almacen_id, sa.nombre AS sub_almacen_nombre, sa.sigla,
                      a.id AS almacen_id, a.nombre AS almacen_nombre,
                      s.aprobador_id, s.aprobador_nombre AS aprobador,
                      s.almacenero_id, s.almacenero_nombre AS almacenero,
                      s.fecha_solicitud, s.fecha_aprobacion, s.fecha_despacho, s.fecha_entrega,
                      s.observacion, s.created_at
               FROM solicitudes s
               JOIN sub_almacenes  sa  ON sa.id  = s.sub_almacen_id
               JOIN almacenes      a   ON a.id   = sa.almacen_id
               {clausula}
               ORDER BY s.created_at DESC
               LIMIT @limit OFFSET @offset", p);

        return Ok(new { total, page, pageSize, items });
    }

    // GET /api/solicitudes/mis-despachos?estado=&page=1&pageSize=20
    // Solicitudes para despacho/entrega del almacenero: estados aprobado, despachado y entregado
    // de los sub-almacenes que tiene asignados en almacen_encargado. Admin ve todas.
    [HttpGet("mis-despachos")]
    [Authorize(Roles = "admin,almacenero")]
    public async Task<IActionResult> MisDespachos(
        [FromQuery] string? estado   = null,
        [FromQuery] int     page     = 1,
        [FromQuery] int     pageSize = 20)
    {
        if (page < 1)       page     = 1;
        if (pageSize < 1)   pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var role   = User.FindFirstValue(ClaimTypes.Role)!;

        using var conn = _db.CreateConnection();

        var where = new List<string>
        {
            "s.active = true",
            "s.estado IN ('aprobado', 'despachado', 'entregado')"
        };
        var p = new DynamicParameters();

        if (role != "admin")
        {
            where.Add(@"s.sub_almacen_id IN (
                SELECT sa2.id FROM sub_almacenes sa2
                JOIN almacen_encargado ae ON ae.almacen_id = sa2.almacen_id
                WHERE ae.user_id = @userId AND ae.active = true)");
            p.Add("userId", userId);
        }

        if (!string.IsNullOrWhiteSpace(estado))
        {
            where.Add("s.estado = @estado");
            p.Add("estado", estado.ToLower().Trim());
        }

        var clausula = "WHERE " + string.Join(" AND ", where);

        var total = await conn.ExecuteScalarAsync<int>(
            $"SELECT COUNT(*) FROM solicitudes s {clausula}", p);

        p.Add("limit",  pageSize);
        p.Add("offset", (page - 1) * pageSize);

        var items = await conn.QueryAsync<SolicitudRow>(
            $@"SELECT s.id, s.numero, s.estado,
                      s.solicitante_id, s.solicitante_nombre AS solicitante,
                      s.sub_almacen_id, sa.nombre AS sub_almacen_nombre, sa.sigla,
                      a.id AS almacen_id, a.nombre AS almacen_nombre,
                      s.aprobador_id, s.aprobador_nombre AS aprobador,
                      s.almacenero_id, s.almacenero_nombre AS almacenero,
                      s.fecha_solicitud, s.fecha_aprobacion, s.fecha_despacho, s.fecha_entrega,
                      s.observacion, s.created_at
               FROM solicitudes s
               JOIN sub_almacenes  sa  ON sa.id  = s.sub_almacen_id
               JOIN almacenes      a   ON a.id   = sa.almacen_id
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
                     s.solicitante_id, s.solicitante_nombre AS solicitante,
                     s.sub_almacen_id, sa.nombre AS sub_almacen_nombre, sa.sigla,
                     a.id AS almacen_id, a.nombre AS almacen_nombre,
                     s.aprobador_id, s.aprobador_nombre AS aprobador,
                     s.almacenero_id, s.almacenero_nombre AS almacenero,
                     s.fecha_solicitud, s.fecha_aprobacion, s.fecha_despacho, s.fecha_entrega,
                     s.observacion, s.created_at
              FROM solicitudes s
              JOIN sub_almacenes  sa  ON sa.id  = s.sub_almacen_id
              JOIN almacenes      a   ON a.id   = sa.almacen_id
              WHERE s.id = @id",
            new { id });

        if (solicitud is null) return NotFound(new { error = "Solicitud no encontrada" });

        if (role == "solicitante" && solicitud.SolicitanteId != userId)
            return Forbid();

        var items = await conn.QueryAsync<SolicitudItemRow>(
            @"SELECT si.id, si.material_id, m.codigo, m.nombre AS material_nombre,
                     si.cantidad_solicitada, si.cantidad_aprobada
              FROM solicitud_items si
              JOIN materiales m ON m.id = si.material_id
              WHERE si.solicitud_id = @id
              ORDER BY m.nombre",
            new { id });

        return Ok(new { solicitud, items });
    }

    // POST /api/solicitudes
    [HttpPost]
    [Authorize(Roles = "admin,solicitante,almacenero")]
    public async Task<IActionResult> Create([FromBody] SolicitudCreateRequest req)
    {
        using var conn = _db.CreateConnection();

        var sub = await conn.QuerySingleOrDefaultAsync<SubAlmacenSigla>(
            "SELECT id, sigla FROM sub_almacenes WHERE id = @id AND active = true",
            new { id = req.SubAlmacenId });

        if (sub is null)
            return BadRequest(new { error = "Sub-almacén no encontrado o inactivo" });

        // Validar ítems antes de abrir la transacción
        if (req.Items is not null)
        {
            foreach (var item in req.Items)
            {
                if (item.Cantidad <= 0)
                    return BadRequest(new { error = "La cantidad solicitada debe ser mayor a cero" });

                var matExiste = await conn.ExecuteScalarAsync<int?>(
                    "SELECT id FROM materiales WHERE id = @id AND active = true",
                    new { id = item.MaterialId });

                if (matExiste is null)
                    return BadRequest(new { error = $"Material {item.MaterialId} no encontrado o inactivo" });
            }
        }

        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // Datos del funcionario desde el servicio externo (token tknrh del JWT)
        var tknrh = User.FindFirstValue("tknrh");
        string nombreCompleto = "", organigrama = "", cargo = "";

        if (!string.IsNullOrWhiteSpace(tknrh))
        {
            try
            {
                var client = _httpFactory.CreateClient();
                var reqUsuario = new HttpRequestMessage(HttpMethod.Get, UrlGetUsuario);
                reqUsuario.Headers.Add("Authorization", $"Token {tknrh}");
                var respUsuario = await client.SendAsync(reqUsuario);

                if (respUsuario.IsSuccessStatusCode)
                {
                    var usuario = JsonSerializer.Deserialize<UsuarioExterno>(await respUsuario.Content.ReadAsStringAsync());
                    nombreCompleto = usuario?.Persona?.NombreCompleto?.Trim() ?? "";
                    organigrama    = usuario?.Persona?.Organigrama?.Trim() ?? "";
                    cargo          = usuario?.Persona?.Cargo?.Trim() ?? "";
                }
            }
            catch { /* servicio externo no disponible — validación abajo */ }
        }

        if (string.IsNullOrWhiteSpace(nombreCompleto) || string.IsNullOrWhiteSpace(organigrama) || string.IsNullOrWhiteSpace(cargo))
            return BadRequest(new { error = "Los datos del funcionario no estan completos" });

        conn.Open();
        using var tx = conn.BeginTransaction();
        try
        {
            // Incrementar secuencia_solicitudes (reinicia por año) y generar número
            var anio = DateTime.Now.Year;

            var secuencia = await conn.ExecuteScalarAsync<int>(
                @"UPDATE sub_almacenes
                  SET secuencia_solicitudes = CASE WHEN anio_solicitudes = @anio THEN secuencia_solicitudes + 1 ELSE 1 END,
                      anio_solicitudes = @anio
                  WHERE id = @id
                  RETURNING secuencia_solicitudes",
                new { id = req.SubAlmacenId, anio }, tx);

            var sigla   = string.IsNullOrWhiteSpace(sub.Sigla) ? "GEN" : sub.Sigla;
            var numero  = $"SOL-{sigla}-{anio}-{secuencia:D6}";

            var solId = await conn.ExecuteScalarAsync<int>(
                @"INSERT INTO solicitudes (numero, solicitante_id, solicitante_nombre, solicitante_organigrama, solicitante_cargo, sub_almacen_id, estado, observacion)
                  VALUES (@numero, @userId, @nombreCompleto, @organigrama, @cargo, @subAlmacenId, 'borrador', @obs)
                  RETURNING id",
                new { numero, userId, nombreCompleto, organigrama, cargo, subAlmacenId = req.SubAlmacenId, obs = req.Observacion?.Trim() }, tx);

            if (req.Items is not null && req.Items.Count > 0)
            {
                foreach (var item in req.Items)
                {
                    await conn.ExecuteAsync(
                        @"INSERT INTO solicitud_items (solicitud_id, material_id, cantidad_solicitada, cantidad_aprobada)
                          VALUES (@solId, @materialId, @cantidad, 0)
                          ON CONFLICT (solicitud_id, material_id)
                          DO UPDATE SET cantidad_solicitada = solicitud_items.cantidad_solicitada + EXCLUDED.cantidad_solicitada",
                        new { solId, materialId = item.MaterialId, cantidad = item.Cantidad }, tx);
                }
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

    // PUT /api/solicitudes/{id}  (editar observacion, solo borrador)
    [HttpPut("{id:int}")]
    [Authorize(Roles = "admin,solicitante,almacenero")]
    public async Task<IActionResult> UpdateSolicitud(int id, [FromBody] SolicitudUpdateRequest req)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var role   = User.FindFirstValue(ClaimTypes.Role)!;

        using var conn = _db.CreateConnection();

        var sol = await conn.QuerySingleOrDefaultAsync<SolConSolicitante>(
            "SELECT id, estado, solicitante_id FROM solicitudes WHERE id = @id AND active = true", new { id });

        if (sol is null) return NotFound(new { error = "Solicitud no encontrada" });
        if (sol.Estado != "borrador")
            return BadRequest(new { error = "Solo se puede editar una solicitud en estado borrador" });
        if (role != "admin" && sol.SolicitanteId != userId)
            return Forbid();

        await conn.ExecuteAsync(
            "UPDATE solicitudes SET observacion = @obs WHERE id = @id",
            new { obs = req.Observacion?.Trim(), id });

        return NoContent();
    }

    // DELETE /api/solicitudes/{id}  (baja lógica, solo borrador)
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "admin,solicitante,almacenero")]
    public async Task<IActionResult> DeleteSolicitud(int id)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var role   = User.FindFirstValue(ClaimTypes.Role)!;

        using var conn = _db.CreateConnection();

        var sol = await conn.QuerySingleOrDefaultAsync<SolConSolicitante>(
            "SELECT id, estado, solicitante_id FROM solicitudes WHERE id = @id AND active = true", new { id });

        if (sol is null) return NotFound(new { error = "Solicitud no encontrada" });
        if (sol.Estado != "borrador")
            return BadRequest(new { error = "Solo se puede eliminar una solicitud en estado borrador" });
        if (role != "admin" && sol.SolicitanteId != userId)
            return Forbid();

        await conn.ExecuteAsync(
            "UPDATE solicitudes SET active = false WHERE id = @id", new { id });

        return NoContent();
    }

    // PUT /api/solicitudes/{id}/enviar  (borrador → pendiente)
    [HttpPut("{id:int}/enviar")]
    [Authorize(Roles = "admin,solicitante,almacenero")]
    public async Task<IActionResult> EnviarSolicitud(int id)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var role   = User.FindFirstValue(ClaimTypes.Role)!;

        using var conn = _db.CreateConnection();

        var sol = await conn.QuerySingleOrDefaultAsync<SolConSolicitante>(
            "SELECT id, estado, solicitante_id FROM solicitudes WHERE id = @id AND active = true", new { id });

        if (sol is null) return NotFound(new { error = "Solicitud no encontrada" });
        if (sol.Estado != "borrador")
            return BadRequest(new { error = "Solo se puede enviar una solicitud en estado borrador" });
        if (role != "admin" && sol.SolicitanteId != userId)
            return Forbid();

        var tieneItems = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM solicitud_items WHERE solicitud_id = @id", new { id });

        if (tieneItems == 0)
            return BadRequest(new { error = "No se puede enviar una solicitud sin ítems" });

        // Aprobador asignado desde el perfil del solicitante (por sub-almacén)
        var aprobador = await conn.QuerySingleOrDefaultAsync<PerfilAprobador>(
            @"SELECT p.aprobador_id AS aprobador_ci, p.aprobador_nombre
              FROM perfil p
              JOIN solicitudes s ON s.solicitante_id = p.persona_id AND s.sub_almacen_id = p.sub_almacen_id
              WHERE s.id = @id",
            new { id });

        if (aprobador is null || string.IsNullOrWhiteSpace(aprobador.AprobadorCi))
            return BadRequest(new { error = "El solicitante no tiene un aprobador configurado en su perfil para este sub-almacén" });

        await conn.ExecuteAsync(
            @"UPDATE solicitudes
              SET estado = 'enviado', aprobador_ci = @aprobadorCi, aprobador_nombre = @aprobadorNombre
              WHERE id = @id",
            new { aprobadorCi = aprobador.AprobadorCi, aprobadorNombre = aprobador.AprobadorNombre, id });

        return NoContent();
    }

    // PUT /api/solicitudes/{id}/aprobar
    [HttpPut("{id:int}/aprobar")]
    public async Task<IActionResult> Aprobar(int id)
    {
        using var conn = _db.CreateConnection();

        var sol = await conn.QuerySingleOrDefaultAsync<SolConAprobador>(
            "SELECT id, estado, aprobador_ci FROM solicitudes WHERE id = @id", new { id });

        if (sol is null) return NotFound(new { error = "Solicitud no encontrada" });
        if (sol.Estado != "enviado")
            return BadRequest(new { error = $"Solo se puede aprobar una solicitud enviada. Estado actual: {sol.Estado}" });

        var role = User.FindFirstValue(ClaimTypes.Role)!;
        var ci   = User.FindFirstValue("ci");

        if (role != "admin" && (string.IsNullOrWhiteSpace(ci) || ci != sol.AprobadorCi))
            return Forbid();

        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var nombre = User.FindFirstValue("nombre") ?? User.Identity?.Name;

        await conn.ExecuteAsync(
            @"UPDATE solicitudes
              SET estado = 'aprobado', aprobador_id = @userId,
                  aprobador_nombre = @nombre, fecha_aprobacion = CURRENT_DATE
              WHERE id = @id",
            new { userId, nombre, id });

        return NoContent();
    }

    // PUT /api/solicitudes/{id}/rechazar
    [HttpPut("{id:int}/rechazar")]
    public async Task<IActionResult> Rechazar(int id, [FromBody] ObservacionRequest req)
    {
        using var conn = _db.CreateConnection();

        var sol = await conn.QuerySingleOrDefaultAsync<SolConAprobador>(
            "SELECT id, estado, aprobador_ci FROM solicitudes WHERE id = @id", new { id });

        if (sol is null) return NotFound(new { error = "Solicitud no encontrada" });
        if (sol.Estado != "enviado")
            return BadRequest(new { error = $"Solo se puede rechazar una solicitud enviada. Estado actual: {sol.Estado}" });

        var role = User.FindFirstValue(ClaimTypes.Role)!;
        var ci   = User.FindFirstValue("ci");

        if (role != "admin" && (string.IsNullOrWhiteSpace(ci) || ci != sol.AprobadorCi))
            return Forbid();

        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var nombre = User.FindFirstValue("nombre") ?? User.Identity?.Name;

        await conn.ExecuteAsync(
            @"UPDATE solicitudes
              SET estado = 'rechazado', aprobador_id = @userId, aprobador_nombre = @nombre,
                  fecha_aprobacion = CURRENT_DATE, observacion = @obs
              WHERE id = @id",
            new { userId, nombre, obs = req.Observacion?.Trim(), id });

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
                @"SELECT s.id, s.estado, sa.almacen_id
                  FROM solicitudes s
                  JOIN sub_almacenes sa ON sa.id = s.sub_almacen_id
                  WHERE s.id = @id",
                new { id }, tx);

            if (sol is null) return NotFound(new { error = "Solicitud no encontrada" });
            if (sol.Estado != "aprobado")
                return BadRequest(new { error = $"Solo se puede despachar una solicitud aprobada. Estado actual: {sol.Estado}" });

            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var nombre = User.FindFirstValue("nombre") ?? User.Identity?.Name;

            foreach (var itemReq in req.Items)
            {
                if (itemReq.CantidadAprobada <= 0)
                    return BadRequest(new { error = "La cantidad aprobada debe ser mayor a cero" });

                var solItem = await conn.QuerySingleOrDefaultAsync<SolItem>(
                    @"SELECT id, material_id, cantidad_solicitada, cantidad_aprobada
                      FROM solicitud_items
                      WHERE id = @id AND solicitud_id = @solId",
                    new { id = itemReq.SolicitudItemId, solId = id }, tx);

                if (solItem is null)
                    return BadRequest(new { error = $"Ítem {itemReq.SolicitudItemId} no pertenece a esta solicitud" });

                if (itemReq.CantidadAprobada > solItem.CantidadSolicitada)
                    return BadRequest(new { error = $"No se puede despachar más de lo solicitado para el ítem {itemReq.SolicitudItemId}" });

                await conn.ExecuteAsync(
                    "UPDATE solicitud_items SET cantidad_aprobada = @cantidad WHERE id = @id",
                    new { cantidad = itemReq.CantidadAprobada, id = solItem.Id }, tx);
            }

            await conn.ExecuteAsync(
                @"UPDATE solicitudes
                  SET estado = 'despachado', almacenero_id = @userId,
                      almacenero_nombre = @nombre, fecha_despacho = @fecha
                  WHERE id = @id",
                new { userId, nombre, fecha = req.Fecha, id }, tx);

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
        using var conn = _db.CreateConnection();
        conn.Open();
        using var tx = conn.BeginTransaction();

        try
        {
            var sol = await conn.QuerySingleOrDefaultAsync<SolEstado>(
                "SELECT id, estado FROM solicitudes WHERE id = @id", new { id }, tx);

            if (sol is null) return NotFound(new { error = "Solicitud no encontrada" });
            if (sol.Estado != "despachado")
                return BadRequest(new { error = $"Solo se puede registrar entrega de una solicitud despachada. Estado actual: {sol.Estado}" });

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
    [Authorize(Roles = "admin,solicitante,almacenero")]
    public async Task<IActionResult> Cancelar(int id)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var role   = User.FindFirstValue(ClaimTypes.Role)!;

        using var conn = _db.CreateConnection();

        var sol = await conn.QuerySingleOrDefaultAsync<SolConSolicitante>(
            "SELECT id, estado, solicitante_id FROM solicitudes WHERE id = @id", new { id });

        if (sol is null) return NotFound(new { error = "Solicitud no encontrada" });
        if (sol.Estado != "enviado")
            return BadRequest(new { error = "Solo se puede cancelar una solicitud enviada" });

        if (role != "admin" && sol.SolicitanteId != userId)
            return Forbid();

        await conn.ExecuteAsync(
            "UPDATE solicitudes SET estado = 'rechazado', observacion = 'Cancelada por el solicitante' WHERE id = @id",
            new { id });

        return NoContent();
    }

    // ─── SOLICITUD ITEMS ─────────────────────────────────────────────────────

    // POST /api/solicitudes/{id}/items
    [HttpPost("{id:int}/items")]
    [Authorize(Roles = "admin,solicitante,almacenero")]
    public async Task<IActionResult> AddItem(int id, [FromBody] SolicitudItemUpsertRequest req)
    {
        if (req.Cantidad <= 0)
            return BadRequest(new { error = "La cantidad debe ser mayor a cero" });

        using var conn = _db.CreateConnection();

        var sol = await conn.QuerySingleOrDefaultAsync<SolEstado>(
            "SELECT id, estado FROM solicitudes WHERE id = @id AND active = true", new { id });

        if (sol is null) return NotFound(new { error = "Solicitud no encontrada" });
        if (sol.Estado != "borrador")
            return BadRequest(new { error = "Solo se pueden agregar ítems a una solicitud en estado borrador" });

        var materialExiste = await conn.ExecuteScalarAsync<int?>(
            "SELECT id FROM materiales WHERE id = @id AND active = true",
            new { id = req.MaterialId });

        if (materialExiste is null)
            return BadRequest(new { error = "Material no encontrado o inactivo" });

        var itemId = await conn.ExecuteScalarAsync<int>(
            @"INSERT INTO solicitud_items (solicitud_id, material_id, cantidad_solicitada, cantidad_aprobada)
              VALUES (@solId, @materialId, @cantidad, 0)
              ON CONFLICT (solicitud_id, material_id)
              DO UPDATE SET cantidad_solicitada = solicitud_items.cantidad_solicitada + EXCLUDED.cantidad_solicitada
              RETURNING id",
            new { solId = id, materialId = req.MaterialId, cantidad = req.Cantidad });

        return Created($"/api/solicitudes/{id}/items/{itemId}", new { id = itemId });
    }

    // PUT /api/solicitudes/{id}/items/{itemId}
    [HttpPut("{id:int}/items/{itemId:int}")]
    [Authorize(Roles = "admin,solicitante,almacenero")]
    public async Task<IActionResult> UpdateItem(int id, int itemId, [FromBody] SolicitudItemUpsertRequest req)
    {
        if (req.Cantidad <= 0)
            return BadRequest(new { error = "La cantidad debe ser mayor a cero" });

        using var conn = _db.CreateConnection();

        var sol = await conn.QuerySingleOrDefaultAsync<SolEstado>(
            "SELECT id, estado FROM solicitudes WHERE id = @id AND active = true", new { id });

        if (sol is null) return NotFound(new { error = "Solicitud no encontrada" });
        if (sol.Estado != "borrador")
            return BadRequest(new { error = "Solo se pueden editar ítems de una solicitud en estado borrador" });

        var existe = await conn.ExecuteScalarAsync<int?>(
            "SELECT id FROM solicitud_items WHERE id = @itemId AND solicitud_id = @id",
            new { id, itemId });

        if (existe is null) return NotFound(new { error = "Ítem no encontrado" });

        await conn.ExecuteAsync(
            @"UPDATE solicitud_items
              SET material_id = @materialId, cantidad_solicitada = @cantidad
              WHERE id = @itemId",
            new { materialId = req.MaterialId, cantidad = req.Cantidad, itemId });

        return NoContent();
    }

    // DELETE /api/solicitudes/{id}/items/{itemId}
    [HttpDelete("{id:int}/items/{itemId:int}")]
    [Authorize(Roles = "admin,solicitante,almacenero")]
    public async Task<IActionResult> DeleteItem(int id, int itemId)
    {
        using var conn = _db.CreateConnection();

        var sol = await conn.QuerySingleOrDefaultAsync<SolEstado>(
            "SELECT id, estado FROM solicitudes WHERE id = @id AND active = true", new { id });

        if (sol is null) return NotFound(new { error = "Solicitud no encontrada" });
        if (sol.Estado != "borrador")
            return BadRequest(new { error = "Solo se pueden eliminar ítems de una solicitud en estado borrador" });

        var deleted = await conn.ExecuteAsync(
            "DELETE FROM solicitud_items WHERE id = @itemId AND solicitud_id = @id",
            new { id, itemId });

        if (deleted == 0) return NotFound(new { error = "Ítem no encontrado" });

        return NoContent();
    }

    // ── Tipos internos ────────────────────────────────────────
    private class SolicitudRow
    {
        public int Id { get; set; }
        public string Numero { get; set; } = "";
        public string Estado { get; set; } = "";
        public int SolicitanteId { get; set; }
        public string? Solicitante { get; set; }
        public int SubAlmacenId { get; set; }
        public string SubAlmacenNombre { get; set; } = "";
        public string? Sigla { get; set; }
        public int AlmacenId { get; set; }
        public string AlmacenNombre { get; set; } = "";
        public int? AprobadorId { get; set; }
        public string? Aprobador { get; set; }
        public int? AlmaceneroId { get; set; }
        public string? Almacenero { get; set; }
        public DateOnly FechaSolicitud { get; set; }
        public DateOnly? FechaAprobacion { get; set; }
        public DateOnly? FechaDespacho { get; set; }
        public DateOnly? FechaEntrega { get; set; }
        public string? Observacion { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    private record SolicitudItemRow(
        int Id, int MaterialId, string Codigo, string MaterialNombre,
        decimal CantidadSolicitada, decimal CantidadAprobada);

    private record SolEstado(int Id, string Estado);
    private record SolConAlmacen(int Id, string Estado, int AlmacenId);
    private record SolConSolicitante(int Id, string Estado, int SolicitanteId);
    private record SolConAprobador(int Id, string Estado, string? AprobadorCi);
    private record SolItem(int Id, int MaterialId, decimal CantidadSolicitada, decimal CantidadAprobada);
    private record SubAlmacenSigla(int Id, string? Sigla);
    private record PerfilAprobador(string? AprobadorCi, string? AprobadorNombre);
}

// ── Request DTOs ──────────────────────────────────────────────
public record SolicitudItemRequest(int MaterialId, decimal Cantidad);
public record SolicitudCreateRequest(int SubAlmacenId, List<SolicitudItemRequest>? Items = null, string? Observacion = null);
public record SolicitudUpdateRequest(string? Observacion);
public record SolicitudItemUpsertRequest(int MaterialId, decimal Cantidad);
public record ObservacionRequest(string? Observacion);
public record DespachoItemRequest(int SolicitudItemId, decimal CantidadAprobada);
public record DespachoRequest(DateOnly Fecha, List<DespachoItemRequest> Items);
public record EntregaRequest(DateOnly Fecha);
