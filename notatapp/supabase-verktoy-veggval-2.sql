-- 13. nov. 2026. Utviding av `verktoy_veggval`: løpenummer per prosjekt (ID 01, 02 …), brukaren sine krav per vegg og endring av eksisterande rader.
-- Køyrast manuelt i Supabase SQL Editor (etter supabase-verktoy-veggval.sql).
alter table public.verktoy_veggval add column if not exists lopenr integer;
alter table public.verktoy_veggval add column if not exists prosjektkrav jsonb not null default '{}'::jsonb;

-- Gje eksisterande rader løpenummer per prosjekt (eldste fyrst)
update public.verktoy_veggval v set lopenr = s.rn
from (select id, row_number() over (partition by project_id order by created_at, id) as rn from public.verktoy_veggval) s
where v.id = s.id and v.lopenr is null;

-- Alle med tilgang til prosjektet kan endre krav, rom og merknad
create policy verktoy_veggval_update on public.verktoy_veggval for update to authenticated
  using (public.kan_se_prosjekt(project_id)) with check (public.kan_se_prosjekt(project_id));
-- Rollback: drop policy verktoy_veggval_update on public.verktoy_veggval; alter table public.verktoy_veggval drop column lopenr, drop column prosjektkrav;
