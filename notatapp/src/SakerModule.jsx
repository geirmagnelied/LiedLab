import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import DatePicker from './DatePicker'

// ── Konstantar ────────────────────────────────────────────────────────
const FAG = ['ARK', 'RIB', 'RIE', 'RIV', 'RIBr', 'Landskap', 'Anna']
const TYPE = ['Prosjekteringsavvik', 'Grensesnitt', 'Sp\u00F8rsm\u00E5l', 'Krev avklaring', 'Forslag']
const STATUS_LABELS = { ny: 'Ny', arbeid: 'Under arbeid', kontroll: 'Til kontroll', lukka: 'Lukka' }
const STATUS_ORDER = ['ny', 'arbeid', 'kontroll', 'lukka']
const STATUS_COLORS = { ny: '#1565C0', arbeid: '#B45309', kontroll: '#6D28D9', lukka: '#166534' }
const PRIO_LABELS = { lav: 'Lav', normal: 'Normal', hoog: 'H\u00F8g', kritisk: 'Kritisk' }
const PRIO_COLORS = { lav: '#6B7280', normal: '#6B7280', hoog: '#B45309', kritisk: '#B91C1C' }

const ALL_COLUMNS = [
  { key: 'number',    label: 'Nr',          width: 110 },
  { key: 'title',      label: 'Tittel',      width: 260 },
  { key: 'status',     label: 'Status',      width: 130 },
  { key: 'fag',        label: 'Fag',         width: 90  },
  { key: 'type',       label: 'Type',        width: 160 },
  { key: 'prioritet',  label: 'Prioritet',   width: 100 },
  { key: 'ansvarlig',  label: 'Ansvarleg',   width: 140 },
  { key: 'frist',      label: 'Frist',       width: 110 },
  { key: 'tegning',    label: 'Tegning',     width: 130 },
  { key: 'linked',     label: 'Koplingar',   width: 170 },
  { key: 'comments',   label: 'Kommentarar', width: 100 },
  { key: 'opprettet',  label: 'Opprettet',   width: 120 },
]
const COLORDER_KEY = 'liedlab-saker-colorder-v1'

