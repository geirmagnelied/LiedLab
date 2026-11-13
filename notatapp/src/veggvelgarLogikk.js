import data from './data/norgipsVeggtabell.json'
import { PLATE_ROBUSTHEIT, TILLEGG_FLEIRE_LAG, FUKTPLATER, RIB_GRENSE_MM, FAMILIE_ROBUSTHEIT_TILLEGG, PROFILNAMN, BREDDEGRUPPER } from './veggvelgarKonfig'

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
  if (hopp !== 'bredde' && krav.bredder?.length && !krav.bredder.some(n => BREDDEGRUPPER.find(g => g.namn === n)?.verdiar.includes(r.stenderBredde))) feil.push('bredde')
  if (hopp !== 'stender' && krav.stender && krav.stender !== 'alle' && (krav.stender === 'enkel') !== /E$/.test(r.loysing)) feil.push('stender')
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
  const namn = { materiale: 'Veggtype', bredde: 'Stenderbreidd', stender: 'Enkel/dobbel stender', romtype: 'Romtype', robust: 'Robustheit', lyd: 'Lydkrav', brann: 'Brannkrav', hogde: 'Romhøgde' }
  return Object.keys(namn).map(k => ({ krav: k, namn: namn[k], antal: rader.filter(r => evaluerRad(r, krav, k).ok).length })).filter(x => x.antal > 0).sort((a, b) => b.antal - a.antal)
}

// ── Vurdering av ein vegg lagra på prosjekt mot krava brukaren har skrive inn (pk = { tjukkleik (maks), brann, lyd, hogde, robust }) ──
export const maksEI = (r) => r.brann.reduce((m, b) => Math.max(m, b.ei), 0)
export function vurderVegg(r, pk = {}, variant = null) {
  const brann = +pk.brann || 0
  let v = null
  if (variant) { const m = maksHogde(r, variant.profil, variant.cc, brann); if (m) v = { ...variant, maks: m.mm } }
  if (!v) v = varianter(r, { brann, cf: true, cc: 'auto' }).sort((a, b) => b.maks - a.maks)[0] || null
  const verdi = { tjukkleik: r.veggTjukkleik, brann: maksEI(r), rw: r.rw, hogde: v ? v.maks : null, robust: robustPoeng(r), variant: v }
  const adv = [], felt = {}
  const slaa = (k, tekst) => { adv.push(tekst); felt[k] = true }
  if (+pk.tjukkleik > 0 && r.veggTjukkleik > +pk.tjukkleik) slaa('tjukkleik', 'Veggen er ' + r.veggTjukkleik + ' mm, krav maks ' + pk.tjukkleik + ' mm.')
  if (brann > 0 && maksEI(r) < brann) slaa('brann', 'Krav EI ' + brann + ' er strengare enn veggen (EI ' + maksEI(r) + ').')
  if (+pk.lyd > 0 && !(r.rw >= +pk.lyd)) slaa('rw', "Krav R'w " + pk.lyd + ' dB er strengare enn veggen (' + (r.rw ?? '–') + ' dB).')
  if (+pk.hogde > 0 && !(brann > 0 && maksEI(r) < brann) && (!v || v.maks < +pk.hogde)) slaa('hogde', 'Krav romhøgde ' + pk.hogde + ' mm er over maks høgde' + (v ? ' (' + v.maks + ' mm)' : '') + (brann > 0 ? ' med EI ' + brann : '') + '.')
  if (+pk.robust > 0 && verdi.robust < +pk.robust) slaa('robust', 'Krav til robustheit er strengare enn veggen.')
  return { verdi, adv, felt }
}

export { PROFILNAMN }
export const kortKode = (r) => r.kode.replace(/\s+/g, ' ')
