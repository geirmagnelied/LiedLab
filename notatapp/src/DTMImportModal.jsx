import { useState, useMemo, useEffect } from 'react'
import { KATEGORI_LABEL, KATEGORI_FARGE, genererDNummer, genererSDNummer, genererEDOKNummer,
  FERDIGSTILLING_STATUS, EKSTERN_DOK_KATEGORIAR } from './dtmKonstantar'

// ═══════════════════════════════════════════════════════════════════
//  DTMImportModal — import-flyten for éin kategori (arbeidsdokument/
//  resultatdokument/kontrolldokument/styrande dokument), sjå
//  claude/dtm-modul.md. Tre steg:
//
//   1. drop      — dra-og-slepp-sone for filer frå Windows Utforskar
//   2. gjennomgang — redigerbar matrise med det skanninga fann, brukar
//                    kan rette/fjerne dokument før stadfesting
//   3. ferdig    — oppsummering av kva som vart importert/feila
//
//  Sjølve fil-skanninga/flyttinga skjer via window.resultatdokumentAPI
//  sine dtm*-funksjonar (Electron-fil-brua, sjå electron/main.js). Denne
//  komponenten skriv ALDRI direkte til Supabase — det gjer DTMModule
//  (sjå onImporter-prop), som eig dtm_dokumenter-tilstanden.
// ═══════════════════════════════════════════════════════════════════

const FELT = [
  { key:'nr',           namn:'Dokumentnummer' },
  { key:'rev',          namn:'Rev.' },
  { key:'dato',         namn:'Dato' },
  { key:'revisjonsbeskriving', namn:'Revisjonsskildring' },
  { key:'fag',          namn:'Fag' },
  { key:'tittel',       namn:'Tittel' },
  { key:'oppdragsgivar',namn:'Oppdragsgivar' },
  { key:'tiltakshavar', namn:'Tiltakshavar' },
  { key:'tegningsformal', namn:'Tegningsformål' },
  { key:'fase',         namn:'Fase' },
  { key:'delprosjekt',  namn:'Delprosjekt' },
  { key:'ferdigstillingsstatus', namn:'Status ved ferdigstilling', val:['', ...FERDIGSTILLING_STATUS] },
  { key:'malestokk',    namn:'Målestokk' },
  { key:'format',       namn:'Arkstørrelse' },
  { key:'utarbeida_av', namn:'Utarbeida av' },
  { key:'fk_person',    namn:'Fagkontroll' },
  { key:'godkjent_av',  namn:'Godkjent' },
  { key:'oppdragsnr',   namn:'Oppdragsnr.' },
]

// Vist BERRE for kategorien «eksternt_dokument», sjå kategori-medviten
// `felt`-utrekning i komponenten under.
const EKSTERN_KATEGORI_FELT = { key:'ekstern_kategori', namn:'Kategori eksternt dok.', val:['', ...EKSTERN_DOK_KATEGORIAR] }

function filtype(filnamn) {
  const m = /\.([a-z0-9]+)$/i.exec(filnamn || '')
  return m ? m[1].toUpperCase() : ''
}

