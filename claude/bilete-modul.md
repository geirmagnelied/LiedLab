# Bilete-modulen (29. sept. 2026)

## Kvifor eiga tabell, ikkje ein ny DTM-kategori

Bilete har ei heilt anna metadata-form enn DTM sine dokument (dato teke,
GPS-plassering, kven som tok det — ingen revisjons-/fase-/kategori-omgrep
i det heile). Difor: éin eigen tabell `dtm_bilete`, IKKJE eit 6. JSONB-
kategorifelt på `dtm_dokumenter`. Løpenummeret (`BIL-XXX`) er løpande PER
PROSJEKT (til skilnad frå DTM sine EDOK-/SD-nummer, som er per-brukar på
tvers av prosjekt) — sjå `genererBilNummer()`/`nesteBilNummer()` (main.js
har sin eigen kopi av utrekninga, same mønster som DTM_KATEGORI_MAPPE alt
er dupliserte mellom dtmKonstantar.js og main.js).

Modulen er sin EIGEN AppRail-oppføring (`bilete`), ikkje ein del av DTM-
modulen sjølv — enklare å byggje vidare fleire biletverktøy på seinare,
og unngår å presse ein heilt annan datamodell inn i DTMTabell sine
kolonnedefinisjonar.

## Mappe: «8 Bilete»

**MERK — talkollisjon**: `OPPDRAGSMAPPER` i `electron/main.js` har FRÅ FØR
«8 Diverse» som mappe nummer 8. Brukar sitt eige krav 29. sept. 2026 var
uttrykkeleg «8 Bilete» — koden lagar denne SOM EI NY, TILLEGGSMAPPE ved
sida av «8 Diverse» (aldri omdøyper/flyttar noko eksisterande). Begge vil
altså liggje side om side i prosjekt som alt har «8 Diverse». Rydd opp
manuelt i eksisterande prosjekt om ønskt.

## Nummerering og datostempel

- `BIL-XXX` (tresifra, løpande per prosjekt) — tildelt av
  `electron/main.js` (IKKJE av renderar-koden, ulikt EDOK/SD, sidan
  hovudprosessen alt gjer heile import-arbeidet i éin operasjon her).
- EXIF (`exifr`, rein JS — INGEN native avhengigheit, sjå grunngjeving
  under) gjev `dato_tatt` (DateTimeOriginal/CreateDate) og `plassering`
  (GPS lat/long som tekst, IKKJE reverse-geocoda til ei adresse enno —
  naturleg utviding seinare, krev eit eige geocoding-kall).
- **Datostempel**: eit KVITT, HØGREORIENTERT «åååå-mm-dd»-merke vert baka
  inn nede i høgre hjørne av biletet FØR det vert lagra. Gjort via eit
  SKJULT `BrowserWindow` + `<canvas>` (`executeJavaScript`, ingen
  `ipcRenderer`/`nodeIntegration` nødvendig — resultatet hentast direkte
  som eit Promise-svar), IKKJE eit biletbehandlingsbibliotek som `sharp`.
  Grunngjeving: `sharp` er ein NATIV Node-addon som må byggjast om for
  Electron sin eigen Node-ABI — electron-builder har alt synt seg ustabilt
  på denne maskina utan Windows Developer Mode (sjå samtalen 28. sept.
  2026 om `npm run dist`-feilen), så ein ny native avhengigheit hadde vore
  eit unødig risikopunkt. Canvas-metoden bruker berre Chromium sin EIGEN,
  alt bunta rendering — same tryggleiksval som Tegningsliste-PDF-
  generatoren (`printToPDF`) tidlegare i prosjektet.

## Import — to vegar

1. **Skrivebords-drag-og-slepp** (krev `harBru`/Electron) —
   `bilete:importer`-IPC-en les EXIF, stemplar dato, flyttar til
   «8 Bilete» DIREKTE, éin operasjon.
