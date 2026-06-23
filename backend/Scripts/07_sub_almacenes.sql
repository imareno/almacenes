-- =============================================================
-- 07_sub_almacenes.sql
-- Tabla sub_almacenes (detalle de almacenes)
-- Ejecutar después de 01_schema.sql
-- =============================================================

CREATE TABLE IF NOT EXISTS sub_almacenes (
    id                      SERIAL PRIMARY KEY,
    almacen_id              INT NOT NULL REFERENCES almacenes(id),
    nombre                  VARCHAR(150) NOT NULL,
    sigla                   VARCHAR(20),
    descripcion             TEXT,
    secuencia_ingresos      INT NOT NULL DEFAULT 0,
    secuencia_solicitudes   INT NOT NULL DEFAULT 0,
    active                  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_sub_almacenes_almacen
    ON sub_almacenes (almacen_id);
