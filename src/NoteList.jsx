import { useState } from 'react'
import { Trash2, Check, Calendar, FolderOpen, Mail, Pencil,
         ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { fmt } from './dateUtils'

const TAG_COLORS = { 'møte':'#1565C0','oppgåve':'#5E35B1','frist':'#B45309','idé':'#166534' }

function TaskList({ tasks, noteId, onUpdateTask, onDeleteTask, onAddTask }) {
  const [newText, setNewText] = useState('')
  const [newDate, setNewDate] = useState('')
  const { nextFriday } = require ? (() => { try { return require('./dateUtils') } catch { return { nextFriday: () => '' } } })() : { nextFriday: () => '' }

  const addIt = () => {
    if (!newText.trim()) return
    const { nextFriday: nf } = window._dateUtils || {}
    const date = newDate || (typeof nf === 'function' ? nf() : '')
    onAddTask(noteId, newText.trim(), date || null)
    setNewText(''); setNewDate('')
  }

  const fi = { background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6,
    color:'var(--text)', fontFamily:'var(--font)', fontSize:12, padding:'5px 8px', outline:'none' }

  return (
    <div style={{ marginTop:10, paddingTop:10, borderTop:'1px dashed var(--border)' }}>
      {(() => {
        const totalH = (tasks||[]).filter(t=>!t.done).reduce((s,t)=>s+(t.hours!==undefined?parseFloat(t.hours):0.5),0)
        const doneH  = (tasks||[]).filter(t=>t.done).reduce((s,t)=>s+(t.hours!==undefined?parseFloat(t.hours):0.5),0)
        return (
          <div style={{ display:'flex', alignItems:'center', marginBottom:7 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--brand)', textTransform:'uppercase', letterSpacing:'.06em' }}>Arbeidsoppgåver</div>
            {(tasks||[]).length>0&&(
              <span style={{ marginLeft:'auto', fontSize:11, color:'var(--brand2)', fontWeight:600,
                background:'var(--brandbg)', borderRadius:6, padding:'1px 8px' }}>
                {doneH>0?`${doneH}/${totalH+doneH}t`:`${totalH}t`} estimert
              </span>
            )}
          </div>
        )
      })()}
      {(tasks||[]).map(task => {
        const di = task.date ? fmt(task.date) : null
        return (
          <div key={task.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 8px',
            background: task.done?'transparent':'var(--bg3)',
            borderRadius:6, border:`1px solid ${di?.overdue?'rgba(185,28,28,.25)':'var(--border)'}`,
            marginBottom:4 }}>
            <button onClick={()=>onUpdateTask(noteId,task.id,{done:!task.done})}
              style={{ width:15,height:15,borderRadius:4,
                border:`2px solid ${task.done?'var(--success)':'var(--border2)'}`,
                background:task.done?'var(--success)':'transparent',
                flexShrink:0,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
              {task.done&&<Check size={9} color="#fff" strokeWidth={3}/>}
            </button>
            <span style={{ flex:1,fontSize:13,color:'var(--text)',whiteSpace:'pre-wrap',
              textDecoration:task.done?'line-through':'none',opacity:task.done?.55:1,lineHeight:1.4 }}>
              {task.text}
            </span>
            {/* Hours badge */}
            <span style={{ fontSize:11, fontWeight:600, color:'var(--brand2)',
              background:'var(--brandbg)', borderRadius:5, padding:'1px 6px',
              flexShrink:0, whiteSpace:'nowrap' }}>
              {task.hours !== undefined ? (task.hours % 1 === 0 ? `${task.hours}t` : `${task.hours}t`) : '0.5t'}
            </span>
            {di&&(
              <span style={{ fontSize:11,display:'flex',alignItems:'center',gap:3,flexShrink:0,
                color:di.overdue?'var(--danger)':di.urgent?'var(--warn)':'var(--text3)',
                fontWeight:di.overdue||di.urgent?600:400 }}>
                <Calendar size={9}/>{di.lbl}
              </span>
            )}
            <button onClick={()=>onDeleteTask(noteId,task.id)}
              style={{ background:'none',border:'none',color:'var(--text3)',cursor:'pointer',padding:2,display:'flex',flexShrink:0 }}
              onMouseEnter={e=>e.currentTarget.style.color='var(--danger)'}
              onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}>
              <Trash2 size={11}/>
            </button>
          </div>
        )
      })}
      <div style={{ display:'flex', gap:5, marginTop:5 }}>
        <input value={newText} onChange={e=>setNewText(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&addIt()} placeholder="Ny oppgåve…"
          style={{ ...fi, flex:1 }}/>
        <input type="date" value={newDate} onChange={e=>setNewDate(e.target.value)}
          title="Frist" style={{ ...fi, width:120 }}/>
        <button onClick={addIt}
          style={{ padding:'5px 9px',background:'var(--bg3)',border:'1px solid var(--border)',
            borderRadius:6,color:'var(--text2)',cursor:'pointer',display:'flex',alignItems:'center',gap:4,fontSize:12,flexShrink:0 }}>
          <Plus size={12}/>
        </button>
      </div>
    </div>
  )
}

function NoteCard({ note, projects, onDelete, onToggleDone, onEdit, onUpdateTask, onDeleteTask, onAddTask }) {
  const [expanded, setExpanded] = useState(false)
  const proj   = note.projectId ? projects.find(p=>p.id===note.projectId) : null
  const tasks  = note.tasks||[]
  const doneCnt = tasks.filter(t=>t.done).length
  const urgentTask = tasks.filter(t=>!t.done&&t.date).sort((a,b)=>new Date(a.date)-new Date(b.date))[0]
  const utDi = urgentTask ? fmt(urgentTask.date) : null
  const hasBody = note.html && note.text

  return (
    <div draggable
      onDragStart={e=>{e.dataTransfer.setData('noteId',String(note.id));e.dataTransfer.effectAllowed='move'}}
      style={{ background:'var(--bg2)', border:'1px solid var(--border)',
        borderLeft:`3px solid ${note.isEmail?'#1565C0':'var(--brand3)'}`,
        borderRadius:'var(--r2)', marginBottom:8, boxShadow:'var(--shadow-sm)',
        overflow:'hidden', cursor:'grab' }}>

      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 13px' }}
        onClick={() => setExpanded(v=>!v)}>
        <button onClick={e=>{e.stopPropagation();onToggleDone(note.id)}}
          style={{ width:18,height:18,borderRadius:5,
            border:`2px solid ${note.done?'var(--success)':'var(--border2)'}`,
            background:note.done?'var(--success)':'transparent',
            display:'flex',alignItems:'center',justifyContent:'center',
            flexShrink:0,cursor:'pointer',transition:'all .15s' }}>
          {note.done&&<Check size={11} color="#fff" strokeWidth={3}/>}
        </button>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span style={{ fontSize:14, fontWeight:700, color:'var(--text)',
              textDecoration:note.done?'line-through':'none', opacity:note.done?.6:1 }}>
              {note.title||note.text?.substring(0,60)||'Utan tittel'}
            </span>
            {tasks.length>0&&(
              <span style={{ fontSize:11, padding:'1px 7px', borderRadius:10, fontWeight:700,
                background:doneCnt===tasks.length?'rgba(22,101,52,.12)':'rgba(27,67,50,.1)',
                color:doneCnt===tasks.length?'var(--success)':'var(--brand)' }}>
                {doneCnt}/{tasks.length}
              </span>
            )}
            {utDi&&(
              <span style={{ fontSize:11,display:'flex',alignItems:'center',gap:3,
                color:utDi.overdue?'var(--danger)':utDi.urgent?'var(--warn)':'var(--text3)',fontWeight:600 }}>
                <Calendar size={10}/>{utDi.lbl}
              </span>
            )}
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginTop:4 }}>
            {proj&&<span style={{ fontSize:11,color:'var(--text2)',display:'flex',alignItems:'center',gap:3 }}><FolderOpen size={10}/>{proj.name}</span>}
            {note.tag&&<span style={{ fontSize:11,padding:'1px 7px',borderRadius:10,
              background:`${TAG_COLORS[note.tag]}18`,color:TAG_COLORS[note.tag],fontWeight:500 }}>{note.tag}</span>}
            {note.isEmail&&<span style={{ fontSize:11,padding:'1px 7px',borderRadius:10,
              background:'rgba(21,101,192,.1)',color:'var(--info)',display:'flex',alignItems:'center',gap:3 }}>
              <Mail size={9}/>e-post</span>}
            {note.sketchDataUrl&&<span style={{ fontSize:11,padding:'1px 7px',borderRadius:10,
              background:'var(--brandbg)',color:'var(--brand)',fontWeight:500 }}>✏️ skisse</span>}
          </div>
        </div>

        <div style={{ display:'flex',alignItems:'center',gap:4,flexShrink:0 }}>
          {!note.done&&(
            <button onClick={e=>{e.stopPropagation();onEdit(note)}}
              style={{ background:'none',border:'1px solid transparent',color:'var(--text3)',padding:'3px 5px',cursor:'pointer',borderRadius:5,display:'flex' }}
              title="Rediger"
              onMouseEnter={e=>{e.currentTarget.style.color='var(--brand)';e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--bg3)'}}
              onMouseLeave={e=>{e.currentTarget.style.color='var(--text3)';e.currentTarget.style.borderColor='transparent';e.currentTarget.style.background='none'}}>
              <Pencil size={13}/>
            </button>
          )}
          <button onClick={e=>{e.stopPropagation();onDelete(note.id)}}
            style={{ background:'none',border:'1px solid transparent',color:'var(--text3)',padding:'3px 5px',cursor:'pointer',borderRadius:5,display:'flex' }}
            title="Slett"
            onMouseEnter={e=>{e.currentTarget.style.color='var(--danger)';e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--bg3)'}}
            onMouseLeave={e=>{e.currentTarget.style.color='var(--text3)';e.currentTarget.style.borderColor='transparent';e.currentTarget.style.background='none'}}>
            <Trash2 size={13}/>
          </button>
          <span style={{ color:'var(--text3)',display:'flex' }}>
            {expanded?<ChevronDown size={16}/>:<ChevronRight size={16}/>}
          </span>
        </div>
      </div>

      {expanded&&(
        <div style={{ padding:'0 13px 13px', borderTop:'1px solid var(--border)', paddingTop:12 }}>
          {hasBody&&(
            <div style={{ fontSize:13,color:'var(--text)',lineHeight:1.7,marginBottom:4,opacity:note.done?.6:1 }}
              dangerouslySetInnerHTML={{__html:note.html}}/>
          )}
          {note.sketchDataUrl&&(
            <div style={{ marginBottom:8 }}>
              <div style={{ fontSize:10,fontWeight:700,color:'var(--brand)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:4 }}>Skisse</div>
              <img src={note.sketchDataUrl} alt="Skisse"
                style={{ maxWidth:'100%',maxHeight:240,borderRadius:'var(--r)',
                  border:'1.5px solid var(--border)',objectFit:'contain',background:'#fff',
                  display:'block' }}/>
            </div>
          )}
          <TaskList tasks={tasks} noteId={note.id}
            onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} onAddTask={onAddTask}/>
        </div>
      )}
    </div>
  )
}

export default function NoteList({ notes, projects, onDelete, onToggleDone, onEdit, onUpdateTask, onDeleteTask, onAddTask, highlightNoteId }) {
  if (!notes.length) return (
    <div style={{ textAlign:'center',color:'var(--text3)',padding:'50px 0',fontSize:13 }}>
      Ingen notatar enno
    </div>
  )
  return (
    <div>
      {notes.map(note => (
        <NoteCard key={note.id} note={note} projects={projects}
          onDelete={onDelete} onToggleDone={onToggleDone} onEdit={onEdit}
          onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} onAddTask={onAddTask}/>
      ))}
    </div>
  )
}
