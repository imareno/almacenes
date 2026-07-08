# Sistema de Control de Almacén

## Stack

- Backend: .NET Core 8 Web API
- Base de datos: PostgreSQL (servidor: 172.16.0.145:5432, db: almacen_db)
- Frontend: React + Fuse React Template (Material UI + TypeScript + Vite + Tailwind CSS)
- ORM: Sin ORM — queries SQL directas con Dapper
- Auth: JWT propio — autenticación delegada a servicio externo (hades.oopp.gob.bo)
- HTTP client frontend: `ky` (no axios)
- State management: React Query (server state) + React Context (auth)

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
  Program.cs                → setup, DI, rutas, middleware, JWT, CORS
  Db.cs                     → conexión Dapper centralizada
  Models/
    Models.cs               → todos los POCOs en un solo archivo
  Controllers/
    AuthController.cs
    AlmacenController.cs
    MaterialController.cs
    CompraController.cs
    MovimientoController.cs
    SolicitudController.cs
    ReporteController.cs
  Helpers/
    PepsHelper.cs            → lógica PEPS/FIFO con bloqueo FOR UPDATE
    JwtHelper.cs             → generación y validación JWT
    DapperDateOnlyHandler.cs → TypeHandler para mapear DateOnly ↔ PostgreSQL DATE
     Scripts/
     01_schema.sql            → creación de tablas principales
     02_seed.sql              → datos iniciales (almacenes, materiales, usuarios de prueba)
     03_sesiones.sql          → tabla sesiones (registro de logins)
     04_almacen_encargado.sql → tabla almacen_encargado (determina rol almacenero)
     05_datos_usuario.sql     → columnas JSONB adicionales (datos_usuario, datos_solicitante)
     06_almacen_encargado_rol.sql → columna rol en almacen_encargado (ya no se usa, reemplazada por admin)
     07_sub_almacenes.sql         → tabla sub_almacenes (detalle de almacenes)
     08_almacen_encargado_admin.sql → columna admin en almacen_encargado
     09_perfil.sql                → tabla perfil (persona_id, sub_almacen_id, aprobador_id)
     10_perfil_aprobador_ci.sql   → cambia perfil.aprobador_id de INT a VARCHAR (CI del servicio externo)
     11_materiales_sin_universal.sql
     12_solicitudes_sub_almacen.sql → sub_almacen_id en solicitudes + columna active
     13_secuencias_anio.sql         → anio_ingresos/anio_solicitudes para reinicio anual de secuencias
     14_solicitudes_datos_usuario.sql → columnas nombre snapshot (solicitante/aprobador/almacenero_nombre)
     15_solicitudes_borrador.sql      → agrega estado 'borrador' al CHECK
     16_solicitudes_estados_flujo.sql → renombra estados + columna aprobador_ci

/frontend                    → Fuse React Template (TypeScript)
  vite.config.mts            → proxy /api → localhost:5252, port 3000
  src/
    @auth/
      authApi.ts             → login/refresh/mapeo de claims → User
      authRoles.ts           → roles (aún tiene template roles, no se usa en producción)
      services/jwt/
        JwtAuthProvider.tsx  → provider de sesión, auto-login, role validation
        JwtAuthContext.tsx
    api/
      almacenes.ts           → CRUD almacenes + sub-almacenes + asignados
      compras.ts             → CRUD compras + compra_items
      materiales.ts          → getMateriales (para selects)
      solicitudes.ts         → ✅ CRUD solicitudes + acciones (aprobar, rechazar, despachar, entregar, cancelar)
      perfil.ts              → 🟡 getMyPerfil, savePerfil, getSubAlmacenesPerfil, getUsuarios
    app/
      (public)/(auth)/       → login, sign-up (disabled), sign-out
      (control-panel)/
        almacenes/           → ✅ CRUD maestro-detalle split view (30/70)
        compras/             → ✅ CRUD con paginación servidor, filtros, flujo estados
        dashboard/           → placeholder (solo título)
        example/             → demo del template (no borrar por ahora)
         solicitudes/         → ✅ Route lazy, SolicitudesPage + 6 dialogs en subdir dialogs/
                              Split view 40/60, header con PageBreadcrumb + motion,
                              FuseSvgIcon lucide, chips filled con iconos,
                              badge perfil estilo OrdersStatus (Tailwind bg-color-50 text-color-700),
                              Skeleton loaders, botón "Nueva Solicitud" con Tooltip disabled,
                              canCreate() solo valida perfil (todos los roles pueden crear)
        perfil/              → 🟡 formulario single-select sub-almacén + aprobador, PUT guarda todo
    configs/
      settingsConfig.ts      → layout1 fullwidth, footer off, tema legacy/defaultDark, roles, redirect /dashboard
      navigationConfig.ts    → ítems del sidebar (todos los módulos)
      routesConfig.tsx       → auto-glob de route.tsx, redirect / → /dashboard
      themesConfig.ts        → paletas legacy + defaultDark personalizadas
    components/
      PageTitle.tsx           → header reutilizable con back link
      PageBreadcrumb.tsx      → breadcrumbs
      ErrorNotification.tsx   → notificación roja notistack
      data-table/             → wrapper MaterialReactTable
    utils/
      api.ts                 → instancia ky con prefixUrl /api + global headers
