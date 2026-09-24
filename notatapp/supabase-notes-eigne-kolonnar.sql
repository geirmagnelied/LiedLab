-- ═══════════════════════════════════════════════════════════════════
--  Notat-tabellen — eigendefinerte kolonnar («+ Ny kolonne…» i tabell-
--  menyen), same mønster som saksmatrisa (sjå supabase-cases.sql).
--  Definisjonen ligg her, verdiane i notes.ekstra. Køyr dette i
--  Supabase SQL Editor. Trygt å køyre fleire gonger.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE notes ADD COLUMN IF NOT EXISTS ekstra JSONB DEFAULT '{}';

CREATE TABLE IF NOT EXISTS note_columns (
  id          BIGINT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  label       TEXT NOT NULL,
  art         TEXT DEFAULT 'tekst',      -- 'tekst' | 'tal' | 'dato'
  sortering   INT  DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_note_columns_user ON note_columns(user_id);

ALTER TABLE note_columns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "note_columns_select" ON note_columns;
DROP POLICY IF EXISTS "note_columns_insert" ON note_columns;
DROP POLICY IF EXISTS "note_columns_update" ON note_columns;
DROP POLICY IF EXISTS "note_columns_delete" ON note_columns;
CREATE POLICY "note_columns_select" ON note_columns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "note_columns_insert" ON note_columns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "note_columns_update" ON note_columns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "note_columns_delete" ON note_columns FOR DELETE USING (auth.uid() = user_id);
