import { useCallback, useMemo, useState } from 'react'
import { addDays, getISOWeek, format } from 'date-fns'
import DataTabell from './DataTabell'
import { formaterDato, tilDato } from './framdriftDato'
import { antalArbeidsdagar, visingsrader, pnsKart, harBorn, etterkommarar } from './framdriftLogikk'
import { effektivFerdig, faseFerdig } from './framdriftFerdig'
import { personDelar, fordelTimar, snittpris } from './framdriftTimar'
import { vekeStart } from './kontorkalender'
import { personFarge } from './personFarge'

// ═══════════════════════════════════════════════════════════════════
//  Tabellvisinga av framdriftsplanen — tynn wrapper rundt DataTabell
//  (same mønster som SakerTabell/TeikningTabell). Kvar aktivitet med timar og
//  personar har ▸/▾ som viser person-UNDERRADER (kven som tek kor mange timar), og
//  vekekolonnar («Veke 42» …) viser timane per veke — for aktivitet, person og fase.
//  Sjølve flyttinga/avhengnadslogikken ligg i FramdriftModule.jsx (`onEndreFelt`).
// ═══════════════════════════════════════════════════════════════════

const TYPE_NAMN = { fase: 'Fase', aktivitet: 'Aktivitet', milepael: 'Milepæl', person: 'Person' }

const BASE_KOLONNAR = [
  { key: 'namn',      label: 'Namn',        art: 'tekst', redigerbar: true, w: 290, utanFilter: true },
  { key: 'pns',       label: 'PNS-nivå',    art: 'tekst', beregna: true, mono: true, w: 90, utanFilter: true },
  { key: 'kode',      label: 'Aktivitetskode', art: 'tekst', redigerbar: true, mono: true, w: 120, utanFilter: true },
  { key: 'type',      label: 'Type',        art: 'val',   beregna: true, w: 100 },
  { key: 'fase',      label: 'Overordna',   art: 'val',   beregna: true, w: 170 },
  { key: 'start',     label: 'Start',       art: 'tekst', redigerbar: true, mono: true, w: 110 },
  { key: 'slutt',     label: 'Slutt',       art: 'tekst', redigerbar: true, mono: true, w: 110 },
  { key: 'varig',     label: 'Arbeidsdagar', art: 'tal',  beregna: true, ikkjeSummer: true, w: 110 },
  { key: 'ansvarleg', label: 'Ansvarleg',   art: 'val',   redigerbar: true, w: 140 },
  { key: 'ferdig',    label: 'Ferdig %',    art: 'tal',   redigerbar: true, ikkjeSummer: true, w: 90 },
  { key: 'levnr',     label: 'Leveransar',  art: 'tal',   beregna: true, ikkjeSummer: true, w: 90 },
  { key: 'btype',     label: 'Budsjettype', art: 'val',   redigerbar: true, val: ['', 'Fastpris', 'Budsjettpris', 'Ufakturerbart'], w: 130 },
  { key: 'budsjett',  label: 'Budsjett kr', art: 'tal',   redigerbar: true, w: 110 },
  { key: 'timerate',  label: 'Timerate kr/t', art: 'tal', redigerbar: true, ikkjeSummer: true, w: 110 },
  { key: 'palopTimar', label: 'Påløpte timar', art: 'tal', redigerbar: true, w: 110 },
  { key: 'palopHonorar', label: 'Påløpt honorar kr', art: 'tal', redigerbar: true, w: 140 },
  { key: 'timar',     label: 'Timar',       art: 'tal',   redigerbar: true, w: 80 },
  { key: 'fordeling', label: 'Fordeling',   art: 'val',   redigerbar: true, val: ['Fast', 'Start', 'Midt', 'Slutt'], w: 100 },
  { key: 'avh',       label: 'Startar etter', art: 'tekst', beregna: true, utanFilter: true, w: 240 },
]

const fmtT = (n) => (n > 0 ? Math.round(n * 10) / 10 : '')
const UKE = 'uke_'

