import { useState } from 'react'

export default function TopBar({ projects, activeProjectId, onSelectProject, onOpenSettings,
                                  offices = [], activeOfficeId, onSetOffice, onAddOffice }) {
  const active = projects.find(p => p.id === activeProjectId)
  const [showNewOffice,  setShowNewOffice]  = useState(false)
  const [newOfficeName,  setNewOfficeName]  = useState('')
  const [newOfficeColor, setNewOfficeColor] = useState('#1B4332')

  const lagreNyttKontor = () => {
    if (!newOfficeName.trim() || !onAddOffice) return
    onAddOffice(newOfficeName.trim(), newOfficeColor).then(o => {
      onSetOffice?.(o.id); setShowNewOffice(false); setNewOfficeName('')
    })
  }

  return (
    <div style={{
      height: 54, minHeight: 54, flexShrink: 0,
      display: 'flex', alignItems: 'center',
      background: '#0A0A0A',
      borderBottom: '1px solid rgba(255,255,255,.08)',
      userSelect: 'none',
      zIndex: 60,
    }}>

      {/* ── Logo-felt: same width as AppRail (52px), so it sits right above the module letters ── */}
      <div style={{
        width: 52, minWidth: 52, height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRight: '1px solid rgba(255,255,255,.08)',
      }} title="LiedLab">
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: 'rgba(255,255,255,.15)',
          border: '1.5px solid rgba(255,255,255,.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 900, color: '#fff',
          letterSpacing: '-1px',
          fontFamily: 'var(--font)',
        }}>
          LL
        </div>
      </div>

      {/* ── Wordmark ── */}
      <div style={{ marginLeft: 12, fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,.75)',
        letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
        LIEDLAB
      </div>

      <div style={{ width: 22 }}/>

      {/* ── Kontor-veljar ── */}
      {onSetOffice && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.4)',
            letterSpacing: '.03em', textTransform: 'uppercase' }}>
            Kontor
          </span>
          <select
            value={activeOfficeId || ''}
            onChange={e => {
              const v = e.target.value
              if (v === '__new__') { setShowNewOffice(true); return }
              onSetOffice(v ? Number(v) : null)
            }}
            style={{
              padding: '6px 10px', borderRadius: 6,
              border: '1.5px solid rgba(255,255,255,.22)',
              background: 'rgba(255,255,255,.06)',
              color: '#fff', fontSize: 13, fontWeight: 600,
              fontFamily: 'var(--font)', cursor: 'pointer',
              maxWidth: 180, outline: 'none',
            }}>
            {offices.map(o => (
              <option key={o.id} value={o.id} style={{ color: '#000' }}>{o.name}</option>
            ))}
            {onAddOffice && <option value="__new__" style={{ color: '#000' }}>＋ Nytt kontor…</option>}
          </select>

          {showNewOffice && (
            <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 70, minWidth: 220,
              display: 'flex', flexDirection: 'column', gap: 6, padding: 10,
              background: '#151515', border: '1.5px solid rgba(255,255,255,.18)',
              borderRadius: 'var(--r)', boxShadow: '0 10px 30px rgba(0,0,0,.4)' }}>
              <input autoFocus type="text" value={newOfficeName}
                onChange={e => setNewOfficeName(e.target.value)}
                placeholder="Namn på kontor"
                style={{ padding: '6px 8px', borderRadius: 5, border: '1px solid rgba(255,255,255,.25)',
                  background: 'rgba(255,255,255,.08)', color: '#fff', fontSize: 12,
                  fontFamily: 'var(--font)', outline: 'none' }}
                onKeyDown={e => {
                  if (e.key === 'Enter') lagreNyttKontor()
                  if (e.key === 'Escape') { setShowNewOffice(false); setNewOfficeName('') }
                }}/>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {['#1B4332', '#1A56A0', '#C2570A', '#5E35B1', '#B91C1C'].map(c => (
                  <button key={c} onClick={() => setNewOfficeColor(c)}
                    style={{ width: 16, height: 16, borderRadius: '50%', background: c, border: 'none',
                      cursor: 'pointer', outline: newOfficeColor === c ? '2px solid #fff' : 'none',
                      outlineOffset: 1 }}/>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                <button onClick={lagreNyttKontor}
                  style={{ flex: 1, padding: '5px', background: 'rgba(255,255,255,.18)', border: 'none',
                    borderRadius: 5, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  Lagre
                </button>
                <button onClick={() => { setShowNewOffice(false); setNewOfficeName('') }}
                  style={{ padding: '5px 8px', background: 'none', border: 'none',
                    color: 'rgba(255,255,255,.5)', fontSize: 12, cursor: 'pointer' }}>
                  Avbryt
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ width: 18 }}/>

      {/* ── Aktivt prosjekt-veljar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.4)',
          letterSpacing: '.03em', textTransform: 'uppercase' }}>
          Prosjekt
        </span>
        <select
          value={activeProjectId || ''}
          onChange={e => onSelectProject(e.target.value ? Number(e.target.value) : null)}
          style={{
            padding: '6px 10px', borderRadius: 6,
            border: '1.5px solid rgba(255,255,255,.22)',
            background: active ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.06)',
            color: '#fff', fontSize: 13, fontWeight: 600,
            fontFamily: 'var(--font)', cursor: 'pointer',
            maxWidth: 320, outline: 'none',
          }}>
          <option value="" style={{ color: '#000' }}>— Alle prosjekt —</option>
          {projects.map(p => (
            <option key={p.id} value={p.id} style={{ color: '#000' }}>
              {p.projectNumber ? `${p.projectNumber} — ${p.name}` : p.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ flex: 1 }}/>

      {/* ── Innstillingar ── */}
      <button
        onClick={onOpenSettings}
        title="Innstillingar"
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.1)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        style={{
          width: 34, height: 34, borderRadius: 8,
          background: 'transparent',
          border: '1.5px solid rgba(255,255,255,.16)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 3.5, cursor: 'pointer',
          transition: 'background .15s',
          padding: 0, marginRight: 16, flexShrink: 0,
        }}>
        <span style={{ display:'block', width:15, height:1.5, background:'rgba(255,255,255,.55)', borderRadius:1 }}/>
        <span style={{ display:'block', width:15, height:1.5, background:'rgba(255,255,255,.55)', borderRadius:1 }}/>
        <span style={{ display:'block', width:15, height:1.5, background:'rgba(255,255,255,.55)', borderRadius:1 }}/>
      </button>
    </div>
  )
}
