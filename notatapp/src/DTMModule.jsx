import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './supabase'
import DTMTabell from './DTMTabell'
import DTMImportModal from './DTMImportModal'
import DTMUtsendingModal from './DTMUtsendingModal'
import DTMUtsendingarListe from './DTMUtsendingarListe'
import TegningslisteModal from './TegningslisteModal'
import DokumentleveranseplanModal from './DokumentleveranseplanModal'
import DTMUkjendeFilerVarsel from './DTMUkjendeFilerVarsel'
import LeveranseplanVindauge from './LeveranseplanVindauge'
import { hentNummerering, lagreNummerering, nyeLopenummer, lopenummerDelar } from './teikningsnummer'
import ResultatdokumentMobilListe from './ResultatdokumentMobilListe'
import SokeFelt from './SokeFelt'
import { KATEGORIAR, KATEGORI_LABEL, KATEGORI_FARGE, KATEGORI_MAPPE, løysAktivtSett, namnFraEpost,
  nesteUtsendingsnummer, utsendingsnrTekst, gjettMimeType, erPlanlagtUtanFil } from './dtmKonstantar'

const LEVERANSEPLAN_FARGE = '#0F766E'
// Kolonnar som er synlege som standard i Leveranseplan-fana (resten kan vises via «+ Kolonnar»).
const LEVERANSEPLAN_KOLONNAR = ['nr', 'tittel', 'delprosjekt', 'malestokk', 'fag', 'fase', 'status', 'format',
  'planlagt_prosjekteringsunderlag', 'sendt_prosjekteringsunderlag', 'planlagt_godkjenning', 'sendt_godkjenning',
  'planlagt_arbeidstegning', 'sendt_arbeidstegning', 'planlagt_som_bygd', 'sendt_som_bygd']

