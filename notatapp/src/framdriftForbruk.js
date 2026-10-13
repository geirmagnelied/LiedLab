// ═══════════════════════════════════════════════════════════════════
//  Forbruk (påløpte timar) frå timeføringsrapporten «<oppdragsnr>_<månad>_spesifisert.xlsx»:
//    Oppdrag: 52607575 Detaljprosjektering …      Periode: 2026-09-01 - 2026-09-30
//    Dato | Periode (ÅÅÅÅUU) | Ansatt («Etternamn, Fornamn») | Aktivitet («611 ARK - prosjektering») | Timer | Beskrivelse
//  Reine funksjonar utan avhengnader — brukt både i appen (import-vindauget) og i skriptet scripts/importer-forbruk.mjs
//  (ukentleg automatisk import). Sjå claude/framdrift-modul.md.
// ═══════════════════════════════════════════════════════════════════

const z = (n) => String(n).padStart(2, '0')
const tal = (v) => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }

export function tilIsoDato(v) {
  if (v == null || v === '') return null
  if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${z(v.getMonth() + 1)}-${z(v.getDate())}`
  if (typeof v === 'number') { const d = new Date(Math.round((v - 25569) * 86400 * 1000)); return `${d.getUTCFullYear()}-${z(d.getUTCMonth() + 1)}-${z(d.getUTCDate())}` }
  const s = String(v).trim()
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(s)
  if (m) return `${m[3]}-${z(m[2])}-${z(m[1])}`
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

// «Lied, Geir Magne» → «Geir Magne Lied»
export function normaliserAnsatt(a) {
  const s = String(a || '').trim()
  if (s.includes(',')) { const [etter, ...for_] = s.split(','); return [for_.join(',').trim(), etter.trim()].filter(Boolean).join(' ') }
  return s
}

// ISO-vekas måndag (ÅÅÅÅ-MM-DD) for ein dato
export function mandagFor(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dag = (dt.getUTCDay() + 6) % 7 // man=0
  dt.setUTCDate(dt.getUTCDate() - dag)
  return `${dt.getUTCFullYear()}-${z(dt.getUTCMonth() + 1)}-${z(dt.getUTCDate())}`
}
export function isoVekeFor(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dag = dt.getUTCDay() || 7
  dt.setUTCDate(dt.getUTCDate() + 4 - dag)
  const start = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1))
  return { aar: dt.getUTCFullYear(), veke: Math.ceil(((dt - start) / 86400000 + 1) / 7) }
}

// aoa = rader frå arket (array av array). Gjev { prosjektNr, oppdrag, fra, til, rader[], feil[] }
export function parseForbruk(aoa) {
  const feil = []
  const celle = (r, i) => (r && r[i] != null ? r[i] : '')
  let prosjektNr = '', oppdrag = '', fra = null, til = null
  let hoved = -1
  for (let i = 0; i < aoa.length; i++) {
    const r = aoa[i] || []
    const k0 = String(celle(r, 0)).trim().toLowerCase()
    if (k0 === 'oppdrag:') { oppdrag = String(celle(r, 1)).trim(); prosjektNr = (/^\s*(\S+)/.exec(oppdrag) || [])[1] || '' }
    if (k0 === 'periode:') { const m = /(\d{4}-\d{2}-\d{2})\s*[-–]\s*(\d{4}-\d{2}-\d{2})/.exec(String(celle(r, 1))); if (m) { fra = m[1]; til = m[2] } }
    const celler = r.map(c => String(c ?? '').trim().toLowerCase())
    if (hoved < 0 && celler.includes('dato') && (celler.includes('timer') || celler.includes('timar'))) { hoved = i; break }
  }
  if (hoved < 0) return { prosjektNr, oppdrag, fra, til, rader: [], feil: ['Fann ikkje kolonneoverskriftene (Dato, Ansatt, Aktivitet, Timer) i fila.'] }
  const overskrift = (aoa[hoved] || []).map(c => String(c ?? '').trim().toLowerCase())
  const idx = (...namn) => { for (const n of namn) { const i = overskrift.indexOf(n); if (i >= 0) return i } return -1 }
  const iDato = idx('dato'), iPer = idx('periode'), iAns = idx('ansatt'), iAkt = idx('aktivitet'), iTim = idx('timer', 'timar'), iBes = idx('beskrivelse', 'beskriving')
  const rader = []
  for (let i = hoved + 1; i < aoa.length; i++) {
    const r = aoa[i] || []
    const dato = tilIsoDato(celle(r, iDato))
    const timar = tal(celle(r, iTim))
    if (!dato) continue // tomme rader og «Sum timer»
    const aktivitet = String(celle(r, iAkt)).trim()
    const ansatt = String(celle(r, iAns)).trim()
    if (!aktivitet && !ansatt && !timar) continue
    const per = String(celle(r, iPer)).trim()
    const vk = isoVekeFor(dato)
    const m = /^(\d{4})(\d{2})$/.exec(per)
    rader.push({
      dato, vekeaar: m ? +m[1] : vk.aar, vekenr: m ? +m[2] : vk.veke,
      ansatt, ansattNamn: normaliserAnsatt(ansatt), aktivitet, kode: (/^\s*(\S+)/.exec(aktivitet) || [])[1] || '',
      timar, beskrivelse: String(celle(r, iBes)).trim(),
    })
  }
  if (rader.length) {
    const d = rader.map(r => r.dato).sort()
    fra = fra || d[0]; til = til || d[d.length - 1]
  }
  return { prosjektNr, oppdrag, fra, til, rader, feil }
}

// ── Kopling til aktivitetane i planen ──────────────────────────────────
// Aktivitetsnamn kan endre seg, aktivitetsnummer gjer det ikkje: ein aktivitet vert kopla på NUMMERET som står FØRST i namnet
// («611 ARK prosjektering» → 611), eller på feltet «Aktivitetskode» (kode) viss det er sett. Namnet elles vert ikkje brukt.
export const aktivitetsnummer = (e) => {
  const k = String(e.kode || '').trim()
  if (k) return k.toLowerCase()
  const m = /^\s*(\S*\d\S*)(?=\s|$|-)/.exec(String(e.namn || ''))
  return m ? m[1].toLowerCase() : ''
}

// → { perAkt: Map(aktivitetId → rader[]), utan: Map(aktivitetsstreng → { timar, kode }) }
export function kopleForbruk(elementer, rader) {
  const foreldre = new Set(elementer.filter(e => e.forelder != null).map(e => e.forelder))
  const perNr = new Map()
  for (const e of elementer.filter(x => x.type === 'aktivitet')) {
    const nr = aktivitetsnummer(e)
    if (!nr) continue
    if (!perNr.has(nr)) perNr.set(nr, [])
    perNr.get(nr).push(e)
  }
  const finn = (r) => {
    const liste = perNr.get((r.kode || '').toLowerCase())
    if (!liste || !liste.length) return null
    return liste.find(e => !foreldre.has(e.id) && !e.summ) || liste[0] // blad-aktivitet går føre ein summasjon med same nummer
  }
  const perAkt = new Map(), utan = new Map()
  for (const r of rader) {
    const e = finn(r)
    if (e) { if (!perAkt.has(e.id)) perAkt.set(e.id, []); perAkt.get(e.id).push(r) }
    else { const u = utan.get(r.aktivitet) || { timar: 0, kode: r.kode }; u.timar += r.timar; utan.set(r.aktivitet, u) }
  }
  return { perAkt, utan }
}

// Map(aktivitetId → { total, personer: Map(namn → { total, veke: Map(måndag → t) }), veke: Map(måndag → t) })
export function bygForbrukKart(perAkt) {
  const kart = new Map()
  for (const [id, rader] of perAkt) {
    const a = { total: 0, personer: new Map(), veke: new Map() }
    for (const r of rader) {
      a.total += r.timar
      const mnd = mandagFor(r.dato)
      a.veke.set(mnd, (a.veke.get(mnd) || 0) + r.timar)
      const navn = r.ansattNamn || r.ansatt || '(ukjend)'
      if (!a.personer.has(navn)) a.personer.set(navn, { total: 0, veke: new Map() })
      const p = a.personer.get(navn)
      p.total += r.timar
      p.veke.set(mnd, (p.veke.get(mnd) || 0) + r.timar)
    }
    kart.set(id, a)
  }
  return kart
}

// ── Personrader med faktisk forbruk ────────────────────────────────────
// Namn vert samanlikna uavhengig av rekkjefølgje på delnamna («Tore Stien» = «Stien Tore»)
export const nokkelNamn = (n) => String(n || '').toLowerCase().split(/[\s,]+/).filter(Boolean).sort().join(' ')
// Planlagde personar ({namn, del}) + personar som har ført timar men ikkje står i planen (del 0)
export function personerMedForbruk(planPersonar, fk) {
  const ut = planPersonar.map(p => ({ ...p }))
  if (fk) for (const n of fk.personer.keys()) if (!ut.some(p => nokkelNamn(p.namn) === nokkelNamn(n))) ut.push({ namn: n, del: 0, utanPlan: true })
  return ut
}
export function faktiskFor(fk, namn) {
  if (!fk) return null
  for (const [n, v] of fk.personer) if (nokkelNamn(n) === nokkelNamn(namn)) return v
  return null
}
