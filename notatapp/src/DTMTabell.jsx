import { useCallback } from 'react'
import DataTabell, { Pille } from './DataTabell'
import { fmtDateShort } from './sakerKonstantar'
import { reknStatus, løysAktivtSett, KATEGORIAR, KATEGORI_LABEL, KATEGORI_MAPPE, FERDIGSTILLING_STATUS,
  EKSTERN_DOK_KATEGORIAR, utsendingsnrTekst, LEVERANSE_FASAR, LEVERANSE_FASAR_BASIS, LEVERANSE_FASAR_EKSTRA, erForsinka, erPlanlagtUtanFil } from './dtmKonstantar'

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

// «Vising»-nedtrekksmenyen i verktøylinja (sjå DataTabell sin
// `visingsFilter`-prop) — faste kolonneutval brukar kan hoppe mellom, i
// tillegg til å skjule/vise kolonnar enkeltvis via «+ Kolonnar» som før.
const VISINGSFILTER = [
  { namn:'Alle', kolonnar:null },
  { namn:'Tegningsliste', kolonnar:['nr', 'tittel', 'filtype', 'rev', 'dato', 'format', 'malestokk'] },
  { namn:'Dokumentleveranseplan', kolonnar:['nr', 'tittel', 'filtype', 'rev', 'dato', 'format', 'malestokk',
    ...LEVERANSE_FASAR_BASIS.flatMap(f => [`planlagt_${f.key}`, `sendt_${f.key}`]),
    ...LEVERANSE_FASAR_EKSTRA.map(f => `sendt_${f.key}`)] },
]

// Alle kolonnar er synlege som standard (brukar sitt eige krav 25. sept.
// 2026: «legg inn alle kolonnene med info frå skanninga inn i tabellen
// som standard visning») — ingen `standardSkjult` lenger.
const BASE_COLUMNS = [
  { key:'nr',          label:'Dokumentnummer', art:'tekst', mono:true, opnaFil:true, redigerbar:true, maskinlest:true, totalTeljing:true },
  { key:'tittel',      label:'Tittel',       art:'tekst', utanFilter:true, opnaFil:true, redigerbar:true },
  { key:'kategori',    label:'Kategori',     art:'val',   redigerbar:true, val:KATEGORIAR.map(k => KATEGORI_LABEL[k]) },
  { key:'ekstern_kategori', label:'Kategori eksternt dok.', art:'val', redigerbar:true, val:['', ...EKSTERN_DOK_KATEGORIAR] },
  { key:'status',      label:'Status',       art:'val',   utanFilter:true, beregna:true },
  { key:'filtype',     label:'Filtype',      art:'val',   mono:true, beregna:true },
  { key:'rev',         label:'Rev.',         art:'tekst', mono:true, redigerbar:true, maskinlest:true },
  // «Dato» omdøypt «Revisjonsdato» 27. sept. 2026 — det var uklårt at
  // denne viser NYASTE revisjon (sjå «Første revisjon» under for eldste).
  { key:'dato',        label:'Revisjonsdato', art:'tekst', mono:true, redigerbar:true, maskinlest:true },
  { key:'forste_revisjon_dato', label:'Første revisjon', art:'tekst', mono:true, redigerbar:true, maskinlest:true },
  { key:'revisjonsbeskriving', label:'Revisjonsskildring', art:'tekst', utanFilter:true, maskinlest:true },
  { key:'tegningsformal', label:'Tegningsformål', art:'val', maskinlest:true },
  { key:'fag',         label:'Fag',          art:'val',   maskinlest:true },
  { key:'oppdragsgivar',label:'Oppdragsgivar',art:'val',  maskinlest:true },
  { key:'tiltakshavar',label:'Tiltakshavar', art:'val',   maskinlest:true },
  { key:'fase',        label:'Fase',         art:'val' },
  { key:'delprosjekt', label:'Delprosjekt',  art:'tekst', redigerbar:true },
  { key:'ferdigstillingsstatus', label:'Status ved ferdigstilling', art:'val', redigerbar:true, val:['', ...FERDIGSTILLING_STATUS] },
  { key:'ferdigstillelse', label:'Ferdigstillelse', art:'tal', redigerbar:true, minW:60, min:0, max:100, ikkjeSummer:true },
  { key:'timebudsjett',   label:'Timebudsjett', art:'tal', redigerbar:true, minW:60 },
  { key:'gjenstaande_timer', label:'Gjenståande timer', art:'tal', beregna:true, minW:60 },
  { key:'malestokk',   label:'Målestokk',    art:'tekst', maskinlest:true },
  { key:'format',      label:'ARK', art:'val',   maskinlest:true },
  { key:'utarbeida_av',label:'Utarbeida av', art:'val',   maskinlest:true },
  { key:'fk_person',   label:'Fagkontroll',  art:'val',   maskinlest:true },
  { key:'godkjent_av', label:'Godkjent',     art:'val',   maskinlest:true },
  { key:'oppdragsnr',  label:'Oppdragsnr.',  art:'tekst', mono:true, maskinlest:true },
  // Generelt på/av-felt, IKKJE avgrensa til éin kategori — t.d. eit utsendt
  // tilbod (eksternt_dokument) kan vere styrande for arbeidet, same som eit
  // internt notat kan vere det (brukar sitt eige krav 29. sept. 2026).
  { key:'er_styrande_dokument', label:'Styrande dokument', art:'bool', redigerbar:true },
  // Reint UI-val enno — sjølve AI-kallet kjem seinare, sjå dtmKonstantar.js.
  { key:'ai_indeksering_onska', label:'AI-indeksering', art:'bool', redigerbar:true },
  { key:'lagra_av',    label:'Lagra av',     art:'val',   beregna:true },
  { key:'lasta_opp',   label:'Lasta opp',    art:'dato',  mono:true, beregna:true },
  { key:'utsendingar', label:'Utsendingar',  art:'tekst', utanFilter:true, beregna:true },
  { key:'filsti',      label:'Filsti',       art:'tekst', utanFilter:true, mono:true, maksInnhaldsBreidd:Infinity, beregna:true },
  // ── Dokumentleveranseplan (1. okt. 2026, sjå claude/dtm-modul.md) ────
  // Planlagt dato er FRITEKST (same mønster som «dato»/«Første revisjon»
  // over — brukar skriv datoen sjølv, ikkje ein ekte datoveljar), «sendt»
  // er ei vanleg bool-kolonne (eitt klikk slår av/på, same mønster som
  // «Styrande dokument»/«AI-indeksering»). Lagt bakerst i tabellen, som
  // brukar bad om.
  ...LEVERANSE_FASAR.flatMap(f => {
    const skjult = LEVERANSE_FASAR_EKSTRA.includes(f)
    // Tolinjes overskrift: «PU Prosjekteringsunderlag» (8 px) over «Frist leveranse»/«Sendt»
    const l1 = `${f.kode} ${f.namn}`
    return [
      { key:`planlagt_${f.key}`, label:`${f.namn} – planlagt`, overskrift:[l1, 'Frist leveranse'], art:'tekst', mono:true, redigerbar:true, standardSkjult:skjult },
      { key:`sendt_${f.key}`,    label:`${f.namn} – sendt`,    overskrift:[l1, 'Sendt'],           art:'bool',  redigerbar:true, standardSkjult:skjult },
    ]
  }),
]

