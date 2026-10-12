// Same farge på ein person overalt i eit prosjekt (fordelingspanel, tidslinje, tabell, oversikt, Excel).
// Fargen følgjer plasseringa i prosjektet sin personellliste (Prosjekt → Personell); personar som ikkje står der
// (t.d. berre skrivne inn som «Ansvarleg») får ein stabil farge ut frå namnet.
export const PALETT = ['#0F766E', '#1565C0', '#B5296B', '#C2570C', '#6D28D9', '#8A6D00', '#0E7490', '#B91C1C', '#2D6A4F', '#7C3AED', '#D97706', '#475569']

export const personFargeKart = (personell) => {
  const kart = new Map()
  ;(personell || []).forEach((p, i) => { const k = (p.namn || '').trim().toLowerCase(); if (k && !kart.has(k)) kart.set(k, PALETT[i % PALETT.length]) })
  return kart
}

export function personFarge(namn, kart) {
  const k = (namn || '').trim().toLowerCase()
  const fastsett = kart?.get(k)
  if (fastsett) return fastsett
  let h = 0
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0
  return PALETT[h % PALETT.length]
}
