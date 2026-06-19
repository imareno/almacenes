-- =============================================================
-- 06_almacen_encargado_rol.sql
-- Agrega columna rol a almacen_encargado
-- Ejecutar después de 04_almacen_encargado.sql
-- =============================================================

ALTER TABLE almacen_encargado
    ADD COLUMN IF NOT EXISTS rol VARCHAR(20) NOT NULL DEFAULT 'almacenero';

-- Check constraint para roles válidos
ALTER TABLE almacen_encargado
    DROP CONSTRAINT IF EXISTS chk_almacen_encargado_rol;

ALTER TABLE almacen_encargado
    ADD CONSTRAINT chk_almacen_encargado_rol
    CHECK (rol IN ('admin', 'almacenero', 'solicitante', 'aprobador', 'readonly'));
