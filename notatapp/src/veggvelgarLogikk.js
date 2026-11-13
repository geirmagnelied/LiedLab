import data from './data/norgipsVeggtabell.json'
import { PLATE_ROBUSTHEIT, TILLEGG_FLEIRE_LAG, FUKTPLATER, RIB_GRENSE_MM, FAMILIE_ROBUSTHEIT_TILLEGG, PROFILNAMN } from './veggvelgarKonfig'

// ═══════════════════════════════════════════════════════════════════
//  Veggvelgar — rein logikk (ingen React): filtrerer og rangerer Norgips-radene mot krava.
//  Krav: { romtype:'innvendig'|'sjakt'|'vatrom', brann:0|30|60|90|120, lyd:dB (0 = ingen), lydMaal:'rw'|'rwC',
//          hogde:mm (0/null = ikkje oppgitt), robust:0..3, cf:boolean (tillat forsterkingsprofil CF), cc:'auto'|450|600 }
// ═══════════════════════════════════════════════════════════════════

export const VEGGDATA = data
export const ALLE_RADER = data.rader

export const robustPoeng = (r) => Math.min(3, (PLATE_ROBUSTHEIT[r.hovudplate] ?? 1) + (r.lagPerSide >= 2 ? TILLEGG_FLEIRE_LAG : 0) + (FAMILIE_ROBUSTHEIT_TILLEGG[r.familie] || 0))
export const erVatromRad = (r) => r.tillattePlater.some(p => FUKTPLATER.includes(p)) || FUKTPLATER.includes(r.hovudplate)

function romtypeOk(r, romtype) {
  if (romtype === 'sjakt') return !!r.sjakt                       // plater berre på éi side (0/x)
  if (romtype === 'vatrom') return !r.sjakt && erVatromRad(r)
  return !r.sjakt                                                // innvendig
}

// Brannklasse-oppføringar som oppfyller kravet. Raden kan ha to (t.d. EI 60 opp til 5000 mm, EI 30 opp til 6000 mm).
const brannKandidatar = (r, brann) => (brann > 0 ? r.brann.filter(b => b.ei >= brann) : [])

// Maks høgde (mm) for ein profil/c-c. Med brannkrav: lågaste av «EI klassifisert maks» og høgda utan brannkrav for c/c.
// CF-profil: EI-høgda kan rundast opp til næraste hele meter (Norgips).
function maksHogde(r, profil, cc, brann) {
  const utanEI = r.hogde[profil]?.['c' + cc]
  if (!(utanEI > 0)) return null
  if (!(brann > 0)) return { mm: utanEI, stjerne: false }
  const kand = brannKandidatar(r, brann)
  if (!kand.length) return null
  const best = kand.reduce((a, b) => (b.maks > a.maks ? b : a))
  const ei = profil === 'CF' ? Math.ceil(best.maks / 1000) * 1000 : best.maks
  return { mm: Math.min(ei, utanEI), stjerne: best.stjerne, eiBrann: best.ei }
}

// Alle (profil, c/c)-variantar for ei rad, i prioritert rekkjefølgje: dB+ c/c 600, dB+ c/c 450, CF c/c 600, CF c/c 450
const PROFILREKKJE = ['dB', 'CF', 'Tre', 'N', 'CFN']
function varianter(r, krav) {
  const ut = []
  for (const profil of PROFILREKKJE) {
    if (!r.hogde[profil] || (profil === 'CF' && !krav.cf)) continue
    for (const cc of [600, 450]) {
      if (krav.cc && krav.cc !== 'auto' && +krav.cc !== cc) continue
      const m = maksHogde(r, profil, cc, krav.brann)
      if (m) ut.push({ profil, cc, maks: m.mm, stjerne: m.stjerne, eiBrann: m.eiBrann })
    }
  }
  return ut
}

