import { favorittForst, prosjektValTekst } from './projectFavoritt'
import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { nextFriday, fmt } from './dateUtils'
import SketchPad from './SketchPad'
import DatePicker, { DatoTid } from './DatePicker'
import { eksporterNotatPdf } from './notatPdf'
import CaseTable from './CaseTable'
import OppgaveInnfoering from './OppgaveInnfoering'
import PersonVelger from './PersonVelger'
import usePersonar from './usePersonar'

// ── Tabell i redigeringsvindauget ────────────────────────────────────
// Rein HTML-tabell med inline-stilar (ikkje CSS-klassar) — notat.html vert
// vist fleire stadar (NotePreview, møtereferat osv.) utan ei felles
// stilsette for notatinnhald, så inline er einaste måten å garantere at
// tabellen ser lik ut over alt.
const TABELL_CELLE_STIL = 'border:1px solid #94a3b8;padding:6px 9px;min-width:50px'
function lagTabellHtml(rader = 3, kolonner = 3) {
  const cellePad = c => `<td style="${TABELL_CELLE_STIL}">${c}</td>`
  const rad = () => `<tr>${Array.from({ length: kolonner }, () => cellePad('&nbsp;')).join('')}</tr>`
  return `<table style="border-collapse:collapse;margin:8px 0">${Array.from({ length: rader }, rad).join('')}</table><p><br></p>`
}

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
  if (h === undefined || h === null || h === '') return '–'
  const n = parseFloat(h)
  if (isNaN(n)) return '–'
  return n % 1 === 0 ? `${n}t` : `${n}t`
}

