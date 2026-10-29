import { useState, useEffect, useCallback } from 'react'
import DatePicker from './DatePicker'
import { supabase } from './supabase'
import NummereringVal from './NummereringVal'
import PersonellSide from './PersonellSide'
import { leggTilMegSomPersonell, merkSeedet } from './personellStandard'
import { STANDARD_NUMMERERING } from './teikningsnummer'

// ── Konstantar ────────────────────────────────────────────────────────
const TILTAKSTYPAR = [
  'Nybygg','Påbygg/tilbygg','Mellombels bygning','Endring av fasade',
  'Innhegning mot veg','Oppretting/endring av matrikkeleining',
  'Anlegg','Skilt/reklame','Antennesystem','Riving','Bruksendring','Anna',
]

const KATEGORIAR = {
  'Bustad':       ['Einebustad','Tomannsbustad','Rekkjehus','Leilegheitsbygg','Fritidsbustad'],
  'Næring':       ['Kontor','Forretning','Hotell/overnatting','Industri/lager','Servering'],
  'Offentleg':    ['Skule/barnehage','Helseinstitusjon','Kulturbygg','Idrettsbygg','Kyrkje/forsamling'],
  'Infrastruktur':['Parkeringsanlegg','Teknisk bygg','Kai/hamn','Bru/tunnel'],
}

const STATUS_LABELS = {
  tilbod: 'Tilbod', sendt: 'Sendt', aktiv: 'Aktiv', tapt: 'Tapt', fullfort: 'Fullført',
}
const STATUS_COLORS = {
  tilbod: '#2D6A4F', sendt: '#1565C0', aktiv: '#166534', tapt: '#B91C1C', fullfort: '#4A7560',
}

// ── Geonorge adressesøk ────────────────────────────────────────────
async function sokGeonorge(query) {
  if (!query || query.length < 3) return []
  try {
    const res = await fetch(
      `https://ws.geonorge.no/adresser/v1/sok?sok=${encodeURIComponent(query)}&treffPerSide=8&side=0`
    )
    const data = await res.json()
    return (data.adresser || []).map(a => ({
      adresse: a.adressetekst,
      postnr: a.postnummer, poststad: a.poststedsnavn,
      kommune: a.kommunenavn, kommunenr: a.kommunenummer,
      gnr: a.gardsnummer, bnr: a.bruksnummer,
      festenr: a.festenummer || '', seksjonsnr: a.undernummer || '',
    }))
  } catch { return [] }
}

// ── Brønnøysund org-oppslag ────────────────────────────────────────
async function sokBrreg(orgnr) {
  if (!orgnr || orgnr.length < 9) return null
  try {
    const res = await fetch(`https://data.brreg.no/enhetsregisteret/api/enheter/${orgnr}`)
    if (!res.ok) return null
    const d = await res.json()
    return {
      namn: d.navn,
      adresse: (d.forretningsadresse?.adresse || []).join(', '),
      postnr: d.forretningsadresse?.postnummer || '',
      poststad: d.forretningsadresse?.poststed || '',
    }
  } catch { return null }
}

// ── Oppdragsmappe: standard rot + føreslått sti + mappestruktur ────
// Brukar må sjølv stadfeste («låse») stien før noko vert oppretta på disk
// — sjå Section «Oppdragsmappe» og laasOppdragssti() i sjølve komponenten.
const OPPDRAG_BASIS = 'C:\\Users\\gemli\\Jottacloud\\Lied Lab\\Web\\Oppdrag'
// Må haldast i sync med OPPDRAGSMAPPER i electron/main.js.
const OPPDRAGSMAPPER = [
  '1 Oppdragsleiing', '2 Informasjonsflyt', '3 Arbeidsdokument', '4 Resultatdokument',
  '5 Kontrolldokument', '6 Styrande dokument', '7 BIM', '8 Diverse', '9 Foreløpig',
]
function forslagOppdragssti(projectNumber) {
  return projectNumber ? `${OPPDRAG_BASIS}\\${projectNumber}` : OPPDRAG_BASIS
}

// ── Generer prosjektnummer ÅÅNNN ──────────────────────────────────
function genererProsjektnummer(eksisterande) {
  const aar = String(new Date().getFullYear()).slice(2)
  const prefix = aar
  const brukte = eksisterande
    .filter(nr => nr && nr.startsWith(prefix))
    .map(nr => parseInt(nr.slice(2)))
    .filter(n => !isNaN(n))
  const neste = brukte.length > 0 ? Math.max(...brukte) + 1 : 1
  return prefix + String(neste).padStart(3, '0')
}

// ── Input-komponent ───────────────────────────────────────────────
// MÅ liggje på modulnivå (ikkje definerast inni ProsjektModule-funksjonen).
// Ein komponent definert inni ein annan komponent sin render-funksjon får
// ein NY funksjonsreferanse kvar gong forelderen rerendrar — React tolkar
// det som ein heilt ny komponenttype, og byter difor ut heile <input>-DOM-
// noden (i staden for berre å oppdatere verdien hans) kvar gong `form`
// endrar seg, altså etter kvart tastetrykk. Det gjorde at feltet mista
// fokus og berre eitt teikn kunne skrivast inn før ein måtte klikke i
// boksen på nytt. Faste, modulnivå-funksjonar har éin stabil referanse
// gjennom heile appen sitt liv, så React kan gjenbruke DOM-noden i staden.
function F({ form, set, label, id, type='text', half, third, quarter, ...props }) {
  return (
    <div style={{ flex: quarter ? '0 0 25%' : third ? '0 0 33.33%' : half ? '0 0 50%' : 1, minWidth: 0 }}>
      <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text3)',
        marginBottom:3, letterSpacing:'.03em' }}>{label}</label>
      {type === 'date' ? (
        <DatePicker value={form?.[id] || ''} onChange={v => set(id, v)}/>
      ) : type === 'textarea' ? (
        <textarea value={form?.[id] || ''} onChange={e => set(id, e.target.value)}
          rows={3} {...props}
          style={{ width:'100%', padding:'8px 10px', borderRadius:'var(--r)',
            border:'1.5px solid var(--border)', background:'var(--bg2)',
            fontSize:14, fontFamily:'var(--font)', color:'var(--text)',
            resize:'vertical', outline:'none', ...props.style }}/>
      ) : (
        <input type={type} value={form?.[id] || ''} onChange={e => set(id, e.target.value)}
          {...props}
          style={{ width:'100%', padding:'8px 10px', borderRadius:'var(--r)',
            border:'1.5px solid var(--border)', background:'var(--bg2)',
            fontSize:14, fontFamily:'var(--font)', color:'var(--text)',
            outline:'none', boxSizing:'border-box', ...props.style }}/>
      )}
    </div>
  )
}

