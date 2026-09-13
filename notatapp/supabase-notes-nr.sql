-- ═══════════════════════════════════════════════════════════════════
--  Notatnummer — permanent, unikt løpenummer per notat (per brukar)
--
--  Legg til kolonnen `nr` på `notes`, og etterutfyller eksisterande
--  rader (som ikkje har `nr` frå før) med eit løpenummer basert på
--  opprettingsdato, per brukar. Same mønster som saksnummer i
--  saksmodulen (SakerModule.jsx: nextCaseNumber), no lagra permanent
--  i staden for rekna ut på nytt kvar gong (som notatnummeret
--  opphavleg var — sjå NoteTabell.jsx / useStore.js).
--
--  Trygg å køyre fleire gongar (idempotent): kolonnen vert berre
--  lagt til om ho manglar, og berre rader utan `nr` vert etterutfylt.
-- ═══════════════════════════════════════════════════════════════════

alter table notes add column if not exists nr bigint;

with mangler as (
  select id, user_id, created_at,
         row_number() over (partition by user_id order by created_at asc, id asc) as rn
  from notes
  where nr is null
),
offset_pr_bruker as (
  select user_id, coalesce(max(nr), 0) as maks
  from notes
  group by user_id
)
update notes
set nr = mangler.rn + coalesce(offset_pr_bruker.maks, 0)
from mangler
left join offset_pr_bruker on offset_pr_bruker.user_id = mangler.user_id
where notes.id = mangler.id;

create unique index if not exists notes_user_nr_idx on notes(user_id, nr) where nr is not null;
