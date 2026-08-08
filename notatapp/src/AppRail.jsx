import { useState } from 'react'

const MODULES = [
  { key: 'notatar',  letter: 'N',  label: 'Notatar',        color: '#52B788' },
  { key: 'prosjekt', letter: 'P',  label: 'Prosjekt',       color: '#85B7EB' },
  { key: 'kunde',    letter: 'K',  label: 'Kunde',          color: '#D4537E' },
  { key: 'oppgaver', letter: 'O',  label: 'Oppg\u00E5ver',  color: '#4EADA3' },
  { key: 'saker',    letter: 'S',  label: 'Saker',          color: '#E07A5F' },
  { key: 'timar',    letter: 'T',  label: 'Timar',          color: '#60A5D4' },
  { key: 'kvalitet', letter: 'KS', label: 'Kvalitetssystem', color: '#EC9A5A' },
  { key: 'farge',    letter: 'F',  label: 'Farge',          color: '#C084B6' },
]

export default function AppRail({ activeModule, onModuleChange }) {
  const [hoveredModule, setHoveredModule] = useState(null)

  return (
    <div style={{
      width: 52, minWidth: 52, flexShrink: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: '#0A0A0A',
      borderRight: '1px solid rgba(255,255,255,.08)',
      paddingTop: 12, paddingBottom: 10,
      userSelect: 'none',
      zIndex: 50,
    }}>

      {/* ── Module buttons ── */}
      {MODULES.map(mod => {
        const active = activeModule === mod.key
        const hovered = hoveredModule === mod.key

        return (
          <div key={mod.key} style={{ position: 'relative', marginBottom: 6 }}>
            <button
              onClick={() => onModuleChange(mod.key)}
              onMouseEnter={() => setHoveredModule(mod.key)}
              onMouseLeave={() => setHoveredModule(null)}
              title={mod.label}
              style={{
                width: 38, height: 38, borderRadius: 10,
                border: active
                  ? '2px solid rgba(255,255,255,.55)'
                  : '1.5px solid transparent',
                background: active
                  ? 'rgba(255,255,255,.18)'
                  : hovered
                    ? 'rgba(255,255,255,.08)'
                    : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all .15s ease',
                position: 'relative',
                padding: 0,
              }}>

              {/* Active indicator bar (left edge) */}
              {active && (
                <div style={{
                  position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)',
                  width: 3, height: 20, borderRadius: 2,
                  background: mod.color,
                }}/>
              )}

              <span style={{
                fontSize: mod.letter.length > 1 ? 13 : 18, fontWeight: 800,
                color: active ? '#fff' : 'rgba(255,255,255,.7)',
                fontFamily: 'var(--font)',
                letterSpacing: mod.letter.length > 1 ? '-0.5px' : '0',
                transition: 'color .15s',
              }}>
                {mod.letter}
              </span>
            </button>

            {/* Tooltip */}
            {hovered && !active && (
              <div style={{
                position: 'absolute', left: '100%', top: '50%',
                transform: 'translateY(-50%)',
                marginLeft: 10,
                padding: '5px 10px',
                background: '#1B4332',
                border: '1px solid rgba(255,255,255,.2)',
                borderRadius: 6,
                fontSize: 12, fontWeight: 600,
                color: '#fff',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,.3)',
                zIndex: 100,
              }}>
                {mod.label}
              </div>
            )}
          </div>
        )
      })}

      {/* ── Spacer ── */}
      <div style={{ flex: 1 }}/>
    </div>
  )
}
