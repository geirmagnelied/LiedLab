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

// pdfjs-dist er berre tilgjengeleg som ES-modul (build/pdf.mjs) — denne
// fila er CommonJS, så vi lastar han inn med ein dynamisk import() og
// cachar resultatet. «legacy»-bygget er meint for Node/eldre miljø utan
// full DOM/Worker-støtte, slik som her.
let pdfjsLibPromise = null
function lastPdfjs() {
  if (!pdfjsLibPromise) pdfjsLibPromise = import('pdfjs-dist/legacy/build/pdf.mjs')
  return pdfjsLibPromise
}

// Live nettversjon (Vercel) — same URL som i nettlesar, sjå README.md
const PROD_URL = 'https://liedarkitektur.no/liedlab/notatblokk/'
// Lokal dev-server (npm run dev), for å teste endringar før dei er pusha
const DEV_URL = 'http://localhost:5173/liedlab/notatblokk/'

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
  // terminal, t.d. under utvikling/testing) — fell elles tilbake til den
  // live nettsida. Slik fungerer både vanleg dagleg bruk (start.bat) og
  // lokal utvikling/testing av nye endringar utan å måtte pushe fyrst.
  win.loadURL(DEV_URL).catch(() => win.loadURL(PROD_URL))
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
//   <resultatDokSti>/kontroll/til kontroll/       ← nye filer hamnar her
//   <resultatDokSti>/kontroll/Kontrollkopiar/…/   ← ferdigstilte kontrollar
//
// «resultatDokSti» er den same stien som er sett for prosjektet i
// Prosjekt-modulen (resultatdokument-mappa) — ingen ny sti trengst.

// Les tekst frå éi side i eit ope PDF-dokument.
//
// pdfjs-dist sin getTextContent() gjev tekst som mange separate,
// posisjonerte «item»-bitar (typisk eitt ord/éin tekst-run kvar) — IKKJE
// ferdige linjer slik det gamle Python-skriptet fekk frå pdfplumber sin
// extract_text() (som klyngjar bitar etter Y-posisjon til visuelle linjer
// for deg). Utan denne klyngjinga hamnar t.d. «Målestokk:» og «1:100» som
// to heilt ulike «linjer» i staden for éi, og regex-mønstera i
// lesTittelfelt() under finn då aldri kvarandre. Derfor grupperer vi her
// tekstbitar med nesten lik Y-posisjon til éi linje, og sorterer bitane
// innanfor linja etter X (venstre til høgre) før vi limer dei saman.
async function lesTekstFraSide(pdf, sideNr) {
  try {
    if (sideNr < 1 || sideNr > pdf.numPages) return ''
    const page = await pdf.getPage(sideNr)
    const content = await page.getTextContent()
    const linjer = []
    for (const item of content.items) {
      if (!item.str || !item.str.trim()) continue
      const y = item.transform[5]
      let linje = linjer.find((l) => Math.abs(l.y - y) <= 2.5)
      if (!linje) { linje = { y, delar: [] }; linjer.push(linje) }
      linje.delar.push({ x: item.transform[4], tekst: item.str })
    }
    linjer.sort((a, b) => b.y - a.y) // pdf-koordinatar: høgast y er øvst på sida
    return linjer.map((l) => l.delar.sort((a, b) => a.x - b.x).map((d) => d.tekst).join(' ')).join('\n')
  } catch {
    return ''
  }
}

// Les tittelfelt frå ein PDF ved å søkje etter kjende mønster i siste
// side (tittelfeltet ligg vanlegvis der), med fyrste side som fallback.
// Same regex-mønster som les_tittelfelt() i pdf_vaktar.py. Loggar den
// tolka teksten og resultatet til konsollen (terminalen der «npm run
// electron»/«npm run dev» køyrer) — nyttig for å sjå kva som faktisk
// vart lese om ei teikning ikkje vert tolka rett.
async function lesTittelfelt(pdfSti) {
  const resultat = { tittel: '', malestokk: '', teikna_av: '', ek_person: '', fk_person: '', dato: '', format: '' }
  try {
    const pdfjsLib = await lastPdfjs()
    const data = new Uint8Array(fs.readFileSync(pdfSti))
    const pdf = await pdfjsLib.getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise
    if (pdf.numPages === 0) return resultat

    let tekst = await lesTekstFraSide(pdf, pdf.numPages)
    if (tekst.trim().length < 20 && pdf.numPages > 1) {
      tekst = (await lesTekstFraSide(pdf, 1)) + '\n' + tekst
    }
    console.log(`[KS] ${path.basename(pdfSti)} — lese tekst:\n${tekst}\n[KS] ── slutt på lese tekst ──`)

    for (const raw of tekst.split('\n')) {
      const l = raw.trim()
      let m

      m = l.match(/(?:målestokk|malestokk|scale|m[aå]l)\s*[:\s]*(\d+\s*:\s*\d+)/i)
      if (m) resultat.malestokk = m[1].replace(/\s+/g, '')

      m = l.match(/\b(1\s*:\s*\d+)\b/)
      if (m && !resultat.malestokk) resultat.malestokk = m[1].replace(/\s+/g, '')

      m = l.match(/(?:tittel|title|teikning)\s*[:\s]+(.+)/i)
      if (m && !resultat.tittel) resultat.tittel = m[1].trim()

      m = l.match(/(?:teikna|tegnet|drawn|drwn)\s*(?:av|by)?\s*[:\s]+(\w{2,4})/i)
      if (m) resultat.teikna_av = m[1].toUpperCase()

      m = l.match(/(?:egenkontroll|kontrollert|checked|chkd|ek)\s*(?:av|by)?\s*[:\s]+(\w{2,4})/i)
      if (m) resultat.ek_person = m[1].toUpperCase()

      m = l.match(/(?:fagkontroll|godkjent|approved|appd|fk)\s*(?:av|by)?\s*[:\s]+(\w{2,4})/i)
      if (m) resultat.fk_person = m[1].toUpperCase()

      m = l.match(/(?:dato|date)\s*[:\s]+(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})/i)
      if (m) resultat.dato = m[1]

      m = l.match(/\b(A[0-4])\b/)
      if (m && !resultat.format) resultat.format = m[1]
    }

    if (!resultat.tittel) resultat.tittel = parseFilnamn(path.basename(pdfSti)).nr
    console.log(`[KS] ${path.basename(pdfSti)} — tolka:`, resultat)
  } catch (e) {
    // Filnamn-tolking dekkjer framleis nr/rev sjølv om PDF-innhaldet
    // ikkje let seg lese — men logg feilen, i staden for å svelgje han
    // stille, slik at ho kan diagnostiserast frå terminalen.
    console.error(`[KS] Klarte ikkje lese tittelfelt i ${path.basename(pdfSti)}:`, e)
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
