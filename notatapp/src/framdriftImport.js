import { addDays } from 'date-fns'
import { iso, tilDato, parseDato, nesteArbeidsdag, forrigeArbeidsdag, leggTilArbeidsdagar } from './framdriftDato'
import { nyId, rullOpp } from './framdriftLogikk'

// ═══════════════════════════════════════════════════════════════════
//  Import av framdriftsplanar (claude/framdrift-modul.md). Reint nettlesar-
//  kode — ingen Electron-bru: filer vert lesne via File-objektet.
//    • Excel (.xlsx/.xls) og CSV/tekst: SheetJS (lasta fyrst når det trengst)
//      + automatisk gjetting av kolonnar, brukar kan rette kolonnekoplinga.
//    • MS Project XML (Fil → Lagre som → XML-format): DOMParser. Tek med
//      oppgåvenamn, datoar, milepælar, disposisjonsnivå og avhengnader av
//      typen «slutt → start». Ressursar og kostnader vert hoppa over.
//  Importerte datoar vert BRUKT SLIK DEI ER (ingen omrekning av kritisk
//  line/nivellering); avhengnadene vert først handheva når brukar seinare
//  flyttar på noko.
// ═══════════════════════════════════════════════════════════════════

// ── Felt som kan koplast til ei kolonne i ei tabellfil ─────────────────
export const IMPORT_FELT = [
  { key: 'namn',      namn: 'Aktivitet',          krevd: true,  tips: ['aktivitet', 'oppgåve', 'oppgave', 'task', 'name', 'namn', 'navn', 'beskriving', 'beskrivelse', 'activity', 'tittel'] },
  { key: 'start',     namn: 'Start',              tips: ['startdato', 'start', 'frå dato', 'fra dato', 'frå', 'fra', 'begin'] },
  { key: 'slutt',     namn: 'Slutt',              tips: ['sluttdato', 'slutt', 'finish', 'end', 'til dato', 'til', 'frist'] },
  { key: 'varig',     namn: 'Varigheit',          tips: ['varigheit', 'varighet', 'duration', 'arbeidsdagar', 'arbeidsdager', 'dagar', 'dager'] },
  { key: 'ansvarleg', namn: 'Ansvarleg',          tips: ['ansvarleg', 'ansvarlig', 'responsible', 'resource', 'ressurs', 'person', 'eigar', 'eier'] },
  { key: 'niva',      namn: 'Nivå / type (valfri)', tips: ['nivå', 'niva', 'level', 'outline', 'disposisjon', 'type'] },
]

const norm = (s) => String(s ?? '').trim().toLowerCase()

export function gjettKolonnar(overskrifter) {
  const map = {}
  const brukt = new Set()
  const hdr = overskrifter.map(norm)
  for (const f of IMPORT_FELT) {
    let idx = -1
    for (const tips of f.tips) {
      idx = hdr.findIndex((h, i) => !brukt.has(i) && h === tips)
      if (idx >= 0) break
    }
    if (idx < 0) for (const tips of f.tips) {
      idx = hdr.findIndex((h, i) => !brukt.has(i) && h && h.includes(tips))
      if (idx >= 0) break
    }
    map[f.key] = idx
    if (idx >= 0) brukt.add(idx)
  }
  return map
}

// ── Les fil til rader ───────────────────────────────────────────────────
function parseCsv(tekst) {
  const forste = tekst.split(/\r?\n/, 1)[0] || ''
  const tel = (c) => forste.split(c).length - 1
  const skil = [';', '\t', ','].sort((a, b) => tel(b) - tel(a))[0]
  const rader = []
  let rad = [], felt = '', iKnutar = false
  for (let i = 0; i < tekst.length; i++) {
    const c = tekst[i]
    if (iKnutar) {
      if (c === '"' && tekst[i + 1] === '"') { felt += '"'; i++ }
      else if (c === '"') iKnutar = false
      else felt += c
    } else if (c === '"') iKnutar = true
    else if (c === skil) { rad.push(felt); felt = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && tekst[i + 1] === '\n') i++
      rad.push(felt); felt = ''
      rader.push(rad); rad = []
    } else felt += c
  }
  if (felt !== '' || rad.length) { rad.push(felt); rader.push(rad) }
  return rader.filter(r => r.some(c => String(c).trim() !== ''))
}

