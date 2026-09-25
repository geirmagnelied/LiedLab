// electron/main.js
// ─────────────────────────────────────────────────────────────────────
// Tynn Electron-skal rundt den vanlege, live LiedLab-nettsida.
//
// Poenget: appen er den SAME nettsida som alle andre opnar i nettlesar
// (Vercel-deployen). Denne fila legg berre til eit vindauge + ei lita
// fil-bru (sjå preload.js) som gjev sida tilgang til nokre heilt
// avgrensa filoperasjonar på disken — berre det Resultatdokument- og
// Kvalitets-modulen treng. Alt anna i appen (Notatar, Oppgåver, Saker osv.)
// fungerer heilt likt anten du opnar via nettlesar eller via denne
// skrivebordsappen, og oppdaterer seg automatisk med kvar «git push»,
// akkurat som nettsida.
//
// Viss du endrar sjølve fil-brua (denne fila eller preload.js), må du
// byggje ein ny .exe (npm run dist) og dele han ut på nytt. Vanlege
// kodeendringar i appen elles treng ikkje det — dei kjem automatisk.
// ─────────────────────────────────────────────────────────────────────

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')

// ── Dev-only: automatisk restart av Electron ved endring i fil-brua ──
// electron/main.js og electron/preload.js vert berre lasta éin gong, ved
// oppstart — i motsetnad til React-koden i src/, som Vite alt hot-
// reloadar automatisk. Utan dette måtte du sjølv lukke og opne appen på
// nytt kvar gong desse to filene vart endra. Overvakar difor BERRE denne
// mappa (electron/) — src/ rører vi ikkje, Vite tek seg av det som før.
// Køyrer aldri i ein pakka .exe (app.isPackaged), og electron-reload er
// ein reindyrka devDependency — feilar require()-en (t.d. i eit miljø der
// devDependencies ikkje er installerte), held appen fram som normalt.
if (!app.isPackaged) {
  try {
    require('electron-reload')(__dirname, {
      electron: process.execPath,
      hardResetMethod: 'exit',
    })
  } catch (e) {
    console.warn('[dev] electron-reload er ikkje tilgjengeleg — restart appen manuelt ved endringar i electron/main.js eller preload.js:', e.message)
  }
}

// pdfjs-dist er berre tilgjengeleg som ES-modul (build/pdf.mjs) — denne
// fila er CommonJS, så vi lastar han inn med ein dynamisk import() og
// cachar resultatet. «legacy»-bygget er meint for Node/eldre miljø utan
// full DOM/Worker-støtte, slik som her.
let pdfjsLibPromise = null
function lastPdfjs() {
  if (!pdfjsLibPromise) pdfjsLibPromise = import('pdfjs-dist/legacy/build/pdf.mjs')
  return pdfjsLibPromise
}

// Live nettversjon (Vercel) — same URL som i nettlesar, sjå README.md.
// «liedarkitektur.no» er den tilsikta/pene offentlege adressa (peikar via
// eit eige domeneoppsett/reverse-proxy over til Vercel-deployen), medan
// «liedlab.vercel.app» er sjølve Vercel-prosjektet sin eigen, alltid
// gyldige adresse — brukt her berre som eit sikkerheitsnett dersom noko
// går gale med domeneoppsettet til liedarkitektur.no (skjedde 23. sept.
// 2026: domenet peika til ein heilt annan LiteSpeed-server som gav 404 —
// utanfor dette repoet, må rettast i Vercel sine domeneinnstillingar eller
// hos den som driftar sjølve liedarkitektur.no-nettstaden).
const PROD_URL       = 'https://liedarkitektur.no/liedlab/notatblokk/'
const PROD_URL_BACKUP = 'https://liedlab.vercel.app/'
// Lokal dev-server (npm run dev), for å teste endringar før dei er pusha.
// MERK: vite.config.js sin `base` er '/' (ikkje '/liedlab/notatblokk/' —
// den stien finst berre via reverse-proxyen på liedarkitektur.no i
// produksjon), så lokalt køyrer Vite frå rot. Retta 23. sept. 2026: denne
// var tidlegare feilaktig sett til .../liedlab/notatblokk/, som gav 404
// frå den lokale dev-serveren i staden for å falle tilbake til PROD_URL.
const DEV_URL = 'http://localhost:5173/'

// Prøver kvar url i rekkjefølgje til éin lastar utan feil. Fell vidare til
// neste både ved NETTVERKSFEIL (t.d. ingen dev-server på 5173 —
// loadURL()-promiset avvisast, fanga av .catch) OG ved HTTP-FEILSTATUS
// (t.d. ein 404-side — det er eit gyldig svar, ikkje ein nettverksfeil,
// så .catch fangar det ALDRI; må sjekkast via did-navigate sin
// httpResponseCode i staden). Utan denne skiljet kan appen bli sitjande
// fast på ei 404-side i staden for å prøve neste kandidat — nøyaktig det
// som skjedde både med DEV_URL (før fiksen over) og med PROD_URL (før
// PROD_URL_BACKUP vart lagt til).
function loadWithFallback(win, urls) {
  let current = -1
  const tryNext = () => {
    current += 1
    if (current >= urls.length) return
    win.loadURL(urls[current]).catch(() => tryNext())
  }
  win.webContents.on('did-navigate', (event, url, httpResponseCode) => {
    if (httpResponseCode >= 400 && current < urls.length - 1) tryNext()
  })
  tryNext()
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    icon: path.join(__dirname, '..', 'icon.png'),
    backgroundColor: '#0A0A0A',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // webUtils.getPathForFile krev at preload køyrer i node-kontekst
    },
  })

  // Prøv lokal dev-server fyrst (viss «npm run dev» køyrer i ein annan
  // terminal, t.d. under utvikling/testing), så den tilsikta live-adressa,
  // så Vercel sin eigen adresse som siste sikkerheitsnett.
  loadWithFallback(win, [DEV_URL, PROD_URL, PROD_URL_BACKUP])
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ═══════════════════════════════════════════════════════════════════
// Resultatdokument — filoperasjonar
// ═══════════════════════════════════════════════════════════════════

