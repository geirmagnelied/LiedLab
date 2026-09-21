# Kvalitetsmodul (KS) — teikningsregister, Del A (august 2026)

Kvalitetsmodulen (`src/KvalitetModule.jsx`) var ein frittståande prototype med
hardkoda data (falske teikningar, fast 3-personars team, ingen lagring —
alt forsvann ved omlasting) og dårleg tilpassa grafikk (smal ~600 px
wrapper, 17–18 px skrift). Denne omgangen (Del A) byggjer eit ekte,
per-prosjekt teikningsregister på same måte som Resultatdokument-modulen
handterer filer, og gjer om heile grafikken til appen sitt standard-oppsett.

## Dra-og-slepp kor som helst → skann → register

Same mønster som Resultatdokument-modulen, med eiga fil-bru i same
Electron-skal — men utan eiga dropsone: heile modul-vindauget er
droppmål (drag/drop-handterarane ligg på rot-elementet i
`KvalitetModule.jsx`, ikkje ein avgrensa boks), sidan brukar synest ei
dedikert sone tok for mykje plass og var unødvendig avgrensande.

1. Arkitekten dreg teikningar/dokument inn kor som helst i vindauget.
2. `window.resultatdokumentAPI.ksSkannOgLeggTil()` (IPC `ks:skann-og-legg-til`
   i `electron/main.js`) flyttar filene til
   `<resultatDokSti>/kontroll/til kontroll/`, tolkar filnamnet (nr/rev, same
   `parseFilnamn()` som Resultatdokument-modulen) og — for PDF-ar — les
   tittelfeltet med `pdfjs-dist` (sjå eige avsnitt under).
3. Renderar-koden lagrar/oppdaterer éi rad per fil i Supabase-tabellen
   `ks_teikningar` (finst frå før på nr → oppdaterer; elles set inn ny rad).
   Fag og fase vert gjetta frå teikningsnummer-koden (sjå under), og kan
   alltid rettast manuelt.

Ein Info-knapp («i») i topbaren i modulen forklarer dette (og kode-tabellen
under) direkte i appen.

Registeret (og resten av modulen, bortsett frå sjølve dra-og-slepp) er
tilgjengeleg både i skrivebordsappen og i vanleg nettlesar — berre
fil-innlesinga krev skrivebordsversjonen, akkurat som i Resultatdokument.

## Teikningsnummer-koden

Kontoret sin faktiske nummerkonvensjon (retta etter tilbakemelding — fyrste
forsøk hadde feil kodetabell):

```
<fagbokstav>-<type>-<løpenr>-<fase>     t.d.  A-40-02-02 = Arkitekt, Snitt, løpenr 2, Forprosjekt
```

| Type (ledd 2) | | Fase (ledd 4) | |
|---|---|---|---|
| 10 | Situasjonsplan | 01 | Skisseprosjekt |
| 20 | Plan | 02 | Forprosjekt |
| 40 | Snitt | 03 | Tilbodsteikning |
| 45 | Fasade | 04 | Søknadsteikning |
| 50 | Detalj | 05 | Detaljprosjekt |

`tolkTeikningsnr()` i `KvalitetModule.jsx` les type- og fase-kodeleddet
(fagbokstaven i ledd 1 og løpenummeret i ledd 3 vert ikkje lagra som eigne
kolonnar enno — berre brukt til å plukke ut dei to andre). Feiltolking
rettar ein rett i tabellen (sjå «Redigering» under).

## PDF-tittelfelt: `pdfjs-dist`

`les_tittelfelt()` frå `pdf_vaktar.py` (det gamle Python-skriptet) er porta
til `electron/main.js` (`lesTittelfelt()`), med alle sju regex-mønstera
(målestokk/tittel/teikna av/egenkontroll/fagkontroll/dato/format) uendra.
`pdfjs-dist` finst frå versjon 6 berre som ES-modul (`legacy/build/pdf.mjs`,
ingen CommonJS-bygg), så innlastinga skjer med ein cacha dynamisk `import()`
frå den elles CommonJS-baserte `main.js`.

