// ── Felles konstantar for saksmodulen ────────────────────────────────
// Ligg i eiga fil slik at både SakerModule og SakerTabell kan bruke dei
// utan sirkulær import.

export const FAG = ['ARK', 'RIB', 'RIE', 'RIV', 'RIBr', 'Landskap', 'Anna']
export const TYPE = ['Prosjekteringsavvik', 'Grensesnitt', 'Spørsmål', 'Krev avklaring', 'Forslag']

// Berre tre statusar: Registrert (raud), Påbegynt (gul), Lukka (grøn). Eldre «kontroll» vert vist som Påbegynt.
export const STATUS_LABELS = { ny: 'Registrert', arbeid: 'Påbegynt', lukka: 'Lukka' }
export const STATUS_ORDER  = ['ny', 'arbeid', 'lukka']
export const STATUS_COLORS = { ny: '#C62828', arbeid: '#B7791F', lukka: '#2E7D32' }
export const normaliserStatus = (s) => (s === 'kontroll' ? 'arbeid' : s)

// Ligg datoen (yyyy-mm-dd) i denne veka (måndag–søndag) / denne månaden?
export function fristIPeriode(iso, periode) {
  if (!iso) return false
  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00'), no = new Date()
  if (periode === 'manad') return d.getFullYear() === no.getFullYear() && d.getMonth() === no.getMonth()
  const start = new Date(no.getFullYear(), no.getMonth(), no.getDate() - ((no.getDay() + 6) % 7))
  const slutt = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59)
  return d >= start && d <= slutt
}

export const PRIO_LABELS = { lav: 'Lav', normal: 'Normal', hoog: 'Høg', kritisk: 'Kritisk' }
export const PRIO_ORDER  = ['kritisk', 'hoog', 'normal', 'lav']
export const PRIO_COLORS = { lav: '#6B7280', normal: '#6B7280', hoog: '#B45309', kritisk: '#B91C1C' }

// ── Saksnummer ───────────────────────────────────────────────────────
// Saksnummeret er berre eit tal. Eldre saker kan liggje lagra som
// «K-1234-007» — då plukkar vi ut talet på slutten, slik at gamle og nye
// saker blir viste likt utan at noko må skrivast om i databasen.
export function caseNoValue(number) {
  const m = String(number ?? '').match(/(\d+)\s*$/)
  return m ? parseInt(m[1], 10) : NaN
}
export function caseNoText(number) {
  const n = caseNoValue(number)
  return isNaN(n) ? String(number ?? '') : String(n)
}

export function fmtDateShort(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
