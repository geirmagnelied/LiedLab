-- 26. okt. 2026: løpenummer (O-nummer) på Kanban-kort/oppgåver, per prosjekt. Køyrt via Supabase MCP.
ALTER TABLE kanban_kort ADD COLUMN IF NOT EXISTS nummer INT;
UPDATE kanban_kort k SET nummer = s.rn FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY id) rn FROM kanban_kort) s WHERE k.id = s.id AND k.nummer IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_kanban_kort_nummer ON kanban_kort(project_id, nummer) WHERE nummer IS NOT NULL;
