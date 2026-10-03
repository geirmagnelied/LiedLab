-- ═══════════════════════════════════════════════════════════════════
--  Bilete-modulen — sjå claude/bilete-modul.md for full spesifikasjon.
--  Køyr i Supabase SQL Editor. Trygt å køyre fleire gonger.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dtm_bilete (
  id             BIGINT PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id     BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  nr             TEXT NOT NULL,             -- BIL-XXX, løpande PER PROSJEKT
  filnamn        TEXT NOT NULL,
  dato_tatt      DATE,                      -- frå EXIF DateTimeOriginal, fell tilbake til importdato
  plassering     TEXT DEFAULT '',           -- GPS lat/long frå EXIF (tekst), eller manuelt skrive stad
  teke_av        TEXT DEFAULT '',           -- EXIF manglar oftast dette — default er den som importerte
  importert_av   TEXT DEFAULT '',
  importert_dato TIMESTAMPTZ DEFAULT NOW(),
  kjelde         TEXT NOT NULL DEFAULT 'skrivebord', -- 'skrivebord' | 'mobil'
  ekstra         JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, project_id, nr)
);
CREATE INDEX IF NOT EXISTS idx_dtm_bilete_project ON dtm_bilete(project_id);

ALTER TABLE dtm_bilete ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dtm_bilete_select" ON dtm_bilete;
DROP POLICY IF EXISTS "dtm_bilete_insert" ON dtm_bilete;
DROP POLICY IF EXISTS "dtm_bilete_update" ON dtm_bilete;
DROP POLICY IF EXISTS "dtm_bilete_delete" ON dtm_bilete;
CREATE POLICY "dtm_bilete_select" ON dtm_bilete FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "dtm_bilete_insert" ON dtm_bilete FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dtm_bilete_update" ON dtm_bilete FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "dtm_bilete_delete" ON dtm_bilete FOR DELETE USING (auth.uid() = user_id);

-- Kø for bilete lasta opp frå mobil, ikkje henta ned/prosessert av skrive-
-- bordsappen enno. Rada vert SLETTA (saman med Storage-objektet) når
-- skrivebordsappen har lasta ned og importert fila til dtm_bilete.
CREATE TABLE IF NOT EXISTS bilete_mobil_ko (
  id             BIGINT PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id     BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  storage_sti    TEXT NOT NULL,   -- sti inni 'bilete-mobil'-bucketen
  opphav_filnamn TEXT NOT NULL,
  lasta_opp_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bilete_mobil_ko_project ON bilete_mobil_ko(project_id);

ALTER TABLE bilete_mobil_ko ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bilete_mobil_ko_select" ON bilete_mobil_ko;
DROP POLICY IF EXISTS "bilete_mobil_ko_insert" ON bilete_mobil_ko;
DROP POLICY IF EXISTS "bilete_mobil_ko_delete" ON bilete_mobil_ko;
CREATE POLICY "bilete_mobil_ko_select" ON bilete_mobil_ko FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bilete_mobil_ko_insert" ON bilete_mobil_ko FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bilete_mobil_ko_delete" ON bilete_mobil_ko FOR DELETE USING (auth.uid() = user_id);

-- Storage-bucket for mellombels mobil-opplasting (privat — ikkje offentleg
-- lesbar). Filer ligg under <user_id>/<project_id>/<filnamn>.
INSERT INTO storage.buckets (id, name, public)
VALUES ('bilete-mobil', 'bilete-mobil', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "bilete_mobil_storage_all" ON storage.objects;
CREATE POLICY "bilete_mobil_storage_all" ON storage.objects FOR ALL
  USING (bucket_id = 'bilete-mobil' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'bilete-mobil' AND (storage.foldername(name))[1] = auth.uid()::text);