```

## Base de datos PostgreSQL

```sql
-- Usuarios locales (solo para datos de prueba — el login usa servicio externo)
users           → id, username, password_hash, role, active, created_at
  roles: 'admin' | 'almacenero' | 'solicitante' | 'aprobador' | 'readonly'

-- Almacenes (maestro)
almacenes       → id, nombre, descripcion, active

-- Sub-almacenes (detalle de almacenes)
sub_almacenes   → id, almacen_id (FK almacenes), nombre, sigla (UNIQUE por almacén),
                   descripcion, secuencia_ingresos, secuencia_solicitudes,
                   anio_ingresos, anio_solicitudes, active
  secuencia_ingresos/secuencia_solicitudes: contadores internos que reinician cada año
  (anio_ingresos/anio_solicitudes guardan el año actual de cada secuencia)

-- Materiales
materiales      → id, codigo, nombre, descripcion, unidad_medida,
                   categoria, active, created_at

-- Compras (cabecera) — numero se genera al concluir con secuencia_ingresos (reinicio anual)
compras         → id, numero (UNIQUE, nullable hasta concluir), proveedor, detalle,
                   fecha (DATE), estado, sub_almacen_id (FK sub_almacenes),
                   user_id, active, created_at
  estados: 'pendiente' | 'concluido' | 'generado'
  numero formato: SIGLA-YYYY-000001 (generado al concluir, secuencia reinicia cada año)

-- Detalle de compras
compra_items    → id, compra_id (FK compras CASCADE), material_id (FK materiales),
                   cantidad NUMERIC(14,4), precio_unitario NUMERIC(14,4),
                   unidad_medida VARCHAR(30), created_at

-- Movimientos — fuente de verdad de existencias
movimientos     → id, tipo, material_id, almacen_id, cantidad,
                   costo_unitario, lote_ref, fecha, solicitud_id,
                   compra_item_id, user_id, observacion, created_at
  tipo: 'ingreso' | 'salida'

-- Solicitudes
solicitudes     → id, numero, solicitante_id, solicitante_nombre, sub_almacen_id (FK sub_almacenes), estado,
                   aprobador_id, aprobador_ci, aprobador_nombre, almacenero_id, almacenero_nombre,
                   fecha_solicitud, fecha_aprobacion, fecha_despacho, fecha_entrega,
                   observacion, active, created_at
  estados: 'borrador' | 'enviado' | 'aprobado' | 'rechazado' | 'despachado' | 'entregado'
  numero: se genera al crear con secuencia_solicitudes (reinicio anual), formato SIGLA-YYYY-000001
  NO existe tabla 'users' en la BD real: solicitante_id/aprobador_id/almacenero_id son IDs del
  servicio externo (JWT sub, INT). Los nombres se guardan como snapshot (solicitante_nombre, etc.).
  aprobador_ci = CI del aprobador asignado desde perfil.aprobador_id al enviar.

-- Detalle de solicitudes
solicitud_items → id, solicitud_id, material_id, cantidad_solicitada,
                   cantidad_despachada, cantidad_entregada, created_at

