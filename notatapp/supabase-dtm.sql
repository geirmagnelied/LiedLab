-- ═══════════════════════════════════════════════════════════════════
--  DTM (Dokument, tegningar og modellar) — datamodell.
--  Sjå claude/dtm-modul.md for full spesifikasjon. Køyr dette i
--  Supabase SQL Editor. Trygt å køyre fleire gonger.
-- ═══════════════════════════════════════════════════════════════════

-- Éi rad per dokumentnummer (per prosjekt). Kan ha fleire av dei fire
-- kategori-felta utfylte samstundes (same dokumentnummer kan vere aktivt
-- som arbeidsdokument OG resultatdokument OG kontrolldokument på éin gong).
CREATE TABLE IF NOT EXISTS dtm_dokumenter (
  id               BIGINT PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id       BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  nr               TEXT NOT NULL,
  tittel           TEXT DEFAULT '',
  fag              TEXT DEFAULT '',
  fase             TEXT DEFAULT '',
  delprosjekt      TEXT DEFAULT '',
  malestokk        TEXT DEFAULT '',
  format           TEXT DEFAULT '',
  utarbeida_av     TEXT DEFAULT '',
  ek_person        TEXT DEFAULT '',
  fk_person        TEXT DEFAULT '',
  lagra_av         TEXT DEFAULT '',
  oppdragsgivar    TEXT DEFAULT '',
  tiltakshavar     TEXT DEFAULT '',
  oppdragsnr       TEXT DEFAULT '',
  godkjent_av      TEXT DEFAULT '',
  revisjonsbeskriving TEXT DEFAULT '',
  tegningsformal   TEXT DEFAULT '',      -- t.d. Arbeidstegning/Søknadstegning/Tilbodstegning — frå den loddrette labelen i tittelfeltet
  ferdigstillingsstatus TEXT DEFAULT '', -- Moglegheitsstudie/Skisseprosjekt/Forprosjekt/Tilbodsunderlag/Arbeidsteikning/Som bygd
  favorite         BOOLEAN NOT NULL DEFAULT false,
  pinned           BOOLEAN NOT NULL DEFAULT false,
  status           TEXT[] NOT NULL DEFAULT '{}',
  arbeidsdokument   JSONB,   -- { filnamn, revisjon, dato, lasta_opp } | null
  resultatdokument  JSONB,
  kontrolldokument  JSONB,
  styrande_dokument JSONB,
  ekstra           JSONB DEFAULT '{}',  -- eigendefinerte kolonnar, same mønster som notes/cases
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, project_id, nr)
);
CREATE INDEX IF NOT EXISTS idx_dtm_dokumenter_project ON dtm_dokumenter(project_id);

-- Historikk/Arkiv per kategori — éi rad per arkivert revisjon.
CREATE TABLE IF NOT EXISTS dtm_versjonar (
  id          BIGINT PRIMARY KEY,
  dokument_id BIGINT NOT NULL REFERENCES dtm_dokumenter(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kategori    TEXT NOT NULL,  -- 'arbeidsdokument' | 'resultatdokument' | 'kontrolldokument' | 'styrande_dokument'
  filnamn     TEXT NOT NULL,
  revisjon    TEXT DEFAULT '',
  dato        TEXT DEFAULT '',
  lasta_opp   TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dtm_versjonar_dokument ON dtm_versjonar(dokument_id);

-- Eigendefinerte kolonnar i DTM-matrisa, same mønster som case_columns/note_columns.
CREATE TABLE IF NOT EXISTS dtm_columns (
  id          BIGINT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id  BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  label       TEXT NOT NULL,
  art         TEXT DEFAULT 'tekst',
  val_liste   JSONB,  -- valfri: fast verdiliste (nedtrekksmeny) i staden for fritekst
  sortering   INT  DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dtm_columns_project ON dtm_columns(project_id);

ALTER TABLE dtm_dokumenter ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dtm_dokumenter_select" ON dtm_dokumenter;
DROP POLICY IF EXISTS "dtm_dokumenter_insert" ON dtm_dokumenter;
DROP POLICY IF EXISTS "dtm_dokumenter_update" ON dtm_dokumenter;
DROP POLICY IF EXISTS "dtm_dokumenter_delete" ON dtm_dokumenter;
CREATE POLICY "dtm_dokumenter_select" ON dtm_dokumenter FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "dtm_dokumenter_insert" ON dtm_dokumenter FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dtm_dokumenter_update" ON dtm_dokumenter FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "dtm_dokumenter_delete" ON dtm_dokumenter FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE dtm_versjonar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dtm_versjonar_select" ON dtm_versjonar;
DROP POLICY IF EXISTS "dtm_versjonar_insert" ON dtm_versjonar;
DROP POLICY IF EXISTS "dtm_versjonar_update" ON dtm_versjonar;
DROP POLICY IF EXISTS "dtm_versjonar_delete" ON dtm_versjonar;
CREATE POLICY "dtm_versjonar_select" ON dtm_versjonar FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "dtm_versjonar_insert" ON dtm_versjonar FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dtm_versjonar_update" ON dtm_versjonar FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "dtm_versjonar_delete" ON dtm_versjonar FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE dtm_columns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dtm_columns_select" ON dtm_columns;
DROP POLICY IF EXISTS "dtm_columns_insert" ON dtm_columns;
DROP POLICY IF EXISTS "dtm_columns_update" ON dtm_columns;
DROP POLICY IF EXISTS "dtm_columns_delete" ON dtm_columns;
CREATE POLICY "dtm_columns_select" ON dtm_columns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "dtm_columns_insert" ON dtm_columns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dtm_columns_update" ON dtm_columns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "dtm_columns_delete" ON dtm_columns FOR DELETE USING (auth.uid() = user_id);
