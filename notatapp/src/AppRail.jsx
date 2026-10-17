import { useState } from 'react'
import { LayoutDashboard, FolderTree, ListChecks, Clock, ShieldCheck, Palette, Image as BileteIkon, GanttChartSquare, CalendarDays, ChevronsLeft, ChevronsRight } from 'lucide-react'

// ── Paraply-struktur (brukar sitt eige krav 30. sept. 2026) ──────────
// «Admin» og «Gjeremål» er reine NAVIGASJONS-paraplyar utan eigen
// modul-komponent — dei viser berre undermodulane sine i AppRailUndermeny
// (rail 2). Resten av modulane er framleis direkte, uendra topp-nivå-val.
const MODULES = [
  { key: 'dashboard', ikon: LayoutDashboard, letter: 'D',   label: 'Dashboard', color: '#A78BFA' },
  { key: 'dtm', ikon: FolderTree,       letter: 'DTM', label: 'Dokument, tegningar og modellar', color: '#E9C46A' },
  { key: 'gjeremaal', ikon: ListChecks, letter: 'G',   label: 'Gjeremål', color: '#52B788', born: ['notatar', 'oppgaver', 'saker'] },
  { key: 'timar', ikon: Clock,     letter: 'T',   label: 'Timar',    color: '#60A5D4' },
  { key: 'kvalitet', ikon: ShieldCheck,  letter: 'KS',  label: 'Kvalitetssystem', color: '#EC9A5A' },
  { key: 'farge', ikon: Palette,     letter: 'F',   label: 'Farge',    color: '#C084B6' },
  { key: 'bilete', ikon: BileteIkon,    letter: 'B',   label: 'Bilete',   color: '#F4A261' },
  { key: 'framdrift', ikon: GanttChartSquare, letter: 'Fd',  label: 'Framdrift', color: '#34D399' },
  { key: 'kalender', ikon: CalendarDays,  letter: 'Ka',  label: 'Kalender', color: '#2A9D8F' },
]

// Undermodulane sjølve (dei EKSISTERANDE `activeModule`-verdiane, uendra —
// berre navigasjonsveg dit som er ny). Eksportert slik AppRailUndermeny.jsx
// og App.jsx (for å avgjere kva paraply som skal syne som aktiv) kan bruke
// same kjelde.
export const UNDERMODULAR = {
  admin: [
    { key:'prosjekt',    letter:'P',  label:'Prosjekt',    color:'#85B7EB' },
    { key:'kunde',       letter:'K',  label:'Kundar',      color:'#D4537E' },
    { key:'kontordrift', letter:'Kd', label:'Kontordrift', color:'#9CA3AF' },
  ],
  gjeremaal: [
    { key:'notatar',  letter:'N', label:'Notatar',  color:'#52B788' },
    { key:'oppgaver', letter:'O', label:'Oppgåver', color:'#4EADA3' },
    { key:'saker',    letter:'S', label:'Saker',    color:'#E07A5F' },
  ],
}

// Undermodul-nøkkel → paraply-nøkkel (omvendt oppslag av UNDERMODULAR),
// brukt til å avgjere KVA TOPP-NIVÅ-IKON som skal syne som aktivt når
// t.d. `activeModule === 'prosjekt'`.
export const PARENT_AV_MODUL = Object.fromEntries(
  Object.entries(UNDERMODULAR).flatMap(([toppNokkel, born]) => born.map(b => [b.key, toppNokkel]))
)

// ── Tre førehandsdefinerte breidder (som verktøylinja i Blender): 'min' = berre ikon, 'kort' = ikon + bokstavkode,
//    'full' = ikon + full tekst. Valet vert hugsa (localStorage) og styrer òg breidda på logorutå i toppen.
export const RAIL_MODUSAR = ['min', 'kort', 'full']
export const RAIL_BREIDD = { min: 52, kort: 96, full: 224 }
const MODUS_NAMN = { min: 'Berre ikon', kort: 'Ikon og bokstav', full: 'Ikon og full tekst' }

