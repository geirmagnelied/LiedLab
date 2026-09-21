import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

// ── Datoformat ──────────────────────────────────────────────────────
function fmtTid(ms) {
  if (!ms) return '—'
  return new Date(ms).toLocaleString('no-NO', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false })
}

// Undermappa Resultatdokument-modulen brukar inni ein låst oppdragssti
// (sjå OPPDRAGSMAPPER i ProsjektModule.jsx — desse to må halde seg i sync).
const RESULTAT_UNDERMAPPE = '4 Resultatdokumenter'

export default function ResultatdokumentModule({ userId, projects, activeProjectId, onOpenProsjekt }) {
  const [details, setDetails]   = useState(null)   // { oppdragsSti, oppdragsStiLast, ... } for aktivt prosjekt
  const [loading, setLoading]   = useState(true)
  const [filer, setFiler]       = useState([])
  const [versjonerTal, setVersjonerTal] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [arbeider, setArbeider] = useState(false)
  const [siste, setSiste]       = useState(null)   // resultat frå siste drop

  const harBru = typeof window !== 'undefined' && !!window.resultatdokumentAPI
  const aktivtProsjekt = projects.find(p => p.id === activeProjectId)
  const laast = !!(details?.oppdragsStiLast && details?.oppdragsSti)
  const sti = laast ? `${details.oppdragsSti}\\${RESULTAT_UNDERMAPPE}` : ''

  // ── Last stien til aktivt prosjekt (frå projects.details i Supabase) ──
  const lastDetails = useCallback(async () => {
    if (!userId || !activeProjectId) { setDetails(null); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase.from('projects').select('details')
      .eq('id', activeProjectId).eq('user_id', userId).single()
    setDetails(data?.details || {})
    setLoading(false)
  }, [userId, activeProjectId])

  useEffect(() => { lastDetails() }, [lastDetails])

  // ── Last filliste frå disk ──
  const lastFiler = useCallback(async () => {
    if (!harBru || !sti) { setFiler([]); setVersjonerTal(0); return }
    const res = await window.resultatdokumentAPI.listFiler(sti)
    setFiler(res.finst ? res.filer : [])
    setVersjonerTal(res.versjonerTal || 0)
  }, [harBru, sti])

  useEffect(() => { lastFiler() }, [lastFiler])

  // ── Drop-handtering ──
  const handleDrop = async (e) => {
    e.preventDefault()
    setDragOver(false)
    if (!harBru || !sti || arbeider) return
    const droppa = Array.from(e.dataTransfer.files || [])
    const filPathar = droppa
      .map(f => window.resultatdokumentAPI.hentFilsti(f))
      .filter(Boolean)
    if (filPathar.length === 0) return
    setArbeider(true)
    setSiste(null)
    const resultat = await window.resultatdokumentAPI.leggTilFiler(sti, filPathar)
    setSiste(resultat)
    setArbeider(false)
    await lastFiler()
  }

  const handleDragOver = (e) => { e.preventDefault(); if (harBru && sti) setDragOver(true) }
  const handleDragLeave = () => setDragOver(false)

  // ══════════════════════════════════════════════════════════════════
  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>

      {/* Topbar */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 16px',
        height:50, flexShrink:0, background:'var(--brand)',
        borderBottom:'1px solid rgba(255,255,255,.1)' }}>
        <span style={{ fontSize:15, fontWeight:800, color:'#fff', letterSpacing:'-0.02em' }}>
          Resultatdokument
        </span>
        {aktivtProsjekt && (
          <>
            <span style={{ color:'rgba(255,255,255,.3)' }}>·</span>
            <span style={{ fontSize:13, color:'rgba(255,255,255,.7)', fontFamily:'var(--mono)' }}>
              {aktivtProsjekt.projectNumber}
            </span>
            <span style={{ fontSize:13, color:'rgba(255,255,255,.7)' }}>{aktivtProsjekt.name}</span>
          </>
        )}
        <div style={{ flex:1 }}/>
        {harBru && sti && (
          <button onClick={() => window.resultatdokumentAPI.apneMappe(sti)}
            style={{ padding:'6px 14px', borderRadius:'var(--r)',
              border:'1.5px solid rgba(255,255,255,.3)', background:'rgba(255,255,255,.1)',
              color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)' }}>
            Opne mappe i utforskar
          </button>
        )}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'22px 28px' }}>

        {!aktivtProsjekt ? (
          <Melding tittel="Vel eit prosjekt" ikon="P">
            Vel eit prosjekt øvst i vindauget for å sjå resultatdokumenta.
          </Melding>

        ) : loading ? (
          <div style={{ color:'var(--text3)', fontSize:13 }}>Lastar…</div>

        ) : !harBru ? (
          <Melding tittel="Krev skrivebordsversjonen" ikon="Rd">
            Resultatdokument-modulen flyttar og omdøyper filer direkte på disken din, og det kan
            berre gjerast frå skrivebordsappen — ikkje frå nettlesar. Opne LiedLab via
            skrivebords-snarvegen for å bruke denne modulen.
          </Melding>

        ) : !laast ? (
          <Melding tittel="Ingen oppdragssti er låst for dette prosjektet" ikon="!">
            Gå til <b>Prosjekt</b>-modulen og lås ein oppdragssti for «{aktivtProsjekt.name}» —
            mappa <code style={{ fontFamily:'var(--mono)' }}>{RESULTAT_UNDERMAPPE}</code> vert
            oppretta automatisk der, og denne modulen brukar ho med det same.
          </Melding>

        ) : (
          <div style={{ maxWidth:900 }}>

            {/* Stivisning */}
            <div style={{ fontSize:12, color:'var(--text3)', marginBottom:16,
              fontFamily:'var(--mono)', wordBreak:'break-all' }}>
              {sti}
            </div>

            {/* Dropsone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${dragOver ? 'var(--brand3)' : 'var(--border2)'}`,
                borderRadius:'var(--r2)',
                background: dragOver ? 'var(--brandbg)' : 'var(--bg2)',
                padding:'36px 20px',
                textAlign:'center',
                marginBottom:24,
                transition:'all .15s',
              }}>
              {arbeider ? (
                <div style={{ fontSize:14, color:'var(--text2)', fontWeight:600 }}>Plasserer filer…</div>
              ) : (
                <>
                  <div style={{ fontSize:15, fontWeight:700, color:'var(--text)', marginBottom:6 }}>
                    Slepp filer her
                  </div>
                  <div style={{ fontSize:12, color:'var(--text3)' }}>
                    Dra teikningar/dokument frå Utforskar. Finst same teikningsnummer frå før,
                    vert den gamle versjonen flytta til «Versjoner».
                  </div>
                </>
              )}
            </div>

            {/* Siste operasjon */}
            {siste && (
              <div style={{ marginBottom:24, border:'1.5px solid var(--border)', borderRadius:'var(--r)',
                overflow:'hidden' }}>
                {siste.map((r, i) => (
                  <div key={i} style={{ padding:'8px 12px',
                    borderTop: i>0 ? '1px solid var(--border)' : 'none',
                    background: r.status==='ok' ? 'var(--bg2)' : 'rgba(185,28,28,.06)' }}>
                    {r.status === 'ok' ? (
                      <>
                        <span style={{ fontSize:13, fontWeight:600, color:'var(--success)' }}>✓ {r.fil}</span>
                        <span style={{ fontSize:12, color:'var(--text3)', marginLeft:8 }}>
                          nr {r.nr} · rev {r.rev}
                        </span>
                        {r.flytta && (
                          <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
                            Flytta til Versjoner: {r.flytta.join(', ')}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize:13, fontWeight:600, color:'var(--danger)' }}>✕ {r.fil}</span>
                        <div style={{ fontSize:11, color:'var(--danger)', marginTop:2 }}>{r.melding}</div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Filliste */}
            <div style={{ fontSize:13, fontWeight:700, color:'var(--brand)', marginBottom:10 }}>
              I mappa no ({filer.length})
              {versjonerTal > 0 && (
                <span style={{ fontSize:12, fontWeight:500, color:'var(--text3)', marginLeft:8 }}>
                  · {versjonerTal} eldre versjon{versjonerTal===1?'':'ar'} i Versjoner
                </span>
              )}
            </div>
            {filer.length === 0 ? (
              <div style={{ fontSize:13, color:'var(--text3)' }}>Ingen filer i mappa enno.</div>
            ) : (
              <div style={{ border:'1.5px solid var(--border)', borderRadius:'var(--r)', overflow:'hidden' }}>
                {filer.map((f, i) => (
                  <div key={f.namn} style={{ display:'flex', alignItems:'center', gap:12,
                    padding:'8px 12px', borderTop: i>0 ? '1px solid var(--border)' : 'none',
                    background:'var(--bg2)' }}>
                    <span onClick={() => window.resultatdokumentAPI.apneFil(sti, f.namn)}
                      title="Opne fila (skriveverna)"
                      style={{ flex:1, fontSize:13, color:'var(--brand)', textDecoration:'underline',
                        cursor:'pointer', overflow:'hidden',
                        textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.namn}</span>
                    <span style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>rev {f.rev}</span>
                    <span style={{ fontSize:11, color:'var(--text3)', width:110, textAlign:'right' }}>{fmtTid(f.endra)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Meldingsboks (tomme/feil-tilstandar) ────────────────────────────
function Melding({ tittel, ikon, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', height:'100%', gap:16, paddingTop:40 }}>
      <div style={{ width:64, height:64, borderRadius:16, background:'var(--brandbg2)',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:24, fontWeight:900, color:'var(--brand)', fontFamily:'var(--font)' }}>{ikon}</div>
      <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>{tittel}</div>
      <p style={{ fontSize:13, color:'var(--text3)', textAlign:'center', maxWidth:420, lineHeight:1.7 }}>
        {children}
      </p>
    </div>
  )
}
