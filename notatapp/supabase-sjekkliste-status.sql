-- Sjekkliste (2. nov. 2026): tre val per punkt + «sjekkliste utfylt» per dokument. Migrasjon `ks_sjekkliste_status`, køyrd i Supabase.
alter table public.ks_kontroll_svar add column if not exists status text check (status in ('kontrollert','ikkje_relevant','neste_fase'));
update public.ks_kontroll_svar set status = 'kontrollert' where avkrossa and status is null;
alter table public.dtm_dokumenter add column if not exists sjekkliste_utfylt jsonb not null default '{}'::jsonb;
