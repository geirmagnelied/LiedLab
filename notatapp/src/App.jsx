import Dashboard from './Dashboard'
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useStore } from './useStore'
import BrukarModule from './BrukarModule'
import SketchPad from './SketchPad'
import { settEksportBrukar } from './notatPdf'
import { startBokmalOmsetjar } from './bokmalOmsetjar'
import useBrukar from './useBrukar'
import { SprakKontekst, lagT } from './sprak'
import AppRail, { PARENT_AV_MODUL, RAIL_MODUSAR, RAIL_BREIDD } from './AppRail'
import AppRailUndermeny from './AppRailUndermeny'
import MalarModule from './MalarModule'
import { Camera, Plus, FileText as NotatIkon, Users as MoteIkon, ClipboardList, CheckSquare } from 'lucide-react'
import { ProsjektVelger } from './TopBar'
import KontordriftModule from './KontordriftModule'
import FramdriftModule from './FramdriftModule'
import TopBar from './TopBar'
import Sidebar from './Sidebar'
import NoteModal from './NoteModal'
import NoteTabell from './NoteTabell'
import NotePreview from './NotePreview'
import SokeFelt from './SokeFelt'
import BileteModule from './BileteModule'
import DeadlineView from './DeadlineView'
import TimeTracker from './TimeTracker'
import ForecastView from './ForecastView'
import SettingsPanel from './SettingsPanel'
import KalenderModule from './KalenderModule'
import Timeline from './Timeline'
import TimarModule from './TimarModule'
import KvalitetModule from './KvalitetModule'
import ProsjektModule from './ProsjektModule'
import KundeModule from './KundeModule'
import OppgaveModule from './OppgaveModule'
import FargeModule from './FargeModule'
import SakerModule from './SakerModule'
import DTMModule from './DTMModule'

const INITIAL_TL_H  = 200

