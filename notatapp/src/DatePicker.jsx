import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameDay, isSameMonth, getISOWeek, getISOWeekYear, parseISO, isValid } from 'date-fns'
import { nb } from 'date-fns/locale'
import { helligdagNamn } from './helligdagar'

// ═══════════════════════════════════════════════════════════════════
//  DatePicker — delt NORSK datoveljar (erstattar <input type="date"/"week"/"month"/"datetime-local">, som følgjer OS/nettlesar sitt
//  språk — ofte engelsk, månad/dag/år, søndag først). Her: dd.mm.åååå, måndag først, norske månads- og vekedagsnamn, vekenummer,
//  helgedagar/helligdagar i raudt, «I dag» og «Fjern». Verdi (value/onChange) er ALLTID tekst:
//    modus 'dato'  → 'ÅÅÅÅ-MM-DD'      modus 'veke'  → 'ÅÅÅÅ-Www'      modus 'manad' → 'ÅÅÅÅ-MM'
//  Du kan skrive datoen direkte (dd.mm.åååå, dd.mm.åå, ddmmåååå, dd.mm = inneverande år) eller velje i kalenderen.
//  Props: className / style (vert sett på tekstfeltet, så eksisterande utsjånad kan behaldast), min / max ('ÅÅÅÅ-MM-DD'), vedTom.
// ═══════════════════════════════════════════════════════════════════
const DOW = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']
const MND_KORT = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']
const iso = (d) => format(d, 'yyyy-MM-dd')
const z = (n) => String(n).padStart(2, '0')

export function tolkDatoTekst(t) {
  const s = String(t || '').trim()
  let m = /^(\d{1,2})[./\-\s](\d{1,2})[./\-\s](\d{2}|\d{4})$/.exec(s)
  if (!m) { const r = /^(\d{2})(\d{2})(\d{4})$/.exec(s); if (r) m = r }
  if (!m) { const k = /^(\d{1,2})[./](\d{1,2})\.?$/.exec(s); if (k) m = [null, k[1], k[2], String(new Date().getFullYear())] }
  if (!m) return null
  let [, d, mo, y] = m; y = +y; if (y < 100) y += 2000
  const dt = new Date(y, +mo - 1, +d)
  return dt.getFullYear() === y && dt.getMonth() === +mo - 1 && dt.getDate() === +d ? iso(dt) : null
}
const visDato = (v) => { if (!v) return ''; const d = parseISO(v); return isValid(d) ? format(d, 'dd.MM.yyyy') : '' }
const vekeTilDato = (v) => { const m = /^(\d{4})-W(\d{2})$/.exec(v || ''); if (!m) return null; const j4 = new Date(+m[1], 0, 4); const man = addDays(startOfWeek(j4, { weekStartsOn: 1 }), (+m[2] - 1) * 7); return man }
const visVeke = (v) => { const m = /^(\d{4})-W(\d{2})$/.exec(v || ''); return m ? `Veke ${+m[2]} · ${m[1]}` : '' }
const visManad = (v) => { const m = /^(\d{4})-(\d{2})$/.exec(v || ''); return m ? `${format(new Date(+m[1], +m[2] - 1, 1), 'MMMM', { locale: nb })} ${m[1]}` : '' }

