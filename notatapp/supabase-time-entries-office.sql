-- 29. okt. 2026: Timelista er spesifikk for kvart kontor.
-- Eksisterande rader fekk kontor frå prosjektet; 7 rader utan prosjekt vart lagt til Norconsult.
alter table public.time_entries add column if not exists office_id bigint references public.offices(id) on delete set null;
update public.time_entries te set office_id = p.office_id from public.projects p where te.project_id = p.id and te.office_id is null;
update public.time_entries set office_id = 1783669931063 where office_id is null;
create index if not exists time_entries_office_idx on public.time_entries (user_id, office_id, date);
