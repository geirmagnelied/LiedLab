import { useState, useCallback, useMemo } from 'react'
import DataTabell from './DataTabell'
import { fmtDateShort } from './sakerKonstantar'

// ═══════════════════════════════════════════════════════════════════
//  Notatregister — standardvisninga for notatmodulen, same tabellmotor
//  (DataTabell) og same mønster som SakerTabell/TeikningTabell.
//  Erstattar den gamle kort-baserte NoteList som standardvising —
//  NoteList.jsx ligg framleis i prosjektet, men vert ikkje lenger brukt.
//
//  Notatnummer er eit permanent, unikt felt (notes.nr i databasen),
//  tildelt ved oppretting i useStore.js (nextNoteNumber — same mønster
//  som saksnummer i saksmodulen). Eldre notat frå før feltet fanst har
//  fått det etterutfylt via supabase-notes-nr.sql, etter opprettingsdato.
// ═══════════════════════════════════════════════════════════════════

const PREFS_KEY = 'liedlab-notat-tabell-v2'

const BASE_COLUMNS = [
  { key:'nr',         label:'Nr.',        w:64,  art:'tal',   mono:true },
  { key:'tittel',     label:'Overskrift', w:340, art:'tekst', utanFilter:true },
  { key:'registrert', label:'Registrert', w:104, art:'dato',  mono:true },
  { key:'endra',      label:'Endra',      w:104, art:'dato',  mono:true },
  { key:'prosjekt',   label:'Prosjekt',   w:160, art:'val',   standardSkjult:true },
  { key:'type',       label:'Type',       w:96,  art:'val',   standardSkjult:true },
]

function tittelFor(n) {
  return n.title || n.text?.substring(0, 60) || 'Utan tittel'
}
function typeFor(n) {
  if (n.isMeeting) return 'Møte'
  if (n.isReferat) return 'Referat'
  return 'Notat'
}

