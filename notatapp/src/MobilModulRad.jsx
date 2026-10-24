import { useEffect, useRef } from 'react'

// ═══════════════════════════════════════════════════════════════════
//  MobilModulRad — rad 2 i mobil-toppfeltet: modulval med KORTNAMN, vassrett scrollbar med scroll-snap og uttona høgrekant.
//  Aktiv modul er fylt (same idé som AppRailUndermeny på skrivebord) og vert scrolla til syne. Sjå claude/mobil-grensesnitt.md.
// ═══════════════════════════════════════════════════════════════════
export const MOBIL_MODULAR = [
  ['dashboard', 'Dashboard'], ['notatar', 'Notatar'], ['oppgaver', 'Oppgåver'], ['saker', 'Saker'], ['kalender', 'Kalender'],
  ['bilete', 'Bilete'], ['timar', 'Timar'], ['prosjekt', 'Prosjekt'], ['kunde', 'Kundar'], ['kvalitet', 'Kvalitet'],
  ['dtm', 'DTM'], ['framdrift', 'Framdrift'],
]

export default function MobilModulRad({ activeModule, onVelg }) {
  const rot = useRef(null)
  useEffect(() => {
    const el = rot.current?.querySelector(`[data-mod="${activeModule}"]`)
    if (el) el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [activeModule])
  return (
    <div style={{ position: 'relative', flexShrink: 0, background: '#151515', borderTop: '1px solid rgba(255,255,255,.08)' }}>
      <style>{'.mob-pills::-webkit-scrollbar{display:none}'}</style>
      <div ref={rot} className="mob-pills" style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '6px 28px 6px 12px', scrollSnapType: 'x proximity', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {MOBIL_MODULAR.map(([k, namn]) => {
          const aktiv = activeModule === k
          return (
            <button key={k} data-mod={k} onClick={() => onVelg(k)}
              style={{ flexShrink: 0, scrollSnapAlign: 'start', height: 40, padding: '0 16px', borderRadius: 20, cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 14,
                fontWeight: aktiv ? 700 : 500, whiteSpace: 'nowrap',
                border: '1.5px solid ' + (aktiv ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.14)'),
                background: aktiv ? 'rgba(255,255,255,.95)' : 'transparent', color: aktiv ? '#111' : 'rgba(255,255,255,.75)' }}>
              {namn}
            </button>
          )
        })}
      </div>
      {/* uttona høgrekant: viser at det finst meir å scrolle til */}
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 32, pointerEvents: 'none', background: 'linear-gradient(to right, rgba(21,21,21,0), #151515)' }}/>
    </div>
  )
}
