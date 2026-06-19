import { useState, useRef, useEffect } from 'react'
import { nextFriday, fmt } from './dateUtils'
import SketchPad from './SketchPad'

const TAGS = [
  { key:'møte',    color:'#1565C0' }, { key:'oppgåve', color:'#5E35B1' },
  { key:'frist',   color:'#B45309' }, { key:'idé',     color:'#166534' },
]
const COLORS = ['#B91C1C','#B45309','#166534','#1565C0','#5E35B1','#9D174D','#1B4332']

const fi = {
  background:'var(--bg3)', border:'1px solid var(--border)',
  borderRadius:'var(--r)', color:'var(--text)',
  fontFamily:'var(--font)', fontSize:13,
  padding:'7px 10px', outline:'none', width:'100%',
}

function fmtHours(h) {
  if (h === undefined || h === null || h === '') return '0.5t'
  const n = parseFloat(h)
  if (isNaN(n)) return '0.5t'
  return n % 1 === 0 ? `${n}t` : `${n}t`
}

function TaskRow({ task, onUpdate, onDelete }) {
  const [editing,    setEditing]    = useState(false)
  const [editText,   setEditText]   = useState(task.text)
  const [editStart,  setEditStart]  = useState(task.startDate || '')
  const [editDate,   setEditDate]   = useState(task.date || '')
  const [editHours,  setEditHours]  = useState(task.hours !== undefined ? String(task.hours) : '0.5')
  const textRef = useRef(null)

  useEffect(() => { if (editing && textRef.current) textRef.current.focus() }, [editing])

  const commit = () => {
    const t     = editText.trim() || task.text
    const d     = editDate  || task.date  || nextFriday()
    const hours = editHours !== '' ? parseFloat(editHours) : 0.5
    onUpdate(task.id, { text: t, startDate: editStart || null, date: d, hours })
    setEditing(false)
  }

  const di = task.date ? fmt(task.date) : null
  const hours = task.hours !== undefined ? task.hours : 0.5

  if (editing) return (
    <div style={{ display:'flex', gap:6, padding:'6px 8px', background:'var(--bg4)',
      borderRadius:'var(--r)', border:'1.5px solid var(--brand3)', marginBottom:5,
      flexWrap:'wrap', alignItems:'center' }}>
      <input ref={textRef} value={editText} onChange={e => setEditText(e.target.value)}
        onKeyDown={e => { if (e.key==='Enter') commit(); if (e.key==='Escape') setEditing(false) }}
        style={{ ...fi, flex:1, minWidth:140, padding:'4px 8px', background:'var(--bg2)', fontSize:13 }}/>
      <input type="date" value={editStart} onChange={e => setEditStart(e.target.value)}
        title="Startdato" style={{ ...fi, width:130, padding:'4px 8px', background:'var(--bg2)', fontSize:12 }}/>
      <input type="number" value={editHours} onChange={e => setEditHours(e.target.value)}
        min="0.5" max="999" step="0.5" title="Timeverk"
        style={{ ...fi, width:64, padding:'4px 8px', background:'var(--bg2)', fontSize:13, textAlign:'center' }}/>
      <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
        title="Frist" style={{ ...fi, width:130, padding:'4px 8px', background:'var(--bg2)', fontSize:12 }}/>
      <button onClick={commit}
        style={{ padding:'4px 10px', background:'var(--brand)', border:'none',
          borderRadius:'var(--r)', color:'#fff', cursor:'pointer',
          display:'flex', alignItems:'center', gap:4, fontSize:12, fontWeight:700 }}>
        OK
      </button>
      <button onClick={() => setEditing(false)}
        style={{ padding:'4px 7px', background:'none', border:'1px solid var(--border)',
          borderRadius:'var(--r)', color:'var(--text3)', cursor:'pointer' }}>
        <span style={{fontWeight:800,fontSize:11}}>×</span>
      </button>
    </div>
  )

  return (
    <div style={{ display:'flex', alignItems:'center', gap:0, padding:'6px 8px',
      background: task.done ? 'transparent' : 'var(--bg3)',
      borderRadius:'var(--r)', border:`1px solid ${di?.overdue ? 'rgba(185,28,28,.3)' : 'var(--border)'}`,
      marginBottom:5 }}>
      <button onClick={() => onUpdate(task.id, { done: !task.done })}
        style={{ width:16, height:16, borderRadius:4, marginRight:8,
          border:`2px solid ${task.done ? 'var(--success)' : 'var(--border2)'}`,
          background: task.done ? 'var(--success)' : 'transparent',
          flexShrink:0, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
        {task.done && <span style={{color:"#fff",fontWeight:900,fontSize:10}}>✓</span>}
      </button>
      {/* Task text */}
      <span style={{ flex:1, fontSize:13, color:'var(--text)',
        textDecoration: task.done ? 'line-through' : 'none', opacity: task.done ? .55 : 1,
        whiteSpace:'pre-wrap', lineHeight:1.4, paddingRight:8 }}>
        {task.text}
      </span>
      {/* Startdato */}
      <span style={{ width:88, fontSize:11, color:'var(--text3)', flexShrink:0,
        display:'flex', alignItems:'center', gap:3 }}>
        {task.startDate
          ? (() => { const sd = fmt(task.startDate); return <><span style={{fontWeight:800,fontSize:9,marginRight:2}}>S</span>{sd.lbl}</> })()
          : <span style={{ opacity:.35 }}>–</span>}
      </span>
      {/* Timeverk */}
      <span style={{ width:52, fontSize:12, fontWeight:600, flexShrink:0,
        color:'var(--brand2)', textAlign:'center',
        background:'var(--brandbg)', borderRadius:5, padding:'1px 4px' }}>
        {fmtHours(hours)}
      </span>
      {/* Frist */}
      {di ? (
        <span style={{ width:88, fontSize:11, marginLeft:6,
          color: di.overdue?'var(--danger)':di.urgent?'var(--warn)':'var(--text3)',
          fontWeight: di.overdue||di.urgent ? 600 : 400,
          display:'flex', alignItems:'center', gap:3, flexShrink:0 }}>
          <span style={{fontWeight:800,fontSize:9,marginRight:2}}>F</span>{di.lbl}
        </span>
      ) : <span style={{ width:88, marginLeft:6 }}/>}
      <button onClick={() => setEditing(true)} title="Rediger"
        style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer',
          padding:'2px 3px', display:'flex', marginLeft:4 }}
        onMouseEnter={e=>e.currentTarget.style.color='var(--brand)'}
        onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}>
        <span style={{fontWeight:800,fontSize:11}}>R</span>
      </button>
      <button onClick={() => onDelete(task.id)} title="Slett"
        style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer',
          padding:'2px 3px', display:'flex' }}
        onMouseEnter={e=>e.currentTarget.style.color='var(--danger)'}
        onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}>
        <span style={{fontWeight:800,fontSize:11}}>S</span>
      </button>
    </div>
  )
}

