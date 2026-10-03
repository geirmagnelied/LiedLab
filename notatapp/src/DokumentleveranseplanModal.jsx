import { useState, useMemo, useEffect } from 'react'
import { løysAktivtSett, KATEGORI_LABEL, LEVERANSE_FASAR } from './dtmKonstantar'
import { NORCONSULT_LOGO_BASE64 } from './norconsultLogo'

// ═══════════════════════════════════════════════════════════════════
//  DokumentleveranseplanModal — PDF-eksport «ved sidan av» Tegningsliste
//  (sjå TegningslisteModal.jsx, som denne fila er ein tilpassa kopi av —
//  same mønster som resten av DTM-modulen, t.d. BILETE_MAPPE duplisert
//  mellom main.js/dtmKonstantar.js: éin sjølvstendig fil per eksport-type
//  i staden for ein delt, parametrisert komponent).
//
//  Skilnaden frå Tegningsliste: PRINT_KOLONNAR har fire EKSTRA kolonnar
//  bakerst (éin per fase i LEVERANSE_FASAR), som viser den PLANLAGDE
//  utsendingsdatoen for akkurat den fasen — pluss ein ✓ når fasen er
//  markert sendt. Planlagt dato og sendt-haken vert sjølve SKRIVNE INN
//  i DTM-matrisa (DTMTabell.jsx, kolonnane «<fase> – planlagt/sendt»,
//  «Dokumentleveranseplan»-visinga i Vising-nedtrekket) — denne modalen
//  er BERRE ein utskriftsklar augneblinksrapport av dei verdiane, same
//  rolle som Tegningsliste har for sjølve revisjonsdataa.
//
//  Reiser SAME generiske IPC-handlar som Tegningsliste
//  (dtm:generer-tegningsliste-pdf/dtm:les-tegningsliste-snapshot) — begge
//  tek berre eit ferdigbygd HTML-dokument + eit fritt feltsett for celle-
//  for-celle-samanlikning, og bryr seg ikkje om KVA eksport han kjem frå.
//  Status-snapshotet er keya på (kategori, dokumentnummer) — så lenge
//  denne modalen sitt dokumentnummer (default «A-60-02») skil seg frå
//  Tegningslista sitt («A-60-01»), kolliderer ikkje dei to snapshota.
// ═══════════════════════════════════════════════════════════════════

const FORMAT_MM = { A4: [210, 297], A3: [297, 420], A2: [420, 594], A1: [594, 841] }
const MARGIN_LEFT_MM = 10
const MARGIN_RIGHT_MM = 10
const MARGIN_TOP_MM = 12
const MARGIN_BOTTOM_MM = 8
const HEADER_HEIGHT_MM = 26
const FOOTER_HEIGHT_MM = 14
const TABELL_HEADER_HØGD_MM = 8
const RAD_HØGD_MM = 7
const MM_TIL_PX = 3.7795 // ~96dpi, brukt BERRE for skjerm-førehandsvisinga

const TITTELBLOKK_TOPP_KOLONNAR = [
  { key: 'logo', namn: 'Utarbeida av', breiddMm: 30 },
  { key: 'prosjektnr', namn: 'Prosjektnummer', breiddMm: 30 },
  { key: 'nr', namn: 'Dokumentnummer', breiddMm: 34 },
  { key: 'rev', namn: 'Revisjon', breiddMm: 18 },
]
const TITTELBLOKK_TOPP_BREIDD_MM = TITTELBLOKK_TOPP_KOLONNAR.reduce((s, c) => s + c.breiddMm, 0)