-- Lotes PEPS/FIFO
lotes           → id, material_id, almacen_id, cantidad_inicial,
                   cantidad_disponible, costo_unitario,
                   fecha_ingreso, compra_item_id, created_at

-- Sesiones de usuario (auditoría de login)
sesiones        → id, user_id, username, ip_address, user_agent,
                   token_hash, fecha_login, fecha_expiracion, fecha_logout,
                   estado, datos_usuario (JSONB), created_at
  estado: 'activa' | 'expirada' | 'cerrada'

-- Relación almacén ↔ encargado (determina rol del usuario)
almacen_encargado → almacen_id, user_id, admin, active, created_at
  (user_id es ID del servicio externo — sin FK local)
  admin=true → rol 'admin' | admin=false → rol 'almacenero' | no en tabla → rol 'solicitante'

-- Perfil del usuario (configuración sub-almacén + aprobador por defecto)
perfil          → id, persona_id, sub_almacen_id (FK sub_almacenes),
                   aprobador_id (VARCHAR(20), CI del servicio externo),
                   aprobador_nombre, aprobador_cargo, created_at
  UNIQUE(persona_id, sub_almacen_id)
  persona_id = user_id del JWT (servicio externo)
```

## Auth — integración con servicio externo

El login NO usa la tabla `users` local. El flujo es:

1. POST /api/auth/login → reenvía credenciales a `hades.oopp.gob.bo/seguridad/api/get_token/`
2. Con el token externo, obtiene datos del usuario de `hades.oopp.gob.bo/seguridad/api/get_usuario/`
3. Verifica `almacen_encargado`: admin=true → `admin`, existe → `almacenero`, no existe → `solicitante`
4. Genera JWT propio con claims: `sub` (user_id), `unique_name` (username), `role`, `nombre`, `foto`
5. Registra la sesión en tabla `sesiones`

El frontend decodifica el JWT con `jwtDecode` para construir el objeto `User` sin llamar al backend.
JWT se guarda en `localStorage` bajo la key `jwt_access_token`.

**Nota importante:** `MapInboundClaims = false` en Program.cs para que ASP.NET no renombre el claim `role`.

## Flujo completo de solicitudes

```
SOLICITANTE crea solicitud
  → estado: "borrador"
  → registra: solicitante_id, solicitante_nombre, sub_almacen_id, items (cantidad_solicitada)
  → ítems se pueden agregar/editar/eliminar mientras esté en borrador

SOLICITANTE envía para aprobación
  → estado: "enviado"
  → registra: aprobador_ci y aprobador_nombre desde el perfil del solicitante
  → aquí se valida que tenga al menos un ítem

APROBADOR aprueba o rechaza
  → aprobado:  estado "aprobado"  | registra: aprobador_id, aprobador_nombre, fecha_aprobacion
  → rechazado: estado "rechazado" | registra: aprobador_id, aprobador_nombre, fecha_aprobacion, observacion

ALMACENERO despacha materiales
  → estado: "despachado"
  → registra: almacenero_id, almacenero_nombre, fecha_despacho, cantidad_despachada por item
  → genera movimientos de salida aplicando lógica PEPS
  → descuenta lotes correspondientes (fecha_ingreso ASC)

ALMACENERO confirma entrega física
  → estado: "entregado"
  → registra: fecha_entrega, cantidad_entregada por item
  → NO genera movimientos — solo confirmación física
  → fin del flujo

SOLICITANTE puede cancelar (si estado = "enviado")
  → estado: "rechazado" + observacion "Cancelada por el solicitante"
