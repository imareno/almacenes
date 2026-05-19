\# Sistema de Control de Almacén



\## Stack

\- Backend: .NET Core 8 Web API

\- Base de datos: PostgreSQL

\- Frontend: React 18 + Vite (segunda fase)

\- ORM: Sin ORM — queries SQL directas con Dapper

\- Auth: JWT con roles



\## Filosofía del proyecto

\- Arquitectura PLANA. Sin repositorios, sin capas de servicios innecesarias.

\- Controllers llaman directo a la base de datos con Dapper.

\- Sin interfaces salvo que sean absolutamente necesarias.

\- Código simple, legible y funcional.

\- Las existencias NO se almacenan — se calculan siempre en tiempo real:

&#x20; EXISTENCIA = Σ ingresos - Σ salidas (por material, por almacén)

\- Valorización con lógica PEPS (FIFO): primera entrada = primera salida.



\## Estructura del proyecto

/backend

&#x20; Program.cs              → setup, DI, rutas, middleware

&#x20; Controllers/

&#x20;   AuthController.cs

&#x20;   AlmacenController.cs

&#x20;   MaterialController.cs

&#x20;   CompraController.cs

&#x20;   MovimientoController.cs

&#x20;   SolicitudController.cs

&#x20;   ReporteController.cs

&#x20; Models/                 → POCOs simples, sin lógica

&#x20; Db.cs                   → conexión Dapper centralizada

&#x20; Helpers/

&#x20;   PepsHelper.cs         → lógica de cálculo PEPS

&#x20;   JwtHelper.cs          → generación y validación JWT

&#x20; Scripts/

&#x20;   01\_schema.sql         → creación de tablas

&#x20;   02\_seed.sql           → datos iniciales



\## Base de datos PostgreSQL



\### Tablas principales



\-- Usuarios y roles

users           → id, username, password\_hash, role, active, created\_at

&#x20; roles: 'admin' | 'almacenero' | 'solicitante' | 'aprobador' | 'readonly'



\-- Almacenes

almacenes       → id, nombre, descripcion, parent\_id (null = raíz), active



\-- Materiales / productos

materiales      → id, codigo, nombre, descripcion, unidad\_medida,

&#x20;                  categoria, active, created\_at



\-- Compras (cabecera)

compras         → id, numero, proveedor, fecha, estado,

&#x20;                  user\_id, created\_at

&#x20; estados: 'borrador' | 'confirmada' | 'recibida'



\-- Detalle de compras

compra\_items    → id, compra\_id, material\_id, cantidad,

&#x20;                  precio\_unitario, created\_at



\-- Movimientos (ingresos y salidas — fuente de verdad)

movimientos     → id, tipo, material\_id, almacen\_id, cantidad,

&#x20;                  costo\_unitario, lote\_ref, fecha,

&#x20;                  solicitud\_id, compra\_item\_id,

&#x20;                  user\_id, observacion, created\_at

&#x20; tipo: 'ingreso' | 'salida'



\-- Solicitudes de materiales

solicitudes     → id, numero, solicitante\_id, almacen\_id,

&#x20;                  estado, aprobador\_id, almacenero\_id,

&#x20;                  fecha\_solicitud, fecha\_aprobacion,

&#x20;                  fecha\_despacho, fecha\_entrega,

&#x20;                  observacion, created\_at

&#x20; estados: 'pendiente' | 'aprobada' | 'rechazada' | 'despachada' | 'entregado'



\-- Detalle de solicitudes

solicitud\_items → id, solicitud\_id, material\_id,

&#x20;                  cantidad\_solicitada,

&#x20;                  cantidad\_despachada,

&#x20;                  cantidad\_entregada,

&#x20;                  created\_at



\-- Lotes PEPS (FIFO)

lotes           → id, material\_id, almacen\_id, cantidad\_inicial,

&#x20;                  cantidad\_disponible, costo\_unitario,

&#x20;                  fecha\_ingreso, compra\_item\_id, created\_at



\## Flujo completo de solicitudes



1\. SOLICITANTE crea solicitud

&#x20;  → estado: "pendiente"

&#x20;  → registra: solicitante\_id, almacen\_id, items (cantidad\_solicitada)



2\. APROBADOR aprueba o rechaza

&#x20;  → aprobada:  estado: "aprobada"  | registra: aprobador\_id, fecha\_aprobacion

&#x20;  → rechazada: estado: "rechazada" | registra: aprobador\_id, fecha\_aprobacion, observacion



