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

### Ansvarleg som nedtrekk (13. okt. 2026)
Kolonna **Ansvarleg** (tidslinjetabellen og tabellvisinga) er no eit **nedtrekk** med personellet i prosjektet (Prosjekt → Personell) — pluss ressursane som alt står i aktivitetens bemanning — i staden for fri tekst. Kolonna viser berre ansvarleg-feltet; den nye kolonna **Bemanning** viser ressursane i bemanningsregisteret med andel. Ansvarleg vert merkt ★ i bemanningsregisteret.

## Revisjon 26. okt. 2026 — verktøylinje, påløpt innan, visning, delsummer, PNS, forbruksimport
- **Verktøylinja** ligg no i NL3 (linja rett under toppfeltet — flytta eit hakk opp). Frå venstre: **Påløpt innan ▾**, Tidslinje/Tabell + zoom, blå **＋ Ny ▾** (aktivitet, fase, milepæl, «Frå mal…»), **Import ▾** (plan, forbruk), **Eksport ▾** (Excel utan/med tidslinje), **Visning ▾**, **PNS ▾**, ↶ Angre. Menyane ligg i `FramdriftVerktoy.jsx` (`FdMeny`, `MenyPunkt`, `PalopInnanMeny`). Avkryssingane «Timar per veke» og «Fristar og møte» (tidslinje) ligg no i Visning.
- **Påløpt innan** (`framdriftPalop.js`): vel ingen avgrensing, dato, veke eller månad. Timeføringar (`framdrift_forbruk.dato`) etter sluttdatoen vert ikkje med — avgrensinga gjeld heile modulen (tabell, tidslinje, personrader, sum, påløpt honorar). Valet vert hugsa (localStorage). Manuelt innskrivne «Påløpte timar» (utan forbruksimport) vert ikkje avgrensa.
- **Kolonneoverskrifter** (`DataTabell` prop `bryttOverskrift`, nytt): høgare (56 px), namn med to ord vert viste over to rader, lange ord får mjuke bindestrekar (`mjukBindestrek()`, &shy;) og vert delte med bindestrek når plassen er for liten. Berre Framdrift-tabellen brukar det førebels.
- **Visning ▾**: *Veke-kolonnar viser* **Timar** eller **Påløpt honorar** (timar × timerate; påløpt reknar kvar person sin rate, planlagt snittrate), og **Vis delsummer** (ei «∑ Sum …»-linje etter kvart delnivå i tabellen med summerte timar, budsjett, påløpt, honorar, gjenståande og vekekolonnar; teljer ikkje dobbelt i totalraden). Månadskolonnar finst ikkje — kolonnane er veker.
- **«Timar per veke»-rada** nedst i tidslinja viser no òg **påløpt** (blått tal under planlagt, og «X t påløpt» i etiketten).
- **PNS ▾** (prosjektnedbrytingsstruktur): «Vis til og med nivå 1…n» (lukkar alle overordna på/under nivået) og «Alle nivå». Gjeld både tabell og tidslinje.
- **Forbruksimport**: kolonna «Aktivitet» («611 ARK prosjektering») vert delt — teikna før fyrste mellomrom = aktivitetsnummer (`kode`), resten = aktivitetsnamn (`delAktivitet()` i `framdriftForbruk.js`, brukt og av det ukentlege skriptet). Aktivitetar som ikkje finst i planen vert tilbydde oppretta (avkryssing, på som standard) som aktivitetar utan fase med kode/namn og datoar frå første/siste timeføring. Same deling vert gjort ved plan-import frå Excel/CSV når aktivitetsnamnet startar med eit nummer og det ikkje er ei eiga kodekolonne.