```

## Reglas del flujo

- Cualquier usuario con perfil configurado puede crear solicitudes (estado "borrador")
- Solo el solicitante dueño (o admin) puede editar/eliminar/enviar una solicitud en borrador
- Solo el aprobador (o admin) puede aprobar o rechazar (estado "enviado")
- Solo el almacenero (o admin) puede despachar (estado "aprobado")
- Solo el almacenero (o admin) puede confirmar entrega (estado "despachado")
- Solo el solicitante dueño (o admin) puede cancelar (estado "enviado")
- Los ítems solo se pueden crear/editar/eliminar en estado "borrador"
- El movimiento de salida se genera al DESPACHAR, no al entregar
- Admin puede ejecutar cualquier acción

## Lógica PEPS (FIFO)

1. Cada ingreso crea un registro en `lotes` con cantidad y costo
2. Al despachar: ordenar lotes por fecha_ingreso ASC
3. Consumir lote más antiguo hasta completar cantidad despachada
4. Si lote se agota, continuar con el siguiente
5. Costo de salida = suma ponderada de lotes consumidos (CostoPonderado)
6. Actualizar cantidad_disponible en cada lote consumido
7. Usa `SELECT ... FOR UPDATE` para evitar concurrencia

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
- GET    /api/almacenes                                → lista (soloActivos=true por defecto)
- GET    /api/almacenes/{id}
- GET    /api/almacenes/asignados                      → almacenes+sub-almacenes del usuario (admin=todos, almacenero=asignados)
- POST   /api/almacenes                                → solo admin
- PUT    /api/almacenes/{id}                            → solo admin
- DELETE /api/almacenes/{id}                            → baja lógica, valida que no tenga sub-almacenes activos

### Sub-Almacenes
- GET    /api/almacenes/{almacenId}/sub-almacenes       → lista por almacén (soloActivos=true)
- POST   /api/almacenes/{almacenId}/sub-almacenes       → solo admin
- PUT    /api/almacenes/{almacenId}/sub-almacenes/{id}  → solo admin
- DELETE /api/almacenes/{almacenId}/sub-almacenes/{id}  → baja lógica, valida compras+solicitudes

### Materiales
- GET    /api/materiales                     → con filtros buscar/categoria/paginación
- GET    /api/materiales/{id}
- GET    /api/materiales/{id}/existencia     → calcula en tiempo real por almacén
- POST   /api/materiales                     → admin o almacenero
- PUT    /api/materiales/{id}                → admin o almacenero

### Compras
- GET    /api/compras                        → filtros subAlmacenId/estado + paginación servidor
- GET    /api/compras/{id}                   → cabecera + items + datos almacén/sub-almacén
- POST   /api/compras                        → crea sin numero (proveedor, detalle, fecha, subAlmacenId)
- PUT    /api/compras/{id}                   → editar cabecera (solo pendiente)
- PUT    /api/compras/{id}/concluir          → pendiente → concluido + genera numero con secuencia_ingresos
- DELETE /api/compras/{id}                   → baja lógica (solo pendiente)

### Compra Items
- POST   /api/compras/{id}/items             → agregar ítem (solo pendiente)
- PUT    /api/compras/{id}/items/{itemId}    → editar ítem (solo pendiente)
- DELETE /api/compras/{id}/items/{itemId}    → eliminar ítem (solo pendiente)

### Movimientos
- GET    /api/movimientos                    → con filtros material/almacen/tipo/fechas
- POST   /api/movimientos/ingreso            → ingreso manual + lote PEPS
- POST   /api/movimientos/salida             → salida manual con PEPS

### Solicitudes
- GET    /api/solicitudes                    → filtro por rol: solicitante→propias, aprobador→propias+asignadas, almacenero→propias+sub-almacenes, admin→todas
- GET    /api/solicitudes/{id}
- POST   /api/solicitudes                    → cualquier rol con perfil configurado (estado 'borrador')
- PUT    /api/solicitudes/{id}               → editar observacion (solo borrador, dueño/admin)
- DELETE /api/solicitudes/{id}               → baja lógica (solo borrador, dueño/admin)
- PUT    /api/solicitudes/{id}/enviar        → borrador→enviado + registra aprobador_ci desde perfil
- PUT    /api/solicitudes/{id}/aprobar       → aprobador/admin
- PUT    /api/solicitudes/{id}/rechazar      → aprobador/admin
- PUT    /api/solicitudes/{id}/despachar     → almacenero/admin + PEPS
- PUT    /api/solicitudes/{id}/entregar      → almacenero/admin
- PUT    /api/solicitudes/{id}/cancelar      → solicitante dueño/admin (solo enviado)

### Reportes
- GET /api/reportes/existencias              → stock actual por material/almacén
- GET /api/reportes/kardex/{materialId}      → historial con saldo acumulado (window function)
- GET /api/reportes/valorizado               → existencias × costo PEPS desde lotes
- GET /api/reportes/compras                  → resumen por período
- GET /api/reportes/movimientos              → entradas/salidas con resumen por tipo

### Perfil 🟡
- GET    /api/perfil                         → perfil actual del usuario (con nombres)
- PUT    /api/perfil                         → reemplaza perfil (subAlmacenIds + aprobadorId)
- GET    /api/perfil/sub-almacenes           → todos los sub-almacenes activos agrupados por almacén
- GET    /api/perfil/usuarios                → lista de usuarios activos (para selectores)
- GET    /api/perfil/aprobadores             → 🟡 obtiene aprobadores del servicio externo de contrataciones

## Frontend — React + Fuse (MUI) — TypeScript

### Estado actual
- Template Fuse instalado con routing y layout base
- Auth integrada: JwtAuthProvider adaptado, authApi.ts conectado a /api/auth/login
- JWT guardado en localStorage (`jwt_access_token`), headers globales con `ky`
- Navegación lateral configurada con todos los módulos (iconos Lucide)
- Logo personalizado: "ALMACENES / MOPSV" con logo.svg
- Toolbar limpio: sin LightDarkModeToggle ni MainProjectSelection (eliminados)
- Tema: `legacy` (main/toolbar/footer) + `defaultDark` (navbar)
- Vite proxy: `/api` → `http://localhost:5252` (backend .NET)
- Componentes compartidos: PageTitle, PageBreadcrumb, ErrorNotification, DataTable
- **Patrón establecido**: página única .tsx, API en `api/`, React Query + notistack
- Configurator de layout y side panels eliminados del template
- Layout: fullwidth, footer off, sin configurator
- `display: 'flex'` en todas las columnas del DataGrid para alineación vertical consistente

