-- =============================================================
-- 16_solicitudes_estados_flujo.sql
-- Renombra los estados de solicitudes al flujo definido:
--   borrador -> enviado -> aprobado/rechazado -> despachado -> entregado
-- Agrega aprobador_ci (CI del aprobador asignado desde el perfil del solicitante).
-- Ejecutar después de 15_solicitudes_borrador.sql
-- =============================================================

-- CI del aprobador asignado al enviar (proviene de perfil.aprobador_id)
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS aprobador_ci VARCHAR(20);

-- Quitar el CHECK anterior antes de migrar los valores
ALTER TABLE solicitudes DROP CONSTRAINT IF EXISTS solicitudes_estado_check;

-- Migrar valores existentes al nuevo vocabulario
UPDATE solicitudes SET estado = 'enviado'    WHERE estado = 'pendiente';
UPDATE solicitudes SET estado = 'aprobado'   WHERE estado = 'aprobada';
UPDATE solicitudes SET estado = 'rechazado'  WHERE estado = 'rechazada';
UPDATE solicitudes SET estado = 'despachado' WHERE estado = 'despachada';

-- Nuevo CHECK
ALTER TABLE solicitudes
ADD CONSTRAINT solicitudes_estado_check
CHECK (estado IN ('borrador','enviado','aprobado','rechazado','despachado','entregado'));
