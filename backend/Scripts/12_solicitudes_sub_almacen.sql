-- =============================================================
-- 12_solicitudes_sub_almacen.sql
-- Migra solicitudes de almacen_id a sub_almacen_id
-- + agrega columna active
-- Ejecutar después de 07_sub_almacenes.sql
-- =============================================================

-- 1. Agregar sub_almacen_id (nullable inicialmente)
ALTER TABLE solicitudes
ADD COLUMN IF NOT EXISTS sub_almacen_id INT;

-- 2. Migrar datos existentes: asignar primer sub-almacén del almacén correspondiente
UPDATE solicitudes s
SET sub_almacen_id = (
    SELECT sa.id
    FROM sub_almacenes sa
    WHERE sa.almacen_id = s.almacen_id AND sa.active = true
    ORDER BY sa.id
    LIMIT 1
)
WHERE s.sub_almacen_id IS NULL;

-- 3. Agregar FK y hacer NOT NULL
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'solicitudes_sub_almacen_id_fkey'
    ) THEN
        ALTER TABLE solicitudes
        ADD CONSTRAINT solicitudes_sub_almacen_id_fkey
        FOREIGN KEY (sub_almacen_id) REFERENCES sub_almacenes(id);
    END IF;
END$$;

-- 4. Agregar columna active
ALTER TABLE solicitudes
ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

-- 5. Eliminar columna almacen_id (ya reemplazada por sub_almacen_id)
ALTER TABLE solicitudes
DROP COLUMN IF EXISTS almacen_id;

CREATE INDEX IF NOT EXISTS idx_solicitudes_sub_almacen
    ON solicitudes(sub_almacen_id);
