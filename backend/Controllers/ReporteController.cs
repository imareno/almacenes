using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Data;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Almacen.Controllers;

[ApiController]
[Route("api/reportes")]
[Authorize(Roles = "admin,almacenero,readonly")]
public class ReporteController : ControllerBase
{
    private readonly Db _db;
    private readonly IHttpClientFactory _httpFactory;
    private readonly IConfiguration _config;

    public ReporteController(Db db, IHttpClientFactory httpFactory, IConfiguration config)
    {
        _db = db;
        _httpFactory = httpFactory;
        _config = config;
    }

    // GET /api/reportes/compras/{id}/reporte
    [HttpGet("compras/{id:int}/reporte")]
    public async Task<IActionResult> GetCompraReporte(int id, CancellationToken ct)
    {
        using var conn = _db.CreateConnection();

        var compra = await conn.QuerySingleOrDefaultAsync<CompraDetalleRow>(
            @"SELECT c.id, c.numero, c.proveedor, c.detalle, c.fecha, c.estado,
                     c.sub_almacen_id, sa.nombre AS sub_almacen_nombre,
                     a.id AS almacen_id, a.nombre AS almacen_nombre,
                     c.created_at
              FROM compras c
              JOIN sub_almacenes sa ON sa.id = c.sub_almacen_id
              JOIN almacenes a ON a.id = sa.almacen_id
              WHERE c.id = @id AND c.active = true",
            new { id });

        if (compra is null) return NotFound(new { error = "Compra no encontrada" });

        var items = await conn.QueryAsync<CompraDetalleItemRow>(
            @"SELECT ci.id, ci.material_id, m.codigo, m.nombre AS material_nombre,
                     ci.unidad_medida, (ci.cantidad)::numeric(10,0) as cantidad, (ci.precio_unitario)::numeric(10,2) as precio_unitario,
                     (ci.cantidad * ci.precio_unitario)::numeric(10,2) AS subtotal
              FROM compra_items ci
              JOIN materiales m ON m.id = ci.material_id
              WHERE ci.compra_id = @id
              ORDER BY ci.id",
            new { id });

        var itemsList = items.Select((item, index) => new
        {
            nro = index + 1,
            codigo = item.Codigo,
            articulo = item.MaterialNombre,
            unidad = item.UnidadMedida,
            cantidad = item.Cantidad,
            precioUnidad = item.PrecioUnitario,
            precioTotal = item.Subtotal
        }).ToList();

        var pAlmacenBody = new
        {
            cabecera = new
            {
                numero = compra.Numero ?? "",
                fechaIngreso = compra.Fecha.ToString("yyyy-MM-dd"),
                proveedor = compra.Proveedor,
                almacen = compra.AlmacenNombre,
                subAlmacen = compra.SubAlmacenNombre,
                detalle = compra.Detalle
            },
            items = itemsList
        };

        var jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        var jsonBody = JsonSerializer.Serialize(pAlmacenBody, jsonOptions);

        var reportPath = _config["Jasper:ReportPathIngresos"] ?? "/ingresos";
        var titulo     = _config["Jasper:TituloIngreso"] ?? "NOTA DE INGRESO";

        var (pdf, error) = await GenerarPdfJasperAsync(reportPath, titulo, jsonBody, ct);
        if (pdf is null)
            return StatusCode(502, new { error = "No se pudo generar el reporte en Jasper", detalle = error });

        var nombreArchivo = string.IsNullOrWhiteSpace(compra.Numero) ? "Compra" : compra.Numero;
        return File(pdf, "application/pdf", $"{nombreArchivo}.pdf");
    }

    // GET /api/reportes/solicitudes/{id}/reporte
    [HttpGet("solicitudes/{id:int}/reporte")]
    public async Task<IActionResult> GetSolicitudReporte(int id, CancellationToken ct)
    {
        using var conn = _db.CreateConnection();

        var solicitud = await ObtenerSolicitudDetalleAsync(conn, id);
        if (solicitud is null) return NotFound(new { error = "Solicitud no encontrada" });

        // Cuerpo del reporte: costos PEPS (FIFO) por lote, calculados en tiempo real
        var filas = await conn.QueryAsync<ReporteSolicitudRow>(
            "SELECT * FROM fn_reporte_solicitud(@solicitudId)",
            new { solicitudId = id });

        var itemsList = filas.Select(f => new
        {
            nro = f.Nro,
            codigo = f.Codigo,
            articulo = f.Material,
            unidad = f.Unidad ?? "",
            fechaIngreso = f.FechaIngreso.ToString("yyyy-MM-dd"),
            cantidad = f.Cantidad,
            unitario = f.Unitario,
            monto = f.Monto,
            salidas = f.Salidas,
            disponible = f.Disponible,
            solicitado = f.Solicitado,
            aprobado = f.Aprobado,
            usado = f.Usado,
            total = f.Total
        }).ToList();

        var pAlmacenBody = new
        {
            cabecera = ConstruirCabecera(solicitud),
            items = itemsList
        };

        var jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        var jsonBody = JsonSerializer.Serialize(pAlmacenBody, jsonOptions);

        var reportPath = _config["Jasper:ReportPathSolicitudes"] ?? "/solicitudes";
        var titulo     = _config["Jasper:TituloSolicitud"] ?? "SOLICITUD DE MATERIALES";

        var (pdf, error) = await GenerarPdfJasperAsync(reportPath, titulo, jsonBody, ct);
        if (pdf is null)
            return StatusCode(502, new { error = "No se pudo generar el reporte en Jasper", detalle = error });

        var nombreArchivo = string.IsNullOrWhiteSpace(solicitud.Numero) ? "Solicitud" : solicitud.Numero;
        return File(pdf, "application/pdf", $"{nombreArchivo}.pdf");
    }