export default function FramdriftTabell({ dokMap, elementer, kal, valgt, onVelg, onEndreFelt, lukka = new Set(), onToggleLukka, prisar = new Map(), fargeKart }) {
  const [persTotOpen, setPersTotOpen] = useState(false)
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

  // Sum per person per veke over alle blad-aktivitetar: Map(namn → Map(veke → timar))
  const persTot = useMemo(() => {
    const kart = new Map()
    const foreldre = new Set(elementer.filter(e => e.forelder != null).map(e => e.forelder))
    for (const e of elementer) {
      if (e.type !== 'aktivitet' || foreldre.has(e.id) || !vekeKart.has(e.id)) continue
      for (const p of personDelar(e)) {
        if (!kart.has(p.namn)) kart.set(p.namn, new Map())
        const m = kart.get(p.namn)
        for (const [v, t] of vekeKart.get(e.id)) m.set(v, (m.get(v) || 0) + t * p.del / 100)
      }
    }
    return { kart, namn: [...kart.keys()].sort((a, b) => a.localeCompare(b, 'nb')) }
  }, [elementer, vekeKart])
  const kanUtvide = (e) => e.type === 'aktivitet' && +e.timar > 0 && personDelar(e).length > 0
  const rader = useMemo(() => {
    const ut = []
    for (const e of visingsrader(elementer, lukka)) {
      ut.push(e)
      if (utvida.has(e.id) && kanUtvide(e)) {
        personDelar(e).forEach((p) => ut.push({ id: `p:${e.id}:${p.namn}`, type: 'person', __forelder: e.id, namn: p.namn, del: p.del, farge: personFarge(p.namn, fargeKart), akt: e }))
      }
    }
    // «Timar per person» (alle aktivitetar): gruppe nedst, med éi rad per person
    if (persTot.namn.length) {
      ut.push({ id: 'pg', type: 'persongruppe', namn: 'Timar per person (alle aktivitetar)' })
      if (persTotOpen) persTot.namn.forEach(n => ut.push({ id: 'pt:' + n, type: 'persontot', __forelder: 'pg', namn: n, farge: personFarge(n, fargeKart) }))
    }
    return ut
  }, [elementer, utvida, lukka, persTot, persTotOpen, fargeKart])

  const pns = useMemo(() => pnsKart(elementer), [elementer])
  const erSammen = useCallback((e) => e.type === 'fase' || (e.type === 'aktivitet' && (e.summ || harBorn(elementer, e.id))), [elementer])
  // blad-aktivitetar under ein overordna (for summar)
  const bladUnder = useCallback((e) => etterkommarar(elementer, e.id).filter(c => c.type === 'aktivitet' && !harBorn(elementer, c.id)), [elementer])
  const rateFor = useCallback((e) => snittpris(e, prisar).pris || 0, [prisar])
  const palopHon = useCallback((c) => (c.palopHonorar != null && c.palopHonorar !== '' ? +c.palopHonorar : (+c.palopTimar > 0 && rateFor(c) > 0 ? Math.round(+c.palopTimar * rateFor(c)) : 0)), [rateFor])
  // ikkje-person-rader som er summar (fase/summasjonsaktivitet) vert ikkje summerte i totalraden (blad tel)
  const radGruppe = useMemo(() => ({ forelder: r => ((r.type === 'person' || r.type === 'persontot') ? r.__forelder : null), ikkjeISum: r => ['person', 'persongruppe', 'persontot'].includes(r.type) || erSammen(r) }), [erSammen])
  const toggle = (id) => setUtvida(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const utvidbare = elementer.filter(kanUtvide)
  const alleOpne = utvidbare.length > 0 && utvidbare.every(e => utvida.has(e.id))

  const vekeTimar = useCallback((e, v) => {
    if (e.type === 'persontot') return persTot.kart.get(e.namn)?.get(v) || 0
    if (e.type === 'persongruppe') return [...persTot.kart.values()].reduce((a, m) => a + (m.get(v) || 0), 0)
    if (e.type === 'aktivitet') return vekeKart.get(e.id)?.get(v) || 0
    if (e.type === 'person') return (vekeKart.get(e.akt.id)?.get(v) || 0) * e.del / 100
    if (e.type === 'fase' || (e.type === 'aktivitet' && erSammen(e))) return bladUnder(e).reduce((a, c) => a + (vekeKart.get(c.id)?.get(v) || 0), 0)
    return 0
  }, [vekeKart, elementer, erSammen, bladUnder, persTot])

  const hentVerdi = useCallback((e, key) => {
    if (key.startsWith(UKE)) return fmtT(vekeTimar(e, key.slice(UKE.length)))
    if (e.type === 'persongruppe') return key === 'namn' ? e.namn : ''
    if (e.type === 'persontot') {
      if (key === 'namn') return e.namn
      if (key === 'type') return 'Sum person'
      if (key === 'timar') return fmtT([...(persTot.kart.get(e.namn)?.values() || [])].reduce((a, b) => a + b, 0))
      return ''
    }
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
      case 'pns': return pns.get(e.id) || ''
      case 'kode': return e.kode || ''
      case 'type': return e.type === 'aktivitet' && erSammen(e) ? 'Summasjon' : TYPE_NAMN[e.type]
      case 'fase': return e.forelder != null ? namnPaId(e.forelder) : ''
      case 'start': return formaterDato(e.start)
      case 'slutt': return formaterDato(e.slutt)
      case 'varig': return e.type === 'milepael' ? '' : antalArbeidsdagar(e)
      case 'ansvarleg': { const p = personDelar(e); return (e.personar || []).length ? p.map(x => x.namn + (p.length > 1 ? ' ' + x.del + '%' : '')).join(', ') : (e.ansvarleg || '') }
      case 'ferdig': return e.type === 'aktivitet' ? effektivFerdig(e, dokMap) : e.type === 'fase' ? faseFerdig(elementer, e, dokMap) : ''
      case 'btype': return e.type === 'aktivitet' && !erSammen(e) ? (e.budsjettType || '') : ''
      case 'budsjett': return e.type === 'aktivitet' && !erSammen(e) ? (e.budsjett || '') : e.type !== 'milepael' ? (bladUnder(e).reduce((a, c) => a + (+c.budsjett || 0), 0) || '') : ''
      case 'timerate': {
        if (e.type === 'milepael') return ''
        if (!erSammen(e)) return rateFor(e) ? Math.round(rateFor(e)) : ''
        const b = bladUnder(e); const t = b.reduce((a, c) => a + (+c.timar || 0), 0)
        return t > 0 ? (Math.round(b.reduce((a, c) => a + (+c.timar || 0) * rateFor(c), 0) / t) || '') : ''
      }
      case 'palopTimar': return e.type === 'milepael' ? '' : !erSammen(e) ? (e.palopTimar ?? '') : (bladUnder(e).reduce((a, c) => a + (+c.palopTimar || 0), 0) || '')
      case 'palopHonorar': return e.type === 'milepael' ? '' : !erSammen(e) ? (palopHon(e) || '') : (bladUnder(e).reduce((a, c) => a + palopHon(c), 0) || '')
      case 'levnr': return e.type === 'aktivitet' ? ((e.leveransar || []).length || '') : ''
      case 'timar': return e.type === 'milepael' ? '' : !erSammen(e) ? (e.timar || 0) : bladUnder(e).reduce((a, c) => a + (+c.timar || 0), 0)
      case 'fordeling': return e.type === 'aktivitet' && e.timar > 0 ? ({ fast: 'Fast', start: 'Start', midt: 'Midt', slutt: 'Slutt' }[e.fordeling || 'fast']) : ''
      case 'avh': return (e.avh || []).map(namnPaId).filter(Boolean).join(', ')
      default: return ''
    }
  }, [namnPaId, dokMap, elementer, vekeTimar, pns, erSammen, bladUnder, rateFor, palopHon, persTot])

  // Namnecella: ▸/▾ for å vise/skjule person-underradene; person-rader får innrykk og fargeprikk
  const lagCelle = useCallback((e, kol) => {
    if (kol.key !== 'namn') return undefined
    if (e.type === 'persongruppe') {
      return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
        <span role="button" title="Vis/skjul sum per person" onClick={ev => { ev.stopPropagation(); setPersTotOpen(v => !v) }} onMouseDown={ev => ev.stopPropagation()}
          style={{ cursor: 'pointer', width: 16, textAlign: 'center', color: 'var(--brand)', fontSize: 12, userSelect: 'none' }}>{persTotOpen ? '▾' : '▸'}</span>{e.namn}</span>
    }
    if (e.type === 'persontot') {
      return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, paddingLeft: 26, color: 'var(--text2)' }}>
        <span style={{ width: 9, height: 9, borderRadius: 3, background: e.farge, flexShrink: 0 }}/>Sum {e.namn}</span>
    }
    if (e.type === 'person') {
      return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, paddingLeft: 26, color: 'var(--text2)' }}>
        <span style={{ width: 9, height: 9, borderRadius: 3, background: e.farge, flexShrink: 0 }}/>{e.namn}
        {e.akt.personar?.length > 1 && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{e.del}%</span>}
      </span>
    }
    const innrykk = (e.nivå || 0) * 16
    if (harBorn(elementer, e.id) && e.type !== 'milepael') {
      const lukkaNo = lukka.has(e.id)
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, paddingLeft: innrykk, fontWeight: 700 }}>
          <span role="button" title={lukkaNo ? 'Vis underaktivitetar' : 'Skjul underaktivitetar'} onClick={ev => { ev.stopPropagation(); onToggleLukka?.(e.id) }} onMouseDown={ev => ev.stopPropagation()}
            style={{ cursor: 'pointer', width: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 12, userSelect: 'none' }}>{lukkaNo ? '▸' : '▾'}</span>
          {erSammen(e) && e.type === 'aktivitet' && <span title="Summasjonsaktivitet" style={{ color: 'var(--brand)', fontSize: 12 }}>∑</span>}
          {e.namn}
        </span>
      )
    }
    if (!kanUtvide(e)) return innrykk ? <span style={{ paddingLeft: innrykk + 22 }}>{e.type === 'aktivitet' && e.summ ? <span title="Summasjonsaktivitet" style={{ color: 'var(--brand)', fontSize: 12, marginRight: 4 }}>∑</span> : null}{e.namn}</span> : (e.summ ? <span style={{ paddingLeft: 22 }}><span style={{ color: 'var(--brand)', fontSize: 12, marginRight: 4 }}>∑</span>{e.namn}</span> : undefined)
    const ope = utvida.has(e.id)
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, paddingLeft: innrykk }}>
        <span role="button" title={ope ? 'Skjul personar' : 'Vis personar og timefordeling'}
          onClick={ev => { ev.stopPropagation(); toggle(e.id) }} onMouseDown={ev => ev.stopPropagation()}
          style={{ cursor: 'pointer', width: 16, textAlign: 'center', color: 'var(--brand)', fontSize: 12, userSelect: 'none' }}>{ope ? '▾' : '▸'}</span>
        {e.namn}
        <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>({personDelar(e).length})</span>
      </span>
    )
  }, [utvida, lukka, elementer, erSammen, onToggleLukka, persTotOpen])

  const hentSorteringsverdi = useCallback((e, key) => {
    if (key.startsWith(UKE)) return vekeTimar(e, key.slice(UKE.length))
    if (e.type === 'person') return key === 'timar' ? (+e.akt.timar || 0) * e.del / 100 : undefined
    if (key === 'pns') return e.type === 'persongruppe' || e.type === 'persontot' ? 'zzz' : (pns.get(e.id) || '')
    if (e.type === 'persontot') return key === 'timar' ? [...(persTot.kart.get(e.namn)?.values() || [])].reduce((a, b) => a + b, 0) : (key.startsWith(UKE) ? vekeTimar(e, key.slice(UKE.length)) : undefined)
    if (key === 'start') return e.start
    if (key === 'slutt') return e.slutt
    return undefined
  }, [vekeTimar, pns, persTot])

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
          onRowClick={(id, r) => { if (typeof id === 'string') { if (r.type === 'person') onVelg(r.__forelder) } else onVelg(id) }}
          radStil={e => (e.type === 'persongruppe' ? { background: 'var(--bg3)', fontWeight: 700 } : e.type === 'persontot' ? { background: 'var(--bg3)', fontSize: 12 } : e.type === 'person' ? { background: 'var(--bg3)', fontSize: 12 } : e.id === valgt ? { background: 'var(--brandbg2)' } : erSammen(e) ? { fontWeight: 700, background: 'var(--bg3)' } : undefined)}
          rutenettRedigering
          klistreKolonnar={['namn']}
          prefsKey="liedlab-framdrift-tabell-v3"
          standardSynlegeKolonnar={standardSynlege}
          itemNamn="element"
          defaultSortering={{ key: 'pns', dir: 'asc' }}
        />
      </div>
    </div>
  )
}
