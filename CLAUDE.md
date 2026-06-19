# Sistema de Control de Almacén

## Stack

<<<<<<< HEAD
- Backend: .NET Core 8 Web API
- Base de datos: PostgreSQL
- Frontend: React + Fuse template (MUI / Material UI) — TypeScript
- ORM: Sin ORM — queries SQL directas con Dapper
- Auth: JWT propio — autenticación delegada a servicio externo (hades.oopp.gob.bo)
- HTTP client frontend: `ky`
=======
- Backend:  .NET Core 8 Web API
- Base de datos: PostgreSQL (servidor: 172.16.0.145:5432, db: almacen_db)
- Frontend: React + Fuse React Template (Material UI + TypeScript + Vite + Tailwind CSS)
- ORM: Sin ORM — queries SQL directas con Dapper
- Auth: JWT propio — integrado al sistema de auth del template Fuse React
- HTTP client frontend: `ky` (no axios)
- State management: React Query (server state) + React Context (auth)
>>>>>>> e780b93 (Avance Almacenes)

## Filosofía del proyecto

- Arquitectura PLANA. Sin repositorios, sin capas de servicios innecesarias.
- Controllers llaman directo a la base de datos con Dapper.
- Sin interfaces salvo que sean absolutamente necesarias.
- Código simple, legible y funcional sobre código "elegante".
- Las existencias NO se almacenan — se calculan en tiempo real:
  EXISTENCIA = Σ ingresos - Σ salidas (por material, por almacén)
- Valorización con lógica PEPS (FIFO): primera entrada = primera salida.

## Estructura del proyecto

```
/backend
<<<<<<< HEAD
  Program.cs                → setup, DI, rutas, middleware, JWT
  Db.cs                     → conexión Dapper centralizada
=======
  Program.cs                → setup, DI, rutas, middleware, JWT, CORS
  Db.cs                     → conexión Dapper centralizada
  Models.cs                 → todos los POCOs en un solo archivo
>>>>>>> e780b93 (Avance Almacenes)
  Controllers/
    AuthController.cs
    AlmacenController.cs
    MaterialController.cs
    CompraController.cs
    MovimientoController.cs
    SolicitudController.cs
    ReporteController.cs
<<<<<<< HEAD
  Models/                   → POCOs simples, sin lógica
  Helpers/
    PepsHelper.cs            → lógica PEPS/FIFO
    JwtHelper.cs             → generación y validación JWT
  Scripts/
    01_schema.sql            → creación de tablas principales
    02_seed.sql              → datos iniciales (almacenes, materiales, usuarios de prueba)
    03_sesiones.sql          → tabla sesiones (registro de logins)
    04_almacen_encargado.sql → tabla almacen_encargado (determina rol almacenero)
    05_datos_usuario.sql     → columnas JSONB adicionales (datos_usuario, datos_solicitante)

/frontend                   → React + Fuse template (MUI), TypeScript
  src/
    @auth/                  → sistema de auth Fuse adaptado a JWT propio
      authApi.ts            → login/refresh/mapeo de claims → User
      services/jwt/
        JwtAuthProvider.tsx → provider de sesión
        JwtAuthContext.tsx
    app/
      (public)/(auth)/      → página de login (Fuse)
      (control-panel)/      → páginas autenticadas (solo existe /example por ahora)
    utils/
      api.ts                → instancia ky con base URL y headers globales
=======
  Helpers/
    PepsHelper.cs            → lógica PEPS/FIFO con bloqueo FOR UPDATE
    JwtHelper.cs             → generación y validación JWT
  Scripts/
    01_schema.sql            → creación de tablas
    02_seed.sql              → datos iniciales
    03_sesiones.sql          → tabla sesiones (tracking tokens)
    04_almacen_encargado.sql → tabla almacen_encargado (rol por almacén)
    05_datos_usuario.sql     → datos adicionales de usuarios

/frontend                    → Fuse React Template (TypeScript)
  src/
    @auth/
      services/jwt/          → JwtAuthProvider, JwtAuthContext, useJwtAuth
    app/
      (public)/
        (auth)/              → páginas de login/logout
      (control-panel)/       → páginas de negocio (a implementar)
    api/                     → un archivo por módulo (a implementar)
    configs/
      routesConfig.tsx
      navigationConfig.ts
    utils/
      api.ts                 → instancia ky con baseURL y Authorization header
>>>>>>> e780b93 (Avance Almacenes)
```

