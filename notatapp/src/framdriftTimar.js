import { addDays, format } from 'date-fns'
import { tilDato } from './framdriftDato'
import { arbeidstimarIVeke, vekeStart, STANDARD_KONTORKALENDER } from './kontorkalender'

// ═══════════════════════════════════════════════════════════════════
//  Timeprognose for aktivitetar i Framdrift (claude/framdrift-modul.md,
//  «Personell og timar»). Ein aktivitet har forventa TIMAR TOTALT og ein
//  FORDELING over vekene i perioden:
//    fast  — same timetal kvar veke
//    start — størst pådrag i starten
//    midt  — størst pådrag i midten
//    slutt — størst pådrag på slutten
//  Kvar veke vert vekta med kor mange arbeidstimar kontoret faktisk har den
//  veka innanfor perioden (kontorkalender.js) — veker med fri (stille veke,
//  juleveka …) får 0, korte veker får mindre. Timane vert runda til halve
//  timar og justerte slik at summen alltid er nøyaktig det oppgjevne totalet.
// ═══════════════════════════════════════════════════════════════════

export const FORDELINGAR = [
  { key: 'fast',  namn: 'Fast',  tips: 'Fast timetal kvar veke' },
  { key: 'start', namn: 'Start', tips: 'Størst pådrag i starten' },
  { key: 'midt',  namn: 'Midt',  tips: 'Størst pådrag i midten' },
  { key: 'slutt', namn: 'Slutt', tips: 'Størst pådrag på slutten' },
]

// Relativ vekt (t = 0…1 gjennom perioden)
const FORM = {
  fast:  () => 1,
  start: (t) => 1.9 - 1.8 * t,
  midt:  (t) => 0.2 + 1.8 * (1 - Math.abs(2 * t - 1)),
  slutt: (t) => 0.1 + 1.8 * t,
}

export const formVekt = (key, t) => (FORM[key] || FORM.fast)(t)

// Timar per veke for éin aktivitet: [{ veke:'yyyy-MM-dd' (måndag), timar }]
export function fordelTimar(el, kal = STANDARD_KONTORKALENDER) {
  const total = +el.timar || 0
  if (total <= 0 || el.type === 'milepael') return []
  const fra = tilDato(el.start), til = tilDato(el.slutt)
  const veker = []
  for (let m = vekeStart(fra); m <= til; m = addDays(m, 7)) {
    veker.push({ mandag: m, kap: arbeidstimarIVeke(m, kal, fra, til) })
  }
  let aktive = veker.filter(v => v.kap > 0)
  // Ingen arbeidstimar i heile perioden (t.d. berre fridagar): fordel likt over alle vekene
  if (!aktive.length) aktive = veker.map(v => ({ ...v, kap: 1 }))
  const form = FORM[el.fordeling] || FORM.fast
  const n = aktive.length
  const vekt = aktive.map((v, i) => v.kap * form(n === 1 ? 0.5 : (i + 0.5) / n))
  const sum = vekt.reduce((a, b) => a + b, 0)
  const rund = vekt.map(w => Math.round((w / sum) * total * 2) / 2)
  // juster slik at summen blir nøyaktig `total`: legg avviket på den største veka
  const avvik = Math.round((total - rund.reduce((a, b) => a + b, 0)) * 2) / 2
  if (avvik !== 0) rund[rund.indexOf(Math.max(...rund))] += avvik
  return aktive.map((v, i) => ({ veke: format(v.mandag, 'yyyy-MM-dd'), timar: Math.max(0, rund[i]) }))
}

// Timar per veke for heile planen, med fordeling per ansvarleg person.
// Berre aktivitetar tel (fasar og milepælar ville gjeve dobbeltrekning).
// Gjev Map(veke → { total, perPerson: { namn: timar } }).
export function timarPerVeke(elementer, kal = STANDARD_KONTORKALENDER) {
  const kart = new Map()
  for (const e of elementer) {
    if (e.type !== 'aktivitet') continue
    for (const { veke, timar } of fordelTimar(e, kal)) {
      if (!kart.has(veke)) kart.set(veke, { total: 0, perPerson: {} })
      const v = kart.get(veke)
      v.total += timar
      const person = (e.ansvarleg || '').trim()
      if (person) v.perPerson[person] = (v.perPerson[person] || 0) + timar
    }
  }
  return kart
}

// Overbelastning: personar som har meir planlagt ei veke enn kapasiteten
// (kontoret sine arbeidstimar den veka × stillingsprosent). Berre personar som
// finst i personellista vert vurderte. Gjev Map(veke → [{ namn, timar, kapasitet }]).
export function overbelastning(kart, personell, kal = STANDARD_KONTORKALENDER) {
  const ut = new Map()
  const perNamn = new Map(personell.map(p => [p.namn.trim().toLowerCase(), p]))
  for (const [veke, v] of kart) {
    const lista = []
    for (const [namn, timar] of Object.entries(v.perPerson)) {
      const p = perNamn.get(namn.toLowerCase())
      if (!p) continue
      const kapasitet = arbeidstimarIVeke(tilDato(veke), kal) * ((+p.prosent || 0) / 100)
      if (timar > kapasitet + 0.01) lista.push({ namn: p.namn, timar, kapasitet })
    }
    if (lista.length) ut.set(veke, lista)
  }
  return ut
}
