CREATE TABLE IF NOT EXISTS perfil (
    id              SERIAL PRIMARY KEY,
    persona_id      INT NOT NULL,
    sub_almacen_id  INT NOT NULL REFERENCES sub_almacenes(id),
    aprobador_id    INT NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(persona_id, sub_almacen_id)
);

CREATE INDEX IF NOT EXISTS idx_perfil_persona ON perfil(persona_id);
