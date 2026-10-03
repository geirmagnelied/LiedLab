import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import BileteTabell from './BileteTabell'
import { namnFraEpost, BILETE_MAPPE } from './dtmKonstantar'

// Byggjer ein file://-URL frå ein absolutt Windows-sti — kvart stisegment
// vert URI-koda FOR SEG (ikkje heile strengen samla, som elles ville
// koda sjølve skiljeteikna «/» òg). Berre meiningsfylt i Electron
// (skrivebordsversjonen) — ein nettlesar har ingen tilgang til lokale
// filstiar i det heile, sjå `harBru`-sjekken der dette vert brukt.
function tilFileUrl(sti) {
  const delar = sti.replace(/\\/g, '/').split('/').map(encodeURIComponent)
  return 'file:///' + delar.join('/')
}

// ═══════════════════════════════════════════════════════════════════
//  Bilete-modulen — sjå claude/bilete-modul.md for full spesifikasjon.
//
//  Éin dedikert tabell (dtm_bilete), IKKJE ein ny DTM-kategori — bilete
//  har heilt anna metadata-form (dato teke/plassering/teke av, ingen
//  revisjons-/kategori-omgrep) enn DTM sine kontroll-/arbeidsdokument.
//  Løpenummer (BIL-XXX) er PER PROSJEKT, ikkje delt med DTM sine eigne nr.
//
//  To importvegar:
//   1. Skrivebords-drag-og-slepp (krev Electron/harBru) — filene vert
//      lest/stempla/flytta DIREKTE på lokal disk (electron/main.js).
//   2. «Last opp frå mobil/nettlesar» — fungerer i EIN KVAR nettlesar
//      (ingen Electron-bru nødvendig), lastar opp til ein mellombels
//      Supabase Storage-bucket («bilete-mobil») + ei kø-rad. Skrivebords-
//      appen hentar seinare desse ned via «Hent bilete frå mobil».
// ═══════════════════════════════════════════════════════════════════