## Revisjon 26. okt. 2026 (2) — månadsvising, KPI, Visning tidslinje
- **Orddeling i tidslinja:** kolonneoverskriftene i tabellen til venstre for tidslinja bryt no på same måte som i tabellen (to ord = to rader, lange ord delt med bindestrek via `mjukBindestrek()` frå `DataTabell.jsx`).
- **Månad-visning** (ny knapp «Månad» ved sidan av Tidslinje/Tabell): tabellen med **månadskolonnar** (ingen vekenummer; sum, delsum, honorar og påløpt vert fordelte på månader). Ei veke som går over eit månadsskifte vert fordelt etter **arbeidstimar i kontorkalenderen** på dagane i kvar månad (`manadDelar()` i `framdriftManad.js`; helg/fridagar/helligdagar tel ikkje; heil fridagsveke fordeler etter kalenderdagar). Døme: veke måndag 28.9. → 60 % september / 40 % oktober. Same fordeling gjeld planlagt og påløpt (påløpt er lagra per veke/aktivitet/person, ikkje per dag). Totalane per månad summerer til same tal som veketotalen. Eiga kolonneoppsett-nøkkel (`liedlab-framdrift-manad-v1`).
- **Visning:** knappen er delt i to. **«Visning tidslinje»** står i ei strek rett over der tidslinja startar (følgjer breidda på kolonnane til venstre) og styrer berre tidslinja: Timar per veke-rada, Fristar og møte, og **Vis delsummer** (∑-linje etter kvart delnivå i tabellen til venstre — dette er nytt, delsummer var før berre i Tabell). Tabell- og Månad-visinga har si eiga **«Visning»** i linja over tabellen (Timar / Påløpt honorar, Vis delsummer). Årsaka til at val «ikkje gjorde noko» før: Timar/Honorar og delsummer gjaldt berre Tabell-visinga, ikkje Tidslinje.
- **KPI-kolonne** (både tidslinje og tabell/månad; `beregnKpi()` / `kpiFarge()` i `framdriftVerdiar.js`): **prosent av budsjett (eller fastprishonorar) brukt ÷ prosent estimert framdrift**. Brukt = påløpt honorar ÷ budsjett (utan budsjett: påløpte ÷ planlagde timar). Under 0,9 = grøn, 0,9–1 = oransje, over 1 = raud; «∞» (raud) = pådrag utan framdrift; tom = ikkje nok data. For fasar/summasjonar vert budsjett og påløpt summert frå blad-aktivitetane og framdrifta er fasen sin. **NB:** formelen er snudd i forhold til ordlyden i ønsket (framdrift ÷ forbruk), slik at fargane gir meining (raud = brukar meir enn ein har kome). Vil ein ha motsett definisjon, endre `beregnKpi`/`kpiFarge`. Kolonnaval i tidslinja er nullstilt (nøkkel `…-tl-kol-v3`) så KPI kjem med som standard.

## Revisjon 26. okt. 2026 (3) — pil-peikar, fleirval, månadssummar i tidslinja, skala
- **Peikar:** alle tabellane i Framdrift (Tabell, Månad, og tabellen til venstre i Tidslinje + tidslinja sjølv) bruker vanleg pil (`cursor: default`) i staden for hand/grab. I `DataTabell.jsx` er det ei ny CSS-klasse `.dt-pil` (brukt av FramdriftTabell).
- **Fleirval:** klikk = ei rad, **Ctrl/Cmd-klikk** legg til/fjernar, **Shift-klikk** vel område (i viste rekkjefølgje) — i Tidslinje, Tabell og Månad (felles `valde`-sett i modulen; i rutenett-tabellen verkar Shift/Ctrl-klikk på ei rad òg som radval). Når fleire er valde vert det ei svart linje «N valde» med massehandlingar: flytt ±1 dag/veke (arbeidsdagar, summasjonar som følgjer barna vert hoppa over), innrykk/utrykk, «Flytt til…» (under ei fase/summasjon), slett, avmerk (Esc). **Dra ein valt stolpe** i tidslinja flyttar alle valde like mykje.
- **Verktøylinja (NL3):** «Visning tidslinje», **− / ＋** (skalerer breidda tidslinja tek: ×0,8/×1,25, hugsa lokalt) og tidsoppløysinga **Dag · Veke · Månad · Månad+ · Kvartal** ligg no til høgre (over tidslinja) og vert berre viste i Tidslinje-visinga.
- **Månad (ny) og Månad+:** «Månad+» er den gamle månadsvisinga (månadsoverskrift + vekenummer). «Månad» er tidslinja utan vekenummer med to summerader nedst: **Timar per månad** (planlagt + påløpt i blått) og **Påløpt honorar per månad** (kr). Veker over månadsskifte vert fordelte på månadene etter arbeidstimar (`manadDelar()`), og honorar reknar kvar person sin rate. Radene vert viste uavhengig av «Timar per veke»-valet.
- **VN:** aktiv modul har svart bakgrunn og kvit tekst/ikon (gjeld òg mobilmenyen).

