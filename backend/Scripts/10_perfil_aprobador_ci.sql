-- Migra aprobador_id de INT (FK a users) a VARCHAR (CI del servicio externo)
-- y agrega columnas para cachear nombre y cargo del aprobador
ALTER TABLE perfil DROP CONSTRAINT IF EXISTS perfil_aprobador_id_fkey;
ALTER TABLE perfil ALTER COLUMN aprobador_id TYPE VARCHAR(20) USING aprobador_id::VARCHAR(20);
ALTER TABLE perfil ALTER COLUMN aprobador_id SET NOT NULL;
ALTER TABLE perfil ADD COLUMN IF NOT EXISTS aprobador_nombre VARCHAR(200);
ALTER TABLE perfil ADD COLUMN IF NOT EXISTS aprobador_cargo VARCHAR(300);
