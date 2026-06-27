-- 11_materiales_sin_universal.sql
-- Cada material ahora debe pertenecer a un almacén específico.
-- Los materiales con almacen_id = 0 (universales) ya no son válidos.

-- OPCIÓN A (recomendada en dev): eliminar materiales sin almacén asignado
DELETE FROM materiales WHERE almacen_id = 0;

-- OPCIÓN B: reasignar a un almacén antes de continuar
-- UPDATE materiales SET almacen_id = <id_almacen> WHERE almacen_id = 0;

-- Quitar el default 0 y agregar restricción que almacen_id > 0
ALTER TABLE materiales ALTER COLUMN almacen_id DROP DEFAULT;
ALTER TABLE materiales ADD CONSTRAINT chk_materiales_almacen_id CHECK (almacen_id > 0);
