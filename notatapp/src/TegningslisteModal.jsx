import { useState, useMemo } from 'react'
import { løysAktivtSett } from './dtmKonstantar'

// ═══════════════════════════════════════════════════════════════════
//  TegningslisteModal — genererer ei utskriftsklar «Tegningsliste»-PDF
//  (A4/A2/A1, ståande/liggjande) av dei synlege DTM-dokumenta. Sjå
//  claude/dtm-modul.md for full spesifikasjon.
//
//  HEILE HTML-dokumentet (éin <div class="side"> per side, alt paginert
//  her i renderar-koden — Chromium sin printToPDF støttar IKKJE sidetal-
//  medvitne topp-/botntekstar via rein CSS) vert bygd i denne fila, og
//  attgjeve BÅDE som ei skalert førehandsvising (side 1, i eit <iframe>)
//  OG sendt uendra til Electron (dtmGenererTegningslistePdf) for sjølve
//  PDF-genereringa — éin og same kjelde, ingen sjanse for at
//  førehandsvisinga lyg om korleis utskrifta faktisk vert.
// ═══════════════════════════════════════════════════════════════════

const FORMAT_MM = { A4: [210, 297], A2: [420, 594], A1: [594, 841] }
const MARGIN_MM = 15
const HEADER_HEIGHT_MM = 32
const FOOTER_HEIGHT_MM = 26
const TABELL_HEADER_HØGD_MM = 8
const RAD_HØGD_MM = 7
const MM_TIL_PX = 3.7795 // ~96dpi, brukt BERRE for skjerm-førehandsvisinga

const PRINT_KOLONNAR = [
  { key: 'nr', namn: 'Dokumentnummer', breiddMm: 32, mono: true },
  { key: 'tittel', namn: 'Tittel', breiddMm: 65 },
  { key: 'filtype', namn: 'Filtype', breiddMm: 18, mono: true },
  { key: 'rev', namn: 'Rev.', breiddMm: 14, mono: true },
  { key: 'dato', namn: 'Revisjonsdato', breiddMm: 26, mono: true },
  { key: 'format', namn: 'Arkstørrelse', breiddMm: 22, mono: true },
  { key: 'malestokk', namn: 'Målestokk', breiddMm: 22, mono: true },
]
const KOLONNE_BREIDD_SUM = PRINT_KOLONNAR.reduce((s, c) => s + c.breiddMm, 0)

const KANDIDATAR = [
  ['A4', 'ståande'], ['A4', 'liggjande'],
  ['A2', 'ståande'], ['A2', 'liggjande'],
  ['A1', 'ståande'], ['A1', 'liggjande'],
]

function sideDimensjonar(format, retning) {
  const [kort, lang] = FORMAT_MM[format]
  return retning === 'liggjande' ? { breidd: lang, høgd: kort } : { breidd: kort, høgd: lang }
}

