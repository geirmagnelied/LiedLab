# Notatmodulen — fjerna venstremeny, ny standard tabellvisning (2. sept. 2026)

Notatmodulen hadde ein eigen venstremeny (`Sidebar.jsx`) med Notatapp-branding,
kontor-veljar, favoritt-/prosjektliste med notat gruppert under kvart prosjekt,
og eit høgreklikk-kontekstmenysystem. Brukar opplevde denne som lite
velfungerande, og sidan aktivt prosjekt uansett vert valt i appen sin globale
`TopBar`, vart heile venstremenyen fjerna frå skrivebordsvisninga av
notatmodulen. Standardvisninga er no ein tabell — same mønster og motor
(`DataTabell.jsx`) som saksmodulen og teikningsregisteret i Kvalitetsmodulen.

## Kva som vart fjerna, og kvar det flytta

`Sidebar.jsx` sjølve fila er **ikkje** sletta eller endra — ho vert framleis
brukt av mobilvisninga (ein utrekkbar meny/«drawer» via hamburger-knappen),
sidan mobil ikkje har fått same opprydding i denne omgangen. Ho er berre
slutta å bli vist i skrivebordslayouten (`App.jsx`, den store ternæren for
`activeModule==='notatar'`).

- **«Notatapp»-tittelen** frå sidebaren sin brand-blokk er flytta til
  notatmodulen sin eigen lokale topbar-rad (den grøne rada med
  +Notat/+Møte/+Referat/+Oppgåve-knappane) — same mønster som
  «Kvalitetssystem» i Kvalitetsmodulen og «Resultatdokument» i
  Resultatdokument-modulen: modulnamnet står fyrst i modulen sin eigen
  fargelagde topbar.
- **Innstillingsknappen** frå sidebaren var overflødig — han opna same
  `SettingsPanel` som knappen som alt finst i den globale `TopBar.jsx`
  (`onOpenSettings`). Ingen endring var nødvendig her; det er no berre éin
  veg inn til innstillingane.
- **Kontor-veljaren** (`offices`/`activeOfficeId`) fanst *berre* i
  sidebaren, og styrer kva prosjekt/notat som er synlege i **heile appen**,
  ikkje berre notatmodulen. Sidan sidebaren no er borte frå skrivebordet,
  er kontor-veljaren flytta til den globale `TopBar.jsx` (ved sida av
  prosjekt-veljaren, med same «＋ Nytt kontor»-skjema som før). Dette er
  reelt sett ei forbetring: kontor-byte er no tilgjengeleg frå alle modular,
  ikkje berre når ein står i notatmodulen. `App.jsx` sin `handleSetOffice`
  nullstiller valt prosjekt ved kontorbyte (slik sidebaren gjorde), men
  tvingar ikkje lenger visinga over til «notatar» — det gav ikkje meining
  lenger sidan veljaren no kan brukast frå kva som helst modul.
- **Uroande fristar-varsel** (banneret i sidebaren som viste kor mange
  oppgåver som hadde frist innan 1–2 dagar) er droppa utan erstatning — det
  fanst frå før ei eiga «Fristar»-fane (`DeadlineView`) som dekkjer same
  behov meir fullstendig.
- **Flytt notat til anna prosjekt** (høgreklikk-menyen i sidebaren) er ikkje
  attskapt i tabellen. Prosjekt kan endrast ved å opne notatet til
  redigering (dobbeltklikk i tabellen) — prosjekt-feltet der er alt
  redigerbart.

## Kalenderfeltet i notatmodulen er fjerna (2. sept. 2026, seinare same dag)

Notatmodulen hadde tidlegare eit kalenderfelt heilt til høgre (kompakt
`CalendarView`, med resize-handtak og av/på-knapp «K»). Dette er no fjerna
i sin heilskap — det vart oppfatta som overflødig ved sida av den nye,
fullverdige **Kalender-modulen** (eiga fane «Ka» i venstremenyen; sjå
`claude/kalendermodul.md`). Notatmodulen har att berre den nedre
`Timeline`-baren (dag-for-dag-linje nedst, som før — uendra).

## Ny standardvisning: `NoteTabell.jsx`

