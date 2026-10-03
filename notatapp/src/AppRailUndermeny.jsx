import { UNDERMODULAR } from './AppRail'

// ═══════════════════════════════════════════════════════════════════
//  AppRailUndermeny — «venstrebar nr. 2», til høgre for den vanlege
//  AppRail (rail 1). Vist BERRE når det aktive topp-nivå-ikonet er ein
//  paraply (Admin/Gjeremål, sjå UNDERMODULAR i AppRail.jsx) — reint
//  tilleggsnivå, ingen eigne `activeModule`-verdiar (born-nøklane er dei
//  SAME, uendra modul-verdiane som før paraply-strukturen fanst).
// ═══════════════════════════════════════════════════════════════════
export default function AppRailUndermeny({ toppNokkel, activeModule, onModuleChange }) {
  const born = UNDERMODULAR[toppNokkel]
  if (!born) return null

  return (
    <div style={{
      width: 132, minWidth: 132, flexShrink: 0,
      display: 'flex', flexDirection: 'column', gap: 3,
      background: '#111214',
      borderRight: '1px solid rgba(255,255,255,.08)',
      paddingTop: 14, paddingLeft: 6, paddingRight: 6,
      userSelect: 'none',
    }}>
      {born.map(b => {
        const active = activeModule === b.key
        return (
          <button key={b.key} onClick={() => onModuleChange(b.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
              borderRadius: 8, border: 'none',
              background: active ? 'rgba(255,255,255,.14)' : 'transparent',
              color: active ? '#fff' : 'rgba(255,255,255,.6)',
              fontSize: 12.5, fontWeight: active ? 700 : 500, cursor: 'pointer',
              textAlign: 'left', fontFamily: 'var(--font)', transition: 'background .15s, color .15s',
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,.07)' }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
            <span style={{ width: 20, height: 20, borderRadius: 5, background: b.color, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: b.letter.length > 1 ? 8.5 : 10.5, fontWeight: 800, color: '#111' }}>
              {b.letter}
            </span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.label}</span>
          </button>
        )
      })}
    </div>
  )
}