    // GET /api/reportes/solicitudes/{id}/reporte-simple  (sin FIFO ni costos: solo cantidades)
    [HttpGet("solicitudes/{id:int}/reporte-simple")]
    public async Task<IActionResult> GetSolicitudReporteSimple(int id, CancellationToken ct)
    {
        using var conn = _db.CreateConnection();

        var solicitud = await ObtenerSolicitudDetalleAsync(conn, id);
        if (solicitud is null) return NotFound(new { error = "Solicitud no encontrada" });

        var filas = await conn.QueryAsync<ReporteSolicitudSimpleRow>(
            "SELECT * FROM fn_reporte_solicitud_simple(@solicitudId)",
            new { solicitudId = id });

        var itemsList = filas.Select(f => new
        {
            nro = f.Nro,
            codigo = f.Codigo,
            articulo = f.Material,
            unidad = f.Unidad ?? "",
            fechaIngreso = f.FechaIngreso.ToString("yyyy-MM-dd"),
            cantidad = f.Cantidad,
            solicitado = f.Solicitado,
            aprobado = f.Aprobado
        }).ToList();

        var pAlmacenBody = new
        {
            cabecera = ConstruirCabecera(solicitud),
            items = itemsList
        };

        var jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        var jsonBody = JsonSerializer.Serialize(pAlmacenBody, jsonOptions);

        var reportPath = _config["Jasper:ReportPathSolicitudesSimple"] ?? "/solicitudes";
        var titulo     = _config["Jasper:TituloSolicitud"] ?? "SOLICITUD DE MATERIALES";

        var (pdf, error) = await GenerarPdfJasperAsync(reportPath, titulo, jsonBody, ct);
        if (pdf is null)
            return StatusCode(502, new { error = "No se pudo generar el reporte en Jasper", detalle = error });

        var nombreArchivo = string.IsNullOrWhiteSpace(solicitud.Numero) ? "Solicitud" : solicitud.Numero;
        return File(pdf, "application/pdf", $"{nombreArchivo}-simple.pdf");
    }

    // ── Helpers de solicitudes ──────────────────────────────────
    private static async Task<SolicitudDetalleRow?> ObtenerSolicitudDetalleAsync(IDbConnection conn, int id)
    {
        return await conn.QuerySingleOrDefaultAsync<SolicitudDetalleRow>(
            @"SELECT s.id, s.numero, s.estado,
                     s.solicitante_nombre AS solicitante,
                     s.solicitante_cargo AS solicitante_cargo,
                     s.solicitante_organigrama AS solicitante_organigrama,
                     sa.nombre AS sub_almacen_nombre,
                     a.nombre  AS almacen_nombre,
                     s.fecha_solicitud
              FROM solicitudes s
              JOIN sub_almacenes sa ON sa.id = s.sub_almacen_id
              JOIN almacenes     a  ON a.id  = sa.almacen_id
              WHERE s.id = @id AND s.active = true",
            new { id });
    }

    private static object ConstruirCabecera(SolicitudDetalleRow s) => new
    {
        numero = s.Numero,
        fechaSolicitud = s.FechaSolicitud.ToString("yyyy-MM-dd"),
        solicitante = s.Solicitante ?? "",
        solicitanteCargo = s.SolicitanteCargo ?? "",
        solicitanteOrganigrama = s.SolicitanteOrganigrama ?? "",
        almacen = s.AlmacenNombre,
        subAlmacen = s.SubAlmacenNombre
    };

