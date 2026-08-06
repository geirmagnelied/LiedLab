import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

const STATUSES = ['Ny', 'Pågår', 'Venter', 'Lukka']
const STATUS_COLORS = {
  'Ny':     { bg: 'rgba(21,101,192,.12)',  fg: '#1565C0' },
  'Pågår':  { bg: 'rgba(180,83,9,.12)',    fg: '#B45309' },
  'Venter': { bg: 'rgba(94,53,177,.12)',   fg: '#5E35B1' },
  'Lukka':  { bg: 'rgba(22,101,52,.12)',   fg: '#166534' },
}

function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return `${dt.getDate()}.${dt.getMonth()+1}.${dt.getFullYear()}`
}

// ── Popup for å redigere / opprette ei sak ────────────────────────────────
function CaseModal({ caseData, onSave, onDelete, onClose, userId }) {
  const [title,     setTitle]     = useState(caseData.title || '')
  const [resp,      setResp]      = useState(caseData.responsible || '')
  const [coResp,    setCoResp]    = useState(caseData.co_responsible || '')
  const [deadline,  setDeadline]  = useState(caseData.deadline || '')
  const [status,    setStatus]    = useState(caseData.status || 'Ny')
  const [solution,  setSolution]  = useState(caseData.solution || '')
  const [atts,      setAtts]      = useState(caseData.attachments || [])
  const [dragOver,  setDragOver]  = useState(false)
  const [uploading, setUploading] = useState(false)
  const [err,       setErr]       = useState(null)
  const modalRef = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const uploadFiles = async (files) => {
    setUploading(true); setErr(null)
    const added = []
    for (const file of files) {
      try {
        const path = `${userId}/saker/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const { error } = await supabase.storage.from('Vedlegg').upload(path, file)
        if (error) throw error
        const { data } = supabase.storage.from('Vedlegg').getPublicUrl(path)
        added.push({ name: file.name, url: data.publicUrl, type: file.type, size: file.size })
      } catch (e) {
        setErr(`Opplasting feila for ${file.name}: ${e.message || e}`)
      }
    }
    if (added.length) setAtts(prev => [...prev, ...added])
    setUploading(false)
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    const files = Array.from(e.dataTransfer.files || [])
    if (files.length) uploadFiles(files)
  }

  const save = () => {
    if (!title.trim()) { setErr('Saka må ha ein tittel'); return }
    onSave({
      ...caseData,
      title: title.trim(),
      responsible: resp.trim(),
      co_responsible: coResp.trim(),
      deadline: deadline || null,
      status,
      solution: solution.trim(),
      attachments: atts,
    })
  }

  const fi = { width:'100%', padding:'8px 11px', border:'1.5px solid var(--border)',
    borderRadius:'var(--r)', fontSize:14, fontFamily:'var(--font)',
    background:'var(--bg)', color:'var(--text)', outline:'none' }
  const lbl = { fontSize:11, fontWeight:700, color:'var(--text3)',
    textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4, display:'block' }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:950, background:'rgba(0,0,0,.4)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={modalRef}
        style={{ width:'100%', maxWidth:620, maxHeight:'90vh', overflowY:'auto',
          background:'var(--bg2)', borderRadius:'var(--r2)', boxShadow:'var(--shadow-lg)' }}>

        {/* Header */}
        <div style={{ background:'var(--brand)', padding:'16px 22px',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          position:'sticky', top:0, zIndex:2 }}>
          <div style={{ fontSize:16, fontWeight:800, color:'#fff' }}>
            {caseData.case_number ? `Sak ${caseData.case_number}` : 'Ny sak'}
          </div>
          <button onClick={onClose}
            style={{ background:'rgba(255,255,255,.15)', border:'none', borderRadius:6,
              color:'#fff', fontSize:18, fontWeight:700, cursor:'pointer',
              width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
        </div>

        <div style={{ padding:'20px 22px', display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={lbl}>Sak</label>
            <input style={fi} value={title} autoFocus
              onChange={e => setTitle(e.target.value)}
              placeholder="Kva gjeld saka?"/>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={lbl}>Ansvarleg</label>
              <input style={fi} value={resp} onChange={e => setResp(e.target.value)}
                placeholder="Namn"/>
            </div>
            <div>
              <label style={lbl}>Medansvarleg</label>
              <input style={fi} value={coResp} onChange={e => setCoResp(e.target.value)}
                placeholder="Namn"/>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={lbl}>Frist</label>
              <input style={fi} type="date" value={deadline || ''}
                onChange={e => setDeadline(e.target.value)}/>
            </div>
            <div>
              <label style={lbl}>Status</label>
              <select style={{ ...fi, cursor:'pointer' }} value={status}
                onChange={e => setStatus(e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={lbl}>Løysing</label>
            <textarea style={{ ...fi, minHeight:80, resize:'vertical' }}
              value={solution} onChange={e => setSolution(e.target.value)}
              placeholder="Korleis vart / blir saka løyst?"/>
          </div>

          {/* Vedlegg */}
          <div>
            <label style={lbl}>Vedlegg {uploading && '· lastar opp…'}</label>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{ border:`2px dashed ${dragOver ? 'var(--brand3)' : 'var(--border)'}`,
                borderRadius:'var(--r)', padding:'14px', textAlign:'center',
                background: dragOver ? 'var(--brandbg)' : 'var(--bg)',
                transition:'all .15s', marginBottom: atts.length ? 8 : 0 }}>
              <div style={{ fontSize:13, color:'var(--text3)' }}>
                Slepp PDF eller andre filer her
              </div>
              <input type="file" multiple id="case-file-input"
                style={{ display:'none' }}
                onChange={e => {
                  const files = Array.from(e.target.files || [])
                  if (files.length) uploadFiles(files)
                  e.target.value = ''
                }}/>
              <button onClick={() => document.getElementById('case-file-input')?.click()}
                style={{ marginTop:6, padding:'5px 14px', background:'var(--bg3)',
                  border:'1px solid var(--border)', borderRadius:'var(--r)',
                  color:'var(--text2)', fontSize:12, cursor:'pointer' }}>
                …eller vel filer
              </button>
            </div>
            {atts.map((a, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8,
                padding:'6px 10px', background:'var(--bg)', borderRadius:'var(--r)',
                border:'1px solid var(--border)', marginBottom:4 }}>
                <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:5,
                  background:'var(--brandbg)', color:'var(--brand)', flexShrink:0 }}>
                  {a.type?.includes('pdf') ? 'PDF' : 'Fil'}
                </span>
                <a href={a.url} target="_blank" rel="noreferrer"
                  style={{ flex:1, fontSize:13, color:'var(--brand)', fontWeight:500,
                    textDecoration:'none', overflow:'hidden', textOverflow:'ellipsis',
                    whiteSpace:'nowrap' }}>
                  {a.name}
                </a>
                <button onClick={() => setAtts(prev => prev.filter((_, j) => j !== i))}
                  style={{ background:'none', border:'none', color:'var(--text3)',
                    cursor:'pointer', fontWeight:800, fontSize:14, lineHeight:1 }}
                  onMouseEnter={e=>e.currentTarget.style.color='var(--danger)'}
                  onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}>×</button>
              </div>
            ))}
          </div>

          {err && <div style={{ fontSize:13, color:'var(--danger)', fontWeight:600 }}>{err}</div>}

          {/* Actions */}
          <div style={{ display:'flex', gap:10, justifyContent:'space-between',
            borderTop:'1px solid var(--border)', paddingTop:14 }}>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={save} disabled={uploading}
                style={{ padding:'9px 22px', background:'var(--brand)', border:'none',
                  borderRadius:'var(--r)', color:'#fff', fontSize:13, fontWeight:700,
                  cursor:'pointer', opacity: uploading ? 0.7 : 1 }}>
                Lagre sak
              </button>
              <button onClick={onClose}
                style={{ padding:'9px 16px', background:'var(--bg3)',
                  border:'1px solid var(--border)', borderRadius:'var(--r)',
                  color:'var(--text2)', fontSize:13, cursor:'pointer' }}>
                Avbryt
              </button>
            </div>
            <div>
              {caseData.id && (
                <button onClick={() => {
                    if (window.confirm(`Slette sak ${caseData.case_number}?`)) onDelete(caseData.id)
                  }}
                  style={{ padding:'9px 16px', background:'none',
                    border:'1.5px solid var(--border)', borderRadius:'var(--r)',
                    color:'var(--danger)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                  Slett sak
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sjølve sakstabellen ───────────────────────────────────────────────────
export default function CaseTable({ noteId, projectId, userId }) {
  const [cases,    setCases]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(null)   // null | caseData
  const [errorMsg, setErrorMsg] = useState(null)

  // Load: all cases for this note (a referat shows the cases created in it)
  useEffect(() => {
    if (!userId || !noteId) return
    let cancelled = false
    setLoading(true)
    supabase.from('project_cases')
      .select('*')
      .eq('user_id', userId)
      .eq('note_id', noteId)
      .order('case_number', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setErrorMsg(`Feil ved lasting av saker: ${error.message}`)
        else setCases(data || [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [noteId, userId])

  const nextCaseNumber = async () => {
    // Sequential per project; fallback to per note when no project
    let q = supabase.from('project_cases')
      .select('case_number')
      .eq('user_id', userId)
      .order('case_number', { ascending: false })
      .limit(1)
    q = projectId ? q.eq('project_id', projectId) : q.eq('note_id', noteId)
    const { data } = await q
    return ((data && data[0]?.case_number) || 0) + 1
  }

  const saveCase = async (c) => {
    setErrorMsg(null)
    try {
      if (c.id) {
        const { error } = await supabase.from('project_cases')
          .update({
            title: c.title, responsible: c.responsible, co_responsible: c.co_responsible,
            deadline: c.deadline, status: c.status, solution: c.solution,
            attachments: c.attachments, updated_at: new Date().toISOString(),
          })
          .eq('id', c.id).eq('user_id', userId)
        if (error) throw error
        setCases(prev => prev.map(x => x.id === c.id ? { ...x, ...c } : x))
      } else {
        const caseNumber = await nextCaseNumber()
        const row = {
          user_id: userId,
          project_id: projectId || null,
          note_id: noteId,
          case_number: caseNumber,
          title: c.title, responsible: c.responsible, co_responsible: c.co_responsible,
          deadline: c.deadline, status: c.status, solution: c.solution,
          attachments: c.attachments, sort_order: cases.length,
          created_at: new Date().toISOString(),
        }
        const { data: inserted, error } = await supabase.from('project_cases').insert(row).select()
        if (error) throw error
        setCases(prev => [...prev, inserted && inserted[0] ? inserted[0] : { ...row, id: Date.now() }])
      }
      setModal(null)
    } catch (err) {
      setErrorMsg(`Lagring feila: ${err.message || err}`)
    }
  }

  const deleteCase = async (id) => {
    await supabase.from('project_cases').delete().eq('id', id).eq('user_id', userId)
    setCases(prev => prev.filter(c => c.id !== id))
    setModal(null)
  }

  const th = { padding:'9px 10px', fontSize:11, fontWeight:700, color:'var(--text3)',
    textTransform:'uppercase', letterSpacing:'.04em', textAlign:'left',
    borderBottom:'2px solid var(--border)', background:'var(--bg3)',
    whiteSpace:'nowrap' }
  const td = { padding:'9px 10px', fontSize:13, color:'var(--text)',
    borderBottom:'1px solid var(--border)', verticalAlign:'top' }

  return (
    <div style={{ marginTop:4 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
        <button onClick={() => setModal({ status:'Ny', attachments:[] })}
          style={{ padding:'7px 16px', background:'var(--brand)', border:'none',
            borderRadius:'var(--r)', color:'#fff', fontSize:12, fontWeight:700,
            cursor:'pointer' }}>
          + Ny sak
        </button>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--text3)',
          textTransform:'uppercase', letterSpacing:'.06em' }}>
          Saksliste {cases.length > 0 && `(${cases.length})`}
        </div>
      </div>

      {errorMsg && (
        <div style={{ background:'rgba(185,28,28,.08)', border:'1.5px solid var(--danger)',
          borderRadius:'var(--r)', padding:'10px 14px', marginBottom:10,
          fontSize:13, color:'var(--danger)', fontWeight:600 }}>
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div style={{ color:'var(--text3)', fontSize:13, padding:'12px 0' }}>Lastar saker…</div>
      ) : cases.length === 0 ? (
        <div style={{ border:'1.5px dashed var(--border)', borderRadius:'var(--r2)',
          padding:'22px', textAlign:'center', color:'var(--text3)', fontSize:13 }}>
          Ingen saker enno — trykk «+ Ny sak» for å starte sakslista
        </div>
      ) : (
        <div style={{ overflowX:'auto', border:'1px solid var(--border)',
          borderRadius:'var(--r2)', background:'var(--bg2)' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:760 }}>
            <thead>
              <tr>
                <th style={{ ...th, width:46 }}>Nr</th>
                <th style={th}>Sak</th>
                <th style={{ ...th, width:110 }}>Ansvarleg</th>
                <th style={{ ...th, width:110 }}>Medansv.</th>
                <th style={{ ...th, width:86 }}>Frist</th>
                <th style={{ ...th, width:78 }}>Status</th>
                <th style={th}>Løysing</th>
              </tr>
            </thead>
            <tbody>
              {cases.map(c => {
                const sc = STATUS_COLORS[c.status] || STATUS_COLORS['Ny']
                return (
                  <tr key={c.id} onClick={() => setModal(c)}
                    style={{ cursor:'pointer', transition:'background .1s' }}
                    onMouseEnter={e => e.currentTarget.style.background='var(--bg3)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <td style={{ ...td, fontFamily:'var(--mono)', fontWeight:700,
                      color:'var(--brand)' }}>{c.case_number}</td>
                    <td style={{ ...td, fontWeight:600 }}>
                      {c.title}
                      {(c.attachments?.length > 0) && (
                        <span style={{ marginLeft:6, fontSize:11, fontWeight:700,
                          padding:'1px 6px', borderRadius:8,
                          background:'var(--brandbg)', color:'var(--brand)' }}>
                          {c.attachments.length} vedl.
                        </span>
                      )}
                    </td>
                    <td style={td}>{c.responsible}</td>
                    <td style={td}>{c.co_responsible}</td>
                    <td style={{ ...td, fontFamily:'var(--mono)', fontSize:12,
                      whiteSpace:'nowrap' }}>{fmtDate(c.deadline)}</td>
                    <td style={td}>
                      <span style={{ fontSize:11, fontWeight:700, padding:'2px 9px',
                        borderRadius:10, background:sc.bg, color:sc.fg,
                        whiteSpace:'nowrap' }}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ ...td, color:'var(--text2)', fontSize:12,
                      maxWidth:220, overflow:'hidden', textOverflow:'ellipsis',
                      whiteSpace:'nowrap' }}>{c.solution}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <CaseModal caseData={modal} userId={userId}
          onSave={saveCase} onDelete={deleteCase} onClose={() => setModal(null)}/>
      )}
    </div>
  )
}
