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