// Dei sju fyrste er NØYAKTIG same kolonnar som Tegningsliste (PRINT_KOLONNAR
// i TegningslisteModal.jsx) — resten er éin kolonne PER FASE i
// LEVERANSE_FASAR (planlagt dato + ✓ når sendt, sjå hentPrintVerdiar).
const PRINT_KOLONNAR = [
  { key: 'nr', namn: 'Dokumentnummer', breiddMm: 32 },
  { key: 'tittel', namn: 'Tittel', breiddMm: 55 },
  { key: 'filtype', namn: 'Filtype', breiddMm: 16 },
  { key: 'rev', namn: 'Rev.', breiddMm: 13 },
  { key: 'dato', namn: 'Rev.dato', breiddMm: 22 },
  { key: 'format', namn: 'Ark', breiddMm: 16 },
  { key: 'malestokk', namn: 'Målestokk', breiddMm: 18 },
  ...LEVERANSE_FASAR.map(f => ({ key: f.key, namn: f.namn, breiddMm: 26 })),
]
const KOLONNE_BREIDD_SUM = PRINT_KOLONNAR.reduce((s, c) => s + c.breiddMm, 0)

const KANDIDATAR = [
  ['A4', 'ståande'], ['A4', 'liggjande'],
  ['A3', 'ståande'], ['A3', 'liggjande'],
  ['A2', 'ståande'], ['A2', 'liggjande'],
  ['A1', 'ståande'], ['A1', 'liggjande'],
]

const LAGRINGS_KATEGORIAR = ['resultatdokument', 'kontrolldokument', 'arbeidsdokument']

function sideDimensjonar(format, retning) {
  const [kort, lang] = FORMAT_MM[format]
  return retning === 'liggjande' ? { breidd: lang, høgd: kort } : { breidd: kort, høgd: lang }
}

function finnPassandeFormat() {
  for (const [format, retning] of KANDIDATAR) {
    const { breidd } = sideDimensjonar(format, retning)
    if (breidd - MARGIN_LEFT_MM - MARGIN_RIGHT_MM >= KOLONNE_BREIDD_SUM) return { format, retning }
  }
  return { format: 'A1', retning: 'liggjande' }
}