`view`-tilstanden i `App.jsx` startar no på `'notatar'` (før: `'new'`), så
notatmodulen opnar rett i tabellen. `NoteTabell.jsx` er ein tynn wrapper
rundt `DataTabell`, same mønster som `SakerTabell.jsx`/`TeikningTabell.jsx`,
og har heilt erstatta den gamle kort-baserte `NoteList.jsx` som standardvising
(NoteList-fila ligg framleis i prosjektet, men vert ikkje lenger importert
noko stad i skildesvisninga).

Kolonnar (i rekkjefølgje, dei fire fyrste synlege som standard):

| Kolonne | Innhald |
|---|---|
| Nr. | Notatnummer — sjå eige avsnitt under |
| Overskrift | `note.title`, fell tilbake til dei fyrste 60 teikna av `note.text`, så «Utan tittel» |
| Registrert | `createdAt`, kort dato-format (gjenbruker `fmtDateShort` frå `sakerKonstantar.js`) |
| Endra | `updatedAt`, fell tilbake til `createdAt` for notat som aldri er redigerte |
| Prosjekt *(skjult som standard)* | Prosjektnamn |
| Type *(skjult som standard)* | Møte / Referat / Notat |
| Arkiver | Handlingsknapp — arkiverer/hentar ut att, same funksjon som «A»-knappen i den gamle NoteList |
| Slett | Handlingsknapp med stadfesting, same åtferd som «S»-knappen i den gamle NoteList |

Dobbeltklikk på ei rad (utanfor handlingsknappane) opnar notatet til
redigering — sjå eige avsnitt om `NoteModal` under (dette endra seg
3. sept. 2026: redigering skjer no i eit flytande vindauge, ikkje inline).
Eit enkeltklikk på ei rad **markerer** notatet og viser innhaldet i
førehandsvisingsruta til høgre — sjå avsnittet om den todelte
dashboard-visinga under. Ein liten «Aktive/Arkivert»-fane-veljar over
sjølve tabellen (vises berre når det finst arkiverte notat) attskapar
visinga NoteList hadde for aktive/arkiverte notat.

### Notatnummer — no eit ekte, permanent databasefelt (oppdatert 2. sept. 2026)

Notatnummeret var opphavleg berre utrekna i `NoteTabell.jsx` (eit stabilt,
men ikkje-lagra løpenummer etter opprettingsrekkjefølgje). Dette er no
gjort om til eit ekte, persistert felt:

- **`notes.nr`** (bigint) er ein ny kolonne i Supabase, lagt til og
  etterutfylt for eksisterande notat via migrasjonen `supabase-notes-nr.sql`
  (etterutfylling skjer per brukar, etter opprettingsdato — same rekkjefølgje
  som den gamle utrekninga gav, så ingen notat byter nummer ved migrering).
  Ein unik indeks (`notes_user_nr_idx`) hindrar dobbeltnummerering per brukar.
- **`useStore.js`** tildeler nummeret ved oppretting: `nextNoteNumber()`
  reknar ut høgste eksisterande `nr` blant brukaren sine notat + 1 — nøyaktig
  same mønster som `nextCaseNumber()` i saksmodulen (`SakerModule.jsx`).
  Dette er altså **ikkje** ein Postgres-sekvens/trigger, men eit
  klientutrekna nummer, i tråd med korleis resten av appen alt handterer
  tilsvarande «permanente løpenummer»-behov.
- **`NoteTabell.jsx`** er forenkla tilsvarande: kolonna «Nr.» les no rett
  frå `note.nr` (via `n.nr ?? ''`), i staden for å rekne ut eit
  `nrMap` frå heile notat-lista. `allNotes`-proppen er dermed heilt fjerna
  frå `NoteTabell` og begge kalla til han i `App.jsx`.

### `updatedAt` — no spora heile vegen

`useStore.js` sin `loadAll()` henta før ikkje `updated_at` frå Supabase inn i
notat-objekta i det heile (feltet vart skrive til databasen ved kvar
oppdatering, men aldri lese tilbake til appen). Dette er retta: `updatedAt`
er no med i den innlasta notat-forma, og alle stadene som oppdaterer eit
notat sin `updated_at` i databasen (`updateNote`, `toggleDone`, `updateTask`,
`deleteTask`) set no òg `updatedAt` i den optimistiske lokale oppdateringa,
slik at «Endra»-kolonna alltid viser korrekt tidspunkt utan at sida må
lastast på nytt.

## Venstremenyen: Notatar flytta ned, «Timar»-snarvegen inni notatmodulen fjerna (3. sept. 2026)

