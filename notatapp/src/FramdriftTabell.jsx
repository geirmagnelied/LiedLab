import { useCallback, useMemo, useState } from 'react'
import { addDays, getISOWeek, format } from 'date-fns'
import DataTabell from './DataTabell'
import { formaterDato, tilDato } from './framdriftDato'
import { antalArbeidsdagar, visingsrader, pnsKart, harBorn, etterkommarar } from './framdriftLogikk'
import { effektivFerdig, faseFerdig } from './framdriftFerdig'
import { personDelar, fordelTimar, snittpris, prisFor } from './framdriftTimar'
import { vekeStart } from './kontorkalender'
import { personFarge } from './personFarge'
import { personerMedForbruk, faktiskFor, nokkelNamn } from './framdriftForbruk'

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
  { key: 'ansvarleg', label: 'Ansvarleg',   art: 'val',   redigerbar: true, w: 150 },
  { key: 'bemanning', label: 'Bemanning',   art: 'tekst', beregna: true, w: 190, utanFilter: true },
  { key: 'ferdig',    label: 'Ferdig %',    art: 'tal',   redigerbar: true, ikkjeSummer: true, w: 90 },
  { key: 'levnr',     label: 'Leveransar',  art: 'tal',   beregna: true, ikkjeSummer: true, w: 90 },
  { key: 'btype',     label: 'Budsjettype', art: 'val',   redigerbar: true, val: ['', 'Fastpris', 'Budsjettpris', 'Ufakturerbart'], w: 130 },
  { key: 'budsjett',  label: 'Budsjett kr', art: 'tal',   redigerbar: true, w: 110 },
  { key: 'timerate',  label: 'Timerate kr/t', art: 'tal', redigerbar: true, ikkjeSummer: true, w: 110 },
  { key: 'palopTimar', label: 'Påløpte timar', art: 'tal', redigerbar: true, w: 110 },
  { key: 'palopHonorar', label: 'Påløpt kostnad kr', art: 'tal', redigerbar: true, w: 140 },
  { key: 'gjenTimar', label: 'Gjenstående timar', art: 'tal', beregna: true, w: 120 },
  { key: 'gjenBudsjett', label: 'Gjenstående budsjett kr', art: 'tal', beregna: true, w: 150 },
  { key: 'timar',     label: 'Timar',       art: 'tal',   redigerbar: true, w: 80 },
  { key: 'fordeling', label: 'Fordeling',   art: 'val',   redigerbar: true, val: ['Fast', 'Start', 'Midt', 'Slutt'], w: 100 },
  { key: 'avh',       label: 'Startar etter', art: 'tekst', beregna: true, utanFilter: true, w: 240 },
]

const fmtT = (n) => (n > 0 ? Math.round(n * 10) / 10 : '')
const UKE = 'uke_'

