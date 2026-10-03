-- ═══════════════════════════════════════════════════════════════════
--  KS — kontroll av teikningar (egenkontroll/fagkontroll/godkjenning).
--  Bygd oppå DTM sine «kontrolldokument»-rader (dtm_dokumenter), IKKJE
--  eit nytt, parallelt dokumentregister — sjå claude/dtm-modul.md og
--  claude/kvalitetsmodul-teikningar.md («Del B»). Køyr i Supabase
--  SQL Editor. Trygt å køyre fleire gonger.
-- ═══════════════════════════════════════════════════════════════════

-- Kvart dokument sin plass i kontrollflyten. NULL/«ikkje_starta» = ikkje
-- teke inn i nokon kontroll enno. Éin kolonne held styr på HEILE flyten
-- (i staden for tre separate boolean-flagg) sidan stega er strengt
-- sekvensielle — eit dokument kan berre vere ETT stad i køen om gongen.
ALTER TABLE dtm_dokumenter ADD COLUMN IF NOT EXISTS kontrollstatus TEXT NOT NULL DEFAULT 'ikkje_starta';
-- Moglege verdiar (handheva i appen, ikkje via CHECK-constraint — same
-- mønster som status TEXT[] elles i denne tabellen):
--   ikkje_starta | egenkontroll_pagaende | klar_fagkontroll |
--   fagkontroll_pagaende | klar_godkjenning | godkjenning_pagaende | godkjent

-- Sjølve sjekklistesvara — éi rad per (dokument, kontrolltype, sjekkpunkt).
-- `sjekkpunkt_id` er IDen frå tegningskontroll.json (t.d. «P003», «TF01»),
-- unik på tvers av ALLE sjekklistetypar (stadfesta i konverteringsskriptet),
-- så ingen eigen kolonne for kva ark/type han høyrer til er nødvendig.
CREATE TABLE IF NOT EXISTS ks_kontroll_svar (
  id             BIGINT PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dokument_id    BIGINT NOT NULL REFERENCES dtm_dokumenter(id) ON DELETE CASCADE,
  kontrolltype   TEXT NOT NULL,  -- 'egenkontroll' | 'fagkontroll' | 'godkjenning'
  sjekkpunkt_id  TEXT NOT NULL,
  avkrossa       BOOLEAN NOT NULL DEFAULT false,
  merknad        TEXT DEFAULT '',
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (dokument_id, kontrolltype, sjekkpunkt_id)
);
CREATE INDEX IF NOT EXISTS idx_ks_kontroll_svar_dokument ON ks_kontroll_svar(dokument_id);

-- Enkel kontaktliste (namn + initialar + e-post) — brukt til å slå opp
-- e-postadressa til den som skal utføre fagkontroll/godkjenning når eit
-- steg vert ferdigstilt (sjå punkt 7). «initialar» er nøkkelen som vert
-- samanlikna mot dei eksisterande fk_person/godkjent_av/utarbeida_av-
-- felta i dtm_dokumenter, som framleis er fritekst-initialar (t.d. «GML»)
-- — IKKJE ei ny, obligatorisk personliste for heile appen.
CREATE TABLE IF NOT EXISTS kontaktar (
  id          BIGINT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  namn        TEXT NOT NULL,
  initialar   TEXT NOT NULL,
  epost       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kontaktar_initialar ON kontaktar(user_id, initialar);

ALTER TABLE ks_kontroll_svar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ks_kontroll_svar_select" ON ks_kontroll_svar;
DROP POLICY IF EXISTS "ks_kontroll_svar_insert" ON ks_kontroll_svar;
DROP POLICY IF EXISTS "ks_kontroll_svar_update" ON ks_kontroll_svar;
DROP POLICY IF EXISTS "ks_kontroll_svar_delete" ON ks_kontroll_svar;
CREATE POLICY "ks_kontroll_svar_select" ON ks_kontroll_svar FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ks_kontroll_svar_insert" ON ks_kontroll_svar FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ks_kontroll_svar_update" ON ks_kontroll_svar FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ks_kontroll_svar_delete" ON ks_kontroll_svar FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE kontaktar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kontaktar_select" ON kontaktar;
DROP POLICY IF EXISTS "kontaktar_insert" ON kontaktar;
DROP POLICY IF EXISTS "kontaktar_update" ON kontaktar;
DROP POLICY IF EXISTS "kontaktar_delete" ON kontaktar;
CREATE POLICY "kontaktar_select" ON kontaktar FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kontaktar_insert" ON kontaktar FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kontaktar_update" ON kontaktar FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "kontaktar_delete" ON kontaktar FOR DELETE USING (auth.uid() = user_id);