const STD_INPUT = { width: '100%', padding: '8px 34px 8px 10px', borderRadius: 'var(--r)', border: '1.5px solid var(--border)', background: 'var(--bg2)', fontSize: 14, fontFamily: 'var(--font)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }

export default function DatePicker({ value, onChange, placeholder, modus = 'dato', min, max, className, style, wrapStyle, vedTom = true, disabled, tittel }) {
  const [open, setOpen] = useState(false)
  const [tekst, setTekst] = useState('')
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [visMnd, setVisMnd] = useState(() => new Date())
  const rot = useRef(null)
  const pop = useRef(null)
  const lesbar = modus !== 'dato'

  const formatert = modus === 'veke' ? visVeke(value) : modus === 'manad' ? visManad(value) : visDato(value)
  useEffect(() => { setTekst(formatert) }, [formatert])
  useEffect(() => {
    if (!open) return
    const v = modus === 'veke' ? vekeTilDato(value) : modus === 'manad' ? (/^\d{4}-\d{2}$/.test(value || '') ? new Date(+value.slice(0, 4), +value.slice(5, 7) - 1, 1) : null) : (value ? parseISO(value) : null)
    setVisMnd(v && isValid(v) ? v : new Date())
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return undefined
    const ned = (e) => { if (rot.current && !rot.current.contains(e.target)) setOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', ned); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', ned); document.removeEventListener('keydown', esc) }
  }, [open])
  // plassering (fast, så ho ikkje vert klipt av vindauge med overflow)
  useLayoutEffect(() => {
    if (!open || !rot.current) return
    const r = rot.current.getBoundingClientRect()
    const hogd = modus === 'manad' ? 250 : 360, bredde = 310
    let top = r.bottom + 4
    if (top + hogd > window.innerHeight - 8) top = Math.max(8, r.top - hogd - 4)
    setPos({ top, left: Math.max(8, Math.min(r.left, window.innerWidth - bredde - 8)) })
  }, [open, modus])

  const forbode = (d) => (min && iso(d) < min) || (max && iso(d) > max)
  const sett = (v) => { onChange(v); setOpen(false) }
  const fullfor = () => {
    if (lesbar) return
    const t = tekst.trim()
    if (!t) { if (value) onChange(''); return }
    const v = tolkDatoTekst(t)
    if (v && !(min && v < min) && !(max && v > max)) { if (v !== value) onChange(v); setTekst(visDato(v)) } else setTekst(formatert)
  }

  const valdDato = modus === 'dato' && value ? parseISO(value) : null
  const valdVeke = modus === 'veke' ? vekeTilDato(value) : null
  const idag = new Date()
  const gridStart = startOfWeek(startOfMonth(visMnd), { weekStartsOn: 1 })
  const gridSlutt = endOfWeek(endOfMonth(visMnd), { weekStartsOn: 1 })
  const rader = []
  for (let d = gridStart; d <= gridSlutt;) { const uke = []; for (let i = 0; i < 7; i++) { uke.push(d); d = addDays(d, 1) } rader.push(uke) }
  const navKnapp = { background: 'var(--bg3)', border: 'none', borderRadius: 7, cursor: 'pointer', width: 28, height: 28, fontSize: 15, color: 'var(--text2)', fontFamily: 'var(--font)' }

  return (
    <div ref={rot} style={{ position: 'relative', ...wrapStyle }}>
      <input type="text" value={tekst} disabled={disabled} readOnly={lesbar} title={tittel}
        placeholder={placeholder || (modus === 'veke' ? 'Vel veke' : modus === 'manad' ? 'Vel månad' : 'dd.mm.åååå')}
        inputMode={lesbar ? undefined : 'numeric'}
        onChange={e => setTekst(e.target.value)} onBlur={fullfor}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); fullfor() } if (e.key === 'ArrowDown' || (lesbar && e.key === ' ')) setOpen(true) }}
        onClick={() => { if (lesbar) setOpen(true) }}
        className={className}
        style={className ? { ...style, paddingRight: 30, cursor: lesbar ? 'default' : undefined } : { ...STD_INPUT, ...style, cursor: lesbar ? 'default' : undefined }}/>
      <button type="button" onClick={() => !disabled && setOpen(o => !o)} tabIndex={-1} title="Opne kalender" disabled={disabled}
        style={{ position: 'absolute', right: 3, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, padding: '2px 5px', lineHeight: 1, color: 'var(--text3)' }}>📅</button>

      {open && (
        <div ref={pop} onMouseDown={e => e.preventDefault()}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 2000, width: 310, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 18px 50px rgba(0,0,0,.28)', padding: 14 }}>
          {/* navigasjon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <button type="button" onClick={() => setVisMnd(m => addMonths(m, -12))} style={navKnapp} title="Eitt år attende">«</button>
            {modus !== 'manad' && <button type="button" onClick={() => setVisMnd(m => subMonths(m, 1))} style={navKnapp} title="Førre månad">‹</button>}
            <div style={{ flex: 1, textAlign: 'center', fontSize: 14.5, fontWeight: 800, color: 'var(--text)', textTransform: 'capitalize', letterSpacing: '-.01em' }}>
              {modus === 'manad' ? format(visMnd, 'yyyy') : format(visMnd, 'MMMM yyyy', { locale: nb })}
            </div>
            {modus !== 'manad' && <button type="button" onClick={() => setVisMnd(m => addMonths(m, 1))} style={navKnapp} title="Neste månad">›</button>}
            <button type="button" onClick={() => setVisMnd(m => addMonths(m, 12))} style={navKnapp} title="Eit år fram">»</button>
          </div>

          {modus === 'manad' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {MND_KORT.map((n, i) => {
                const v = `${visMnd.getFullYear()}-${z(i + 1)}`
                const sel = value === v, na = idag.getFullYear() === visMnd.getFullYear() && idag.getMonth() === i
                return <button type="button" key={n} onClick={() => sett(v)}
                  style={{ padding: '10px 0', borderRadius: 9, border: '1.5px solid ' + (na && !sel ? 'var(--brand)' : 'transparent'), background: sel ? 'var(--brand)' : 'var(--bg3)', color: sel ? '#fff' : 'var(--text)', fontWeight: sel ? 800 : 600, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)', textTransform: 'capitalize' }}>{n}.</button>
              })}
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '30px repeat(7, 1fr)', gap: 2, marginBottom: 3 }}>
                <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text3)', padding: '3px 0' }}>Uke</div>
                {DOW.map((d, i) => <div key={d} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 800, color: i === 6 ? 'var(--danger, #c0392b)' : 'var(--text3)', padding: '3px 0', textTransform: 'uppercase', letterSpacing: '.03em' }}>{d}</div>)}
              </div>
              {rader.map((uke, wi) => {
                const ukeMan = uke[0], ukeNr = getISOWeek(ukeMan)
                const erValdVeke = valdVeke && isSameDay(valdVeke, ukeMan)
                return (
                  <div key={wi} style={{ display: 'grid', gridTemplateColumns: '30px repeat(7, 1fr)', gap: 2, marginBottom: 2, borderRadius: 8, background: erValdVeke ? 'var(--brandbg2)' : 'transparent' }}>
                    <button type="button" onClick={() => modus === 'veke' && sett(`${getISOWeekYear(ukeMan)}-W${z(ukeNr)}`)} title={modus === 'veke' ? 'Vel veke ' + ukeNr : 'Veke ' + ukeNr}
                      style={{ border: 'none', background: 'transparent', fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', cursor: modus === 'veke' ? 'pointer' : 'default', fontFamily: 'var(--font)', padding: 0 }}>{ukeNr}</button>
                    {uke.map((d, di) => {
                      const iMnd = isSameMonth(d, visMnd), sel = valdDato && isSameDay(d, valdDato), na = isSameDay(d, idag)
                      const helg = di === 6 || helligdagNamn(d), av = forbode(d)
                      return (
                        <button type="button" key={di} disabled={av} title={helligdagNamn(d) || undefined}
                          onClick={() => sett(modus === 'veke' ? `${getISOWeekYear(d)}-W${z(getISOWeek(d))}` : iso(d))}
                          style={{ padding: '7px 0', borderRadius: 8, border: '1.5px solid ' + (na && !sel ? 'var(--brand)' : 'transparent'),
                            background: sel ? 'var(--brand)' : 'transparent', color: sel ? '#fff' : helg ? 'var(--danger, #c0392b)' : 'var(--text)',
                            opacity: av ? .25 : iMnd ? 1 : .38, fontSize: 12.5, fontWeight: sel || na ? 800 : 500, cursor: av ? 'default' : 'pointer', fontFamily: 'var(--font)' }}
                          onMouseEnter={e => { if (!sel && !av) e.currentTarget.style.background = 'var(--bg3)' }} onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent' }}>
                          {format(d, 'd')}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" onClick={() => sett(modus === 'veke' ? `${getISOWeekYear(idag)}-W${z(getISOWeek(idag))}` : modus === 'manad' ? format(idag, 'yyyy-MM') : iso(idag))}
              style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', background: 'var(--brandbg)', color: 'var(--brand)', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font)' }}>
              {modus === 'veke' ? 'Denne veka' : modus === 'manad' ? 'Denne månaden' : 'I dag'}
            </button>
            {vedTom && value && <button type="button" onClick={() => sett('')} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>Fjern</button>}
          </div>
        </div>
      )}
    </div>
  )
}

// Dato + klokkeslett (24-timars, norsk) — erstattar <input type="datetime-local">. Verdi: 'ÅÅÅÅ-MM-DDTHH:mm' (eller '' / berre dato utan klokkeslett).
export function DatoTid({ value, onChange, className, style, placeholder }) {
  const [dato, tid] = String(value || '').split('T')
  const [tidTekst, setTidTekst] = useState(tid ? tid.slice(0, 5) : '')
  useEffect(() => { setTidTekst(tid ? tid.slice(0, 5) : '') }, [tid])
  const kjem = (d, t) => onChange(d ? (t ? `${d}T${t}` : `${d}T00:00`) : '')
  const fullforTid = () => {
    const m = /^(\d{1,2})[.:]?(\d{2})?$/.exec(tidTekst.trim())
    if (!m) { setTidTekst(tid ? tid.slice(0, 5) : ''); return }
    const h = Math.min(23, +m[1]), mi = Math.min(59, +(m[2] || 0)); const t = `${z(h)}:${z(mi)}`
    setTidTekst(t); kjem(dato || iso(new Date()), t)
  }
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <div style={{ flex: 1, minWidth: 130 }}><DatePicker value={dato || ''} onChange={d => kjem(d, tidTekst)} className={className} style={style} placeholder={placeholder}/></div>
      <input type="text" value={tidTekst} onChange={e => setTidTekst(e.target.value)} onBlur={fullforTid} onKeyDown={e => e.key === 'Enter' && fullforTid()} placeholder="tt:mm" inputMode="numeric"
        className={className} style={{ ...(className ? null : STD_INPUT), ...style, width: 72, flex: '0 0 72px', paddingRight: 10, textAlign: 'center' }}/>
    </div>
  )
}
