# Sistema de Control de Almacén

## Stack

- Backend: .NET Core 8 Web API
- Base de datos: PostgreSQL
- Frontend: React + Fuse template (MUI / Material UI) — TypeScript
- ORM: Sin ORM — queries SQL directas con Dapper
- Auth: JWT propio — autenticación delegada a servicio externo (hades.oopp.gob.bo)
- HTTP client frontend: `ky`

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
```

## Base de datos PostgreSQL

```sql
-- Usuarios locales (solo para datos de prueba — el login usa servicio externo)
users           → id, username, password_hash, role, active, created_at
  roles: 'admin' | 'almacenero' | 'solicitante' | 'aprobador' | 'readonly'

-- Almacenes (árbol con parent_id)
almacenes       → id, nombre, descripcion, parent_id (null = raíz), active

-- Materiales
materiales      → id, codigo, nombre, descripcion, unidad_medida,
                   categoria, active, created_at

-- Compras (cabecera)
compras         → id, numero, proveedor, fecha, estado, user_id, created_at
  estados: 'borrador' | 'confirmada' | 'recibida'

-- Detalle de compras
compra_items    → id, compra_id, material_id, cantidad,
                   precio_unitario, created_at

-- Movimientos — fuente de verdad de existencias
movimientos     → id, tipo, material_id, almacen_id, cantidad,
                   costo_unitario, lote_ref, fecha, solicitud_id,
                   compra_item_id, user_id, observacion, created_at
  tipo: 'ingreso' | 'salida'

-- Solicitudes
solicitudes     → id, numero, solicitante_id, almacen_id, estado,
                   aprobador_id, almacenero_id, fecha_solicitud,
                   fecha_aprobacion, fecha_despacho, fecha_entrega,
                   observacion, datos_solicitante (JSONB), created_at
  estados: 'pendiente' | 'aprobada' | 'rechazada' | 'despachada' | 'entregado'

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

## Flujo completo de solicitudes

```
SOLICITANTE crea solicitud
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
5. Costo de salida = suma ponderada de lotes consumidos
6. Actualizar cantidad_disponible en cada lote consumido

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
- /solicitudes            → vista según rol:
    solicitante           → mis solicitudes + nueva solicitud
    aprobador             → bandeja pendientes
    almacenero            → despacho y entrega
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
- No duplicar lógica de negocio — el backend es la fuente de verdad

## Paquetes autorizados

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

## Estado de módulos

### Fase 1 — Backend ✅ COMPLETO
- ✅ Scripts SQL (01_schema.sql al 05_datos_usuario.sql)
- ✅ Program.cs + Db.cs + JwtHelper
- ✅ AuthController (login externo + refresh + logout + sesiones)
- ✅ AlmacenController
- ✅ MaterialController
- ✅ CompraController
- ✅ MovimientoController + PepsHelper
- ✅ SolicitudController (flujo completo 5 acciones)
- ✅ ReporteController

### Fase 2 — Frontend 🔄 EN CURSO
- ✅ Setup Fuse template (React + MUI + TypeScript)
- ✅ Auth integrada → JWT propio (JwtAuthProvider + authApi.ts)
- [ ] Dashboard
- [ ] Almacenes
- [ ] Materiales
- [ ] Compras
- [ ] Movimientos
- [ ] Solicitudes (vistas por rol)
- [ ] Reportes (5 reportes)
- [ ] Navegación lateral (sidebar con rutas del sistema)

## Al iniciar cada sesión

1. Leer este archivo
2. Revisar qué módulos están marcados como completos ✅
3. Leer el código existente para entender el estado real
4. Preguntar por cuál módulo continuar si no es claro
5. Mantener arquitectura plana — no agregar capas sin consultar
6. No instalar paquetes sin aprobación previa
7. El frontend usa Fuse (MUI) — NO usar DevExtreme
