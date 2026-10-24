# Kanban-modul — spesifikasjon (24. okt. 2026) — BYGD 24. okt. 2026 (sjå «Implementering» nedst)

Spesifisert i samtale med Geir Magne 23.–24. okt. 2026, før implementering i
Claude Code. Skal erstatte plasshaldaren i `OppgaveModule.jsx» («Oppgåvemodulen
med kanban-tavle, sjekkpunkt og fil-drop er under utvikling»), under paraplyen
**Gjeremål** (saman med Notatar og Saker — sjå `claude/appreil-struktur.md`).

## Kvifor eiga modul, ikkje del av Framdrift

Framdrift-modulen (`claude/framdrift-modul.md`) er prosjektleiaren sitt
plan-/økonomiverktøy: fase/aktivitet-Gantt, budsjett, timepris, bemanning —
dei same aktivitetane (t.d. «ARK detaljar», «ARK prosjektering») som folk
fører timane sine på. Kanban er noko anna: eit operativt, lettvekts
arbeidsflyt-verktøy for heile teamet — "kva skal eg gjere no", rask
delegering i møte. Dei to held fram **frikopla** i datamodell og i kva som
styrer kva (sjå eige avsnitt om lenkjer under) — nøyaktig fordi ein unngår
at éin ting må oppdaterast to stader for at tala skal stemme.

## Kolonner (arbeidsflyt, venstre til høgre)

| Kolonne | Tyding |
|---|---|
| **Idé** | Råe idear/problemstillingar, ikkje klare til å startast. (Var «Logg» i fyrste utkast — bytt namn og flytta fremst i flyten, sidan det er eit idé-steg, ikkje eit historikk-steg.) |
| **Komande oppgåver** | Avklart og klar til å takast fatt på. |
| **Under arbeid** | Pågår no. |
| **Til godkjenning internt** | Eigenkontroll/intern gjennomgang — speglar «egenkontroll»-omgrepet frå KS-modulen. |
| **Til godkjenning eksternt** | Ute til kunde/mynde/ekstern part — speglar «fagkontroll»/ekstern godkjenning. |
| **Ferdigstilt** | Fullført. |

## Ferdige kort hamnar i arkiv, ikkje open kolonne

Prosjekt varer ofte fleire år — ein open «Ferdigstilt»-kolonne ville vakse
seg uhandterleg og gå imot kravet om at tavla ikkje skal føles overveldande.
Gjenbruk **Aktive/Arkivert-fane-mønsteret** som alt finst i `NoteTabell.jsx`:
eit lite val over tavla, ikkje ein sjette alltid synleg kolonne. Arkivet bør
vere filtrerbart på dato/person/fase, for behovet om å sjå kva som vart
gjort tidlegare i eit langt prosjekt.

## WIP-grenser (visuelle, ikkje sperrande)

For å handtere mange samstundes pågåande kort utan at det føles tungt: ei
**visuell**, ikkje-blokkerande grense på tal kort per person/kolonne i
**Under arbeid** og dei to godkjenning-kolonnane (ikkje Idé/Komande
oppgåver/Ferdigstilt, som naturleg kan vere lengre). Talet vert raudt når
grensa er passert — same visuelle idé som overbelastningsvarselet i
Framdrift (raud ramme + tooltip), ikkje ei ny mekanikk å lære. Grensa bør
vere av/justerbar, ikkje fast frå dag éin.

## Fase som filter/merkelapp — ingen swimlanes ved lansering

Byrjar **flatt**: fase (skisse/forprosjekt/detalj, same `fasekode` 01–05
som Framdrift) er eit felt/merkelapp på kortet, filtrerbart — ikkje eigne
vassrette rader (swimlanes). Swimlanes kan leggjast til seinare om behovet
dukkar opp; lettare å leggje til kompleksitet enn å fjerne ho.

## Lenkjer til Sak/Oppgåve/Framdrift-aktivitet — referanse, aldri styrande

Eit kort kan **valfritt** lenkjast til éi eller fleire av:

- **Ei sak** (`saker`-tabellen) — enkel FK (`sak_id`).
- **Ei oppgåve** — MERK: oppgåver ligg som element i `notes.tasks`
  (JSONB-array), ikkje ein eigen tabell. Ei lenkje vert difor eit par
  (`note_id`, `task_id`), ikkje ein enkel FK.
- **Ein Framdrift-aktivitet** — MERK: aktivitetar ligg i `framdrift_planar.
  elementer` (JSONB-array, éi rad per brukar+prosjekt), heller ikkje ein
  eigen tabell. Lenkja vert prosjektets element-id (tekstfelt), ikkje FK.

Geir Magne vurderte å la ei slik lenkje styre Framdrift sin `ferdig %`
automatisk, men vi landa på **berre referanse/filter** (same prinsipp som
DTM-leveransar ↔ Framdrift-aktivitetar, der Framdrift sjølv avgjer korleis
lenkja skal tolkast via `ferdigModus`). Grunngjeving: éin aktivitet vil ha
mange kanban-kort knytt til seg over tid — eitt kort ferdig seier lite
presist om kor mykje av aktiviteten som er gjort. Verdien av lenkja er
sporing/kontekst («sjå alle kort knytt til ARK detaljar»), ikkje eit
automatisk rekna tal.

**Eit kort kan også stå heilt fritt** — ingen lenkjer er påkravd. Dette er
viktig for rask bruk i møte (eit raskt idé-/delegeringskort treng ikkje
tvingast inn i sak/oppgåve-strukturen).

## Kort — datamodell (forslag)

Ny tabell `kanban_kort` (RLS per brukar, same mønster som resten av appen):

```
{ id, user_id, project_id,
  tittel, skildring (valfri),
  status: 'ide'|'komande'|'under_arbeid'|'godkjenning_intern'|'godkjenning_ekstern'|'ferdig',
  ansvarleg (namn/e-post frå prosjekt_personell, same mønster som Framdrift sin «ansvarleg»),
  fase: '01'..'05'|null,
  frist: dato|null,
  farge: hex|null (enkel prioritets-/kategorimerking, same mønster som Framdrift sin `farge`),
  sak_id: FK → saker|null,
  oppgave_ref: { note_id, task_id }|null,
  framdrift_aktivitet_ref: { prosjekt_plan_id, element_id }|null,
  created_at, updated_at }
