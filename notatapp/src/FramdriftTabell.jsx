import { useCallback, useMemo, useState } from 'react'
import { addDays, getISOWeek, format } from 'date-fns'
import DataTabell from './DataTabell'
import { formaterDato, tilDato } from './framdriftDato'
import { antalArbeidsdagar } from './framdriftLogikk'
import { effektivFerdig, faseFerdig } from './framdriftFerdig'
import { personDelar, fordelTimar } from './framdriftTimar'
import { vekeStart } from './kontorkalender'
import { PERSONFARGAR } from './FramdriftPersonarPanel'

// ═══════════════════════════════════════════════════════════════════
//  Tabellvisinga av framdriftsplanen — tynn wrapper rundt DataTabell
//  (same mønster som SakerTabell/TeikningTabell). Kvar aktivitet med timar og
//  personar har ▸/▾ som viser person-UNDERRADER (kven som tek kor mange timar), og
//  vekekolonnar («Veke 42» …) viser timane per veke — for aktivitet, person og fase.
//  Sjølve flyttinga/avhengnadslogikken ligg i FramdriftModule.jsx (`onEndreFelt`).
// ═══════════════════════════════════════════════════════════════════

const TYPE_NAMN = { fase: 'Fase', aktivitet: 'Aktivitet', milepael: 'Milepæl', person: 'Person' }

const BASE_KOLONNAR = [
  { key: 'namn',      label: 'Namn',        art: 'tekst', redigerbar: true, w: 270, utanFilter: true },
  { key: 'type',      label: 'Type',        art: 'val',   beregna: true, w: 100 },
  { key: 'fase',      label: 'Fase',        art: 'val',   beregna: true, w: 170 },
  { key: 'start',     label: 'Start',       art: 'tekst', redigerbar: true, mono: true, w: 110 },
  { key: 'slutt',     label: 'Slutt',       art: 'tekst', redigerbar: true, mono: true, w: 110 },
  { key: 'varig',     label: 'Arbeidsdagar', art: 'tal',  beregna: true, ikkjeSummer: true, w: 110 },
  { key: 'ansvarleg', label: 'Ansvarleg',   art: 'val',   redigerbar: true, w: 140 },
  { key: 'ferdig',    label: 'Ferdig %',    art: 'tal',   redigerbar: true, ikkjeSummer: true, w: 90 },
  { key: 'levnr',     label: 'Leveransar',  art: 'tal',   beregna: true, ikkjeSummer: true, w: 90 },
  { key: 'budsjett',  label: 'Budsjett kr', art: 'tal',   redigerbar: true, w: 110 },
  { key: 'timar',     label: 'Timar',       art: 'tal',   redigerbar: true, w: 80 },
  { key: 'fordeling', label: 'Fordeling',   art: 'val',   redigerbar: true, val: ['Fast', 'Start', 'Midt', 'Slutt'], w: 100 },
  { key: 'avh',       label: 'Startar etter', art: 'tekst', beregna: true, utanFilter: true, w: 240 },
]

const fmtT = (n) => (n > 0 ? Math.round(n * 10) / 10 : '')
const UKE = 'uke_'

