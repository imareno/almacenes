using Almacen.Helpers;
using Almacen.Models;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Almacen.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly Db                 _db;
    private readonly JwtHelper          _jwt;
    private readonly IHttpClientFactory _httpFactory;
    private readonly IConfiguration     _config;

    private const string UrlGetToken   = "https://hades.oopp.gob.bo/seguridad/api/get_token/";
    private const string UrlGetUsuario = "https://hades.oopp.gob.bo/seguridad/api/get_usuario/";

    public AuthController(Db db, JwtHelper jwt, IHttpClientFactory httpFactory, IConfiguration config)
    {
        _db          = db;
        _jwt         = jwt;
        _httpFactory = httpFactory;
        _config      = config;
    }

    // POST /api/auth/login
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Username) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "Usuario y contraseña son requeridos" });

        var client = _httpFactory.CreateClient();

        // 1. Obtener hash del servicio externo
        var payload = JsonSerializer.Serialize(new { username = req.Username.Trim(), password = req.Password });
        var content = new StringContent(payload, Encoding.UTF8, "application/json");

        HttpResponseMessage respToken;
        try
        {
            respToken = await client.PostAsync(UrlGetToken, content);
        }
        catch (Exception ex)
        {
            return StatusCode(503, new { error = "Servicio de autenticación no disponible", detalle = ex.Message });
        }

        if (!respToken.IsSuccessStatusCode)
            return Unauthorized(new { error = "Credenciales inválidas" });

        var bodyToken  = await respToken.Content.ReadAsStringAsync();
        var tokenData  = JsonSerializer.Deserialize<RespuestaToken>(bodyToken);

        if (string.IsNullOrWhiteSpace(tokenData?.Token))
            return Unauthorized(new { error = "Credenciales inválidas" });

        // 2. Obtener datos del usuario con el hash recibido
        var reqUsuario = new HttpRequestMessage(HttpMethod.Get, UrlGetUsuario);
        reqUsuario.Headers.Add("Authorization", $"Token {tokenData.Token}");

        HttpResponseMessage respUsuario;
        try
        {
            respUsuario = await client.SendAsync(reqUsuario);
        }
        catch (Exception ex)
        {
            return StatusCode(503, new { error = "Error al obtener datos del usuario", detalle = ex.Message });
        }

        if (!respUsuario.IsSuccessStatusCode)
            return StatusCode(502, new { error = "No se pudieron obtener los datos del usuario" });

        var bodyUsuario  = await respUsuario.Content.ReadAsStringAsync();
        var usuarioExt   = JsonSerializer.Deserialize<UsuarioExterno>(bodyUsuario);

        if (usuarioExt is null || usuarioExt.Id <= 0)
            return StatusCode(502, new { error = "Respuesta inválida del servicio de usuarios" });

        // 3. Determinar rol: admin si está en almacen_encargado con admin=true,
        //    almacenero si está sin admin, solicitante si no está
        var role = "solicitante";
        try
        {
            using var conn = _db.CreateConnection();
            var esAdmin = await conn.ExecuteScalarAsync<bool?>(
                "SELECT admin FROM almacen_encargado WHERE user_id = @uid AND active = true LIMIT 1",
                new { uid = usuarioExt.Id });
            if (esAdmin.HasValue)
                role = esAdmin.Value ? "admin" : "almacenero";
        }
        catch { /* BD no disponible — rol por defecto "solicitante" */ }

        // 4. Generar JWT con nombre, foto, ci y el token del servicio externo en los claims
        var token = _jwt.GenerateToken(
            usuarioExt.Id,
            usuarioExt.Username,
            role,
            usuarioExt.Persona?.Nombres,
            usuarioExt.Persona?.Fotografia,
            usuarioExt.Persona?.Ci,
            tokenData.Token);

        // 5. Registrar sesión (opcional)
        try
        {
            using var conn2 = _db.CreateConnection();
            var expMinutes  = int.Parse(_config["Jwt:ExpirationMinutes"] ?? "60");
            await conn2.ExecuteAsync(@"
                INSERT INTO sesiones (user_id, username, ip_address, user_agent, token_hash, fecha_expiracion)
                VALUES (@userId, @username, @ip, @ua, @hash, @exp)",
                new
                {
                    userId   = usuarioExt.Id,
                    username = usuarioExt.Username,
                    ip       = HttpContext.Connection.RemoteIpAddress?.ToString(),
                    ua       = Request.Headers.UserAgent.ToString(),
                    hash     = ComputeSha256(token),
                    exp      = DateTime.UtcNow.AddMinutes(expMinutes)
                });
        }
        catch { /* BD no disponible — sin registro de sesión */ }

        return Ok(new
        {
            token,
            user = new
            {
                id             = usuarioExt.Id,
                username       = usuarioExt.Username,
                email          = usuarioExt.Email,
                nombreCompleto = usuarioExt.Persona?.NombreCompleto,
                fotografia     = usuarioExt.Persona?.Fotografia,
                role
            }
        });
    }

    // POST /api/auth/logout
    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        var authHeader = Request.Headers.Authorization.ToString();
        var token      = authHeader.StartsWith("Bearer ") ? authHeader[7..] : null;

        if (token is not null)
        {
            var tokenHash = ComputeSha256(token);
            using var conn = _db.CreateConnection();
            await conn.ExecuteAsync(@"
                UPDATE sesiones
                SET estado = 'cerrada', fecha_logout = NOW()
                WHERE token_hash = @hash AND estado = 'activa'",
                new { hash = tokenHash });
        }

        return Ok(new { mensaje = "Sesión cerrada" });
    }

    // POST /api/auth/refresh
    [HttpPost("refresh")]
    [Authorize]
    public async Task<IActionResult> Refresh()
    {
        var userId   = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var username = User.FindFirstValue(ClaimTypes.Name)!;

        using var conn = _db.CreateConnection();

        // Re-verificar rol por si cambió la asignación
        var esAdmin = await conn.ExecuteScalarAsync<bool?>(
            "SELECT admin FROM almacen_encargado WHERE user_id = @uid AND active = true LIMIT 1",
            new { uid = userId });
        var role = esAdmin.HasValue ? (esAdmin.Value ? "admin" : "almacenero") : "solicitante";

        // Preservar claims adicionales del token actual
        var nombre = User.FindFirst("nombre")?.Value;
        var foto   = User.FindFirst("foto")?.Value;
        var ci     = User.FindFirst("ci")?.Value;
        var tknrh  = User.FindFirst("tknrh")?.Value;

        var token = _jwt.GenerateToken(userId, username, role, nombre, foto, ci, tknrh);

        return Ok(new
        {
            token,
            user = new { id = userId, username, role }
        });
    }

    private static string ComputeSha256(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    // ── Modelos internos ──────────────────────────────────────────────────────

    private class RespuestaToken
    {
        [JsonPropertyName("token")]
        public string? Token { get; set; }
    }
}

public record LoginRequest(string Username, string Password);
