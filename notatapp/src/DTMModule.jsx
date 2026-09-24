import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from './supabase'
import DTMTabell from './DTMTabell'
import DTMImportModal from './DTMImportModal'
import { KATEGORIAR, KATEGORI_LABEL, KATEGORI_FARGE } from './dtmKonstantar'

// ═══════════════════════════════════════════════════════════════════
//  DTM — Dokument, tegningar og modellar. Erstattar Resultatdokument-
//  modulen (som ligg att urørt/ubrukt i ResultatdokumentModule.jsx, sjå
//  claude/dtm-modul.md — sama konvensjon som NoteList.jsx: ikkje sletta
//  utan å spørje).
//
//  Fase 3 av 4, sjå claude/dtm-modul.md for full spesifikasjon. IKKJE
//  bygd enno: ekspanderbare rader (visning av eldre Arkiv-versjonar) —
//  det er Fase 4, ei generell utviding av DataTabell.jsx.
// ═══════════════════════════════════════════════════════════════════

export default function DTMModule({ userId, userEmail, projects, activeProjectId }) {
  const [details, setDetails]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [dokumenter, setDokumenter] = useState([])
  const [eigneKolonnar, setEigneKolonnar] = useState([])
  const [aktivtSett, setAktivtSett] = useState('arbeidsdokument')
  const [importKategori, setImportKategori] = useState(null) // kategori-nøkkel eller null (modal lukka)

  const harBru = typeof window !== 'undefined' && !!window.resultatdokumentAPI
  const aktivtProsjekt = projects.find(p => p.id === activeProjectId)
  const laast = !!(details?.oppdragsStiLast && details?.oppdragsSti)
  const oppdragsSti = laast ? details.oppdragsSti : ''

  // ── Last prosjektdetaljar (oppdragssti) + register + eigne kolonnar ──
  const lastAlt = useCallback(async () => {
    if (!userId || !activeProjectId) { setDetails(null); setDokumenter([]); setEigneKolonnar([]); setLoading(false); return }
    setLoading(true)
    const [{ data: pData }, { data: dData }, { data: colData }] = await Promise.all([
      supabase.from('projects').select('details').eq('id', activeProjectId).eq('user_id', userId).single(),
      supabase.from('dtm_dokumenter').select('*').eq('project_id', activeProjectId).eq('user_id', userId).order('nr'),
      supabase.from('dtm_columns').select('*').eq('project_id', activeProjectId).eq('user_id', userId).order('sortering'),
    ])
    setDetails(pData?.details || {})
    setDokumenter(dData || [])
    setEigneKolonnar((colData || []).map(k => ({ key:k.key, label:k.label, art:k.art || 'tekst' })))
    setLoading(false)
  }, [userId, activeProjectId])

  useEffect(() => { lastAlt() }, [lastAlt])

  // Sjølvlegande mappeoppretting — kjøyr opprett-oppdragsmapper-IPC-en på
  // nytt kvar gong DTM opnar eit alt-låst prosjekt, slik at eksisterande
  // prosjekt får dei nye DTM-kategorimappene utan noko manuelt steg.
  // Trygt: mkdirSync med recursive:true rører aldri eksisterande filer.
  useEffect(() => {
    if (harBru && laast) window.resultatdokumentAPI.opprettOppdragsmapper(oppdragsSti)
  }, [harBru, laast, oppdragsSti])

  // ── Rader for det aktive settet: dokument som har ei gjeldande fil i
  // akkurat denne kategorien akkurat no ──
  const synlegeDokument = useMemo(
    () => dokumenter.filter(d => d[aktivtSett]),
    [dokumenter, aktivtSett])

  const tal = useCallback(k => dokumenter.filter(d => d[k]).length, [dokumenter])

  // ── Eigendefinerte kolonnar (same mønster som Saker/Notat) ─────────
  const addKolonne = async (label, art) => {
    const key = 'eigen_' + Date.now().toString(36)
    const rad = { id: Date.now(), user_id: userId, project_id: activeProjectId, key, label, art, sortering: eigneKolonnar.length, created_at: new Date().toISOString() }
    const { error } = await supabase.from('dtm_columns').insert(rad)
    if (error) { alert('Klarte ikkje lagre kolonnen: ' + error.message); return null }
    setEigneKolonnar(prev => [...prev, { key, label, art }])
    return key
  }
  const slettKolonne = async (key) => {
    const { error } = await supabase.from('dtm_columns').delete().eq('key', key).eq('user_id', userId).eq('project_id', activeProjectId)
    if (error) { alert('Klarte ikkje slette kolonnen: ' + error.message); return }
    setEigneKolonnar(prev => prev.filter(k => k.key !== key))
  }
  const setExtraVerdi = async (id, key, verdi) => {
    const d = dokumenter.find(x => x.id === id)
    if (!d) return
    const neste = { ...(d.ekstra || {}), [key]: verdi }
    setDokumenter(ds => ds.map(x => x.id === id ? { ...x, ekstra: neste } : x))
    await supabase.from('dtm_dokumenter').update({ ekstra: neste, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId)
  }

  // ── Rediger éi celle direkte i registeret (t.d. Delprosjekt) ────────
  const settVerdi = async (id, felt, verdi) => {
    setDokumenter(ds => ds.map(d => d.id === id ? { ...d, [felt]: verdi } : d))
    await supabase.from('dtm_dokumenter').update({ [felt]: verdi, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId)
  }

  // ── Opne den gjeldande fila for aktivtSett (klikk på Nr.-kolonna) ───
  const opneFil = (rad) => {
    const g = rad[aktivtSett]
    if (!g?.filnamn || !harBru) return
    window.resultatdokumentAPI.dtmApneFil(oppdragsSti, aktivtSett, g.filnamn, false)
  }

  // ── Sjølve importen: flytt filer (Electron) + skriv til Supabase ───
  // Kalla frå DTMImportModal etter at brukar har retta/fjerna dokument i
  // gjennomgangsmatrisa. Sjå claude/dtm-modul.md, avsnittet om
  // importflyten, for den fulle regelen.
  const importer = async (rader) => {
    const kategori = importKategori
    const filResultat = await window.resultatdokumentAPI.dtmBekreftImport(
      oppdragsSti, kategori,
      rader.map(r => ({ kjeldeSti: r.kjeldeSti, nr: r.nr, rev: r.rev })),
    )

    const no = new Date().toISOString()
    const resultat = []
    let nyeDokument = [...dokumenter]

    for (let i = 0; i < filResultat.length; i++) {
      const f = filResultat[i]
      const r = rader[i]
      if (f.status !== 'ok') { resultat.push({ status:'feil', nr:r.nr, filnamn:r.filnamn, melding: f.melding || 'Ukjend feil.' }); continue }

      const kategoriVerdi = { filnamn: f.filnamn, revisjon: f.rev, dato: r.dato || '', lasta_opp: no }
      const idx = nyeDokument.findIndex(d => d.nr === r.nr)

      if (idx === -1) {
        const rad = {
          id: Date.now() + i, user_id: userId, project_id: activeProjectId, nr: r.nr,
          tittel: r.tittel || r.nr, fag: r.fag || '', fase: r.fase || '',
          delprosjekt: r.delprosjekt || '', malestokk: r.malestokk || '', format: r.format || '',
          utarbeida_av: r.utarbeida_av || '', ek_person: r.ek_person || '', fk_person: r.fk_person || '',
          lagra_av: userEmail || '', status: [], ekstra: {},
          arbeidsdokument: null, resultatdokument: null, kontrolldokument: null, styrande_dokument: null,
          created_at: no, updated_at: no,
          [kategori]: kategoriVerdi,
        }
        const { error } = await supabase.from('dtm_dokumenter').insert(rad)
        if (error) { resultat.push({ status:'feil', nr:r.nr, filnamn:f.filnamn, melding: error.message }); continue }
        nyeDokument = [...nyeDokument, rad]
        resultat.push({ status:'ok', nr:r.nr, filnamn:f.filnamn })
      } else {
        const gammalRad = nyeDokument[idx]
        const gammalKategoriVerdi = gammalRad[kategori]
        const endring = {
          tittel: r.tittel || gammalRad.tittel, fag: r.fag || gammalRad.fag, fase: r.fase || gammalRad.fase,
          malestokk: r.malestokk || gammalRad.malestokk, format: r.format || gammalRad.format,
          utarbeida_av: r.utarbeida_av || gammalRad.utarbeida_av,
          ek_person: r.ek_person || gammalRad.ek_person, fk_person: r.fk_person || gammalRad.fk_person,
          lagra_av: userEmail || gammalRad.lagra_av, updated_at: no,
          [kategori]: kategoriVerdi,
        }
        const { error } = await supabase.from('dtm_dokumenter').update(endring).eq('id', gammalRad.id).eq('user_id', userId)
        if (error) { resultat.push({ status:'feil', nr:r.nr, filnamn:f.filnamn, melding: error.message }); continue }

        if (gammalKategoriVerdi) {
          await supabase.from('dtm_versjonar').insert({
            id: Date.now() + i + 1, dokument_id: gammalRad.id, user_id: userId, kategori,
            filnamn: gammalKategoriVerdi.filnamn, revisjon: gammalKategoriVerdi.revisjon,
            dato: gammalKategoriVerdi.dato, lasta_opp: gammalKategoriVerdi.lasta_opp,
          })
        }
        nyeDokument = nyeDokument.map((d, j) => j === idx ? { ...gammalRad, ...endring } : d)
        resultat.push({ status:'ok', nr:r.nr, filnamn:f.filnamn })
      }
    }

    setDokumenter(nyeDokument)
    return resultat
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>

      {/* Topbar */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 16px', flexWrap:'wrap',
        minHeight:50, flexShrink:0, background:'var(--brand)', borderBottom:'1px solid rgba(255,255,255,.1)' }}>
        <span style={{ fontSize:15, fontWeight:800, color:'#fff', letterSpacing:'-0.02em' }}>
          Dokument, tegningar og modellar (DTM)
        </span>
        {aktivtProsjekt && (<>
          <span style={{ color:'rgba(255,255,255,.3)' }}>·</span>
          <span style={{ fontSize:13, color:'rgba(255,255,255,.7)', fontFamily:'var(--mono)' }}>{aktivtProsjekt.projectNumber}</span>
          <span style={{ fontSize:13, color:'rgba(255,255,255,.7)' }}>{aktivtProsjekt.name}</span>
        </>)}
        <div style={{ flex:1 }}/>
        {harBru && laast && KATEGORIAR.map(k => (
          <button key={k} onClick={() => setImportKategori(k)}
            style={{ padding:'7px 14px', borderRadius:'var(--r)', border:'none',
              background: KATEGORI_FARGE[k], color:'#fff', fontSize:12.5, fontWeight:700, cursor:'pointer' }}>
            Import {KATEGORI_LABEL[k].toLowerCase()}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', padding:'18px 20px' }}>
        {!aktivtProsjekt ? (
          <Melding tittel="Vel eit prosjekt" ikon="P">Vel eit prosjekt øvst i vindauget for å sjå DTM-registeret.</Melding>
        ) : loading ? (
          <div style={{ color:'var(--text3)', fontSize:13 }}>Lastar…</div>
        ) : !harBru ? (
          <Melding tittel="Krev skrivebordsversjonen" ikon="Rd">
            DTM flyttar og omdøyper filer direkte på disken din, og det kan berre gjerast frå
            skrivebordsappen — ikkje frå nettlesar. Opne LiedLab via skrivebords-snarvegen for å
            bruke denne modulen.
          </Melding>
        ) : !laast ? (
          <Melding tittel="Ingen oppdragssti er låst for dette prosjektet" ikon="!">
            Gå til <b>Prosjekt</b>-modulen og lås ein oppdragssti for «{aktivtProsjekt.name}» —
            mappene DTM brukar vert oppretta automatisk der.
          </Melding>
        ) : (
          <>
            {/* Sett (faner) */}
            <div style={{ display:'flex', gap:6, marginBottom:14, flexShrink:0, flexWrap:'wrap' }}>
              {KATEGORIAR.map(k => (
                <button key={k} onClick={() => setAktivtSett(k)}
                  style={{ padding:'6px 13px', borderRadius:6, fontSize:12.5, fontWeight:700,
                    border:'1.5px solid', cursor:'pointer',
                    borderColor: aktivtSett === k ? KATEGORI_FARGE[k] : 'var(--border)',
                    background:  aktivtSett === k ? KATEGORI_FARGE[k] + '1a' : 'transparent',
                    color:       aktivtSett === k ? KATEGORI_FARGE[k] : 'var(--text3)' }}>
                  {KATEGORI_LABEL[k]} ({tal(k)})
                </button>
              ))}
            </div>

            <DTMTabell dokumenter={synlegeDokument} aktivtSett={aktivtSett} eigneKolonnar={eigneKolonnar}
              onSetVerdi={settVerdi} onOpneFil={(rad) => opneFil(rad)}
              onNyKolonne={addKolonne} onSlettKolonne={slettKolonne} onSetExtra={setExtraVerdi}/>
          </>
        )}
      </div>

      {importKategori && (
        <DTMImportModal kategori={importKategori} oppdragsSti={oppdragsSti} dokumenter={dokumenter}
          onLukk={() => setImportKategori(null)} onImporter={importer}/>
      )}
    </div>
  )
}

function Melding({ tittel, ikon, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      height:'100%', gap:16, paddingTop:40 }}>
      <div style={{ width:64, height:64, borderRadius:16, background:'var(--brandbg2)',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:24, fontWeight:900, color:'var(--brand)', fontFamily:'var(--font)' }}>{ikon}</div>
      <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>{tittel}</div>
      <p style={{ fontSize:13, color:'var(--text3)', textAlign:'center', maxWidth:420, lineHeight:1.7 }}>{children}</p>
    </div>
  )
}
