// ── Felles konstantar for saksmodulen ────────────────────────────────
// Ligg i eiga fil slik at både SakerModule og SakerTabell kan bruke dei
// utan sirkulær import.

export const FAG = ['ARK', 'RIB', 'RIE', 'RIV', 'RIBr', 'Landskap', 'Anna']
export const TYPE = ['Prosjekteringsavvik', 'Grensesnitt', 'Spørsmål', 'Krev avklaring', 'Forslag']

export const STATUS_LABELS = { ny: 'Ny', arbeid: 'Under arbeid', kontroll: 'Til kontroll', lukka: 'Lukka' }
export const STATUS_ORDER  = ['ny', 'arbeid', 'kontroll', 'lukka']
export const STATUS_COLORS = { ny: '#1565C0', arbeid: '#B45309', kontroll: '#6D28D9', lukka: '#166534' }

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
