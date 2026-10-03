-- ═══════════════════════════════════════════════════════════════════
--  DTM — skyopplasting av resultatdokument (1. okt. 2026), sjå
--  claude/dtm-modul.md. Køyr i Supabase SQL Editor. Trygt å køyre fleire
--  gonger.
--
--  Siste versjon av KVART resultatdokument vert lasta opp (OVERSKRIVEN —
--  ingen revisjonshistorikk i skya, berre siste versjon er tilgjengeleg
--  derifrå) til denne private bøtta, men BERRE for prosjekt der det nye
--  valet «Skyopplasting» (projects.details.skyOpplastingResultatdokument)
--  er slått på i Prosjekt-modulen — brukar sitt eige krav 1. okt. 2026 om
--  at dette IKKJE skal vere automatisk for alle prosjekt. Sti i bøtta:
--  <user_id>/<project_id>/<dokumentnummer>.<filtype>.
--
--  Same mønster som bilete-mobil-bøtta i supabase-bilete.sql: privat
--  bucket, RLS avgrensa til brukaren sin eigen mappe i bøtta.
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('dtm-resultatdokument', 'dtm-resultatdokument', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "dtm_resultatdokument_storage_all" ON storage.objects;
CREATE POLICY "dtm_resultatdokument_storage_all" ON storage.objects FOR ALL
  USING (bucket_id = 'dtm-resultatdokument' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'dtm-resultatdokument' AND (storage.foldername(name))[1] = auth.uid()::text);
