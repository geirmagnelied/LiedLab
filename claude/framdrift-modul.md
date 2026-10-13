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

## Raskare kopling, leveransar og personfordeling (11. okt. 2026)

- **Dra-kopling i tidslinja**: hald musa over ein stolpe (eller vel han) → ein sirkel dukkar opp på høgre kant. Dra frå sirkelen og slepp på ein annan rad: «den startar når denne er ferdig» (grøn markering = lov, raud = ikkje mogleg, t.d. sirkel). Klikk på ei avhengnadspil fjernar ho (Angre set ho attende). `FramdriftTidslinje.jsx` (`startKobling`), handlarar `koble`/`fjernAvh` i `FramdriftModule.jsx`. Fiksa same dag: `leggTilAvhengnad` mista varigheita (aktiviteten vart 1 dag).
- **Leveransar kopla til aktivitet** (`FramdriftLeveransarVindauge.jsx`, flyttbart/skalerbart): to kolonnar — DTM-dokument til venstre (søk, filter Ledige/Leveranseplan/Alle, marker fleire, dra eller ＋) og kopla dokument til høgre. Lagra som `leveransar: [dtm_dokumenter.id]` på aktiviteten. Knapp «⛓ Kople leveransar» i eigenskapspanelet.
- **Framdrift frå leveransar** (`framdriftFerdig.js`): `ferdigModus` `'auto'` (standard når det finst kopla leveransar) = snitt av «Ferdigstillelse» i DTM, vekta med timebudsjett viss ALLE har det, elles enkelt snitt; `'skjonn'` = brukaren sitt eige tal i `ferdig` (overstyrer). Å skrive eit tal i tabellkolonna «Ferdig %» set skjønn. Fasar viser snittet av aktivitetane (vekta med arbeidsdagar). Vist som mørk fyll i stolpane, ⛓ i namnekolonna, og i tabellen (ny kolonne «Leveransar»).
- **Fordel timar på personell** (`FramdriftPersonarPanel.jsx`): `personar: [{namn, del}]` (sum 100 %) per aktivitet. Samansett stolpe med skiljelinjer å dra (snapp 5 %, Alt = 1 %), tal-felt, snarvegsknappar frå personell-lista, «Jamt». `personDelar()` i `framdriftTimar.js` styrer «Timar per veke» og overbelastning; utan `personar` gjeld `ansvarleg` = 100 %.

## Verktøylinje, aktivitetsfargar og standardpersonell (11. okt. 2026)

- **Kollapsbar verktøylinje** (`FramdriftVerktoy.jsx`) til venstre i modulen, rett ved venstremenyen: + Fase / + Aktivitet / + Milepæl, Malar, Importer, Angre. Skjult/open vert hugsa (`liedlab-framdrift-verktoy-open`). Fjerna frå topplinja.
- **Farge på element**: felt `farge` (hex) på fase/aktivitet/milepæl; fargeveljar i eigenskapspanelet (12 fargar, eigen farge, ⊘ = følgjer fasen). Brukt i stolpe og namnekolonne.
- **Personell**: den som opprettar eit prosjekt vert lagt inn som personell (`personellStandard.js`; frå `useStore.addProject` og `ProsjektModule.nyttProsjekt`). Eksisterande prosjekt utan personell får brukaren lagt inn fyrste gong personell-lista/Framdrift vert opna (éin gong per prosjekt, merkt i localStorage). Ny knapp «+ Legg meg til» i Prosjekt → Personell.
- **Electron**: vindauget startar maksimert og vert synleg når sida er klar (`electron/main.js`). Merk: .exe-en lastar den LIVE nettsida (Vercel), så kodeendringar i `src/` kjem fyrst etter push.

## Justeringar 12. okt. 2026

