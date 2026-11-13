import { useId } from 'react'

// ═══════════════════════════════════════════════════════════════════
//  Veggvelgar — skjematisk snitt (plan) av ein vegg frå Norgips-rada.
//  Svarte strekar, gips med skravur, isolasjon med svakt gult fyll. Lengde 900 mm (stenderavstanden vert synleg).
//  Oppbygginga vert tolka frå `lagKode` (t.d. «1+UB13/UB13+1», «0/2xBRN») og er SKJEMATISK — mål følgjer Norgips-tabellen.
// ═══════════════════════════════════════════════════════════════════

export const VEGG_LENGDE = 900
const PLATE_MM = { STD: 12.5, HRD: 12.5, HB: 12.5, LB: 12.5, SIB: 12.5, SAB: 12.5, AQ: 12.5, BRN: 15, UB13: 12.5, UB15: 15.5 }

const siffer = (s) => { const m = String(s || '').replace(',', '.').match(/(\d+(?:\.\d+)?)(?!.*\d)/); return m ? +m[1] : null }

// Ei side av veggen (t.d. «2xBRN», «UB13+1», «0») → liste med lagtjukkleikar (mm), i teiknerekkjefølgje
function lagForSide(s, standard) {
  if (!s || s === '0') return []
  const ut = []
  for (const tok of s.split('+')) {
    let n = 1, plate = null
    let m
    if (/^\d+$/.test(tok)) { n = +tok; plate = null }
    else if ((m = tok.match(/^(\d+)x(.+)$/i))) { n = +m[1]; plate = m[2] }
    else if ((m = tok.match(/^(.+)x(\d+)$/i))) { n = +m[2]; plate = m[1] }
    else plate = tok
    for (let i = 0; i < n; i++) ut.push(plate ? (PLATE_MM[plate] || standard) : standard)
  }
  return ut
}

export function lagOppbygging(r) {
  const [a, b] = String(r.lagKode || '').split('/')
  const std = r.materiale === 'nailit' || /\+/.test(r.plateTjukkleik || '') ? 12.5 : (siffer(r.plateTjukkleik) || 12.5)
  const venstre = lagForSide(a, std), hogre = lagForSide(b, std)
  const sum = [...venstre, ...hogre].reduce((x, y) => x + y, 0)
  let kjerne = r.veggTjukkleik - sum
  if (!(kjerne >= 20)) kjerne = r.stenderBredde
  return { venstre, hogre, kjerne, total: sum + kjerne }
}

export const harIsolasjon = (r) => { const t = String(r.isolasjon || '').toUpperCase(); if (!t) return false; const tal = t.match(/\d+/g); return t === 'MR' || (tal ? tal.some(x => +x > 0) : false) }

// bredde: CSS-breidd på heile figuren (t.d. '90mm' eller 180). Høgda følgjer vegg-tjukkleiken.
export default function VeggTegning({ rad, cc = 600, bredde = 180 }) {
  const uid = useId().replace(/:/g, '')
  const L = VEGG_LENGDE
  const { venstre, hogre, kjerne } = lagOppbygging(rad)
  const T = venstre.reduce((x, y) => x + y, 0) + kjerne + hogre.reduce((x, y) => x + y, 0)
  const y0 = venstre.reduce((x, y) => x + y, 0), y1 = y0 + kjerne
  const ccV = +cc || 600
  const xs = [L / 2 - ccV / 2, L / 2 + ccV / 2]
  const dobbel = /D$/.test(rad.loysing)
  const tre = rad.materiale === 'tre'
  const isol = harIsolasjon(rad)
  const w = rad.stenderBredde
  const stenderY = dobbel ? [[y0, y0 + Math.min(w, kjerne / 2 - 5)], [y1 - Math.min(w, kjerne / 2 - 5), y1]] : [[y0, y1]]
  const lag = []
  let y = 0
  for (const t of venstre) { lag.push([y, t]); y += t }
  y += kjerne
  for (const t of hogre) { lag.push([y, t]); y += t }
  const stroke = { stroke: '#000', strokeWidth: 1.1, vectorEffect: 'non-scaling-stroke', fill: 'none' }
  const pad = 30
  const px = typeof bredde === 'number' ? bredde + 'px' : bredde

  return (
    <svg viewBox={`${-pad} ${-pad} ${L + 2 * pad} ${T + 2 * pad}`} style={{ width: px, height: 'auto', display: 'block', overflow: 'visible' }} role="img" aria-label={'Snitt ' + rad.kode}>
      <defs>
        <pattern id={'gips' + uid} width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="22" stroke="#000" strokeWidth="0.6" vectorEffect="non-scaling-stroke"/>
        </pattern>
      </defs>
      {isol && <rect x="0" y={y0} width={L} height={kjerne} fill="#FFF3B0"/>}
      {lag.map(([yy, t], i) => (<g key={i}><rect x="0" y={yy} width={L} height={t} fill={`url(#gips${uid})`}/><rect x="0" y={yy} width={L} height={t} {...stroke}/></g>))}
      {xs.map((x, i) => stenderY.map(([a, b], j) => tre
        ? <rect key={i + '-' + j} x={x - 24} y={a} width="48" height={b - a} fill="#fff" {...stroke}/>
        : <path key={i + '-' + j} d={`M${x + 38},${a + 10} V${a} H${x} V${b} H${x + 38} V${b - 10}`} {...stroke}/>))}
      {/* c/c-mål */}
      <line x1={xs[0]} y1={-12} x2={xs[1]} y2={-12} {...stroke} strokeWidth="0.7"/>
      <text x={L / 2} y={-18} fontSize="30" textAnchor="middle" fontFamily="sans-serif" fill="#000">c/c {ccV}</text>
    </svg>
  )
}

export const figurHogde = (rad, mmPerEining) => { const { total } = lagOppbygging(rad); return (total + 60) * mmPerEining }
