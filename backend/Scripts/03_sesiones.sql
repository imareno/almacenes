CREATE TABLE IF NOT EXISTS sesiones (
    id              SERIAL PRIMARY KEY,

    -- Identidad
    user_id         INT NOT NULL,
    username        VARCHAR(100) NOT NULL,

    -- Contexto de red
    ip_address      VARCHAR(45),           -- IPv4 o IPv6
    user_agent      TEXT,

    -- Token: almacenamos el hash (SHA-256) para no guardar el JWT completo
    token_hash      VARCHAR(64),

    -- Tiempos
    fecha_login     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_expiracion TIMESTAMPTZ,
    fecha_logout    TIMESTAMPTZ,           -- NULL mientras la sesión está activa
    -- Estado
    estado          VARCHAR(20) NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa','expirada','cerrada')),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_sesiones_username      ON sesiones(username);
CREATE INDEX IF NOT EXISTS idx_sesiones_user_id       ON sesiones(user_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_estado        ON sesiones(estado);
CREATE INDEX IF NOT EXISTS idx_sesiones_fecha_login   ON sesiones(fecha_login);
CREATE INDEX IF NOT EXISTS idx_sesiones_token_hash    ON sesiones(token_hash);
