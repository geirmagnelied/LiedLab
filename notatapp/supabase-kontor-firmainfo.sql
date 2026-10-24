-- Firmainfo på kontoret (til Malar-modulen: ansvarleg søkjar) + telefon på brukarprofilen. 25. okt. 2026, køyrt via Supabase MCP.
ALTER TABLE offices ADD COLUMN IF NOT EXISTS org_nr TEXT DEFAULT '';
ALTER TABLE offices ADD COLUMN IF NOT EXISTS adresse TEXT DEFAULT '';
ALTER TABLE offices ADD COLUMN IF NOT EXISTS postnr TEXT DEFAULT '';
ALTER TABLE offices ADD COLUMN IF NOT EXISTS poststad TEXT DEFAULT '';
ALTER TABLE offices ADD COLUMN IF NOT EXISTS telefon TEXT DEFAULT '';
ALTER TABLE offices ADD COLUMN IF NOT EXISTS epost TEXT DEFAULT '';
ALTER TABLE brukar_profil ADD COLUMN IF NOT EXISTS telefon TEXT DEFAULT '';
