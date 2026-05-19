-- =============================================================
-- 02_seed.sql — Datos iniciales
-- Password para todos los usuarios de prueba: Admin123!
-- Hash BCrypt generado con cost=12
-- =============================================================

-- Usuarios (password: Admin123!)
INSERT INTO users (username, password_hash, role) VALUES
    ('admin',        '$2a$12$XsOmNFkAnqOOlKnCTHiPOeZ.MQ0WXRWWriDuJzHkeMNGr.TW4IVCy', 'admin'),
    ('almacenero1',  '$2a$12$XsOmNFkAnqOOlKnCTHiPOeZ.MQ0WXRWWriDuJzHkeMNGr.TW4IVCy', 'almacenero'),
    ('solicitante1', '$2a$12$XsOmNFkAnqOOlKnCTHiPOeZ.MQ0WXRWWriDuJzHkeMNGr.TW4IVCy', 'solicitante'),
    ('aprobador1',   '$2a$12$XsOmNFkAnqOOlKnCTHiPOeZ.MQ0WXRWWriDuJzHkeMNGr.TW4IVCy', 'aprobador'),
    ('visor1',       '$2a$12$XsOmNFkAnqOOlKnCTHiPOeZ.MQ0WXRWWriDuJzHkeMNGr.TW4IVCy', 'readonly')
ON CONFLICT (username) DO NOTHING;

-- Almacén raíz y sub-almacenes
INSERT INTO almacenes (nombre, descripcion, parent_id) VALUES
    ('Almacén Central', 'Almacén principal de la empresa', NULL)
ON CONFLICT DO NOTHING;

INSERT INTO almacenes (nombre, descripcion, parent_id) VALUES
    ('Almacén Norte', 'Depósito zona norte', (SELECT id FROM almacenes WHERE nombre = 'Almacén Central')),
    ('Almacén Sur',   'Depósito zona sur',   (SELECT id FROM almacenes WHERE nombre = 'Almacén Central'))
ON CONFLICT DO NOTHING;

-- Materiales de ejemplo
INSERT INTO materiales (codigo, nombre, descripcion, unidad_medida, categoria) VALUES
    ('MAT-001', 'Cemento Portland Tipo I',   'Bolsa 42.5 kg',               'BLS',  'Construcción'),
    ('MAT-002', 'Arena gruesa',              'Por metro cúbico',            'M3',   'Construcción'),
    ('MAT-003', 'Fierro corrugado 3/8"',     'Varilla 9 metros',            'VAR',  'Acero'),
    ('MAT-004', 'Fierro corrugado 1/2"',     'Varilla 9 metros',            'VAR',  'Acero'),
    ('MAT-005', 'Tubería PVC 4" x 3m',       'Tubería desagüe',             'UND',  'Plomería'),
    ('MAT-006', 'Cable NYY 2x4mm',           'Metro lineal',                'ML',   'Eléctrico'),
    ('MAT-007', 'Pintura látex blanca',      'Balde 20 litros',             'BLD',  'Pinturas'),
    ('MAT-008', 'Madera tornillo 2"x4"x10\'','Tabla para encofrado',        'UND',  'Madera'),
    ('MAT-009', 'Clavos 3"',                 'Kilogramo',                   'KG',   'Ferretería'),
    ('MAT-010', 'Disco de corte 4.5"',       'Disco abrasivo para amoladora','UND', 'Ferretería')
ON CONFLICT (codigo) DO NOTHING;
