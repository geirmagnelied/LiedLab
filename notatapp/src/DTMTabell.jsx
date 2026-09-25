import { useCallback } from 'react'
import DataTabell, { Pille } from './DataTabell'
import { fmtDateShort } from './sakerKonstantar'
import { reknStatus, løysAktivtSett, KATEGORI_LABEL, KATEGORI_MAPPE, FERDIGSTILLING_STATUS, utsendingsnrTekst } from './dtmKonstantar'

// ═══════════════════════════════════════════════════════════════════
//  DTM-matrisa — kolonnedefinisjonar og celle-visning for eitt «sett»
//  (éin kategori, eller «alle», sjå DTMModule.jsx). Same mønster som
//  SakerTabell/TeikningTabell: DataTabell gjer sjølve tabelljobben.
//
//  «rad» er ei dtm_dokumenter-rad. Felt som varierer med kategorien
//  (filnamn/rev/dato/lasta opp) vert lese frå rad[løystSett] — sjå
//  hentGjeldande() under. I «alle»-settet løyser løysAktivtSett() kvar
//  rad til kategorien med nyaste opplasting (finnGjeldandeKategori).
// ═══════════════════════════════════════════════════════════════════

const PREFS_KEY = 'liedlab-dtm-tabell-v1'

const STATUS_FARGE = {
  'Siste versjon': 'var(--success)',
}

// Alle kolonnar er synlege som standard (brukar sitt eige krav 25. sept.
// 2026: «legg inn alle kolonnene med info frå skanninga inn i tabellen
// som standard visning») — ingen `standardSkjult` lenger.
const BASE_COLUMNS = [
  { key:'nr',          label:'Dokumentnummer', art:'tekst', mono:true, opnaFil:true },
  { key:'tittel',      label:'Tittel',       art:'tekst', utanFilter:true, opnaFil:true },
  { key:'kategori',    label:'Kategori',     art:'val',   beregna:true },
  { key:'status',      label:'Status',       art:'val',   utanFilter:true, beregna:true },
  { key:'filtype',     label:'Filtype',      art:'val',   mono:true, beregna:true },
  { key:'rev',         label:'Rev.',         art:'tekst', mono:true, beregna:true },
  { key:'dato',        label:'Dato',         art:'tekst', mono:true, beregna:true },
  { key:'revisjonsbeskriving', label:'Revisjonsskildring', art:'tekst', utanFilter:true },
  { key:'tegningsformal', label:'Tegningsformål', art:'val' },
  { key:'fag',         label:'Fag',          art:'val' },
  { key:'oppdragsgivar',label:'Oppdragsgivar',art:'val' },
  { key:'tiltakshavar',label:'Tiltakshavar', art:'val' },
  { key:'fase',        label:'Fase',         art:'val' },
  { key:'delprosjekt', label:'Delprosjekt',  art:'tekst', redigerbar:true },
  { key:'ferdigstillingsstatus', label:'Status ved ferdigstilling', art:'val', redigerbar:true, val:['', ...FERDIGSTILLING_STATUS] },
  { key:'malestokk',   label:'Målestokk',    art:'tekst' },
  { key:'format',      label:'Arkstørrelse', art:'val' },
  { key:'utarbeida_av',label:'Utarbeida av', art:'val' },
  { key:'fk_person',   label:'Fagkontroll',  art:'val' },
  { key:'godkjent_av', label:'Godkjent',     art:'val' },
  { key:'oppdragsnr',  label:'Oppdragsnr.',  art:'tekst', mono:true },
  { key:'lagra_av',    label:'Lagra av',     art:'val',   beregna:true },
  { key:'lasta_opp',   label:'Lasta opp',    art:'dato',  mono:true, beregna:true },
  { key:'utsendingar', label:'Utsendingar',  art:'tekst', utanFilter:true, beregna:true },
  { key:'filsti',      label:'Filsti',       art:'tekst', utanFilter:true, mono:true, maksInnhaldsBreidd:Infinity, beregna:true },
]

function hentGjeldande(rad, aktivtSett) {
  const sett = løysAktivtSett(rad, aktivtSett)
  return { sett, g: (sett && rad[sett]) || {} }
}