- **Eigenskapspanelet** (valt element) ligg no som ei **kollapsbar kolonne heilt til venstre** i modulen (‹ for å skjule, smal stolpe «Eigenskapar» for å vise att; hugsa i `liedlab-framdrift-panel-open`). Knappane «+ Ny fase / + Ny aktivitet / + Milepæl / Malar / Importer / Angre» er tilbake i topplinja; `FramdriftVerktoy.jsx` er fjerna.
- **Lås prosentdel** (`FramdriftPersonarPanel.jsx`): 🔒 per person (`personar[].last`). Låste delar vert aldri endra av dragingar, tal-felt, «Jamt» eller når nokon vert lagt til/fjerna; skilje mellom låste vert sperra.
- **Timefordeling i tabellvisinga** (`FramdriftTimeMatrise.jsx`): foldbar seksjon under tabellen — éin rad per aktivitet (▸ utvid for personar × veker), totalrad og sum per person. Same tal som «Timar per veke».
- **Personell**: kolonnane Fornamn/Etternamn (`prosjekt_personell.fornamn/etternamn`, migrasjon køyrt; `namn` = «fornamn etternamn»). «Legg meg til»/standardpersonell hentar namn frå tidlegare rad med same e-post, kontometadata eller e-post på forma fornamn.etternamn.
- **Redigering i Electron**: etter `alert()/confirm()/prompt()` sluttar tekstfelt å ta imot tastetrykk i Electron/Windows. `fokusFiks` (preload) + IPC `fokus-fiks` (main) tek fokuset tilbake etter kvar dialog; `main.jsx` pakkar dialogfunksjonane. Krev ny .exe.

## Person-underrader i tabellen og fast sidefelt (12. okt. 2026, kveld)

- **Tabellvisinga** (`FramdriftTabell.jsx`): aktivitetar med timar og personar har ▸/▾ i namnecella; open gjev ein **underrad per person** (fargeprikk, del %, timar) og vekekolonnar («Veke 42» …) viser timane per veke for fase, aktivitet og person. «Utvid alle personar / Fold saman alle» i ei linje over tabellen. `DataTabell` fekk valfri prop `radGruppe` (`{ forelder(rad) }`): underrader følgjer forelderen uansett sortering, går utanom filter og vert ikkje summerte i totalraden. Den separate matrisa (`FramdriftTimeMatrise`) er fjerna.
- **Fast venstrefelt** (kvit bakgrunn, kollapsbart, hugsa i `liedlab-framdrift-panel-open`): viser **planoversikt** (`FramdriftOversikt.jsx`: tal, samla framdrift, timar per person, neste i planen) når ingenting er valt, og **eigenskapane** til valt element når noko er valt (× fjernar utvalet).

## Person-rader i tidslinja, kurveeditor, timepris og budsjett (12. okt. 2026)

- **Tidslinja**: ▸/▾ framfor aktivitetar med timar og personar viser person-underrader med timar per veke (fargerute per veke). Same i tabellen (Tabell-visinga).
- **Kurveeditor for timefordeling** (`FramdriftTimarPanel.jsx`): fordelingsgrafen har ein sirkel over høgaste stolpe — dra opp/ned for å styre kor stor forskjell det er mellom veker (`fordelingStyrke`, 0–200 %, standard 100 %; `formVekt(key, t, styrke)` skalerer avviket frå flat). Skyvekontroll gjer det same. Dra ein enkelt stolpe → «Eigen» (`fordeling:'eigen'`, `eigenVekt[veke]`, Nullstill-knapp).
- **Timepris og budsjett**: kolonnen «Timepris kr/t» i Prosjekt → Personell (`prosjekt_personell.timepris`, migrasjon køyrt). På ein aktivitet vel du **Timar** eller **Budsjett (fastpris)** (`modus`, `budsjett`). Med budsjett er timar = budsjett ÷ snittpris, snittpris = Σ(del_i % av TIMANE × timepris_i) — personfordelinga er alltid prosent av timar, ikkje av beløp (`snittpris`/`effektiveTimar`/`medEffektiveTimar` i `framdriftTimar.js`). Modulen kjører elles på `elEff` (plan med effektive timar) for visning/utrekning; redigering går mot råplanen. Manglar timepris vert det varsla; kostnad per person vert vist. Tabellkolonna «Budsjett kr» er redigerbar.

## Dra tidslinja og timepris per aktivitet (12. okt. 2026)

- **Dra tidslinja**: hald nede på ein tom flate (eller datooverskrifta) og dra i alle retningar (`startPan` i `FramdriftTidslinje.jsx`); eit enkelt klikk fjernar utvalet som før. Stolpar/handtak/pilar fungerer uendra.
- **Timepris per person i aktiviteten**: `personar[].pris` (kr/t) overstyrer prosjektets `timepris` frå Prosjekt → Personell for den aktiviteten (`prisFor()` i `framdriftTimar.js`; brukt i snittpris, timar frå budsjett og kostnad). Eige felt under kvar person i fordelingspanelet; tomt = standard frå personell.

