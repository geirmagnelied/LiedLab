-- ═══════════════════════════════════════════════════════════════════
--  Notat-tabellen — «favoritt» og «fest til toppen» (radmeny, DataTabell)
--  Køyr dette i Supabase SQL Editor. Trygt å køyre fleire gonger.
-- ═══════════════════════════════════════════════════════════════════

alter table notes add column if not exists favorite boolean not null default false;
alter table notes add column if not exists pinned   boolean not null default false;
