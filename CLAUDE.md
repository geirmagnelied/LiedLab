# LiedLab Notatapp — prosjektunderlag for Claude Code

Dette dokumentet er underlaget Claude bør lese før arbeid i dette repoet.
Det oppsummerer arkitektur, mapper, kjende fallgruver og arbeidsflyt.
**Meir detaljert, historisk dokumentasjon** (éin fil per feature, skrive
etter kvar leveranse) ligg i denne `claude/`-mappa i sjølve repoet — les
den relevante fila når ei oppgåve gjeld eit tema han dekkjer:

- `claude/notatapp-oppsett.md` — mapper, GitHub/deploy, køyre lokalt, historikk om Cowork→Claude Code-overgangen
- `claude/notatmodul-tabellvisning.md` — notatmodulens historie: tabellvising, NoteModal, todelt dashboard
- `claude/kalendermodul.md` — Kalender-modulen
- `claude/kvalitetsmodul-teikningar.md` — KS-modulens teikningsregister
- `claude/saksmodul-tabell.md` — Saksmodulen og `DataTabell.jsx`
- `claude/resultatdokument-modul.md` — Resultatdokument-modulen og Electron-fil-brua
- `claude/prosjektplan-tegningskontroll.md` — eit **separat, frittståande**
  Python/Flask-verktøy (ikkje ein del av dette repoet), dokumentert her fordi
  KS-modulens PDF-tittelfelt-lesing (`lesTittelfelt()`) er ein direkte port
  av logikk derifrå — sjå fila for autoritative regex-mønster og kontekst
- `claude/dtm-modul.md` — **under bygging** (frå 24. sept. 2026): DTM
  (Dokument, tegningar og modellar) erstattar Resultatdokument-modulen.
  Full spesifikasjon (mapper, datamodell, status-logikk, importflytar,
  fase-status) — les denne FØR du gjer noko DTM-relatert

Same innhald finst òg (kan verte forelda over tid) som eigne dokument i
Claude-prosjektet **"Digitale verktøy"** på claude.ai — `claude/`-mappa her
i repoet er frå 14. sept. 2026 den primære, alltid oppdaterte kjelda, sidan
Claude Code ikkje les claude.ai-prosjekt automatisk. Oppdater helst begge
stadar ved nye funksjonar, men **denne mappa er den som tel**.

## Kva appen er

Ein norsk (nynorsk) produktivitets-app for eit arkitektkontor: prosjekt,
kundar, notat/møte/referat/oppgåver, saksregister, kvalitetssystem
(teikningsregister), timeføring, kalender, resultatdokument-handtering.
React + Vite, Supabase som backend, pakka som ei tynn Electron-skrivebordsapp.

- Repo: `https://github.com/geirmagnelied/LiedLab` (offentleg, branch `main`)
- Live nettside: `https://liedarkitektur.no/liedlab/notatblokk/` (Vercel,
  auto-deploy ved push til `main`)
- Supabase-prosjekt: **"Lied Lab"** (`hcdtagtkyewhrbrvrbqh`) — URL og anon-nøkkel
  ligg hardkoda i `notatapp/src/supabase.js` (ikkje via `.env`)

## Mappestruktur

```
Liedlab/                      ← repo-rota — git-kommandoar køyrer herifrå
├── notatapp/                 ← sjølve appen
│   ├── src/                  ← alle React-komponentar
│   ├── electron/             ← main.js + preload.js (tynn skal, sjå under)
│   ├── package.json
│   └── supabase-*.sql        ← migrasjonar, køyrast manuelt i Supabase SQL Editor
└── supabase/                 ← eldre/backup Supabase-eksport
```

På brukaren si Windows-maskin heiter repo-rota `Liedlab` under
`C:\Users\gemli\Jottacloud\Lied Lab\Web\Liedlab\`. Det er **denne** mappa
som skal koplast til Claude/Cowork, ikkje `notatapp`-undermappa — då er
både git, appen og supabase-mappa synlege. To andre, utdaterte klonar kan
liggje tilkopla frå tidlegare (`Web\notatapp\notatapp` og
`C:\Users\gemli\liedlab\notatapp`) — dei er **ikkje** i bruk, ignorer dei.

## Kritisk arkitektur-fakta: Electron lastar den LIVE nettsida

`electron/main.js` gjer IKKJE `loadFile()` på ein lokal build. Han gjer:

```js
win.loadURL('http://localhost:5173/liedlab/notatblokk/')
   .catch(() => win.loadURL('https://liedarkitektur.no/liedlab/notatblokk/'))