### Páginas construidas
- /almacenes              → ✅ CRUD maestro-detalle split view 30/70 (almacenes + sub-almacenes)
- /compras                → ✅ Split view 40/60, filtro sub-almacén agrupado, CRUD cabecera+items, número auto al concluir. Header con PageBreadcrumb + motion + contador (igual que Solicitudes). Iconos FuseSvgIcon lucide. Autocomplete materiales.
- /solicitudes            → ✅ Split view 40/60: lista solicitudes + detalle items. Flujo completo: borrador→enviado→aprobado/rechazado→despachado→entregado. Editar/enviar/eliminar en lista borrador. 7+ acciones según rol+estado. Header con PageBreadcrumb + motion. Chips outlined sin icono (estilo Compras). Skeleton loaders. Diálogos extraídos en `dialogs/`. canCreate() solo valida perfil.
- /perfil                 → 🟡 Formulario single-select sub-almacén (agrupado por almacén) + aprobador. PUT guarda todo. Pendiente: obtener aprobadores de servicio externo.
- /dashboard              → placeholder (solo título, sin KPIs)

### Páginas por construir
- /materiales             → tabla + formulario ABM
- /movimientos            → tabla con filtros avanzados
- /reportes/existencias   → tabla con existencias por almacén
- /reportes/kardex        → tabla historial movimientos por material
- /reportes/valorizado    → tabla existencias valorizadas PEPS
- /reportes/compras       → tabla/gráfico resumen compras
- /reportes/movimientos   → tabla/gráfico entradas/salidas
- /dashboard              → completar con KPIs: solicitudes pendientes, existencias bajas, últimos movimientos

### Estructura de archivos

```
app/(control-panel)/
  almacenes/                  → ✅ route.tsx + AlmacenesPage.tsx (split view)
  compras/                    → ✅ route.tsx + ComprasPage.tsx
  dashboard/                  → route.tsx + DashboardPage.tsx (placeholder)
  materiales/                 → POR CREAR
  movimientos/                → POR CREAR
   solicitudes/                → ✅ route.tsx + SolicitudesPage.tsx + dialogs/ (6 componentes)
  perfil/                     → 🟡 route.tsx + PerfilPage.tsx (single-select form)
  reportes/
    existencias/              → POR CREAR
    kardex/                   → POR CREAR
    valorizado/               → POR CREAR
    compras/                  → POR CREAR
    movimientos/              → POR CREAR

api/                          → un archivo por módulo (TypeScript)
  almacenes.ts                → ✅ CRUD almacenes + sub-almacenes + asignados
  compras.ts                  → ✅ CRUD compras + compra_items
  materiales.ts               → ✅ getMateriales (para selects en compra_items)
  movimientos.ts              → POR CREAR
  solicitudes.ts              → ✅ CRUD solicitudes + todas las acciones
  perfil.ts                   → ✅ getMyPerfil, savePerfil, getSubAlmacenesPerfil, getUsuarios
  reportes.ts                 → POR CREAR
```

