# Framdrift-modulen (3. okt. 2026)

Forenkla faseplan/Gantt per prosjekt, bygd for arkitektar — ikkje ein
MS Project-klone. Eigen AppRail-oppføring («Fd», `activeModule === 'framdrift'`),
eigen topbar, same globale prosjektval som DTM/Kvalitet.

## Datamodell

Ny tabell `framdrift_planar` (`supabase-framdrift.sql`, kjørt 3. okt. 2026):
**éi rad per (brukar, prosjekt)** med heile planen som JSONB-liste
`elementer`. Medvite IKKJE i `projects.details`: `ProsjektModule.lagreProsjekt`
skriv heile `details` tilbake frå prosjektkortet og ville overskrive planen
med ei gammal kopi. Lagring er automatisk (700 ms etter siste endring,
`upsert` på `user_id,project_id`) + ved prosjektbyte/lukking.

Eit element:
```
{ id, type:'fase'|'aktivitet'|'milepael', namn, start, slutt (ISO «yyyy-MM-dd»),
  forelder: fase-id|null, avh:[id], ansvarleg, ferdig (0–100), fasekode ('01'–'05') }
```
Tre nivå: fase → aktivitet/milepæl. Ei fase MED aktivitetar har datoar rekna
frå dei (`rullOpp`) og kan berre flyttast som gruppe.

## Filer

| Fil | Innhald |
|---|---|
| `framdriftDato.js` | arbeidsdagar (man–fre minus `helligdagar.js`), parse/format |
| `framdriftLogikk.js` | reine funksjonar: rull opp, avhengnader, `settElement`, mal-bygging |
| `framdriftMalar.js` | malar (byggesak m/ dispensasjon, utan dispensasjon, fase 01–05) |
| `framdriftImport.js` | Excel/CSV + MS Project XML → element |
| `FramdriftTidslinje.jsx` | Gantt (dra-og-slepp, helg/heilagdagar, ISO-veke, avhengnadspilar) |
| `FramdriftTabell.jsx` | tabellvising, tynn wrapper rundt `DataTabell` |
| `FramdriftImportModal.jsx` | importvindauge i steg |
| `FramdriftModule.jsx` | lasting/lagring, verktøylinje, eigenskapspanel, malvindauge |

## Avhengnader («B startar når A er ferdig»)

Eit **minimumskrav**, ikkje ein hard lås: B startar tidlegast fyrste
arbeidsdag etter at A er ferdig. Flyttar/forlengar du A, vert B (og alt
etter) flytta med viss B låg «stram» mot A, eller skubba viss B elles
ville starte for tidleg — er B planlagt seinare enn naudsynt, vert han
ståande. Legg du til ei avhengnad, vert B flytta til dagen etter A.
Sirkel-avhengnader og fase↔eigne aktivitetar vert avviste. Ingen kritisk
line, ingen ressursnivellering. Varigheit reknast i arbeidsdagar.

## Fristar og møte

Lest direkte frå `notes` (same reglar som `KalenderModule.jsx`: opne
oppgåver med `task.date`, møte med `isMeeting && meetingTime`, filtrert på
valt prosjekt) og vist som ei eiga rad øvst i tidslinja (frist = ruter,
møte = sirkel). Ingenting vert lagra dobbelt.

## Import (ingen Electron-bru — fungerer i vanleg nettlesar)

- **Excel (.xlsx/.xls) / CSV**: `xlsx` vert lasta fyrst ved bruk
  (`import('xlsx')`, eigen chunk ≈ 430 kB). Automatisk gjetting av
  kolonnar frå overskrifter (aktivitet, start, slutt, varigheit, ansvarleg,
  nivå/type) + manuell kopling med nedtrekk, førehandsvising, stadfesting.
  Varigheit utan slutt vert rekna ut i arbeidsdagar. «Nivå/type»-kolonna
  (tal eller tekst som «fase»/«milepæl») gjev fasestruktur.
- **MS Project XML** (`DOMParser`): oppgåvenamn, start/slutt, milepælar,
  disposisjonsnivå (nivå-1-sammendrag → fase, resten → aktivitet under
  fasen; djupare sammendrag vert slått saman), % ferdig og avhengnader av
  typen slutt→start. Andre avhengnadstypar, ressursar og kostnader vert
  hoppa over — brukar får ei oppsummering av kva som vart utelate.