## Base de datos PostgreSQL

```sql
<<<<<<< HEAD
-- Usuarios locales (solo para datos de prueba — el login usa servicio externo)
users           → id, username, password_hash, role, active, created_at
  roles: 'admin' | 'almacenero' | 'solicitante' | 'aprobador' | 'readonly'

-- Almacenes (árbol con parent_id)
almacenes       → id, nombre, descripcion, parent_id (null = raíz), active

-- Materiales
materiales      → id, codigo, nombre, descripcion, unidad_medida,
                   categoria, active, created_at

=======
-- Usuarios (datos vienen del servicio externo hades.oopp.gob.bo)
-- La tabla local almacena solo el rol asignado en este sistema

-- Almacén-encargado (asignación de roles por almacén)
almacen_encargado → id, user_id, almacen_id, rol, active

-- Sesiones (tracking de tokens activos)
sesiones         → id, user_id, token_hash, ip, created_at, expires_at, active

-- Almacenes (árbol con parent_id)
almacenes       → id, nombre, descripcion, parent_id (null = raíz), active

-- Materiales
materiales      → id, codigo, nombre, descripcion, unidad_medida,
                   categoria, active, created_at

>>>>>>> e780b93 (Avance Almacenes)
-- Compras (cabecera)
compras         → id, numero, proveedor, fecha, estado, user_id, created_at
  estados: 'borrador' | 'confirmada' | 'recibida'

-- Detalle de compras
compra_items    → id, compra_id, material_id, cantidad,
                   precio_unitario, created_at

-- Movimientos — fuente de verdad de existencias
movimientos     → id, tipo, material_id, almacen_id, cantidad,
<<<<<<< HEAD
                   costo_unitario, lote_ref, fecha, solicitud_id,
=======
                   costo_unitario, fecha, solicitud_id,
>>>>>>> e780b93 (Avance Almacenes)
                   compra_item_id, user_id, observacion, created_at
  tipo: 'ingreso' | 'salida'

-- Solicitudes
solicitudes     → id, numero, solicitante_id, almacen_id, estado,
                   aprobador_id, almacenero_id, fecha_solicitud,
                   fecha_aprobacion, fecha_despacho, fecha_entrega,
<<<<<<< HEAD
                   observacion, datos_solicitante (JSONB), created_at
=======
                   observacion, created_at
>>>>>>> e780b93 (Avance Almacenes)
  estados: 'pendiente' | 'aprobada' | 'rechazada' | 'despachada' | 'entregado'

-- Detalle de solicitudes
solicitud_items → id, solicitud_id, material_id, cantidad_solicitada,
                   cantidad_despachada, cantidad_entregada, created_at

-- Lotes PEPS/FIFO
lotes           → id, material_id, almacen_id, cantidad_inicial,
                   cantidad_disponible, costo_unitario,
                   fecha_ingreso, compra_item_id, created_at
<<<<<<< HEAD

-- Sesiones de usuario (auditoría de login)
sesiones        → id, user_id, username, ip_address, user_agent,
                   token_hash, fecha_login, fecha_expiracion, fecha_logout,
                   estado, datos_usuario (JSONB), created_at
  estado: 'activa' | 'expirada' | 'cerrada'

-- Relación almacén ↔ encargado (determina si user_id tiene rol almacenero)
almacen_encargado → almacen_id, user_id, active, created_at
  (user_id es ID del servicio externo — sin FK local)
```

## Auth — integración con servicio externo

El login NO usa la tabla `users` local. El flujo es:

1. POST /api/auth/login → reenvía credenciales a `hades.oopp.gob.bo/seguridad/api/get_token/`
2. Con el token externo, obtiene datos del usuario de `hades.oopp.gob.bo/seguridad/api/get_usuario/`
3. Verifica si el `user_id` externo existe en `almacen_encargado` → rol `almacenero` o `user`
4. Genera JWT propio con claims: `sub` (user_id), `unique_name` (username), `role`, `nombre`, `foto`
5. Registra la sesión en tabla `sesiones`

El frontend decodifica el JWT con `jwtDecode` para construir el objeto `User` sin llamar al backend.
JWT se guarda en `localStorage` bajo la key `jwt_access_token`.

**Nota:** Los JOINs a la tabla `users` en los controllers (compras, movimientos, solicitudes) asumen que el `user_id` externo coincide con un registro local. Esto puede necesitar revisión.
=======
```

## Autenticación

- Login valida credenciales contra servicio externo: `hades.oopp.gob.bo`
- El rol del usuario se obtiene de la tabla `almacen_encargado`
- JWT generado localmente con claims: userId, username, role, nombre, foto
- JWT expira en 480 minutos
- Frontend guarda JWT en localStorage con key `jwt_access_token`
- Frontend incluye JWT en header `Authorization: Bearer {token}` via interceptor en `api.ts`
- Sesiones tracked en tabla `sesiones` con hash del token e IP
- `/api/auth/refresh` re-verifica el rol antes de renovar
- `/api/auth/logout` invalida la sesión en BD
>>>>>>> e780b93 (Avance Almacenes)

## Flujo completo de solicitudes

```
SOLICITANTE crea solicitud
<<<<<<< HEAD
  → estado: "pendiente"
  → registra: solicitante_id, almacen_id, items (cantidad_solicitada)

APROBADOR aprueba o rechaza
  → aprobada:  estado "aprobada"  | registra: aprobador_id, fecha_aprobacion
  → rechazada: estado "rechazada" | registra: aprobador_id, fecha_aprobacion, observacion

ALMACENERO despacha materiales
  → estado: "despachada"
  → registra: almacenero_id, fecha_despacho, cantidad_despachada por item
  → genera movimientos de salida aplicando lógica PEPS
  → descuenta lotes correspondientes (fecha_ingreso ASC)

ALMACENERO confirma entrega física
  → estado: "entregado"
  → registra: fecha_entrega, cantidad_entregada por item
  → NO genera movimientos — solo confirmación física
  → fin del flujo

SOLICITANTE puede cancelar (si estado = "pendiente")
  → estado: "rechazada" + observacion "Cancelada por el solicitante"
=======
→ estado: "pendiente"
→ registra: solicitante_id, almacen_id, items (cantidad_solicitada)

APROBADOR aprueba o rechaza
→ aprobada:  estado "aprobada"  | registra: aprobador_id, fecha_aprobacion
→ rechazada: estado "rechazada" | registra: aprobador_id, fecha_aprobacion, observacion

ALMACENERO despacha materiales
→ estado: "despachada"
→ registra: almacenero_id, fecha_despacho, cantidad_despachada por item
→ genera movimientos de salida aplicando lógica PEPS
→ descuenta lotes correspondientes (fecha_ingreso ASC) con FOR UPDATE

ALMACENERO confirma entrega física
→ estado: "entregado"
→ registra: fecha_entrega, cantidad_entregada por item
→ NO genera movimientos — solo confirmación física
→ fin del flujo
>>>>>>> e780b93 (Avance Almacenes)
```

## Reglas del flujo

- Solo el solicitante puede crear/cancelar sus solicitudes (estado "pendiente")
- Solo el aprobador puede aprobar o rechazar (estado "pendiente")
- Solo el almacenero puede despachar (estado "aprobada")
- Solo el almacenero puede confirmar entrega (estado "despachada")
- El movimiento de salida se genera al DESPACHAR, no al entregar
- Admin puede ejecutar cualquier acción

## Lógica PEPS (FIFO)

1. Cada ingreso crea un registro en `lotes` con cantidad y costo
2. Al despachar: ordenar lotes por fecha_ingreso ASC
3. Consumir lote más antiguo hasta completar cantidad despachada
4. Si lote se agota, continuar con el siguiente
<<<<<<< HEAD
5. Costo de salida = suma ponderada de lotes consumidos
6. Actualizar cantidad_disponible en cada lote consumido
=======
5. Costo de salida = suma ponderada de lotes consumidos (CostoPonderado)
6. Actualizar cantidad_disponible en cada lote consumido
7. Usa `SELECT ... FOR UPDATE` para evitar concurrencia
>>>>>>> e780b93 (Avance Almacenes)

## Cálculo de existencias (tiempo real, sin tabla de stock)

```sql
SELECT
  material_id,
  almacen_id,
  SUM(CASE WHEN tipo = 'ingreso' THEN cantidad ELSE -cantidad END) as existencia