function AppInnhald({ userId, userEmail, brukar }) {
  const { notes, projects, loading, addNote, updateNote, deleteNote, toggleDone,
          toggleNoteFavorite, toggleNotePinned,
          noteColumns, addNoteColumn, deleteNoteColumn, setNoteExtraValue,
          addTask, updateTask, deleteTask, addProject, updateProject, deleteProject, toggleFavorite,
          offices, addOffice, updateOffice, deleteOffice } = useStore(userId)

  const [view,              setView]              = useState('notatar')
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [tlCollapsed,       setTlCollapsed]       = useState(false)
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
  const [fabMeny,           setFabMeny]           = useState(false)   // pluss-knappen (mobil): notattypar
  const [bileteMelding,     setBileteMelding]     = useState('')
  const fotoRef = useRef(null)
  const [activeOfficeId,    setActiveOfficeId]    = useState(null)    // null = show all
  const [showSettings,      setShowSettings]      = useState(false)
  const [skisseMelding, setSkisseMelding] = useState('')
  const [railLive, setRailLive] = useState(null) // breidd på VN under dragning (så logorutå i toppen følgjer med)
  const [railModus, setRailModus] = useState(() => { try { const v = localStorage.getItem('liedlab-rail-modus'); return RAIL_MODUSAR.includes(v) ? v : 'min' } catch { return 'min' } })
  const settRailModus = (m) => { setRailModus(m); try { localStorage.setItem('liedlab-rail-modus', m) } catch { /* privat modus */ } }
  const [activeModule,      setActiveModule]      = useState('dashboard') // startsida; elles 'notatar' | 'timar' | 'kvalitet' …
  const [selectedNoteId,    setSelectedNoteId]    = useState(null) // markert (enkeltklikka) notat i NoteTabell — vist i NotePreview
  const [previewWidth,      setPreviewWidth]      = useState(() => {
    try { const v = parseInt(localStorage.getItem('liedlab-notat-preview-w')); return isNaN(v) ? 380 : v }
    catch { return 380 }
  })

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

  const handleSetOffice = (id) => { setActiveOfficeId(id); setSelectedProjectId(null) }

  // Full save / done — used by task-only and explicit save
  // Skisse (VN): lagrar skissa som notat i valt prosjekt
  const lagreSkisse = async (url) => {
    const d = new Date()
    const tittel = 'Skisse ' + d.toLocaleDateString('nb-NO') + ' ' + d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
    await addNote({ title: tittel, text: '', html: '', tasks: [], tag: null, projectId: selectedProjectId || null, sketchDataUrl: url, attachments: [], isMeeting: false })
    setSkisseMelding('Skissa er lagra som notat: «' + tittel + '»')
    setTimeout(() => setSkisseMelding(''), 6000)
  }

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
  // Søk (SokeFelt, sjå claude/sok-modul.md) — søkjer i FULL notes-lista
  // (ikkje berre visibleNotes), sidan eit treff skal opnast uansett kva
  // prosjekt/modus-filter som tilfeldigvis er aktivt no.
  const sokVelgNotat = r => { if (r.kjelde_tabell === 'notes') { const n = notes.find(x => x.id === r.kjelde_id); if (n) handleEdit(n) } }
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

  // Justerbar breidd på førehandsvisings-ruta i den todelte notat-dashbordet
  // (NoteTabell til venstre, NotePreview til høgre) — sjå claude/notatmodul-tabellvisning.md
  // Merk: previewWidth er breidda på HØGRE rute, så å dra skiljelinja mot
  // høgre skal gjere ho smalare — difor trekk vi frå deltaX, ikkje legg til.
  // Maksbreidda er sett dynamisk (70 % av vindaugsbreidda, aldri under 500px)
  // i staden for eit fast tak — den gamle faste grensa på 760px kjentest ut
  // som ei sperre på om lag 1/4 av skjermbreidda på ein vanleg skjerm.
  const maxPreviewWidth = () => Math.max(500, Math.round(window.innerWidth * 0.7))
  const startPreviewResize = (e) => {
    e.preventDefault()
    const startX = e.clientX, startW = previewWidth
    const flytt = (ev) => {
      const ny = Math.max(240, Math.min(maxPreviewWidth(), Math.round(startW - (ev.clientX - startX))))
      setPreviewWidth(ny)
    }
    const slepp = () => {
      window.removeEventListener('mousemove', flytt)
      window.removeEventListener('mouseup', slepp)
      document.body.style.cursor = ''
      setPreviewWidth(w => { try { localStorage.setItem('liedlab-notat-preview-w', String(w)) } catch { /* privat modus */ } ; return w })
    }
    document.body.style.cursor = 'col-resize'
    window.addEventListener('mousemove', flytt)
    window.addEventListener('mouseup', slepp)
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
  // ── Aktivt prosjekt (valt i TopBar) — filtrerer visninga for modular som opererer på eitt prosjekt om gongen
  const activeProjectFiltered = selectedProjectId
    ? officeProjects.filter(p => p.id === selectedProjectId)
    : officeProjects
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
        borderColor:active?'var(--brand)':'var(--border)',
        background:active?'#fff':'rgba(255,255,255,.5)',
        borderRadius:'var(--r)',display:'flex',alignItems:'center',justifyContent:'center',
        cursor:'pointer',color:active?'var(--brand)':'var(--text2)',flexShrink:0,transition:'all .15s' }}>
      {children}
    </button>
  )

  const Tab = ({ v, letter, label, onClick }) => {
    const active = view===v
    return (
      <button onClick={onClick||(() => { setView(v); if (v!=='new') setEditNote(null) })}
        style={{ display:'flex',alignItems:'center',gap:7,padding:'7px 14px',
          border:'1.5px solid',
          borderColor:active?'var(--brand)':'transparent',
          background:active?'#fff':'transparent',
          borderRadius:'var(--r)',color:active?'var(--brand)':'var(--text2)',
          fontSize:14,cursor:'pointer',fontWeight:active?700:500,transition:'all .15s' }}>
        {letter && <span style={{ width:20,height:20,borderRadius:5,
          background: active?'var(--brand)':'rgba(27,42,58,.1)',
          color: active?'#fff':'var(--text2)',
          display:'flex',alignItems:'center',justifyContent:'center',
          fontSize:11,fontWeight:800,flexShrink:0 }}>{letter}</span>}
        {label}
      </button>
    )
  }

  if (loading) return (
    <div style={{minHeight:'100vh',background:'#0A0A0A',display:'flex',alignItems:'center',justifyContent:'center'}}>
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

      {/* Mobil-toppfelt: heilt svart felt øverst (under iPhone sin notch/«busslomme»), så rada med hamburger (venstre), prosjektvelgjar og brukar.
          Hamburgeren ekspanderer ned eksakt same navigasjon som venstremenyen på skrivebord (AppRail). Sjå claude/mobil-grensesnitt.md */}
      {mobileSheet && <div onClick={() => setMobileSheet(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:100 }}/>}
      <div style={{ position:'relative', zIndex:102, flexShrink:0, background:'#000' }}>
        <div style={{ height:'max(env(safe-area-inset-top), 24px)', background:'#000' }}/>
        <div style={{ display:'flex', alignItems:'center', padding:'0 12px 8px', height:56, gap:10, background:'#000' }}>
          <button onClick={() => setMobileSheet(v=>!v)} aria-label="Meny" aria-expanded={mobileSheet}
            style={{ background:'none', border:'none', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', padding:4, flexShrink:0 }}>
            <span style={{ width:38, height:38, borderRadius:10, background: mobileSheet ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.15)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4.5 }}>
              <span style={{ display:'block', width:18, height:2, background:'#fff', borderRadius:1 }}/>
              <span style={{ display:'block', width:18, height:2, background:'#fff', borderRadius:1 }}/>
              <span style={{ display:'block', width:18, height:2, background:'#fff', borderRadius:1 }}/>
            </span>
          </button>
          <div style={{ flex:1, minWidth:0, display:'flex', justifyContent:'center' }}>
            <ProsjektVelger projects={officeProjects} activeProjectId={selectedProjectId} onSelectProject={setSelectedProjectId} onToggleFavorite={toggleFavorite}/>
          </div>
          <button onClick={() => { setActiveModule('bruker'); setMobileSheet(false) }} title={brukar.visNamn || 'Brukar'}
            style={{ width:36, height:36, borderRadius:'50%', overflow:'hidden', flexShrink:0, cursor:'pointer', padding:0,
              background: activeModule === 'bruker' ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.18)', border:'1.5px solid rgba(255,255,255,.3)', color:'#fff', fontSize:14, fontWeight:800, fontFamily:'var(--font)' }}>
            {brukar.bileteUrl ? <img src={brukar.bileteUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : (((brukar.visNamn || userEmail || '?').trim()[0]) || '?').toUpperCase()}
          </button>
        </div>
        {mobileSheet && (
          <div style={{ position:'absolute', top:'100%', left:0, right:0, maxHeight:'calc(100vh - 120px)', overflowY:'auto', background:'var(--bg)', borderBottom:'1px solid var(--border)', boxShadow:'0 14px 30px rgba(0,0,0,.35)' }}>
            <AppRail mobil activeModule={activeModule} modus="full"
              onModuleChange={m => { setActiveModule(m); setMobileSheet(false) }}
              onOpenSettings={() => { setShowSettings(true); setMobileSheet(false) }}
              onLogout={() => { import('./supabase').then(m => m.supabase.auth.signOut()) }}/>
          </div>
        )}
      </div>
      {PARENT_AV_MODUL[activeModule] && PARENT_AV_MODUL[activeModule] !== 'admin' && (
        <AppRailUndermeny toppNokkel={PARENT_AV_MODUL[activeModule]} activeModule={activeModule} onModuleChange={setActiveModule}/>
      )}

      {/* Mobile content */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px' }}>
        {activeModule === 'bruker' && <BrukarModule userId={userId} userEmail={userEmail} brukar={brukar}/>}
        {activeModule === 'malar' && <MalarModule userId={userId} userEmail={userEmail} projects={officeProjects} activeProjectId={selectedProjectId} brukar={brukar} offices={offices} activeOfficeId={activeOfficeId}/>}
        {activeModule === 'skisse' && <div style={{ height:'calc(100vh - 190px)', display:'flex', position:'relative' }}><SketchPad innbygd existingDataUrl={null} onClose={() => setActiveModule('dashboard')} onSave={lagreSkisse}/></div>}
        {activeModule === 'dashboard' && <Dashboard userId={userId} userEmail={userEmail} projects={officeProjects} notes={modeNotes} onOpneModul={setActiveModule} onVelgProsjekt={setSelectedProjectId}/>}
        {activeModule === 'notatar' && (
          <>
            <div style={{ display:'flex', gap:6, marginBottom:12 }}>
              {[['notatar', 'Notatar'], ['fristar', 'Fristar']].map(([v, namn]) => (
                <button key={v} onClick={() => setView(v)}
                  style={{ padding:'8px 18px', borderRadius:20, border:'1.5px solid ' + (view === v ? 'var(--brand)' : 'var(--border)'), background: view === v ? 'var(--brand)' : 'var(--bg2)',
                    color: view === v ? '#fff' : 'var(--text2)', fontSize:14, fontWeight: view === v ? 700 : 500, cursor:'pointer', fontFamily:'var(--font)' }}>{namn}</button>
              ))}
            </div>
            {view==='notatar' && (
              <div style={{ marginBottom:12 }}>
                <SokeFelt projectId={selectedProjectId} kjelder={['notes']} onVelgResultat={sokVelgNotat} plassholder="Søk i notat…"/>
              </div>
            )}
            {view==='notatar'  && <NoteTabell key={selectedProjectId} notes={visibleNotes} projects={projects} onEdit={handleEdit} onDelete={deleteNote} onToggleDone={toggleDone}
              activeProjectId={selectedProjectId} onToggleFavorite={toggleNoteFavorite} onTogglePinned={toggleNotePinned}
              eigneKolonnar={noteColumns} onSetExtra={setNoteExtraValue} onNyKolonne={addNoteColumn} onSlettKolonne={deleteNoteColumn}/>}
// Fjerna - prognose er no i TimarModule:             {view==='prognose' && <ForecastView userId={userId} projects={officeProjects} mode={mode}/>}
            {view==='fristar'  && <DeadlineView notes={visibleNotes} projects={projects} {...listProps}/>}
          </>
        )}
        {activeModule === 'timar' && <TimeTracker userId={userId} projects={officeProjects} addProject={(n,t)=>addProject(n,t,activeOfficeId)} mode={mode}/>}
        {activeModule === 'kalender' && <KalenderModule projects={officeProjects} notes={modeNotes} activeProjectId={selectedProjectId} onEdit={handleEdit}/>}
        {activeModule === 'prosjekt' && <ProsjektModule userId={userId} projects={officeProjects} offices={offices} activeOfficeId={activeOfficeId} addProject={addProject} activeProjectId={selectedProjectId} onSetActiveProject={setSelectedProjectId}/>}
        {activeModule === 'kunde' && <KundeModule userId={userId} activeOfficeId={activeOfficeId}/>}
        {activeModule === 'kvalitet' && <KvalitetModule userId={userId} projects={officeProjects} activeOfficeId={activeOfficeId} activeProjectId={selectedProjectId} onSetActiveProject={setSelectedProjectId}/>}
        {activeModule === 'oppgaver' && <OppgaveModule userId={userId} projects={officeProjects} activeOfficeId={activeOfficeId} activeProjectId={selectedProjectId} notes={modeNotes}/>}
        {activeModule === 'farge' && <FargeModule userId={userId} projects={officeProjects} activeOfficeId={activeOfficeId}/>}
        {activeModule === 'saker' && <SakerModule userId={userId} userEmail={userEmail} activeProjectId={selectedProjectId} projects={officeProjects} notes={modeNotes} activeOfficeId={activeOfficeId}/>}
        {activeModule === 'dtm' && <DTMModule userId={userId} userEmail={userEmail} projects={officeProjects} activeProjectId={selectedProjectId}/>}
        {activeModule === 'bilete' && <BileteModule userId={userId} userEmail={userEmail} projects={officeProjects} activeProjectId={selectedProjectId}/>}
        {activeModule === 'kontordrift' && <KontordriftModule userId={userId} userEmail={userEmail} visNamn={brukar.visNamn}/>}
        {activeModule === 'framdrift' && <FramdriftModule userId={userId} projects={officeProjects} notes={modeNotes} activeProjectId={selectedProjectId}/>}
      </div>

      {/* Flytande knappar (berre mobil): kamera → vel/ta bilete direkte, pluss → meny med notattypar */}
      <input ref={fotoRef} type="file" accept="image/*" multiple style={{ display:'none' }}
        onChange={async e => {
          const filer = Array.from(e.target.files || []); e.target.value = ''
          if (!filer.length) return
          if (!selectedProjectId) { setBileteMelding('Vel eit prosjekt fyrst (øvst), så vert biletet lagt i prosjektet.'); setTimeout(() => setBileteMelding(''), 4500); return }
          setBileteMelding('Lastar opp ' + filer.length + (filer.length === 1 ? ' bilete…' : ' bilete…'))
          const { supabase } = await import('./supabase')
          let ok = 0
          for (const fil of filer) {
            const sti = `${userId}/${selectedProjectId}/${Date.now()}-${(fil.name || 'bilete.jpg').replace(/[^a-zA-Z0-9._-]/g, '_')}`
            const { error } = await supabase.storage.from('bilete-mobil').upload(sti, fil)
            if (error) continue
            const { error: e2 } = await supabase.from('bilete_mobil_ko').insert({ id: Date.now() + Math.floor(Math.random() * 1000), user_id: userId, project_id: selectedProjectId, storage_sti: sti, opphav_filnamn: fil.name || 'bilete.jpg', lasta_opp_at: new Date().toISOString() })
            if (!e2) ok++
          }
          setBileteMelding(ok === filer.length ? (ok === 1 ? 'Biletet er lagt i prosjektet (vert henta av skrivebordsappen).' : ok + ' bilete er lagde i prosjektet.') : 'Berre ' + ok + ' av ' + filer.length + ' bilete vart lasta opp.')
          setTimeout(() => setBileteMelding(''), 4500)
        }}/>
      {bileteMelding && <div style={{ position:'fixed', left:16, right:16, bottom:'calc(96px + env(safe-area-inset-bottom))', zIndex:120, background:'#1B2A3A', color:'#fff', padding:'11px 16px', borderRadius:12, fontSize:13.5, fontWeight:600, textAlign:'center', boxShadow:'0 8px 24px rgba(0,0,0,.35)' }}>{bileteMelding}</div>}
      {view !== 'new' && !mobileSheet && (
        <>
          {fabMeny && <div onClick={() => setFabMeny(false)} style={{ position:'fixed', inset:0, zIndex:89 }}/>}
          <div style={{ position:'fixed', right:16, bottom:'calc(18px + env(safe-area-inset-bottom))', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:12, zIndex:90 }}>
            {fabMeny && (
              <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:14, boxShadow:'0 10px 30px rgba(0,0,0,.3)', padding:6, minWidth:190 }}>
                {[['regular', 'Notat', NotatIkon], ['meeting', 'Møte', MoteIkon], ['referat', 'Referat', ClipboardList], ['task', 'Oppgåve', CheckSquare]].map(([typ, namn, Ikon]) => (
                  <button key={typ} onClick={() => { setFabMeny(false); handleNewNote(typ) }}
                    style={{ display:'flex', alignItems:'center', gap:12, width:'100%', textAlign:'left', padding:'13px 14px', border:'none', borderRadius:10, background:'transparent', color:'var(--text)', fontSize:15, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)' }}>
                    <Ikon size={20} color="var(--brand)"/>{namn}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => { setFabMeny(false); fotoRef.current?.click() }} aria-label="Nytt bilete" title="Nytt bilete"
              style={{ width:54, height:54, borderRadius:'50%', border:'none', background:'#fff', color:'var(--brand)', boxShadow:'0 6px 18px rgba(0,0,0,.3)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Camera size={24}/>
            </button>
            <button onClick={() => setFabMeny(v => !v)} aria-label="Nytt notat" aria-expanded={fabMeny} title="Nytt…"
              style={{ width:60, height:60, borderRadius:'50%', border:'none', background:'var(--brand)', color:'#fff', boxShadow:'0 6px 18px rgba(0,0,0,.35)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'transform .2s', transform: fabMeny ? 'rotate(45deg)' : 'none' }}>
              <Plus size={30}/>
            </button>
          </div>
        </>
      )}

      {view === 'new' && (
        <NoteModal
          projects={projects} onAdd={handleAdd} onAutoSave={handleAutoSave}
          onSetEditNote={(noteOrId) => { if (noteOrId?._autoCreated) setPendingEditId(noteOrId.id); else setEditNote(noteOrId) }}
          defaultProjectId={defaultProjectId} editNote={editNote} onCancelEdit={handleCancelEdit}
          isMeeting={isMeeting} isTaskOnly={isTaskOnly && !editNote} isReferat={isReferat} userId={userId}
        />
      )}

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
    /* Outer column: TopBar spans full width at the very top, AppRail+innhald i rad under */
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden',
      background:'var(--bg)', boxSizing:'border-box' }}>

      {/* TopBar — felles for alle modular, uansett kva som er aktivt */}
      <TopBar
        projects={officeProjects}
        activeProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
        onToggleFavorite={toggleFavorite}
        activeModule={activeModule}
        onModuleChange={setActiveModule}
        stadNamn={MODULE_LABELS[activeModule] || ''}
        railBredde={railLive ?? RAIL_BREIDD[railModus]}
        brukarNamn={brukar.visNamn}
        brukarBilete={brukar.bileteUrl}
        onOpenBruker={() => setActiveModule('bruker')}
        onOpenSettings={() => setShowSettings(true)}
        offices={offices}
        activeOfficeId={activeOfficeId}
        onSetOffice={handleSetOffice}
        onAddOffice={addOffice}
      />

      <div style={{ display:'flex', flex:1, overflow:'hidden', minHeight:0 }}>

      {/* App Rail — leftmost vertical navigation, rett under logoen i TopBar */}
      <AppRail
        activeModule={activeModule}
        onModuleChange={setActiveModule}
        modus={railModus}
        onModus={settRailModus}
        onLiveBredde={setRailLive}
        onOpenSettings={() => setShowSettings(true)}
        onLogout={() => { import('./supabase').then(m => m.supabase.auth.signOut()) }}
      />

      {/* Rail 2 — undermenyen til paraply-modulane (Admin/Gjeremål), sjå
          claude/appreil-struktur.md. Vist BERRE når gjeldande modul høyrer
          til éin av desse. */}
      {/* Module content area — felles kolonne med botn-statuslinje for alle modular */}
      <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden', minWidth:0 }}>
      {PARENT_AV_MODUL[activeModule] && PARENT_AV_MODUL[activeModule] !== 'admin' && (
        <AppRailUndermeny
          toppNokkel={PARENT_AV_MODUL[activeModule]}
          activeModule={activeModule}
          onModuleChange={setActiveModule}
        />
      )}
      <div style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>
      {activeModule === 'skisse' ? (
        <div style={{ flex:1, display:'flex', minWidth:0, minHeight:0, position:'relative' }}>
          <SketchPad innbygd existingDataUrl={null} onClose={() => setActiveModule('dashboard')} onSave={lagreSkisse}/>
          {skisseMelding && <div style={{ position:'absolute', left:'50%', bottom:24, transform:'translateX(-50%)', zIndex:50, background:'#1B2A3A', color:'#fff', padding:'10px 18px', borderRadius:10, fontSize:13, fontWeight:600, boxShadow:'0 8px 24px rgba(0,0,0,.35)' }}>{skisseMelding}</div>}
        </div>
      ) : activeModule === 'malar' ? (
        <MalarModule userId={userId} userEmail={userEmail} projects={officeProjects} activeProjectId={selectedProjectId} brukar={brukar} offices={offices} activeOfficeId={activeOfficeId}/>
      ) : activeModule === 'bruker' ? (
        <BrukarModule userId={userId} userEmail={userEmail} brukar={brukar}/>
      ) : activeModule === 'dashboard' ? (
        <Dashboard userId={userId} userEmail={userEmail} projects={officeProjects} notes={modeNotes} onOpneModul={setActiveModule} onVelgProsjekt={setSelectedProjectId}/>
      ) : activeModule === 'prosjekt' ? (
        <ProsjektModule userId={userId} projects={officeProjects} offices={offices}
          activeOfficeId={activeOfficeId} addProject={addProject}
          activeProjectId={selectedProjectId} onSetActiveProject={setSelectedProjectId}/>
      ) : activeModule === 'kalender' ? (
        <KalenderModule projects={officeProjects} notes={modeNotes} activeProjectId={selectedProjectId} onEdit={handleEdit}/>
      ) : activeModule === 'kunde' ? (
        <KundeModule userId={userId} activeOfficeId={activeOfficeId}/>
      ) : activeModule === 'oppgaver' ? (
        <OppgaveModule userId={userId} projects={officeProjects} activeOfficeId={activeOfficeId} activeProjectId={selectedProjectId} notes={modeNotes}/>
      ) : activeModule === 'timar' ? (
        <TimarModule userId={userId} projects={officeProjects}
          addProject={addProject} mode={mode} activeOfficeId={activeOfficeId}/>
      ) : activeModule === 'kvalitet' ? (
        <KvalitetModule userId={userId} projects={officeProjects} activeOfficeId={activeOfficeId} activeProjectId={selectedProjectId} onSetActiveProject={setSelectedProjectId}/>
      ) : activeModule === 'farge' ? (
        <FargeModule userId={userId} projects={officeProjects} activeOfficeId={activeOfficeId}/>
      ) : activeModule === 'saker' ? (
        <SakerModule userId={userId} userEmail={userEmail} activeProjectId={selectedProjectId} projects={officeProjects} notes={modeNotes} activeOfficeId={activeOfficeId}/>
      ) : activeModule === 'dtm' ? (
        <DTMModule userId={userId} userEmail={userEmail} projects={officeProjects} activeProjectId={selectedProjectId}/>
      ) : activeModule === 'bilete' ? (
        <BileteModule userId={userId} userEmail={userEmail} projects={officeProjects} activeProjectId={selectedProjectId}/>
      ) : activeModule === 'kontordrift' ? (
        <KontordriftModule userId={userId} userEmail={userEmail} visNamn={brukar.visNamn}/>
      ) : activeModule === 'framdrift' ? (
        <FramdriftModule userId={userId} projects={officeProjects} notes={modeNotes} activeProjectId={selectedProjectId}/>
      ) : (
      /* ── Notatar module (original layout) ── */
      <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden', minWidth:0 }}>
      <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
        {/* Upper section */}
        <div style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>

          {/* Main */}
          <main style={{ flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0 }}>
            <div style={{ display:'flex',alignItems:'center',gap:4,padding:'0 16px',
              borderBottom:'1px solid var(--border)',background:'var(--bg3)',
              height:50,flexShrink:0 }}>
              {/* Direkte snarvegar for notattypar */}
              <button onClick={()=>handleNewNote('regular')}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px',
                  border:'1.5px solid var(--border)',
                  borderRadius:'var(--r)',
                  background:'#fff', color:'var(--brand)',
                  fontSize:14, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                + Notat
              </button>
              <button onClick={()=>handleNewNote('meeting')}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px',
                  border:'1.5px solid var(--border)',
                  borderRadius:'var(--r)',
                  background:'rgba(255,255,255,.6)', color:'var(--text2)',
                  fontSize:13, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                + Møte
              </button>
              <button onClick={()=>handleNewNote('referat')}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px',
                  border:'1.5px solid var(--border)',
                  borderRadius:'var(--r)',
                  background:'rgba(255,255,255,.6)', color:'var(--text2)',
                  fontSize:13, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                + Referat
              </button>
              <button onClick={()=>handleNewNote('task')}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px',
                  border:'1.5px solid var(--border)',
                  borderRadius:'var(--r)',
                  background:'rgba(255,255,255,.6)', color:'var(--text2)',
                  fontSize:13, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                + Oppgåve
              </button>
              <div style={{width:10}}/>
              <Tab v="fristar"  letter="F" label="Fristar"/>
              <div style={{flex:1}}/>
              {/* Søk — heilt til høgre i linja (NL3), før tidslinje-knappen */}
              {view==='notatar' && (
                <div style={{ marginRight:10 }}>
                  <SokeFelt projectId={selectedProjectId} kjelder={['notes']} onVelgResultat={sokVelgNotat} plassholder="Søk i notat…"/>
                </div>
              )}
              <IcoBtn onClick={()=>setTlCollapsed(v=>!v)} active={!tlCollapsed} title="Tidslinje"><span style={{fontWeight:800,fontSize:13}}>T</span></IcoBtn>
              <div style={{width:4}}/>
            </div>

            {view==='notatar' && (
              <div style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>
                {/* Notattabellen — venstre halvdel */}
                <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column',
                  overflow:'hidden', padding:'22px 20px 22px 26px' }}>
                  <NoteTabell key={selectedProjectId} notes={visibleNotes} projects={projects} onEdit={handleEdit}
                    onDelete={deleteNote} onToggleDone={toggleDone}
                    onSelect={setSelectedNoteId} selectedId={selectedNoteId}
                    activeProjectId={selectedProjectId} onToggleFavorite={toggleNoteFavorite} onTogglePinned={toggleNotePinned}
                    eigneKolonnar={noteColumns} onSetExtra={setNoteExtraValue} onNyKolonne={addNoteColumn} onSlettKolonne={deleteNoteColumn}/>
                </div>
                {/* Dragbar delelinje — justerer andelen mellom tabell og førehandsvising */}
                <div onMouseDown={startPreviewResize} title="Dra for å justere breidda"
                  style={{ width:7, flexShrink:0, cursor:'col-resize', position:'relative' }}>
                  <div style={{ position:'absolute', left:3, top:0, bottom:0, width:1, background:'var(--border)' }}/>
                </div>
                {/* Førehandsvising av markert notat — høgre halvdel */}
                <div style={{ width:previewWidth, minWidth:240, maxWidth:maxPreviewWidth(), flexShrink:0,
                  display:'flex', flexDirection:'column', overflow:'hidden',
                  borderLeft:'1px solid var(--border)' }}>
                  <NotePreview note={visibleNotes.find(n => n.id === selectedNoteId) || null}
                    projects={projects} onEdit={handleEdit} onUpdateTask={updateTask}/>
                </div>
              </div>
            )}
            {view==='fristar' && (
              <div style={{ flex:1,overflowY:'auto',padding:'22px 26px' }}>
                <DeadlineView notes={visibleNotes} projects={projects} {...listProps}/>
              </div>
            )}
          </main>
        </div>

        {/* Timeline */}
        {!tlCollapsed&&(
          <div style={{ height:tlHeight,minHeight:90,maxHeight:600,flexShrink:0 }}>
            <Timeline notes={notes} projects={projects} height={tlHeight} onResize={setTlHeight}
              onSelectNote={id => { setView('notatar'); setSelectedNoteId(id) }}
              onEditNote={id => { const n = notes.find(x => x.id === id); if (n) handleEdit(n) }}/>
          </div>
        )}
      </div>
      </div>
      )} {/* end module ternary */}
      </div>
      </div>
      </div>
      {/* Felles botn-statuslinje: full breidd frå venstre til høgre, som toppfeltet */}
      <StatusBar activeModule={activeModule}/>

      {view === 'new' && (
        <NoteModal
          projects={projects} onAdd={handleAdd} onAutoSave={handleAutoSave}
          onSetEditNote={(noteOrId) => { if (noteOrId?._autoCreated) setPendingEditId(noteOrId.id); else setEditNote(noteOrId) }}
          defaultProjectId={defaultProjectId} editNote={editNote} onCancelEdit={handleCancelEdit}
          isMeeting={isMeeting} isTaskOnly={isTaskOnly && !editNote} isReferat={isReferat} userId={userId}
        />
      )}

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

const MODULE_LABELS = { skisse:'Skisse', bruker:'Brukar', dashboard:'Dashboard', notatar:'Notatar', prosjekt:'Prosjekt', kunde:'Kundar', oppgaver:'Oppg\u00E5ver', saker:'Saker', timar:'Timar', kvalitet:'Kvalitetssystem', kalender:'Kalender', malar:'Malar', farge:'Farge', dtm:'Dokument, tegningar og modellar', bilete:'Bilete', kontordrift:'Kontordrift', framdrift:'Framdrift' }

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
      <span style={{ fontSize:11, color:'rgba(255,255,255,.4)' }}>v9i</span>
    </div>
)
}

// Rotkomponent: brukarprofil (inkl. språk) + språkkontekst rundt heile appen
export default function App({ userId, userEmail }) {
  const brukar = useBrukar(userId, userEmail)
  const sprak = brukar.sprak
  const verdi = useMemo(() => ({ sprak, t: lagT(sprak), settSprak: (s) => brukar.oppdater({ sprak: s }) }), [sprak]) // eslint-disable-line react-hooks/exhaustive-deps
  // Bokmål: omsetj heile appen (ord for ord) i DOM-en; nynorsk er kjeldespråket. Sjå bokmalOmsetjar.js
  useEffect(() => { if (sprak !== 'bm') return undefined; return startBokmalOmsetjar() }, [sprak])
  // Namn på den som eksporterer (botntekst i PDF-eksport av notat)
  useEffect(() => { settEksportBrukar(brukar.visNamn || userEmail) }, [brukar.visNamn, userEmail])
  return (
    <SprakKontekst.Provider value={verdi}>
      <AppInnhald userId={userId} userEmail={userEmail} brukar={brukar}/>
    </SprakKontekst.Provider>
  )
}
