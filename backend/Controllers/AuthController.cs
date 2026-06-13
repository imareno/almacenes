using Almacen.Helpers;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Almacen.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly Db                  _db;
    private readonly JwtHelper           _jwt;
    private readonly IHttpClientFactory  _httpFactory;

    private const string ServicioExternoUrl = "https://hades.oopp.gob.bo/seguridad/api/get_token/";

    public AuthController(Db db, JwtHelper jwt, IHttpClientFactory httpFactory)
    {
        _db          = db;
        _jwt         = jwt;
        _httpFactory = httpFactory;
    }

    // POST /api/auth/login
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Username) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "Usuario y contraseña son requeridos" });

        // Llamar al servicio externo de autenticación
        var client   = _httpFactory.CreateClient();
        var payload  = JsonSerializer.Serialize(new { username = req.Username.Trim(), password = req.Password });
        var content  = new StringContent(payload, System.Text.Encoding.UTF8, "application/json");

        HttpResponseMessage respuesta;
        try
        {
            respuesta = await client.PostAsync(ServicioExternoUrl, content);
        }
        catch (Exception ex)
        {
            return StatusCode(503, new { error = "Servicio de autenticación no disponible", detalle = ex.Message });
        }

        var body = await respuesta.Content.ReadAsStringAsync();

        if (!respuesta.IsSuccessStatusCode)
            return Unauthorized(new { error = "Credenciales inválidas" });

        // Extraer el token del servicio externo
        var resultado = JsonSerializer.Deserialize<RespuestaToken>(body);

        if (resultado?.Token is null)
            return Unauthorized(new { error = "Credenciales inválidas" });

        // Por ahora retornamos el token externo directamente al frontend
        return Ok(new
        {
            token         = resultado.Token,
            externalToken = resultado.Token,
            user = new
            {
                id       = "0",
                username = req.Username.Trim(),
                role     = "user"
            }
        });
    }

    // POST /api/auth/refresh
    [HttpPost("refresh")]
    [Authorize]
    public async Task<IActionResult> Refresh()
    {
        var userId   = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var username = User.FindFirstValue(ClaimTypes.Name)!;

        using var conn = _db.CreateConnection();

        var user = await conn.QuerySingleOrDefaultAsync<UserRefresh>(
            "SELECT id, username, role, active FROM users WHERE id = @userId",
            new { userId });

        if (user is null || !user.Active)
            return Unauthorized(new { error = "Usuario inactivo o no encontrado" });

        var token = _jwt.GenerateToken(user.Id, user.Username, user.Role);

        return Ok(new
        {
            token,
            user = new { user.Id, user.Username, user.Role }
        });
    }

    private record UserRefresh(int Id, string Username, string Role, bool Active);

    private class RespuestaToken
    {
        [JsonPropertyName("token")]
        public string? Token { get; set; }
    }
}

public record LoginRequest(string Username, string Password);
