import { useState } from 'react'
import { parseISO, isToday, isTomorrow, isPast, isWithinInterval, addDays, addMonths,
         startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns'
import { nb } from 'date-fns/locale'
import NoteList from './NoteList'

// A note is "due" if any of its open tasks has a date matching the filter
function notesDue(notes, filterFn) {
  return notes.filter(n => {
    if (n.done) return false
    const tasks = (n.tasks || []).filter(t => !t.done && t.date)
    return tasks.some(t => filterFn(parseISO(t.date)))
  })
}

const FILTERS = [
  { key: 'overdue',   letter: 'O', label: 'Overskride',  color: 'var(--danger)' },
  { key: 'today',      letter: 'D', label: 'I dag',       color: 'var(--warn)' },
  { key: 'tomorrow',   letter: 'M', label: 'I morgon',    color: '#B85C00' },
  { key: 'thisWeek',   letter: 'V', label: 'Denne veka',  color: 'var(--info)' },
  { key: 'nextWeek',   letter: 'N', label: 'Neste veke',  color: 'var(--brand)' },
  { key: 'nextMonth',  letter: 'Å', label: 'Neste månad', color: 'var(--text2)' },
]

export default function DeadlineView({ notes, projects, onDelete, onToggleDone, onEdit, onUpdateTask, onDeleteTask, onAddTask }) {
  const [activeFilters, setActiveFilters] = useState(new Set())  // empty = show all

  const now      = new Date()
  const wStart   = startOfWeek(now, { weekStartsOn: 1 })
  const wEnd     = endOfWeek(now,   { weekStartsOn: 1 })
  const nwStart  = addDays(wEnd, 1)
  const nwEnd    = addDays(nwStart, 6)
  const nmStart  = startOfMonth(addMonths(now, 1))
  const nmEnd    = endOfMonth(addMonths(now, 1))

  const buckets = {
    overdue:   notesDue(notes, d => isPast(d) && !isToday(d)),
    today:     notesDue(notes, d => isToday(d)),
    tomorrow:  notesDue(notes, d => isTomorrow(d)),
    thisWeek:  notesDue(notes, d => !isToday(d) && !isTomorrow(d) && !isPast(d) && isWithinInterval(d, { start: wStart, end: wEnd })),
    nextWeek:  notesDue(notes, d => isWithinInterval(d, { start: nwStart, end: nwEnd })),
    nextMonth: notesDue(notes, d => isWithinInterval(d, { start: nmStart, end: nmEnd })),
  }

  // De-duplicate across buckets (a note may match multiple — keep earliest bucket only)
  const order = ['overdue','today','tomorrow','thisWeek','nextWeek','nextMonth']
  const seen = new Set()
  const dedup = {}
  for (const key of order) {
    dedup[key] = buckets[key].filter(n => { if (seen.has(n.id)) return false; seen.add(n.id); return true })
  }

  const toggleFilter = (key) => {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const visibleKeys = activeFilters.size === 0 ? order : order.filter(k => activeFilters.has(k))
  const total = order.reduce((s, k) => s + dedup[k].length, 0)

  const labelFor = (key) => {
    if (key === 'thisWeek')  return `Denne veka (${format(wStart, 'd. MMM', { locale: nb })}–${format(wEnd, 'd. MMM', { locale: nb })})`
    if (key === 'nextWeek')  return `Neste veke (${format(nwStart, 'd. MMM', { locale: nb })}–${format(nwEnd, 'd. MMM', { locale: nb })})`
    if (key === 'nextMonth') return `Neste månad (${format(nmStart, 'MMMM', { locale: nb })})`
    return FILTERS.find(f => f.key === key)?.label || key
  }

  return (
    <div>
      {/* Filter pills */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
        {FILTERS.map(f => {
          const count  = dedup[f.key].length
          const active = activeFilters.has(f.key)
          return (
            <button key={f.key} onClick={() => toggleFilter(f.key)}
              style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 13px',
                border:`1.5px solid ${active ? f.color : 'var(--border)'}`,
                borderRadius:'var(--r2)',
                background: active ? `${f.color}14` : 'var(--bg2)',
                color: active ? f.color : 'var(--text2)',
                fontSize:14, fontWeight: active ? 700 : 500, cursor:'pointer',
                transition:'all .15s' }}>
              <span style={{ width:22, height:22, borderRadius:6,
                background: active ? f.color : 'var(--bg3)',
                color: active ? '#fff' : 'var(--text3)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:12, fontWeight:800, flexShrink:0 }}>{f.letter}</span>
              {f.label}
              {count > 0 && (
                <span style={{ fontSize:11, fontWeight:700,
                  background: active ? f.color : 'var(--bg3)',
                  color: active ? '#fff' : 'var(--text3)',
                  borderRadius:10, padding:'1px 7px' }}>{count}</span>
              )}
            </button>
          )
        })}
        {activeFilters.size > 0 && (
          <button onClick={() => setActiveFilters(new Set())}
            style={{ padding:'7px 13px', border:'1.5px solid var(--border)',
              borderRadius:'var(--r2)', background:'var(--bg2)', color:'var(--text3)',
              fontSize:13, fontWeight:500, cursor:'pointer' }}>
            Vis alle
          </button>
        )}
      </div>

      {total === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:'var(--text3)' }}>
          <div style={{ fontSize:16, fontWeight:600, color:'var(--text2)', marginBottom:6 }}>
            Ingen fristar på oppgåver
          </div>
          <div style={{ fontSize:13 }}>Legg til frist på ei arbeidsoppgåve for å sjå den her</div>
        </div>
      ) : (
        visibleKeys.map(key => {
          const items = dedup[key]
          if (!items.length) return null
          const color = FILTERS.find(f => f.key === key)?.color
          return (
            <div key={key} style={{ marginBottom:24 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10,
                paddingBottom:7, borderBottom:`2px solid ${color}44` }}>
                <span style={{ fontSize:13, fontWeight:700, textTransform:'uppercase',
                  letterSpacing:'.06em', color }}>{labelFor(key)}</span>
                <span style={{ fontSize:11, background:`${color}18`, color,
                  borderRadius:10, padding:'2px 9px', fontWeight:700 }}>{items.length}</span>
              </div>
              <NoteList notes={items} projects={projects} onDelete={onDelete} onToggleDone={onToggleDone} onEdit={onEdit}
                onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} onAddTask={onAddTask}/>
            </div>
          )
        })
      )}
    </div>
  )
}