// Standard mappestruktur som vert oppretta INNI oppdragsstien når brukar
// låser prosjektet til ein sti i Prosjekt-modulen (sjå ProsjektModule.jsx:
// laasOppdragssti()). Stien sjølv er brukarstyrt (foreslått, men fritt
// redigerbar/veljbar før låsing) — ikkje ei fast rotmappe rekna ut frå
// prosjektnummeret slik det var tidlegare. Resultatdokument-modulen brukar
// «4 Resultatdokumenter»-undermappa automatisk.
const OPPDRAGSMAPPER = [
  '1 Oppdragsleiing', '2 Informasjonsflyt', '3 Arbeidsdokument', '4 Resultatdokument',
  '5 Kontrolldokument', '6 Styrande dokument', '7 BIM', '8 Diverse', '9 Foreløpig',
]
// Kategori → mappenamn for DTM-modulen. Kvar av desse fire har si eiga
// «Arkiv»-undermappe — gjeldande revisjon ligg direkte i mappa, eldre
// revisjonar (med _REV<revisjon|dato-tidsstempel> i filnamnet) vert flytta
// til Arkiv når ein ny versjon vert importert. Sjå claude/dtm-modul.md.
const DTM_KATEGORI_MAPPE = {
  arbeidsdokument:   '3 Arbeidsdokument',
  resultatdokument:  '4 Resultatdokument',
  kontrolldokument:  '5 Kontrolldokument',
  styrande_dokument: '6 Styrande dokument',
}

// Trygt å køyre om att på eit alt-låst prosjekt (t.d. når DTM-modulen opnar) —
// mkdirSync med recursive:true rører aldri eksisterande filer/mapper, berre
// legg til det som manglar. Slik får eksisterande prosjekt dei nye DTM-
// mappene automatisk, utan at nokon må flytte/omdøype noko manuelt. NB: eit
// prosjekt som vart låst FØR denne lista vart utvida (berre «5 BIM» som
// mappe 5) får IKKJE den gamle «5 BIM»-mappa si automatisk omdøypt/flytta til
// «7 BIM» — begge vil då eksistere side om side. Handter dette manuelt for
// slike prosjekt om ynskjeleg.
ipcMain.handle('resultatdokument:opprett-oppdragsmapper', async (event, { oppdragsSti }) => {
  if (!oppdragsSti) return { ok: false, melding: 'Inga sti oppgjeven.' }
  try {
    for (const mappe of OPPDRAGSMAPPER) {
      fs.mkdirSync(path.join(oppdragsSti, mappe), { recursive: true })
    }
    for (const mappe of Object.values(DTM_KATEGORI_MAPPE)) {
      fs.mkdirSync(path.join(oppdragsSti, mappe, 'Arkiv'), { recursive: true })
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, melding: e.message }
  }
})

// Tolkar filnamn på forma: A-20-01_B.pdf → nr=A-20-01, rev=B
// Støttar også: A-20-01 rev B.pdf, A-20-01(B).pdf
// Same mønster som parse_filnamn() i pdf_vaktar.py (KS-modulen),
// slik at teikningsnummer/revisjon vert tolka likt over heile appen.
function parseFilnamn(filnamn) {
  const namn = filnamn.replace(/\.[^.]+$/, '')

  let m = namn.match(/^(.+?)_([A-Za-z])$/)
  if (m) return { nr: m[1], rev: m[2].toUpperCase() }

  m = namn.match(/^(.+?)\s+rev\s+([A-Za-z])$/i)
  if (m) return { nr: m[1], rev: m[2].toUpperCase() }

  m = namn.match(/^(.+?)\(([A-Za-z])\)$/)
  if (m) return { nr: m[1], rev: m[2].toUpperCase() }

  return { nr: namn, rev: 'A' }
}

// ── DTM-hjelparar ────────────────────────────────────────────────────
// I motsetnad til parseFilnamn() over (som alltid fell tilbake til
// rev:'A' når ingen revisjon er å finne — god nok default der, sidan rev
// berre er visningsinfo for Resultatdokument/KS) treng DTM å VITE om
// revisjonen faktisk vart funnen, sidan appen då skal bruke eit
// dato/tidsstempel i staden (jf. brukar sitt krav i claude/dtm-modul.md).
// Returnerer null når ikkje funnen, aldri ein fallback-verdi.
function finnRevisjonFraFilnamn(filnamn) {
  const namn = filnamn.replace(/\.[^.]+$/, '')
  let m = namn.match(/^(.+?)_([A-Za-z0-9]{1,3})$/); if (m) return m[2].toUpperCase()
  m = namn.match(/^(.+?)\s+rev\s+([A-Za-z0-9]{1,3})$/i); if (m) return m[2].toUpperCase()
  m = namn.match(/^(.+?)\(([A-Za-z0-9]{1,3})\)$/); if (m) return m[2].toUpperCase()
  return null
}

// Kompakt dato-tidsstempel, brukt i filnamnet i staden for revisjon når
// ingen revisjon vart funnen verken i filnamnet eller i PDF-tittelfeltet.
function formatTidsstempel(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

// Kjende fagkodar (same liste som i pdf_autotagger.py, sjå
// claude/prosjektplan-tegningskontroll.md) — brukt til å gjette faget frå
// dokumentnummeret sitt fyrste ledd, og til Fag-D-<løpenr>-fallnummer for
// dokument der appen ikkje klarte å tolke ut noko dokumentnummer i det heile.
// Kodane er ledd 1 i dokumentnummeret, verdiane er det FULLE fagnamnet
// som skal visast (t.d. «A» → «Arkitekt», ikkje berre bokstaven) — sjå
// brukar sitt krav 24. sept. 2026.
const FAG_NAMN = {
  A: 'Arkitekt', ARK: 'Arkitekt',
  RIB: 'Rådgivande ingeniør bygg', RIE: 'Rådgivande ingeniør elektro',
  RIV: 'Rådgivande ingeniør VVS', RIVA: 'Rådgivande ingeniør VA',
  R: 'Rådgivar', K: 'Konstruksjon', L: 'Landskap',
}
function gjettFag(nr) {
  const fyrsteLedd = String(nr || '').split(/[-_ ]/)[0].toUpperCase()
  return FAG_NAMN[fyrsteLedd] || ''
}

// Ser om `nr` faktisk ser ut som ein gyldig dokumentkode (fagbokstavar +
// bindestrek, t.d. «A-40-02-02» eller IFC-forma «A-01»), i staden for at
// parseFilnamn() sin fallback berre gav att heile filnamnet uendra (som
// skjer for filnamn utan noko attkjenneleg mønster). Reint syntaktisk
// sjekk — ei fullstendig, sikker deteksjon er ikkje mogleg, sjå
// claude/dtm-modul.md.
function serUtSomDokumentkode(nr) {
  return /^[A-Za-zÆØÅæøå]{1,4}-\d/.test(String(nr || ''))
}

// Flytt ei fil — prøver rename (raskt), fell tilbake til kopi+slett
// viss kjelde og mål ligg på ulike stasjonar/delte område (EXDEV).
// Kjelda kan vere skriveverna (sjå gjerSkriveverna() under) — det stoppar
// ikkje rename (ei rein katalog-operasjon), men copy+slett-fallbacken må
// fjerne skriveverninga frå kjelda fyrst, elles feilar unlink på Windows.
function flyttFil(kjelde, mål) {
  try {
    fs.renameSync(kjelde, mål)
  } catch (e) {
    fs.copyFileSync(kjelde, mål)
    try { fs.chmodSync(kjelde, 0o666) } catch { /* uironisk om det feilar */ }
    fs.unlinkSync(kjelde)
  }
}

// Gjer ei fil skriveverna (t.d. på Windows: set berre-lesing-attributtet).
// Brukt på filer i resultatdokument-mappa — dei er ferdige, leverte
// dokument og skal ikkje kunne endrast eller overskrivast ved eit uhell;
// ei ny revisjon skal alltid leggjast inn via appen (som flyttar den gamle
// fila til «Versjoner» fyrst).
function gjerSkriveverna(sti) {
  try { fs.chmodSync(sti, 0o444) } catch { /* stille — ikkje kritisk */ }
}

// Finn eit ledig filnamn i Versjoner-mappa (aldri overskriv ein
// tidlegare versjon ved uhell).
function ledigVersjonsnamn(versjonerSti, stem, rev, ext) {
  let namn = `${stem}_REV${rev}${ext}`
  let sti = path.join(versjonerSti, namn)
  let teller = 2
  while (fs.existsSync(sti)) {
    namn = `${stem}_REV${rev}(${teller})${ext}`
    sti = path.join(versjonerSti, namn)
    teller++
  }
  return sti
}

ipcMain.handle('resultatdokument:velg-mappe', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  if (result.canceled || !result.filePaths[0]) return null
  return result.filePaths[0]
})