FROM movimientos
WHERE material_id = @materialId AND almacen_id = @almacenId
GROUP BY material_id, almacen_id
```

## Roles y permisos

<<<<<<< HEAD
- admin       → acceso total
- almacenero  → ingresos, salidas, despachos, entregas, reportes
- solicitante → crear y ver sus propias solicitudes
- aprobador   → aprobar/rechazar solicitudes
- user        → rol base asignado a usuarios del servicio externo sin almacén asignado
- readonly    → solo reportes y consultas

## Endpoints backend (todos implementados)

### Auth
- POST /api/auth/login    → autentica contra servicio externo, retorna JWT
- POST /api/auth/refresh  → renueva JWT (requiere token válido)
- POST /api/auth/logout   → marca sesión como cerrada

### Almacenes
- GET    /api/almacenes           → lista plana (soloActivos=true por defecto)
- GET    /api/almacenes/{id}
- POST   /api/almacenes           → solo admin
- PUT    /api/almacenes/{id}      → solo admin (valida ciclos en árbol)
- DELETE /api/almacenes/{id}      → baja lógica, solo admin

### Materiales
- GET    /api/materiales                     → con filtros buscar/categoria/paginación
- GET    /api/materiales/{id}
- GET    /api/materiales/{id}/existencia     → calcula en tiempo real por almacén
- POST   /api/materiales                     → admin o almacenero
- PUT    /api/materiales/{id}                → admin o almacenero

### Compras
- GET    /api/compras                        → con filtro estado/paginación
- GET    /api/compras/{id}                   → cabecera + items
- POST   /api/compras                        → crea en estado 'borrador'
- PUT    /api/compras/{id}/confirmar         → borrador → confirmada
- POST   /api/compras/{id}/recibir           → confirmada → recibida + ingresos + lotes PEPS

### Movimientos
- GET    /api/movimientos                    → con filtros material/almacen/tipo/fechas
- POST   /api/movimientos/ingreso            → ingreso manual + lote PEPS
- POST   /api/movimientos/salida             → salida manual con PEPS

### Solicitudes
- GET    /api/solicitudes                    → filtros estado/almacen/solicitante (rol-aware)
- GET    /api/solicitudes/{id}
- POST   /api/solicitudes                    → solicitante/admin
- PUT    /api/solicitudes/{id}/aprobar       → aprobador/admin
- PUT    /api/solicitudes/{id}/rechazar      → aprobador/admin
- PUT    /api/solicitudes/{id}/despachar     → almacenero/admin + PEPS
- PUT    /api/solicitudes/{id}/entregar      → almacenero/admin
- PUT    /api/solicitudes/{id}/cancelar      → solicitante dueño/admin (solo pendiente)

### Reportes
- GET /api/reportes/existencias              → stock actual por material/almacén
- GET /api/reportes/kardex/{materialId}      → historial con saldo acumulado (window function)
- GET /api/reportes/valorizado               → existencias × costo PEPS desde lotes
- GET /api/reportes/compras                  → resumen por período
- GET /api/reportes/movimientos              → entradas/salidas con resumen por tipo

## Frontend — React + Fuse (MUI) — TypeScript

### Estado actual
- Template Fuse instalado con routing y layout base
- Auth integrada: JwtAuthProvider adaptado, authApi.ts conectado a /api/auth/login
- JWT guardado en localStorage (`jwt_access_token`), headers globales con `ky`
- Ninguna página del sistema construida aún

### Páginas a construir
- /dashboard              → KPIs: solicitudes pendientes, existencias bajas, últimos movimientos
- /almacenes              → árbol de almacenes (TreeView MUI o tabla anidada)
- /materiales             → tabla + formulario ABM
- /compras                → tabla + nueva compra + flujo recepción
- /movimientos            → tabla con filtros avanzados
=======
- admin        → acceso total
- almacenero   → ingresos, salidas, despachos, entregas, reportes
- solicitante  → crear y ver sus propias solicitudes
- aprobador    → aprobar/rechazar solicitudes
- readonly     → solo reportes y consultas

## Endpoints backend (todos implementados ✅)

### Auth
- POST /api/auth/login       → valida en hades + retorna JWT + datos
- POST /api/auth/refresh     → renueva JWT re-verificando rol
- POST /api/auth/logout      → invalida sesión en BD

### Almacenes
- GET    /api/almacenes               → lista con filtro soloActivos
- GET    /api/almacenes/{id}          → detalle
- POST   /api/almacenes              → crea (admin)
- PUT    /api/almacenes/{id}         → edita (admin)
- DELETE /api/almacenes/{id}         → elimina (admin)

### Materiales
- GET    /api/materiales                   → lista (filtro active)
- GET    /api/materiales/{id}              → detalle
- GET    /api/materiales/{id}/existencia   → calcula en tiempo real
- POST   /api/materiales                   → crea
- PUT    /api/materiales/{id}              → edita

### Compras
- GET    /api/compras                      → lista con filtros
- POST   /api/compras                      → crea cabecera + items
- PUT    /api/compras/{id}/confirmar       → borrador → confirmada
- POST   /api/compras/{id}/recibir         → confirmada → recibida + ingresos + lotes

### Movimientos
- GET    /api/movimientos                  → con filtros (tipo, material, almacen, fechas)
- POST   /api/movimientos/ingreso          → ingreso manual
- POST   /api/movimientos/salida           → salida manual con PEPS

### Solicitudes
- GET    /api/solicitudes                  → filtrado por rol del usuario
- POST   /api/solicitudes                  → crea (solicitante)
- PUT    /api/solicitudes/{id}/aprobar     → aprueba (aprobador)
- PUT    /api/solicitudes/{id}/rechazar    → rechaza (aprobador)
- PUT    /api/solicitudes/{id}/despachar   → despacha con PEPS (almacenero)
- PUT    /api/solicitudes/{id}/entregar    → confirma entrega (almacenero)

### Reportes
- GET /api/reportes/existencias            → stock actual por almacén
- GET /api/reportes/kardex/{materialId}    → historial PEPS con info de lotes
- GET /api/reportes/valorizado             → existencias × costo PEPS
- GET /api/reportes/compras                → resumen por período
- GET /api/reportes/movimientos            → entradas/salidas por período

## Frontend — React + Fuse Template (MUI)

### Stack real instalado
- React 19 + TypeScript + Vite
- Material UI (@mui/material 7 + @mui/x-data-grid 8) — NO DevExtreme
- Tailwind CSS 4
- React Router 7 (lazy-loaded routes)
- React Query 5 (server state)
- `ky` como HTTP client (NO axios)
- `jwt-decode` para decodificar tokens
- `zod` para validación de formularios
- `notistack` para notificaciones

### Configuración de auth (implementada ✅)
- JWT almacenado en localStorage con key `jwt_access_token`
- `JwtAuthProvider.tsx` maneja auto-login, sign-in, sign-out, refresh
- `api.ts` crea instancia `ky` con prefix `/api` y Authorization header dinámico
- Redirige a /sign-in si JWT expirado o ausente
- VITE_API_BASE_URL en .env apunta al backend (.env.development: localhost:3000)

### Componentes MUI a usar (equivalentes a lo planeado con DevExtreme)
- `DataGrid` (@mui/x-data-grid) → listados con filtros, paginación, export
- Charts (recharts o @mui/x-charts) → reportes visuales
- `TextField`, `Select`, `Autocomplete` → formularios con validación zod
- TreeView (MUI) → árbol de almacenes
- `DatePicker` (@mui/x-date-pickers) → filtros de fecha en reportes

### Páginas (a implementar en /src/app/(control-panel)/)

- /dashboard              → KPIs: existencias bajas, solicitudes pendientes, últimos movimientos
- /almacenes              → TreeView/DataGrid árbol de almacenes + ABM
- /materiales             → DataGrid + formulario ABM
- /compras                → DataGrid + nueva compra + recepción
- /movimientos            → DataGrid con filtros avanzados
>>>>>>> e780b93 (Avance Almacenes)
- /solicitudes            → vista según rol:
    solicitante           → mis solicitudes + nueva solicitud
    aprobador             → bandeja pendientes
    almacenero            → despacho y entrega
<<<<<<< HEAD
- /reportes/existencias   → tabla con existencias por almacén
- /reportes/kardex        → tabla historial movimientos por material
- /reportes/valorizado    → tabla existencias valorizadas PEPS
- /reportes/compras       → tabla/gráfico resumen compras
- /reportes/movimientos   → tabla/gráfico entradas/salidas

### Estructura de archivos a crear en frontend/src/

```
app/(control-panel)/
  dashboard/route.tsx + components/
  almacenes/route.tsx + components/
  materiales/route.tsx + components/
  compras/route.tsx + components/
  movimientos/route.tsx + components/
  solicitudes/route.tsx + components/
  reportes/
    existencias/route.tsx
    kardex/route.tsx
    valorizado/route.tsx
    compras/route.tsx
    movimientos/route.tsx

