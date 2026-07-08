-- =============================================================
-- 14_solicitudes_datos_usuario.sql
-- Snapshot de nombres de usuario en solicitudes (sin tabla users)
-- solicitante_id / aprobador_id / almacenero_id son IDs del servicio
-- externo; se guarda el nombre al momento de cada acción.
-- Ejecutar después de 12_solicitudes_sub_almacen.sql
-- =============================================================

ALTER TABLE solicitudes
ADD COLUMN IF NOT EXISTS solicitante_nombre VARCHAR(200);

ALTER TABLE solicitudes
ADD COLUMN IF NOT EXISTS aprobador_nombre   VARCHAR(200);

ALTER TABLE solicitudes
ADD COLUMN IF NOT EXISTS almacenero_nombre  VARCHAR(200);