ipcMain.handle('resultatdokument:apne-mappe', async (event, sti) => {
  if (!sti || !fs.existsSync(sti)) return false
  await shell.openPath(sti)
  return true
})

ipcMain.handle('resultatdokument:list', async (event, { prosjektSti }) => {
  if (!prosjektSti || !fs.existsSync(prosjektSti)) return { finst: false, filer: [] }
  const filer = fs.readdirSync(prosjektSti, { withFileTypes: true })
    .filter(f => f.isFile())
    .map(f => {
      const fullSti = path.join(prosjektSti, f.name)
      gjerSkriveverna(fullSti) // rettar opp filer som vart lagt inn før skriveverninga fanst
      const stat = fs.statSync(fullSti)
      const { nr, rev } = parseFilnamn(f.name)
      return { namn: f.name, nr, rev, endra: stat.mtimeMs }
    })
    .sort((a, b) => a.namn.localeCompare(b.namn, 'no'))
  const versjonerSti = path.join(prosjektSti, 'Versjoner')
  const versjonerTal = fs.existsSync(versjonerSti)
    ? fs.readdirSync(versjonerSti, { withFileTypes: true }).filter(f => f.isFile()).length
    : 0
  return { finst: true, filer, versjonerTal }
})

// Opnar ei fil i resultatdokument-mappa med systemet sitt standardprogram
// (t.d. Adobe/Edge for PDF). Filene er skriveverna, sjå gjerSkriveverna().
ipcMain.handle('resultatdokument:apne-fil', async (event, { prosjektSti, filnamn }) => {
  if (!prosjektSti || !filnamn) return false
  const sti = path.join(prosjektSti, filnamn)
  if (!fs.existsSync(sti)) return false
  await shell.openPath(sti)
  return true
})

// Legg til éin eller fleire filer i prosjektet sin resultatdokument-mappe.
// Dersom ei fil med same teikningsnummer allereie ligg der, vert DEN
// eksisterande fila flytta til «Versjoner» og få _REVx lagt til namnet
// før den nye fila vert plassert.
ipcMain.handle('resultatdokument:legg-til', async (event, { prosjektSti, filPathar }) => {
  if (!prosjektSti) {
    return (filPathar || []).map(fp => ({ fil: path.basename(fp), status: 'feil', melding: 'Inga mappe er sett for prosjektet.' }))
  }
  if (!fs.existsSync(prosjektSti)) {
    return (filPathar || []).map(fp => ({ fil: path.basename(fp), status: 'feil', melding: `Fann ikkje mappa: ${prosjektSti}` }))
  }

  const versjonerSti = path.join(prosjektSti, 'Versjoner')
  const resultat = []

  for (const kjeldeSti of filPathar) {
    const filnamn = path.basename(kjeldeSti)
    try {
      if (!fs.existsSync(kjeldeSti)) {
        resultat.push({ fil: filnamn, status: 'feil', melding: 'Fann ikkje kjeldefila.' })
        continue
      }
      const { nr } = parseFilnamn(filnamn)

      // Finn eksisterande fil(er) i mål-mappa med same teikningsnummer
      const eksisterande = fs.readdirSync(prosjektSti, { withFileTypes: true })
        .filter(f => f.isFile())
        .map(f => f.name)
        .filter(namn => namn !== filnamn && parseFilnamn(namn).nr === nr)

      let flytta = []
      if (eksisterande.length > 0) {
        if (!fs.existsSync(versjonerSti)) fs.mkdirSync(versjonerSti, { recursive: true })
        for (const gammalFil of eksisterande) {
          const gammalRev = parseFilnamn(gammalFil).rev
          const gammalExt = path.extname(gammalFil)
          const gammalStem = path.basename(gammalFil, gammalExt)
          const målSti = ledigVersjonsnamn(versjonerSti, gammalStem, gammalRev, gammalExt)
          flyttFil(path.join(prosjektSti, gammalFil), målSti)
          flytta.push(path.basename(målSti))
        }
      }

      const målSti = path.join(prosjektSti, filnamn)
      flyttFil(kjeldeSti, målSti)
      gjerSkriveverna(målSti)

      const { rev } = parseFilnamn(filnamn)
      resultat.push({ fil: filnamn, status: 'ok', nr, rev, flytta: flytta.length ? flytta : null })
    } catch (e) {
      resultat.push({ fil: filnamn, status: 'feil', melding: e.message })
    }
  }

  return resultat
})

// ═══════════════════════════════════════════════════════════════════
// Kvalitetsmodul (KS) — same fil-bru, eigne endepunkt
// ═══════════════════════════════════════════════════════════════════
//
// Byggjer på same mappekonvensjon som pdf_vaktar.py brukte:
//   <oppdragsSti>\4 Resultatdokumenter\kontroll\til kontroll\        ← nye filer hamnar her
//   <oppdragsSti>\4 Resultatdokumenter\kontroll\Kontrollkopiar\…\    ← ferdigstilte kontrollar
//
// «prosjektSti» (parameternamnet under) er stien som Resultatdokument-
// modulen alt reknar ut (oppdragsSti + «4 Resultatdokumenter», låst i
// Prosjekt-modulen) — ingen eigen sti for KS-modulen.

