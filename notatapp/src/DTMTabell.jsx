import { useCallback } from 'react'
import DataTabell, { Pille } from './DataTabell'
import { fmtDateShort } from './sakerKonstantar'
import { reknStatus } from './dtmKonstantar'

// ═══════════════════════════════════════════════════════════════════
//  DTM-matrisa — kolonnedefinisjonar og celle-visning for eitt «sett»
//  (éin kategori om gongen, sjå DTMModule.jsx). Same mønster som
//  SakerTabell/TeikningTabell: DataTabell gjer sjølve tabelljobben.
//
//  «rad» er ei dtm_dokumenter-rad. Felt som varierer med kategorien
//  (filnamn/rev/dato/lasta opp) vert lese frå rad[aktivtSett] — sjå
//  hentGjeldande() under.
// ═══════════════════════════════════════════════════════════════════

const PREFS_KEY = 'liedlab-dtm-tabell-v1'

const STATUS_FARGE = {
  'Siste versjon': 'var(--success)',
}

const BASE_COLUMNS = [
  { key:'nr',          label:'Nr.',          w:110, art:'tekst', mono:true, opnaFil:true },
  { key:'tittel',      label:'Tittel',       w:240, art:'tekst', utanFilter:true },
  { key:'status',      label:'Status',       w:190, art:'val',   utanFilter:true },
  { key:'rev',         label:'Rev.',         w:64,  art:'tekst', mono:true },
  { key:'dato',        label:'Dato',         w:96,  art:'tekst', mono:true },
  { key:'fag',         label:'Fag',          w:90,  art:'val' },
  { key:'fase',        label:'Fase',         w:120, art:'val',   standardSkjult:true },
  { key:'delprosjekt', label:'Delprosjekt',  w:130, art:'tekst', redigerbar:true },
  { key:'malestokk',   label:'Målestokk',    w:104, art:'tekst', standardSkjult:true },
  { key:'format',      label:'Format',       w:88,  art:'val',   standardSkjult:true },
  { key:'utarbeida_av',label:'Utarbeida av', w:126, art:'val' },
  { key:'ek_person',   label:'EK',           w:64,  art:'val',   standardSkjult:true },
  { key:'fk_person',   label:'FK',           w:64,  art:'val',   standardSkjult:true },
  { key:'lagra_av',    label:'Lagra av',     w:170, art:'val',   standardSkjult:true },
  { key:'lasta_opp',   label:'Lasta opp',    w:112, art:'dato',  mono:true },
]

function hentGjeldande(rad, aktivtSett) {
  return rad[aktivtSett] || {}
}

export default function DTMTabell({ dokumenter, aktivtSett, onSetVerdi, onOpneFil, eigneKolonnar = [] }) {
  const hentVerdi = useCallback((rad, key) => {
    const g = hentGjeldande(rad, aktivtSett)
    switch (key) {
      case 'nr':          return rad.nr || ''
      case 'tittel':      return rad.tittel || rad.nr || ''
      case 'status':      return reknStatus(rad, aktivtSett).join(', ')
      case 'rev':         return g.revisjon || ''
      case 'dato':        return g.dato || ''
      case 'fag':         return rad.fag || ''
      case 'fase':        return rad.fase || ''
      case 'delprosjekt': return rad.delprosjekt || ''
      case 'malestokk':   return rad.malestokk || ''
      case 'format':      return rad.format || ''
      case 'utarbeida_av':return rad.utarbeida_av || ''
      case 'ek_person':   return rad.ek_person || ''
      case 'fk_person':   return rad.fk_person || ''
      case 'lagra_av':    return rad.lagra_av || ''
      case 'lasta_opp':   return fmtDateShort(g.lasta_opp)
      default:            return String(rad.ekstra?.[key] ?? '')
    }
  }, [aktivtSett])

  const hentSorteringsverdi = useCallback((rad, key) => {
    const g = hentGjeldande(rad, aktivtSett)
    if (key === 'lasta_opp') return g.lasta_opp ? new Date(g.lasta_opp).getTime() : 0
    return undefined
  }, [aktivtSett])

  const lagCelle = useCallback((rad, kol) => {
    if (kol.key === 'tittel')
      return <span style={{ fontWeight:600, color:'var(--text)' }}>{rad.tittel || rad.nr}</span>
    if (kol.key === 'nr')
      return <span style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--brand)' }}>{rad.nr}</span>
    if (kol.key === 'status') {
      const taggar = reknStatus(rad, aktivtSett)
      if (!taggar.length) return <span style={{ color:'var(--text3)', opacity:.45 }}>—</span>
      return (
        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
          {taggar.map(t => <Pille key={t} tekst={t} farge={STATUS_FARGE[t]}/>)}
        </div>
      )
    }
    return undefined
  }, [aktivtSett])

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:300,
      border:'1.5px solid var(--border)', borderRadius:'var(--r2)', overflow:'hidden' }}>
      <DataTabell
        rader={dokumenter}
        kolonnar={BASE_COLUMNS}
        eigne={eigneKolonnar}
        hentVerdi={hentVerdi}
        hentSorteringsverdi={hentSorteringsverdi}
        lagCelle={lagCelle}
        radId={r => r.id}
        onSetVerdi={onSetVerdi}
        onOpneFil={onOpneFil}
        prefsKey={`${PREFS_KEY}:${aktivtSett}`}
        itemNamn="dokument"
        defaultSortering={{ key:'nr', dir:'asc' }}
      />
    </div>
  )
}
