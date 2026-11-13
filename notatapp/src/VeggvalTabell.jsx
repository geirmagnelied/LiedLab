import { useCallback } from 'react'
import DataTabell, { Pille } from './DataTabell'

// ═══════════════════════════════════════════════════════════════════
//  Veggvelgar — resultattabell (tynn wrapper rundt DataTabell, same mønster som TeikningTabell/SakerTabell).
//  Radene er flate objekt frå VeggvelgarVerktoy (sjå `tilTabellRad` der).
// ═══════════════════════════════════════════════════════════════════

const PREFS_KEY = 'liedlab-verktoy-veggval-tabell-v3'
const ROBUST_NAMN = ['Lett', 'Normal', 'Auka', 'Høg']
const ROBUST_FARGE = ['#6B7280', '#0891B2', '#D97706', '#059669']

const KOLONNAR = [
  { key: 'familie',   label: 'Type',          w: 74,  art: 'val' },
  { key: 'kode',      label: 'Veggkode',      w: 290, art: 'tekst', mono: true },
  { key: 'tjukkleik', label: 'Tjukkleik mm',  w: 96,  art: 'tal' },
  { key: 'plater',    label: 'Plater',        w: 110, art: 'tekst' },
  { key: 'isolasjon', label: 'Isolasjon',     w: 100, art: 'tekst', mono: true },
  { key: 'brann',     label: 'EI',            w: 56,  art: 'tal' },
  { key: 'rw',        label: "R'w dB",        w: 72,  art: 'tal' },
  { key: 'rwC',       label: "R'w+C dB",      w: 82,  art: 'tal' },
  { key: 'maksHogde', label: 'Maks høgde mm', w: 104, art: 'tal' },
  { key: 'oppsett',   label: 'Profil / c/c',  w: 104, art: 'val' },
  { key: 'margin',    label: 'Margin mm',     w: 86,  art: 'tal' },
  { key: 'robust',    label: 'Robustheit',    w: 96,  art: 'val' },
  { key: 'merknad',   label: 'Merknad',       w: 300, art: 'tekst', utanFilter: true },
]

export default function VeggvalTabell({ rader, onVelg }) {
  const hentVerdi = useCallback((r, key) => {
    switch (key) {
      case 'familie':   return r.familie
      case 'kode':      return r.kode
      case 'tjukkleik': return r.tjukkleik
      case 'plater':    return r.plater
      case 'isolasjon': return r.isolasjon
      case 'brann':     return r.brann ?? ''
      case 'rw':        return r.rw ?? ''
      case 'rwC':       return r.rwC ?? ''
      case 'maksHogde': return r.maksHogde ?? ''
      case 'oppsett':   return r.oppsett
      case 'margin':    return r.margin ?? ''
      case 'robust':    return ROBUST_NAMN[r.robust] || ''
      case 'merknad':   return r.merknad || ''
      default:          return ''
    }
  }, [])
  const hentSorteringsverdi = useCallback((r, key) => (key === 'robust' ? r.robust : undefined), [])
  const lagCelle = useCallback((r, kol, { farge }) => {
    const v = hentVerdi(r, kol.key)
    if (kol.key === 'kode') return <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--brand)' }}>{v}</span>
    if (kol.key === 'robust') return <Pille tekst={v} farge={farge ? ROBUST_FARGE[r.robust] : null}/>
    if (kol.key === 'margin' && v !== '') return <span style={{ color: v < 100 ? '#B45309' : 'var(--text)', fontWeight: v < 100 ? 700 : 400 }}>{v}</span>
    return undefined
  }, [hentVerdi])

  return (
    <DataTabell
      rader={rader}
      kolonnar={KOLONNAR}
      hentVerdi={hentVerdi}
      hentSorteringsverdi={hentSorteringsverdi}
      lagCelle={lagCelle}
      radId={r => r.id}
      onRowClick={(id, r) => onVelg?.(r)}
      prefsKey={PREFS_KEY}
      itemNamn="veggar"
      defaultSortering={{ key: 'tjukkleik', dir: 'asc' }}
    />
  )
}
