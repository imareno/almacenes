\# Sistema de Control de Almacén



\## Stack

\- Backend:  .NET Core 8 Web API

\- Base de datos: PostgreSQL

\- Frontend: React + DevExtreme (template oficial DevExpress)

\- ORM: Sin ORM — queries SQL directas con Dapper

\- Auth: JWT propio — integrado al sistema de auth del template DevExtreme



\## Filosofía del proyecto

\- Arquitectura PLANA. Sin repositorios, sin capas de servicios innecesarias.

\- Controllers llaman directo a la base de datos con Dapper.

\- Sin interfaces salvo que sean absolutamente necesarias.

\- Código simple, legible y funcional sobre código "elegante".

\- Las existencias NO se almacenan — se calculan en tiempo real:

&#x20; EXISTENCIA = Σ ingresos - Σ salidas (por material, por almacén)

\- Valorización con lógica PEPS (FIFO): primera entrada = primera salida.



\## Estructura del proyecto

/backend

Program.cs                → setup, DI, rutas, middleware, JWT

Db.cs                     → conexión Dapper centralizada

Controllers/

AuthController.cs

AlmacenController.cs

MaterialController.cs

CompraController.cs

MovimientoController.cs

SolicitudController.cs

ReporteController.cs

Models/                   → POCOs simples, sin lógica

Helpers/

PepsHelper.cs            → lógica PEPS/FIFO

JwtHelper.cs             → generación y validación JWT

Scripts/

01\_schema.sql            → creación de tablas

02\_seed.sql              → datos iniciales

/frontend                   → React + DevExtreme template oficial

src/

api/                    → un archivo por módulo (almacen.js,

material.js, compra.js, etc.)

pages/                  → una página por pantalla

components/             → solo si se reutiliza 2+ veces

auth/                   → ajuste del auth DevExtreme → JWT propio



\## Base de datos PostgreSQL



```sql

\-- Usuarios y roles

users           → id, username, password\_hash, role, active, created\_at

&#x20; roles: 'admin' | 'almacenero' | 'solicitante' | 'aprobador' | 'readonly'



\-- Almacenes (árbol con parent\_id)

almacenes       → id, nombre, descripcion, parent\_id (null = raíz), active



\-- Materiales

materiales      → id, codigo, nombre, descripcion, unidad\_medida,

&#x20;                  categoria, active, created\_at



\-- Compras (cabecera)

compras         → id, numero, proveedor, fecha, estado, user\_id, created\_at

&#x20; estados: 'borrador' | 'confirmada' | 'recibida'



\-- Detalle de compras

compra\_items    → id, compra\_id, material\_id, cantidad,

&#x20;                  precio\_unitario, created\_at



\-- Movimientos — fuente de verdad de existencias

movimientos     → id, tipo, material\_id, almacen\_id, cantidad,

&#x20;                  costo\_unitario, fecha, solicitud\_id,

&#x20;                  compra\_item\_id, user\_id, observacion, created\_at

&#x20; tipo: 'ingreso' | 'salida'



\-- Solicitudes

solicitudes     → id, numero, solicitante\_id, almacen\_id, estado,

&#x20;                  aprobador\_id, almacenero\_id, fecha\_solicitud,

&#x20;                  fecha\_aprobacion, fecha\_despacho, fecha\_entrega,

&#x20;                  observacion, created\_at

&#x20; estados: 'pendiente' | 'aprobada' | 'rechazada' | 'despachada' | 'entregado'



\-- Detalle de solicitudes

solicitud\_items → id, solicitud\_id, material\_id, cantidad\_solicitada,

&#x20;                  cantidad\_despachada, cantidad\_entregada, created\_at



\-- Lotes PEPS/FIFO

lotes           → id, material\_id, almacen\_id, cantidad\_inicial,

&#x20;                  cantidad\_disponible, costo\_unitario,

&#x20;                  fecha\_ingreso, compra\_item\_id, created\_at

```



\## Flujo completo de solicitudes



SOLICITANTE crea solicitud

→ estado: "pendiente"

→ registra: solicitante\_id, almacen\_id, items (cantidad\_solicitada)

