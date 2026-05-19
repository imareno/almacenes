-- =============================================================
-- 01_schema.sql — Almacen: creación de tablas
-- Orden: users → almacenes → materiales → compras → compra_items
--        → solicitudes → movimientos → solicitud_items → lotes
-- =============================================================

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(100) NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    role            VARCHAR(20) NOT NULL CHECK (role IN ('admin','almacenero','solicitante','aprobador','readonly')),
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS almacenes (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(150) NOT NULL,
    descripcion TEXT,
    parent_id   INT REFERENCES almacenes(id),
    active      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS materiales (
    id              SERIAL PRIMARY KEY,
    codigo          VARCHAR(50) NOT NULL UNIQUE,
    nombre          VARCHAR(200) NOT NULL,
    descripcion     TEXT,
    unidad_medida   VARCHAR(30) NOT NULL,
    categoria       VARCHAR(100),
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compras (
    id          SERIAL PRIMARY KEY,
    numero      VARCHAR(50) NOT NULL UNIQUE,
    proveedor   VARCHAR(200) NOT NULL,
    fecha       DATE NOT NULL,
    estado      VARCHAR(20) NOT NULL DEFAULT 'borrador'
                    CHECK (estado IN ('borrador','confirmada','recibida')),
    user_id     INT NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compra_items (
    id              SERIAL PRIMARY KEY,
    compra_id       INT NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
    material_id     INT NOT NULL REFERENCES materiales(id),
    cantidad        NUMERIC(14,4) NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(14,4) NOT NULL CHECK (precio_unitario >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS solicitudes (
    id                  SERIAL PRIMARY KEY,
    numero              VARCHAR(50) NOT NULL UNIQUE,
    solicitante_id      INT NOT NULL REFERENCES users(id),
    almacen_id          INT NOT NULL REFERENCES almacenes(id),
    estado              VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                            CHECK (estado IN ('pendiente','aprobada','rechazada','despachada','entregado')),
    aprobador_id        INT REFERENCES users(id),
    almacenero_id       INT REFERENCES users(id),
    fecha_solicitud     DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_aprobacion    DATE,
    fecha_despacho      DATE,
    fecha_entrega       DATE,
    observacion         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS movimientos (
    id              SERIAL PRIMARY KEY,
    tipo            VARCHAR(10) NOT NULL CHECK (tipo IN ('ingreso','salida')),
    material_id     INT NOT NULL REFERENCES materiales(id),
    almacen_id      INT NOT NULL REFERENCES almacenes(id),
    cantidad        NUMERIC(14,4) NOT NULL CHECK (cantidad > 0),
    costo_unitario  NUMERIC(14,4) NOT NULL DEFAULT 0,
    lote_ref        VARCHAR(100),
    fecha           DATE NOT NULL,
    solicitud_id    INT REFERENCES solicitudes(id),
    compra_item_id  INT REFERENCES compra_items(id),
    user_id         INT NOT NULL REFERENCES users(id),
    observacion     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS solicitud_items (
    id                      SERIAL PRIMARY KEY,
    solicitud_id            INT NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
    material_id             INT NOT NULL REFERENCES materiales(id),
    cantidad_solicitada     NUMERIC(14,4) NOT NULL CHECK (cantidad_solicitada > 0),
    cantidad_despachada     NUMERIC(14,4) NOT NULL DEFAULT 0,
    cantidad_entregada      NUMERIC(14,4) NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lotes (
    id                  SERIAL PRIMARY KEY,
    material_id         INT NOT NULL REFERENCES materiales(id),
    almacen_id          INT NOT NULL REFERENCES almacenes(id),
    cantidad_inicial    NUMERIC(14,4) NOT NULL CHECK (cantidad_inicial > 0),
    cantidad_disponible NUMERIC(14,4) NOT NULL CHECK (cantidad_disponible >= 0),
    costo_unitario      NUMERIC(14,4) NOT NULL DEFAULT 0,
    fecha_ingreso       DATE NOT NULL,
    compra_item_id      INT REFERENCES compra_items(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_movimientos_material    ON movimientos(material_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_almacen     ON movimientos(almacen_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha       ON movimientos(fecha);
CREATE INDEX IF NOT EXISTS idx_lotes_material_almacen  ON lotes(material_id, almacen_id);
CREATE INDEX IF NOT EXISTS idx_lotes_fecha_ingreso     ON lotes(fecha_ingreso);
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado      ON solicitudes(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_solicitante ON solicitudes(solicitante_id);
