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

const STATUSVAL = [
  { nokkel:'kontrollert',    namn:'Kontrollert' },
  { nokkel:'ikkje_relevant', namn:'Ikkje relevant' },
  { nokkel:'neste_fase',     namn:'Må avklarast i neste fase' },
]
const SJEKK_KOLONNAR = 'minmax(0, 70fr) repeat(3, 84px) minmax(120px, 22fr)'

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
    ;(s || []).forEach(r => { svarMap[r.sjekkpunkt_id] = { status: r.status || (r.avkrossa ? 'kontrollert' : null), merknad: r.merknad || '' } })
    setSvar(svarMap)
    setLastar(false)
  }, [kontrolltype])

  useEffect(() => { if (session && dokumentId) lastDokument(dokumentId) }, [session, dokumentId, lastDokument])

  const { type: typeGjetta, stadium } = useMemo(() => tolkSjekklisteType(dokument?.nr, nummerering, dokument?.tittel), [dokument?.nr, dokument?.tittel, nummerering])
  const type = typeOverstyrt !== undefined ? typeOverstyrt : typeGjetta
  const punkt = useMemo(() => hentGjeldandeSjekkliste(sjekklisteData, type, stadium), [type, stadium])

  const settSvar = useCallback((sjekkpunktId, endring) => {
    setSvar(s => ({ ...s, [sjekkpunktId]: { ...(s[sjekkpunktId] || { status:null, merknad:'' }), ...endring } }))
  }, [])

  // Lagrar EITT sjekkpunkt-svar med det same (ikkje debounca — svara er
  // små og sjeldne nok til at dette ikkje monar, og unngår tapt data om
  // brukar lukkar vindauget rett etter siste klikk).
  const lagreSvar = useCallback(async (sjekkpunktId, nyttSvar) => {
    if (!session || !dokumentId) return
    await supabase.from('ks_kontroll_svar').upsert({
      id: Date.now() + Math.floor(Math.random() * 1000),
      user_id: session.user.id, dokument_id: dokumentId, kontrolltype,
      sjekkpunkt_id: sjekkpunktId, avkrossa: nyttSvar.status === 'kontrollert', status: nyttSvar.status || null, merknad: nyttSvar.merknad || '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'dokument_id,kontrolltype,sjekkpunkt_id' })
  }, [session, dokumentId, kontrolltype])

  // Tre gjensidig utelukkande val per punkt (klikk på det valde fjernar det att)
  const veksleStatus = (sjekkpunktId, status) => {
    const gjeldande = svar[sjekkpunktId]?.status || null
    const nytt = { ...(svar[sjekkpunktId] || { status:null, merknad:'' }), status: gjeldande === status ? null : status }
    settSvar(sjekkpunktId, { status: nytt.status })
    lagreSvar(sjekkpunktId, nytt)
  }
  const settMerknad = (sjekkpunktId, tekst) => settSvar(sjekkpunktId, { merknad: tekst })
  const lagreMerknad = (sjekkpunktId) => lagreSvar(sjekkpunktId, svar[sjekkpunktId] || { status:null, merknad:'' })

  const talAvkryssa = punkt.filter(p => svar[p.id]?.status).length
  const talKritiskUsjekka = punkt.filter(p => p.kritisk && svar[p.id]?.status !== 'kontrollert' && svar[p.id]?.status !== 'ikkje_relevant').length
  // Lista er alt ferdig utfylt og lukka for denne kontrolltypen → vert opna for innsyn, ikkje på nytt gjennom køen
  const alleredeUtfylt = dokument?.sjekkliste_utfylt?.[kontrolltype] || null

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
    if (alleredeUtfylt) { window.close(); return }
    setFerdigstiller(true)
    const teljing = (s) => punkt.filter(p => svar[p.id]?.status === s).length
    const utfylt = { ...(dokument.sjekkliste_utfylt || {}), [kontrolltype]: {
      at: new Date().toISOString(), av: session.user.email || '', type: type || null, stadium: stadium || null,
      kontrollert: teljing('kontrollert'), ikkje_relevant: teljing('ikkje_relevant'), neste_fase: teljing('neste_fase'), totalt: punkt.length,
    } }
    const { error } = await supabase.from('dtm_dokumenter')
      .update({ kontrollstatus: cfg.ferdigStatus, sjekkliste_utfylt: utfylt, updated_at: new Date().toISOString() })
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
      <div style={{ padding:'8px 18px', borderBottom:'1px solid var(--border)', background:'var(--brand)', flexShrink:0, display:'flex', alignItems:'baseline', gap:14, flexWrap:'wrap' }}>
        <span style={{ fontSize:11, fontWeight:800, letterSpacing:'.06em', textTransform:'uppercase', color:'rgba(255,255,255,.75)' }}>{cfg.namn}</span>
        <span style={{ fontSize:15, fontWeight:800, color:'#fff', fontFamily:'var(--mono)' }}>{dokument.nr}</span>
        <span style={{ fontSize:13, color:'rgba(255,255,255,.85)' }}>{dokument.tittel}</span>
      </div>

      <div style={{ padding:'10px 18px', borderBottom:'1px solid var(--border)', display:'flex',
        alignItems:'center', gap:10, flexWrap:'wrap', background:'var(--bg3)', flexShrink:0 }}>
        <span style={{ fontSize:11.5, color:'var(--text3)', fontWeight:600 }}>Sjekkliste-type:</span>
        <TypeVal verdi={type} sett={setTypeOverstyrt}/>
        {stadium && <span style={{ fontSize:11, color:'var(--text3)' }}>Stadium: <b>{stadium}</b></span>}
        <div style={{ flex:1 }}/>
        <span style={{ fontSize:11.5, color:'var(--text3)' }}>{talAvkryssa}/{punkt.length} behandla</span>
        {talKritiskUsjekka > 0 && (
          <span style={{ fontSize:11.5, color:'var(--danger)', fontWeight:700 }}>{talKritiskUsjekka} kritiske ikkje kontrollerte</span>
        )}
      </div>

      {alleredeUtfylt && (
        <div style={{ padding:'6px 18px', background:'rgba(5,150,105,.10)', color:'var(--success)', fontSize:12, fontWeight:700, flexShrink:0 }}>
          ✓ Sjekklista vart fylt ut {new Date(alleredeUtfylt.at).toLocaleDateString('nb-NO')}{alleredeUtfylt.av ? ' av ' + alleredeUtfylt.av : ''} — du ser den som ho vart levert.
        </div>
      )}

      {/* Liggande A4-oppsett: kontrolltekst ca. 70 %, så tre val og eit lite kommentarfelt */}
      <div style={{ flex:1, overflow:'auto' }}>
        <div style={{ display:'grid', gridTemplateColumns:SJEKK_KOLONNAR, alignItems:'center', position:'sticky', top:0, zIndex:2,
          background:'var(--bg3)', borderBottom:'1.5px solid var(--border)', padding:'5px 14px', gap:8,
          fontSize:10.5, fontWeight:800, letterSpacing:'.04em', textTransform:'uppercase', color:'var(--text3)' }}>
          <span>Kontrollpunkt</span>
          {STATUSVAL.map(v => <span key={v.nokkel} style={{ textAlign:'center', lineHeight:1.15 }}>{v.namn}</span>)}
          <span>Kommentar</span>
        </div>
        {punkt.length === 0 && (
          <div style={{ padding:'20px 18px', fontSize:13, color:'var(--text3)' }}>
            Ingen sjekkpunkt for denne kombinasjonen — vel ein annan type over, eller rediger Excel-fila og
            køyr <code>npm run sjekkliste:konverter</code> på nytt.
          </div>
        )}
        {punkt.map(p => {
          const v = svar[p.id] || { status:null, merknad:'' }
          return (
            <div key={p.id} style={{ display:'grid', gridTemplateColumns:SJEKK_KOLONNAR, alignItems:'center', gap:8,
              padding:'3px 14px', borderBottom:'1px solid var(--border)', background: v.status === 'kontrollert' ? 'rgba(5,150,105,.05)' : 'transparent' }}>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:12, lineHeight:1.3, color:'var(--text)' }}>
                  {p.tekst}
                  {p.kritisk && <span title="Kritisk punkt" style={{ color:'var(--danger)', marginLeft:5, fontWeight:800 }}>!</span>}
                  {p.ref && <span style={{ fontSize:10, color:'var(--text3)', marginLeft:6 }}>{p.ref}</span>}
                </div>
              </div>
              {STATUSVAL.map(sv => (
                <div key={sv.nokkel} style={{ textAlign:'center' }}>
                  <input type="checkbox" checked={v.status === sv.nokkel} onChange={() => veksleStatus(p.id, sv.nokkel)} title={sv.namn} disabled={!!alleredeUtfylt}
                    style={{ width:15, height:15, accentColor:'var(--brand)', cursor: alleredeUtfylt ? 'default' : 'pointer' }}/>
                </div>
              ))}
              <input value={v.merknad} onChange={e => settMerknad(p.id, e.target.value)}
                onBlur={() => lagreMerknad(p.id)} placeholder="…" disabled={!!alleredeUtfylt}
                style={{ width:'100%', boxSizing:'border-box', padding:'2px 6px', fontSize:11.5,
                  borderRadius:'var(--r)', border:'1px solid var(--border)', background:'var(--bg2)',
                  color:'var(--text)', outline:'none', fontFamily:'var(--font)' }}/>
            </div>
          )
        })}
      </div>

      <div style={{ padding:'8px 18px', borderTop:'1px solid var(--border)', flexShrink:0, background:'var(--bg2)' }}>
        {varselStatus && <div style={{ fontSize:11.5, color:'var(--text3)', marginBottom:8 }}>{varselStatus}</div>}
        <button className="dt-knapp hovud" style={{ width:'100%' }} disabled={ferdigstiller} onClick={ferdigstill}>
          {ferdigstiller ? 'Lagrar…' : alleredeUtfylt ? 'Lukk' : `Ferdigstill ${cfg.namn.toLowerCase()}`}
        </button>
      </div>
    </div>
  )
}
