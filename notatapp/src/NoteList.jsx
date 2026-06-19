import { useState, useRef } from 'react'
import { fmt } from './dateUtils'

// Letter-badge in place of icons — clearer and more legible than small glyphs
function LetterIcon({ letter, size = 22, color, bg, title }) {
  return (
    <span title={title} style={{
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      width:size, height:size, borderRadius: size > 18 ? 7 : 5,
      background: bg || 'var(--brandbg)', color: color || 'var(--brand)',
      fontWeight:800, fontSize: Math.round(size*0.52), fontFamily:'var(--font)',
      flexShrink:0, lineHeight:1,
    }}>{letter}</span>
  )
}

const TAG_COLORS = { 'møte':'#1565C0','oppgåve':'#5E35B1','frist':'#B45309','idé':'#166534' }

function TaskList({ tasks, noteId, onUpdateTask, onDeleteTask, onAddTask }) {
  const [newText,  setNewText]  = useState('')
  const [newStart, setNewStart] = useState('')
  const [newHours, setNewHours] = useState('')
  const [newDate,  setNewDate]  = useState('')
  // nextFriday via window bridge set in App.jsx

  const addIt = () => {
    const text = newText.trim()
    if (!text) return
    const { nextFriday: nf } = window._dateUtils || {}
    const date  = newDate  || (typeof nf === 'function' ? nf() : null)
    const hours = newHours !== '' ? parseFloat(newHours) : 0.5
    // Use addTask with extended signature via a wrapper
    onAddTask(noteId, text, date, newStart || null, hours)
    setNewText(''); setNewStart(''); setNewHours(''); setNewDate('')
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
              {task.done && <span style={{color:'#fff', fontWeight:900, fontSize:11, lineHeight:1}}>✓</span>}
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
                <LetterIcon letter="F" size={15} title="Frist"/>{di.lbl}
              </span>
            )}
            <button onClick={()=>{
                if (window.confirm(`Slette oppgåva «${task.text}»?`)) onDeleteTask(noteId,task.id)
              }}
              title="Slett oppgåve"
              style={{ background:'none',border:'none',color:'var(--text3)',cursor:'pointer',padding:2,display:'flex',flexShrink:0 }}
              onMouseEnter={e=>e.currentTarget.style.color='var(--danger)'}
              onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}>
              <LetterIcon letter="S" size={17} color="var(--text3)" bg="transparent" title="Slett oppgåve"/>
            </button>
          </div>
        )
      })}
      {/* Column headers */}
      <div style={{ display:'flex', gap:5, marginTop:8, marginBottom:3 }}>
        <div style={{ flex:1, fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.04em' }}>Oppgåve</div>
        <div style={{ width:110, fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.04em' }}>Startdato</div>
        <div style={{ width:48, fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.04em', textAlign:'center' }}>t</div>
        <div style={{ width:110, fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.04em' }}>Frist</div>
        <div style={{ width:32 }}></div>
      </div>
      <div style={{ display:'flex', gap:5, alignItems:'center' }}>
        <input value={newText} onChange={e=>setNewText(e.target.value)}
          onKeyDown={e=>{ if(e.key==='Enter'&&!e.altKey){e.preventDefault();addIt()} }}
          placeholder="Ny oppgåve… (Enter)"
          style={{ ...fi, flex:1, fontSize:13 }}/>
        <input type="date" value={newStart||''} onChange={e=>setNewStart(e.target.value)}
          title="Startdato" style={{ ...fi, width:110 }}/>
        <input type="number" value={newHours} onChange={e=>setNewHours(e.target.value)}
          placeholder="0.5" min="0.5" max="999" step="0.5"
          title="Timeverk (standard: 0.5)"
          style={{ ...fi, width:48, textAlign:'center' }}/>
        <input type="date" value={newDate} onChange={e=>setNewDate(e.target.value)}
          title="Frist" style={{ ...fi, width:110 }}/>
        <button onClick={addIt}
          style={{ padding:'5px 9px', width:32, background:'var(--brand)', border:'none',
            borderRadius:6, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center',
            justifyContent:'center', flexShrink:0 }}>
          <LetterIcon letter="+" size={20} color="#fff" bg="transparent"/>
        </button>
      </div>
    </div>
  )
}

function NoteCard({ note, projects, onDelete, onToggleDone, onEdit, onUpdateTask, onDeleteTask, onAddTask, onMoveToProject, onRenameNote }) {
  const [expanded,  setExpanded]  = useState(false)
  const [ctxMenu,   setCtxMenu]   = useState(null)
  const [renaming,  setRenaming]  = useState(false)
  const [renameVal, setRenameVal] = useState(note.title || '')
  const clickTimer = useRef(null)
  const proj   = note.projectId ? projects.find(p=>p.id===note.projectId) : null
  const tasks  = note.tasks||[]
  const doneCnt = tasks.filter(t=>t.done).length
  const urgentTask = tasks.filter(t=>!t.done&&t.date).sort((a,b)=>new Date(a.date)-new Date(b.date))[0]
  const utDi = urgentTask ? fmt(urgentTask.date) : null
  const hasBody = (note.html && note.text) || note.isMeeting

  return (
    <div draggable
      onDragStart={e=>{
        e.dataTransfer.setData('noteId',String(note.id))
        e.dataTransfer.setData('text/plain',String(note.id))
        e.dataTransfer.effectAllowed='move'
      }}
      onContextMenu={e=>{ e.preventDefault(); setCtxMenu({x:e.clientX,y:e.clientY}) }}
      style={{ background:'var(--bg2)', border:'1px solid var(--border)',
        borderLeft:`3px solid ${note.isMeeting?'#1565C0':note.isEmail?'#B45309':'var(--brand3)'}`,
        borderRadius:'var(--r2)', marginBottom:8, boxShadow:'var(--shadow-sm)',
        overflow:'hidden', cursor:'grab', position:'relative' }}>

      {/* Note context menu */}
      {ctxMenu && (
        <>
          <div onClick={()=>setCtxMenu(null)} style={{position:'fixed',inset:0,zIndex:200}}/>
          <div style={{position:'fixed',left:ctxMenu.x,top:ctxMenu.y,zIndex:201,
            background:'var(--bg2)',border:'1.5px solid var(--brand3)',
            borderRadius:'var(--r2)',padding:'4px 0',
            boxShadow:'0 8px 24px rgba(0,0,0,.18)',minWidth:200}}>
            <button onClick={()=>{setRenaming(true);setRenameVal(note.title||'');setCtxMenu(null)}}
              style={{width:'100%',textAlign:'left',padding:'8px 14px',background:'none',border:'none',
                cursor:'pointer',fontSize:13,color:'var(--text)',fontFamily:'var(--font)',display:'block'}}
              onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
              onMouseLeave={e=>e.currentTarget.style.background='none'}>
              Endre tittel
            </button>
            {projects.length>0 && (
              <div>
                <div style={{padding:'4px 14px 2px',fontSize:10,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.05em'}}>Flytt til prosjekt</div>
                {projects.map(p=>(
                  <button key={p.id} onClick={()=>{onMoveToProject&&onMoveToProject(note.id,p.id);setCtxMenu(null)}}
                    style={{width:'100%',textAlign:'left',padding:'6px 14px 6px 22px',background:'none',border:'none',
                      cursor:'pointer',fontSize:12,color:'var(--text2)',fontFamily:'var(--font)',display:'block'}}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                    onMouseLeave={e=>e.currentTarget.style.background='none'}>
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            <div style={{height:1,background:'var(--border)',margin:'4px 0'}}/>
            <button onClick={()=>{
              if (window.confirm(`Sikker på at du vil slette notatet «${note.title || 'Utan tittel'}»?\n\nDenne handlinga kan ikkje angrast.`)) {
                onDelete(note.id); setCtxMenu(null)
              } else { setCtxMenu(null) }
            }}
              style={{width:'100%',textAlign:'left',padding:'8px 14px',background:'none',border:'none',
                cursor:'pointer',fontSize:13,color:'var(--danger)',fontFamily:'var(--font)',display:'block'}}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(185,28,28,.06)'}
              onMouseLeave={e=>e.currentTarget.style.background='none'}>
              Slett notat
            </button>
          </div>
        </>
      )}

      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 13px' }}
        onClick={e => {
          // Delay single-click slightly so double-click can preempt it
          if (clickTimer.current) {
            clearTimeout(clickTimer.current); clickTimer.current = null
            return  // Double-click handler will fire instead
          }
          clickTimer.current = setTimeout(() => {
            setExpanded(v => !v)
            clickTimer.current = null
          }, 220)
        }}
        onDoubleClick={e => {
          if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null }
          e.stopPropagation()
          if (!note.done) onEdit(note)
        }}>
        <button onClick={e=>{e.stopPropagation();onToggleDone(note.id)}}
          title={note.done ? 'Hent ut av arkivet' : 'Arkiver notatet'}
          style={{ width:24,height:24,borderRadius:6,
            border:`2px solid ${note.done?'var(--success)':'var(--border2)'}`,
            background:note.done?'var(--success)':'transparent',
            display:'flex',alignItems:'center',justifyContent:'center',
            flexShrink:0,cursor:'pointer',transition:'all .15s',
            fontSize:11 }}
          onMouseEnter={e=>{
            if(!note.done){e.currentTarget.style.borderColor='var(--brand3)';e.currentTarget.style.background='var(--brandbg)'}
          }}
          onMouseLeave={e=>{
            if(!note.done){e.currentTarget.style.borderColor='var(--border2)';e.currentTarget.style.background='transparent'}
          }}>
          {note.done ? <span style={{color:'#fff', fontWeight:900, fontSize:13}}>✓</span> : <LetterIcon letter="A" size={15} bg="transparent" color="var(--text3)" title="Arkiver"/>}
        </button>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            {renaming ? (
              <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)}
                onClick={e=>e.stopPropagation()}
                onKeyDown={e=>{
                  if(e.key==='Enter'){onRenameNote&&onRenameNote(note.id,renameVal);setRenaming(false)}
                  if(e.key==='Escape')setRenaming(false)
                }}
                onBlur={()=>{onRenameNote&&onRenameNote(note.id,renameVal);setRenaming(false)}}
                style={{flex:1,fontSize:15,fontWeight:700,background:'var(--bg3)',
                  border:'2px solid var(--brand3)',borderRadius:'var(--r)',
                  padding:'2px 8px',outline:'none',fontFamily:'var(--font)',color:'var(--text)'}}/>
            ) : (
              <span style={{ fontSize:15, fontWeight:700, color:'var(--text)',
                textDecoration:note.done?'line-through':'none', opacity:note.done?.6:1 }}>
                {note.title||note.text?.substring(0,60)||'Utan tittel'}
              </span>
            )}
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
                <LetterIcon letter="F" size={16} title="Frist"/>{utDi.lbl}
              </span>
            )}
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginTop:4 }}>
            {proj&&<span style={{ fontSize:13,color:'var(--text2)',display:'flex',alignItems:'center',gap:4 }}><LetterIcon letter="P" size={16} title="Prosjekt"/>{proj.name}</span>}
            {note.tag&&<span style={{ fontSize:11,padding:'1px 7px',borderRadius:10,
              background:`${TAG_COLORS[note.tag]}18`,color:TAG_COLORS[note.tag],fontWeight:500 }}>{note.tag}</span>}
            {note.isEmail&&<span style={{ fontSize:12,padding:'2px 9px',borderRadius:10,
              background:'rgba(21,101,192,.1)',color:'var(--info)',fontWeight:600 }}>
              E-post</span>}
            {note.sketchDataUrl&&<span style={{ fontSize:12,padding:'2px 9px',borderRadius:10,
              background:'var(--brandbg)',color:'var(--brand)',fontWeight:600 }}>Skisse</span>}
            {note.attachments?.length>0&&<span style={{fontSize:12,padding:'2px 9px',borderRadius:10,
              background:'rgba(180,83,9,.08)',color:'var(--warn)',fontWeight:600}}>Vedlegg ({note.attachments.length})</span>}
            {note.isMeeting&&(
              <span style={{ fontSize:12,padding:'2px 9px',borderRadius:10,
                background:'rgba(21,101,192,.1)',color:'#1565C0',fontWeight:700 }}>
                Møte {note.meetingTime ? new Date(note.meetingTime).toLocaleString('no-NO',{dateStyle:'short',timeStyle:'short'}) : ''}
              </span>
            )}
            {note.isMeeting && note.attendees?.length>0 && (
              <span style={{ fontSize:12,color:'var(--text2)',fontWeight:500 }}>
                Deltakarar: {note.attendees.slice(0,3).join(', ')}{note.attendees.length>3?` +${note.attendees.length-3}`:''}
              </span>
            )}
          </div>
        </div>

        <div style={{ display:'flex',alignItems:'center',gap:4,flexShrink:0 }}>
          {!note.done&&(
            <button onClick={e=>{e.stopPropagation();onEdit(note)}}
              style={{ background:'none',border:'1px solid transparent',color:'var(--text3)',padding:'3px 5px',cursor:'pointer',borderRadius:5,display:'flex' }}
              title="Rediger"
              onMouseEnter={e=>{e.currentTarget.style.color='var(--brand)';e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--bg3)'}}
              onMouseLeave={e=>{e.currentTarget.style.color='var(--text3)';e.currentTarget.style.borderColor='transparent';e.currentTarget.style.background='none'}}>
              <LetterIcon letter="R" size={20} bg="transparent" color="var(--text3)" title="Rediger"/>
            </button>
          )}
          <button onClick={e=>{
              e.stopPropagation()
              if (window.confirm(`Sikker på at du vil slette notatet «${note.title || 'Utan tittel'}»?\n\nDenne handlinga kan ikkje angrast.`)) {
                onDelete(note.id)
              }
            }}
            style={{ background:'none',border:'1px solid transparent',color:'var(--text3)',padding:'3px 5px',cursor:'pointer',borderRadius:5,display:'flex' }}
            title="Slett notat"
            onMouseEnter={e=>{e.currentTarget.style.color='var(--danger)';e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--bg3)'}}
            onMouseLeave={e=>{e.currentTarget.style.color='var(--text3)';e.currentTarget.style.borderColor='transparent';e.currentTarget.style.background='none'}}>
            <LetterIcon letter="S" size={20} bg="transparent" color="var(--text3)" title="Slett"/>
          </button>
          <span style={{ color:'var(--text3)', fontWeight:800, fontSize:14, display:'flex', alignItems:'center', padding:'0 4px' }}>
            {expanded ? '▾' : '▸'}
          </span>
        </div>
      </div>

      {expanded&&(
        <div style={{ padding:'0 13px 13px', borderTop:'1px solid var(--border)', paddingTop:12 }}>
          {note.isMeeting && (
            <div style={{ background:'var(--bg3)', border:'1px solid var(--border)',
              borderRadius:'var(--r)', padding:'10px 14px', marginBottom:10,
              display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {note.meetingTime && <div><span style={{fontSize:11,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.04em'}}>Tidspunkt</span><br/><span style={{fontSize:13,color:'var(--text)'}}>{new Date(note.meetingTime).toLocaleString('no-NO',{dateStyle:'long',timeStyle:'short'})}</span></div>}
              {note.meetingDuration && <div><span style={{fontSize:11,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.04em'}}>Varigheit</span><br/><span style={{fontSize:13,color:'var(--text)'}}>{note.meetingDuration} min</span></div>}
              {note.meetingLocation && <div style={{gridColumn:'1/-1'}}><span style={{fontSize:11,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.04em'}}>Stad</span><br/><span style={{fontSize:13,color:'var(--text)'}}>{note.meetingLocation}</span></div>}
              {note.attendees?.length>0 && <div style={{gridColumn:'1/-1'}}><span style={{fontSize:11,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.04em'}}>Deltakarar</span><br/><div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:4}}>{note.attendees.map((a,i)=><span key={i} style={{fontSize:12,padding:'2px 8px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:20,color:'var(--text2)'}}>{a}</span>)}</div></div>}
            </div>
          )}
          {hasBody&&(
            <div style={{ fontSize:13,color:'var(--text)',lineHeight:1.7,marginBottom:4,opacity:note.done?.6:1 }}
              dangerouslySetInnerHTML={{__html:note.html}}/>
          )}
          {note.attachments?.length > 0 && (
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:12,fontWeight:700,color:'var(--brand)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6 }}>Vedlegg</div>
              {note.attachments.map((att, i) => (
                <div key={i} style={{ display:'flex',alignItems:'center',gap:8,
                  padding:'6px 10px',background:'var(--bg3)',borderRadius:'var(--r)',
                  border:'1px solid var(--border)',marginBottom:4 }}>
                  <LetterIcon letter={att.type?.includes('pdf')?'P':'E'} size={20} title={att.type?.includes('pdf')?'PDF':'E-post'}/>
                  <a href={att.url} target="_blank" rel="noreferrer"
                    style={{flex:1,fontSize:13,color:'var(--brand)',fontWeight:500,
                      textDecoration:'none',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {att.name}
                  </a>
                  <span style={{fontSize:11,color:'var(--text3)'}}>{(att.size/1024).toFixed(0)} KB</span>
                </div>
              ))}
            </div>
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

export default function NoteList({ notes, projects, onDelete, onToggleDone, onEdit,
  onUpdateTask, onDeleteTask, onAddTask, highlightNoteId, onMoveToProject, onRenameNote }) {
  const [showArchived, setShowArchived] = useState(false)
  const activeNotes   = notes.filter(n => !n.done)
  const archivedNotes = notes.filter(n => n.done)
  const visible = showArchived ? archivedNotes : activeNotes

  if (notes.length === 0) return (
    <div style={{ textAlign:'center',color:'var(--text3)',padding:'50px 0',fontSize:13 }}>
      Ingen notatar enno
    </div>
  )
  return (
    <div>
      {archivedNotes.length > 0 && (
        <div style={{ display:'flex', gap:6, marginBottom:14 }}>
          <button onClick={() => setShowArchived(false)}
            style={{ padding:'5px 12px', borderRadius:6, fontSize:12, fontWeight:600,
              border:'1.5px solid', cursor:'pointer',
              borderColor: !showArchived ? 'var(--brand3)' : 'var(--border)',
              background:  !showArchived ? 'var(--brandbg)' : 'transparent',
              color:       !showArchived ? 'var(--brand)' : 'var(--text3)' }}>
            Aktive ({activeNotes.length})
          </button>
          <button onClick={() => setShowArchived(true)}
            style={{ padding:'5px 12px', borderRadius:6, fontSize:12, fontWeight:600,
              border:'1.5px solid', cursor:'pointer',
              borderColor: showArchived ? 'var(--text3)' : 'var(--border)',
              background:  showArchived ? 'var(--bg3)' : 'transparent',
              color:       showArchived ? 'var(--text2)' : 'var(--text3)' }}>
            Arkivet ({archivedNotes.length})
          </button>
        </div>
      )}
      {visible.length === 0 ? (
        <div style={{ textAlign:'center',color:'var(--text3)',padding:'30px 0',fontSize:13 }}>
          {showArchived ? 'Ingen arkiverte notatar' : 'Ingen aktive notatar'}
        </div>
      ) : (
        visible.map(note => (
          <NoteCard key={note.id} note={note} projects={projects}
            onDelete={onDelete} onToggleDone={onToggleDone} onEdit={onEdit}
            onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} onAddTask={onAddTask}
            onMoveToProject={onMoveToProject} onRenameNote={onRenameNote}/>
        ))
      )}
    </div>
  )
}