// Gjev { type:'msp', tekst } | { type:'tabell', ark:[{namn, rader:[[...]]}] }
export async function lesFil(fil) {
  const namn = fil.name.toLowerCase()
  if (namn.endsWith('.xml')) return { type: 'msp', tekst: await fil.text() }
  if (namn.endsWith('.mpp')) throw new Error('Direkte .mpp-filer er ikkje støtta (lukka binærformat). Opne fila i MS Project og vel Fil → Lagre som → XML-format, importer deretter XML-fila.')
  if (/\.(csv|tsv|txt)$/.test(namn)) {
    return { type: 'tabell', ark: [{ namn: fil.name, rader: parseCsv(await fil.text()) }] }
  }
  const mod = await import('xlsx')
  const XLSX = mod.read ? mod : mod.default
  const bok = XLSX.read(await fil.arrayBuffer(), { type: 'array', cellDates: true })
  const ark = bok.SheetNames.map(n => ({
    namn: n,
    rader: XLSX.utils.sheet_to_json(bok.Sheets[n], { header: 1, raw: true, defval: '' })
      .filter(r => r.some(c => String(c).trim() !== '')),
  })).filter(a => a.rader.length)
  if (!ark.length) throw new Error('Fann ingen data i fila.')
  return { type: 'tabell', ark }
}

// ── Celleverdiar → datoar/varigheit ───────────────────────────────────
function tilIso(v) {
  if (v instanceof Date && !isNaN(v)) {
    // SheetJS gjev lokal midnatt med små tidssone-avvik; +12 t gjer datoen robust.
    return iso(new Date(v.getTime() + 12 * 3600e3))
  }
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const u = new Date(Math.round((v - 25569) * 86400000))
    return iso(new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()))
  }
  const d = parseDato(v)
  return d ? iso(d) : null
}

function tilVarigheit(v) {
  if (typeof v === 'number') return v > 0 ? Math.round(v) : null
  const t = norm(v).replace(',', '.')
  const m = /^(\d+(?:\.\d+)?)\s*([a-zæøå]*)/.exec(t)
  if (!m) return null
  const n = parseFloat(m[1])
  const e = m[2]
  if (!(n > 0)) return null
  if (e.startsWith('v') || e.startsWith('w')) return Math.round(n * 5)
  if (e.startsWith('t') || e.startsWith('h')) return Math.max(1, Math.ceil(n / 7.5))
  return Math.round(n)
}

function typeFraNiva(v) {
  const t = norm(v)
  if (!t) return null
  if (/^\d+$/.test(t)) return t === '1' ? 'fase' : 'aktivitet'
  if (t.includes('fase') || t.includes('phase') || t.includes('summary') || t.includes('sammendrag')) return 'fase'
  if (t.includes('milep') || t.includes('milest')) return 'milepael'
  return 'aktivitet'
}

// ── Tabell → plan ─────────────────────────────────────────────────────
export function byggFraTabell(rader, kol, { harOverskrift = true } = {}) {
  const merknader = []
  const data = harOverskrift ? rader.slice(1) : rader
  const ut = []
  let fase = null
  let hoppa = 0
  const celle = (r, key) => (kol[key] >= 0 ? r[kol[key]] : '')
  for (const r of data) {
    const namn = String(celle(r, 'namn') ?? '').trim()
    if (!namn) { hoppa++; continue }
    let type = typeFraNiva(celle(r, 'niva')) || 'aktivitet'
    let start = tilIso(celle(r, 'start'))
    let slutt = tilIso(celle(r, 'slutt'))
    const varig = tilVarigheit(celle(r, 'varig'))
    if (start && slutt && slutt < start) { const t = start; start = slutt; slutt = t }
    if (start && !slutt) slutt = varig ? iso(leggTilArbeidsdagar(nesteArbeidsdag(tilDato(start)), varig - 1)) : start
    if (!start && slutt && varig) start = iso(forrigeArbeidsdag(addDays(tilDato(slutt), -(Math.ceil(varig * 7 / 5) - 1))))
    if (!start || !slutt) {
      if (type === 'fase') { start = slutt = iso(new Date()) }  // rullar opp frå barna om det finst
      else { hoppa++; continue }
    }
    if (type !== 'fase' && start === slutt && !varig && /milep|milest/.test(norm(celle(r, 'niva')))) type = 'milepael'
    if (type === 'aktivitet' && start === slutt && /milep|milest/.test(norm(namn))) type = 'milepael'
    const el = {
      id: nyId(), type, namn, start, slutt: type === 'milepael' ? start : slutt,
      forelder: null, avh: [], ansvarleg: String(celle(r, 'ansvarleg') ?? '').trim(), ferdig: 0, fasekode: '',
    }
    if (type === 'fase') fase = el.id
    else if (fase != null && kol.niva >= 0) el.forelder = fase
    ut.push(el)
  }
  if (hoppa) merknader.push(`${hoppa} rad${hoppa === 1 ? '' : 'er'} vart hoppa over (manglar namn eller datoar).`)
  return { elementer: rullOpp(ut), merknader }
}