// Les tekst frå éi side i eit ope PDF-dokument, gruppert i LINJER og i
// CELLER (kolonnar) innanfor kvar linje.
//
// Retta 24. sept. 2026: DTM-import synte at det opphavlege, Python-porta
// «merkelapp: verdi på éi linje»-mønsteret (les_tittelfelt() i
// pdf_vaktar.py) ikkje fann NOKO i det heile på Norconsult sin faktiske
// standardmal — der står merkelappen («Oppdragsgiver») og verdien
// («Gunvald Johansen Bygg AS») på TO ulike linjer, ikkje kolon-skilde på
// éi. I tillegg gjev pdfjs-dist sin getTextContent() ofte kvart teikn/tal
// som eit HEILT EIGE «item» (t.d. tre item «1», «0», «0» for talet 100) —
// den gamle koda limte ALLE item i ei linje saman med mellomrom mellom
// kvart einaste eitt, som gjorde om «100» til «1 0 0» og fekk \d+-regex
// til berre å fange fyrste sifferet («1:1» i staden for «1:100»).
//
// Grupperer difor med tre nivå (i staden for berre «linje»):
//   - TEIKN_GAP  — nesten null mellomrom → same teikn-run, INGEN
//                  mellomrom ved samanslåing (fiksar «1 0 0» → «100»)
//   - ORD_GAP    — vanleg ordmellomrom  → same CELLE (kolonne), eitt
//                  mellomrom ved samanslåing
//   - > ORD_GAP  → NY celle (ny kolonne i tittelfeltet/tabellen)
// Kvar linje vert difor ei liste med celler, ikkje berre éin tekststreng —
// naudsynt for å kunne slå opp «cella rett under» ei merkelapp-celle
// (tolkStablaFelt) og for å lese revisjonstabellen kolonne for kolonne
// (tolkRevisjonstabell).
async function lesLinjerFraSide(pdf, sideNr) {
  try {
    if (sideNr < 1 || sideNr > pdf.numPages) return []
    const page = await pdf.getPage(sideNr)
    const content = await page.getTextContent()

    // Avgrensar til tittelfeltet (nedre høgre hjørne av arket), same
    // konvensjon som pdf_vaktar.py brukte (sjå
    // claude/prosjektplan-tegningskontroll.md). Lagt til 25. sept. 2026:
    // utan denne avgrensinga vart ALLE tekstelementa på heile arket (mål-
    // setjingar, romnamn, tegnforklaring osv. — på ei full arbeidsteikning
    // fort fleire hundre) blanda inn i linje/celle-oppdelinga saman med
    // sjølve tittelfeltet, som gjorde celle-grensene upålitelege akkurat
    // der det monar mest (Oppdragsgiver/Tiltakshaver/Oppdragsnummer).
    // Fell tilbake til HEILE sida om avgrensinga ikkje gav nok tekst att
    // (t.d. uvanleg sideoppsett), slik at ingenting går heilt i stykke.
    const [x0, y0, x1, y1] = page.view
    const breidd = x1 - x0, høgd = y1 - y0
    const grenseX = x0 + breidd * 0.60
    const grenseY = y0 + høgd * 0.32
    const heileArket = content.items.filter((item) => item.str && item.str.trim())
    let aktuelle = heileArket.filter((item) => item.transform[4] >= grenseX && item.transform[5] <= grenseY)
    if (aktuelle.length < 15) aktuelle = heileArket

    const rader = []
    for (const item of aktuelle) {
      const y = item.transform[5]
      let rad = rader.find((r) => Math.abs(r.y - y) <= 2.5)
      if (!rad) { rad = { y, delar: [] }; rader.push(rad) }
      rad.delar.push({ x: item.transform[4], breidd: item.width || item.str.length * 4.5, tekst: item.str })
    }
    rader.sort((a, b) => b.y - a.y) // pdf-koordinatar: høgast y er øvst på sida

    // Grensene er RELATIVE til gjennomsnittleg teiknbreidd (item.breidd /
    // talet på teikn) i staden for faste punkt-verdiar. Retta 24. sept.
    // 2026 — ein fast ORD_GAP=20 var for STOR for tronge tal-kolonnar
    // (t.d. «Oppdragsnummer  Tegningsnummer» limte «52406865» og
    // «A-60-02» saman til éi celle, sidan mellomrommet mellom dei var
    // mindre enn 20 punkt), men måtte samstundes vere stor nok til å IKKJE
    // kutte vanlege setningar («Sjøåsan B21 - Detaljprosjekt») i fleire
    // celler. Ein relativ grense skalerer naturleg med skriftstorleiken på
    // ulike stader på sida (stor teikningstittel vs. liten tabelltekst).
    return rader.map((r) => {
      const delar = [...r.delar].sort((a, b) => a.x - b.x)
      const celler = []
      for (const d of delar) {
        const dTeiknbreidd = d.breidd / Math.max(1, d.tekst.length)
        const siste = celler[celler.length - 1]
        const gap = siste ? d.x - siste.xSlutt : Infinity
        const referanse = siste ? Math.max(dTeiknbreidd, siste.teiknbreidd, 2) : dTeiknbreidd
        if (siste && gap <= referanse * 3.2) {
          siste.tekst += (gap <= referanse * 0.7 ? '' : ' ') + d.tekst
          siste.xSlutt = Math.max(siste.xSlutt, d.x + d.breidd)
          siste.teiknbreidd = referanse
        } else {
          celler.push({ x: d.x, xSlutt: d.x + d.breidd, tekst: d.tekst, teiknbreidd: dTeiknbreidd })
        }
      }
      return { y: r.y, celler: celler.map(({ x, xSlutt, tekst }) => ({ x, xSlutt, tekst })) }
    })
  } catch {
    return []
  }
}

function flatTekstFraLinjer(linjer) {
  return linjer.map((l) => l.celler.map((c) => c.tekst).join(' ')).join('\n')
}
function samletTekstlengd(linjer) {
  return linjer.reduce((sum, l) => sum + l.celler.reduce((s, c) => s + c.tekst.length, 0), 0)
}

