-- Legg til type-kolonne på projects (work/private)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'work';