// ── Seksjon-wrapper ───────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:13, fontWeight:700, color:'var(--brand)', letterSpacing:'-0.01em',
        marginBottom:10, paddingBottom:6, borderBottom:'2px solid var(--brandbg2)' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ children, gap=10 }) {
  return <div style={{ display:'flex', gap, marginBottom:8 }}>{children}</div>
}

// ── Tom prosjektdata ──────────────────────────────────────────────
function tomtProsjekt() {
  return {
    projectNumber: '',
    status: 'tilbod',
    description: '',
    // Kunde
    clientName: '', clientOrgNr: '', clientAddress: '', clientPostnr: '', clientPoststad: '',
    clientContactName: '', clientContactEmail: '', clientContactPhone: '',
    // Tiltakshavar
    tiltakshavarName: '', tiltakshavarOrgNr: '', tiltakshavarAddress: '',
    tiltakshavarContactName: '', tiltakshavarContactEmail: '', tiltakshavarContactPhone: '',
    tiltakshavarSameAsClient: true,
    // Eigedom
    propertyAddress: '', propertyPostnr: '', propertyPoststad: '',
    propertyKommune: '', propertyKommunenr: '',
    propertyGnr: '', propertyBnr: '', propertyFestenr: '', propertySeksjonsnr: '',
    propertySource: '',
    // Klassifisering
    tiltakTypes: [], buildingCategory: '', buildingSubcategory: '', bra: '',
    tiltakDescription: '',
    // Tilbod
    offerPrice: '', estimatedHours: '', sentDate: '', actualHours: '',
    // Oppdragsmappe (lokal filstruktur)
    oppdragsSti: '', oppdragsStiLast: false,
    // Skyopplasting av resultatdokument (DTM, sjå claude/dtm-modul.md) —
    // AV som standard per prosjekt (brukar sitt eige krav 1. okt. 2026:
    // ikkje automatisk for alle prosjekt, sidan nokre kan ha dokument ein
    // ikkje vil ha liggjande i ein skybøtte i det heile).
    skyOpplastingResultatdokument: false,
    // Oppsett for teikningsnummer (DS-356) — sjå teikningsnummer.js
    nummerering: { ...STANDARD_NUMMERERING },
  }
}