// Merkelapp/verdi-par STABLA i to linjer (merkelapp øvst, verdi rett
// under, same x-posisjon i same rute) — Norconsult sin standardmal for
// tittelfelt. Fyller berre inn felt som er tomme frå før.
const STABLA_FELT = [
  { m: /^oppdragsgiver$/i, felt: 'oppdragsgivar' },
  { m: /^tiltakshaver$/i, felt: 'tiltakshavar' },
  { m: /^tegningsnavn$/i, felt: 'tittel' },
  { m: /^m[aå]lestokk\b/i, felt: 'malestokk' },
  { m: /^oppdragsnummer$/i, felt: 'oppdragsnr' },
  { m: /^tegningsnummer$/i, felt: 'tegningsnrFraPdf' },
  { m: /^revisjon$/i, felt: 'revisjon' },
]
function tolkStablaFelt(linjer, resultat) {
  // Ser i dei NESTE INNTIL TRE linjene (ikkje berre den aller neste) —
  // avstanden mellom merkelapp og verdi kan variere litt (t.d. ei ekstra,
  // nesten-tom linje mellom dei), så éi fast linje under held ikkje alltid.
  const VINDAUGE = 3
  for (let i = 0; i < linjer.length - 1; i++) {
    // Alle KJENDE merkelappar PÅ DENNE linja, sortert etter x — brukt til
    // å avgrense KOR LANGT TIL HØGRE éin verdi skal strekke seg før han
    // høyrer til NESTE merkelapp si eiga kolonne (t.d. Oppdragsgiver og
    // Målestokk ligg på same rad, med kvar sin verdi rett under seg).
    const merkelappar = linjer[i].celler
      .map((c) => ({ c, treff: STABLA_FELT.find((f) => f.m.test(c.tekst.trim())) }))
      .filter((x) => x.treff)
      .sort((a, b) => a.c.x - b.c.x)
    if (merkelappar.length === 0) continue

    for (let mi = 0; mi < merkelappar.length; mi++) {
      const { c: celle, treff } = merkelappar[mi]
      if (resultat[treff.felt]) continue
      const grenseFrå = celle.x - 15
      const grenseTil = mi + 1 < merkelappar.length ? (celle.x + merkelappar[mi + 1].c.x) / 2 : Infinity

      // Verdien kan vere FRAGMENTERT i fleire celler (t.d. eit langt
      // firmanamn) — vel linja med FLEST celler innanfor kolonneområdet
      // blant dei næraste, og set saman alle cellene i x-rekkjefølgje, i
      // staden for å berre plukke den EINE cella som ligg næraste.
      let bestLinje = -1, bestTal = 0
      for (let j = i + 1; j < Math.min(linjer.length, i + 1 + VINDAUGE); j++) {
        const tal = linjer[j].celler.filter((v) => v.tekst.trim() && v.x >= grenseFrå && v.x < grenseTil).length
        if (tal > bestTal) { bestTal = tal; bestLinje = j }
      }
      if (bestLinje === -1) continue
      const verdiCeller = linjer[bestLinje].celler
        .filter((v) => v.tekst.trim() && v.x >= grenseFrå && v.x < grenseTil)
        .sort((a, b) => a.x - b.x)
      if (verdiCeller.length) resultat[treff.felt] = verdiCeller.map((v) => v.tekst.trim()).join(' ')
    }
  }

  // Forsvar mot celler som slo seg saman på tvers av kolonnegrensa (t.d.
  // «52406865 A-60-02» i staden for to åtskilde celler, dersom gapet
  // mellom dei var mindre enn cella-grensa i lesLinjerFraSide()) — splittar
  // oppdragsnummer frå eit tegningsnummer som heng med på slutten.
  if (resultat.oppdragsnr) {
    const m = resultat.oppdragsnr.match(/^(\d{3,})\s+([A-Za-zÆØÅæøå]{1,4}-\S+)$/)
    if (m) {
      resultat.oppdragsnr = m[1]
      if (!resultat.tegningsnrFraPdf) resultat.tegningsnrFraPdf = m[2]
    }
  }
}

// Revisjonstabellen (Rev. | Dato | Beskrivelse | ... | Utarbeidet |
// Fagkontroll | Godkjent) — finn header-rada, reknar ut KOLONNE-OMRÅDE
// (x-intervall) frå header-cellene sine x-posisjonar, og les kvar data-rad
// ved å SAMLE ALLE celler som fell innanfor kvart områd (IKKJE berre den
// eine cella som ligg næraste, og IKKJE ved ordinal celle-indeks). Dette
// er naudsynt for fleirords-verdiar som «Arbeidstegninger for bruk» i
// Beskrivelse-kolonna — dei kan hamne som FLEIRE separate celler (om
// ordmellomromma innanfor verdien vart tolka som cellegrenser), og då
// ville «næraste eine celle» berre fanga det fyrste ordet eller bomme
// heilt. Kolonne-områda strekk seg til midtvegs til næraste kolonne.
//
// MERK: data-rada(ne) kan liggje BÅDE over og under header-rada, avhengig
// av malen — i Norconsult sitt oppsett (verifisert mot eit ekte tittelfelt
// 24. sept. 2026) ligg t.d. den siste revisjonen RETT OVER header-rada,
// ikkje under. Skannar difor i BÅDE retningar frå header-rada.
const REVISJONSKOL = [
  { namn: 'rev', m: /^rev\.?$/i }, { namn: 'dato', m: /^dato$/i }, { namn: 'beskriving', m: /beskriv/i },
  { namn: 'utarbeidd', m: /utarbeid/i }, { namn: 'fagkontroll', m: /fagkontroll/i }, { namn: 'godkjent', m: /godkjent/i },
]

function lesRadEtterKolonneOmråde(celler, kolonnar) {
  const verdiar = {}
  for (const c of celler) {
    const tekst = c.tekst.trim()
    if (!tekst) continue
    const i = kolonnar.findIndex((k) => c.x >= k.frå && c.x < k.til)
    if (i === -1) continue
    const namn = kolonnar[i].namn
    verdiar[namn] = verdiar[namn] ? `${verdiar[namn]} ${tekst}` : tekst
  }
  return verdiar
}

function samleRevisjonsrader(linjer, headerIdx, kolonnar, retning) {
  const rader = []
  for (let i = headerIdx + retning; i >= 0 && i < linjer.length; i += retning) {
    const verdiar = lesRadEtterKolonneOmråde(linjer[i].celler, kolonnar)
    const revTekst = (verdiar.rev || '').toUpperCase()
    // Stopp ved fyrste rad som ikkje ser ut som ein revisjonskode — t.d.
    // ei tom rad eller den lovpålagde brødteksten ved sida av tabellen.
    if (!revTekst || !/^[A-ZÆØÅ]{0,2}\d{0,2}$/.test(revTekst)) break
    rader.push({ rev: revTekst, dato: verdiar.dato || '', beskriving: verdiar.beskriving || '',
      utarbeidd: verdiar.utarbeidd || '', fagkontroll: verdiar.fagkontroll || '', godkjent: verdiar.godkjent || '' })
  }
  return rader
}

