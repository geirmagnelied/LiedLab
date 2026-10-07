import { addDays } from 'date-fns'
import { iso, tilDato, nesteArbeidsdag, forrigeArbeidsdag, leggTilArbeidsdagar, arbeidsdagarMellom } from './framdriftDato'

// ═══════════════════════════════════════════════════════════════════
//  Datamodell og planlogikk for Framdrift-modulen (claude/framdrift-modul.md).
//  Reine funksjonar utan React/Supabase — ein plan er ei flat liste:
//
//    { id, type:'fase'|'aktivitet'|'milepael', namn, start, slutt  (ISO-tekst),
//      forelder: fase-id | null,   // berre aktivitet/milepæl kan ha ei fase over seg
//      avh: [id],                  // «startar når desse er ferdige» (slutt → start)
//      ansvarleg, ferdig (0–100), fasekode ('01'–'05', berre fase) }
//
//  • Ei fase MED aktivitetar under seg har datoar som vert rekna ut frå dei
//    (rullOpp) og kan berre flyttast som ei heil gruppe.
//  • Avhengnad er eit MINIMUMSKRAV: ein aktivitet kan ikkje starte før alle
//    føregangarane er ferdige. Låg han «stram» (starta dagen etter) fylgjer
//    han føregangaren begge vegar; elles vert han berre skubba når han
//    ville ha starta for tidleg. Ingen kritisk line, ingen ressursnivellering.
//  • Varigheit vert rekna i arbeidsdagar (ikkje helg/heilagdag).
// ═══════════════════════════════════════════════════════════════════

let sistId = 0
export function nyId() {
  const t = Date.now() * 1000
  sistId = t > sistId ? t : sistId + 1
  return sistId
}

export const harBorn = (els, id) => els.some(e => e.forelder === id)

const varigheit = (e) => arbeidsdagarMellom(tilDato(e.start), tilDato(e.slutt))

// ── Rull opp: fase-datoar frå barna, milepæl har alltid slutt = start ────
export function rullOpp(els) {
  return els.map(e => {
    if (e.type === 'milepael' && e.slutt !== e.start) return { ...e, slutt: e.start }
    if (e.type === 'fase') {
      const b = els.filter(c => c.forelder === e.id)
      if (b.length) {
        const st = b.reduce((m, c) => (c.start < m ? c.start : m), b[0].start)
        const sl = b.reduce((m, c) => (c.slutt > m ? c.slutt : m), b[0].slutt)
        if (st !== e.start || sl !== e.slutt) return { ...e, start: st, slutt: sl }
      }
    }
    return e
  })
}

// Tidlegaste lovlege start for `e` ut frå føregangarane (ISO), eller null.
export function krav(els, e) {
  const ps = (e.avh || []).map(id => els.find(x => x.id === id)).filter(Boolean)
  if (!ps.length) return null
  const maks = ps.reduce((m, p) => (p.slutt > m ? p.slutt : m), ps[0].slutt)
  return iso(nesteArbeidsdag(addDays(tilDato(maks), 1)))
}

// Nye datoar for eit element ved dra-og-slepp: modus 'flytt' | 'start' | 'slutt',
// `d` = tal kalenderdagar mus er dratt. Brukt både til førehandsvising og lagring.
export function beregnDatoar(e, modus, d) {
  const st = tilDato(e.start)
  const sl = tilDato(e.slutt)
  if (modus === 'flytt' || e.type === 'milepael') {
    const ns = nesteArbeidsdag(addDays(st, d))
    if (e.type === 'milepael') return { start: iso(ns), slutt: iso(ns) }
    return { start: iso(ns), slutt: iso(leggTilArbeidsdagar(ns, varigheit(e) - 1)) }
  }
  if (modus === 'start') {
    const ns = nesteArbeidsdag(addDays(st, d))
    return { start: iso(ns), slutt: ns > sl ? iso(ns) : e.slutt }
  }
  const ns = forrigeArbeidsdag(addDays(sl, d))
  return { start: e.start, slutt: ns < st ? e.start : iso(ns) }
}

// Skyv eit element `dd` kalenderdagar (behald varigheit i arbeidsdagar).
function skyv(e, dd) {
  const r = beregnDatoar(e, 'flytt', dd)
  return { ...e, ...r }
}

