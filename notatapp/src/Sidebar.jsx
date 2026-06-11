import { useState, useRef } from 'react'
import { ChevronDown, ChevronRight, FolderOpen, Trash2, AlertCircle,
         FileText, Plus, Star, Briefcase, Home, Pencil } from 'lucide-react'

export default function Sidebar({ projects, notes, onSelectProject, onSelectNote,
                                   selectedProjectId, onDeleteProject, onNewNote,
                                   onToggleFavorite, onRenameProject, mode }) {
  const [projsOpen, setProjsOpen] = useState(true)
  const [openProjs, setOpenProjs] = useState({})
  const [ctxMenu,   setCtxMenu]   = useState(null)
  const [renaming,  setRenaming]  = useState(null)  // projectId being renamed
  const renameRef = useRef(null)

  const modeProjects = projects.filter(p => (p.type || 'work') === mode)
  const notesFor     = id => notes.filter(n => n.projectId === id && !n.done)
  const unprojected  = notes.filter(n => !n.projectId && !n.done)

  const urgentCount = notes.filter(n => {
    if (n.done) return false
    return (n.tasks || []).some(t => {
      if (t.done || !t.date) return false
      const d = (new Date(t.date) - new Date()) / 86400000
      return d <= 2 && d >= -1
    })
  }).length

  const toggleProjOpen = (id, e) => {
    e.stopPropagation()
    setOpenProjs(p => ({ ...p, [id]: !p[id] }))
  }

  const sortedProjects = [...modeProjects].sort((a, b) => {
    if (a.favorite && !b.favorite) return -1
    if (!a.favorite && b.favorite) return 1
    return a.name.localeCompare(b.name)
  })
  const favoriteProjects = sortedProjects.filter(p => p.favorite)
  const normalProjects   = sortedProjects.filter(p => !p.favorite)

  const startRename = (id, currentName) => {
    setCtxMenu(null)
    setRenaming(id)
    setTimeout(() => {
      if (renameRef.current) {
        renameRef.current.value = currentName
        renameRef.current.focus()
        renameRef.current.select()
      }
    }, 30)
  }

  const commitRename = (id) => {
    const val = renameRef.current?.value?.trim()
    if (val && onRenameProject) onRenameProject(id, val)
    setRenaming(null)
  }

  const ProjItem = ({ p }) => {
    const pNotes    = notesFor(p.id)
    const ac        = selectedProjectId === p.id
    const expanded  = openProjs[p.id]
    const openTasks = pNotes.reduce((s, n) => s + (n.tasks || []).filter(t => !t.done).length, 0)

    return (
      <div>
        <div className="proj-row"
          style={{ display:'flex', alignItems:'center', gap:5,
            padding:'5px 10px 5px 18px',
            background: ac ? 'rgba(255,255,255,.15)' : 'transparent',
            borderLeft: `3px solid ${ac ? 'rgba(255,255,255,.85)' : 'transparent'}`,
            cursor:'pointer' }}
          onClick={() => onSelectProject(ac ? null : p.id)}
          onContextMenu={e => { e.preventDefault(); e.stopPropagation()
            setCtxMenu({ x:e.clientX, y:e.clientY, projectId:p.id, name:p.name }) }}>

          <button onClick={e => toggleProjOpen(p.id, e)}
            style={{ background:'none', border:'none', color:'rgba(255,255,255,.45)',
              cursor:'pointer', padding:0, display:'flex', flexShrink:0 }}>
            {expanded ? <ChevronDown size={10}/> : <ChevronRight size={10}/>}
          </button>

          <FolderOpen size={11} color={ac ? '#fff' : 'rgba(255,255,255,.55)'}/>

          {renaming === p.id ? (
            <input ref={renameRef}
              defaultValue={p.name}
              onClick={e => e.stopPropagation()}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename(p.id)
                if (e.key === 'Escape') setRenaming(null)
              }}
              onBlur={() => commitRename(p.id)}
              style={{ flex:1, fontSize:12, background:'rgba(255,255,255,.15)',
                border:'1px solid rgba(255,255,255,.4)', borderRadius:4,
                color:'#fff', padding:'1px 5px', outline:'none', fontFamily:'var(--font)' }}/>
          ) : (
            <span style={{ flex:1, fontSize:12, color: ac ? '#fff' : 'rgba(255,255,255,.8)',
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
              fontWeight: ac ? 700 : 400 }}>
              {p.name}
            </span>
          )}

          {openTasks > 0 && (
            <span style={{ fontSize:10, background:'rgba(255,255,255,.2)',
              color:'#fff', borderRadius:10, padding:'1px 6px', fontWeight:700 }}>
              {openTasks}
            </span>
          )}

          <button onClick={e => { e.stopPropagation(); onToggleFavorite && onToggleFavorite(p.id) }}
            className="fav-btn" title={p.favorite ? 'Fjern favoritt' : 'Favoritt'}
            style={{ background:'none', border:'none', cursor:'pointer', padding:'1px 2px',
              display:'flex', flexShrink:0, opacity: p.favorite ? 1 : 0, transition:'opacity .15s' }}>
            <Star size={11} fill={p.favorite ? 'rgba(255,220,50,.9)' : 'none'}
              color={p.favorite ? 'rgba(255,220,50,.9)' : 'rgba(255,255,255,.5)'}/>
          </button>

          <button onClick={e => { e.stopPropagation(); onDeleteProject(p.id) }}
            className="del-proj"
            style={{ background:'none', border:'none', color:'rgba(255,255,255,.35)',
              padding:2, display:'flex', opacity:0, transition:'opacity .15s', flexShrink:0 }}>
            <Trash2 size={10}/>
          </button>
        </div>

        {expanded && (
          <div style={{ paddingLeft:34, paddingBottom:4 }}>
            {pNotes.length === 0
              ? <div style={{ fontSize:11, color:'rgba(255,255,255,.3)', padding:'2px 0' }}>Ingen notatar</div>
              : pNotes.map(n => {
                  const ot = (n.tasks||[]).filter(t=>!t.done).length
                  return (
                    <div key={n.id} className="note-link"
                      onClick={() => onSelectNote && onSelectNote(n.id)}
                      style={{ display:'flex', alignItems:'center', gap:5,
                        padding:'3px 6px', borderRadius:5, cursor:'pointer', marginBottom:1 }}>
                      <FileText size={10} color="rgba(255,255,255,.38)" style={{ flexShrink:0 }}/>
                      <span style={{ flex:1, fontSize:11, color:'rgba(255,255,255,.65)',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {n.isMeeting ? '📋 ' : ''}{n.title || n.text?.substring(0,40) || 'Utan tittel'}
                      </span>
                      {ot > 0 && <span style={{ fontSize:10, color:'rgba(255,255,255,.45)', fontWeight:600 }}>{ot}</span>}
                    </div>
                  )
                })
            }
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="sidebar-brand" style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <style>{`
        .proj-row:hover .del-proj  { opacity:1 !important }
        .proj-row:hover .fav-btn   { opacity:1 !important }
        .note-link:hover           { background:rgba(255,255,255,.1) }
      `}</style>

      {/* Logo */}
      <div style={{ padding:'18px 16px 14px', borderBottom:'1px solid rgba(255,255,255,.12)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:9,
            background:'rgba(255,255,255,.15)', display:'flex', alignItems:'center',
            justifyContent:'center', fontSize:16, fontWeight:800, color:'#fff',
            flexShrink:0, border:'1.5px solid rgba(255,255,255,.25)' }}>N</div>
          <div>
            <div style={{ fontWeight:700, fontSize:15, color:'#fff', letterSpacing:'-0.02em' }}>Notatapp</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,.45)', fontWeight:500 }}>
              {modeProjects.length} prosjekt · {notes.filter(n=>!n.done).length} aktive
            </div>
          </div>
        </div>
      </div>

      {/* New note */}
      <div style={{ padding:'12px 12px 8px' }}>
        <button onClick={onNewNote}
          style={{ width:'100%', padding:'9px 12px', background:'rgba(255,255,255,.15)',
            border:'1.5px solid rgba(255,255,255,.25)', borderRadius:'var(--r2)',
            color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer',
            display:'flex', alignItems:'center', gap:8, transition:'all .15s' }}
          onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.25)'}
          onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,.15)'}>
          <Plus size={15}/> Nytt notat
        </button>
      </div>

      {urgentCount > 0 && (
        <div style={{ margin:'0 12px 8px', padding:'6px 10px', borderRadius:'var(--r)',
          background:'rgba(255,255,255,.12)', border:'1px solid rgba(255,255,255,.2)',
          fontSize:11, color:'rgba(255,255,255,.85)', display:'flex', alignItems:'center', gap:6 }}>
          <AlertCircle size={12}/>{urgentCount} oppgåver med frist snart
        </div>
      )}

      {/* Project list */}
      <div style={{ flex:1, overflowY:'auto', borderTop:'1px solid rgba(255,255,255,.1)', paddingTop:4 }}>

        {favoriteProjects.length > 0 && (
          <div style={{ marginBottom:4 }}>
            <div style={{ padding:'5px 14px 3px', fontSize:10, fontWeight:700,
              color:'rgba(255,220,50,.7)', letterSpacing:'.08em', textTransform:'uppercase',
              display:'flex', alignItems:'center', gap:5 }}>
              <Star size={9} fill="rgba(255,220,50,.7)" color="rgba(255,220,50,.7)"/>
              Favoritt
            </div>
            {favoriteProjects.map(p => <ProjItem key={p.id} p={p}/>)}
            <div style={{ height:1, background:'rgba(255,255,255,.1)', margin:'6px 12px 4px' }}/>
          </div>
        )}

        <button onClick={() => setProjsOpen(v=>!v)}
          style={{ width:'100%', display:'flex', alignItems:'center', gap:7,
            padding:'5px 14px', background:'none', border:'none',
            color:'rgba(255,255,255,.5)', fontSize:10, fontWeight:700,
            letterSpacing:'.1em', textTransform:'uppercase', cursor:'pointer' }}>
          {projsOpen ? <ChevronDown size={11}/> : <ChevronRight size={11}/>}
          {mode === 'work' ? 'Jobb-prosjekt' : 'Private prosjekt'}
          <span style={{ marginLeft:'auto', fontSize:10, opacity:.5 }}>{modeProjects.length}</span>
        </button>

        {projsOpen && (
          <>
            {modeProjects.length === 0 && (
              <div style={{ padding:'3px 22px 8px', color:'rgba(255,255,255,.3)', fontSize:11 }}>
                Ingen prosjekt enno
              </div>
            )}
            {sortedProjects.map(p => <ProjItem key={p.id} p={p}/>)}

            {unprojected.length > 0 && (
              <div style={{ marginTop:4 }}>
                <div style={{ padding:'4px 18px', fontSize:10, color:'rgba(255,255,255,.3)',
                  fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase' }}>
                  Utan prosjekt
                </div>
                {unprojected.map(n => (
                  <div key={n.id} className="note-link"
                    onClick={() => onSelectNote && onSelectNote(n.id)}
                    style={{ display:'flex', alignItems:'center', gap:5,
                      padding:'3px 10px 3px 22px', borderRadius:5, cursor:'pointer', marginBottom:1 }}>
                    <FileText size={10} color="rgba(255,255,255,.3)" style={{ flexShrink:0 }}/>
                    <span style={{ flex:1, fontSize:11, color:'rgba(255,255,255,.5)',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {n.title || n.text?.substring(0,40) || 'Utan tittel'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ padding:'8px 13px', borderTop:'1px solid rgba(255,255,255,.1)',
        fontSize:11, color:'rgba(255,255,255,.3)' }}>
        {notes.filter(n=>!n.done).length} aktive notatar
      </div>

      {/* Project context menu */}
      {ctxMenu && (
        <>
          <div onClick={() => setCtxMenu(null)} style={{ position:'fixed', inset:0, zIndex:200 }}/>
          <div style={{ position:'fixed', left:ctxMenu.x, top:ctxMenu.y, zIndex:201,
            background:'var(--bg2)', border:'1.5px solid var(--brand3)',
            borderRadius:'var(--r2)', padding:'4px 0',
            boxShadow:'0 8px 24px rgba(0,0,0,.18)', minWidth:210 }}>
            <div style={{ padding:'4px 12px 6px', fontSize:11, fontWeight:700,
              color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.06em',
              borderBottom:'1px solid var(--border)', marginBottom:4 }}>
              📁 {ctxMenu.name}
            </div>
            {[
              { label:'📝 Nytt notat', action:'new-note' },
              { label:'📋 Nytt møtenotat', action:'new-meeting' },
              { label:'✏️ Endre namn', action:'rename' },
            ].map(item => (
              <button key={item.action}
                onClick={() => {
                  if (item.action === 'rename') { startRename(ctxMenu.projectId, ctxMenu.name) }
                  else {
                    window.dispatchEvent(new CustomEvent('sidebar-ctx', {
                      detail:{ action:item.action, projectId:ctxMenu.projectId }
                    }))
                    setCtxMenu(null)
                  }
                }}
                style={{ width:'100%', textAlign:'left', padding:'8px 14px',
                  background:'none', border:'none', cursor:'pointer',
                  fontSize:13, color:'var(--text)', fontFamily:'var(--font)', display:'block' }}
                onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                onMouseLeave={e=>e.currentTarget.style.background='none'}>
                {item.label}
              </button>
            ))}
            <div style={{ height:1, background:'var(--border)', margin:'4px 0' }}/>
            <button onClick={() => { onDeleteProject(ctxMenu.projectId); setCtxMenu(null) }}
              style={{ width:'100%', textAlign:'left', padding:'8px 14px',
                background:'none', border:'none', cursor:'pointer',
                fontSize:13, color:'var(--danger)', fontFamily:'var(--font)', display:'block' }}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(185,28,28,.06)'}
              onMouseLeave={e=>e.currentTarget.style.background='none'}>
              🗑 Slett prosjekt
            </button>
          </div>
        </>
      )}
    </div>
  )
}
