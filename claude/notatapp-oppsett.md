# Notatappen — kvar ting ligg og korleis han blir publisert

## Dagleg e-post om forfallande oppgåver

Ein Supabase Edge Function (`hyper-worker`, kjeldefil `send-deadline-
reminders.ts`) sender kvar dag kl. 06:00 UTC ein e-post med oppgåver som
er forfalt, forfell i dag, eller forfell i morgon. Trigga av ein
`pg_cron`-jobb (`dagleg-frist-varsling`, `0 6 * * *`) som kallar funksjonen
via `net.http_post`. E-post vert sendt via Resend (domenet
`liedarkitektur.no` er verifisert der) til éin av to faste adresser,
avhengig av om oppgåva sitt prosjekt er typa `work` eller `private`
(oppgåver utan prosjekt går til den innlogga brukaren sin eigen e-post).

**Feil oppdaga og retta 21. sept. 2026:** Heile dette oppsettet fanst frå
før, men hadde ALDRI fungert — `pg_net`-utvidinga (som gjev tilgang til
`net.http_post`) var aldri skrudd på i databasen, så kron-jobben feila
stille kvar einaste dag sidan minst 12. sept. med `ERROR: schema "net"
does not exist` (synleg i `cron.job_run_details`, ikkje i vanlege
applikasjonslogg). I same runde vart òg eit logikkfeil retta: funksjonen
filtrerte tidlegare bort alt som var forfalt FØR i dag (`t.date <
todayStr`), så allereie forfalte oppgåver kom aldri med i e-posten —
berre dei neste 2 dagane. No er nedre grense fjerna heilt (all forfalt,
uansett kor gamalt, kjem med), og øvre grense sett til i morgon (var før
2 dagar fram).

Krev to secrets sett på Edge Function-nivå i Supabase (allereie på plass):
`RESEND_API_KEY`, samt dei automatisk tilgjengelege
`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`.

## Mapper på maskina (Windows)

| Kva | Sti |
|---|---|
| Git-repo (rota) | `C:\Users\gemli\Jottacloud\Lied Lab\Web\Liedlab\` — inneheld `.git`, `notatapp\` og `supabase\` |
| Sjølve appen | `...\Web\Liedlab\notatapp\` (package.json, src, electron, …) |

Repo-rota heitte tidlegare `Web\notatapp\`, med appen i `notatapp\notatapp\`.
Det vart døypt om i august 2026 fordi to nivå med same namn var forvirrande.
Det er repo-rota (`Liedlab`) som skal koplast til Claude — då er både
git-oppsettet, appen og supabase-mappa synlege.

Merk: git-kommandoar må køyrast frå repo-rota, ikkje frå app-mappa.

Ein gammal, utdatert klone låg i `C:\Users\gemli\liedlab\notatapp`
(snapshot frå juni 2026, utan Supabase og saksmodul) — ikkje i bruk.

## GitHub og deploy

- Repo: `https://github.com/geirmagnelied/LiedLab` (offentleg, branch `main`)
- Struktur i repoet: `notatapp/` og `supabase/`
- Vercel deployer automatisk når det kjem nye commits på `main`
- Build: Vite, `npm run build`, output `dist`
- Live-URL: `https://liedarkitektur.no/liedlab/notatblokk/`

## Køyre lokalt

- `npm run dev` i app-mappa → `http://localhost:5173/liedlab/notatblokk/`,
  med automatisk oppdatering ved endringar
- `npm run electron` (eller `start.bat`) startar skrivebordsversjonen. Sidan
  august 2026 er dette ei **tynn Electron-skal** (`electron/main.js` +
  `electron/preload.js`) som lastar den live nettsida direkte — ikkje ein
  lokal `dist`-kopi. Vanlege kodeendringar (push til `main`) gjeld difor
  automatisk òg her. Berre dersom `electron/`-mappa sjølv vert endra, må ein
  byggje ein ny installasjonsfil (`npm run dist`) og dele han ut på nytt.
  Sjå `claude/resultatdokument-modul.md` for kvifor dette vart bygd.
