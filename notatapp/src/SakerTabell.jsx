import { useCallback } from 'react'
import DataTabell, { Pille } from './DataTabell'
import { personFarge, ALLE_STATUSAR } from './kanbanLogikk'
import {
  STATUS_LABELS, STATUS_ORDER,
  PRIO_LABELS, PRIO_ORDER, PRIO_COLORS,
  fmtDateShort,
} from './sakerKonstantar'

// ═══════════════════════════════════════════════════════════════════
//  Gjeremål-tabellen — saker (S-nr) og oppgåver/Kanban-kort (O-nr) i same liste.
//  Kolonnedefinisjonar og celle-visning; sjølve tabellmotoren ligg i DataTabell. Kvar rad er bygd i SakerModule:
//    { radId: 'S12' | 'O5', rad: 'sak' | 'oppgave', number, title, status, statusLabel, statusFarge, ansvarlig, frist, opprettet, … }
//  Kolonnene som berre gjeld saker (Fag, Sakstype, Prioritet, Kommentarar …) er skjult som standard og viser «—» for oppgåver.
//  Eigne kolonnar høyrer til prosjektet og gjeld saker (case_columns / cases.ekstra).
// ═══════════════════════════════════════════════════════════════════
const PREFS_KEY = 'liedlab-gjeremaal-tabell-v1'

// art: 'tekst' | 'tal' | 'dato' | 'val'  — styrer sorteringsval og meny
const BASE_COLUMNS = [
  { key: 'prosjekt',  label: 'Prosjektnr',  w: 118, art: 'val',   mono: true },
  { key: 'number',    label: 'Nr',          w: 92,  art: 'tal',   mono: true },
  { key: 'rad',       label: 'Type',        w: 108, art: 'val' },
  { key: 'title',     label: 'Tittel',      w: 320, art: 'tekst', utanFilter: true },
  { key: 'status',    label: 'Status',      w: 150, art: 'val' },
  { key: 'ansvarlig', label: 'Ansvarleg',   w: 150, art: 'val' },
  { key: 'frist',     label: 'Frist',       w: 106, art: 'dato' },
  { key: 'sak',       label: 'Sak',         w: 90,  art: 'val',  mono: true },
  { key: 'opprettet', label: 'Oppretta',    w: 116, art: 'dato' },
  { key: 'fag',       label: 'Fag',         w: 92,  art: 'val',  standardSkjult: true },
  { key: 'type',      label: 'Sakstype',    w: 176, art: 'val',  standardSkjult: true },
  { key: 'prioritet', label: 'Prioritet',   w: 122, art: 'val',  standardSkjult: true },
  { key: 'tegning',   label: 'Tegning',     w: 130, art: 'val',  standardSkjult: true },
  { key: 'linked',    label: 'Koplingar',   w: 124, art: 'tal',  standardSkjult: true },
  { key: 'comments',  label: 'Kommentarar', w: 152, art: 'tal',  standardSkjult: true },
]

// Status-rekkjefølgje på tvers av sak- og oppgåvestatusar (til sortering)
const STATUS_RANG = [...ALLE_STATUSAR.filter(s => s.key !== 'under_arbeid' && s.key !== 'ferdig').map(s => s.label), ...STATUS_ORDER.map(k => STATUS_LABELS[k]), ALLE_STATUSAR.find(s => s.key === 'ferdig').label]
function rangering(key) {
  if (key === 'status')    return [...new Set(STATUS_RANG)]
  if (key === 'prioritet') return PRIO_ORDER.map(k => PRIO_LABELS[k])
  return null
}
export const radNr = (r) => (r.rad === 'sak' ? 'S-' : 'O-') + (r.number ?? '')

