using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text;
using System.Text.Json;

namespace Almacen.Controllers;

[ApiController]
[Route("api/perfil")]
[Authorize]
public class PerfilController : ControllerBase
{
    private readonly Db _db;
    private readonly IHttpClientFactory _httpFactory;

    public PerfilController(Db db, IHttpClientFactory httpFactory)
    {
        _db = db;
        _httpFactory = httpFactory;
    }

    // GET /api/perfil
    [HttpGet]
    public async Task<IActionResult> GetMyPerfil()
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        using var conn = _db.CreateConnection();

        var items = await conn.QueryAsync<PerfilRow>(
            @"SELECT p.id, p.persona_id, p.sub_almacen_id, p.aprobador_id,
                     p.aprobador_nombre, p.aprobador_cargo,
                     sa.nombre AS sub_almacen_nombre, sa.sigla,
                     a.id AS almacen_id, a.nombre AS almacen_nombre
              FROM perfil p
              JOIN sub_almacenes sa ON sa.id = p.sub_almacen_id
              JOIN almacenes a ON a.id = sa.almacen_id
              WHERE p.persona_id = @userId
              ORDER BY a.nombre, sa.nombre",
            new { userId });

        return Ok(new { items });
    }

    // PUT /api/perfil
    [HttpPut]
    [Authorize]
    public async Task<IActionResult> SaveMyPerfil([FromBody] PerfilSaveRequest req)
    {
        if (req.SubAlmacenIds is null || req.SubAlmacenIds.Count == 0)
            return BadRequest(new { error = "Debe seleccionar al menos un sub-almacén" });

        if (string.IsNullOrWhiteSpace(req.AprobadorId))
            return BadRequest(new { error = "Debe seleccionar un aprobador" });

        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        using var conn = _db.CreateConnection();

        var subExistentes = await conn.QueryAsync<int>(
            "SELECT id FROM sub_almacenes WHERE id = ANY(@ids)",
            new { ids = req.SubAlmacenIds.ToArray() });

        if (subExistentes.Count() != req.SubAlmacenIds.Count)
            return BadRequest(new { error = "Uno o más sub-almacenes no existen" });

        conn.Open();
        using var tx = conn.BeginTransaction();

        try
        {
            await conn.ExecuteAsync(
                "DELETE FROM perfil WHERE persona_id = @userId",
                new { userId }, tx);

            foreach (var subId in req.SubAlmacenIds)
            {
                await conn.ExecuteAsync(
                    @"INSERT INTO perfil (persona_id, sub_almacen_id, aprobador_id, aprobador_nombre, aprobador_cargo)
                      VALUES (@userId, @subId, @aprobadorId, @aprobadorNombre, @aprobadorCargo)",
                    new
                    {
                        userId,
                        subId = subId,
                        aprobadorId = req.AprobadorId,
                        aprobadorNombre = req.AprobadorNombre?.Trim(),
                        aprobadorCargo = req.AprobadorCargo?.Trim()
                    },
                    tx);
            }

            tx.Commit();
            return NoContent();
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    // GET /api/perfil/sub-almacenes
    [HttpGet("sub-almacenes")]
    public async Task<IActionResult> GetSubAlmacenesForPerfil()
    {
        using var conn = _db.CreateConnection();

        var items = await conn.QueryAsync<SubAlmacenParaPerfilRow>(
            @"SELECT sa.id, sa.nombre, sa.sigla, sa.almacen_id, a.nombre AS almacen_nombre
              FROM sub_almacenes sa
              JOIN almacenes a ON a.id = sa.almacen_id AND a.active = true
              WHERE sa.active = true
              ORDER BY a.nombre, sa.nombre");

        return Ok(new { items });
    }

    // GET /api/perfil/usuarios
    [HttpGet("usuarios")]
    public async Task<IActionResult> GetUsuarios()
    {
        using var conn = _db.CreateConnection();

        var usuarios = await conn.QueryAsync<UsuarioRow>(
            @"SELECT id, username, role
              FROM users
              WHERE active = true
              ORDER BY username");

        return Ok(new { items = usuarios });
    }

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
    };

    // GET /api/perfil/aprobadores
    [HttpGet("aprobadores")]
    public async Task<IActionResult> GetAprobadores()
    {
        var ci = User.FindFirst("ci")?.Value;
        if (string.IsNullOrWhiteSpace(ci))
            return BadRequest(new { error = "No se encontró el CI en el token" });

        var client = _httpFactory.CreateClient();

        // 1. Obtener relación laboral activa
        HttpResponseMessage respRelacion;
        try
        {
            respRelacion = await client.GetAsync(
                $"https://hades.oopp.gob.bo/contrataciones/api/relacion_laboral/{ci}");
        }
        catch (Exception ex)
        {
            return StatusCode(503, new { error = "Servicio de relación laboral no disponible", detalle = ex.Message });
        }

        if (!respRelacion.IsSuccessStatusCode)
            return StatusCode(502, new { error = "No se pudo obtener la relación laboral" });

        var bodyRelacion = await respRelacion.Content.ReadAsStringAsync();
        var relaciones = JsonSerializer.Deserialize<List<RelacionLaboralRow>>(bodyRelacion, JsonOpts);
        var activa = relaciones?.FirstOrDefault(r => r.Activo);

        if (activa is null)
            return Ok(new { items = Array.Empty<AprobadorRow>() });

        // 2. Obtener aprobadores (inmediato superior)
        var url = $"https://hades.oopp.gob.bo/contrataciones/api/relacion_laboral/{ci}/{activa.Id}/inmediato_superior/";
        HttpResponseMessage respAprobadores;
        try
        {
            var reqAprob = new HttpRequestMessage(HttpMethod.Post, url);
            reqAprob.Content = new StringContent("{}", Encoding.UTF8, "application/json");
            respAprobadores = await client.SendAsync(reqAprob);
        }
        catch (Exception ex)
        {
            return StatusCode(503, new { error = "Servicio de aprobadores no disponible", detalle = ex.Message });
        }

        if (!respAprobadores.IsSuccessStatusCode)
            return StatusCode(502, new { error = "No se pudieron obtener los aprobadores" });

        var bodyAprob = await respAprobadores.Content.ReadAsStringAsync();
        var aprobadores = JsonSerializer.Deserialize<List<AprobadorRow>>(bodyAprob, JsonOpts);

        return Ok(new { items = aprobadores ?? new List<AprobadorRow>() });
    }

    // ── Tipos internos ────────────────────────────────────────
    private record PerfilRow(
        int Id, int PersonaId, int SubAlmacenId, string AprobadorId,
        string? AprobadorNombre, string? AprobadorCargo,
        string SubAlmacenNombre, string? Sigla,
        int AlmacenId, string AlmacenNombre);

    private record SubAlmacenParaPerfilRow(
        int Id, string Nombre, string? Sigla, int AlmacenId, string AlmacenNombre);

    private record UsuarioRow(int Id, string Username, string Role);

    private record RelacionLaboralRow(int Id, bool Activo);

    private record AprobadorRow(
        string Ci,
        string NombreCompleto,
        int RelacionLaboral,
        int CargoId,
        string Cargo,
        int AreaOrganizacionalId,
        string AreaOrganizacional,
        string? Email,
        string? Username);
}

// ── Request DTO ──────────────────────────────────────────────
public record PerfilSaveRequest(
    List<int> SubAlmacenIds,
    string AprobadorId,
    string? AprobadorNombre = null,
    string? AprobadorCargo = null);