```

## Malar per fase

Same mønster som `framdriftMalar.js`: ein «Malar»-knapp fyller tavla
(kolonne **Idé** eller **Komande oppgåver**, etter val) med standard-kort
for vald fase, basert på dei leveransane/problemstillingane som normalt går
igjen i skisseprosjekt/forprosjekt/detaljprosjekt. Malinnhaldet må
avklarast med Geir Magne/kontoret før fyrste versjon — set opp
mal-strukturen fyrst, fyll med tomt eller eitt eksempel, utvid etter
tilbakemelding.

## Rask oppretting og delegering

Eit nytt kort skal kunne opprettast med **berre tittel + ansvarleg**
(resten valfritt, kan leggjast til seinare) — viktig for å kunne delegere
raskt midt i eit prosjekteringsmøte. Ansvarleg-feltet hentar frå same
personell-nedtrekk som Framdrift alt bruker, for attkjenning og
konsistens.

## Estetikk og respons

Geir Magne har eksplisitt bedt om at tavla skal kjennast estetisk og
responsiv, med enkle animasjonar — ikkje berre funksjonell. Konkret:

- **Dra-og-slepp** mellom kolonner: kortet løftar seg synleg (aukande
  skugge + lett skalering) når det vert teke tak i, andre kort flyttar seg
  mjukt unna (FLIP-teknikk eller CSS-transitions, ikkje eit brått hopp), og
  kortet set seg på plass med ein kort, dempa animasjon ved slepp.
- **Kolonneoverskrifter**: dempa fargeaksent (venstrekant-strek, same
  mønster som prosjektfargen i Kalender-modulen) heller enn sterke fylte
  fargeflater — god skanbarheit utan visuell støy, i tråd med appen sitt
  uttalte designprinsipp (god kontrast, friskt, lett å lese).
- **Nye kort**: fade/slide inn, ikkje brå framvising.
- **WIP-grense overskride**: jamn fargeovergang til raud (ikkje eit brått
  blink) — synleg, men ikkje masete.
- **Rask oppretting**: inputfeltet nedst i kolonna ekspanderer mjukt når ein
  trykkjer «+ nytt kort», i staden for å hoppe opp.
- **Hover**: eit lett løft (skugge, svak skalering) på kort for å signalisere
  at dei er klikkbare/dragbare.
- **Kjend avgrensing å vere merksam på**: dra-og-slepp i Framdrift fungerer
  berre med mus, ikkje touch (same grunnlagsproblem ville gjelde her). Legg
  difor til ein ikkje-dra-basert reserveløysing for mobil/touch (t.d. ein
  «Flytt til…»-nedtrekksmeny per kort), slik at tavla fungerer fullt ut
  utan eigen touch-dra-og-slepp-implementasjon frå start.

## Filer (forslag — ikkje bygd enno)

Bygg ut sjølve `OppgaveModule.jsx` (i dag berre ein plasshaldar), truleg
splitta etter same mønster som Framdrift (ein tynn modul-fil + fleire
spesialiserte filer):

| Fil | Innhald |
|---|---|
| `OppgaveModule.jsx` | lasting/lagring, verktøylinje, overordna layout |
| `KanbanTavle.jsx` | sjølve tavla — kolonner, dra-og-slepp, WIP-indikator |
| `KanbanKort.jsx` | eitt kort — vising + rask-rediger |
| `kanbanLogikk.js` | reine funksjonar: status-overgangar, WIP-sjekk, lenkje-oppslag |
| `kanbanMalar.js` | fase-malar |
| `supabase-kanban.sql` | ny tabell `kanban_kort` + RLS, migrasjon |

## Opne punkt (ikkje avklart enno)

- Konkret innhald i fase-malane (kva leveransar/problemstillingar som skal
  førehandsfyllast) — avklarast med kontoret.
- Om swimlanes (per fase) skal leggjast til seinare, basert på faktisk bruk.
- Om «Idé»-kort som ligg urørte lenge bør få eit mjukt varsel (ikkje
  prioritert no).
- Om prioritets-/fargemerkinga treng meir struktur enn fri hex-farge etter
  kvart som tavla vert teken i bruk.

## Implementering (24. okt. 2026)

Bygd etter spesifikasjonen over. Filer i `notatapp/src/`:
`OppgaveModule.jsx` (lasting/lagring, verktøylinje, Tavle/Arkiv), `KanbanTavle.jsx` (kolonner, dra-og-slepp, FLIP, WIP, rask oppretting),
`KanbanKort.jsx`, `KanbanKortModal.jsx` (rediger/opprett, lenkjer), `kanbanLogikk.js` (status, WIP, `planFlytting`, lenkje-oppslag, filter),
`kanbanMalar.js` (startpakke per fase — **plasshaldar-innhald, skal avklarast med kontoret**), `supabase-kanban.sql` (tabell `kanban_kort` + RLS; køyrt i Supabase).

Val som vart gjorde undervegs:
- Tavla viser 5 kolonner; **Ferdigstilt** er ei smal slepp-sone på høgre side, og ferdige kort ligg i fana **Arkiv** (filter på dato frå/til, fase, person, søk; «Gjenopne» sender kortet til Komande oppgåver). `ferdig_dato` vert sett ved flytting til ferdig.
- Kortrekkjefølgje: `sortering` per kolonne (heiltal), oppdatert ved kvar flytting/innsetjing.
- WIP-grense: eit tal per person i Under arbeid + dei to godkjenning-kolonnane, innstilt i verktøylinja (0 = av, lagra i `localStorage`). Over grensa vert kolonne-teljaren og dei aktuelle korta raude (jamn overgang), tooltip viser kven.
- Ansvarleg = fritekst med forslag frå `prosjekt_personell` (datalist, same mønster som Framdrift). Lenkjer: `sak_id` (FK → cases), `oppgave_ref {note_id, task_id}`, `framdrift_aktivitet_ref {element_id}` — kun referanse (merke S/O/A på kortet).
- Touch: kvart kort har ein «Flytt til…»-nedtrekk (reserve for dra-og-slepp, som berre går med mus).
- Dra-og-slepp er HTML5 (ikkje bibliotek); andre kort glir mjukt unna (FLIP), kortet «set seg» med ei kort animasjon, nye kort fadar inn.
- Prosjekt må vere valt (toppfeltet); kortet høyrer til prosjektet. Mobil-grensa i `App.jsx` bruker same modul.
- Ikkje gjort: swimlanes, mjukt varsel for gamle Idé-kort, ikkje-mus-dra. Ikkje testa med innlogga brukar mot Supabase (berre logikk og tavle-rendering vart testa i nettlesaren).
