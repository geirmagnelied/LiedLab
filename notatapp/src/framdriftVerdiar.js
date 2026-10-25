import { formaterDato } from './framdriftDato'
import { antalArbeidsdagar, harBorn, etterkommarar, pnsKart } from './framdriftLogikk'
import { effektivFerdig, faseFerdig } from './framdriftFerdig'
import { personDelar, snittpris } from './framdriftTimar'

// ═══════════════════════════════════════════════════════════════════
//  Kolonnar som kan visast i tabellen til venstre for tidslinja (høgreklikk på overskrifta → «Kolonnar»), og
//  verdiane deira. Same utrekningar som FramdriftTabell.jsx og Excel-eksporten.
// ═══════════════════════════════════════════════════════════════════

export const KOLONNE_DEF = [
  { key: 'pns',          label: 'PNS',          w: 64 },
  { key: 'kode',         label: 'Aktivitetskode', w: 104 },
  { key: 'type',         label: 'Type',         w: 84 },
  { key: 'fase',         label: 'Overordna',    w: 130 },
  { key: 'start',        label: 'Start',        w: 84 },
  { key: 'slutt',        label: 'Slutt',        w: 84 },
  { key: 'varig',        label: 'Dagar',        w: 56, hogre: true },
  { key: 'ansvarleg',    label: 'Ansvarleg',    w: 130 },
  { key: 'bemanning',    label: 'Bemanning',    w: 170 },
  { key: 'ferdig',       label: 'Ferdig %',     w: 70, hogre: true },
  { key: 'kpi',          label: 'KPI',          w: 56, hogre: true },
  { key: 'levnr',        label: 'Levering.',    w: 66, hogre: true },
  { key: 'btype',        label: 'Budsjettype',  w: 100 },
  { key: 'budsjett',     label: 'Budsjett kr',  w: 90, hogre: true },
  { key: 'timerate',     label: 'Timerate',     w: 76, hogre: true },
  { key: 'timar',        label: 'Timar',        w: 64, hogre: true },
  { key: 'palopTimar',   label: 'Påløpt t',     w: 72, hogre: true },
  { key: 'palopHonorar', label: 'Påløpt kostnad', w: 100, hogre: true },
  { key: 'gjenTimar',    label: 'Gjenst. timar', w: 90, hogre: true },
  { key: 'gjenBudsjett', label: 'Gjenst. budsjett', w: 110, hogre: true },
  { key: 'avh',          label: 'Forgjengere',  w: 150 },
  { key: 'etterf',       label: 'Etterfølgere', w: 150 },
]

const TYPE_NAMN = { fase: 'Fase', aktivitet: 'Aktivitet', milepael: 'Milepæl' }

// Kolonnar som kan redigerast direkte i tabellen (dobbeltklikk). Summasjonar/fasar: berre namn, kode og ansvarleg.
export const REDIGERBARE = new Set(['namn', 'kode', 'start', 'slutt', 'ansvarleg', 'ferdig', 'btype', 'budsjett', 'timerate', 'timar', 'palopTimar', 'palopHonorar'])
export const BTYPAR = ['', 'Fastpris', 'Budsjettpris', 'Ufakturerbart']

// KPI = (prosent av budsjett/fastprishonorar som er brukt) ÷ (prosent estimert framdrift). Under 0,9 = grøn, 0,9–1 = gul/oransje, over 1 = raud
// (pådraget ligg føre framdrifta). Utan budsjett vert prosent av planlagde timar brukt. '' = ikkje nok data, '∞' = pådrag utan framdrift.
export function beregnKpi({ budsjett, bruktKr, timar, bruktTimar, ferdig }) {
  let brukt = null
  if (budsjett > 0) brukt = (bruktKr / budsjett) * 100
  else if (timar > 0) brukt = (bruktTimar / timar) * 100
  if (brukt == null || !(brukt > 0)) return ''
  if (!(ferdig > 0)) return '∞'
  return Math.round((brukt / ferdig) * 100) / 100
}
export const kpiFarge = (v) => (v === '∞' ? '#B91C1C' : typeof v !== 'number' ? undefined : v > 1 ? '#B91C1C' : v >= 0.9 ? '#B45309' : '#166534')

