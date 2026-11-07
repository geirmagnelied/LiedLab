import { addDays, format } from 'date-fns'
import { tilDato } from './framdriftDato'
import { visingsrader, harBorn, etterkommarar } from './framdriftLogikk'
import { fordelTimar, personDelar, prisKartFra, snittpris, prisFor } from './framdriftTimar'
import { kopleForbruk, nokkelNamn } from './framdriftForbruk'

// ═══════════════════════════════════════════════════════════════════
//  Rapportar frå Prosjektplan (Framdrift) → PDF. Reine funksjonar: utrekning av rapportdata og teikning av PDF (pdf-lib, lasta ved bruk).
//  Ein rapport er delt i fire seksjonar (kolonnegrupper):
//    info     — aktivitet: nummer, namn, ansvarleg, budsjett …
//    total    — påløpt TIL OG MED periodeslutten (timar/kroner) og gjenståande
//    periode  — påløpt i den valde perioden (standard: førre månad)
//    prognose — planlagde timar frå dagen ETTER periodeslutten og ut aktiviteten (kroner = timar × timerate)
//  Standardrapportane (kunde/intern) er faste; brukaren lagar eigne (framdrift_rapportar) ved å velje seksjonar og kolonnar.
// ═══════════════════════════════════════════════════════════════════

// ── Kolonnekatalog ──────────────────────────────────────────────────
export const SEKSJONAR = [
  { key: 'info', namn: 'Aktivitet og budsjett' },
  { key: 'total', namn: 'Påløpt totalt' },
  { key: 'periode', namn: 'Påløpt i perioden' },
  { key: 'prognose', namn: 'Prognose resterande arbeid' },
]
// type: 'tekst' | 'kr' | 't' | 'pct'
export const KOLONNER = {
  info: [
    { key: 'kode', namn: 'Aktivitetsnr.', type: 'tekst', b: 54 },
    { key: 'namn', namn: 'Aktivitet', type: 'tekst', b: 0 },
    { key: 'ansvarleg', namn: 'Ansvarleg', type: 'tekst', b: 82 },
    { key: 'budsjettType', namn: 'Budsjettype', type: 'tekst', b: 58 },
    { key: 'start', namn: 'Start', type: 'tekst', b: 52 },
    { key: 'slutt', namn: 'Slutt', type: 'tekst', b: 52 },
    { key: 'timarPlan', namn: 'Planlagde timar', type: 't', b: 52 },
    { key: 'timerate', namn: 'Timerate (kr/t)', type: 'kr', b: 52 },
    { key: 'budsjett', namn: 'Budsjett (kr)', type: 'kr', b: 62 },
  ],
  total: [
    { key: 'palopKr', namn: 'Påløpt (kr)', type: 'kr', b: 62 },
    { key: 'palopTimar', namn: 'Påløpt (timar)', type: 't', b: 52 },
    { key: 'gjenKr', namn: 'Gjenståande budsjett (kr)', type: 'kr', b: 66 },
    { key: 'gjenTimar', namn: 'Gjenståande timar', type: 't', b: 52 },
    { key: 'prosentBrukt', namn: '% av budsjett brukt', type: 'pct', b: 48 },
  ],
  periode: [
    { key: 'perKr', namn: 'Påløpt (kr)', type: 'kr', b: 62 },
    { key: 'perTimar', namn: 'Påløpt (timar)', type: 't', b: 52 },
  ],
  prognose: [
    { key: 'progKr', namn: 'Prognose (kr)', type: 'kr', b: 62 },
    { key: 'progTimar', namn: 'Prognose (timar)', type: 't', b: 52 },
    { key: 'sluttKr', namn: 'Venta sluttkostnad (kr)', type: 'kr', b: 66 },
    { key: 'avvikKr', namn: 'Avvik mot budsjett (kr)', type: 'kr', b: 66 },
  ],
}
const kolDef = (sek, key) => KOLONNER[sek].find(k => k.key === key)