- `electron:dev`-skriptet (`concurrently`+`wait-on`: startar vite, ventar
  til `localhost:5173` svarar, opnar så Electron mot han — eitt steg i
  staden for to terminalar) er **fiksa 21. sept. 2026** — `concurrently` og
  `wait-on` var lenge borte frå `devDependencies`, lagt til då og verifisert
  (vite+wait-on-delen testa; sjølve Electron-oppstarten må testast på
  Windows-maskina, sidan Electron-GUI ikkje kan køyrast i eit skymiljø).
  **Køyr `npm install` éin gong** etter denne oppdateringa (og etter kvar
  `git pull`/synk som rører `package.json`), elles manglar pakkane i
  `node_modules` sjølv om `package.json`/`package-lock.json` er oppdatert.
  **Ekstra fallgruve, oppdaga same dag:** nyare npm (11/12) blokkerer
  install-skript for pakkar som standard («`npm warn install-scripts`»).
  `electron` sitt eige postinstall-skript (som lastar ned sjølve
  Electron-programfila) og `esbuild` sitt vert difor hoppa over ved ein
  vanleg `npm install`, og `electron:dev`/`electron` feilar (manglar binær)
  til dei er godkjende eksplisitt:
  ```bash
  npm install-scripts approve electron
  npm install-scripts approve esbuild
  npm install
  ```
  Godkjenninga er versjonslåst (`allowScripts` i `package.json`) — dukkar
  same åtvaringa opp igjen etter ei versjonsoppgradering av éin av desse to
  pakkane, må dei godkjennast på nytt.
- **Auto-restart av Electron ved endring i fil-brua (lagt til 21. sept.
  2026):** `electron/main.js` og `electron/preload.js` vert normalt berre
  lasta éin gong ved oppstart — i motsetnad til `src/`, som Vite alt
  hot-reloadar. `electron-reload` (ny devDependency) overvakar no BERRE
  `electron/`-mappa og gjer ein full restart av Electron-prosessen
  (`app.exit()` + `app.relaunch()`) automatisk når main.js/preload.js vert
  lagra medan `npm run electron`/`electron:dev` køyrer. `src/` vert ikkje
  overvaka av dette — Vite tek seg av alt der, som før. Køyrer aldri i ein
  pakka `.exe` (`app.isPackaged`-sjekk), og feilar stille (åtvaring i
  konsollen, ikkje ein krasj) om pakken av ein eller annan grunn manglar.
- **`npm run dist` (bygg installasjonsfila) — to fallgruver oppdaga/retta
  23. sept. 2026:**
  1. `icon.png` var berre 32×32 px. `electron-builder` krev minst 256×256
     for portable-target-ikonet og feila («image ... must be at least
     256x256»). Retta ved å erstatte `icon.png` med ein 512×512-versjon
     (same design, generert frå `icon.svg`).
  2. Sjølv med rett ikon feilar bygget likevel på denne maskina, éin steg
     seinare: `electron-builder` prøver alltid å laste ned og pakke ut
     `winCodeSign` (eit paket som eigentleg gjeld macOS-signering, men som
     vert henta uansett måloperativsystem), og utpakkinga inneheld
     symbolske lenker (`.dylib`-filer for macOS) som krev eit Windows-
     løyve (`SeCreateSymbolicLinkPrivilege`) kontoen manglar utan anten (a)
     Utviklarmodus skrudd på (Innstillingar → Personvern og tryggleik → For
     utviklarar → Utviklarmodus), eller (b) å køyre terminalen som
     administrator. Ingen av delane er noko Claude Code skal gjere sjølv
     (køyrer under vanleg brukarkonto, og skal ikkje endre
     tryggleiksinnstillingar) — **Geir Magne må skru på Utviklarmodus (eller
     køyre som admin) éin gong, sjølv, før `npm run dist` fullfører.**
     Fram til då: `release\win-unpacked\Notatapp.exe` (heile mappa, ikkje
     berre .exe-fila) vert oppretta FØR dette steget og er ein fullt
     fungerande, ikkje-pakka versjon av appen — brukbar direkte, berre ikkje
     éi enkelt portabel fil.
  Same dag vart det òg oppdaga at det installerte skrivebords-snarveg-
  programmet var eit **frose, mykje eldre `npm run dist`-bygg** — heile
  fil-bru-arbeidet (Resultatdokument-modulen, `resultatdokumentAPI`) fanst
  ikkje i det. Skjeramen (`electron/main.js`+`preload.js`) er berre bunta
  INN i sjølve installasjonsfila ved bygge-tidspunktet, og oppdaterer seg
  ALDRI automatisk sjølv om Vite/nettsida gjer det — ein ny `npm run dist`
  (og utdeling av den nye fila til snarvegen) er einaste måten å få
  fil-bru-endringar inn i ein installert/portabel versjon.