export default function FramdriftTabell({ dokMap, elementer, kal, valgt, onVelg, onEndreFelt, lukka = new Set(), onToggleLukka, prisar = new Map(), fargeKart, forbrukKart, personell = [], eining = 'timar', delsummer = false }) {
  const [vekeVisn, setVekeVisn] = useState('plan') // plan | palopt | begge — kva vekekolonnane viser
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
    if (forbrukKart) for (const a of forbrukKart.values()) for (const v of a.veke.keys()) alle.add(v)
    if (!alle.size) return []
    const s = [...alle].sort()
    const ut = []
    for (let d = vekeStart(tilDato(s[0])); d <= tilDato(s[s.length - 1]); d = addDays(d, 7)) ut.push(format(d, 'yyyy-MM-dd'))
    return ut
  }, [vekeKart, forbrukKart])

  // «Ansvarleg» vert vald frå personellet i prosjektet (ikkje fri tekst)
  const personNamn = useMemo(() => [...new Set((personell || []).map(p => p.namn).filter(Boolean))], [personell])
  const kolonnar = useMemo(() => [
    ...BASE_KOLONNAR.map(k => (k.key === 'ansvarleg' ? { ...k, val: ['', ...personNamn, ...new Set(elementer.map(e => e.ansvarleg).filter(a => a && !personNamn.includes(a)))] } : k)),
    ...veker.map(v => ({ key: UKE + v, label: 'Veke ' + getISOWeek(tilDato(v)), overskrift: ['Veke ' + getISOWeek(tilDato(v)), format(tilDato(v), 'dd.MM')],
      art: 'tal', beregna: true, w: 62, mono: true })),
  ], [veker, personNamn, elementer])

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
  const personerFor = (e) => personerMedForbruk(personDelar(e), forbrukKart?.get(e.id))
  const kanUtvide = (e) => e.type === 'aktivitet' && ((+e.timar > 0 && personDelar(e).length > 0) || !!forbrukKart?.has(e.id))
  const rader = useMemo(() => {
    const ut = []
    const stabel = []   // opne overordna (med synlege born) — får ei «Sum»-linje når gruppa er slutt
    const avslutt = (nivaa) => { while (stabel.length && stabel[stabel.length - 1].nivå >= nivaa) { const p = stabel.pop(); ut.push({ id: 'ds:' + p.id, type: 'delsum', src: p, nivå: p.nivå, namn: 'Sum ' + p.namn }) } }
    for (const e of visingsrader(elementer, lukka)) {
      if (delsummer) avslutt(e.nivå)
      ut.push(e)
      if (utvida.has(e.id) && kanUtvide(e)) {
        personerFor(e).forEach((p) => ut.push({ id: `p:${e.id}:${p.namn}`, type: 'person', __forelder: e.id, namn: p.namn, del: p.del, farge: personFarge(p.namn, fargeKart), akt: e }))
      }
      if (delsummer && e.type !== 'milepael' && harBorn(elementer, e.id) && !lukka.has(e.id)) stabel.push(e)
    }
    if (delsummer) avslutt(-1)
    // «Timar per person» (alle aktivitetar): gruppe nedst, med éi rad per person
    if (persTot.namn.length) {
      ut.push({ id: 'pg', type: 'persongruppe', namn: 'Timar per person (alle aktivitetar)' })
      if (persTotOpen) persTot.namn.forEach(n => ut.push({ id: 'pt:' + n, type: 'persontot', __forelder: 'pg', namn: n, farge: personFarge(n, fargeKart) }))
    }
    return ut
  }, [elementer, utvida, lukka, persTot, persTotOpen, fargeKart, forbrukKart, delsummer])

  const pns = useMemo(() => pnsKart(elementer), [elementer])
  const erSammen = useCallback((e) => e.type === 'fase' || (e.type === 'aktivitet' && (e.summ || harBorn(elementer, e.id))), [elementer])
  // blad-aktivitetar under ein overordna (for summar)
  const bladUnder = useCallback((e) => etterkommarar(elementer, e.id).filter(c => c.type === 'aktivitet' && !harBorn(elementer, c.id)), [elementer])
  const rateFor = useCallback((e) => snittpris(e, prisar).pris || 0, [prisar])
  const palopHon = useCallback((c) => (c.palopHonorar != null && c.palopHonorar !== '' ? +c.palopHonorar : (+c.palopTimar > 0 && rateFor(c) > 0 ? Math.round(+c.palopTimar * rateFor(c)) : 0)), [rateFor])
  // ikkje-person-rader som er summar (fase/summasjonsaktivitet) vert ikkje summerte i totalraden (blad tel)
  const radGruppe = useMemo(() => ({ forelder: r => ((r.type === 'person' || r.type === 'persontot') ? r.__forelder : null), ikkjeISum: r => ['person', 'persongruppe', 'persontot', 'delsum'].includes(r.type) || erSammen(r) }), [erSammen])
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

  const vekeFaktisk = useCallback((e, v) => {
    if (!forbrukKart) return 0
    if (e.type === 'aktivitet' && !erSammen(e)) return forbrukKart.get(e.id)?.veke.get(v) || 0
    if (e.type === 'person') return faktiskFor(forbrukKart.get(e.akt.id), e.namn)?.veke.get(v) || 0
    if (e.type === 'fase' || e.type === 'aktivitet') return bladUnder(e).reduce((a, c) => a + (forbrukKart.get(c.id)?.veke.get(v) || 0), 0)
    return 0
  }, [forbrukKart, erSammen, bladUnder])
  // ── Honorar (kr) per veke = timar × timerate. Planlagt: snittrate for aktiviteten (eller personen sin rate); påløpt: kvar person sin rate ──
  const personRate = useCallback((namn, akt) => {
    const d = personDelar(akt).find(x => nokkelNamn(x.namn) === nokkelNamn(namn))
    return (d ? prisFor(d, prisar) : (prisar.get((namn || '').toLowerCase()) || 0)) || rateFor(akt)
  }, [prisar, rateFor])
  const honorarPlan = useCallback((e, v) => {
    if (e.type === 'persontot') return (persTot.kart.get(e.namn)?.get(v) || 0) * (prisar.get((e.namn || '').toLowerCase()) || 0)
    if (e.type === 'persongruppe') return [...persTot.kart.entries()].reduce((a, [n, m]) => a + (m.get(v) || 0) * (prisar.get((n || '').toLowerCase()) || 0), 0)
    if (e.type === 'person') return (vekeKart.get(e.akt.id)?.get(v) || 0) * e.del / 100 * personRate(e.namn, e.akt)
    if (e.type === 'aktivitet' && !erSammen(e)) return (vekeKart.get(e.id)?.get(v) || 0) * rateFor(e)
    if (e.type === 'fase' || e.type === 'aktivitet') return bladUnder(e).reduce((a, c) => a + (vekeKart.get(c.id)?.get(v) || 0) * rateFor(c), 0)
    return 0
  }, [persTot, prisar, vekeKart, erSammen, bladUnder, rateFor, personRate])
  const honorarFaktiskLeaf = useCallback((c, v) => {
    const a = forbrukKart?.get(c.id); if (!a) return 0
    let sum = 0
    for (const [namn, p] of a.personer) sum += (p.veke.get(v) || 0) * personRate(namn, c)
    return sum
  }, [forbrukKart, personRate])
  const honorarFaktisk = useCallback((e, v) => {
    if (!forbrukKart) return 0
    if (e.type === 'person') return (faktiskFor(forbrukKart.get(e.akt.id), e.namn)?.veke.get(v) || 0) * personRate(e.namn, e.akt)
    if (e.type === 'aktivitet' && !erSammen(e)) return honorarFaktiskLeaf(e, v)
    if (e.type === 'fase' || e.type === 'aktivitet') return bladUnder(e).reduce((a, c) => a + honorarFaktiskLeaf(c, v), 0)
    return 0
  }, [forbrukKart, erSammen, bladUnder, honorarFaktiskLeaf, personRate])
  const fmtKr = (n) => (n > 0 ? Math.round(n) : '')
  const vekeCelle = (e0, v) => {
    const e = e0.type === 'delsum' ? e0.src : e0
    const honorar = eining === 'honorar'
    const p = honorar ? honorarPlan(e, v) : vekeTimar(e, v), f = honorar ? honorarFaktisk(e, v) : vekeFaktisk(e, v)
    const fm = honorar ? fmtKr : fmtT
    if (vekeVisn === 'plan') return fm(p)
    if (vekeVisn === 'palopt') return fm(f)
    return p || f ? (fm(p) || '–') + ' / ' + (fm(f) || '–') : ''
  }
  const hentVerdi = useCallback((e, key) => {
    if (e.type === 'delsum') {
      if (key.startsWith(UKE)) return vekeCelle(e, key.slice(UKE.length))
      if (key === 'namn') return e.namn
      if (key === 'type') return 'Delsum'
      if (key === 'pns') return pns.get(e.src.id) || ''
      if (['timar', 'budsjett', 'timerate', 'palopTimar', 'palopHonorar', 'gjenTimar', 'gjenBudsjett'].includes(key)) return hentVerdi(e.src, key)
      return ''
    }
    if (key.startsWith(UKE)) return vekeCelle(e, key.slice(UKE.length))
    if (e.type === 'persongruppe') return key === 'namn' ? e.namn : ''
    if (e.type === 'persontot') {
      if (key === 'namn') return e.namn
      if (key === 'type') return 'Sum person'
      if (key === 'timar') return fmtT([...(persTot.kart.get(e.namn)?.values() || [])].reduce((a, b) => a + b, 0))
      return ''
    }
    if (e.type === 'person') {
      switch (key) {
        case 'palopTimar': { const f = faktiskFor(forbrukKart?.get(e.akt.id), e.namn); return f ? fmtT(f.total) : '' }
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
      case 'ansvarleg': return e.ansvarleg || ''
      case 'bemanning': { const p = personDelar(e); return p.length ? p.map(x => x.namn + (p.length > 1 ? ' ' + Math.round(x.del * 10) / 10 + '%' : '')).join(', ') : '' }
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
      case 'gjenTimar': {
        if (e.type === 'milepael') return ''
        const g = (c) => (+c.timar || 0) - (+c.palopTimar || 0)
        const v = !erSammen(e) ? ((+e.timar || +e.palopTimar) ? g(e) : '') : bladUnder(e).reduce((a, c) => a + g(c), 0)
        return v === '' ? '' : Math.round(v * 10) / 10
      }
      case 'gjenBudsjett': {
        if (e.type === 'milepael') return ''
        const g = (c) => (+c.budsjett || 0) - palopHon(c)
        const v = !erSammen(e) ? ((+e.budsjett || palopHon(e)) ? g(e) : '') : bladUnder(e).reduce((a, c) => a + g(c), 0)
        return v === '' ? '' : Math.round(v)
      }
      case 'palopHonorar': return e.type === 'milepael' ? '' : !erSammen(e) ? (palopHon(e) || '') : (bladUnder(e).reduce((a, c) => a + palopHon(c), 0) || '')
      case 'levnr': return e.type === 'aktivitet' ? ((e.leveransar || []).length || '') : ''
      case 'timar': return e.type === 'milepael' ? '' : !erSammen(e) ? (e.timar || 0) : bladUnder(e).reduce((a, c) => a + (+c.timar || 0), 0)
      case 'fordeling': return e.type === 'aktivitet' && e.timar > 0 ? ({ fast: 'Fast', start: 'Start', midt: 'Midt', slutt: 'Slutt' }[e.fordeling || 'fast']) : ''
      case 'avh': return (e.avh || []).map(namnPaId).filter(Boolean).join(', ')
      default: return ''
    }
  }, [namnPaId, dokMap, elementer, vekeTimar, vekeFaktisk, vekeVisn, forbrukKart, pns, erSammen, bladUnder, rateFor, palopHon, persTot, eining, honorarPlan, honorarFaktisk])

  // Namnecella: ▸/▾ for å vise/skjule person-underradene; person-rader får innrykk og fargeprikk
  const lagCelle = useCallback((e, kol) => {
    if (kol.key !== 'namn') return undefined
    if (e.type === 'delsum') return <span style={{ paddingLeft: (e.nivå || 0) * 16 + 22, fontWeight: 800, color: 'var(--brand)' }}>∑ {e.namn}</span>
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
        {e.akt.personar?.length > 1 && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{Math.round(e.del * 10) / 10}%</span>}
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
    if (e.type === 'delsum') return key === 'pns' ? (pns.get(e.src.id) || '') + '.zzz' : undefined
    if (key.startsWith(UKE)) return vekeVisn === 'palopt' ? vekeFaktisk(e, key.slice(UKE.length)) : vekeTimar(e, key.slice(UKE.length))
    if (e.type === 'person') return key === 'timar' ? (+e.akt.timar || 0) * e.del / 100 : undefined
    if (key === 'pns') return e.type === 'persongruppe' || e.type === 'persontot' ? 'zzz' : (pns.get(e.id) || '')
    if (e.type === 'persontot') return key === 'timar' ? [...(persTot.kart.get(e.namn)?.values() || [])].reduce((a, b) => a + b, 0) : (key.startsWith(UKE) ? vekeTimar(e, key.slice(UKE.length)) : undefined)
    if (key === 'start') return e.start
    if (key === 'slutt') return e.slutt
    return undefined
  }, [vekeTimar, pns, persTot, vekeVisn, vekeFaktisk])

  const hentRedigerVerdi = useCallback((e, key) => {
    if (key === 'start') return formaterDato(e.start)
    if (key === 'slutt') return formaterDato(e.slutt)
    if (key === 'ansvarleg') return e.ansvarleg || ''
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
        <div className="fd-seg" title="Kva vekekolonnane viser">
          {[['plan', 'Planlagt'], ['palopt', 'Påløpt'], ['begge', 'Plan / påløpt']].map(([k, t]) => <button key={k} className={vekeVisn === k ? 'pa' : ''} onClick={() => setVekeVisn(k)}>{t}</button>)}
        </div>
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
          onRowClick={(id, r) => { if (typeof id === 'string') { if (r.type === 'person') onVelg(r.__forelder); else if (r.type === 'delsum') onVelg(r.src.id) } else onVelg(id) }}
          radStil={e => (e.type === 'delsum' ? { background: 'var(--bg3)', fontWeight: 700, boxShadow: 'inset 0 1px 0 var(--border)' } : e.type === 'persongruppe' ? { background: 'var(--bg3)', fontWeight: 700 } : e.type === 'persontot' ? { background: 'var(--bg3)', fontSize: 12 } : e.type === 'person' ? { background: 'var(--bg3)', fontSize: 12 } : e.id === valgt ? { background: 'var(--brandbg2)' } : erSammen(e) ? { fontWeight: 700, background: 'var(--bg3)' } : undefined)}
          rutenettRedigering
          klistreKolonnar={['namn']}
          bryttOverskrift
          prefsKey="liedlab-framdrift-tabell-v3"
          standardSynlegeKolonnar={standardSynlege}
          itemNamn="element"
          defaultSortering={{ key: 'pns', dir: 'asc' }}
        />
      </div>
    </div>
  )
}