### Patrón para nuevas páginas (seguir el de Almacenes)
1. Crear `api/<modulo>.ts` con tipos + funciones ky
2. Crear `app/(control-panel)/<modulo>/route.tsx` con lazy import
3. Crear `app/(control-panel)/<modulo>/<Modulo>Page.tsx` con:
   - React Query para datos (`useQuery`, `useMutation`)
   - DataGrid de MUI X para tabla
   - Diálogos MUI para crear/editar
   - notistack para feedback
   - FusePageSimple como layout
   - Invalidación de cache con `queryClient.invalidateQueries`

### Convenciones frontend
- Rutas siguen la convención Fuse: `app/(control-panel)/<nombre>/route.tsx`
- Página principal como archivo único `<Modulo>Page.tsx` (no subdirectorio components/ salvo que crezca mucho)
- Diálogos complejos se extraen a `dialogs/` cuando la página supera ~500 líneas
- Los archivos `api/*.ts` solo hacen llamadas HTTP con `ky` y tipan la respuesta
- No duplicar validaciones del backend en el frontend
- Manejo de errores ky: `err.response?.json()` → mostrar `body.error` (ky lanza HTTPError con .response)
- Vite proxy: `/api` → `http://localhost:5252` (no usar VITE_API_BASE_URL, el proxy ya resuelve)
- Rutas se auto-registran por glob en routesConfig.tsx (no necesitan import manual)
- **Iconos:** usar `FuseSvgIcon` con `lucide:*` (NO `@mui/icons-material`)
- **Header:** usar `PageBreadcrumb` + `motion/react` para animaciones de título (patrón Demo Contacts)
- **Loaders:** usar `Skeleton` de MUI (NO texto "Cargando...")
- **Badges de estado:** usar Tailwind `bg-{color}-50 text-{color}-700 rounded px-2 py-1 text-sm font-medium` (patrón `OrdersStatus` del Demo)
- **Botones de acción:** `variant="contained"` con `startIcon` de lucide. Si puede estar disabled, envolver en `<Tooltip title="..."><span><Button .../></span></Tooltip>` (patrón ComprasPage)

## Convenciones generales

- Español en labels, títulos y mensajes al usuario
- Inglés en nombres de componentes, variables y funciones
- Respuestas API siempre en JSON
- Errores: `{ "error": "descripción en español" }`
- Fechas en ISO 8601
- Paginación: `?page=1&pageSize=20`
- No duplicar lógica de negocio — el backend es la fuente de verdad

## Paquetes autorizados

### Backend
- Dapper
- Npgsql
- Microsoft.AspNetCore.Authentication.JwtBearer
- BCrypt.Net-Next (instalado, no usado actualmente en el flujo principal)
- Swashbuckle (Swagger)

### Frontend (ya instalados)
- @mui/material 7 + @mui/x-data-grid 8
- ky (HTTP client)
- @tanstack/react-query 5
- jwt-decode 4
- zod 4
- notistack 3
- No agregar devextreme — se usa MUI del template Fuse

## Estado de módulos

### Fase 1 — Backend ✅ COMPLETO
- ✅ Scripts SQL (01_schema.sql al 09_perfil.sql)
- ✅ Program.cs + Db.cs + JwtHelper + DapperDateOnlyHandler (MapInboundClaims=false, MatchNamesWithUnderscores=true)
- ✅ AuthController (login externo + refresh + logout + sesiones + lógica admin/almacenero/solicitante)
- ✅ AlmacenController (CRUD almacenes + sub-almacenes con validaciones de eliminación)
- ✅ MaterialController
- ✅ CompraController (CRUD + flujo pendiente→concluido, depende de sub_almacen_id)
- ✅ MovimientoController + PepsHelper
- ✅ SolicitudController (flujo completo, POST permite cualquier rol con perfil, depende de sub_almacen_id)
- ✅ ReporteController
- ✅ PerfilController (GET perfil, PUT perfil, GET sub-almacenes, GET usuarios)