export default function AppRail({ activeModule, onModuleChange, modus = 'min', onModus }) {
  const [hoveredModule, setHoveredModule] = useState(null)
  // Kva topp-nivå-ikon skal syne som aktivt? Anten activeModule sjølv (for modular utan paraply), eller paraplyen som eig activeModule.
  const gjeldandeTopp = PARENT_AV_MODUL[activeModule] || activeModule
  const bredde = RAIL_BREIDD[modus] || RAIL_BREIDD.min
  const neste = RAIL_MODUSAR[(RAIL_MODUSAR.indexOf(modus) + 1) % RAIL_MODUSAR.length]

  const handleClick = (mod) => {
    if (mod.born) {
      // Alt inne i DENNE paraplyen? Ikkje hopp attende til fyrste barn — behald kva undermodul brukar faktisk står i.
      if (PARENT_AV_MODUL[activeModule] === mod.key) return
      onModuleChange(mod.born[0])
    } else {
      onModuleChange(mod.key)
    }
  }

  return (
    <div style={{
      width: bredde, minWidth: bredde, flexShrink: 0,
      display: 'flex', flexDirection: 'column', alignItems: modus === 'min' ? 'center' : 'stretch',
      background: 'var(--bg)',
      borderRight: '1px solid var(--border)',
      paddingTop: 10, paddingBottom: 10, paddingLeft: modus === 'min' ? 0 : 8, paddingRight: modus === 'min' ? 0 : 8,
      userSelect: 'none', zIndex: 50, transition: 'width .15s ease, min-width .15s ease',
      overflow: 'hidden', boxSizing: 'border-box',
    }}>

      {/* ── Breidde: bytt mellom ikon / ikon+bokstav / ikon+full tekst ── */}
      <button onClick={() => onModus?.(neste)} title={`Breidde: ${MODUS_NAMN[modus]} — klikk for ${MODUS_NAMN[neste].toLowerCase()}`}
        style={{ display: 'flex', alignItems: 'center', justifyContent: modus === 'min' ? 'center' : 'flex-end', gap: 6, width: modus === 'min' ? 38 : '100%', height: 26, marginBottom: 8,
          border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text3)', borderRadius: 6, padding: modus === 'min' ? 0 : '0 6px' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        {modus === 'full' ? <ChevronsLeft size={16}/> : <ChevronsRight size={16}/>}
      </button>

      {/* ── Modulknappar ── */}
      {MODULES.map(mod => {
        const active = gjeldandeTopp === mod.key
        const hovered = hoveredModule === mod.key
        const Ikon = mod.ikon
        return (
          <div key={mod.key} style={{ position: 'relative', marginBottom: 4 }}>
            <button
              onClick={() => handleClick(mod)}
              onMouseEnter={() => setHoveredModule(mod.key)}
              onMouseLeave={() => setHoveredModule(null)}
              title={mod.label}
              style={{
                width: modus === 'min' ? 38 : '100%', height: 38, borderRadius: 9, padding: modus === 'min' ? 0 : '0 9px',
                border: '1.5px solid transparent',
                background: active ? 'var(--brandbg)' : hovered ? 'var(--bg3)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: modus === 'min' ? 'center' : 'flex-start', gap: 10,
                cursor: 'pointer', transition: 'background .15s ease', position: 'relative', fontFamily: 'var(--font)',
              }}>

              {/* Aktiv-markering (venstrekant) */}
              {active && <div style={{ position: 'absolute', left: modus === 'min' ? -7 : -8, top: '50%', transform: 'translateY(-50%)', width: 3, height: 20, borderRadius: 2, background: mod.color }}/>}

              <Ikon size={19} strokeWidth={active ? 2.4 : 2} color={active ? mod.color : 'var(--text2)'} style={{ flexShrink: 0 }}/>

              {modus === 'kort' && (
                <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.02em', color: active ? 'var(--text)' : 'var(--text2)', whiteSpace: 'nowrap' }}>{mod.letter}</span>
              )}
              {modus === 'full' && (
                <span style={{ fontSize: 12.5, fontWeight: active ? 800 : 600, color: active ? 'var(--text)' : 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mod.label}</span>
              )}
            </button>

            {/* Tooltip (berre når namnet ikkje alt står der) */}
            {hovered && modus !== 'full' && (
              <div style={{
                position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 10,
                padding: '5px 10px', background: '#1B2A3A', border: '1px solid rgba(255,255,255,.2)', borderRadius: 6,
                fontSize: 12, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', pointerEvents: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,.3)', zIndex: 100,
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
