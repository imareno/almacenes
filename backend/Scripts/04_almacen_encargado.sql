-- =============================================================
-- 04_almacen_encargado.sql — Relación almacén ↔ encargado
-- user_id es externo (sin FK local) — solo se conoce el ID int
-- Ejecutar después de 01_schema.sql
-- =============================================================

CREATE TABLE IF NOT EXISTS almacen_encargado (
    almacen_id  INT  NOT NULL REFERENCES almacenes(id) ON DELETE CASCADE,
    user_id     INT  NOT NULL,
    active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    PRIMARY KEY (almacen_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_almacen_encargado_user ON almacen_encargado(user_id);
