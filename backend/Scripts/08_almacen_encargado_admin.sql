-- =============================================================
-- 08_almacen_encargado_admin.sql
-- Agrega columna admin a almacen_encargado
-- Ejecutar después de 04_almacen_encargado.sql
-- =============================================================

ALTER TABLE almacen_encargado
    ADD COLUMN IF NOT EXISTS admin BOOLEAN NOT NULL DEFAULT FALSE;