## Publisere endringar (frå Windows-maskina)

```bash
cd "C:\Users\gemli\Jottacloud\Lied Lab\Web\Liedlab"
git status
git add .
git commit -m "Kort skildring av endringa"
git push
```

## Arbeidsflyt frå Claude Cowork (frå september 2026)

Frå og med denne datoen arbeidde Geir Magne på notatappen ei tid direkte frå
Claude Cowork (skya), i staden for berre via skrivebord-brua fil-for-fil.
Oppsettet den gongen:

- Ein full klone av repoet i skyarbeidsflata, `npm install` og
  `npm run build` verifisert reint der.
- Vanleg utviklingsserver (`npm run dev`) og eit reelt nettlesar-render
  (headless Chromium via Playwright) fungerte i skya — nyttig for å sjekke
  at grensesnittet faktisk vart bygd/vist korrekt før ting vart synkronisert
  attende.
- **Viktig avgrensing i Cowork-skya:** utgåande nettverk derifrå var sperra
  mot `*.supabase.co` (organisasjonens brannmur-policy for den økta). Det
  vil seie at innlogging og all datahenting/-lagring **ikkje** kunne testast
  fullt ut i skya — berre den statiske strukturen/utsjånaden.
- Claude hadde *ikkje* direkte push-tilgang til GitHub frå Cowork-skya
  (ville kravd at Claude handterte ein tilgangsnøkkel/OAuth-innlogging).
  Endra filer vart synkroniserte til den lokale Windows-mappa via
  skrivebord-brua, og Geir Magne køyrde sjølv `git add`/`commit`/`push`.

## Overgang til Claude Code (frå 14. sept. 2026)

Geir Magne har no gått over til å bruke **Claude Code** (i skrivebordsappen
sin eigen Code-fane, eller via terminal) som hovudarbeidsflate for dette
prosjektet, nettopp for å sleppe dei manuelle synkroniserings-/push-stega
Cowork-arbeidsflyten kravde. Skilnaden frå Cowork:

- Claude Code køyrer direkte i den ekte prosjektmappa på maskina — ingen
  skrivebord-bru, ingen sky-klone å halde i sync.
- Vanleg nettverkstilgang (same som resten av maskina) — ingen
  Supabase-sperre, full funksjonstest (innlogging, datahenting/-lagring) er
  mogleg undervegs.
- Claude Code køyrer *som* Geir Magne, med hans eigne lagra
  git-akkreditiv — `git add`/`commit`/`push` kan difor gjerast direkte,
  styrt av kva løyve han gir Claude Code (Ask/Code/Plan-modus).
- Claude Code les **ikkje** claude.ai-prosjektdokumenta automatisk (dei er
  knytt til Claude-kontoen, ikkje til sjølve repoet). Difor er innhaldet i
  denne `claude/`-mappa kopiert inn som vanlege filer i repoet (14. sept.
  2026), slik at `CLAUDE.md` og desse filene lastar automatisk uansett
  kva for Claude-overflate ein brukar. **Denne mappa er no den primære
  kjelda** — same-namngjevne dokument i "Digitale verktøy"-prosjektet på
  claude.ai kan verte forelda over tid; oppdater helst begge stadar, eller
  i det minste denne mappa, ved nye endringar.
