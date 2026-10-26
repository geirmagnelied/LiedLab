import { useState } from 'react'
import { useT } from './sprak'
import { LayoutDashboard, FolderTree, ListChecks, Clock, ShieldCheck, Palette, Image as BileteIkon, GanttChartSquare, CalendarDays, ChevronsLeft, ChevronsRight, UserRound, PenTool, FileText, FolderKanban, Building2, Users, Settings, LogOut } from 'lucide-react'

// ── Paraply-struktur (brukar sitt eige krav 30. sept. 2026) ──────────
// «Admin» og «Gjeremål» er reine NAVIGASJONS-paraplyar utan eigen
// modul-komponent — dei viser berre undermodulane sine i AppRailUndermeny
// (rail 2). Resten av modulane er framleis direkte, uendra topp-nivå-val.
const MODULES = [
  { key: 'dashboard', ikon: LayoutDashboard, letter: 'D',   label: 'Dashboard', color: '#A78BFA' },
  { key: 'dtm', ikon: FolderTree,       letter: 'DTM', label: 'Dokument, tegningar og modellar', color: '#E9C46A' },
  { key: 'gjeremaal', ikon: ListChecks, letter: 'S',   label: 'Saksbehandling', color: '#52B788', born: ['saker', 'oppgaver', 'notatar'] },
  { key: 'timar', ikon: Clock,     letter: 'T',   label: 'Timar',    color: '#60A5D4' },
  { key: 'kvalitet', ikon: ShieldCheck,  letter: 'KS',  label: 'Kvalitetssystem', color: '#EC9A5A' },
  { key: 'bilete', ikon: BileteIkon,    letter: 'B',   label: 'Bilete',   color: '#F4A261' },
  { key: 'skisse',    ikon: PenTool, letter: 'Sk', label: 'Skisse', color: '#F59E0B' },
  { key: 'framdrift', ikon: GanttChartSquare, letter: 'Fd',  label: 'Framdrift', color: '#34D399' },
  { key: 'kalender', ikon: CalendarDays,  letter: 'Ka',  label: 'Kalender', color: '#2A9D8F' },
  { key: 'malar', ikon: FileText, letter: 'Ml', label: 'Malar', color: '#38BDF8' },
  { key: 'admin', ikon: Building2, letter: 'Kd', label: 'Kontordrift', color: '#9CA3AF', born: ['prosjekt', 'kunde', 'ansatte', 'kontorkalender'] },
]

// Undermodulane sjølve (dei EKSISTERANDE `activeModule`-verdiane, uendra —
// berre navigasjonsveg dit som er ny). Eksportert slik AppRailUndermeny.jsx
// og App.jsx (for å avgjere kva paraply som skal syne som aktiv) kan bruke
// same kjelde.
export const UNDERMODULAR = {
  admin: [
    { key:'prosjekt',        letter:'P',  label:'Prosjekt',        color:'#85B7EB' },
    { key:'kunde',           letter:'K',  label:'Kundar',          color:'#D4537E' },
    { key:'ansatte',         letter:'A',  label:'Ansatte',         color:'#9CA3AF' },
    { key:'kontorkalender',  letter:'Ka', label:'Kontorkalender',  color:'#2A9D8F' },
  ],
  gjeremaal: [
    { key:'saker',    letter:'S', label:'Saksbehandling', color:'#E07A5F' },
    { key:'oppgaver', letter:'K', label:'Kanban',   color:'#4EADA3' },
    { key:'notatar',  letter:'N', label:'Notatar',  color:'#52B788' },
  ],
}

// Undermodul-nøkkel → paraply-nøkkel (omvendt oppslag av UNDERMODULAR),
// brukt til å avgjere KVA TOPP-NIVÅ-IKON som skal syne som aktivt når
// t.d. `activeModule === 'prosjekt'`.
export const PARENT_AV_MODUL = {
  ...Object.fromEntries(Object.entries(UNDERMODULAR).flatMap(([toppNokkel, born]) => born.map(b => [b.key, toppNokkel]))),
  kontordrift: 'admin',   // eldre nøkkel = Ansatte
}