export default function SakerTabell({
  rader, comments, eigne = [],
  onOpenRad, onSetExtra, onNyKolonne, onSlettKolonne,
}) {
  const antalKommentarar = useCallback((c) => (c.rad === 'sak' ? (comments?.[c.id] || []).length : 0), [comments])

  const hentVerdi = useCallback((c, key) => {
    const sak = c.rad === 'sak'
    switch (key) {
      case 'prosjekt':  return c.prosjektNr || '—'
      case 'number':    return radNr(c)
      case 'rad':       return sak ? 'Sak' : 'Oppgåve'
      case 'title':     return c.title || ''
      case 'status':    return c.statusLabel || ''
      case 'prioritet': return sak ? (PRIO_LABELS[c.prioritet] || c.prioritet || '') : '—'
      case 'fag':       return (sak && c.fag) || '—'
      case 'type':      return (sak && c.type) || '—'
      case 'ansvarlig': return c.ansvarlig || '—'
      case 'tegning':   return (sak && c.tegning) || '—'
      case 'sak':       return c.sakNr ? 'S-' + c.sakNr : '—'
      case 'frist':     return fmtDateShort(c.frist)
      case 'opprettet': return fmtDateShort(c.opprettet)
      case 'linked':    return sak ? String((c.linkedNotes?.length || 0) + (c.linkedTasks?.length || 0)) : '0'
      case 'comments':  return String(antalKommentarar(c))
      default:          return String(c.ekstra?.[key] ?? '')
    }
  }, [antalKommentarar])

  const hentSorteringsverdi = useCallback((c, key) => {
    switch (key) {
      case 'number':    return (c.rad === 'sak' ? 0 : 1000000) + (Number(c.number) || 0)
      case 'status':    return STATUS_RANG.indexOf(c.statusLabel)
      case 'prioritet': return c.rad === 'sak' ? PRIO_ORDER.indexOf(c.prioritet) : 99
      case 'frist':     return c.frist ? new Date(c.frist).getTime() : Infinity
      case 'opprettet': return c.opprettet ? new Date(c.opprettet).getTime() : 0
      case 'linked':    return (c.linkedNotes?.length || 0) + (c.linkedTasks?.length || 0)
      case 'comments':  return antalKommentarar(c)
      default:          return undefined // la DataTabell falle tilbake til standardlogikk
    }
  }, [antalKommentarar])

  const lagCelle = useCallback((c, kol, { farge }) => {
    const t = hentVerdi(c, kol.key)
    if (kol.key === 'status')    return <Pille tekst={t} farge={farge ? c.statusFarge : null}/>
    if (kol.key === 'prioritet') return t === '—' ? <span style={{ color: 'var(--text3)', opacity: .5 }}>—</span> : <Pille tekst={t} farge={farge ? PRIO_COLORS[c.prioritet] : null}/>
    if (kol.key === 'title')     return <span style={{ fontWeight: 600, color: 'var(--text)' }}>{t}</span>
    if (kol.key === 'rad')       return <Pille tekst={t} farge={farge ? (c.rad === 'sak' ? '#E07A5F' : '#4EADA3') : null}/>
    if (kol.key === 'number' || kol.key === 'prosjekt' || kol.key === 'sak')
      return <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: farge ? (c.rad === 'sak' ? '#C2563B' : '#2F8A80') : 'var(--text2)' }}>{t}</span>
    if (kol.key === 'ansvarlig') {
      const pf = personFarge(c.ansvarlig)
      if (!pf) return <span style={{ color: 'var(--text3)', opacity: .5 }}>—</span>
      return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, color: farge ? pf.fg : 'var(--text2)' }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: pf.fg, flexShrink: 0 }}/>{t}</span>
    }
    if (kol.key === 'linked') {
      const n = c.linkedNotes?.length || 0, o = c.linkedTasks?.length || 0
      if (!n && !o) return <span style={{ color: 'var(--text3)', opacity: .5 }}>—</span>
      return <span style={{ fontSize: 12 }}>{n ? `${n} notat` : ''}{n && o ? ' · ' : ''}{o ? `${o} oppg.` : ''}</span>
    }
    if (kol.key === 'comments') return <span>{t === '0' ? <span style={{ opacity: .4 }}>—</span> : `💬 ${t}`}</span>
    if (kol.eigen) {
      if (!t) return <span style={{ color: 'var(--text3)', opacity: .45 }}>—</span>
      return <>{kol.art === 'dato' ? fmtDateShort(t) : t}</>
    }
    return undefined
  }, [hentVerdi])

  return (
    <DataTabell
      rader={rader}
      kolonnar={BASE_COLUMNS}
      eigne={eigne}
      hentVerdi={hentVerdi}
      hentSorteringsverdi={hentSorteringsverdi}
      lagCelle={lagCelle}
      rangering={rangering}
      radId={c => c.radId}
      radStil={c => ({ opacity: c.ferdig ? .6 : 1 })}
      onOpenRad={id => onOpenRad?.(id)}
      onSetExtra={(id, key, val) => { if (String(id).startsWith('S')) onSetExtra?.(Number(String(id).slice(1)), key, val) }}
      onNyKolonne={onNyKolonne}
      onSlettKolonne={onSlettKolonne}
      prefsKey={PREFS_KEY}
      itemNamn="gjeremål"
      defaultSortering={{ key: 'opprettet', dir: 'desc' }}
    />
  )
}
