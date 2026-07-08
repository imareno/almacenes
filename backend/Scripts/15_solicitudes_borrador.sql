-- =============================================================
-- 15_solicitudes_borrador.sql
-- Agrega estado 'borrador' al flujo de solicitudes.
-- Flujo: borrador -> pendiente -> aprobada/rechazada -> despachada -> entregado
-- Ejecutar después de 12_solicitudes_sub_almacen.sql
-- =============================================================

ALTER TABLE solicitudes DROP CONSTRAINT IF EXISTS solicitudes_estado_check;

ALTER TABLE solicitudes
ADD CONSTRAINT solicitudes_estado_check
CHECK (estado IN ('borrador','pendiente','aprobada','rechazada','despachada','entregado'));
