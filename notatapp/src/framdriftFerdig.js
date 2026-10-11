import { antalArbeidsdagar as varigheit } from './framdriftLogikk'

// ═══════════════════════════════════════════════════════════════════
//  Framdrift frå leveransar (DTM). Ein aktivitet kan ha kopla til
//  dokument/teikningar (`leveransar: [dtm_dokumenter.id]`). Då kan
//  framdrifta (ferdig-prosenten) reknast ut frå «Ferdigstillelse» på
//  dokumenta i DTM:
//    – viss ALLE kopla dokument har eit timebudsjett > 0, vert snittet vekta
//      med timebudsjettet (store teikningar tel meir);
//    – elles er det eit vanleg snitt.
//  `ferdigModus`: 'auto' (frå leveransar, standard når det finst kopla
//  leveransar) eller 'skjonn' (brukaren sitt eige tal i `ferdig`, overstyrer).
// ═══════════════════════════════════════════════════════════════════

// → { prosent: 0–100 | null, antal, funne, manglar, vekta }
export function leveransarFerdig(el, dokMap) {
  const ids = el.leveransar || []
  const dok = ids.map(id => dokMap?.get(id)).filter(Boolean)
  if (!dok.length) return { prosent: null, antal: ids.length, funne: 0, manglar: ids.length, vekta: false }
  const pros = d => Math.max(0, Math.min(100, Number(d.ferdigstillelse) || 0))
  const vekta = dok.every(d => Number(d.timebudsjett) > 0)
  let prosent
  if (vekta) {
    const sum = dok.reduce((a, d) => a + Number(d.timebudsjett), 0)
    prosent = dok.reduce((a, d) => a + pros(d) * Number(d.timebudsjett), 0) / sum
  } else {
    prosent = dok.reduce((a, d) => a + pros(d), 0) / dok.length
  }
  return { prosent: Math.round(prosent), antal: ids.length, funne: dok.length, manglar: ids.length - dok.length, vekta }
}

export const brukarAuto = (el, dokMap) =>
  el.type === 'aktivitet' && (el.leveransar || []).length > 0 && el.ferdigModus !== 'skjonn' && leveransarFerdig(el, dokMap).prosent != null

// Gjeldande framdrift (0–100) for ein aktivitet
export function effektivFerdig(el, dokMap) {
  if (brukarAuto(el, dokMap)) return leveransarFerdig(el, dokMap).prosent
  return el.ferdig || 0
}

// Framdrift for ei fase: snitt av aktivitetane, vekta med arbeidsdagar
export function faseFerdig(elementer, fase, dokMap) {
  const born = elementer.filter(e => e.forelder === fase.id && e.type === 'aktivitet')
  if (!born.length) return 0
  const dagar = born.map(b => Math.max(1, varigheit(b)))
  const sum = dagar.reduce((a, b) => a + b, 0)
  return Math.round(born.reduce((a, b, i) => a + effektivFerdig(b, dokMap) * dagar[i], 0) / sum)
}