const erPlanlagt = erPlanlagtUtanFil

function hentGjeldande(rad, aktivtSett) {
  const sett = løysAktivtSett(rad, aktivtSett)
  return { sett, g: (sett && rad[sett]) || {} }
}

export default function DTMTabell({ dokumenter, aktivtSett, onSetVerdi, onOpneFil, onDelFil,
                                     onToggleFavorite, onTogglePinned, onRegistrerUtsending, onLeggTilRad, onDupliserRad, onSlettRad, onNyLopenummer, radRekkjefolge, onSlettValde,
                                     merking, oppdragsSti, eigneKolonnar = [], utsendingarPerDokument = {},
                                     // Valfrie — brukt av KvalitetModule.jsx sin kontroll-tabell, som viser DEI
                                     // SAME kolonnedefinisjonane (BASE_COLUMNS) men med EI ANNA standardvising
                                     // og EIT EIGE, SEPARAT lagra kolonneoppsett enn DTM-modulen sitt eige
                                     // (sjå claude/kvalitetsmodul-teikningar.md, «Del B»).
                                     prefsKeySuffix, standardSynlegeKolonnar }) {
  const hentVerdi = useCallback((rad, key) => {
    const { sett, g } = hentGjeldande(rad, aktivtSett)
    switch (key) {
      case 'nr':          return rad.nr || ''
      case 'tittel':      return rad.tittel || rad.nr || ''
      case 'kategori':    return sett ? KATEGORI_LABEL[sett] : ''
      case 'ekstern_kategori': return rad.ekstern_kategori || ''
      case 'er_styrande_dokument': return !!rad.er_styrande_dokument
      case 'ai_indeksering_onska': return !!rad.ai_indeksering_onska
      case 'status':      return sett ? reknStatus(rad, sett).join(', ') : erPlanlagt(rad) ? 'Planlagt' : ''
      case 'filtype': {
        const m = /\.([a-z0-9]+)$/i.exec(g.filnamn || '')
        return m ? m[1].toUpperCase() : ''
      }
      case 'rev':         return g.revisjon || ''
      case 'dato':        return g.dato || ''
      case 'forste_revisjon_dato': return rad.forste_revisjon_dato || ''
      case 'revisjonsbeskriving': return rad.revisjonsbeskriving || ''
      case 'tegningsformal': return rad.tegningsformal || ''
      case 'fag':         return rad.fag || ''
      case 'fase':        return rad.fase || ''
      case 'delprosjekt': return rad.delprosjekt || ''
      case 'ferdigstillingsstatus': return rad.ferdigstillingsstatus || ''
      case 'ferdigstillelse': return rad.ferdigstillelse != null ? rad.ferdigstillelse : ''
      case 'timebudsjett':    return rad.timebudsjett != null ? rad.timebudsjett : ''
      case 'gjenstaande_timer': {
        if (rad.timebudsjett == null || rad.ferdigstillelse == null) return ''
        return Math.round(rad.timebudsjett * (1 - rad.ferdigstillelse / 100) * 10) / 10
      }
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
      default:
        if (key.startsWith('planlagt_')) return rad[key] || ''
        if (key.startsWith('sendt_'))    return !!rad[key]
        return String(rad.ekstra?.[key] ?? '')
    }
  }, [aktivtSett, oppdragsSti, utsendingarPerDokument])

  const hentSorteringsverdi = useCallback((rad, key) => {
    const { g } = hentGjeldande(rad, aktivtSett)
    if (key === 'lasta_opp') return g.lasta_opp ? new Date(g.lasta_opp).getTime() : 0
    return undefined
  }, [aktivtSett])

  const lagCelle = useCallback((rad, kol) => {
    if (kol.key === 'tittel')
      return <span className="dt-lenketekst" style={{ fontWeight:600, color:'var(--brand)', cursor:'pointer' }}>{rad.tittel || rad.nr}</span>
    if (kol.key === 'nr')
      return <span className="dt-lenketekst" style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--brand)', cursor:'pointer' }}>{rad.nr}</span>
    if (kol.key === 'status') {
      const { sett } = hentGjeldande(rad, aktivtSett)
      const taggar = sett ? reknStatus(rad, sett) : erPlanlagt(rad) ? ['Planlagt'] : []
      if (!taggar.length) return <span style={{ color:'var(--text3)', opacity:.45 }}>—</span>
      return (
        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
          {taggar.map(t => <Pille key={t} tekst={t} farge={STATUS_FARGE[t]}/>)}
        </div>
      )
    }
    if (kol.key === 'ferdigstillelse') {
      if (rad.ferdigstillelse == null || rad.ferdigstillelse === '') return <span style={{ color:'var(--text3)', opacity:.45 }}>—</span>
      return <span style={{ fontVariantNumeric:'tabular-nums' }}>{rad.ferdigstillelse} %</span>
    }
    if (kol.key === 'timebudsjett' || kol.key === 'gjenstaande_timer') {
      const v = kol.key === 'timebudsjett' ? rad.timebudsjett
        : (rad.timebudsjett == null || rad.ferdigstillelse == null ? null : Math.round(rad.timebudsjett * (1 - rad.ferdigstillelse / 100) * 10) / 10)
      if (v == null || v === '') return <span style={{ color:'var(--text3)', opacity:.45 }}>—</span>
      return <span style={{ fontVariantNumeric:'tabular-nums' }}>{v} t</span>
    }
    if (kol.key.startsWith('planlagt_')) {
      const verdi = rad[kol.key] || ''
      if (!verdi) return <span style={{ color:'var(--text3)', opacity:.45 }}>—</span>
      const forsinka = erForsinka(rad, kol.key.slice('planlagt_'.length))
      return <span style={{ color: forsinka ? 'var(--danger)' : undefined, fontWeight: forsinka ? 700 : undefined }}
        title={forsinka ? 'Planlagt dato er passert — ikkje markert sendt enno' : undefined}>{verdi}</span>
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
  if (onLeggTilRad) ekstraVal.push({ ikon:'＋', namn:'Legg til rad', onKlikk: () => onLeggTilRad() })
  if (onDupliserRad) ekstraVal.push({ ikon:'⧉', namn:'Dupliser rad', onKlikk: (id) => onDupliserRad(id) })
  // Tredje argument `ctx.rader` = radene i VIST rekkjefølgje (sortert/filtrert), sjå DataTabell
  if (onNyLopenummer) ekstraVal.push({ ikon:'№', namn:'Generer ny løpenummer etter vist rekkefølge', onKlikk: (id, rad, ctx) => onNyLopenummer(ctx?.rader || []) })
  const radMeny = {
    erFavoritt:    (rad) => !!rad.favorite,
    onFavoritt:    (id) => onToggleFavorite?.(id),
    erFesta:       (rad) => !!rad.pinned,
    onFestTilTopp: (id) => onTogglePinned?.(id),
    ekstraVal,
    ...(onSlettRad ? { onSlett: (id) => onSlettRad(id) } : {}),
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
        klistreKolonnar={['nr', 'tittel']}
        radRekkjefolge={radRekkjefolge}
        onSlettValde={onSlettValde}
        visingsFilter={VISINGSFILTER}
        prefsKey={`${PREFS_KEY}${prefsKeySuffix ? `:${prefsKeySuffix}` : ''}:${aktivtSett}`}
        standardSynlegeKolonnar={standardSynlegeKolonnar}
        itemNamn="dokument"
        defaultSortering={{ key:'nr', dir:'asc' }}
      />
    </div>
  )
}
