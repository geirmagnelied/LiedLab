-- ═══════════════════════════════════════════════════════════
-- Fix: "updated_at column of projects not found in schema cache"
-- Køyr dette i Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Trygt å køyre fleire gonger.
--
-- Årsak: supabase-schema.sql brukte CREATE TABLE IF NOT EXISTS for
-- projects. Sidan tabellen alt fanst frå før (oppretta tidlegare, utan
-- updated_at), vart aldri kolonnen lagt til — CREATE TABLE IF NOT EXISTS
-- endrar ikkje ein eksisterande tabell. Difor har lagring av
-- prosjektkort og statusendring i Prosjekt-modulen feila heile tida med
-- "Could not find the updated_at column of projects in the schema cache".
-- ═══════════════════════════════════════════════════════════

ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Verifiser at kolonnen no finst
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'projects'
ORDER BY ordinal_position;
