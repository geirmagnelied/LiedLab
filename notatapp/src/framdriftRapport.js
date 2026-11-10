import { addDays, format, getISOWeek, getISOWeekYear } from 'date-fns'
import { tilDato } from './framdriftDato'
import { visingsrader, harBorn, etterkommarar } from './framdriftLogikk'
import { fordelTimar, personDelar, prisKartFra, snittpris, prisFor, rateUtanPlan } from './framdriftTimar'
import { kopleForbruk, nokkelNamn } from './framdriftForbruk'
import { normAktType } from './framdriftVerdiar'
import { effektivFerdig } from './framdriftFerdig'
import { NORCONSULT_LOGO_BASE64 } from './norconsultLogo'

// ═══════════════════════════════════════════════════════════════════
//  Rapportar frå Prosjektplan (Framdrift) → PDF. Reine funksjonar: utrekning av rapportdata og teikning av PDF (pdf-lib, lasta ved bruk).
//  Ein rapport er delt i fire seksjonar (kolonnegrupper):
//    info     — aktivitet: nummer, namn, ansvarleg, budsjett …
//    total    — påløpt akkumulert TIL OG MED periodeslutten (timar/kroner) og gjenståande
//    periode  — påløpt i den valde perioden (standard: førre månad)
//    prognose — planlagde timar frå dagen ETTER periodeslutten og ut aktiviteten (kroner = timar × timerate)
//  Standardrapportane (kunde/intern) er faste; brukaren lagar eigne (framdrift_rapportar) ved å velje seksjonar og kolonnar.
// ═══════════════════════════════════════════════════════════════════

// ── Kolonnekatalog ──────────────────────────────────────────────────
export const SEKSJONAR = [
  { key: 'info', namn: 'Aktivitet og budsjett' },
  { key: 'total', namn: 'Påløpt akkumulert' },
  { key: 'periode', namn: 'Påløpt i perioden' },
  { key: 'prognose', namn: 'Prognose resterande arbeid' },
]
// type: 'tekst' | 'kr' | 't' | 'pct'
export const KOLONNER = {
  info: [
    { key: 'kode', namn: 'Aktivitetsnr.', type: 'tekst', b: 54 },
    { key: 'namn', namn: 'Aktivitet', type: 'tekst', b: 0 },
    { key: 'ansvarleg', namn: 'Ansvarleg', type: 'tekst', b: 82 },
    { key: 'budsjettType', namn: 'Aktivitetstype', type: 'tekst', b: 62 },
    { key: 'start', namn: 'Start', type: 'tekst', b: 52 },
    { key: 'slutt', namn: 'Slutt', type: 'tekst', b: 52 },
    { key: 'timarPlan', namn: 'Planlagde timar', type: 't', b: 52 },
    { key: 'timerate', namn: 'Timerate (kr/t)', type: 'kr', b: 52 },
    { key: 'budsjett', namn: 'Budsjett (kr)', type: 'kr', b: 62 },
    { key: 'fastpris', namn: 'Fastpris (kr)', type: 'kr', b: 62 },
  ],
  total: [
    { key: 'palopKr', namn: 'Påløpt (kr)', type: 'kr', b: 62 },
    { key: 'palopTimar', namn: 'Påløpt (timar)', type: 't', b: 52 },
    { key: 'avvikAkkKr', namn: '+/- budsjett (kr)', type: 'kr', b: 62 },
    { key: 'avvikAkkTimar', namn: '+/- budsjett (timar)', type: 't', b: 52 },
    { key: 'gjenKr', namn: 'Gjenståande budsjett (kr)', type: 'kr', b: 66 },
    { key: 'gjenTimar', namn: 'Gjenståande timar', type: 't', b: 52 },
    { key: 'prosentBrukt', namn: '% av budsjett brukt', type: 'pct', b: 48 },
    { key: 'ferdigPct', namn: '% faktisk framdrift (timevekta)', type: 'pct', b: 62 },
  ],
  periode: [
    { key: 'perKr', namn: 'Påløpt (kr)', type: 'kr', b: 62 },
    { key: 'perTimar', namn: 'Påløpt (timar)', type: 't', b: 52 },
    { key: 'avvikPerKr', namn: '+/- budsjett (kr)', type: 'kr', b: 62 },
    { key: 'avvikPerTimar', namn: '+/- budsjett (timar)', type: 't', b: 52 },
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
    kolonnar: { info: ['kode', 'namn', 'budsjettType', 'ansvarleg', 'budsjett', 'fastpris'], total: ['palopKr', 'palopTimar', 'avvikAkkKr', 'avvikAkkTimar', 'gjenKr'], periode: ['perKr', 'perTimar', 'avvikPerKr', 'avvikPerTimar'], prognose: ['progKr', 'progTimar'] } } },
  { id: 'std-intern', namn: 'Intern rapport', standard: true, oppsett: { ...BASIS, tittel: 'Intern prosjektrapport', berreMedTal: false, delsum: true, perPerson: true,
    seksjonar: { info: true, total: true, periode: true, prognose: true },
    kolonnar: { info: ['kode', 'namn', 'budsjettType', 'ansvarleg', 'timarPlan', 'budsjett', 'fastpris'], total: ['palopTimar', 'palopKr', 'avvikAkkTimar', 'avvikAkkKr', 'gjenTimar', 'gjenKr', 'prosentBrukt', 'ferdigPct'], periode: ['perTimar', 'perKr', 'avvikPerTimar', 'avvikPerKr'], prognose: ['progTimar', 'progKr', 'sluttKr', 'avvikKr'] } } },
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