export default function NoteTabell({ notes, projects, onEdit, onDelete, onToggleDone, onSelect, selectedId,
                                     activeProjectId, onToggleFavorite, onTogglePinned,
                                     eigneKolonnar, onSetExtra, onNyKolonne, onSlettKolonne }) {
  const [showArchived, setShowArchived] = useState(false)
  const [valde, setValde] = useState(() => new Set())
  const activeNotes   = notes.filter(n => !n.done)
  const archivedNotes = notes.filter(n => n.done)
  const visible = showArchived ? archivedNotes : activeNotes

  const prosjektNamn = useCallback((n) => {
    if (!n.projectId) return '—'
    return projects.find(p => p.id === n.projectId)?.name || '—'
  }, [projects])

  const hentVerdi = useCallback((n, key) => {
    switch (key) {
      case 'nr':         return n.nr ?? ''
      case 'tittel':     return tittelFor(n)
      case 'registrert': return fmtDateShort(n.createdAt)
      case 'endra':      return fmtDateShort(n.updatedAt || n.createdAt)
      case 'prosjekt':   return prosjektNamn(n)
      case 'type':       return typeFor(n)
      default:           return String(n.ekstra?.[key] ?? '')
    }
  }, [prosjektNamn])

  const hentSorteringsverdi = useCallback((n, key) => {
    switch (key) {
      case 'nr':         return n.nr || 0
      case 'registrert': return n.createdAt ? new Date(n.createdAt).getTime() : 0
      case 'endra':      return n.updatedAt ? new Date(n.updatedAt).getTime()
                                 : (n.createdAt ? new Date(n.createdAt).getTime() : 0)
      default:           return undefined
    }
  }, [])

  const lagCelle = useCallback((n, kol) => {
    if (kol.key === 'tittel')
      return (
        <span style={{ fontWeight:600, color:'var(--text)',
          textDecoration: n.done ? 'line-through' : 'none', opacity: n.done ? .6 : 1 }}>
          {tittelFor(n)}
        </span>
      )
    return undefined
  }, [])

  const slettMedStadfesting = useCallback((id, n) => {
    if (window.confirm(`Sikker på at du vil slette notatet «${tittelFor(n)}»?\n\nDenne handlinga kan ikkje angrast.`)) {
      onDelete?.(id)
    }
  }, [onDelete])

  // Radmeny (☰): favoritt/fest-til-topp/arkiver/slett — sjå DataTabell sin `radMeny`-prop.
  const radMeny = useMemo(() => ({
    erFavoritt:    n => !!n.favorite,
    onFavoritt:    (id) => onToggleFavorite?.(id),
    erFesta:       n => !!n.pinned,
    onFestTilTopp: (id) => onTogglePinned?.(id),
    erArkivert:    n => !!n.done,
    onArkiver:     (id) => onToggleDone?.(id),
    onSlett:       (id, n) => slettMedStadfesting(id, n),
  }), [onToggleFavorite, onTogglePinned, onToggleDone, slettMedStadfesting])

  // Fleirval (shift/ctrl-klikk) — sjå DataTabell sin `merking`-prop.
  const merking = useMemo(() => ({ valde, onEndre: setValde }), [valde])
  const byteVisning = (arkivert) => { setShowArchived(arkivert); setValde(new Set()) }

  const slettValde = () => {
    if (!window.confirm(`Sikker på at du vil slette ${valde.size} notat?\n\nDenne handlinga kan ikkje angrast.`)) return
    valde.forEach(id => onDelete?.(id))
    setValde(new Set())
  }
  const arkiverValde = () => {
    valde.forEach(id => {
      const n = notes.find(x => x.id === id)
      if (n && !n.done) onToggleDone?.(id)
    })
    setValde(new Set())
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>
      {(archivedNotes.length > 0 || valde.size > 0) && (
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12, flexShrink:0, flexWrap:'wrap' }}>
          {archivedNotes.length > 0 && (<>
            <button onClick={() => byteVisning(false)}
              style={{ padding:'5px 12px', borderRadius:6, fontSize:12, fontWeight:600,
                border:'1.5px solid', cursor:'pointer',
                borderColor: !showArchived ? 'var(--brand3)' : 'var(--border)',
                background:  !showArchived ? 'var(--brandbg)' : 'transparent',
                color:       !showArchived ? 'var(--brand)' : 'var(--text3)' }}>
              Aktive ({activeNotes.length})
            </button>
            <button onClick={() => byteVisning(true)}
              style={{ padding:'5px 12px', borderRadius:6, fontSize:12, fontWeight:600,
                border:'1.5px solid', cursor:'pointer',
                borderColor: showArchived ? 'var(--text3)' : 'var(--border)',
                background:  showArchived ? 'var(--bg3)' : 'transparent',
                color:       showArchived ? 'var(--text2)' : 'var(--text3)' }}>
              Arkivert ({archivedNotes.length})
            </button>
          </>)}
          {valde.size > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:6, marginLeft: archivedNotes.length ? 10 : 0,
              padding:'4px 10px', borderRadius:20, background:'var(--brandbg)' }}>
              <span style={{ fontSize:12, fontWeight:700, color:'var(--brand)' }}>{valde.size} valde</span>
              <button onClick={arkiverValde} className="dt-knapp" style={{ padding:'3px 9px' }}>Arkiver valde</button>
              <button onClick={slettValde} className="dt-knapp" style={{ padding:'3px 9px', color:'#B91C1C', borderColor:'#B91C1C' }}>Slett valde</button>
              <button onClick={() => setValde(new Set())} className="dt-knapp" style={{ padding:'3px 9px' }}>Avbryt</button>
            </div>
          )}
        </div>
      )}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:300,
        border:'1.5px solid var(--border)', borderRadius:'var(--r2)', overflow:'hidden' }}>
        <DataTabell
          rader={visible}
          kolonnar={BASE_COLUMNS}
          eigne={eigneKolonnar}
          hentVerdi={hentVerdi}
          hentSorteringsverdi={hentSorteringsverdi}
          lagCelle={lagCelle}
          radId={n => n.id}
          onOpenRad={(id, n) => onEdit?.(n)}
          onRowClick={(id) => onSelect?.(id)}
          radStil={n => n.id === selectedId ? { background:'var(--brandbg)' } : undefined}
          radMeny={radMeny}
          merking={merking}
          onSetExtra={onSetExtra}
          onNyKolonne={onNyKolonne}
          onSlettKolonne={onSlettKolonne}
          prefsKey={`${PREFS_KEY}:${activeProjectId ?? 'alle'}`}
          itemNamn="notatar"
          defaultSortering={{ key:'nr', dir:'desc' }}
        />
      </div>
    </div>
  )
}
