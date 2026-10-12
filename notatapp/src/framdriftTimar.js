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

// Kor kraftig forma er (0 = flat, 1 = standard, opp til 2 = ekstrem). «styrke» skalerer avviket frå flat fordeling.
export const STYRKE_MAKS = 2
export const formVekt = (key, t, styrke = 1) => {
  const w = (FORM[key] || FORM.fast)(t)
  return Math.max(0.03, 1 + (Number.isFinite(styrke) ? styrke : 1) * (w - 1))
}

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
  const n = aktive.length
  const styrke = el.fordelingStyrke ?? 1
  const vekt = aktive.map((v, i) => {
    // «eigen»: brukaren har dratt stolpane sjølv (eigenVekt per veke, nøkkel = måndag)
    if (el.fordeling === 'eigen') return v.kap * Math.max(0.02, +(el.eigenVekt?.[format(v.mandag, 'yyyy-MM-dd')] ?? 1))
    return v.kap * formVekt(el.fordeling || 'fast', n === 1 ? 0.5 : (i + 0.5) / n, styrke)
  })
  const sum = vekt.reduce((a, b) => a + b, 0)
  const rund = vekt.map(w => Math.round((w / sum) * total * 2) / 2)
  // juster slik at summen blir nøyaktig `total`: legg avviket på den største veka
  const avvik = Math.round((total - rund.reduce((a, b) => a + b, 0)) * 2) / 2
  if (avvik !== 0) rund[rund.indexOf(Math.max(...rund))] += avvik
  return aktive.map((v, i) => ({ veke: format(v.mandag, 'yyyy-MM-dd'), timar: Math.max(0, rund[i]) }))
}

// Kven som gjer jobben i ein aktivitet: [{ namn, del (prosent, sum 100) }].
// Bruker `personar` (Framdrift → «Fordel timar på personell») viss sett, elles ansvarleg = 100 %.
export function personDelar(e) {
  const p = (e.personar || []).filter(x => x && x.namn && +x.del > 0)
  if (p.length) return p.map(x => ({ namn: x.namn.trim(), del: +x.del }))
  const a = (e.ansvarleg || '').trim()
  return a ? [{ namn: a, del: 100 }] : []
}

// ── Timepris og budsjett ────────────────────────────────────────────
// Ein aktivitet kan ha FORVENTA TIMAR (fast) eller eit BUDSJETT (fastpris, kr; modus 'budsjett'). Med budsjett er
// timane eit RESULTAT: budsjett ÷ snittpris, der snittprisen er vekta med personfordelinga — fordelinga er alltid
// prosent av TIMANE (ikkje av beløpet): snittpris = Σ (del_i % × timepris_i).
export const prisKartFra = (personell) => new Map((personell || []).filter(p => +p.timepris > 0).map(p => [p.namn.trim().toLowerCase(), +p.timepris]))

export function snittpris(el, prisar) {
  const delar = personDelar(el)
  if (!delar.length) return { pris: 0, manglar: [], utanPersonar: true }
  const manglar = delar.filter(d => !prisar.get(d.namn.toLowerCase())).map(d => d.namn)
  const pris = delar.reduce((s, d) => s + (d.del / 100) * (prisar.get(d.namn.toLowerCase()) || 0), 0)
  return { pris, manglar, utanPersonar: false }
}

// Effektive timar for ein aktivitet (frå budsjett viss modus = 'budsjett')
export function effektiveTimar(el, prisar) {
  if (el.type !== 'aktivitet') return +el.timar || 0
  if (el.modus === 'budsjett') {
    const { pris } = snittpris(el, prisar)
    return pris > 0 ? Math.round(((+el.budsjett || 0) / pris) * 2) / 2 : 0
  }
  return +el.timar || 0
}

// Heile planen med effektive timar (for visning/utrekning; redigering brukar råplanen)
export const medEffektiveTimar = (elementer, personell) => {
  const prisar = prisKartFra(personell)
  return elementer.map(e => (e.type === 'aktivitet' && e.modus === 'budsjett' ? { ...e, timar: effektiveTimar(e, prisar) } : e))
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
      for (const { namn, del } of personDelar(e)) v.perPerson[namn] = (v.perPerson[namn] || 0) + timar * del / 100
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
