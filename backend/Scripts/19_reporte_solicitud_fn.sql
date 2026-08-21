-- 19_reporte_solicitud_fn.sql
-- Función que genera el cuerpo del reporte de solicitud con costos PEPS (FIFO), todo en tiempo real.
--
-- Lógica:
--   · Ingresos  = compra_items de compras 'concluido' del mismo sub-almacén (lotes de la gestión).
--   · Salidas   = cantidad_aprobada de solicitudes 'despachado'/'entregado' previas (excluye esta).
--   · FIFO      = las salidas consumen los lotes más antiguos; lo restante es el "disponible".
--   · Asignación= la cantidad_aprobada de esta solicitud se toma del disponible, lote a lote.
-- Devuelve una fila por lote consumido; código/descripción del ítem repetidos por lote.

CREATE OR REPLACE FUNCTION fn_reporte_solicitud(p_solicitud_id INT)
RETURNS TABLE (
    nro            BIGINT,
    material_id    INT,
    codigo         TEXT,
    material       TEXT,
    unidad         TEXT,
    fecha_ingreso  DATE,
    cantidad       NUMERIC(14,4),
    unitario       NUMERIC(14,4),
    monto          NUMERIC(14,4),
    salidas        NUMERIC(14,4),
    disponible     NUMERIC(14,4),
    solicitado     NUMERIC(14,4),
    aprobado       NUMERIC(14,4),
    usado          NUMERIC(14,4),
    total          NUMERIC(14,4)
)
LANGUAGE sql
STABLE
AS $$
    WITH sol AS (
        SELECT s.sub_almacen_id, s.fecha_solicitud
        FROM solicitudes s
        WHERE s.id = p_solicitud_id
    ),
    items AS (
        SELECT si.material_id, si.cantidad_solicitada, si.cantidad_aprobada,
               m.codigo, m.nombre AS material
        FROM solicitud_items si
        JOIN materiales m ON m.id = si.material_id
        WHERE si.solicitud_id = p_solicitud_id
    ),
    -- Lotes = compra_items de compras concluidas del mismo sub-almacén en la gestión
    ingresos AS (
        SELECT ci.material_id, c.id AS compra_id, c.fecha AS fecha_ingreso,
               ci.cantidad, ci.precio_unitario, ci.unidad_medida AS unidad
        FROM compras c
        JOIN compra_items ci ON ci.compra_id = c.id
        WHERE c.estado = 'concluido' AND c.active = true
          AND c.sub_almacen_id = (SELECT sub_almacen_id FROM sol)
          AND EXTRACT(YEAR FROM c.fecha) = EXTRACT(YEAR FROM (SELECT fecha_solicitud FROM sol))
    ),
    -- Salidas previas = despachos/entregas de solicitudes anteriores (excluye esta)
    salidas AS (
        SELECT si.material_id, SUM(si.cantidad_aprobada) AS total
        FROM solicitud_items si
        JOIN solicitudes s ON s.id = si.solicitud_id
        WHERE s.estado IN ('despachado', 'entregado') AND s.active = true
          AND s.sub_almacen_id = (SELECT sub_almacen_id FROM sol)
          AND s.id <> p_solicitud_id
          AND EXTRACT(YEAR FROM s.fecha_solicitud) = EXTRACT(YEAR FROM (SELECT fecha_solicitud FROM sol))
        GROUP BY si.material_id
    ),
    -- Posición FIFO por lote: acumulado de ingreso vs salidas consumidas
    lotes AS (
        SELECT i.material_id, i.compra_id, i.fecha_ingreso, i.cantidad, i.precio_unitario, i.unidad,
               SUM(i.cantidad) OVER (PARTITION BY i.material_id ORDER BY i.fecha_ingreso, i.compra_id) AS acum_ingreso,
               COALESCE(s.total, 0) AS salidas
        FROM ingresos i
        LEFT JOIN salidas s ON s.material_id = i.material_id
    ),
    lotes_disp AS (
        SELECT l.*,
               LEAST(l.cantidad, GREATEST(0, l.acum_ingreso - l.salidas)) AS disponible
        FROM lotes l
    ),
    -- Disponible acumulado por material
    asignacion AS (
        SELECT ld.*,
               SUM(ld.disponible) OVER (PARTITION BY ld.material_id ORDER BY ld.fecha_ingreso, ld.compra_id) AS acum_disp,
               i.cantidad_solicitada, i.cantidad_aprobada
        FROM lotes_disp ld
        JOIN items i ON i.material_id = ld.material_id
    ),
    -- Cuánto consume esta solicitud de cada lote (FIFO)
    consumo AS (
        SELECT a.*,
               GREATEST(0, LEAST(a.disponible, a.cantidad_aprobada - (a.acum_disp - a.disponible))) AS usado
        FROM asignacion a
    )
    SELECT ROW_NUMBER() OVER (ORDER BY i.material_id, c.fecha_ingreso, c.compra_id)::BIGINT AS nro,
           i.material_id,
           i.codigo,
           i.material,
           c.unidad,
           c.fecha_ingreso,
           c.cantidad,
           c.precio_unitario,
           c.cantidad * c.precio_unitario,
           c.salidas,
           c.disponible,
           i.cantidad_solicitada,
           i.cantidad_aprobada,
           c.usado,
           c.usado * c.precio_unitario
    FROM items i
    LEFT JOIN consumo c ON c.material_id = i.material_id
    WHERE c.usado > 0
    ORDER BY i.material_id, c.fecha_ingreso, c.compra_id;
$$;