function tolkRevisjonstabell(linjer, resultat) {
  const headerIdx = linjer.findIndex((l) =>
    l.celler.some((c) => /^rev\.?$/i.test(c.tekst.trim())) &&
    l.celler.some((c) => /^dato$/i.test(c.tekst.trim())))
  if (headerIdx === -1) return
  const header = linjer[headerIdx].celler

  const kolonnar = []
  for (const c of header) {
    const treff = REVISJONSKOL.find((k) => k.m.test(c.tekst.trim()))
    if (treff) kolonnar.push({ namn: treff.namn, x: c.x })
  }
  if (kolonnar.length === 0) return
  kolonnar.sort((a, b) => a.x - b.x)
  kolonnar.forEach((k, i) => {
    k.frå = i === 0 ? -Infinity : (kolonnar[i - 1].x + k.x) / 2
    k.til = i === kolonnar.length - 1 ? Infinity : (k.x + kolonnar[i + 1].x) / 2
  })

  const rader = [
    ...samleRevisjonsrader(linjer, headerIdx, kolonnar, -1).reverse(),
    ...samleRevisjonsrader(linjer, headerIdx, kolonnar, 1),
  ]
  if (rader.length === 0) return

  const rad = (resultat.revisjon && rader.find((r) => r.rev === resultat.revisjon.toUpperCase())) || rader[rader.length - 1]
  if (!resultat.revisjon) resultat.revisjon = rad.rev
  if (!resultat.dato) resultat.dato = rad.dato
  if (!resultat.revisjonsbeskriving) resultat.revisjonsbeskriving = rad.beskriving
  if (!resultat.teikna_av) resultat.teikna_av = rad.utarbeidd
  if (!resultat.fk_person) resultat.fk_person = rad.fagkontroll
  if (!resultat.godkjent_av) resultat.godkjent_av = rad.godkjent
}

// Gamal, generisk «merkelapp: verdi» PÅ ÉI LINJE-tolking (same mønster
// som det opphavlege les_tittelfelt() i pdf_vaktar.py) — kjørast som
// FALLBACK etter tolkStablaFelt()/tolkRevisjonstabell(), for tittelfelt-
// malar som brukar denne enklare, kolon-skilde stilen i staden for
// Norconsult sin stabla to-linjers stil. Fyller berre inn felt som
// framleis er tomme.
function tolkInlineMerkelappar(tekst, resultat) {
  for (const raw of tekst.split('\n')) {
    const l = raw.trim()
    let m

    m = l.match(/(?:målestokk|malestokk|scale|m[aå]l)\s*[:\s]*(\d+\s*:\s*\d+)/i)
    if (m && !resultat.malestokk) resultat.malestokk = m[1].replace(/\s+/g, '')

    m = l.match(/\b(1\s*:\s*\d+)\b/)
    if (m && !resultat.malestokk) resultat.malestokk = m[1].replace(/\s+/g, '')

    m = l.match(/(?:tittel|title|teikning)\s*[:\s]+(.+)/i)
    if (m && !resultat.tittel) resultat.tittel = m[1].trim()

    m = l.match(/(?:teikna|tegnet|drawn|drwn)\s*(?:av|by)?\s*[:\s]+(\w{2,4})/i)
    if (m && !resultat.teikna_av) resultat.teikna_av = m[1].toUpperCase()

    m = l.match(/(?:egenkontroll|kontrollert|checked|chkd|ek)\s*(?:av|by)?\s*[:\s]+(\w{2,4})/i)
    if (m && !resultat.ek_person) resultat.ek_person = m[1].toUpperCase()

    m = l.match(/(?:fagkontroll|godkjent|approved|appd|fk)\s*(?:av|by)?\s*[:\s]+(\w{2,4})/i)
    if (m && !resultat.fk_person) resultat.fk_person = m[1].toUpperCase()

    m = l.match(/(?:dato|date)\s*[:\s]+(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})/i)
    if (m && !resultat.dato) resultat.dato = m[1]

    m = l.match(/\b(A[0-4])\b/)
    if (m && !resultat.format) resultat.format = m[1]

    m = l.match(/\bREV(?:ISJON)?[:\s.]+([A-Z0-9]{1,3})\b/i)
    if (m && !resultat.revisjon) resultat.revisjon = m[1].toUpperCase()
  }
}

// Les tittelfelt frå ein PDF: prøver siste side fyrst (tittelfeltet ligg
// vanlegvis der), med fyrste side som fallback dersom for lite tekst vart
// funnen. Loggar den lesne linje/celle-strukturen OG resultatet til
// konsollen (terminalen der «npm run electron»/«npm run dev» køyrer) —
// send dette hit om ei teikning framleis ikkje vert tolka rett, så kan
// mønstera/grenseverdiane (ORD_GAP m.fl.) justerast mot faktiske tal.
async function lesTittelfelt(pdfSti) {
  const resultat = {
    tittel: '', malestokk: '', teikna_av: '', ek_person: '', fk_person: '', dato: '', format: '', revisjon: '',
    oppdragsgivar: '', tiltakshavar: '', oppdragsnr: '', tegningsnrFraPdf: '', godkjent_av: '', revisjonsbeskriving: '',
  }
  try {
    const pdfjsLib = await lastPdfjs()
    const data = new Uint8Array(fs.readFileSync(pdfSti))
    const pdf = await pdfjsLib.getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise
    if (pdf.numPages === 0) return resultat

    let linjer = await lesLinjerFraSide(pdf, pdf.numPages)
    if (samletTekstlengd(linjer) < 20 && pdf.numPages > 1) {
      linjer = [...(await lesLinjerFraSide(pdf, 1)), ...linjer]
    }
    console.log(`[DTM] ${path.basename(pdfSti)} — lesne linjer:\n` +
      linjer.map((l) => l.celler.map((c) => c.tekst).join(' | ')).join('\n') + '\n[DTM] ── slutt ──')

    tolkStablaFelt(linjer, resultat)
    tolkRevisjonstabell(linjer, resultat)
    tolkInlineMerkelappar(flatTekstFraLinjer(linjer), resultat)

    if (!resultat.tittel) resultat.tittel = parseFilnamn(path.basename(pdfSti)).nr
    console.log(`[DTM] ${path.basename(pdfSti)} — tolka:`, resultat)
  } catch (e) {
    // Filnamn-tolking dekkjer framleis nr/rev sjølv om PDF-innhaldet
    // ikkje let seg lese — men logg feilen, i staden for å svelgje han
    // stille, slik at ho kan diagnostiserast frå terminalen.
    console.error(`[DTM] Klarte ikkje lese tittelfelt i ${path.basename(pdfSti)}:`, e)
  }
  return resultat
}

