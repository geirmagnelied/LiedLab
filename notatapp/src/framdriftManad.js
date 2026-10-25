// ═══════════════════════════════════════════════════════════════════
//  Månadsvisinga i Framdrift: timane ligg vekesvis, så ei veke som går over to månader vert fordelt på begge månadene etter kor mange
//  ARBEIDSTIMAR kontorkalenderen har på dagane i kvar månad (fridagar, helgar og helligdagar tel ikkje). Ei veke heilt innanfor
//  éin månad går uendra til den månaden. Fordelinga gjeld både planlagde og påløpte timar (og honorar rekna frå dei).
// ═══════════════════════════════════════════════════════════════════
import { addDays, format } from 'date-fns'
import { arbeidstimarForDag } from './kontorkalender'
import { tilDato } from './framdriftDato'

// mandag (ÅÅÅÅ-MM-DD) → [['ÅÅÅÅ-MM', andel 0–1], …] (andelane summerer til 1)
export function manadDelar(mandagIso, kal) {
  const d0 = tilDato(mandagIso)
  const timar = new Map(), dagar = new Map()
  let tot = 0
  for (let i = 0; i < 7; i++) {
    const d = addDays(d0, i)
    const m = format(d, 'yyyy-MM')
    const t = arbeidstimarForDag(d, kal)
    timar.set(m, (timar.get(m) || 0) + t); tot += t
    dagar.set(m, (dagar.get(m) || 0) + 1)
  }
  if (tot > 0) return [...timar].filter(([, t]) => t > 0).map(([m, t]) => [m, t / tot])
  return [...dagar].map(([m, n]) => [m, n / 7])   // heil fridagsveke: fordel etter kalenderdagar
}

const MND = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']
export const manadNamn = (m) => { const [y, mm] = m.split('-'); return { aar: y, kort: MND[+mm - 1] } }