// ── Ignorerte ukjende filer (sjå skannUkjendeFiler/DTMUkjendeFilerVarsel) ──
// Rein klient-bekvemmelegheit i localStorage, PER PROSJEKT — ikkje noko
// brukar treng synkronisert mellom maskiner, berre eit «ikkje spør om
// akkurat denne fila att»-val. Same les/skriv-mønster som alle andre
// localStorage-bruk elles i appen (t.d. TegningslisteModal sitt vindauge).
function lesIgnorerte(prosjektId) {
  try { return new Set(JSON.parse(localStorage.getItem(`liedlab-dtm-ignorerte-filer:${prosjektId}`)) || []) }
  catch { return new Set() }
}
function skrivIgnorerte(prosjektId, sett) {
  try { localStorage.setItem(`liedlab-dtm-ignorerte-filer:${prosjektId}`, JSON.stringify([...sett])) }
  catch { /* privat modus */ }
}

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
  // Prosjektnummeret vert lese FERSKT her (same query som `details`), IKKJE
  // frå den delte `projects`-lista (App.jsx/useStore) — den vert berre
  // henta éin gong ved appstart og ProsjektModule.jsx synkroniserer ALDRI
  // endringar attende dit etter lagring, så eit nyleg innskrive prosjekt-
  // nummer synte seg blankt her (brukar sitt eige krav 30. sept. 2026).
  const [prosjektnrFriskt, setProsjektnrFriskt] = useState('')
  const [loading, setLoading]     = useState(true)
  const [dokumenter, setDokumenter] = useState([])
  const [eigneKolonnar, setEigneKolonnar] = useState([])
  const [aktivtSett, setAktivtSett] = useState('alle')
  const [importKategori, setImportKategori] = useState(null) // kategori-nøkkel eller null (modal lukka)
  const [importMenyOpen, setImportMenyOpen] = useState(false)
  const [valde, setValde] = useState(() => new Set()) // fleirval (shift/ctrl-klikk), sjå DataTabell sin `merking`-prop
  const importMenyRef = useRef(null)
  const [eksportMenyOpen, setEksportMenyOpen] = useState(false)
  const eksportMenyRef = useRef(null)
  const [utsendingar, setUtsendingar] = useState([])
  const [utsendingModalId, setUtsendingModalId] = useState(null) // id eller null (lukka)
  const [utsendingarListeOpen, setUtsendingarListeOpen] = useState(false)
  const [tegningslisteOpen, setTegningslisteOpen] = useState(false)
  const [leveranseplanOpen, setLeveranseplanOpen] = useState(false)
  const [planleggerOpen, setPlanleggerOpen] = useState(false) // «Leveranseplan»-vindauget (teikningsforslag)
  // Ukjende filer (sjå skannUkjendeFiler under) — filer som ligg i DTM-
  // mappene, men ikkje er registrerte i nokon dtm_dokumenter-rad.
  const [ukjendeFiler, setUkjendeFiler] = useState([]) // [{kategori, filnamn}]
  const [ukjendeFilerVarselOpen, setUkjendeFilerVarselOpen] = useState(false)
  // Sett når brukar vel «Registrer…» for éin kategori i varselet — opnar
  // DTMImportModal med `forhandsvalde` (same import-flyt som vanleg).
  const [ukjendeFilerForImport, setUkjendeFilerForImport] = useState(null) // { kategori, filPathar } | null

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
      supabase.from('projects').select('details, project_number').eq('id', activeProjectId).eq('user_id', userId).single(),
      supabase.from('dtm_dokumenter').select('*').eq('project_id', activeProjectId).eq('user_id', userId).order('nr'),
      supabase.from('dtm_columns').select('*').eq('project_id', activeProjectId).eq('user_id', userId).order('sortering'),
      supabase.from('dtm_utsendingar').select('*').eq('project_id', activeProjectId).eq('user_id', userId).order('created_at', { ascending:false }),
      supabase.from('dtm_utsending_dokument').select('*').eq('user_id', userId),
    ])
    setDetails(pData?.details || {})
    setProsjektnrFriskt(pData?.project_number || '')
    setDokumenter(dData || [])
    setEigneKolonnar((colData || []).map(k => ({ key:k.key, label:k.label, art:k.art || 'tekst', val:k.val_liste || undefined })))
    const udPerUtsending = {}
    ;(udData || []).forEach(ud => { (udPerUtsending[ud.utsending_id] ??= []).push(ud) })
    setUtsendingar((uData || []).map(u => ({ ...u, dokument: udPerUtsending[u.id] || [] })))
    setLoading(false)

    // Skann etter ukjende filer (sjå claude/dtm-modul.md, «Ukjende filer»)
    // — KØYRER I BAKGRUNNEN (ikkje avventa), skal ikkje forsinke sjølve
    // tabellvisinga. Brukar LOKALE variablar (pData/dData), ikkje
    // komponenten sin `details`/`dokumenter`-state, sidan dei ikkje er
    // oppdaterte før neste render.
    const laastNo = !!(pData?.details?.oppdragsStiLast && pData?.details?.oppdragsSti)
    skannUkjendeFiler(laastNo ? pData.details.oppdragsSti : '', dData || [])
  }, [userId, activeProjectId])

  // Listar gjeldande filer i KVAR kategorimappe (gjenbruker same
  // `dtmListFiler`-kallet som Tegningsliste alt brukar til revisjons-
  // forslaget) og samanliknar mot kva filnamn som ALT er registrerte i
  // `dokumenterLokal` — resten er «ukjende», altså lagt inn utanom Import-
  // knappen. `.dtm-*`-filene er interne status-/snapshot-filer (sjå
  // TegningslisteModal.jsx), ALDRI dokument — hoppa over her.
  const skannUkjendeFiler = useCallback(async (oppdragsStiLokal, dokumenterLokal) => {
    if (!harBru || !oppdragsStiLokal) { setUkjendeFiler([]); return }
    const ignorerte = lesIgnorerte(activeProjectId)
    const funne = []
    for (const kategori of KATEGORIAR) {
      const kjende = new Set(dokumenterLokal.map(d => d[kategori]?.filnamn).filter(Boolean))
      // Excel-eksport (Tegningsliste/Dokumentleveranseplan) ligg ved sida av
      // den registrerte PDF-en med same namn — reknast som kjend, sjå
      // registrerGenerertFil.
      const kjendeStammar = new Set([...kjende].map(n => n.replace(/\.[^.]+$/, '').toLowerCase()))
      let svar
      try { svar = await window.resultatdokumentAPI.dtmListFiler(oppdragsStiLokal, kategori) }
      catch { continue }
      for (const f of (svar?.filer || [])) {
        if (f.namn.startsWith('.dtm-')) continue
        if (kjende.has(f.namn)) continue
        if (/\.xlsx?$/i.test(f.namn) && kjendeStammar.has(f.namn.replace(/\.[^.]+$/, '').toLowerCase())) continue
        if (ignorerte.has(`${kategori}:${f.namn}`)) continue
        funne.push({ kategori, filnamn: f.namn })
      }
    }
    setUkjendeFiler(funne)
  }, [harBru, activeProjectId])

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
  // «leveranseplan» er eit eige filter ved sida av kategoriane: rader som kom
  // frå Leveranseplan-vindauget (i_leveranseplan), og SOM STANDARD berre dei som
  // endå ikkje har fått ei faktisk fil (brukar sitt krav 8. okt. 2026) —
  // «Vis også leverte» tek dei med.
  const [visLeverte, setVisLeverte] = useState(false)
  const [sisteLopenr, setSisteLopenr] = useState(null) // { endringar:[{id,gammal,ny}] } — grunnlag for «Angre løpenummer»
  useEffect(() => { setSisteLopenr(null) }, [activeProjectId]) // angre-grunnlaget gjeld berre prosjektet det vart gjort i
  const synlegeDokument = useMemo(
    () => aktivtSett === 'alle' ? dokumenter
      : aktivtSett === 'leveranseplan' ? dokumenter.filter(d => d.i_leveranseplan && (visLeverte || erPlanlagtUtanFil(d)))
      : dokumenter.filter(d => d[aktivtSett]),
    [dokumenter, aktivtSett, visLeverte])

  const tal = useCallback(k => dokumenter.filter(d => d[k]).length, [dokumenter])
  const talLeveranseplan = useMemo(() => dokumenter.filter(d => d.i_leveranseplan && erPlanlagtUtanFil(d)).length, [dokumenter])
  const talLeveranseplanAlle = useMemo(() => dokumenter.filter(d => d.i_leveranseplan).length, [dokumenter])

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

  useEffect(() => {
    if (!eksportMenyOpen) return
    const lukk = (e) => { if (!eksportMenyRef.current?.contains(e.target)) setEksportMenyOpen(false) }
    document.addEventListener('mousedown', lukk)
    return () => document.removeEventListener('mousedown', lukk)
  }, [eksportMenyOpen])

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
    const no = new Date().toISOString()
    // `updated_at` må setjast i BÅDE den optimistiske lokale state-
    // oppdateringa OG sjølve databaseskrivinga — elles ser resten av UI-en
    // (t.d. Tegningsliste sin «endra sidan sist»-sjekk) framleis den GAMLE
    // updated_at-verdien heilt til neste fulle innlasting, sidan `dokumenter`
    // i denne komponenten aldri vert henta på nytt etter ei enkelt celle-
    // redigering (brukar sitt eige krav 30. sept. 2026 — same feil retta i
    // dei tre andre skrivefunksjonane under).
    setDokumenter(ds => ds.map(x => x.id === id ? { ...x, ekstra: neste, updated_at: no } : x))
    await supabase.from('dtm_dokumenter').update({ ekstra: neste, updated_at: no }).eq('id', id).eq('user_id', userId)
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

  // «Kategori» er kva av dei fire kategori-slotta (arbeidsdokument/
  // resultatdokument/kontrolldokument/styrande_dokument) som er den
  // GJELDANDE for rada — å endre han FLYTTAR sjølve metadata-objektet
  // (filnamn/revisjon/dato/lasta_opp) frå det gamle til det nye slottet.
  // IKKJE den fysiske fila på disken, som vert liggjande urørt i den
  // opphavlege kategorimappa — brukar må evt. importere på nytt i rett
  // kategori om filplasseringa òg skal rettast. Sjå claude/dtm-modul.md.
  const settKategori = async (id, nyLabel) => {
    const d = dokumenter.find(x => x.id === id)
    if (!d) return
    const gammalSett = løysAktivtSett(d, aktivtSett)
    const nyttSett = KATEGORIAR.find(k => KATEGORI_LABEL[k] === nyLabel)
    if (!gammalSett || !nyttSett || gammalSett === nyttSett) return
    if (d[nyttSett]) {
      alert(`Dokumentet har alt eit aktivt «${KATEGORI_LABEL[nyttSett]}»-dokument — fjern det derifrå fyrst, eller importer på nytt i rett kategori.`)
      return
    }
    const endring = { [gammalSett]: null, [nyttSett]: d[gammalSett] }
    const no = new Date().toISOString()
    setDokumenter(ds => ds.map(x => x.id === id ? { ...x, ...endring, updated_at: no } : x))
    const { error } = await supabase.from('dtm_dokumenter').update({ ...endring, updated_at: no }).eq('id', id).eq('user_id', userId)
    if (error) {
      alert('Klarte ikkje endre kategori: ' + error.message)
      setDokumenter(ds => ds.map(x => x.id === id ? { ...x, [gammalSett]: d[gammalSett], [nyttSett]: d[nyttSett] ?? null } : x))
    }
  }

  const settVerdi = async (id, felt, verdi) => {
    if (felt === 'kategori') { await settKategori(id, verdi); return }

    if (NØSTA_FELT[felt]) {
      const d = dokumenter.find(x => x.id === id)
      const sett = d && løysAktivtSett(d, aktivtSett)
      if (!sett) return
      const gammalSettVerdi = d[sett] || {}
      const nyttSett = { ...gammalSettVerdi, [NØSTA_FELT[felt]]: verdi }
      const no = new Date().toISOString()
      setDokumenter(ds => ds.map(x => x.id === id ? { ...x, [sett]: nyttSett, updated_at: no } : x))
      const { error } = await supabase.from('dtm_dokumenter').update({ [sett]: nyttSett, updated_at: no }).eq('id', id).eq('user_id', userId)
      if (error) {
        alert('Klarte ikkje lagre endringa: ' + error.message)
        setDokumenter(ds => ds.map(x => x.id === id ? { ...x, [sett]: gammalSettVerdi } : x))
      }
      return
    }

    // «nr» (dokumentnummer) er no òg redigerbar (brukar sitt krav 26. sept.
    // 2026: «kan potensielt vere feil») — men har ein UNIK-indeks per
    // prosjekt (user_id, project_id, nr), så eit duplikat gjev ein ekte
    // databasefeil me må fange og melde tydeleg, ikkje berre la forsvinne.
    const gammalRad = dokumenter.find(x => x.id === id)
    const lagra = NUMERISKE_FELT.has(felt) && verdi === '' ? null : verdi
    const no = new Date().toISOString()
    setDokumenter(ds => ds.map(d => d.id === id ? { ...d, [felt]: lagra, updated_at: no } : d))
    const { error } = await supabase.from('dtm_dokumenter').update({ [felt]: lagra, updated_at: no }).eq('id', id).eq('user_id', userId)
    if (error) {
      const melding = felt === 'nr' && /duplicate key|unique constraint/i.test(error.message)
        ? `Dokumentnummeret «${verdi}» er alt i bruk av eit anna dokument i dette prosjektet.`
        : 'Klarte ikkje lagre endringa: ' + error.message
      alert(melding)
      if (gammalRad) setDokumenter(ds => ds.map(x => x.id === id ? { ...x, [felt]: gammalRad[felt] } : x))
    }
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

  // ── Søk (SokeFelt, sjå claude/sok-modul.md) — eit treff kan liggje i
  // ein ANNA kategori-fane enn den som er aktiv no, difor løyser denne
  // BEST kategori direkte (som 'alle'-visinga) i staden for å stole på
  // gjeldande aktivtSett-state, og byter sjølv til 'alle' etterpå.
  const sokVelgResultat = (r) => {
    if (r.kjelde_tabell !== 'dtm_dokumenter') return
    const rad = dokumenter.find(d => d.id === r.kjelde_id)
    if (!rad) return
    const sett = løysAktivtSett(rad, 'alle')
    setAktivtSett('alle')
    if (!sett || !rad[sett]?.filnamn || !harBru) return
    window.resultatdokumentAPI.dtmApneFil(oppdragsSti, sett, rad[sett].filnamn, false)
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
  // Skyopplasting av resultatdokument (sjå claude/dtm-modul.md) — berre
  // når prosjektet sjølv har slått dette PÅ (brukar sitt eige krav
  // 1. okt. 2026: av/på-bryter per prosjekt, IKKJE automatisk for alle).
  // Feilar ALDRI heile importen om opplastinga skulle mislykkast (nettverk
  // nede o.l.) — berre ein konsoll-åtvaring, sidan sjølve fila alt ligg
  // trygt lokalt uansett.
  const lastOppResultatdokumentTilSky = async (nr, filnamn) => {
    try {
      const b64 = await window.resultatdokumentAPI.dtmLesFilBytes(oppdragsSti, 'resultatdokument', filnamn)
      if (!b64) return
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
      const ext = (/\.([a-z0-9]+)$/i.exec(filnamn)?.[1] || 'bin').toLowerCase()
      const sti = `${userId}/${activeProjectId}/${nr}.${ext}`
      const { error } = await supabase.storage.from('dtm-resultatdokument')
        .upload(sti, bytes, { upsert: true, contentType: gjettMimeType(filnamn) })
      if (error) console.warn('[DTM] Klarte ikkje laste opp resultatdokument til skya:', error.message)
    } catch (e) {
      console.warn('[DTM] Klarte ikkje laste opp resultatdokument til skya:', e.message)
    }
  }

  // Etterfyller skya med resultatdokument som alt fanst FØR Skyopplasting
  // vart slått på for prosjektet (eller frå før funksjonen vart bygd) —
  // utan denne ville dei vore usynlege frå mobil heilt til nokon tilfeldigvis
  // importerte dei på nytt. Manuell, synleg knapp (sjå toolbar) i staden for
  // ein stille automatikk, sidan dette kan vere mange filer/ta ei stund.
  const [skyBackfillKjorer, setSkyBackfillKjorer] = useState(false)
  const lastOppAlleResultatdokumentTilSky = async () => {
    if (!harBru || !details?.skyOpplastingResultatdokument || skyBackfillKjorer) return
    setSkyBackfillKjorer(true)
    for (const d of dokumenter) {
      if (d.resultatdokument?.filnamn) await lastOppResultatdokumentTilSky(d.nr, d.resultatdokument.filnamn)
    }
    setSkyBackfillKjorer(false)
  }

  // Kalla frå DTMImportModal etter at brukar har retta/fjerna dokument i
  // gjennomgangsmatrisa. Sjå claude/dtm-modul.md, avsnittet om
  // importflyten, for den fulle regelen. `opts.kategori` (sett av
  // DTMImportModal sin bekreft()) vinn over `importKategori`-state — treng
  // det for «ukjende filer»-registrering, som ikkje går via det vanlege
  // import-menyvalet (sjå ukjendeFilerForImport).
  const importer = async (rader, opts = {}) => {
    const kategori = opts.kategori ?? importKategori
    const brukAI = !!opts.brukAI
    const skalLastOppTilSky = kategori === 'resultatdokument' && harBru && !!details?.skyOpplastingResultatdokument
    const filResultat = await window.resultatdokumentAPI.dtmBekreftImport(
      oppdragsSti, kategori,
      rader.map(r => {
        const gammalKategoriVerdi = dokumenter.find(d => d.nr === r.nr)?.[kategori]
        return {
          kjeldeSti: r.kjeldeSti, nr: r.nr, rev: r.rev, tittel: r.tittel,
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
          ferdigstillingsstatus: r.ferdigstillingsstatus || '', forste_revisjon_dato: r.forste_revisjon_dato || '',
          ekstern_kategori: r.ekstern_kategori || '', er_styrande_dokument: false,
          ai_indeksering_onska: brukAI,
          lagra_av: namnFraEpost(userEmail), status: [], ekstra: {}, favorite: false, pinned: false,
          arbeidsdokument: null, resultatdokument: null, kontrolldokument: null, styrande_dokument: null,
          eksternt_dokument: null,
          created_at: no, updated_at: no,
          [kategori]: kategoriVerdi,
        }
        const { error } = await supabase.from('dtm_dokumenter').insert(rad)
        if (error) { resultat.push({ status:'feil', nr:r.nr, filnamn:f.filnamn, melding: error.message }); continue }
        nyeDokument = [...nyeDokument, rad]
        resultat.push({ status:'ok', nr:r.nr, filnamn:f.filnamn })
        if (skalLastOppTilSky) await lastOppResultatdokumentTilSky(r.nr, f.filnamn)
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
          ekstern_kategori: r.ekstern_kategori || gammalRad.ekstern_kategori,
          // Fyrste-revisjon-datoen skal ALDRI skrivast over av ein seinare
          // re-import — han representerer den opphavlege, historiske datoen.
          forste_revisjon_dato: gammalRad.forste_revisjon_dato || r.forste_revisjon_dato || '',
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
        if (skalLastOppTilSky) await lastOppResultatdokumentTilSky(r.nr, f.filnamn)
        resultat.push({ status:'ok', nr:r.nr, filnamn:f.filnamn })
      }
    }

    setDokumenter(nyeDokument)
    return resultat
  }

  // Opprettar PLANLAGDE dokument-rader (utan fil, alle kategori-felt null) frå
  // Leveranseplan-vindauget. Når den ferdige fila seinare vert importert med
  // same dokumentnummer, finn importer() den eksisterande rada (match på nr)
  // og fyller inn fila — ingen eigen kopling trengst. Rader med nummer som alt
  // finst er filtrerte bort av vindauget; dobbeltsjekk her likevel.
  const lagreProsjektNummerering = async (n) => {
    setDetails(x => ({ ...(x || {}), nummerering: n }))
    try { await lagreNummerering(supabase, activeProjectId, userId, n) }
    catch (e) { alert('Klarte ikkje lagre nummereringsoppsettet: ' + e.message) }
  }

  // Tom rad UTAN fil (alle kategori-felt null) med alle standardfelt — felles for
  // Leveranseplan-vindauget, «Legg til rad» og «Dupliser rad» (radmenyen).
  const lagPlanRad = (felt, id) => {
    const no = new Date().toISOString()
    return {
      id, user_id: userId, project_id: activeProjectId, nr: '', tittel: '',
      fag: '', fase: '', delprosjekt: '', malestokk: '', format: '',
      utarbeida_av: '', ek_person: '', fk_person: '', godkjent_av: '', oppdragsgivar: '', tiltakshavar: '',
      oppdragsnr: '', revisjonsbeskriving: '', tegningsformal: '', ferdigstillingsstatus: '', forste_revisjon_dato: '',
      ekstern_kategori: '', er_styrande_dokument: false, ai_indeksering_onska: false, i_leveranseplan: true,
      lagra_av: namnFraEpost(userEmail), status: [], ekstra: {}, favorite: false, pinned: false,
      arbeidsdokument: null, resultatdokument: null, kontrolldokument: null, styrande_dokument: null, eksternt_dokument: null,
      rekkefolge: null,
      created_at: no, updated_at: no, ...felt,
    }
  }

  const opprettPlanlagdeDokument = async (nye, { fase, fag }) => {
    const finst = new Set(dokumenter.map(d => d.nr.toUpperCase()))
    const base = Date.now()
    const rader = nye.filter(n => n.nr && !finst.has(n.nr.toUpperCase())).map((n, i) => lagPlanRad({
      nr: n.nr, tittel: n.tittel || n.nr, fag: fag || '', fase: fase || '', delprosjekt: n.bygg || '', malestokk: n.malestokk || '',
    }, base + i))
    if (!rader.length) return { opprettet: 0 }
    const { error } = await supabase.from('dtm_dokumenter').insert(rader)
    if (error) throw new Error('Klarte ikkje opprette dokumenta: ' + error.message)
    setDokumenter(ds => [...ds, ...rader])
    return { opprettet: rader.length }
  }

  // ── Fast rekkjefølgje (dra rader i tabellen) ───────────────────────────
  // Rekkjefølgja ligg i dtm_dokumenter.rekkefolge (flyttal, supabase-dtm.sql). Å flytte éi rad set
  // berre denne eine verdien (midt mellom naboane); «frys»/omnummerering set 1000, 2000 … på alle viste.
  const settRekkefolgjeAlle = async (raderIOrden) => {
    const nye = raderIOrden.map((r, i) => ({ id: r.id, verdi: (i + 1) * 1000 }))
      .filter(x => dokumenter.find(d => d.id === x.id)?.rekkefolge !== x.verdi)
    if (!nye.length) return
    const kart = new Map(nye.map(x => [x.id, x.verdi]))
    setDokumenter(ds => ds.map(d => (kart.has(d.id) ? { ...d, rekkefolge: kart.get(d.id) } : d)))
    for (let i = 0; i < nye.length; i += 20) {
      const svar = await Promise.all(nye.slice(i, i + 20).map(x =>
        supabase.from('dtm_dokumenter').update({ rekkefolge: x.verdi }).eq('id', x.id).eq('user_id', userId)))
      const feil = svar.find(s => s.error)?.error
      if (feil) { alert('Klarte ikkje lagre rekkjefølgja: ' + feil.message + ' (er migrasjonen for kolonna «rekkefolge» køyrd?)'); return }
    }
  }
  const flyttRad = async (id, verdi) => {
    setDokumenter(ds => ds.map(d => (d.id === id ? { ...d, rekkefolge: verdi } : d)))
    const { error } = await supabase.from('dtm_dokumenter').update({ rekkefolge: verdi }).eq('id', id).eq('user_id', userId)
    if (error) alert('Klarte ikkje lagre rekkjefølgja: ' + error.message)
  }

  // ── Radmenyen: «Slett» ──────────────────────────────────────────────────
  // Slettar rada(ne) frå REGISTERET. Er fleire rader markerte og den du klikka på er
  // ei av dei, vert alle markerte sletta. Filer på disken vert ALDRI rørte.
  const slettRad = (id) => slettRader(valde.has(id) && valde.size > 1 ? [...valde] : [id])
  const slettRader = async (ider) => {
    const rader = dokumenter.filter(d => ider.includes(d.id))
    if (!rader.length) return
    const medFil = rader.filter(d => !erPlanlagtUtanFil(d)).length
    const nrListe = rader.slice(0, 6).map(d => d.nr).join(', ') + (rader.length > 6 ? ' … (+' + (rader.length - 6) + ')' : '')
    const melding = 'Slette ' + (rader.length === 1 ? 'denne raden' : 'desse ' + rader.length + ' radene') + ' frå DTM-registeret?\n\n' + nrListe + '\n\n' +
      (medFil ? medFil + ' av dei har ei registrert fil: filene på disken vert IKKJE sletta, men versjonshistorikk og kontrollsvar for dokumenta forsvinn.\n\n' : '') +
      'Dette kan ikkje angrast.'
    if (!window.confirm(melding)) return
    const { error } = await supabase.from('dtm_dokumenter').delete().in('id', ider).eq('user_id', userId)
    if (error) { alert('Klarte ikkje slette: ' + error.message); return }
    setDokumenter(ds => ds.filter(d => !ider.includes(d.id)))
    setValde(new Set())
  }

  // ── Radmenyen: «Generer ny løpenummer etter vist rekkefølge» ───────────────
  // Berre for dokument UTAN fil (planlagde rader). Dei markerte radene får fortløpande
  // løpenummer (per type/etasje/bygg-gruppe) i den rekkjefølgja tabellen viser dei, etter
  // prosjektet sitt nummereringsoppsett. «Angre løpenummer» set dei førre nummera tilbake.
  const oppdaterNummer = async (par) => {
    // To steg (fyrst mellombels unike nummer, så dei endelege) — elles ville ei omrokkering
    // brote UNIQUE (brukar, prosjekt, nr) midt i køyringa.
    const no = new Date().toISOString()
    const set = async (liste, fra) => {
      const svar = await Promise.all(liste.map(p => supabase.from('dtm_dokumenter')
        .update({ nr: fra(p), updated_at: no }).eq('id', p.id).eq('user_id', userId)))
      const feil = svar.find(s => s.error)?.error
      if (feil) throw new Error(feil.message)
    }
    await set(par, p => '~' + p.id + '~')
    try { await set(par, p => p.til) }
    catch (e) { try { await set(par, p => p.fra) } catch { /* beste forsøk */ } throw e }
    const kart = new Map(par.map(p => [p.id, p.til]))
    setDokumenter(ds => ds.map(d => (kart.has(d.id) ? { ...d, nr: kart.get(d.id), updated_at: no } : d)))
  }

  const genererLopenummer = async (synlegeRader) => {
    const cfg = hentNummerering(details)
    if (!cfg.medLopenummer) { alert('Prosjektet er sett opp UTAN løpenummer (Prosjekt → Teikningsnummerering), så det finst ikkje noko løpenummer å generere.'); return }
    const markerte = (synlegeRader || []).filter(d => valde.has(d.id))
    if (markerte.length < 2) { alert('Marker to eller fleire rader fyrst (kryssboksen til venstre for rada).'); return }
    const utanFil = markerte.filter(erPlanlagtUtanFil)
    if (!utanFil.length) { alert('Løpenummer kan berre genererast på nytt for dokument som ikkje har ei lasta opp fil enno — ingen av dei markerte er slike.'); return }
    const anna = new Set(dokumenter.filter(d => !utanFil.some(u => u.id === d.id)).map(d => d.nr))
    const res = nyeLopenummer(utanFil.map(d => ({ id: d.id, nr: d.nr })), anna, cfg)
    if (!res.endringar.length) {
      alert('Ingen endringar trengst: nummera ligg alt fortløpande i vist rekkefølge' + (res.hoppaOver.length ? ', og ' + res.hoppaOver.length + ' rad(er) har nummer som ikkje følgjer nummereringsoppsettet.' : '.'))
      return
    }
    const dome = res.endringar.slice(0, 4).map(e => e.gammal + '  →  ' + e.ny).join('\n')
    const merk = [
      markerte.length > utanFil.length ? (markerte.length - utanFil.length) + ' markert(e) rad(er) har fil og vert ikkje rørte.' : '',
      res.hoppaOver.length ? res.hoppaOver.length + ' rad(er) har nummer som ikkje følgjer oppsettet og vert ikkje rørte.' : '',
    ].filter(Boolean).join('\n')
    if (!window.confirm('Gje ' + res.endringar.length + ' rad(er) nye løpenummer etter vist rekkefølge?\n\n' + dome + (res.endringar.length > 4 ? '\n…' : '') + (merk ? '\n\n' + merk : '') + '\n\nDu kan angre med «Angre løpenummer».')) return
    try {
      await oppdaterNummer(res.endringar.map(e => ({ id: e.id, fra: e.gammal, til: e.ny })))
      setSisteLopenr({ endringar: res.endringar })
    } catch (e) { alert('Klarte ikkje endre nummera: ' + e.message) }
  }

  const angreLopenummer = async () => {
    if (!sisteLopenr) return
    try {
      await oppdaterNummer(sisteLopenr.endringar.map(e => ({ id: e.id, fra: e.ny, til: e.gammal })))
      setSisteLopenr(null)
    } catch (e) { alert('Klarte ikkje angre (nummera er kanskje endra sidan): ' + e.message) }
  }

  // ── Radmenyen: «Legg til rad» / «Dupliser rad» ──────────────────────────
  // Begge lagar ei rad utan fil (ei planlagd oppføring, same som frå Leveranseplan)
  // som brukar så rettar i tabellen. Ei rad utan kategori vert berre synleg i
  // «Alle dokumenter»/«Leveranseplan», så frå ei kategori-fane byter vi til «Alle».
  const ledigNr = (ynskja) => {
    const finst = new Set(dokumenter.map(d => d.nr.toUpperCase()))
    if (!finst.has(ynskja.toUpperCase())) return ynskja
    for (let i = 2; ; i++) { const k = `${ynskja} (${i})`; if (!finst.has(k.toUpperCase())) return k }
  }
  const settInnPlanrad = async (rad) => {
    const { error } = await supabase.from('dtm_dokumenter').insert(rad)
    if (error) { alert('Klarte ikkje opprette raden: ' + error.message); return }
    setDokumenter(ds => [...ds, rad])
    setValde(new Set([rad.id]))
    if (aktivtSett !== 'alle' && aktivtSett !== 'leveranseplan') setAktivtSett('alle')
  }
  const leggTilRad = async () => {
    let n = 1
    while (dokumenter.some(d => d.nr.toUpperCase() === `NY-${String(n).padStart(3, '0')}`)) n++
    await settInnPlanrad(lagPlanRad({ nr: `NY-${String(n).padStart(3, '0')}`, tittel: 'Ny oppføring' }, Date.now()))
  }
  const dupliserRad = async (id) => {
    const d = dokumenter.find(x => x.id === id)
    if (!d) return
    const kopi = {}
    for (const k of ['fag', 'fase', 'delprosjekt', 'malestokk', 'format', 'utarbeida_av', 'ek_person', 'fk_person', 'godkjent_av',
      'oppdragsgivar', 'tiltakshavar', 'oppdragsnr', 'revisjonsbeskriving', 'tegningsformal', 'ferdigstillingsstatus',
      'ekstern_kategori']) kopi[k] = d[k] || ''
    // planlagde datoar vert med, «sendt»-hakar og filer gjer det ikkje
    for (const k of Object.keys(d)) if (k.startsWith('planlagt_')) kopi[k] = d[k] || ''
    // Nytt dokumentnummer = NESTE LEDIGE løpenummer etter originalen (A-40-00-02 → A-40-00-03), etter
    // prosjektet sitt nummereringsoppsett; følgjer ikkje nummeret oppsettet, vert det «<nr> (kopi)».
    let nyttNr = null
    const p = lopenummerDelar(d.nr, hentNummerering(details))
    if (p) {
      const finst = new Set(dokumenter.map(x => x.nr.toUpperCase()))
      const breidd = Math.max(2, p.lopenr.length)
      for (let n = parseInt(p.lopenr, 10) + 1; n < 1000; n++) {
        const dl = [...p.delar]; dl[p.idx] = String(n).padStart(breidd, '0')
        const kand = dl.join('-')
        if (!finst.has(kand.toUpperCase())) { nyttNr = kand; break }
      }
    }
    if (!nyttNr) nyttNr = ledigNr(`${d.nr} (kopi)`)
    const namn = d.tittel || d.nr
    const tittel = /\(kopi\)\s*$/i.test(namn) ? namn : `${namn} (kopi)`
    // I fast rekkjefølgje: rett etter originalen
    let rek = null
    if (d.rekkefolge != null) {
      const storre = dokumenter.map(x => x.rekkefolge).filter(v => v != null && v > d.rekkefolge)
      rek = storre.length ? (d.rekkefolge + Math.min(...storre)) / 2 : d.rekkefolge + 1000
    }
    await settInnPlanrad(lagPlanRad({ ...kopi, nr: nyttNr, tittel, rekkefolge: rek, ekstra: { ...(d.ekstra || {}) } }, Date.now()))
  }

  // Indekserer ei fil APPEN SJØLV nett genererte i ei DTM-kategorimappe
  // (Tegningsliste/Dokumentleveranseplan, PDF eller Excel) i registeret på
  // éin gong — elles ville ho dukke opp som «ukjend fil» ved neste skanning
  // (brukar sitt krav 2. okt. 2026). Går via same importer() som vanleg
  // import, så eit tidlegare registrert utkast av same dokumentnummer vert
  // arkivert, versjonert og (om skyopplasting er på) lasta opp likt.
  const registrerGenerertFil = async ({ kategori, filnamn, filSti, nr, tittel, rev, dato, format }) => {
    const stamme = (n) => n.replace(/\.[^.]+$/, '').toLowerCase()
    const finst = dokumenter.find(d => d.nr === nr)
    // Excel-eksport ved sida av ein ALT registrert PDF med same namn: ikkje
    // registrer på nytt (ville arkivert PDF-en) — skanninga reknar han som
    // kjend via namne-stamma, sjå skannUkjendeFiler.
    if (/\.xlsx?$/i.test(filnamn) && finst?.[kategori]?.filnamn && stamme(finst[kategori].filnamn) === stamme(filnamn)) return
    await importer([{ kjeldeSti: filSti, filnamn, nr, rev: String(rev || ''), tittel: tittel || nr, dato: dato || '', format: format || '' }],
      { kategori })
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>

      {/* Topbar */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 16px', flexWrap:'wrap',
        minHeight:50, flexShrink:0, background:'var(--brand)', borderBottom:'1px solid rgba(255,255,255,.1)' }}>
        <span style={{ fontSize:15, fontWeight:800, color:'#fff', letterSpacing:'-0.02em' }}>
          Dokument, tegningar og modellar (DTM)
        </span>
        {/* Prosjektnummer/-namn er fjerna her (står alt i den svarte topplinja) —
            søket tek plassen, til høgre for overskrifta (brukar sitt krav 2. okt. 2026) */}
        {aktivtProsjekt && (
          <div style={{ marginLeft:8 }}>
            <SokeFelt projectId={activeProjectId} kjelder={['dtm_dokumenter']}
              onVelgResultat={sokVelgResultat} plassholder="Søk i DTM-dokument…"/>
          </div>
        )}
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
            {/* Eksport — nedtrekksmeny rett til høgre for Import (brukar sitt krav
                2. okt. 2026, for å rydde i layouten): Tegningsliste og Dokumentleveranseplan */}
            <div ref={eksportMenyRef} style={{ position:'relative' }}>
              <button onClick={() => setEksportMenyOpen(v => !v)}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:'var(--r)',
                  border:'1.5px solid var(--border)', background:'var(--bg2)', color:'var(--text2)',
                  fontSize:13, fontWeight:700, cursor:'pointer' }}>
                Eksport <span style={{ fontSize:10 }}>▾</span>
              </button>
              {eksportMenyOpen && (
                <div className="dt-meny" style={{ left:0, top:'calc(100% + 6px)', position:'absolute', width:220 }}>
                  <button type="button" className="dt-val"
                    onClick={() => { setTegningslisteOpen(true); setEksportMenyOpen(false) }}>
                    <span>Tegningsliste</span>
                  </button>
                  <button type="button" className="dt-val"
                    onClick={() => { setLeveranseplanOpen(true); setEksportMenyOpen(false) }}>
                    <span>Dokumentleveranseplan</span>
                  </button>
                </div>
              )}
            </div>
            <button onClick={() => setPlanleggerOpen(true)}
              title="Planlegg leveransar: legg inn bygg, få forslag til teikningar"
              style={{ padding:'9px 16px', borderRadius:'var(--r)', border:'1.5px solid #0F766E',
                background:'rgba(15,118,110,.10)', color:'#0F766E', fontSize:13, fontWeight:700, cursor:'pointer' }}>
              Leveranseplan
            </button>
            {sisteLopenr && (
              <button onClick={angreLopenummer}
                title="Set tilbake dei førre dokumentnummera"
                style={{ padding:'9px 16px', borderRadius:'var(--r)', border:'1.5px solid #0F766E',
                  background:'rgba(15,118,110,.10)', color:'#0F766E', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                ↶ Angre løpenummer ({sisteLopenr.endringar.length})
              </button>
            )}
            <button onClick={() => setUtsendingarListeOpen(true)}
              style={{ padding:'9px 16px', borderRadius:'var(--r)', border:'1.5px solid var(--border)',
                background:'var(--bg2)', color:'var(--text2)', fontSize:13, fontWeight:700, cursor:'pointer' }}>
              Utsendingar {utsendingar.filter(u => u.status !== 'sendt').length > 0
                && `(${utsendingar.filter(u => u.status !== 'sendt').length} kladd)`}
            </button>
            {ukjendeFiler.length > 0 && (
              <button onClick={() => setUkjendeFilerVarselOpen(true)}
                style={{ padding:'9px 16px', borderRadius:'var(--r)', border:'1.5px solid #B45309',
                  background:'rgba(180,83,9,.12)', color:'#B45309', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                ⚠ {ukjendeFiler.length} ukjende fil{ukjendeFiler.length === 1 ? '' : 'er'}
              </button>
            )}
            {details?.skyOpplastingResultatdokument && (
              <button onClick={lastOppAlleResultatdokumentTilSky} disabled={skyBackfillKjorer}
                title="Lastar opp ALLE resultatdokument på nytt — nyttig etter at Skyopplasting nett vart slått på"
                style={{ padding:'9px 16px', borderRadius:'var(--r)', border:'1.5px solid var(--border)',
                  background:'var(--bg2)', color:'var(--text2)', fontSize:13, fontWeight:700,
                  cursor: skyBackfillKjorer ? 'default' : 'pointer', opacity: skyBackfillKjorer ? .6 : 1 }}>
                {skyBackfillKjorer ? 'Lastar opp…' : '☁ Last opp alle resultatdokument'}
              </button>
            )}
          </div>
        )}

        {!aktivtProsjekt ? (
          <Melding tittel="Vel eit prosjekt" ikon="P">Vel eit prosjekt øvst i vindauget for å sjå DTM-registeret.</Melding>
        ) : loading ? (
          <div style={{ color:'var(--text3)', fontSize:13 }}>Lastar…</div>
        ) : !harBru ? (
          details?.skyOpplastingResultatdokument ? (
            <ResultatdokumentMobilListe dokumenter={dokumenter} userId={userId} activeProjectId={activeProjectId}/>
          ) : (
            <Melding tittel="Krev skrivebordsversjonen" ikon="Rd">
              DTM flyttar og omdøyper filer direkte på disken din, og det kan berre gjerast frå
              skrivebordsappen — ikkje frå nettlesar. Opne LiedLab via skrivebords-snarvegen for å
              bruke denne modulen. (Resultatdokument kan gjerast tilgjengelege her frå mobil —
              sjå «Skyopplasting» i Prosjekt-modulen på skrivebordet.)
            </Melding>
          )
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
              <button onClick={() => setAktivtSett('leveranseplan')}
                title="Planlagde leveransar frå Leveranseplan-vindauget — som standard berre dei som ikkje er levert (utan fil) enno"
                style={{ padding:'6px 13px', borderRadius:6, fontSize:12.5, fontWeight:700,
                  border:'1.5px solid', cursor:'pointer',
                  borderColor: aktivtSett === 'leveranseplan' ? LEVERANSEPLAN_FARGE : 'var(--border)',
                  background:  aktivtSett === 'leveranseplan' ? LEVERANSEPLAN_FARGE + '1a' : 'transparent',
                  color:       aktivtSett === 'leveranseplan' ? LEVERANSEPLAN_FARGE : 'var(--text3)' }}>
                Leveranseplan ({talLeveranseplan})
              </button>
              {aktivtSett === 'leveranseplan' && (
                <label style={{ display:'flex', alignItems:'center', gap:6, marginLeft:8, fontSize:12.5, color:'var(--text2)', cursor:'pointer' }}>
                  <input type="checkbox" checked={visLeverte} onChange={e => setVisLeverte(e.target.checked)}/>
                  Vis også leverte ({talLeveranseplanAlle - talLeveranseplan})
                </label>
              )}
            </div>

            <DTMTabell key={aktivtSett} dokumenter={synlegeDokument} aktivtSett={aktivtSett} eigneKolonnar={eigneKolonnar}
              standardSynlegeKolonnar={aktivtSett === 'leveranseplan' ? LEVERANSEPLAN_KOLONNAR : undefined}
              oppdragsSti={oppdragsSti} merking={{ valde, onEndre: setValde }}
              onSetVerdi={settVerdi} onOpneFil={(rad) => opneFil(rad)} onDelFil={delFil}
              onToggleFavorite={toggleFavorite} onTogglePinned={togglePinned}
              onRegistrerUtsending={registrerUtsending} onLeggTilRad={leggTilRad} onDupliserRad={dupliserRad} onSlettRad={slettRad} onNyLopenummer={genererLopenummer}
              radRekkjefolge={{ verdi: r => r.rekkefolge ?? null, onSettAlle: settRekkefolgjeAlle, onFlytt: flyttRad }}
              onSlettValde={() => slettRader([...valde])} utsendingarPerDokument={utsendingarPerDokument}
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
            onApneKvittering={() => apneKvitteringForUtsending(u.id)}
            onMarkerLevert={(dokumentId, faseKey, verdi) => settVerdi(dokumentId, `sendt_${faseKey}`, verdi)}/>
        )
      })()}

      {utsendingarListeOpen && (
        <DTMUtsendingarListe utsendingar={utsendingar}
          onOpne={(id) => { setUtsendingModalId(id); setUtsendingarListeOpen(false) }}
          onSlett={slettUtsendingKladd}
          onLukk={() => setUtsendingarListeOpen(false)}/>
      )}

      {tegningslisteOpen && (
        <TegningslisteModal dokumenter={synlegeDokument} aktivtSett={aktivtSett}
          aktivtProsjekt={aktivtProsjekt && { ...aktivtProsjekt, projectNumber: prosjektnrFriskt || aktivtProsjekt.projectNumber }}
          oppdragsgivar={details?.clientName} oppdragsSti={oppdragsSti}
          alleDokument={dokumenter} onGenerert={registrerGenerertFil}
          onLukk={() => setTegningslisteOpen(false)}/>
      )}

      {leveranseplanOpen && (
        <DokumentleveranseplanModal dokumenter={synlegeDokument} aktivtSett={aktivtSett}
          aktivtProsjekt={aktivtProsjekt && { ...aktivtProsjekt, projectNumber: prosjektnrFriskt || aktivtProsjekt.projectNumber }}
          oppdragsgivar={details?.clientName} oppdragsSti={oppdragsSti}
          alleDokument={dokumenter} onGenerert={registrerGenerertFil}
          onLukk={() => setLeveranseplanOpen(false)}/>
      )}

      {planleggerOpen && (
        <LeveranseplanVindauge dokumenter={dokumenter} aktivtProsjekt={aktivtProsjekt}
          nummerering={hentNummerering(details)} onLagreNummerering={lagreProsjektNummerering}
          onOpprett={opprettPlanlagdeDokument} onLukk={() => setPlanleggerOpen(false)}/>
      )}

      {ukjendeFilerVarselOpen && (
        <DTMUkjendeFilerVarsel funne={ukjendeFiler}
          onLukk={() => setUkjendeFilerVarselOpen(false)}
          onIgnorer={(kategori, filnamn) => {
            const sett = lesIgnorerte(activeProjectId)
            sett.add(`${kategori}:${filnamn}`)
            skrivIgnorerte(activeProjectId, sett)
            setUkjendeFiler(fs => fs.filter(f => !(f.kategori === kategori && f.filnamn === filnamn)))
          }}
          onImporter={(kategori, filer) => {
            setUkjendeFilerForImport({
              kategori,
              filPathar: filer.map(f => `${oppdragsSti}\\${KATEGORI_MAPPE[kategori]}\\${f.filnamn}`),
            })
            setUkjendeFilerVarselOpen(false)
          }}/>
      )}

      {ukjendeFilerForImport && (
        <DTMImportModal kategori={ukjendeFilerForImport.kategori} oppdragsSti={oppdragsSti}
          dokumenter={dokumenter} forhandsvalde={ukjendeFilerForImport.filPathar}
          onImporter={importer}
          onLukk={() => {
            setUkjendeFilerForImport(null)
            // Oppdater ukjende-filer-lista med det som faktisk vart registrert
            // (eller ikkje, om brukar avbraut) — `dokumenter` er alt oppdatert
            // her, sidan importer() sin setDokumenter() har rokke å flush-ast
            // før brukar fekk klikka «Lukk».
            skannUkjendeFiler(oppdragsSti, dokumenter)
          }}/>
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
