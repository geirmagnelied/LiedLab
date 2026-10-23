import { UNDERMODULAR } from './AppRail'
import { useT } from './sprak'

// ═══════════════════════════════════════════════════════════════════
//  AppRailUndermeny — «venstrebar nr. 2», til høgre for den vanlege
//  AppRail (rail 1). Vist BERRE når det aktive topp-nivå-ikonet er ein
//  paraply (Admin/Gjeremål, sjå UNDERMODULAR i AppRail.jsx) — reint
//  tilleggsnivå, ingen eigne `activeModule`-verdiar (born-nøklane er dei
//  SAME, uendra modul-verdiane som før paraply-strukturen fanst).
// ═══════════════════════════════════════════════════════════════════
export default function AppRailUndermeny({ toppNokkel, activeModule, onModuleChange }) {
  const { t } = useT()
  const born = UNDERMODULAR[toppNokkel]
  if (!born) return null

  // NL2: vassrett navigasjonslinje under TN — aktiv undermodul er mørk blå (viser kvar ein er), dei andre passive
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, height: 44, padding: '0 16px',
      background: 'var(--bg2)', borderBottom: '1px solid var(--border)', userSelect: 'none',
    }}>
      {born.map(b => {
        const active = activeModule === b.key
        return (
          <button key={b.key} onClick={() => onModuleChange(b.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px',
              borderRadius: 8, border: '1.5px solid ' + (active ? 'var(--brand)' : 'transparent'),
              background: active ? 'var(--brand)' : 'transparent',
              color: active ? '#fff' : 'var(--text3)',
              fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer',
              fontFamily: 'var(--font)', transition: 'background .15s, color .15s',
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg3)' }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
            {t('nav.' + b.key, b.label)}
          </button>
        )
      })}
    </div>
  )
}
