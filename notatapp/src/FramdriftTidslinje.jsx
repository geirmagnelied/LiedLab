import { useState, useMemo, useRef, useEffect } from 'react'
import { addDays, differenceInCalendarDays, startOfWeek, endOfWeek, getISOWeek, format } from 'date-fns'
import { nb } from 'date-fns/locale'
import { helligdagNamn } from './helligdagar'
import { tilDato, formaterDato } from './framdriftDato'
import { beregnDatoar, harBorn, avhengnadFeil, forfedrar, erSumm, kanFlytteTil } from './framdriftLogikk'
import { effektivFerdig, faseFerdig } from './framdriftFerdig'
import { fordelTimar, personDelar, snittpris, prisFor } from './framdriftTimar'
import { manadDelar } from './framdriftManad'
import { personFarge } from './personFarge'
import { personerMedForbruk, faktiskFor, nokkelNamn } from './framdriftForbruk'
import { KOLONNE_DEF, bygVerdiar, REDIGERBARE, BTYPAR, kpiFarge } from './framdriftVerdiar'
import { mjukBindestrek } from './DataTabell'

// ═══════════════════════════════════════════════════════════════════
//  Tidslinja (Gantt) i Framdrift-modulen — sjå claude/framdrift-modul.md.
//  Éin scrollflate: namnekolonna til venstre og vekeoverskrifta øvst er
//  «klistra» (position:sticky) slik at ein alltid ser kva rad/veke ein er
//  på. Dra i midten av ein stolpe for å flytte, i kantane for å endre
//  lengde (eigendefinert musehandtering på window, same mønster som resten
//  av appen). Sjølve datoendringa (inkl. avhengnader) skjer i overordna
//  modul via `onEndre` — her vert berre ei førehandsvising vist under draget.
// ═══════════════════════════════════════════════════════════════════

const RAD_H = 34
const NAMN_STD = 300 // standardbreidd på namnekolonna; brukaren kan dra ho (og kvar kolonne) breiare/smalare
const DAGB = { dag: 30, veke: 14, manad: 5, kvartal: 2.2 }
const FASEFARGAR = ['#2D6A4F', '#1565C0', '#B5296B', '#C2570C', '#0E7490', '#6D28D9', '#8A6D00']
const NEUTRAL = '#475569'
const FRIST_FARGE = '#B45309'
const MOTE_FARGE = '#1565C0'
const VALG_FARGE = '#1E3A8A'