- **.mpp** direkte: ikkje støtta (lukka binærformat; krev MPXJ/Java i
  Electron-skalen og ny installasjonsfil). Brukar får ei forklarande feilmelding.
- Importerte datoar vert brukte slik dei er; avhengnadene vert først
  handheva når noko seinare vert flytta.

## Opne punkt / mogleg seinare

- **Overbelastningsindikator** (raud markering viss ein person har meir
  planlagt enn timar): IKKJE med frå start — berre faseplan og tidslinje
  fyrst, som oppdraget sa. `ansvarleg` er alt eit eige felt, så grunnlaget finst.
- Samanlikning planlagd/brukt tid mot Timar-modulen, og knyting til
  Saker/DTM-milepælar: ikkje bygd.
- Importen er testa mot MS Project sin standard XML-struktur og sjølvlaga
  Excel/CSV; ei **ekte testfil frå brukar** står att for å fange opp
  oppsett som avvik.
- Dra-og-slepp bruker musehendingar — fungerer ikkje med touch (mobil viser
  planen, men kan ikkje flytte stolpar der; bruk Tabell/panelet).

## Personell, kontorkalender og timeprognose (10. okt. 2026)

**Prosjekt-modulen har no tre faner**: Prosjektkort · **Personell** · **Kontorkalender**.

- **Personell** (`PersonellSide.jsx`, tabell `prosjekt_personell`, `supabase-personell.sql`): ein tabell
  (DataTabell) per prosjekt med namn, rolle, **prosent** (del av full arbeidstid på prosjektet), utrekna
  kapasitet t/veke, e-post og merknad. «Kopier personell frå anna prosjekt» fyller lista raskt. Radmeny → slett.
- **Kontorkalender** (`KontorkalenderSide.jsx`, `kontorkalender.js`, tabell `kontor_kalender`, éi rad per brukar):
  standard **8 t/dag, måndag–fredag**; fri **stille veke i påska** (måndag–fredag veka før påskedag),
  **julaften** og **veka 24.–31. des.**, elles norske helligdagar (`helligdagar.js`). Kvart val kan slåast av,
  arbeidsdagar og timar kan endrast, og eigne fridagar/ferie (periodar) kan leggjast til. Sida viser alle
  fridagar for valt år og sum arbeidsdagar/timar. Hook: `useKontorkalender`. NB: kalenderen styrer
  **timar/kapasitet** — planlegginga av datoar (`framdriftDato.js`, varigheit i arbeidsdagar) bruker framleis
  berre norske helligdagar, så ein aktivitet «arbeider» gjennom stille veke/juleveka med 0 timar.
- **Timeprognose per aktivitet** (`framdriftTimar.js`, `FramdriftTimarPanel.jsx`): to nye felt på aktivitetar,
  `timar` (forventa totalt) og `fordeling`: **fast** kvar veke · størst **start** · størst **midt** · størst **slutt**.
  Kvar veke vert vekta med kontorets faktiske arbeidstimar innanfor aktiviteten sin periode (veker med fri får 0,
  delveker mindre); timar vert runda til halve og justerte så summen er nøyaktig det oppgjevne. Panelet (til høgre
  når ein aktivitet er vald) har timefelt, fire fordelingsknappar med form-ikon og ei førehandsvising per veke.
  Også kolonnane «Timar»/«Fordeling» i tabellvisinga. Fasar viser sum av aktivitetane sine timar.
- **Timar per veke** (ny rad nedst i tidslinja, kan slåast av): sum for alle aktivitetar per veke, tooltip viser
  fordeling per person. **Overbelastning**: har ein person (matcha på namn mot personell-lista) meir planlagt ei
  veke enn kapasiteten (arbeidstimar den veka × prosent), får vekecella raud ramme og tooltipen listar kven og kor
  mykje; verktøylinja viser tal overbelasta veker. Berre aktivitetar i DETTE prosjektet tel (ikkje på tvers av prosjekt).
- «Ansvarleg» på ein aktivitet foreslår namn frå personell-lista (fritekst er framleis lov).
