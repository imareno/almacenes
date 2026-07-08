-- =============================================================
-- 13_secuencias_anio.sql
-- Agrega columnas de año para reinicio anual de secuencias
-- (compras: secuencia_ingresos | solicitudes: secuencia_solicitudes)
-- Ejecutar después de 07_sub_almacenes.sql
-- =============================================================

ALTER TABLE sub_almacenes
ADD COLUMN IF NOT EXISTS anio_ingresos    INT NOT NULL DEFAULT 0;

ALTER TABLE sub_almacenes
ADD COLUMN IF NOT EXISTS anio_solicitudes INT NOT NULL DEFAULT 0;
