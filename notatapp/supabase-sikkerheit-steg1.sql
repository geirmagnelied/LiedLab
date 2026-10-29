-- Sikkerheit steg 1 (28. okt. 2026): herding av LiedLab-funksjonar. Rører IKKJE bg_*-funksjonane (anna app i same prosjekt).
-- Backup av tabellar, policyar og funksjonar ligg i skjemaet backup_20261028 (utan tilgang for anon/authenticated).
ALTER FUNCTION public.is_office_member(bigint)  SET search_path = public, pg_temp;
ALTER FUNCTION public.is_office_admin(bigint)   SET search_path = public, pg_temp;
ALTER FUNCTION public.sok(text, bigint, text[]) SET search_path = public, pg_temp;
ALTER FUNCTION public.sok_index_notes()          SET search_path = public, pg_temp;
ALTER FUNCTION public.sok_index_cases()          SET search_path = public, pg_temp;
ALTER FUNCTION public.sok_index_dtm_dokumenter() SET search_path = public, pg_temp;
-- ikkje-innlogga skal ikkje kunne kalle desse via /rest/v1/rpc
REVOKE EXECUTE ON FUNCTION public.is_office_member(bigint), public.is_office_admin(bigint) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sok_index_notes(), public.sok_index_cases(), public.sok_index_dtm_dokumenter() FROM PUBLIC, anon, authenticated; -- trigger-funksjonar, treng ikkje EXECUTE
-- ROLLBACK:
-- ALTER FUNCTION ... RESET search_path; GRANT EXECUTE ON FUNCTION ... TO PUBLIC;

-- STEG 2 (28. okt. 2026): Vedlegg-bøtta privat, les berre eigne filer (mellomløysing til prosjekt-tilgang)
-- UPDATE storage.buckets SET public = false WHERE id = 'Vedlegg';
-- DROP POLICY auth_read ON storage.objects;
-- CREATE POLICY vedlegg_les_eigne ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'Vedlegg' AND owner_id = auth.uid()::text);
-- ROLLBACK: UPDATE storage.buckets SET public = true WHERE id = 'Vedlegg'; DROP POLICY vedlegg_les_eigne ON storage.objects; CREATE POLICY auth_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'Vedlegg');

-- STEG 3 (28. okt. 2026): kontor-medlemskap herda (migrasjon «sikkerheit_steg3_kontor_medlemskap» + opprydding)
--  * offices.er_privat (Privat = true): berre skaparen kan vere medlem (trigger office_members_privat)
--  * is_office_admin: berre aktivt administrator-medlemskap — eigar-unntaket via offices.user_id er fjerna
--  * offices: select via is_office_member, update/delete via is_office_admin, insert krev user_id = auth.uid(); skaparen vert admin (trigger offices_ny_admin)
--  * office_members: medlem kan ikkje lenger endre si eiga rad (members_update berre admin); members_select brukar auth.jwt()->>'email' (auth.users-subspørjinga gav «permission denied»)
--  * siste aktive administrator kan ikkje fjernast/nedgraderast (trigger office_members_siste_admin)
--  * office_members.office_id fekk FK med ON DELETE CASCADE (ingen foreldrelause medlemsrader)
--  * konto geir.magne.lied@norconsult.com sletta (0 prosjekt, 1 testnotat)
-- ROLLBACK: gjenopprett policyar/funksjonar frå backup_20261028._policies og backup_20261028._funksjonar.

-- ═══ STEG 4 (29. okt. 2026): project_members + kan_se_prosjekt() — ingen eksisterande policy er endra ═══
-- Migrasjon `sikkerheit_steg4_project_members`: tabell project_members (PK project_id+user_id, RLS på),
-- funksjonane kan_se_prosjekt(pid), prosjekt_kontor(pid), kan_handtere_prosjekt(pid) (medlem ELLER kontoradmin; gjev berre
-- rett til medlemslista, ikkje innhaldet) og kan_leggast_til(pid, uid) (må vere aktiv medlem av prosjektets kontor).
-- Policyar: select (eiga rad eller kan_handtere), insert (kan_handtere + kan_leggast_til + lagt_til_av = auth.uid()), delete (eiga rad eller kan_handtere).
-- Trigger trg_prosjekt_ny_medlem: den som lagar eit prosjekt vert automatisk medlem. Utrulling: eigar av kvart eksisterande prosjekt (28 rader).
-- Rollback: drop trigger trg_prosjekt_ny_medlem on projects; drop table project_members; drop function kan_leggast_til, kan_handtere_prosjekt, prosjekt_kontor, kan_se_prosjekt;
