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

// ── Hierarki (13. okt. 2026): ein aktivitet kan vere SUMMASJONSAKTIVITET (har underaktivitetar, eller er markert
//    `summ: true`), på vilkårleg djupn. Fasar er alltid toppnivå. Datoane til ein summasjonsaktivitet med born vert
//    rekna ut frå borna (rullOpp), på same måte som for fasar. Milepælar kan ikkje ha born.
export const erSumm = (els, e) => !!e && e.type !== 'milepael' && (e.type === 'fase' || !!e.summ || harBorn(els, e.id))
// Ein «rulla» overordna har born (datoar følgjer borna)
export const erRulla = (els, e) => !!e && e.type !== 'milepael' && harBorn(els, e.id)

export function etterkommarar(els, id) {
  const ut = []
  const sett = new Set([id])
  const kø = [id]
  while (kø.length) {
    const p = kø.shift()
    for (const c of els) if (c.forelder === p && !sett.has(c.id)) { sett.add(c.id); ut.push(c); kø.push(c.id) }
  }
  return ut
}
export function forfedrar(els, id) {
  const ut = []
  let x = els.find(e => e.id === id)
  let vern = 0
  while (x && x.forelder != null && vern++ < 50) { x = els.find(e => e.id === x.forelder); if (x) ut.push(x) }
  return ut
}
export const nivåAv = (els, id) => forfedrar(els, id).length

const varigheit = (e) => arbeidsdagarMellom(tilDato(e.start), tilDato(e.slutt))