## Rapportar (PDF) — 7. nov. 2026
Ny meny **Rapport ▾** i Prosjektplan-verktøylinja (til høgre for Eksport). `FramdriftRapportModal.jsx` + `framdriftRapport.js` (reine funksjonar + PDF med pdf-lib, A4 liggande).
- **Seksjonar (kolonnegrupper):** *Aktivitet og budsjett* · *Påløpt totalt* (til og med periodeslutten) · *Påløpt i perioden* · *Prognose resterande arbeid* (planlagde timar frå dagen etter periodeslutten og ut aktiviteten, delvis veke prorata etter arbeidsdagar; kroner = timar × timerate).
- **Periode:** standard førre månad; kan setjast til eigen periode. Påløpt kjem frå importert forbruk (`framdrift_forbruk`, kopla på aktivitetskode), kroner = timar × personens/aktivitetens rate (same regel som tabellen); manuelt påløpt tal vert brukt viss det ikkje finst forbruk.
- **Standardrapportar (låste):** *Rapport til kunde* (aktivitetsnr., aktivitet, ansvarleg, budsjett · påløpt kr/timar, gjenståande budsjett · periode kr/timar · prognose kr/timar) og *Intern rapport* (i tillegg planlagde timar, gjenståande timar, % brukt, venta sluttkostnad og avvik mot budsjett).
- **Eigne rapportar:** vel seksjonar/kolonnar, tittel, fasar/delsummar, sum-rad, skjul aktivitetar utan tal. Lagra i `framdrift_rapportar` (`supabase-framdrift-rapportar.sql`) og **synlege for alle med tilgang til prosjektet**; forfattaren eller administrator kan endre/slette. «Lag eigen kopi» startar frå ein standardrapport.
- Ikkje gjort: grafar, rekkjefølgje på kolonnar, PDF-fil lagra i DTM.

## Rapportar — revisjon 7. nov. 2026 (tilbakemelding)

- **Skiljestrekar**: tjukk loddrett strek (1,4 pt) ved starten på kvar hovuddel (aktivitet | påløpt totalt | påløpt i perioden | prognose), i heile tabellhøgda og på alle sider.
- **Prognose per periode**: `oppsett.prognoseModus` = `manad` (standard) | `veke` | `resterande`. Planlagde timar etter periodeslutten vert fordelte på arbeidsdagar (`prognoseFordelt`) og gitt ei kolonne per månad/veke (timar og/eller kroner etter valde prognosekolonnar), pluss sum-kolonnar. Valet er eit utskriftsval og kan endrast òg for låste standardrapportar.
- **Intern rapport**: `delsum` (eiga «Sum …»-rad etter kvar fase/delaktivitet; overskriftsrada er utan tal) og `perPerson` (kvar person under aktiviteten med planlagd del, faktisk forbruk og prognose = aktivitetens prognose × personens del; personrader er ikkje med i summane). Begge kan veljast i eigne rapportar.
- **Ark**: `oppsett.ark` = `{ storleik: A0–A5, retning: landskap|portrett }`; vindauget åtvarar når kolonnane ikkje får plass (`trengBredd`). Skriftstorleiken er fast, større ark gir meir plass.
- **Vindauget** (`FramdriftRapportModal.jsx`): flyttbart (dra i tittelfeltet), skalerbart (kantar/hjørne), maksimerbart (knapp eller dobbeltklikk på tittelfeltet), storleik i `localStorage` (`liedlab.rapportVindu`). Førehandsvisinga er den ferdige PDF-en (iframe mot blob-URL). «＋ Ny» står heilt til venstre nedst, og «＋ Ny rapport…» er øvst i Rapport-menyen.

