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
  { key:'arkiver',    label:'Arkiver',    w:78,  art:'tekst', utanFilter:true },
  { key:'slett',      label:'Slett',      w:62,  art:'tekst', utanFilter:true },
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
                                     activeProjectId, onToggleFavorite, onTogglePinned }) {
  const [showArchived, setShowArchived] = useState(false)
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
      default:           return ''
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
    if (kol.key === 'arkiver')
      return (
        <button onClick={e => { e.stopPropagation(); onToggleDone?.(n.id) }}
          title={n.done ? 'Hent ut av arkivet' : 'Arkiver notatet'}
          style={{ width:24, height:24, borderRadius:6,
            border:`1px solid ${n.done ? 'var(--success)' : 'var(--border)'}`,
            background: n.done ? 'var(--success)' : 'var(--bg2)',
            color: n.done ? '#fff' : 'var(--text3)',
            fontSize:12, fontWeight:800, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center' }}>
          {n.done ? '✓' : 'A'}
        </button>
      )
    if (kol.key === 'slett')
      return (
        <button onClick={e => {
            e.stopPropagation()
            if (window.confirm(`Sikker på at du vil slette notatet «${tittelFor(n)}»?\n\nDenne handlinga kan ikkje angrast.`)) {
              onDelete?.(n.id)
            }
          }}
          title="Slett notat"
          style={{ width:24, height:24, borderRadius:6, border:'1px solid var(--border)',
            background:'var(--bg2)', color:'var(--text3)', fontSize:11, fontWeight:800,
            cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          S
        </button>
      )
    return undefined
  }, [onToggleDone, onDelete])

  // Radmeny (☰): favoritt/fest-til-topp — sjå DataTabell sin `radMeny`-prop.
  const radMeny = useMemo(() => ({
    erFavoritt:    n => !!n.favorite,
    onFavoritt:    (id) => onToggleFavorite?.(id),
    erFesta:       n => !!n.pinned,
    onFestTilTopp: (id) => onTogglePinned?.(id),
  }), [onToggleFavorite, onTogglePinned])

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>
      {archivedNotes.length > 0 && (
        <div style={{ display:'flex', gap:6, marginBottom:12, flexShrink:0 }}>
          <button onClick={() => setShowArchived(false)}
            style={{ padding:'5px 12px', borderRadius:6, fontSize:12, fontWeight:600,
              border:'1.5px solid', cursor:'pointer',
              borderColor: !showArchived ? 'var(--brand3)' : 'var(--border)',
              background:  !showArchived ? 'var(--brandbg)' : 'transparent',
              color:       !showArchived ? 'var(--brand)' : 'var(--text3)' }}>
            Aktive ({activeNotes.length})
          </button>
          <button onClick={() => setShowArchived(true)}
            style={{ padding:'5px 12px', borderRadius:6, fontSize:12, fontWeight:600,
              border:'1.5px solid', cursor:'pointer',
              borderColor: showArchived ? 'var(--text3)' : 'var(--border)',
              background:  showArchived ? 'var(--bg3)' : 'transparent',
              color:       showArchived ? 'var(--text2)' : 'var(--text3)' }}>
            Arkivert ({archivedNotes.length})
          </button>
        </div>
      )}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:300,
        border:'1.5px solid var(--border)', borderRadius:'var(--r2)', overflow:'hidden' }}>
        <DataTabell
          rader={visible}
          kolonnar={BASE_COLUMNS}
          hentVerdi={hentVerdi}
          hentSorteringsverdi={hentSorteringsverdi}
          lagCelle={lagCelle}
          radId={n => n.id}
          onOpenRad={(id, n) => onEdit?.(n)}
          onRowClick={(id) => onSelect?.(id)}
          radStil={n => n.id === selectedId ? { background:'var(--brandbg)' } : undefined}
          radMeny={radMeny}
          prefsKey={`${PREFS_KEY}:${activeProjectId ?? 'alle'}`}
          itemNamn="notatar"
          defaultSortering={{ key:'nr', dir:'desc' }}
        />
      </div>
    </div>
  )
}
