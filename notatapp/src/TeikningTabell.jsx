import { useCallback } from 'react'
import DataTabell, { Pille } from './DataTabell'

// ═══════════════════════════════════════════════════════════════════
//  Teikningsregister — kolonnedefinisjonar og celle-visning for
//  Kvalitetsmodulen sitt teikningsregister (ks_teikningar).
//  Sjølve tabellmotoren kjem frå DataTabell, som er standarden for
//  alle tabellar i appen (same mønster som SakerTabell for saker).
//  Feil frå automatisk skanning rettar ein med dobbeltklikk i cella —
//  sjå kol.redigerbar/kol.val og RedigerCelle i DataTabell.jsx.
// ═══════════════════════════════════════════════════════════════════

const PREFS_KEY = 'liedlab-ks-teikningar-tabell-v1'

export const FAG_LIST = ['Situasjonsplan', 'Plan', 'Snitt', 'Fasade', 'Detalj', 'Anna']
export const FAG_COLORS = {
  Situasjonsplan: '#0891B2', Plan: '#2563EB', Snitt: '#059669',
  Fasade: '#9333EA', Detalj: '#D97706', Anna: '#6B7280',
}

export const FASE_LIST = ['Skisseprosjekt', 'Forprosjekt', 'Tilbodsteikning', 'Søknadsteikning', 'Detaljprosjekt']
export const FASE_COLORS = {
  Skisseprosjekt: '#6B7280', Forprosjekt: '#0891B2', Tilbodsteikning: '#CA8A04',
  Søknadsteikning: '#2563EB', Detaljprosjekt: '#059669',
}

// Tolkar norsk datoformat (dd.mm.åå / dd-mm-åååå / dd/mm/åååå) til eit
// tal som kan brukast til sortering — same format som PDF-tittelfeltet
// vert lese i (sjå lesTittelfelt() i electron/main.js).
export function parseDatoNb(s) {
  const m = String(s || '').match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$/)
  if (!m) return 0
  let [, d, mnd, år] = m
  if (år.length === 2) år = '20' + år
  const t = new Date(`${år}-${mnd.padStart(2, '0')}-${d.padStart(2, '0')}`).getTime()
  return isNaN(t) ? 0 : t
}

function fmtLastaOpp(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  return d.toLocaleString('no-NO', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false })
}

const BASE_COLUMNS = [
  { key:'nr',        label:'Nr.',        w:150, art:'tekst', mono:true, redigerbar:true, opnaFil:true },
  { key:'tittel',    label:'Tittel',     w:260, art:'tekst', utanFilter:true, redigerbar:true },
  { key:'rev',       label:'Rev',        w:52,  art:'val',   mono:true, redigerbar:true },
  { key:'fag',       label:'Fag',        w:118, art:'val',   redigerbar:true, val:FAG_LIST },
  { key:'malestokk', label:'Målestokk',  w:92,  art:'val',   mono:true, redigerbar:true },
  { key:'fase',      label:'Fase',       w:130, art:'val',   redigerbar:true, val:['', ...FASE_LIST] },
  { key:'teikna_av', label:'Teikna av',  w:100, art:'val',   mono:true, redigerbar:true },
  { key:'ek_person', label:'EK',         w:68,  art:'val',   mono:true, redigerbar:true },
  { key:'fk_person', label:'FK',         w:68,  art:'val',   mono:true, redigerbar:true },
  { key:'dato',      label:'Dato',       w:96,  art:'dato',  mono:true, redigerbar:true },
  { key:'lasta_opp', label:'Lasta opp',  w:118, art:'dato',  mono:true },
  { key:'format',    label:'Format',     w:76,  art:'val',   mono:true, redigerbar:true, standardSkjult:true },
]

function rangering(key) {
  if (key === 'fag')  return FAG_LIST
  if (key === 'fase') return ['', ...FASE_LIST]
  return null
}

export default function TeikningTabell({ teikningar, onSetVerdi, onOpneFil }) {
  const hentVerdi = useCallback((t, key) => {
    switch (key) {
      case 'nr':        return t.nr || ''
      case 'tittel':    return t.tittel || '—'
      case 'rev':       return t.rev || 'A'
      case 'fag':       return t.fag || 'Anna'
      case 'malestokk': return t.malestokk || '—'
      case 'fase':      return t.fase || '—'
      case 'teikna_av': return t.teikna_av || '—'
      case 'ek_person': return t.ek_person || '—'
      case 'fk_person': return t.fk_person || '—'
      case 'dato':      return t.dato || ''
      case 'lasta_opp': return fmtLastaOpp(t.created_at) || '—'
      case 'format':    return t.format || '—'
      default:          return ''
    }
  }, [])

  // Råverdi å redigere — utan «—»-fallbacken hentVerdi bruker til visning,
  // slik at ein ikkje må slette eit em-dash før ein kan skrive inn noko.
  const hentRedigerVerdi = useCallback((t, key) => {
    switch (key) {
      case 'nr':        return t.nr || ''
      case 'tittel':    return t.tittel || ''
      case 'rev':       return t.rev || 'A'
      case 'fag':       return t.fag || 'Anna'
      case 'malestokk': return t.malestokk || ''
      case 'fase':      return t.fase || ''
      case 'teikna_av': return t.teikna_av || ''
      case 'ek_person': return t.ek_person || ''
      case 'fk_person': return t.fk_person || ''
      case 'dato':      return t.dato || ''
      case 'format':    return t.format || ''
      default:          return ''
    }
  }, [])

  const hentSorteringsverdi = useCallback((t, key) => {
    if (key === 'dato')      return parseDatoNb(t.dato)
    if (key === 'lasta_opp') return t.created_at ? new Date(t.created_at).getTime() : 0
    return undefined
  }, [])

  const lagCelle = useCallback((t, kol, { farge }) => {
    const v = hentVerdi(t, kol.key)
    if (kol.key === 'nr')
      return <span style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--brand)', textDecoration:'underline' }}>{v}</span>
    if (kol.key === 'tittel')
      return <span style={{ fontWeight:600, color:'var(--text)' }}>{v}</span>
    if (kol.key === 'fag')
      return <Pille tekst={v} farge={farge ? FAG_COLORS[t.fag] || FAG_COLORS.Anna : null}/>
    if (kol.key === 'fase' && t.fase)
      return <Pille tekst={v} farge={farge ? FASE_COLORS[t.fase] : null}/>
    return undefined
  }, [hentVerdi])

  return (
    <DataTabell
      rader={teikningar}
      kolonnar={BASE_COLUMNS}
      hentVerdi={hentVerdi}
      hentRedigerVerdi={hentRedigerVerdi}
      hentSorteringsverdi={hentSorteringsverdi}
      lagCelle={lagCelle}
      rangering={rangering}
      radId={t => t.id}
      onSetVerdi={onSetVerdi}
      onOpneFil={t => onOpneFil?.(t.id)}
      prefsKey={PREFS_KEY}
      itemNamn="teikningar"
      defaultSortering={{ key:'nr', dir:'asc' }}
    />
  )
}
