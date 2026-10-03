-- ═══════════════════════════════════════════════════════════════════
--  sok_index — delt fulltekst-søkjeindeks på tvers av modular.
--  Sjå claude/sok-modul.md. Køyr i Supabase SQL Editor. Trygt å køyre
--  fleire gonger (triggerfunksjonane er CREATE OR REPLACE, backfillen
--  brukar ON CONFLICT DO NOTHING).
--
--  Arkitektur (brukar sitt eige val 29. sept. 2026, etter tilråding):
--  éin DELT tabell, IKKJE ei live UNION-spørjing på tvers av kjeldetabellar
--  ved kvart søk. Kvar kjeldetabell (notes/cases/dtm_dokumenter) har sin
--  eigen AFTER-trigger som held sok_index oppdatert automatisk ved
--  INSERT/UPDATE/DELETE. Nye kjeldetabellar (t.d. framtidige bilete/
--  ks_teikningar) kan leggjast til seinare med same mønster, utan å røre
--  søkjekoden i klienten.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sok_index (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id        UUID NOT NULL,
  project_id     BIGINT,
  kjelde_tabell  TEXT NOT NULL,   -- 'notes' | 'cases' | 'dtm_dokumenter' (fleire kjem)
  kjelde_id      BIGINT NOT NULL,
  tittel         TEXT NOT NULL DEFAULT '',
  samandrag      TEXT DEFAULT '', -- kort utdrag vist i søkjeresultat-lista
  sok_tekst      TSVECTOR,        -- norsk tekstsøk, sjå to_tsvector('norwegian', ...)
  oppdatert_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (kjelde_tabell, kjelde_id)
);
CREATE INDEX IF NOT EXISTS idx_sok_index_tsv ON sok_index USING GIN (sok_tekst);
CREATE INDEX IF NOT EXISTS idx_sok_index_project ON sok_index(project_id);
CREATE INDEX IF NOT EXISTS idx_sok_index_user ON sok_index(user_id);

ALTER TABLE sok_index ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sok_index_select" ON sok_index;
CREATE POLICY "sok_index_select" ON sok_index FOR SELECT USING (auth.uid() = user_id);

-- ── Trigger: notes ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sok_index_notes() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM sok_index WHERE kjelde_tabell = 'notes' AND kjelde_id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO sok_index (user_id, project_id, kjelde_tabell, kjelde_id, tittel, samandrag, sok_tekst, oppdatert_at)
  VALUES (
    NEW.user_id, NEW.project_id, 'notes', NEW.id,
    COALESCE(NEW.title, ''), left(COALESCE(NEW.text, ''), 300),
    to_tsvector('norwegian', COALESCE(NEW.title,'') || ' ' || COALESCE(NEW.text,'')),
    NOW()
  )
  ON CONFLICT (kjelde_tabell, kjelde_id) DO UPDATE SET
    user_id = EXCLUDED.user_id, project_id = EXCLUDED.project_id,
    tittel = EXCLUDED.tittel, samandrag = EXCLUDED.samandrag,
    sok_tekst = EXCLUDED.sok_tekst, oppdatert_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sok_index_notes ON notes;
CREATE TRIGGER trg_sok_index_notes AFTER INSERT OR UPDATE OR DELETE ON notes
  FOR EACH ROW EXECUTE FUNCTION sok_index_notes();

-- ── Trigger: cases (Saker-modulen) ──────────────────────────────────
CREATE OR REPLACE FUNCTION sok_index_cases() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM sok_index WHERE kjelde_tabell = 'cases' AND kjelde_id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO sok_index (user_id, project_id, kjelde_tabell, kjelde_id, tittel, samandrag, sok_tekst, oppdatert_at)
  VALUES (
    NEW.user_id, NEW.project_id, 'cases', NEW.id,
    trim(concat_ws(' ', NEW.number, NEW.title)), left(COALESCE(NEW.description,''), 300),
    to_tsvector('norwegian', concat_ws(' ', NEW.number, NEW.title, NEW.description, NEW.ansvarlig)),
    NOW()
  )
  ON CONFLICT (kjelde_tabell, kjelde_id) DO UPDATE SET
    user_id = EXCLUDED.user_id, project_id = EXCLUDED.project_id,
    tittel = EXCLUDED.tittel, samandrag = EXCLUDED.samandrag,
    sok_tekst = EXCLUDED.sok_tekst, oppdatert_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sok_index_cases ON cases;
CREATE TRIGGER trg_sok_index_cases AFTER INSERT OR UPDATE OR DELETE ON cases
  FOR EACH ROW EXECUTE FUNCTION sok_index_cases();

