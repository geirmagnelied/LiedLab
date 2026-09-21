-- ═══════════════════════════════════════════════════════════════════
--  Notatnummer — gjer om frå global (per brukar) til løpande PER
--  PROSJEKT. Sjå useStore.js (nextNoteNumber) — notatnummer vert no
--  rekna ut som høgste eksisterande nr blant notat i SAME prosjekt + 1,
--  i staden for høgste blant ALLE notat til brukaren. Det betyr at
--  notat i ulike prosjekt kan ha same nr — det er meint slik.
--
--  Det gamle unike indekset (user_id, nr) tillet ikkje det (ville gjeve
--  ein constraint-feil straks to ulike prosjekt fekk same nr), så det
--  vert bytt ut med eit indeks som også tek med project_id.
--
--  Merk: eksisterande notat vert IKKJE nummererte om att — dei har
--  framleis sine gamle (globale) nr-verdiar. Berre NYE notat frå no av
--  følgjer den nye, per-prosjekt-baserte nummereringa.
--
--  Trygg å køyre fleire gongar (idempotent).
-- ═══════════════════════════════════════════════════════════════════

drop index if exists notes_user_nr_idx;

create unique index if not exists notes_user_project_nr_idx
  on notes(user_id, project_id, nr) where nr is not null;
