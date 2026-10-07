import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import TeikningTabell from './TeikningTabell'
import DTMTabell from './DTMTabell'
import { KONTROLLTYPE, KONTROLLSTATUS } from './dtmKonstantar'
import { tolkTeikningsnr, hentNummerering, lagreNummerering, TYPEKODE, FASEKODE_NY } from './teikningsnummer'
import NummereringVal from './NummereringVal'

// ═══════════════════════════════════════════════════════════════════
//  Kvalitetsmodul (KS)
//
//  Del A (denne versjonen): eit ekte teikningsregister per prosjekt.
//  Brukar dreg teikningar/dokument inn kor som helst i vindauget, appen
//  flyttar dei til <oppdragsSti>\4 Resultatdokumenter\kontroll\til kontroll,
//  skannar
//  filnamn + PDF-tittelfelt (same logikk som det gamle pdf_vaktar.py-
//  skriptet), og lagrar éi rad per fil i Supabase-tabellen
//  ks_teikningar. Feil frå skanninga rettar ein med dobbeltklikk i
//  tabellcella, som i eit reknearkprogram (Tab går til neste kolonne).
//  Registeret er tilgjengeleg og redigerbart både frå skrivebordsappen
//  og frå nettlesar — berre sjølve dra-og-slepp-innlesinga krev
//  skrivebordsversjonen (fil-tilgang).
//
//  Del B (frå 30. sept. 2026): sjølve leveransekontrollen (egenkontroll/
//  fagkontroll/godkjenning) er BYGD OPPÅ DTM sine kontrolldokument-rader
//  (dtm_dokumenter), IKKJE eit eige, parallelt register som Del A over —
//  «Leveransekontroll»-fana viser DTMTabell filtrert til kategorien
//  Kontrolldokument, med tre knappar («Start egenkontroll/fagkontroll/
//  godkjenning») som opnar BÅDE det assosierte programmet for fila OG eit
//  eige, skalerbart sjekkliste-vindauge (SjekklisteVindauge.jsx). Sjekk-
//  listene sjølve kjem frå tegningskontroll.json (generert av
//  scripts/konverter-sjekkliste.cjs frå kontoret si Excel-fil), svara
//  vert lagra i ks_kontroll_svar. Sjå claude/kvalitetsmodul-teikningar.md.
// ═══════════════════════════════════════════════════════════════════

// Teikningsnummer-lesing (DS-356, med/utan bygg, bygningsfagkode, løpenummer og fase
// etter prosjektet sitt oppsett) ligg i teikningsnummer.js.

// ── Tomme-/feiltilstandar (same mønster som Resultatdokument-modulen) ─
function Melding({ tittel, ikon, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', height:'100%', gap:16, paddingTop:40 }}>
      <div style={{ width:64, height:64, borderRadius:16, background:'var(--brandbg2)',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:24, fontWeight:900, color:'var(--brand)', fontFamily:'var(--font)' }}>{ikon}</div>
      <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>{tittel}</div>
      <p style={{ fontSize:13, color:'var(--text3)', textAlign:'center', maxWidth:420, lineHeight:1.7 }}>{children}</p>
    </div>
  )
}

function Fane({ vk, lb, view, setView }) {
  const a = view === vk
  return (
    <button onClick={() => setView(vk)} style={{
      padding:'6px 13px', borderRadius:'var(--r)',
      border: a ? '1.5px solid rgba(255,255,255,.55)' : '1.5px solid transparent',
      background: a ? 'rgba(255,255,255,.18)' : 'transparent',
      color: a ? '#fff' : 'rgba(255,255,255,.65)',
      fontSize:13, fontWeight: a ? 700 : 500, cursor:'pointer', fontFamily:'var(--font)' }}>{lb}</button>
  )
}