Rekkjefølgja på fanene i `AppRail.jsx` (den vertikale venstremenyen for
heile appen, ikkje å forveksle med den no fjerna `Sidebar.jsx`) er endra
til: **Prosjekt, Kunde, Notatar, Oppgåver, Saker, Timar, Kvalitetssystem,
Farge, Resultatdokument, Kalender**. Notatar er dermed flytta ned frå
fyrsteplass til tredjeplass, og Kalender (som vart lagt til tidlegare same
dag) er plassert sist.

Notatmodulen sin eigen lokale topbar hadde tidlegare ein snarveg-fane
«Timar» (ved sida av «Fristar») som viste `TimeTracker`-komponenten inni
notatmodulen sjølv — heilt uavhengig av den ordentlege Timar-fana i
venstremenyen (som brukar `TimarModule.jsx` på skrivebord). Denne
duplikatsnarvegen er no fjerna, både i skrivebordsvisninga (`Tab v="timar"`)
og i mobil-botnnavigasjonen (`MobileTab v="timar"`). Den vanlege Timar-fana
i venstremenyen er uendra og fungerer som før. Merk: `TimeTracker`-fila og
-importen er **ikkje** fjerna frå `App.jsx`, sidan mobilvisninga framleis
brukar han for sjølve Timar-fana (`activeModule==='timar'` på mobil).

## Nytt notat/møte/referat/oppgåve: flytande, justerbart vindauge med spør-om-lagring (3. sept. 2026, justert same dag)

Å opprette eit nytt notat, møte, referat eller ei oppgåve (via
+Notat/+Møte/+Referat/+Oppgåve-knappane), og å opne eit eksisterande notat
til redigering (dobbeltklikk i tabellen), skjedde tidlegare *inline* i
hovudinnhaldsområdet til notatmodulen. Dette er no eit **flytande
vindauge** (`NoteModal.jsx`, nytt), etter same visuelle mønster som dei
flytande vindauga i saksmodulen (`SakerModule.jsx`: `NewCaseModal`/
`CaseDetailModal`) — sentrert overlegg, eiga header med tittel + X-knapp.

Sjølve skjemaet (`NoteInput.jsx`) er **ikkje** omskrive — det autolagrar
framleis fortløpande (800ms debounce) akkurat som før. `NoteModal` legg
berre eit vindauge rundt det, og gjer to ting nye:

- **`NoteInput` er gjort om til ein `forwardRef`-komponent** som via
  `useImperativeHandle` eksponerer éin metode, `save()` — han utløyser
  same lagring som «Ferdig»-knappen (eller «Lagre»-knappen i
  oppgåve-modus), slik at `NoteModal` kan tvinge fram ei lagring
  utanfrå.
- **`NoteInput` tek ein ny prop, `onDirtyChange(boolean)`**, kalla kvar
  gong det finst ei endring som enno ikkje er stadfesta lagra (avleia av
  det interne `saveStatus`-signalet — `'saving'` betyr «ulagra» — eller,
  i oppgåve-modus som ikkje har autolagring, av om det finst utfylt
  innhald i det heile).

Når brukar trykkjer **X** i `NoteModal`-vindauget: er det ikkje noko
ulagra (vanlegast — autolagringa har alt teke seg av det), lukkar
vindauget seg stille, akkurat som før. Finst det derimot ei endring som
enno ikkje er stadfesta lagra (t.d. dersom brukar rekk å skrive noko og
lukke vindauget i det vesle vindauget før 800ms-autolagringa har slått
inn), kjem det opp ein liten stadfestingsdialog med tre val: **Lagre og
lukk** (kallar `save()` og lukkar), **Lukk utan å lagre** (lukkar
direkte — sidan `NoteInput` sin eksisterande oppryddingseffekt allereie
avbryt ei ventande autolagring ved avmontering, vert ingenting nytt
lagra), og **Avbryt** (attende til skjemaet).

`App.jsx` sin `handleNewNote`/`handleEdit`/`handleCancelEdit` er
funksjonelt uendra — dei styrer framleis `view`-tilstanden
(`'new'`/`'notatar'`/`'fristar'`) akkurat som før. Det som er nytt, er
berre at `{view==='new' && <NoteModal .../>}` no vert rendra som eit
frittståande overlegg (same stad i både skrivebords- og mobilretur i
`App.jsx`), i staden for at `<NoteInput>` vart rendra inne i sjølve
innhaldskolonna.

### Justerbar storleik på vindauget (lagt til 3. sept. 2026, same dag)

