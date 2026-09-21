# Resultatdokument-modul (august 2026) — Del 1

Ny modul i LiedLab-appen: **Resultatdokument** («Rd» i venstre fane). Lèt
arkitekten dra teikningar/dokument frå Windows Utforskar og sleppe dei i
appen, som så plasserer dei i riktig prosjektmappe på disken — med automatisk
versjonshandtering.

## Kvifor Electron vart bygd på nytt

`package.json` peikte alt på `electron/main.js`, men fila fanst ikkje —
skrivebordsversjonen har difor aldri hatt ekte filsystemtilgang. Ei vanleg
nettside kan av tryggleiksgrunnar ikkje skrive filer på disken uansett, så
denne funksjonen kan berre fungere frå ein ekte Electron-prosess.

Løysinga er ei **tynn Electron-skal** rundt den vanlege, live nettsida:

- `electron/main.js` opnar eit vindauge som fyrst prøver den lokale
  dev-serveren (`http://localhost:5173/liedlab/notatblokk/`, viss `npm run
  dev` køyrer i ein annan terminal — nyttig for å teste endringar før dei er
  pusha), og fell elles tilbake til den live nettsida
  (`https://liedarkitektur.no/liedlab/notatblokk/`). Registrerer i tillegg
  nokre få IPC-funksjonar for filoperasjonar.
- `electron/preload.js` eksponerer desse som `window.resultatdokumentAPI` i
  sida, avgrensa til akkurat det Resultatdokument-modulen treng.
- Alt anna i appen (Notatar, Oppgåver, Saker, Kunde, Farge, Kvalitetssystem,
  Timar) er **heilt uendra** og fungerer likt i nettlesar og skrivebordsapp.
  Vanlege kodeendringar (push til `main`) gjeld difor begge kanalar momentant
  — berre dersom sjølve fil-brua (`electron/`-mappa) vert endra, må ein byggje
  ein ny installasjonsfil (`npm run dist`) og dele han ut på nytt.
- Sida sjekkar sjølv om brua finst (`window.resultatdokumentAPI`). Opnar du
  via vanleg nettlesar, viser Resultatdokument-fana ei melding om at
  funksjonen krev skrivebordsversjonen, i staden for droppsona.

Ingen nye avhengigheiter (npm-pakkar) var nødvendige — `electron` var alt
installert.

## Prosjektsti

Kvart prosjekt har no eit felt **«Sti til resultatdokument-mappe»** i
Prosjekt-modulen (t.d. `…\Prosjekt\26001\03 Resultatdokumenter`), med ein
«Bla gjennom…»-knapp (native mappeveljar) når appen køyrer i Electron.
Stien ligg i det same fleksible `details`-JSONB-feltet på `projects`-tabellen
som resten av prosjektkortet — **ingen ny Supabase-tabell eller -kolonne var
nødvendig**.

## Versjonering

Når ei fil vert sleppt i modulen:

1. Teikningsnummer og revisjon vert tolka frå **filnamnet** — same mønster
   som `parse_filnamn()` i `pdf_vaktar.py` (KS-modulen sin PDF-vaktar):
   `A-20-01_B.pdf` → nr `A-20-01`, rev `B`. Støttar òg `nr rev B.pdf` og
   `nr(B).pdf`, med `A` som standard om ikkje noko mønster passar.
   (Dette er den einaste revisjons-uthentinga som finst i kodebasen frå før —
   `les_tittelfelt()` i same fil søkjer gjennom PDF-innhaldet, men berre
   etter tittel/målestokk/signaturar, ikkje revisjon.)
2. Finst det frå før ei fil i mappa med same teikningsnummer, vert **den
   gamle fila** flytta til ei undermappe **«Versjoner»**, med `_REVx` lagt
   til filnamnet (t.d. `A-20-01_B_REVB.pdf`).
3. Den nye fila vert plassert direkte i resultatdokument-mappa.

Fungerer for alle filtypar (ikkje berre PDF), sidan tolkinga skjer på
filnamnet.

## Del 2 (ikkje starta)

Utsett av brukar til del 1 er verifisert i praksis.