**Feil oppdaga og retta (30. august):** tittelfeltet vart ikkje lese i
praksis. Årsak: `pdfjs-dist` sin `getTextContent()` gjev tekst som mange
separate, posisjonerte tekst-bitar (typisk éin per ord/tekst-run) — IKKJE
ferdige linjer. Det gamle Python-skriptet brukte `pdfplumber`, som klyngjar
bitar etter Y-posisjon til visuelle linjer for deg; den fyrste porten hoppa
over dette steget og limte berre saman éin bit per «linje» i rekkjefølgja
pdfjs leverte dei — så t.d. «Målestokk:» og «1:100» hamna på kvar si linje,
og regex-mønstera fann aldri kvarandre. `lesTekstFraSide()` grupperer no
tekstbitar med nesten lik Y-posisjon til éi linje (sorterte etter X
innanfor linja) før regex-tolkinga køyrer — verifisert mot ein syntetisk
testteikning med same oppsett som eit ekte tittelfelt (feltnamn og verdi
som separate tekst-objekt), der alle sju felta no vert lest korrekt.

`lesTittelfelt()` loggar no òg den lesne teksten og det tolka resultatet
til konsollen (terminalen der `npm run electron`/`npm run dev` køyrer),
og eventuelle feil vert logga i staden for svelgde stille. Er det framleis
teikningar som ikkje vert tolka rett, er neste steg å sjå på denne
konsoll-loggen for akkurat den fila — send innhaldet hit, så kan
regex-mønstera justerast etter korleis kontoret sitt faktiske tittelfelt
er ordlagt (dei er framleis dei same generiske mønstera som i
`pdf_vaktar.py`, aldri verifisert mot eit ekte tittelfelt frå kontoret).
Feilar PDF-lesinga heilt (skanna bilete, uvanleg oppsett), fell koden
stille tilbake til filnamn-tolking åleine for nr/rev.

**Ny avhengigheit:** `pdfjs-dist` er lagt til i `package.json`. Krev
**éin gong** `npm install` før appen køyrer med denne versjonen.

## Redigering: dobbeltklikk, som i eit rekneark