// Flytt `e` til ny start (behald varigheit). For ei fase med born: skyv alle barna.
function flyttTil(els, e, nyStart) {
  if (e.type === 'fase' && harBorn(els, e.id)) {
    const dd = Math.round((tilDato(nyStart) - tilDato(e.start)) / 86400000)
    const barn = els.filter(c => c.forelder === e.id)
    return { els: els.map(c => (c.forelder === e.id ? skyv(c, dd) : c)), endra: barn.map(c => c.id) }
  }
  const ns = tilDato(nyStart)
  const slutt = e.type === 'milepael' ? nyStart : iso(leggTilArbeidsdagar(ns, varigheit(e) - 1))
  return { els: els.map(c => (c.id === e.id ? { ...c, start: nyStart, slutt } : c)), endra: [] }
}

// Spreier endringar til dei som kjem etter (avhengnader), frå `endraIds`.
// `gml` = planen FØR redigeringa (for å vite om ein etterfylgjar var «stram»).
export function propager(gml, ny, endraIds) {
  let cur = ny
  const kø = [...endraIds]
  let teller = 0
  while (kø.length && teller++ < 3000) {
    const id = kø.shift()
    for (const s0 of cur.filter(e => (e.avh || []).includes(id))) {
      const s = cur.find(e => e.id === s0.id)
      const nyKrav = krav(cur, s)
      const gS = gml.find(e => e.id === s.id)
      const gKrav = gS ? krav(gml, gS) : null
      let mål = null
      if (nyKrav) {
        if (gKrav && s.start === gKrav) mål = nyKrav
        else if (s.start < nyKrav) mål = nyKrav
      }
      if (mål && mål !== s.start) {
        const r = flyttTil(cur, s, mål)
        cur = rullOpp(r.els)
        kø.push(s.id, ...r.endra)
        if (s.forelder) kø.push(s.forelder)
      }
    }
  }
  return cur
}

// Set nye datoar på eit element og spreie endringa. `beholdVarigheit`: ved
// samanstøyt med ein føregangar vert starten klemd fram og slutten flytta med.
export function settElement(gml, id, start, slutt, { beholdVarigheit = false } = {}) {
  const e = gml.find(x => x.id === id)
  if (!e) return gml
  const endra = [id]
  let cur
  if (e.type === 'fase' && harBorn(gml, id)) {
    const dd = Math.round((tilDato(start) - tilDato(e.start)) / 86400000)
    cur = gml.map(c => (c.forelder === id ? skyv(c, dd) : c))
    endra.push(...gml.filter(c => c.forelder === id).map(c => c.id))
  } else {
    let ns = start
    let sl = slutt
    const k = krav(gml, e)
    if (k && ns < k) {
      const wd = arbeidsdagarMellom(tilDato(start), tilDato(slutt < start ? start : slutt))
      ns = k
      sl = beholdVarigheit ? iso(leggTilArbeidsdagar(tilDato(k), wd - 1)) : (sl < k ? k : sl)
    }
    if (e.type === 'milepael') sl = ns
    if (sl < ns) sl = ns
    cur = gml.map(x => (x.id === id ? { ...x, start: ns, slutt: sl } : x))
  }
  cur = rullOpp(cur)
  if (e.forelder) endra.push(e.forelder)
  return propager(gml, cur, endra)
}

// ── Avhengnader ─────────────────────────────────────────────────────────
function girSyklus(els, id, predId) {
  if (id === predId) return true
  const sett = new Set()
  const gaa = (x) => {
    if (x === id) return true
    if (sett.has(x)) return false
    sett.add(x)
    const e = els.find(y => y.id === x)
    return (e?.avh || []).some(gaa)
  }
  return gaa(predId)
}

// Kan `predId` vere føregangar til `id`? Gjev feilmelding (tekst) eller null.
export function avhengnadFeil(els, id, predId) {
  const e = els.find(x => x.id === id)
  const p = els.find(x => x.id === predId)
  if (!e || !p) return 'Fann ikkje elementet.'
  if ((e.avh || []).includes(predId)) return 'Avhengnaden finst alt.'
  if (e.forelder === predId || p.forelder === id) return 'Ei fase kan ikkje vere avhengig av sine eigne aktivitetar.'
  if (girSyklus(els, id, predId)) return 'Avhengnaden ville laga ein sirkel.'
  return null
}

// Legg til «id startar når predId er ferdig» og flytt id til dagen etter.
export function leggTilAvhengnad(els, id, predId) {
  if (avhengnadFeil(els, id, predId)) return els
  const med = els.map(x => (x.id === id ? { ...x, avh: [...(x.avh || []), predId] } : x))
  const e = med.find(x => x.id === id)
  const k = krav(med, e)
  if (!k) return med
  const ny = beregnDatoar({ ...e, start: k }, 'flytt', 0)
  return settElement(med, id, ny.start, ny.slutt, { beholdVarigheit: true })
}