// Planlagde timar i tidsrommet [fraIso, tilIso] (fraIso = null: frå starten av aktiviteten). Same fordeling som prognoseFordelt, so
// planlagd-til-no + prognose = alle planlagde timar.
function planlagdIntervall(e, kal, fraIso, tilIso) {
  // Ingen samanlikning av forbruk mot plan når timane ikkje er spreidde gjennom tidsrommet: berre budsjett (modus 'budsjett'), eller fordelinga er aldri sett
  // (standard «Fast» utan at brukaren har valt/justert fordeling → e.fordelingSett er ikkje sett). Valt Start/Midt/Slutt/eigen fordeling tel som innlagd spreiing.
  const spreidd = (e.fordeling && e.fordeling !== 'fast') || !!e.fordelingSett
  if (e.modus === 'budsjett' || !spreidd) return 0
  const fra = fraIso ? tilDato(fraIso) : null, til = tilDato(tilIso)
  let sum = 0
  for (const { veke, timar } of fordelTimar(e, kal)) {
    const mandag = tilDato(veke), perDag = timar / 5
    for (let i = 0; i < 5; i++) { const d = addDays(mandag, i); if (d > til) break; if (fra && d < fra) continue; sum += perDag }
  }
  return sum
}
// Avviksfarge: raud = over 20 % meir enn planlagd · blå = over 20 % under · gul = 10-20 % avvik · grå = under 10 %
const avvikFarge = (faktisk, plan) => {
  const d = faktisk / plan - 1
  return d > 0.2 ? 'raud' : d < -0.2 ? 'blaa' : Math.abs(d) >= 0.1 ? 'gul' : 'graa'
}