## Endringar (endringsmeldingar) — 7. nov. 2026

- Lagra på aktiviteten: `e.endringar = [{ id, nr ('E1'…), namn, rev:{timar,fastpris,timepris}, god:{…same…}, overfort, for:{timar,budsjett,timerate,modus}, overfortDato }]` (følgjer planen, ingen ny tabell).
- Fane «Endringar» til venstre for «Leveranseregister» i registeret under tabellen (`EndringsRegister` i `FramdriftBemanning.jsx`): alle endringar i prosjektet, med kolonnegruppene «Revidert (frå kontoret)» og «Godkjent av kunde» (same tre felt: nytt timebudsjett, fastpris, timepris), rad nedst for ny endring (nummer føreslått automatisk).
- Haka «Overfør» (`overforEndring` i `FramdriftModule.jsx`): godkjent verdi (elles revidert) → aktivitetens `timar`/`budsjett`/`timerate` (`modus` vert `timar`, eller `budsjett` når berre fastpris er gitt). Gamle verdiar vert lagra i `for`; å fjerne haka set dei attende. Overførte endringar er låste.
- Høgreklikk på ei aktivitet (tidslinje og tabell) → «Legg til endring» (delegert `onContextMenu`; rader har `data-fd-id` / `data-radid`).
- «＋ Ny» står først (heilt til venstre) i verktøylinja.
- PDF-rapport: kolonnebreidder målt frå innhaldet (ingen avkorting av tal; heile tabellen vert forminska jamt viss det er for trongt, `bytes.skala`), tekst vert brotten over fleire linjer, tynnare skiljestrekar og ytterkant rundt tabellen.

## Revisjon 7. nov. 2026 (kveld) — rapport, endringar og aktivitetstype

- **Aktivitetstype** (feltet `budsjettType`, kolonne `btype`, tidlegare «Budsjettype»): verdiane er `Budsjett`, `Fastpris`, `Budsjett med tak`, `Ufakturerbar`, `Opplæring` (`BTYPAR`/`normAktType` i `framdriftVerdiar.js`; gamle `Budsjettpris`/`Ufakturerbart` vert vist som `Budsjett`/`Ufakturerbar`). Kolonnen står i tidslinje, tabell, Excel-eksport, endringsregisteret (`en.akttype`) og rapportane (info-seksjonen, med i begge standardrapportane).
- **Endringar vert LAGDE TIL aktiviteten** (ikkje erstatning): timar = gamle + endringa sine; budsjett = gammalt (eller timar × snittpris) + fastpris + timar × timepris. Timepris gjeld berre timane i endringa; `timerate` og tidlegare estimat er uendra. Fjerna hake set tilbake `for`-verdiane. Endringstabellen har eigne tekstfelt (ikkje pilfelt), «Timebudsjett» og produktkolonne timar × pris for både revidert og godkjent.
- **Intern rapport:** rad «+/- budsjett» under kvar person (forbruk − planlagd, timar og kr). Farge: raud (+, over 120 % av budsjett), gul (10–20 % avvik), grå (under 10 %), blå (under 80 %).
- **PDF:** svarte celleramma i overskrifta, mørkeblå strek under overskrifta, tynn strek mellom prognoseperiodane, gruppeoverskrifter vert brotne over fleire linjer.

## Endringsvarsel — 8. nov. 2026

