import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from './supabase'
import { KONTROLLTYPE, tolkSjekklisteType, hentGjeldandeSjekkliste, KATEGORI_MAPPE } from './dtmKonstantar'
import { hentNummerering } from './teikningsnummer'
import sjekklisteData from './sjekklister/tegningskontroll.json'

// ═══════════════════════════════════════════════════════════════════
//  SjekklisteVindauge — innhaldet i det NYE, skalerbare Electron-
//  vindauget «Start egenkontroll/fagkontroll/godkjenning» opnar (sjå
//  KvalitetModule.jsx og main.jsx sin ?sjekkliste=1-ruting). Køyrer i
//  eit HEILT ANNA BrowserWindow enn hovudappen, men SAME preload/økt
//  (delt localStorage) — difor ingen eigen innloggingsflyt her, berre
//  ei kort venting på at Supabase-økta er attgjeven.
//
//  Sjekklista sjølv er STATISK data (tegningskontroll.json, generert av
//  scripts/konverter-sjekkliste.cjs frå kontoret si Excel-fil) — svara
//  (avkryssing + merknad) vert lagra fortløpande i ks_kontroll_svar.
//
//  Etter ferdigstilling hentar komponenten sjølv fram NESTE dokument i
//  same kø (same kontrolltype) og går vidare utan at brukar treng gjere
//  noko i hovudvindauget — brukar sitt eige val 28. sept. 2026
//  («Held fram automatisk til neste dokument i køen»).
// ═══════════════════════════════════════════════════════════════════

function TypeVal({ verdi, sett }) {
  return (
    <select value={verdi || ''} onChange={e => sett(e.target.value || null)}
      style={{ padding:'5px 8px', borderRadius:'var(--r)', border:'1.5px solid var(--border)',
        background:'var(--bg2)', color:'var(--text)', fontSize:12.5, fontFamily:'var(--font)' }}>
      <option value="">(ingen type — berre Tittelfelt)</option>
      {Object.entries(sjekklisteData.typar).map(([nokkel, t]) => (
        <option key={nokkel} value={nokkel}>{t.namn}</option>
      ))}
    </select>
  )
}