## Summasjonsaktivitetar, hierarki og fleire tabellkolonnar (13. okt. 2026)

- **Hierarki på vilkårleg djupn**: ein aktivitet kan ha underaktivitetar og vert då ein **summasjonsaktivitet** (`forelder` peikar på overordna aktivitet, ikkje berre fase; `summ: true` markerer ein aktivitet som summasjon også utan born enno). Fasar er alltid toppnivå, milepælar kan ikkje ha born. Datoane til ein summasjon følgjer borna (`rullOpp`, botn-opp), og han vert flytta som gruppe. Funksjonar i `framdriftLogikk.js`: `erSumm`, `erRulla`, `etterkommarar`, `forfedrar`, `flyttNode(id, mal, 'for'|'etter'|'inni'|'rot')`, `innrykk`/`utrykk`, `settSumm`, `moglegeForeldre`, `pnsKart`. Avhengnader mellom eit element og sine overordna/underordna vert avvist/fjerna.
- **Grensesnitt**: i panelet — «Overordna»-nedtrekk, ⇤ Flytt ut / ⇥ Flytt inn, og «∑ Marker som summasjonsaktivitet» / «Opphev» (underaktivitetane flyttar opp eitt nivå). I tidslinja: grepet ⠿ framfor namnet — dra over/under ei rad (same nivå) eller midt på ei rad (blir underaktivitet, raden vert summasjon); underaktivitetane følgjer med. Summasjonar teiknast som fasestolpar og kan foldast saman (▾/▸). «+ Ny aktivitet» med ein summasjon vald legg aktiviteten under han.
- **Summar**: timar/budsjett/påløpt/framdrift for ein summasjon er summen av BLAD-aktivitetane under (ikkje dobbelt: `timarPerVeke` og totalraden hoppar over summasjonar; `DataTabell` fekk `radGruppe.ikkjeISum`).
- **Tabell** (`prefsKey` v3, rekkjefølgje = hierarki sortert på PNS): nye kolonnar **PNS-nivå** (rekna ut, 1.2.3), **Aktivitetskode**, **Budsjettype** (Fastpris/Budsjettpris/Ufakturerbart), **Timerate kr/t** (frå personfordelinga; å skrive eit tal set `timerate` som OVERSTYRER utrekninga, brukt òg for budsjett → timar), **Påløpte timar** og **Påløpt honorar** (manuelt innskrive; honorar utan eige tal = påløpte timar × timerate). Namn viser innrykk, ∑ og ▾/▸. Alle celler kan redigerast (klikk, så klikk igjen/dobbeltklikk); kolonnar skjulast/visast via «+ Kolonnar».

## Kolonnar i tidslinja, faste personfargar, personsummar, Excel (13. okt. 2026, kveld)

- **Kolonnar til venstre for tidslinja**: høgreklikk på overskrifta (eller «＋ Kolonnar») → vel mellom PNS, kode, type, overordna, start, slutt, dagar, ansvarleg, ferdig, budsjettype, budsjett, timerate, timar, påløpt, «startar etter» (`KOLONNE_DEF` i `framdriftVerdiar.js`, same utrekningar som tabellen). Tidslinja vert flytta mot høgre; val hugsa i `liedlab-framdrift-tl-kol`.
- **Same farge på ein person i prosjektet** (`personFarge.js`): fargen følgjer plasseringa i personell-lista (elles stabil hash av namnet) — i fordelingspanel, tidslinje, tabell, oversikt og Excel.
- **Sum per person**: under «Timar per veke» i tidslinja (▸) og som gruppa «Timar per person (alle aktivitetar)» nedst i tabellen: éi rad per person med timar per veke og sum. Innanfor ein aktivitet viser person-underradene (▸ framfor aktiviteten) kvar person sine timar per veke. Overbelastning merkast raudt.
- **Excel-eksport** (`framdriftEksport.js`, `exceljs` lasta først ved bruk, eigen chunk): «⇩ Excel ▾» → **Berre tabell** (alle kolonnar + timar per veke, personar som underrader) eller **Tabell med tidslinje** (vekekolonnane teiknar stolpane i fargar, ◆ for milepælar, timar i cella). Eige ark «Timar per person». Filnamn «Framdrift <prosjekt> (…) <dato>.xlsx».
- **Ansvarleg = person i fordelinga**: er ingen fordelt, men ein er sett som ansvarleg, står han som 100 % i fordelingspanelet, så timepris kan setjast utan å leggje personen til på nytt.

