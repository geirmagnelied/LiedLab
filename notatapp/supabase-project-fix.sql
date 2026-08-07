-- ═══════════════════════════════════════════════════════════
-- Fix: sikre at alle nødvendige kolonnar finst på projects
-- Køyr dette i Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Trygt å køyre fleire gonger — bruker IF NOT EXISTS overalt
-- ═══════════════════════════════════════════════════════════

ALTER TABLE projects ADD COLUMN IF NOT EXISTS type            TEXT DEFAULT 'work';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS office_id       BIGINT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_number  TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_status  TEXT DEFAULT 'tilbod';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS details         JSONB DEFAULT '{}';

-- Søppelbøtte for slett prosjekt (30 dagar før endeleg fjerning)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at      TIMESTAMPTZ;

-- Sikre at det ikkje finst ein streng CHECK-constraint på gamle statusverdiar
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_project_status_check;

-- Indeks for raskare filtrering på kontor og status
CREATE INDEX IF NOT EXISTS idx_projects_office  ON projects(office_id);
CREATE INDEX IF NOT EXISTS idx_projects_status  ON projects(project_status);
CREATE INDEX IF NOT EXISTS idx_projects_deleted ON projects(deleted_at);

-- Verifiser resultatet — sjekk at alle kolonnar no finst
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'projects'
ORDER BY ordinal_position;