// ── Standardrapportar (låste) ────────────────────────────────────────
const BASIS = { periode: { modus: 'forrigeManad', fra: '', til: '' }, fasar: true, sumrad: true, berreMedTal: false, undertittel: '' }
export const STANDARD_RAPPORTAR = [
  { id: 'std-kunde', namn: 'Rapport til kunde', standard: true, oppsett: { ...BASIS, tittel: 'Prosjektrapport',
    seksjonar: { info: true, total: true, periode: true, prognose: true },
    kolonnar: { info: ['kode', 'namn', 'ansvarleg', 'budsjett'], total: ['palopKr', 'palopTimar', 'gjenKr'], periode: ['perKr', 'perTimar'], prognose: ['progKr', 'progTimar'] } } },
  { id: 'std-intern', namn: 'Intern rapport', standard: true, oppsett: { ...BASIS, tittel: 'Intern prosjektrapport', berreMedTal: false,
    seksjonar: { info: true, total: true, periode: true, prognose: true },
    kolonnar: { info: ['kode', 'namn', 'ansvarleg', 'timarPlan', 'budsjett'], total: ['palopTimar', 'palopKr', 'gjenTimar', 'gjenKr', 'prosentBrukt'], periode: ['perTimar', 'perKr'], prognose: ['progTimar', 'progKr', 'sluttKr', 'avvikKr'] } } },
]
export const tomtOppsett = () => JSON.parse(JSON.stringify({ ...STANDARD_RAPPORTAR[0].oppsett, tittel: 'Ny rapport' }))

// ── Periode ─────────────────────────────────────────────────────────
const iso = (d) => format(d, 'yyyy-MM-dd')
export function forrigeManad(idag = new Date()) {
  return { fra: iso(new Date(idag.getFullYear(), idag.getMonth() - 1, 1)), til: iso(new Date(idag.getFullYear(), idag.getMonth(), 0)) }
}
export function periodeFra(oppsett, idag = new Date()) {
  const p = oppsett?.periode || {}
  if (p.modus === 'eigen' && /^\d{4}-\d{2}-\d{2}$/.test(p.fra || '') && /^\d{4}-\d{2}-\d{2}$/.test(p.til || '') && p.fra <= p.til) return { fra: p.fra, til: p.til }
  return forrigeManad(idag)
}
export const datoNo = (s) => (s ? s.split('-').reverse().join('.') : '')

// ── Utrekning ───────────────────────────────────────────────────────
function prognoseTimar(e, kal, tilIso) {
  const til = tilDato(tilIso)
  let sum = 0
  for (const { veke, timar } of fordelTimar(e, kal)) {
    const mandag = tilDato(veke)
    if (addDays(mandag, 6) <= til) continue
    if (mandag > til) { sum += timar; continue }
    let etter = 0
    for (let i = 0; i < 5; i++) if (addDays(mandag, i) > til) etter++   // delvis veke: arbeidsdagane etter periodeslutten
    sum += timar * etter / 5
  }
  return sum
}

