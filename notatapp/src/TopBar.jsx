export default function TopBar({ projects, activeProjectId, onSelectProject, onOpenSettings }) {
  const active = projects.find(p => p.id === activeProjectId)

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
