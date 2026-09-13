-- ═══════════════════════════════════════════════════════════
-- Kvalitetsmodul — legg til «fase»-kolonne på teikningsregisteret
-- Køyr dette i Supabase SQL Editor. Trygt å køyre fleire gonger.
--
-- Fasa (Skisseprosjekt/Forprosjekt/Tilbodsteikning/Søknadsteikning/
-- Detaljprosjekt) vert gjetta automatisk frå fase-kodeleddet i
-- teikningsnummeret (…-NN) når ei teikning vert skanna, og kan
-- alltid rettast for hand i registeret.
-- ═══════════════════════════════════════════════════════════

ALTER TABLE ks_teikningar ADD COLUMN IF NOT EXISTS fase TEXT DEFAULT '';
