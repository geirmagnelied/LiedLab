// ═══════════════════════════════════════════════════════════════════
//  «Påløpt innan» — avgrensing av kva påløpt tid (forbruk frå timeføringa) Framdrift-tabellen viser. Valet gjeld ein sluttdato:
//  { modus: 'alle' | 'dato' | 'veke' | 'manad', verdi: 'ÅÅÅÅ-MM-DD' | 'ÅÅÅÅ-Www' | 'ÅÅÅÅ-MM' }.
//  Veke = til og med søndagen i veka, månad = til og med siste dag i månaden. Timeføringar etter datoen vert ikkje teke med.
// ═══════════════════════════════════════════════════════════════════
const z = (n) => String(n).padStart(2, '0')
const isoFra = (d) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`

// ISO-vekas måndag
function mandagIVeke(aar, veke) {
  const jan4 = new Date(aar, 0, 4)
  const dag = jan4.getDay() || 7
  const mnd1 = new Date(aar, 0, 4 - (dag - 1))
  return new Date(mnd1.getFullYear(), mnd1.getMonth(), mnd1.getDate() + (veke - 1) * 7)
}

// → 'ÅÅÅÅ-MM-DD' (siste dag som tel med) eller null (ingen avgrensing / ugyldig)
export function palopSlutt(val) {
  if (!val || !val.verdi || val.modus === 'alle') return null
  if (val.modus === 'dato') return /^\d{4}-\d{2}-\d{2}$/.test(val.verdi) ? val.verdi : null
  if (val.modus === 'veke') {
    const m = /^(\d{4})-W(\d{2})$/.exec(val.verdi)
    if (!m) return null
    const mnd = mandagIVeke(+m[1], +m[2])
    return isoFra(new Date(mnd.getFullYear(), mnd.getMonth(), mnd.getDate() + 6))
  }
  if (val.modus === 'manad') {
    const m = /^(\d{4})-(\d{2})$/.exec(val.verdi)
    return m ? isoFra(new Date(+m[1], +m[2], 0)) : null
  }
  return null
}

export function palopTekst(val) {
  const slutt = palopSlutt(val)
  if (!slutt) return 'Alle datoar'
  const [y, m, d] = slutt.split('-')
  if (val.modus === 'veke') return 'veke ' + parseInt(val.verdi.slice(6), 10) + ' ' + val.verdi.slice(0, 4)
  if (val.modus === 'manad') return ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'][+m - 1] + ' ' + y
  return `${d}.${m}.${y}`
}