export function bygVerdiar({ elementer, dokMap, prisar }) {
  const pns = pnsKart(elementer)
  const namnPaId = (id) => elementer.find(e => e.id === id)?.namn || ''
  const erSammen = (e) => e.type === 'fase' || (e.type === 'aktivitet' && (e.summ || harBorn(elementer, e.id)))
  const blad = (e) => etterkommarar(elementer, e.id).filter(c => c.type === 'aktivitet' && !harBorn(elementer, c.id))
  const rate = (e) => snittpris(e, prisar || new Map()).pris || 0
  const palopHon = (c) => (c.palopHonorar != null && c.palopHonorar !== '' ? +c.palopHonorar : (+c.palopTimar > 0 && rate(c) > 0 ? Math.round(+c.palopTimar * rate(c)) : 0))
  const sumBlad = (e, fn) => blad(e).reduce((a, c) => a + fn(c), 0)

  const verdi = (e, key) => {
    switch (key) {
      case 'namn': return e.namn
      case 'pns': return pns.get(e.id) || ''
      case 'kode': return e.kode || ''
      case 'type': return e.type === 'aktivitet' && erSammen(e) ? 'Summasjon' : TYPE_NAMN[e.type]
      case 'fase': return e.forelder != null ? namnPaId(e.forelder) : ''
      case 'start': return formaterDato(e.start)
      case 'slutt': return e.type === 'milepael' ? '' : formaterDato(e.slutt)
      case 'varig': return e.type === 'milepael' ? '' : antalArbeidsdagar(e)
      case 'ansvarleg': return e.ansvarleg || ''
      case 'bemanning': { const p = personDelar(e); return p.length ? p.map(x => x.namn + (p.length > 1 ? ' ' + Math.round(x.del * 10) / 10 + '%' : '')).join(', ') : '' }
      case 'ferdig': return e.type === 'aktivitet' ? effektivFerdig(e, dokMap) : e.type === 'fase' ? faseFerdig(elementer, e, dokMap) : ''
      case 'kpi': {
        if (e.type === 'milepael') return ''
        const sam = erSammen(e)
        return beregnKpi({
          budsjett: !sam ? (+e.budsjett || 0) : sumBlad(e, c => +c.budsjett || 0), bruktKr: !sam ? palopHon(e) : sumBlad(e, palopHon),
          timar: !sam ? (+e.timar || 0) : sumBlad(e, c => +c.timar || 0), bruktTimar: !sam ? (+e.palopTimar || 0) : sumBlad(e, c => +c.palopTimar || 0),
          ferdig: +verdi(e, 'ferdig') || 0,
        })
      }
      case 'levnr': return e.type === 'aktivitet' && !erSammen(e) ? ((e.leveransar || []).length || '') : ''
      case 'btype': return e.type === 'aktivitet' && !erSammen(e) ? (e.budsjettType || '') : ''
      case 'budsjett': return e.type === 'aktivitet' && !erSammen(e) ? (e.budsjett || '') : e.type !== 'milepael' ? (sumBlad(e, c => +c.budsjett || 0) || '') : ''
      case 'timerate': {
        if (e.type === 'milepael') return ''
        if (!erSammen(e)) return rate(e) ? Math.round(rate(e)) : ''
        const t = sumBlad(e, c => +c.timar || 0)
        return t > 0 ? (Math.round(sumBlad(e, c => (+c.timar || 0) * rate(c)) / t) || '') : ''
      }
      case 'timar': return e.type === 'milepael' ? '' : !erSammen(e) ? (e.timar || 0) : sumBlad(e, c => +c.timar || 0)
      case 'palopTimar': return e.type === 'milepael' ? '' : !erSammen(e) ? (e.palopTimar ?? '') : (sumBlad(e, c => +c.palopTimar || 0) || '')
      case 'palopHonorar': return e.type === 'milepael' ? '' : !erSammen(e) ? (palopHon(e) || '') : (sumBlad(e, palopHon) || '')
      case 'gjenTimar': {
        if (e.type === 'milepael') return ''
        const g = (c) => (+c.timar || 0) - (+c.palopTimar || 0)
        const v = !erSammen(e) ? ((+e.timar || +e.palopTimar) ? g(e) : '') : sumBlad(e, g)
        return v === '' ? '' : Math.round(v * 10) / 10
      }
      case 'gjenBudsjett': {
        if (e.type === 'milepael') return ''
        const g = (c) => (+c.budsjett || 0) - palopHon(c)
        const v = !erSammen(e) ? ((+e.budsjett || palopHon(e)) ? g(e) : '') : sumBlad(e, g)
        return v === '' || v === 0 ? (v === 0 && erSammen(e) ? '' : v) : Math.round(v)
      }
      case 'etterf': return elementer.filter(x => (x.avh || []).includes(e.id)).map(x => x.namn).join(', ')
      case 'avh': return (e.avh || []).map(namnPaId).filter(Boolean).join(', ')
      default: return ''
    }
  }
  return { verdi, pns, erSammen, blad }
}