export default function NoteInput({ projects, onAdd, onAutoSave, onSetEditNote, defaultProjectId, editNote, onCancelEdit, isMeeting, isTaskOnly }) {
  const isEdit = !!editNote

  const [tag,         setTag]         = useState(isEdit ? editNote.tag : null)
  const [projectVal,  setProjectVal]  = useState(
    isEdit ? String(editNote.projectId||'') : (defaultProjectId ? String(defaultProjectId) : '')
  )
  const [newProjName, setNewProjName] = useState('')
  const [tasks,       setTasks]       = useState(isEdit ? (editNote.tasks||[]) : [])
  const [newTaskText,  setNewTaskText]  = useState('')
  const [newTaskStart, setNewTaskStart] = useState('')
  const [newTaskDate,  setNewTaskDate]  = useState('')
  const [newTaskHours, setNewTaskHours] = useState('')

  // Meeting-specific state
  const [meetingTime,      setMeetingTime]      = useState(() => {
    const now = new Date(); now.setSeconds(0,0)
    return now.toISOString().slice(0,16)
  })
  const [meetingDuration, setMeetingDuration]  = useState('60')
  const [meetingLocation, setMeetingLocation]  = useState('')
  const [attendees,       setAttendees]         = useState([])
  const [attendeeInput,   setAttendeeInput]     = useState('')

  const titleRef  = useRef(null)
  const editorRef = useRef(null)

  // Drag state for whole-window drop
  const [dragActive,    setDragActive]    = useState(false)
  const [showSketch,    setShowSketch]    = useState(false)
  const [sketchDataUrl, setSketchDataUrl] = useState(isEdit ? (editNote?.sketchDataUrl || null) : null)

  useEffect(() => {
    if (titleRef.current)  titleRef.current.value  = isEdit ? (editNote.title||'') : ''
    if (editorRef.current) editorRef.current.innerHTML = isEdit ? (editNote.html||editNote.text||'') : ''
    setTasks(isEdit ? (editNote.tasks||[]) : [])
    setTag(isEdit ? editNote.tag : null)
    setProjectVal(isEdit ? String(editNote.projectId||'') : (defaultProjectId ? String(defaultProjectId) : ''))
    setSketchDataUrl(isEdit ? (editNote?.sketchDataUrl || null) : null)
    if (!isEdit && titleRef.current) setTimeout(() => titleRef.current?.focus(), 50)
  }, [editNote?.id, defaultProjectId])

  // All projects (no type filter)
  const allProjects = projects

  const exec = (cmd, val=null) => { editorRef.current?.focus(); document.execCommand(cmd, false, val) }

  // ── Task auto-save ───────────────────────────────────────────────────
  const commitNewTask = () => {
    const text = newTaskText.trim()
    if (!text) return
    const date  = newTaskDate  || nextFriday()
    const hours = newTaskHours !== '' ? parseFloat(newTaskHours) : 0.5
    setTasks(ts => [...ts, { id: Date.now(), text, done:false,
      startDate: newTaskStart || null, date, hours }])
    setNewTaskText(''); setNewTaskStart(''); setNewTaskDate(''); setNewTaskHours('')
  }

  const updateTask = (id, changes) => setTasks(ts => ts.map(t => t.id===id ? {...t,...changes} : t))
  const deleteTask = (id) => setTasks(ts => ts.filter(t => t.id!==id))

  const handleSave = () => {
    const html  = editorRef.current?.innerHTML?.trim()
    const text  = editorRef.current?.innerText?.trim()
    const title = titleRef.current?.value?.trim() || text?.substring(0,60) || 'Utan tittel'
    if (!text && tasks.length===0) return
    let pid = null
    if (projectVal && projectVal!=='__new__') pid = parseInt(projectVal)
    onAdd({ title, text:text||'', html:html||'', tasks, tag,
      projectId:pid, newProjName: projectVal==='__new__' ? newProjName : '', sketchDataUrl,
      attachments,
      isMeeting: isMeeting || false,
      meetingTime: isMeeting ? meetingTime : null,
      meetingDuration: isMeeting ? meetingDuration : null,
      meetingLocation: isMeeting ? meetingLocation : null,
      attendees: isMeeting ? attendees : [],
    })
    if (!isEdit) {
      titleRef.current.value = ''; editorRef.current.innerHTML = ''
      setTag(null); setProjectVal(defaultProjectId?String(defaultProjectId):'')
      setNewProjName(''); setTasks([]); setNewTaskText(''); setNewTaskDate('')
    }
  }

  // ── Whole-window drag & drop for .eml and PDF ────────────────────────
  const handleDragOver = (e) => { e.preventDefault(); setDragActive(true) }
  const handleDragLeave = (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragActive(false) }

  const [attachments, setAttachments] = useState([])
  const [uploading,   setUploading]   = useState(false)
  const [undoStack,   setUndoStack]   = useState([])
  const [saveStatus,  setSaveStatus]  = useState('idle')   // 'idle' | 'saving' | 'saved'
  const [createdId,   setCreatedId]   = useState(null)
  const saveTimerRef   = useRef(null)
  const editorContentRef = useRef('')
  const editorTitleRef   = useRef('')

  // Snapshot the editable state so we can revert
  const pushUndoState = () => {
    const snap = {
      title:       titleRef.current?.value || '',
      html:        editorRef.current?.innerHTML || '',
      attachments: [...attachments],
      tasks:       [...tasks],
    }
    setUndoStack(s => [...s.slice(-9), snap])
  }

  const handleUndo = () => {
    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    if (titleRef.current)  titleRef.current.value  = prev.title
    if (editorRef.current) editorRef.current.innerHTML = prev.html
    setAttachments(prev.attachments)
    setTasks(prev.tasks)
    setUndoStack(s => s.slice(0, -1))
  }

  // Ctrl+Z to undo
  useEffect(() => {
    const handler = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase()
      if (e.target?.isContentEditable) return
      if (['input','textarea'].includes(tag)) return
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undoStack])

  // ── Autosave ────────────────────────────────────────────────────────
  // Trigger autosave debounce on any meaningful state change
  const triggerAutoSave = () => {
    if (isTaskOnly) return  // task-only has its own explicit save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveStatus('saving')
    saveTimerRef.current = setTimeout(async () => {
      const html  = editorRef.current?.innerHTML?.trim() || ''
      const text  = editorRef.current?.innerText?.trim() || ''
      const title = titleRef.current?.value?.trim() || ''
      const hasContent = title || text || tasks.length > 0 || sketchDataUrl || attachments.length > 0 ||
                         (isMeeting && (meetingLocation || attendees.length > 0))
      if (!hasContent) { setSaveStatus('idle'); return }
      let pid = null
      if (projectVal && projectVal !== '__new__') pid = parseInt(projectVal)
      const finalTitle = title || text?.substring(0,60) || 'Utan tittel'
      const newProjVal = (projectVal === '__new__' && newProjName.trim()) ? newProjName.trim() : ''
      const id = await onAutoSave({
        title: finalTitle, text, html, tasks, tag,
        projectId: pid, newProjName: newProjVal,
        sketchDataUrl, attachments,
        isMeeting: isMeeting || false,
        meetingTime: isMeeting ? meetingTime : null,
        meetingDuration: isMeeting ? meetingDuration : null,
        meetingLocation: isMeeting ? meetingLocation : null,
        attendees: isMeeting ? attendees : [],
      })
      // After first save in "new" mode, switch to edit mode for subsequent saves
      if (!editNote && id && !createdId) {
        setCreatedId(id)
        // Schedule editNote transition via parent
        setTimeout(() => {
          // Find the freshly created note and set it as editNote
          if (onSetEditNote) {
            // We need the actual note object - parent will resolve from id
            onSetEditNote({ id, _autoCreated: true })
          }
        }, 100)
      }
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    }, 800)  // 800ms debounce
  }

  // Trigger autosave when relevant state changes
  useEffect(() => { triggerAutoSave() },
    [tasks, tag, projectVal, newProjName, sketchDataUrl, attachments,
     meetingTime, meetingDuration, meetingLocation, attendees])

  // Editor / title onInput handlers
  const handleEditorInput  = () => triggerAutoSave()
  const handleTitleInput   = () => triggerAutoSave()

  // Cleanup on unmount
  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }, [])

  const uploadToSupabase = async (file) => {
    try {
      const { supabase } = await import('./supabase')
      const path = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`
      const { data, error } = await supabase.storage.from('Vedlegg').upload(path, file)
      if (error) throw error
      const { data: urlData } = supabase.storage.from('Vedlegg').getPublicUrl(path)
      return { name: file.name, path, url: urlData.publicUrl, size: file.size, type: file.type }
    } catch (e) {
      console.error('Upload feila:', e)
      return null
    }
  }

  const processFile = async (file) => {
    if (!file) return
    setUploading(true)
    setDragActive(false)

    // Push current editor + title state to undo stack BEFORE any changes
    pushUndoState()

    if (file.name.endsWith('.eml') || file.type.includes('message')) {
      const reader = new FileReader()
      reader.onload = async ev => {
        const txt  = ev.target.result
        const sm   = txt.match(/^Subject:\s*(.+)$/mi)
        const fm   = txt.match(/^From:\s*(.+)$/mi)
        const bi   = txt.indexOf('\n\n')
        const subject = sm?.[1]?.trim() || file.name.replace('.eml','')
        const from    = fm?.[1]?.trim() || ''
        const body    = bi > -1 ? txt.substring(bi+2).trim()
          .replace(/Content-[^\n]+\n/g,'').replace(/--[^\n]+\n?/g,'').substring(0,600) : ''
        // Only set title if empty
        if (!titleRef.current.value) titleRef.current.value = subject
        // APPEND to existing editor content — do NOT overwrite
        if (editorRef.current) {
          const fromLine = from ? `<div style="font-size:12px;color:#888;margin-bottom:8px">Frå: ${from}</div>` : ''
          const emailBlock = `<div style="margin-top:12px;padding:10px 12px;background:rgba(21,101,192,.06);border-left:3px solid #1565C0;border-radius:6px"><b>E-post: ${subject}</b>${fromLine}<br>${body.replace(/\n/g,'<br>')}</div>`
          const existing = editorRef.current.innerHTML.trim()
          editorRef.current.innerHTML = existing
            ? existing + '<br>' + emailBlock
            : emailBlock
        }
        const att = await uploadToSupabase(file)
        if (att) setAttachments(prev => [...prev, att])
        setUploading(false)
      }
      reader.readAsText(file)
    } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      // Only set title if empty — do NOT overwrite
      if (!titleRef.current.value) titleRef.current.value = file.name.replace('.pdf','')
      // PDF: do not modify editor content — file appears in attachments below
      const att = await uploadToSupabase(file)
      if (att) setAttachments(prev => [...prev, att])
      setUploading(false)
    } else {
      // Generic file
      const att = await uploadToSupabase(file)
      if (att) setAttachments(prev => [...prev, att])
      setUploading(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragActive(false)
    const files = [...e.dataTransfer.files]
    if (files.length > 0) { processFile(files[0]) }
  }

  const TBtn = ({ onClick, title, children }) => (
    <button onClick={onClick} title={title}
      style={{ padding:'4px 7px', border:'1px solid transparent', background:'none',
        borderRadius:5, cursor:'pointer', color:'var(--text2)', fontSize:13, lineHeight:1 }}
      onMouseEnter={e=>{e.currentTarget.style.background='var(--bg4)';e.currentTarget.style.borderColor='var(--border)'}}
      onMouseLeave={e=>{e.currentTarget.style.background='none';e.currentTarget.style.borderColor='transparent'}}>
      {children}
    </button>
  )

  const Divider = ({label}) => (
    <div style={{ display:'flex', alignItems:'center', gap:10, margin:'2px 0 8px' }}>
      <div style={{ flex:1, height:2, background:'var(--brand)', borderRadius:1 }}/>
      <span style={{ fontSize:11, fontWeight:800, color:'var(--brand)',
        textTransform:'uppercase', letterSpacing:'.1em', whiteSpace:'nowrap' }}>{label}</span>
      <div style={{ flex:1, height:2, background:'var(--brand)', borderRadius:1 }}/>
    </div>
  )

  // Simplified task-only mode
  if (isTaskOnly) {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:14, maxWidth:680 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
          background:'var(--brandbg)', border:'1.5px solid var(--brand3)',
          borderRadius:'var(--r2)' }}>
          <span style={{ fontSize:18 }}>✅</span>
          <span style={{ fontSize:14, fontWeight:700, color:'var(--brand)' }}>
            Ny arbeidsoppgåve (utan notat)
          </span>
        </div>

        {/* Project */}
        <div>
          <label style={{ fontSize:11, color:'var(--text3)', display:'block', marginBottom:4,
            textTransform:'uppercase', letterSpacing:'.05em', fontWeight:700 }}>Prosjekt</label>
          <select value={projectVal} onChange={e => setProjectVal(e.target.value)}
            style={{ ...fi, fontWeight: projectVal ? 600 : 400 }}>
            <option value="">— Utan prosjekt —</option>
            {allProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="__new__">＋ Nytt prosjekt…</option>
          </select>
          {projectVal==='__new__' && (
            <input type="text" value={newProjName} onChange={e => setNewProjName(e.target.value)}
              placeholder="Skriv prosjektnummer / namn"
              autoFocus
              style={{ ...fi, marginTop:6, background:'var(--bg2)',
                border:'2px solid var(--brand3)', fontWeight:600 }}/>
          )}
        </div>

        {/* Task title */}
        <div>
          <label style={{ fontSize:11, color:'var(--text3)', display:'block', marginBottom:4,
            textTransform:'uppercase', letterSpacing:'.05em', fontWeight:700 }}>Oppgåve</label>
          <input ref={titleRef} type="text" placeholder="Kva skal gjerast?"
            autoFocus
            style={{ ...fi, fontSize:16, fontWeight:600, padding:'10px 13px',
              background:'var(--bg2)', border:'2px solid var(--brand3)' }}
            onKeyDown={e => e.key==='Enter' && handleSave()}/>
        </div>

        {/* Dates and hours */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
          <div>
            <label style={{ fontSize:11, color:'var(--text3)', display:'block', marginBottom:4,
              textTransform:'uppercase', letterSpacing:'.05em', fontWeight:700 }}>Startdato</label>
            <input type="date" value={newTaskStart} onChange={e => setNewTaskStart(e.target.value)}
              style={fi}/>
          </div>
          <div>
            <label style={{ fontSize:11, color:'var(--text3)', display:'block', marginBottom:4,
              textTransform:'uppercase', letterSpacing:'.05em', fontWeight:700 }}>Timar</label>
            <input type="number" value={newTaskHours} onChange={e => setNewTaskHours(e.target.value)}
              placeholder="0.5" min="0.5" max="999" step="0.5"
              style={{ ...fi, textAlign:'center' }}/>
          </div>
          <div>
            <label style={{ fontSize:11, color:'var(--text3)', display:'block', marginBottom:4,
              textTransform:'uppercase', letterSpacing:'.05em', fontWeight:700 }}>Frist</label>
            <input type="date" value={newTaskDate} onChange={e => setNewTaskDate(e.target.value)}
              style={fi}/>
          </div>
        </div>
        <div style={{ fontSize:11, color:'var(--text3)' }}>
          Utan frist → fredag denne veka · Utan timar → 0.5t
        </div>

        {/* Save */}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:8 }}>
          <button onClick={() => onCancelEdit && onCancelEdit()}
            style={{ padding:'10px 18px', background:'var(--bg3)',
              border:'1px solid var(--border)', borderRadius:'var(--r2)',
              color:'var(--text2)', fontSize:13, cursor:'pointer' }}>
            Avbryt
          </button>
          <button onClick={() => {
              const taskText = titleRef.current?.value?.trim()
              if (!taskText) return
              const date  = newTaskDate  || nextFriday()
              const hours = newTaskHours !== '' ? parseFloat(newTaskHours) : 0.5
              const task  = { id: Date.now(), text: taskText, done: false,
                startDate: newTaskStart || null, date, hours }
              let pid = null
              if (projectVal && projectVal !== '__new__') pid = parseInt(projectVal)
              onAdd({ title: `Oppgåve: ${taskText.substring(0, 50)}`,
                text: '', html: '', tasks: [task], tag: 'oppgåve',
                projectId: pid, newProjName: projectVal === '__new__' ? newProjName : '',
                sketchDataUrl: null, attachments: [],
                isMeeting: false })
            }}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 24px',
              background:'var(--brand)', border:'none', borderRadius:'var(--r2)',
              color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer',
              boxShadow:'var(--shadow)' }}>
            ✅ Lagre oppgåve
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ display:'flex', flexDirection:'column', gap:10, position:'relative',
        outline: dragActive ? '3px dashed var(--brand3)' : 'none',
        outlineOffset: 4, borderRadius:'var(--r2)' }}>

      {dragActive && (
        <div style={{ position:'absolute', inset:0, zIndex:50, borderRadius:'var(--r2)',
          background:'rgba(27,67,50,.08)', display:'flex', alignItems:'center', justifyContent:'center',
          pointerEvents:'none' }}>
          <div style={{ fontSize:15, fontWeight:700, color:'var(--brand)',
            background:'var(--bg2)', padding:'12px 24px', borderRadius:'var(--r2)',
            border:'2px dashed var(--brand3)', boxShadow:'var(--shadow)' }}>
            Slepp e-post eller PDF her
          </div>
        </div>
      )}

      {/* Undo button - shown when undo stack has items */}
      {undoStack.length > 0 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'8px 12px', background:'rgba(180,83,9,.08)', border:'1.5px solid rgba(180,83,9,.25)',
          borderRadius:'var(--r)' }}>
          <span style={{ fontSize:12, color:'var(--warn)', display:'flex', alignItems:'center', gap:6 }}>
            <span style={{fontWeight:800,fontSize:12}}>A</span>
            {undoStack.length} {undoStack.length === 1 ? 'handling' : 'handlingar'} kan angrast
          </span>
          <button onClick={handleUndo}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px',
              background:'var(--warn)', color:'#fff', border:'none', borderRadius:5,
              fontSize:12, fontWeight:600, cursor:'pointer' }}>
            Angre (Ctrl+Z)
          </button>
        </div>
      )}

      {isEdit && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'8px 12px', background:'var(--brandbg2)', border:'1.5px solid var(--brand3)',
          borderRadius:'var(--r)' }}>
          <span style={{ fontSize:12, fontWeight:700, color:'var(--brand)' }}>Redigerer notat</span>
          <button onClick={onCancelEdit}
            style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer',
              display:'flex', alignItems:'center', gap:4, fontSize:12 }}>
            Avbryt
          </button>
        </div>
      )}

      {/* ── Prosjekt ØVST ── */}
      <div>
        <label style={{ fontSize:11, color:'var(--text3)', display:'block', marginBottom:4,
          textTransform:'uppercase', letterSpacing:'.05em', fontWeight:700 }}>Prosjekt</label>
        <div>
          <select value={projectVal==='__new__' ? '__new__' : projectVal}
            onChange={e => setProjectVal(e.target.value)}
            style={{ ...fi, fontWeight: projectVal && projectVal!=='__new__' ? 600 : 400 }}>
            <option value="">— Utan prosjekt —</option>
            {allProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="__new__">＋ Nytt prosjekt…</option>
          </select>
          {projectVal==='__new__' && (
            <input type="text" value={newProjName} onChange={e => setNewProjName(e.target.value)}
              placeholder="Skriv prosjektnummer / namn"
              autoFocus
              onKeyDown={e => e.key==='Escape' && setProjectVal('')}
              style={{ ...fi, marginTop:6, background:'var(--bg2)',
                border:'2px solid var(--brand3)', fontWeight:600 }}/>
          )}
        </div>
      </div>

      {/* Title */}
      <input ref={titleRef} type="text" placeholder="Tittel på notatet…"
        style={{ ...fi, fontSize:16, fontWeight:700, padding:'10px 13px',
          background:'var(--bg2)', border:'2px solid var(--brand3)',
          borderRadius:'var(--r2)', letterSpacing:'-0.01em' }}
        onInput={handleTitleInput}
        onKeyDown={e => e.key==='Enter' && editorRef.current?.focus()}/>

      {/* ── Møtedetaljar (berre for møtenotat) ── */}
      {isMeeting && (
        <>
          <Divider label="Møtedetaljar"/>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            <div>
              <label style={{ fontSize:11, color:'var(--text3)', display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:'.05em', fontWeight:700 }}>Møtetidspunkt</label>
              <input type="datetime-local" value={meetingTime} onChange={e=>setMeetingTime(e.target.value)}
                style={{ ...fi, background:'var(--bg2)', border:'2px solid var(--border)' }}/>
            </div>
            <div>
              <label style={{ fontSize:11, color:'var(--text3)', display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:'.05em', fontWeight:700 }}>Varigheit</label>
              <select value={meetingDuration} onChange={e=>setMeetingDuration(e.target.value)}
                style={{ ...fi, background:'var(--bg2)' }}>
                <option value="30">30 minutt</option>
                <option value="60">1 time</option>
                <option value="90">1,5 time</option>
                <option value="120">2 timar</option>
                <option value="180">3 timar</option>
                <option value="480">Heildagsmøte</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, color:'var(--text3)', display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:'.05em', fontWeight:700 }}>Stad / møtelenke</label>
            <input type="text" value={meetingLocation} onChange={e=>setMeetingLocation(e.target.value)}
              placeholder="Møterom 2, eller https://teams.microsoft.com/…"
              style={{ ...fi, background:'var(--bg2)' }}/>
          </div>
          <Divider label="I møtet"/>
          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, color:'var(--text3)', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'.05em', fontWeight:700 }}>Deltakarar</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:8, minHeight:28 }}>
              {attendees.map((a,i) => (
                <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:20, fontSize:12, color:'var(--text2)' }}>
                  {a}
                  <button onClick={() => setAttendees(prev=>prev.filter((_,j)=>j!==i))}
                    style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:14, lineHeight:1, padding:'0 2px' }}
                    onMouseEnter={e=>e.currentTarget.style.color='var(--danger)'}
                    onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}>×</button>
                </span>
              ))}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <input type="text" value={attendeeInput} onChange={e=>setAttendeeInput(e.target.value)}
                placeholder="Namn eller e-post — trykk Enter"
                onKeyDown={e=>{ if(e.key==='Enter'&&attendeeInput.trim()){ setAttendees(prev=>[...prev,attendeeInput.trim()]); setAttendeeInput('') }}}
                style={{ ...fi, flex:1, background:'var(--bg2)' }}/>
              <button onClick={() => { if(attendeeInput.trim()){ setAttendees(prev=>[...prev,attendeeInput.trim()]); setAttendeeInput('') }}}
                style={{ padding:'7px 14px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--r)', color:'var(--text2)', cursor:'pointer', fontSize:13, fontWeight:500, flexShrink:0 }}>
                ＋ Legg til
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Beskriving ── */}
      <Divider label={isMeeting ? "Agenda / referat" : "Beskriving"}/>

      <div style={{ border:'2px solid var(--border)', borderRadius:'var(--r2)',
        overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
        <div style={{ display:'flex', gap:2, padding:'5px 8px', borderBottom:'1px solid var(--border)',
          background:'var(--bg3)', flexWrap:'wrap', alignItems:'center' }}>
          <TBtn onClick={()=>exec('bold')}          title="Fet">       <b>B</b></TBtn>
          <TBtn onClick={()=>exec('italic')}        title="Kursiv">    <i>I</i></TBtn>
          <TBtn onClick={()=>exec('underline')}     title="Understr."> <span style={{textDecoration:'underline'}}>U</span></TBtn>
          <TBtn onClick={()=>exec('strikeThrough')} title="Gj.strek">  <span style={{textDecoration:'line-through'}}>S</span></TBtn>
          <div style={{ width:1, height:16, background:'var(--border2)', margin:'0 3px' }}/>
          <TBtn onClick={()=>exec('insertUnorderedList')} title="Punktliste">• —</TBtn>
          <TBtn onClick={()=>exec('insertOrderedList')}   title="Nummerert"> 1.</TBtn>
          <div style={{ width:1, height:16, background:'var(--border2)', margin:'0 3px' }}/>
          {COLORS.map(c => (
            <div key={c} onClick={() => exec('foreColor',c)} title={c}
              style={{ width:15, height:15, borderRadius:3, background:c,
                border:'1.5px solid rgba(0,0,0,.15)', cursor:'pointer', flexShrink:0 }}/>
          ))}
          <div style={{ width:1, height:16, background:'var(--border2)', margin:'0 3px' }}/>
          <TBtn onClick={()=>exec('removeFormat')} title="Fjern format.">✕</TBtn>
        </div>
        <div ref={editorRef} contentEditable suppressContentEditableWarning
          style={{ minHeight:140, padding:'13px 15px', outline:'none',
            fontSize:14, lineHeight:1.8, color:'var(--text)', background:'var(--bg2)' }}
          onInput={handleEditorInput}
          onKeyDown={e => { if (e.key==='Enter' && (e.ctrlKey||e.metaKey)) handleSave() }}
          data-placeholder="Skriv notat, eller dra inn e-post / PDF…"/>
      </div>

      {/* ── Arbeidsoppgåver ── */}
      <Divider label="Arbeidsoppgåver"/>

      <div>
        {tasks.map(task => (
          <TaskRow key={task.id} task={task} onUpdate={updateTask} onDelete={deleteTask}/>
        ))}

        {/* Column headers */}
        <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:3, padding:'0 2px' }}>
          <div style={{ flex:1, fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.05em' }}>Oppgåve</div>
          <div style={{ width:130, fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.05em' }}>Startdato</div>
          <div style={{ width:56, fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.05em', textAlign:'center' }}>Timar</div>
          <div style={{ width:130, fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.05em' }}>Frist</div>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'flex-start' }}>
          <textarea
            value={newTaskText}
            onChange={e => setNewTaskText(e.target.value)}
            onKeyDown={e => {
              if (e.key==='Enter' && e.altKey) {
                e.preventDefault()
                const ta = e.currentTarget
                const s = ta.selectionStart, end = ta.selectionEnd
                const val = ta.value
                const newVal = val.substring(0,s) + '\n' + val.substring(end)
                setNewTaskText(newVal)
                setTimeout(() => { ta.selectionStart = ta.selectionEnd = s+1 }, 0)
              } else if (e.key==='Enter' && !e.altKey) {
                e.preventDefault()
                commitNewTask()
              }
            }}
            placeholder="Ny arbeidsoppgåve… (Enter = lagre, Alt+Enter = ny linje)"
            rows={newTaskText.includes('\n') ? Math.min(5, newTaskText.split('\n').length + 1) : 1}
            style={{ ...fi, flex:1, resize:'none', lineHeight:1.5,
              background:'var(--bg2)', border:'1.5px solid var(--border)', minHeight:36 }}/>
          <input type="date" value={newTaskStart} onChange={e => setNewTaskStart(e.target.value)}
            title="Startdato"
            style={{ ...fi, width:130, background:'var(--bg2)' }}/>
          <input type="number" value={newTaskHours} onChange={e => setNewTaskHours(e.target.value)}
            placeholder="0.5"
            min="0.5" max="999" step="0.5"
            title="Timeverk (standard: 0.5)"
            style={{ ...fi, width:56, background:'var(--bg2)', textAlign:'center' }}/>
          <input type="date" value={newTaskDate} onChange={e => setNewTaskDate(e.target.value)}
            title={`Frist (standard: fredag = ${nextFriday()})`}
            style={{ ...fi, width:130, background:'var(--bg2)' }}/>
        </div>
        <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>
          Utan frist → fredag denne veka · Utan timar → 0.5t · Alt+Enter for ny linje
        </div>
      </div>

      {/* Tags + Save */}
      {/* Tags row */}
      <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
        {TAGS.map(t => (
          <button key={t.key} onClick={() => setTag(tag===t.key?null:t.key)}
            style={{ padding:'4px 10px', borderRadius:20, border:'1.5px solid',
              borderColor: tag===t.key ? t.color : 'var(--border)',
              background:  tag===t.key ? t.color+'18' : 'transparent',
              color:       tag===t.key ? t.color : 'var(--text3)',
              fontSize:12, cursor:'pointer', fontWeight: tag===t.key ? 700 : 400,
              display:'flex', alignItems:'center', gap:4 }}>
            {t.key}
          </button>
        ))}
      </div>

      {/* Attachments */}
      {(attachments.length > 0 || uploading) && (
        <div style={{ background:'var(--bg3)', border:'1px solid var(--border)',
          borderRadius:'var(--r)', padding:'10px 12px' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)',
            textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>
            Vedlegg {uploading && <span style={{ color:'var(--brand3)' }}>— lastar opp…</span>}
          </div>
          {attachments.map((att, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:8,
              padding:'6px 8px', background:'var(--bg2)', borderRadius:'var(--r)',
              border:'1px solid var(--border)', marginBottom:5 }}>
              <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:5,
                background:'var(--brandbg)', color:'var(--brand)', flexShrink:0 }}>{att.type?.includes('pdf') ? 'PDF' : 'E-post'}</span>
              <a href={att.url} target="_blank" rel="noreferrer"
                style={{ flex:1, fontSize:13, color:'var(--brand)', fontWeight:500,
                  textDecoration:'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {att.name}
              </a>
              <span style={{ fontSize:11, color:'var(--text3)' }}>
                {(att.size/1024).toFixed(0)} KB
              </span>
              <button onClick={() => { pushUndoState(); setAttachments(prev => prev.filter((_,j)=>j!==i)) }}
                style={{ background:'none', border:'none', color:'var(--text3)',
                  cursor:'pointer', padding:2, display:'flex' }}
                onMouseEnter={e=>e.currentTarget.style.color='var(--danger)'}
                onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}>
                <span style={{fontWeight:800,fontSize:13}}>×</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Sketch preview + button */}
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <button onClick={() => setShowSketch(true)}
          style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 18px',
            background: sketchDataUrl ? 'var(--brandbg2)' : 'var(--bg3)',
            border: `1.5px solid ${sketchDataUrl ? 'var(--brand3)' : 'var(--border)'}`,
            borderRadius:'var(--r)', color: sketchDataUrl ? 'var(--brand)' : 'var(--text2)',
            fontSize:13, fontWeight:600, cursor:'pointer', transition:'all .15s' }}>
          
          {sketchDataUrl ? 'Rediger skisse' : 'Legg til skisse'}
        </button>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text3)' }}>
          {saveStatus === 'saving' && <><span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:'var(--warn)',animation:'pulse 1s infinite'}}/>Lagrar…</>}
          {saveStatus === 'saved'  && <><span style={{color:'var(--success)',fontWeight:600}}>Lagra</span></>}
          {saveStatus === 'idle'   && (editNote || createdId) && <span style={{opacity:.6}}>✓ Alle endringar er lagra</span>}
        </div>
        {sketchDataUrl && (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <img src={sketchDataUrl} alt="Skisse" onClick={() => setShowSketch(true)}
              style={{ height:48, borderRadius:'var(--r)', border:'1px solid var(--border)',
                cursor:'pointer', objectFit:'contain', background:'#fff' }}/>
            <button onClick={() => setSketchDataUrl(null)}
              style={{ background:'none', border:'none', color:'var(--text3)',
                cursor:'pointer', padding:2, display:'flex' }}
              onMouseEnter={e=>e.currentTarget.style.color='var(--danger)'}
              onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}>
              <span style={{fontWeight:800,fontSize:13}}>×</span>
            </button>
          </div>
        )}
        <div style={{ flex:1 }}/>
        <button onClick={() => {
            // Force final save and navigate away
            if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null }
            handleSave()
          }}
          style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 22px',
            background:'var(--brand)', border:'none', borderRadius:'var(--r2)',
            color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer',
            boxShadow:'var(--shadow)', transition:'background .15s' }}
          onMouseEnter={e=>e.currentTarget.style.background='var(--brand2)'}
          onMouseLeave={e=>e.currentTarget.style.background='var(--brand)'}>
          Ferdig
        </button>
      </div>

      {/* SketchPad overlay */}
      {showSketch && (
        <SketchPad
          existingDataUrl={sketchDataUrl}
          onSave={url => { setSketchDataUrl(url); setShowSketch(false) }}
          onClose={() => setShowSketch(false)}
        />
      )}
    </div>
  )
}