- Prosjektplan → «＋ Ny» → «Ny endring» opnar `FramdriftEndringsvarsel.jsx` (flytande vindauge: flytt, endre storleik, maksimer; lukking med ulagra endringar spør «Vil du lagre utkastet?»).
- Innhald: tittel, kopling til éi eller fleire rader i endringstabellen (`e.endringar`), val 1 Behov for å justere budsjettet / 2 Endringsforslag / 3 Anna (kvar med beskriving og konsekvensar for framdrift), honorar-linjer (aktivitet, timar, timepris, timar × pris, fastpris, sum) og utgiftslinjer, kostnadstabell per aktivitet med totalsum, utarbeidd av + dato, vedlegg (dra inn / vel fil → bøtta `dtm-resultatdokument` under `<user>/<prosjekt>/endringsvarsel/<mappe>/`; eller referanse til `dtm_dokumenter`).
- Lagring: tabell `framdrift_endringsvarsel` (status `utkast`/`ferdig`, `innhald` jsonb). SQL i `notatapp/supabase-framdrift-endringsvarsel.sql` — **må køyrast manuelt i Supabase SQL Editor** (migrasjonen frå Claude vart avvist av løyvesystemet).
- Ikkje bygd enno: PDF/utsending av varselet, varsling til kunde, kopling av ferdig varsel tilbake til endringstabellen.

## Endringsvarsel: PDF, utsending, status og tilbakeføring — 8. nov. 2026 (kveld)

Bygger på «Endringsvarsel — 8. nov. 2026» (tabellen `framdrift_endringsvarsel` er oppretta). **Inga ny migrasjon**: alt nytt ligg i `innhald` (JSONB).

- **Utsending** (`innhald.utsending`): `{status, sendtDato, sendtTil, sendtMetode, svarDato, svarFra, merknad, logg:[{status,dato,av,tekst}]}`. Statusar (`ENDR_STATUSAR` i `framdriftVerdiar.js`): Utkast, Sendt til kunde, Godkjent, Avvist. Bytte av status set dato automatisk og legg ei linje i loggen. Tabellkolonnen `status` (utkast/ferdig) vert «ferdig» så snart utsendingsstatusen er noko anna enn Utkast.
- **Status i endringstabellen**: kolonnane Status og Statusdato på kvar endring (`en.status`, `en.statusDato`, `en.varselId`, `en.varselStatus`, `en.varselTittel`). Ved lagring av varselet vert statusen førd til kopla endringar, men berre når varselet er nytt for endringa eller utsendingsstatusen er endra (ei manuell endring i tabellen vert ikkje overskrive). Vert varselet «Godkjent», spør vindauget om reviderte kostnader skal kopierast til «Godkjent av kunde» (berre der dette er tomt). `FramdriftModule.settEndringarSamla()` lagrar fleire endringar i éin `oppdater()`.
- **Tilbakeføring**: knappen «↑ Før tilbake til endringstabellen» skriv honorarlinjene til `rev` (timar, fastpris, vekta timepris = Σ(timar×pris)/Σtimar) for kvar kopla endring. Honorarlinja har ny kolonne «Endring» (`h.endring`); linjer utan endring høyrer til den einaste kopla endringa på same aktivitet. Endringar som alt er lagt til aktiviteten (`overfort`) vert hoppa over. Utgifter har ingen kolonne i endringstabellen og vert ikkje førte tilbake.
- **PDF**: `framdriftVarselPdf.js` (`lagVarselPdf`, A4 ståande, pdf-lib): tittelfelt med utarbeidd/dato/status, endringar, valde punkt med beskriving og framdrift, honorar- og utgiftstabell, kostnader per aktivitet med totalsum, vedlegg, utsending. Knappar nederst: «⬇ PDF» (lastar ned) og «PDF → vedlegg» (lagrar i bøtta og legg til som vedlegg, t.d. versjonen som vart sendt).
- **Autolagring**: eit alt lagra varsel vert lagra 12 s etter siste endring. Nye varsel må lagrast manuelt éin gong.

## Rapport: rettingar — 8. nov. 2026 (natt)