// → { rader, sum, perioder }. rader: { id, nivaa, gruppe, delsum, utanTal, person, …felt }.
// `elementer` = planen med effektive timar (medEffektiveTimar), `forbrukRader` = ALLE importerte timeføringar.
export function byggRapportData({ elementer, forbrukRader, personell, kal, periode, oppsett, dokMap = new Map() }) {
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
      const rate = d ? prisFor(d, prisar) : rateUtanPlan(e, namn, prisar)
      t += r.timar; k += r.timar * (rate || snitt || 0)
    }
    return { t, k }
  }
  const radNamn = (r) => r.ansattNamn || r.ansatt || ''

  // Felles utrekning av eit tal-sett (aktivitet eller person). `del` = andel av aktivitetens timar (1 for heile aktiviteten).
  const lagTal = ({ budsjett, timarPlan, timerate, palop, per, fordelt, snitt, planAkk = 0, planPer = 0, fast = false }) => {
    const progT = fordelt.sum, progK = progT * snitt
    const t = {
      budsjett, timarPlan, timerate,
      palopKr: palop.k, palopTimar: palop.t, gjenKr: budsjett - palop.k, gjenTimar: timarPlan - palop.t,
      perKr: per.k, perTimar: per.t, progKr: progK, progTimar: progT,
      sluttKr: palop.k + progK, avvikKr: budsjett - (palop.k + progK),
      planAkkT: planAkk, planPerT: planPer, planAkkKr: planAkk * snitt, planPerKr: planPer * snitt,
      // «+/- budsjett» = faktisk minus planlagd for same tidsrom (0 når ingenting er planlagt, so summane vert rette oppover)
      avvikAkkTimar: planAkk > 0.001 ? palop.t - planAkk : 0, avvikAkkKr: planAkk > 0.001 ? palop.k - planAkk * snitt : 0,
      avvikPerTimar: planPer > 0.001 ? per.t - planPer : 0, avvikPerKr: planPer > 0.001 ? per.k - planPer * snitt : 0,
      fastpris: fast ? budsjett : 0, budsjettVis: fast ? 0 : budsjett,      // fastpris og budsjett (medgått tid) i kvar si kolonne      // planlagd til og med periodeslutten / i perioden (grunnlag for «+/- budsjett»)
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
    const ferdig = Math.max(0, Math.min(100, +effektivFerdig(e, dokMap) || 0))      // % faktisk framdrift; vekt (timevekta oppover) = planlagde timar
    return { ...lagTal({ budsjett, timarPlan: +e.timar || 0, timerate: snitt, palop, per: kostOgTimar(e, iPeriode), fordelt: prognoseFordelt(e, kal, periode.til), snitt,
      planAkk: planlagdIntervall(e, kal, null, periode.til), planPer: planlagdIntervall(e, kal, periode.fra, periode.til), fast: normAktType(e.budsjettType) === 'Fastpris' }),
      ferdigPct: ferdig, ferdigVekt: (+e.timar || 0) * ferdig }
  }

  // Per person i ein aktivitet: planlagd del, faktisk forbruk og prognose (aktivitetens prognose × personens del)
  const personTal = (e, t0) => {
    const rader = perAkt.get(e.id) || []
    const delar = personDelar(e)
    const namnListe = delar.map(d => ({ namn: d.namn, del: d.del / 100, d }))
    for (const r of rader) { const n = radNamn(r); if (n && !namnListe.some(x => nokkelNamn(x.namn) === nokkelNamn(n))) namnListe.push({ namn: n, del: 0, d: null }) }
    const snitt = snittpris(e, prisar).pris
    const fordeltAkt = prognoseFordelt(e, kal, periode.til)
    const planAkkAkt = planlagdIntervall(e, kal, null, periode.til), planPerAkt = planlagdIntervall(e, kal, periode.fra, periode.til)
    return namnListe.map(p => {
      const mine = rader.filter(r => nokkelNamn(radNamn(r)) === nokkelNamn(p.namn))
      const rate = (+e.timerate > 0 ? +e.timerate : 0) || (p.d ? prisFor(p.d, prisar) : rateUtanPlan(e, p.namn, prisar)) || snitt
      const kt = (liste) => ({ t: liste.reduce((a, r) => a + r.timar, 0), k: liste.reduce((a, r) => a + r.timar, 0) * rate })
      const skaler = (m) => new Map([...m].map(([k, h]) => [k, h * p.del]))
      const timarPlan = (t0.timarPlan || 0) * p.del
      return { namn: p.namn, ...lagTal({
        budsjett: timarPlan * rate, timarPlan, timerate: rate, planAkk: planAkkAkt * p.del, planPer: planPerAkt * p.del, fast: normAktType(e.budsjettType) === 'Fastpris',
        palop: kt(mine.filter(r => r.dato <= periode.til)), per: kt(mine.filter(r => r.dato >= periode.fra && r.dato <= periode.til)),
        fordelt: { veke: skaler(fordeltAkt.veke), manad: skaler(fordeltAkt.manad), sum: fordeltAkt.sum * p.del }, snitt: rate }) }
    })
  }

  const IKKJE_SUM = new Set(['nivaa', 'prosentBrukt', 'timerate', 'ferdigPct'])
  const summer = (liste) => {
    const felt = new Set()
    for (const x of liste) for (const k of Object.keys(x)) if (typeof x[k] === 'number' && !IKKJE_SUM.has(k)) felt.add(k)
    const s = Object.fromEntries([...felt].map(f => [f, liste.reduce((a, x) => a + (x[f] || 0), 0)]))
    s.prosentBrukt = (s.budsjett || 0) > 0 ? (s.palopKr / s.budsjett) * 100 : null
    s.ferdigPct = (s.timarPlan || 0) > 0 ? (s.ferdigVekt || 0) / s.timarPlan : null
    s.timerate = (s.timarPlan || 0) > 0 ? liste.reduce((a, x) => a + (x.timarPlan || 0) * (x.timerate || 0), 0) / s.timarPlan : 0
    return s
  }
  const harTal = (t) => ['budsjett', 'timarPlan', 'palopKr', 'palopTimar', 'perTimar', 'progTimar'].some(f => Math.abs(t[f] || 0) > 0.001)
  const medPct = (t) => { t.prosentBrukt = (t.budsjett || 0) > 0 ? (t.palopKr / t.budsjett) * 100 : null; return t }

  // Fargar på «+/- budsjett»-kolonnane (raud/gul/grå/blå, sjå avvikFarge) — akkumulert og i perioden. Ingen farge utan planlagt forbruk.
  const avvFarge = (t) => ({
    farge: (t.planAkkT || 0) > 0.001 ? avvikFarge((t.avvikAkkTimar || 0) + t.planAkkT, t.planAkkT) : 'graa',
    fargePer: (t.planPerT || 0) > 0.001 ? avvikFarge((t.avvikPerTimar || 0) + t.planPerT, t.planPerT) : 'graa' })
  const bladTal = new Map()
  for (const e of elementer) if (erBlad(e)) bladTal.set(e.id, medPct(tal(e)))
  const bladUnder = (e) => etterkommarar(elementer, e.id).filter(erBlad)

  const rader = []
  const apne = []                   // opne gruppar (for «Sum …»-rad etter siste delaktivitet)
  const lukk = (nivaMin) => {
    while (apne.length && apne[apne.length - 1].nivaa >= nivaMin) {
      const g = apne.pop()
      rader.push({ id: g.id + ':sum', nivaa: g.nivaa, gruppe: true, delsum: true, kode: '', namn: 'Sum ' + g.namn, ansvarleg: '', budsjettType: '', start: '', slutt: '', ...g.sum, ...avvFarge(g.sum) })
    }
  }
  for (const e of visingsrader(elementer, new Set())) {
    if (e.type === 'milepael') continue
    if (oppsett.delsum && oppsett.fasar) lukk(e.nivå)
    if (erBlad(e)) {
      const t = bladTal.get(e.id)
      if (oppsett.berreMedTal && !harTal(t)) continue
      const nivaa = oppsett.fasar ? e.nivå : 0
      rader.push({ id: e.id, nivaa, gruppe: false, kode: e.kode || '', namn: e.namn, ansvarleg: e.ansvarleg || '', budsjettType: normAktType(e.budsjettType),
        start: e.start ? datoNo(e.start) : '', slutt: e.slutt ? datoNo(e.slutt) : '', ...t, ...avvFarge(t) })
      if (oppsett.perPerson) personTal(e, t).forEach((p, i) => {
        rader.push({ id: e.id + ':p' + i, nivaa: nivaa + 1, gruppe: false, person: true, kode: '', ansvarleg: '', budsjettType: '', start: '', slutt: '', ...medPct(p), ...avvFarge(p) })
      })
    } else if (oppsett.fasar) {
      const barn = bladUnder(e).map(b => bladTal.get(b.id)).filter(t => t && (!oppsett.berreMedTal || harTal(t)))
      if (!barn.length) continue
      const s = summer(barn)
      if (oppsett.delsum) {
        rader.push({ id: e.id, nivaa: e.nivå, gruppe: true, utanTal: true, kode: e.kode || '', namn: e.namn, ansvarleg: e.ansvarleg || '', budsjettType: '', start: '', slutt: '' })
        apne.push({ id: e.id, nivaa: e.nivå, namn: e.namn, sum: s })
      } else rader.push({ id: e.id, nivaa: e.nivå, gruppe: true, kode: e.kode || '', namn: e.namn, ansvarleg: e.ansvarleg || '', budsjettType: '', start: '', slutt: '', ...s, ...avvFarge(s) })
    }
  }
  lukk(-1)
  const leggTil = rader.filter(r => !r.gruppe && !r.person)
  // Prognoseperiodar (kolonnar): alle nøklar som har timar hos minst éin aktivitet
  const nøklar = new Set()
  for (const t of bladTal.values()) for (const k of Object.keys(t)) if (k.startsWith('pt_')) nøklar.add(k.slice(3))
  const perioder = [...nøklar].sort().map(k => ({ key: k, label: periodeNamn(k, modus) }))
  const sumTal = summer(leggTil)
  return { rader, sum: { ...sumTal, ...avvFarge(sumTal) }, perioder }
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
        if (medT) dyn.push({ key: 'pt_' + p.key, namn: p.label + ' (timar)', type: 't', b: 38, periode: true, pkey: p.key })
        if (medK) dyn.push({ key: 'pk_' + p.key, namn: p.label + ' (kr)', type: 'kr', b: 48, periode: true, pkey: p.key })
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

const medFortegn = (v, type) => { const t = fmtVerdi(v, type); return t && t !== '-' && !t.startsWith('-') ? '+' + t : t }
const AVVIK_FARGE = { raud: [0.8, 0.1, 0.1], gul: [0.78, 0.52, 0], graa: [0.5, 0.5, 0.5], blaa: [0.1, 0.35, 0.85] }

// ── PDF ─────────────────────────────────────────────────────────────
// Kolonnebreidder vert målte frå innhaldet: tal og overskrifter får alltid plass (aldri avkorta). Er det for lite plass, vert
// heile tabellen (skrift, rader, breidder) forminska jamt. Lang tekst (aktivitetsnamn, ansvarleg) vert brotten over fleire linjer.
// Resultatet har eigenskapen `skala` (1 = full storleik).
export async function lagRapportPdf({ data, oppsett, periode, prosjektNamn, prosjektNr, brukar, kontor }) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  const fn = await doc.embedFont(StandardFonts.Helvetica), fb = await doc.embedFont(StandardFonts.HelveticaBold)
  const rens = (f, s) => String(s ?? '').split('').map(c => { try { f.encodeText(c); return c } catch { return c === '–' || c === '−' ? '-' : '?' } }).join('')
  const [B, H] = arkMaal(oppsett.ark), M = 34
  const grupperKol = valdeKolonnar(oppsett, data.perioder)
  const kol = grupperKol.flatMap(g => g.kol.map((k, i) => ({ ...k, sek: g.key, forst: i === 0 })))
  if (!kol.length) throw new Error('Rapporten har ingen kolonnar. Vel minst ein seksjon og ei kolonne.')
  const bredd = B - 2 * M

  const alle = [...data.rader.map(r => ({ r, sum: false })), ...(oppsett.sumrad ? [{ r: { ...data.sum, gruppe: false, nivaa: 0 }, sum: true }] : [])]
  const tekstAv = (r, k, sum) => {
    if (k.key.startsWith('avvik')) return !r.utanTal && (r[k.key.startsWith('avvikPer') ? 'planPerT' : 'planAkkT'] || 0) > 0.001 ? medFortegn(r[k.key], k.type) : ''
    if (k.key === 'fastpris' || k.key === 'budsjett') { const v = k.key === 'budsjett' ? (r.budsjettVis ?? r.budsjett) : r.fastpris; return !r.utanTal && Math.abs(v || 0) >= 0.5 ? fmtVerdi(v, 'kr') : '' }
    if (sum) return k.key === 'namn' ? 'Sum' : k.type === 'tekst' ? '' : fmtVerdi(r[k.key], k.type)
    if (r.utanTal && k.type !== 'tekst') return ''
    return fmtVerdi(r[k.key], k.type)
  }
  const BASE = 7.5, HOV = 7
  const lengste = (t, f, s) => rens(f, t).split(/\s+/).filter(Boolean).reduce((a, o) => Math.max(a, f.widthOfTextAtSize(o, s)), 0)
  // naturleg breidd per kolonne ved full skriftstorleik
  const natur = kol.map(k => {
    const hov = lengste(k.namn, fb, HOV) + 8
    if (k.key === 'namn') return 0
    let m = 0
    for (const { r, sum } of alle) {
      const f = (r.gruppe || sum || k.key.startsWith('avvik')) ? fb : fn
      m = Math.max(m, f.widthOfTextAtSize(rens(f, tekstAv(r, k, sum)), BASE))
    }
    const innhald = k.type === 'tekst' ? Math.min(m + 8, 100) : m + 8
    return Math.max(hov, innhald, 26)
  })
  const harNamn = kol.some(k => k.key === 'namn')
  const trengs = natur.reduce((a, x) => a + x, 0) + (harNamn ? 150 : 0)
  const S = Math.max(0.4, Math.min(1, bredd / trengs))
  const W = natur.map(x => x * S)
  if (harNamn) W[kol.findIndex(k => k.key === 'namn')] = bredd - W.reduce((a, x) => a + x, 0)
  else { const ekstra = bredd - W.reduce((a, x) => a + x, 0); if (ekstra > 0) W.forEach((x, i) => { W[i] = x + ekstra * natur[i] / natur.reduce((a, y) => a + y, 0) }) }
  const X = W.reduce((a, w, i) => (a.push(i ? a[i - 1] + W[i - 1] : M), a), [])
  const fs = BASE * S, fh = HOV * S, lh = 9.2 * S, pad = 3 * S

  const blaa = rgb(0.663, 0.784, 0.925), lys = rgb(0.93, 0.95, 0.98), strek = rgb(0.7, 0.72, 0.76), svart = rgb(0, 0, 0), grå = rgb(0.3, 0.3, 0.3)
  const prognoseGraa = rgb(0.8, 0.81, 0.84)                             // prognosen skil seg frå påløpt: grå i staden for blå overskrift
  const SKILJE = 0.9                                                    // strek mellom hovuddelane (aktivitet | påløpt | periode | prognose) og rundt tabellen
  const bryt = (tekst, font, size, maks) => {          // ordbryting til maks breidd
    const ord = rens(font, tekst).split(/\s+/).filter(Boolean); const linjer = []; let l = ''
    for (const o of ord) { const t = l ? l + ' ' + o : o; if (font.widthOfTextAtSize(t, size) <= maks || !l) l = t; else { linjer.push(l); l = o } }
    if (l) linjer.push(l)
    return linjer.length ? linjer : ['']
  }
  const kort = (tekst, font, size, maks) => {          // avkort med «..» (berre eit siste skansemiddel)
    let t = rens(font, tekst)
    if (font.widthOfTextAtSize(t, size) <= maks) return t
    while (t.length > 1 && font.widthOfTextAtSize(t + '..', size) > maks) t = t.slice(0, -1)
    return t + '..'
  }
  const skiljeLinjer = (yTopp, yBotn, yTynnTopp = yTopp) => {               // loddrette strekar: ytterkantane + starten på kvar seksjon (unntatt den fyrste)
    const v = (x) => side.drawLine({ start: { x, y: yTopp }, end: { x, y: yBotn }, thickness: SKILJE, color: svart })
    v(M); v(M + bredd)
    const tynn = (x) => side.drawLine({ start: { x, y: yTynnTopp }, end: { x, y: yBotn }, thickness: 0.35, color: rgb(0.3, 0.3, 0.3) })
    kol.forEach((k, i) => {
      if (k.forst && i > 0) v(X[i])
      else if (i > 0 && ((k.pkey && k.pkey !== kol[i - 1].pkey) || (!k.pkey && kol[i - 1].pkey))) tynn(X[i])      // tynn strek mellom prognoseperiodane
    })
  }

  const sider = []
  let side, y
  let logo = null
  try {
    const b64 = NORCONSULT_LOGO_BASE64.split(',')[1]
    logo = await doc.embedPng(Uint8Array.from(atob(b64), c => c.charCodeAt(0)))
  } catch { logo = null }
  const tekstTopp = () => {
    if (logo) {
      const lh2 = 24, lw = lh2 * logo.width / logo.height
      side.drawImage(logo, { x: B - M - lw, y: H - M - lh2 + 4, width: lw, height: lh2 })
    }
    side.drawText(rens(fb, oppsett.tittel || 'Rapport'), { x: M, y: H - M - 6, size: 16, font: fb, color: svart })
    let ty = H - M - 22
    const linje = (s) => { side.drawText(rens(fn, s), { x: M, y: ty, size: 8.5, font: fn, color: rgb(0.25, 0.25, 0.25) }); ty -= 11.5 }
    linje(`Prosjekt: ${[prosjektNr, prosjektNamn].filter(Boolean).join(' ')}`)
    if (oppsett.undertittel) linje(oppsett.undertittel)
    const t = []
    if (oppsett.seksjonar?.total) t.push(`Påløpt akkumulert: til og med ${datoNo(periode.til)}`)
    if (oppsett.seksjonar?.periode) t.push(`Periode: ${datoNo(periode.fra)} - ${datoNo(periode.til)}`)
    if (oppsett.seksjonar?.prognose) {
      const per = oppsett.prognoseModus === 'veke' ? ', per veke' : oppsett.prognoseModus === 'resterande' ? '' : ', per månad'
      t.push(`Prognose: planlagde timar frå ${datoNo(iso(addDays(tilDato(periode.til), 1)))} og ut aktiviteten${per}`)
    }
    if (t.length) linje(t.join('   ·   '))
    return ty - 6
  }
  const tabellHovud = () => {
    const gl = grupperKol.map(g => { const gw = kol.reduce((a, c, i) => (c.sek === g.key ? a + W[i] : a), 0); return { g, gw, linjer: bryt(g.namn, fb, 8 * S, gw - 2 * pad) } })
    const hG = Math.max(...gl.map(x => x.linjer.length)) * 9 * S + 6 * S
    const yTopp = y
    let gx = M
    for (const { g, gw, linjer } of gl) {
      side.drawRectangle({ x: gx, y: y - hG, width: gw, height: hG, color: g.key === 'prognose' ? prognoseGraa : blaa, borderColor: svart, borderWidth: 0.5 })
      linjer.forEach((l, j) => side.drawText(l, { x: gx + pad, y: y - 10.5 * S - j * 9 * S, size: 8 * S, font: fb, color: svart }))
      gx += gw
    }
    y -= hG
    const linjer = kol.map((k, i) => bryt(k.namn, fb, fh, W[i] - 2 * pad))
    const hK = Math.max(...linjer.map(l => l.length)) * 8.4 * S + 5 * S
    kol.forEach((k, i) => {
      side.drawRectangle({ x: X[i], y: y - hK, width: W[i], height: hK, color: k.sek === 'prognose' ? prognoseGraa : blaa, borderColor: svart, borderWidth: 0.5 })
      linjer[i].forEach((l, j) => {
        const tw = fb.widthOfTextAtSize(l, fh)
        side.drawText(l, { x: k.type === 'tekst' ? X[i] + pad : X[i] + W[i] - pad - tw, y: y - 9 * S - j * 8.4 * S, size: fh, font: fb, color: svart })
      })
    })
    y -= hK
    side.drawLine({ start: { x: M, y }, end: { x: M + bredd, y }, thickness: 1.6, color: rgb(0.04, 0.17, 0.4) })      // mørkeblå strek under overskrifta
    side.drawLine({ start: { x: M, y: yTopp }, end: { x: M + bredd, y: yTopp }, thickness: SKILJE, color: svart })
    skiljeLinjer(yTopp, y, yTopp - hG)
  }
  const avslutt = () => side.drawLine({ start: { x: M, y }, end: { x: M + bredd, y }, thickness: SKILJE, color: svart })
  const nySide = () => { if (side) avslutt(); side = doc.addPage([B, H]); sider.push(side); y = tekstTopp(); tabellHovud() }
  nySide()

  const rad = (r, { sum = false } = {}) => {
    const font = (r.gruppe || sum) ? fb : fn
    const sz = r.person ? fs * 0.94 : fs
    // tekstkolonnar vert brotne over fleire linjer; radhøgda følgjer den lengste
    const cellelinjer = kol.map((k, i) => {
      const t = tekstAv(r, k, sum)
      if (k.type !== 'tekst') return [t]
      const innrykk = k.key === 'namn' && !sum ? r.nivaa * 7 * S : 0
      return bryt(t, font, sz, W[i] - 2 * pad - innrykk)
    })
    const RH = Math.max(...cellelinjer.map(l => l.length)) * lh + 4 * S
    if (y - RH < M + 24) nySide()
    if (r.gruppe) side.drawRectangle({ x: M, y: y - RH, width: bredd, height: RH, color: lys })
    kol.forEach((k, i) => { if (k.sek === 'prognose') side.drawRectangle({ x: X[i], y: y - RH, width: W[i], height: RH, color: rgb(0.45, 0.45, 0.5), opacity: 0.12 }) })      // svakt grått slør: prognosen
    if (sum || r.delsum) side.drawLine({ start: { x: M, y }, end: { x: M + bredd, y }, thickness: sum ? 0.9 : 0.5, color: svart })
    kol.forEach((k, i) => {
      const innrykk = k.key === 'namn' && !sum ? r.nivaa * 7 * S : 0
      cellelinjer[i].forEach((l, j) => {
        if (!l) return
        const fnt = k.key.startsWith('avvik') ? fb : font
        const t = k.type === 'tekst' ? l : kort(l, fnt, sz, W[i] - 2 * pad)
        const tw = fnt.widthOfTextAtSize(t, sz)
        const farge = k.key.startsWith('avvik') ? rgb(...AVVIK_FARGE[k.key.startsWith('avvikPer') ? r.fargePer : r.farge]) : r.person ? grå : svart
        side.drawText(t, { x: k.type === 'tekst' ? X[i] + pad + innrykk : X[i] + W[i] - pad - tw, y: y - 8.6 * S - j * lh, size: sz, font: fnt, color: farge })
      })
    })
    skiljeLinjer(y, y - RH)
    side.drawLine({ start: { x: M, y: y - RH }, end: { x: M + bredd, y: y - RH }, thickness: 0.25, color: rgb(0.85, 0.86, 0.88) })
    y -= RH
  }
  alle.forEach(({ r, sum }) => rad(r, { sum }))
  if (!data.rader.length) side.drawText('Ingen aktivitetar å vise.', { x: M, y: y - 14, size: 9, font: fn, color: svart })
  avslutt()

  const no = new Date()
  // Botntekst: kontornamn først, deretter «Utarbeida i LiedLab»
  const stempel = `${kontor ? kontor + ' · ' : ''}Utarbeida i LiedLab · generert av ${brukar || 'ukjend brukar'} ${no.toLocaleDateString('nb-NO')} kl. ${no.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}`
  sider.forEach((s, k) => {
    s.drawText(rens(fn, stempel), { x: M, y: 18, size: 7.5, font: fn, color: rgb(0.4, 0.4, 0.4) })
    const st = `Side ${k + 1} av ${sider.length}`
    s.drawText(st, { x: B - M - fn.widthOfTextAtSize(st, 7.5), y: 18, size: 7.5, font: fn, color: rgb(0.4, 0.4, 0.4) })
  })
  doc.setTitle(oppsett.tittel || 'Rapport'); doc.setCreator('LiedLab'); doc.setAuthor(brukar || '')
  const bytes = await doc.save()
  bytes.skala = S
  return bytes
}

