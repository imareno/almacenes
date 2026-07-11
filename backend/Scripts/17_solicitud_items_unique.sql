-- 17_solicitud_items_unique.sql
-- Evita ítems duplicados por material en una misma solicitud.
-- Si se solicita el mismo material dos veces, se suman las cantidades (ON CONFLICT).

-- Consolidar duplicados existentes antes de crear el índice único
WITH dups AS (
    SELECT solicitud_id, material_id,
           MIN(id) AS keep_id,
           SUM(cantidad_solicitada) AS total_solicitada,
           SUM(cantidad_aprobada) AS total_aprobada
    FROM solicitud_items
    GROUP BY solicitud_id, material_id
    HAVING COUNT(*) > 1
)
UPDATE solicitud_items si
SET cantidad_solicitada = d.total_solicitada,
    cantidad_aprobada   = d.total_aprobada
FROM dups d
WHERE si.id = d.keep_id;

DELETE FROM solicitud_items si
USING (
    SELECT solicitud_id, material_id, MIN(id) AS keep_id
    FROM solicitud_items
    GROUP BY solicitud_id, material_id
    HAVING COUNT(*) > 1
) d
WHERE si.solicitud_id = d.solicitud_id
  AND si.material_id = d.material_id
  AND si.id <> d.keep_id;

ALTER TABLE solicitud_items
    ADD CONSTRAINT solicitud_items_solicitud_material_key
    UNIQUE (solicitud_id, material_id);