APROBADOR aprueba o rechaza

→ aprobada:  estado "aprobada"  | registra: aprobador\_id, fecha\_aprobacion

→ rechazada: estado "rechazada" | registra: aprobador\_id, fecha\_aprobacion, observacion

ALMACENERO despacha materiales

→ estado: "despachada"

→ registra: almacenero\_id, fecha\_despacho, cantidad\_despachada por item

→ genera movimientos de salida aplicando lógica PEPS

→ descuenta lotes correspondientes (fecha\_ingreso ASC)

ALMACENERO confirma entrega física

→ estado: "entregado"

→ registra: fecha\_entrega, cantidad\_entregada por item

→ NO genera movimientos — solo confirmación física

→ fin del flujo





\## Reglas del flujo

\- Solo el solicitante puede crear/cancelar sus solicitudes (estado "pendiente")

\- Solo el aprobador puede aprobar o rechazar (estado "pendiente")

\- Solo el almacenero puede despachar (estado "aprobada")

\- Solo el almacenero puede confirmar entrega (estado "despachada")

\- El movimiento de salida se genera al DESPACHAR, no al entregar

\- Admin puede ejecutar cualquier acción



\## Lógica PEPS (FIFO)

1\. Cada ingreso crea un registro en `lotes` con cantidad y costo

2\. Al despachar: ordenar lotes por fecha\_ingreso ASC

3\. Consumir lote más antiguo hasta completar cantidad despachada

4\. Si lote se agota, continuar con el siguiente

5\. Costo de salida = suma ponderada de lotes consumidos

6\. Actualizar cantidad\_disponible en cada lote consumido



\## Cálculo de existencias (tiempo real, sin tabla de stock)

```sql

SELECT

&#x20; material\_id,

&#x20; almacen\_id,

&#x20; SUM(CASE WHEN tipo = 'ingreso' THEN cantidad ELSE -cantidad END) as existencia

FROM movimientos

WHERE material\_id = @materialId AND almacen\_id = @almacenId

GROUP BY material\_id, almacen\_id

```



\## Roles y permisos

\- admin        → acceso total

\- almacenero   → ingresos, salidas, despachos, entregas, reportes

\- solicitante  → crear y ver sus propias solicitudes

\- aprobador    → aprobar/rechazar solicitudes

\- readonly     → solo reportes y consultas



\## Endpoints backend



\### Auth

\- POST /api/auth/login       → retorna JWT + datos de usuario

\- POST /api/auth/refresh



\### Almacenes

\- GET    /api/almacenes               → árbol completo

\- POST   /api/almacenes

\- PUT    /api/almacenes/{id}

\- DELETE /api/almacenes/{id}



\### Materiales

\- GET    /api/materiales

\- GET    /api/materiales/{id}/existencia   → calcula en tiempo real

\- POST   /api/materiales

\- PUT    /api/materiales/{id}



\### Compras

\- GET    /api/compras

\- POST   /api/compras                      → crea cabecera + items

\- PUT    /api/compras/{id}/confirmar

\- POST   /api/compras/{id}/recibir         → genera ingresos + lotes PEPS



\### Movimientos

\- GET    /api/movimientos                  → con filtros

\- POST   /api/movimientos/ingreso

\- POST   /api/movimientos/salida



\### Solicitudes

\- GET    /api/solicitudes

\- POST   /api/solicitudes                  → solicitante

\- PUT    /api/solicitudes/{id}/aprobar     → aprobador

\- PUT    /api/solicitudes/{id}/rechazar    → aprobador

\- PUT    /api/solicitudes/{id}/despachar   → almacenero + PEPS

\- PUT    /api/solicitudes/{id}/entregar    → almacenero



\### Reportes

\- GET /api/reportes/existencias            → stock actual por almacén

\- GET /api/reportes/kardex/{materialId}    → historial PEPS

\- GET /api/reportes/valorizado             → existencias × costo PEPS

\- GET /api/reportes/compras                → resumen por período

\- GET /api/reportes/movimientos            → entradas/salidas por período



\## Frontend — React + DevExtreme



\### Configuración inicial

\- Usar DevExtreme React Application Template oficial