```

Det betyr: `start.bat` åleine (utan ein køyrande dev-server) lastar den
**live, deployde** nettsida — ikkje lokale kodeendringar. For å sjå lokale
endringar i skrivebordsappen må `npm run dev` køyre samstundes i ein
separat terminal. Elles gjeld lokale endringar **først etter** `git push`
til `main` (Vercel byggjer og deployer automatisk).

`npm run electron:dev` gjer dette i eitt steg (`concurrently`+`wait-on`
startar vite, ventar til `localhost:5173` svarar, og opnar så Electron mot
han). Fiksa 21. sept. 2026 — pakkane var lenge borte frå `devDependencies`,
lagt til då. Krev **éin gong** `npm install` etter oppdateringa (og etter
kvar `git pull` som rører `package.json`) før skriptet fungerer, sidan
`node_modules` ikkje syncar med filsynkronisering/git åleine.

## Venstremenyen (`AppRail.jsx`) — modulrekkjefølgje

Prosjekt, Kunde, **Notatar**, Oppgåver, Saker, Timar, Kvalitetssystem,
Farge, Resultatdokument, Kalender. (Notatar vart flytta ned frå fyrsteplass
3. sept. 2026 — sjå `claude/notatmodul-tabellvisning.md`.)

## Gjennomgåande mønster i kodebasen

- **`DataTabell.jsx`** er den generiske tabellmotoren (sortering, filter,
  kolonnestyring, tettleik, redigering med dobbeltklikk, opne-fil-klikk).
  `SakerTabell.jsx`, `TeikningTabell.jsx` og `NoteTabell.jsx` er alle tynne
  wrapparar rundt han. **Nye tabellar skal følgje same mønster** — ein liten
  wrapper med `hentVerdi`/`hentSorteringsverdi`/`lagCelle`, ikkje ein ny
  tabell frå botnen.
- **Flytande vindauge** for opprette/redigere (t.d. `NoteModal.jsx`,
  `NewCaseModal`/`CaseDetailModal` i `SakerModule.jsx`): sentrert overlegg,
  eiga header med tittel + X, spør om lagring ved ulagra endringar før lukking.
- **Justerbar storleik/breidd**: alltid ein eigendefinert dra-handtak
  (mousedown/mousemove/mouseup på `window`, ikkje CSS `resize`, som har vist
  seg upåliteleg i denne Electron/Chromium-konteksten). Storleik/breidd vert
  lagra i `localStorage` og hugsa til neste gong.
- **Permanente løpenummer** (saksnummer, notatnummer): klientutrekna
  (`nextCaseNumber()`/`nextNoteNumber()` = høgste eksisterande + 1), ikkje
  Postgres-sekvens/trigger. Lagra i ein eigen kolonne med unik indeks per brukar.
- Alt UI-språk, kommentarar og commit-meldingar er på **nynorsk**.
- Etter kvar større feature-leveranse: oppsummer endringa i den relevante
  `claude/*.md`-fila **i dette repoet** (og gjerne òg i "Digitale
  verktøy"-prosjektet på claude.ai, men repo-fila er den Claude Code faktisk
  les), ikkje berre i commit-meldinga.

## Kjende, ikkje-kritiske avvik (ikkje fiks utan at brukar ber om det)

- `ProsjektModule.jsx`: to harmlause "Duplicate key" ESBuild-åtvarer ved
  build (`projectNumber`/`status` sett to gonger i eit objektlitteral).
- Vite-bygget åtvarer om at hovud-chunken er > 500 kB (ingen code-splitting
  er gjort enno).
- `NoteList.jsx` og `CalendarView.jsx` ligg framleis i `src/`, men er ikkje
  lenger importerte noko stad (erstatta av `NoteTabell`+`NotePreview` og
  `KalenderModule`). Ikkje slett utan å spørje — kan vere nyttig referanse.

## Arbeidsflyt: Claude Code (frå 14. september 2026)

Geir Magne brukte fyrst Claude Cowork (skya) ei kort periode, men har no gått
over til **Claude Code** (skrivebordsappen sin eigen Code-fane, eller
terminal) som hovudarbeidsflate — nettopp for å sleppe manuell
filsynkronisering. Sjå `claude/notatapp-oppsett.md` for full samanlikning
og grunngjeving. Praktisk betyr det:

- Arbeid skjer **direkte i den ekte prosjektmappa** på Geir Magne si maskin
  — ingen sky-klone, ingen skrivebord-bru, ingen fil-synkronisering.
- Vanleg nettverkstilgang (Claude Code køyrer lokalt) — full funksjonstest
  mot Supabase (innlogging, datahenting/-lagring) er mogleg undervegs,
  ulikt den tidlegare Cowork-skya som hadde sperra Supabase-tilgang.
- Claude Code køyrer **som** Geir Magne, med hans eigne lagra
  git-akkreditiv — `git add`/`commit`/`push` kan gjerast direkte når han
  gir løyve til det (styr etter kva Ask/Code/Plan-modus er valt, og bruk
  sunn dømmekraft — vis gjerne `git diff`/samandrag før du pushar noko).
- Denne `claude/`-mappa og `CLAUDE.md` er no den primære dokumentasjonen
  (sjå merknaden øvst i fila) — hald dei oppdaterte i staden for å stole på
  at kontekst frå tidlegare Cowork-økter heng med.

## Publisere endringar (Geir Magne køyrer sjølv, frå repo-rota)

```bash
cd "C:\Users\gemli\Jottacloud\Lied Lab\Web\Liedlab"
git add .
git commit -m "Kort skildring av endringa"
git push
```
