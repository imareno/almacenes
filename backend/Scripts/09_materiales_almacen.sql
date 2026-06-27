-- 09_materiales_almacen.sql
-- Agrega almacen_id a materiales (0 = universal, >0 = específico del almacén)
-- Cambia unicidad de codigo: de global a por almacén

ALTER TABLE materiales ADD COLUMN IF NOT EXISTS almacen_id INT NOT NULL DEFAULT 0;

-- Quitar constraint único global de codigo
ALTER TABLE materiales DROP CONSTRAINT IF EXISTS materiales_codigo_key;
DROP INDEX IF EXISTS materiales_codigo_key;

-- Unicidad: mismo código no puede repetirse dentro del mismo almacen_id (incluye 0 = universal)
CREATE UNIQUE INDEX IF NOT EXISTS idx_materiales_codigo_almacen
    ON materiales(LOWER(codigo), almacen_id);

CREATE INDEX IF NOT EXISTS idx_materiales_almacen ON materiales(almacen_id);