function manglarBreiddMm(format, retning) {
  const { breidd } = sideDimensjonar(format, retning)
  return Math.max(0, KOLONNE_BREIDD_SUM - (breidd - MARGIN_LEFT_MM - MARGIN_RIGHT_MM))
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function dagensDato() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

function sanertFilnamn(s) {
  return String(s || '').replace(/[\\/:*?"<>|]/g, '').trim()
}

// Feltnamna i den printa tabellen — dei sju Tegningsliste-felta PLUSS éin
// per fase (sjå LEVERANSE_FASAR) — same liste vert brukt til cella-for-
// celle-samanlikninga mot FØRRE generering (berekneCelleEndringar).
const PRINT_FELT = ['nr', 'tittel', 'filtype', 'rev', 'dato', 'format', 'malestokk', ...LEVERANSE_FASAR.map(f => f.key)]

function hentPrintVerdiar(dok, aktivtSett) {
  const sett = løysAktivtSett(dok, aktivtSett)
  const g = (sett && dok[sett]) || {}
  const filtype = /\.([a-z0-9]+)$/i.exec(g.filnamn || '')?.[1]?.toUpperCase() || ''
  const faseVerdiar = Object.fromEntries(LEVERANSE_FASAR.map(f => {
    const planlagt = dok[`planlagt_${f.key}`] || ''
    const sendt = !!dok[`sendt_${f.key}`]
    return [f.key, planlagt ? `${planlagt}${sendt ? ' ✓' : ''}` : (sendt ? '✓' : '')]
  }))
  return {
    nr: dok.nr || '', tittel: dok.tittel || dok.nr || '', filtype,
    rev: g.revisjon || '', dato: g.dato || '', format: dok.format || '', malestokk: dok.malestokk || '',
    ...faseVerdiar,
  }
}

function berekneCelleEndringar(rad, snapshot) {
  if (!snapshot) return {}
  const gamalRad = snapshot[rad.nr]
  if (!gamalRad) return Object.fromEntries(PRINT_FELT.map(k => [k, true]))
  return Object.fromEntries(PRINT_FELT.map(k => [k, String(gamalRad[k] ?? '') !== String(rad[k] ?? '')]))
}

function byggSideHtml({ radar, sideNr, talSider, breidd, høgd, tittel, prosjektnr, prosjektnamn, oppdragsgivar,
                        dokumentnummer, revisjon, revisjonsdato, arkstorleikTekst, erFørsteSide }) {
  const radHtml = radar.map(r => `
    <tr>${PRINT_KOLONNAR.map(k => `<td${r.endraFelt?.[k.key] ? ' class="endra-celle"' : ''}>${escHtml(r[k.key])}</td>`).join('')}</tr>`).join('')

  const toppHtml = erFørsteSide ? `
  <div class="topptekst">
    <div class="prosjektnamn">${escHtml(prosjektnamn)}</div>
    <div class="tittel">${escHtml(tittel)}</div>
    <div class="kunde">${escHtml(oppdragsgivar)}</div>
  </div>
  <table class="tittelblokk-topp">
    <thead><tr>${TITTELBLOKK_TOPP_KOLONNAR.map(k => `<th>${k.namn}</th>`).join('')}</tr></thead>
    <tbody><tr>
      <td class="logo"><img src="${NORCONSULT_LOGO_BASE64}" alt="Norconsult"/></td>
      <td>${escHtml(prosjektnr)}</td><td>${escHtml(dokumentnummer)}</td><td>${escHtml(revisjon)}</td>
    </tr></tbody>
  </table>` : ''

  return `
<div class="side${erFørsteSide ? '' : ' forts'}" style="width:${breidd}mm;height:${høgd}mm">
  ${toppHtml}
  <table class="hovudtabell">
    <thead><tr>${PRINT_KOLONNAR.map(k => `<th style="width:${k.breiddMm}mm">${k.namn}</th>`).join('')}</tr></thead>
    <tbody>${radHtml}</tbody>
  </table>
  <div class="botntekst">Side ${sideNr} av ${talSider}</div>
  <div class="botntekst-hogre">
    <span>${escHtml(tittel)}</span><span>${escHtml(prosjektnr)}</span><span>${escHtml(prosjektnamn)}</span>
    <span>${escHtml(dokumentnummer)}</span><span>Rev. ${escHtml(revisjon)}</span>
    <span>${escHtml(revisjonsdato)}</span><span>${escHtml(arkstorleikTekst)}</span>
  </div>
</div>`
}

function byggHtmlDokument({ printRader, format, retning, tittel, prosjektnr, prosjektnamn, oppdragsgivar,
                            dokumentnummer, revisjon, revisjonsdato }) {
  const { breidd, høgd } = sideDimensjonar(format, retning)
  const arkstorleikTekst = format
  const tilgjengelegHøgdFørste = høgd - MARGIN_TOP_MM - MARGIN_BOTTOM_MM - HEADER_HEIGHT_MM - FOOTER_HEIGHT_MM - TABELL_HEADER_HØGD_MM
  const tilgjengelegHøgdForts  = høgd - MARGIN_TOP_MM - MARGIN_BOTTOM_MM - FOOTER_HEIGHT_MM - TABELL_HEADER_HØGD_MM
  const radarPerSideFørste = Math.max(1, Math.floor(tilgjengelegHøgdFørste / RAD_HØGD_MM))
  const radarPerSideForts  = Math.max(1, Math.floor(tilgjengelegHøgdForts / RAD_HØGD_MM))
  const sider = []
  for (let i = 0; i < printRader.length;) {
    const per = sider.length === 0 ? radarPerSideFørste : radarPerSideForts
    sider.push(printRader.slice(i, i + per))
    i += per
  }
  if (sider.length === 0) sider.push([])

  const sideHtml = sider.map((radar, i) => byggSideHtml({
    radar, sideNr: i + 1, talSider: sider.length, breidd, høgd, tittel,
    prosjektnr, prosjektnamn, oppdragsgivar, dokumentnummer, revisjon, revisjonsdato, arkstorleikTekst,
    erFørsteSide: i === 0,
  })).join('\n')

  return { talSider: sider.length, breidd, høgd, html: `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
@page { size: ${breidd}mm ${høgd}mm; margin: 0 }
* { box-sizing:border-box; margin:0; padding:0; font-family:Arial, Helvetica, sans-serif }
body { width:${breidd}mm }
.side { position:relative; width:${breidd}mm; height:${høgd}mm; page-break-after:always; overflow:hidden }
.side:last-child { page-break-after:auto }
.topptekst { position:absolute; top:${MARGIN_TOP_MM}mm; left:${MARGIN_LEFT_MM}mm;
  right:${MARGIN_RIGHT_MM + TITTELBLOKK_TOPP_BREIDD_MM + 6}mm }
.topptekst .prosjektnamn { font-size:12pt; font-weight:400; margin-bottom:1mm }
.topptekst .tittel { font-size:22pt; font-weight:700; margin-bottom:1mm }
.topptekst .kunde { font-size:9pt; font-weight:400; color:#666 }
.tittelblokk-topp { position:absolute; top:${MARGIN_TOP_MM}mm; right:${MARGIN_RIGHT_MM}mm;
  width:${TITTELBLOKK_TOPP_BREIDD_MM}mm; border-collapse:collapse; border:0.5pt solid #000; height:fit-content }
.tittelblokk-topp th, .tittelblokk-topp td { border:0.5pt solid #000; padding:1.5mm 3mm; font-size:8pt; text-align:left; white-space:nowrap }
.tittelblokk-topp th { font-weight:700 }
.tittelblokk-topp td.logo { text-align:center; padding:1.5mm }
.tittelblokk-topp td.logo img { height:5.5mm; width:auto; display:block; margin:0 auto }
.hovudtabell { position:absolute; top:${MARGIN_TOP_MM + HEADER_HEIGHT_MM}mm; left:${MARGIN_LEFT_MM}mm; right:${MARGIN_RIGHT_MM}mm;
  bottom:${MARGIN_BOTTOM_MM + FOOTER_HEIGHT_MM}mm; border-collapse:collapse; font-size:9pt; overflow:hidden }
.side.forts .hovudtabell { top:${MARGIN_TOP_MM}mm }
.hovudtabell th { text-align:left; border-bottom:1pt solid #000; padding:1mm 2mm; font-size:9pt; font-weight:700; white-space:nowrap }
.hovudtabell td { border-bottom:0.3pt solid #999; padding:1mm 2mm; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
.hovudtabell td.endra-celle { background:#dbeafe }
.botntekst { position:absolute; bottom:${MARGIN_BOTTOM_MM}mm; left:${MARGIN_LEFT_MM}mm; font-size:9pt; color:#666 }
.botntekst-hogre { position:absolute; bottom:${MARGIN_BOTTOM_MM}mm; right:${MARGIN_RIGHT_MM}mm; font-size:8pt; color:#666;
  display:flex; gap:6mm; white-space:nowrap }
</style></head>
<body>${sideHtml}</body></html>` }
}

// ── Dragbart + skalerbart vindauge (åtte hjørne/kant-handtak) ───────────
const VINDAUGE_KEY = 'liedlab-dokumentleveranseplan-vindauge'
const MIN_W = 576, MIN_H = 432

function handtakStil(dir) {
  const RAND = 8, HJORNE = 16
  const cursor = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
    ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' }[dir]
  const basis = { position: 'absolute', zIndex: 25, cursor }
  switch (dir) {
    case 'n': return { ...basis, top: -RAND / 2, left: HJORNE, right: HJORNE, height: RAND }
    case 's': return { ...basis, bottom: -RAND / 2, left: HJORNE, right: HJORNE, height: RAND }
    case 'e': return { ...basis, right: -RAND / 2, top: HJORNE, bottom: HJORNE, width: RAND }
    case 'w': return { ...basis, left: -RAND / 2, top: HJORNE, bottom: HJORNE, width: RAND }
    case 'ne': return { ...basis, top: -HJORNE / 2, right: -HJORNE / 2, width: HJORNE, height: HJORNE }
    case 'nw': return { ...basis, top: -HJORNE / 2, left: -HJORNE / 2, width: HJORNE, height: HJORNE }
    case 'se': return { ...basis, bottom: -HJORNE / 2, right: -HJORNE / 2, width: HJORNE, height: HJORNE }
    case 'sw': return { ...basis, bottom: -HJORNE / 2, left: -HJORNE / 2, width: HJORNE, height: HJORNE }
    default: return basis
  }
}

export default function DokumentleveranseplanModal({ dokumenter, aktivtSett, aktivtProsjekt, oppdragsgivar,
                                                       oppdragsSti, onLukk, alleDokument, onGenerert }) {
  const forslag = useMemo(() => finnPassandeFormat(), [])
  const [format, setFormat] = useState(forslag.format)
  const [retning, setRetning] = useState(forslag.retning)
  const [tittel, setTittel] = useState('Dokumentleveranseplan')
  const [dokumentnummer, setDokumentnummer] = useState('A-60-02')
  const [revisjon, setRevisjon] = useState('1')
  const [revisjonsdato, setRevisjonsdato] = useState(() => dagensDato())
  const [kategori, setKategori] = useState('resultatdokument')
  // Eksportformat (PDF/Excel, brukar sitt eige krav 1. okt. 2026) — same
  // namneval som TegningslisteModal.jsx (unngår kollisjon med «format»,
  // arkstorleiken, over).
  const [eksportFormat, setEksportFormat] = useState('pdf')
  const [genererer, setGenererer] = useState(false)
  const [feil, setFeil] = useState('')
  const [snapshotGamal, setSnapshotGamal] = useState(null)

  const harBru = typeof window !== 'undefined' && !!window.resultatdokumentAPI

  const [vindauge, setVindauge] = useState(() => {
    try {
      const lagra = JSON.parse(localStorage.getItem(VINDAUGE_KEY))
      if (lagra && lagra.w > 0 && lagra.h > 0) return lagra
    } catch { /* privat modus */ }
    const breddeProsent = forslag.retning === 'liggjande' ? 0.81 : 0.54
    const w = Math.max(MIN_W, Math.min(Math.round(window.innerWidth * 0.97), Math.round(window.innerWidth * breddeProsent)))
    const h = Math.max(MIN_H, Math.min(Math.round(window.innerHeight * 0.94), Math.round(window.innerHeight * 0.765)))
    return { x: Math.round((window.innerWidth - w) / 2), y: Math.round((window.innerHeight - h) / 2), w, h }
  })
  const lagreVindauge = (v) => { try { localStorage.setItem(VINDAUGE_KEY, JSON.stringify(v)) } catch { /* privat modus */ } }

  const startVindaugeFlytt = (e) => {
    if (e.target.closest('button')) return
    e.preventDefault()
    const startX = e.clientX, startY = e.clientY
    const start = { ...vindauge }
    const flytt = (ev) => setVindauge({ ...start,
      x: Math.max(-(start.w - 160), Math.min(window.innerWidth - 160, start.x + (ev.clientX - startX))),
      y: Math.max(0, Math.min(window.innerHeight - 60, start.y + (ev.clientY - startY))) })
    const slepp = () => {
      window.removeEventListener('mousemove', flytt)
      window.removeEventListener('mouseup', slepp)
      setVindauge(v => { lagreVindauge(v); return v })
    }
    window.addEventListener('mousemove', flytt)
    window.addEventListener('mouseup', slepp)
  }

  const startVindaugeEndring = (dir, e) => {
    e.preventDefault(); e.stopPropagation()
    const startX = e.clientX, startY = e.clientY
    const start = { ...vindauge }
    const flytt = (ev) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY
      let { x, y, w, h } = start
      if (dir.includes('e')) w = Math.max(MIN_W, start.w + dx)
      if (dir.includes('s')) h = Math.max(MIN_H, start.h + dy)
      if (dir.includes('w')) { w = Math.max(MIN_W, start.w - dx); x = start.x + (start.w - w) }
      if (dir.includes('n')) { h = Math.max(MIN_H, start.h - dy); y = start.y + (start.h - h) }
      setVindauge({ x, y, w, h })
    }
    const slepp = () => {
      window.removeEventListener('mousemove', flytt)
      window.removeEventListener('mouseup', slepp)
      document.body.style.cursor = ''
      setVindauge(v => { lagreVindauge(v); return v })
    }
    document.body.style.cursor = handtakStil(dir).cursor
    window.addEventListener('mousemove', flytt)
    window.addEventListener('mouseup', slepp)
  }

  const printRader = useMemo(() =>
    dokumenter.map(d => {
      const rad = hentPrintVerdiar(d, aktivtSett)
      return { ...rad, endraFelt: berekneCelleEndringar(rad, snapshotGamal) }
    }),
  [dokumenter, aktivtSett, snapshotGamal])

  const { talSider, breidd, høgd, html } = useMemo(() => byggHtmlDokument({
    printRader, format, retning, tittel,
    prosjektnr: aktivtProsjekt?.projectNumber || '', prosjektnamn: aktivtProsjekt?.name || '',
    oppdragsgivar: oppdragsgivar || '',
    dokumentnummer, revisjon, revisjonsdato,
  }), [printRader, format, retning, tittel, aktivtProsjekt, oppdragsgivar, dokumentnummer, revisjon, revisjonsdato])

  const manglarBreidd = useMemo(() => manglarBreiddMm(format, retning), [format, retning])

  const naturleggBreiddPx = breidd * MM_TIL_PX
  const naturlegHøgdPx = høgd * MM_TIL_PX
  const previewMaksBreidd = Math.max(280, vindauge.w - 280)
  const skala = Math.min(1, previewMaksBreidd / naturleggBreiddPx)

  useEffect(() => {
    if (!harBru || !oppdragsSti) return
    let avbrote = false
    const registrert = (alleDokument || []).find(d => d.nr === dokumentnummer.trim())?.[kategori]
    const registrertRev = parseInt(registrert?.revisjon, 10)
    if (!isNaN(registrertRev)) { setRevisjon(String(registrertRev + 1)); return }
    window.resultatdokumentAPI.dtmListFiler(oppdragsSti, kategori).then(svar => {
      if (avbrote) return
      const prefiks = dokumentnummer.trim().toUpperCase()
      const treff = [...(svar?.filer || []), ...(svar?.arkiverte || [])].filter(f => f.namn.toUpperCase().startsWith(prefiks))
      setRevisjon(String(treff.length + 1))
    }).catch(() => { /* la revisjonsforslaget stå urørt viss skanninga feilar */ })
    return () => { avbrote = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kategori, harBru, oppdragsSti])

  useEffect(() => {
    if (!harBru || !oppdragsSti) return
    if (typeof window.resultatdokumentAPI.dtmLesTegningslisteSnapshot !== 'function') {
      setSnapshotGamal(null)
      return
    }
    let avbrote = false
    window.resultatdokumentAPI.dtmLesTegningslisteSnapshot(oppdragsSti, kategori, dokumentnummer).then(snap => {
      if (!avbrote) setSnapshotGamal(snap)
    }).catch(() => { if (!avbrote) setSnapshotGamal(null) })
    return () => { avbrote = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kategori, harBru, oppdragsSti])

  const generer = async () => {
    if (!harBru) return
    setGenererer(true); setFeil('')
    try {
      const namnebase = `${sanertFilnamn(dokumentnummer) || 'Dokumentleveranseplan'} ${sanertFilnamn(tittel) || 'Dokumentleveranseplan'}`
      const snapshotData = Object.fromEntries(printRader.map(r => [r.nr, Object.fromEntries(PRINT_FELT.map(k => [k, r[k]]))]))
      const svar = eksportFormat === 'excel'
        ? await window.resultatdokumentAPI.dtmGenererExcel(printRader, PRINT_KOLONNAR, oppdragsSti, kategori, `${namnebase}.xlsx`)
        : await window.resultatdokumentAPI.dtmGenererTegningslistePdf(html, oppdragsSti, kategori, `${namnebase}.pdf`, dokumentnummer, snapshotData)
      if (!svar?.ok) { setFeil(svar?.melding || 'Ukjend feil.'); setGenererer(false); return }
      // Indekser fila i DTM-registeret med det same, sjå registrerGenerertFil i DTMModule.jsx
      await onGenerert?.({ kategori, filnamn: svar.filnamn, filSti: svar.filSti, nr: dokumentnummer.trim(),
        tittel: tittel.trim(), rev: revisjon, dato: revisjonsdato, format })
      onLukk()
    } catch (e) {
      setFeil(e.message)
      setGenererer(false)
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.42)', zIndex:200 }}>
      <div style={{ position:'fixed', left:vindauge.x, top:vindauge.y, width:vindauge.w, height:vindauge.h,
        background:'var(--bg2)', borderRadius:'var(--r2)', overflow:'hidden', display:'flex', flexDirection:'column',
        boxShadow:'0 24px 70px rgba(0,0,0,.35)' }}>

        <div onMouseDown={startVindaugeFlytt} style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 20px',
          borderBottom:'1px solid rgba(255,255,255,.12)', flexShrink:0, background:'#0E7490', cursor:'move' }}>
          <span style={{ fontSize:15, fontWeight:800, color:'#fff' }}>Dokumentleveranseplan</span>
          <div style={{ flex:1 }}/>
          <button onClick={onLukk} title="Lukk" style={{ background:'none', border:'none', fontSize:22,
            cursor:'pointer', color:'rgba(255,255,255,.85)', lineHeight:1, padding:'2px 6px' }}>×</button>
        </div>

        <div style={{ flex:1, overflow:'auto', padding:'20px 24px', display:'flex', gap:24 }}>
          {/* ── Val ── */}
          <div style={{ width:240, flexShrink:0, display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ fontSize:11.5, color:'var(--text3)', lineHeight:1.6 }}>
              Planlagde og faktiske utsendingsdatoar vert redigerte direkte i
              DTM-tabellen (visinga «Dokumentleveranseplan» i Vising-menyen).
              Her genererer du berre ein utskriftsklar augneblinksrapport av dei
              verdiane.
            </div>
            <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <span className="dt-etikett">Tittel</span>
              <input className="dt-input" value={tittel} onChange={e => setTittel(e.target.value)}/>
            </label>
            <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <span className="dt-etikett">Eksportformat</span>
              <div className="dt-seg" style={{ width:'100%' }}>
                {[['pdf', 'PDF'], ['excel', 'Excel']].map(([v, t]) => (
                  <button key={v} type="button" className={eksportFormat === v ? 'på' : ''} style={{ flex:1 }}
                    onClick={() => setEksportFormat(v)}>{t}</button>
                ))}
              </div>
            </label>
            {eksportFormat === 'pdf' && (<>
            <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <span className="dt-etikett">Arkstørrelse</span>
              <div className="dt-seg" style={{ width:'100%' }}>
                {['A4', 'A3', 'A2', 'A1'].map(f => (
                  <button key={f} type="button" className={format === f ? 'på' : ''} style={{ flex:1 }}
                    onClick={() => setFormat(f)}>{f}</button>
                ))}
              </div>
            </label>
            <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <span className="dt-etikett">Retning</span>
              <div className="dt-seg" style={{ width:'100%' }}>
                {[['ståande', 'Ståande'], ['liggjande', 'Liggjande']].map(([v, t]) => (
                  <button key={v} type="button" className={retning === v ? 'på' : ''} style={{ flex:1 }}
                    onClick={() => setRetning(v)}>{t}</button>
                ))}
              </div>
            </label>
            {manglarBreidd > 0 && (
              <div style={{ fontSize:11.5, color:'var(--danger)', background:'color-mix(in srgb, var(--danger) 12%, transparent)',
                borderRadius:'var(--r)', padding:'8px 10px', lineHeight:1.5 }}>
                ⚠ Kolonnene i tabellen er {Math.ceil(manglarBreidd)}mm breiare enn det valde arket —
                nokre kolonnar kan bli avkutta. Vel eit større format eller liggjande retning.
              </div>
            )}
            </>)}
            <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <span className="dt-etikett">Dokumentnummer (dette arket)</span>
              <input className="dt-input" value={dokumentnummer} onChange={e => setDokumentnummer(e.target.value)}/>
            </label>
            <div style={{ display:'flex', gap:8 }}>
              <label style={{ display:'flex', flexDirection:'column', gap:4, flex:1 }}>
                <span className="dt-etikett">Revisjon</span>
                <input className="dt-input" value={revisjon} onChange={e => setRevisjon(e.target.value)}/>
              </label>
              <label style={{ display:'flex', flexDirection:'column', gap:4, flex:1 }}>
                <span className="dt-etikett">Revisjonsdato</span>
                <input className="dt-input" value={revisjonsdato} onChange={e => setRevisjonsdato(e.target.value)}/>
              </label>
            </div>
            <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <span className="dt-etikett">Lagra som</span>
              <div className="dt-seg" style={{ width:'100%', flexDirection:'column' }}>
                {LAGRINGS_KATEGORIAR.map(k => (
                  <button key={k} type="button" className={kategori === k ? 'på' : ''}
                    style={{ width:'100%', textAlign:'left' }} onClick={() => setKategori(k)}>
                    {KATEGORI_LABEL[k]}
                  </button>
                ))}
              </div>
            </label>
            <div style={{ fontSize:11.5, color:'var(--text3)', lineHeight:1.6 }}>
              {dokumenter.length} dokument, {talSider} side{talSider === 1 ? '' : 'r'}.
              {snapshotGamal && (() => {
                const talEndra = printRader.filter(r => Object.values(r.endraFelt).some(Boolean)).length
                return talEndra > 0
                  ? <> <span style={{ color:'#0E7490', fontWeight:700 }}>{talEndra}</span> dokument har celler endra sidan sist generering (markert lyseblå).</>
                  : ' Ingen endringar sidan sist generering.'
              })()}
            </div>
            {feil && <div style={{ fontSize:12, color:'var(--danger)' }}>{feil}</div>}
            <div style={{ fontSize:11.5, color:'var(--text3)', lineHeight:1.5 }}>
              Lagrast som «{sanertFilnamn(dokumentnummer) || 'Dokumentleveranseplan'} {sanertFilnamn(tittel) || 'Dokumentleveranseplan'}.{eksportFormat === 'excel' ? 'xlsx' : 'pdf'}»
              i {KATEGORI_LABEL[kategori]?.toLowerCase()}
            </div>
            <div style={{ display:'flex', gap:8, marginTop:'auto', paddingTop:8 }}>
              <button className="dt-knapp" style={{ flex:1 }} onClick={onLukk}>Avbryt</button>
              <button className="dt-knapp hovud" style={{ flex:1 }} disabled={!harBru || genererer} onClick={generer}>
                {genererer ? 'Genererer…' : eksportFormat === 'excel' ? 'Generer Excel' : 'Generer PDF'}
              </button>
            </div>
          </div>

          {/* ── Førehandsvising (side 1) — berre for PDF ── */}
          {eksportFormat === 'pdf' ? (
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:8, minWidth:0 }}>
              <span className="dt-etikett">Førehandsvising — side 1{talSider > 1 ? ` av ${talSider}` : ''}</span>
              <div style={{ width:naturleggBreiddPx * skala, height:naturlegHøgdPx * skala, overflow:'hidden',
                border:'1px solid var(--border)', boxShadow:'var(--shadow-sm)', background:'#fff', flexShrink:0 }}>
                <iframe title="Førehandsvising" srcDoc={html}
                  style={{ width:naturleggBreiddPx, height:naturlegHøgdPx, border:'none',
                    transform:`scale(${skala})`, transformOrigin:'top left' }}/>
              </div>
            </div>
          ) : (
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              gap:8, minWidth:0, color:'var(--text3)', fontSize:12.5, textAlign:'center', padding:20 }}>
              <div style={{ fontSize:32 }}>📊</div>
              <div>Excel-fila får éi rad per dokument, med same kolonnar som tabellen —
                {PRINT_KOLONNAR.map(k => k.namn).join(', ')}.</div>
              <div>Ingen sidelayout å førehandsvise for dette formatet.</div>
            </div>
          )}
        </div>

        {['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map(dir => (
          <div key={dir} onMouseDown={e => startVindaugeEndring(dir, e)}
            title="Dra for å endre storleiken på vindauget" style={handtakStil(dir)}/>
        ))}
      </div>
    </div>
  )
}