export function fjernAvhengnad(els, id, predId) {
  return els.map(x => (x.id === id ? { ...x, avh: (x.avh || []).filter(a => a !== predId) } : x))
}

// ── Opprett / slett / rekkjefølgje ─────────────────────────────────────
export function slettElement(els, id) {
  const e = els.find(x => x.id === id)
  if (!e) return els
  const bort = new Set([id, ...(e.type === 'fase' ? els.filter(c => c.forelder === id).map(c => c.id) : [])])
  return rullOpp(els.filter(x => !bort.has(x.id)).map(x => ({ ...x, avh: (x.avh || []).filter(a => !bort.has(a)) })))
}

// Bytt plass med næraste søsken (dir = -1 opp, +1 ned) innanfor same forelder.
export function flyttRekkjefolgje(els, id, dir) {
  const e = els.find(x => x.id === id)
  if (!e) return els
  const søsken = els.filter(x => (x.forelder ?? null) === (e.forelder ?? null))
  const i = søsken.findIndex(x => x.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= søsken.length) return els
  const a = els.findIndex(x => x.id === id)
  const b = els.findIndex(x => x.id === søsken[j].id)
  const ut = [...els]
  ;[ut[a], ut[b]] = [ut[b], ut[a]]
  return ut
}

// Flat visingsrekkjefølgje: toppnivå-element i rekkjefølgje, kvar fase fylgd av sine born.
export function visingsrader(els, lukka) {
  const ut = []
  for (const e of els) {
    if (e.forelder != null) continue
    ut.push({ ...e, nivå: 0 })
    if (e.type === 'fase' && !lukka.has(e.id)) {
      for (const c of els) if (c.forelder === e.id) ut.push({ ...c, nivå: 1 })
    }
  }
  return ut
}

export const FASEKODAR = [
  { kode: '01', namn: 'Skisseprosjekt' },
  { kode: '02', namn: 'Forprosjekt' },
  { kode: '03', namn: 'Tilbodsteikning' },
  { kode: '04', namn: 'Søknadsteikning' },
  { kode: '05', namn: 'Detaljprosjekt' },
]

export function nyttElement(type, { start, forelder = null, namn } = {}) {
  const s = nesteArbeidsdag(start || new Date())
  const slutt = type === 'milepael' ? s : leggTilArbeidsdagar(s, type === 'fase' ? 9 : 4)
  return {
    id: nyId(), type, namn: namn || (type === 'fase' ? 'Ny fase' : type === 'milepael' ? 'Ny milepæl' : 'Ny aktivitet'),
    start: iso(s), slutt: iso(slutt), forelder, avh: [], ansvarleg: '', ferdig: 0, fasekode: '', timar: 0, fordeling: 'fast',
  }
}

// Byggjer element frå ein mal (framdriftMalar.js) frå `startIso`, i kjede:
// kvar aktivitet/milepæl startar når førre aktivitet er ferdig.
export function byggFraMal(mal, startIso) {
  const ut = []
  let markør = nesteArbeidsdag(tilDato(startIso))
  let forrigeAkt = null
  for (const fase of mal.fasar) {
    const f = { id: nyId(), type: 'fase', namn: fase.namn, start: iso(markør), slutt: iso(markør),
      forelder: null, avh: [], ansvarleg: '', ferdig: 0, fasekode: fase.fasekode || '' }
    ut.push(f)
    for (const it of fase.element) {
      const s = markør
      if (it.type === 'milepael') {
        ut.push({ id: nyId(), type: 'milepael', namn: it.namn, start: iso(s), slutt: iso(s), forelder: f.id,
          avh: forrigeAkt ? [forrigeAkt] : [], ansvarleg: '', ferdig: 0, fasekode: '' })
        continue
      }
      const slutt = leggTilArbeidsdagar(s, Math.max(1, it.varig) - 1)
      const el = { id: nyId(), type: 'aktivitet', namn: it.namn, start: iso(s), slutt: iso(slutt), forelder: f.id,
        avh: forrigeAkt ? [forrigeAkt] : [], ansvarleg: it.ansvarleg || '', ferdig: 0, fasekode: '' }
      ut.push(el)
      forrigeAkt = el.id
      markør = nesteArbeidsdag(addDays(slutt, 1))
    }
  }
  return rullOpp(ut)
}

export const antalArbeidsdagar = varigheit