// Vel det MINSTE formatet/retninga (i rekkjefølgja over) der hovudtabellen
// sine kolonnar faktisk får plass i breidda — brukar sitt eige krav.
function finnPassandeFormat() {
  for (const [format, retning] of KANDIDATAR) {
    const { breidd } = sideDimensjonar(format, retning)
    if (breidd - 2 * MARGIN_MM >= KOLONNE_BREIDD_SUM) return { format, retning }
  }
  return { format: 'A1', retning: 'liggjande' }
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function hentPrintVerdiar(dok, aktivtSett) {
  const sett = løysAktivtSett(dok, aktivtSett)
  const g = (sett && dok[sett]) || {}
  const filtype = /\.([a-z0-9]+)$/i.exec(g.filnamn || '')?.[1]?.toUpperCase() || ''
  return {
    nr: dok.nr || '', tittel: dok.tittel || dok.nr || '', filtype,
    rev: g.revisjon || '', dato: g.dato || '', format: dok.format || '', malestokk: dok.malestokk || '',
  }
}

function byggSideHtml({ radar, sideNr, talSider, breidd, høgd, prosjektnr, prosjektnamn, dokumentnummer, revisjon }) {
  const radHtml = radar.map(r => `
    <tr>${PRINT_KOLONNAR.map(k => `<td${k.mono ? ' class="mono"' : ''}>${escHtml(r[k.key])}</td>`).join('')}</tr>`).join('')

  return `
<div class="side" style="width:${breidd}mm;height:${høgd}mm">
  <div class="topptekst">
    <div class="tittel">Tegningsliste</div>
    <div class="prosjekt">Prosjektnummer: ${escHtml(prosjektnr)}</div>
    <div class="prosjekt">${escHtml(prosjektnamn)}</div>
  </div>
  <table class="hovudtabell">
    <thead><tr>${PRINT_KOLONNAR.map(k => `<th style="width:${k.breiddMm}mm">${k.namn}</th>`).join('')}</tr></thead>
    <tbody>${radHtml}</tbody>
  </table>
  <div class="botntekst">Side ${sideNr} av ${talSider}</div>
  <table class="tittelblokk">
    <thead><tr><th>Dokumentnummer</th><th>Revisjon</th></tr></thead>
    <tbody><tr><td class="mono">${escHtml(dokumentnummer)}</td><td class="mono">${escHtml(revisjon)}</td></tr></tbody>
  </table>
</div>`
}

function byggHtmlDokument({ printRader, format, retning, prosjektnr, prosjektnamn, dokumentnummer, revisjon }) {
  const { breidd, høgd } = sideDimensjonar(format, retning)
  const tilgjengelegHøgd = høgd - 2 * MARGIN_MM - HEADER_HEIGHT_MM - FOOTER_HEIGHT_MM - TABELL_HEADER_HØGD_MM
  const radarPerSide = Math.max(1, Math.floor(tilgjengelegHøgd / RAD_HØGD_MM))
  const sider = []
  for (let i = 0; i < printRader.length; i += radarPerSide) sider.push(printRader.slice(i, i + radarPerSide))
  if (sider.length === 0) sider.push([])

  const sideHtml = sider.map((radar, i) => byggSideHtml({
    radar, sideNr: i + 1, talSider: sider.length, breidd, høgd,
    prosjektnr, prosjektnamn, dokumentnummer, revisjon,
  })).join('\n')

  return { talSider: sider.length, breidd, høgd, html: `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
@page { size: ${breidd}mm ${høgd}mm; margin: 0 }
* { box-sizing:border-box; margin:0; padding:0; font-family:Arial, Helvetica, sans-serif }
body { width:${breidd}mm }
.side { position:relative; width:${breidd}mm; height:${høgd}mm; page-break-after:always; overflow:hidden }
.side:last-child { page-break-after:auto }
.topptekst { position:absolute; top:${MARGIN_MM}mm; left:${MARGIN_MM}mm; right:${MARGIN_MM}mm }
.topptekst .tittel { font-size:18pt; font-weight:700; margin-bottom:2mm }
.topptekst .prosjekt { font-size:16pt; font-weight:700; line-height:1.3 }
.hovudtabell { position:absolute; top:${MARGIN_MM + HEADER_HEIGHT_MM}mm; left:${MARGIN_MM}mm; right:${MARGIN_MM}mm;
  bottom:${MARGIN_MM + FOOTER_HEIGHT_MM}mm; border-collapse:collapse; font-size:9pt; overflow:hidden }
.hovudtabell th { text-align:left; border-bottom:1pt solid #000; padding:1mm 2mm; font-size:9pt; white-space:nowrap }
.hovudtabell td { border-bottom:0.3pt solid #999; padding:1mm 2mm; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
.hovudtabell td.mono, .hovudtabell th.mono { font-family:'Courier New', monospace }
.botntekst { position:absolute; bottom:${MARGIN_MM}mm; left:${MARGIN_MM}mm; font-size:9pt }
.tittelblokk { position:absolute; bottom:${MARGIN_MM}mm; right:${MARGIN_MM}mm; border-collapse:collapse; border:0.5pt solid #000 }
.tittelblokk th, .tittelblokk td { border:0.5pt solid #000; padding:1.5mm 3mm; font-size:8pt; text-align:left; white-space:nowrap }
.tittelblokk th { font-weight:700 }
.tittelblokk td.mono { font-family:'Courier New', monospace }
</style></head>
<body>${sideHtml}</body></html>` }
}

export default function TegningslisteModal({ dokumenter, aktivtSett, aktivtProsjekt, onLukk }) {
  const forslag = useMemo(() => finnPassandeFormat(), [])
  const [format, setFormat] = useState(forslag.format)
  const [retning, setRetning] = useState(forslag.retning)
  const [dokumentnummer, setDokumentnummer] = useState('A-60-01')
  const [revisjon, setRevisjon] = useState('')
  const [genererer, setGenererer] = useState(false)
  const [feil, setFeil] = useState('')

  const harBru = typeof window !== 'undefined' && !!window.resultatdokumentAPI

  const printRader = useMemo(() =>
    dokumenter.map(d => hentPrintVerdiar(d, aktivtSett)),
  [dokumenter, aktivtSett])

  const { talSider, breidd, høgd, html } = useMemo(() => byggHtmlDokument({
    printRader, format, retning,
    prosjektnr: aktivtProsjekt?.projectNumber || '', prosjektnamn: aktivtProsjekt?.name || '',
    dokumentnummer, revisjon,
  }), [printRader, format, retning, aktivtProsjekt, dokumentnummer, revisjon])

  // Førehandsvising: iframe i naturleg (mm→px) storleik, skalert ned med
  // ein CSS-transform til å passe i vindauget — SAME HTML som vert sendt
  // til PDF-generatoren, så det er aldri usemje mellom dei to.
  const naturleggBreiddPx = breidd * MM_TIL_PX
  const naturlegHøgdPx = høgd * MM_TIL_PX
  const previewMaksBreidd = 560
  const skala = Math.min(1, previewMaksBreidd / naturleggBreiddPx)

  const generer = async () => {
    if (!harBru) return
    setGenererer(true); setFeil('')
    try {
      const filnamnForslag = `Tegningsliste_${(aktivtProsjekt?.projectNumber || 'prosjekt').replace(/[\\/:*?"<>|]/g, '')}.pdf`
      const svar = await window.resultatdokumentAPI.dtmGenererTegningslistePdf(html, filnamnForslag)
      if (svar?.avbrote) { setGenererer(false); return }
      if (!svar?.ok) { setFeil(svar?.melding || 'Ukjend feil.'); setGenererer(false); return }
      onLukk()
    } catch (e) {
      setFeil(e.message)
      setGenererer(false)
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.42)', display:'flex',
      alignItems:'center', justifyContent:'center', zIndex:200 }}>
      <div style={{ background:'var(--bg2)', borderRadius:'var(--r2)', width:'min(94vw, 800px)',
        maxHeight:'92vh', overflow:'hidden', display:'flex', flexDirection:'column',
        boxShadow:'0 24px 70px rgba(0,0,0,.35)' }}>

        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 20px',
          borderBottom:'1px solid rgba(255,255,255,.12)', flexShrink:0, background:'#2563EB' }}>
          <span style={{ fontSize:15, fontWeight:800, color:'#fff' }}>Tegningsliste</span>
          <div style={{ flex:1 }}/>
          <button onClick={onLukk} title="Lukk" style={{ background:'none', border:'none', fontSize:22,
            cursor:'pointer', color:'rgba(255,255,255,.85)', lineHeight:1, padding:'2px 6px' }}>×</button>
        </div>

        <div style={{ flex:1, overflow:'auto', padding:'20px 24px', display:'flex', gap:24 }}>
          {/* ── Val ── */}
          <div style={{ width:220, flexShrink:0, display:'flex', flexDirection:'column', gap:16 }}>
            <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <span className="dt-etikett">Arkstørrelse</span>
              <div className="dt-seg" style={{ width:'100%' }}>
                {['A4', 'A2', 'A1'].map(f => (
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
            <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <span className="dt-etikett">Dokumentnummer (dette arket)</span>
              <input className="dt-input" value={dokumentnummer} onChange={e => setDokumentnummer(e.target.value)}/>
            </label>
            <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <span className="dt-etikett">Revisjon</span>
              <input className="dt-input" value={revisjon} onChange={e => setRevisjon(e.target.value)}/>
            </label>
            <div style={{ fontSize:11.5, color:'var(--text3)', lineHeight:1.6 }}>
              {dokumenter.length} dokument, {talSider} side{talSider === 1 ? '' : 'r'}.
            </div>
            {feil && <div style={{ fontSize:12, color:'var(--danger)' }}>{feil}</div>}
          </div>

          {/* ── Førehandsvising (side 1) ── */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
            <span className="dt-etikett">Førehandsvising — side 1{talSider > 1 ? ` av ${talSider}` : ''}</span>
            <div style={{ width:naturleggBreiddPx * skala, height:naturlegHøgdPx * skala, overflow:'hidden',
              border:'1px solid var(--border)', boxShadow:'var(--shadow-sm)', background:'#fff' }}>
              <iframe title="Førehandsvising" srcDoc={html}
                style={{ width:naturleggBreiddPx, height:naturlegHøgdPx, border:'none',
                  transform:`scale(${skala})`, transformOrigin:'top left' }}/>
            </div>
          </div>
        </div>

        <div style={{ display:'flex', gap:8, padding:'14px 20px', borderTop:'1px solid var(--border)', flexShrink:0 }}>
          <div style={{ flex:1 }}/>
          <button className="dt-knapp" onClick={onLukk}>Avbryt</button>
          <button className="dt-knapp hovud" disabled={!harBru || genererer} onClick={generer}>
            {genererer ? 'Genererer…' : 'Generer PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}