// Sjekkar éi rad. `hopp` = namn på eit krav som skal ignorerast (til flaskehals-analyse).
export function evaluerRad(r, krav, hopp = null) {
  const feil = []
  if (hopp !== 'materiale' && krav.materiale && krav.materiale !== 'alle' && r.materiale !== krav.materiale) feil.push('materiale')
  if (hopp !== 'romtype' && !romtypeOk(r, krav.romtype)) feil.push('romtype')
  if (hopp !== 'robust' && robustPoeng(r) < (krav.robust || 0)) feil.push('robust')
  if (hopp !== 'lyd' && krav.lyd > 0 && !((krav.lydMaal === 'rwC' ? r.rwC : r.rw) >= krav.lyd)) feil.push('lyd')
  if (hopp !== 'brann' && krav.brann > 0 && !brannKandidatar(r, krav.brann).length) feil.push('brann')
  const vars = varianter(r, hopp === 'brann' ? { ...krav, brann: 0 } : krav)
  let valt = null
  if (krav.hogde > 0) {
    valt = hopp === 'hogde' ? vars[0] || null : vars.find(v => v.maks >= krav.hogde) || null
    if (hopp !== 'hogde' && !valt) feil.push('hogde')
  } else valt = vars[0] || null
  return { ok: feil.length === 0, feil, variant: valt, varianter: vars }
}

// Merknader til ein treff
function merknader(r, krav, v) {
  const m = []
  if (v?.profil === 'CF') m.push('Krev forsterkingsprofil (CF).')
  if (r.materiale === 'tre') m.push('Trestender: høgdene er anbefalte for ikkje-bærande vegger.')
  if (r.familie === 'NailItSafety') m.push('Nail It Safety: sikkerheitsklasse 3 (RC4).')
  if (r.rwMerknad) m.push(r.rwMerknad)
  if (v && v.cc === 450) m.push('Krev stenderavstand c/c 450.')
  if (krav.brann > 0 && krav.hogde > RIB_GRENSE_MM && (r.familie === 'W115' || r.sjakt)) m.push('Høgde med brannkrav over 4 m: skal prosjekterast særskilt av RIB (Norgips).')
  else if (krav.brann > 0 && v?.stjerne) m.push('Høgda er avgrensa av NS-EN 15254-3 (merka * i Norgips-tabellen).')
  if (krav.brann > 0 && v?.maks && krav.hogde > 0 && v.profil === 'CF' && Math.ceil(v.maks / 1000) * 1000 !== v.maks) m.push('CF: EI-høgda er runda opp til hel meter (Norgips).')
  if (r.brann.length > 1) m.push('Radda har to brannklasse/høgde-par: ' + r.brann.map(b => 'EI ' + b.ei + ' opp til ' + b.maks + ' mm').join(', ') + '.')
  return m
}

export function foreslaVeggar(krav, rader = ALLE_RADER) {
  const treff = []
  for (const r of rader) {
    const e = evaluerRad(r, krav)
    if (!e.ok) continue
    const v = e.variant
    treff.push({ rad: r, variant: v, margin: krav.hogde > 0 && v ? v.maks - krav.hogde : null, robust: robustPoeng(r), merknader: merknader(r, krav, v) })
  }
  // Rangering: tynnast vegg, så færrast lag, så dB+ før CF, så c/c 600 før 450, så høgast lydreduksjon
  treff.sort((a, b) =>
    (a.rad.veggTjukkleik - b.rad.veggTjukkleik) || (a.rad.lagPerSide - b.rad.lagPerSide) ||
    ((a.variant?.profil === 'CF') - (b.variant?.profil === 'CF')) || ((b.variant?.cc || 0) - (a.variant?.cc || 0)) || ((b.rad.rw || 0) - (a.rad.rw || 0)))
  return treff
}

// Flaskehals: kor mange rader hadde vore med om eitt krav vart ignorert (for «ingen treff»-hjelp)
export function flaskehalsar(krav, rader = ALLE_RADER) {
  const namn = { materiale: 'Veggtype', romtype: 'Romtype', robust: 'Robustheit', lyd: 'Lydkrav', brann: 'Brannkrav', hogde: 'Romhøgde' }
  return Object.keys(namn).map(k => ({ krav: k, namn: namn[k], antal: rader.filter(r => evaluerRad(r, krav, k).ok).length })).filter(x => x.antal > 0).sort((a, b) => b.antal - a.antal)
}

export { PROFILNAMN }
export const kortKode = (r) => r.kode.replace(/\s+/g, ' ')
