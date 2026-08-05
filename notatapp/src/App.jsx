import { useState, useCallback, useRef, useEffect } from 'react'
import { useStore } from './useStore'
import AppRail from './AppRail'
import Sidebar from './Sidebar'
import NoteInput from './NoteInput'
import NoteList from './NoteList'
import DeadlineView from './DeadlineView'
import TimeTracker from './TimeTracker'
import ForecastView from './ForecastView'
import SettingsPanel from './SettingsPanel'
import CalendarView from './CalendarView'
import Timeline from './Timeline'
import TimarModule from './TimarModule'
import KvalitetModule from './KvalitetModule'
import ProsjektModule from './ProsjektModule'
import KundeModule from './KundeModule'
import OppgaveModule from './OppgaveModule'
import FargeModule from './FargeModule'

const INITIAL_SB_W  = 260
const INITIAL_CAL_W = 260
const INITIAL_TL_H  = 200
const MIN_W = 160, MAX_W = 600

export default function App({ userId, userEmail }) {
  const { notes, projects, loading, addNote, updateNote, deleteNote, toggleDone,
          addTask, updateTask, deleteTask, addProject, updateProject, deleteProject, toggleFavorite,
          offices, addOffice, updateOffice, deleteOffice } = useStore(userId)

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
  const [newNoteMenuOpen,   setNewNoteMenuOpen]   = useState(false)
  const newNoteMenuRef = useRef(null)
  const [isTaskOnly,        setIsTaskOnly]        = useState(false)
  const [isReferat,         setIsReferat]         = useState(false)
  const [pendingEditId,     setPendingEditId]     = useState(null)
  const [isMobile,          setIsMobile]          = useState(window.innerWidth < 768)
  const [mobileSheet,       setMobileSheet]       = useState(false)
  const [activeOfficeId,    setActiveOfficeId]    = useState(null)    // null = show all
  const [showSettings,      setShowSettings]      = useState(false)
  const [activeModule,      setActiveModule]      = useState('notatar') // 'notatar' | 'timar' | 'kvalitet'

  // Expose nextFriday to NoteList via window (simple bridge)
  useEffect(() => {
    import('./dateUtils').then(m => { window._dateUtils = m })
  }, [])

  // Close "Nytt notat" dropdown when clicking outside
  useEffect(() => {
    if (!newNoteMenuOpen) return
    const handler = (e) => {
      if (newNoteMenuRef.current && !newNoteMenuRef.current.contains(e.target)) {
        setNewNoteMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [newNoteMenuOpen])

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

  // Apply colour theme based on active office
  useEffect(() => {
    const el = document.documentElement
    el.classList.remove('theme-private', 'theme-norconsult')
    const office = offices.find(o => o.id === activeOfficeId)
    if (!office) return
    // Map office color to CSS class
    const color = office.color || ''
    if (color.startsWith('#C25') || color.startsWith('#D46') || color.startsWith('#E07')) {
      el.classList.add('theme-norconsult')
    } else if (color.startsWith('#1A5') || color.startsWith('#1E6') || color.startsWith('#3B8')) {
      el.classList.add('theme-private')
    }
    // Default (green) needs no class
  }, [activeOfficeId, offices])

  // Set initial office when offices load — Norconsult som standard
  useEffect(() => {
    if (offices.length > 0 && activeOfficeId === null) {
      const nc = offices.find(o => o.name && o.name.toLowerCase().indexOf('norconsult') >= 0)
      setActiveOfficeId(nc ? nc.id : offices[0].id)
    }
  }, [offices.length])

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
      const p = await addProject(newProjName, mode, activeOfficeId)
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
      const p = await addProject(newProjName, mode, activeOfficeId)
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

  const handleEdit        = note => { setEditNote(note); setIsMeeting(!!note.isMeeting); setIsTaskOnly(false); setIsReferat(!!note.isReferat); setView('new') }
  const handleRenameProject  = (id, name)      => updateProject(id, { name })
  const handleRenameNote     = (id, title)     => updateNote(id, { title })
  const handleMoveToProject  = (noteId, projId) => updateNote(noteId, { projectId: projId })
  const handleCancelEdit  = ()   => { setEditNote(null); setIsMeeting(false); setIsTaskOnly(false); setIsReferat(false); setView('notatar') }
  const handleSelectProject = id => { setSelectedProjectId(id); setView('notatar') }
  const handleNewNote = (type='regular') => {
    setEditNote(null)
    setIsMeeting(type === 'meeting')
    setIsTaskOnly(type === 'task')
    setIsReferat(type === 'referat')
    setView('new')
  }
  const handleSelectNote  = id  => {
    setSelectedProjectId(null); setView('notatar')
    setHighlightNoteId(id); setTimeout(()=>setHighlightNoteId(null),2000)
  }

  const defaultProjectId = view==='new' && !editNote ? selectedProjectId : undefined
  const selProj          = selectedProjectId ? projects.find(p=>p.id===selectedProjectId) : null
  // Filter projects and notes by active office
  const activeOffice     = offices.find(o => o.id === activeOfficeId)
  const mode             = activeOffice
    ? (activeOffice.color?.startsWith('#1A5') ? 'private' : 'work') : 'work'
  const officeProjects   = activeOfficeId
    ? projects.filter(p => p.officeId === activeOfficeId)
    : projects
  const officeProjectIds = new Set(officeProjects.map(p => p.id))
  // All project IDs that belong to OTHER offices (exclude from view)
  const otherOfficeIds   = new Set(
    projects.filter(p => p.officeId && p.officeId !== activeOfficeId).map(p => p.id)
  )
  const modeNotes        = notes.filter(n => {
    if (!n.projectId) return true                    // no project → always show
    if (otherOfficeIds.has(n.projectId)) return false // belongs to another office → hide
    if (activeOfficeId) return officeProjectIds.has(n.projectId) // must match office
    return true
  })
  const visibleNotes     = selectedProjectId
    ? modeNotes.filter(n => n.projectId === selectedProjectId)
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

  const Tab = ({ v, letter, label, onClick }) => {
    const active = view===v
    return (
      <button onClick={onClick||(() => { setView(v); if (v!=='new') setEditNote(null) })}
        style={{ display:'flex',alignItems:'center',gap:7,padding:'7px 14px',
          border:'1.5px solid',
          borderColor:active?'rgba(255,255,255,.6)':'transparent',
          background:active?'rgba(255,255,255,.18)':'transparent',
          borderRadius:'var(--r)',color:active?'#fff':'rgba(255,255,255,.7)',
          fontSize:14,cursor:'pointer',fontWeight:active?700:500,transition:'all .15s' }}>
        {letter && <span style={{ width:20,height:20,borderRadius:5,
          background: active?'rgba(255,255,255,.92)':'rgba(255,255,255,.18)',
          color: active?'var(--brand)':'#fff',
          display:'flex',alignItems:'center',justifyContent:'center',
          fontSize:11,fontWeight:800,flexShrink:0 }}>{letter}</span>}
        {label}
      </button>
    )
  }

  if (loading) return (
    <div style={{minHeight:'100vh',background:'var(--brand)',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{color:'rgba(255,255,255,.6)',fontSize:14}}>Lastar notatar…</div>
    </div>
  )

  // ── Mobile topbar tabs ────────────────────────────────────────────────
  const MobileTab = ({ v, letter, label, onClick }) => {
    const active = view === v
    return (
      <button onClick={onClick || (() => { setView(v); setEditNote(null); setMobileSheet(false) })}
        style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3,
          padding:'8px 4px', border:'none', background:'none',
          color: active ? '#fff' : 'rgba(255,255,255,.5)',
          fontSize:11, fontWeight: active ? 700 : 500, cursor:'pointer' }}>
        <span style={{ width:22,height:22,borderRadius:6,
          background: active?'rgba(255,255,255,.92)':'rgba(255,255,255,.15)',
          color: active?'var(--brand)':'rgba(255,255,255,.7)',
          display:'flex',alignItems:'center',justifyContent:'center',
          fontSize:12,fontWeight:800 }}>{letter}</span>
        {label}
      </button>
    )
  }

  if (isMobile) return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh',
      overflow:'hidden', background:'var(--bg)', position:'relative' }}>

      {/* Mobile topbar */}
      <div style={{ display:'flex', alignItems:'center', padding:'0 12px',
        background:'#0A0A0A', height:52, flexShrink:0, gap:8 }}>
        <button onClick={() => setMobileSheet(v=>!v)}
          style={{ background:'none', border:'none', color:'#fff', cursor:'pointer',
            display:'flex', alignItems:'center', padding:4 }}>
          <span style={{ width:22,height:22,borderRadius:6,background:'rgba(255,255,255,.15)',
            display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:12,fontWeight:800 }}>M</span>
        </button>
        <div style={{ flex:1, fontSize:15, fontWeight:700, color:'#fff', letterSpacing:'-0.02em' }}>
          {selProj ? selProj.name : (MODULE_LABELS[activeModule] || 'LiedLab')}
        </div>
        {/* Module switcher pills */}
        <div style={{ display:'flex', gap:3, marginRight:4 }}>
          {[{k:'notatar',l:'N'},{k:'prosjekt',l:'P'},{k:'kunde',l:'K'},{k:'oppgaver',l:'O'},{k:'timar',l:'T'},{k:'kvalitet',l:'KS'},{k:'farge',l:'F'}].map(m => (
            <button key={m.k} onClick={() => { setActiveModule(m.k); if(m.k!=='notatar') setView('notatar') }}
              style={{ width:24,height:24,borderRadius:6,border:'none',
                background: activeModule===m.k ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.08)',
                color: activeModule===m.k ? '#fff' : 'rgba(255,255,255,.45)',
                fontSize:11,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
              {m.l}
            </button>
          ))}
        </div>
        <button onClick={() => setShowSettings(true)}
          title="Innstillingar"
          style={{ display:'flex', flexDirection:'column', gap:3, padding:'7px 8px',
            background:'rgba(255,255,255,.1)', border:'1.5px solid rgba(255,255,255,.2)',
            borderRadius:'var(--r)', cursor:'pointer', flexShrink:0 }}>
          <span style={{display:'block',width:14,height:2,background:'rgba(255,255,255,.85)',borderRadius:1}}/>
          <span style={{display:'block',width:14,height:2,background:'rgba(255,255,255,.85)',borderRadius:1}}/>
          <span style={{display:'block',width:14,height:2,background:'rgba(255,255,255,.85)',borderRadius:1}}/>
        </button>
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
            <Sidebar projects={officeProjects} notes={modeNotes}
              onSelectProject={id => { handleSelectProject(id); setMobileSheet(false) }}
              onSelectNote={id => { handleSelectNote(id); setMobileSheet(false) }}
              selectedProjectId={selectedProjectId}
              onDeleteProject={deleteProject}
              onNewNote={() => { handleNewNote('regular'); setMobileSheet(false) }}
              onToggleFavorite={toggleFavorite}
              onRenameProject={handleRenameProject}
              offices={offices} activeOfficeId={activeOfficeId} onSetOffice={setActiveOfficeId}
              onAddOffice={addOffice} onUpdateOffice={updateOffice} onDeleteOffice={deleteOffice}
                  onOpenSettings={() => setShowSettings(true)}
              mode={mode}/>
          </div>
        </>
      )}

      {/* Mobile content */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px' }}>
        {activeModule === 'notatar' && (
          <>
            {view==='new'      && <NoteInput projects={projects} onAdd={handleAdd} onAutoSave={handleAutoSave} onSetEditNote={(noteOrId) => { if (noteOrId?._autoCreated) setPendingEditId(noteOrId.id); else setEditNote(noteOrId) }} defaultProjectId={defaultProjectId} editNote={editNote} onCancelEdit={handleCancelEdit} isMeeting={isMeeting} isTaskOnly={isTaskOnly && !editNote} isReferat={isReferat} userId={userId}/>}
            {view==='notatar'  && <NoteList notes={visibleNotes} {...listProps} highlightNoteId={highlightNoteId}/>}
            {view==='timar'    && <TimeTracker userId={userId} projects={officeProjects} addProject={(n,t)=>addProject(n,t,activeOfficeId)} mode={mode}/>}
            {view==='prognose' && <ForecastView userId={userId} projects={officeProjects} mode={mode}/>}
            {view==='fristar'  && <DeadlineView notes={modeNotes} projects={projects} {...listProps}/>}
          </>
        )}
        {activeModule === 'timar' && <TimeTracker userId={userId} projects={officeProjects} addProject={(n,t)=>addProject(n,t,activeOfficeId)} mode={mode}/>}
        {activeModule === 'prosjekt' && <ProsjektModule userId={userId} projects={officeProjects} offices={offices} activeOfficeId={activeOfficeId} addProject={addProject}/>}
        {activeModule === 'kunde' && <KundeModule userId={userId} activeOfficeId={activeOfficeId}/>}
        {activeModule === 'kvalitet' && <KvalitetModule userId={userId} projects={officeProjects} activeOfficeId={activeOfficeId}/>}
        {activeModule === 'oppgaver' && <OppgaveModule userId={userId} projects={officeProjects} activeOfficeId={activeOfficeId}/>}
        {activeModule === 'farge' && <FargeModule userId={userId} projects={officeProjects} activeOfficeId={activeOfficeId}/>}
      </div>

      {/* Mobile bottom nav */}
      <div style={{ display:'flex', background:'var(--brand)',
        borderTop:'1px solid rgba(255,255,255,.1)', flexShrink:0,
        paddingBottom:'env(safe-area-inset-bottom)' }}>
        <MobileTab v="new"      letter="N" label="Nytt" onClick={() => { handleNewNote('regular'); setMobileSheet(false) }}/>
        <MobileTab v="notatar"  letter="L" label="Notatar"/>
        <MobileTab v="timar"    letter="T" label="Timar"/>
        <MobileTab v="fristar"  letter="F" label="Fristar"/>
      </div>

      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          offices={offices}
          activeOfficeId={activeOfficeId}
          userId={userId}
          userEmail={userEmail}
          onAddOffice={addOffice}
          onUpdateOffice={updateOffice}
          onDeleteOffice={deleteOffice}
        />
      )}
    </div>
  )

  // ── Desktop layout ──────────────────────────────────────────────────
  return (
    /* Outer wrapper with AppRail on the far left */
    <div style={{ display:'flex', height:'100vh', overflow:'hidden',
      background:'var(--bg)', boxSizing:'border-box' }}>

      {/* App Rail — leftmost vertical navigation */}
      <AppRail
        activeModule={activeModule}
        onModuleChange={setActiveModule}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Module content area */}
      {activeModule === 'prosjekt' ? (
        <ProsjektModule userId={userId} projects={officeProjects} offices={offices}
          activeOfficeId={activeOfficeId} addProject={addProject}/>
      ) : activeModule === 'kunde' ? (
        <KundeModule userId={userId} activeOfficeId={activeOfficeId}/>
      ) : activeModule === 'oppgaver' ? (
        <OppgaveModule userId={userId} projects={officeProjects} activeOfficeId={activeOfficeId}/>
      ) : activeModule === 'timar' ? (
        <TimarModule userId={userId} projects={officeProjects}
          addProject={addProject} mode={mode} activeOfficeId={activeOfficeId}/>
      ) : activeModule === 'kvalitet' ? (
        <KvalitetModule userId={userId} projects={officeProjects} activeOfficeId={activeOfficeId}/>
      ) : activeModule === 'farge' ? (
        <FargeModule userId={userId} projects={officeProjects} activeOfficeId={activeOfficeId}/>
      ) : (
      /* ── Notatar module (original layout) ── */
      <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden', minWidth:0 }}>
      <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
        {/* Upper section */}
        <div style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>

          {/* Sidebar */}
          {!sbCollapsed && (
            <>
              <aside style={{ width:sbWidth,minWidth:sbWidth,overflow:'hidden',flexShrink:0,display:'flex',flexDirection:'column' }}>
                <Sidebar projects={officeProjects} notes={modeNotes}
                  onSelectProject={handleSelectProject} onSelectNote={handleSelectNote}
                  selectedProjectId={selectedProjectId} onDeleteProject={deleteProject}
                  onNewNote={handleNewNote} onToggleFavorite={toggleFavorite}
                  onRenameProject={handleRenameProject}
                  offices={offices} activeOfficeId={activeOfficeId} onSetOffice={setActiveOfficeId}
                  onAddOffice={addOffice} onUpdateOffice={updateOffice} onDeleteOffice={deleteOffice}
                  onOpenSettings={() => setShowSettings(true)}
                  mode={mode}/>
              </aside>
              <div className="resize-handle" onMouseDown={e=>onColMouseDown('sb',e)}/>
            </>
          )}

          {/* Main */}
          <main style={{ flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0 }}>
            <div style={{ display:'flex',alignItems:'center',gap:4,padding:'0 12px',
              borderBottom:'1px solid rgba(255,255,255,.1)',background:'var(--brand)',
              height:50,flexShrink:0 }}>
              <IcoBtn onClick={()=>setSbCollapsed(v=>!v)} active={sbCollapsed} title="Meny"><span style={{fontWeight:800,fontSize:13}}>M</span></IcoBtn>
              <div style={{width:8}}/>
              {/* Combined "Nytt notat" button with dropdown arrow */}
              <div style={{ position:'relative' }} ref={newNoteMenuRef}>
                <div style={{ display:'flex' }}>
                  <button onClick={()=>handleNewNote('regular')}
                    style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 16px',
                      border:'1.5px solid rgba(255,255,255,.4)', borderRight:'none',
                      borderRadius:'var(--r) 0 0 var(--r)',
                      background:'rgba(255,255,255,.14)', color:'#fff',
                      fontSize:14, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                    Nytt notat
                  </button>
                  <button onClick={() => setNewNoteMenuOpen(v => !v)}
                    title="Fler typer notat"
                    style={{ display:'flex', alignItems:'center', justifyContent:'center',
                      padding:'7px 10px',
                      border:'1.5px solid rgba(255,255,255,.4)',
                      borderRadius:'0 var(--r) var(--r) 0',
                      background: newNoteMenuOpen ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.14)',
                      color:'#fff', cursor:'pointer',
                      transition:'background .15s, transform .2s' }}>
                    <span style={{ fontSize:14, display:'inline-block', transform: newNoteMenuOpen ? 'rotate(180deg)' : 'none', transition:'transform .2s' }}>▾</span>
                  </button>
                </div>
                {newNoteMenuOpen && (
                  <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:50,
                    background:'var(--bg2)', border:'1.5px solid var(--brand3)',
                    borderRadius:'var(--r2)', minWidth:200, overflow:'hidden',
                    boxShadow:'var(--shadow-lg)',
                    animation:'dropdownIn .15s ease-out' }}>
                    <button onClick={()=>{ handleNewNote('meeting'); setNewNoteMenuOpen(false) }}
                      style={{ width:'100%', textAlign:'left', padding:'12px 16px',
                        background:'none', border:'none', cursor:'pointer',
                        fontSize:14, fontWeight:600, color:'var(--text)', fontFamily:'var(--font)',
                        display:'flex', alignItems:'center', gap:10 }}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                      onMouseLeave={e=>e.currentTarget.style.background='none'}>
                      <span style={{width:26,height:26,borderRadius:7,background:'var(--brandbg)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,color:'var(--brand)',fontSize:13,flexShrink:0}}>M</span>
                      Nytt møtenotat
                    </button>
                    <div style={{height:1,background:'var(--border)'}}/>
                    <button onClick={()=>{ handleNewNote('referat'); setNewNoteMenuOpen(false) }}
                      style={{ width:'100%', textAlign:'left', padding:'12px 16px',
                        background:'none', border:'none', cursor:'pointer',
                        fontSize:14, fontWeight:600, color:'var(--text)', fontFamily:'var(--font)',
                        display:'flex', alignItems:'center', gap:10 }}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                      onMouseLeave={e=>e.currentTarget.style.background='none'}>
                      <span style={{width:26,height:26,borderRadius:7,background:'var(--brandbg)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,color:'var(--brand)',fontSize:13,flexShrink:0}}>R</span>
                      Nytt møtereferat
                    </button>
                    <div style={{height:1,background:'var(--border)'}}/>
                    <button onClick={()=>{ handleNewNote('task'); setNewNoteMenuOpen(false) }}
                      style={{ width:'100%', textAlign:'left', padding:'12px 16px',
                        background:'none', border:'none', cursor:'pointer',
                        fontSize:14, fontWeight:600, color:'var(--text)', fontFamily:'var(--font)',
                        display:'flex', alignItems:'center', gap:10 }}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                      onMouseLeave={e=>e.currentTarget.style.background='none'}>
                      <span style={{width:26,height:26,borderRadius:7,background:'var(--brandbg)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,color:'var(--brand)',fontSize:13,flexShrink:0}}>O</span>
                      Ny oppgåve
                    </button>
                  </div>
                )}
              </div>
              <div style={{width:10}}/>
              <Tab v="timar"    letter="T" label="Timar"/>
              <Tab v="prognose" letter="P" label="Prognose"/>
              <Tab v="fristar"  letter="F" label="Fristar"/>
              <div style={{flex:1}}/>
              {selProj&&(
                <div style={{ display:'flex',alignItems:'center',gap:7,fontSize:12,
                  color:'rgba(255,255,255,.75)',marginRight:6 }}>
                  <span style={{ width:7,height:7,borderRadius:'50%',background:'rgba(255,255,255,.6)' }}/>
                  <span style={{ fontFamily:'var(--mono)',fontWeight:500 }}>{selProj.name}</span>
                </div>
              )}
              <IcoBtn onClick={()=>setTlCollapsed(v=>!v)} active={!tlCollapsed} title="Tidslinje"><span style={{fontWeight:800,fontSize:13}}>T</span></IcoBtn>
              <div style={{width:4}}/>
              <div style={{fontSize:11,color:'rgba(255,255,255,.5)',maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{userEmail}</div>
              <button onClick={()=>{ import('./supabase').then(m=>m.supabase.auth.signOut()) }}
                style={{padding:'4px 10px',background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.2)',borderRadius:'var(--r)',color:'rgba(255,255,255,.8)',fontSize:11,cursor:'pointer',whiteSpace:'nowrap',marginLeft:4}}>
                Logg ut
              </button>
              <div style={{width:4}}/>
              <IcoBtn onClick={()=>setCalCollapsed(v=>!v)} active={calCollapsed} title="Kalender"><span style={{fontWeight:800,fontSize:13}}>K</span></IcoBtn>
            </div>

            <div style={{ flex:1,overflowY:'auto',padding:'22px 26px' }}>
              {view==='new'        && <NoteInput projects={projects} onAdd={handleAdd} onAutoSave={handleAutoSave} onSetEditNote={(noteOrId) => { if (noteOrId?._autoCreated) setPendingEditId(noteOrId.id); else setEditNote(noteOrId) }} defaultProjectId={defaultProjectId} editNote={editNote} onCancelEdit={handleCancelEdit} isMeeting={isMeeting} isTaskOnly={isTaskOnly && !editNote} isReferat={isReferat} userId={userId}/>}
              {view==='notatar'    && <NoteList notes={visibleNotes} {...listProps} highlightNoteId={highlightNoteId}/>}
              {view==='timar'      && <TimeTracker userId={userId} projects={officeProjects} addProject={(n,t)=>addProject(n,t,activeOfficeId)} mode={mode}/>}
              {view==='prognose'   && <ForecastView userId={userId} projects={officeProjects} mode={mode}/>}
              {view==='fristar'    && <DeadlineView notes={modeNotes} projects={projects} {...listProps}/>}
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
      <StatusBar activeModule={activeModule}/>
      </div>
      )} {/* end notatar module ternary */}

      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          offices={offices}
          activeOfficeId={activeOfficeId}
          userId={userId}
          userEmail={userEmail}
          onAddOffice={addOffice}
          onUpdateOffice={updateOffice}
          onDeleteOffice={deleteOffice}
        />
      )}
    </div>
)
}

const MODULE_LABELS = { notatar:'Notatar', prosjekt:'Prosjekt', kunde:'Kundar', oppgaver:'Oppg\u00E5ver', timar:'Timar', kvalitet:'Kvalitetssystem', farge:'Farge' }

function StatusBar({ activeModule }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const days = ['søn','man','tir','ons','tor','fre','lør']
  const months = ['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des']
  const dateStr = `${days[now.getDay()]} ${now.getDate()}. ${months[now.getMonth()]} ${now.getFullYear()}`
  const timeStr = now.toLocaleTimeString('no-NO', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false })
  return (
    <div style={{ height:36, flexShrink:0, background:'#0A0A0A',
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'0 16px', borderTop:'1px solid rgba(255,255,255,.1)' }}>
      <span style={{ fontSize:12, color:'rgba(255,255,255,.55)', fontWeight:500 }}>
        LiedLab · {MODULE_LABELS[activeModule] || 'Notatar'}
      </span>
      <span style={{ fontSize:13, color:'rgba(255,255,255,.9)', fontWeight:600,
        fontFamily:'var(--mono)', letterSpacing:'.03em' }}>
        {dateStr} &nbsp;·&nbsp; {timeStr}
      </span>
      <span style={{ fontSize:11, color:'rgba(255,255,255,.4)' }}>v9</span>
    </div>
)
}
