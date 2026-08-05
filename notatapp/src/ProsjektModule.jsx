import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

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
  }
}

// ══════════════════════════════════════════════════════════════════
export default function ProsjektModule({ userId, projects: existingProjects, offices,
                                          activeOfficeId, addProject, onProjectCreated }) {
  const [prosjektList, setProsjektList] = useState([])
  const [selected, setSelected]         = useState(null) // project id
  const [form, setForm]                 = useState(null)  // prosjektkort data
  const [dirty, setDirty]               = useState(false)
  const [loading, setLoading]           = useState(true)
  const [geoResults, setGeoResults]     = useState([])
  const [geoQuery, setGeoQuery]         = useState('')
  const [orgLookup, setOrgLookup]       = useState({ field: null, loading: false })
  const [filter, setFilter]             = useState('alle') // alle|tilbod|aktiv|arkiv
  const [sidebarWidth]                  = useState(240)

  // ── Last prosjekt med detaljar ────────────────────────────────
  const loadProsjekt = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase.from('projects').select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setProsjektList((data || []).map(p => ({
      id: p.id,
      name: p.name,
      officeId: p.office_id,
      projectNumber: p.project_number || '',
      status: p.project_status || 'tilbod',
      details: p.details || {},
      createdAt: p.created_at,
    })))
    setLoading(false)
  }, [userId])

  useEffect(() => { loadProsjekt() }, [loadProsjekt])

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
  }

  // ── Nytt prosjekt ─────────────────────────────────────────────
  const nyttProsjekt = async () => {
    if (dirty && !window.confirm('Du har ulagra endringar. Vil du forkaste dei?')) return
    const nr = genererProsjektnummer(prosjektList.map(p => p.projectNumber))
    const id = Date.now()
    const row = {
      id, user_id: userId, name: `Nytt prosjekt ${nr}`,
      favorite: false, type: 'work',
      office_id: activeOfficeId,
      project_number: nr, project_status: 'tilbod',
      details: tomtProsjekt(),
      created_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('projects').insert(row)
    if (!error) {
      await loadProsjekt()
      setSelected(id)
      setForm({ ...tomtProsjekt(), projectNumber: nr, status: 'tilbod', name: row.name })
      setDirty(false)
    }
  }

  // ── Lagre prosjekt ────────────────────────────────────────────
  const lagreProsjekt = async () => {
    if (!selected || !form) return
    const { projectNumber, status, name, ...details } = form
    await supabase.from('projects').update({
      name: name || `Prosjekt ${projectNumber}`,
      project_number: projectNumber,
      project_status: status,
      details,
      updated_at: new Date().toISOString(),
    }).eq('id', selected).eq('user_id', userId)
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
    set('status', nyStatus)
    if (nyStatus === 'sendt' && !form.sentDate) set('sentDate', new Date().toISOString().slice(0, 10))
    // Auto-lagre statusendring
    await supabase.from('projects').update({
      project_status: nyStatus,
      updated_at: new Date().toISOString(),
    }).eq('id', selected).eq('user_id', userId)
    setDirty(false)
    await loadProsjekt()
  }

  // ── Filter ────────────────────────────────────────────────────
  const filteredList = prosjektList.filter(p => {
    if (activeOfficeId && p.officeId !== activeOfficeId) return false
    if (filter === 'tilbod') return p.status === 'tilbod' || p.status === 'sendt'
    if (filter === 'aktiv')  return p.status === 'aktiv'
    if (filter === 'arkiv')  return p.status === 'tapt' || p.status === 'fullfort'
    return true
  })

  // ── Input-komponent ───────────────────────────────────────────
  const F = ({ label, id, type='text', half, third, quarter, ...props }) => (
    <div style={{ flex: quarter ? '0 0 25%' : third ? '0 0 33.33%' : half ? '0 0 50%' : 1, minWidth: 0 }}>
      <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text3)',
        marginBottom:3, letterSpacing:'.03em' }}>{label}</label>
      {type === 'textarea' ? (
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

  // ── Seksjon-wrapper ───────────────────────────────────────────
  const Section = ({ title, children }) => (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:13, fontWeight:700, color:'var(--brand)', letterSpacing:'-0.01em',
        marginBottom:10, paddingBottom:6, borderBottom:'2px solid var(--brandbg2)' }}>
        {title}
      </div>
      {children}
    </div>
  )

  const Row = ({ children, gap=10 }) => (
    <div style={{ display:'flex', gap, marginBottom:8 }}>{children}</div>
  )

  // ══════════════════════════════════════════════════════════════
  return (
    <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

      {/* ── Sidebar: prosjektliste ── */}
      <aside className="sidebar-brand" style={{
        width:sidebarWidth, minWidth:sidebarWidth, flexShrink:0,
        display:'flex', flexDirection:'column', overflow:'hidden',
      }}>
        {/* Header */}
        <div style={{ padding:'18px 16px 14px', borderBottom:'1px solid rgba(255,255,255,.12)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
            <div style={{ width:32, height:32, borderRadius:9,
              background:'rgba(255,255,255,.15)', display:'flex', alignItems:'center',
              justifyContent:'center', fontSize:16, fontWeight:800, color:'#fff',
              flexShrink:0, border:'1.5px solid rgba(255,255,255,.25)' }}>P</div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:16, color:'#fff', letterSpacing:'-0.02em' }}>Prosjekt</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.55)', fontWeight:500 }}>
                {filteredList.length} prosjekt
              </div>
            </div>
          </div>

          {/* Nytt prosjekt-knapp */}
          <button onClick={nyttProsjekt}
            style={{ width:'100%', padding:'9px 12px', borderRadius:'var(--r)',
              border:'1.5px solid rgba(255,255,255,.35)', background:'rgba(255,255,255,.12)',
              color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer',
              fontFamily:'var(--font)', textAlign:'left' }}>
            ＋ Nytt prosjekt
          </button>
        </div>

        {/* Filter-pills */}
        <div style={{ display:'flex', gap:4, padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,.08)' }}>
          {[['alle','Alle'],['tilbod','Tilbod'],['aktiv','Aktive'],['arkiv','Arkiv']].map(([k,l]) => (
            <button key={k} onClick={() => setFilter(k)}
              style={{ flex:1, padding:'4px 0', borderRadius:5, border:'none',
                background: filter===k ? 'rgba(255,255,255,.2)' : 'transparent',
                color: filter===k ? '#fff' : 'rgba(255,255,255,.5)',
                fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)' }}>
              {l}
            </button>
          ))}
        </div>

        {/* Liste */}
        <div style={{ flex:1, overflowY:'auto', paddingTop:4 }}>
          {loading && <div style={{ padding:'12px 16px', color:'rgba(255,255,255,.4)', fontSize:12 }}>Lastar…</div>}
          {!loading && filteredList.length === 0 && (
            <div style={{ padding:'16px', color:'rgba(255,255,255,.35)', fontSize:12, textAlign:'center' }}>
              Ingen prosjekt enno
            </div>
          )}
          {filteredList.map(p => {
            const ac = selected === p.id
            const sc = STATUS_COLORS[p.status] || '#4A7560'
            return (
              <div key={p.id} onClick={() => selectProject(p.id)}
                style={{ display:'flex', alignItems:'center', gap:8,
                  padding:'8px 12px 8px 16px', cursor:'pointer',
                  background: ac ? 'rgba(255,255,255,.15)' : 'transparent',
                  borderLeft: `3px solid ${ac ? 'rgba(255,255,255,.85)' : 'transparent'}`,
                  transition:'background .1s' }}
                onMouseEnter={e => { if (!ac) e.currentTarget.style.background='rgba(255,255,255,.06)' }}
                onMouseLeave={e => { if (!ac) e.currentTarget.style.background='transparent' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:ac ? 700 : 500, color: ac ? '#fff' : 'rgba(255,255,255,.8)',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,.45)', marginTop:1, display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontFamily:'var(--mono)' }}>{p.projectNumber || '—'}</span>
                    <span style={{ padding:'1px 6px', borderRadius:3,
                      background:sc, color:'#fff', fontSize:9, fontWeight:700,
                      letterSpacing:'.04em', textTransform:'uppercase' }}>
                      {STATUS_LABELS[p.status] || p.status}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Botntelling */}
        <div style={{ padding:'8px 16px', borderTop:'1px solid rgba(255,255,255,.1)',
          fontSize:11, color:'rgba(255,255,255,.3)' }}>
          {prosjektList.filter(p => p.status === 'aktiv').length} aktive prosjekt
        </div>
      </aside>

      {/* ── Hovudinnhald: prosjektkort ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Topbar */}
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 16px',
          height:50, flexShrink:0, background:'var(--brand)',
          borderBottom:'1px solid rgba(255,255,255,.1)' }}>
          <span style={{ fontSize:15, fontWeight:800, color:'#fff', letterSpacing:'-0.02em' }}>
            Prosjekt
          </span>
          {form && (
            <>
              <span style={{ color:'rgba(255,255,255,.3)' }}>·</span>
              <span style={{ fontSize:13, color:'rgba(255,255,255,.7)', fontFamily:'var(--mono)' }}>
                {form.projectNumber}
              </span>
              <span style={{ fontSize:13, color:'rgba(255,255,255,.7)' }}>{form.name}</span>
              <div style={{ flex:1 }}/>
              {dirty && (
                <button onClick={lagreProsjekt}
                  style={{ padding:'6px 16px', borderRadius:'var(--r)',
                    border:'1.5px solid rgba(255,255,255,.4)',
                    background:'rgba(255,255,255,.18)', color:'#fff',
                    fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'var(--font)' }}>
                  Lagre
                </button>
              )}
            </>
          )}
        </div>

        {/* Prosjektkort */}
        <div style={{ flex:1, overflowY:'auto', padding:'22px 28px' }}>
          {!form ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
              justifyContent:'center', height:'100%', gap:16 }}>
              <div style={{ width:72, height:72, borderRadius:18, background:'var(--brandbg2)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:32, fontWeight:900, color:'var(--brand)', fontFamily:'var(--font)' }}>P</div>
              <p style={{ fontSize:14, color:'var(--text3)', textAlign:'center', maxWidth:360, lineHeight:1.7 }}>
                Vel eit prosjekt frå lista til venstre, eller opprett eit nytt prosjekt.
              </p>
            </div>
          ) : (
            <div style={{ maxWidth:780 }}>

              {/* ── Grunndata ── */}
              <Section title="Grunndata">
                <Row>
                  <F label="Prosjektnummer" id="projectNumber" style={{ fontFamily:'var(--mono)', fontWeight:700 }}/>
                  <F label="Prosjektnamn" id="name"/>
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
                <Row><F label="Kort prosjektbeskriving" id="description" type="textarea"/></Row>
              </Section>

              {/* ── Kunde ── */}
              <Section title="Kunde">
                <Row>
                  <F label="Org.nr." id="clientOrgNr" half/>
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
                <Row><F label="Firmanamn / Namn" id="clientName"/></Row>
                <Row>
                  <F label="Adresse" id="clientAddress"/>
                  <F label="Postnr." id="clientPostnr" quarter/>
                  <F label="Poststad" id="clientPoststad" third/>
                </Row>
                <Row>
                  <F label="Kontaktperson" id="clientContactName"/>
                  <F label="E-post" id="clientContactEmail" type="email"/>
                  <F label="Telefon" id="clientContactPhone" type="tel"/>
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
                      <F label="Org.nr." id="tiltakshavarOrgNr" half/>
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
                    <Row><F label="Firmanamn / Namn" id="tiltakshavarName"/></Row>
                    <Row><F label="Adresse" id="tiltakshavarAddress"/></Row>
                    <Row>
                      <F label="Kontaktperson" id="tiltakshavarContactName"/>
                      <F label="E-post" id="tiltakshavarContactEmail" type="email"/>
                      <F label="Telefon" id="tiltakshavarContactPhone" type="tel"/>
                    </Row>
                  </>
                )}
              </Section>

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
                  <F label="Adresse" id="propertyAddress"/>
                  <F label="Postnr." id="propertyPostnr" quarter/>
                  <F label="Poststad" id="propertyPoststad" third/>
                </Row>
                <Row>
                  <F label="Kommune" id="propertyKommune"/>
                  <F label="Kommunenr." id="propertyKommunenr" quarter/>
                </Row>
                <Row>
                  <F label="Gnr." id="propertyGnr" quarter/>
                  <F label="Bnr." id="propertyBnr" quarter/>
                  <F label="Festenr." id="propertyFestenr" quarter/>
                  <F label="Seksjonsnr." id="propertySeksjonsnr" quarter/>
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
                  <F label="BRA (m²)" id="bra" type="number" quarter/>
                </Row>
                <Row><F label="Beskriving av tiltaket" id="tiltakDescription" type="textarea"/></Row>
              </Section>

              {/* ── Tilbod ── */}
              <Section title="Tilbod og økonomi">
                <Row>
                  <F label="Tilbodspris (kr)" id="offerPrice" type="number"/>
                  <F label="Estimerte timar" id="estimatedHours" type="number"/>
                  <F label="Sendt dato" id="sentDate" type="date"/>
                </Row>
                {(form.status === 'aktiv' || form.status === 'fullfort') && (
                  <Row>
                    <F label="Faktiske timar" id="actualHours" type="number"/>
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

              {/* ── Lagre-knapp ── */}
              <div style={{ display:'flex', gap:10, marginTop:12, paddingBottom:40 }}>
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
      </div>
    </div>
  )
}
