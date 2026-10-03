# Søk på tvers av modular (29. sept. 2026)

## Arkitektur

Éin delt Postgres-tabell `sok_index` (sjå `supabase-sok-index.sql`), IKKJE ei
live UNION-spørjing over kjeldetabellane ved kvart søk. Kvar kjeldetabell
(`notes`, `cases`, `dtm_dokumenter` — fleire kjem, sjå under) har sin eigen
`AFTER INSERT OR UPDATE OR DELETE`-trigger som held `sok_index` oppdatert
automatisk. Éi eiga søkjefunksjon (`sok(q, p_project_id, p_kjelder)`, RPC)
brukar Postgres sin innebygde fulltekstsøk (`to_tsvector('norwegian', …)`,
GIN-indeks, `websearch_to_tsquery` for tolerant tolking av vanleg
brukarinput). Vald FRAMFOR Elasticsearch/ein ekstern søkjemotor — unødig
driftskompleksitet for eit lite kontor sitt dokumentvolum, sjå tilrådinga
gjeve 29. sept. 2026.

Ny kjeldetabell (t.d. framtidige `ks_teikningar` eller `bilete`) treng berre:
1. Ein ny trigger-funksjon (kopier `sok_index_notes()`-mønsteret).
2. Ein `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` på tabellen.
3. Ein eingongs-backfill (`INSERT ... SELECT ... ON CONFLICT DO NOTHING`).

Ingenting i `SokeFelt.jsx` eller RPC-en treng endrast.

## Frontend — `SokeFelt.jsx`

Delt, gjenbrukbar komponent (input + nedtrekks-resultatliste), kalla med
`projectId`, `kjelder` (avgrensar til éin/fleire `kjelde_tabell`-verdiar) og
`onVelgResultat(r)`. Komponenten er REINT UI — kvar modul avgjer sjølv kva
eit treff skal gjere, sidan kvar modul alt har sin eigen «opne dette»-logikk
(DTMModule sin `opneFil()`, SakerModule sin `setOpenCaseId()`, App.jsx sin
`handleEdit()` for notat) som ikkje skal duplisersat.

**Plassering**: same mønster i alle modular — ei eiga rad rett under modulen
sin topbar/header, søkjefeltet lengst til venstre (brukar sitt eige krav).
Bygd inn i: DTM (`DTMModule.jsx`, søkjer `dtm_dokumenter`), Saker
(`SakerModule.jsx`, søkjer `cases`), Notat (`App.jsx`, søkjer `notes`, BÅDE
mobil- og skrivebordslayouten). **Ikkje bygd inn enno** i Kvalitetssystem
(Teikningar-fana brukar ks_teikningar, som ikkje har nokon trigger enno),
Timar, Kalender, Farge, Kunde, Oppgåver — same mønster kan leggjast til
raskt når/viss ønskt.

## Prosjektsøk i TopBar

SEPARAT frå `sok_index`/`SokeFelt` — reint klientside-filter over den alt
innlasta `projects`-lista (ingen database-tur, sidan prosjektlista uansett
alt er lasta). `TopBar.jsx` sin `ProsjektVelger`-komponent bytte ut den
gamle `<select>`-nedtrekksmenyen med eit søkbart kombinasjonsfelt (skriv
for å filtrere, klikk for å velje).

## Ikkje bygd enno

- AI-generert samandrag av eksterne dokument (sjå diskusjonen 29. sept.
  2026) ville gjeve MYKJE rikare `samandrag`/`sok_tekst`-innhald for
  `dtm_dokumenter`-rader enn berre metadata-felta — eit naturleg neste steg
  når AI-indekseringssteget (`ai_indeksering_onska`-flagget) får sin
  faktiske API-kode.
- `ks_teikningar` (Kvalitetsmodulen sitt eige register) har ingen trigger
  enno.
