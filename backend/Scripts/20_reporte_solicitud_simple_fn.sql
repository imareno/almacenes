-- 20_reporte_solicitud_simple_fn.sql
-- Variante simple de fn_reporte_solicitud (script 19):
--   · misma fuente: ítems de la solicitud + lotes (compras 'concluido' del mismo sub-almacén en la gestión)
--   · SIN columnas FIFO (salidas, disponible, usado, total) y SIN costos (unitario, monto)
--   · solo cantidades: solicitado y aprobado
-- Select + joins sencillos (sin CTE de ventanas, salvo ROW_NUMBER para nro).

CREATE OR REPLACE FUNCTION fn_reporte_solicitud_simple(p_solicitud_id INT)
RETURNS TABLE (
    nro            BIGINT,
    material_id    INT,
    codigo         TEXT,
    material       TEXT,
    unidad         TEXT,
    fecha_ingreso  DATE,
    cantidad       NUMERIC(14,4),
    solicitado     NUMERIC(14,4),
    aprobado       NUMERIC(14,4)
)
LANGUAGE sql
STABLE
AS $$
    WITH sol AS (
        SELECT sub_almacen_id, fecha_solicitud
        FROM solicitudes
        WHERE id = p_solicitud_id
    ),
    items AS (
        SELECT si.material_id, si.cantidad_solicitada, si.cantidad_aprobada,
               m.codigo, m.nombre AS material
        FROM solicitud_items si
        JOIN materiales m ON m.id = si.material_id
        WHERE si.solicitud_id = p_solicitud_id
    ),
    ingresos AS (
        SELECT ci.material_id, c.id AS compra_id, c.fecha AS fecha_ingreso,
               ci.cantidad, ci.unidad_medida
        FROM compras c
        JOIN compra_items ci ON ci.compra_id = c.id
        WHERE c.estado = 'concluido' AND c.active = true
          AND c.sub_almacen_id = (SELECT sub_almacen_id FROM sol)
          AND EXTRACT(YEAR FROM c.fecha) = EXTRACT(YEAR FROM (SELECT fecha_solicitud FROM sol))
    )
    SELECT ROW_NUMBER() OVER (ORDER BY i.material_id, g.fecha_ingreso, g.compra_id)::BIGINT AS nro,
           i.material_id,
           i.codigo,
           i.material,
           g.unidad_medida AS unidad,
           g.fecha_ingreso,
           g.cantidad,
           i.cantidad_solicitada,
           i.cantidad_aprobada
    FROM items i
    LEFT JOIN ingresos g ON g.material_id = i.material_id
    ORDER BY i.material_id, g.fecha_ingreso, g.compra_id;
$$;
