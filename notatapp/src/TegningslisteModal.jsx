import { useState, useMemo, useEffect } from 'react'
import { løysAktivtSett, KATEGORI_LABEL } from './dtmKonstantar'

// ═══════════════════════════════════════════════════════════════════
//  TegningslisteModal — genererer ei utskriftsklar «Tegningsliste»-PDF
//  (A4/A2/A1, ståande/liggjande) av dei synlege DTM-dokumenta, og lagrar
//  ho DIREKTE i vald DTM-kategorimappe på disk. Sjå claude/dtm-modul.md.
//
//  HEILE HTML-dokumentet (éin <div class="side"> per side, alt paginert
//  her i renderar-koden — Chromium sin printToPDF støttar IKKJE sidetal-
//  medvitne topp-/botntekstar via rein CSS) vert bygd i denne fila, og
//  attgjeve BÅDE som ei skalert førehandsvising (side 1, i eit <iframe>)
//  OG sendt uendra til Electron (dtmGenererTegningslistePdf) for sjølve
//  PDF-genereringa — éin og same kjelde, ingen sjanse for at
//  førehandsvisinga lyg om korleis utskrifta faktisk vert.
//
//  Vindauget er BÅDE dragbart (via topplinja) og skalerbart frå ALLE
//  kantar/hjørne (åtte eigendefinerte dra-handtak — same «mousedown på
//  window»-mønster som resten av appen sine flytande vindauge/kolonne-
//  breidder brukar, ALDRI CSS sin eigen `resize`, sjå NoteModal.jsx).
// ═══════════════════════════════════════════════════════════════════

const FORMAT_MM = { A4: [210, 297], A3: [297, 420], A2: [420, 594], A1: [594, 841] }
const MARGIN_MM = 15
const HEADER_HEIGHT_MM = 26
const TITTELBLOKK_TOPP_BREIDD_MM = 55
const FOOTER_HEIGHT_MM = 22
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
  ['A3', 'ståande'], ['A3', 'liggjande'],
  ['A2', 'ståande'], ['A2', 'liggjande'],
  ['A1', 'ståande'], ['A1', 'liggjande'],
]

// Dei tre DTM-kategoriane ei tegningsliste kan lagrast som — IKKJE
// «styrande dokument», som ikkje er ein naturleg heim for denne fila.
const LAGRINGS_KATEGORIAR = ['resultatdokument', 'kontrolldokument', 'arbeidsdokument']

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

function dagensDato() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