export function lastNedPdf(bytes, filnamn) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url; a.download = filnamn
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
// Arkivnamn: «<oppdragsnr> <oppdragsnamn> rapport (M09 - M10)» — månad (M) eller veke (V) etter prognose-visninga; to siffer so mappa sorterer rett
export function rapportArkivNamn(oppsett, prosjektNr, prosjektNamn, periode) {
  const veke = oppsett.prognoseModus === 'veke'
  const nr = (key) => { const d = tilDato(key); return veke ? 'V' + String(getISOWeek(d)).padStart(2, '0') : 'M' + String(d.getMonth() + 1).padStart(2, '0') }
  const aar = (key) => (veke ? getISOWeekYear(tilDato(key)) : tilDato(key).getFullYear())
  // Årstal først (so mappa sorterer rett over årsskifte): «2026 M09 - M10», eller «2026 M12 - 2027 M01» når perioden går over årsskiftet
  const per = aar(periode.fra) === aar(periode.til) ? `${aar(periode.fra)} ${nr(periode.fra)} - ${nr(periode.til)}` : `${aar(periode.fra)} ${nr(periode.fra)} - ${aar(periode.til)} ${nr(periode.til)}`
  const namn = `${[prosjektNr, prosjektNamn].filter(Boolean).join(' ')} rapport${oppsett.perPerson ? ' intern' : ''} (${per})`
  return namn.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim() + '.pdf'
}
export const rapportFilnamn = (oppsett, prosjektNr) => (`${prosjektNr ? prosjektNr + ' ' : ''}${oppsett.tittel || 'Rapport'}`.replace(/[\\/:*?"<>|]+/g, '').trim() || 'Rapport') + '.pdf'
