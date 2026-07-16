-- ============================================================
-- 038_add_account_id_to_media_library.sql
--
-- Agrega account_id a la tabla media_library para consistencia
-- con la migración 017 (account_sharing)
-- ============================================================

-- Agregar columna account_id a media_library
ALTER TABLE media_library ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;

-- Backfill account_id desde user_id (asumiendo que cada usuario tiene su cuenta)
UPDATE media_library SET account_id = (
  SELECT account_id FROM profiles WHERE profiles.user_id = media_library.user_id LIMIT 1
) WHERE account_id IS NULL;

-- Hacer account_id NOT NULL después del backfill
ALTER TABLE media_library ALTER COLUMN account_id SET NOT NULL;

-- Crear índice para account_id
CREATE INDEX IF NOT EXISTS idx_media_library_account ON media_library(account_id);

-- Actualizar política RLS para incluir account_id
DROP POLICY IF EXISTS "Users can manage own media" ON media_library;
CREATE POLICY "Users can manage own media" ON media_library FOR ALL 
USING (auth.uid() = user_id OR account_id IN (
  SELECT account_id FROM profiles WHERE user_id = auth.uid()
));