function sanertFilnamn(s) {
  return String(s || '').replace(/[\\/:*?"<>|]/g, '').trim()
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

function byggSideHtml({ radar, sideNr, talSider, breidd, høgd, tittel, prosjektnr, oppdragsgivar,
                        dokumentnummer, revisjon, revisjonsdato, arkstorleikTekst }) {
  const radHtml = radar.map(r => `
    <tr>${PRINT_KOLONNAR.map(k => `<td${k.mono ? ' class="mono"' : ''}>${escHtml(r[k.key])}</td>`).join('')}</tr>`).join('')

  return `
<div class="side" style="width:${breidd}mm;height:${høgd}mm">
  <div class="topptekst">
    <div class="tittel">${escHtml(tittel)}</div>
    <div class="prosjekt">Prosjektnummer: ${escHtml(prosjektnr)}</div>
    <div class="prosjekt">${escHtml(oppdragsgivar)}</div>
  </div>
  <table class="tittelblokk-topp">
    <thead><tr><th>Dokumentnummer</th><th>Revisjon</th></tr></thead>
    <tbody><tr><td class="mono">${escHtml(dokumentnummer)}</td><td class="mono">${escHtml(revisjon)}</td></tr></tbody>
  </table>
  <table class="hovudtabell">
    <thead><tr>${PRINT_KOLONNAR.map(k => `<th style="width:${k.breiddMm}mm">${k.namn}</th>`).join('')}</tr></thead>
    <tbody>${radHtml}</tbody>
  </table>
  <div class="botntekst">Side ${sideNr} av ${talSider}</div>
  <div class="botntekst-hogre">
    <span>${escHtml(dokumentnummer)}</span><span>${escHtml(tittel)}</span><span>Rev. ${escHtml(revisjon)}</span>
    <span>${escHtml(revisjonsdato)}</span><span>${escHtml(arkstorleikTekst)}</span>
  </div>
</div>`
}

function byggHtmlDokument({ printRader, format, retning, tittel, prosjektnr, oppdragsgivar,
                            dokumentnummer, revisjon, revisjonsdato }) {
  const { breidd, høgd } = sideDimensjonar(format, retning)
  const arkstorleikTekst = `${format} ${retning}`
  const tilgjengelegHøgd = høgd - 2 * MARGIN_MM - HEADER_HEIGHT_MM - FOOTER_HEIGHT_MM - TABELL_HEADER_HØGD_MM
  const radarPerSide = Math.max(1, Math.floor(tilgjengelegHøgd / RAD_HØGD_MM))
  const sider = []
  for (let i = 0; i < printRader.length; i += radarPerSide) sider.push(printRader.slice(i, i + radarPerSide))
  if (sider.length === 0) sider.push([])

  const sideHtml = sider.map((radar, i) => byggSideHtml({
    radar, sideNr: i + 1, talSider: sider.length, breidd, høgd, tittel,
    prosjektnr, oppdragsgivar, dokumentnummer, revisjon, revisjonsdato, arkstorleikTekst,
  })).join('\n')

  return { talSider: sider.length, breidd, høgd, html: `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
@page { size: ${breidd}mm ${høgd}mm; margin: 0 }
* { box-sizing:border-box; margin:0; padding:0; font-family:Arial, Helvetica, sans-serif }
body { width:${breidd}mm }
.side { position:relative; width:${breidd}mm; height:${høgd}mm; page-break-after:always; overflow:hidden }
.side:last-child { page-break-after:auto }
.topptekst { position:absolute; top:${MARGIN_MM}mm; left:${MARGIN_MM}mm;
  right:${MARGIN_MM + TITTELBLOKK_TOPP_BREIDD_MM + 6}mm }
.topptekst .tittel { font-size:22pt; font-weight:700; margin-bottom:2mm }
.topptekst .prosjekt { font-size:12pt; font-weight:400; line-height:1.4 }
.tittelblokk-topp { position:absolute; top:${MARGIN_MM}mm; right:${MARGIN_MM}mm;
  width:${TITTELBLOKK_TOPP_BREIDD_MM}mm; border-collapse:collapse; border:0.5pt solid #000; height:fit-content }
.tittelblokk-topp th, .tittelblokk-topp td { border:0.5pt solid #000; padding:1.5mm 3mm; font-size:8pt; text-align:left; white-space:nowrap }
.tittelblokk-topp th { font-weight:700 }
.tittelblokk-topp td.mono { font-family:'Courier New', monospace }
.hovudtabell { position:absolute; top:${MARGIN_MM + HEADER_HEIGHT_MM}mm; left:${MARGIN_MM}mm; right:${MARGIN_MM}mm;
  bottom:${MARGIN_MM + FOOTER_HEIGHT_MM}mm; border-collapse:collapse; font-size:9pt; overflow:hidden }
.hovudtabell th { text-align:left; border-bottom:1pt solid #000; padding:1mm 2mm; font-size:9pt; white-space:nowrap }
.hovudtabell td { border-bottom:0.3pt solid #999; padding:1mm 2mm; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
.hovudtabell td.mono, .hovudtabell th.mono { font-family:'Courier New', monospace }
.botntekst { position:absolute; bottom:${MARGIN_MM}mm; left:${MARGIN_MM}mm; font-size:9pt }
.botntekst-hogre { position:absolute; bottom:${MARGIN_MM}mm; right:${MARGIN_MM}mm; font-size:8pt;
  display:flex; gap:6mm; white-space:nowrap }
</style></head>
<body>${sideHtml}</body></html>` }
}

// ── Dragbart + skalerbart vindauge (åtte hjørne/kant-handtak) ───────────
const VINDAUGE_KEY = 'liedlab-tegningsliste-vindauge'
const MIN_W = 640, MIN_H = 480

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

export default function TegningslisteModal({ dokumenter, aktivtSett, aktivtProsjekt, oppdragsgivar,
                                              oppdragsSti, onLukk }) {
  const forslag = useMemo(() => finnPassandeFormat(), [])
  const [format, setFormat] = useState(forslag.format)
  const [retning, setRetning] = useState(forslag.retning)
  const [tittel, setTittel] = useState('Tegningsliste')
  const [dokumentnummer, setDokumentnummer] = useState('A-60-01')
  const [revisjon, setRevisjon] = useState('1')
  const [revisjonsdato, setRevisjonsdato] = useState(() => dagensDato())
  const [kategori, setKategori] = useState('resultatdokument')
  const [genererer, setGenererer] = useState(false)
  const [feil, setFeil] = useState('')

  const harBru = typeof window !== 'undefined' && !!window.resultatdokumentAPI

  // ── Vindauge: posisjon + storleik, dragbart og skalerbart frå alle kantar ──
  const [vindauge, setVindauge] = useState(() => {
    try {
      const lagra = JSON.parse(localStorage.getItem(VINDAUGE_KEY))
      if (lagra && lagra.w > 0 && lagra.h > 0) return lagra
    } catch { /* privat modus */ }
    const breddeProsent = forslag.retning === 'liggjande' ? 0.9 : 0.6
    const w = Math.max(MIN_W, Math.min(Math.round(window.innerWidth * 0.97), Math.round(window.innerWidth * breddeProsent)))
    const h = Math.max(MIN_H, Math.min(Math.round(window.innerHeight * 0.94), Math.round(window.innerHeight * 0.85)))
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
    dokumenter.map(d => hentPrintVerdiar(d, aktivtSett)),
  [dokumenter, aktivtSett])

  const { talSider, breidd, høgd, html } = useMemo(() => byggHtmlDokument({
    printRader, format, retning, tittel,
    prosjektnr: aktivtProsjekt?.projectNumber || '', oppdragsgivar: oppdragsgivar || '',
    dokumentnummer, revisjon, revisjonsdato,
  }), [printRader, format, retning, tittel, aktivtProsjekt, oppdragsgivar, dokumentnummer, revisjon, revisjonsdato])

  // Førehandsvising: iframe i naturleg (mm→px) storleik, skalert ned med
  // ein CSS-transform til å passe i vindauget — SAME HTML som vert sendt
  // til PDF-generatoren, så det er aldri usemje mellom dei to.
  const naturleggBreiddPx = breidd * MM_TIL_PX
  const naturlegHøgdPx = høgd * MM_TIL_PX
  const previewMaksBreidd = Math.max(280, vindauge.w - 280)
  const skala = Math.min(1, previewMaksBreidd / naturleggBreiddPx)

  // Føreslå neste løpande revisjonsnummer ved å telje kor mange filer i
  // vald kategorimappe som alt startar med dette dokumentnummeret — same
  // «høgste + 1»-idé som elles i appen (nextCaseNumber osb.), berre henta
  // frå disken i staden for databasen, sidan tegningslista IKKJE vert
  // registrert som ei eiga dtm_dokumenter-rad. Køyrer på nytt kvar gong
  // brukar byter kategori (eit medvite, sjeldan val) — IKKJE for kvart
  // tastetrykk i dokumentnummer-feltet, som ville vore urovekkjande.
  useEffect(() => {
    if (!harBru || !oppdragsSti) return
    let avbrote = false
    window.resultatdokumentAPI.dtmListFiler(oppdragsSti, kategori).then(svar => {
      if (avbrote) return
      const prefiks = dokumentnummer.trim().toUpperCase()
      const treff = (svar?.filer || []).filter(f => f.namn.toUpperCase().startsWith(prefiks))
      setRevisjon(String(treff.length + 1))
    }).catch(() => { /* la revisjonsforslaget stå urørt viss skanninga feilar */ })
    return () => { avbrote = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kategori, harBru, oppdragsSti])

  const generer = async () => {
    if (!harBru) return
    setGenererer(true); setFeil('')
    try {
      const filnamn = `${sanertFilnamn(dokumentnummer) || 'Tegningsliste'}_Rev${sanertFilnamn(revisjon) || '1'}.pdf`
      const svar = await window.resultatdokumentAPI.dtmGenererTegningslistePdf(html, oppdragsSti, kategori, filnamn)
      if (!svar?.ok) { setFeil(svar?.melding || 'Ukjend feil.'); setGenererer(false); return }
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
          borderBottom:'1px solid rgba(255,255,255,.12)', flexShrink:0, background:'#2563EB', cursor:'move' }}>
          <span style={{ fontSize:15, fontWeight:800, color:'#fff' }}>Tegningsliste</span>
          <div style={{ flex:1 }}/>
          <button onClick={onLukk} title="Lukk" style={{ background:'none', border:'none', fontSize:22,
            cursor:'pointer', color:'rgba(255,255,255,.85)', lineHeight:1, padding:'2px 6px' }}>×</button>
        </div>

        <div style={{ flex:1, overflow:'auto', padding:'20px 24px', display:'flex', gap:24 }}>
          {/* ── Val ── */}
          <div style={{ width:240, flexShrink:0, display:'flex', flexDirection:'column', gap:14 }}>
            <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <span className="dt-etikett">Tittel</span>
              <input className="dt-input" value={tittel} onChange={e => setTittel(e.target.value)}/>
            </label>
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
            </div>
            {feil && <div style={{ fontSize:12, color:'var(--danger)' }}>{feil}</div>}
          </div>

          {/* ── Førehandsvising (side 1) ── */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:8, minWidth:0 }}>
            <span className="dt-etikett">Førehandsvising — side 1{talSider > 1 ? ` av ${talSider}` : ''}</span>
            <div style={{ width:naturleggBreiddPx * skala, height:naturlegHøgdPx * skala, overflow:'hidden',
              border:'1px solid var(--border)', boxShadow:'var(--shadow-sm)', background:'#fff', flexShrink:0 }}>
              <iframe title="Førehandsvising" srcDoc={html}
                style={{ width:naturleggBreiddPx, height:naturlegHøgdPx, border:'none',
                  transform:`scale(${skala})`, transformOrigin:'top left' }}/>
            </div>
          </div>
        </div>

        <div style={{ display:'flex', gap:8, padding:'14px 20px', borderTop:'1px solid var(--border)', flexShrink:0 }}>
          <div style={{ fontSize:11.5, color:'var(--text3)', alignSelf:'center' }}>
            Lagrast som «{sanertFilnamn(dokumentnummer) || 'Tegningsliste'}_Rev{sanertFilnamn(revisjon) || '1'}.pdf»
            i {KATEGORI_LABEL[kategori]?.toLowerCase()}
          </div>
          <div style={{ flex:1 }}/>
          <button className="dt-knapp" onClick={onLukk}>Avbryt</button>
          <button className="dt-knapp hovud" disabled={!harBru || genererer} onClick={generer}>
            {genererer ? 'Genererer…' : 'Generer og lagre PDF'}
          </button>
        </div>

        {['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map(dir => (
          <div key={dir} onMouseDown={e => startVindaugeEndring(dir, e)}
            title="Dra for å endre storleiken på vindauget" style={handtakStil(dir)}/>
        ))}
      </div>
    </div>
  )
}