// → { rader: [{ id, nivaa, gruppe, ...felt }], sum: {...} }. `elementer` = planen med effektive timar (medEffektiveTimar), `forbrukRader` = ALLE importerte timeføringar.
export function byggRapportData({ elementer, forbrukRader, personell, kal, periode, oppsett }) {
  const prisar = prisKartFra(personell)
  const { perAkt } = kopleForbruk(elementer, forbrukRader)
  const erBlad = (e) => e.type === 'aktivitet' && !harBorn(elementer, e.id)

  const kostOgTimar = (e, rader) => {
    const delar = personDelar(e); const snitt = snittpris(e, prisar).pris
    let t = 0, k = 0
    for (const r of rader) {
      const namn = r.ansattNamn || r.ansatt || ''
      const d = delar.find(x => nokkelNamn(x.namn) === nokkelNamn(namn))
      const rate = d ? prisFor(d, prisar) : (prisar.get(namn.toLowerCase()) || 0)
      t += r.timar; k += r.timar * (rate || snitt || 0)
    }
    return { t, k }
  }

  const tal = (e) => {
    const snitt = snittpris(e, prisar).pris
    const rader = perAkt.get(e.id) || []
    const tilTotal = rader.filter(r => r.dato <= periode.til)
    const iPeriode = rader.filter(r => r.dato >= periode.fra && r.dato <= periode.til)
    let palop = kostOgTimar(e, tilTotal)
    if (!rader.length && (+e.palopTimar > 0 || +e.palopHonorar > 0)) {      // manuelt innskrive påløpt (ingen importert forbruk)
      const t = +e.palopTimar || 0
      palop = { t, k: e.palopHonorar != null && e.palopHonorar !== '' ? +e.palopHonorar : t * snitt }
    }
    const per = kostOgTimar(e, iPeriode)
    const budsjett = +e.budsjett > 0 ? +e.budsjett : Math.round((+e.timar || 0) * snitt)
    const progT = prognoseTimar(e, kal, periode.til)
    const progK = progT * snitt
    return {
      budsjett, timarPlan: +e.timar || 0, timerate: snitt,
      palopKr: palop.k, palopTimar: palop.t, gjenKr: budsjett - palop.k, gjenTimar: (+e.timar || 0) - palop.t,
      perKr: per.k, perTimar: per.t, progKr: progK, progTimar: progT,
      sluttKr: palop.k + progK, avvikKr: budsjett - (palop.k + progK),
    }
  }
  const SUMFELT = ['budsjett', 'timarPlan', 'palopKr', 'palopTimar', 'gjenKr', 'gjenTimar', 'perKr', 'perTimar', 'progKr', 'progTimar', 'sluttKr', 'avvikKr']
  const summer = (liste) => {
    const s = Object.fromEntries(SUMFELT.map(f => [f, liste.reduce((a, x) => a + (x[f] || 0), 0)]))
    s.prosentBrukt = s.budsjett > 0 ? (s.palopKr / s.budsjett) * 100 : null
    s.timerate = s.timarPlan > 0 ? liste.reduce((a, x) => a + (x.timarPlan || 0) * (x.timerate || 0), 0) / s.timarPlan : 0
    return s
  }
  const harTal = (t) => ['budsjett', 'timarPlan', 'palopKr', 'palopTimar', 'perTimar', 'progTimar'].some(f => Math.abs(t[f] || 0) > 0.001)

  const bladTal = new Map()
  for (const e of elementer) if (erBlad(e)) { const t = tal(e); t.prosentBrukt = t.budsjett > 0 ? (t.palopKr / t.budsjett) * 100 : null; bladTal.set(e.id, t) }
  const bladUnder = (e) => etterkommarar(elementer, e.id).filter(erBlad)

  const rader = []
  for (const e of visingsrader(elementer, new Set())) {
    if (e.type === 'milepael') continue
    if (erBlad(e)) {
      const t = bladTal.get(e.id)
      if (oppsett.berreMedTal && !harTal(t)) continue
      rader.push({ id: e.id, nivaa: oppsett.fasar ? e.nivå : 0, gruppe: false, kode: e.kode || '', namn: e.namn, ansvarleg: e.ansvarleg || '', budsjettType: e.budsjettType || '',
        start: e.start ? datoNo(e.start) : '', slutt: e.slutt ? datoNo(e.slutt) : '', ...t })
    } else if (oppsett.fasar) {
      const barn = bladUnder(e).map(b => bladTal.get(b.id)).filter(t => t && (!oppsett.berreMedTal || harTal(t)))
      if (!barn.length) continue
      rader.push({ id: e.id, nivaa: e.nivå, gruppe: true, kode: e.kode || '', namn: e.namn, ansvarleg: e.ansvarleg || '', budsjettType: '', start: '', slutt: '', ...summer(barn) })
    }
  }
  const alleBlad = rader.filter(r => !r.gruppe)
  return { rader, sum: summer(alleBlad) }
}

// Kolonnene som faktisk vert vist (seksjon på + minst éi kolonne), i kjent rekkjefølgje
export function valdeKolonnar(oppsett) {
  return SEKSJONAR.filter(s => oppsett.seksjonar?.[s.key]).map(s => ({
    ...s, kol: KOLONNER[s.key].filter(k => (oppsett.kolonnar?.[s.key] || []).includes(k.key)),
  })).filter(s => s.kol.length)
}

// ── Formatering (berre teikn som Helvetica/WinAnsi kan teikne) ──────────
const grupper = (n) => String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
export function fmtVerdi(v, type) {
  if (type === 'tekst') return v == null ? '' : String(v)
  if (v == null || v === '' || Number.isNaN(v)) return ''
  if (type === 'kr') { const n = Math.round(v); return n === 0 ? '-' : (n < 0 ? '-' : '') + grupper(n) }
  if (type === 't') { const n = Math.round(v * 10) / 10; return n === 0 ? '-' : (n < 0 ? '-' : '') + grupper(Math.trunc(Math.abs(n))) + ',' + String(Math.round((Math.abs(n) % 1) * 10)) }
  if (type === 'pct') return Math.round(v) + ' %'
  return String(v)
}

