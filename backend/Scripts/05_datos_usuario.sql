-- =============================================================
-- 05_datos_usuario.sql
-- Ejecutar después de 03_sesiones.sql y 01_schema.sql
-- =============================================================

-- Snapshot completo del usuario externo al momento del login
ALTER TABLE sesiones
    ADD COLUMN IF NOT EXISTS datos_usuario JSONB;

-- Datos personales del solicitante al momento de crear la solicitud
ALTER TABLE solicitudes
    ADD COLUMN IF NOT EXISTS datos_solicitante JSONB;