- **«+/- budsjett» samanliknar mot planlagd for same tidsrom**: før vart påløpt til no rekna mot HEILE planlagde timar. No: `planlagdIntervall()` (framdriftRapport.js) summerer planlagde timar (veketimar jamt på man-fre, same fordeling som prognosen) frå start til periodeslutt (akkumulert) og innanfor perioden. Raden gir to avvik: under «Påløpt akkumulert» (`palopTimar/palopKr`) og under «Påløpt i perioden» (`perTimar/perKr`), kvar med eigen farge (`farge`/`fargePer`). Kroner = timar × personens timerate.
- **Inga rad utan planlagt forbruk**: manglar personen planlagde timar både akkumulert og i perioden, vert «+/- budsjett» ikkje laga.
- Seksjonen «Påløpt totalt» heiter no **«Påløpt akkumulert»** (SEKSJONAR, toppteksten i PDF og vindauget).
- Tynne månadsstrekar startar under den øvste overskriftsrada (`skiljeLinjer(…, yTynnTopp)`).
- **Firmalogo** øvst til høgre i PDF-en (`norconsultLogo.js`, same logo som tegningslista).
- **Lagre PDF → arkiv**: knappen «💾 Lagre PDF» lagrar i `<oppdragssti>\1 Oppdragsleiing\4 Rapportering` (mappa vert oppretta) via ny Electron-handler `framdrift:lagre-rapport` (preload: `framdriftLagreRapport`). Finst namnet frå før vert fila « (2)» osv. Uten skrivebordsapp/låst oppdragssti: vanleg nedlasting. «⬇ Last ned» er behalden for manuell lagring. **Krev omstart av Electron** (ny preload/main).
- **Filnamn** (`rapportArkivNamn`): `<oppdragsnr> <oppdragsnamn> rapport (M09 - M10)`; veke-visning gir `V37 - V40`. Tosifra nummer so mappa sorterer rett. Intern rapport får `rapport intern` for at ho ikkje skal kollidere med kunderapporten.

## Tabellar, høgreklikk, sletting og rapport-rettingar — 9. nov. 2026

- **Høgreklikk-meny på rad** (alle visingar: tidslinje, Veke, Månad): Legg til endring · Ny summasjonsaktivitet (etter vald rad, same nivå) · Gjer om til / Opphev summasjonsaktivitet · **🗑 Slett** (raud, nedst). `FramdriftModule.radMeny`/`kontekstRad`. «＋ Ny» har òg «∑ Ny summasjonsaktivitet» nedst (`leggTil('summasjon')`).
- **Vern**: rader (og overordna med underaktivitetar) med påløpt/importert timeføring (`harPaalopt`: palopTimar/palopHonorar/forbrukKart) kan verken slettast eller gjerast om til summasjonsaktivitet. Same vern i registeret for endringar (ikkje når «Lagt til») og bemanning (ikkje ressurs med ført tid).
- **Gjenoppretting**: kvar sletting krev stadfesting, kan angrast (Ctrl+Z / ↶ Angre) og ligg i «🗑 Sletta»-lista i verktøylinja (`papirkorg`, localStorage per prosjekt, maks 30). Gjenoppretta rader hamnar sist blant søskena.
- **Dra-og-fyll**: tidslinjetabellen (klikk ei redigerbar celle → handtak nede til høgre → dra opp/ned; `onFyll`/`fyllKolonne`, eitt angresteg) og endringsregisteret. DataTabell (Veke/Månad) hadde det frå før. `settFelt/settFelter` byggjer no på `elRef.current` (siste plan) slik at fleire raske endringar ikkje overskriv kvarandre.
- **Kolonnelås**: høgreklikk kolonneoverskrifta → «Lås kolonnen for redigering». Gjeld tidslinjetabellen (localStorage `liedlab-framdrift-laasa-kol`), alle DataTabell-tabellar (`prefs.laasa`, òg via kolonnemenyen ▾) og registera (endringar/bemanning). Låsing stoppar berre redigering for hand — import og automatiske oppdateringar går uhindra.
- **Hover**: rad lyser opp (tidslinja både i tabell og stolpeområde; DataTabell med venstrekant); registera får hover og tydeleg celle-fokus.
- **Dra i hierarkiet**: ⠿-handtak i namnecella også i Veke/Månad (over/under ei rad = same nivå, midt på = underaktivitet; `kanFlytteTil`). Tidslinja hadde det frå før.
- **Endrings- og bemanningsregister**: delt `useRegister`/`REG_CSS` i FramdriftBemanning.jsx — justerbare kolonnebreidder (dra i overskrifta, dobbeltklikk = standard; localStorage), heile cella er innfelt, høgreklikk → lås/slett. Dra-og-fyll berre i endringsregisteret (ikkje i bemanningsregisteret).
- Fana «Tabell» heiter no **«Veke»**.
- **Rapport**: botntekst = `<kontornamn> · Utarbeida i LiedLab · generert av …` (kontornamn frå aktivt kontor, `kontorNamn` frå App.jsx); eigen **overskrift** (og undertittel) kan setjast også på standardrapportar (gjeld berre utskrifta); arkivnamn har **årstal** (`rapport (2026 M09 - M10)`, `(2026 M12 - 2027 M01)` over årsskifte).