2. **Mobil/nettlesar-opplasting** — fungerer i EIN KVAR nettlesar (ingen
   Electron-bru), sidan `BileteModule.jsx` sjølv køyrer i nettlesaren via
   den vanlege web-utgåva av appen. Bilete vert lasta opp til Supabase
   Storage-bucketen `bilete-mobil` (privat, RLS avgrensa til
   `<auth.uid()>/...`-mappa), pluss ei kø-rad i `bilete_mobil_ko`.
   Skrivebordsappen viser talet på ventande bilete for AKTIVT PROSJEKT og
   hentar dei ned på førespurnad («Hent bilete frå mobil») via
   `bilete:importer-fra-bytar` (SAME EXIF/stempel/nummer-logikk som over,
   berre med bytes lasta ned av renderar-koden i staden for ein lokal
   filsti). Storage-objektet og kø-rada vert SLETTA etter vellukka import.

## Datamodell

Sjå `supabase-bilete.sql`: `dtm_bilete` (nr, filnamn, dato_tatt,
plassering, teke_av, importert_av, importert_dato, kjelde), `bilete_mobil_ko`
(kø-rader for uprosesserte mobil-opplastingar), Storage-bucket
`bilete-mobil` (privat).

## Retta 30. sept. 2026

- **Dato teken var feil** (synte fil-endringsdato, ikkje EXIF-datoen):
  `exifr.parse()` vart kalla med `pick: ['DateTimeOriginal', ..., 'latitude', 'longitude']`
  — men `latitude`/`longitude` er UTREKNA av exifr ETTER vanleg parsing
  (frå dei rå GPS-tagga), og `pick` filtrerer FØR den utrekninga skjer.
  GPS vart difor alltid tomt, og (urelatert, men saman rapportert)
  code-gjennomgangen avdekte at dette óg gjorde datosøket skjørare enn
  nødvendig. Retta ved å BERRE styre kva SEGMENT som vert lese
  (`tiff/exif/gps`, ikkje `pick`), og hente GPS via exifr sin eigen
  `exifr.gps()`-hjelpefunksjon i staden for `pick`-filtrering.
- **EXIF forsvann frå det lagra biletet**: `<canvas>.toDataURL()` skriv
  ALDRI metadata — det stempla biletet hadde difor ALLTID mista all EXIF
  (dato, GPS, kamera osv.), stikk i strid med brukar sitt krav. Retta ved
  å lese EXIF-dictet frå originalfila FØR canvas-steget (`piexifjs`, rein
  JS) og setje det attende inn i det ferdig stempla biletet etterpå.
  Berre JPEG (piexifjs sitt einaste støtta format); feilar aldri heile
  importen om attsetjinga skulle mislykkast.

## Kjende avvik / bevisste forenklingar (fyrste versjon)

- **«teke av»**: EXIF har SJELDAN eit pålitande «kven tok biletet»-felt
  (telefonar skriv nesten aldri `Artist`-taggen). Fell difor tilbake til
  IMPORTERANDE BRUKAR sitt namn, redigerbart i etterkant.
- **«plassering»**: rå GPS-koordinatar som tekst, IKKJE reverse-geocoda
  til ei lesbar adresse — krev eit eige, separat geocoding-API-kall,
  naturleg neste steg.
- Ingen gjennomgangs-/rettesteg før import (ulikt DTMImportModal) — sidan
  nummereringa ALLTID er auto-generert (ingen kode å gjette feil på),
  vart dette vurdert som mindre kritisk enn for DTM-dokument. Metadata kan
  rettast i etterkant, direkte i tabellcella.
- **Importknapp «i DTM-modulen»**: brukar sitt fyrste ordval bad om
  importknappen i sjølve DTM-modulen; det vart avgjort å heller gje Bilete
  sin eigen, fullstendige import-UI i sin eigen modul (unngår duplisert
  import-logikk to stader) — kan leggjast til som eit ekstra snarveg-val i
  DTM sin «+ Import»-meny seinare om ønskt.
- Bilete er IKKJE kopla på `sok_index` (søk) enno — same trigger-mønster
  som notes/cases/dtm_dokumenter kan leggjast til raskt, sjå
  claude/sok-modul.md.