// Finn eit ledig filnamn i mål-mappa (ingen automatisk versjonering her
// slik som i Resultatdokument — «til kontroll» er ei innboks der fleire
// leveransar av same teikning kan liggje samstundes før kontroll).
function ledigFilnamn(mappe, filnamn) {
  const ext = path.extname(filnamn)
  const stem = path.basename(filnamn, ext)
  let namn = filnamn
  let sti = path.join(mappe, namn)
  let teller = 2
  while (fs.existsSync(sti)) {
    namn = `${stem}(${teller})${ext}`
    sti = path.join(mappe, namn)
    teller++
  }
  return sti
}

ipcMain.handle('ks:list', async (event, { prosjektSti }) => {
  const tilKontrollSti = path.join(prosjektSti || '', 'kontroll', 'til kontroll')
  if (!prosjektSti || !fs.existsSync(tilKontrollSti)) return { finst: false, filer: [] }
  const filer = fs.readdirSync(tilKontrollSti, { withFileTypes: true })
    .filter((f) => f.isFile())
    .map((f) => f.name)
    .sort((a, b) => a.localeCompare(b, 'no'))
  return { finst: true, filer }
})

// Opnar ei fil i «til kontroll» med systemet sitt standardprogram. I
// motsetnad til resultatdokument-filene er desse IKKJE skriveverna —
// dei er framleis under kontroll og skal kunne merkast/redigerast
// (t.d. i Adobe Acrobat) fram til dei vert ferdigstilte.
ipcMain.handle('ks:apne-fil', async (event, { prosjektSti, filnamn }) => {
  if (!prosjektSti || !filnamn) return false
  const sti = path.join(prosjektSti, 'kontroll', 'til kontroll', filnamn)
  if (!fs.existsSync(sti)) return false
  await shell.openPath(sti)
  return true
})

// Flyttar dei dropa filene til «kontroll/til kontroll», skannar filnamn
// (nr/rev) + PDF-innhald (tittelfelt), og returnerer metadata for kvar
// fil slik at renderar-koden kan lagre dei som rader i ks_teikningar.
ipcMain.handle('ks:skann-og-legg-til', async (event, { prosjektSti, filPathar }) => {
  if (!prosjektSti) {
    return (filPathar || []).map((fp) => ({ fil: path.basename(fp), status: 'feil', melding: 'Inga mappe er sett for prosjektet.' }))
  }
  const tilKontrollSti = path.join(prosjektSti, 'kontroll', 'til kontroll')
  fs.mkdirSync(tilKontrollSti, { recursive: true })

  const resultat = []
  for (const kjeldeSti of filPathar) {
    const opphavFilnamn = path.basename(kjeldeSti)
    try {
      if (!fs.existsSync(kjeldeSti)) {
        resultat.push({ fil: opphavFilnamn, status: 'feil', melding: 'Fann ikkje kjeldefila.' })
        continue
      }
      const målSti = ledigFilnamn(tilKontrollSti, opphavFilnamn)
      flyttFil(kjeldeSti, målSti)
      const filnamn = path.basename(målSti)

      const { nr, rev } = parseFilnamn(filnamn)
      let meta = { tittel: '', malestokk: '', teikna_av: '', ek_person: '', fk_person: '', dato: '', format: '' }
      if (filnamn.toLowerCase().endsWith('.pdf')) {
        meta = await lesTittelfelt(målSti)
      }

      resultat.push({
        fil: filnamn, status: 'ok', nr, rev,
        tittel: meta.tittel || nr, malestokk: meta.malestokk,
        teikna_av: meta.teikna_av, ek_person: meta.ek_person, fk_person: meta.fk_person,
        dato: meta.dato, format: meta.format,
      })
    } catch (e) {
      resultat.push({ fil: opphavFilnamn, status: 'feil', melding: e.message })
    }
  }
  return resultat
})

// Ferdigstiller ein kontroll: flyttar dei gjevne filnamna frå
// «til kontroll» til «Kontrollkopiar/<løpenr>_<namn>/».
ipcMain.handle('ks:ferdigstill', async (event, { prosjektSti, seq, namn, filnamn }) => {
  if (!prosjektSti) return { ok: false, melding: 'Inga mappe er sett for prosjektet.' }
  const tilKontrollSti = path.join(prosjektSti, 'kontroll', 'til kontroll')
  const trygtNamn = String(namn || '').trim().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_')
  const målMappe = path.join(prosjektSti, 'kontroll', 'Kontrollkopiar', `${seq}_${trygtNamn}`)
  fs.mkdirSync(målMappe, { recursive: true })

  const flytta = []
  for (const fil of filnamn || []) {
    const kjelde = path.join(tilKontrollSti, fil)
    if (!fs.existsSync(kjelde)) continue
    const målSti = ledigFilnamn(målMappe, fil)
    flyttFil(kjelde, målSti)
    flytta.push(path.basename(målSti))
  }
  return { ok: true, mappe: målMappe, flytta }
})

// ═══════════════════════════════════════════════════════════════════
// DTM — Dokument, tegningar og modellar
// ═══════════════════════════════════════════════════════════════════
//
// Erstattar Resultatdokument-modulen. Sjå claude/dtm-modul.md for full
// spesifikasjon. Fase 2: sjølve fil-brua. Skanning og bekrefta import er
// to separate steg (i motsetnad til ks:skann-og-legg-til, som gjer begge
// på éin gong) — brukar skal kunne rette/fjerne dokument i ei matrise
// FØR noka fil vert flytta, jf. brukar sitt krav.