export default function FramdriftTidslinje({ delsummer = false, skala = 1, valde, verktoy, rader, elementer, valgt, onVelg, onEndre, hendingar, visHendingar,
                                              zoom, lukka, onToggleLukka, timarKart, overlast, visTimar, dokMap, onKoble, onFjernAvh, kal, utvida, onToggleUtvida, onFlyttHierarki, fargeKart, prisar, forbrukKart, onEndreFelt, personell }) {
  const manadSum = zoom === 'manadsum'   // «Månad»: tidslinje med månadssummar (timar og påløpt honorar) — «Månad+» er den gamle månadsvisinga med vekenummer
  const dagB = (DAGB[manadSum ? 'manad' : zoom] || DAGB.veke) * skala
  // Ekstrakolonnar i tabellen til venstre for tidslinja (høgreklikk på overskrifta). Val vert hugsa på denne maskina.
  const STANDARD_KOL = ['kode', 'start', 'slutt', 'ansvarleg', 'ferdig', 'kpi', 'timar', 'budsjett', 'timerate']
  const [valgteKol, setValgteKol] = useState(() => { try { const v = JSON.parse(localStorage.getItem('liedlab-framdrift-tl-kol-v3')); return Array.isArray(v) ? v : STANDARD_KOL } catch { return STANDARD_KOL } })
  const lagreKol = (n) => { setValgteKol(n); try { localStorage.setItem('liedlab-framdrift-tl-kol-v3', JSON.stringify(n)) } catch { /* privat modus */ } }
  const [kolMeny, setKolMeny] = useState(null) // { x, y }
  const [persTotOpen, setPersTotOpen] = useState(false)
  const kolDefs = valgteKol.map(k => KOLONNE_DEF.find(d => d.key === k)).filter(Boolean)
  // Breidder (dratt av brukaren): namnekolonna + kvar ekstrakolonne
  const [namnB, setNamnB] = useState(() => { try { const v = +localStorage.getItem('liedlab-framdrift-tl-namnb'); return v >= 140 ? v : NAMN_STD } catch { return NAMN_STD } })
  const [kolB, setKolB] = useState(() => { try { return JSON.parse(localStorage.getItem('liedlab-framdrift-tl-kolb')) || {} } catch { return {} } })
  const NAMN_B = namnB
  const kb = (d) => kolB[d.key] ?? d.w
  const VENSTRE = NAMN_B + kolDefs.reduce((a, d) => a + kb(d), 0)
  const [redigerer, setRedigerer] = useState(null) // { id, key } — celle i redigering (dobbeltklikk)
  const startKolResize = (ev, key, bredde0) => {
    ev.preventDefault(); ev.stopPropagation()
    const x0 = ev.clientX
    let siste = bredde0
    const mv = (e2) => {
      siste = Math.max(key === '__namn' ? 140 : 44, Math.min(900, Math.round(bredde0 + (e2.clientX - x0))))
      key === '__namn' ? setNamnB(siste) : setKolB(b => ({ ...b, [key]: siste }))
    }
    const opp = () => {
      window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', opp); document.body.style.cursor = ''
      try { if (key === '__namn') localStorage.setItem('liedlab-framdrift-tl-namnb', String(siste)); else setKolB(b => { localStorage.setItem('liedlab-framdrift-tl-kolb', JSON.stringify(b)); return b }) } catch { /* privat modus */ }
    }
    document.body.style.cursor = 'col-resize'
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', opp)
  }
  const handtak = (key, b) => (
    <div onMouseDown={e => startKolResize(e, key, b)} onDoubleClick={e => { e.stopPropagation(); key === '__namn' ? setNamnB(NAMN_STD) : setKolB(x => { const n = { ...x }; delete n[key]; return n }) }}
      title="Dra for å endre breidda (dobbeltklikk = standard)"
      style={{ position: 'absolute', right: -3, top: 0, bottom: 0, width: 7, cursor: 'col-resize', zIndex: 12 }}/>
  )
  const verdiar = useMemo(() => bygVerdiar({ elementer, dokMap, prisar }), [elementer, dokMap, prisar])
  useEffect(() => {
    if (!kolMeny) return
    const lukk = (e) => { if (!e.target.closest?.('[data-kolmeny]')) setKolMeny(null) }
    document.addEventListener('mousedown', lukk)
    return () => document.removeEventListener('mousedown', lukk)
  }, [kolMeny])
  const scrollRef = useRef(null)
  const [drag, setDrag] = useState(null) // { id, modus, d }
  const flateRef = useRef(null)
  const [hoverId, setHoverId] = useState(null)        // stolpe musa er over (viser koplingspunktet)
  const [hoverPil, setHoverPil] = useState(null)      // avhengnadspil musa er over (klikk fjernar)
  const [kobling, setKobling] = useState(null)        // { fraId, x, y, malId, ok } under ei dra-kopling
  const idag = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])

  const { fra, til } = useMemo(() => {
    let min, maks
    if (elementer.length) {
      const ds = elementer.flatMap(e => [tilDato(e.start), tilDato(e.slutt)])
      min = ds.reduce((a, b) => (b < a ? b : a))
      maks = ds.reduce((a, b) => (b > a ? b : a))
    } else { min = addDays(idag, -14); maks = addDays(idag, 70) }
    const fra = startOfWeek(addDays(min, -14), { weekStartsOn: 1 })
    let til = endOfWeek(addDays(maks, 42), { weekStartsOn: 1 })
    if (differenceInCalendarDays(til, fra) < 140) til = endOfWeek(addDays(fra, 140), { weekStartsOn: 1 })
    return { fra, til }
  }, [elementer, idag])

  const antalDagar = differenceInCalendarDays(til, fra) + 1
  const breiddTotal = antalDagar * dagB
  const x = (d) => differenceInCalendarDays(d, fra) * dagB

  // Rull til i dag (eller planstart) ved fyrste opning
  const harRulla = useRef(false)
  useEffect(() => {
    if (harRulla.current || !scrollRef.current) return
    harRulla.current = true
    const mål = elementer.length ? tilDato(elementer.reduce((m, e) => (e.start < m ? e.start : m), elementer[0].start)) : idag
    scrollRef.current.scrollLeft = Math.max(0, x(addDays(mål, -7)))
  }, [elementer.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Overskrifter ──
  const manader = useMemo(() => {
    const ut = []
    let start = 0
    for (let i = 0; i <= antalDagar; i++) {
      const d = addDays(fra, i)
      const forrige = addDays(fra, i - 1)
      if (i === antalDagar || (i > 0 && d.getMonth() !== forrige.getMonth())) {
        const f = addDays(fra, start)
        ut.push({ key: format(f, 'yyyy-MM'), label: format(f, dagB * (i - start) > 90 ? 'MMMM yyyy' : 'MMM yy', { locale: nb }), left: start * dagB, width: (i - start) * dagB })
        start = i
      }
    }
    return ut
  }, [fra, antalDagar, dagB])
  const veker = useMemo(() => {
    const ut = []
    for (let i = 0; i < antalDagar; i += 7) ut.push({ nr: getISOWeek(addDays(fra, i)), left: i * dagB })
    return ut
  }, [fra, antalDagar, dagB])
  const visVekenr = !manadSum && dagB * 7 >= 24
  const visDagar = dagB >= 24

  // ── Bakgrunn: helg og heilagdagar ──
  const bakgrunn = useMemo(() => {
    if (dagB < 3) return []
    const ut = []
    for (let i = 0; i < antalDagar; i++) {
      const d = addDays(fra, i)
      const hn = helligdagNamn(d)
      if (hn) ut.push({ left: i * dagB, width: dagB, helg: true, tittel: hn })
      else if (d.getDay() === 6) ut.push({ left: i * dagB, width: Math.min(2, antalDagar - i) * dagB, helg: false })
    }
    return ut
  }, [fra, antalDagar, dagB])

  const fasar = useMemo(() => elementer.filter(e => e.type === 'fase'), [elementer])
  const fargeFor = (e) => {
    if (e.farge) return e.farge
    const rot = e.type === 'fase' ? e : forfedrar(elementer, e.id).find(f => f.type === 'fase')
    const i = rot ? fasar.findIndex(f => f.id === rot.id) : -1
    return i >= 0 ? FASEFARGAR[i % FASEFARGAR.length] : NEUTRAL
  }

  // Timar per veke (sum av alle aktivitetar) — eiga rad nedst
  // Påløpt (frå timeføringa) per veke, summert over alle aktivitetar — vert vist saman med planlagt i «Timar per veke»-rada
  const faktVeke = new Map(); let sumFaktisk = 0
  if (forbrukKart) for (const a of forbrukKart.values()) for (const [v, t] of a.veke) { faktVeke.set(v, (faktVeke.get(v) || 0) + t); sumFaktisk += t }
  const harTimar = (visTimar || manadSum) && ((timarKart && timarKart.size > 0) || faktVeke.size > 0)
  // Månadssummar (berre «Månad»): veker som går over månadsskifte vert fordelte på månadene etter arbeidstimar i kontorkalenderen
  const manadTal = useMemo(() => {
    const m = new Map()
    if (!manadSum) return m
    const add = (mnd, k, t) => { const x = m.get(mnd) || { plan: 0, fakt: 0, hon: 0 }; x[k] += t; m.set(mnd, x) }
    for (const [veke, v] of timarKart || []) for (const [mnd, fr] of manadDelar(veke, kal)) add(mnd, 'plan', v.total * fr)
    for (const [aid, a] of forbrukKart || []) {
      const akt = elementer.find(e => e.id === aid)
      const delar = akt ? personDelar(akt) : []
      const snitt = akt ? snittpris(akt, prisar || new Map()).pris : 0
      for (const [namn, p] of a.personer) {
        const d = delar.find(x => nokkelNamn(x.namn) === nokkelNamn(namn))
        const rate = (d ? prisFor(d, prisar || new Map()) : ((prisar || new Map()).get((namn || '').toLowerCase()) || 0)) || snitt || 0
        for (const [veke, t] of p.veke) for (const [mnd, fr] of manadDelar(veke, kal)) { add(mnd, 'fakt', t * fr); add(mnd, 'hon', t * fr * rate) }
      }
    }
    return m
  }, [manadSum, timarKart, forbrukKart, elementer, prisar, kal])
  const maksTimar = harTimar ? Math.max(1, ...[...(timarKart?.values() || [])].map(v => v.total), ...faktVeke.values()) : 0
  const sumTimar = harTimar && timarKart ? [...timarKart.values()].reduce((s2, v) => s2 + v.total, 0) : 0
  const persNamn = harTimar && timarKart ? [...new Set([...timarKart.values()].flatMap(v => Object.keys(v.perPerson)))].sort((a, b) => a.localeCompare(b, 'nb')) : []
  const personerFor = (e) => personerMedForbruk(personDelar(e), forbrukKart?.get(e.id))
  const kanUtvide = (e) => e.type === 'aktivitet' && ((+e.timar > 0 && personDelar(e).length > 0) || !!forbrukKart?.has(e.id))
  // rader + person-underrader + (valfritt) ei «Sum»-linje etter kvart delnivå
  const raderMedDelsum = (() => {
    const ut = [], stabel = []
    const avslutt = (n) => { while (stabel.length && stabel[stabel.length - 1].nivå >= n) { const p = stabel.pop(); ut.push({ id: 'ds:' + p.id, type: 'delsum', src: p, nivå: p.nivå }) } }
    for (const e of rader) {
      if (delsummer) avslutt(e.nivå || 0)
      ut.push(e)
      if (utvida?.has(e.id) && kanUtvide(e)) personerFor(e).forEach((p) => ut.push({ id: 'p:' + e.id + ':' + p.namn, type: 'person', akt: e, namn: p.namn, del: p.del, farge: personFarge(p.namn, fargeKart) }))
      if (delsummer && e.type !== 'milepael' && harBorn(elementer, e.id) && !lukka.has(e.id)) stabel.push(e)
    }
    if (delsummer) avslutt(-1)
    return ut
  })()
  const radar = [
    ...(visHendingar ? [{ id: '__hendingar', type: 'hendingar' }] : []),
    ...raderMedDelsum,
    ...(harTimar ? [{ id: '__timar', type: 'timar' }] : []),
    ...(harTimar && manadSum ? [{ id: '__honorar', type: 'honorar' }] : []),
    ...(harTimar && persTotOpen ? persNamn.map(n => ({ id: 'pt:' + n, type: 'persontot', namn: n })) : []),
  ]
  const radIndeks = new Map(radar.map((r, i) => [r.id, i]))

  // ── Dra-og-slepp ──
  const startDrag = (ev, el, modus) => {
    ev.preventDefault(); ev.stopPropagation()
    onVelg(el.id)
    const x0 = ev.clientX
    let flytta = false
    const dFor = (cx) => Math.round((cx - x0) / dagB)
    const mv = (e2) => {
      if (Math.abs(e2.clientX - x0) > 3) flytta = true
      if (flytta) setDrag({ id: el.id, modus, d: dFor(e2.clientX) })
    }
    const opp = (e2) => {
      window.removeEventListener('mousemove', mv)
      window.removeEventListener('mouseup', opp)
      document.body.style.cursor = ''
      setDrag(null)
      const d = dFor(e2.clientX)
      if (flytta && d !== 0) onEndre(el.id, modus, d)
    }
    document.body.style.cursor = modus === 'flytt' ? 'grabbing' : 'ew-resize'
    window.addEventListener('mousemove', mv)
    window.addEventListener('mouseup', opp)
  }

  // ── Dra-kopling: dra frå sirkelen på høgre kant av ein stolpe og slepp på ein annan rad →
  //    «den andre startar når denne er ferdig» (same som å legge til avhengnad i panelet)
  const startKobling = (ev, el) => {
    ev.preventDefault(); ev.stopPropagation()
    onVelg(el.id)
    const rect = () => flateRef.current.getBoundingClientRect()
    const finnMal = (e2) => {
      const r = rect()
      const idx = Math.floor((e2.clientY - r.top) / RAD_H)
      const mal = radar[idx]
      if (!mal || mal.id === el.id || mal.type === 'hendingar' || mal.type === 'timar' || mal.type === 'person' || mal.type === 'persontot') return { malId: null, ok: false }
      return { malId: mal.id, ok: !avhengnadFeil(elementer, mal.id, el.id) }
    }
    const mv = (e2) => { const r = rect(); setKobling({ fraId: el.id, x: e2.clientX - r.left, y: e2.clientY - r.top, ...finnMal(e2) }) }
    const opp = (e2) => {
      window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', opp); document.body.style.cursor = ''
      const m = finnMal(e2); setKobling(null)
      if (m.malId != null) onKoble?.(el.id, m.malId)
    }
    document.body.style.cursor = 'crosshair'
    mv(ev)
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', opp)
  }
  const koplingspunkt = (e, l, w, y) => {
    if (!onKoble) return null
    const vis = hoverId === e.id || valgt === e.id || kobling?.fraId === e.id
    const sone = (
      <div key={'k' + e.id} onMouseEnter={() => setHoverId(e.id)} onMouseLeave={() => setHoverId(h => (h === e.id ? null : h))}
        style={{ position: 'absolute', left: l - 2, top: y + 2, width: w + 28, height: RAD_H - 4, zIndex: 3 }}/>
    )
    const punkt = vis && (
      <div key={'p' + e.id} onMouseDown={ev => startKobling(ev, e)} onMouseEnter={() => setHoverId(e.id)}
        title={'Dra til ein annan aktivitet: den startar når «' + e.namn + '» er ferdig'}
        style={{ position: 'absolute', left: l + w + 5, top: y + RAD_H / 2 - 7, width: 14, height: 14, borderRadius: '50%', zIndex: 7, cursor: 'crosshair',
          background: '#fff', border: '2.5px solid ' + VALG_FARGE, boxShadow: '0 1px 4px rgba(0,0,0,.35)' }}/>
    )
    return [sone, punkt]
  }

  // ── Ta tak i tidslinja og dra ho: hald nede på ein tom flate (eller datooverskrifta) og dra i alle retningar.
  //    Eit enkelt klikk (utan dragning) fjernar utvalet som før.
  const startPan = (ev) => {
    if (ev.button !== 0 || !scrollRef.current) return
    ev.preventDefault()
    const sc = scrollRef.current
    const x0 = ev.clientX, y0 = ev.clientY, sl = sc.scrollLeft, st = sc.scrollTop
    let flytta = false
    const mv = (e2) => {
      const dx = e2.clientX - x0, dy = e2.clientY - y0
      if (!flytta && Math.abs(dx) + Math.abs(dy) > 3) { flytta = true; document.body.style.cursor = 'grabbing' }
      if (flytta) { sc.scrollLeft = sl - dx; sc.scrollTop = st - dy }
    }
    const opp = () => {
      window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', opp); document.body.style.cursor = ''
      if (!flytta) onVelg(null)
    }
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', opp)
  }

  // ── Dra ein rad i namnekolonna til ny plass i hierarkiet (grep ⠿): slepp over/under ei rad = same nivå som den,
  //    midt på ei rad = blir underaktivitet (raden vert summasjonsaktivitet). Underaktivitetane følgjer med.
  const navnRef = useRef(null)
  const [hDrag, setHDrag] = useState(null) // { id, malId, pos, ok }
  const startHDrag = (ev, r) => {
    if (ev.button !== 0 || !onFlyttHierarki) return
    ev.preventDefault(); ev.stopPropagation()
    const x0 = ev.clientX, y0 = ev.clientY
    let flytta = false
    const finn = (cy) => {
      const rect = navnRef.current.getBoundingClientRect()
      const pos0 = (cy - rect.top) / RAD_H
      const idx = Math.floor(pos0)
      const mal = radar[idx]
      if (!mal || !['fase', 'aktivitet', 'milepael'].includes(mal.type)) return { id: r.id, malId: null, pos: null, ok: false }
      const frac = pos0 - idx
      let pos = frac < 0.28 ? 'for' : frac > 0.72 ? 'etter' : 'inni'
      if (pos === 'inni' && mal.type === 'milepael') pos = frac < 0.5 ? 'for' : 'etter'
      return { id: r.id, malId: mal.id, pos, ok: kanFlytteTil(elementer, r.id, mal.id, pos) }
    }
    const mv = (e2) => {
      if (!flytta && Math.abs(e2.clientX - x0) + Math.abs(e2.clientY - y0) > 4) { flytta = true; document.body.style.cursor = 'grabbing' }
      if (flytta) setHDrag(finn(e2.clientY))
    }
    const opp = (e2) => {
      window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', opp); document.body.style.cursor = ''
      const m = flytta ? finn(e2.clientY) : null
      setHDrag(null)
      if (m && m.ok) onFlyttHierarki(m.id, m.malId, m.pos)
    }
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', opp)
  }

  const visDatoar = (e) => {
    if (!drag) return { start: e.start, slutt: e.slutt }
    if (drag.id === e.id) return beregnDatoar(e, drag.modus, drag.d)
    if (drag.modus === 'flytt' && forfedrar(elementer, e.id).some(a => a.id === drag.id)) {
      const f = elementer.find(x => x.id === drag.id)
      if (f && erSumm(elementer, f) && harBorn(elementer, f.id)) {
        const nf = beregnDatoar(f, 'flytt', drag.d)
        const dd = differenceInCalendarDays(tilDato(nf.start), tilDato(f.start))
        return { start: format(addDays(tilDato(e.start), dd), 'yyyy-MM-dd'), slutt: format(addDays(tilDato(e.slutt), dd), 'yyyy-MM-dd') }
      }
    }
    return { start: e.start, slutt: e.slutt }
  }

  // ── Avhengnadspilar ──
  const pilar = []
  for (const e of rader) {
    for (const pid of e.avh || []) {
      const p = rader.find(r => r.id === pid)
      if (!p) continue
      const pd = visDatoar(p), ed = visDatoar(e)
      const rp = radIndeks.get(p.id), re = radIndeks.get(e.id)
      const x1 = x(tilDato(pd.slutt)) + dagB
      const x2 = x(tilDato(ed.start))
      const y1 = rp * RAD_H + RAD_H / 2
      const y2 = re * RAD_H + RAD_H / 2
      const midY = y2 > y1 ? y1 + RAD_H / 2 - 2 : y1 - RAD_H / 2 + 2
      const sti = x2 >= x1 + 8
        ? `M${x1},${y1} H${x1 + 6} V${y2} H${x2 - 1}`
        : `M${x1},${y1} H${x1 + 6} V${midY} H${x2 - 8} V${y2} H${x2 - 1}`
      pilar.push({ key: `${p.id}-${e.id}`, sti, x2, y2, fraId: p.id, tilId: e.id })
    }
  }

  const todayX = x(idag)
  const idagSynleg = todayX >= 0 && todayX <= breiddTotal
  const topH = manadSum ? 36 : visDagar ? 62 : 52

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
    {verktoy && <div style={{ height: 34, flexShrink: 0, display: 'flex', alignItems: 'center', paddingLeft: VENSTRE + 8, paddingBottom: 4 }}>{verktoy}</div>}
    <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', minHeight: 0, background: 'var(--bg2)',
      border: '1.5px solid var(--border)', borderRadius: 'var(--r2)', position: 'relative' }}>
      <div style={{ width: VENSTRE + breiddTotal, position: 'relative' }}>

        {/* ── Overskrift ── */}
        <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 8, height: topH, background: 'var(--bg3)',
          borderBottom: '2px solid var(--border)' }}>
          <div onContextMenu={e => { e.preventDefault(); setKolMeny({ x: e.clientX, y: e.clientY }) }} title="Høgreklikk for å velje kolonnar"
            style={{ position: 'sticky', left: 0, zIndex: 9, width: VENSTRE, flexShrink: 0, background: 'var(--bg3)',
            borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'flex-end',
            fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text3)' }}>
            <div style={{ width: NAMN_B, flexShrink: 0, padding: '0 12px 8px', display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
              {handtak('__namn', NAMN_B)}
              Fase / aktivitet
              <button type="button" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setKolMeny({ x: r.left, y: r.bottom + 4 }) }} title="Vel kolonnar (kan òg opnast med høgreklikk)"
                style={{ border: '1px solid var(--border)', background: 'var(--bg2)', borderRadius: 5, cursor: 'default', fontSize: 11, padding: '0 6px', color: 'var(--text2)', fontWeight: 800 }}>＋ Kolonnar</button>
            </div>
            {kolDefs.map(d => (
              <div key={d.key} style={{ width: kb(d), flexShrink: 0, padding: '0 6px 8px', textAlign: d.hogre ? 'right' : 'left', whiteSpace: 'nowrap', position: 'relative' }} title={d.label}>
                <span lang="nb" style={{ display: 'block', whiteSpace: 'normal', lineHeight: 1.18, wordBreak: 'normal' }}>{d.label.split(' ').length === 2 ? d.label.split(' ').map((w, wi) => <span key={wi} style={{ display: 'block' }}>{mjukBindestrek(w)}</span>) : d.label.split(' ').map(mjukBindestrek).join(' ')}</span>{handtak(d.key, kb(d))}
              </div>
            ))}
          </div>
          <div onMouseDown={startPan} title="Dra for å flytte tidslinja" style={{ position: 'relative', width: breiddTotal, flexShrink: 0, cursor: 'default' }}>
            {manader.map((m, i) => (
              <div key={i} style={{ position: 'absolute', left: m.left, width: m.width, top: 0, height: manadSum ? 36 : 22,
                borderRight: '1px solid var(--border)', padding: '4px 8px', fontSize: 11.5, fontWeight: 800,
                color: 'var(--text)', textTransform: 'capitalize', overflow: 'hidden', whiteSpace: 'nowrap' }}>{m.label}</div>
            ))}
            {!manadSum && veker.map((v, i) => (
              <div key={i} style={{ position: 'absolute', left: v.left, width: dagB * 7, top: 22, height: 24,
                borderRight: '1px solid var(--border)', borderTop: '1px solid var(--border)', textAlign: 'center',
                fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', lineHeight: '23px', overflow: 'hidden' }}>
                {visVekenr ? v.nr : ''}
              </div>
            ))}
            {visDagar && Array.from({ length: antalDagar }, (_, i) => {
              const d = addDays(fra, i)
              const fri = d.getDay() === 0 || d.getDay() === 6 || helligdagNamn(d)
              return (
                <div key={i} style={{ position: 'absolute', left: i * dagB, width: dagB, top: 46, height: 16,
                  textAlign: 'center', fontSize: 9.5, color: fri ? 'var(--danger)' : 'var(--text3)', lineHeight: '16px' }}>
                  {format(d, 'd')}
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex' }}>
          {/* ── Namnekolonne (klistra til venstre) ── */}
          <div ref={navnRef} style={{ position: 'sticky', left: 0, zIndex: 6, width: VENSTRE, flexShrink: 0, background: 'var(--bg2)',
            borderRight: '1px solid var(--border)' }}>
            {hDrag && hDrag.malId != null && (() => {
              const mi = radIndeks.get(hDrag.malId)
              const farge = hDrag.ok ? '#16A34A' : '#DC2626'
              if (mi == null) return null
              return hDrag.pos === 'inni'
                ? <div style={{ position: 'absolute', left: 0, right: 0, top: mi * RAD_H, height: RAD_H, outline: '2px solid ' + farge, outlineOffset: -2, background: farge + '22', zIndex: 20, pointerEvents: 'none' }}/>
                : <div style={{ position: 'absolute', left: 0, right: 0, top: (hDrag.pos === 'for' ? mi : mi + 1) * RAD_H - 2, height: 4, background: farge, zIndex: 20, pointerEvents: 'none' }}/>
            })()}
            {radar.map(r => {
              if (r.type === 'timar') {
                return (
                  <div key={r.id} style={{ height: RAD_H, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px',
                    borderBottom: '1px solid var(--border)', background: 'var(--bg3)', fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
                    <button type="button" onClick={() => setPersTotOpen(v => !v)} title={persTotOpen ? 'Skjul timar per person' : 'Vis timar per person (alle aktivitetar)'}
                      style={{ border: 'none', background: 'transparent', cursor: 'default', width: 14, padding: 0, fontSize: 11, color: 'var(--brand)', fontWeight: 800 }}>{persTotOpen ? '▾' : '▸'}</button>
                    <span style={{ width: 9, height: 9, background: '#0F766E', borderRadius: 2, flexShrink: 0 }}/>
                    {manadSum ? 'Timar per månad' : 'Timar per veke'}
                    <span style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--text3)' }}>{Math.round(sumTimar * 2) / 2} t planlagt{sumFaktisk > 0 ? <> · <span style={{ color: '#1565C0', fontWeight: 800 }}>{Math.round(sumFaktisk * 2) / 2} t påløpt</span></> : ''}</span>
                  </div>
                )
              }
              if (r.type === 'honorar') {
                const sumHon = [...manadTal.values()].reduce((a, v) => a + v.hon, 0)
                return (
                  <div key={r.id} style={{ height: RAD_H, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px 0 36px', borderBottom: '1px solid var(--border)', background: 'var(--bg3)', fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
                    <span style={{ width: 9, height: 9, background: '#1565C0', borderRadius: 2, flexShrink: 0 }}/>
                    Påløpt honorar per månad
                    <span style={{ marginLeft: 'auto', fontWeight: 600, color: '#1565C0' }}>{Math.round(sumHon).toLocaleString('nb-NO')} kr</span>
                  </div>
                )
              }
              if (r.type === 'hendingar') {
                return (
                  <div key={r.id} style={{ height: RAD_H, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px',
                    borderBottom: '1px solid var(--border)', background: 'var(--bg3)', fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
                    <span style={{ width: 9, height: 9, background: FRIST_FARGE, transform: 'rotate(45deg)', flexShrink: 0 }}/>
                    Fristar og møte ({hendingar.length})
                  </div>
                )
              }
              if (r.type === 'persontot') {
                const sumP = [...timarKart.values()].reduce((a, v) => a + (v.perPerson[r.namn] || 0), 0)
                return (
                  <div key={r.id} style={{ height: RAD_H, display: 'flex', alignItems: 'center', gap: 7, paddingLeft: 30, paddingRight: 12, borderBottom: '1px solid var(--border)', background: 'var(--bg3)' }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: personFarge(r.namn, fargeKart), flexShrink: 0 }}/>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Sum {r.namn}</span>
                    <span style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{Math.round(sumP * 2) / 2} t</span>
                  </div>
                )
              }
              if (r.type === 'person') {
                return (
                  <div key={r.id} onClick={() => onVelg(r.akt.id)} style={{ height: RAD_H, display: 'flex', alignItems: 'center', gap: 7, paddingLeft: 10 + ((r.akt.nivå || 0) + 1) * 20 + 16,
                    paddingRight: 8, borderBottom: '1px solid var(--border)', background: 'var(--bg3)', cursor: 'default' }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: r.farge, flexShrink: 0 }}/>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text2)' }}>{r.namn}</span>
                    {r.akt.personar?.length > 1 && <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>{Math.round(r.del * 10) / 10}%</span>}
                    <span style={{ fontSize: 10.5, color: 'var(--text3)', fontFamily: 'var(--mono)' }} title="planlagt / påløpt">{Math.round((+r.akt.timar || 0) * r.del / 100 * 2) / 2} t{(() => { const f = faktiskFor(forbrukKart?.get(r.akt.id), r.namn); return f ? <b style={{ color: '#1565C0' }}> / {Math.round(f.total * 10) / 10}</b> : null })()}</span>
                  </div>
                )
              }
              if (r.type === 'delsum') {
                return (
                  <div key={r.id} onClick={() => onVelg(r.src.id)} style={{ height: RAD_H, display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', borderTop: '1px solid var(--border)', background: 'var(--bg3)', cursor: 'default' }}>
                    <div style={{ width: NAMN_B, flexShrink: 0, paddingLeft: 36 + (r.nivå || 0) * 20, paddingRight: 8, fontSize: 12.5, fontWeight: 800, color: 'var(--brand)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>∑ Sum {r.src.namn}</div>
                    {kolDefs.map(d => {
                      const v = ['budsjett', 'timerate', 'timar', 'palopTimar', 'palopHonorar', 'gjenTimar', 'gjenBudsjett', 'kpi', 'ferdig'].includes(d.key) ? verdiar.verdi(r.src, d.key) : ''
                      return <div key={d.key} style={{ width: kb(d), flexShrink: 0, padding: '0 6px', textAlign: d.hogre ? 'right' : 'left', fontSize: 12, fontWeight: 800, color: d.key === 'kpi' ? kpiFarge(v) : 'var(--text)', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {v === '' ? '' : d.key === 'kpi' ? (typeof v === 'number' ? v.toFixed(2).replace('.', ',') : v) : (typeof v === 'number' && d.key !== 'ferdig' ? v.toLocaleString('nb-NO') : v)}</div>
                    })}
                  </div>
                )
              }
              const erFase = r.type === 'fase' || (r.type === 'aktivitet' && (r.summ || harBorn(elementer, r.id))) // fase / summasjonsaktivitet
              const sel = valgt === r.id || !!valde?.has(r.id)
              return (
                <div key={r.id} onClick={e => onVelg(r.id, e)}
                  style={{ height: RAD_H, display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', cursor: 'default',
                    background: sel ? 'var(--brandbg2)' : erFase ? 'var(--bg3)' : 'transparent',
                    boxShadow: sel ? `inset 3px 0 0 ${VALG_FARGE}` : undefined }}
                  title={`${r.namn}\n${formaterDato(r.start)} – ${formaterDato(r.slutt)}`}>
                  <div style={{ width: NAMN_B, flexShrink: 0, height: '100%', display: 'flex', alignItems: 'center', gap: 7, paddingLeft: 10 + (r.nivå || 0) * 20, paddingRight: 8, overflow: 'hidden' }}>
                  {onFlyttHierarki && <span onMouseDown={e => startHDrag(e, r)} title="Dra for å flytte i hierarkiet (over/under ei rad = same nivå, midt på = underaktivitet)"
                    style={{ width: 10, flexShrink: 0, cursor: 'default', color: 'var(--text3)', opacity: .55, fontSize: 13, lineHeight: 1, userSelect: 'none', marginLeft: -4 }}>⠿</span>}
                  {harBorn(elementer, r.id) && r.type !== 'milepael' ? (
                    <button type="button" onClick={e => { e.stopPropagation(); onToggleLukka(r.id) }}
                      style={{ border: 'none', background: 'transparent', cursor: 'default', width: 16, padding: 0,
                        fontSize: 11, color: 'var(--text3)' }}>{lukka.has(r.id) ? '▸' : '▾'}</button>
                  ) : kanUtvide(r) && onToggleUtvida ? (
                    <button type="button" onClick={e => { e.stopPropagation(); onToggleUtvida(r.id) }} title={utvida?.has(r.id) ? 'Skjul personar' : 'Vis personar og timar per veke'}
                      style={{ border: 'none', background: 'transparent', cursor: 'default', width: 16, padding: 0, fontSize: 11, color: 'var(--brand)', fontWeight: 800 }}>{utvida?.has(r.id) ? '▾' : '▸'}</button>
                  ) : <span style={{ width: 16, flexShrink: 0 }}/>}
                  <span style={{ width: r.type === 'milepael' ? 9 : 10, height: r.type === 'milepael' ? 9 : 10, flexShrink: 0,
                    background: fargeFor(r), transform: r.type === 'milepael' ? 'rotate(45deg)' : undefined,
                    borderRadius: r.type === 'aktivitet' ? 3 : 0 }}/>
                  {redigerer && redigerer.id === r.id && redigerer.key === 'namn' ? (
                    <input autoFocus defaultValue={r.namn} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}
                      onBlur={e => { setRedigerer(null); if (e.target.value.trim() && e.target.value !== r.namn) onEndreFelt?.(r.id, 'namn', e.target.value) }}
                      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { e.currentTarget.value = r.namn; setRedigerer(null) } }}
                      style={{ flex: 1, minWidth: 0, fontSize: 12.5, padding: '2px 5px', border: '1.5px solid var(--brand2)', borderRadius: 4, fontFamily: 'var(--font)', background: 'var(--bg2)', color: 'var(--text)' }}/>
                  ) : (
                    <span onDoubleClick={e => { if (onEndreFelt) { e.stopPropagation(); setRedigerer({ id: r.id, key: 'namn' }) } }} title="Dobbeltklikk for å endre namn"
                      style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontSize: erFase ? 13 : 12.5, fontWeight: erFase ? 800 : 500, color: 'var(--text)' }}>{r.namn}</span>
                  )}
                  {r.type === 'aktivitet' && effektivFerdig(r, dokMap) > 0 && (
                    <span title={(r.leveransar || []).length && r.ferdigModus !== 'skjonn' ? 'Rekna ut frå kopla leveransar' : 'Skjønn'} style={{ fontSize: 10.5, fontWeight: 700, color: (r.leveransar || []).length && r.ferdigModus !== 'skjonn' ? '#0F766E' : 'var(--text3)' }}>{(r.leveransar || []).length && r.ferdigModus !== 'skjonn' ? '⛓ ' : ''}{effektivFerdig(r, dokMap)}%</span>
                  )}
                  {erFase && r.type !== 'milepael' && faseFerdig(elementer, r, dokMap) > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)' }}>{faseFerdig(elementer, r, dokMap)}%</span>}
                  </div>
                  {kolDefs.map(d => {
                    const redig = redigerer && redigerer.id === r.id && redigerer.key === d.key
                    const kanRed = !!onEndreFelt && REDIGERBARE.has(d.key) && d.key !== 'namn' && d.key !== 'bemanning'
                      && (!erFase || ['kode', 'ansvarleg'].includes(d.key)) && !(r.type === 'milepael' && !['kode', 'start', 'ansvarleg'].includes(d.key))
                    const v = verdiar.verdi(r, d.key)
                    const gaa = () => { setRedigerer(null) }
                    const lagre = (ny) => { gaa(); if (String(ny) !== String(v)) onEndreFelt(r.id, d.key, ny) }
                    return (
                      <div key={d.key} onDoubleClick={e => { if (kanRed) { e.stopPropagation(); setRedigerer({ id: r.id, key: d.key }) } }}
                        style={{ width: kb(d), flexShrink: 0, padding: redig ? '0 2px' : '0 6px', textAlign: d.hogre ? 'right' : 'left', fontSize: 12, color: 'var(--text2)', fontFamily: ['pns', 'kode', 'start', 'slutt'].includes(d.key) ? 'var(--mono)' : undefined,
                          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontWeight: erFase ? 700 : 400, cursor: kanRed ? 'text' : undefined,
                          background: kanRed && !redig ? 'rgba(21,101,192,.04)' : undefined, height: '100%', display: 'flex', alignItems: 'center', justifyContent: d.hogre ? 'flex-end' : 'flex-start' }}
                        title={kanRed ? 'Dobbeltklikk for å endre' : String(v)}>
                        {redig ? (d.key === 'ansvarleg' ? (
                          <select autoFocus defaultValue={String(v)} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onChange={e => lagre(e.target.value)} onBlur={gaa}
                            style={{ width: '100%', fontSize: 12, padding: '1px 2px', border: '1.5px solid var(--brand2)', borderRadius: 4, background: 'var(--bg2)', color: 'var(--text)' }}>
                            {(() => {
                              const namn = []
                              for (const p of personell || []) if (p.namn && !namn.includes(p.namn)) namn.push(p.namn)
                              for (const p of (r.personar || [])) if (p.namn && !namn.some(n => n.toLowerCase() === p.namn.toLowerCase())) namn.push(p.namn)
                              if (v && !namn.includes(String(v))) namn.push(String(v))
                              return [<option key="" value="">(ingen)</option>, ...namn.map(n => <option key={n} value={n}>{n}</option>)]
                            })()}
                          </select>
                        ) : d.key === 'btype' ? (
                          <select autoFocus defaultValue={String(v)} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onChange={e => lagre(e.target.value)} onBlur={gaa}
                            style={{ width: '100%', fontSize: 12, padding: '1px 2px', border: '1.5px solid var(--brand2)', borderRadius: 4, background: 'var(--bg2)', color: 'var(--text)' }}>
                            {BTYPAR.map(t => <option key={t} value={t}>{t || '(ikkje sett)'}</option>)}
                          </select>
                        ) : (
                          <input autoFocus defaultValue={String(v)} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}
                            onBlur={e => lagre(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { e.currentTarget.value = String(v); gaa() } }}
                            style={{ width: '100%', fontSize: 12, padding: '1px 4px', border: '1.5px solid var(--brand2)', borderRadius: 4, fontFamily: 'var(--font)', background: 'var(--bg2)', color: 'var(--text)', textAlign: d.hogre ? 'right' : 'left' }}/>
                        )) : (v === '' ? '' : d.key === 'kpi' ? <span style={{ fontWeight: 800, color: kpiFarge(v) }}>{typeof v === 'number' ? v.toFixed(2).replace('.', ',') : v}</span> : (typeof v === 'number' && d.hogre && d.key !== 'ferdig' && d.key !== 'varig' ? v.toLocaleString('nb-NO') : v))}
                      </div>
                    )
                  })}
                </div>
              )
            })}
            {radar.length === 0 && <div style={{ height: RAD_H }}/>}
          </div>

          {/* ── Tidslinje-flate ── */}
          <div ref={flateRef} style={{ position: 'relative', width: breiddTotal, flexShrink: 0, height: Math.max(radar.length, 1) * RAD_H, cursor: 'default' }}
            onMouseDown={startPan}>
            {bakgrunn.map((b, i) => (
              <div key={i} title={b.tittel} style={{ position: 'absolute', left: b.left, width: b.width, top: 0, bottom: 0,
                background: b.helg ? 'rgba(185,28,28,.10)' : 'rgba(100,116,139,.09)' }}/>
            ))}
            {!manadSum && veker.map((v, i) => (
              <div key={i} style={{ position: 'absolute', left: v.left, top: 0, bottom: 0, width: 1, background: 'var(--border)', opacity: .6 }}/>
            ))}
            {radar.map((r, i) => (
              <div key={r.id} style={{ position: 'absolute', left: 0, right: 0, top: (i + 1) * RAD_H - 1, height: 1, background: 'var(--border)', opacity: .7 }}/>
            ))}

            {/* Fristar og møte frå notat/oppgåver (Kalender-modulen sine data) */}
            {visHendingar && hendingar.map(h => {
              const same = hendingar.filter(o => o.dato.getTime() === h.dato.getTime())
              const off = same.indexOf(h) * 11
              const tittel = h.type === 'møte'
                ? `Møte: ${h.tittel} — ${format(h.dato, 'dd.MM.yyyy HH:mm')}`
                : `Frist: ${h.tekst} (${h.tittel}) — ${format(h.dato, 'dd.MM.yyyy')}`
              return (
                <div key={h.id} title={tittel} onMouseDown={e => e.stopPropagation()}
                  style={{ position: 'absolute', left: x(h.dato) + dagB / 2 - 5 + off, top: RAD_H / 2 - 5, width: 10, height: 10,
                    background: h.type === 'møte' ? MOTE_FARGE : FRIST_FARGE, borderRadius: h.type === 'møte' ? '50%' : 0,
                    transform: h.type === 'møte' ? undefined : 'rotate(45deg)', border: '1.5px solid #fff', zIndex: 3 }}/>
              )
            })}

            {/* Timar per veke: sum per veke, raud ramme viss nokon har meir planlagt enn kapasiteten */}
            {harTimar && !manadSum && [...new Set([...(timarKart?.keys() || []), ...faktVeke.keys()])].sort().map((veke) => {
              const v = timarKart?.get(veke) || { total: 0, perPerson: {} }
              const fakt = faktVeke.get(veke) || 0
              const ob = overlast?.get(veke)
              const rad = radIndeks.get('__timar')
              const tekst = Math.round(v.total * 2) / 2
              const faktTekst = Math.round(fakt * 2) / 2
              const avr = (n) => Math.round(n * 2) / 2
              const linjer = [`Veke ${getISOWeek(tilDato(veke))}: ${tekst} t planlagt${fakt ? ', ' + faktTekst + ' t påløpt' : ''}`,
                ...Object.entries(v.perPerson).map(([n, h]) => `${n}: ${avr(h)} t`)]
              if (ob) linjer.push('', 'OVERBELASTNING:', ...ob.map(o => `${o.namn}: ${avr(o.timar)} t av ${avr(o.kapasitet)} t kapasitet`))
              return (
                <div key={veke} title={linjer.join('\n')}
                  style={{ position: 'absolute', left: x(tilDato(veke)) + 1, width: dagB * 7 - 2, top: rad * RAD_H + 4, height: RAD_H - 8, borderRadius: 4,
                    background: v.total > 0 ? `rgba(15,118,110,${0.14 + 0.5 * (maksTimar ? v.total / maksTimar : 0)})` : 'var(--bg3)',
                    border: fakt && !v.total ? '1px dashed #1565C0' : undefined,
                    outline: ob ? '2px solid #DC2626' : undefined, outlineOffset: -1,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 800, lineHeight: '12px',
                    color: ob ? '#B91C1C' : 'var(--text)', overflow: 'hidden', zIndex: 3 }}>
                  {dagB * 7 >= 24 && tekst > 0 && <span>{tekst}</span>}
                  {dagB * 7 >= 24 && fakt > 0 && <span style={{ color: '#1565C0' }}>{faktTekst}</span>}
                </div>
              )
            })}

            {/* «Månad»: timar (planlagt + påløpt) og påløpt honorar per månad */}
            {harTimar && manadSum && manader.map((m) => {
              const t = manadTal.get(m.key) || { plan: 0, fakt: 0, hon: 0 }
              const rT = radIndeks.get('__timar'), rH = radIndeks.get('__honorar')
              const maks = Math.max(1, ...[...manadTal.values()].map(v => Math.max(v.plan, v.fakt)))
              const grunn = { position: 'absolute', left: m.left + 2, width: Math.max(0, m.width - 4), height: RAD_H - 8, borderRadius: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', zIndex: 3, fontSize: 11, fontWeight: 800, lineHeight: '13px' }
              const avr = (n) => Math.round(n * 2) / 2
              return [
                <div key={m.key + 't'} title={m.label + ': ' + avr(t.plan) + ' t planlagt' + (t.fakt ? ', ' + avr(t.fakt) + ' t påløpt' : '')}
                  style={{ ...grunn, top: rT * RAD_H + 4, background: t.plan > 0 ? `rgba(15,118,110,${0.14 + 0.5 * (t.plan / maks)})` : 'var(--bg3)', color: 'var(--text)' }}>
                  {t.plan > 0 && <span>{avr(t.plan)}</span>}{t.fakt > 0 && <span style={{ color: '#1565C0' }}>{avr(t.fakt)}</span>}
                </div>,
                rH != null ? <div key={m.key + 'h'} title={m.label + ': påløpt honorar ' + Math.round(t.hon).toLocaleString('nb-NO') + ' kr'}
                  style={{ ...grunn, top: rH * RAD_H + 4, background: t.hon > 0 ? 'rgba(21,101,192,.14)' : 'var(--bg3)', color: '#1565C0' }}>
                  {t.hon > 0 && <span>{Math.round(t.hon).toLocaleString('nb-NO')}</span>}
                </div> : null,
              ]
            })}

            {/* Sum per person per veke (alle aktivitetar) */}
            {radar.filter(r => r.type === 'persontot').map(r => {
              const i = radIndeks.get(r.id)
              return [...timarKart.entries()].map(([veke, v]) => {
                const t = Math.round((v.perPerson[r.namn] || 0) * 10) / 10
                if (!t) return null
                const ob = overlast?.get(veke)?.find(o => o.namn.toLowerCase() === r.namn.toLowerCase())
                const farge = personFarge(r.namn, fargeKart)
                return (
                  <div key={r.id + veke} title={r.namn + ' — veke ' + getISOWeek(tilDato(veke)) + ' totalt: ' + t + ' t' + (ob ? ' (kapasitet ' + Math.round(ob.kapasitet * 2) / 2 + ' t — overbelasta)' : '')}
                    style={{ position: 'absolute', left: x(tilDato(veke)) + 1, width: dagB * 7 - 2, top: i * RAD_H + 5, height: RAD_H - 10, borderRadius: 4, background: farge + '40',
                      outline: ob ? '2px solid #DC2626' : undefined, outlineOffset: -1, color: ob ? '#B91C1C' : 'var(--text)', fontSize: 10.5, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', zIndex: 3 }}>
                    {dagB * 7 >= 24 ? t : ''}
                  </div>
                )
              })
            })}

            {/* Person-underrader: timar per veke for kvar person */}
            {radar.filter(r => r.type === 'person').map(r => {
              const i = radIndeks.get(r.id)
              const plan = new Map(fordelTimar(r.akt, kal).map(v => [v.veke, v.timar * r.del / 100]))
              const fakt = faktiskFor(forbrukKart?.get(r.akt.id), r.namn)?.veke || new Map()
              const alle = [...new Set([...plan.keys(), ...fakt.keys()])]
              return alle.map(veke => {
                const t = Math.round((plan.get(veke) || 0) * 10) / 10
                const f = Math.round((fakt.get(veke) || 0) * 10) / 10
                const smal = dagB * 7 >= 24
                return (
                  <div key={r.id + veke} title={r.namn + ' — veke ' + getISOWeek(tilDato(veke)) + ': planlagt ' + t + ' t' + (f ? ', påløpt ' + f + ' t' : '')}
                    style={{ position: 'absolute', left: x(tilDato(veke)) + 1, width: dagB * 7 - 2, top: i * RAD_H + 3, height: RAD_H - 6, borderRadius: 4,
                      background: t > 0 ? r.farge + '40' : 'var(--bg3)', border: f && !t ? '1px dashed ' + r.farge : undefined, color: 'var(--text)', fontSize: 10, fontWeight: 700, lineHeight: '12px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', zIndex: 3 }}>
                    {smal && t > 0 && <span>{t}</span>}
                    {smal && f > 0 && <span style={{ color: '#1565C0', fontWeight: 800 }}>{f}</span>}
                  </div>
                )
              })
            })}

            {/* Avhengnadspilar */}
            <svg width={breiddTotal} height={Math.max(radar.length, 1) * RAD_H}
              style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 2 }}>
              {pilar.map(p => (
                <g key={p.key} onMouseEnter={() => setHoverPil(p.key)} onMouseLeave={() => setHoverPil(h => (h === p.key ? null : h))}>
                  <title>Klikk for å fjerne avhengnaden (Angre set han attende)</title>
                  <path d={p.sti} fill="none" stroke="transparent" strokeWidth="10" style={{ pointerEvents: 'stroke', cursor: 'default' }}
                    onMouseDown={ev => ev.stopPropagation()} onClick={() => onFjernAvh?.(p.fraId, p.tilId)}/>
                  <path d={p.sti} fill="none" stroke={hoverPil === p.key ? '#DC2626' : '#64748B'} strokeWidth={hoverPil === p.key ? 2.4 : 1.4}/>
                  <path d={`M${p.x2 - 1},${p.y2} l-5,-3.5 v7 z`} fill={hoverPil === p.key ? '#DC2626' : '#64748B'}/>
                </g>
              ))}
            </svg>

            {/* Dra-kopling: elastisk linje + markert målrad */}
            {kobling && (() => {
              const fra = rader.find(r => r.id === kobling.fraId)
              const fd = fra && visDatoar(fra)
              const ri = radIndeks.get(kobling.fraId)
              const x1 = fd ? x(tilDato(fd.slutt)) + dagB + 8 : 0
              const y1 = ri * RAD_H + RAD_H / 2
              const mi = kobling.malId != null ? radIndeks.get(kobling.malId) : null
              const farge = kobling.malId == null ? '#64748B' : kobling.ok ? '#16A34A' : '#DC2626'
              const mal = kobling.malId != null ? rader.find(r => r.id === kobling.malId) : null
              return (
                <>
                  {mi != null && <div style={{ position: 'absolute', left: 0, right: 0, top: mi * RAD_H, height: RAD_H, background: farge + '22', outline: '2px solid ' + farge, outlineOffset: -2, zIndex: 1, pointerEvents: 'none' }}/>}
                  <svg width={breiddTotal} height={Math.max(radar.length, 1) * RAD_H} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 15 }}>
                    <path d={'M' + x1 + ',' + y1 + ' C' + (x1 + 60) + ',' + y1 + ' ' + (kobling.x - 60) + ',' + kobling.y + ' ' + kobling.x + ',' + kobling.y}
                      fill="none" stroke={farge} strokeWidth="2.2" strokeDasharray="6 4"/>
                    <circle cx={kobling.x} cy={kobling.y} r="5" fill={farge}/>
                  </svg>
                  <div style={{ position: 'absolute', left: Math.min(kobling.x + 14, breiddTotal - 260), top: kobling.y + 10, zIndex: 16, pointerEvents: 'none',
                    background: '#111', color: '#fff', fontSize: 11.5, fontWeight: 700, padding: '4px 9px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                    {mal ? (kobling.ok ? '«' + mal.namn + '» startar når «' + (fra?.namn || '') + '» er ferdig' : (avhengnadFeil(elementer, mal.id, kobling.fraId) || 'Ikkje mogleg'))
                      : 'Slepp på aktiviteten som skal starte etterpå'}
                  </div>
                </>
              )
            })()}

            {/* Stolpar */}
            {rader.map(e => {
              const i = radIndeks.get(e.id)
              const y = i * RAD_H
              const vd = visDatoar(e)
              const l = x(tilDato(vd.start))
              const w = Math.max(dagB, (differenceInCalendarDays(tilDato(vd.slutt), tilDato(vd.start)) + 1) * dagB)
              const farge = fargeFor(e)
              const sel = valgt === e.id || !!valde?.has(e.id)
              const dragger = drag?.id === e.id
              const erFase = e.type === 'fase' || (e.type === 'aktivitet' && (e.summ || harBorn(elementer, e.id)))
              const tipp = `${e.namn}\n${formaterDato(vd.start)} – ${formaterDato(vd.slutt)}`
              const dato = dragger && (
                <div style={{ position: 'absolute', left: l, top: y - 4, transform: 'translateY(-100%)', zIndex: 20,
                  background: '#111', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                  whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                  {formaterDato(vd.start)} – {formaterDato(vd.slutt)}
                </div>
              )

              if (e.type === 'milepael') {
                const cx = l + dagB / 2
                return (
                  <div key={e.id}>
                    <div title={tipp} onMouseDown={ev => startDrag(ev, e, 'flytt')}
                      style={{ position: 'absolute', left: cx - 8, top: y + RAD_H / 2 - 8, width: 16, height: 16,
                        transform: 'rotate(45deg)', background: farge, cursor: 'default', zIndex: 4,
                        outline: sel ? `2.5px solid ${VALG_FARGE}` : '2px solid #fff', outlineOffset: sel ? 1 : 0 }}/>
                    <div style={{ position: 'absolute', left: cx + 14, top: y, height: RAD_H, display: 'flex', alignItems: 'center',
                      fontSize: 11.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{e.namn}</div>
                    {koplingspunkt(e, l, dagB - 8, y)}
                    {dato}
                  </div>
                )
              }

              if (erFase) {
                return (
                  <div key={e.id}>
                    <div title={tipp} onMouseDown={ev => startDrag(ev, e, 'flytt')}
                      style={{ position: 'absolute', left: l, top: y + 9, width: w, height: 11, background: farge,
                        borderRadius: 2, cursor: 'default', zIndex: 4, outline: sel ? `2.5px solid ${VALG_FARGE}` : undefined, outlineOffset: 1, overflow: 'hidden' }}>
                      {faseFerdig(elementer, e, dokMap) > 0 && <div style={{ width: faseFerdig(elementer, e, dokMap) + '%', height: '100%', background: 'rgba(0,0,0,.30)' }}/>}
                    </div>
                    {koplingspunkt(e, l, w, y)}
                    <div style={{ position: 'absolute', left: l, top: y + 20, width: 0, height: 0, borderLeft: `6px solid ${farge}`,
                      borderBottom: '6px solid transparent', pointerEvents: 'none', zIndex: 4 }}/>
                    <div style={{ position: 'absolute', left: l + w - 6, top: y + 20, width: 0, height: 0, borderRight: `6px solid ${farge}`,
                      borderBottom: '6px solid transparent', pointerEvents: 'none', zIndex: 4 }}/>
                    <div style={{ position: 'absolute', left: l + w + 8, top: y, height: RAD_H, display: 'flex', alignItems: 'center',
                      fontSize: 11.5, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{e.namn}</div>
                    {dato}
                  </div>
                )
              }

              return (
                <div key={e.id}>
                  <div title={tipp} onMouseDown={ev => startDrag(ev, e, 'flytt')}
                    style={{ position: 'absolute', left: l, top: y + 7, width: w, height: 20, background: farge, borderRadius: 5,
                      cursor: 'default', zIndex: 4, overflow: 'hidden', display: 'flex', alignItems: 'center',
                      outline: sel ? `2.5px solid ${VALG_FARGE}` : undefined, outlineOffset: 1,
                      boxShadow: '0 1px 2px rgba(0,0,0,.25)' }}>
                    {effektivFerdig(e, dokMap) > 0 && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, effektivFerdig(e, dokMap))}%`,
                      background: 'rgba(0,0,0,.30)' }}/>}
                    {w >= 90 && <span style={{ position: 'relative', padding: '0 14px 0 8px', fontSize: 11.5, fontWeight: 700, color: '#fff',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', pointerEvents: 'none' }}>{e.namn}</span>}
                  </div>
                  <div onMouseDown={ev => startDrag(ev, e, 'start')} title="Dra for å endre starten"
                    style={{ position: 'absolute', left: l - 1, top: y + 7, width: 7, height: 20, cursor: 'ew-resize', zIndex: 5 }}/>
                  <div onMouseDown={ev => startDrag(ev, e, 'slutt')} title="Dra for å endre slutten"
                    style={{ position: 'absolute', left: l + w - 6, top: y + 7, width: 7, height: 20, cursor: 'ew-resize', zIndex: 5 }}/>
                  {koplingspunkt(e, l, w, y)}
                  {w < 90 && <div style={{ position: 'absolute', left: l + w + 7, top: y, height: RAD_H, display: 'flex', alignItems: 'center',
                    fontSize: 11.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{e.namn}</div>}
                  {dato}
                </div>
              )
            })}

            {idagSynleg && (
              <div title="I dag" style={{ position: 'absolute', left: todayX + dagB / 2 - 1, top: 0, bottom: 0, width: 2,
                background: '#DC2626', zIndex: 6, pointerEvents: 'none' }}/>
            )}
          </div>
        </div>

        {kolMeny && (
          <div data-kolmeny="1" style={{ position: 'fixed', left: Math.min(kolMeny.x, window.innerWidth - 230), top: Math.min(kolMeny.y, window.innerHeight - 440), width: 220, maxHeight: 430, overflow: 'auto', zIndex: 400,
            background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', boxShadow: 'var(--shadow-lg)', padding: 6 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text3)', padding: '6px 8px' }}>Kolonnar i tabellen</div>
            {KOLONNE_DEF.map(d => (
              <label key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6, cursor: 'default', fontSize: 12.5, color: 'var(--text)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <input type="checkbox" checked={valgteKol.includes(d.key)}
                  onChange={e => lagreKol(e.target.checked ? [...valgteKol, d.key] : valgteKol.filter(k => k !== d.key))}/>
                {d.label}
              </label>
            ))}
            <div style={{ display: 'flex', gap: 6, padding: '6px 8px 4px' }}>
              <button className="fd-knapp" style={{ flex: 1, padding: '3px 6px', fontSize: 11.5 }} onClick={() => lagreKol([])}>Fjern alle</button>
              <button className="fd-knapp hovud" style={{ flex: 1, padding: '3px 6px', fontSize: 11.5 }} onClick={() => setKolMeny(null)}>Ferdig</button>
            </div>
          </div>
        )}

        {rader.length === 0 && (
          <div style={{ position: 'absolute', left: VENSTRE, right: 0, top: topH + (visHendingar ? RAD_H : 0) + 20, textAlign: 'center',
            color: 'var(--text3)', fontSize: 13, pointerEvents: 'none', width: 'min(520px, 100%)', marginLeft: 40 }}>
            Ingen fasar eller aktivitetar enno. Bruk «+ Fase», «Malar…» eller «Importer…» øvst.
          </div>
        )}
      </div>
    </div>
    </div>
  )
}
