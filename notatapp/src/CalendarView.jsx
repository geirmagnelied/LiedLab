import { useState } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays,
  isSameDay, isSameMonth, isToday, parseISO, getISOWeek } from 'date-fns'
import { nb } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import NoteList from './NoteList'

const TAG_COLORS = { 'møte': '#1565C0', 'oppgåve': '#6D4EC7', 'frist': '#C25A00', 'idé': '#1A7A50' }
const DOW = ['ma', 'ti', 'on', 'to', 'fr', 'lø', 'sø']

function CalGrid({ notes, current, setCurrent, selected, setSelected, compact }) {
  const monthStart = startOfMonth(current)
  const monthEnd   = endOfMonth(current)
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd    = endOfWeek(monthEnd,     { weekStartsOn: 1 })

  const rows = []
  let day = gridStart
  while (day <= gridEnd) {
    const week = []
    for (let i = 0; i < 7; i++) { week.push(day); day = addDays(day, 1) }
    rows.push(week)
  }
  const notesOnDay = d => notes.filter(n => n.date && isSameDay(parseISO(n.date), d) && !n.done)

  return (
    <div style={{ padding: compact ? '10px 10px 6px' : 0 }}>
      {/* Month nav — green header in compact mode to match topbar height */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: compact ? 8 : 14,
        ...(compact ? {
          background: 'var(--brand)',
          margin: '-10px -10px 8px -10px',
          padding: '0 6px',
          height: 50,
          borderBottom: '1px solid rgba(255,255,255,.12)',
        } : {})
      }}>
        <button onClick={() => setCurrent(d => new Date(d.getFullYear(), d.getMonth() - 1))}
          style={{ background: 'none', border: 'none', color: compact ? 'rgba(255,255,255,.7)' : 'var(--text2)', cursor: 'pointer', padding: 4, borderRadius: 'var(--r)' }}>
          <ChevronLeft size={compact ? 14 : 17} />
        </button>
        <span style={{ fontSize: compact ? 12 : 14, fontWeight: 700, textTransform: 'capitalize', color: compact ? '#fff' : 'var(--text)', letterSpacing: '-0.01em' }}>
          {format(current, 'MMMM yyyy', { locale: nb })}
        </span>
        <button onClick={() => setCurrent(d => new Date(d.getFullYear(), d.getMonth() + 1))}
          style={{ background: 'none', border: 'none', color: compact ? 'rgba(255,255,255,.7)' : 'var(--text2)', cursor: 'pointer', padding: 4, borderRadius: 'var(--r)' }}>
          <ChevronRight size={compact ? 14 : 17} />
        </button>
      </div>

      {/* DOW header */}
      <div style={{ display: 'grid', gridTemplateColumns: '26px repeat(7, 1fr)', gap: 1, marginBottom: 2 }}>
        <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700, textAlign: 'center', padding: '2px 0', textTransform: 'uppercase' }}>veke</div>
        {DOW.map(d => <div key={d} style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700, textAlign: 'center', padding: '2px 0', textTransform: 'uppercase', letterSpacing: '.04em' }}>{d}</div>)}
      </div>

      {/* Rows */}
      {rows.map((week, wi) => (
        <div key={wi} style={{ display: 'grid', gridTemplateColumns: '26px repeat(7, 1fr)', gap: 1, marginBottom: 1 }}>
          {/* Week number */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--text3)', fontWeight: 700, borderRadius: 4, background: 'var(--bg3)', border: '1px solid var(--border)' }}>
            {getISOWeek(week[0])}
          </div>
          {week.map((d, di) => {
            const dn      = notesOnDay(d)
            const inMonth = isSameMonth(d, current)
            const isSel   = isSameDay(d, selected)
            const isT     = isToday(d)
            const h       = compact ? 26 : 50
            return (
              <button key={di} onClick={() => setSelected(d)}
                style={{ minHeight: h, borderRadius: 5, padding: '2px', cursor: 'pointer', border: `1px solid ${isSel ? 'var(--accent)' : 'transparent'}`, background: isSel ? 'rgba(194,90,0,.1)' : isT ? 'rgba(194,90,0,.06)' : 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, transition: 'background .1s' }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--bg3)' }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = isT ? 'rgba(194,90,0,.06)' : 'transparent' }}>
                <span style={{ fontSize: compact ? 10 : 12, fontWeight: isT ? 700 : 400, color: !inMonth ? 'var(--text3)' : isT ? 'var(--accent)' : 'var(--text)', width: compact ? 17 : 21, height: compact ? 17 : 21, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: isT ? 'rgba(194,90,0,.15)' : 'transparent' }}>
                  {format(d, 'd')}
                </span>
                {dn.length > 0 && (
                  <div style={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {dn.slice(0, compact ? 3 : 4).map((n, j) => (
                      <div key={j} style={{ width: compact ? 4 : 5, height: compact ? 4 : 5, borderRadius: '50%', background: n.tag ? TAG_COLORS[n.tag] || 'var(--text3)' : 'var(--text3)' }} />
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export default function CalendarView({ notes, projects, onDelete, onToggleDone, onEdit, compact }) {
  const [current,  setCurrent]  = useState(new Date())
  const [selected, setSelected] = useState(new Date())
  const selectedNotes = notes.filter(n => n.date && isSameDay(parseISO(n.date), selected) && !n.done)

  if (compact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <CalGrid notes={notes} current={current} setCurrent={setCurrent} selected={selected} setSelected={setSelected} compact />
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 7, textTransform: 'capitalize' }}>
            {format(selected, 'EEEE d. MMMM', { locale: nb })}
            <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text3)', fontWeight: 400 }}>veke {getISOWeek(selected)}</span>
          </div>
          {!selectedNotes.length
            ? <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', paddingTop: 10 }}>Ingen notatar</div>
            : selectedNotes.map(n => (
              <div key={n.id} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 9px', marginBottom: 5, fontSize: 11, color: 'var(--text)', lineHeight: 1.5, cursor: 'pointer' }} dangerouslySetInnerHTML={{ __html: n.html || n.text }} />
            ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24 }}>
      <CalGrid notes={notes} current={current} setCurrent={setCurrent} selected={selected} setSelected={setSelected} compact={false} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)', textTransform: 'capitalize' }}>
          {format(selected, 'EEEE d. MMMM', { locale: nb })}
          <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>veke {getISOWeek(selected)}</span>
        </div>
        {!selectedNotes.length
          ? <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', paddingTop: 20 }}>Ingen notatar denne dagen</div>
          : <NoteList notes={selectedNotes} projects={projects} onDelete={onDelete} onToggleDone={onToggleDone} onEdit={onEdit} />}
      </div>
    </div>
  )
}