## Rapport: avvik på aktivitetsnivå og prognoseslør — 10. nov. 2026

- «+/- budsjett» (påløpt − planlagd for same tidsrom, akkumulert og i perioden, fargekoda) kjem no også under **kvar aktivitet**, **kvar summasjon/fase** (òg «Sum …»-radene med delsum) og under **totalsummen**, i tillegg til personradene. Planlagd er summert frå underaktivitetane (`planAkkT/planPerT/planAkkKr/planPerKr` i `lagTal`; felles `avvikRadFra`). Val «+/- budsjett på aktivitets- og summasjonsnivå» (`oppsett.avvikAktivitet`, standard på) i Rader-lista.
- Prognosekolonnane har eit svakt grått slør (opacity 0,12) i PDF-en.

## Rate for ressursar utanfor bemanninga — 10. nov. 2026

Ressursar som har ført timar (import) men ikkje er med i aktivitetens bemanning (`utanPlan`-rader i bemanningsregisteret) har no eit redigerbart ratefelt. Raten ligg på aktiviteten som `e.utanPlanRate` (`{ <namn med små bokstavar>: kr/t }`) og vert lest via `rateUtanPlan()` i framdriftTimar.js (fell tilbake til Personell-rate, deretter aktivitetens rate). Brukt i påløpt kostnad i rapport, tabell, tidslinje og importert forbruk.

- 10. nov. 2026: «+/- budsjett» vert ikkje laga for aktivitetar utan planlagde (fordelte) timar. Summasjonar tel då berre med underaktivitetane som har plan. (Aktivitetstype Fastpris vert IKKJE unnateke.)

## Rapport: kolonnar for avvik, framdrift og fastpris — 10. nov. 2026 (kveld)

- **«+/- budsjett» er no kolonnar**, ikkje eigne rader: «+/- budsjett (kr/timar)» bak påløpt under «Påløpt akkumulert» (`avvikAkkKr/Timar`) og under «Påløpt i perioden» (`avvikPerKr/Timar`), fargekoda per celle (`farge`/`fargePer`) på aktivitet, person, summasjon, delsum og totalrad. Avviket er rekna i `lagTal` (0 utan plan) og summerast oppover; fargen er avvik ÷ planlagd. Kolonnane er med i begge standardrapportane.
- **Ingen samanlikning når berre budsjett er lagt inn**: `planlagdIntervall` gir 0 for `modus === 'budsjett'` (timane er utleidde frå budsjettet, ikkje fordelte på veker) og for aktivitetar utan fordelte timar.
- Prognosen har grå (ikkje blå) overskrift (+ det svake grå sløret i radene).
- **Intern rapport: «% faktisk framdrift (timevekta)»** (`ferdigPct`, seksjon Påløpt akkumulert): aktivitetens effektive ferdig-% (`effektivFerdig`), og for summasjonar/total vekta med planlagde timar (`ferdigVekt`). Kravde `dokMap` inn i `byggRapportData`.
- **Fastpris vs. budsjett**: Fastpris (kontraktsbeløp) og Budsjett (medgått tid) ligg framleis i same felt `e.budsjett`, men vert viste i kvar si kolonne etter aktivitetstype (`erFastpris`). Ny kolonne «Fastpris kr» i tidslinjetabellen (localStorage-nøkkel v5), Veke/Månad og rapportane (`fastpris`, `budsjettVis`). Å skrive i Fastpris-kolonna set aktivitetstypa til Fastpris; å skrive i Budsjett-kolonna på ei Fastpris-aktivitet byter typa til Budsjett.