export default function SjekklisteVindauge({ dokumentId: startId, kontrolltype }) {
  const cfg = KONTROLLTYPE[kontrolltype]
  const [session, setSession] = useState(null)
  const [dokumentId, setDokumentId] = useState(startId)
  const [dokument, setDokument] = useState(null)
  const [oppdragsSti, setOppdragsSti] = useState('')
  const [nummerering, setNummerering] = useState(() => hentNummerering(null))
  const [typeOverstyrt, setTypeOverstyrt] = useState(undefined) // undefined = ikkje rørt, følg gjetting
  const [svar, setSvar] = useState({}) // { [sjekkpunktId]: { avkrossa, merknad } }
  const [lastar, setLastar] = useState(true)
  const [feil, setFeil] = useState('')
  const [ferdigstiller, setFerdigstiller] = useState(false)
  const [heileKoenFerdig, setHeileKoenFerdig] = useState(false)
  const [varselStatus, setVarselStatus] = useState('') // melding om e-postvarsel etter ferdigstilling

  const harBru = typeof window !== 'undefined' && !!window.resultatdokumentAPI

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
  }, [])

  const lastDokument = useCallback(async (id) => {
    setLastar(true); setFeil(''); setVarselStatus('')
    const { data: d, error } = await supabase.from('dtm_dokumenter').select('*').eq('id', id).single()
    if (error || !d) { setFeil('Fann ikkje dokumentet.'); setLastar(false); return }
    setDokument(d)
    setTypeOverstyrt(undefined)
    const { data: p } = await supabase.from('projects').select('details').eq('id', d.project_id).single()
    setOppdragsSti(p?.details?.oppdragsSti || '')
    setNummerering(hentNummerering(p?.details))
    const { data: s } = await supabase.from('ks_kontroll_svar').select('*')
      .eq('dokument_id', id).eq('kontrolltype', kontrolltype)
    const svarMap = {}
    ;(s || []).forEach(r => { svarMap[r.sjekkpunkt_id] = { avkrossa: r.avkrossa, merknad: r.merknad || '' } })
    setSvar(svarMap)
    setLastar(false)
  }, [kontrolltype])

  useEffect(() => { if (session && dokumentId) lastDokument(dokumentId) }, [session, dokumentId, lastDokument])

  const { type: typeGjetta, stadium } = useMemo(() => tolkSjekklisteType(dokument?.nr, nummerering, dokument?.tittel), [dokument?.nr, dokument?.tittel, nummerering])
  const type = typeOverstyrt !== undefined ? typeOverstyrt : typeGjetta
  const punkt = useMemo(() => hentGjeldandeSjekkliste(sjekklisteData, type, stadium), [type, stadium])

  const settSvar = useCallback((sjekkpunktId, endring) => {
    setSvar(s => ({ ...s, [sjekkpunktId]: { ...(s[sjekkpunktId] || { avkrossa:false, merknad:'' }), ...endring } }))
  }, [])

  // Lagrar EITT sjekkpunkt-svar med det same (ikkje debounca — svara er
  // små og sjeldne nok til at dette ikkje monar, og unngår tapt data om
  // brukar lukkar vindauget rett etter siste klikk).
  const lagreSvar = useCallback(async (sjekkpunktId, nyttSvar) => {
    if (!session || !dokumentId) return
    await supabase.from('ks_kontroll_svar').upsert({
      id: Date.now() + Math.floor(Math.random() * 1000),
      user_id: session.user.id, dokument_id: dokumentId, kontrolltype,
      sjekkpunkt_id: sjekkpunktId, avkrossa: !!nyttSvar.avkrossa, merknad: nyttSvar.merknad || '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'dokument_id,kontrolltype,sjekkpunkt_id' })
  }, [session, dokumentId, kontrolltype])

  const veksleAvkryssa = (sjekkpunktId) => {
    const nytt = { ...(svar[sjekkpunktId] || { avkrossa:false, merknad:'' }), avkrossa: !(svar[sjekkpunktId]?.avkrossa) }
    settSvar(sjekkpunktId, { avkrossa: nytt.avkrossa })
    lagreSvar(sjekkpunktId, nytt)
  }
  const settMerknad = (sjekkpunktId, tekst) => settSvar(sjekkpunktId, { merknad: tekst })
  const lagreMerknad = (sjekkpunktId) => lagreSvar(sjekkpunktId, svar[sjekkpunktId] || { avkrossa:false, merknad:'' })

  const talAvkryssa = punkt.filter(p => svar[p.id]?.avkrossa).length
  const talKritiskUsjekka = punkt.filter(p => p.kritisk && !svar[p.id]?.avkrossa).length

  // Opnar den assosierte fila for eit dokument i systemet sitt standard-
  // program (same mønster som DTM/KvalitetModule elles) — brukt både ved
  // FYRSTE opning (kalla frå KvalitetModule sjølv) og ved auto-vidareføring
  // til neste dokument i køen (kalla herifrå).
  const opneAssosiertFil = useCallback((dok, sti) => {
    if (!harBru || !sti) return
    const filnamn = dok?.kontrolldokument?.filnamn
    if (!filnamn) return
    window.resultatdokumentAPI.dtmApneFil(sti, 'kontrolldokument', filnamn, false)
  }, [harBru])

  // Sender eit varsel til den som skal utføre NESTE steg (fagkontroll etter
  // egenkontroll, godkjenning etter fagkontroll) — slår opp e-postadressa
  // via dei frie initialane i dtm_dokumenter (fk_person/godkjent_av) mot
  // kontaktar-tabellen. Opnar eit FERDIG UTFYLT UTKAST i Outlook (brukar
  // sitt eige val 28. sept. 2026) — sender ALDRI stille/automatisk.
  const varsleNesteSteg = useCallback(async (dok) => {
    if (!cfg.varsleFelt) return
    const initialar = (dok[cfg.varsleFelt] || '').trim()
    if (!initialar) { setVarselStatus('Ingen person sett i feltet — ingen e-post sendt.'); return }
    const { data: kontaktar } = await supabase.from('kontaktar').select('*').eq('initialar', initialar)
    const kontakt = kontaktar?.[0]
    if (!kontakt) { setVarselStatus(`Fann ingen kontakt med initialane «${initialar}» — varsle manuelt.`); return }

    const nesteNamn = cfg.ferdigStatus === 'klar_fagkontroll' ? 'fagkontroll' : 'godkjenning'
    const emne = `${dok.nr} klar for ${nesteNamn}`
    const kropp = `Hei ${kontakt.namn}!\n\n${dok.nr} – ${dok.tittel || ''} er no ferdig med ${cfg.namn.toLowerCase()} og klar for ${nesteNamn}.\n\nMvh`
    const mappeNamn = KATEGORI_MAPPE.kontrolldokument
    const filsti = (oppdragsSti && dok.kontrolldokument?.filnamn)
      ? `${oppdragsSti}\\${mappeNamn}\\${dok.kontrolldokument.filnamn}` : ''
    if (harBru) {
      await window.resultatdokumentAPI.dtmOpneEpostMedVedlegg(kontakt.epost, emne, kropp, filsti ? [filsti] : [])
      setVarselStatus(`Utkast opna i Outlook til ${kontakt.namn} (${kontakt.epost}).`)
    }
  }, [cfg, oppdragsSti, harBru])

  const ferdigstill = async () => {
    if (!dokument) return
    setFerdigstiller(true)
    const { error } = await supabase.from('dtm_dokumenter')
      .update({ kontrollstatus: cfg.ferdigStatus, updated_at: new Date().toISOString() })
      .eq('id', dokument.id)
    if (error) { setFeil('Klarte ikkje lagre ferdigstillinga: ' + error.message); setFerdigstiller(false); return }

    await varsleNesteSteg(dokument)

    // Finn NESTE dokument i same kø (same kontrolltype), ikkje det som
    // nett vart ferdigstilt — held fram automatisk (brukar sitt eige val).
    const { data: kandidatar } = await supabase.from('dtm_dokumenter').select('*')
      .eq('project_id', dokument.project_id).in('kontrollstatus', cfg.kø).order('nr')
    const neste = (kandidatar || []).find(d => d.id !== dokument.id)
    setFerdigstiller(false)
    if (neste) {
      opneAssosiertFil(neste, oppdragsSti)
      setDokumentId(neste.id)
    } else {
      setHeileKoenFerdig(true)
    }
  }

  if (!session || lastar) {
    return <div style={{ padding:24, fontSize:13, color:'var(--text3)' }}>Lastar…</div>
  }
  if (feil) {
    return <div style={{ padding:24, fontSize:13, color:'var(--danger)' }}>{feil}</div>
  }
  if (heileKoenFerdig) {
    return (
      <div style={{ padding:32, textAlign:'center' }}>
        <div style={{ fontSize:34, marginBottom:10 }}>✓</div>
        <div style={{ fontSize:15, fontWeight:800, color:'var(--text)', marginBottom:6 }}>
          Alle dokument er ferdige med {cfg.namn.toLowerCase()}!
        </div>
        <p style={{ fontSize:13, color:'var(--text3)' }}>Du kan lukke dette vindauget.</p>
        <button onClick={() => window.close()} className="dt-knapp" style={{ marginTop:14 }}>Lukk vindauge</button>
      </div>
    )
  }
  if (!dokument) return null

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'var(--bg2)' }}>
      <style>{`:root, body, #root { height:100%; margin:0 }`}</style>
      <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', background:'var(--brand)', flexShrink:0 }}>
        <div style={{ fontSize:11, fontWeight:800, letterSpacing:'.06em', textTransform:'uppercase', color:'rgba(255,255,255,.75)' }}>
          {cfg.namn}
        </div>
        <div style={{ fontSize:16, fontWeight:800, color:'#fff', fontFamily:'var(--mono)' }}>{dokument.nr}</div>
        <div style={{ fontSize:13, color:'rgba(255,255,255,.85)' }}>{dokument.tittel}</div>
      </div>

      <div style={{ padding:'10px 18px', borderBottom:'1px solid var(--border)', display:'flex',
        alignItems:'center', gap:10, flexWrap:'wrap', background:'var(--bg3)', flexShrink:0 }}>
        <span style={{ fontSize:11.5, color:'var(--text3)', fontWeight:600 }}>Sjekkliste-type:</span>
        <TypeVal verdi={type} sett={setTypeOverstyrt}/>
        {stadium && <span style={{ fontSize:11, color:'var(--text3)' }}>Stadium: <b>{stadium}</b></span>}
        <div style={{ flex:1 }}/>
        <span style={{ fontSize:11.5, color:'var(--text3)' }}>{talAvkryssa}/{punkt.length} avkryssa</span>
        {talKritiskUsjekka > 0 && (
          <span style={{ fontSize:11.5, color:'var(--danger)', fontWeight:700 }}>{talKritiskUsjekka} kritiske ikkje avkryssa</span>
        )}
      </div>

      <div style={{ flex:1, overflow:'auto', padding:'6px 0' }}>
        {punkt.length === 0 && (
          <div style={{ padding:'20px 18px', fontSize:13, color:'var(--text3)' }}>
            Ingen sjekkpunkt for denne kombinasjonen — vel ein annan type over, eller rediger Excel-fila og
            køyr <code>npm run sjekkliste:konverter</code> på nytt.
          </div>
        )}
        {punkt.map(p => {
            const v = svar[p.id] || { avkrossa:false, merknad:'' }
            return (
              <div key={p.id} style={{ padding:'8px 18px', borderBottom:'1px solid var(--border)',
                background: v.avkrossa ? 'rgba(5,150,105,.05)' : 'transparent' }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                  <input type="checkbox" checked={v.avkrossa} onChange={() => veksleAvkryssa(p.id)}
                    style={{ width:16, height:16, marginTop:2, accentColor:'var(--brand)', cursor:'pointer', flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, color:'var(--text)', textDecoration: v.avkrossa ? 'line-through' : 'none',
                      opacity: v.avkrossa ? .7 : 1 }}>
                      {p.tekst}
                      {p.kritisk && <span title="Kritisk punkt" style={{ color:'var(--danger)', marginLeft:5, fontWeight:800 }}>!</span>}
                    </div>
                    <div style={{ fontSize:10.5, color:'var(--text3)', marginTop:1 }}>
                      {p.ref}{p.ref && p.stadium?.length ? ' · ' : ''}{p.stadium?.join(', ')}
                      {p.auto && <span style={{ marginLeft:6, color:'var(--brand)' }}>⚙ kan automatiserast</span>}
                    </div>
                    <input value={v.merknad} onChange={e => settMerknad(p.id, e.target.value)}
                      onBlur={() => lagreMerknad(p.id)} placeholder="Merknad …"
                      style={{ marginTop:5, width:'100%', boxSizing:'border-box', padding:'4px 8px', fontSize:12,
                        borderRadius:'var(--r)', border:'1px solid var(--border)', background:'var(--bg2)',
                        color:'var(--text)', outline:'none', fontFamily:'var(--font)' }}/>
                  </div>
                </div>
              </div>
            )
        })}
      </div>

      <div style={{ padding:'12px 18px', borderTop:'1px solid var(--border)', flexShrink:0, background:'var(--bg2)' }}>
        {varselStatus && <div style={{ fontSize:11.5, color:'var(--text3)', marginBottom:8 }}>{varselStatus}</div>}
        <button className="dt-knapp hovud" style={{ width:'100%' }} disabled={ferdigstiller} onClick={ferdigstill}>
          {ferdigstiller ? 'Lagrar…' : `Ferdigstill ${cfg.namn.toLowerCase()}`}
        </button>
      </div>
    </div>
  )
}
