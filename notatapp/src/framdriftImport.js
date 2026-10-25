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
    // Aktivitetsnummer og -namn er ofte slått saman i same kolonne («611 ARK prosjektering»): nummer = teikna før fyrste mellomrom
    if (type === 'aktivitet' && !(kol.kode >= 0)) {
      const m = /^(\S*\d\S*)\s+(\S[\s\S]*)$/.exec(namn)
      if (m) { el.kode = m[1]; el.namn = m[2].trim() }
    }
    if (type === 'fase') fase = el.id
    else if (fase != null && kol.niva >= 0) el.forelder = fase
    ut.push(el)
  }
  if (hoppa) merknader.push(`${hoppa} rad${hoppa === 1 ? '' : 'er'} vart hoppa over (manglar namn eller datoar).`)
  return { elementer: rullOpp(ut), merknader }
}

// ── MS Project XML → plan (inkl. eksport frå ISY Prosjekt Plan) ───────────
// Hierarki frå OutlineLevel: nivå 1-sammendrag → fase, djupare sammendrag → summasjonsaktivitet (aktivitet med
// underaktivitetar), blad → aktivitet, milepæl → milepæl. ISY-felt (ExtendedAttribute): Text10 = aktivitetskode,
// Number1 = påløpte timar, Cost1 = påløpt honorar + utlegg, «Physical % Complete» = virkeleg framdrift (timevekta).
// MSP/ISY lagrar kostnader i hundredelar (øre): 247600 = 2 476 kr. Work = budsjetterte timar, FixedCost = budsjett (honorar).
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
  const tal = (s) => { const n = parseFloat(String(s ?? '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }
  const timar = (s) => { const m = /PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+)M)?/.exec(s || ''); return m ? (parseFloat(m[1] || 0) + (parseInt(m[2] || 0, 10) / 60)) : 0 }

  // Utvida felt (definisjonar på prosjektnivå): FieldName → { id, alias }
  const def = {}
  for (const d of Array.from(doc.getElementsByTagName('ExtendedAttribute'))) {
    const namn = verdi(d, 'FieldName')
    if (namn) def[namn] = { id: verdi(d, 'FieldID'), alias: verdi(d, 'Alias') }
  }
  const erIsy = /ISY/i.test(def.Number1?.alias || '') || /ISY/i.test(def.Cost1?.alias || '')
  const feltId = (namn) => def[namn]?.id
  const kodeFelt = (def.Text10 && (/code|kode/i.test(def.Text10.alias) || erIsy)) ? feltId('Text10') : null

  const uidTilId = new Map()
  const ut = []
  const lenker = []
  const stakk = [] // { nivå, id, ufakt }
  let hoppaTom = 0
  const tel = { fasar: 0, summ: 0, akt: 0, mil: 0, medPaalopt: 0, medBudsjett: 0 }
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

    // Overordna frå disposisjonsnivået
    while (stakk.length && stakk[stakk.length - 1].nivå >= nivå) stakk.pop()
    const overordna = stakk.length ? stakk[stakk.length - 1] : null
    const type = sammendrag && nivå === 1 ? 'fase' : milepael ? 'milepael' : 'aktivitet'

    // Utvida felt på oppgåva
    const ext = {}
    for (const e of barn(t)) if (e.localName === 'ExtendedAttribute') ext[verdi(e, 'FieldID')] = verdi(e, 'Value')
    const ev = (felt) => (feltId(felt) ? ext[feltId(felt)] : undefined)

    const fysisk = tal(verdi(t, 'PhysicalPercentComplete'))
    const prosent = tal(verdi(t, 'PercentComplete'))
    const framdrift = Math.max(0, Math.min(100, Math.round(erIsy || fysisk > 0 ? fysisk : prosent)))
    const el = {
      id: nyId(), type, namn, start, slutt: milepael ? start : slutt, forelder: overordna ? overordna.id : null, avh: [],
      ansvarleg: '', ferdig: framdrift, fasekode: '',
    }
    if (sammendrag && type === 'aktivitet') el.summ = true
    const kode = kodeFelt ? (ext[kodeFelt] || '') : ''
    if (kode) el.kode = kode

    const ufakt = /ufakturerbar/i.test(namn) || (overordna && overordna.ufakt)
    if (type === 'aktivitet' && !sammendrag) {
      // blad-aktivitet: timar, budsjett, påløpt, timerate
      const work = timar(verdi(t, 'Work'))
      const fast = tal(verdi(t, 'FixedCost')) / 100
      const kost = tal(verdi(t, 'Cost')) / 100
      const budsjett = Math.round(fast > 0 ? fast : kost)
      if (work > 0) { el.timar = Math.round(work * 2) / 2; el.modus = 'timar'; el.fordeling = 'fast' }
      if (budsjett > 0) { el.budsjett = budsjett; tel.medBudsjett++ }
      if (work > 0 && budsjett > 0) el.timerate = Math.round(budsjett / work)
      const paaTimar = erIsy ? tal(ev('Number1')) : timar(verdi(t, 'ActualWork'))
      if (paaTimar > 0) el.palopTimar = Math.round(paaTimar * 2) / 2
      const paaHon = erIsy ? tal(ev('Cost1')) / 100 : tal(verdi(t, 'ActualCost')) / 100
      if (paaHon) el.palopHonorar = Math.round(paaHon)
      if (paaTimar > 0 || paaHon) tel.medPaalopt++
      if (ufakt) el.budsjettType = 'Ufakturerbart'
      if (framdrift > 0) el.ferdigModus = 'skjonn'
    }
    if (type === 'fase') tel.fasar++
    else if (type === 'milepael') tel.mil++
    else if (sammendrag) tel.summ++
    else tel.akt++

    stakk.push({ nivå, id: el.id, ufakt })
    uidTilId.set(uid, el.id)
    ut.push(el)
    for (const p of barn(t)) {
      if (p.localName !== 'PredecessorLink') continue
      lenker.push({ id: el.id, predUid: verdi(p, 'PredecessorUID'), type: verdi(p, 'Type') })
    }
  }
  const harBorn = (id) => ut.some(c => c.forelder === id)
  let andreTypar = 0, utan = 0
  for (const l of lenker) {
    const predId = uidTilId.get(l.predUid)
    if (l.type && l.type !== '1') { andreTypar++; continue }
    if (!predId || predId === l.id) { utan++; continue }
    const el = ut.find(e => e.id === l.id)
    // ikkje avhengnad mellom overordna og eigne underaktivitetar, og ikkje på overordna med born (datoane deira følgjer borna)
    const pred = ut.find(e => e.id === predId)
    if ((el.type !== 'milepael' && harBorn(el.id)) || (pred && pred.forelder === el.id) || (el.forelder === predId)) { utan++; continue }
    el.avh.push(predId)
  }
  merknader.push(`Importerte ${tel.fasar} fase${tel.fasar === 1 ? '' : 'r'}, ${tel.summ} summasjonsaktivitet${tel.summ === 1 ? '' : 'ar'}, ${tel.akt} aktivitet${tel.akt === 1 ? '' : 'ar'} og ${tel.mil} milepæl${tel.mil === 1 ? '' : 'ar'} — hierarkiet er henta frå disposisjonsnivået (OutlineLevel/PNS).`)
  if (erIsy) merknader.push(`ISY Prosjekt Plan-fil kjend att: aktivitetskode (Text10), timar (Work), budsjett (Fixed cost → kr), påløpte timar (Number1), påløpt honorar (Cost1) og virkeleg framdrift (Physical % Complete) er med. ${tel.medBudsjett} aktivitetar har budsjett og ${tel.medPaalopt} har påløpt. Timerate er rekna som budsjett ÷ timar.`)
  else merknader.push('Timar (Work), faste kostnader og påløpt er lest frå standardfelta i MS Project. Ressursar og ressurstilknytningar er ikkje med.')
  if (andreTypar) merknader.push(`${andreTypar} avhengnad${andreTypar === 1 ? '' : 'er'} av andre typar enn «slutt → start» vart hoppa over.`)
  if (utan) merknader.push(`${utan} avhengnad${utan === 1 ? '' : 'er'} peika på oppgåver som ikkje vart med (eller på overordna med underaktivitetar), og vart hoppa over.`)
  if (hoppaTom) merknader.push(`${hoppaTom} oppgåve${hoppaTom === 1 ? '' : 'r'} vart hoppa over (tomme eller utan datoar, inkl. prosjektsammendraget).`)
  merknader.push('Summasjonar (fasar og overordna aktivitetar) får datoar, timar og framdrift rekna frå underaktivitetane. Kritisk line og nivellering vert ikkje rekna ut på nytt.')
  return { elementer: rullOpp(ut), merknader }
}
