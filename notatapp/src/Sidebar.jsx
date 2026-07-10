import { useState, useRef } from 'react'

export default function Sidebar({ projects, notes, onSelectProject, onSelectNote,
                                   selectedProjectId, onDeleteProject, onNewNote,
                                   onToggleFavorite, onRenameProject, mode,
                                   offices, activeOfficeId, onSetOffice,
                                   onAddOffice, onUpdateOffice, onDeleteOffice }) {
  const [projsOpen, setProjsOpen] = useState(true)
  const [openProjs, setOpenProjs] = useState({})
  const [ctxMenu,   setCtxMenu]   = useState(null)
  const [renaming,  setRenaming]  = useState(null)  // projectId being renamed
  const renameRef = useRef(null)
  const [showNewOffice,  setShowNewOffice]  = useState(false)
  const [newOfficeName,  setNewOfficeName]  = useState('')
  const [newOfficeColor, setNewOfficeColor] = useState('#1B4332')

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
          onDoubleClick={e => {
            e.stopPropagation()
            setOpenProjs(prev => ({ ...prev, [p.id]: !prev[p.id] }))
          }}
          onContextMenu={e => { e.preventDefault(); e.stopPropagation()
            setCtxMenu({ x:e.clientX, y:e.clientY, projectId:p.id, name:p.name }) }}>

          <button onClick={e => toggleProjOpen(p.id, e)}
            style={{ background:'none', border:'none', color:'rgba(255,255,255,.45)',
              cursor:'pointer', padding:0, display:'flex', flexShrink:0 }}>
            <span style={{fontWeight:800,fontSize:10}}>{expanded ? '▾' : '▸'}</span>
          </button>

          <span style={{width:16,height:16,borderRadius:4,background:ac?'rgba(255,255,255,.25)':'rgba(255,255,255,.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:800,color:ac?'#fff':'rgba(255,255,255,.55)',flexShrink:0}}>P</span>

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
            <span style={{fontSize:13, color: p.favorite ? 'rgba(255,220,50,.95)' : 'rgba(255,255,255,.4)', fontWeight:800}}>★</span>
          </button>

          <button onClick={e => {
              e.stopPropagation()
              if (window.confirm(`Sikker på at du vil slette prosjektet «${p.name}»?\n\nNotata blir IKKJE sletta, men mister prosjekt-tilknytinga.`)) {
                onDeleteProject(p.id)
              }
            }}
            className="del-proj"
            title="Slett prosjekt"
            style={{ background:'none', border:'none', color:'rgba(255,255,255,.35)',
              padding:2, display:'flex', opacity:0, transition:'opacity .15s', flexShrink:0 }}>
            <span style={{fontSize:10,fontWeight:800}}>S</span>
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
                      <span style={{width:14,height:14,borderRadius:3,background:'rgba(255,255,255,.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:800,color:'rgba(255,255,255,.45)',flexShrink:0}}>N</span>
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

      {/* Logo + mode toggle */}
      <div style={{ padding:'18px 16px 14px', borderBottom:'1px solid rgba(255,255,255,.12)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <div style={{ width:32, height:32, borderRadius:9,
            background:'rgba(255,255,255,.15)', display:'flex', alignItems:'center',
            justifyContent:'center', fontSize:16, fontWeight:800, color:'#fff',
            flexShrink:0, border:'1.5px solid rgba(255,255,255,.25)' }}>N</div>
          <div>
            <div style={{ fontWeight:700, fontSize:16, color:'#fff', letterSpacing:'-0.02em' }}>Notatapp</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.55)', fontWeight:500 }}>
              {modeProjects.length} prosjekt · {notes.filter(n=>!n.done).length} aktive
            </div>
          </div>
        </div>

        {/* Office switcher */}
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {(offices || []).map(office => (
            <button key={office.id}
              onClick={() => { onSetOffice(office.id); onSelectProject(null) }}
              style={{ display:'flex', alignItems:'center', gap:9,
                padding:'8px 12px', border:'none', borderRadius:'var(--r)',
                background: activeOfficeId === office.id
                  ? 'rgba(255,255,255,.92)' : 'rgba(255,255,255,.1)',
                color: activeOfficeId === office.id ? office.color : 'rgba(255,255,255,.75)',
                fontSize:13, fontWeight:700, cursor:'pointer', transition:'all .15s',
                textAlign:'left' }}>
              <span style={{ width:12, height:12, borderRadius:'50%', background:office.color,
                flexShrink:0, border:'2px solid rgba(255,255,255,.4)' }}/>
              {office.name}
            </button>
          ))}
          {/* Add new office */}
          {showNewOffice ? (
            <div style={{ display:'flex', flexDirection:'column', gap:5, padding:'8px',
              background:'rgba(255,255,255,.1)', borderRadius:'var(--r)' }}>
              <input type="text" value={newOfficeName}
                onChange={e => setNewOfficeName(e.target.value)}
                placeholder="Namn på kontor"
                autoFocus
                style={{ padding:'5px 8px', borderRadius:5, border:'1px solid rgba(255,255,255,.3)',
                  background:'rgba(255,255,255,.15)', color:'#fff', fontSize:12,
                  fontFamily:'var(--font)', outline:'none' }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newOfficeName.trim()) {
                    onAddOffice(newOfficeName.trim(), newOfficeColor)
                      .then(o => { onSetOffice(o.id); setShowNewOffice(false); setNewOfficeName('') })
                  }
                  if (e.key === 'Escape') { setShowNewOffice(false); setNewOfficeName('') }
                }}/>
              <div style={{ display:'flex', gap:5, alignItems:'center' }}>
                {['#1B4332','#1A56A0','#C2570A','#5E35B1','#B91C1C'].map(c => (
                  <button key={c} onClick={() => setNewOfficeColor(c)}
                    style={{ width:18, height:18, borderRadius:'50%', background:c, border:'none',
                      cursor:'pointer', outline: newOfficeColor===c ? '2px solid #fff' : 'none',
                      outlineOffset:1 }}/>
                ))}
                <span style={{ fontSize:11, color:'rgba(255,255,255,.5)', marginLeft:4 }}>Farge</span>
              </div>
              <div style={{ display:'flex', gap:5 }}>
                <button onClick={() => {
                    if (newOfficeName.trim()) {
                      onAddOffice(newOfficeName.trim(), newOfficeColor)
                        .then(o => { onSetOffice(o.id); setShowNewOffice(false); setNewOfficeName('') })
                    }
                  }}
                  style={{ flex:1, padding:'5px', background:'rgba(255,255,255,.2)',
                    border:'none', borderRadius:5, color:'#fff', fontSize:12,
                    fontWeight:700, cursor:'pointer' }}>
                  Lagre
                </button>
                <button onClick={() => { setShowNewOffice(false); setNewOfficeName('') }}
                  style={{ padding:'5px 8px', background:'none', border:'none',
                    color:'rgba(255,255,255,.5)', fontSize:12, cursor:'pointer' }}>
                  Avbryt
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowNewOffice(true)}
              style={{ padding:'6px 12px', border:'1.5px dashed rgba(255,255,255,.25)',
                borderRadius:'var(--r)', background:'transparent',
                color:'rgba(255,255,255,.45)', fontSize:12, cursor:'pointer', textAlign:'left' }}>
              + Nytt kontor
            </button>
          )}
        </div>
      </div>

      {urgentCount > 0 && (
        <div style={{ margin:'0 12px 8px', padding:'6px 10px', borderRadius:'var(--r)',
          background:'rgba(255,255,255,.12)', border:'1px solid rgba(255,255,255,.2)',
          fontSize:11, color:'rgba(255,255,255,.85)', display:'flex', alignItems:'center', gap:6 }}>
          <span style={{width:16,height:16,borderRadius:8,background:'rgba(255,220,50,.25)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,flexShrink:0}}>!</span>{urgentCount} oppgåver med frist snart
        </div>
      )}

      {/* Project list */}
      <div style={{ flex:1, overflowY:'auto', borderTop:'1px solid rgba(255,255,255,.1)', paddingTop:4 }}>

        {favoriteProjects.length > 0 && (
          <div style={{ marginBottom:4 }}>
            <div style={{ padding:'5px 14px 3px', fontSize:10, fontWeight:700,
              color:'rgba(255,220,50,.7)', letterSpacing:'.08em', textTransform:'uppercase',
              display:'flex', alignItems:'center', gap:5 }}>
              <span style={{fontSize:11, color:'rgba(255,220,50,.85)', fontWeight:800}}>★</span>
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
          <span style={{fontWeight:800,fontSize:11}}>{projsOpen ? '▾' : '▸'}</span>
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
                    <span style={{width:14,height:14,borderRadius:3,background:'rgba(255,255,255,.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:800,color:'rgba(255,255,255,.35)',flexShrink:0}}>N</span>
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
            <button onClick={() => {
              if (window.confirm(`Sikker på at du vil slette prosjektet «${ctxMenu.name}»?\n\nNotata i prosjektet blir IKKJE sletta, men mister prosjekt-tilknytinga. Denne handlinga kan ikkje angrast.`)) {
                onDeleteProject(ctxMenu.projectId)
              }
              setCtxMenu(null)
            }}
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