function TaskRow({ task, onUpdate, onDelete, personar = [] }) {
  const [editAnsv,   setEditAnsv]   = useState(task.ansvarleg || '')
  const [editing,    setEditing]    = useState(false)
  const [editText,   setEditText]   = useState(task.text)
  const [editStart,  setEditStart]  = useState(task.startDate || '')
  const [editDate,   setEditDate]   = useState(task.date || '')
  const [editHours,  setEditHours]  = useState(task.hours !== undefined ? String(task.hours) : '')
  const textRef = useRef(null)

  // Hald redigeringsfelta i synk viss oppgåva vert oppdatert utanfrå
  // (t.d. via timeline-drag eller ei anna kjelde) medan feltet ikkje er ope for redigering
  useEffect(() => {
    if (!editing) {
      setEditText(task.text)
      setEditStart(task.startDate || '')
      setEditDate(task.date || '')
      setEditHours(task.hours !== undefined ? String(task.hours) : '')
      setEditAnsv(task.ansvarleg || '')
    }
  }, [task.text, task.startDate, task.date, task.hours, task.ansvarleg, editing])

  useEffect(() => { if (editing && textRef.current) textRef.current.focus() }, [editing])

  const commit = () => {
    const t     = editText.trim() || task.text
    const d     = editDate  || nextFriday()
    const hours = editHours !== '' ? parseFloat(editHours) : undefined
    onUpdate(task.id, { text: t, startDate: editStart || null, date: d, hours, ansvarleg: editAnsv })
    setEditing(false)
  }

  const di = task.date ? fmt(task.date) : null
  const hours = task.hours

  if (editing) return (
    <div style={{ display:'flex', gap:6, padding:'6px 8px', background:'var(--bg4)',
      borderRadius:'var(--r)', border:'1.5px solid var(--brand3)', marginBottom:5,
      flexWrap:'wrap', alignItems:'center' }}>
      <input ref={textRef} value={editText} onChange={e => setEditText(e.target.value)}
        onKeyDown={e => { if (e.key==='Enter') commit(); if (e.key==='Escape') setEditing(false) }}
        style={{ ...fi, flex:1, minWidth:140, padding:'4px 8px', background:'var(--bg2)', fontSize:13 }}/>
      <DatePicker value={editStart} onChange={setEditStart} tittel="Startdato" wrapStyle={{ width:132 }} style={{ ...fi, padding:'4px 28px 4px 8px', background:'var(--bg2)', fontSize:12 }}/>
      <input type="number" value={editHours} onChange={e => setEditHours(e.target.value)}
        min="0.5" max="999" step="0.5" title="Timeverk"
        style={{ ...fi, width:64, padding:'4px 8px', background:'var(--bg2)', fontSize:13, textAlign:'center' }}/>
      <DatePicker value={editDate} onChange={setEditDate} tittel="Frist" wrapStyle={{ width:132 }} style={{ ...fi, padding:'4px 28px 4px 8px', background:'var(--bg2)', fontSize:12 }}/>
      <div style={{ width:150 }}><PersonVelger value={editAnsv} onChange={setEditAnsv} personar={personar} stil={{ padding:'4px 8px', fontSize:12 }}/></div>
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
      {/* Ansvarleg */}
      <span style={{ width:96, fontSize:11, fontWeight:600, color:'var(--text2)', flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={task.ansvarleg || ''}>
        {task.ansvarleg || <span style={{ opacity:.35, fontWeight:400 }}>–</span>}
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

const NoteInput = forwardRef(function NoteInput({ projects, onAdd, onAutoSave, onSetEditNote, defaultProjectId, editNote, onCancelEdit, isMeeting: isMeetingProp, isTaskOnly, isReferat: isReferatProp, userId, onDirtyChange }, ref) {
  const isEdit = !!editNote
  // Lock in "is this a meeting/referat note" so the auto-create→edit transition
  // (which can flip props mid-typing) never collapses the UI. Re-sync ONLY in a
  // fresh "new note" state (editNote null) — the case where the user can switch
  // note type via the dropdown before anything is saved.
  const isReferatRef = useRef(isReferatProp || editNote?.isReferat || false)
  if (editNote?.isReferat) {
    isReferatRef.current = true
  } else if (!editNote) {
    isReferatRef.current = !!isReferatProp
  }
  const isReferat = isReferatRef.current

  const isMeetingRef = useRef(isMeetingProp || editNote?.isMeeting || false)
  if (editNote?.isMeeting) {
    isMeetingRef.current = true  // existing note always wins
  } else if (!editNote) {
    isMeetingRef.current = !!isMeetingProp || !!isReferatProp  // referat brukar møtefelta
  }
  const isMeeting = isMeetingRef.current || isReferat

  const [tag,         setTag]         = useState(isEdit ? editNote.tag : null)
  const [projectVal,  setProjectVal]  = useState(
    isEdit ? String(editNote.projectId||'') : (defaultProjectId ? String(defaultProjectId) : '')
  )
  const [newProjName, setNewProjName] = useState('')
  const [tasks,       setTasks]       = useState(isEdit ? (editNote.tasks||[]) : [])
  const [newTaskText,  setNewTaskText]  = useState('')
  const oppgInnRef = useRef(null) // felles oppgåve-inndata (OppgaveInnfoering); newTaskText speglar teksten som ikkje er lagt til enno
  const { personar, meg } = usePersonar(userId, projectVal && projectVal !== '__new__' ? parseInt(projectVal) : null)

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

  // Track whether this editNote arrived via auto-create-transition (skip re-init)
  // vs. an explicit "open for editing" action (do re-init).
  const skipNextInitRef = useRef(false)

  useEffect(() => {
    if (skipNextInitRef.current) {
      skipNextInitRef.current = false
      return
    }
    if (titleRef.current)  titleRef.current.value  = isEdit ? (editNote.title||'') : ''
    if (editorRef.current) editorRef.current.innerHTML = isEdit ? (editNote.html||editNote.text||'') : ''
    setTasks(isEdit ? (editNote.tasks||[]) : [])
    setTag(isEdit ? editNote.tag : null)
    setProjectVal(isEdit ? String(editNote.projectId||'') : (defaultProjectId ? String(defaultProjectId) : ''))
    setSketchDataUrl(isEdit ? (editNote?.sketchDataUrl || null) : null)
    if (!isEdit && titleRef.current) setTimeout(() => titleRef.current?.focus(), 50)
  }, [editNote?.id, defaultProjectId])

  // All projects (no type filter)
  const allProjects = favorittForst(projects)

  const exec = (cmd, val=null) => { editorRef.current?.focus(); document.execCommand(cmd, false, val); triggerAutoSave() }

  // ── Tabell: sett inn, og rediger via høgreklikk-meny ─────────────────
  const [tableMenu, setTableMenu] = useState(null) // { x, y, cell, table }
  // Word-liknande tabellverktøy: flytande verktøylinje når markøren står i ein tabell, dra i kolonnekanten for breidde, Tab = neste celle
  const [tabellKtx, setTabellKtx] = useState(null)   // { cell, table } for markøren
  const [verktoy, setVerktoy] = useState(null)       // { x, y } posisjon (fixed) for verktøylinja
  const [visTabellVelger, setVisTabellVelger] = useState(false)
  const [velgR, setVelgR] = useState({ r: 0, k: 0 })
  const resizeRef = useRef(false)

  const settInnTabell = (r = 3, k = 3) => {
    setVisTabellVelger(false)
    editorRef.current?.focus()
    document.execCommand('insertHTML', false, lagTabellHtml(r, k))
    triggerAutoSave()
  }

  const handleEditorContextMenu = (e) => {
    const cell = e.target.closest('td, th')
    const table = e.target.closest('table')
    if (!cell || !table || !editorRef.current?.contains(table)) { setTableMenu(null); return }
    e.preventDefault()
    setTableMenu({ x: e.clientX, y: e.clientY, cell, table })
  }

  useEffect(() => {
    if (!tableMenu) return
    const lukk = () => setTableMenu(null)
    const esc  = (e) => { if (e.key === 'Escape') setTableMenu(null) }
    window.addEventListener('mousedown', lukk)
    window.addEventListener('keydown', esc)
    window.addEventListener('scroll', lukk, true)
    return () => {
      window.removeEventListener('mousedown', lukk)
      window.removeEventListener('keydown', esc)
      window.removeEventListener('scroll', lukk, true)
    }
  }, [tableMenu])

  // Manipulerer tabell-DOM-en direkte (insertRow/deleteCell osv. utløyser
  // ikkje eit 'input'-event på det redigerbare feltet slik tastetrykk gjer),
  // så autolagringa må kallast eksplisitt etter kvar endring.
  const nyCelle = (rad, malCelle) => {
    const c = rad.insertCell()
    c.innerHTML = '&nbsp;'
    c.setAttribute('style', malCelle?.getAttribute('style') || TABELL_CELLE_STIL)
    return c
  }
  const settInnRad = (retning) => {
    const ktx = tableMenu || tabellKtx
    if (!ktx) return
    const { cell, table } = ktx
    const radIndeks = cell.parentElement.rowIndex + (retning === 'under' ? 1 : 0)
    const nyRad = table.insertRow(radIndeks)
    const malRad = table.rows[retning === 'under' ? radIndeks - 1 : radIndeks + 1]
    const tal = malRad ? malRad.cells.length : cell.parentElement.cells.length
    for (let i = 0; i < tal; i++) nyCelle(nyRad, malRad?.cells[i])
    setTableMenu(null); triggerAutoSave()
  }
  const settInnKolonne = (retning) => {
    const ktx = tableMenu || tabellKtx
    if (!ktx) return
    const { cell, table } = ktx
    const kolIndeks = cell.cellIndex + (retning === 'høgre' ? 1 : 0)
    for (const rad of table.rows) {
      const c = rad.insertCell(kolIndeks)
      c.innerHTML = '&nbsp;'
      c.setAttribute('style', rad.cells[Math.max(0, Math.min(kolIndeks - (retning === 'høgre' ? 1 : 0), rad.cells.length - 1))]?.getAttribute('style') || TABELL_CELLE_STIL)
    }
    oppdaterTabellBredde(table)
    setTableMenu(null); triggerAutoSave()
  }
  const slettRad = () => {
    const ktx = tableMenu || tabellKtx
    if (!ktx) return
    const { cell, table } = ktx
    if (table.rows.length <= 1) table.remove()
    else table.deleteRow(cell.parentElement.rowIndex)
    setTableMenu(null); triggerAutoSave()
  }
  const slettKolonne = () => {
    const ktx = tableMenu || tabellKtx
    if (!ktx) return
    const { cell, table } = ktx
    if (table.rows[0].cells.length <= 1) table.remove()
    else for (const rad of table.rows) rad.deleteCell(cell.cellIndex)
    oppdaterTabellBredde(table)
    setTableMenu(null); triggerAutoSave()
  }
  const slettTabell = () => {
    const ktx = tableMenu || tabellKtx
    if (!ktx) return
    ktx.table.remove()
    setTableMenu(null); triggerAutoSave()
  }


  // Fast kolonnebreidd (px) — gjer breidda på kolonnane dragbare. Konverterer ein vanleg (auto-)tabell fyrste gong.
  const oppdaterTabellBredde = (table) => {
    if (!table || table.style.tableLayout !== 'fixed' || !table.rows[0]) return
    table.style.width = [...table.rows[0].cells].reduce((a, c) => a + (parseFloat(c.style.width) || 0), 0) + 'px'
  }
  const fiksTabell = (table) => {
    if (table.style.tableLayout === 'fixed') return
    const maal = [...table.rows[0].cells].map(c => c.getBoundingClientRect().width)
    for (const rad of table.rows) [...rad.cells].forEach((c, i) => { c.style.width = Math.round(maal[i] ?? 80) + 'px'; c.style.minWidth = '30px' })
    table.style.tableLayout = 'fixed'
    oppdaterTabellBredde(table)
  }
  const naerKant = (cell, e) => { const r = cell.getBoundingClientRect(); const d = r.right - e.clientX; return d <= 5 && d >= -2 }
  const handleEditorMouseMove = (e) => {
    const ed = editorRef.current
    if (!ed || resizeRef.current) return
    const cell = e.target.closest?.('td, th')
    ed.style.cursor = cell && ed.contains(cell) && naerKant(cell, e) ? 'col-resize' : ''
  }
  const handleEditorMouseDown = (e) => {
    const cell = e.target.closest?.('td, th')
    if (!cell || !editorRef.current?.contains(cell) || !naerKant(cell, e)) return
    e.preventDefault()
    const table = cell.closest('table')
    fiksTabell(table)
    const idx = cell.cellIndex, x0 = e.clientX, w0 = parseFloat(cell.style.width) || cell.getBoundingClientRect().width
    resizeRef.current = true
    const mv = (ev) => {
      const w = Math.max(30, Math.round(w0 + ev.clientX - x0))
      for (const rad of table.rows) { const c = rad.cells[idx]; if (c) c.style.width = w + 'px' }
      oppdaterTabellBredde(table)
    }
    const opp = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', opp); resizeRef.current = false; document.body.style.cursor = ''; triggerAutoSave() }
    document.body.style.cursor = 'col-resize'
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', opp)
  }
  // Tab i ein tabell: neste celle (ny rad etter siste), Shift+Tab: førre
  const handleTabITabell = (e) => {
    const sel = window.getSelection()
    const n = sel?.anchorNode
    const el = n && (n.nodeType === 1 ? n : n.parentElement)
    const cell = el?.closest?.('td, th')
    const table = cell?.closest('table')
    if (!cell || !table || !editorRef.current?.contains(table)) return false
    e.preventDefault()
    const alle = [...table.querySelectorAll('td, th')]
    const i = alle.indexOf(cell)
    let mal = e.shiftKey ? alle[i - 1] : alle[i + 1]
    if (!mal && !e.shiftKey) {
      const siste = table.rows[table.rows.length - 1]
      const ny = table.insertRow(-1)
      for (const c0 of siste.cells) { const c = ny.insertCell(); c.innerHTML = '&nbsp;'; c.setAttribute('style', c0.getAttribute('style') || TABELL_CELLE_STIL) }
      mal = ny.cells[0]; triggerAutoSave()
    }
    if (mal) { const r = document.createRange(); r.selectNodeContents(mal); r.collapse(false); sel.removeAllRanges(); sel.addRange(r) }
    return true
  }
  useEffect(() => {
    const oppdater = () => {
      const sel = window.getSelection()
      const ed = editorRef.current
      const n = sel?.anchorNode
      const el = n && (n.nodeType === 1 ? n : n.parentElement)
      const cell = el?.closest?.('td, th')
      const table = cell?.closest('table')
      if (!ed || !cell || !table || !ed.contains(table)) { setVerktoy(null); setTabellKtx(null); return }
      const r = table.getBoundingClientRect()
      setTabellKtx({ cell, table }); setVerktoy({ x: Math.max(8, r.left), y: Math.max(8, r.top - 44) })
    }
    document.addEventListener('selectionchange', oppdater)
    window.addEventListener('scroll', oppdater, true); window.addEventListener('resize', oppdater)
    return () => { document.removeEventListener('selectionchange', oppdater); window.removeEventListener('scroll', oppdater, true); window.removeEventListener('resize', oppdater) }
  }, [])

  // ── Task auto-save ───────────────────────────────────────────────────
  const commitNewTask = () => {
    const t = oppgInnRef.current?.hentVentande()
    if (t) setTasks(ts => [...ts, t])
  }

  const updateTask = (id, changes) => setTasks(ts => ts.map(t => t.id===id ? {...t,...changes} : t))
  const deleteTask = (id) => setTasks(ts => ts.filter(t => t.id!==id))

  // Eksport til PDF av notatet slik det står no (PDF-vedlegg vert lagde inn bak notatsidene)
  const eksporterPdf = async () => {
    if (pdfBusy) return
    setPdfBusy(true)
    try {
      const html = editorRef.current?.innerHTML?.trim() || ''
      const text = editorRef.current?.innerText?.trim() || ''
      const pid = (projectVal && projectVal !== '__new__') ? parseInt(projectVal) : null
      const prosjekt = pid ? (projects || []).find(p => p.id === pid) : null
      const { advarslar } = await eksporterNotatPdf({
        ...(editNote || {}),
        title: titleRef.current?.value?.trim() || text.substring(0, 60) || 'Utan tittel', text, html, tasks, sketchDataUrl, attachments,
        isMeeting: isMeeting || false, isReferat: isReferat || false, meetingTime, meetingLocation, attendees: isMeeting ? attendees : [],
      }, prosjekt ? ((prosjekt.projectNumber ? prosjekt.projectNumber + ' ' : '') + prosjekt.name) : '')
      if (advarslar.length) alert('Desse PDF-vedlegga kunne ikkje leggjast med i eksporten: ' + advarslar.join(', '))
    } catch (e) { console.error(e); alert('PDF-eksport feila: ' + (e.message || e)) }
    setPdfBusy(false)
  }

  const handleSave = async () => {
    // Kanseller ventande auto-lagring — vi lagrar no direkte med fersk state
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null }
    const html  = editorRef.current?.innerHTML?.trim()
    const text  = editorRef.current?.innerText?.trim()
    const title = titleRef.current?.value?.trim() || text?.substring(0,60) || 'Utan tittel'
    if (!text && tasks.length===0) return
    let pid = null
    if (projectVal && projectVal!=='__new__') pid = parseInt(projectVal)
    const payload = { title, text:text||'', html:html||'', tasks, tag,
      projectId:pid, newProjName: projectVal==='__new__' ? newProjName : '', sketchDataUrl,
      attachments,
      isMeeting: isMeeting || false,
      isReferat: isReferat || false,
      meetingTime: isMeeting ? meetingTime : null,
      meetingDuration: isMeeting ? meetingDuration : null,
      meetingLocation: isMeeting ? meetingLocation : null,
      attendees: isMeeting ? attendees : [],
    }
    if (isEdit && editNote?.id) {
      // Lagre eksisterande notat via autosave, deretter lukk
      await onAutoSave(payload)
      if (onCancelEdit) onCancelEdit()
    } else {
      onAdd(payload)
      titleRef.current.value = ''; editorRef.current.innerHTML = ''
      setTag(null); setProjectVal(defaultProjectId?String(defaultProjectId):'')
      setNewProjName(''); setTasks([]); setNewTaskText('')
    }
  }

  // ── Whole-window drag & drop for .eml and PDF ────────────────────────
  const handleDragOver = (e) => { e.preventDefault(); setDragActive(true) }
  const handleDragLeave = (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragActive(false) }

  const [attachments, setAttachments] = useState([])
  const [uploading,   setUploading]   = useState(false)
  const [pdfBusy,     setPdfBusy]     = useState(false)
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
      isReferat: isReferat || false,
        meetingTime: isMeeting ? meetingTime : null,
        meetingDuration: isMeeting ? meetingDuration : null,
        meetingLocation: isMeeting ? meetingLocation : null,
        attendees: isMeeting ? attendees : [],
      })
      // After first save in "new" mode, switch to edit mode for subsequent saves
      if (!editNote && id && !createdId) {
        setCreatedId(id)
        skipNextInitRef.current = true  // don't let the init-effect clobber what's being typed
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
  // Skriv «- » (eller «* », «• ») først på ei linje → punktliste; «1. » → nummerert liste. Neste linje held fram i lista (Enter), tom linje avsluttar.
  const handleEditorInput  = () => {
    const ed = editorRef.current
    const sel = window.getSelection()
    if (ed && sel && sel.isCollapsed && sel.anchorNode && sel.anchorNode.nodeType === 3 && !sel.anchorNode.parentElement?.closest('li')) {
      const n = sel.anchorNode, t = n.nodeValue || ''
      if (!n.previousSibling && sel.anchorOffset === t.length) {
        if (/^[-*•–]\s$/.test(t)) { n.nodeValue = ''; document.execCommand('insertUnorderedList') }
        else if (/^\d{1,2}[.)]\s$/.test(t)) { n.nodeValue = ''; document.execCommand('insertOrderedList') }
      }
    }
    if (ed && (ed.innerHTML === '<br>' || ed.innerHTML === '<div><br></div>')) ed.innerHTML = ''   // tomt felt → plasshaldaren «Beskriving» vert vist
    triggerAutoSave()
  }
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
    if (files.length > 0) { (async () => { for (const f of files) await processFile(f) })() }
  }

  // tabIndex={-1}: verktøylinja skal ikkje vere ein del av Tab-rekkjefølgja —
  // utan dette var «Fet»-knappen (fyrste elementet i verktøylinja, som ligg
  // rett før redigeringsvindauget i DOM-en) det Tab landa på etter tittel-
  // feltet, i staden for å hoppe rett til sjølve tekstfeltet.
  const TBtn = ({ onClick, title, children }) => (
    <button onClick={onClick} title={title} tabIndex={-1}
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

  // ── Lagre arbeidsoppgåver (task-only-modus) ──────────────────────────
  // Trekt ut til ein eigen funksjon slik at han kan kallast både frå
  // «Lagre»-knappen under og frå den eksterne save()-referansen (sjå
  // useImperativeHandle under) — brukt av NoteModal når brukar vel
  // «Lagre og lukk» i stadfestingsdialogen ved X-lukking.
  const handleSaveTasksOnly = () => {
    // Hent ei oppgåve som er skriven men ikkje lagt til enno
    const ventande = oppgInnRef.current?.hentVentande()
    setTimeout(() => {
      let pid = null
      if (projectVal && projectVal !== '__new__') pid = parseInt(projectVal)
      const finalTasks = ventande ? [...tasks, ventande] : tasks
      if (finalTasks.length === 0) return
      const titleSummary = finalTasks.length === 1
        ? `Oppgåve: ${finalTasks[0].text.substring(0, 50)}`
        : `${finalTasks.length} arbeidsoppgåver`
      onAdd({ title: titleSummary,
        text: '', html: '', tasks: finalTasks, tag: 'oppgåve',
        projectId: pid, newProjName: projectVal === '__new__' ? newProjName : '',
        sketchDataUrl: null, attachments: [],
        isMeeting: false })
    }, 0)
  }

  // ── Ulagra-endringar-signal + ekstern lagre-metode ───────────────────
  // isTaskOnly har inga autolagring (eksplisitt «Lagre»-knapp), så dirty
  // er her rekna direkte frå innhaldet. Elles fell det saman med
  // saveStatus === 'saving' (autolagringa har registrert ei endring som
  // enno ikkje er stadfesta lagra). NoteModal bruker onDirtyChange til å
  // avgjere om X-lukking skal spørje om lagring, og save() (via ref) til
  // å utløyse lagring direkte når brukar svarar «Lagre og lukk».
  const dirty = isTaskOnly ? (tasks.length > 0 || newTaskText.trim() !== '') : (saveStatus === 'saving')
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty])

  useImperativeHandle(ref, () => ({
    save: () => { if (isTaskOnly) handleSaveTasksOnly(); else handleSave() },
  }), [isTaskOnly, handleSaveTasksOnly, handleSave])

  // Simplified task-only mode
  if (isTaskOnly) {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
          background:'var(--brandbg)', border:'1.5px solid var(--brand3)',
          borderRadius:'var(--r2)' }}>
          <span style={{ width:24, height:24, borderRadius:6, background:'var(--brand)',
            color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
            fontWeight:800, fontSize:13, flexShrink:0 }}>O</span>
          <span style={{ fontSize:14, fontWeight:700, color:'var(--brand)' }}>
            Nye arbeidsoppgåver (utan notat)
          </span>
        </div>

        {/* Project */}
        <div>
          <label style={{ fontSize:11, color:'var(--text3)', display:'block', marginBottom:4,
            textTransform:'uppercase', letterSpacing:'.05em', fontWeight:700 }}>Prosjekt</label>
          <select value={projectVal} onChange={e => setProjectVal(e.target.value)}
            style={{ ...fi, fontWeight: projectVal ? 600 : 400 }}>
            <option value="">— Utan prosjekt —</option>
            {allProjects.map(p => <option key={p.id} value={p.id}>{prosjektValTekst(p)}</option>)}
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

        {/* Already-added tasks list */}
        {tasks.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {tasks.map(t => (
              <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10,
                padding:'9px 12px', background:'var(--bg2)', border:'1px solid var(--border)',
                borderRadius:'var(--r)' }}>
                <span style={{ flex:1, fontSize:14, color:'var(--text)', fontWeight:500 }}>{t.text}</span>
                {t.ansvarleg && <span style={{ fontSize:12, fontWeight:600, color:'var(--text2)' }}>{t.ansvarleg}</span>}
                {t.startDate && <span style={{ fontSize:12, color:'var(--text3)' }}>Start: {t.startDate}</span>}
                {t.hours != null && <span style={{ fontSize:12, fontWeight:700, color:'var(--brand)',
                  background:'var(--brandbg)', borderRadius:5, padding:'2px 8px' }}>{t.hours}t</span>}
                {t.date && <span style={{ fontSize:12, color:'var(--text3)' }}>Frist: {t.date}</span>}
                <button onClick={() => deleteTask(t.id)}
                  style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer',
                    fontWeight:800, fontSize:13, padding:'2px 6px' }}
                  onMouseEnter={e=>e.currentTarget.style.color='var(--danger)'}
                  onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Ny oppgåve — same inndata som alle andre flater */}
        <div>
          <label style={{ fontSize:11, color:'var(--text3)', display:'block', marginBottom:4,
            textTransform:'uppercase', letterSpacing:'.05em', fontWeight:700 }}>
            {tasks.length > 0 ? 'Legg til ei oppgåve til' : 'Oppgåve'}
          </label>
          <OppgaveInnfoering ref={oppgInnRef} autoFocus personar={personar} standardAnsvarleg={meg} onTekst={setNewTaskText} onLeggTil={t => setTasks(ts => [...ts, t])}/>
        </div>

        {/* Save all — primærknapp til venstre */}
        <div style={{ display:'flex', justifyContent:'flex-start', gap:10, marginTop:8 }}>
          <button onClick={handleSaveTasksOnly}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 24px',
              background:'var(--brand)', border:'none', borderRadius:'var(--r2)',
              color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer',
              boxShadow:'var(--shadow)' }}>
            Lagre {tasks.length > 0 ? `(${tasks.length + (newTaskText.trim() ? 1 : 0)})` : ''} oppgåve{(tasks.length + (newTaskText.trim() ? 1 : 0)) === 1 ? '' : 'r'}
          </button>
          <button onClick={() => onCancelEdit && onCancelEdit()}
            style={{ padding:'10px 18px', background:'var(--bg3)',
              border:'1px solid var(--border)', borderRadius:'var(--r2)',
              color:'var(--text2)', fontSize:13, cursor:'pointer' }}>
            Avbryt
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

      {/* ── Prosjekt + Tittel (+ møtefelt på same linje i møte-/referatmodus) ── */}
      <div style={isMeeting
        ? { display:'grid', gridTemplateColumns:'minmax(200px, 1.5fr) 2fr 170px 95px 1fr', gap:8, alignItems:'end' }
        : { display:'flex', flexDirection:'column', gap:10 }}>
        <div>
          {isMeeting && <label style={{ fontSize:10, color:'var(--text3)', display:'block', marginBottom:2, textTransform:'uppercase', letterSpacing:'.04em', fontWeight:700 }}>Prosjekt</label>}
          <select value={projectVal==='__new__' ? '__new__' : projectVal}
            onChange={e => setProjectVal(e.target.value)}
            title="Prosjekt"
            style={{ ...fi, fontWeight: projectVal && projectVal!=='__new__' ? 600 : 400,
              padding: isMeeting ? '8px 10px' : '10px 13px' }}>
            <option value="">— Utan prosjekt —</option>
            {allProjects.map(p => <option key={p.id} value={p.id}>{prosjektValTekst(p)}</option>)}
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

        <div>
          {isMeeting && <label style={{ fontSize:10, color:'var(--text3)', display:'block', marginBottom:2, textTransform:'uppercase', letterSpacing:'.04em', fontWeight:700 }}>Tittel</label>}
          <input ref={titleRef} type="text"
            placeholder={isReferat ? "Tittel på møtereferatet…" : "Tittel på notatet…"}
            style={{ ...fi, fontSize: isMeeting ? 14 : 16, fontWeight:700,
              padding: isMeeting ? '8px 10px' : '10px 13px',
              background:'var(--bg2)', border:'2px solid var(--brand3)',
              borderRadius:'var(--r2)', letterSpacing:'-0.01em' }}
            onInput={handleTitleInput}
            onKeyDown={e => e.key==='Enter' && editorRef.current?.focus()}/>
        </div>

        {isMeeting && (
          <>
            <div>
              <label style={{ fontSize:10, color:'var(--text3)', display:'block', marginBottom:2, textTransform:'uppercase', letterSpacing:'.04em', fontWeight:700 }}>Tidspunkt</label>
              <DatoTid value={meetingTime} onChange={setMeetingTime} style={{ ...fi, background:'var(--bg2)', padding:'8px 8px', fontSize:12 }}/>
            </div>
            <div>
              <label style={{ fontSize:10, color:'var(--text3)', display:'block', marginBottom:2, textTransform:'uppercase', letterSpacing:'.04em', fontWeight:700 }}>Varigheit</label>
              <select value={meetingDuration} onChange={e=>setMeetingDuration(e.target.value)}
                style={{ ...fi, background:'var(--bg2)', padding:'8px 8px', fontSize:12 }}>
                <option value="30">30 min</option>
                <option value="60">1 t</option>
                <option value="90">1,5 t</option>
                <option value="120">2 t</option>
                <option value="180">3 t</option>
                <option value="480">Heil dag</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize:10, color:'var(--text3)', display:'block', marginBottom:2, textTransform:'uppercase', letterSpacing:'.04em', fontWeight:700 }}>Stad / lenke</label>
              <input type="text" value={meetingLocation} onChange={e=>setMeetingLocation(e.target.value)}
                placeholder="Møterom 2 / Teams"
                style={{ ...fi, background:'var(--bg2)', padding:'8px 8px', fontSize:12 }}/>
            </div>
          </>
        )}
      </div>

      {/* ── Kompakt møteinfo (møtenotat + møtereferat) ── */}
      {isMeeting && (
        <div style={{ background:'var(--bg3)', border:'1px solid var(--border)',
          borderRadius:'var(--r2)', padding:'8px 12px' }}>
          <div style={{ display:'flex', flexWrap:'wrap', gap:5, alignItems:'center' }}>
            <span style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase',
              letterSpacing:'.04em', fontWeight:700, marginRight:4 }}>Deltakarar</span>
            {attendees.map((a,i) => (
              <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:16, fontSize:12, color:'var(--text2)' }}>
                {a}
                <button onClick={() => setAttendees(prev=>prev.filter((_,j)=>j!==i))}
                  style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:13, lineHeight:1, padding:'0 1px' }}
                  onMouseEnter={e=>e.currentTarget.style.color='var(--danger)'}
                  onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}>×</button>
              </span>
            ))}
            <input type="text" value={attendeeInput} onChange={e=>setAttendeeInput(e.target.value)}
              placeholder="+ Namn/e-post, Enter"
              onKeyDown={e=>{ if(e.key==='Enter'&&attendeeInput.trim()){ setAttendees(prev=>[...prev,attendeeInput.trim()]); setAttendeeInput('') }}}
              style={{ flex:1, minWidth:140, border:'none', background:'transparent',
                fontSize:12, padding:'3px 4px', outline:'none', color:'var(--text)', fontFamily:'var(--font)' }}/>
          </div>
        </div>
      )}

      {/* ── Beskriving ── */}
      {isReferat && (
        <>
          <Divider label="Saksliste"/>
          {(editNote?.id || createdId) ? (
            <CaseTable key={'ct-' + (editNote?.id || createdId)} noteId={editNote?.id || createdId}
              projectId={projectVal && projectVal !== '__new__' ? parseInt(projectVal) : null}
              userId={userId}/>
          ) : (
            <div style={{ border:'1.5px dashed var(--border)', borderRadius:'var(--r2)',
              padding:'16px', textAlign:'center', color:'var(--text3)', fontSize:13 }}>
              Skriv ein tittel på referatet først — sakslista blir tilgjengeleg når notatet er lagra (automatisk)
            </div>
          )}
        </>
      )}

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
          <span style={{ position: 'relative', display: 'inline-block' }} onMouseLeave={() => setVisTabellVelger(false)}>
            <TBtn onClick={() => setVisTabellVelger(v => !v)} title="Sett inn tabell — vel storleik. Når markøren står i ein tabell kjem ei verktøylinje over han; dra i kolonnekanten for å endre breidde.">⊞</TBtn>
            {visTabellVelger && (
              <div onMouseDown={e => e.preventDefault()} style={{ position: 'absolute', top: '100%', left: 0, zIndex: 400, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-lg)', padding: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 20px)', gap: 3 }}>
                  {Array.from({ length: 48 }, (_, i) => { const r = Math.floor(i / 8) + 1, k = (i % 8) + 1; const pa = r <= velgR.r && k <= velgR.k
                    return <div key={i} onMouseEnter={() => setVelgR({ r, k })} onClick={() => settInnTabell(r, k)}
                      style={{ width: 20, height: 16, border: '1px solid ' + (pa ? 'var(--brand)' : 'var(--border)'), background: pa ? 'var(--brandbg2)' : 'var(--bg2)', cursor: 'pointer', borderRadius: 2 }}/> })}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text2)', textAlign: 'center', marginTop: 6 }}>{velgR.r ? velgR.r + ' rader × ' + velgR.k + ' kolonnar' : 'Vel storleik'}</div>
              </div>
            )}
          </span>
          <div style={{ width:1, height:16, background:'var(--border2)', margin:'0 3px' }}/>
          <TBtn onClick={()=>exec('removeFormat')} title="Fjern format.">✕</TBtn>
        </div>
        <div ref={editorRef} contentEditable suppressContentEditableWarning
          style={{ minHeight:'max(280px, 34vh)', padding:'13px 15px', outline:'none',
            fontSize:14, lineHeight:1.8, color:'var(--text)', background:'var(--bg2)' }}
          onInput={handleEditorInput}
          onContextMenu={handleEditorContextMenu}
          onMouseMove={handleEditorMouseMove} onMouseDown={handleEditorMouseDown}
          onKeyDown={e => { if (e.key==='Tab' && handleTabITabell(e)) return; if (e.key==='Enter' && (e.ctrlKey||e.metaKey)) handleSave() }}
          data-placeholder={isReferat ? 'Notat / kommentarar' : isMeeting ? 'Agenda / referat' : 'Beskriving'}/>
      </div>

      {/* ── Tabell-kontekstmeny (høgreklikk i ein tabellcelle) ── */}
      {verktoy && tabellKtx && (
        <div onMouseDown={e => e.preventDefault()}
          style={{ position: 'fixed', left: Math.min(verktoy.x, window.innerWidth - 560), top: verktoy.y, zIndex: 350, display: 'flex', alignItems: 'center', gap: 3, padding: '4px 6px',
            background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 9, boxShadow: 'var(--shadow-lg)' }}>
          {[
            ['Rad over', '＋↑', () => settInnRad('over')], ['Rad under', '＋↓', () => settInnRad('under')],
            ['Kolonne til venstre', '＋←', () => settInnKolonne('venstre')], ['Kolonne til høgre', '＋→', () => settInnKolonne('høgre')],
          ].map(([t, ikon, fn]) => (
            <button key={t} onClick={fn} title={'Sett inn: ' + t} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', fontFamily: 'var(--font)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--brandbg)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>{ikon}</button>
          ))}
          <span style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 3px' }}/>
          {[['Slett rad', '✕ Rad', slettRad], ['Slett kolonne', '✕ Kolonne', slettKolonne], ['Slett heile tabellen', '🗑 Tabell', slettTabell]].map(([t, ikon, fn]) => (
            <button key={t} onClick={fn} title={t} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--danger)', fontFamily: 'var(--font)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(185,28,28,.10)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>{ikon}</button>
          ))}
          <span style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 3px' }}/>
          <span style={{ fontSize: 11, color: 'var(--text3)', padding: '0 4px', whiteSpace: 'nowrap' }}>Dra i kolonnekanten for breidde · Tab = neste celle</span>
        </div>
      )}

      {tableMenu && (
        <div onMouseDown={e => e.stopPropagation()}
          style={{ position:'fixed', left:Math.min(tableMenu.x, window.innerWidth-210), top:tableMenu.y,
            zIndex:400, width:200, background:'var(--bg2)', border:'1px solid var(--border)',
            borderRadius:10, boxShadow:'var(--shadow-lg)', padding:5 }}>
          {[
            ['Sett inn rad over',    () => settInnRad('over')],
            ['Sett inn rad under',   () => settInnRad('under')],
            ['Sett inn kolonne til venstre', () => settInnKolonne('venstre')],
            ['Sett inn kolonne til høgre',   () => settInnKolonne('høgre')],
          ].map(([txt, fn]) => (
            <button key={txt} onClick={fn} style={{ display:'block', width:'100%', textAlign:'left',
              border:'none', background:'transparent', padding:'6px 10px', borderRadius:7,
              fontSize:12.5, color:'var(--text)', fontFamily:'var(--font)', cursor:'pointer' }}
              onMouseEnter={e=>e.currentTarget.style.background='var(--brandbg)'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              {txt}
            </button>
          ))}
          <div style={{ height:1, background:'var(--border)', margin:'5px 4px' }}/>
          {[
            ['Slett rad',      slettRad],
            ['Slett kolonne',  slettKolonne],
            ['Slett tabell',   slettTabell],
          ].map(([txt, fn]) => (
            <button key={txt} onClick={fn} style={{ display:'block', width:'100%', textAlign:'left',
              border:'none', background:'transparent', padding:'6px 10px', borderRadius:7,
              fontSize:12.5, color:'var(--danger)', fontFamily:'var(--font)', cursor:'pointer' }}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(185,28,28,.10)'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              {txt}
            </button>
          ))}
        </div>
      )}

      {/* ── Arbeidsoppgåver ── */}
      <div>
        {tasks.map(task => (
          <TaskRow key={task.id} task={task} onUpdate={updateTask} onDelete={deleteTask} personar={personar}/>
        ))}

        <OppgaveInnfoering ref={oppgInnRef} personar={personar} standardAnsvarleg={meg} onTekst={setNewTaskText} onLeggTil={t => setTasks(ts => [...ts, t])} plassholder="Ny arbeidsoppgåve… (Enter = legg til, Alt+Enter = ny linje)"/>
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

      {/* Bottom bar: Ferdig til venstre, deretter skisse + status */}
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <button onClick={() => {
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
        <button onClick={() => setShowSketch(true)}
          style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 18px',
            background: sketchDataUrl ? 'var(--brandbg2)' : 'var(--bg3)',
            border: `1.5px solid ${sketchDataUrl ? 'var(--brand3)' : 'var(--border)'}`,
            borderRadius:'var(--r)', color: sketchDataUrl ? 'var(--brand)' : 'var(--text2)',
            fontSize:13, fontWeight:600, cursor:'pointer', transition:'all .15s' }}>
          
          {sketchDataUrl ? 'Rediger skisse' : 'Legg til skisse'}
        </button>
        <label title="Legg ei PDF ved notatet (kan òg dragast rett inn i vindauget)"
          style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 18px', background:'var(--bg3)', border:'1.5px solid var(--border)',
            borderRadius:'var(--r)', color:'var(--text2)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
          Legg til PDF
          <input type="file" accept="application/pdf,.pdf" multiple style={{ display:'none' }}
            onChange={async e => { const fl = [...e.target.files]; e.target.value = ''; for (const f of fl) await processFile(f) }}/>
        </label>
        <button onClick={eksporterPdf} disabled={pdfBusy} title="Eksporter notatet til PDF (PDF-vedlegg vert med)"
          style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 18px', background:'var(--bg3)', border:'1.5px solid var(--border)',
            borderRadius:'var(--r)', color:'var(--text2)', fontSize:13, fontWeight:600, cursor: pdfBusy ? 'wait' : 'pointer', opacity: pdfBusy ? .6 : 1 }}>
          {pdfBusy ? 'Lagar PDF…' : 'Eksporter PDF'}
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
})

export default NoteInput
