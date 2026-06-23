using Almacen;
using Almacen.Helpers;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.OpenApi.Models;

Dapper.DefaultTypeMap.MatchNamesWithUnderscores = true;
Dapper.SqlMapper.AddTypeHandler(new Almacen.Helpers.DapperDateOnlyHandler());

var builder = WebApplication.CreateBuilder(args);

// ── Base de datos ─────────────────────────────────────────────
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")!;
builder.Services.AddSingleton(new Db(connectionString));

// ── JWT ───────────────────────────────────────────────────────
var jwtHelper = new JwtHelper(builder.Configuration);
builder.Services.AddSingleton(jwtHelper);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = jwtHelper.GetValidationParameters();
        options.MapInboundClaims = false;
    });

builder.Services.AddAuthorization();

// ── HttpClient ────────────────────────────────────────────────
builder.Services.AddHttpClient();

// ── Controllers ───────────────────────────────────────────────
builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });

// ── Swagger ───────────────────────────────────────────────────
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title   = "Sistema de Control de Almacén",
        Version = "v1"
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description  = "JWT Authorization header. Formato: Bearer {token}",
        Name         = "Authorization",
        In           = ParameterLocation.Header,
        Type         = SecuritySchemeType.Http,
        Scheme       = "bearer",
        BearerFormat = "JWT"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id   = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// ── CORS (desarrollo) ─────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(
                builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                ?? ["http://localhost:5173"])
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// ─────────────────────────────────────────────────────────────
var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
