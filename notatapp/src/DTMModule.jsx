import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './supabase'
import DTMTabell from './DTMTabell'
import DTMImportModal from './DTMImportModal'
import DTMUtsendingModal from './DTMUtsendingModal'
import DTMUtsendingarListe from './DTMUtsendingarListe'
import { KATEGORIAR, KATEGORI_LABEL, KATEGORI_FARGE, KATEGORI_MAPPE, løysAktivtSett, namnFraEpost,
  nesteUtsendingsnummer, utsendingsnrTekst } from './dtmKonstantar'

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
  const [aktivtSett, setAktivtSett] = useState('alle')
  const [importKategori, setImportKategori] = useState(null) // kategori-nøkkel eller null (modal lukka)
  const [importMenyOpen, setImportMenyOpen] = useState(false)
  const [valde, setValde] = useState(() => new Set()) // fleirval (shift/ctrl-klikk), sjå DataTabell sin `merking`-prop
  const importMenyRef = useRef(null)
  const [utsendingar, setUtsendingar] = useState([])
  const [utsendingModalId, setUtsendingModalId] = useState(null) // id eller null (lukka)
  const [utsendingarListeOpen, setUtsendingarListeOpen] = useState(false)

  const harBru = typeof window !== 'undefined' && !!window.resultatdokumentAPI
  const aktivtProsjekt = projects.find(p => p.id === activeProjectId)
  const laast = !!(details?.oppdragsStiLast && details?.oppdragsSti)
  const oppdragsSti = laast ? details.oppdragsSti : ''

  // ── Last prosjektdetaljar (oppdragssti) + register + eigne kolonnar ──
  const lastAlt = useCallback(async () => {
    if (!userId || !activeProjectId) {
      setDetails(null); setDokumenter([]); setEigneKolonnar([]); setUtsendingar([]); setLoading(false); return
    }
    setLoading(true)
    const [{ data: pData }, { data: dData }, { data: colData }, { data: uData }, { data: udData }] = await Promise.all([
      supabase.from('projects').select('details').eq('id', activeProjectId).eq('user_id', userId).single(),
      supabase.from('dtm_dokumenter').select('*').eq('project_id', activeProjectId).eq('user_id', userId).order('nr'),
      supabase.from('dtm_columns').select('*').eq('project_id', activeProjectId).eq('user_id', userId).order('sortering'),
      supabase.from('dtm_utsendingar').select('*').eq('project_id', activeProjectId).eq('user_id', userId).order('created_at', { ascending:false }),
      supabase.from('dtm_utsending_dokument').select('*').eq('user_id', userId),
    ])
    setDetails(pData?.details || {})
    setDokumenter(dData || [])
    setEigneKolonnar((colData || []).map(k => ({ key:k.key, label:k.label, art:k.art || 'tekst', val:k.val_liste || undefined })))
    const udPerUtsending = {}
    ;(udData || []).forEach(ud => { (udPerUtsending[ud.utsending_id] ??= []).push(ud) })
    setUtsendingar((uData || []).map(u => ({ ...u, dokument: udPerUtsending[u.id] || [] })))
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
  // akkurat denne kategorien akkurat no. «alle» syner alt, uavhengig av
  // kategori — sjå løysAktivtSett()/finnGjeldandeKategori() for korleis
  // kvar rad då vel KVA kategori sitt filnamn/rev/dato/status ho viser.
  const synlegeDokument = useMemo(
    () => aktivtSett === 'alle' ? dokumenter : dokumenter.filter(d => d[aktivtSett]),
    [dokumenter, aktivtSett])

  const tal = useCallback(k => dokumenter.filter(d => d[k]).length, [dokumenter])

  // Grupperer SENDTE utsendingar per dokument (via dokument_id), til den
  // nye «Utsendingar»-kolonna i DTMTabell — kladdar tel ikkje med, sidan
  // dei enno ikkje er stadfesta faktisk sende.
  const utsendingarPerDokument = useMemo(() => {
    const m = {}
    for (const u of utsendingar) {
      if (u.status !== 'sendt') continue
      for (const d of u.dokument) {
        if (!d.dokument_id) continue
        ;(m[d.dokument_id] ??= []).push(u)
      }
    }
    return m
  }, [utsendingar])

  // Fleirval høyrer til det synlege utvalet — byte av sett/fane skal ikkje
  // halde på eit utval frå ei anna vising.
  useEffect(() => { setValde(new Set()) }, [aktivtSett])

  // Lukk import-nedtrekksmenyen ved klikk utanfor
  useEffect(() => {
    if (!importMenyOpen) return
    const lukk = (e) => { if (!importMenyRef.current?.contains(e.target)) setImportMenyOpen(false) }
    document.addEventListener('mousedown', lukk)
    return () => document.removeEventListener('mousedown', lukk)
  }, [importMenyOpen])

  // ── Eigendefinerte kolonnar (same mønster som Saker/Notat) ─────────
  // «valListe» (valfri) gjer kolonnen om til ei nedtrekksliste med faste
  // val i staden for fritekst — sjå DataTabell sitt Ny kolonne-skjema.
  const addKolonne = async (label, art, valListe) => {
    const key = 'eigen_' + Date.now().toString(36)
    const rad = {
      id: Date.now(), user_id: userId, project_id: activeProjectId, key, label, art,
      val_liste: valListe || null, sortering: eigneKolonnar.length, created_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('dtm_columns').insert(rad)
    if (error) { alert('Klarte ikkje lagre kolonnen: ' + error.message); return null }
    setEigneKolonnar(prev => [...prev, { key, label, art, val: valListe }])
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
  // «Ferdigstillelse»/«Timebudsjett» er ekte NUMERIC/INTEGER-kolonnar i
  // Supabase (til skilnad frå tekstfelta, som brukar '' som tomt-verdi) —
  // ein tom streng ville feila mot databasen, så tomming skal lagrast som
  // NULL for desse to i staden.
  const NUMERISKE_FELT = new Set(['ferdigstillelse', 'timebudsjett'])
  // «Rev.»/«Dato» er IKKJE flate felt på rada — dei ligg nøsta inni det
  // AKTIVE kategori-JSON-objektet (arbeidsdokument/resultatdokument/…, sjå
  // hentGjeldande() i DTMTabell.jsx). Redigering her må difor skrive inn i
  // heile det objektet, ikkje som eit topp-nivå Supabase-felt.
  const NØSTA_FELT = { rev:'revisjon', dato:'dato' }
  const settVerdi = async (id, felt, verdi) => {
    if (NØSTA_FELT[felt]) {
      const d = dokumenter.find(x => x.id === id)
      const sett = d && løysAktivtSett(d, aktivtSett)
      if (!sett) return
      const nyttSett = { ...(d[sett] || {}), [NØSTA_FELT[felt]]: verdi }
      setDokumenter(ds => ds.map(x => x.id === id ? { ...x, [sett]: nyttSett } : x))
      await supabase.from('dtm_dokumenter').update({ [sett]: nyttSett, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId)
      return
    }
    const lagra = NUMERISKE_FELT.has(felt) && verdi === '' ? null : verdi
    setDokumenter(ds => ds.map(d => d.id === id ? { ...d, [felt]: lagra } : d))
    await supabase.from('dtm_dokumenter').update({ [felt]: lagra, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId)
  }

  // ── Favoritt / fest til toppen (radmeny) ────────────────────────────
  const toggleFavorite = async (id) => {
    const d = dokumenter.find(x => x.id === id)
    if (!d) return
    await settVerdi(id, 'favorite', !d.favorite)
  }
  const togglePinned = async (id) => {
    const d = dokumenter.find(x => x.id === id)
    if (!d) return
    await settVerdi(id, 'pinned', !d.pinned)
  }

  // ── Opne den gjeldande fila (klikk på Dokumentnummer-kolonna) ───────
  const opneFil = (rad) => {
    const sett = løysAktivtSett(rad, aktivtSett)
    const g = sett && rad[sett]
    if (!g?.filnamn || !harBru) return
    window.resultatdokumentAPI.dtmApneFil(oppdragsSti, sett, g.filnamn, false)
  }

  // ── «Del fil» (radmeny) — kopierer filstien(ane) til utklippstavla og
  // opnar e-postprogrammet med dei lima inn. Er fleire rader markerte
  // (og rada som vart klikka er éin av dei), vert ALLE dei markerte filene
  // delte samstundes — elles berre den eine rada som vart klikka.
  const delFil = async (id, rad) => {
    if (!harBru) return
    const idAr = valde.has(id) && valde.size > 1 ? [...valde] : [id]
    const stiar = idAr.map((docId) => {
      const d = docId === id ? rad : dokumenter.find((x) => x.id === docId)
      if (!d) return null
      const sett = løysAktivtSett(d, aktivtSett)
      const g = sett && d[sett]
      if (!g?.filnamn) return null
      return `${oppdragsSti}\\${KATEGORI_MAPPE[sett]}\\${g.filnamn}`
    }).filter(Boolean)
    if (stiar.length === 0) { alert('Fann ingen filer å dele.'); return }
    await window.resultatdokumentAPI.dtmDelFil(stiar)
  }

  // ── Registrering av utsendingar ──────────────────────────────────────
  // «Registrer utsending» (radmeny) — same fleirval-oppførsel som «Del
  // fil»: er fleire rader markerte, vert dei ALLE lagt inn i den nye
  // utsendinga med det same. Lagra som KLADD i Supabase STRAKS, slik at
  // ingenting går tapt om brukar lukkar vindauget eller går til e-post og
  // kjem attende seinare — sjå claude/dtm-modul.md.
  const registrerUtsending = async (id, rad) => {
    const idAr = valde.has(id) && valde.size > 1 ? [...valde] : [id]
    const radArr = idAr.map((docId) => docId === id ? rad : dokumenter.find((x) => x.id === docId)).filter(Boolean)
    if (radArr.length === 0) return

    const no = new Date().toISOString()
    const utsendingId = Date.now()
    const nyUtsending = {
      id: utsendingId, user_id: userId, project_id: activeProjectId,
      mottakar: '', kanal: [], emne: '', utsendingsnr: nesteUtsendingsnummer(utsendingar),
      kommentar: '', status: 'kladd',
      dato: no.slice(0, 10), oppretta_av: namnFraEpost(userEmail), bekrefta_av: '', bekrefta_tid: null,
      kvittering_fil: '', created_at: no, updated_at: no,
    }
    const { error } = await supabase.from('dtm_utsendingar').insert(nyUtsending)
    if (error) { alert('Klarte ikkje opprette utsendinga: ' + error.message); return }

    const dokRader = radArr.map((d, i) => {
      const sett = løysAktivtSett(d, aktivtSett)
      const g = sett && d[sett]
      return {
        id: utsendingId + i + 1, user_id: userId, utsending_id: utsendingId, dokument_id: d.id,
        nr: d.nr, kategori: sett || '', filnamn: g?.filnamn || '', revisjon: g?.revisjon || '',
        created_at: no,
      }
    })
    const { error: error2 } = await supabase.from('dtm_utsending_dokument').insert(dokRader)
    if (error2) { alert('Klarte ikkje leggje til dokument i utsendinga: ' + error2.message) }

    setUtsendingar(us => [{ ...nyUtsending, dokument: dokRader }, ...us])
    setUtsendingModalId(utsendingId)
  }

  const oppdaterUtsendingFelt = async (id, felt, verdi) => {
    setUtsendingar(us => us.map(u => u.id === id ? { ...u, [felt]: verdi } : u))
    await supabase.from('dtm_utsendingar').update({ [felt]: verdi, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId)
  }

  const leggTilDokumentIUtsending = async (utsendingId, dokInfo) => {
    const id = Date.now()
    const rad = { id, user_id: userId, utsending_id: utsendingId, created_at: new Date().toISOString(), ...dokInfo }
    const { error } = await supabase.from('dtm_utsending_dokument').insert(rad)
    if (error) { alert('Klarte ikkje leggje til dokumentet: ' + error.message); return }
    setUtsendingar(us => us.map(u => u.id === utsendingId ? { ...u, dokument: [...u.dokument, rad] } : u))
  }

  const fjernDokumentFraUtsending = async (utsendingDokumentId) => {
    await supabase.from('dtm_utsending_dokument').delete().eq('id', utsendingDokumentId).eq('user_id', userId)
    setUtsendingar(us => us.map(u => ({ ...u, dokument: u.dokument.filter(d => d.id !== utsendingDokumentId) })))
  }

  // Opnar utsendinga sin e-post med EKTE VEDLEGG via Outlook-COM (fell
  // automatisk attende til mailto: viss det feilar — sjå dtm:opne-epost-
  // med-vedlegg i main.js). Utsendingsnummeret vert lima inn nedst i
  // e-postteksten slik at ein seinare kan slå opp att kva utsending ein
  // motteken kvittering høyrer til.
  const apneEpostForUtsending = async (utsendingId) => {
    if (!harBru) return null
    const u = utsendingar.find(x => x.id === utsendingId)
    if (!u) return null
    const stiar = u.dokument.map(d => d.filnamn ? `${oppdragsSti}\\${KATEGORI_MAPPE[d.kategori]}\\${d.filnamn}` : null).filter(Boolean)
    if (stiar.length === 0) { alert('Ingen dokument med fil å opne e-post for.'); return null }

    const nrTekst = utsendingsnrTekst(u.utsendingsnr)
    const dokListe = u.dokument.map(d => `- ${d.nr}${d.revisjon ? ` (rev. ${d.revisjon})` : ''}`).join('\n')
    const kropp = `Oversending av følgjande dokument:\n\n${dokListe}\n\n\n${nrTekst}`
    const emne = u.emne || `Oversending av dokument ${nrTekst}`

    return await window.resultatdokumentAPI.dtmOpneEpostMedVedlegg(u.mottakar || '', emne, kropp, stiar)
  }

  const bekreftUtsendingSendt = async (utsendingId) => {
    const felt = { status: 'sendt', bekrefta_av: namnFraEpost(userEmail), bekrefta_tid: new Date().toISOString() }
    setUtsendingar(us => us.map(u => u.id === utsendingId ? { ...u, ...felt } : u))
    await supabase.from('dtm_utsendingar').update({ ...felt, updated_at: new Date().toISOString() }).eq('id', utsendingId).eq('user_id', userId)
  }

  // Kvittering (t.d. sendt e-post dregen ut som .msg) — sterkare dokumentasjon
  // enn ei eigenmelding, difor stadfestar dette sendinga automatisk.
  const lagreKvitteringForUtsending = async (utsendingId, kjeldeSti) => {
    if (!harBru) return
    const svar = await window.resultatdokumentAPI.dtmLagreKvittering(oppdragsSti, kjeldeSti)
    if (!svar?.ok) { throw new Error(svar?.melding || 'Ukjend feil.') }
    const u = utsendingar.find(x => x.id === utsendingId)
    const felt = {
      kvittering_fil: svar.filnamn, status: 'sendt',
      bekrefta_av: u?.bekrefta_av || namnFraEpost(userEmail),
      bekrefta_tid: u?.bekrefta_tid || new Date().toISOString(),
    }
    setUtsendingar(us => us.map(x => x.id === utsendingId ? { ...x, ...felt } : x))
    await supabase.from('dtm_utsendingar').update({ ...felt, updated_at: new Date().toISOString() }).eq('id', utsendingId).eq('user_id', userId)
  }

  const apneKvitteringForUtsending = async (utsendingId) => {
    if (!harBru) return
    const u = utsendingar.find(x => x.id === utsendingId)
    if (!u?.kvittering_fil) return
    await window.resultatdokumentAPI.dtmApneKvittering(oppdragsSti, u.kvittering_fil)
  }

  const slettUtsendingKladd = async (utsendingId) => {
    if (!window.confirm('Slette denne kladden?')) return
    await supabase.from('dtm_utsendingar').delete().eq('id', utsendingId).eq('user_id', userId)
    setUtsendingar(us => us.filter(u => u.id !== utsendingId))
    if (utsendingModalId === utsendingId) setUtsendingModalId(null)
  }

  // ── Sjølve importen: flytt filer (Electron) + skriv til Supabase ───
  // Kalla frå DTMImportModal etter at brukar har retta/fjerna dokument i
  // gjennomgangsmatrisa. Sjå claude/dtm-modul.md, avsnittet om
  // importflyten, for den fulle regelen.
  const importer = async (rader) => {
    const kategori = importKategori
    const filResultat = await window.resultatdokumentAPI.dtmBekreftImport(
      oppdragsSti, kategori,
      rader.map(r => {
        const gammalKategoriVerdi = dokumenter.find(d => d.nr === r.nr)?.[kategori]
        return {
          kjeldeSti: r.kjeldeSti, nr: r.nr, rev: r.rev,
          gammalFilnamn: gammalKategoriVerdi?.filnamn || null,
          gammalRevisjon: gammalKategoriVerdi?.revisjon || null,
        }
      }),
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
          godkjent_av: r.godkjent_av || '', oppdragsgivar: r.oppdragsgivar || '',
          tiltakshavar: r.tiltakshavar || '', oppdragsnr: r.oppdragsnr || '',
          revisjonsbeskriving: r.revisjonsbeskriving || '', tegningsformal: r.tegningsformal || '',
          ferdigstillingsstatus: r.ferdigstillingsstatus || '',
          lagra_av: namnFraEpost(userEmail), status: [], ekstra: {}, favorite: false, pinned: false,
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
          godkjent_av: r.godkjent_av || gammalRad.godkjent_av,
          oppdragsgivar: r.oppdragsgivar || gammalRad.oppdragsgivar,
          tiltakshavar: r.tiltakshavar || gammalRad.tiltakshavar,
          oppdragsnr: r.oppdragsnr || gammalRad.oppdragsnr,
          revisjonsbeskriving: r.revisjonsbeskriving || gammalRad.revisjonsbeskriving,
          tegningsformal: r.tegningsformal || gammalRad.tegningsformal,
          ferdigstillingsstatus: r.ferdigstillingsstatus || gammalRad.ferdigstillingsstatus,
          lagra_av: namnFraEpost(userEmail) || gammalRad.lagra_av, updated_at: no,
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
      </div>

      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', padding:'18px 20px' }}>
        {/* Import — éin blå knapp med nedtrekksmeny, venstrestilt øvst i modulen */}
        {harBru && laast && (
          <div style={{ display:'flex', gap:8, marginBottom:16, flexShrink:0 }}>
            <div ref={importMenyRef} style={{ position:'relative' }}>
              <button onClick={() => setImportMenyOpen(v => !v)}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:'var(--r)',
                  border:'none', background:'#2563EB', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer',
                  boxShadow:'var(--shadow-sm)' }}>
                + Import <span style={{ fontSize:10 }}>▾</span>
              </button>
              {importMenyOpen && (
                <div className="dt-meny" style={{ left:0, top:'calc(100% + 6px)', position:'absolute', width:220 }}>
                  {KATEGORIAR.map(k => (
                    <button key={k} type="button" className="dt-val"
                      onClick={() => { setImportKategori(k); setImportMenyOpen(false) }}>
                      <span className="dt-rmikon" style={{ color:KATEGORI_FARGE[k] }}>●</span>
                      <span>Import {KATEGORI_LABEL[k].toLowerCase()}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setUtsendingarListeOpen(true)}
              style={{ padding:'9px 16px', borderRadius:'var(--r)', border:'1.5px solid var(--border)',
                background:'var(--bg2)', color:'var(--text2)', fontSize:13, fontWeight:700, cursor:'pointer' }}>
              Utsendingar {utsendingar.filter(u => u.status !== 'sendt').length > 0
                && `(${utsendingar.filter(u => u.status !== 'sendt').length} kladd)`}
            </button>
          </div>
        )}

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
            {/* Sett (faner) — «Alle dokumenter» heilt til venstre, så kategoriane */}
            <div style={{ display:'flex', gap:6, marginBottom:14, flexShrink:0, flexWrap:'wrap' }}>
              <button onClick={() => setAktivtSett('alle')}
                style={{ padding:'6px 13px', borderRadius:6, fontSize:12.5, fontWeight:700,
                  border:'1.5px solid', cursor:'pointer',
                  borderColor: aktivtSett === 'alle' ? 'var(--brand)' : 'var(--border)',
                  background:  aktivtSett === 'alle' ? 'var(--brandbg)' : 'transparent',
                  color:       aktivtSett === 'alle' ? 'var(--brand)' : 'var(--text3)' }}>
                Alle dokumenter ({dokumenter.length})
              </button>
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
              oppdragsSti={oppdragsSti} merking={{ valde, onEndre: setValde }}
              onSetVerdi={settVerdi} onOpneFil={(rad) => opneFil(rad)} onDelFil={delFil}
              onToggleFavorite={toggleFavorite} onTogglePinned={togglePinned}
              onRegistrerUtsending={registrerUtsending} utsendingarPerDokument={utsendingarPerDokument}
              onNyKolonne={addKolonne} onSlettKolonne={slettKolonne} onSetExtra={setExtraVerdi}/>
          </>
        )}
      </div>

      {importKategori && (
        <DTMImportModal kategori={importKategori} oppdragsSti={oppdragsSti} dokumenter={dokumenter}
          onLukk={() => setImportKategori(null)} onImporter={importer}/>
      )}

      {utsendingModalId && (() => {
        const u = utsendingar.find(x => x.id === utsendingModalId)
        if (!u) return null
        return (
          <DTMUtsendingModal utsending={u} dokumenter={dokumenter} oppdragsSti={oppdragsSti}
            onLukk={() => setUtsendingModalId(null)}
            onOppdater={(felt, verdi) => oppdaterUtsendingFelt(u.id, felt, verdi)}
            onLeggTilDokument={(dokInfo) => leggTilDokumentIUtsending(u.id, dokInfo)}
            onFjernDokument={fjernDokumentFraUtsending}
            onApneEpost={() => apneEpostForUtsending(u.id)}
            onBekreftSendt={() => bekreftUtsendingSendt(u.id)}
            onLagreKvittering={(kjeldeSti) => lagreKvitteringForUtsending(u.id, kjeldeSti)}
            onApneKvittering={() => apneKvitteringForUtsending(u.id)}/>
        )
      })()}

      {utsendingarListeOpen && (
        <DTMUtsendingarListe utsendingar={utsendingar}
          onOpne={(id) => { setUtsendingModalId(id); setUtsendingarListeOpen(false) }}
          onSlett={slettUtsendingKladd}
          onLukk={() => setUtsendingarListeOpen(false)}/>
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