// ══════════════════════════════════════════════════════════════════
//  Landingsside for Prosjekt (når «Alle prosjekt» er valt): søk + filter + kort. Klikk på eit prosjekt for å opne det.
function ProsjektOversikt({ liste, loading, filter, setFilter, papirkorgTal, onVel, onNytt, onSlett, onGjenopprett, onSlettEndeleg }) {
  const [sok, setSok] = useState('')
  const q = sok.trim().toLowerCase()
  const treff = liste.filter(p => !q || `${p.projectNumber || ''} ${p.name || ''} ${p.details?.oppdragsgivar || ''} ${p.details?.kunde || ''} ${p.details?.adresse || ''}`.toLowerCase().includes(q))
  const dagar = (d) => Math.max(0, 30 - Math.floor((Date.now() - new Date(d).getTime()) / 86400000))
  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden', background:'var(--bg)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'0 20px', height:50, flexShrink:0, background:'var(--bg3)' }}>
        <span style={{ fontSize:12, color:'var(--text2)' }}>{treff.length} prosjekt</span>
        <div style={{ flex:1 }}/>
        <button onClick={onNytt} style={{ padding:'6px 16px', borderRadius:'var(--r)', border:'1.5px solid var(--border)', background:'rgba(255,255,255,.18)', color:'var(--text)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'var(--font)' }}>＋ Nytt prosjekt</button>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'26px 30px 40px' }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', marginBottom:20 }}>
            <input autoFocus value={sok} onChange={e => setSok(e.target.value)} placeholder="Søk etter prosjekt (namn, nummer, oppdragsgjevar)…"
              style={{ flex:'1 1 360px', maxWidth:560, padding:'11px 14px', fontSize:14, border:'1.5px solid var(--border)', borderRadius:10, background:'var(--bg2)', color:'var(--text)', fontFamily:'var(--font)', outline:'none' }}/>
            <div style={{ display:'flex', gap:4, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:9, padding:3 }}>
              {[['alle','Alle'],['tilbod','Tilbod'],['aktiv','Aktive'],['arkiv','Arkiv']].map(([k, l]) => (
                <button key={k} onClick={() => setFilter(k)} style={{ border:'none', borderRadius:7, padding:'6px 14px', fontSize:12.5, fontWeight:700, cursor:'pointer', fontFamily:'var(--font)',
                  background: filter === k ? 'var(--bg2)' : 'transparent', color: filter === k ? 'var(--brand)' : 'var(--text3)', boxShadow: filter === k ? 'var(--shadow-sm)' : 'none' }}>{l}</button>
              ))}
              <button onClick={() => setFilter('papirkorg')} title="Papirkorg" style={{ border:'none', borderRadius:7, padding:'6px 12px', fontSize:12.5, fontWeight:700, cursor:'pointer', fontFamily:'var(--font)',
                background: filter === 'papirkorg' ? 'rgba(220,38,38,.15)' : 'transparent', color: filter === 'papirkorg' ? 'var(--danger)' : 'var(--text3)' }}>🗑{papirkorgTal > 0 ? ' ' + papirkorgTal : ''}</button>
            </div>
          </div>
          {loading && <div style={{ color:'var(--text3)', fontSize:13 }}>Lastar…</div>}
          {!loading && treff.length === 0 && <div style={{ padding:'40px 10px', textAlign:'center', color:'var(--text3)', fontSize:14 }}>{q ? 'Ingen prosjekt passar søket.' : 'Ingen prosjekt enno — trykk «＋ Nytt prosjekt».'}</div>}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:14 }}>
            {treff.map(p => {
              const sc = STATUS_COLORS[p.status] || '#4A7560'
              const iKorg = !!p.deletedAt
              return (
                <div key={p.id} onClick={() => !iKorg && onVel(p.id)}
                  style={{ background:'var(--bg2)', border:'1.5px solid var(--border)', borderRadius:12, padding:'14px 16px', cursor: iKorg ? 'default' : 'pointer', transition:'box-shadow .15s, border-color .15s', display:'flex', flexDirection:'column', gap:8 }}
                  onMouseEnter={e => { if (!iKorg) { e.currentTarget.style.borderColor = 'var(--brand2)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)' } }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontFamily:'var(--mono)', fontSize:12, fontWeight:700, color:'var(--text3)' }}>{p.projectNumber || '—'}</span>
                    <span style={{ padding:'2px 8px', borderRadius:4, background:sc, color:'#fff', fontSize:10, fontWeight:800, letterSpacing:'.05em', textTransform:'uppercase' }}>{STATUS_LABELS[p.status] || p.status}</span>
                    <div style={{ flex:1 }}/>
                    {!iKorg && <button onClick={e => { e.stopPropagation(); onSlett(p.id) }} title="Slett prosjekt" style={{ border:'none', background:'none', cursor:'pointer', color:'var(--text3)', fontSize:13, opacity:.6 }}>🗑</button>}
                  </div>
                  <div style={{ fontSize:15, fontWeight:700, color:'var(--text)', lineHeight:1.35 }}>{p.name}</div>
                  {iKorg && (
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:12, color:'var(--danger)', fontWeight:600 }}>Slettast om {dagar(p.deletedAt)} dagar</span>
                      <div style={{ flex:1 }}/>
                      <button className="fd-knapp" style={{ padding:'3px 10px', fontSize:12, border:'1.5px solid var(--border)', borderRadius:6, background:'var(--bg2)', cursor:'pointer' }} onClick={e => { e.stopPropagation(); onGjenopprett(p.id) }}>Gjenopprett</button>
                      <button style={{ padding:'3px 10px', fontSize:12, border:'1.5px solid var(--danger)', borderRadius:6, background:'transparent', color:'var(--danger)', cursor:'pointer' }} onClick={e => { e.stopPropagation(); onSlettEndeleg(p.id) }}>Slett endeleg</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
export default function ProsjektModule({ userId, projects: existingProjects, offices,
                                          activeOfficeId, addProject, onProjectCreated,
                                          activeProjectId, onSetActiveProject }) {
  const [prosjektList, setProsjektList] = useState([])
  const [selected, setSelected]         = useState(null) // project id
  const [form, setForm]                 = useState(null)  // prosjektkort data
  const [dirty, setDirty]               = useState(false)
  const [loading, setLoading]           = useState(true)
  const [geoResults, setGeoResults]     = useState([])
  const [geoQuery, setGeoQuery]         = useState('')
  const [orgLookup, setOrgLookup]       = useState({ field: null, loading: false })
  const [kundeliste, setKundeliste]       = useState([])   // kundar frå Kundar-modulen (kundeveljar i prosjektskjemaet)
  useEffect(() => {
    if (!userId) return
    supabase.from('clients').select('id,company_name,org_nr,details').eq('user_id', userId).order('company_name').then(({ data }) => setKundeliste(data || []))
  }, [userId])
  const [filter, setFilter]             = useState('alle') // alle|tilbod|aktiv|arkiv
  const [sidebarWidth]                  = useState(240)
  const [side, setSide]                   = useState('kort') // 'kort' | 'personell' | 'kalender'

  // ── Last prosjekt med detaljar ────────────────────────────────
  const loadProsjekt = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase.from('projects').select('*')
      .order('created_at', { ascending: false })
    setProsjektList((data || []).map(p => ({
      id: p.id,
      name: p.name,
      officeId: p.office_id,
      projectNumber: p.project_number || '',
      status: p.project_status || 'tilbod',
      details: p.details || {},
      createdAt: p.created_at,
      deletedAt: p.deleted_at || null,
    })))
    setLoading(false)

    // Endeleg fjerning av prosjekt som har lege i papirkorga i over 30 dagar
    const now = Date.now()
    const expired = (data || []).filter(p => {
      if (!p.deleted_at) return false
      const deletedMs = new Date(p.deleted_at).getTime()
      return (now - deletedMs) > 30 * 24 * 60 * 60 * 1000
    })
    if (expired.length > 0) {
      await supabase.from('projects').delete()
        .in('id', expired.map(p => p.id)).eq('user_id', userId)
    }
  }, [userId])

  useEffect(() => { loadProsjekt() }, [loadProsjekt])

  // ── Oppdragsmappe: føreslått (endå ikkje låst) sti ─────────────
  // Halde utanfor `form`/dirty-sporinga — dette er berre eit forslag brukar
  // kan skrive over før dei eksplisitt trykkjer «Lås denne stien» (sjå
  // laasOppdragssti under), ikkje eit felt som skal inngå i den vanlege
  // «Lagre prosjektkort»-flyten.
  const [oppdragsForslag, setOppdragsForslag] = useState('')
  useEffect(() => {
    if (!form || form.oppdragsStiLast) return
    setOppdragsForslag(form.oppdragsSti || forslagOppdragssti(form.projectNumber))
  }, [form?.projectNumber, form?.oppdragsStiLast])

  // ── Vel prosjekt ──────────────────────────────────────────────
  const selectProject = (id) => {
    if (dirty && !window.confirm('Du har ulagra endringar. Vil du forkaste dei?')) return
    setSelected(id)
    const p = prosjektList.find(x => x.id === id)
    if (p) {
      setForm({
        projectNumber: p.projectNumber,
        status: p.status,
        name: p.name,
        ...tomtProsjekt(),
        ...p.details,
        projectNumber: p.projectNumber,
        status: p.status,
      })
    }
    setDirty(false)
    // Synk med det globalt aktive prosjektet (valt i TopBar), slik at alle andre
    // modular filtrerer på det same prosjektet ein no jobbar med her
    if (onSetActiveProject && id !== activeProjectId) onSetActiveProject(id)
  }

  // ── Opne det globalt aktive prosjektet automatisk når det vert valt i TopBar ──
  useEffect(() => {
    if (!activeProjectId) return
    if (activeProjectId === selected) return
    if (dirty) return // ikkje forkast ulagra endringar automatisk
    const p = prosjektList.find(x => x.id === activeProjectId)
    if (p) {
      setSelected(p.id)
      setForm({
        projectNumber: p.projectNumber,
        status: p.status,
        name: p.name,
        ...tomtProsjekt(),
        ...p.details,
        projectNumber: p.projectNumber,
        status: p.status,
      })
      setDirty(false)
    }
  }, [activeProjectId, prosjektList])

  // ── Nytt prosjekt ─────────────────────────────────────────────
  const nyttProsjekt = async () => {
    if (dirty && !window.confirm('Du har ulagra endringar. Vil du forkaste dei?')) return
    const nr = genererProsjektnummer(prosjektList.map(p => p.projectNumber))
    const id = Date.now()
    const details = tomtProsjekt()
    const row = {
      id, user_id: userId, name: `Nytt prosjekt ${nr}`,
      favorite: false, type: 'work',
      office_id: activeOfficeId,
      project_number: nr, project_status: 'tilbod',
      details,
      created_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('projects').insert(row)
    if (!error) {
      merkSeedet(id); leggTilMegSomPersonell(userId, id, { eksisterande: [] })
      onSetActiveProject?.(id)
      await loadProsjekt()
      setSelected(id)
      setForm({ ...details, projectNumber: nr, status: 'tilbod', name: row.name })
      setDirty(false)
    }
  }

  // ── Lagre prosjekt ────────────────────────────────────────────
  const lagreProsjekt = async () => {
    if (!selected || !form) return
    const { projectNumber, status, name, ...details } = form
    const { error, data } = await supabase.from('projects').update({
      name: name || `Prosjekt ${projectNumber}`,
      project_number: projectNumber,
      project_status: status,
      details,
      updated_at: new Date().toISOString(),
    }).eq('id', selected).select()
    if (error) {
      alert('Klarte ikkje lagre prosjektet: ' + error.message)
      return
    }
    if (!data || data.length === 0) {
      alert('Lagring feila — prosjektet vart ikkje funne i databasen.')
      return
    }
    setDirty(false)
    await loadProsjekt()
  }

  // ── Oppdater felt ─────────────────────────────────────────────
  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }))
    setDirty(true)
  }

  // ── Geonorge-søk ─────────────────────────────────────────────
  const doGeoSearch = async () => {
    if (geoQuery.length < 3) return
    const results = await sokGeonorge(geoQuery)
    setGeoResults(results)
  }

  const velgAdresse = (a) => {
    setForm(f => ({
      ...f,
      propertyAddress: a.adresse, propertyPostnr: a.postnr, propertyPoststad: a.poststad,
      propertyKommune: a.kommune, propertyKommunenr: a.kommunenr,
      propertyGnr: String(a.gnr || ''), propertyBnr: String(a.bnr || ''),
      propertyFestenr: String(a.festenr || ''), propertySeksjonsnr: String(a.seksjonsnr || ''),
      propertySource: 'Geonorge',
    }))
    setGeoResults([])
    setGeoQuery('')
    setDirty(true)
  }

  // ── Kundeveljar: fyll kundefelta frå kundelista, og vel kontaktperson/sakbehandlar blant kunden sine tilsette ──
  const velgKunde = (idStr) => {
    const k = kundeliste.find(c => String(c.id) === String(idStr))
    if (!k) { setForm(f => ({ ...f, clientId: null })); setDirty(true); return }
    const d = k.details || {}
    setForm(f => ({ ...f, clientId: k.id, clientName: k.company_name || '', clientOrgNr: k.org_nr || '', clientAddress: d.address || '', clientPostnr: d.postnr || '', clientPoststad: d.poststad || '' }))
    setDirty(true)
  }
  const velgKundekontakt = (ctId) => {
    const k = kundeliste.find(c => String(c.id) === String(form.clientId))
    const ct = (k?.details?.contacts || []).find(c => String(c.id) === String(ctId))
    setForm(f => ({ ...f, clientContactName: ct?.name || '', clientContactEmail: ct?.email || '', clientContactPhone: ct?.phone || ct?.mobile || '' }))
    setDirty(true)
  }

  // ── Brønnøysund-oppslag ───────────────────────────────────────
  const doOrgLookup = async (field) => {
    const orgnr = field === 'client' ? form.clientOrgNr : form.tiltakshavarOrgNr
    setOrgLookup({ field, loading: true })
    const result = await sokBrreg(orgnr)
    setOrgLookup({ field: null, loading: false })
    if (!result) return
    if (field === 'client') {
      setForm(f => ({
        ...f, clientName: result.namn, clientAddress: result.adresse,
        clientPostnr: result.postnr, clientPoststad: result.poststad,
      }))
    } else {
      setForm(f => ({
        ...f, tiltakshavarName: result.namn, tiltakshavarAddress: result.adresse,
      }))
    }
    setDirty(true)
  }

  // ── Status-endring (auto-lagrar) ─────────────────────────────
  const byttStatus = async (nyStatus) => {
    if (nyStatus === 'sendt' && !form.offerPrice) {
      alert('Du må fylle inn tilbodspris før du kan stemple tilbodet som sendt.')
      return
    }
    const prevStatus = form.status
    set('status', nyStatus)
    if (nyStatus === 'sendt' && !form.sentDate) set('sentDate', new Date().toISOString().slice(0, 10))
    // Auto-lagre statusendring
    const { error, data } = await supabase.from('projects').update({
      project_status: nyStatus,
      updated_at: new Date().toISOString(),
    }).eq('id', selected).select()
    if (error) {
      alert('Klarte ikkje lagre statusendring: ' + error.message)
      set('status', prevStatus)
      return
    }
    if (!data || data.length === 0) {
      alert('Statusendring vart ikkje lagra — prosjektet vart ikkje funne i databasen (id/eigar stemmer ikkje). Kontakt utviklar.')
      set('status', prevStatus)
      return
    }
    setDirty(false)
    await loadProsjekt()
  }

  // ── Lås oppdragsmappe (auto-lagrar, som byttStatus) ────────────
  // Brukar må eksplisitt stadfeste stien før noko vert oppretta på disk —
  // sjå forslagOppdragssti()/OPPDRAG_BASIS over. Kan IKKJE skje via den
  // vanlege set()+lagreProsjekt()-flyten, sidan set() berre planlegg ei
  // state-oppdatering — eit umiddelbart lagreProsjekt()-kall etterpå ville
  // lese att den GAMLE `form`-verdien (same «race»-fallgruve som
  // byttStatus over er bygd for å unngå).
  const laasOppdragssti = async () => {
    const sti = (oppdragsForslag || '').trim()
    if (!sti) { alert('Skriv eller vel ein sti fyrst.'); return }
    if (!window.confirm(
      `Lås prosjektet til:\n${sti}\n\n` +
      `Følgjande mapper vert oppretta der:\n${OPPDRAGSMAPPER.map(m => '• ' + m).join('\n')}\n\n` +
      `Fortsette?`
    )) return
    if (typeof window !== 'undefined' && window.resultatdokumentAPI) {
      const res = await window.resultatdokumentAPI.opprettOppdragsmapper(sti)
      if (!res?.ok) { alert('Klarte ikkje opprette mappestrukturen: ' + (res?.melding || 'ukjend feil')); return }
    }
    const { projectNumber, status, name, ...restDetails } = form
    const nyeDetails = { ...restDetails, oppdragsSti: sti, oppdragsStiLast: true }
    const { error, data } = await supabase.from('projects').update({
      details: nyeDetails, updated_at: new Date().toISOString(),
    }).eq('id', selected).select()
    if (error || !data?.length) {
      alert('Klarte ikkje lagre stien: ' + (error?.message || 'prosjektet vart ikkje funne'))
      return
    }
    setForm(f => ({ ...f, oppdragsSti: sti, oppdragsStiLast: true }))
    setProsjektList(list => list.map(p => p.id === selected ? { ...p, details: nyeDetails } : p))
  }

  const laasOppOppdragssti = async () => {
    if (!window.confirm('Låse opp stien? Du kan då velje ein annan plassering. Mapper som alt er oppretta på disk vert IKKJE sletta.')) return
    const { projectNumber, status, name, ...restDetails } = form
    const nyeDetails = { ...restDetails, oppdragsStiLast: false }
    const { error, data } = await supabase.from('projects').update({
      details: nyeDetails, updated_at: new Date().toISOString(),
    }).eq('id', selected).select()
    if (error || !data?.length) {
      alert('Klarte ikkje låse opp: ' + (error?.message || 'prosjektet vart ikkje funne'))
      return
    }
    setForm(f => ({ ...f, oppdragsStiLast: false }))
    setProsjektList(list => list.map(p => p.id === selected ? { ...p, details: nyeDetails } : p))
  }

  // ── Slett prosjekt (til papirkorg, 30 dagar) ──────────────────
  const slettProsjekt = async (id) => {
    const p = prosjektList.find(x => x.id === id)
    if (!p) return
    if (!window.confirm(`Vil du verkeleg slette prosjektet «${p.name}»?\n\nProsjektet vert lagt i papirkorga og sletta endeleg om 30 dagar.`)) return
    const { error } = await supabase.from('projects')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { alert('Klarte ikkje slette prosjektet: ' + error.message); return }
    if (selected === id) { setSelected(null); setForm(null) }
    await loadProsjekt()
  }

  // ── Gjenopprett frå papirkorg ──────────────────────────────────
  const gjenopprettProsjekt = async (id) => {
    const { error } = await supabase.from('projects')
      .update({ deleted_at: null })
      .eq('id', id)
    if (error) { alert('Klarte ikkje gjenopprette prosjektet: ' + error.message); return }
    await loadProsjekt()
  }

  // ── Slett endeleg med det same (frå papirkorga) ────────────────
  const slettEndeleg = async (id) => {
    const p = prosjektList.find(x => x.id === id)
    if (!p) return
    if (!window.confirm(`Slette «${p.name}» endeleg NO? Dette kan ikkje angrast.`)) return
    const { error } = await supabase.from('projects').delete()
      .eq('id', id).eq('user_id', userId)
    if (error) { alert('Klarte ikkje slette prosjektet: ' + error.message); return }
    await loadProsjekt()
  }

  const dagarIgjen = (deletedAt) => {
    const deletedMs = new Date(deletedAt).getTime()
    const daysLeft = 30 - Math.floor((Date.now() - deletedMs) / (24 * 60 * 60 * 1000))
    return Math.max(0, daysLeft)
  }

  // ── Filter ────────────────────────────────────────────────────
  const filteredList = prosjektList.filter(p => {
    if (activeOfficeId && p.officeId !== activeOfficeId) return false
    if (filter === 'papirkorg') return !!p.deletedAt
    if (p.deletedAt) return false  // skjul sletta prosjekt frå alle andre filter
    if (filter === 'tilbod') return p.status === 'tilbod' || p.status === 'sendt'
    if (filter === 'aktiv')  return p.status === 'aktiv'
    if (filter === 'arkiv')  return p.status === 'tapt' || p.status === 'fullfort'
    return true
  })

  const papirkorgTal = prosjektList.filter(p => !!p.deletedAt).length

  // F/Section/Row ligg no på modulnivå (sjå over) — `bind` sender form/set
  // ned til F som vanlege props, i staden for via lukke, sjå kommentaren der.
  const bind = { form, set }

  // ══════════════════════════════════════════════════════════════
  // «Alle prosjekt» valt øvst → landingsside med søk (i staden for den gamle prosjektlista til venstre)
  if (!activeProjectId) {
    return <ProsjektOversikt liste={filteredList} loading={loading} filter={filter} setFilter={setFilter} papirkorgTal={papirkorgTal}
      onVel={selectProject} onNytt={nyttProsjekt} onSlett={slettProsjekt} onGjenopprett={gjenopprettProsjekt} onSlettEndeleg={slettEndeleg}/>
  }

  return (
    <div style={{ display:'flex', flex:1, overflow:'hidden' }}>


      {/* ── Hovudinnhald: prosjektkort ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Topbar */}
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 16px',
          height:50, flexShrink:0, background:'var(--bg3)',
          borderBottom:'1px solid var(--border)' }}>
          {form && (
            <>
              <button onClick={lagreProsjekt}
                disabled={!dirty}
                style={{ display:'flex', alignItems:'center', gap:6,
                  padding:'6px 16px', borderRadius:'var(--r)',
                  border: dirty ? '1.5px solid var(--brand)' : '1.5px solid var(--border)',
                  background: dirty ? 'var(--brand)' : 'rgba(255,255,255,.5)',
                  color: dirty ? '#fff' : 'var(--text3)',
                  fontSize:13, fontWeight:700, cursor: dirty ? 'pointer' : 'default',
                  fontFamily:'var(--font)', transition:'all .15s' }}>
                {dirty ? '● Lagre' : '✓ Lagra'}
              </button>
              <span style={{ fontSize:13, color:'var(--text2)', fontFamily:'var(--mono)' }}>
                {form.projectNumber}
              </span>
              <span style={{ fontSize:13, color:'var(--text2)' }}>{form.name}</span>
              <div style={{ flex:1 }}/>
              <button onClick={() => slettProsjekt(selected)}
                title="Slett prosjekt"
                style={{ display:'flex', alignItems:'center', gap:6,
                  padding:'6px 14px', borderRadius:'var(--r)',
                  border:'1.5px solid var(--border)',
                  background:'rgba(220,38,38,.18)', color:'var(--text2)',
                  fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)' }}>
                🗑 Slett prosjekt
              </button>
            </>
          )}
        </div>

        {/* Fanerad (NL3): Prosjektinfo · Personell — aktiv fane svart med kvit tekst (konsekvent i alle modular) */}
        <div style={{ display:'flex', gap:6, padding:'8px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', flexShrink:0 }}>
          {[['kort','Prosjektinfo'],['personell','Personell']].map(([k, t]) => (
            <button key={k} onClick={() => setSide(k)}
              style={{ padding:'6px 16px', border:'1.5px solid ' + (side === k ? '#0A0A0A' : 'transparent'), borderRadius:8, cursor:'pointer', fontFamily:'var(--font)',
                fontSize:13, fontWeight: side === k ? 700 : 500, background: side === k ? '#0A0A0A' : 'transparent', color: side === k ? '#fff' : 'var(--text2)' }}>
              {t}
            </button>
          ))}
        </div>

        {side === 'personell' && (
          <div style={{ flex:1, overflow:'auto', padding:'22px 28px', display:'flex', flexDirection:'column', minHeight:0 }}>
            <PersonellSide userId={userId} prosjekt={prosjektList.find(p => p.id === selected)} prosjektListe={prosjektList}/>
          </div>
        )}

        {/* Prosjektkort */}
        {side === 'kort' && (
        <div style={{ flex:1, overflowY:'auto', padding:'22px 28px' }}>
          {!form ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
              justifyContent:'center', height:'100%', gap:16 }}>
              <div style={{ width:72, height:72, borderRadius:18, background:'var(--brandbg2)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:32, fontWeight:900, color:'var(--brand)', fontFamily:'var(--font)' }}>P</div>
              <p style={{ fontSize:14, color:'var(--text3)', textAlign:'center', maxWidth:360, lineHeight:1.7 }}>
                Vel eit prosjekt øvst i vindauget, eller opprett eit nytt prosjekt.
              </p>
            </div>
          ) : (
            <div style={{ maxWidth:1180, display:'grid',
              gridTemplateColumns:'1fr 1fr', gap:'0 32px', alignItems:'start' }}>

              {/* ── Venstre kolonne ── */}
              <div>

              {/* ── Grunndata ── */}
              <Section title="Grunndata">
                <Row>
                  <F {...bind} label="Prosjektnummer" id="projectNumber" style={{ fontFamily:'var(--mono)', fontWeight:700 }}/>
                  <F {...bind} label="Prosjektnamn" id="name"/>
                </Row>
                <Row>
                  <div style={{ flex:1 }}>
                    <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text3)',
                      marginBottom:3, letterSpacing:'.03em' }}>Status</label>
                    <div style={{ display:'flex', gap:4 }}>
                      {['tilbod','sendt','aktiv','tapt','fullfort'].map(s => (
                        <button key={s} onClick={() => byttStatus(s)}
                          style={{ padding:'6px 12px', borderRadius:5,
                            border: form.status===s ? '2px solid var(--brand)' : '1.5px solid var(--border)',
                            background: form.status===s ? STATUS_COLORS[s] : 'var(--bg2)',
                            color: form.status===s ? '#fff' : 'var(--text3)',
                            fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)',
                            transition:'all .15s' }}>
                          {STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                </Row>
                <Row><F {...bind} label="Kort prosjektbeskriving" id="description" type="textarea"/></Row>
              </Section>

              {/* ── Kunde ── */}
              <Section title="Kunde">
                {kundeliste.length > 0 && (
                  <Row>
                    <div style={{ flex:1, minWidth:0 }}>
                      <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:3, letterSpacing:'.03em' }}>Vel kunde frå kundelista</label>
                      <select value={form.clientId || ''} onChange={e => velgKunde(e.target.value)}
                        style={{ width:'100%', padding:'8px 10px', borderRadius:'var(--r)', border:'1.5px solid var(--border)', background:'var(--bg2)', fontSize:14, fontFamily:'var(--font)', color:'var(--text)', outline:'none' }}>
                        <option value="">— Vel kunde (eller fyll ut under) —</option>
                        {kundeliste.map(c => <option key={c.id} value={c.id}>{c.company_name || 'Utan namn'}{c.org_nr ? ' · ' + c.org_nr : ''}</option>)}
                      </select>
                    </div>
                    {form.clientId && (kundeliste.find(c => String(c.id) === String(form.clientId))?.details?.contacts || []).length > 0 && (
                      <div style={{ flex:1, minWidth:0 }}>
                        <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:3, letterSpacing:'.03em' }}>Kontaktperson / sakbehandlar hos kunden</label>
                        <select value={((kundeliste.find(c => String(c.id) === String(form.clientId))?.details?.contacts || []).find(c => c.name && c.name === form.clientContactName) || {}).id || ''} onChange={e => velgKundekontakt(e.target.value)}
                          style={{ width:'100%', padding:'8px 10px', borderRadius:'var(--r)', border:'1.5px solid var(--border)', background:'var(--bg2)', fontSize:14, fontFamily:'var(--font)', color:'var(--text)', outline:'none' }}>
                          <option value="">— Vel kontakt —</option>
                          {(kundeliste.find(c => String(c.id) === String(form.clientId))?.details?.contacts || []).filter(c => c.name).map(c => <option key={c.id} value={c.id}>{c.name}{c.role ? ' — ' + c.role : ''}</option>)}
                        </select>
                      </div>
                    )}
                  </Row>
                )}
                <Row>
                  <F {...bind} label="Org.nr." id="clientOrgNr" half/>
                  <div style={{ display:'flex', alignItems:'flex-end', paddingBottom:1 }}>
                    <button onClick={() => doOrgLookup('client')}
                      disabled={orgLookup.loading}
                      style={{ padding:'8px 14px', borderRadius:'var(--r)',
                        border:'1.5px solid var(--border)', background:'var(--bg3)',
                        fontSize:12, fontWeight:600, cursor:'pointer', color:'var(--text2)',
                        fontFamily:'var(--font)', whiteSpace:'nowrap' }}>
                      {orgLookup.loading && orgLookup.field==='client' ? 'Søkjer…' : 'Hent frå Brønnøysund'}
                    </button>
                  </div>
                </Row>
                <Row><F {...bind} label="Firmanamn / Namn" id="clientName"/></Row>
                <Row>
                  <F {...bind} label="Adresse" id="clientAddress"/>
                  <F {...bind} label="Postnr." id="clientPostnr" quarter/>
                  <F {...bind} label="Poststad" id="clientPoststad" third/>
                </Row>
                <Row>
                  <F {...bind} label="Kontaktperson" id="clientContactName"/>
                  <F {...bind} label="E-post" id="clientContactEmail" type="email"/>
                  <F {...bind} label="Telefon" id="clientContactPhone" type="tel"/>
                </Row>
              </Section>

              {/* ── Tiltakshavar ── */}
              <Section title="Tiltakshavar">
                <div style={{ marginBottom:10 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13,
                    color:'var(--text2)', cursor:'pointer' }}>
                    <input type="checkbox" checked={form.tiltakshavarSameAsClient || false}
                      onChange={e => set('tiltakshavarSameAsClient', e.target.checked)}
                      style={{ width:16, height:16 }}/>
                    Same som kunde
                  </label>
                </div>
                {!form.tiltakshavarSameAsClient && (
                  <>
                    <Row>
                      <F {...bind} label="Org.nr." id="tiltakshavarOrgNr" half/>
                      <div style={{ display:'flex', alignItems:'flex-end', paddingBottom:1 }}>
                        <button onClick={() => doOrgLookup('tiltakshavar')}
                          disabled={orgLookup.loading}
                          style={{ padding:'8px 14px', borderRadius:'var(--r)',
                            border:'1.5px solid var(--border)', background:'var(--bg3)',
                            fontSize:12, fontWeight:600, cursor:'pointer', color:'var(--text2)',
                            fontFamily:'var(--font)', whiteSpace:'nowrap' }}>
                          {orgLookup.loading && orgLookup.field==='tiltakshavar' ? 'Søkjer…' : 'Hent frå Brønnøysund'}
                        </button>
                      </div>
                    </Row>
                    <Row><F {...bind} label="Firmanamn / Namn" id="tiltakshavarName"/></Row>
                    <Row><F {...bind} label="Adresse" id="tiltakshavarAddress"/></Row>
                    <Row>
                      <F {...bind} label="Kontaktperson" id="tiltakshavarContactName"/>
                      <F {...bind} label="E-post" id="tiltakshavarContactEmail" type="email"/>
                      <F {...bind} label="Telefon" id="tiltakshavarContactPhone" type="tel"/>
                    </Row>
                  </>
                )}
              </Section>

              </div>
              {/* ── Høgre kolonne ── */}
              <div>

              {/* ── Eigedom ── */}
              <Section title="Eigedom">
                <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                  <input value={geoQuery} onChange={e => setGeoQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && doGeoSearch()}
                    placeholder="Søk adresse (Geonorge) — t.d. Sjøgata 12, Bodø"
                    style={{ flex:1, padding:'8px 10px', borderRadius:'var(--r)',
                      border:'1.5px solid var(--border)', background:'var(--bg2)',
                      fontSize:13, fontFamily:'var(--font)', color:'var(--text)', outline:'none' }}/>
                  <button onClick={doGeoSearch}
                    style={{ padding:'8px 14px', borderRadius:'var(--r)',
                      border:'1.5px solid var(--border)', background:'var(--bg3)',
                      fontSize:12, fontWeight:600, cursor:'pointer', color:'var(--text2)',
                      fontFamily:'var(--font)', whiteSpace:'nowrap' }}>
                    Hent frå Kartverket
                  </button>
                </div>
                {geoResults.length > 0 && (
                  <div style={{ border:'1.5px solid var(--brand3)', borderRadius:'var(--r2)',
                    marginBottom:12, overflow:'hidden', background:'var(--bg2)',
                    boxShadow:'var(--shadow)' }}>
                    {geoResults.map((a, i) => (
                      <div key={i} onClick={() => velgAdresse(a)}
                        style={{ padding:'8px 12px', cursor:'pointer', borderBottom: i < geoResults.length-1 ? '1px solid var(--border)' : 'none',
                          transition:'background .1s' }}
                        onMouseEnter={e => e.currentTarget.style.background='var(--bg3)'}
                        onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{a.adresse}</div>
                        <div style={{ fontSize:11, color:'var(--text3)' }}>
                          {a.postnr} {a.poststad} · gnr {a.gnr} bnr {a.bnr} · {a.kommune}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {form.propertySource && (
                  <div style={{ fontSize:11, color:'var(--brand3)', marginBottom:8, fontWeight:500 }}>
                    Henta frå {form.propertySource}
                  </div>
                )}
                <Row>
                  <F {...bind} label="Adresse" id="propertyAddress"/>
                  <F {...bind} label="Postnr." id="propertyPostnr" quarter/>
                  <F {...bind} label="Poststad" id="propertyPoststad" third/>
                </Row>
                <Row>
                  <F {...bind} label="Kommune" id="propertyKommune"/>
                  <F {...bind} label="Kommunenr." id="propertyKommunenr" quarter/>
                </Row>
                <Row>
                  <F {...bind} label="Gnr." id="propertyGnr" quarter/>
                  <F {...bind} label="Bnr." id="propertyBnr" quarter/>
                  <F {...bind} label="Festenr." id="propertyFestenr" quarter/>
                  <F {...bind} label="Seksjonsnr." id="propertySeksjonsnr" quarter/>
                </Row>
              </Section>

              {/* ── Klassifisering ── */}
              <Section title="Klassifisering av tiltaket">
                <div style={{ marginBottom:10 }}>
                  <label style={{ fontSize:11, fontWeight:600, color:'var(--text3)',
                    marginBottom:6, display:'block', letterSpacing:'.03em' }}>
                    Tiltakstype (fleire val mogleg)
                  </label>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {TILTAKSTYPAR.map(t => {
                      const checked = (form.tiltakTypes || []).includes(t)
                      return (
                        <label key={t} style={{ display:'flex', alignItems:'center', gap:5,
                          padding:'5px 10px', borderRadius:5,
                          border: checked ? '1.5px solid var(--brand)' : '1.5px solid var(--border)',
                          background: checked ? 'var(--brandbg)' : 'var(--bg2)',
                          cursor:'pointer', fontSize:12, color: checked ? 'var(--brand)' : 'var(--text3)',
                          fontWeight: checked ? 600 : 400, transition:'all .1s' }}>
                          <input type="checkbox" checked={checked}
                            onChange={() => {
                              const current = form.tiltakTypes || []
                              set('tiltakTypes', checked ? current.filter(x => x !== t) : [...current, t])
                            }}
                            style={{ display:'none' }}/>
                          {t}
                        </label>
                      )
                    })}
                  </div>
                </div>
                <Row>
                  <div style={{ flex:1 }}>
                    <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text3)',
                      marginBottom:3, letterSpacing:'.03em' }}>Bygningskategori</label>
                    <select value={form.buildingCategory || ''} onChange={e => {
                        set('buildingCategory', e.target.value)
                        set('buildingSubcategory', '')
                      }}
                      style={{ width:'100%', padding:'8px 10px', borderRadius:'var(--r)',
                        border:'1.5px solid var(--border)', background:'var(--bg2)',
                        fontSize:14, fontFamily:'var(--font)', color:'var(--text)', outline:'none' }}>
                      <option value="">— Vel —</option>
                      {Object.keys(KATEGORIAR).map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <div style={{ flex:1 }}>
                    <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text3)',
                      marginBottom:3, letterSpacing:'.03em' }}>Underkategori</label>
                    <select value={form.buildingSubcategory || ''} onChange={e => set('buildingSubcategory', e.target.value)}
                      style={{ width:'100%', padding:'8px 10px', borderRadius:'var(--r)',
                        border:'1.5px solid var(--border)', background:'var(--bg2)',
                        fontSize:14, fontFamily:'var(--font)', color:'var(--text)', outline:'none' }}>
                      <option value="">— Vel —</option>
                      {(KATEGORIAR[form.buildingCategory] || []).map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <F {...bind} label="BRA (m²)" id="bra" type="number" quarter/>
                </Row>
                <Row><F {...bind} label="Beskriving av tiltaket" id="tiltakDescription" type="textarea"/></Row>
              </Section>

              {/* ── Tilbod ── */}
              <Section title="Tilbod og økonomi">
                <Row>
                  <F {...bind} label="Tilbodspris (kr)" id="offerPrice" type="number"/>
                  <F {...bind} label="Estimerte timar" id="estimatedHours" type="number"/>
                  <F {...bind} label="Sendt dato" id="sentDate" type="date"/>
                </Row>
                {(form.status === 'aktiv' || form.status === 'fullfort') && (
                  <Row>
                    <F {...bind} label="Faktiske timar" id="actualHours" type="number"/>
                    {form.estimatedHours && form.actualHours && (
                      <div style={{ display:'flex', alignItems:'flex-end', paddingBottom:8 }}>
                        <span style={{ fontSize:13, fontWeight:600,
                          color: form.actualHours / form.estimatedHours > 1.1 ? 'var(--danger)' :
                                 form.actualHours / form.estimatedHours < 0.95 ? 'var(--success)' : 'var(--text3)' }}>
                          Kalibrering: {(form.actualHours / form.estimatedHours * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </Row>
                )}
              </Section>

              {/* ── Oppdragsmappe ── */}
              <Section title="Oppdragsmappe">
                {form.oppdragsStiLast ? (
                  <>
                    <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text3)',
                      marginBottom:3, letterSpacing:'.03em' }}>Låst sti</label>
                    <div style={{ fontFamily:'var(--mono)', fontSize:12, padding:'8px 10px',
                      background:'var(--bg3)', borderRadius:'var(--r)', border:'1.5px solid var(--border)',
                      color:'var(--text2)', wordBreak:'break-all', marginBottom:10 }}>
                      {form.oppdragsSti}
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      {typeof window !== 'undefined' && window.resultatdokumentAPI && (
                        <button onClick={() => window.resultatdokumentAPI.apneMappe(form.oppdragsSti)}
                          style={{ padding:'8px 14px', borderRadius:'var(--r)',
                            border:'1.5px solid var(--border)', background:'var(--bg3)',
                            fontSize:12, fontWeight:600, cursor:'pointer', color:'var(--text2)',
                            fontFamily:'var(--font)', whiteSpace:'nowrap' }}>
                          Opne mappe i utforskar
                        </button>
                      )}
                      <button onClick={laasOppOppdragssti}
                        style={{ padding:'8px 14px', borderRadius:'var(--r)',
                          border:'1.5px solid var(--border)', background:'var(--bg2)',
                          fontSize:12, fontWeight:600, cursor:'pointer', color:'var(--text3)',
                          fontFamily:'var(--font)', whiteSpace:'nowrap' }}>
                        Lås opp
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <Row>
                      <div style={{ flex:1 }}>
                        <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text3)',
                          marginBottom:3, letterSpacing:'.03em' }}>Føreslått sti (kan endrast før du låser)</label>
                        <input type="text" value={oppdragsForslag} onChange={e => setOppdragsForslag(e.target.value)}
                          style={{ width:'100%', padding:'8px 10px', borderRadius:'var(--r)',
                            border:'1.5px solid var(--border)', background:'var(--bg2)',
                            fontSize:12, fontFamily:'var(--mono)', color:'var(--text)',
                            outline:'none', boxSizing:'border-box' }}/>
                      </div>
                      {typeof window !== 'undefined' && window.resultatdokumentAPI && (
                        <div style={{ display:'flex', alignItems:'flex-end', paddingBottom:1 }}>
                          <button onClick={async () => {
                              const valgt = await window.resultatdokumentAPI.velgMappe()
                              if (valgt) setOppdragsForslag(valgt)
                            }}
                            style={{ padding:'8px 14px', borderRadius:'var(--r)',
                              border:'1.5px solid var(--border)', background:'var(--bg3)',
                              fontSize:12, fontWeight:600, cursor:'pointer', color:'var(--text2)',
                              fontFamily:'var(--font)', whiteSpace:'nowrap' }}>
                            Bla gjennom…
                          </button>
                        </div>
                      )}
                    </Row>
                    <p style={{ fontSize:11, color:'var(--text3)', margin:'2px 0 10px', lineHeight:1.6 }}>
                      Når du låser stien vert desse mappene oppretta der: {OPPDRAGSMAPPER.join(' · ')}.
                      Dokument, tegningar og modellar (DTM) brukar mappe 3–6 automatisk.
                      {(typeof window === 'undefined' || !window.resultatdokumentAPI) &&
                        ' Krev at appen er opna via skrivebordsversjonen for å opprette mappene på disk.'}
                    </p>
                    <button onClick={laasOppdragssti}
                      disabled={typeof window === 'undefined' || !window.resultatdokumentAPI}
                      title={(typeof window === 'undefined' || !window.resultatdokumentAPI) ? 'Krev skrivebordsversjonen' : undefined}
                      style={{ padding:'8px 18px', borderRadius:'var(--r)', border:'none',
                        background: (typeof window !== 'undefined' && window.resultatdokumentAPI) ? 'var(--brand)' : 'var(--bg4)',
                        color: (typeof window !== 'undefined' && window.resultatdokumentAPI) ? '#fff' : 'var(--text3)',
                        fontSize:13, fontWeight:700,
                        cursor: (typeof window !== 'undefined' && window.resultatdokumentAPI) ? 'pointer' : 'default',
                        fontFamily:'var(--font)' }}>
                      Lås denne stien
                    </button>
                  </>
                )}
              </Section>

              {/* ── Skyopplasting (DTM, sjå claude/dtm-modul.md) ── */}
              <Section title="Skyopplasting">
                <label style={{ display:'flex', alignItems:'flex-start', gap:8, cursor:'pointer' }}>
                  <input type="checkbox" checked={form.skyOpplastingResultatdokument || false}
                    onChange={e => set('skyOpplastingResultatdokument', e.target.checked)}
                    style={{ marginTop:2 }}/>
                  <span style={{ fontSize:12.5, color:'var(--text2)', lineHeight:1.6 }}>
                    Last siste versjon av resultatdokument opp til ein privat skybøtte, slik at dei
                    kan opnast frå mobil (via den vanlege nettsida — krev innlogging med same konto).
                    Berre siste versjon av kvart dokument er tilgjengeleg derifrå, ingen
                    revisjonshistorikk.
                  </span>
                </label>
              </Section>

              {/* ── Teikningsnummerering (DS-356) — gjeld KS, sjekklister og Leveranseplan ── */}
              <Section title="Teikningsnummerering">
                <p style={{ fontSize:12, color:'var(--text3)', lineHeight:1.6, margin:'0 0 10px' }}>
                  Korleis er teikningsnummera i dette prosjektet bygde? Valet styrer korleis Kvalitetssystemet og
                  sjekklistene les nummera, og korleis Leveranseplan lagar dei. Fag, type og etasje er alltid med.
                </p>
                <NummereringVal verdi={{ ...STANDARD_NUMMERERING, ...(form.nummerering || {}) }}
                  onEndre={n => set('nummerering', n)}/>
              </Section>

              </div>
              {/* ── Lagre-knapp (spenner over begge kolonnar) ── */}
              <div style={{ gridColumn:'1 / -1', display:'flex', gap:10, marginTop:12, paddingBottom:40 }}>
                <button onClick={lagreProsjekt}
                  disabled={!dirty}
                  style={{ padding:'10px 24px', borderRadius:'var(--r)',
                    border:'none',
                    background: dirty ? 'var(--brand)' : 'var(--bg4)',
                    color: dirty ? '#fff' : 'var(--text3)',
                    fontSize:14, fontWeight:700, cursor: dirty ? 'pointer' : 'default',
                    fontFamily:'var(--font)', transition:'all .15s' }}>
                  Lagre prosjektkort
                </button>
                {dirty && (
                  <span style={{ fontSize:12, color:'var(--warn)', alignSelf:'center', fontWeight:500 }}>
                    Ulagra endringar
                  </span>
                )}
              </div>

            </div>
          )}
        </div>
        )}
      </div>
    </div>
  )
}