// ── Rull opp: fase-datoar frå barna, milepæl har alltid slutt = start ────
export function rullOpp(els) {
  let cur = els.map(e => (e.type === 'milepael' && e.slutt !== e.start ? { ...e, slutt: e.start } : e))
  const dyp = (e) => nivåAv(cur, e.id)
  const foreldre = cur.filter(e => e.type !== 'milepael' && harBorn(cur, e.id)).sort((a, b) => dyp(b) - dyp(a)) // djupast fyrst
  for (const f of foreldre) {
    const b = cur.filter(c => c.forelder === f.id)
    const st = b.reduce((m, c) => (c.start < m ? c.start : m), b[0].start)
    const sl = b.reduce((m, c) => (c.slutt > m ? c.slutt : m), b[0].slutt)
    if (st !== f.start || sl !== f.slutt) cur = cur.map(x => (x.id === f.id ? { ...x, start: st, slutt: sl } : x))
  }
  return cur
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
  if (erRulla(els, e)) {
    const dd = Math.round((tilDato(nyStart) - tilDato(e.start)) / 86400000)
    const barn = etterkommarar(els, e.id)
    const ider = new Set(barn.map(c => c.id))
    return { els: els.map(c => (ider.has(c.id) ? skyv(c, dd) : c)), endra: barn.map(c => c.id) }
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
        kø.push(s.id, ...r.endra, ...forfedrar(cur, s.id).map(f => f.id))
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
  if (erRulla(gml, e)) {
    const dd = Math.round((tilDato(start) - tilDato(e.start)) / 86400000)
    const barn = etterkommarar(gml, id)
    const ider = new Set(barn.map(c => c.id))
    cur = gml.map(c => (ider.has(c.id) ? skyv(c, dd) : c))
    endra.push(...barn.map(c => c.id))
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
  endra.push(...forfedrar(gml, id).map(f => f.id))
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
  if (forfedrar(els, id).some(f => f.id === predId) || forfedrar(els, predId).some(f => f.id === id)) return 'Ein overordna aktivitet kan ikkje vere avhengig av sine eigne underaktivitetar (og omvendt).'
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
  // Behald varigheita (tidlegare vart ho til 1 dag fordi `start` var overskriven før utrekninga)
  let slutt
  if (e.type === 'milepael') slutt = k
  else if (erRulla(med, e)) slutt = iso(addDays(tilDato(e.slutt), Math.round((tilDato(k) - tilDato(e.start)) / 86400000)))
  else slutt = iso(leggTilArbeidsdagar(tilDato(k), varigheit(e) - 1))
  return settElement(med, id, k, slutt, { beholdVarigheit: true })
}

export function fjernAvhengnad(els, id, predId) {
  return els.map(x => (x.id === id ? { ...x, avh: (x.avh || []).filter(a => a !== predId) } : x))
}

// ── Opprett / slett / rekkjefølgje ─────────────────────────────────────
export function slettElement(els, id) {
  const e = els.find(x => x.id === id)
  if (!e) return els
  const bort = new Set([id, ...etterkommarar(els, id).map(c => c.id)])
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

// Flat visingsrekkjefølgje (hierarki, vilkårleg djupn): toppnivå i rekkjefølgje, kvar fylgd av sine born (rekursivt).
// Samanfolda (lukka) overordna skjuler alle etterkommarane sine.
export function visingsrader(els, lukka) {
  const ut = []
  const sett = new Set()
  const gaa = (e, nivå) => {
    if (sett.has(e.id)) return
    sett.add(e.id)
    ut.push({ ...e, nivå })
    if (!lukka.has(e.id)) for (const c of els) if (c.forelder === e.id) gaa(c, nivå + 1)
  }
  for (const e of els) if (e.forelder == null) gaa(e, 0)
  return ut
}

// PNS-nivå (disposisjonsnummer 1, 1.1, 1.1.2 …) for kvart element ut frå plassering i hierarkiet. Map(id → «1.2.3»)
export function pnsKart(els) {
  const kart = new Map()
  const gaa = (forelder, prefiks) => {
    let i = 0
    for (const e of els) if ((e.forelder ?? null) === forelder) { i++; const n = prefiks ? prefiks + '.' + i : String(i); kart.set(e.id, n); gaa(e.id, n) }
  }
  gaa(null, '')
  return kart
}

// ── Endre hierarki ─────────────────────────────────────────────────────
// Flyttar `id` (med alle underaktivitetane sine) til ny plass: pos = 'for' | 'etter' (søsken til mål) | 'inni' (siste barn av mål, som
// då vert summasjonsaktivitet) | 'rot' (toppnivå, sist). Gjev uendra plan viss flyttinga ikkje er lov.
export function kanFlytteTil(els, id, malId, pos) {
  const e = els.find(x => x.id === id)
  if (!e) return false
  if (pos === 'rot') return true
  const m = els.find(x => x.id === malId)
  if (!m || m.id === id) return false
  if (etterkommarar(els, id).some(c => c.id === malId)) return false // ikkje inn i seg sjølv
  if (pos === 'inni') return m.type !== 'milepael' && e.type !== 'fase'
  if (e.type === 'fase') return (m.forelder ?? null) === null // fasar berre på toppnivå
  return true
}

export function flyttNode(els, id, malId, pos) {
  if (!kanFlytteTil(els, id, malId, pos)) return els
  const e = els.find(x => x.id === id)
  const m = els.find(x => x.id === malId)
  const nyForelder = pos === 'rot' ? null : pos === 'inni' ? m.id : (m.forelder ?? null)
  let ut = els.filter(x => x.id !== id)
  const flytta = { ...e, forelder: nyForelder }
  let idx
  if (pos === 'rot' || pos === 'inni') idx = ut.length
  else idx = ut.findIndex(x => x.id === malId) + (pos === 'etter' ? 1 : 0)
  ut = [...ut.slice(0, idx), flytta, ...ut.slice(idx)]
  if (pos === 'inni' && m.type === 'aktivitet' && !m.summ) ut = ut.map(x => (x.id === m.id ? { ...x, summ: true } : x))
  // Fjern avhengnader mellom det flytta elementet (og det som heng under) og dei nye overordna (og omvendt)
  const sub = new Set([id, ...etterkommarar(ut, id).map(c => c.id)])
  const fedre = new Set(forfedrar(ut, id).map(f => f.id))
  ut = ut.map(x => {
    if (sub.has(x.id)) return { ...x, avh: (x.avh || []).filter(a => !fedre.has(a)) }
    if (fedre.has(x.id)) return { ...x, avh: (x.avh || []).filter(a => !sub.has(a)) }
    return x
  })
  return rullOpp(ut)
}

// Innrykk: blir underaktivitet av førre søsken (som då vert summasjonsaktivitet). Utrykk: eit nivå opp, rett etter overordna.
export function innrykk(els, id) {
  const e = els.find(x => x.id === id)
  if (!e || e.type === 'fase') return els
  const sosken = els.filter(x => (x.forelder ?? null) === (e.forelder ?? null))
  const i = sosken.findIndex(x => x.id === id)
  for (let j = i - 1; j >= 0; j--) if (sosken[j].type !== 'milepael') return flyttNode(els, id, sosken[j].id, 'inni')
  return els
}
export function utrykk(els, id) {
  const e = els.find(x => x.id === id)
  if (!e || e.forelder == null) return els
  return flyttNode(els, id, e.forelder, 'etter')
}

// Marker/opphev summasjonsaktivitet. Opphev: underaktivitetane flyttar opp eit nivå (rett etter den som vart oppheva).
export function settSumm(els, id, pa) {
  const e = els.find(x => x.id === id)
  if (!e || e.type !== 'aktivitet') return els
  if (pa) return els.map(x => (x.id === id ? { ...x, summ: true } : x))
  let ut = els.map(x => (x.id === id ? { ...x, summ: false } : x))
  const born = ut.filter(c => c.forelder === id)
  for (const c of [...born].reverse()) ut = flyttNode(ut, c.id, id, 'etter')
  return rullOpp(ut)
}

// Gyldige overordna for `id` (til «Overordna»-nedtrekk): ikkje seg sjølv/etterkommarar, ikkje milepælar
export const moglegeForeldre = (els, id) => els.filter(x => x.type !== 'milepael' && kanFlytteTil(els, id, x.id, 'inni'))

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