export default function DTMImportModal({ kategori, oppdragsSti, dokumenter, onLukk, onImporter, forhandsvalde }) {
  // `forhandsvalde` (valfri): fulle filstiar som ALT er kjende (t.d. frå
  // ukjende-filer-skanninga, sjå DTMUkjendeFilerVarsel.jsx) — går rett til
  // skanning utan drop-steget, sidan brukar alt har valt filene implisitt
  // ved å plassere dei i kategorimappa. Resten av flyten (gjennomgang,
  // bekreft, «same operasjonar som ein tradisjonell import») er HEILT
  // UENDRA — sjå claude/dtm-modul.md.
  const [steg, setSteg]         = useState(forhandsvalde?.length ? 'skannar' : 'drop')
  const [rader, setRader]       = useState([])
  const [dragOver, setDragOver] = useState(false)
  const [feil, setFeil]         = useState('')
  const [resultat, setResultat] = useState([])
  // Reint UI-val enno (sjølve AI-kallet kjem seinare) — berre aktuelt for
  // eksterne/innkomande dokument, sjå brukar sitt krav 29. sept. 2026.
  const [brukAI, setBrukAI]     = useState(false)

  const farge = KATEGORI_FARGE[kategori]
  const harBru = typeof window !== 'undefined' && !!window.resultatdokumentAPI
  // «Kategori eksternt dokument» er berre meiningsfylt for denne eine
  // kategorien — resten av FELT-lista er felles for alle kategoriane.
  const felt = kategori === 'eksternt_dokument' ? [...FELT, EKSTERN_KATEGORI_FELT] : FELT

  const skannOgGaaTilGjennomgang = async (filPathar) => {
    setSteg('skannar')
    setFeil('')
    try {
      const skanna = await window.resultatdokumentAPI.dtmSkannFiler(filPathar, kategori)
      // Nr-fallback (Fag-D-<løpenr> / SD-<løpenr>) skjer her, ikkje i
      // Electron-fil-brua — treng tilgang til dei ALT eksisterande
      // dokumentnummera i registeret (sjå claude/dtm-modul.md).
      const kjenteNr = dokumenter.map(d => d.nr)
      const nye = []
      const rader2 = skanna.map(s => {
        if (s.status !== 'ok') return { ...s, fjerna:true }
        let nr = s.nr
        let nrUsikker = s.nrUsikker
        let tittel = s.tittel
        if (kategori === 'eksternt_dokument') {
          // ALLTID eit ferskt EDOK-nummer — filnamnet til eit innkomande
          // dokument fylgjer ikkje vår eigen kode, så det finst ikkje noko
          // «usikkert» å falle tilbake frå her (brukar sitt eige krav).
          const gamalNr = s.nr
          nr = genererEDOKNummer([...kjenteNr, ...nye])
          nrUsikker = false
          // Fall attende til det ORIGINALE filnamnet (utan filending) som
          // skildring — den skanna «tittelen» er berre meiningsfylt viss ho
          // faktisk kom frå eit PDF-tittelfelt (ikkje berre den no-forkasta
          // kodegjetninga, som ville synt sjølve EDOK-nummeret att som «tittel»).
          if (!tittel || tittel === gamalNr) tittel = s.filnamn.replace(/\.[a-z0-9]+$/i, '')
        } else if (kategori === 'styrande_dokument') {
          nr = genererSDNummer([...kjenteNr, ...nye])
        } else if (s.nrUsikker) {
          nr = genererDNummer([...kjenteNr, ...nye], s.fagKode || s.fag)
        }
        nye.push(nr)
        return { ...s, nr, nrUsikker, tittel, fjerna:false }
      })
      setRader(rader2)
      setSteg('gjennomgang')
    } catch (e2) {
      setFeil('Klarte ikkje skanne filene: ' + e2.message)
      // `forhandsvalde` har ikkje noko drop-steg å gå attende til — vis
      // feilen i gjennomgangs-steget i staden (tom tabell, men synleg
      // feilmelding, sjå render-greina under).
      setSteg(forhandsvalde?.length ? 'gjennomgang' : 'drop')
    }
  }

  // Berre køyrer éin gong, for `forhandsvalde`-tilfellet — vanleg drag-og-
  // slepp-import treng ikkje dette, sjå handleDrop.
  useEffect(() => {
    if (forhandsvalde?.length) skannOgGaaTilGjennomgang(forhandsvalde)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDrop = async (e) => {
    e.preventDefault()
    setDragOver(false)
    if (!harBru || steg !== 'drop') return
    const droppa = Array.from(e.dataTransfer.files || [])
    const filPathar = droppa.map(f => window.resultatdokumentAPI.hentFilsti(f)).filter(Boolean)
    if (filPathar.length === 0) return
    await skannOgGaaTilGjennomgang(filPathar)
  }

  const oppdaterRad = (i, felt, verdi) => {
    setRader(rs => rs.map((r, idx) => idx === i ? { ...r, [felt]: verdi } : r))
  }
  const fjernRad = (i) => setRader(rs => rs.map((r, idx) => idx === i ? { ...r, fjerna:true } : r))
  const attRader = rader.filter(r => !r.fjerna)

  // Kolonnebreidd tilpassa faktisk innhald (i staden for faste pikselbreidder),
  // slik at t.d. eit langt oppdragsgivarnamn ikkje vert avkutta medan Rev.-
  // kolonna tek unødig mykje plass. Målt i «ch» (teiknbreidd), rekna ut på
  // nytt kvar gong radene endrar seg.
  const kolonneBreidd = useMemo(() => {
    const breidd = {}
    for (const f of felt) {
      const lengder = attRader.map(r => String(r[f.key] || '').length).concat(f.namn.length)
      breidd[f.key] = Math.max(5, Math.min(38, Math.max(...lengder, 0) + 2))
    }
    return breidd
  }, [attRader, felt])

  const bekreft = async () => {
    if (attRader.length === 0) return
    setSteg('importerer')
    setFeil('')
    try {
      // `kategori` sendt EKSPLISITT (ikkje berre underforstått av kallaren
      // sin eigen state) — DTMModule.jsx sin importer() treng dette for å
      // vite kva kategori ein `forhandsvalde`-registrering (ukjende filer)
      // gjeld, sidan den vegen ikkje går via det vanlege import-menyvalet.
      const svar = await onImporter(attRader, { brukAI, kategori })
      setResultat(svar || [])
      setSteg('ferdig')
    } catch (e2) {
      setFeil('Importen feila: ' + e2.message)
      setSteg('gjennomgang')
    }
  }

  // «Prøv igjen» — for feila dokument (t.d. fila var open i eit anna
  // program) skal brukar kunne lukke fila og prøve akkurat DEI på nytt,
  // i staden for å måtte starte heile importen om att frå draging av filer.
  const feila = resultat.filter(r => r.status !== 'ok')
  const prøvIgjen = async () => {
    if (feila.length === 0) return
    setSteg('importerer')
    try {
      const svar = await onImporter(feila, { brukAI, kategori })
      setResultat(rs => rs.map(r => {
        if (r.status === 'ok') return r
        const nytt = svar?.find(s => s.nr === r.nr)
        return nytt || r
      }))
      setSteg('ferdig')
    } catch (e2) {
      setFeil('Prøv-igjen feila: ' + e2.message)
      setSteg('ferdig')
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.42)', display:'flex',
      alignItems:'center', justifyContent:'center', zIndex:200 }}>
      <div style={{ background:'var(--bg2)', borderRadius:'var(--r2)',
        width: steg === 'gjennomgang' || steg === 'ferdig' ? '90vw' : 480,
        maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column',
        boxShadow:'0 24px 70px rgba(0,0,0,.35)' }}>

        {/* Head */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 20px',
          borderBottom:'1px solid rgba(255,255,255,.12)', flexShrink:0, background:farge }}>
          <span style={{ fontSize:15, fontWeight:800, color:'#fff' }}>
            {forhandsvalde?.length ? 'Registrer ukjende filer — ' : 'Import '}{KATEGORI_LABEL[kategori].toLowerCase()}
          </span>
          <div style={{ flex:1 }}/>
          <button onClick={onLukk} title="Lukk"
            style={{ background:'none', border:'none', fontSize:22, cursor:'pointer',
              color:'rgba(255,255,255,.85)', lineHeight:1, padding:'2px 6px' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflow:'auto', padding:'20px 24px' }}>

          {!harBru ? (
            <div style={{ fontSize:13, color:'var(--text3)', textAlign:'center', padding:'30px 0' }}>
              Import krev skrivebordsversjonen av appen.
            </div>

          ) : !oppdragsSti ? (
            <div style={{ fontSize:13, color:'var(--text3)', textAlign:'center', padding:'30px 0' }}>
              Ingen oppdragssti er låst for dette prosjektet enno. Gå til <b>Prosjekt</b>-modulen
              og lås ein oppdragssti fyrst.
            </div>

          ) : steg === 'drop' ? (
            <>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                style={{
                  border:`2px dashed ${dragOver ? farge : 'var(--border2)'}`,
                  borderRadius:'var(--r2)', background: dragOver ? 'var(--bg3)' : 'var(--bg2)',
                  padding:'48px 20px', textAlign:'center',
                }}>
                <div style={{ fontSize:15, fontWeight:700, color:'var(--text)', marginBottom:6 }}>
                  Slepp filer her
                </div>
                <div style={{ fontSize:12, color:'var(--text3)' }}>
                  PDF, IFC, Excel og andre filformat frå Windows Utforskar.
                </div>
                {feil && <div style={{ marginTop:14, fontSize:12, color:'var(--danger)' }}>{feil}</div>}
              </div>
              {kategori === 'eksternt_dokument' && (
                <label style={{ display:'flex', alignItems:'center', gap:8, marginTop:14,
                  fontSize:12.5, color:'var(--text2)', cursor:'pointer', justifyContent:'center' }}>
                  <input type="checkbox" checked={brukAI} onChange={e => setBrukAI(e.target.checked)}
                    style={{ width:15, height:15, accentColor:farge, cursor:'pointer' }}/>
                  Bruk AI til indeksering (merkjer dokumenta for seinare handsaming — sjølve AI-kallet kjem seinare)
                </label>
              )}
            </>

          ) : steg === 'skannar' ? (
            <div style={{ fontSize:14, color:'var(--text2)', fontWeight:600, textAlign:'center', padding:'30px 0' }}>
              Skannar filer…
            </div>

          ) : steg === 'gjennomgang' ? (
            <>
              <div style={{ fontSize:12, color:'var(--text3)', marginBottom:12 }}>
                Rett gjerne felt før du stadfestar. Dokument merkt med <b style={{ color:'var(--warn)' }}>*</b> ved
                nummeret fekk ikkje eit dokumentnummer att frå skanninga — eit mellombels nummer er
                sett i staden, rett det til det rette om du kjenner det.
              </div>
              <div style={{ overflowX:'auto', border:'1.5px solid var(--border)', borderRadius:'var(--r)' }}>
                <table style={{ borderCollapse:'collapse', width:'100%', fontSize:12.5 }}>
                  <thead>
                    <tr style={{ background:'var(--bg3)' }}>
                      <th style={{ width:28 }}/>
                      <th style={thStil}>Fil</th>
                      <th style={{ ...thStil, width:'6ch' }}>Filtype</th>
                      {felt.map(f => <th key={f.key} style={{ ...thStil, width:`${kolonneBreidd[f.key]}ch` }}>{f.namn}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rader.map((r, i) => r.fjerna && r.status !== 'ok' ? (
                      <tr key={i} style={{ opacity:.5 }}>
                        <td style={tdStil}/>
                        <td style={tdStil} colSpan={felt.length + 2}>
                          <span style={{ color:'var(--danger)' }}>✕ {r.filnamn}</span> — {r.melding}
                        </td>
                      </tr>
                    ) : !r.fjerna && (
                      <tr key={i}>
                        <td style={{ ...tdStil, textAlign:'center' }}>
                          <button onClick={() => fjernRad(i)} title="Fjern dette dokumentet frå importen"
                            style={{ border:'none', background:'transparent', color:'var(--text3)',
                              fontSize:14, cursor:'pointer', fontWeight:800 }}>×</button>
                        </td>
                        <td style={{ ...tdStil, fontSize:11.5, color:'var(--text3)', maxWidth:220,
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.filnamn}>
                          {r.filnamn}
                        </td>
                        <td style={{ ...tdStil, fontSize:11.5, color:'var(--text3)' }}>{filtype(r.filnamn)}</td>
                        {felt.map(f => (
                          <td key={f.key} style={tdStil}>
                            {f.val ? (
                              <select value={r[f.key] || ''} onChange={e => oppdaterRad(i, f.key, e.target.value)}
                                style={{ ...inputStil, width:`${kolonneBreidd[f.key]}ch` }}>
                                {f.val.map(v => <option key={v || '_tom'} value={v}>{v || '—'}</option>)}
                              </select>
                            ) : (
                              <input value={r[f.key] || ''} onChange={e => oppdaterRad(i, f.key, e.target.value)}
                                style={{ ...inputStil, width:`${kolonneBreidd[f.key]}ch`,
                                  ...(f.key === 'nr' && r.nrUsikker ? { color:'var(--warn)' } : {}) }}/>
                            )}
                            {f.key === 'nr' && r.nrUsikker && <span style={{ color:'var(--warn)' }}> *</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {feil && <div style={{ marginTop:12, fontSize:12, color:'var(--danger)' }}>{feil}</div>}
            </>

          ) : steg === 'importerer' ? (
            <div style={{ fontSize:14, color:'var(--text2)', fontWeight:600, textAlign:'center', padding:'30px 0' }}>
              Importerer…
            </div>

          ) : (
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:12 }}>
                Import fullført
              </div>
              <div style={{ border:'1.5px solid var(--border)', borderRadius:'var(--r)', overflow:'hidden' }}>
                {resultat.map((r, i) => (
                  <div key={i} style={{ padding:'8px 12px', borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                    background: r.status === 'ok' ? 'var(--bg2)' : 'rgba(185,28,28,.06)' }}>
                    {r.status === 'ok' ? (
                      <span style={{ fontSize:13, fontWeight:600, color:'var(--success)' }}>
                        ✓ {r.nr} — {r.filnamn}
                      </span>
                    ) : (
                      <>
                        <span style={{ fontSize:13, fontWeight:600, color:'var(--danger)' }}>✕ {r.nr}</span>
                        <div style={{ fontSize:11, color:'var(--danger)', marginTop:2 }}>{r.melding}</div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              {feila.length > 0 && (
                <div style={{ marginTop:14, fontSize:12, color:'var(--text3)' }}>
                  {feila.length} dokument feila. Lukk fila(ne) i det andre programmet om det er årsaka, og
                  trykk «Prøv igjen» — dei som alt lukkast vert ikkje importerte på nytt.
                </div>
              )}
              {feil && <div style={{ marginTop:12, fontSize:12, color:'var(--danger)' }}>{feil}</div>}
            </div>
          )}
        </div>

        {/* Footer */}
        {(steg === 'gjennomgang' || steg === 'ferdig') && (
          <div style={{ display:'flex', gap:8, padding:'14px 20px', borderTop:'1px solid var(--border)', flexShrink:0 }}>
            <div style={{ flex:1 }}/>
            {steg === 'gjennomgang' ? (
              <>
                <button onClick={onLukk} className="dt-knapp">Avbryt</button>
                <button onClick={bekreft} disabled={attRader.length === 0}
                  className="dt-knapp hovud" style={{ opacity: attRader.length === 0 ? .5 : 1 }}>
                  Bekreft import ({attRader.length})
                </button>
              </>
            ) : (
              <>
                {feila.length > 0 && (
                  <button onClick={prøvIgjen} className="dt-knapp hovud">Prøv igjen ({feila.length})</button>
                )}
                <button onClick={onLukk} className="dt-knapp">Lukk</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const thStil = { textAlign:'left', padding:'7px 8px', fontSize:11, fontWeight:700, color:'var(--text3)',
  textTransform:'uppercase', letterSpacing:'.04em', borderBottom:'1px solid var(--border)' }
const tdStil = { padding:'4px 8px', borderBottom:'1px solid var(--border)' }
const inputStil = { width:'100%', padding:'4px 6px', border:'1px solid var(--border)', borderRadius:5,
  fontSize:12.5, fontFamily:'var(--font)', background:'var(--bg2)', color:'var(--text)' }
