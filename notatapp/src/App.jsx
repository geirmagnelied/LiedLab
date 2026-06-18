import { useState, useCallback, useRef, useEffect } from 'react'
import { useStore } from './useStore'
import Sidebar from './Sidebar'
import NoteInput from './NoteInput'
import NoteList from './NoteList'
import DeadlineView from './DeadlineView'
import OverdueView from './OverdueView'
import TimeTracker from './TimeTracker'
import CalendarView from './CalendarView'
import Timeline from './Timeline'
import { LayoutList, AlertCircle, Calendar, PanelLeft, CalendarDays, Plus, Clock } from 'lucide-react'

const INITIAL_SB_W  = 260
const INITIAL_CAL_W = 260
const INITIAL_TL_H  = 200
const MIN_W = 160, MAX_W = 600

export default function App({ userId, userEmail }) {
  const { notes, projects, loading, addNote, updateNote, deleteNote, toggleDone,
          addTask, updateTask, deleteTask, addProject, updateProject, deleteProject, toggleFavorite } = useStore(userId)

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
  const [isMeeting,         setIsMeeting]         = useState(false)
  const [isTaskOnly,        setIsTaskOnly]        = useState(false)
  const [pendingEditId,     setPendingEditId]     = useState(null)
  const [isMobile,          setIsMobile]          = useState(window.innerWidth < 768)
  const [mobileSheet,       setMobileSheet]       = useState(false)
  const [mode,              setMode]              = useState('work')  // 'work' | 'private'

  // Expose nextFriday to NoteList via window (simple bridge)
  useEffect(() => {
    import('./dateUtils').then(m => { window._dateUtils = m })
  }, [])

  // Auto-promote: when a freshly-created note appears in `notes`, set it as editNote
  useEffect(() => {
    if (pendingEditId && view === 'new') {
      const note = notes.find(n => n.id === pendingEditId)
      if (note) {
        setEditNote(note)
        setPendingEditId(null)
      }
    }
  }, [notes, pendingEditId, view])

  // Handle ?note=XXX URL parameter (from email links)
  useEffect(() => {
    const params  = new URLSearchParams(window.location.search)
    const noteId  = params.get('note')
    if (noteId && notes.length > 0) {
      const id = parseInt(noteId)
      const note = notes.find(n => n.id === id)
      if (note) {
        handleSelectNote(id)
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
  }, [notes.length])

  // Track mobile breakpoint
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Apply colour theme
  useEffect(() => {
    if (mode === 'private') {
      document.documentElement.classList.add('theme-private')
    } else {
      document.documentElement.classList.remove('theme-private')
    }
  }, [mode])

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

  // Sidebar context menu handler
  useEffect(() => {
    const handler = (e) => {
      const { action, projectId } = e.detail
      setSelectedProjectId(projectId)
      if (action === 'new-meeting') handleNewNote('meeting')
      else if (action === 'new-task') handleNewNote('task')
      else handleNewNote('regular')
    }
    window.addEventListener('sidebar-ctx', handler)
    return () => window.removeEventListener('sidebar-ctx', handler)
  }, [])

  // Timeline context menu handler
  useEffect(() => {
    const handler = (e) => {
      const { action, date } = e.detail
      if (action === 'new-note')         handleNewNote('regular')
      else if (action === 'new-meeting') handleNewNote('meeting')
      else if (action === 'new-task')    handleNewNote('task')
    }
    window.addEventListener('timeline-ctx', handler)
    return () => window.removeEventListener('timeline-ctx', handler)
  }, [])

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

  // Full save / done — used by task-only and explicit save
  const handleAdd = async (data) => {
    const { title, text, html, tasks, tag, projectId, newProjName, sketchDataUrl,
            attachments, isMeeting: noteIsMeeting,
            meetingTime, meetingDuration, meetingLocation, attendees } = data
    let pid = projectId
    if (newProjName && !projectId) {
      const p = await addProject(newProjName, mode)
      pid = p.id
    }
    const noteData = { title, text, html, tasks, tag, projectId: pid,
      sketchDataUrl, attachments, isMeeting: noteIsMeeting,
      meetingTime, meetingDuration, meetingLocation, attendees }
    if (editNote) { await updateNote(editNote.id, noteData); setEditNote(null) }
    else await addNote(noteData)
    if (pid) setSelectedProjectId(pid)
    setView('notatar')
    setIsMeeting(false); setIsTaskOnly(false)
  }

  // Autosave — debounced upsert from NoteInput
  const handleAutoSave = async (data) => {
    const { title, text, html, tasks, tag, projectId, newProjName, sketchDataUrl,
            attachments, isMeeting: noteIsMeeting,
            meetingTime, meetingDuration, meetingLocation, attendees } = data
    let pid = projectId
    if (newProjName && !projectId) {
      const p = await addProject(newProjName, mode)
      pid = p.id
    }
    const noteData = { title, text, html, tasks, tag, projectId: pid,
      sketchDataUrl, attachments, isMeeting: noteIsMeeting,
      meetingTime, meetingDuration, meetingLocation, attendees }
    if (editNote) {
      await updateNote(editNote.id, noteData)
      return editNote.id
    } else {
      const result = await addNote(noteData)
      // Transition from "new" to "edit" mode by finding the just-created note
      // We can't easily setEditNote here without race conditions, so return the id
      return result?.id
    }
  }

  const handleEdit        = note => { setEditNote(note); setView('new') }
  const handleRenameProject  = (id, name)      => updateProject(id, { name })
  const handleRenameNote     = (id, title)     => updateNote(id, { title })
  const handleMoveToProject  = (noteId, projId) => updateNote(noteId, { projectId: projId })
  const handleCancelEdit  = ()   => { setEditNote(null); setView('notatar') }
  const handleSelectProject = id => { setSelectedProjectId(id); setView('notatar') }
  const handleNewNote = (type='regular') => {
    setEditNote(null)
    setIsMeeting(type === 'meeting')
    setIsTaskOnly(type === 'task')
    setView('new')
  }
  const handleSelectNote  = id  => {
    setSelectedProjectId(null); setView('notatar')
    setHighlightNoteId(id); setTimeout(()=>setHighlightNoteId(null),2000)
  }

  const defaultProjectId = view==='new' && !editNote ? selectedProjectId : undefined
  const selProj          = selectedProjectId ? projects.find(p=>p.id===selectedProjectId) : null
  // Filter notes by mode (show notes whose project matches current mode, or unassigned)
  const modeProjectIds   = new Set(projects.filter(p=>(p.type||'work')===mode).map(p=>p.id))
  const modeNotes        = notes.filter(n => !n.projectId || modeProjectIds.has(n.projectId))
  const visibleNotes     = selectedProjectId
    ? modeNotes.filter(n=>n.projectId===selectedProjectId)
    : modeNotes
  const listProps = { projects, onDelete:deleteNote, onToggleDone:toggleDone, onEdit:handleEdit,
    onUpdateTask:updateTask, onDeleteTask:deleteTask, onAddTask:addTask,
    onMoveToProject:handleMoveToProject, onRenameNote:handleRenameNote }

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

  if (loading) return (
    <div style={{minHeight:'100vh',background:'var(--brand)',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{color:'rgba(255,255,255,.6)',fontSize:14}}>Lastar notatar…</div>
    </div>
  )

  // ── Mobile topbar tabs ────────────────────────────────────────────────
  const MobileTab = ({ v, icon: Icon, label, onClick }) => {
    const active = view === v
    return (
      <button onClick={onClick || (() => { setView(v); setEditNote(null); setMobileSheet(false) })}
        style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2,
          padding:'8px 4px', border:'none', background:'none',
          color: active ? '#fff' : 'rgba(255,255,255,.5)',
          fontSize:10, fontWeight: active ? 700 : 400, cursor:'pointer' }}>
        <Icon size={20} strokeWidth={active ? 2.5 : 1.5}/>
        {label}
      </button>
    )
  }

  if (isMobile) return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh',
      overflow:'hidden', background:'var(--bg)', position:'relative' }}>

      {/* Mobile topbar */}
      <div style={{ display:'flex', alignItems:'center', padding:'0 12px',
        background:'var(--brand)', height:52, flexShrink:0, gap:8 }}>
        <button onClick={() => setMobileSheet(v=>!v)}
          style={{ background:'none', border:'none', color:'#fff', cursor:'pointer',
            display:'flex', alignItems:'center', padding:4 }}>
          <PanelLeft size={22}/>
        </button>
        <div style={{ flex:1, fontSize:15, fontWeight:700, color:'#fff', letterSpacing:'-0.02em' }}>
          {selProj ? selProj.name : 'Notatapp'}
        </div>
        <button onClick={()=>{ import('./supabase').then(m=>m.supabase.auth.signOut()) }}
          style={{ background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.2)',
            borderRadius:'var(--r)', padding:'5px 10px', color:'rgba(255,255,255,.8)',
            fontSize:11, cursor:'pointer' }}>
          Logg ut
        </button>
      </div>

      {/* Mobile sidebar drawer */}
      {mobileSheet && (
        <>
          <div onClick={() => setMobileSheet(false)}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', zIndex:100 }}/>
          <div style={{ position:'fixed', left:0, top:0, bottom:0, width:280,
            zIndex:101, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <Sidebar projects={projects} notes={notes}
              onSelectProject={id => { handleSelectProject(id); setMobileSheet(false) }}
              onSelectNote={id => { handleSelectNote(id); setMobileSheet(false) }}
              selectedProjectId={selectedProjectId}
              onDeleteProject={deleteProject}
              onNewNote={() => { handleNewNote('regular'); setMobileSheet(false) }}
              onToggleFavorite={toggleFavorite}/>
          </div>
        </>
      )}

      {/* Mobile content */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px' }}>
        {view==='new'      && <NoteInput projects={projects} onAdd={handleAdd} onAutoSave={handleAutoSave} onSetEditNote={(noteOrId) => { if (noteOrId?._autoCreated) setPendingEditId(noteOrId.id); else setEditNote(noteOrId) }} defaultProjectId={defaultProjectId} editNote={editNote} onCancelEdit={handleCancelEdit} isMeeting={isMeeting && !editNote} isTaskOnly={isTaskOnly && !editNote}/>}
        {view==='notatar'  && <NoteList notes={visibleNotes} {...listProps} highlightNoteId={highlightNoteId}/>}
        {view==='fristar'  && <DeadlineView notes={visibleNotes} {...listProps}/>}
        {view==='kalender' && <CalendarView notes={visibleNotes} projects={projects} onDelete={deleteNote} onToggleDone={toggleDone} onEdit={handleEdit}/>}
      </div>

      {/* Mobile bottom nav */}
      <div style={{ display:'flex', background:'var(--brand)',
        borderTop:'1px solid rgba(255,255,255,.1)', flexShrink:0,
        paddingBottom:'env(safe-area-inset-bottom)' }}>
        <MobileTab v="new"      icon={Plus}       label="Nytt" onClick={() => { handleNewNote('regular'); setMobileSheet(false) }}/>
        <MobileTab v="notatar"  icon={LayoutList}  label="Notatar"/>
        <MobileTab v="fristar"  icon={AlertCircle} label="Fristar"/>
        <MobileTab v="kalender" icon={Calendar}    label="Kalender"/>
      </div>
    </div>
  )

  // ── Desktop layout ──────────────────────────────────────────────────
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
                  onNewNote={handleNewNote} onToggleFavorite={toggleFavorite}
                  onRenameProject={handleRenameProject} mode={mode}/>
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
              {/* Mode toggle */}
              <button onClick={() => setMode(m => m==='work'?'private':'work')}
                title={mode==='work'?'Byt til privat modus':'Byt til jobb-modus'}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px',
                  border:'1.5px solid rgba(255,255,255,.35)',
                  background: mode==='private'?'rgba(255,255,255,.25)':'rgba(255,255,255,.1)',
                  borderRadius:'var(--r)', color:'#fff', fontSize:12, fontWeight:700,
                  cursor:'pointer', transition:'all .2s', flexShrink:0 }}>
                {mode==='work' ? '💼 Jobb' : '🏠 Privat'}
              </button>
              <div style={{width:4}}/>
              <Tab v="new"      icon={Plus}       label="Nytt notat" onClick={()=>handleNewNote('regular')}/>
              <button onClick={()=>handleNewNote('meeting')}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px',
                  border:'1.5px solid rgba(255,255,255,.3)', background:'rgba(255,255,255,.08)',
                  borderRadius:'var(--r)', color:'rgba(255,255,255,.75)',
                  fontSize:13, cursor:'pointer', fontWeight:400, transition:'all .15s', whiteSpace:'nowrap' }}>
                📋 Møtenotat
              </button>
              <button onClick={()=>handleNewNote('task')}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px',
                  border:'1.5px solid rgba(255,255,255,.3)', background:'rgba(255,255,255,.08)',
                  borderRadius:'var(--r)', color:'rgba(255,255,255,.75)',
                  fontSize:13, cursor:'pointer', fontWeight:400, transition:'all .15s', whiteSpace:'nowrap' }}>
                ✅ Ny oppgåve
              </button>
              <Tab v="notatar"  icon={LayoutList}  label="Notatar"/>
              <Tab v="timar"    icon={Clock}       label="Timar"/>
              <Tab v="overskride" icon={AlertCircle} label="Overskride"/>
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
              <div style={{fontSize:11,color:'rgba(255,255,255,.5)',maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{userEmail}</div>
              <button onClick={()=>{ import('./supabase').then(m=>m.supabase.auth.signOut()) }}
                style={{padding:'4px 10px',background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.2)',borderRadius:'var(--r)',color:'rgba(255,255,255,.8)',fontSize:11,cursor:'pointer',whiteSpace:'nowrap',marginLeft:4}}>
                Logg ut
              </button>
              <div style={{width:4}}/>
              <IcoBtn onClick={()=>setCalCollapsed(v=>!v)} active={calCollapsed} title="Kalender"><Calendar size={16}/></IcoBtn>
            </div>

            <div style={{ flex:1,overflowY:'auto',padding:'22px 26px' }}>
              {view==='new'        && <NoteInput projects={projects} onAdd={handleAdd} onAutoSave={handleAutoSave} onSetEditNote={(noteOrId) => { if (noteOrId?._autoCreated) setPendingEditId(noteOrId.id); else setEditNote(noteOrId) }} defaultProjectId={defaultProjectId} editNote={editNote} onCancelEdit={handleCancelEdit} isMeeting={isMeeting && !editNote} isTaskOnly={isTaskOnly && !editNote}/>}
              {view==='notatar'    && <NoteList notes={visibleNotes} {...listProps} highlightNoteId={highlightNoteId}/>}
              {view==='timar'      && <TimeTracker userId={userId} projects={projects} addProject={addProject} mode={mode}/>}
        {view==='overskride' && <OverdueView notes={modeNotes} projects={projects} {...listProps}/>}
              {view==='fristar'    && <DeadlineView notes={visibleNotes} {...listProps}/>}
              {view==='kalender'   && <CalendarView notes={visibleNotes} projects={projects} onDelete={deleteNote} onToggleDone={toggleDone} onEdit={handleEdit}/>}
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
          <div style={{ height:tlHeight,minHeight:90,maxHeight:600,flexShrink:0 }}>
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
