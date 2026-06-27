-- 10_materiales_quitar_unidad.sql
-- Quitar unidad_medida de materiales (cada compra_item ya tiene su propia unidad)

ALTER TABLE materiales DROP COLUMN IF EXISTS unidad_medida;
