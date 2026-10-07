import { useCallback } from 'react'
import DataTabell from './DataTabell'
import { formaterDato } from './framdriftDato'
import { antalArbeidsdagar } from './framdriftLogikk'

// ═══════════════════════════════════════════════════════════════════
//  Tabellvisinga av framdriftsplanen — tynn wrapper rundt DataTabell
//  (same mønster som SakerTabell/TeikningTabell). Gjev presis redigering
//  av namn, datoar, ansvarleg og framdrift; sjølve flyttinga/avhengnads-
//  logikken ligg i FramdriftModule.jsx (`onEndreFelt`).
// ═══════════════════════════════════════════════════════════════════

const TYPE_NAMN = { fase: 'Fase', aktivitet: 'Aktivitet', milepael: 'Milepæl' }

const KOLONNAR = [
  { key: 'namn',      label: 'Namn',        art: 'tekst', redigerbar: true, w: 260, utanFilter: true },
  { key: 'type',      label: 'Type',        art: 'val',   beregna: true, w: 100 },
  { key: 'fase',      label: 'Fase',        art: 'val',   beregna: true, w: 170 },
  { key: 'start',     label: 'Start',       art: 'tekst', redigerbar: true, mono: true, w: 110 },
  { key: 'slutt',     label: 'Slutt',       art: 'tekst', redigerbar: true, mono: true, w: 110 },
  { key: 'varig',     label: 'Arbeidsdagar', art: 'tal',  beregna: true, ikkjeSummer: true, w: 110 },
  { key: 'ansvarleg', label: 'Ansvarleg',   art: 'val',   redigerbar: true, w: 140 },
  { key: 'ferdig',    label: 'Ferdig %',    art: 'tal',   redigerbar: true, ikkjeSummer: true, w: 90 },
  { key: 'timar',     label: 'Timar',       art: 'tal',   redigerbar: true, w: 80 },
  { key: 'fordeling', label: 'Fordeling',   art: 'val',   redigerbar: true, val: ['Fast', 'Start', 'Midt', 'Slutt'], w: 100 },
  { key: 'avh',       label: 'Startar etter', art: 'tekst', beregna: true, utanFilter: true, w: 240 },
]

export default function FramdriftTabell({ elementer, valgt, onVelg, onEndreFelt }) {
  const namnPaId = useCallback((id) => elementer.find(e => e.id === id)?.namn || '', [elementer])

  const hentVerdi = useCallback((e, key) => {
    switch (key) {
      case 'namn': return e.namn
      case 'type': return TYPE_NAMN[e.type]
      case 'fase': return e.forelder != null ? namnPaId(e.forelder) : ''
      case 'start': return formaterDato(e.start)
      case 'slutt': return formaterDato(e.slutt)
      case 'varig': return e.type === 'milepael' ? '' : antalArbeidsdagar(e)
      case 'ansvarleg': return e.ansvarleg || ''
      case 'ferdig': return e.type === 'aktivitet' ? (e.ferdig || 0) : ''
      case 'timar': return e.type === 'aktivitet' ? (e.timar || 0) : e.type === 'fase' ? elementer.filter(c => c.forelder === e.id).reduce((a, c) => a + (+c.timar || 0), 0) : ''
      case 'fordeling': return e.type === 'aktivitet' && e.timar > 0 ? ({ fast: 'Fast', start: 'Start', midt: 'Midt', slutt: 'Slutt' }[e.fordeling || 'fast']) : ''
      case 'avh': return (e.avh || []).map(namnPaId).filter(Boolean).join(', ')
      default: return ''
    }
  }, [namnPaId])

  const hentSorteringsverdi = useCallback((e, key) => {
    if (key === 'start') return e.start
    if (key === 'slutt') return e.slutt
    return undefined
  }, [])

  const hentRedigerVerdi = useCallback((e, key) => {
    if (key === 'start') return formaterDato(e.start)
    if (key === 'slutt') return formaterDato(e.slutt)
    return hentVerdi(e, key)
  }, [hentVerdi])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 300,
      border: '1.5px solid var(--border)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
      <DataTabell
        rader={elementer}
        kolonnar={KOLONNAR}
        hentVerdi={hentVerdi}
        hentRedigerVerdi={hentRedigerVerdi}
        hentSorteringsverdi={hentSorteringsverdi}
        radId={e => e.id}
        onSetVerdi={(id, key, verdi) => onEndreFelt(id, key, verdi)}
        onRowClick={(id) => onVelg(id)}
        radStil={e => (e.id === valgt ? { background: 'var(--brandbg2)' } : e.type === 'fase' ? { fontWeight: 700 } : undefined)}
        rutenettRedigering
        klistreKolonnar={['namn']}
        prefsKey="liedlab-framdrift-tabell-v1"
        itemNamn="element"
        defaultSortering={{ key: 'start', dir: 'asc' }}
      />
    </div>
  )
}