## Lagre status, framdrift = % brukt og spreiing — 10. nov. 2026 (natt)

- **Spreiing**: «+/- budsjett» i rapporten vert berre rekna når timane er spreidde gjennom tidsrommet: `fordeling` er Start/Midt/Slutt/eigen, eller brukaren har sett fordelinga (`e.fordelingSett`, sett frå Timar-panelet/tabellen, nullstilt av «Nullstill»). Standard «Fast» utan val, og modus `budsjett`, gir ingen avvik (`planlagdIntervall`). Eksisterande aktivitetar med uendra standardfordeling mistar dermed avviket til fordelinga vert sett.
- **Rapport-menyen → «Sett framdrift = % brukt…»** (`justerFramdriftTilForbruk`): setter `ferdig` (skjønn) for alle aktivitetar med budsjett/fastpris lik påløpt honorar ÷ budsjett (maks 100 %). Eitt angresteg.
- **«Lagre status»-meny** (`FramdriftStatusModal.jsx`, tabell `framdrift_statusar`, migrasjon `supabase-framdrift-statusar.sql` — køyrast manuelt): «Lagre ny status…» (rekneskapsmånad eller heile veker; namn `ÅÅÅÅ-MM` / `ÅÅÅÅ-VV` + dato lagra; kort beskriving; lagrar planen + påløpt til periodeslutten) og «Hent tidlegare lagra status…» (liste; spør om gjeldande plan skal lagrast som **kladd** — berre siste kladd per prosjekt, ligg i same lista; henting erstattar planen og kan angrast).

## 11. nov. 2026 — Påløpt %-kolonne og «Sett faktisk framdrift lik påløpt»

- Nye kolonnar i tabellen ved sida av tidslinja: **Påløpt t** (fanst) og **Påløpt %** (`palopPct` i `framdriftVerdiar.js`: påløpt honorar ÷ budsjett/fastpris, utan budsjett planlagde timar × snittrate; summasjon/fase = sum av aktivitetane under). Begge er med i standardkolonnane; lagra kolonneval vert flytta til `liedlab-framdrift-tl-kol-v6`.
- `justerFramdriftTilForbruk(rotId)` i `FramdriftModule.jsx`: set `ferdig` = påløpt % av budsjett/fastpris (maks 100) for aktivitetar. `rotId = null` = heile planen, elles aktiviteten/summasjonen/fasen og alt under.
- Høgreklikk på overskrifta «Ferdig %» (heile planen) og høgreklikk på ei rad (aktivitet, summasjon, fase) gir valet «Sett faktisk framdrift lik påløpt av budsjett/fastpris». Stadfesting og «Angre» som før.

## 11. nov. 2026 (kveld) — Felt tok ikkje imot tastetrykk etter stadfestingsdialog

- Symptom: etter «Sett faktisk framdrift lik påløpt…» (og andre `window.confirm/alert`) kunne ingen tal/tekstfelt endrast (tidslinjetabell, rapportoverskrift). Årsak (truleg): Electron/Windows-feilen der den innebygde dialogen held att tastaturfokuset; `fokusFiks` (preload) var ikkje nok.
- Fiks: `FramdriftModule.jsx` har no ein eigen, asynkron `spor(tekst, berreOk)`-dialog (state `dialog`) i staden for `window.confirm/alert` (justering av framdrift, sletting, opphev summasjon, endringsvarsel-feilmelding). `fokus-fiks` i `electron/main.js` prøver no tre gonger (0/80/300 ms). **main.js-endringa krev omstart av skrivebordsappen.** Dei andre Framdrift-filene (Bemanning, Endringsvarsel, Rapport, Timar-/Personpanel, Status) brukar framleis `window.confirm` og kan byttast til same mønster ved behov.
