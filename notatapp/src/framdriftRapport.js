import { addDays, format, getISOWeek, getISOWeekYear } from 'date-fns'
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
// prognoseModus: 'resterande' (berre sum), 'manad' (kolonne per månad) eller 'veke' (kolonne per veke) · ark: utskriftsformat for PDF
const BASIS = { periode: { modus: 'forrigeManad', fra: '', til: '' }, fasar: true, sumrad: true, berreMedTal: false, undertittel: '',
  prognoseModus: 'manad', ark: { storleik: 'A4', retning: 'landskap' }, delsum: false, perPerson: false }
export const ARK = { A0: [2383.94, 3370.39], A1: [1683.78, 2383.94], A2: [1190.55, 1683.78], A3: [841.89, 1190.55], A4: [595.28, 841.89], A5: [419.53, 595.28] }
export const arkMaal = (ark) => {
  const [kort, lang] = ARK[ark?.storleik] || ARK.A4
  return ark?.retning === 'portrett' ? [kort, lang] : [lang, kort]      // [breidd, høgd] i pt
}
export const STANDARD_RAPPORTAR = [
  { id: 'std-kunde', namn: 'Rapport til kunde', standard: true, oppsett: { ...BASIS, tittel: 'Prosjektrapport',
    seksjonar: { info: true, total: true, periode: true, prognose: true },
    kolonnar: { info: ['kode', 'namn', 'ansvarleg', 'budsjett'], total: ['palopKr', 'palopTimar', 'gjenKr'], periode: ['perKr', 'perTimar'], prognose: ['progKr', 'progTimar'] } } },
  { id: 'std-intern', namn: 'Intern rapport', standard: true, oppsett: { ...BASIS, tittel: 'Intern prosjektrapport', berreMedTal: false, delsum: true, perPerson: true,
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
const MND = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']
export function periodeNamn(key, modus) {
  if (modus === 'veke') { const d = tilDato(key); return `U${getISOWeek(d)} ${String(getISOWeekYear(d)).slice(2)}` }
  const [y, m] = key.split('-'); return `${MND[+m - 1]} ${y.slice(2)}`
}

// Planlagde timar ETTER periodeslutten: per veke (nøkkel = måndag) og per månad (nøkkel = yyyy-MM). Delvis veke vert fordelt på arbeidsdagane etter periodeslutten.
function prognoseFordelt(e, kal, tilIso) {
  const til = tilDato(tilIso)
  const veke = new Map(), manad = new Map()
  for (const { veke: v, timar } of fordelTimar(e, kal)) {
    const mandag = tilDato(v)
    if (addDays(mandag, 6) <= til) continue
    const perDag = timar / 5
    for (let i = 0; i < 5; i++) {
      const d = addDays(mandag, i)
      if (d <= til) continue
      const kv = format(mandag, 'yyyy-MM-dd'), km = format(d, 'yyyy-MM')
      veke.set(kv, (veke.get(kv) || 0) + perDag); manad.set(km, (manad.get(km) || 0) + perDag)
    }
  }
  return { veke, manad, sum: [...veke.values()].reduce((a, b) => a + b, 0) }
}

// → { rader, sum, perioder }. rader: { id, nivaa, gruppe, delsum, utanTal, person, …felt }.
// `elementer` = planen med effektive timar (medEffektiveTimar), `forbrukRader` = ALLE importerte timeføringar.
export function byggRapportData({ elementer, forbrukRader, personell, kal, periode, oppsett }) {
  const prisar = prisKartFra(personell)
  const { perAkt } = kopleForbruk(elementer, forbrukRader)
  const erBlad = (e) => e.type === 'aktivitet' && !harBorn(elementer, e.id)
  const modus = oppsett.prognoseModus || 'manad'

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
  const radNamn = (r) => r.ansattNamn || r.ansatt || ''

  // Felles utrekning av eit tal-sett (aktivitet eller person). `del` = andel av aktivitetens timar (1 for heile aktiviteten).
  const lagTal = ({ budsjett, timarPlan, timerate, palop, per, fordelt, snitt }) => {
    const progT = fordelt.sum, progK = progT * snitt
    const t = {
      budsjett, timarPlan, timerate,
      palopKr: palop.k, palopTimar: palop.t, gjenKr: budsjett - palop.k, gjenTimar: timarPlan - palop.t,
      perKr: per.k, perTimar: per.t, progKr: progK, progTimar: progT,
      sluttKr: palop.k + progK, avvikKr: budsjett - (palop.k + progK),
    }
    if (modus !== 'resterande') {
      for (const [k, h] of (modus === 'veke' ? fordelt.veke : fordelt.manad)) { t['pt_' + k] = h; t['pk_' + k] = h * snitt }
    }
    return t
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
    const budsjett = +e.budsjett > 0 ? +e.budsjett : Math.round((+e.timar || 0) * snitt)
    return lagTal({ budsjett, timarPlan: +e.timar || 0, timerate: snitt, palop, per: kostOgTimar(e, iPeriode), fordelt: prognoseFordelt(e, kal, periode.til), snitt })
  }

  // Per person i ein aktivitet: planlagd del, faktisk forbruk og prognose (aktivitetens prognose × personens del)
  const personTal = (e, t0) => {
    const rader = perAkt.get(e.id) || []
    const delar = personDelar(e)
    const namnListe = delar.map(d => ({ namn: d.namn, del: d.del / 100, d }))
    for (const r of rader) { const n = radNamn(r); if (n && !namnListe.some(x => nokkelNamn(x.namn) === nokkelNamn(n))) namnListe.push({ namn: n, del: 0, d: null }) }
    const snitt = snittpris(e, prisar).pris
    const fordeltAkt = prognoseFordelt(e, kal, periode.til)
    return namnListe.map(p => {
      const mine = rader.filter(r => nokkelNamn(radNamn(r)) === nokkelNamn(p.namn))
      const rate = (+e.timerate > 0 ? +e.timerate : 0) || (p.d ? prisFor(p.d, prisar) : (prisar.get(p.namn.toLowerCase()) || 0)) || snitt
      const kt = (liste) => ({ t: liste.reduce((a, r) => a + r.timar, 0), k: liste.reduce((a, r) => a + r.timar, 0) * rate })
      const skaler = (m) => new Map([...m].map(([k, h]) => [k, h * p.del]))
      const timarPlan = (t0.timarPlan || 0) * p.del
      return { namn: p.namn, ...lagTal({
        budsjett: timarPlan * rate, timarPlan, timerate: rate,
        palop: kt(mine.filter(r => r.dato <= periode.til)), per: kt(mine.filter(r => r.dato >= periode.fra && r.dato <= periode.til)),
        fordelt: { veke: skaler(fordeltAkt.veke), manad: skaler(fordeltAkt.manad), sum: fordeltAkt.sum * p.del }, snitt: rate }) }
    })
  }

  const IKKJE_SUM = new Set(['nivaa', 'prosentBrukt', 'timerate'])
  const summer = (liste) => {
    const felt = new Set()
    for (const x of liste) for (const k of Object.keys(x)) if (typeof x[k] === 'number' && !IKKJE_SUM.has(k)) felt.add(k)
    const s = Object.fromEntries([...felt].map(f => [f, liste.reduce((a, x) => a + (x[f] || 0), 0)]))
    s.prosentBrukt = (s.budsjett || 0) > 0 ? (s.palopKr / s.budsjett) * 100 : null
    s.timerate = (s.timarPlan || 0) > 0 ? liste.reduce((a, x) => a + (x.timarPlan || 0) * (x.timerate || 0), 0) / s.timarPlan : 0
    return s
  }
  const harTal = (t) => ['budsjett', 'timarPlan', 'palopKr', 'palopTimar', 'perTimar', 'progTimar'].some(f => Math.abs(t[f] || 0) > 0.001)
  const medPct = (t) => { t.prosentBrukt = (t.budsjett || 0) > 0 ? (t.palopKr / t.budsjett) * 100 : null; return t }

  const bladTal = new Map()
  for (const e of elementer) if (erBlad(e)) bladTal.set(e.id, medPct(tal(e)))
  const bladUnder = (e) => etterkommarar(elementer, e.id).filter(erBlad)

  const rader = []
  const apne = []                   // opne gruppar (for «Sum …»-rad etter siste delaktivitet)
  const lukk = (nivaMin) => {
    while (apne.length && apne[apne.length - 1].nivaa >= nivaMin) {
      const g = apne.pop()
      rader.push({ id: g.id + ':sum', nivaa: g.nivaa, gruppe: true, delsum: true, kode: '', namn: 'Sum ' + g.namn, ansvarleg: '', budsjettType: '', start: '', slutt: '', ...g.sum })
    }
  }
  for (const e of visingsrader(elementer, new Set())) {
    if (e.type === 'milepael') continue
    if (oppsett.delsum && oppsett.fasar) lukk(e.nivå)
    if (erBlad(e)) {
      const t = bladTal.get(e.id)
      if (oppsett.berreMedTal && !harTal(t)) continue
      const nivaa = oppsett.fasar ? e.nivå : 0
      rader.push({ id: e.id, nivaa, gruppe: false, kode: e.kode || '', namn: e.namn, ansvarleg: e.ansvarleg || '', budsjettType: e.budsjettType || '',
        start: e.start ? datoNo(e.start) : '', slutt: e.slutt ? datoNo(e.slutt) : '', ...t })
      if (oppsett.perPerson) personTal(e, t).forEach((p, i) => rader.push({ id: e.id + ':p' + i, nivaa: nivaa + 1, gruppe: false, person: true, kode: '', ansvarleg: '', budsjettType: '', start: '', slutt: '', ...medPct(p) }))
    } else if (oppsett.fasar) {
      const barn = bladUnder(e).map(b => bladTal.get(b.id)).filter(t => t && (!oppsett.berreMedTal || harTal(t)))
      if (!barn.length) continue
      const s = summer(barn)
      if (oppsett.delsum) {
        rader.push({ id: e.id, nivaa: e.nivå, gruppe: true, utanTal: true, kode: e.kode || '', namn: e.namn, ansvarleg: e.ansvarleg || '', budsjettType: '', start: '', slutt: '' })
        apne.push({ id: e.id, nivaa: e.nivå, namn: e.namn, sum: s })
      } else rader.push({ id: e.id, nivaa: e.nivå, gruppe: true, kode: e.kode || '', namn: e.namn, ansvarleg: e.ansvarleg || '', budsjettType: '', start: '', slutt: '', ...s })
    }
  }
  lukk(-1)
  const leggTil = rader.filter(r => !r.gruppe && !r.person)
  // Prognoseperiodar (kolonnar): alle nøklar som har timar hos minst éin aktivitet
  const nøklar = new Set()
  for (const t of bladTal.values()) for (const k of Object.keys(t)) if (k.startsWith('pt_')) nøklar.add(k.slice(3))
  const perioder = [...nøklar].sort().map(k => ({ key: k, label: periodeNamn(k, modus) }))
  return { rader, sum: summer(leggTil), perioder }
}

// Kolonnene som faktisk vert vist (seksjon på + minst éi kolonne), i kjent rekkjefølgje.
// Med prognose per månad/veke vert kolonnar for kvar periode lagt framfor sum-kolonnane (timar og/eller kroner etter kva som er valt).
export function valdeKolonnar(oppsett, perioder = []) {
  const modus = oppsett.prognoseModus || 'manad'
  return SEKSJONAR.filter(s => oppsett.seksjonar?.[s.key]).map(s => {
    let kol = KOLONNER[s.key].filter(k => (oppsett.kolonnar?.[s.key] || []).includes(k.key))
    if (s.key === 'prognose' && modus !== 'resterande' && perioder.length) {
      const medT = kol.some(k => k.key === 'progTimar'), medK = kol.some(k => k.key === 'progKr')
      const dyn = []
      for (const p of perioder) {
        if (medT) dyn.push({ key: 'pt_' + p.key, namn: p.label + ' (timar)', type: 't', b: 38, periode: true })
        if (medK) dyn.push({ key: 'pk_' + p.key, namn: p.label + ' (kr)', type: 'kr', b: 48, periode: true })
      }
      kol = [...dyn, ...kol.map(k => (k.key === 'progTimar' ? { ...k, namn: 'Sum prognose (timar)' } : k.key === 'progKr' ? { ...k, namn: 'Sum prognose (kr)' } : k))]
    }
    return { ...s, kol }
  }).filter(s => s.kol.length)
}

// Minste breidd (pt) kolonnane treng for å få plass med litt rom for aktivitetsnamnet
export function trengBredd(oppsett, perioder) {
  const kol = valdeKolonnar(oppsett, perioder).flatMap(g => g.kol)
  const fast = kol.reduce((a, k) => a + (k.b || 0), 0)
  return fast + (kol.some(k => k.b === 0) ? 150 : 0) + 68
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
  const [B, H] = arkMaal(oppsett.ark), M = 34
  const grupperKol = valdeKolonnar(oppsett, data.perioder)
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

  const blaa = rgb(0.663, 0.784, 0.925), lys = rgb(0.93, 0.95, 0.98), strek = rgb(0.7, 0.72, 0.76), svart = rgb(0, 0, 0), grå = rgb(0.3, 0.3, 0.3)
  const SKILJE = 1.4                                                    // tjukk strek mellom hovuddelane (aktivitet | påløpt | periode | prognose)
  const bryt = (tekst, font, size, maks) => {          // ordbryting til maks breidd
    const ord = rens(font, tekst).split(/\s+/).filter(Boolean); const linjer = []; let l = ''
    for (const o of ord) { const t = l ? l + ' ' + o : o; if (font.widthOfTextAtSize(t, size) <= maks || !l) l = t; else { linjer.push(l); l = o } }
    if (l) linjer.push(l)
    return linjer.length ? linjer : ['']
  }
  const kort = (tekst, font, size, maks) => {          // avkort med «..»
    let t = rens(font, tekst)
    if (font.widthOfTextAtSize(t, size) <= maks) return t
    while (t.length > 1 && font.widthOfTextAtSize(t + '..', size) > maks) t = t.slice(0, -1)
    return t + '..'
  }
  const skiljeLinjer = (yTopp, yBotn) => {               // tjukke loddrette strekar ved starten på kvar seksjon (unntatt den fyrste) + kantane
    kol.forEach((k, i) => { if (k.forst && i > 0) side.drawLine({ start: { x: X[i], y: yTopp }, end: { x: X[i], y: yBotn }, thickness: SKILJE, color: svart }) })
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
    if (oppsett.seksjonar?.prognose) {
      const per = oppsett.prognoseModus === 'veke' ? ', per veke' : oppsett.prognoseModus === 'resterande' ? '' : ', per månad'
      t.push(`Prognose: planlagde timar frå ${datoNo(iso(addDays(tilDato(periode.til), 1)))} og ut aktiviteten${per}`)
    }
    if (t.length) linje(t.join('   ·   '))
    return ty - 6
  }
  const tabellHovud = () => {
    const hG = 15
    const yTopp = y
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
    skiljeLinjer(yTopp, y)
  }
  const nySide = () => { side = doc.addPage([B, H]); sider.push(side); y = tekstTopp(); tabellHovud() }
  nySide()

  const RH = 13
  const rad = (r, { sum = false } = {}) => {
    if (y - RH < M + 24) nySide()
    const fet = r.gruppe || sum
    const font = fet ? fb : fn
    if (r.gruppe) side.drawRectangle({ x: M, y: y - RH, width: bredd, height: RH, color: lys })
    if (sum || r.delsum) side.drawLine({ start: { x: M, y: y }, end: { x: M + bredd, y: y }, thickness: sum ? 0.9 : 0.5, color: svart })
    kol.forEach((k, i) => {
      const innrykk = k.key === 'namn' && !sum ? r.nivaa * 7 : 0
      let verdi
      if (sum) verdi = k.key === 'namn' ? 'Sum' : k.type === 'tekst' ? '' : fmtVerdi(r[k.key], k.type)
      else if (r.utanTal && k.type !== 'tekst') verdi = ''
      else verdi = fmtVerdi(r[k.key], k.type)
      const t = kort(verdi, font, r.person ? 7 : 7.5, W[i] - 6 - innrykk)
      const tw = font.widthOfTextAtSize(t, r.person ? 7 : 7.5)
      side.drawText(t, { x: k.type === 'tekst' ? X[i] + 3 + innrykk : X[i] + W[i] - 3 - tw, y: y - 9.3, size: r.person ? 7 : 7.5, font, color: r.person ? grå : svart })
    })
    skiljeLinjer(y, y - RH)
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
