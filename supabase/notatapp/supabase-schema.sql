-- ═══════════════════════════════════════════════════════════
-- LiedLab Notatapp — Supabase databaseskjema
-- Køyr dette i Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Prosjekt
CREATE TABLE IF NOT EXISTS projects (
  id          BIGINT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  favorite    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ
);

-- Notatar
CREATE TABLE IF NOT EXISTS notes (
  id              BIGINT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT DEFAULT '',
  text            TEXT DEFAULT '',
  html            TEXT DEFAULT '',
  tasks           JSONB DEFAULT '[]',
  tag             TEXT,
  project_id      BIGINT REFERENCES projects(id) ON DELETE SET NULL,
  is_email        BOOLEAN DEFAULT FALSE,
  sketch_data_url TEXT,
  done            BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ
);

-- Indeksar for raskare spørjingar
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user    ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_project ON notes(project_id);

-- ── Row Level Security (RLS) ────────────────────────────────
-- Brukarar kan berre sjå og endre sine eigne data

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes    ENABLE ROW LEVEL SECURITY;

-- Projects policies
CREATE POLICY "Brukar ser eigne prosjekt"
  ON projects FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Brukar oppretter eigne prosjekt"
  ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Brukar oppdaterer eigne prosjekt"
  ON projects FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Brukar slettar eigne prosjekt"
  ON projects FOR DELETE USING (auth.uid() = user_id);

-- Notes policies
CREATE POLICY "Brukar ser eigne notatar"
  ON notes FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Brukar oppretter eigne notatar"
  ON notes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Brukar oppdaterer eigne notatar"
  ON notes FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Brukar slettar eigne notatar"
  ON notes FOR DELETE USING (auth.uid() = user_id);