// ── Info-knapp med forklarande nedtrekksmeny i topbaren ──
function InfoKnapp({ nummerering, onEndreNummerering }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const lukk = (e) => { if (!e.target.closest?.('.ks-info')) setOpen(false) }
    document.addEventListener('mousedown', lukk)
    return () => document.removeEventListener('mousedown', lukk)
  }, [open])

  const Kode = ({ tal, tekst }) => (
    <div style={{ display:'flex', gap:6, fontSize:11.5 }}>
      <span style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--brand)', width:20 }}>{tal}</span>
      <span style={{ color:'var(--text2)' }}>{tekst}</span>
    </div>
  )

  return (
    <div className="ks-info" style={{ position:'relative' }}>
      <button onClick={() => setOpen(v => !v)} title="Korleis fungerer dette?"
        style={{ width:24, height:24, borderRadius:'50%', border:'1.5px solid rgba(255,255,255,.45)',
          background: open ? 'rgba(255,255,255,.24)' : 'rgba(255,255,255,.08)', color:'#fff',
          fontSize:12, fontWeight:800, cursor:'pointer', fontFamily:'var(--font)', fontStyle:'italic' }}>i</button>
      {open && (
        <div style={{ position:'absolute', right:0, top:32, width:340, zIndex:200,
          background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r2)',
          boxShadow:'var(--shadow-lg)', padding:14, animation:'none' }}>
          <div style={{ fontSize:10.5, fontWeight:800, letterSpacing:'.06em', textTransform:'uppercase',
            color:'var(--text3)', marginBottom:8 }}>Slik fungerer Kvalitetsmodulen</div>

          <p style={{ fontSize:12.5, color:'var(--text2)', lineHeight:1.6, marginBottom:10 }}>
            Dra teikningar eller dokument inn <b>kor som helst i dette vindauget</b> for å registrere
            dei — dei vert flytta til kontrollmappa og lest automatisk.
          </p>
          <p style={{ fontSize:12.5, color:'var(--text2)', lineHeight:1.6, marginBottom:10 }}>
            <b>Dobbeltklikk</b> ei celle i tabellen for å rette feil, som i eit reknearkprogram.
            <b> Tab</b> går til neste kolonne, <b>Enter</b> lagrar, <b>Escape</b> avbryt.
          </p>

          <div style={{ fontSize:10.5, fontWeight:800, letterSpacing:'.06em', textTransform:'uppercase',
            color:'var(--text3)', margin:'10px 0 5px' }}>Teikningsnummer (DS-356) — oppsett for prosjektet</div>
          <NummereringVal verdi={nummerering} onEndre={onEndreNummerering} kompakt/>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2px 12px', margin:'10px 0 2px' }}>
            {['10','20','30','40','45','50','60'].map(k => <Kode key={k} tal={k} tekst={TYPEKODE[k]}/>)}
            {Object.entries(FASEKODE_NY).map(([k, v]) => <Kode key={k} tal={k} tekst={v}/>)}
          </div>
          <p style={{ fontSize:11, color:'var(--text3)', lineHeight:1.6, marginTop:8 }}>
            Type og fase vert gjetta automatisk ut frå nummeret (etter oppsettet over — eldre to-sifra fasekodar 01–05 vert òg kjende att), og kan alltid rettast for hand.
            «Leveransekontroll»-fana viser DTM sine Kontrolldokument-rader — trykk «Start egenkontroll/
            fagkontroll/godkjenning» for å opne fila og ei sjekkliste for det fyrste (evt. merkte) dokumentet.
          </p>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
export default function KvalitetModule({ userId, projects, activeProjectId }) {
  const [view, setView] = useState('teikningar')

  // ── Teikningsregister (Del A — ekte, lagra i Supabase) ──
  const [details, setDetails]                 = useState(null)
  // Prosjektet sitt oppsett for teikningsnummer (med/utan bygg, bygningsfagkode, løpenummer, fase)
  const endreNummerering = async (n) => {
    setDetails(d => ({ ...(d || {}), nummerering: n }))
    try { await lagreNummerering(supabase, activeProjectId, userId, n) }
    catch (e) { alert('Klarte ikkje lagre nummereringsoppsettet: ' + e.message) }
  }
  const [detaljLastar, setDetaljLastar]         = useState(true)
  const [teikningar, setTeikningar]             = useState([])
  const [teikningarLastar, setTeikningarLastar] = useState(true)
  const [dragOver, setDragOver]                 = useState(false)
  const [arbeider, setArbeider]                 = useState(false)
  const [sisteSkann, setSisteSkann]             = useState(null)

  // ── Leveransekontroll (Del B — no bygd oppå DTM sine kontrolldokument-
  // rader, IKKJE eit eige register, sjå claude/kvalitetsmodul-teikningar.md) ──
  const [kontrollDokumenter, setKontrollDokumenter] = useState([])
  const [kontrollLastar, setKontrollLastar]         = useState(true)
  const [kontrollValde, setKontrollValde]           = useState(() => new Set())
  const [kontrollFeil, setKontrollFeil]             = useState('')

  const harBru = typeof window !== 'undefined' && !!window.resultatdokumentAPI
  const aktivtProsjekt = projects.find(p => p.id === activeProjectId)
  // Same base-sti som Resultatdokument-modulen (oppdragsSti + «4 Resultat-
  // dokumenter», sett/låst i Prosjekt-modulen) — kontroll/-undermappa (sjå
  // ks:*-endepunkta i electron/main.js) ligg framleis INNI denne, ikkje
  // som ei eiga oppdragsmappe, for å halde fram som før prosjektet vart
  // gjort om til den låsbare oppdragssti-modellen.
  const laast = !!(details?.oppdragsStiLast && details?.oppdragsSti)
  const sti = laast ? `${details.oppdragsSti}\\4 Resultatdokumenter` : ''
  // Bare oppdragssti (INGEN «4 Resultatdokumenter»-suffiks) — det DTM sine
  // eigne endepunkt (dtm:apne-fil m.fl.) forventar, sidan DTM sjølv legg
  // til rett DTM-kategorimappe (KATEGORI_MAPPE.kontrolldokument) internt.
  const dtmOppdragsSti = laast ? details.oppdragsSti : ''

  // ── Last oppdragssti for aktivt prosjekt ──
  const lastDetails = useCallback(async () => {
    if (!userId || !activeProjectId) { setDetails(null); setDetaljLastar(false); return }
    setDetaljLastar(true)
    const { data } = await supabase.from('projects').select('details')
      .eq('id', activeProjectId).eq('user_id', userId).single()
    setDetails(data?.details || {})
    setDetaljLastar(false)
  }, [userId, activeProjectId])
  useEffect(() => { lastDetails() }, [lastDetails])

  // ── Last teikningsregister ──
  const lastTeikningar = useCallback(async () => {
    if (!userId || !activeProjectId) { setTeikningar([]); setTeikningarLastar(false); return }
    setTeikningarLastar(true)
    const { data } = await supabase.from('ks_teikningar').select('*')
      .eq('user_id', userId).eq('project_id', activeProjectId).order('nr')
    setTeikningar(data || [])
    setTeikningarLastar(false)
  }, [userId, activeProjectId])
  useEffect(() => { lastTeikningar() }, [lastTeikningar])

  // ── Last kontrolldokument (DTM sine rader, filtrert til éin kategori) ──
  const lastKontrollDokumenter = useCallback(async () => {
    if (!userId || !activeProjectId) { setKontrollDokumenter([]); setKontrollLastar(false); return }
    setKontrollLastar(true)
    const { data } = await supabase.from('dtm_dokumenter').select('*')
      .eq('user_id', userId).eq('project_id', activeProjectId).order('nr')
    setKontrollDokumenter((data || []).filter(d => d.kontrolldokument))
    setKontrollLastar(false)
  }, [userId, activeProjectId])
  useEffect(() => { lastKontrollDokumenter() }, [lastKontrollDokumenter])
  useEffect(() => { setKontrollValde(new Set()) }, [activeProjectId])

  // Same skriveflyt som DTMModule.jsx sin settVerdi() — inkl. den kritiske
  // detaljen at «updated_at» må stemplast i BÅDE den optimistiske lokale
  // state-oppdateringa OG sjølve databaseskrivinga, elles ser resten av UI-
  // en (t.d. Tegningsliste sin «endra sidan sist») den GAMLE verdien heilt
  // til neste fulle innlasting (same feil retta i DTMModule.jsx 30. sept.).
  const NØSTA_FELT = { rev:'revisjon', dato:'dato' }
  const kontrollSettVerdi = async (id, felt, verdi) => {
    if (NØSTA_FELT[felt]) {
      const d = kontrollDokumenter.find(x => x.id === id)
      const gammalSettVerdi = d?.kontrolldokument || {}
      const nyttSett = { ...gammalSettVerdi, [NØSTA_FELT[felt]]: verdi }
      const no = new Date().toISOString()
      setKontrollDokumenter(ds => ds.map(x => x.id === id ? { ...x, kontrolldokument: nyttSett, updated_at: no } : x))
      await supabase.from('dtm_dokumenter').update({ kontrolldokument: nyttSett, updated_at: no }).eq('id', id).eq('user_id', userId)
      return
    }
    const no = new Date().toISOString()
    setKontrollDokumenter(ds => ds.map(d => d.id === id ? { ...d, [felt]: verdi, updated_at: no } : d))
    const { error } = await supabase.from('dtm_dokumenter').update({ [felt]: verdi, updated_at: no }).eq('id', id).eq('user_id', userId)
    if (error) alert('Klarte ikkje lagre endringa: ' + error.message)
  }
  const kontrollToggleFavorite = (id) => { const d = kontrollDokumenter.find(x => x.id === id); if (d) kontrollSettVerdi(id, 'favorite', !d.favorite) }
  const kontrollTogglePinned   = (id) => { const d = kontrollDokumenter.find(x => x.id === id); if (d) kontrollSettVerdi(id, 'pinned', !d.pinned) }

  const kontrollOpneFil = (rad) => {
    const filnamn = rad?.kontrolldokument?.filnamn
    if (!filnamn || !harBru || !dtmOppdragsSti) return
    window.resultatdokumentAPI.dtmApneFil(dtmOppdragsSti, 'kontrolldokument', filnamn, false)
  }

  // ── Start egenkontroll/fagkontroll/godkjenning ──────────────────────
  // Fyrste dokument = det MERKTE (via rad-vel-feltet i tabellen) om noko
  // er merkt, elles fyrste i den (filtrerte/sorterte) køen — brukar sitt
  // eige val 28. sept. 2026.
  const startKontroll = async (type) => {
    setKontrollFeil('')
    const cfg = KONTROLLTYPE[type]
    const kandidatar = kontrollDokumenter.filter(d => cfg.kø.includes(d.kontrollstatus || KONTROLLSTATUS.IKKJE_STARTA))
    if (!kandidatar.length) { setKontrollFeil(`Ingen dokument er klare for ${cfg.namn.toLowerCase()}.`); return }
    const merkt = kandidatar.find(d => kontrollValde.has(d.id))
    const dokument = merkt || kandidatar[0]

    if (dokument.kontrollstatus !== cfg.pågåande) {
      const no = new Date().toISOString()
      setKontrollDokumenter(ds => ds.map(d => d.id === dokument.id ? { ...d, kontrollstatus: cfg.pågåande, updated_at: no } : d))
      await supabase.from('dtm_dokumenter').update({ kontrollstatus: cfg.pågåande, updated_at: no }).eq('id', dokument.id).eq('user_id', userId)
    }
    kontrollOpneFil(dokument)
    if (harBru) await window.resultatdokumentAPI.ksApneSjekklisteVindauge(dokument.id, type)
    else setKontrollFeil('Sjekkliste-vindauget krev skrivebordsversjonen.')
  }

  // ── Drop kor som helst i vindauget: flytt + skann + registrer ──
  const handleDrop = async (e) => {
    e.preventDefault(); setDragOver(false)
    if (!harBru || !sti || arbeider) return
    const droppa = Array.from(e.dataTransfer.files || [])
    const filPathar = droppa.map(f => window.resultatdokumentAPI.hentFilsti(f)).filter(Boolean)
    if (!filPathar.length) return
    setView('teikningar')
    setArbeider(true); setSisteSkann(null)
    const resultat = await window.resultatdokumentAPI.ksSkannOgLeggTil(sti, filPathar)
    setSisteSkann(resultat)

    for (const r of resultat.filter(x => x.status === 'ok')) {
      const eksisterande = teikningar.find(t => t.nr === r.nr)
      const kode = tolkTeikningsnr(r.nr, hentNummerering(details))
      const rad = {
        user_id: userId, project_id: activeProjectId,
        nr: r.nr, rev: r.rev || 'A', tittel: r.tittel || r.nr,
        fag: eksisterande?.fag || kode.fag,
        fase: eksisterande?.fase || kode.fase,
        malestokk: r.malestokk || '', teikna_av: r.teikna_av || '',
        ek_person: r.ek_person || '', fk_person: r.fk_person || '',
        dato: r.dato || '', format: r.format || '', filnamn: r.fil,
        updated_at: new Date().toISOString(),
      }
      if (eksisterande) await supabase.from('ks_teikningar').update(rad).eq('id', eksisterande.id)
      else await supabase.from('ks_teikningar').insert({ id: Date.now() + Math.floor(Math.random() * 1000), ...rad })
    }
    setArbeider(false)
    await lastTeikningar()
  }
  const handleDragOver  = (e) => { e.preventDefault(); if (harBru && sti) setDragOver(true) }
  const handleDragLeave = (e) => { if (e.currentTarget === e.target) setDragOver(false) }

  // ── Rediger éi celle i registeret (dobbeltklikk i tabellen) ──
  async function lagreVerdi(id, felt, verdi) {
    await supabase.from('ks_teikningar').update({ [felt]: verdi, updated_at: new Date().toISOString() }).eq('id', id)
    setTeikningar(ts => ts.map(t => t.id === id ? { ...t, [felt]: verdi } : t))
  }

  // ── Opne teikninga i systemet sitt standardprogram (klikk på Nr.) ──
  // Filene i «til kontroll» er framleis under kontroll og skal kunne
  // redigerast, så dei vert IKKJE skriveverna (i motsetning til
  // Resultatdokument-modulen).
  function opneFil(id) {
    const t = teikningar.find(x => x.id === id)
    if (!t?.filnamn || !harBru || !sti) return
    window.resultatdokumentAPI.ksApneFil(sti, t.filnamn)
  }

  // ══════════════════════════════════════════════════════════════
  return (
    <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
      style={{ position:'relative', display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>

      {/* Topbar */}
      <div style={{ display:'flex', alignItems:'center', gap:4, padding:'0 16px',
        height:50, flexShrink:0, background:'var(--brand)',
        borderBottom:'1px solid rgba(255,255,255,.1)' }}>
        <span style={{ fontSize:15, fontWeight:800, color:'#fff', letterSpacing:'-0.02em', marginRight:10 }}>
          Kvalitetssystem
        </span>
        <Fane vk="teikningar" lb="Teikningar" view={view} setView={setView}/>
        <Fane vk="kontroll"   lb="Leveransekontroll" view={view} setView={setView}/>
        <div style={{ flex:1 }}/>
        {aktivtProsjekt && (
          <span style={{ fontSize:13, color:'rgba(255,255,255,.7)', fontFamily:'var(--mono)', marginRight:10 }}>
            {aktivtProsjekt.projectNumber} {aktivtProsjekt.name}
          </span>
        )}
        <InfoKnapp nummerering={hentNummerering(details)} onEndreNummerering={endreNummerering}/>
      </div>

      {!aktivtProsjekt ? (
        <Melding tittel="Vel eit prosjekt" ikon="P">
          Vel eit prosjekt øvst i vindauget for å sjå kvalitetssystemet.
        </Melding>
      ) : (
        <>
          {/* TEIKNINGAR — registeret (Del A) */}
          {view === 'teikningar' && (
            <div style={{ flex:1, overflow:'auto', padding:'20px 24px', display:'flex', flexDirection:'column' }}>
              {detaljLastar ? (
                <div style={{ color:'var(--text3)', fontSize:13 }}>Lastar…</div>
              ) : (
                <>
                  {!harBru && (
                    <div style={{ marginBottom:14, padding:'8px 14px', borderRadius:'var(--r)',
                      background:'var(--brandbg)', color:'var(--brand)', fontSize:12.5, fontWeight:600 }}>
                      Dra-og-slepp av nye teikningar krev skrivebordsversjonen — registeret under kan du framleis sjå og redigere frå nettlesar.
                    </div>
                  )}
                  {harBru && !sti && (
                    <div style={{ marginBottom:14, padding:'8px 14px', borderRadius:'var(--r)',
                      background:'rgba(217,119,6,.10)', color:'#B45309', fontSize:12.5, fontWeight:600 }}>
                      Ingen oppdragssti er låst for «{aktivtProsjekt.name}». Gå til Prosjekt-modulen og lås ein sti for å kunne dra inn nye teikningar.
                    </div>
                  )}
                  {harBru && sti && arbeider && (
                    <div style={{ marginBottom:14, padding:'8px 14px', borderRadius:'var(--r)',
                      background:'var(--brandbg)', color:'var(--brand)', fontSize:12.5, fontWeight:600 }}>
                      Skannar og registrerer…
                    </div>
                  )}

                  {sisteSkann && (
                    <div style={{ marginBottom:16, border:'1.5px solid var(--border)', borderRadius:'var(--r)', overflow:'hidden' }}>
                      {sisteSkann.map((r, i) => (
                        <div key={i} style={{ padding:'8px 12px', borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                          background: r.status === 'ok' ? 'var(--bg2)' : 'rgba(185,28,28,.06)' }}>
                          {r.status === 'ok' ? (
                            <>
                              <span style={{ fontSize:13, fontWeight:600, color:'var(--success)' }}>✓ {r.fil}</span>
                              <span style={{ fontSize:12, color:'var(--text3)', marginLeft:8 }}>nr {r.nr} · rev {r.rev}{r.tittel ? ` · ${r.tittel}` : ''}</span>
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

                  {teikningarLastar ? (
                    <div style={{ color:'var(--text3)', fontSize:13 }}>Lastar register…</div>
                  ) : teikningar.length === 0 ? (
                    <Melding tittel="Ingen teikningar enno" ikon="T">
                      Dra teikningar eller dokument inn kor som helst i dette vindauget for å registrere dei.
                    </Melding>
                  ) : (
                    <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:300,
                      border:'1.5px solid var(--border)', borderRadius:'var(--r2)', overflow:'hidden' }}>
                      <TeikningTabell teikningar={teikningar} onSetVerdi={lagreVerdi} onOpneFil={opneFil}/>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* LEVERANSEKONTROLL — DTM sine kontrolldokument-rader (Del B) */}
          {view === 'kontroll' && (
            <div style={{ flex:1, overflow:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:14 }}>
              {!dtmOppdragsSti && (
                <div style={{ padding:'8px 14px', borderRadius:'var(--r)',
                  background:'rgba(217,119,6,.10)', color:'#B45309', fontSize:12.5, fontWeight:600 }}>
                  Ingen oppdragssti er låst for «{aktivtProsjekt.name}». Gå til Prosjekt-modulen og lås ein sti for å kunne opne filer/sjekklister.
                </div>
              )}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                {Object.entries(KONTROLLTYPE).map(([type, cfg]) => {
                  const talKlare = kontrollDokumenter.filter(d => cfg.kø.includes(d.kontrollstatus || KONTROLLSTATUS.IKKJE_STARTA)).length
                  return (
                    <button key={type} onClick={() => startKontroll(type)} disabled={!harBru || talKlare === 0}
                      className="dt-knapp hovud" style={{ opacity: (!harBru || talKlare === 0) ? .5 : 1 }}>
                      Start {cfg.namn.toLowerCase()}{talKlare > 0 ? ` (${talKlare})` : ''}
                    </button>
                  )
                })}
                {!harBru && <span style={{ fontSize:11.5, color:'var(--text3)' }}>Krev skrivebordsversjonen.</span>}
              </div>
              {kontrollFeil && <div style={{ fontSize:12.5, color:'var(--danger)' }}>{kontrollFeil}</div>}

              {kontrollLastar ? (
                <div style={{ color:'var(--text3)', fontSize:13 }}>Lastar…</div>
              ) : kontrollDokumenter.length === 0 ? (
                <Melding tittel="Ingen kontrolldokument enno" ikon="K">
                  Importer dokument i «Kontrolldokument»-kategorien i DTM-modulen for å sjå dei her.
                </Melding>
              ) : (
                <DTMTabell
                  dokumenter={kontrollDokumenter}
                  aktivtSett="kontrolldokument"
                  onSetVerdi={kontrollSettVerdi}
                  onOpneFil={kontrollOpneFil}
                  onToggleFavorite={kontrollToggleFavorite}
                  onTogglePinned={kontrollTogglePinned}
                  merking={{ valde:kontrollValde, onEndre:setKontrollValde }}
                  oppdragsSti={dtmOppdragsSti}
                  prefsKeySuffix="ks-kontroll"
                  standardSynlegeKolonnar={['nr','tittel','filtype','rev','utarbeida_av','fk_person','godkjent_av']}
                />
              )}
            </div>
          )}
        </>
      )}

      {dragOver && harBru && sti && (
        <div style={{ position:'absolute', inset:8, border:'3px dashed var(--brand3)', borderRadius:'var(--r2)',
          background:'var(--brandbg)', pointerEvents:'none', zIndex:100,
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ padding:'14px 26px', background:'var(--bg2)', borderRadius:'var(--r2)',
            fontSize:15, fontWeight:700, color:'var(--brand)', boxShadow:'var(--shadow-lg)' }}>
            Slepp for å registrere teikningane
          </div>
        </div>
      )}
    </div>
  )
}
