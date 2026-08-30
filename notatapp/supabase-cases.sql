-- ═══════════════════════════════════════════════════════════
-- Saksregister — Supabase-tabellar for S-modulen
-- Køyr dette i Supabase SQL Editor. Trygt å køyre fleire gonger.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cases (
  id            BIGINT PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id    BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  number        TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT DEFAULT '',
  fag           TEXT DEFAULT 'ARK',
  type          TEXT DEFAULT 'Sporsmal',
  status        TEXT DEFAULT 'ny',
  prioritet     TEXT DEFAULT 'normal',
  ansvarlig     TEXT DEFAULT '',
  frist         DATE,
  tegning       TEXT DEFAULT '',
  linked_notes  JSONB DEFAULT '[]',
  linked_tasks  JSONB DEFAULT '[]',
  attachments   JSONB DEFAULT '[]',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  created_by    TEXT,
  updated_at    TIMESTAMPTZ,
  deleted_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS case_comments (
  id          BIGINT PRIMARY KEY,
  case_id     BIGINT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author      TEXT,
  text        TEXT,
  system      BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cases_project     ON cases(project_id);
CREATE INDEX IF NOT EXISTS idx_cases_status       ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_deleted      ON cases(deleted_at);
CREATE INDEX IF NOT EXISTS idx_case_comments_case ON case_comments(case_id);

-- Nytt felt: eigendefinerte kolonnar i saksmatrisa.
-- Verdiane til kolonnar brukaren lagar sjølv ("Ny kolonne..." i tabellmenyen)
-- vert lagra her som {"eigen_xxx": "verdi"} — trygt å køyre igjen.
ALTER TABLE cases ADD COLUMN IF NOT EXISTS ekstra JSONB DEFAULT '{}';

-- Nytt felt: fleire involverte personar (i tillegg til éin ansvarleg) — trygt å køyre igjen
ALTER TABLE cases ADD COLUMN IF NOT EXISTS involverte JSONB DEFAULT '[]';

-- Eigendefinerte kolonnar i saksmatrisa, per prosjekt.
-- Brukaren lagar dei med "Ny kolonne..." i nedtrekksmenyen i tabellen.
-- Definisjonen ligg her, verdiane i cases.ekstra.
CREATE TABLE IF NOT EXISTS case_columns (
  id          BIGINT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id  BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  label       TEXT NOT NULL,
  art         TEXT DEFAULT 'tekst',      -- 'tekst' | 'tal' | 'dato'
  sortering   INT  DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_case_columns_project ON case_columns(project_id);

ALTER TABLE case_columns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "case_columns_select" ON case_columns;
DROP POLICY IF EXISTS "case_columns_insert" ON case_columns;
DROP POLICY IF EXISTS "case_columns_update" ON case_columns;
DROP POLICY IF EXISTS "case_columns_delete" ON case_columns;
CREATE POLICY "case_columns_select" ON case_columns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "case_columns_insert" ON case_columns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "case_columns_update" ON case_columns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "case_columns_delete" ON case_columns FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cases_select" ON cases;
DROP POLICY IF EXISTS "cases_insert" ON cases;
DROP POLICY IF EXISTS "cases_update" ON cases;
DROP POLICY IF EXISTS "cases_delete" ON cases;
CREATE POLICY "cases_select" ON cases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cases_insert" ON cases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cases_update" ON cases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "cases_delete" ON cases FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE case_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "case_comments_select" ON case_comments;
DROP POLICY IF EXISTS "case_comments_insert" ON case_comments;
DROP POLICY IF EXISTS "case_comments_update" ON case_comments;
DROP POLICY IF EXISTS "case_comments_delete" ON case_comments;
CREATE POLICY "case_comments_select" ON case_comments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "case_comments_insert" ON case_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "case_comments_update" ON case_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "case_comments_delete" ON case_comments FOR DELETE USING (auth.uid() = user_id);
