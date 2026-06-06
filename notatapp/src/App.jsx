import { useState, useCallback, useRef, useEffect } from 'react'
import { useStore } from './useStore'
import Sidebar from './Sidebar'
import NoteInput from './NoteInput'
import NoteList from './NoteList'
import DeadlineView from './DeadlineView'
import CalendarView from './CalendarView'
import Timeline from './Timeline'
import { LayoutList, AlertCircle, Calendar, PanelLeft, CalendarDays, Plus } from 'lucide-react'

const INITIAL_SB_W  = 260
const INITIAL_CAL_W = 260
const INITIAL_TL_H  = 200
const MIN_W = 160, MAX_W = 600

export default function App() {
  const { notes, projects, addNote, updateNote, deleteNote, toggleDone,
          addTask, updateTask, deleteTask, addProject, deleteProject, toggleFavorite } = useStore()

  const [view,              setView]              = useState('new')
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [sbCollapsed,       setSbCollapsed]       = useState(false)
  const [calCollapsed,      setCalCollapsed]      = useState(false)
  const [tlCollapsed,       setTlCollapsed]       = useState(false)
  const [sbWidth,           setSbWidth]           = useState(INITIAL_SB_W)
  const [calWidth,          setCalWidth]          = useState(INITIAL_CAL_W)
  const [tlHeight,          setTlHeight]          = useState(INITIAL_TL_H)
  const [editNote,          setEditNote]          = useState(null)
  const [highlightNoteId,   setHighlightNoteId]   = useState(null)

  // Expose nextFriday to NoteList via window (simple bridge)
  useEffect(() => {
    import('./dateUtils').then(m => { window._dateUtils = m })
  }, [])

  // Timeline drop handler
  useEffect(() => {
    const handler = (e) => {
      const { noteId, date } = e.detail
      const note = notes.find(n => n.id === noteId)
      if (!note) return
      const firstOpen = (note.tasks||[]).find(t => !t.done)
      if (firstOpen) updateTask(noteId, firstOpen.id, { date })
      else addTask(noteId, 'Frist', date)
    }
    window.addEventListener('timeline-drop', handler)
    return () => window.removeEventListener('timeline-drop', handler)
  }, [notes, updateTask, addTask])

  // Column resize
  const dragging   = useRef(null)
  const dragStart  = useRef(null)
  const widthStart = useRef(null)

  const onColMouseDown = useCallback((side, e) => {
    e.preventDefault()
    dragging.current   = side
    dragStart.current  = e.clientX
    widthStart.current = side==='sb' ? sbWidth : calWidth
    const onMove = ev => {
      const delta = ev.clientX - dragStart.current
      if (dragging.current==='sb')  setSbWidth( Math.min(MAX_W, Math.max(MIN_W, widthStart.current+delta)))
      else                          setCalWidth(Math.min(MAX_W, Math.max(MIN_W, widthStart.current-delta)))
    }
    const onUp = () => { dragging.current=null; window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp) }
    window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp)
  }, [sbWidth, calWidth])

  const handleAdd = ({ title, text, html, tasks, tag, projectId, newProjName, sketchDataUrl }) => {
    let pid = projectId
    if (newProjName && !projectId) { const p = addProject(newProjName); pid = p.id }
    if (editNote) { updateNote(editNote.id, { title, text, html, tasks, tag, projectId: pid, sketchDataUrl }); setEditNote(null) }
    else addNote({ title, text, html, tasks, tag, projectId: pid, sketchDataUrl })
    setView('notatar')
  }

  const handleEdit        = note => { setEditNote(note); setView('new') }
  const handleCancelEdit  = ()   => { setEditNote(null); setView('notatar') }
  const handleSelectProject = id => { setSelectedProjectId(id); setView('notatar') }
  const handleNewNote     = ()   => { setEditNote(null); setView('new') }
  const handleSelectNote  = id  => {
    setSelectedProjectId(null); setView('notatar')
    setHighlightNoteId(id); setTimeout(()=>setHighlightNoteId(null),2000)
  }

  const defaultProjectId = view==='new' && !editNote ? selectedProjectId : undefined
  const selProj          = selectedProjectId ? projects.find(p=>p.id===selectedProjectId) : null
  const visibleNotes     = selectedProjectId ? notes.filter(n=>n.projectId===selectedProjectId) : notes
  const listProps = { projects, onDelete:deleteNote, onToggleDone:toggleDone, onEdit:handleEdit,
    onUpdateTask:updateTask, onDeleteTask:deleteTask, onAddTask:addTask }

  const IcoBtn = ({ onClick, active, title, children }) => (
    <button onClick={onClick} title={title} aria-label={title}
      style={{ width:30,height:30,border:'1.5px solid',
        borderColor:active?'rgba(255,255,255,.6)':'rgba(255,255,255,.2)',
        background:active?'rgba(255,255,255,.25)':'rgba(255,255,255,.1)',
        borderRadius:'var(--r)',display:'flex',alignItems:'center',justifyContent:'center',
        cursor:'pointer',color:active?'#fff':'rgba(255,255,255,.65)',flexShrink:0,transition:'all .15s' }}>
      {children}
    </button>
  )

  const Tab = ({ v, icon:Icon, label, onClick }) => {
    const active = view===v
    return (
      <button onClick={onClick||(() => { setView(v); if (v!=='new') setEditNote(null) })}
        style={{ display:'flex',alignItems:'center',gap:5,padding:'6px 13px',
          border:'1.5px solid',
          borderColor:active?'rgba(255,255,255,.6)':'transparent',
          background:active?'rgba(255,255,255,.18)':'transparent',
          borderRadius:'var(--r)',color:active?'#fff':'rgba(255,255,255,.65)',
          fontSize:13,cursor:'pointer',fontWeight:active?700:400,transition:'all .15s' }}>
        <Icon size={14}/>{label}
      </button>
    )
  }

  return (
    /* Outer wrapper with deep green border frame */
    <div style={{ display:'flex', height:'100vh', overflow:'hidden',
      background:'var(--bg)', boxSizing:'border-box',
      borderLeft:'6px solid var(--brand)' }}>

      {/* Main vertical layout */}
      <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden', minWidth:0 }}>
      <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
        {/* Upper section */}
        <div style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>

          {/* Sidebar */}
          {!sbCollapsed && (
            <>
              <aside style={{ width:sbWidth,minWidth:sbWidth,overflow:'hidden',flexShrink:0,display:'flex',flexDirection:'column' }}>
                <Sidebar projects={projects} notes={notes}
                  onSelectProject={handleSelectProject} onSelectNote={handleSelectNote}
                  selectedProjectId={selectedProjectId} onDeleteProject={deleteProject}
                  onNewNote={handleNewNote} onToggleFavorite={toggleFavorite}/>
              </aside>
              <div className="resize-handle" onMouseDown={e=>onColMouseDown('sb',e)}/>
            </>
          )}

          {/* Main */}
          <main style={{ flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0 }}>
            <div style={{ display:'flex',alignItems:'center',gap:4,padding:'0 12px',
              borderBottom:'1px solid rgba(255,255,255,.1)',background:'var(--brand)',
              height:50,flexShrink:0 }}>
              <IcoBtn onClick={()=>setSbCollapsed(v=>!v)} active={sbCollapsed} title="Meny"><PanelLeft size={16}/></IcoBtn>
              <div style={{width:4}}/>
              <Tab v="new"      icon={Plus}       label="Nytt notat" onClick={handleNewNote}/>
              <Tab v="notatar"  icon={LayoutList}  label="Notatar"/>
              <Tab v="fristar"  icon={AlertCircle} label="Fristar"/>
              <Tab v="kalender" icon={Calendar}    label="Kalender"/>
              <div style={{flex:1}}/>
              {selProj&&(
                <div style={{ display:'flex',alignItems:'center',gap:7,fontSize:12,
                  color:'rgba(255,255,255,.75)',marginRight:6 }}>
                  <span style={{ width:7,height:7,borderRadius:'50%',background:'rgba(255,255,255,.6)' }}/>
                  <span style={{ fontFamily:'var(--mono)',fontWeight:500 }}>{selProj.name}</span>
                </div>
              )}
              <IcoBtn onClick={()=>setTlCollapsed(v=>!v)} active={!tlCollapsed} title="Tidslinje"><CalendarDays size={16}/></IcoBtn>
              <div style={{width:4}}/>
              <IcoBtn onClick={()=>setCalCollapsed(v=>!v)} active={calCollapsed} title="Kalender"><Calendar size={16}/></IcoBtn>
            </div>

            <div style={{ flex:1,overflowY:'auto',padding:'22px 26px' }}>
              {view==='new'      && <NoteInput projects={projects} onAdd={handleAdd} defaultProjectId={defaultProjectId} editNote={editNote} onCancelEdit={handleCancelEdit}/>}
              {view==='notatar'  && <NoteList notes={visibleNotes} {...listProps} highlightNoteId={highlightNoteId}/>}
              {view==='fristar'  && <DeadlineView notes={visibleNotes} {...listProps}/>}
              {view==='kalender' && <CalendarView notes={visibleNotes} projects={projects} onDelete={deleteNote} onToggleDone={toggleDone} onEdit={handleEdit}/>}
            </div>
          </main>

          {/* Calendar panel */}
          {!calCollapsed&&(
            <>
              <div className="resize-handle" onMouseDown={e=>onColMouseDown('cal',e)}/>
              <aside style={{ width:calWidth,minWidth:calWidth,borderLeft:'1px solid var(--border)',background:'var(--bg2)',display:'flex',flexDirection:'column',overflow:'hidden',flexShrink:0 }}>
                <CalendarView notes={notes} projects={projects} onDelete={deleteNote} onToggleDone={toggleDone} onEdit={handleEdit} compact/>
              </aside>
            </>
          )}
        </div>

        {/* Timeline */}
        {!tlCollapsed&&(
          <div style={{ height:tlHeight,minHeight:90,maxHeight:400,flexShrink:0 }}>
            <Timeline notes={notes} projects={projects} height={tlHeight} onResize={setTlHeight}/>
          </div>
        )}
      </div>

      {/* Bottom status bar - ~1cm high, shows date/time */}
      <StatusBar/>
      </div>

      {/* Right green border strip on calendar side */}
      <div style={{ width:6, flexShrink:0, background:'var(--brand)' }}/>
    </div>
  )
}

function StatusBar() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const days = ['søn','man','tir','ons','tor','fre','lør']
  const months = ['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des']
  const dateStr = `${days[now.getDay()]} ${now.getDate()}. ${months[now.getMonth()]} ${now.getFullYear()}`
  const timeStr = now.toLocaleTimeString('no-NO', { hour:'2-digit', minute:'2-digit', second:'2-digit' })
  return (
    <div style={{ height:36, flexShrink:0, background:'var(--brand)',
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'0 16px', borderTop:'1px solid rgba(255,255,255,.15)' }}>
      <span style={{ fontSize:12, color:'rgba(255,255,255,.55)', fontWeight:500 }}>Notatapp</span>
      <span style={{ fontSize:13, color:'rgba(255,255,255,.9)', fontWeight:600,
        fontFamily:'var(--mono)', letterSpacing:'.03em' }}>
        {dateStr} &nbsp;·&nbsp; {timeStr}
      </span>
      <span style={{ fontSize:11, color:'rgba(255,255,255,.4)' }}>v6</span>
    </div>
  )
}
