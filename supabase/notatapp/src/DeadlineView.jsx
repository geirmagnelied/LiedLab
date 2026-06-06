import { parseISO, isToday, isTomorrow, isPast, isWithinInterval, addDays, startOfWeek, endOfWeek, format } from 'date-fns'
import { nb } from 'date-fns/locale'
import { AlertTriangle, Clock, CalendarDays } from 'lucide-react'
import NoteList from './NoteList'

// A note is "due" if any of its open tasks has a date, or if the note itself had a date (legacy)
function notesDue(notes, filterFn) {
  return notes.filter(n => {
    if (n.done) return false
    const tasks = (n.tasks || []).filter(t => !t.done && t.date)
    return tasks.some(t => filterFn(parseISO(t.date)))
  })
}

export default function DeadlineView({ notes, projects, onDelete, onToggleDone, onEdit, onUpdateTask, onDeleteTask, onAddTask }) {
  const now    = new Date()
  const wStart = startOfWeek(now, { weekStartsOn: 1 })
  const wEnd   = endOfWeek(now,   { weekStartsOn: 1 })
  const nwStart = addDays(wEnd, 1)
  const nwEnd   = addDays(nwStart, 6)

  const overdue = notesDue(notes, d => isPast(d) && !isToday(d))
  const tod     = notesDue(notes, d => isToday(d))
  const tom     = notesDue(notes, d => isTomorrow(d))
  const thisW   = notesDue(notes, d => !isToday(d) && !isTomorrow(d) && !isPast(d) && isWithinInterval(d, { start: wStart, end: wEnd }))
  const nextW   = notesDue(notes, d => isWithinInterval(d, { start: nwStart, end: nwEnd }))
  const later   = notesDue(notes, d => d > nwEnd)

  // De-duplicate across buckets (a note may match multiple buckets — put in earliest)
  const seen = new Set()
  const dedup = (arr) => arr.filter(n => { if (seen.has(n.id)) return false; seen.add(n.id); return true })
  const od2 = dedup(overdue), td2 = dedup(tod), tm2 = dedup(tom), tw2 = dedup(thisW), nw2 = dedup(nextW), lt2 = dedup(later)

  const Sec = ({ icon: Icon, title, items, color }) => {
    if (!items.length) return null
    return (
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 7, borderBottom: `2px solid ${color}44` }}>
          <Icon size={14} color={color} />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color }}>{title}</span>
          <span style={{ fontSize: 10, background: `${color}18`, color, borderRadius: 10, padding: '2px 8px', fontWeight: 600 }}>{items.length}</span>
        </div>
        <NoteList notes={items} projects={projects} onDelete={onDelete} onToggleDone={onToggleDone} onEdit={onEdit}
          onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} onAddTask={onAddTask} />
      </div>
    )
  }

  const wL  = `Denne veka (${format(wStart, 'd. MMM', { locale: nb })}–${format(wEnd, 'd. MMM', { locale: nb })})`
  const nwL = `Neste veke (${format(nwStart, 'd. MMM', { locale: nb })}–${format(nwEnd, 'd. MMM', { locale: nb })})`
  const total = od2.length + td2.length + tm2.length + tw2.length + nw2.length + lt2.length

  if (!total) return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}>
      <CalendarDays size={32} style={{ margin: '0 auto 10px', display: 'block', opacity: .3 }} />
      <div>Ingen fristar på oppgåver</div>
      <div style={{ fontSize: 12, marginTop: 4 }}>Legg til frist på ei arbeidsoppgåve for å sjå den her</div>
    </div>
  )

  return (
    <div>
      <Sec icon={AlertTriangle} title="Forfalt"    items={od2} color="var(--danger)" />
      <Sec icon={Clock}         title="I dag"       items={td2} color="var(--warn)" />
      <Sec icon={Clock}         title="I morgon"    items={tm2} color="#B85C00" />
      <Sec icon={CalendarDays}  title={wL}          items={tw2} color="var(--info)" />
      <Sec icon={CalendarDays}  title={nwL}         items={nw2} color="var(--job)" />
      <Sec icon={CalendarDays}  title="Seinare"     items={lt2} color="var(--text2)" />
    </div>
  )
}