3\. ALMACENERO despacha materiales

&#x20;  → estado: "despachada"

&#x20;  → registra: almacenero\_id, fecha\_despacho, cantidad\_despachada por item

&#x20;  → genera movimientos de salida (aplica lógica PEPS)

&#x20;  → descuenta lotes correspondientes



4\. ALMACENERO confirma entrega física

&#x20;  → estado: "entregado"

&#x20;  → registra: fecha\_entrega, cantidad\_entregada por item

&#x20;  → fin del flujo



\## Reglas del flujo

\- Solo el solicitante puede crear y cancelar sus solicitudes (si están en "pendiente")

\- Solo el aprobador puede aprobar o rechazar (estado "pendiente")

\- Solo el almacenero puede despachar (estado "aprobada") y entregar (estado "despachada")

\- El movimiento de salida se genera al despachar, no al entregar

\- La entrega es confirmación física — no afecta movimientos ni lotes

\- Un admin puede ejecutar cualquier acción



\## Lógica PEPS (FIFO)

1\. Cada ingreso (compra recibida o ingreso manual) crea un registro en lotes

2\. Al despachar: ordenar lotes por fecha\_ingreso ASC

3\. Consumir el lote más antiguo hasta completar la cantidad despachada

4\. Si un lote se agota, continuar con el siguiente

5\. Costo de salida = suma ponderada de lotes consumidos

6\. Actualizar cantidad\_disponible en cada lote consumido



\## Cálculo de existencias (en tiempo real)

SELECT

&#x20; material\_id, almacen\_id,

&#x20; SUM(CASE WHEN tipo = 'ingreso' THEN cantidad ELSE -cantidad END) as existencia

FROM movimientos

WHERE material\_id = @materialId AND almacen\_id = @almacenId

GROUP BY material\_id, almacen\_id



\## Roles y permisos

\- admin        → acceso total

\- almacenero   → ingresos, salidas, despachos, entregas, reportes

\- solicitante  → crear y ver sus propias solicitudes

\- aprobador    → aprobar/rechazar solicitudes

\- readonly     → solo reportes y consultas



\## Endpoints principales



\### Auth

\- POST /api/auth/login

\- POST /api/auth/refresh



\### Almacenes

\- GET    /api/almacenes

\- POST   /api/almacenes

\- PUT    /api/almacenes/{id}

\- DELETE /api/almacenes/{id}



\### Materiales

\- GET    /api/materiales

\- GET    /api/materiales/{id}/existencia

\- POST   /api/materiales

\- PUT    /api/materiales/{id}



\### Compras

\- GET    /api/compras

\- POST   /api/compras

\- PUT    /api/compras/{id}/confirmar

\- POST   /api/compras/{id}/recibir      → genera ingresos + lotes



\### Movimientos

\- GET    /api/movimientos

\- POST   /api/movimientos/ingreso

\- POST   /api/movimientos/salida



\### Solicitudes

\- GET    /api/solicitudes

\- POST   /api/solicitudes               → solicitante

\- PUT    /api/solicitudes/{id}/aprobar  → aprobador

\- PUT    /api/solicitudes/{id}/rechazar → aprobador

\- PUT    /api/solicitudes/{id}/despachar → almacenero → genera salidas PEPS

\- PUT    /api/solicitudes/{id}/entregar  → almacenero → confirma entrega física



\### Reportes

\- GET /api/reportes/existencias

\- GET /api/reportes/kardex/{materialId}

\- GET /api/reportes/valorizado

\- GET /api/reportes/compras

\- GET /api/reportes/movimientos



\## Convenciones

\- Español en nombres de negocio

\- Inglés en nombres técnicos

\- Respuestas API siempre en JSON

\- Errores: { "error": "descripción en español" }

\- Fechas en ISO 8601 (UTC)

\- Paginación: ?page=1\&pageSize=20



\## Paquetes autorizados (backend)

\- Dapper

\- Npgsql

\- Microsoft.AspNetCore.Authentication.JwtBearer

\- BCrypt.Net-Next

\- Swashbuckle (Swagger)



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



\### Fase 2 — Frontend React \[ ]

(pendiente hasta completar backend)



\## Al iniciar cada sesión

1\. Leer este archivo

2\. Revisar qué módulos están marcados como completos

3\. Preguntar por cuál módulo continuar si no es claro

4\. Mantener arquitectura plana — no agregar capas sin consultar

5\. No instalar paquetes adicionales sin aprobación