    // ── Llamada a Jasper (Report Execution API: POST crea, GET descarga) ─────
    private async Task<(byte[]? Pdf, string? Error)> GenerarPdfJasperAsync(
        string reportPath, string titulo, string jsonBody, CancellationToken ct)
    {
        var http    = _httpFactory.CreateClient();
        var server  = _config["Jasper:ServerUrl"] ?? "http://reportes.oopp.gob.bo";
        var credentials = Convert.ToBase64String(
            Encoding.ASCII.GetBytes($"{_config["Jasper:Username"]}:{_config["Jasper:Password"]}"));

        // 1) POST — crear ejecución del reporte
        var payload = new JsonObject
        {
            ["reportUnitUri"]     = reportPath,
            ["outputFormat"]      = "pdf",
            ["async"]             = false,
            ["freshData"]         = true,
            ["saveDataSnapshot"]  = false,
            ["interactive"]       = false,
            ["ignorePagination"]  = false,
            ["parameters"] = new JsonObject
            {
                ["reportParameter"] = new JsonArray
                {
                    new JsonObject { ["name"] = "P_ALMACEN_TITULO", ["value"] = new JsonArray { titulo } },
                    new JsonObject { ["name"] = "P_ALMACEN_BODY",   ["value"] = new JsonArray { jsonBody } }
                }
            }
        };

        var post = new HttpRequestMessage(HttpMethod.Post, $"{server}/rest_v2/reportExecutions")
        {
            Content = new StringContent(payload.ToJsonString(), Encoding.UTF8, "application/json")
        };
        post.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", credentials);
        post.Headers.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/json"));

        var respPost = await http.SendAsync(post, ct);
        if (!respPost.IsSuccessStatusCode)
            return (null, await respPost.Content.ReadAsStringAsync(ct));

        var ejecucion = JsonNode.Parse(await respPost.Content.ReadAsStringAsync(ct));
        var requestId = ejecucion?["requestId"]?.GetValue<string>();
        var exportId  = ejecucion?["exports"]?[0]?["id"]?.GetValue<string>();

        if (string.IsNullOrWhiteSpace(requestId) || string.IsNullOrWhiteSpace(exportId))
            return (null, "Respuesta de Jasper sin requestId/exports");

        // 2) GET — descargar el PDF generado
        var get = new HttpRequestMessage(HttpMethod.Get,
            $"{server}/rest_v2/reportExecutions/{requestId}/exports/{exportId}/outputResource");
        get.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", credentials);

        var respGet = await http.SendAsync(get, ct);
        if (!respGet.IsSuccessStatusCode)
            return (null, await respGet.Content.ReadAsStringAsync(ct));

        return (await respGet.Content.ReadAsByteArrayAsync(ct), null);
    }

    // ── Tipos internos ─────────────────────────────────────────
    private class CompraDetalleRow
    {
        public int Id { get; set; }
        public string? Numero { get; set; }
        public string Proveedor { get; set; } = "";
        public string Detalle { get; set; } = "";
        public DateOnly Fecha { get; set; }
        public string Estado { get; set; } = "";
        public int SubAlmacenId { get; set; }
        public string SubAlmacenNombre { get; set; } = "";
        public int AlmacenId { get; set; }
        public string AlmacenNombre { get; set; } = "";
        public DateTime CreatedAt { get; set; }
    }

    private record CompraDetalleItemRow(int Id, int MaterialId, string Codigo, string MaterialNombre,
                                        string UnidadMedida, decimal Cantidad, decimal PrecioUnitario, decimal Subtotal);

    private class SolicitudDetalleRow
    {
        public int Id { get; set; }
        public string Numero { get; set; } = "";
        public string Estado { get; set; } = "";
        public string? Solicitante { get; set; }
        public string? SolicitanteCargo { get; set; }
        public string? SolicitanteOrganigrama { get; set; }
        public string SubAlmacenNombre { get; set; } = "";
        public string AlmacenNombre { get; set; } = "";
        public string? Aprobador { get; set; }
        public string? Almacenero { get; set; }
        public DateOnly FechaSolicitud { get; set; }
        public string? Observacion { get; set; }
    }

    private class ReporteSolicitudRow
    {
        public long     Nro          { get; set; }
        public int      MaterialId   { get; set; }
        public string   Codigo       { get; set; } = "";
        public string   Material     { get; set; } = "";
        public string?  Unidad       { get; set; }
        public DateOnly FechaIngreso { get; set; }
        public decimal  Cantidad     { get; set; }
        public decimal  Unitario     { get; set; }
        public decimal  Monto        { get; set; }
        public decimal  Salidas      { get; set; }
        public decimal  Disponible   { get; set; }
        public decimal  Solicitado   { get; set; }
        public decimal  Aprobado     { get; set; }
        public decimal  Usado        { get; set; }
        public decimal  Total        { get; set; }
    }

    private class ReporteSolicitudSimpleRow
    {
        public long     Nro          { get; set; }
        public int      MaterialId   { get; set; }
        public string   Codigo       { get; set; } = "";
        public string   Material     { get; set; } = "";
        public string?  Unidad       { get; set; }
        public DateOnly FechaIngreso { get; set; }
        public decimal  Cantidad     { get; set; }
        public decimal  Solicitado   { get; set; }
        public decimal  Aprobado     { get; set; }
    }
}