api/                          → un archivo por módulo (TypeScript)
  almacenes.ts
  materiales.ts
  compras.ts
  movimientos.ts
  solicitudes.ts
  reportes.ts

components/                   → solo si se reutiliza 2+ veces
  RolGuard.tsx                → proteger rutas por rol
```

### Convenciones frontend
- Rutas siguen la convención Fuse: `app/(control-panel)/<nombre>/route.tsx`
- Componentes de página en `components/` dentro de cada ruta
- Los archivos `api/*.ts` solo hacen llamadas HTTP con `ky` y tipan la respuesta
- No duplicar validaciones del backend en el frontend

## Convenciones generales

- Español en labels, títulos y mensajes al usuario
- Inglés en nombres de componentes, variables y funciones
- Respuestas API siempre en JSON
- Errores: `{ "error": "descripción en español" }`
- Fechas en ISO 8601
- Paginación: `?page=1&pageSize=20`
=======
- /reportes/existencias   → DataGrid con existencias por almacén
- /reportes/kardex        → DataGrid historial movimientos por material
- /reportes/valorizado    → DataGrid existencias valorizadas PEPS
- /reportes/compras       → Chart + DataGrid resumen compras
- /reportes/movimientos   → Chart + DataGrid entradas/salidas

### Estructura de archivos frontend (a crear)

```
src/
  api/
    almacenes.ts
    materiales.ts
    compras.ts
    movimientos.ts
    solicitudes.ts
    reportes.ts
  app/(control-panel)/
    dashboard/
    almacenes/
    materiales/
    compras/
    movimientos/
    solicitudes/
    reportes/
      existencias/
      kardex/
      valorizado/
      compras/
      movimientos/
  components/
    RolGuard.tsx          → proteger rutas por rol
    ConfirmDialog.tsx     → diálogo de confirmación reutilizable
```

## Convenciones

- Español en labels, títulos y mensajes al usuario
- Inglés en nombres de componentes, variables y funciones
- TypeScript en todo el frontend (`.ts`, `.tsx`)
- Respuestas API siempre en JSON
- Errores: { "error": "descripción en español" }
- Fechas en ISO 8601 (UTC)
- Paginación: ?page=1&pageSize=20
>>>>>>> e780b93 (Avance Almacenes)
- No duplicar lógica de negocio — el backend es la fuente de verdad

## Paquetes autorizados

<<<<<<< HEAD
### Backend
- Dapper
- Npgsql
- Microsoft.AspNetCore.Authentication.JwtBearer
- BCrypt.Net-Next (instalado, no usado actualmente en el flujo principal)
- Swashbuckle (Swagger)

### Frontend
- @mui/material (MUI — incluido en Fuse)
- ky (HTTP client)
- jwt-decode
- No agregar devextreme — se usa MUI del template Fuse
=======
### Backend (ya instalados)
- Dapper 2.1.79
- Npgsql 10.0.2
- Microsoft.AspNetCore.Authentication.JwtBearer 8.0
- BCrypt.Net-Next 4.2.1
- Swashbuckle.AspNetCore 6.9.0

### Frontend (ya instalados)
- @mui/material 7 + @mui/x-data-grid 8
- ky (HTTP client)
- @tanstack/react-query 5
- jwt-decode 4
- zod 4
- notistack 3
>>>>>>> e780b93 (Avance Almacenes)

## Estado de módulos

### Fase 1 — Backend ✅ COMPLETO
<<<<<<< HEAD
- ✅ Scripts SQL (01_schema.sql al 05_datos_usuario.sql)
- ✅ Program.cs + Db.cs + JwtHelper
- ✅ AuthController (login externo + refresh + logout + sesiones)
=======
- ✅ Scripts SQL (01_schema.sql + 02_seed.sql + 03_sesiones.sql + 04_almacen_encargado.sql + 05_datos_usuario.sql)
- ✅ Program.cs + Db.cs + JWT + CORS
- ✅ AuthController (con servicio externo hades + sesiones)
>>>>>>> e780b93 (Avance Almacenes)
- ✅ AlmacenController
- ✅ MaterialController
- ✅ CompraController
- ✅ MovimientoController + PepsHelper
<<<<<<< HEAD
- ✅ SolicitudController (flujo completo 5 acciones)
- ✅ ReporteController

### Fase 2 — Frontend 🔄 EN CURSO
- ✅ Setup Fuse template (React + MUI + TypeScript)
- ✅ Auth integrada → JWT propio (JwtAuthProvider + authApi.ts)
- [ ] Dashboard
- [ ] Almacenes
=======
- ✅ SolicitudController (flujo completo 4 pasos)
- ✅ ReporteController

### Fase 2 — Frontend
- ✅ Setup Fuse React template (MUI + TypeScript)
- ✅ Auth → JWT propio (JwtAuthProvider, JwtAuthContext, api.ts con ky)
- ✅ Páginas de login/logout
- ✅ Navegación lateral completa (todos los módulos y reportes)
- ✅ Almacenes (src/api/almacenes.ts + AlmacenesPage.tsx — DataGrid árbol + CRUD completo)
- [ ] Dashboard
- [ ] API layer restante (materiales.ts, compras.ts, movimientos.ts, solicitudes.ts, reportes.ts)
>>>>>>> e780b93 (Avance Almacenes)
- [ ] Materiales
- [ ] Compras
- [ ] Movimientos
- [ ] Solicitudes (vistas por rol)
- [ ] Reportes (5 reportes)
<<<<<<< HEAD
- [ ] Navegación lateral (sidebar con rutas del sistema)
=======
- [ ] Navegación lateral con todos los módulos
- [ ] RolGuard (protección de rutas por rol)
>>>>>>> e780b93 (Avance Almacenes)

## Al iniciar cada sesión

1. Leer este archivo
2. Revisar qué módulos están marcados como completos ✅
3. Leer el código existente para entender el estado real
4. Preguntar por cuál módulo continuar si no es claro
5. Mantener arquitectura plana — no agregar capas sin consultar
6. No instalar paquetes sin aprobación previa
<<<<<<< HEAD
7. El frontend usa Fuse (MUI) — NO usar DevExtreme
=======
7. Frontend usa MUI (no DevExtreme) — usar DataGrid de @mui/x-data-grid
8. Frontend usa `ky` como HTTP client (no axios)
9. JWT se guarda como `jwt_access_token` en localStorage
>>>>>>> e780b93 (Avance Almacenes)