Alle felt i registeret (unnateke «Lasta opp») kan rettast med **dobbeltklikk**
direkte i tabellcella. **Tab**/**Shift+Tab** lagrar og flytter til neste/førre
redigerbare kolonne i rada, **Enter** lagrar og lukkar, **Escape** avbryt.
Fag og fase vert redigert med nedtrekksmeny (fast verdiliste), resten som
fritekst. Dette er ei generalisering av `DataTabell.jsx` (kolonneflagget
`redigerbar` + valfri `val`-liste, sjå `onSetVerdi`-prop og `RedigerCelle`) —
tidlegare kunne berre «eigne kolonnar» i saksmodulen redigerast slik.

## Opne fil i standardprogram — og skriveverna resultatdokument

Både i Resultatdokument-modulen (filliste) og i KS-registeret (Nr.-kolonna
i tabellen) kan brukar no **klikke på filnamnet/teikningsnummeret** for å
opne pdf-en i systemet sitt standard pdf-lesar (`shell.openPath()`, nye IPC-
endepunkt `resultatdokument:apne-fil` og `ks:apne-fil` i `electron/main.js`,
eksponert som `window.resultatdokumentAPI.apneFil()`/`ksApneFil()`).

I `DataTabell.jsx` er dette eit generisk kolonneflagg (`opnaFil:true` +
`onOpneFil(rad, key)`-prop), same mønster som `redigerbar`. Nr.-kolonna i
teikningsregisteret er **både** `opnaFil` og `redigerbar` (klikk opnar fila,
dobbeltklikk rettar teikningsnummeret) — dei to vert skilde med ein 220 ms
debounce (ein enkel/dobbelklikk-disambiguering), sidan begge handlingane
skjer på same celle.

Filene har ulik skrivetilgang etter kva mappe dei ligg i, sidan dei har
heilt ulik status:

- **Resultatdokument** er ferdige, leverte dokument — filene vert sett
  **skriveverna** (`fs.chmodSync(sti, 0o444)`, hjelpefunksjonen
  `gjerSkriveverna()`) med det same dei hamnar i mappa (både ved vanleg
  opplasting og retroaktivt på eksisterande filer, via `resultatdokument:list`).
  Skal ein leggje inn ei ny revisjon, gjer ein det via appen (som flyttar den
  gamle versjonen til «Versjoner» og skriv den nye), ikkje ved å redigere
  fila direkte. `flyttFil()` er samstundes herda til å fjerne
  skriveverna (`chmod 0o666`) på kjeldefila før flytting/overskriving, slik
  at ei tidlegare skriveverna fil framleis kan supplerast av ei nyare
  revisjon.
- **KS-registeret** («til kontroll») er framleis under aktiv kontroll —
  desse filene er **ikkje** skriveverna, og kan redigerast direkte utanfor
  appen om nødvendig.

## Datamodell

To migrasjonar, sjå `supabase-ks-teikningar.sql` og `supabase-ks-fase.sql`
(begge trygge å køyre fleire gonger):

| Kolonne | Innhald |
|---|---|
| `nr`, `rev` | Teikningsnummer/revisjon, tolka frå filnamnet |
| `tittel`, `fag`, `fase`, `malestokk`, `format`, `dato` | Frå PDF-tittelfeltet + teikningsnummer-koden, alle redigerbare i registeret |
| `teikna_av`, `ek_person`, `fk_person` | Initialar frå tittelfeltet — **ikkje** knytt til ei fast personliste; visast som ein farga initial-boble (farge hasha frå teksten) |
| `filnamn` | Namnet fila fekk i «til kontroll» |
| `created_at` | Vist i tabellen som «Lasta opp» (ikkje ei eiga kolonne — gjenbruker standard tidsstempelet) |
| `project_id`, `user_id` | Same mønster som resten av appen |

## Standard-tabell i heile appen

Teikningsregisteret brukar det same tabellkomponentet som saksmodulen —
sjå `claude/saksmodul-tabell.md` for detaljar om `DataTabell.jsx`, som no er
den generiske tabellmotoren `SakerTabell.jsx` og `TeikningTabell.jsx` begge
er tynne wrapparar rundt. Nye tabellar i appen bør følgje same mønster:
kolonnedefinisjon + `hentVerdi`/`lagCelle` i ein liten wrapper, resten
(sortering, filter, kolonnestyring, tettleik, redigering, no òg
opne-fil-klikk via `opnaFil`/`onOpneFil`) kjem gratis frå `DataTabell`.

## Grafikk

Heile modulen er skriven om frå hardkoda hex-fargar (`BRAND`, `BG`, `TX` osv.)
til appen sine delte CSS-variablar (`var(--brand)`, `var(--bg2)`,
`var(--text3)` osv.), same 50 px grøne topbar-mønster som
Resultatdokument/Prosjekt-modulen, skriftstorleikar normalisert til 11–15 px
(var 17–18 px), og dei smale ~600–700 px wrapparane er fjerna til fordel for
full bredde (tabellvisningane) eller ~760–1000 px (skjema/oversikt).

## Del B (ikkje starta)

Leveransekontroll-arbeidsflyten (egenkontroll/fagkontroll-sjekklista, faner
«Oversikt»/«＋ Ny»/«Leveransekontroll»/«Arkiv») er **framleis berre
skjermtilstand** — ho vert nullstilt ved bytte av prosjekt og ved omlasting.
Når Del A er verifisert i praksis, gjenstår:

- Ein `ks_kontrollar`-tabell (eller liknande) for å lagre sjølve kontrollane
  og sjekklistesvara.
- «Ferdigstill»-knappen skal faktisk kalle `ks:ferdigstill`-endepunktet (alt
  bygd og klart i `electron/main.js`/`preload.js`) for å flytte filene til
  `kontroll/Kontrollkopiar/<løpenr>_<namn>/` — no viser han berre kva som
  *vil* skje.