export default function FramdriftTabell({ dokMap, elementer, kal, valgt, onVelg, onEndreFelt }) {
  const [utvida, setUtvida] = useState(() => new Set()) // aktivitets-id med opne person-underrader
  const namnPaId = useCallback((id) => elementer.find(e => e.id === id)?.namn || '', [elementer])

  // timar per veke per aktivitet: Map(id → Map(veke → timar))
  const vekeKart = useMemo(() => {
    const m = new Map()
    for (const e of elementer) if (e.type === 'aktivitet' && +e.timar > 0) m.set(e.id, new Map(fordelTimar(e, kal).map(v => [v.veke, v.timar])))
    return m
  }, [elementer, kal])

  const veker = useMemo(() => {
    const alle = new Set([...vekeKart.values()].flatMap(k => [...k.keys()]))
    if (!alle.size) return []
    const s = [...alle].sort()
    const ut = []
    for (let d = vekeStart(tilDato(s[0])); d <= tilDato(s[s.length - 1]); d = addDays(d, 7)) ut.push(format(d, 'yyyy-MM-dd'))
    return ut
  }, [vekeKart])

  const kolonnar = useMemo(() => [
    ...BASE_KOLONNAR,
    ...veker.map(v => ({ key: UKE + v, label: 'Veke ' + getISOWeek(tilDato(v)), overskrift: ['Veke ' + getISOWeek(tilDato(v)), format(tilDato(v), 'dd.MM')],
      art: 'tal', beregna: true, w: 62, mono: true })),
  ], [veker])

  const kanUtvide = (e) => e.type === 'aktivitet' && +e.timar > 0 && personDelar(e).length > 0
  const rader = useMemo(() => {
    const ut = []
    for (const e of elementer) {
      ut.push(e)
      if (utvida.has(e.id) && kanUtvide(e)) {
        personDelar(e).forEach((p, i) => ut.push({ id: `p:${e.id}:${p.namn}`, type: 'person', __forelder: e.id, namn: p.namn, del: p.del, farge: PERSONFARGAR[i % PERSONFARGAR.length], akt: e }))
      }
    }
    return ut
  }, [elementer, utvida])

  const radGruppe = useMemo(() => ({ forelder: r => (r.type === 'person' ? r.__forelder : null) }), [])
  const toggle = (id) => setUtvida(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const utvidbare = elementer.filter(kanUtvide)
  const alleOpne = utvidbare.length > 0 && utvidbare.every(e => utvida.has(e.id))

  const vekeTimar = useCallback((e, v) => {
    if (e.type === 'aktivitet') return vekeKart.get(e.id)?.get(v) || 0
    if (e.type === 'person') return (vekeKart.get(e.akt.id)?.get(v) || 0) * e.del / 100
    if (e.type === 'fase') return elementer.filter(c => c.forelder === e.id).reduce((a, c) => a + (vekeKart.get(c.id)?.get(v) || 0), 0)
    return 0
  }, [vekeKart, elementer])

  const hentVerdi = useCallback((e, key) => {
    if (key.startsWith(UKE)) return fmtT(vekeTimar(e, key.slice(UKE.length)))
    if (e.type === 'person') {
      switch (key) {
        case 'namn': return e.namn
        case 'type': return 'Person'
        case 'timar': return fmtT((+e.akt.timar || 0) * e.del / 100)
        default: return ''
      }
    }
    switch (key) {
      case 'namn': return e.namn
      case 'type': return TYPE_NAMN[e.type]
      case 'fase': return e.forelder != null ? namnPaId(e.forelder) : ''
      case 'start': return formaterDato(e.start)
      case 'slutt': return formaterDato(e.slutt)
      case 'varig': return e.type === 'milepael' ? '' : antalArbeidsdagar(e)
      case 'ansvarleg': { const p = personDelar(e); return (e.personar || []).length ? p.map(x => x.namn + (p.length > 1 ? ' ' + x.del + '%' : '')).join(', ') : (e.ansvarleg || '') }
      case 'ferdig': return e.type === 'aktivitet' ? effektivFerdig(e, dokMap) : e.type === 'fase' ? faseFerdig(elementer, e, dokMap) : ''
      case 'budsjett': return e.type === 'aktivitet' ? (e.budsjett || '') : e.type === 'fase' ? (elementer.filter(c => c.forelder === e.id).reduce((a, c) => a + (+c.budsjett || 0), 0) || '') : ''
      case 'levnr': return e.type === 'aktivitet' ? ((e.leveransar || []).length || '') : ''
      case 'timar': return e.type === 'aktivitet' ? (e.timar || 0) : e.type === 'fase' ? elementer.filter(c => c.forelder === e.id).reduce((a, c) => a + (+c.timar || 0), 0) : ''
      case 'fordeling': return e.type === 'aktivitet' && e.timar > 0 ? ({ fast: 'Fast', start: 'Start', midt: 'Midt', slutt: 'Slutt' }[e.fordeling || 'fast']) : ''
      case 'avh': return (e.avh || []).map(namnPaId).filter(Boolean).join(', ')
      default: return ''
    }
  }, [namnPaId, dokMap, elementer, vekeTimar])

  // Namnecella: ▸/▾ for å vise/skjule person-underradene; person-rader får innrykk og fargeprikk
  const lagCelle = useCallback((e, kol) => {
    if (kol.key !== 'namn') return undefined
    if (e.type === 'person') {
      return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, paddingLeft: 26, color: 'var(--text2)' }}>
        <span style={{ width: 9, height: 9, borderRadius: 3, background: e.farge, flexShrink: 0 }}/>{e.namn}
        {e.akt.personar?.length > 1 && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{e.del}%</span>}
      </span>
    }
    if (!kanUtvide(e)) return undefined
    const ope = utvida.has(e.id)
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span role="button" title={ope ? 'Skjul personar' : 'Vis personar og timefordeling'}
          onClick={ev => { ev.stopPropagation(); toggle(e.id) }} onMouseDown={ev => ev.stopPropagation()}
          style={{ cursor: 'pointer', width: 16, textAlign: 'center', color: 'var(--brand)', fontSize: 12, userSelect: 'none' }}>{ope ? '▾' : '▸'}</span>
        {e.namn}
        <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>({personDelar(e).length})</span>
      </span>
    )
  }, [utvida])

  const hentSorteringsverdi = useCallback((e, key) => {
    if (key.startsWith(UKE)) return vekeTimar(e, key.slice(UKE.length))
    if (e.type === 'person') return key === 'timar' ? (+e.akt.timar || 0) * e.del / 100 : undefined
    if (key === 'start') return e.start
    if (key === 'slutt') return e.slutt
    return undefined
  }, [vekeTimar])

  const hentRedigerVerdi = useCallback((e, key) => {
    if (key === 'start') return formaterDato(e.start)
    if (key === 'slutt') return formaterDato(e.slutt)
    return hentVerdi(e, key)
  }, [hentVerdi])

  const standardSynlege = useMemo(() => kolonnar.map(k => k.key).filter(k => !['type', 'fase', 'varig', 'avh', 'fordeling'].includes(k)), [kolonnar])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 300,
      border: '1.5px solid var(--border)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', background: 'var(--bg3)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>
          {utvidbare.length ? 'Trykk ▸ framfor ein aktivitet for å sjå personane og timefordelinga deira per veke.' : 'Legg inn «Timar» og personar på aktivitetane for å sjå timefordelinga her.'}
        </span>
        <div style={{ flex: 1 }}/>
        {utvidbare.length > 0 && (
          <button className="fd-knapp" style={{ padding: '3px 10px', fontSize: 11.5 }}
            onClick={() => setUtvida(alleOpne ? new Set() : new Set(utvidbare.map(e => e.id)))}>
            {alleOpne ? 'Fold saman alle' : 'Utvid alle personar'}
          </button>
        )}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <DataTabell
          rader={rader}
          kolonnar={kolonnar}
          hentVerdi={hentVerdi}
          hentRedigerVerdi={hentRedigerVerdi}
          hentSorteringsverdi={hentSorteringsverdi}
          lagCelle={lagCelle}
          radGruppe={radGruppe}
          radId={e => e.id}
          onSetVerdi={(id, key, verdi) => { if (typeof id === 'string') return; onEndreFelt(id, key, verdi) }}
          onRowClick={(id, r) => onVelg(typeof id === 'string' ? r.__forelder : id)}
          radStil={e => (e.type === 'person' ? { background: 'var(--bg3)', fontSize: 12 } : e.id === valgt ? { background: 'var(--brandbg2)' } : e.type === 'fase' ? { fontWeight: 700 } : undefined)}
          rutenettRedigering
          klistreKolonnar={['namn']}
          prefsKey="liedlab-framdrift-tabell-v2"
          standardSynlegeKolonnar={standardSynlege}
          itemNamn="element"
          defaultSortering={{ key: 'start', dir: 'asc' }}
        />
      </div>
    </div>
  )
}