## Import frå ISY Prosjekt Plan (13. okt. 2026)

ISY Prosjekt Plan (Norconsult Digital) eksporterer via Fil → Eksporter prosjekt… → «til MS Project» til **MS Project XML (.xml)**. Importen i Framdrift («Importer…» → vel .xml) les no denne fila fullt ut (`parseMspXml` i `framdriftImport.js`; testa mot ei ekte eksportfil, 55 oppgåver):
- **Hierarki** frå `OutlineLevel`: nivå 1-sammendrag → fase, djupare sammendrag → summasjonsaktivitet, blad → aktivitet, milepæl → milepæl.
- **ISY-felt** (utvida attributt, kjend att på alias «…(ISY)»): Text10 = **aktivitetskode** (`kode`), `Work` = **timar**, `FixedCost` ÷ 100 = **budsjett** (kr; MSP/ISY lagrar kostnader i hundredelar), **timerate** = budsjett ÷ timar, Number1 = **påløpte timar**, Cost1 ÷ 100 = **påløpt honorar**, Physical % Complete = **framdrift** (skjønn). Aktivitetar under ein «Ufakturerbart»-overordna får budsjettype Ufakturerbart. Tala bruker komma som desimal.
- **Avhengnader** (slutt → start) vert med; andre typar og avhengnader til overordna med born vert hoppa over. Ressursar/ressurstilknytningar og Number2/Cost2 (gjenståande) vert ikkje importerte (reknast frå budsjett − påløpt). Vanlege MS Project-filer bruker standardfelta (Work, FixedCost, ActualWork) på same måte.
- `ISY/`-mappa i repo-rota er lagt i `.gitignore` (kundedata).

## Forbruk (påløpte timar) frå timeføringsrapport (13. okt. 2026)

- **Rapportformat** (Excel, «<oppdragsnr>_<månad>_spesifisert.xlsx»): topptekst `Oppdrag: 52607575 …` og `Periode: 2026-09-01 - 2026-09-30`, så kolonnane **Dato · Periode (ÅÅÅÅUU) · Ansatt («Etternamn, Fornamn») · Aktivitet («611 ARK - prosjektering») · Timer · Beskrivelse**. Parser: `framdriftForbruk.js` (`parseForbruk`, rein ESM — brukt både i appen og i skriptet).
- **Tabell** `framdrift_forbruk` (`user_id, project_id, dato, vekeaar, vekenr, ansatt, ansatt_namn, aktivitet, kode, timar, beskrivelse, kilde`; RLS per brukar, migrasjon køyrt). Import **erstattar** alle rader i rapporten sin periode (fra–til) for prosjektet — same fil kan importerast fleire gonger.
- **Kopling til aktivitetar** (`kopleForbruk`, endra 13. okt.): berre på **aktivitetsnummeret** — talet/koden som står FØRST i aktivitetsnamnet («611 ARK prosjektering» → 611) eller feltet «Aktivitetskode» (`kode`) viss det er sett. Namnet elles vert ikkje brukt, så det kan endrast fritt. Timar utan kopling vert lagra og lista (importvindauget og planoversikta) til ein aktivitet får rett nummer. Personnamn vert samanlikna uavhengig av rekkjefølgje («Stien, Tore» = «Tore Stien»).
- **Bruk i Framdrift**: «Påløpte timar» på ein aktivitet = sum frå forbruket (går føre manuelt tal; honorar = timar × timerate viss ikkje eige tal). Person-underradene (▸) viser planlagt **/ påløpt** i namnekolonna og per veke (blått tal i vekecella) — også personar som har ført timar utan å stå i planen. Tabellen har velgar **Planlagt / Påløpt / Plan / påløpt** for vekekolonnane og kolonnen «Påløpte timar» per person. Planoversikta viser påløpt totalt og per person.
- **Manuell import**: «⇩ Forbruk…» i Framdrift (førehandsvising av kopling, åtvaring viss oppdragsnummeret ikkje stemmer med valt prosjekt).
- **Automatisk import**: ukentleg planlagt oppgåve («framdrift-forbruk-import», tirsdagar ca. 12.00 — appen må vere open) køyrer `notatapp/scripts/importer-forbruk.mjs "<repo>\Framdrift"`, som les alle .xlsx i mappa `Framdrift/` (i `.gitignore` — personopplysningar) og skriv SQL (erstatt periode + sett inn; prosjektet vert funne på prosjektnummeret i fila). SQL-en vert køyrd mot Supabase via MCP.