// ── MS Project XML → plan ─────────────────────────────────────────────
export function parseMspXml(tekst) {
  const doc = new DOMParser().parseFromString(tekst, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Fila er ikkje gyldig XML.')
  const oppgaver = Array.from(doc.getElementsByTagName('Task'))
  if (!oppgaver.length) throw new Error('Fann ingen oppgåver — er dette ei MS Project XML-fil?')
  const merknader = []
  const barn = (el) => Array.from(el.childNodes).filter(c => c.nodeType === 1)
  const verdi = (el, tag) => {
    for (const c of barn(el)) if (c.localName === tag) return c.textContent.trim()
    return ''
  }
  const datoDel = (s) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null)

  const uidTilId = new Map()
  const ut = []
  const lenker = [] // { id, predUid, type }
  let fase = null
  let hoppaNivå = 0, hoppaTom = 0
  for (const t of oppgaver) {
    const uid = verdi(t, 'UID')
    const nivå = parseInt(verdi(t, 'OutlineLevel'), 10) || 1
    const namn = verdi(t, 'Name')
    if (uid === '0' || nivå === 0 || !namn) { hoppaTom++; continue }
    const sammendrag = verdi(t, 'Summary') === '1'
    const start = datoDel(verdi(t, 'Start'))
    const slutt = datoDel(verdi(t, 'Finish'))
    if (!start || !slutt) { hoppaTom++; continue }
    const milepael = verdi(t, 'Milestone') === '1'
    if (sammendrag && nivå > 1) { hoppaNivå++; continue }
    const el = {
      id: nyId(), type: sammendrag ? 'fase' : milepael ? 'milepael' : 'aktivitet', namn,
      start, slutt: milepael ? start : slutt, forelder: null, avh: [],
      ansvarleg: '', ferdig: Math.min(100, parseInt(verdi(t, 'PercentComplete'), 10) || 0), fasekode: '',
    }
    if (sammendrag) fase = el.id
    else if (nivå > 1) el.forelder = fase
    else fase = null
    uidTilId.set(uid, el.id)
    ut.push(el)
    for (const p of barn(t)) {
      if (p.localName !== 'PredecessorLink') continue
      lenker.push({ id: el.id, predUid: verdi(p, 'PredecessorUID'), type: verdi(p, 'Type') })
    }
  }
  let andreTypar = 0, utan = 0
  for (const l of lenker) {
    const predId = uidTilId.get(l.predUid)
    if (l.type && l.type !== '1') { andreTypar++; continue }
    if (!predId || predId === l.id) { utan++; continue }
    const el = ut.find(e => e.id === l.id)
    if (el.type !== 'fase' || !ut.some(c => c.forelder === el.id)) el.avh.push(predId)
    else utan++
  }
  if (hoppaNivå) merknader.push(`${hoppaNivå} djupare sammendragsoppgåve${hoppaNivå === 1 ? '' : 'r'} vart slått saman inn i fasen over (planen har berre tre nivå).`)
  if (andreTypar) merknader.push(`${andreTypar} avhengnad${andreTypar === 1 ? '' : 'er'} av andre typar enn «slutt → start» vart hoppa over.`)
  if (utan) merknader.push(`${utan} avhengnad${utan === 1 ? '' : 'er'} peika på oppgåver som ikkje vart med, og vart hoppa over.`)
  if (hoppaTom) merknader.push(`${hoppaTom} oppgåve${hoppaTom === 1 ? '' : 'r'} vart hoppa over (tomme eller utan datoar, inkl. prosjektsammendraget).`)
  merknader.push('Ressursar og kostnader er ikkje med. Kritisk line og nivellering vert ikkje rekna ut på nytt.')
  return { elementer: rullOpp(ut), merknader }
}