function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('no-NO', { day:'2-digit', month:'short' }) + ' ' + d.toLocaleTimeString('no-NO', { hour:'2-digit', minute:'2-digit', hour12:false })
}
function fmtDate(iso) {
  if (!iso) return '\u2014'
  return new Date(iso).toLocaleDateString('no-NO', { day:'2-digit', month:'short', year:'numeric' })
}
function fmtDateShort(iso) {
  if (!iso) return '\u2014'
  return new Date(iso).toLocaleDateString('no-NO', { day:'2-digit', month:'2-digit', year:'2-digit' })
}
function initials(name) { return (name || '?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() }

export default function SakerModule({ userId, userEmail, activeProjectId, projects, notes, activeOfficeId }) {
  const activeProject = (projects || []).find(p => p.id === activeProjectId)
  // Berre notat frå det aktive prosjektet skal kunne koplast til ei sak
  const projectNotes = (notes || []).filter(n => n.projectId === activeProjectId)
  // Personell-forslag henta frå deltakarlister i prosjektets møtereferat (inga eiga personelliste finst enno)
  const personnelList = Array.from(new Set(projectNotes.flatMap(n => n.attendees || []).filter(Boolean))).sort()

  const [cases, setCases]           = useState([])
  const [comments, setComments]     = useState({}) // caseId -> [comment,...]
  const [loading, setLoading]       = useState(true)
  const [statusFilter, setStatusFilter] = useState('alle')
  const [fagFilter, setFagFilter]   = useState('alle')
  const [search, setSearch]         = useState('')
  const [openCaseId, setOpenCaseId] = useState(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [columnOrder, setColumnOrder] = useState(() => {
    try { return JSON.parse(localStorage.getItem(COLORDER_KEY)) || ALL_COLUMNS.map(c=>c.key) }
    catch { return ALL_COLUMNS.map(c=>c.key) }
  })
  const dragColRef = useRef(null)
  const currentUser = userEmail || 'Ukjend brukar'

  // ── Last saker + kommentarar for aktivt prosjekt ──────────────
  const loadCases = useCallback(async () => {
    if (!userId || !activeProjectId) { setCases([]); setComments({}); setLoading(false); return }
    setLoading(true)
    const { data: caseData, error: caseErr } = await supabase.from('cases').select('*')
      .eq('user_id', userId).eq('project_id', activeProjectId).is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (caseErr) { console.error(caseErr); setLoading(false); return }
    const list = caseData || []
    setCases(list.map(c => ({
      id: c.id, number: c.number, title: c.title, description: c.description || '',
      fag: c.fag, type: c.type, status: c.status, prioritet: c.prioritet,
      ansvarlig: c.ansvarlig || '', involverte: c.involverte || [], frist: c.frist || '', tegning: c.tegning || '',
      linkedNotes: c.linked_notes || [], linkedTasks: c.linked_tasks || [],
      attachments: c.attachments || [],
      opprettet: c.created_at, opprettetAv: c.created_by,
    })))

    if (list.length > 0) {
      const { data: commentData } = await supabase.from('case_comments').select('*')
        .in('case_id', list.map(c => c.id)).order('created_at', { ascending: true })
      const grouped = {}
      ;(commentData || []).forEach(cm => {
        if (!grouped[cm.case_id]) grouped[cm.case_id] = []
        grouped[cm.case_id].push({ id: cm.id, author: cm.author, text: cm.text, system: cm.system, time: cm.created_at })
      })
      setComments(grouped)
    } else {
      setComments({})
    }
    setLoading(false)
  }, [userId, activeProjectId])

  useEffect(() => { loadCases() }, [loadCases])

  const saveColOrder = (order) => {
    setColumnOrder(order)
    localStorage.setItem(COLORDER_KEY, JSON.stringify(order))
  }

  // ── Saksnummer-generering per prosjekt ────────────────────────
  const nextCaseNumber = () => {
    const prefix = activeProject?.projectNumber || '0000'
    const nums = cases.map(c => {
      const parts = c.number.split('-')
      return parseInt(parts[parts.length - 1])
    }).filter(n => !isNaN(n))
    const next = (nums.length ? Math.max(...nums) : 0) + 1
    return `K-${prefix}-${String(next).padStart(3, '0')}`
  }

  // ── Opprett sak ────────────────────────────────────────────────
  const createCase = async (fields, stagedFiles) => {
    if (!fields.title.trim()) { alert('Tittel er p\u00E5krevd'); return }
    const id = Date.now()
    const row = {
      id, user_id: userId, project_id: activeProjectId,
      number: nextCaseNumber(), title: fields.title.trim(), description: fields.description.trim(),
      fag: fields.fag, type: fields.type, status: 'ny', prioritet: fields.prioritet,
      ansvarlig: fields.ansvarlig.trim(), involverte: fields.involverte || [],
      frist: fields.frist || null, tegning: '',
      linked_notes: [], linked_tasks: [], attachments: [],
      created_at: new Date().toISOString(), created_by: currentUser,
    }
    const { error } = await supabase.from('cases').insert(row)
    if (error) { alert('Klarte ikkje opprette sak: ' + error.message); return }
    const commentId = Date.now() + 1
    await supabase.from('case_comments').insert({
      id: commentId, case_id: id, user_id: userId, author: currentUser,
      text: 'Sak oppretta.', system: false, created_at: new Date().toISOString(),
    })

    // Last opp filer/utklipp som vart lagt til i registreringsvindauget
    if (stagedFiles && stagedFiles.length > 0) {
      const uploaded = []
      for (const file of stagedFiles) {
        try {
          const path = `${Date.now()}_${Math.random().toString(36).slice(2)}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
          const { error: upErr } = await supabase.storage.from('Vedlegg').upload(path, file)
          if (upErr) throw upErr
          const { data: urlData } = supabase.storage.from('Vedlegg').getPublicUrl(path)
          uploaded.push({ name: file.name, path, url: urlData.publicUrl, size: file.size, type: file.type })
        } catch (e) { console.error('Opplasting feila:', file.name, e) }
      }
      if (uploaded.length > 0) {
        await supabase.from('cases').update({ attachments: uploaded }).eq('id', id).eq('user_id', userId)
      }
    }

    setShowNewModal(false)
    await loadCases()
    setOpenCaseId(id)
  }

  // ── Statusendring ──────────────────────────────────────────────
  const setCaseStatus = async (caseId, newStatus) => {
    const c = cases.find(x => x.id === caseId)
    if (!c || c.status === newStatus) return
    const oldLabel = STATUS_LABELS[c.status]
    const { error } = await supabase.from('cases').update({
      status: newStatus, updated_at: new Date().toISOString(),
    }).eq('id', caseId).eq('user_id', userId)
    if (error) { alert('Klarte ikkje lagre statusendring: ' + error.message); return }
    const commentId = Date.now()
    await supabase.from('case_comments').insert({
      id: commentId, case_id: caseId, user_id: userId, author: currentUser, system: true,
      text: `${currentUser} endra status fr\u00E5 "${oldLabel}" til "${STATUS_LABELS[newStatus]}"`,
      created_at: new Date().toISOString(),
    })
    await loadCases()
  }

  // ── Kommentar ──────────────────────────────────────────────────
  const addComment = async (caseId, text) => {
    if (!text.trim()) return
    const id = Date.now()
    const { error } = await supabase.from('case_comments').insert({
      id, case_id: caseId, user_id: userId, author: currentUser, text: text.trim(),
      system: false, created_at: new Date().toISOString(),
    })
    if (error) { alert('Klarte ikkje lagre kommentar: ' + error.message); return }
    await loadCases()
  }

  // ── Kopling til notat/oppgåve ────────────────────────────────
  const addNoteLink = async (caseId, noteId) => {
    const c = cases.find(x => x.id === caseId)
    if (!c || c.linkedNotes.includes(noteId)) return
    const newLinks = [...c.linkedNotes, noteId]
    const { error } = await supabase.from('cases').update({ linked_notes: newLinks }).eq('id', caseId).eq('user_id', userId)
    if (error) { alert('Klarte ikkje kople notat: ' + error.message); return }
    const note = (notes || []).find(n => n.id === noteId)
    await supabase.from('case_comments').insert({
      id: Date.now(), case_id: caseId, user_id: userId, author: currentUser, system: true,
      text: `${currentUser} kopla til notat: "${note?.title || note?.text?.slice(0,40) || 'Notat'}"`,
      created_at: new Date().toISOString(),
    })
    await loadCases()
  }
  const removeNoteLink = async (caseId, noteId) => {
    const c = cases.find(x => x.id === caseId)
    if (!c) return
    const newLinks = c.linkedNotes.filter(id => id !== noteId)
    await supabase.from('cases').update({ linked_notes: newLinks }).eq('id', caseId).eq('user_id', userId)
    await loadCases()
  }
  const addTaskLink = async (caseId, noteId, taskId) => {
    const c = cases.find(x => x.id === caseId)
    if (!c) return
    if (c.linkedTasks.some(t => t.noteId === noteId && t.taskId === taskId)) return
    const newLinks = [...c.linkedTasks, { noteId, taskId }]
    const { error } = await supabase.from('cases').update({ linked_tasks: newLinks }).eq('id', caseId).eq('user_id', userId)
    if (error) { alert('Klarte ikkje kople oppg\u00E5ve: ' + error.message); return }
    const note = (notes || []).find(n => n.id === noteId)
    const task = note?.tasks?.find(t => t.id === taskId)
    await supabase.from('case_comments').insert({
      id: Date.now(), case_id: caseId, user_id: userId, author: currentUser, system: true,
      text: `${currentUser} kopla til oppg\u00E5ve: "${task?.text || 'Oppg\u00E5ve'}"`,
      created_at: new Date().toISOString(),
    })
    await loadCases()
  }
  const removeTaskLink = async (caseId, noteId, taskId) => {
    const c = cases.find(x => x.id === caseId)
    if (!c) return
    const newLinks = c.linkedTasks.filter(t => !(t.noteId === noteId && t.taskId === taskId))
    await supabase.from('cases').update({ linked_tasks: newLinks }).eq('id', caseId).eq('user_id', userId)
    await loadCases()
  }

  // ── Vedlegg ──────────────────────────────────────────────────
  const uploadAttachment = async (caseId, file) => {
    try {
      const path = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error: upErr } = await supabase.storage.from('Vedlegg').upload(path, file)
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('Vedlegg').getPublicUrl(path)
      const att = { name: file.name, path, url: urlData.publicUrl, size: file.size, type: file.type }
      const c = cases.find(x => x.id === caseId)
      const newAtt = [...(c?.attachments || []), att]
      await supabase.from('cases').update({ attachments: newAtt }).eq('id', caseId).eq('user_id', userId)
      await supabase.from('case_comments').insert({
        id: Date.now(), case_id: caseId, user_id: userId, author: currentUser, system: true,
        text: `${currentUser} la ved fil: "${file.name}"`, created_at: new Date().toISOString(),
      })
      await loadCases()
    } catch (e) {
      alert('Klarte ikkje laste opp vedlegg: ' + e.message)
    }
  }
  const removeAttachment = async (caseId, path) => {
    const c = cases.find(x => x.id === caseId)
    if (!c) return
    const newAtt = c.attachments.filter(a => a.path !== path)
    await supabase.from('cases').update({ attachments: newAtt }).eq('id', caseId).eq('user_id', userId)
    await loadCases()
  }

  // ── Kolonne drag-and-drop ────────────────────────────────────
  const onColDragStart = (key) => { dragColRef.current = key }
  const onColDrop = (targetKey) => {
    const from = dragColRef.current
    if (!from || from === targetKey) return
    const order = [...columnOrder]
    const fi = order.indexOf(from), ti = order.indexOf(targetKey)
    order.splice(fi, 1); order.splice(ti, 0, from)
    dragColRef.current = null
    saveColOrder(order)
  }

  // ── Filtrering ─────────────────────────────────────────────────
  const filtered = cases.filter(c => {
    if (statusFilter !== 'alle' && c.status !== statusFilter) return false
    if (fagFilter !== 'alle' && c.fag !== fagFilter) return false
    if (search && !(c.title + c.number).toLowerCase().includes(search.toLowerCase())) return false
    return true
  })
  const cols = columnOrder.map(k => ALL_COLUMNS.find(c => c.key === k)).filter(Boolean)
  const openCase = cases.find(c => c.id === openCaseId)

  // ── Ingen prosjekt valt ────────────────────────────────────────
  if (!activeProjectId) {
    return (
      <div style={{ display:'flex', flex:1, flexDirection:'column', overflow:'hidden' }}>
        <ModuleTopbar/>
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:14 }}>
          <div style={{ width:72, height:72, borderRadius:18, background:'var(--brandbg2)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, fontWeight:900, color:'var(--brand)' }}>S</div>
          <p style={{ fontSize:14, color:'var(--text3)', textAlign:'center', maxWidth:380, lineHeight:1.7 }}>
            {'Saksregisteret er organisert per prosjekt. Vel eit prosjekt i nedtrekksmenyen \u00F8vst for \u00E5 sj\u00E5 og opprette saker.'}
          </p>
        </div>
      </div>
    )
  }

  function ModuleTopbar() {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0 16px',
        height:50, flexShrink:0, background:'var(--brand)', borderBottom:'1px solid rgba(255,255,255,.1)' }}>
        <span style={{ fontSize:15, fontWeight:800, color:'#fff' }}>Saker</span>
        {activeProject && (
          <span style={{ fontSize:12, color:'rgba(255,255,255,.65)', fontFamily:'var(--mono)' }}>
            {activeProject.projectNumber}{' \u00B7 '}{activeProject.name}
          </span>
        )}
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flex:1, flexDirection:'column', overflow:'hidden' }}>
      <ModuleTopbar/>

      {/* Verktøylinje */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 16px',
        background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexWrap:'wrap' }}>
        <button onClick={()=>setShowNewModal(true)}
          style={{ padding:'7px 14px', borderRadius:'var(--r)', border:'none',
            background:'var(--brand)', color:'#fff', fontWeight:700, fontSize:12.5, cursor:'pointer', fontFamily:'var(--font)' }}>
          + Ny sak
        </button>
        <div style={{ width:1, height:22, background:'var(--border)' }}/>
        <input placeholder={'S\u00F8k sak...'} value={search} onChange={e=>setSearch(e.target.value)}
          style={{ padding:'7px 12px', borderRadius:'var(--r)', border:'1.5px solid var(--border)',
            fontSize:12.5, fontFamily:'var(--font)', outline:'none', width:220 }}/>
        <div style={{ width:1, height:22, background:'var(--border)' }}/>
        <FilterChip active={statusFilter==='alle'} onClick={()=>setStatusFilter('alle')}>Alle ({cases.length})</FilterChip>
        {STATUS_ORDER.map(s => (
          <FilterChip key={s} active={statusFilter===s} onClick={()=>setStatusFilter(s)}>
            {STATUS_LABELS[s]} ({cases.filter(c=>c.status===s).length})
          </FilterChip>
        ))}
        <div style={{ width:1, height:22, background:'var(--border)' }}/>
        <FilterChip active={fagFilter==='alle'} onClick={()=>setFagFilter('alle')}>Alle fag</FilterChip>
        {FAG.map(f => <FilterChip key={f} active={fagFilter===f} onClick={()=>setFagFilter(f)}>{f}</FilterChip>)}
      </div>

      {/* Matrise */}
      <div style={{ flex:1, overflow:'auto' }}>
        {loading ? (
          <div style={{ padding:20, color:'var(--text3)', fontSize:13 }}>{'Lastar\u2026'}</div>
        ) : (
          <table style={{ borderCollapse:'collapse', width:'100%', minWidth:900 }}>
            <thead>
              <tr>
                {cols.map(col => (
                  <th key={col.key} draggable style={{ position:'sticky', top:0, zIndex:5,
                      background:'var(--bg3)', borderBottom:'2px solid var(--border)', borderRight:'1px solid var(--border)',
                      padding:0, textAlign:'left', userSelect:'none', minWidth:col.width }}
                    onDragStart={()=>onColDragStart(col.key)}
                    onDragOver={e=>e.preventDefault()}
                    onDrop={()=>onColDrop(col.key)}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 12px', cursor:'grab',
                      fontSize:10.5, fontWeight:700, color:'var(--text3)', letterSpacing:'.04em', textTransform:'uppercase' }}>
                      <span style={{ opacity:.35, fontSize:11 }}>{'\u22EE\u22EE'}</span>
                      {col.label}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={cols.length} style={{ textAlign:'center', padding:30, color:'var(--text3)' }}>
                  Ingen saker matcher filteret
                </td></tr>
              )}
              {filtered.map(c => (
                <tr key={c.id} onDoubleClick={()=>setOpenCaseId(c.id)} title={'Dobbeltklikk for \u00E5 opne'}
                  style={{ cursor:'pointer', opacity: c.status==='lukka' ? .55 : 1 }}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  {cols.map(col => (
                    <td key={col.key} style={{ padding:'9px 12px', borderBottom:'1px solid var(--border)',
                      borderRight:'1px solid var(--border)', whiteSpace:'nowrap', overflow:'hidden',
                      textOverflow:'ellipsis', maxWidth:260, minWidth:col.width, fontSize:13 }}>
                      <Cell c={c} colKey={col.key} notes={projectNotes} commentCount={(comments[c.id] || []).length}/>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {openCase && (
        <CaseDetailModal
          c={openCase}
          comments={comments[openCase.id] || []}
          notes={projectNotes}
          currentUser={currentUser}
          onClose={()=>setOpenCaseId(null)}
          onSetStatus={setCaseStatus}
          onAddComment={addComment}
          onAddNoteLink={addNoteLink}
          onRemoveNoteLink={removeNoteLink}
          onAddTaskLink={addTaskLink}
          onRemoveTaskLink={removeTaskLink}
          onUploadAttachment={uploadAttachment}
          onRemoveAttachment={removeAttachment}
        />
      )}

      {showNewModal && (
        <NewCaseModal
          nextNumber={nextCaseNumber()}
          personnel={personnelList}
          onClose={()=>setShowNewModal(false)}
          onCreate={createCase}
        />
      )}
    </div>
  )
}

// ── Filter-chip ────────────────────────────────────────────────────
function FilterChip({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      style={{ padding:'5px 11px', borderRadius:20, border:'1.5px solid', borderColor: active ? 'var(--brand2)' : 'var(--border)',
        background: active ? 'var(--brandbg2)' : 'var(--bg2)', color: active ? 'var(--brand)' : 'var(--text3)',
        fontSize:11.5, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)', whiteSpace:'nowrap' }}>
      {children}
    </button>
  )
}

// ── Celle-rendering ──────────────────────────────────────────────
function Cell({ c, colKey, notes, commentCount }) {
  switch (colKey) {
    case 'number': return <span style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--text3)' }}>{c.number}</span>
    case 'title': return <span style={{ fontWeight:600 }}>{c.title}</span>
    case 'status': return <StatusBadge status={c.status}/>
    case 'fag': return c.fag
    case 'type': return c.type
    case 'prioritet': return <PrioBadge prio={c.prioritet}/>
    case 'ansvarlig': return c.ansvarlig || '\u2014'
    case 'frist': return fmtDateShort(c.frist)
    case 'tegning': return c.tegning || '\u2014'
    case 'linked': {
      const n = c.linkedNotes.length, t = c.linkedTasks.length
      if (!n && !t) return <span style={{ color:'var(--text3)', opacity:.5 }}>{'\u2014'}</span>
      return (
        <>
          {n > 0 && <LinkPill>{'\u{1F4C4}'} {n} notat</LinkPill>}
          {t > 0 && <LinkPill>{'\u2713'} {t} oppg.</LinkPill>}
        </>
      )
    }
    case 'comments': return `\u{1F4AC} ${commentCount}`
    case 'opprettet': return fmtDateShort(c.opprettet)
    default: return null
  }
}
function StatusBadge({ status }) {
  return (
    <span style={{ padding:'2px 9px', borderRadius:20, fontSize:10.5, fontWeight:700, letterSpacing:'.02em',
      textTransform:'uppercase', background: STATUS_COLORS[status]+'1a', color: STATUS_COLORS[status] }}>
      {STATUS_LABELS[status]}
    </span>
  )
}
function PrioBadge({ prio }) {
  return (
    <span style={{ padding:'2px 9px', borderRadius:20, fontSize:10.5, fontWeight:700, letterSpacing:'.02em',
      textTransform:'uppercase', background: PRIO_COLORS[prio]+'1a', color: PRIO_COLORS[prio] }}>
      {PRIO_LABELS[prio]}
    </span>
  )
}
function LinkPill({ children }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'1px 7px', borderRadius:20,
      background:'var(--brandbg)', color:'var(--brand)', fontSize:10.5, fontWeight:600, marginRight:4 }}>
      {children}
    </span>
  )
}

// ── Detaljmodal ──────────────────────────────────────────────────
function CaseDetailModal({ c, comments, notes, currentUser, onClose, onSetStatus, onAddComment,
                            onAddNoteLink, onRemoveNoteLink, onAddTaskLink, onRemoveTaskLink,
                            onUploadAttachment, onRemoveAttachment }) {
  const [commentText, setCommentText] = useState('')
  const [linkNoteSel, setLinkNoteSel] = useState('')
  const [linkTaskSel, setLinkTaskSel] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef(null)

  const linkableNotes = notes.filter(n => !c.linkedNotes.includes(n.id))
  const selNoteForTask = notes.find(n => n.id === Number(linkNoteSel) || n.id === linkNoteSel)
  const linkableTasksForNote = selNoteForTask ? (selNoteForTask.tasks || [])
    .filter(t => !c.linkedTasks.some(lt => lt.noteId === selNoteForTask.id && lt.taskId === t.id)) : []

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return
    setUploading(true)
    for (const file of files) { await onUploadAttachment(c.id, file) }
    setUploading(false)
  }

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          e.preventDefault()
          const named = new File([file], `utklipp_${Date.now()}.png`, { type: file.type })
          await handleFiles([named])
        }
      }
    }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.42)', display:'flex',
        alignItems:'center', justifyContent:'center', zIndex:200 }}>
      <div onPaste={handlePaste}
        style={{ background:'var(--bg2)', borderRadius:'var(--r2)', width:640, maxWidth:'94vw', maxHeight:'90vh',
          display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>

        {/* Head */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'16px 20px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <span style={{ fontFamily:'var(--mono)', fontWeight:800, fontSize:15, color:'var(--brand)' }}>{c.number}</span>
          <span style={{ color:'var(--text3)', fontSize:12 }}>{c.fag}{' \u00B7 '}{c.type}</span>
          <button onClick={onClose} style={{ marginLeft:'auto', background:'none', border:'none', fontSize:20,
            cursor:'pointer', color:'var(--text3)', lineHeight:1, padding:4 }}>{'\u00D7'}</button>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:'18px 20px' }}>
          <div style={{ fontSize:17, fontWeight:700, marginBottom:4 }}>{c.title}</div>
          {c.description && <div style={{ fontSize:13, color:'var(--text2)', marginBottom:16, lineHeight:1.6 }}>{c.description}</div>}

          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'12px 20px', marginBottom:16,
            padding:'14px 16px', background:'var(--bg3)', borderRadius:'var(--r)' }}>
            <Field label="Ansvarleg" value={c.ansvarlig || '\u2014'}/>
            <Field label="Frist" value={fmtDate(c.frist)}/>
            <Field label="Tegning" value={c.tegning || '\u2014'}/>
            <Field label="Prioritet" value={PRIO_LABELS[c.prioritet]}/>
          </div>

          {/* Status */}
          <div style={{ marginBottom:18 }}>
            <SectionLabel>Status</SectionLabel>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:6 }}>
              {STATUS_ORDER.map(s => (
                <button key={s} onClick={()=>onSetStatus(c.id, s)}
                  style={{ padding:'7px 13px', borderRadius:'var(--r)', fontSize:12, fontWeight:700, cursor:'pointer',
                    fontFamily:'var(--font)',
                    border: c.status===s ? `2px solid ${STATUS_COLORS[s]}` : '1.5px solid var(--border)',
                    background: c.status===s ? STATUS_COLORS[s] : 'var(--bg2)',
                    color: c.status===s ? '#fff' : 'var(--text3)' }}>
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Vedlegg */}
          <div style={{ marginBottom:18 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <SectionLabel>Vedlegg{uploading ? ' \u2014 lastar opp\u2026' : ''}</SectionLabel>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={()=>fileInputRef.current?.click()}
                  style={{ padding:'6px 12px', borderRadius:'var(--r)', border:'1.5px solid var(--brand2)',
                    background:'var(--brandbg)', color:'var(--brand)', fontWeight:700, fontSize:11.5,
                    cursor:'pointer', fontFamily:'var(--font)' }}>
                  {'\u{1F4CE}'} Legg til fil / utklipp
                </button>
                <input ref={fileInputRef} type="file" multiple style={{ display:'none' }}
                  onChange={e => { handleFiles([...e.target.files]); e.target.value = '' }}/>
              </div>
            </div>
            <div
              onDragOver={e=>{ e.preventDefault(); setDragActive(true) }}
              onDragLeave={()=>setDragActive(false)}
              onDrop={e=>{ e.preventDefault(); setDragActive(false); handleFiles([...e.dataTransfer.files]) }}
              style={{ border:`1.5px dashed ${dragActive ? 'var(--brand2)' : 'var(--border)'}`,
                borderRadius:'var(--r)', padding: c.attachments.length ? 10 : 18,
                background: dragActive ? 'var(--brandbg)' : 'var(--bg3)', transition:'all .15s' }}>
              {c.attachments.length === 0 ? (
                <div style={{ textAlign:'center', color:'var(--text3)', fontSize:12 }}>
                  Dra og slepp filer hit, eller lim inn eit utklipp (Ctrl+V) direkte i vindauget
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  {c.attachments.map((att, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px',
                      background:'var(--bg2)', borderRadius:'var(--r)', border:'1px solid var(--border)' }}>
                      <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 7px', borderRadius:5,
                        background:'var(--brandbg)', color:'var(--brand)', flexShrink:0 }}>
                        {att.type?.includes('image') ? 'BILETE' : att.type?.includes('pdf') ? 'PDF' : 'FIL'}
                      </span>
                      <a href={att.url} target="_blank" rel="noreferrer"
                        style={{ flex:1, fontSize:12.5, color:'var(--brand)', fontWeight:500, textDecoration:'none',
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {att.name}
                      </a>
                      <span style={{ fontSize:10.5, color:'var(--text3)' }}>{(att.size/1024).toFixed(0)} KB</span>
                      <button onClick={()=>onRemoveAttachment(c.id, att.path)}
                        style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer', padding:2 }}>
                        <span style={{ fontWeight:800, fontSize:13 }}>{'\u00D7'}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Kopla notat */}
          <div style={{ marginBottom:18 }}>
            <SectionLabel>Kopla notat</SectionLabel>
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <select value={linkNoteSel} onChange={e=>setLinkNoteSel(e.target.value)}
                style={{ flex:1, padding:'7px 10px', borderRadius:'var(--r)', border:'1.5px solid var(--border)',
                  fontFamily:'var(--font)', fontSize:12.5, outline:'none' }}>
                <option value="">{'Vel notat \u00E5 kople til...'}</option>
                {linkableNotes.map(n => <option key={n.id} value={n.id}>{n.title || n.text?.slice(0,50) || 'Notat'}</option>)}
              </select>
              <button onClick={()=>{ if (linkNoteSel) { onAddNoteLink(c.id, Number(linkNoteSel)); setLinkNoteSel('') } }}
                style={{ padding:'7px 12px', borderRadius:'var(--r)', border:'1.5px solid var(--brand2)',
                  background:'var(--brandbg)', color:'var(--brand)', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'var(--font)' }}>
                Kople
              </button>
            </div>
            {c.linkedNotes.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:8 }}>
                {c.linkedNotes.map(id => {
                  const n = notes.find(x => x.id === id)
                  if (!n) return null
                  return (
                    <div key={id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px',
                      background:'var(--bg3)', borderRadius:6, fontSize:12.5 }}>
                      <span style={{ width:20, height:20, borderRadius:5, display:'flex', alignItems:'center',
                        justifyContent:'center', fontSize:10, fontWeight:800, color:'#fff', background:'#52B788', flexShrink:0 }}>N</span>
                      <span style={{ flex:1, fontWeight:500 }}>{n.title || n.text?.slice(0,50) || 'Notat'}</span>
                      <button onClick={()=>onRemoveNoteLink(c.id, id)}
                        style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:13, padding:'2px 5px' }}>{'\u00D7'}</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Kopla oppgåve */}
          <div style={{ marginBottom:18 }}>
            <SectionLabel>{'Kopla oppg\u00E5ve'}</SectionLabel>
            <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
              <select value={linkNoteSel} onChange={e=>{ setLinkNoteSel(e.target.value); setLinkTaskSel('') }}
                style={{ flex:'1 1 200px', padding:'7px 10px', borderRadius:'var(--r)', border:'1.5px solid var(--border)',
                  fontFamily:'var(--font)', fontSize:12.5, outline:'none' }}>
                <option value="">{'Vel notat med oppg\u00E5va...'}</option>
                {notes.filter(n => (n.tasks||[]).length > 0).map(n => (
                  <option key={n.id} value={n.id}>{n.title || n.text?.slice(0,40) || 'Notat'}</option>
                ))}
              </select>
              <select value={linkTaskSel} onChange={e=>setLinkTaskSel(e.target.value)} disabled={!selNoteForTask}
                style={{ flex:'1 1 200px', padding:'7px 10px', borderRadius:'var(--r)', border:'1.5px solid var(--border)',
                  fontFamily:'var(--font)', fontSize:12.5, outline:'none' }}>
                <option value="">{'Vel oppg\u00E5ve...'}</option>
                {linkableTasksForNote.map(t => <option key={t.id} value={t.id}>{t.text}</option>)}
              </select>
              <button onClick={()=>{
                  if (selNoteForTask && linkTaskSel) {
                    onAddTaskLink(c.id, selNoteForTask.id, Number(linkTaskSel) || linkTaskSel)
                    setLinkTaskSel('')
                  }
                }}
                style={{ padding:'7px 12px', borderRadius:'var(--r)', border:'1.5px solid var(--brand2)',
                  background:'var(--brandbg)', color:'var(--brand)', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'var(--font)' }}>
                Kople
              </button>
            </div>
            {c.linkedTasks.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:8 }}>
                {c.linkedTasks.map((lt, i) => {
                  const note = notes.find(n => n.id === lt.noteId)
                  const task = note?.tasks?.find(t => t.id === lt.taskId)
                  if (!task) return null
                  return (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px',
                      background:'var(--bg3)', borderRadius:6, fontSize:12.5 }}>
                      <span style={{ width:20, height:20, borderRadius:5, display:'flex', alignItems:'center',
                        justifyContent:'center', fontSize:10, fontWeight:800, color:'#fff', background:'#4EADA3', flexShrink:0 }}>O</span>
                      <span style={{ flex:1, fontWeight:500 }}>{task.text}</span>
                      <button onClick={()=>onRemoveTaskLink(c.id, lt.noteId, lt.taskId)}
                        style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:13, padding:'2px 5px' }}>{'\u00D7'}</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Aktivitet / kommentarar */}
          <div>
            <SectionLabel>Aktivitet ({comments.length})</SectionLabel>
            <div style={{ display:'flex', flexDirection:'column', gap:12, marginTop:10 }}>
              {comments.map(cm => (
                <div key={cm.id} style={{ display:'flex', gap:10 }}>
                  <div style={{ width:30, height:30, borderRadius:'50%', background:'var(--brandbg2)', color:'var(--brand)',
                    display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:11.5, flexShrink:0 }}>
                    {initials(cm.author)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'baseline', gap:7, marginBottom:2 }}>
                      <span style={{ fontWeight:700, fontSize:12.5 }}>{cm.author}</span>
                      <span style={{ fontSize:10.5, color:'var(--text3)' }}>{fmtTime(cm.time)}</span>
                    </div>
                    {cm.system ? (
                      <div style={{ color:'var(--text3)', fontStyle:'italic', fontSize:11.5 }}>{cm.text}</div>
                    ) : (
                      <div style={{ fontSize:12.5, color:'var(--text2)', background:'var(--bg3)', padding:'8px 12px',
                        borderRadius:'var(--r)', lineHeight:1.5 }}>{cm.text}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop:16, paddingTop:14, borderTop:'1px solid var(--border)', display:'flex', gap:8, alignItems:'flex-start' }}>
              <div style={{ width:30, height:30, borderRadius:'50%', background:'var(--brandbg2)', color:'var(--brand)',
                display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:11.5, flexShrink:0 }}>
                {initials(currentUser)}
              </div>
              <textarea value={commentText} onChange={e=>setCommentText(e.target.value)}
                placeholder="Skriv ein kommentar..."
                style={{ flex:1, padding:'8px 12px', borderRadius:'var(--r)', border:'1.5px solid var(--border)',
                  fontFamily:'var(--font)', fontSize:12.5, resize:'vertical', minHeight:40, outline:'none' }}/>
              <button onClick={()=>{ onAddComment(c.id, commentText); setCommentText('') }}
                style={{ padding:'8px 16px', borderRadius:'var(--r)', border:'none', background:'var(--brand)',
                  color:'#fff', fontWeight:700, fontSize:12.5, cursor:'pointer', fontFamily:'var(--font)', whiteSpace:'nowrap' }}>
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:10, fontWeight:700, color:'var(--text3)', letterSpacing:'.04em',
        textTransform:'uppercase', marginBottom:3 }}>{label}</label>
      <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{value}</div>
    </div>
  )
}
function SectionLabel({ children }) {
  return (
    <label style={{ fontSize:11, fontWeight:700, color:'var(--text3)', letterSpacing:'.04em', textTransform:'uppercase' }}>
      {children}
    </label>
  )
}

// ── Ny sak-modal ─────────────────────────────────────────────────
const DRAFT_KEY = 'liedlab-saker-newcase-draft'
const emptyDraft = { title:'', description:'', fag:FAG[0], type:TYPE[0], prioritet:'normal', ansvarlig:'', involverte:[], frist:'' }

function NewCaseModal({ nextNumber, personnel, onClose, onCreate }) {
  const [fields, setFields] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY))
      return saved && typeof saved === 'object' ? { ...emptyDraft, ...saved } : { ...emptyDraft }
    } catch { return { ...emptyDraft } }
  })
  const [involvertInput, setInvolvertInput] = useState('')
  const [stagedFiles, setStagedFiles] = useState([])
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef(null)

  const set = (key, val) => setFields(f => {
    const next = { ...f, [key]: val }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(next))
    return next
  })

  const addInvolvert = (name) => {
    const n = (name || '').trim()
    if (!n || fields.involverte.includes(n)) return
    set('involverte', [...fields.involverte, n])
    setInvolvertInput('')
  }
  const removeInvolvert = (name) => set('involverte', fields.involverte.filter(x => x !== name))

  const handleFiles = (files) => {
    if (!files || files.length === 0) return
    setStagedFiles(prev => [...prev, ...files])
  }
  const removeStagedFile = (idx) => setStagedFiles(prev => prev.filter((_, i) => i !== idx))

  const handlePaste = (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          e.preventDefault()
          const named = new File([file], `utklipp_${Date.now()}.png`, { type: file.type })
          handleFiles([named])
        }
      }
    }
  }

  const handleCreate = () => {
    onCreate(fields, stagedFiles)
    localStorage.removeItem(DRAFT_KEY)
  }
  const handleClose = () => {
    // Informasjonen er alt lagra som utkast i localStorage — trygt å lukke utan å miste noko.
    // Utkastet vert henta att neste gong "Ny sak" vert opna, til brukar oppretter eller uttrykkeleg forkastar det.
    onClose()
  }
  const discardDraft = () => {
    if (!window.confirm('Forkaste utkastet? Alt du har fylt ut i dette skjemaet g\u00E5r tapt.')) return
    localStorage.removeItem(DRAFT_KEY)
    setFields({ ...emptyDraft })
    setStagedFiles([])
  }

  const hasDraftContent = fields.title || fields.description || fields.ansvarlig ||
    fields.involverte.length > 0 || fields.frist || stagedFiles.length > 0

  return (
    // Merk: ingen "klikk utanfor for å lukke" — ville mista utfylt informasjon ved uhell.
    // Lukking skjer berre via eksplisitt knapp, og utkastet vert i tillegg lagra fortløpande.
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.42)', display:'flex',
      alignItems:'center', justifyContent:'center', zIndex:200 }}>
      <div onPaste={handlePaste}
        style={{ background:'var(--bg2)', borderRadius:'var(--r2)',
          width:'min(1180px, 94vw)', height:'min(760px, 90vh)',
          minWidth:640, minHeight:440, maxWidth:'96vw', maxHeight:'96vh',
          resize:'both', overflow:'hidden', display:'flex', flexDirection:'column',
          boxShadow:'0 24px 70px rgba(0,0,0,.35)' }}>

        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'18px 26px',
          borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <h3 style={{ margin:0, fontSize:19 }}>Ny sak{' \u2014 '}{nextNumber}</h3>
          {hasDraftContent && (
            <span style={{ fontSize:11, color:'var(--text3)', background:'var(--bg3)',
              padding:'3px 9px', borderRadius:20, fontWeight:600 }}>
              {'Utkast lagra fortl\u00F8pande'}
            </span>
          )}
          <div style={{ flex:1 }}/>
          {hasDraftContent && (
            <button onClick={discardDraft}
              style={{ background:'none', border:'none', color:'var(--text3)', fontSize:12,
                cursor:'pointer', fontFamily:'var(--font)', textDecoration:'underline' }}>
              Forkast utkast
            </button>
          )}
        </div>

        {/* To kolonner: tekstfelt til venstre, vedlegg til høgre */}
        <div style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>

          {/* Venstre kolonne — tekstfelt */}
          <div style={{ flex:'1 1 58%', overflowY:'auto', padding:'22px 26px', borderRight:'1px solid var(--border)' }}>
            <FormField label="Tittel">
              <input className="saker-field-input" value={fields.title} onChange={e=>set('title', e.target.value)}
                placeholder="Kort, beskrivende tittel"/>
            </FormField>
            <FormField label="Skildring">
              <textarea className="saker-field-input" rows={6} value={fields.description}
                onChange={e=>set('description', e.target.value)}
                placeholder="Beskriv problemstillinga i detalj"/>
            </FormField>

            <div style={{ display:'flex', gap:14 }}>
              <FormField label="Ansvarleg" flex>
                <input className="saker-field-input" list="saker-personnel-list" value={fields.ansvarlig}
                  onChange={e=>set('ansvarlig', e.target.value)}
                  placeholder="Vel eller skriv namn"/>
              </FormField>
              <FormField label="Frist" flex>
                <DatePicker value={fields.frist} onChange={v=>set('frist', v)}/>
              </FormField>
            </div>

            <FormField label="Involverte">
              <div style={{ display:'flex', gap:8 }}>
                <input className="saker-field-input" list="saker-personnel-list" value={involvertInput}
                  onChange={e=>setInvolvertInput(e.target.value)}
                  onKeyDown={e=>{ if (e.key==='Enter') { e.preventDefault(); addInvolvert(involvertInput) } }}
                  placeholder="Vel eller skriv namn, Enter for å legge til"/>
                <button type="button" onClick={()=>addInvolvert(involvertInput)}
                  style={{ padding:'0 16px', borderRadius:'var(--r)', border:'1.5px solid var(--brand2)',
                    background:'var(--brandbg)', color:'var(--brand)', fontWeight:700, fontSize:12.5,
                    cursor:'pointer', fontFamily:'var(--font)', whiteSpace:'nowrap' }}>
                  Legg til
                </button>
              </div>
              {fields.involverte.length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
                  {fields.involverte.map(name => (
                    <span key={name} style={{ display:'inline-flex', alignItems:'center', gap:6,
                      padding:'4px 10px', background:'var(--bg3)', borderRadius:20, fontSize:12.5, fontWeight:500 }}>
                      {name}
                      <span onClick={()=>removeInvolvert(name)} style={{ cursor:'pointer', color:'var(--text3)', fontSize:13 }}>{'\u00D7'}</span>
                    </span>
                  ))}
                </div>
              )}
              <datalist id="saker-personnel-list">
                {personnel.map(p => <option key={p} value={p}/>)}
              </datalist>
            </FormField>

            <div style={{ display:'flex', gap:14 }}>
              <FormField label="Fag" flex>
                <select className="saker-field-input" value={fields.fag} onChange={e=>set('fag', e.target.value)}>
                  {FAG.map(f=><option key={f}>{f}</option>)}
                </select>
              </FormField>
              <FormField label="Type" flex>
                <select className="saker-field-input" value={fields.type} onChange={e=>set('type', e.target.value)}>
                  {TYPE.map(t=><option key={t}>{t}</option>)}
                </select>
              </FormField>
              <FormField label="Prioritet" flex>
                <select className="saker-field-input" value={fields.prioritet} onChange={e=>set('prioritet', e.target.value)}>
                  {Object.entries(PRIO_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </FormField>
            </div>
          </div>

          {/* Høgre kolonne — vedlegg/utklipp */}
          <div style={{ flex:'1 1 42%', overflowY:'auto', padding:'22px 26px', display:'flex', flexDirection:'column' }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text3)', letterSpacing:'.03em',
              marginBottom:8, textTransform:'uppercase' }}>
              Vedlegg / tegningar / utklipp
            </label>
            <div
              onClick={()=>fileInputRef.current?.click()}
              onDragOver={e=>{ e.preventDefault(); setDragActive(true) }}
              onDragLeave={()=>setDragActive(false)}
              onDrop={e=>{ e.preventDefault(); setDragActive(false); handleFiles([...e.dataTransfer.files]) }}
              style={{ flex:1, minHeight:180, border:`2px dashed ${dragActive ? 'var(--brand2)' : 'var(--border)'}`,
                borderRadius:'var(--r2)', background: dragActive ? 'var(--brandbg)' : 'var(--bg3)',
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                gap:10, cursor:'pointer', transition:'all .15s', padding:20, textAlign:'center' }}>
              <span style={{ fontSize:30 }}>{'\u{1F4CE}'}</span>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text2)' }}>
                Dra og slepp PDF-ar eller bilete hit
              </div>
              <div style={{ fontSize:12, color:'var(--text3)' }}>
                {'eller klikk for \u00E5 velje filer \u2014 du kan ogs\u00E5 lime inn eit skjermutklipp (Ctrl+V) direkte i vindauget'}
              </div>
            </div>
            <input ref={fileInputRef} type="file" multiple style={{ display:'none' }}
              onChange={e => { handleFiles([...e.target.files]); e.target.value = '' }}/>

            {stagedFiles.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:12 }}>
                {stagedFiles.map((file, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px',
                    background:'var(--bg3)', borderRadius:'var(--r)', border:'1px solid var(--border)' }}>
                    <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 7px', borderRadius:5,
                      background:'var(--brandbg)', color:'var(--brand)', flexShrink:0 }}>
                      {file.type?.includes('image') ? 'BILETE' : file.type?.includes('pdf') ? 'PDF' : 'FIL'}
                    </span>
                    <span style={{ flex:1, fontSize:12.5, fontWeight:500, overflow:'hidden',
                      textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{file.name}</span>
                    <span style={{ fontSize:10.5, color:'var(--text3)' }}>{(file.size/1024).toFixed(0)} KB</span>
                    <button onClick={()=>removeStagedFile(i)}
                      style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer', padding:2 }}>
                      <span style={{ fontWeight:800, fontSize:13 }}>{'\u00D7'}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display:'flex', justifyContent:'flex-end', gap:10, padding:'16px 26px',
          borderTop:'1px solid var(--border)', flexShrink:0 }}>
          <button onClick={handleClose}
            style={{ padding:'9px 18px', borderRadius:'var(--r)', border:'1.5px solid var(--border)',
              background:'var(--bg2)', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:'var(--font)' }}>
            Lukk (utkast vert lagra)
          </button>
          <button onClick={handleCreate}
            style={{ padding:'9px 20px', borderRadius:'var(--r)', border:'none', background:'var(--brand)',
              color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'var(--font)' }}>
            Opprett sak
          </button>
        </div>
      </div>
    </div>
  )
}

function FormField({ label, flex, children }) {
  return (
    <div style={{ marginBottom:16, flex: flex ? 1 : undefined }}>
      <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text3)', letterSpacing:'.03em',
        marginBottom:5, textTransform:'uppercase' }}>{label}</label>
      {children}
    </div>
  )
}
