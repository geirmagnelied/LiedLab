import { useCallback } from 'react'
import DataTabell, { Pille } from './DataTabell'
import {
  STATUS_LABELS, STATUS_ORDER, STATUS_COLORS,
  PRIO_LABELS, PRIO_ORDER, PRIO_COLORS,
  caseNoValue, caseNoText, fmtDateShort,
} from './sakerKonstantar'

// ═══════════════════════════════════════════════════════════════════
//  Saksmatrise — kolonnedefinisjonar og celle-visning for saker.
//  Sjølve tabellmotoren (sortering, filter, kolonnestyring, eigne
//  kolonnar, tettleik osv.) ligg no i den delte komponenten DataTabell,
//  som er standarden for alle tabellar i appen.
//  Visingsoppsett (rekkjefølgje, breidd, farge, sortering) er personleg og
//  vert lagra lokalt i nettlesaren.
//  Eigne kolonnar høyrer til prosjektet og ligg i databasen: definisjonen i
//  case_columns, verdiane i cases.ekstra.
// ═══════════════════════════════════════════════════════════════════

const PREFS_KEY = 'liedlab-saker-tabell-v2'

// art: 'tekst' | 'tal' | 'dato' | 'val'  — styrer sorteringsval og meny
const BASE_COLUMNS = [
  { key:'prosjekt',  label:'Prosjektnr',  w:118, art:'val',   mono:true },
  { key:'number',    label:'Saksnr',      w:112, art:'tal',   mono:true },
  { key:'title',     label:'Tittel',      w:300, art:'tekst', utanFilter:true },
  { key:'status',    label:'Status',      w:142, art:'val' },
  { key:'fag',       label:'Fag',         w:92,  art:'val' },
  { key:'type',      label:'Type',        w:176, art:'val' },
  { key:'prioritet', label:'Prioritet',   w:122, art:'val' },
  { key:'ansvarlig', label:'Ansvarleg',   w:142, art:'val' },
  { key:'frist',     label:'Frist',       w:106, art:'dato' },
  { key:'tegning',   label:'Tegning',     w:130, art:'val', standardSkjult:true },
  { key:'linked',    label:'Koplingar',   w:124, art:'tal', standardSkjult:true },
  { key:'comments',  label:'Kommentarar', w:152, art:'tal' },
  { key:'opprettet', label:'Oppretta',    w:116, art:'dato', standardSkjult:true },
]

function rangering(key) {
  if (key === 'status')    return STATUS_ORDER.map(k => STATUS_LABELS[k])
  if (key === 'prioritet') return PRIO_ORDER.map(k => PRIO_LABELS[k])
  return null
}

export default function SakerTabell({
  cases, comments, eigne = [],
  onOpenCase, onSetExtra, onNyKolonne, onSlettKolonne,
}) {
  const antalKommentarar = useCallback((c) => (comments?.[c.id] || []).length, [comments])

  const hentVerdi = useCallback((c, key) => {
    switch (key) {
      case 'prosjekt':  return c.prosjektNr || '—'
      case 'number':    return caseNoText(c.number)
      case 'title':     return c.title || ''
      case 'status':    return STATUS_LABELS[c.status] || c.status || ''
      case 'prioritet': return PRIO_LABELS[c.prioritet] || c.prioritet || ''
      case 'fag':       return c.fag || '—'
      case 'type':      return c.type || '—'
      case 'ansvarlig': return c.ansvarlig || '—'
      case 'tegning':   return c.tegning || '—'
      case 'frist':     return fmtDateShort(c.frist)
      case 'opprettet': return fmtDateShort(c.opprettet)
      case 'linked':    return String((c.linkedNotes?.length || 0) + (c.linkedTasks?.length || 0))
      case 'comments':  return String(antalKommentarar(c))
      default:          return String(c.ekstra?.[key] ?? '')
    }
  }, [antalKommentarar])

  const hentSorteringsverdi = useCallback((c, key) => {
    switch (key) {
      case 'number':    return caseNoValue(c.number) || 0
      case 'status':    return STATUS_ORDER.indexOf(c.status)
      case 'prioritet': return PRIO_ORDER.indexOf(c.prioritet)
      case 'frist':     return c.frist ? new Date(c.frist).getTime() : Infinity
      case 'opprettet': return c.opprettet ? new Date(c.opprettet).getTime() : 0
      case 'linked':    return (c.linkedNotes?.length || 0) + (c.linkedTasks?.length || 0)
      case 'comments':  return antalKommentarar(c)
      default:          return undefined // la DataTabell falle tilbake til standardlogikk
    }
  }, [antalKommentarar])

  const lagCelle = useCallback((c, kol, { farge }) => {
    const t = hentVerdi(c, kol.key)
    if (kol.key === 'status')    return <Pille tekst={t} farge={farge ? STATUS_COLORS[c.status] : null}/>
    if (kol.key === 'prioritet') return <Pille tekst={t} farge={farge ? PRIO_COLORS[c.prioritet] : null}/>
    if (kol.key === 'title')     return <span style={{ fontWeight:600, color:'var(--text)' }}>{t}</span>
    if (kol.key === 'number' || kol.key === 'prosjekt')
      return <span style={{ fontFamily:'var(--mono)', fontWeight:700, color: farge ? 'var(--brand)' : 'var(--text2)' }}>{t}</span>
    if (kol.key === 'linked') {
      const n = c.linkedNotes?.length || 0, o = c.linkedTasks?.length || 0
      if (!n && !o) return <span style={{ color:'var(--text3)', opacity:.5 }}>—</span>
      return <span style={{ fontSize:12 }}>{n ? `${n} notat` : ''}{n && o ? ' · ' : ''}{o ? `${o} oppg.` : ''}</span>
    }
    if (kol.key === 'comments') return <span>{t === '0' ? <span style={{ opacity:.4 }}>—</span> : `💬 ${t}`}</span>
    if (kol.eigen) {
      if (!t) return <span style={{ color:'var(--text3)', opacity:.45 }}>—</span>
      return <>{kol.art === 'dato' ? fmtDateShort(t) : t}</>
    }
    return undefined
  }, [hentVerdi])

  return (
    <DataTabell
      rader={cases}
      kolonnar={BASE_COLUMNS}
      eigne={eigne}
      hentVerdi={hentVerdi}
      hentSorteringsverdi={hentSorteringsverdi}
      lagCelle={lagCelle}
      rangering={rangering}
      radId={c => c.id}
      radStil={c => ({ opacity: c.status === 'lukka' ? .6 : 1 })}
      onOpenRad={id => onOpenCase?.(id)}
      onSetExtra={onSetExtra}
      onNyKolonne={onNyKolonne}
      onSlettKolonne={onSlettKolonne}
      prefsKey={PREFS_KEY}
      itemNamn="saker"
      defaultSortering={{ key:'number', dir:'desc' }}
    />
  )
}