// ── Tre førehandsdefinerte breidder (som verktøylinja i Blender): 'min' = berre (stort) ikon, 'kort' = ikon + bokstavkode,
//    'full' = ikon + full tekst. Knappen øvst bytter, og ein kan dra i høgre kant — breidda snappar til næraste av dei tre.
//    Valet vert hugsa (localStorage) og styrer òg breidda på logorutå i toppfeltet.
export const RAIL_MODUSAR = ['min', 'full']
export const RAIL_BREIDD = { min: 64, full: 240 }
const nærmaste = (b) => RAIL_MODUSAR.reduce((best, m) => (Math.abs(RAIL_BREIDD[m] - b) < Math.abs(RAIL_BREIDD[best] - b) ? m : best), 'min')
const IKON = 24

export default function AppRail({ activeModule, onModuleChange, modus = 'min', onModus, onLiveBredde, onSkisse, onOpenSettings, onLogout, mobil = false }) {
  const { t } = useT()
  const [hoveredModule, setHoveredModule] = useState(null)
  const [dragB, setDragB] = useState(null) // breidd under dragning (px)
  const gjeldandeTopp = PARENT_AV_MODUL[activeModule] || activeModule
  const visModus = mobil ? 'full' : (dragB != null ? nærmaste(dragB) : modus)
  const bredde = mobil ? '100%' : (dragB != null ? dragB : (RAIL_BREIDD[modus] || RAIL_BREIDD.min))
  const neste = RAIL_MODUSAR[(RAIL_MODUSAR.indexOf(modus) + 1) % RAIL_MODUSAR.length]
  const smal = visModus === 'min'
  const MODUS_NAMN = { min: t('nav.berreIkon'), kort: t('nav.ikonBokstav'), full: t('nav.ikonTekst') }

  const handleClick = (mod) => {
    if (mod.handling === 'skisse') { onSkisse?.(); return }
    if (mod.born) {
      if (PARENT_AV_MODUL[activeModule] === mod.key) return
      onModuleChange(mod.born[0])
    } else {
      onModuleChange(mod.key)
    }
  }

  // Dra i høgre kant: følg musa mellom min og full breidd, snapp til næraste førehandsdefinerte breidd ved slepp
  const startDrag = (ev) => {
    ev.preventDefault()
    const x0 = ev.clientX, b0 = RAIL_BREIDD[modus]
    const klem = (e2) => Math.max(RAIL_BREIDD.min, Math.min(RAIL_BREIDD.full, b0 + (e2.clientX - x0)))
    const mv = (e2) => { const b = klem(e2); setDragB(b); onLiveBredde?.(b) }
    const opp = (e2) => {
      window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', opp); document.body.style.cursor = ''
      setDragB(null); onLiveBredde?.(null)
      onModus?.(nærmaste(klem(e2)))
    }
    document.body.style.cursor = 'col-resize'
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', opp)
  }

  const Knapp = ({ mod, active, hovered, ikon: Ikon, namn, kode, onClick, onEnter, onLeave }) => (
    <div style={{ position: 'relative', marginBottom: 12 }}>
      <button onClick={onClick} onMouseEnter={onEnter} onMouseLeave={onLeave} title={namn}
        style={{
          width: smal ? 46 : '100%', height: 46, borderRadius: 11, padding: smal ? 0 : '0 12px',
          border: '1.5px solid transparent', background: active ? '#0A0A0A' : hovered ? 'var(--bg3)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: smal ? 'center' : 'flex-start', gap: 14,
          cursor: 'pointer', transition: 'background .15s ease', position: 'relative', fontFamily: 'var(--font)',
        }}>
        {active && <div style={{ position: 'absolute', left: smal ? -11 : -8, top: '50%', transform: 'translateY(-50%)', width: 4, height: 22, borderRadius: 2, background: mod.color }}/>}
        <Ikon size={IKON} strokeWidth={active ? 2 : 1.7} color={active ? '#FFFFFF' : 'var(--text2)'} style={{ flexShrink: 0 }}/>
        {visModus === 'kort' && <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '.02em', color: active ? '#fff' : 'var(--text2)', whiteSpace: 'nowrap' }}>{kode}</span>}
        {visModus === 'full' && <span style={{ fontSize: 13.5, fontWeight: active ? 800 : 600, color: active ? '#fff' : 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{namn}</span>}
      </button>
      {hovered && visModus !== 'full' && dragB == null && (
        <div style={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 10, padding: '5px 10px', background: '#1B2A3A',
          border: '1px solid rgba(255,255,255,.2)', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.3)', zIndex: 100 }}>{namn}</div>
      )}
    </div>
  )

  return (
    <div style={{
      width: bredde, minWidth: bredde, flexShrink: 0, position: 'relative',
      display: 'flex', flexDirection: 'column', alignItems: smal ? 'center' : 'stretch',
      background: 'var(--bg)', borderRight: '1px solid var(--border)',
      paddingTop: 14, paddingBottom: 14, paddingLeft: smal ? 0 : 10, paddingRight: smal ? 0 : 10,
      userSelect: 'none', zIndex: 50, transition: dragB == null ? 'width .15s ease, min-width .15s ease' : 'none',
      boxSizing: 'border-box', overflowY: 'auto', overflowX: 'hidden',
    }}>
      {/* Breidde: bytt mellom ikon / ikon+bokstav / ikon+full tekst */}
      {!mobil && <button onClick={() => onModus?.(neste)} title={`${t('nav.breidde')}: ${MODUS_NAMN[visModus]} — klikk for ${MODUS_NAMN[neste].toLowerCase()}`}
        style={{ display: 'flex', alignItems: 'center', justifyContent: smal ? 'center' : 'flex-end', width: smal ? 40 : '100%', height: 28, marginBottom: 14, border: 'none', background: 'transparent',
          cursor: 'pointer', color: 'var(--text3)', borderRadius: 6, padding: smal ? 0 : '0 6px', flexShrink: 0 }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        {visModus === 'full' ? <ChevronsLeft size={18}/> : <ChevronsRight size={18}/>}
      </button>}

      {MODULES.map(mod => (
        <Knapp key={mod.key} mod={mod} ikon={mod.ikon} namn={t('nav.' + mod.key, mod.label)} kode={mod.letter}
          active={gjeldandeTopp === mod.key} hovered={hoveredModule === mod.key}
          onClick={() => handleClick(mod)} onEnter={() => setHoveredModule(mod.key)} onLeave={() => setHoveredModule(null)}/>
      ))}

      <div style={{ flex: 1, minHeight: 10 }}/>

      {/* Botn-sone: berre Innstillingar (Brukar vert opna frå namnet i TN, Logg ut ligg i Brukar-modulen) */}
      <div style={{ height: 1, background: 'var(--border)', margin: smal ? '0 10px 12px' : '0 4px 12px', alignSelf: 'stretch', flexShrink: 0 }}/>
      <Knapp mod={{ color: '#9CA3AF' }} ikon={Settings} namn={t('topp.innstillingar', 'Innstillingar')} kode="In"
        active={false} hovered={hoveredModule === 'innst'}
        onClick={() => onOpenSettings?.()} onEnter={() => setHoveredModule('innst')} onLeave={() => setHoveredModule(null)}/>

      {/* Dra for å endre breidda */}
      {!mobil && <div onMouseDown={startDrag} title="Dra for å endre breidda (snappar til ikon / ikon+bokstav / ikon+tekst)"
        style={{ position: 'absolute', top: 0, bottom: 0, right: -3, width: 8, cursor: 'col-resize', zIndex: 60 }}/>}
    </div>
  )
}
