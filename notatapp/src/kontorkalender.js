import { addDays, format, startOfWeek } from 'date-fns'
import { helligdagNamn, paaskedag } from './helligdagar'

// ═══════════════════════════════════════════════════════════════════
//  Kontorkalender — kva dagar kontoret har arbeidstid og kor mange timar
//  (claude/framdrift-modul.md, «Personell og timar»). Standard: 8 timar,
//  måndag–fredag; fri i STILLE VEKE i påska (måndag–fredag veka før
//  påskedag), på JULAFTEN og heile veka mellom julaften og nyttår
//  (24.–31. des.), og elles på norske helligdagar. Eigne fridagar/ferie kan
//  leggjast til. Oppsettet vert lagra per brukar (tabell kontor_kalender).
//
//  Denne kalenderen styrer TIMAR/kapasitet (timefordeling og overbelastning
//  i Framdrift). Sjølve planlegginga av datoar (framdriftDato.js) bruker
//  framleis berre norske helligdagar.
// ═══════════════════════════════════════════════════════════════════

export const STANDARD_KONTORKALENDER = {
  timarPerDag: 8,
  arbeidsdagar: [1, 2, 3, 4, 5],   // JS-vekedagar: 1 = måndag … 5 = fredag
  helligdagar: true,
  stilleVekePaaske: true,
  julaften: true,
  juleveka: true,                  // 24.–31. desember
  ekstraFri: [],                   // [{ fra:'2026-07-06', til:'2026-07-31', namn:'Sommarferie' }]
}

export const hentKalender = (innstillingar) => ({ ...STANDARD_KONTORKALENDER, ...(innstillingar || {}) })

const nokkel = (d) => format(d, 'yyyy-MM-dd')

// Fyrste (måndag) og siste (fredag) dag i stille veke for eit år.
export function stilleVeke(aar) {
  const p = paaskedag(aar)
  return { fra: addDays(p, -6), til: addDays(p, -2) }
}

// Årsaka til at kontoret er stengt/fri denne dagen (tekst), eller null om det er ein vanleg arbeidsdag.
export function fridagNamn(d, kal = STANDARD_KONTORKALENDER) {
  if (!kal.arbeidsdagar.includes(d.getDay())) return d.getDay() === 6 ? 'Laurdag' : d.getDay() === 0 ? 'Søndag' : 'Ikkje arbeidsdag'
  if (kal.helligdagar) { const h = helligdagNamn(d); if (h) return h }
  const m = d.getMonth(), dag = d.getDate()
  if (kal.julaften && m === 11 && dag === 24) return 'Julaften'
  if (kal.juleveka && m === 11 && dag >= 24 && dag <= 31) return 'Juleveka'
  if (kal.stilleVekePaaske) {
    const s = stilleVeke(d.getFullYear())
    if (d >= s.fra && d <= s.til) return 'Stille veke (påske)'
  }
  const k = nokkel(d)
  for (const f of kal.ekstraFri || []) if (f.fra && k >= f.fra && k <= (f.til || f.fra)) return f.namn || 'Fri'
  return null
}

// Arbeidstimar kontoret har på ein dag (0 på fridagar).
export function arbeidstimarForDag(d, kal = STANDARD_KONTORKALENDER) {
  return fridagNamn(d, kal) ? 0 : kal.timarPerDag
}

// Måndag i veka som inneheld `d`.
export const vekeStart = (d) => startOfWeek(d, { weekStartsOn: 1 })

// Arbeidstimar i ei veke (måndag–søndag) frå og med `fra` og til og med `til` (valfritt avgrensa).
export function arbeidstimarIVeke(mandag, kal = STANDARD_KONTORKALENDER, fra = null, til = null) {
  let sum = 0
  for (let i = 0; i < 7; i++) {
    const d = addDays(mandag, i)
    if (fra && d < fra) continue
    if (til && d > til) continue
    sum += arbeidstimarForDag(d, kal)
  }
  return sum
}

// Alle fridagar i eit år (kalenderdagar der kontoret ellers hadde hatt arbeidsdag
// eller helligdag), til oversikta i Prosjekt-modulen.
export function fridagarIAar(aar, kal = STANDARD_KONTORKALENDER) {
  const ut = []
  for (let d = new Date(aar, 0, 1); d.getFullYear() === aar; d = addDays(d, 1)) {
    const ve = d.getDay() === 0 || d.getDay() === 6
    const n = fridagNamn(d, kal)
    if (n && !(ve && (n === 'Laurdag' || n === 'Søndag'))) ut.push({ dato: new Date(d), namn: n })
  }
  return ut
}

export function arbeidsdagarOgTimarIAar(aar, kal = STANDARD_KONTORKALENDER) {
  let dagar = 0
  for (let d = new Date(aar, 0, 1); d.getFullYear() === aar; d = addDays(d, 1)) if (arbeidstimarForDag(d, kal) > 0) dagar++
  return { dagar, timar: dagar * kal.timarPerDag }
}

export const kapasitetPerVeke = (kal, prosent = 100) => (kal.timarPerDag * kal.arbeidsdagar.length * prosent) / 100
