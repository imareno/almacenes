using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Almacen.Helpers;

public class JwtHelper
{
    private readonly string _secret;
    private readonly string _issuer;
    private readonly string _audience;
    private readonly int _expirationMinutes;

    public JwtHelper(IConfiguration config)
    {
        _secret            = config["Jwt:Secret"]!;
        _issuer            = config["Jwt:Issuer"]!;
        _audience          = config["Jwt:Audience"]!;
        _expirationMinutes = int.Parse(config["Jwt:ExpirationMinutes"] ?? "60");
    }

    public string GenerateToken(int userId, string username, string role,
                                string? nombreCompleto = null, string? fotografia = null,
                                string? ci = null)
    {
        var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub,        userId.ToString()),
            new Claim(ClaimTypes.NameIdentifier,          userId.ToString()),
            new Claim(JwtRegisteredClaimNames.UniqueName, username),
            new Claim("role", role),
            new Claim(JwtRegisteredClaimNames.Jti,        Guid.NewGuid().ToString())
        };

        if (!string.IsNullOrWhiteSpace(nombreCompleto))
            claims.Add(new Claim("nombre", nombreCompleto));

        if (!string.IsNullOrWhiteSpace(fotografia))
            claims.Add(new Claim("foto", fotografia));

        if (!string.IsNullOrWhiteSpace(ci))
            claims.Add(new Claim("ci", ci));

        var token = new JwtSecurityToken(
            issuer:             _issuer,
            audience:           _audience,
            claims:             claims,
            expires:            DateTime.UtcNow.AddMinutes(_expirationMinutes),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public TokenValidationParameters GetValidationParameters()
    {
        return new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidateAudience         = true,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer              = _issuer,
            ValidAudience            = _audience,
            IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secret)),
            RoleClaimType            = "role",
            NameClaimType            = JwtRegisteredClaimNames.UniqueName
        };
    }
}
