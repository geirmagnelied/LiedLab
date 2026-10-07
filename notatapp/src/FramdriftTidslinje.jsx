import { useState, useMemo, useRef, useEffect } from 'react'
import { addDays, differenceInCalendarDays, startOfWeek, endOfWeek, getISOWeek, format } from 'date-fns'
import { nb } from 'date-fns/locale'
import { helligdagNamn } from './helligdagar'
import { tilDato, formaterDato } from './framdriftDato'
import { beregnDatoar, harBorn } from './framdriftLogikk'

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
const VENSTRE = 300
const DAGB = { dag: 30, veke: 14, manad: 5, kvartal: 2.2 }
const FASEFARGAR = ['#2D6A4F', '#1565C0', '#B5296B', '#C2570C', '#0E7490', '#6D28D9', '#8A6D00']
const NEUTRAL = '#475569'
const FRIST_FARGE = '#B45309'
const MOTE_FARGE = '#1565C0'
const VALG_FARGE = '#1E3A8A'

export default function FramdriftTidslinje({ rader, elementer, valgt, onVelg, onEndre, hendingar, visHendingar,
                                              zoom, lukka, onToggleLukka, timarKart, overlast, visTimar }) {
  const dagB = DAGB[zoom] || DAGB.veke
  const scrollRef = useRef(null)
  const [drag, setDrag] = useState(null) // { id, modus, d }
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
        ut.push({ label: format(f, dagB * (i - start) > 90 ? 'MMMM yyyy' : 'MMM yy', { locale: nb }), left: start * dagB, width: (i - start) * dagB })
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
  const visVekenr = dagB * 7 >= 24
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
    const rot = e.type === 'fase' ? e : elementer.find(f => f.id === e.forelder)
    const i = rot ? fasar.findIndex(f => f.id === rot.id) : -1
    return i >= 0 ? FASEFARGAR[i % FASEFARGAR.length] : NEUTRAL
  }

  // Timar per veke (sum av alle aktivitetar) — eiga rad nedst
  const harTimar = visTimar && timarKart && timarKart.size > 0
  const maksTimar = harTimar ? Math.max(...[...timarKart.values()].map(v => v.total)) : 0
  const sumTimar = harTimar ? [...timarKart.values()].reduce((s2, v) => s2 + v.total, 0) : 0
  const radar = [
    ...(visHendingar ? [{ id: '__hendingar', type: 'hendingar' }] : []),
    ...rader,
    ...(harTimar ? [{ id: '__timar', type: 'timar' }] : []),
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

  const visDatoar = (e) => {
    if (!drag) return { start: e.start, slutt: e.slutt }
    if (drag.id === e.id) return beregnDatoar(e, drag.modus, drag.d)
    if (drag.modus === 'flytt' && e.forelder === drag.id) {
      const f = elementer.find(x => x.id === drag.id)
      if (f?.type === 'fase') {
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
      pilar.push({ key: `${p.id}-${e.id}`, sti, x2, y2 })
    }
  }

  const todayX = x(idag)
  const idagSynleg = todayX >= 0 && todayX <= breiddTotal
  const topH = visDagar ? 62 : 46

  return (
    <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', minHeight: 0, background: 'var(--bg2)',
      border: '1.5px solid var(--border)', borderRadius: 'var(--r2)', position: 'relative' }}>
      <div style={{ width: VENSTRE + breiddTotal, position: 'relative' }}>

        {/* ── Overskrift ── */}
        <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 8, height: topH, background: 'var(--bg3)',
          borderBottom: '2px solid var(--border)' }}>
          <div style={{ position: 'sticky', left: 0, zIndex: 9, width: VENSTRE, flexShrink: 0, background: 'var(--bg3)',
            borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'flex-end', padding: '0 12px 8px',
            fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text3)' }}>
            Fase / aktivitet
          </div>
          <div style={{ position: 'relative', width: breiddTotal, flexShrink: 0 }}>
            {manader.map((m, i) => (
              <div key={i} style={{ position: 'absolute', left: m.left, width: m.width, top: 0, height: 22,
                borderRight: '1px solid var(--border)', padding: '4px 8px', fontSize: 11.5, fontWeight: 800,
                color: 'var(--text)', textTransform: 'capitalize', overflow: 'hidden', whiteSpace: 'nowrap' }}>{m.label}</div>
            ))}
            {veker.map((v, i) => (
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
          <div style={{ position: 'sticky', left: 0, zIndex: 6, width: VENSTRE, flexShrink: 0, background: 'var(--bg2)',
            borderRight: '1px solid var(--border)' }}>
            {radar.map(r => {
              if (r.type === 'timar') {
                return (
                  <div key={r.id} style={{ height: RAD_H, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px',
                    borderBottom: '1px solid var(--border)', background: 'var(--bg3)', fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
                    <span style={{ width: 9, height: 9, background: '#0F766E', borderRadius: 2, flexShrink: 0 }}/>
                    Timar per veke
                    <span style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--text3)' }}>{Math.round(sumTimar * 2) / 2} t totalt</span>
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
              const erFase = r.type === 'fase'
              const sel = valgt === r.id
              return (
                <div key={r.id} onClick={() => onVelg(r.id)}
                  style={{ height: RAD_H, display: 'flex', alignItems: 'center', gap: 7, paddingLeft: 10 + (r.nivå || 0) * 20,
                    paddingRight: 8, borderBottom: '1px solid var(--border)', cursor: 'pointer',
                    background: sel ? 'var(--brandbg2)' : erFase ? 'var(--bg3)' : 'transparent',
                    boxShadow: sel ? `inset 3px 0 0 ${VALG_FARGE}` : undefined }}
                  title={`${r.namn}\n${formaterDato(r.start)} – ${formaterDato(r.slutt)}`}>
                  {erFase && harBorn(elementer, r.id) ? (
                    <button type="button" onClick={e => { e.stopPropagation(); onToggleLukka(r.id) }}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', width: 16, padding: 0,
                        fontSize: 11, color: 'var(--text3)' }}>{lukka.has(r.id) ? '▸' : '▾'}</button>
                  ) : <span style={{ width: 16, flexShrink: 0 }}/>}
                  <span style={{ width: r.type === 'milepael' ? 9 : 10, height: r.type === 'milepael' ? 9 : 10, flexShrink: 0,
                    background: fargeFor(r), transform: r.type === 'milepael' ? 'rotate(45deg)' : undefined,
                    borderRadius: r.type === 'aktivitet' ? 3 : 0 }}/>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontSize: erFase ? 13 : 12.5, fontWeight: erFase ? 800 : 500, color: 'var(--text)' }}>{r.namn}</span>
                  {r.type === 'aktivitet' && r.ferdig > 0 && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)' }}>{r.ferdig}%</span>
                  )}
                </div>
              )
            })}
            {radar.length === 0 && <div style={{ height: RAD_H }}/>}
          </div>

          {/* ── Tidslinje-flate ── */}
          <div style={{ position: 'relative', width: breiddTotal, flexShrink: 0, height: Math.max(radar.length, 1) * RAD_H }}
            onMouseDown={() => onVelg(null)}>
            {bakgrunn.map((b, i) => (
              <div key={i} title={b.tittel} style={{ position: 'absolute', left: b.left, width: b.width, top: 0, bottom: 0,
                background: b.helg ? 'rgba(185,28,28,.10)' : 'rgba(100,116,139,.09)' }}/>
            ))}
            {veker.map((v, i) => (
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
            {harTimar && [...timarKart.entries()].map(([veke, v]) => {
              const ob = overlast?.get(veke)
              const rad = radIndeks.get('__timar')
              const tekst = Math.round(v.total * 2) / 2
              const avr = (n) => Math.round(n * 2) / 2
              const linjer = [`Veke ${getISOWeek(tilDato(veke))}: ${tekst} t`,
                ...Object.entries(v.perPerson).map(([n, h]) => `${n}: ${avr(h)} t`)]
              if (ob) linjer.push('', 'OVERBELASTNING:', ...ob.map(o => `${o.namn}: ${avr(o.timar)} t av ${avr(o.kapasitet)} t kapasitet`))
              return (
                <div key={veke} title={linjer.join('\n')}
                  style={{ position: 'absolute', left: x(tilDato(veke)) + 1, width: dagB * 7 - 2, top: rad * RAD_H + 4, height: RAD_H - 8, borderRadius: 4,
                    background: `rgba(15,118,110,${0.14 + 0.5 * (maksTimar ? v.total / maksTimar : 0)})`,
                    outline: ob ? '2px solid #DC2626' : undefined, outlineOffset: -1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800,
                    color: ob ? '#B91C1C' : 'var(--text)', overflow: 'hidden', zIndex: 3 }}>
                  {dagB * 7 >= 24 ? tekst : ''}
                </div>
              )
            })}

            {/* Avhengnadspilar */}
            <svg width={breiddTotal} height={Math.max(radar.length, 1) * RAD_H}
              style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 2 }}>
              {pilar.map(p => (
                <g key={p.key}>
                  <path d={p.sti} fill="none" stroke="#64748B" strokeWidth="1.4"/>
                  <path d={`M${p.x2 - 1},${p.y2} l-5,-3.5 v7 z`} fill="#64748B"/>
                </g>
              ))}
            </svg>

            {/* Stolpar */}
            {rader.map(e => {
              const i = radIndeks.get(e.id)
              const y = i * RAD_H
              const vd = visDatoar(e)
              const l = x(tilDato(vd.start))
              const w = Math.max(dagB, (differenceInCalendarDays(tilDato(vd.slutt), tilDato(vd.start)) + 1) * dagB)
              const farge = fargeFor(e)
              const sel = valgt === e.id
              const dragger = drag?.id === e.id
              const erFase = e.type === 'fase'
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
                        transform: 'rotate(45deg)', background: farge, cursor: 'grab', zIndex: 4,
                        outline: sel ? `2.5px solid ${VALG_FARGE}` : '2px solid #fff', outlineOffset: sel ? 1 : 0 }}/>
                    <div style={{ position: 'absolute', left: cx + 14, top: y, height: RAD_H, display: 'flex', alignItems: 'center',
                      fontSize: 11.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{e.namn}</div>
                    {dato}
                  </div>
                )
              }

              if (erFase) {
                return (
                  <div key={e.id}>
                    <div title={tipp} onMouseDown={ev => startDrag(ev, e, 'flytt')}
                      style={{ position: 'absolute', left: l, top: y + 9, width: w, height: 11, background: farge,
                        borderRadius: 2, cursor: 'grab', zIndex: 4, outline: sel ? `2.5px solid ${VALG_FARGE}` : undefined, outlineOffset: 1 }}/>
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
                      cursor: 'grab', zIndex: 4, overflow: 'hidden', display: 'flex', alignItems: 'center',
                      outline: sel ? `2.5px solid ${VALG_FARGE}` : undefined, outlineOffset: 1,
                      boxShadow: '0 1px 2px rgba(0,0,0,.25)' }}>
                    {e.ferdig > 0 && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, e.ferdig)}%`,
                      background: 'rgba(0,0,0,.30)' }}/>}
                    {w >= 90 && <span style={{ position: 'relative', padding: '0 14px 0 8px', fontSize: 11.5, fontWeight: 700, color: '#fff',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', pointerEvents: 'none' }}>{e.namn}</span>}
                  </div>
                  <div onMouseDown={ev => startDrag(ev, e, 'start')} title="Dra for å endre starten"
                    style={{ position: 'absolute', left: l - 1, top: y + 7, width: 7, height: 20, cursor: 'ew-resize', zIndex: 5 }}/>
                  <div onMouseDown={ev => startDrag(ev, e, 'slutt')} title="Dra for å endre slutten"
                    style={{ position: 'absolute', left: l + w - 6, top: y + 7, width: 7, height: 20, cursor: 'ew-resize', zIndex: 5 }}/>
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

        {rader.length === 0 && (
          <div style={{ position: 'absolute', left: VENSTRE, right: 0, top: topH + (visHendingar ? RAD_H : 0) + 20, textAlign: 'center',
            color: 'var(--text3)', fontSize: 13, pointerEvents: 'none', width: 'min(520px, 100%)', marginLeft: 40 }}>
            Ingen fasar eller aktivitetar enno. Bruk «+ Fase», «Malar…» eller «Importer…» øvst.
          </div>
        )}
      </div>
    </div>
  )
}