export default function BileteModule({ userId, userEmail, projects, activeProjectId }) {
  const [details, setDetails]     = useState(null)
  const [bilete, setBilete]       = useState([])
  const [lastar, setLastar]       = useState(true)
  const [dragOver, setDragOver]   = useState(false)
  const [arbeider, setArbeider]   = useState(false)
  const [sisteResultat, setSisteResultat] = useState(null)
  const [mobilKo, setMobilKo]     = useState([])
  const [hentarMobil, setHentarMobil]     = useState(false)
  const [lastarOppMobil, setLastarOppMobil] = useState(false)
  const [merkt, setMerkt]         = useState(() => new Set())
  const [visning, setVisning]     = useState('tabell') // 'tabell' | 'rutenett'
  const mobilInputRef = useRef(null)

  const harBru = typeof window !== 'undefined' && !!window.resultatdokumentAPI
  const aktivtProsjekt = projects.find(p => p.id === activeProjectId)
  const laast = !!(details?.oppdragsStiLast && details?.oppdragsSti)
  const oppdragsSti = laast ? details.oppdragsSti : ''
  const namn = namnFraEpost(userEmail)

  const lastDetails = useCallback(async () => {
    if (!userId || !activeProjectId) { setDetails(null); return }
    const { data } = await supabase.from('projects').select('details').eq('id', activeProjectId).eq('user_id', userId).single()
    setDetails(data?.details || {})
  }, [userId, activeProjectId])
  useEffect(() => { lastDetails() }, [lastDetails])

  const lastBilete = useCallback(async () => {
    if (!userId || !activeProjectId) { setBilete([]); setLastar(false); return }
    setLastar(true)
    const { data } = await supabase.from('dtm_bilete').select('*')
      .eq('user_id', userId).eq('project_id', activeProjectId).order('nr', { ascending: false })
    setBilete(data || [])
    setLastar(false)
  }, [userId, activeProjectId])
  useEffect(() => { lastBilete() }, [lastBilete])

  const lastMobilKo = useCallback(async () => {
    if (!userId || !activeProjectId) { setMobilKo([]); return }
    const { data } = await supabase.from('bilete_mobil_ko').select('*')
      .eq('user_id', userId).eq('project_id', activeProjectId).order('lasta_opp_at')
    setMobilKo(data || [])
  }, [userId, activeProjectId])
  useEffect(() => { lastMobilKo() }, [lastMobilKo])
  useEffect(() => { setMerkt(new Set()) }, [activeProjectId])

  // ── Rediger éi celle (dato teke/plassering/teke av) ─────────────────
  const settVerdi = async (id, felt, verdi) => {
    const no = new Date().toISOString()
    setBilete(bs => bs.map(b => b.id === id ? { ...b, [felt]: verdi, updated_at: no } : b))
    await supabase.from('dtm_bilete').update({ [felt]: verdi, updated_at: no }).eq('id', id).eq('user_id', userId)
  }

  const opneFil = (rad) => {
    if (!rad?.filnamn || !harBru || !oppdragsSti) return
    window.resultatdokumentAPI.biliteApneFil(oppdragsSti, rad.filnamn)
  }

  // ── Skrivebords-import (drag-og-slepp) ──────────────────────────────
  const importerFiler = async (filPathar) => {
    if (!harBru || !oppdragsSti || arbeider || !filPathar.length) return
    setArbeider(true); setSisteResultat(null)
    const kjenteNr = bilete.map(b => b.nr)
    const resultat = await window.resultatdokumentAPI.biliteImporter(filPathar, oppdragsSti, kjenteNr, namn)
    setSisteResultat(resultat)
    const no = new Date().toISOString()
    for (const r of resultat.filter(x => x.status === 'ok')) {
      await supabase.from('dtm_bilete').insert({
        id: Date.now() + Math.floor(Math.random() * 1000), user_id: userId, project_id: activeProjectId,
        nr: r.nr, filnamn: r.filnamn, dato_tatt: r.dato_tatt || null, plassering: r.plassering || '',
        teke_av: r.teke_av || namn, importert_av: namn, importert_dato: no, kjelde: r.kjelde || 'skrivebord',
        created_at: no, updated_at: no,
      })
    }
    setArbeider(false)
    await lastBilete()
  }

  const handleDrop = async (e) => {
    e.preventDefault(); setDragOver(false)
    if (!harBru) return
    const droppa = Array.from(e.dataTransfer.files || [])
    const filPathar = droppa.map(f => window.resultatdokumentAPI.hentFilsti(f)).filter(Boolean)
    await importerFiler(filPathar)
  }
  const handleDragOver  = (e) => { e.preventDefault(); if (harBru) setDragOver(true) }
  const handleDragLeave = (e) => { if (e.currentTarget === e.target) setDragOver(false) }

  // ── Last opp frå mobil/nettlesar (fungerer UTAN Electron-bru) ───────
  const lastOppFraMobil = async (filer) => {
    if (!filer?.length || !userId || !activeProjectId) return
    setLastarOppMobil(true)
    for (const fil of filer) {
      const storageSti = `${userId}/${activeProjectId}/${Date.now()}-${fil.name}`
      const { error } = await supabase.storage.from('bilete-mobil').upload(storageSti, fil)
      if (!error) {
        await supabase.from('bilete_mobil_ko').insert({
          id: Date.now() + Math.floor(Math.random() * 1000), user_id: userId, project_id: activeProjectId,
          storage_sti: storageSti, opphav_filnamn: fil.name, lasta_opp_at: new Date().toISOString(),
        })
      }
    }
    setLastarOppMobil(false)
    if (mobilInputRef.current) mobilInputRef.current.value = ''
    await lastMobilKo()
  }

  // ── Hent bilete frå mobil-køen (berre skrivebordsappen) ─────────────
  const hentFraMobil = async () => {
    if (!harBru || !oppdragsSti || mobilKo.length === 0 || hentarMobil) return
    setHentarMobil(true)
    const filer = []
    for (const rad of mobilKo) {
      const { data, error } = await supabase.storage.from('bilete-mobil').download(rad.storage_sti)
      if (error || !data) continue
      const buf = await data.arrayBuffer()
      filer.push({ filnamn: rad.opphav_filnamn, data: buf, køId: rad.id, storageSti: rad.storage_sti })
    }
    const kjenteNr = bilete.map(b => b.nr)
    const resultat = await window.resultatdokumentAPI.biliteImporterFraBytar(
      filer.map(f => ({ filnamn: f.filnamn, data: f.data })), oppdragsSti, kjenteNr, namn,
    )
    setSisteResultat(resultat)
    const no = new Date().toISOString()
    for (let i = 0; i < resultat.length; i++) {
      const r = resultat[i]
      const kø = filer[i]
      if (r.status === 'ok') {
        await supabase.from('dtm_bilete').insert({
          id: Date.now() + i, user_id: userId, project_id: activeProjectId,
          nr: r.nr, filnamn: r.filnamn, dato_tatt: r.dato_tatt || null, plassering: r.plassering || '',
          teke_av: r.teke_av || '', importert_av: namn, importert_dato: no, kjelde: 'mobil',
          created_at: no, updated_at: no,
        })
        await supabase.storage.from('bilete-mobil').remove([kø.storageSti])
        await supabase.from('bilete_mobil_ko').delete().eq('id', kø.køId)
      }
    }
    setHentarMobil(false)
    await Promise.all([lastBilete(), lastMobilKo()])
  }

  return (
    <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
      style={{ position:'relative', display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>

      {/* Topbar */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 16px',
        height:50, flexShrink:0, background:'var(--brand)', borderBottom:'1px solid rgba(255,255,255,.1)' }}>
        <span style={{ fontSize:15, fontWeight:800, color:'#fff', letterSpacing:'-0.02em' }}>Bilete</span>
        {aktivtProsjekt && (<>
          <span style={{ color:'rgba(255,255,255,.3)' }}>·</span>
          <span style={{ fontSize:13, color:'rgba(255,255,255,.7)', fontFamily:'var(--mono)' }}>
            {aktivtProsjekt.projectNumber} {aktivtProsjekt.name}
          </span>
        </>)}
      </div>

      {!aktivtProsjekt ? (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:14 }}>
          <div style={{ width:72, height:72, borderRadius:18, background:'var(--brandbg2)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, fontWeight:900, color:'var(--brand)' }}>B</div>
          <p style={{ fontSize:14, color:'var(--text3)', textAlign:'center', maxWidth:380, lineHeight:1.7 }}>
            Bilete er organisert per prosjekt. Vel eit prosjekt øvst for å sjå og importere bilete.
          </p>
        </div>
      ) : (
        <div style={{ flex:1, overflow:'auto', padding:'18px 20px', display:'flex', flexDirection:'column', gap:14 }}>

          {!laast && (
            <div style={{ padding:'8px 14px', borderRadius:'var(--r)', background:'rgba(217,119,6,.10)',
              color:'#B45309', fontSize:12.5, fontWeight:600 }}>
              Ingen oppdragssti er låst for «{aktivtProsjekt.name}». Gå til Prosjekt-modulen og lås ein sti
              for å kunne importere bilete til lokal disk.
            </div>
          )}

          {/* ── Import-val ── */}
          <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
            {harBru && laast && (
              <div style={{ flex:'1 1 260px', minWidth:240, border:`2px dashed ${dragOver ? 'var(--brand)' : 'var(--border2)'}`,
                borderRadius:'var(--r2)', background: dragOver ? 'var(--bg3)' : 'var(--bg2)',
                padding:'20px', textAlign:'center' }}>
                <div style={{ fontSize:13.5, fontWeight:700, color:'var(--text)', marginBottom:4 }}>
                  {arbeider ? 'Importerer …' : 'Slepp bilete her'}
                </div>
                <div style={{ fontSize:11.5, color:'var(--text3)' }}>
                  Frå Windows Utforskar — vert stempla med dato og lagra i «8 Bilete».
                </div>
              </div>
            )}

            <div style={{ flex:'1 1 260px', minWidth:240, border:'2px dashed var(--border2)', borderRadius:'var(--r2)',
              background:'var(--bg2)', padding:'20px', textAlign:'center' }}>
              <div style={{ fontSize:13.5, fontWeight:700, color:'var(--text)', marginBottom:4 }}>
                Last opp frå mobil/nettlesar
              </div>
              <div style={{ fontSize:11.5, color:'var(--text3)', marginBottom:10 }}>
                Fungerer på telefonen din — vert lasta opp mellombels og henta ned av skrivebordsappen seinare.
              </div>
              <input ref={mobilInputRef} type="file" accept="image/*" multiple capture="environment"
                onChange={e => lastOppFraMobil(Array.from(e.target.files || []))}
                style={{ display:'none' }} id="bilete-mobil-input"/>
              <label htmlFor="bilete-mobil-input" className="dt-knapp hovud"
                style={{ display:'inline-block', cursor:'pointer', opacity: lastarOppMobil ? .6 : 1 }}>
                {lastarOppMobil ? 'Lastar opp …' : '+ Vel/ta bilete'}
              </label>
            </div>

            {harBru && laast && mobilKo.length > 0 && (
              <div style={{ flex:'1 1 260px', minWidth:240, border:'1.5px solid var(--border)', borderRadius:'var(--r2)',
                background:'var(--brandbg)', padding:'20px', textAlign:'center' }}>
                <div style={{ fontSize:13.5, fontWeight:700, color:'var(--brand)', marginBottom:8 }}>
                  {mobilKo.length} bilete ventar frå mobil
                </div>
                <button className="dt-knapp hovud" disabled={hentarMobil} onClick={hentFraMobil}>
                  {hentarMobil ? 'Hentar …' : 'Hent bilete frå mobil'}
                </button>
              </div>
            )}
          </div>

          {sisteResultat && (
            <div style={{ border:'1.5px solid var(--border)', borderRadius:'var(--r)', overflow:'hidden' }}>
              {sisteResultat.map((r, i) => (
                <div key={i} style={{ padding:'8px 12px', borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                  background: r.status === 'ok' ? 'var(--bg2)' : 'rgba(185,28,28,.06)' }}>
                  {r.status === 'ok' ? (
                    <span style={{ fontSize:13, fontWeight:600, color:'var(--success)' }}>✓ {r.nr} — {r.filnamn}</span>
                  ) : (
                    <>
                      <span style={{ fontSize:13, fontWeight:600, color:'var(--danger)' }}>✕ {r.filnamn}</span>
                      <div style={{ fontSize:11, color:'var(--danger)', marginTop:2 }}>{r.melding}</div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {lastar ? (
            <div style={{ color:'var(--text3)', fontSize:13 }}>Lastar…</div>
          ) : bilete.length === 0 ? (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <p style={{ fontSize:13, color:'var(--text3)', textAlign:'center', maxWidth:360, lineHeight:1.7 }}>
                Ingen bilete registrerte enno for dette prosjektet.
              </p>
            </div>
          ) : (
            <>
              <div className="dt-seg" style={{ alignSelf:'flex-start' }}>
                <button type="button" className={visning === 'tabell' ? 'på' : ''} onClick={() => setVisning('tabell')}>Tabell</button>
                <button type="button" className={visning === 'rutenett' ? 'på' : ''} onClick={() => setVisning('rutenett')}>Rutenett</button>
              </div>
              {visning === 'tabell' ? (
                <BileteTabell bilete={bilete} onSetVerdi={settVerdi} onOpneFil={opneFil}
                  merking={{ valde:merkt, onEndre:setMerkt }}/>
              ) : (
                <div style={{ flex:1, overflow:'auto' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(170px, 1fr))', gap:12 }}>
                    {bilete.map(b => (
                      <div key={b.id} onClick={() => opneFil(b)} title={`${b.nr} — klikk for å opne`}
                        style={{ cursor: harBru ? 'pointer' : 'default', border:'1px solid var(--border)',
                          borderRadius:'var(--r2)', overflow:'hidden', background:'var(--bg2)' }}>
                        <div style={{ aspectRatio:'4 / 3', background:'var(--bg3)', overflow:'hidden',
                          display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {harBru && oppdragsSti ? (
                            <img src={tilFileUrl(`${oppdragsSti}\\${BILETE_MAPPE}\\${b.filnamn}`)} alt={b.nr}
                              loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover' }}
                              onError={e => { e.currentTarget.style.display = 'none' }}/>
                          ) : (
                            <span style={{ fontSize:28, opacity:.35 }}>🖼</span>
                          )}
                        </div>
                        <div style={{ padding:'6px 9px' }}>
                          <div style={{ fontSize:11.5, fontWeight:700, fontFamily:'var(--mono)', color:'var(--brand)' }}>{b.nr}</div>
                          <div style={{ fontSize:10.5, color:'var(--text3)' }}>{b.dato_tatt || '—'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {dragOver && harBru && (
        <div style={{ position:'absolute', inset:8, border:'3px dashed var(--brand3)', borderRadius:'var(--r2)',
          background:'var(--brandbg)', pointerEvents:'none', zIndex:100,
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ padding:'14px 26px', background:'var(--bg2)', borderRadius:'var(--r2)',
            fontSize:15, fontWeight:700, color:'var(--brand)', boxShadow:'var(--shadow-lg)' }}>
            Slepp for å importere bileta
          </div>
        </div>
      )}
    </div>
  )
}
