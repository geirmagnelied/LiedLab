import { useState } from 'react'
import { AlertCircle, Calendar, FolderOpen, Check, Trash2, Pencil } from 'lucide-react'

export default function OverdueView({ notes, projects, onUpdateTask, onDeleteTask, onEdit }) {
  const today  = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // Collect all overdue tasks across all notes
  const overdueItems = []
  for (const note of notes) {
    if (note.done) continue
    for (const t of (note.tasks || [])) {
      if (t.done || !t.date) continue
      if (t.date < todayStr) {
        const dt   = new Date(t.date)
        const days = Math.round((today - dt) / 86400000)
        overdueItems.push({
          task: t, noteId: note.id, noteTitle: note.title || 'Utan tittel',
          projectId: note.projectId, daysOverdue: days, note,
        })
      }
    }
  }

  overdueItems.sort((a, b) => b.daysOverdue - a.daysOverdue)

  const totalHours = overdueItems.reduce((s, i) => s + (i.task.hours || 0.5), 0)

  if (overdueItems.length === 0) return (
    <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text3)' }}>
      <div style={{ fontSize:48, marginBottom:14 }}>✅</div>
      <div style={{ fontSize:16, fontWeight:600, color:'var(--text2)', marginBottom:6 }}>
        Ingen overskridne fristar!
      </div>
      <div style={{ fontSize:13 }}>Alt er under kontroll.</div>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ background:'rgba(185,28,28,.06)', border:'1.5px solid rgba(185,28,28,.25)',
        borderRadius:'var(--r2)', padding:'14px 18px', marginBottom:16,
        display:'flex', alignItems:'center', gap:12 }}>
        <AlertCircle size={26} color="var(--danger)"/>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:16, fontWeight:700, color:'var(--danger)' }}>
            {overdueItems.length} overskridne {overdueItems.length === 1 ? 'oppgåve' : 'oppgåver'}
          </div>
          <div style={{ fontSize:12, color:'var(--text2)', marginTop:2 }}>
            Totalt {totalHours}t estimert · sortert etter overskridingstid
          </div>
        </div>
      </div>

      {/* Items */}
      {overdueItems.map(item => {
        const proj = item.projectId ? projects.find(p => p.id === item.projectId) : null
        const dateLabel = new Date(item.task.date).toLocaleDateString('no-NO',
          { day:'numeric', month:'short' })
        return (
          <div key={`${item.noteId}-${item.task.id}`}
            style={{ background:'var(--bg2)', border:'1px solid var(--border)',
              borderLeft:'3px solid var(--danger)', borderRadius:'var(--r2)',
              padding:'12px 14px', marginBottom:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <button onClick={() => onUpdateTask(item.noteId, item.task.id, { done: true })}
                title="Marker som ferdig"
                style={{ width:18, height:18, borderRadius:5, border:'2px solid var(--border2)',
                  background:'transparent', cursor:'pointer', display:'flex',
                  alignItems:'center', justifyContent:'center', flexShrink:0 }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--success)';e.currentTarget.style.background='var(--success)'}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border2)';e.currentTarget.style.background='transparent'}}>
              </button>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:600, color:'var(--text)', marginBottom:3 }}>
                  {item.task.text}
                </div>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
                  {proj && (
                    <span style={{ fontSize:11, color:'var(--text2)',
                      display:'flex', alignItems:'center', gap:3 }}>
                      <FolderOpen size={10}/>{proj.name}
                    </span>
                  )}
                  <span style={{ fontSize:11, color:'var(--text3)' }}>
                    📝 {item.noteTitle}
                  </span>
                  {item.task.hours !== undefined && (
                    <span style={{ fontSize:11, color:'var(--brand)', fontWeight:600,
                      background:'var(--brandbg)', borderRadius:5, padding:'1px 7px' }}>
                      {item.task.hours}t
                    </span>
                  )}
                </div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--danger)' }}>
                  {item.daysOverdue} dag{item.daysOverdue === 1 ? '' : 'ar'} over
                </div>
                <div style={{ fontSize:11, color:'var(--text3)',
                  display:'flex', alignItems:'center', justifyContent:'flex-end', gap:3, marginTop:2 }}>
                  <Calendar size={10}/>{dateLabel}
                </div>
              </div>
              <button onClick={() => onEdit(item.note)} title="Opne notat"
                style={{ padding:'5px 10px', background:'var(--bg3)',
                  border:'1px solid var(--border)', borderRadius:'var(--r)',
                  color:'var(--text2)', fontSize:12, cursor:'pointer', flexShrink:0 }}>
                Opne
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
