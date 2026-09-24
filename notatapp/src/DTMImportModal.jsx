import { useState } from 'react'
import { KATEGORI_LABEL, KATEGORI_FARGE, genererDNummer, genererSDNummer } from './dtmKonstantar'

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
  { key:'nr',           namn:'Nr.',           w:120 },
  { key:'rev',          namn:'Rev.',          w:64 },
  { key:'dato',         namn:'Dato',          w:96 },
  { key:'fag',          namn:'Fag',           w:80 },
  { key:'tittel',       namn:'Tittel',        w:200 },
  { key:'fase',         namn:'Fase',          w:110 },
  { key:'delprosjekt',  namn:'Delprosjekt',   w:120 },
  { key:'malestokk',    namn:'Målestokk',     w:96 },
  { key:'utarbeida_av', namn:'Utarbeida av',  w:110 },
  { key:'fk_person',    namn:'Fagkontroll',   w:90 },
  { key:'godkjent_av',  namn:'Godkjent',      w:90 },
  { key:'ek_person',    namn:'EK',            w:56 },
  { key:'oppdragsgivar',namn:'Oppdragsgivar', w:150 },
  { key:'tiltakshavar', namn:'Tiltakshavar',  w:150 },
  { key:'oppdragsnr',   namn:'Oppdragsnr.',   w:100 },
]

export default function DTMImportModal({ kategori, oppdragsSti, dokumenter, onLukk, onImporter }) {
  const [steg, setSteg]         = useState('drop') // 'drop' | 'skannar' | 'gjennomgang' | 'importerer' | 'ferdig'
  const [rader, setRader]       = useState([])
  const [dragOver, setDragOver] = useState(false)
  const [feil, setFeil]         = useState('')
  const [resultat, setResultat] = useState([])

  const farge = KATEGORI_FARGE[kategori]
  const harBru = typeof window !== 'undefined' && !!window.resultatdokumentAPI

  const handleDrop = async (e) => {
    e.preventDefault()
    setDragOver(false)
    if (!harBru || steg !== 'drop') return
    const droppa = Array.from(e.dataTransfer.files || [])
    const filPathar = droppa.map(f => window.resultatdokumentAPI.hentFilsti(f)).filter(Boolean)
    if (filPathar.length === 0) return

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
        if (kategori === 'styrande_dokument') {
          nr = genererSDNummer([...kjenteNr, ...nye])
        } else if (s.nrUsikker) {
          nr = genererDNummer([...kjenteNr, ...nye], s.fag)
        }
        nye.push(nr)
        return { ...s, nr, fjerna:false }
      })
      setRader(rader2)
      setSteg('gjennomgang')
    } catch (e2) {
      setFeil('Klarte ikkje skanne filene: ' + e2.message)
      setSteg('drop')
    }
  }

  const oppdaterRad = (i, felt, verdi) => {
    setRader(rs => rs.map((r, idx) => idx === i ? { ...r, [felt]: verdi } : r))
  }
  const fjernRad = (i) => setRader(rs => rs.map((r, idx) => idx === i ? { ...r, fjerna:true } : r))
  const attRader = rader.filter(r => !r.fjerna)

  const bekreft = async () => {
    if (attRader.length === 0) return
    setSteg('importerer')
    setFeil('')
    try {
      const svar = await onImporter(attRader)
      setResultat(svar || [])
      setSteg('ferdig')
    } catch (e2) {
      setFeil('Importen feila: ' + e2.message)
      setSteg('gjennomgang')
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.42)', display:'flex',
      alignItems:'center', justifyContent:'center', zIndex:200 }}>
      <div style={{ background:'var(--bg2)', borderRadius:'var(--r2)',
        width: steg === 'gjennomgang' || steg === 'ferdig' ? 'min(94vw, 1180px)' : 480,
        maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column',
        boxShadow:'0 24px 70px rgba(0,0,0,.35)' }}>

        {/* Head */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 20px',
          borderBottom:'1px solid rgba(255,255,255,.12)', flexShrink:0, background:farge }}>
          <span style={{ fontSize:15, fontWeight:800, color:'#fff' }}>
            Import {KATEGORI_LABEL[kategori].toLowerCase()}
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
                      {FELT.map(f => <th key={f.key} style={{ ...thStil, width:f.w }}>{f.namn}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rader.map((r, i) => r.fjerna && r.status !== 'ok' ? (
                      <tr key={i} style={{ opacity:.5 }}>
                        <td style={tdStil}/>
                        <td style={tdStil} colSpan={FELT.length + 1}>
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
                        <td style={{ ...tdStil, fontSize:11.5, color:'var(--text3)', maxWidth:160,
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.filnamn}>
                          {r.filnamn}
                        </td>
                        {FELT.map(f => (
                          <td key={f.key} style={tdStil}>
                            <input value={r[f.key] || ''} onChange={e => oppdaterRad(i, f.key, e.target.value)}
                              style={{ ...inputStil, ...(f.key === 'nr' && r.nrUsikker ? { color:'var(--warn)' } : {}) }}/>
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
              <button onClick={onLukk} className="dt-knapp hovud">Lukk</button>
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