### Fase 2 — Frontend 🔄 EN CURSO
- ✅ Setup Fuse template (React + MUI + TypeScript)
- ✅ Auth integrada → JWT propio (JwtAuthProvider + authApi.ts)
- ✅ Navegación lateral completa (todos los módulos y reportes)
- ✅ Layout personalizado: fullwidth, footer off, sin configurator, Logo ALMACENES/MOPSV, tema legacy+dark
- ✅ Almacenes — CRUD maestro-detalle split view 30/70 (almacenes + sub-almacenes con sigla)
- ✅ Compras — Split view 40/60, filtro sub-almacén agrupado, CRUD cabecera+items, número auto al concluir
- ✅ API almacenes.ts + compras.ts + materiales.ts
- ✅ Solicitudes — Split view 40/60, filtro estado, flujo borrador→enviado→aprobado/rechazado→despachado→entregado. Editar/enviar/eliminar en lista borrador. Acciones por rol. Header con PageBreadcrumb + motion. Chips outlined sin icono (estilo Compras). Skeleton loaders. 6 diálogos extraídos en dialogs/. FuseSvgIcon lucide. canCreate solo valida perfil.
- ✅ API solicitudes.ts + perfil.ts
- 🟡 Perfil — formulario single-select sub-almacén + aprobador. Pendiente: aprobadores desde servicio externo
- 🟡 Dashboard — placeholder (solo título, sin KPIs)
- [ ] Materiales (página + API)
- [ ] Movimientos (página + API)
- [ ] Reportes (5 reportes + API)
- [ ] Dashboard KPIs

## Al iniciar cada sesión

1. Leer este archivo — el estado de módulos refleja el avance real
2. Si el usuario no indica módulo, preguntar cuál continuar
3. Para nuevas páginas: seguir el patrón de ComprasPage.tsx o AlmacenesPage.tsx según el tipo
4. Mantener arquitectura plana — no agregar capas sin consultar
5. No instalar paquetes sin aprobación previa
6. El frontend usa Fuse (MUI) — NO usar DevExtreme
7. Frontend usa `ky` como HTTP client (no axios)
8. JWT se guarda como `jwt_access_token` en localStorage
9. Backend corre en localhost:5252, frontend en localhost:3000 (proxy Vite)
10. Dapper: `MatchNamesWithUnderscores = true` en Program.cs (mapea snake_case → PascalCase)
11. ASP.NET: `MapInboundClaims = false` para que el claim `role` funcione con [Authorize(Roles)]
12. Errores ky en frontend: leer `err.response.json()` (HTTPError), no `err.json()` (no es Response)
13. DataGrid: usar `display: 'flex'` en todas las columnas para alineación vertical consistente
14. Compras y solicitudes dependen de sub_almacen_id — formularios usan selección cascada almacén→sub-almacén
15. Validaciones de eliminación: almacén valida sub-almacenes, sub-almacén valida compras+solicitudes
16. Dapper no soporta DateOnly nativo — usar DapperDateOnlyHandler (registrado en Program.cs)
17. Records posicionales de Dapper fallan con DateOnly — usar clases con propiedades para rows con columnas DATE
18. Filtro sub-almacén en compras usa ListSubheader de MUI para agrupar por almacén
19. GET /api/almacenes/asignados devuelve almacenes+sub-almacenes anidados según rol (admin=todos, almacenero=asignados)
20. Compras: numero nullable, se genera al concluir con formato SIGLA-YYYY-NNNNNN usando secuencia_ingresos del sub-almacén (reinicio anual)
21. UserMenu: se agregó opción "Perfil" en el dropdown del avatar (ícono user-cog), junto a "Cerrar Sesión"
22. Perfil: persona_id viene del JWT (sub claim), sub_almacen_id es single-select agrupado por almacén, aprobador_id es CI del servicio externo (VARCHAR)
23. Solicitudes: secuencia_solicitudes también reinicia por año, igual que compras
24. Solicitudes: el `enviar` registra aprobador_ci y aprobador_nombre desde el perfil del solicitante