## Tabell-først: redigering i tidslinjetabellen og bemanningsvindauge (13. okt. 2026, kveld)

- **Aktivitetskode erstattar aktivitetsnummer**: kolonnen «Aktivitetskode» (`kode`) er nøkkelen for kopling av forbruk (nummer først i namnet vert berre brukt viss kode manglar). Nye kolonnar: **Påløpt kostnad** (påløpte timar × timerate; med forbruk = Σ personar sine påløpte timar × deira timerate i aktiviteten), **Gjenstående timar** (timar − påløpt) og **Gjenstående budsjett** (budsjett − påløpt kostnad). Summar for summasjonsaktivitetar/fasar vert rekna frå bladaktivitetane.
- **Tabellen til venstre for tidslinja** (`FramdriftTidslinje.jsx`): breidda kan dragast — dra i høgre kant av overskrifta på namnekolonna eller kvar kolonne (dobbeltklikk = standard); hugsa i `liedlab-framdrift-tl-namnb/-kolb`. Standardkolonnar: kode, start, slutt, ansvarleg, ferdig, timar, budsjett, timerate (høgreklikk → vel fleire). **Dobbeltklikk i ei celle for å skrive inn**: namn, kode, start, slutt, ansvarleg, ferdig, budsjettype (nedtrekk), budsjett, timerate, timar, påløpte timar, påløpt kostnad (Enter/forlat feltet lagrar, Esc avbryt). Same handlar som tabellvisinga (`endreFraTabell`).
- **Sidepanelet** er redusert til det som er vanskeleg i ei tabell: namn, farge, hierarki (overordna/ut/inn/summasjon), fasekode, **timefordeling over vekene** (kurve), avhengnader, rekkjefølgje/slett. Datoar, ansvarleg, timar/budsjett/timerate, framdrift og personar er fjerna derifrå.
- **Bemanningsvindauge UNDER tabellen** (`FramdriftBemanning.jsx`, som «Bemanningsregister» i ISY; høgda kan dragast, kan skjulast): for vald aktivitet éi rad per ressurs — ressursnamn, andel % (av TIMANE, med lås), planlagde timar, timerate (overstyrer prosjektets), planlagd kostnad, påløpte timar/kostnad (frå forbruk), gjenståande timar/kostnad, sum-rad og «Legg til ressurs»; personar som har ført timar utan å stå i planen kjem med (＋ for å ta dei med). Fana **Leveransar** viser kopla DTM-dokument, «Kople leveransar…» og styring av framdrift (auto/skjønn).

### Bemanningsregister som i ISY (13. okt. 2026, seint)
`FramdriftBemanning.jsx` er omarbeidd etter ISY-skjermbiletet: kolonnane **Aktivitetskode · Navn · Ressursnamn · Ressurs timer · Ressurs rate · Ressurs faste kostnader · Kostnad (timar × rate + faste) · Belastning (%) · Kommentar**, pluss påløpte timar/kostnad og gjenståande frå forbruket. Faner «Leveranseregister» / «Bemanningsregister», tom rad nedst med nedtrekk for å velje ressurs. Som i ISY skriv du **timar per ressurs**: aktivitetens timar vert summen (modus «timar»), og Belastning (ressursens del av timane, 2 desimalar, t.d. 35,6 %) vert rekna ut; å skrive Belastning direkte fordeler dei samla timane på nytt (alltid % av timar, med lås). «Oppdater budsjett frå kostnad» set aktivitetens budsjett lik samla kostnad. Ressurslinja (`personar[]`) har no òg `fast` (faste kostnader) og `kommentar`. Tidslinjetabellen fekk kolonnen «Etterfølgere» (og «Forgjengere» = tidlegare «Startar etter»).