\- Ajustar sistema de auth del template para consumir /api/auth/login

\- Guardar JWT en localStorage con key 'auth\_token'

\- Incluir JWT en header Authorization: Bearer {token} en cada request

\- Redirigir a /login si JWT expirado o ausente



\### DevExtreme — componentes a usar

\- DataGrid    → todos los listados (materiales, compras, movimientos,

&#x20;               solicitudes) con filtros, paginación y export Excel/PDF

\- Chart       → reportes visuales (existencias, movimientos por período)

\- Form        → formularios con validación

\- TreeList    → árbol de almacenes y subalmacenes

\- DateRangeBox → filtros de fecha en reportes

\- SelectBox   → dropdowns de materiales, almacenes, usuarios



\### Páginas

\- /login

\- /dashboard              → KPIs: existencias bajas, solicitudes pendientes,

&#x20;                            últimos movimientos

\- /almacenes              → TreeList con árbol de almacenes

\- /materiales             → DataGrid + formulario ABM

\- /compras                → DataGrid + nueva compra + recepción

\- /movimientos            → DataGrid con filtros avanzados

\- /solicitudes            → vista según rol:

&#x20;   solicitante           → mis solicitudes + nueva solicitud

&#x20;   aprobador             → bandeja pendientes

&#x20;   almacenero            → despacho y entrega

\- /reportes/existencias   → DataGrid con existencias por almacén

\- /reportes/kardex        → DataGrid historial movimientos por material

\- /reportes/valorizado    → DataGrid existencias valorizadas PEPS

\- /reportes/compras       → Chart + DataGrid resumen compras

\- /reportes/movimientos   → Chart + DataGrid entradas/salidas



\### Estructura de archivos frontend

src/

api/

auth.js

almacenes.js

materiales.js

compras.js

movimientos.js

solicitudes.js

reportes.js

pages/

Dashboard.js

Almacenes.js

Materiales.js

Compras.js

Movimientos.js

Solicitudes.js

reportes/

Existencias.js

Kardex.js

Valorizado.js

ComprasReporte.js

MovimientosReporte.js

components/

RolGuard.js           → proteger rutas por rol



\## Convenciones

\- Español en labels, títulos y mensajes al usuario

\- Inglés en nombres de componentes, variables y funciones

\- Respuestas API siempre en JSON

\- Errores: { "error": "descripción en español" }

\- Fechas en ISO 8601 (UTC)

\- Paginación: ?page=1\&pageSize=20

\- No duplicar lógica de negocio — el backend es la fuente de verdad



\## Paquetes autorizados



\### Backend

\- Dapper

\- Npgsql

\- Microsoft.AspNetCore.Authentication.JwtBearer

\- BCrypt.Net-Next

\- Swashbuckle (Swagger)



\### Frontend

\- devextreme

\- devextreme-react

\- axios (llamadas HTTP)



\## Estado de módulos



\### Fase 1 — Backend \[ ]

\- \[ ] Scripts SQL (01\_schema.sql + 02\_seed.sql)

\- \[ ] Program.cs + Db.cs + JWT

\- \[ ] AuthController

\- \[ ] AlmacenController

\- \[ ] MaterialController

\- \[ ] CompraController

\- \[ ] MovimientoController + PepsHelper

\- \[ ] SolicitudController (flujo completo 4 pasos)

\- \[ ] ReporteController



\### Fase 2 — Frontend \[ ]

\- \[ ] Setup DevExtreme React template

\- \[ ] Ajuste auth → JWT propio

\- \[ ] Dashboard

\- \[ ] Almacenes

\- \[ ] Materiales

\- \[ ] Compras

\- \[ ] Movimientos

\- \[ ] Solicitudes (vistas por rol)

\- \[ ] Reportes (5 reportes)



\## Al iniciar cada sesión

1\. Leer este archivo

2\. Revisar qué módulos están marcados como completos ✅

3\. Leer el código existente para entender el estado real

4\. Preguntar por cuál módulo continuar si no es claro

5\. Mantener arquitectura plana — no agregar capas sin consultar

6\. No instalar paquetes sin aprobación previa