// Skannar filer UTAN å flytte dei — nr/rev/fag + (for PDF) tittelfelt.
// «kategori» styrer berre korleis dokumentnummeret vert tolka (IFC-
// spesialregel), ikkje kva som vert lese; sjølve flyttinga skjer fyrst i
// dtm:bekreft-import, etter at brukar har fått rette/fjerne dokument.
ipcMain.handle('dtm:skann-filer', async (event, { filPathar, kategori }) => {
  const resultat = []
  for (const kjeldeSti of filPathar || []) {
    const filnamn = path.basename(kjeldeSti)
    const ext = path.extname(filnamn).toLowerCase()
    try {
      if (!fs.existsSync(kjeldeSti)) {
        resultat.push({ kjeldeSti, filnamn, status: 'feil', melding: 'Fann ikkje kjeldefila.' })
        continue
      }

      let { nr } = parseFilnamn(filnamn)
      // IFC-filer: dokumentnummeret er fyrste ledd av filnamnet
      // (<fagbokstav>-<tosifra løpenr>, t.d. «A-01» frå «A-01_Modell.ifc»)
      // — IKKJE heile filnamnet slik parseFilnamn() sin generelle fallback
      // ville gjeve.
      if (ext === '.ifc') {
        const m = filnamn.match(/^([A-Za-zÆØÅæøå]{1,4}-\d{2})/)
        if (m) nr = m[1]
      }

      let revisjon = finnRevisjonFraFilnamn(filnamn)
      let meta = {
        tittel: '', malestokk: '', teikna_av: '', ek_person: '', fk_person: '', dato: '', format: '',
        oppdragsgivar: '', tiltakshavar: '', oppdragsnr: '', tegningsnrFraPdf: '', godkjent_av: '', revisjonsbeskriving: '',
      }
      if (ext === '.pdf') {
        meta = await lesTittelfelt(kjeldeSti)
        if (!revisjon && meta.revisjon) revisjon = meta.revisjon
        // Tegningsnummeret lese FRÅ SJØLVE TEIKNINGA er meir pålitande enn
        // filnamn-gjetting når det finst — same tanke som i pdf_vaktar.py.
        if (meta.tegningsnrFraPdf && serUtSomDokumentkode(meta.tegningsnrFraPdf)) nr = meta.tegningsnrFraPdf
      }

      const fann = serUtSomDokumentkode(nr)
      resultat.push({
        kjeldeSti, filnamn, status: 'ok',
        nr, nrUsikker: !fann, rev: revisjon || '', fag: gjettFag(nr),
        tittel: meta.tittel || nr, malestokk: meta.malestokk, utarbeida_av: meta.teikna_av,
        ek_person: meta.ek_person, fk_person: meta.fk_person, dato: meta.dato, format: meta.format,
        oppdragsgivar: meta.oppdragsgivar, tiltakshavar: meta.tiltakshavar,
        oppdragsnr: meta.oppdragsnr, godkjent_av: meta.godkjent_av,
        revisjonsbeskriving: meta.revisjonsbeskriving,
      })
    } catch (e) {
      resultat.push({ kjeldeSti, filnamn, status: 'feil', melding: e.message })
    }
  }
  return resultat
})

// Bekreftar import: flyttar dei (evt. retta) dokumenta til rett
// kategorimappe med _REV<revisjon>-namngjeving (eller _REV<dato-
// tidsstempel> om ingen revisjon vart funnen), og arkiverer eventuell
// eksisterande gjeldande fil for same dokumentnummer i kategorien sin
// Arkiv-undermappe fyrst. «dokument» er lista frå matrisa AKKURAT SLIK
// brukar har retta ho (kan ha andre nr/rev enn det skanninga fann).
ipcMain.handle('dtm:bekreft-import', async (event, { oppdragsSti, kategori, dokument }) => {
  const mappeNamn = DTM_KATEGORI_MAPPE[kategori]
  if (!oppdragsSti || !mappeNamn) {
    return (dokument || []).map((d) => ({ ...d, status: 'feil', melding: 'Ukjend kategori eller manglande oppdragssti.' }))
  }
  const mappeSti = path.join(oppdragsSti, mappeNamn)
  const arkivSti = path.join(mappeSti, 'Arkiv')
  fs.mkdirSync(arkivSti, { recursive: true })

  const resultat = []
  for (const d of dokument || []) {
    try {
      if (!d.kjeldeSti || !fs.existsSync(d.kjeldeSti)) {
        resultat.push({ ...d, status: 'feil', melding: 'Fann ikkje kjeldefila (kan vere flytta/sletta sidan skanninga).' })
        continue
      }
      const ext = path.extname(d.kjeldeSti)
      const trygtNr = String(d.nr || 'ukjend').replace(/[\\/:*?"<>|]/g, '_')
      const revEllerTidsstempel = d.rev ? String(d.rev).toUpperCase() : formatTidsstempel(new Date())

      let nyttFilnamn = `${trygtNr}_REV${revEllerTidsstempel}${ext}`
      let målSti = path.join(mappeSti, nyttFilnamn)
      let teller = 2
      while (fs.existsSync(målSti)) {
        nyttFilnamn = `${trygtNr}_REV${revEllerTidsstempel}(${teller})${ext}`
        målSti = path.join(mappeSti, nyttFilnamn)
        teller++
      }

      // Finst det alt ei gjeldande fil for same dokumentnummer direkte i
      // kategorimappa (ikkje i Arkiv frå før)? Arkiver ho fyrst.
      const eksisterande = fs.readdirSync(mappeSti, { withFileTypes: true })
        .filter((f) => f.isFile() && f.name.startsWith(trygtNr + '_REV'))
      for (const gammalFil of eksisterande) {
        let arkivMål = path.join(arkivSti, gammalFil.name)
        let t2 = 2
        while (fs.existsSync(arkivMål)) {
          const gammalExt = path.extname(gammalFil.name)
          arkivMål = path.join(arkivSti, `${path.basename(gammalFil.name, gammalExt)}(${t2})${gammalExt}`)
          t2++
        }
        flyttFil(path.join(mappeSti, gammalFil.name), arkivMål)
      }

      flyttFil(d.kjeldeSti, målSti)
      resultat.push({ ...d, status: 'ok', filnamn: nyttFilnamn, rev: revEllerTidsstempel })
    } catch (e) {
      resultat.push({ ...d, status: 'feil', melding: e.message })
    }
  }
  return resultat
})

// Listar gjeldande filer + arkiverte (eldre) revisjonar for éin kategori.
ipcMain.handle('dtm:list', async (event, { oppdragsSti, kategori }) => {
  const mappeNamn = DTM_KATEGORI_MAPPE[kategori]
  if (!oppdragsSti || !mappeNamn) return { finst: false, filer: [], arkiverte: [] }
  const mappeSti = path.join(oppdragsSti, mappeNamn)
  if (!fs.existsSync(mappeSti)) return { finst: false, filer: [], arkiverte: [] }

  const lesMappe = (sti) => fs.existsSync(sti)
    ? fs.readdirSync(sti, { withFileTypes: true }).filter((f) => f.isFile())
        .map((f) => {
          const stat = fs.statSync(path.join(sti, f.name))
          return { namn: f.name, endra: stat.mtimeMs }
        })
    : []

  return {
    finst: true,
    filer: lesMappe(mappeSti),
    arkiverte: lesMappe(path.join(mappeSti, 'Arkiv')),
  }
})

// Opnar ei fil (gjeldande eller arkivert) i systemet sitt standardprogram.
ipcMain.handle('dtm:apne-fil', async (event, { oppdragsSti, kategori, filnamn, arkivert }) => {
  const mappeNamn = DTM_KATEGORI_MAPPE[kategori]
  if (!oppdragsSti || !mappeNamn || !filnamn) return false
  const sti = arkivert
    ? path.join(oppdragsSti, mappeNamn, 'Arkiv', filnamn)
    : path.join(oppdragsSti, mappeNamn, filnamn)
  if (!fs.existsSync(sti)) return false
  await shell.openPath(sti)
  return true
})