-- ── Trigger: dtm_dokumenter (DTM-modulen, alle kategoriar) ──────────
CREATE OR REPLACE FUNCTION sok_index_dtm_dokumenter() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM sok_index WHERE kjelde_tabell = 'dtm_dokumenter' AND kjelde_id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO sok_index (user_id, project_id, kjelde_tabell, kjelde_id, tittel, samandrag, sok_tekst, oppdatert_at)
  VALUES (
    NEW.user_id, NEW.project_id, 'dtm_dokumenter', NEW.id,
    COALESCE(NEW.tittel, NEW.nr, ''), trim(concat_ws(' — ', NEW.nr, NEW.tittel)),
    to_tsvector('norwegian', concat_ws(' ', NEW.nr, NEW.tittel, NEW.fag, NEW.fase, NEW.delprosjekt,
      NEW.oppdragsgivar, NEW.tiltakshavar, NEW.revisjonsbeskriving, NEW.tegningsformal,
      NEW.ekstern_kategori, NEW.utarbeida_av, NEW.fk_person, NEW.godkjent_av, NEW.oppdragsnr)),
    NOW()
  )
  ON CONFLICT (kjelde_tabell, kjelde_id) DO UPDATE SET
    user_id = EXCLUDED.user_id, project_id = EXCLUDED.project_id,
    tittel = EXCLUDED.tittel, samandrag = EXCLUDED.samandrag,
    sok_tekst = EXCLUDED.sok_tekst, oppdatert_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sok_index_dtm ON dtm_dokumenter;
CREATE TRIGGER trg_sok_index_dtm AFTER INSERT OR UPDATE OR DELETE ON dtm_dokumenter
  FOR EACH ROW EXECUTE FUNCTION sok_index_dtm_dokumenter();

-- ── Sjølve søkjefunksjonen (RPC, kalla frå klienten via supabase.rpc('sok', ...)) ──
-- websearch_to_tsquery tolkar vanleg brukarinput (fleire ord, "frasar i
-- hermeteikn", -utelating) mykje meir tolerant enn plainto_tsquery.
CREATE OR REPLACE FUNCTION sok(q TEXT, p_project_id BIGINT DEFAULT NULL, p_kjelder TEXT[] DEFAULT NULL)
RETURNS TABLE(kjelde_tabell TEXT, kjelde_id BIGINT, project_id BIGINT, tittel TEXT, samandrag TEXT, rangering REAL)
LANGUAGE sql STABLE AS $$
  SELECT s.kjelde_tabell, s.kjelde_id, s.project_id, s.tittel, s.samandrag,
    ts_rank(s.sok_tekst, websearch_to_tsquery('norwegian', q)) AS rangering
  FROM sok_index s
  WHERE s.user_id = auth.uid()
    AND s.sok_tekst @@ websearch_to_tsquery('norwegian', q)
    AND (p_project_id IS NULL OR s.project_id = p_project_id)
    AND (p_kjelder IS NULL OR s.kjelde_tabell = ANY(p_kjelder))
  ORDER BY rangering DESC
  LIMIT 30;
$$;

-- ── Éin gong: fyll inn eksisterande rader (triggeren fangar berre framtidige) ──
INSERT INTO sok_index (user_id, project_id, kjelde_tabell, kjelde_id, tittel, samandrag, sok_tekst, oppdatert_at)
SELECT user_id, project_id, 'notes', id, COALESCE(title,''), left(COALESCE(text,''),300),
  to_tsvector('norwegian', COALESCE(title,'')||' '||COALESCE(text,'')), NOW()
FROM notes
ON CONFLICT (kjelde_tabell, kjelde_id) DO NOTHING;

INSERT INTO sok_index (user_id, project_id, kjelde_tabell, kjelde_id, tittel, samandrag, sok_tekst, oppdatert_at)
SELECT user_id, project_id, 'cases', id, trim(concat_ws(' ', number, title)), left(COALESCE(description,''),300),
  to_tsvector('norwegian', concat_ws(' ', number, title, description, ansvarlig)), NOW()
FROM cases
ON CONFLICT (kjelde_tabell, kjelde_id) DO NOTHING;

INSERT INTO sok_index (user_id, project_id, kjelde_tabell, kjelde_id, tittel, samandrag, sok_tekst, oppdatert_at)
SELECT user_id, project_id, 'dtm_dokumenter', id, COALESCE(tittel, nr, ''), trim(concat_ws(' — ', nr, tittel)),
  to_tsvector('norwegian', concat_ws(' ', nr, tittel, fag, fase, delprosjekt, oppdragsgivar, tiltakshavar,
    revisjonsbeskriving, tegningsformal, ekstern_kategori, utarbeida_av, fk_person, godkjent_av, oppdragsnr)), NOW()
FROM dtm_dokumenter
ON CONFLICT (kjelde_tabell, kjelde_id) DO NOTHING;