Fyrste versjonen av `NoteModal` brukte CSS sin innebygde `resize:'both'`
for å la brukar dra i nedre høgre hjørne — dette synte seg upåliteleg i
praksis (verka som vindauget berre hadde éin fast storleik). Dette er
bytt ut med ein eigendefinert, dragbar hjørnehandtak (same mønster som
kolonnebreidd-justering i `DataTabell.jsx` og delelinja i det todelte
dashbordet under): eit lite handtak nedst til høgre i vindauget, markert
med diagonale strekar, som ein dreg for å endre både breidd og høgd på
vindauget samstundes. Storleiken vert lagra i `localStorage`
(`liedlab-notemodal-size`, som `{w, h}`) og hugsa til neste gong eit
notat vert opna — startstorleiken elles er avgrensa til 94 %/92 % av
vindaugebreidda/-høgda til nettlesarvindauget, med ei nedre grense på
420×360 px.

## Todelt dashboard: tabell + førehandsvising, justerbar breidd (3. sept. 2026, layout snudd same dag)

Notatmodulen sitt hovudinnhald (når `view==='notatar'`, på skrivebord) er
delt i to kolonnar:

- **Venstre: `NoteTabell.jsx`** (uendra elles) — tabellen som før.
- **Høgre: `NotePreview.jsx`** (ny) — ei skriveverna førehandsvising av
  notatet som er markert (enkeltklikka) i tabellen: tittel, type-merke
  (Notat/Møte/Referat), prosjektnamn, notatnummer, registrert-/endra-dato,
  møteinfo (tidspunkt/stad/deltakarar) for møtenotat, sjølve
  tekstinnhaldet (rendra frå `note.html`), arbeidsoppgåver (med
  interaktive avkryssingsboksar via `onUpdateTask` — resten av visinga er
  rein lesevising) og vedlegg som lenker. Er ingenting markert, vert det
  vist ein enkel «Vel eit notat i tabellen for å sjå innhaldet her»-tekst.
  Ein «Rediger»-knapp i toppen av ruta opnar notatet i `NoteModal`
  (same som dobbeltklikk i tabellen).

(Fyrste versjonen same dag hadde førehandsvisinga til venstre og tabellen
til høgre — brukar bad om å byte om desse, sidan tabellen skal stå fyrst.)

Enkeltklikk på ei rad i tabellen markerer notatet (kallar den nye
`onSelect`-proppen), utan å opne noko — dobbeltklikk opnar framleis
`NoteModal` til redigering som før. Den markerte rada er utheva med
`var(--brandbg)` (via ein ny, valfri `radStil`-bruk — ingen endring i
sjølve fargelogikken i `DataTabell.jsx`).

Andelen mellom dei to kolonnane er **justerbar**: eit tynt, dragbart
skiljefelt mellom rutene (same mønster som kolonnebreidd-justering i
`DataTabell.jsx`) let brukar dra breidda på førehandsvisingsruta (no
høgre rute) mellom 240 og 760 px. Breidda vert lagra i `localStorage`
(`liedlab-notat-preview-w`) og hugsa til neste gong — merk at
skiljelinja no styrer breidda «bakover» samanlikna med fyrste versjonen
(å dra mot høgre gjer høgre rute smalare), sidan ruta bytte side.

`DataTabell.jsx` har fått éin ny, valfri prop for å støtte dette:
**`onRowClick(id, rad)`**, kalla ved enkeltklikk på ei rad (i tillegg til
det eksisterande `onOpenRad` ved dobbeltklikk). Han er reint additiv —
`SakerTabell.jsx` og `TeikningTabell.jsx` sender han ikkje, og er difor
heilt uendra av denne endringa.

Denne todelte visinga gjeld **berre skrivebord**. Mobilvisninga har framleis
`NoteTabell` i full breidd, utan førehandsvising — ei todelt rute gjev
ikkje meining på eit smalt mobilskjerm.

## Publisering til den live nettsida

Appen er ein tynn Electron-skal rundt den same, live nettsida
(`https://liedarkitektur.no/liedlab/notatblokk/`, sjå `electron/main.js`) —
lokale kodeendringar i `src/`-mappa er difor **ikkje** synlege på nettsida
eller i den vanlege `start.bat`-oppstarten før dei er bygde og publiserte
dit (typisk via `git push` til repoet som Vercel-deployen byggjer frå).
