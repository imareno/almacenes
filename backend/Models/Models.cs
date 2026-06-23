namespace Almacen.Models;

public class User
{
    public int      Id           { get; set; }
    public string   Username     { get; set; } = "";
    public string   PasswordHash { get; set; } = "";
    public string   Role         { get; set; } = "";
    public bool     Active       { get; set; }
    public DateTime CreatedAt    { get; set; }
}

public class Almacen
{
    public int     Id          { get; set; }
    public string  Nombre      { get; set; } = "";
    public string? Descripcion { get; set; }
    public bool    Active      { get; set; }
}

public class SubAlmacen
{
    public int     Id                    { get; set; }
    public int     AlmacenId             { get; set; }
    public string  Nombre                { get; set; } = "";
    public string? Sigla                 { get; set; }
    public string? Descripcion           { get; set; }
    public int     SecuenciaIngresos     { get; set; }
    public int     SecuenciaSolicitudes  { get; set; }
    public bool    Active                { get; set; }
}

public class Material
{
    public int      Id            { get; set; }
    public string   Codigo        { get; set; } = "";
    public string   Nombre        { get; set; } = "";
    public string?  Descripcion   { get; set; }
    public string   UnidadMedida  { get; set; } = "";
    public string?  Categoria     { get; set; }
    public bool     Active        { get; set; }
    public DateTime CreatedAt     { get; set; }
}

public class Compra
{
    public int      Id            { get; set; }
    public string?  Numero        { get; set; }
    public string   Proveedor     { get; set; } = "";
    public string   Detalle       { get; set; } = "";
    public DateTime Fecha         { get; set; }
    public string   Estado        { get; set; } = "pendiente";
    public int      SubAlmacenId  { get; set; }
    public int?     UserId        { get; set; }
    public bool     Active        { get; set; }
    public DateTime CreatedAt     { get; set; }
}

public class CompraItem
{
    public int     Id             { get; set; }
    public int     CompraId       { get; set; }
    public int     MaterialId     { get; set; }
    public decimal Cantidad       { get; set; }
    public decimal PrecioUnitario { get; set; }
    public DateTime CreatedAt     { get; set; }
}

public class Movimiento
{
    public int      Id             { get; set; }
    public string   Tipo           { get; set; } = "";
    public int      MaterialId     { get; set; }
    public int      AlmacenId      { get; set; }
    public decimal  Cantidad       { get; set; }
    public decimal  CostoUnitario  { get; set; }
    public string?  LoteRef        { get; set; }
    public DateTime Fecha          { get; set; }
    public int?     SolicitudId    { get; set; }
    public int?     CompraItemId   { get; set; }
    public int      UserId         { get; set; }
    public string?  Observacion    { get; set; }
    public DateTime CreatedAt      { get; set; }
}

public class Solicitud
{
    public int       Id              { get; set; }
    public string    Numero          { get; set; } = "";
    public int       SolicitanteId   { get; set; }
    public int       AlmacenId       { get; set; }
    public string    Estado          { get; set; } = "pendiente";
    public int?      AprobadorId     { get; set; }
    public int?      AlmaceneroId    { get; set; }
    public DateTime  FechaSolicitud  { get; set; }
    public DateTime? FechaAprobacion { get; set; }
    public DateTime? FechaDespacho   { get; set; }
    public DateTime? FechaEntrega    { get; set; }
    public string?   Observacion     { get; set; }
    public DateTime  CreatedAt       { get; set; }
}

public class SolicitudItem
{
    public int     Id                 { get; set; }
    public int     SolicitudId        { get; set; }
    public int     MaterialId         { get; set; }
    public decimal CantidadSolicitada { get; set; }
    public decimal CantidadDespachada { get; set; }
    public decimal CantidadEntregada  { get; set; }
    public DateTime CreatedAt         { get; set; }
}

public class Lote
{
    public int      Id                 { get; set; }
    public int      MaterialId         { get; set; }
    public int      AlmacenId          { get; set; }
    public decimal  CantidadInicial    { get; set; }
    public decimal  CantidadDisponible { get; set; }
    public decimal  CostoUnitario      { get; set; }
    public DateTime FechaIngreso       { get; set; }
    public int?     CompraItemId       { get; set; }
    public DateTime CreatedAt          { get; set; }
}

public class AlmacenEncargado
{
    public int      AlmacenId  { get; set; }
    public int      UserId     { get; set; }
    public bool     Active     { get; set; }
    public DateTime CreatedAt  { get; set; }
}

public class Sesion
{
    public int       Id               { get; set; }
    public int       UserId           { get; set; }
    public string    Username         { get; set; } = "";
    public string?   IpAddress        { get; set; }
    public string?   UserAgent        { get; set; }
    public string?   TokenHash        { get; set; }
    public DateTime  FechaLogin       { get; set; }
    public DateTime? FechaExpiracion  { get; set; }
    public DateTime? FechaLogout      { get; set; }
    public string    Estado           { get; set; } = "activa";
    public DateTime  CreatedAt        { get; set; }
}
