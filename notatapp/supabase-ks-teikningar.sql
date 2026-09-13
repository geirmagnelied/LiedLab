-- ═══════════════════════════════════════════════════════════
-- Kvalitetsmodul — teikningsregister (Del A)
-- Køyr dette i Supabase SQL Editor. Trygt å køyre fleire gonger.
--
-- Erstattar den hardkoda eksempel-lista i KvalitetModule.jsx med eit
-- ekte register per prosjekt. Fylt av Kvalitetsmodulen når arkitekten
-- dreg inn teikningar/dokument — appen flyttar filene til
-- «<resultatDokSti>/kontroll/til kontroll/», skannar filnamn + PDF-
-- innhald (tittelfelt), og lagrar éi rad her per fil.
--
-- Merk: ks_kontrollar/sjekklister (leveransekontroll-arbeidsflyten) er
-- ikkje del av denne omgangen (Del B, seinare) — dei ligg framleis
-- berre i skjermbiletet si eiga tilstand og forsvinn ved omlasting.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ks_teikningar (
  id          BIGINT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id  BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  nr          TEXT NOT NULL,
  rev         TEXT NOT NULL DEFAULT 'A',
  tittel      TEXT DEFAULT '',
  fag         TEXT DEFAULT '',   -- Plan / Snitt / Fasade / Situasjonsplan / Detalj / Anna
  malestokk   TEXT DEFAULT '',
  teikna_av   TEXT DEFAULT '',
  ek_person   TEXT DEFAULT '',
  fk_person   TEXT DEFAULT '',
  dato        TEXT DEFAULT '',
  format      TEXT DEFAULT '',
  filnamn     TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ks_teikningar_user    ON ks_teikningar(user_id);
CREATE INDEX IF NOT EXISTS idx_ks_teikningar_project ON ks_teikningar(project_id);

ALTER TABLE ks_teikningar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Brukar ser eigne teikningar"      ON ks_teikningar;
DROP POLICY IF EXISTS "Brukar oppretter eigne teikningar" ON ks_teikningar;
DROP POLICY IF EXISTS "Brukar oppdaterer eigne teikningar" ON ks_teikningar;
DROP POLICY IF EXISTS "Brukar slettar eigne teikningar"   ON ks_teikningar;

CREATE POLICY "Brukar ser eigne teikningar"
  ON ks_teikningar FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Brukar oppretter eigne teikningar"
  ON ks_teikningar FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Brukar oppdaterer eigne teikningar"
  ON ks_teikningar FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Brukar slettar eigne teikningar"
  ON ks_teikningar FOR DELETE USING (auth.uid() = user_id);