// ── PDF ─────────────────────────────────────────────────────────────
export async function lagRapportPdf({ data, oppsett, periode, prosjektNamn, prosjektNr, brukar }) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  const fn = await doc.embedFont(StandardFonts.Helvetica), fb = await doc.embedFont(StandardFonts.HelveticaBold)
  const rens = (f, s) => String(s ?? '').split('').map(c => { try { f.encodeText(c); return c } catch { return c === '–' || c === '−' ? '-' : '?' } }).join('')
  const B = 842, H = 595, M = 34
  const grupperKol = valdeKolonnar(oppsett)
  const kol = grupperKol.flatMap(g => g.kol.map((k, i) => ({ ...k, sek: g.key, forst: i === 0 })))
  if (!kol.length) throw new Error('Rapporten har ingen kolonnar. Vel minst ein seksjon og ei kolonne.')

  // breidder: namn tek resten
  const bredd = B - 2 * M
  const fast = kol.filter(k => k.b > 0).reduce((a, k) => a + k.b, 0)
  const harNamn = kol.some(k => k.b === 0)
  // tal-kolonnane vert skalerte ned slik at aktivitetsnamnet får minst 150 pt; utan namnekolonne fyller kolonnane heile breidda
  const skala = harNamn ? Math.min(1, (bredd - 150) / fast) : bredd / fast
  const W = kol.map(k => (k.b > 0 ? k.b * skala : 0))
  const restB = bredd - W.reduce((a, x) => a + x, 0)
  if (harNamn) W[kol.findIndex(k => k.b === 0)] = restB
  const X = W.reduce((a, w, i) => (a.push(i ? a[i - 1] + W[i - 1] : M), a), [])

  const blaa = rgb(0.663, 0.784, 0.925), lys = rgb(0.93, 0.95, 0.98), strek = rgb(0.7, 0.72, 0.76), svart = rgb(0, 0, 0)
  const bryt = (tekst, font, size, maks) => {          // ordbryting til maks breidd
    const ord = rens(font, tekst).split(/\s+/).filter(Boolean); const linjer = []; let l = ''
    for (const o of ord) { const t = l ? l + ' ' + o : o; if (font.widthOfTextAtSize(t, size) <= maks || !l) l = t; else { linjer.push(l); l = o } }
    if (l) linjer.push(l)
    return linjer.length ? linjer : ['']
  }
  const kort = (tekst, font, size, maks) => {          // avkort med «…» (…→ «..» sidan WinAnsi manglar den i enkelte fonter)
    let t = rens(font, tekst)
    if (font.widthOfTextAtSize(t, size) <= maks) return t
    while (t.length > 1 && font.widthOfTextAtSize(t + '..', size) > maks) t = t.slice(0, -1)
    return t + '..'
  }

  const sider = []
  let side, y
  const tekstTopp = () => {
    side.drawText(rens(fb, oppsett.tittel || 'Rapport'), { x: M, y: H - M - 6, size: 16, font: fb, color: svart })
    let ty = H - M - 22
    const linje = (s) => { side.drawText(rens(fn, s), { x: M, y: ty, size: 8.5, font: fn, color: rgb(0.25, 0.25, 0.25) }); ty -= 11.5 }
    linje(`Prosjekt: ${[prosjektNr, prosjektNamn].filter(Boolean).join(' ')}`)
    if (oppsett.undertittel) linje(oppsett.undertittel)
    const t = []
    if (oppsett.seksjonar?.total) t.push(`Påløpt totalt: til og med ${datoNo(periode.til)}`)
    if (oppsett.seksjonar?.periode) t.push(`Periode: ${datoNo(periode.fra)} - ${datoNo(periode.til)}`)
    if (oppsett.seksjonar?.prognose) t.push(`Prognose: planlagde timar frå ${datoNo(iso(addDays(tilDato(periode.til), 1)))} og ut aktiviteten`)
    if (t.length) linje(t.join('   ·   '))
    return ty - 6
  }
  const tabellHovud = () => {
    const hG = 15
    // gruppe-rad
    let gx = M
    for (const g of grupperKol) {
      const gw = kol.reduce((a, c, i) => (c.sek === g.key ? a + W[i] : a), 0)
      side.drawRectangle({ x: gx, y: y - hG, width: gw, height: hG, color: blaa, borderColor: strek, borderWidth: 0.4 })
      side.drawText(kort(g.namn, fb, 8, gw - 6), { x: gx + 3, y: y - 10.5, size: 8, font: fb, color: svart })
      gx += gw
    }
    y -= hG
    const linjer = kol.map((k, i) => bryt(k.namn, fb, 7, W[i] - 6))
    const hK = Math.max(...linjer.map(l => l.length)) * 8.4 + 5
    kol.forEach((k, i) => {
      side.drawRectangle({ x: X[i], y: y - hK, width: W[i], height: hK, color: blaa, borderColor: strek, borderWidth: 0.4 })
      linjer[i].forEach((l, j) => {
        const tw = fb.widthOfTextAtSize(l, 7)
        side.drawText(l, { x: k.type === 'tekst' ? X[i] + 3 : X[i] + W[i] - 3 - tw, y: y - 9 - j * 8.4, size: 7, font: fb, color: svart })
      })
    })
    y -= hK
  }
  const nySide = () => { side = doc.addPage([B, H]); sider.push(side); y = tekstTopp(); tabellHovud() }
  nySide()

  const RH = 13
  const rad = (r, { sum = false } = {}) => {
    if (y - RH < M + 24) nySide()
    const fet = r.gruppe || sum
    const font = fet ? fb : fn
    if (r.gruppe) side.drawRectangle({ x: M, y: y - RH, width: bredd, height: RH, color: lys })
    if (sum) side.drawLine({ start: { x: M, y: y }, end: { x: M + bredd, y: y }, thickness: 0.9, color: svart })
    kol.forEach((k, i) => {
      if (k.forst && i > 0) side.drawLine({ start: { x: X[i], y: y }, end: { x: X[i], y: y - RH }, thickness: 0.4, color: strek })
      const innrykk = k.key === 'namn' && !sum ? r.nivaa * 7 : 0
      const verdi = sum && k.key === 'namn' ? 'Sum' : sum && k.type === 'tekst' ? '' : fmtVerdi(r[k.key], k.type)
      const t = kort(verdi, font, 7.5, W[i] - 6 - innrykk)
      const tw = font.widthOfTextAtSize(t, 7.5)
      side.drawText(t, { x: k.type === 'tekst' ? X[i] + 3 + innrykk : X[i] + W[i] - 3 - tw, y: y - 9.3, size: 7.5, font, color: svart })
    })
    side.drawLine({ start: { x: M, y: y - RH }, end: { x: M + bredd, y: y - RH }, thickness: 0.25, color: rgb(0.85, 0.86, 0.88) })
    y -= RH
  }
  data.rader.forEach(r => rad(r))
  if (oppsett.sumrad) rad({ ...data.sum, gruppe: false, nivaa: 0 }, { sum: true })
  if (!data.rader.length) side.drawText('Ingen aktivitetar å vise.', { x: M, y: y - 14, size: 9, font: fn, color: svart })

  const no = new Date()
  const stempel = `Generert av ${brukar || 'ukjend brukar'} · ${no.toLocaleDateString('nb-NO')} kl. ${no.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })} · LiedLab`
  sider.forEach((s, k) => {
    s.drawText(rens(fn, stempel), { x: M, y: 18, size: 7.5, font: fn, color: rgb(0.4, 0.4, 0.4) })
    const st = `Side ${k + 1} av ${sider.length}`
    s.drawText(st, { x: B - M - fn.widthOfTextAtSize(st, 7.5), y: 18, size: 7.5, font: fn, color: rgb(0.4, 0.4, 0.4) })
  })
  doc.setTitle(oppsett.tittel || 'Rapport'); doc.setCreator('LiedLab'); doc.setAuthor(brukar || '')
  return doc.save()
}

export function lastNedPdf(bytes, filnamn) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url; a.download = filnamn
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
export const rapportFilnamn = (oppsett, prosjektNr) => (`${prosjektNr ? prosjektNr + ' ' : ''}${oppsett.tittel || 'Rapport'}`.replace(/[\\/:*?"<>|]+/g, '').trim() || 'Rapport') + '.pdf'
