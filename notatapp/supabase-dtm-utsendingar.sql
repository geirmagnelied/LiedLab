-- ═══════════════════════════════════════════════════════════════════
--  DTM — registrering av utsendingar (t.d. e-post) av dokument/tegningar.
--  Sjå claude/dtm-modul.md. Køyr dette i Supabase SQL Editor. Trygt å
--  køyre fleire gonger.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dtm_utsendingar (
  id             BIGINT PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id     BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  mottakar       TEXT DEFAULT '',
  kanal          TEXT DEFAULT 'epost',   -- 'epost' | 'webhotell' | 'anna'
  kommentar      TEXT DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'kladd',  -- 'kladd' | 'sendt'
  dato           TEXT DEFAULT '',
  oppretta_av    TEXT DEFAULT '',
  bekrefta_av    TEXT DEFAULT '',
  bekrefta_tid   TIMESTAMPTZ,
  kvittering_fil TEXT DEFAULT '',        -- filnamn i "2 Informasjonsflyt\Utsendingar", om lagt ved
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dtm_utsendingar_project ON dtm_utsendingar(project_id);

-- Kva dokument (og kva revisjon/fil, på utsendingstidspunktet) som var
-- del av éi utsending. Snapshot, ikkje ein levande peikar — ei seinare
-- ny revisjon skal ikkje skrive om historia.
CREATE TABLE IF NOT EXISTS dtm_utsending_dokument (
  id           BIGINT PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  utsending_id BIGINT NOT NULL REFERENCES dtm_utsendingar(id) ON DELETE CASCADE,
  dokument_id  BIGINT REFERENCES dtm_dokumenter(id) ON DELETE SET NULL,
  nr           TEXT NOT NULL,
  kategori     TEXT DEFAULT '',
  filnamn      TEXT DEFAULT '',
  revisjon     TEXT DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dtm_utsending_dokument_utsending ON dtm_utsending_dokument(utsending_id);

ALTER TABLE dtm_utsendingar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dtm_utsendingar_select" ON dtm_utsendingar;
DROP POLICY IF EXISTS "dtm_utsendingar_insert" ON dtm_utsendingar;
DROP POLICY IF EXISTS "dtm_utsendingar_update" ON dtm_utsendingar;
DROP POLICY IF EXISTS "dtm_utsendingar_delete" ON dtm_utsendingar;
CREATE POLICY "dtm_utsendingar_select" ON dtm_utsendingar FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "dtm_utsendingar_insert" ON dtm_utsendingar FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dtm_utsendingar_update" ON dtm_utsendingar FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "dtm_utsendingar_delete" ON dtm_utsendingar FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE dtm_utsending_dokument ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dtm_utsending_dokument_select" ON dtm_utsending_dokument;
DROP POLICY IF EXISTS "dtm_utsending_dokument_insert" ON dtm_utsending_dokument;
DROP POLICY IF EXISTS "dtm_utsending_dokument_update" ON dtm_utsending_dokument;
DROP POLICY IF EXISTS "dtm_utsending_dokument_delete" ON dtm_utsending_dokument;
CREATE POLICY "dtm_utsending_dokument_select" ON dtm_utsending_dokument FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "dtm_utsending_dokument_insert" ON dtm_utsending_dokument FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dtm_utsending_dokument_update" ON dtm_utsending_dokument FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "dtm_utsending_dokument_delete" ON dtm_utsending_dokument FOR DELETE USING (auth.uid() = user_id);
