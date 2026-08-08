import { useState, useRef, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays,
  addMonths, subMonths, isSameDay, isSameMonth, isToday, parseISO } from 'date-fns'
import { nb } from 'date-fns/locale'

// ── Delt norsk datoveljar (måndag først, norske namn) ────────────────
// Erstatning for <input type="date">, som alltid følgjer nettlesaren/OS sine
// eigne lokale-innstillingar og ikkje kan tvingast til måndag-først/norsk via kode.
export default function DatePicker({ value, onChange, placeholder }) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => value ? parseISO(value) : new Date())
  const ref = useRef(null)

  useEffect(() => {
    if (value) setViewMonth(parseISO(value))
  }, [open]) // eslint-disable-line

  useEffect(() => {
    if (!open) return
    const onDocClick = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const selectedDate = value ? parseISO(value) : null
  const monthStart = startOfMonth(viewMonth)
  const monthEnd   = endOfMonth(viewMonth)
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd    = endOfWeek(monthEnd,     { weekStartsOn: 1 })
  const rows = []
  let day = gridStart
  while (day <= gridEnd) {
    const week = []
    for (let i = 0; i < 7; i++) { week.push(day); day = addDays(day, 1) }
    rows.push(week)
  }
  const DOW = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'L\u00F8r', 'S\u00F8n']

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button type="button" onClick={()=>setOpen(o=>!o)}
        className="saker-field-input"
        style={{ textAlign:'left', cursor:'pointer', background:'var(--bg2)',
          color: value ? 'var(--text)' : 'var(--text3)', display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:14 }}>{'\u{1F4C5}'}</span>
        {value ? format(selectedDate, 'dd.MM.yyyy', { locale: nb }) : (placeholder || 'Vel dato')}
        {value && (
          <span onClick={e=>{ e.stopPropagation(); onChange(''); }}
            style={{ marginLeft:'auto', color:'var(--text3)', fontSize:13, padding:'0 2px' }}
            title="Fjern dato">{'\u00D7'}</span>
        )}
      </button>

      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:300,
          background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r2)',
          boxShadow:'0 12px 32px rgba(0,0,0,.18)', padding:12, width:270 }}>

          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <button type="button" onClick={()=>setViewMonth(m=>subMonths(m,1))}
              style={{ background:'none', border:'none', cursor:'pointer', fontSize:15, color:'var(--text3)', padding:4 }}>{'\u2039'}</button>
            <span style={{ fontWeight:700, fontSize:13, textTransform:'capitalize' }}>
              {format(viewMonth, 'MMMM yyyy', { locale: nb })}
            </span>
            <button type="button" onClick={()=>setViewMonth(m=>addMonths(m,1))}
              style={{ background:'none', border:'none', cursor:'pointer', fontSize:15, color:'var(--text3)', padding:4 }}>{'\u203A'}</button>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:2, marginBottom:2 }}>
            {DOW.map(d => (
              <div key={d} style={{ textAlign:'center', fontSize:10, fontWeight:700, color:'var(--text3)', padding:'2px 0' }}>{d}</div>
            ))}
          </div>

          {rows.map((week, wi) => (
            <div key={wi} style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:2 }}>
              {week.map((d, di) => {
                const inMonth = isSameMonth(d, viewMonth)
                const sel = selectedDate && isSameDay(d, selectedDate)
                const today = isToday(d)
                return (
                  <button type="button" key={di}
                    onClick={()=>{ onChange(format(d, 'yyyy-MM-dd')); setOpen(false) }}
                    style={{ padding:'6px 0', borderRadius:6, border: today && !sel ? '1.5px solid var(--brand2)' : '1.5px solid transparent',
                      background: sel ? 'var(--brand)' : 'transparent',
                      color: sel ? '#fff' : inMonth ? 'var(--text)' : 'var(--text3)',
                      opacity: inMonth ? 1 : .4, fontSize:12, fontWeight: sel ? 700 : 500,
                      cursor:'pointer', fontFamily:'var(--font)' }}>
                    {format(d, 'd')}
                  </button>
                )
              })}
            </div>
          ))}

          <button type="button" onClick={()=>{ onChange(format(new Date(), 'yyyy-MM-dd')); setOpen(false) }}
            style={{ width:'100%', marginTop:8, padding:'6px 0', borderRadius:6, border:'1px solid var(--border)',
              background:'var(--bg3)', color:'var(--text3)', fontSize:11.5, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)' }}>
            I dag
          </button>
        </div>
      )}
    </div>
  )
}