export default function DTMTabell({ dokumenter, aktivtSett, onSetVerdi, onOpneFil, onDelFil,
                                     onToggleFavorite, onTogglePinned, onRegistrerUtsending,
                                     merking, oppdragsSti, eigneKolonnar = [], utsendingarPerDokument = {} }) {
  const hentVerdi = useCallback((rad, key) => {
    const { sett, g } = hentGjeldande(rad, aktivtSett)
    switch (key) {
      case 'nr':          return rad.nr || ''
      case 'tittel':      return rad.tittel || rad.nr || ''
      case 'kategori':    return sett ? KATEGORI_LABEL[sett] : ''
      case 'status':      return sett ? reknStatus(rad, sett).join(', ') : ''
      case 'filtype': {
        const m = /\.([a-z0-9]+)$/i.exec(g.filnamn || '')
        return m ? m[1].toUpperCase() : ''
      }
      case 'rev':         return g.revisjon || ''
      case 'dato':        return g.dato || ''
      case 'revisjonsbeskriving': return rad.revisjonsbeskriving || ''
      case 'tegningsformal': return rad.tegningsformal || ''
      case 'fag':         return rad.fag || ''
      case 'fase':        return rad.fase || ''
      case 'delprosjekt': return rad.delprosjekt || ''
      case 'ferdigstillingsstatus': return rad.ferdigstillingsstatus || ''
      case 'malestokk':   return rad.malestokk || ''
      case 'format':      return rad.format || ''
      case 'utarbeida_av':return rad.utarbeida_av || ''
      case 'fk_person':   return rad.fk_person || ''
      case 'godkjent_av': return rad.godkjent_av || ''
      case 'oppdragsgivar': return rad.oppdragsgivar || ''
      case 'tiltakshavar':  return rad.tiltakshavar || ''
      case 'oppdragsnr':    return rad.oppdragsnr || ''
      case 'lagra_av':    return rad.lagra_av || ''
      case 'lasta_opp':   return fmtDateShort(g.lasta_opp)
      case 'utsendingar': return (utsendingarPerDokument[rad.id] || [])
        .map(u => `${utsendingsnrTekst(u.utsendingsnr)} (${fmtDateShort(u.dato)})`).join(', ')
      case 'filsti':       return (sett && g.filnamn && oppdragsSti) ? `${oppdragsSti}\\${KATEGORI_MAPPE[sett]}\\${g.filnamn}` : ''
      default:            return String(rad.ekstra?.[key] ?? '')
    }
  }, [aktivtSett, oppdragsSti, utsendingarPerDokument])

  const hentSorteringsverdi = useCallback((rad, key) => {
    const { g } = hentGjeldande(rad, aktivtSett)
    if (key === 'lasta_opp') return g.lasta_opp ? new Date(g.lasta_opp).getTime() : 0
    return undefined
  }, [aktivtSett])

  const lagCelle = useCallback((rad, kol) => {
    if (kol.key === 'tittel')
      return <span style={{ fontWeight:600, color:'var(--text)' }}>{rad.tittel || rad.nr}</span>
    if (kol.key === 'nr')
      return <span style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--brand)' }}>{rad.nr}</span>
    if (kol.key === 'status') {
      const { sett } = hentGjeldande(rad, aktivtSett)
      const taggar = sett ? reknStatus(rad, sett) : []
      if (!taggar.length) return <span style={{ color:'var(--text3)', opacity:.45 }}>—</span>
      return (
        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
          {taggar.map(t => <Pille key={t} tekst={t} farge={STATUS_FARGE[t]}/>)}
        </div>
      )
    }
    if (kol.key === 'utsendingar') {
      const liste = utsendingarPerDokument[rad.id] || []
      if (!liste.length) return <span style={{ color:'var(--text3)', opacity:.45 }}>—</span>
      return (
        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
          {liste.map(u => (
            <Pille key={u.id} tekst={`${utsendingsnrTekst(u.utsendingsnr)} · ${fmtDateShort(u.dato)}`} farge="var(--success)"/>
          ))}
        </div>
      )
    }
    return undefined
  }, [aktivtSett, utsendingarPerDokument])

  // Radmeny (☰): favoritt/fest-til-topp (same generiske mønster som
  // notat-tabellen) + «Del fil»/«Registrer utsending» (via radMeny.ekstraVal).
  const ekstraVal = []
  if (onDelFil) ekstraVal.push({ ikon:'✉', namn:'Del fil', onKlikk: (id, rad) => onDelFil(id, rad) })
  if (onRegistrerUtsending) ekstraVal.push({ ikon:'📤', namn:'Registrer utsending', onKlikk: (id, rad) => onRegistrerUtsending(id, rad) })
  const radMeny = {
    erFavoritt:    (rad) => !!rad.favorite,
    onFavoritt:    (id) => onToggleFavorite?.(id),
    erFesta:       (rad) => !!rad.pinned,
    onFestTilTopp: (id) => onTogglePinned?.(id),
    ekstraVal,
  }

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
        radMeny={radMeny}
        merking={merking}
        innhaldstilpassaBreidd
        rutenettRedigering
        prefsKey={`${PREFS_KEY}:${aktivtSett}`}
        itemNamn="dokument"
        defaultSortering={{ key:'nr', dir:'asc' }}
      />
    </div>
  )
}
