-- 18_solicitud_items_fix.sql
-- Agrega columna cantidad_aprobada (si no existe) y crea la constraint UNIQUE requerida por el código C#.
-- Reemplaza a 17_solicitud_items_unique.sql.

-- 1. Agregar columna cantidad_aprobada si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'solicitud_items' AND column_name = 'cantidad_aprobada'
    ) THEN
        -- Copiar datos de cantidad_despachada si existe y cantidad_aprobada no
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'solicitud_items' AND column_name = 'cantidad_despachada'
        ) THEN
            ALTER TABLE solicitud_items ADD COLUMN cantidad_aprobada NUMERIC(14,4) NOT NULL DEFAULT 0;
            UPDATE solicitud_items SET cantidad_aprobada = cantidad_despachada;
        ELSE
            ALTER TABLE solicitud_items ADD COLUMN cantidad_aprobada NUMERIC(14,4) NOT NULL DEFAULT 0;
        END IF;
    END IF;
END $$;

-- 2. Crear constraint UNIQUE (solicitud_id, material_id) si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'solicitud_items_solicitud_material_key'
          AND conrelid = 'solicitud_items'::regclass
    ) THEN
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
    END IF;
END $$;
