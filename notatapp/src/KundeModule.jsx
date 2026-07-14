import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'

// ── Brønnøysund org-oppslag ────────────────────────────────────────
async function sokBrreg(orgnr) {
  if (!orgnr || orgnr.replace(/\s/g, '').length < 9) return null
  try {
    const res = await fetch(`https://data.brreg.no/enhetsregisteret/api/enheter/${orgnr.replace(/\s/g, '')}`)
    if (!res.ok) return null
    const d = await res.json()
    return {
      namn: d.navn,
      orgnr: d.organisasjonsnummer,
      adresse: (d.forretningsadresse?.adresse || []).join(', '),
      postnr: d.forretningsadresse?.postnummer || '',
      poststad: d.forretningsadresse?.poststed || '',
      naeringskode: d.naeringskode1?.beskrivelse || '',
      organisasjonsform: d.organisasjonsform?.beskrivelse || '',
    }
  } catch { return null }
}

// ── Brønnøysund namn-søk ───────────────────────────────────────────
async function sokBrregNamn(namn) {
  if (!namn || namn.length < 2) return []
  try {
    const res = await fetch(
      `https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encodeURIComponent(namn)}&size=8`
    )
    const d = await res.json()
    return (d._embedded?.enheter || []).map(e => ({
      namn: e.navn,
      orgnr: e.organisasjonsnummer,
      adresse: (e.forretningsadresse?.adresse || []).join(', '),
      postnr: e.forretningsadresse?.postnummer || '',
      poststad: e.forretningsadresse?.poststed || '',
      naeringskode: e.naeringskode1?.beskrivelse || '',
    }))
  } catch { return [] }
}

const BRANSJAR = [
  'Privat utbyggjar','Offentleg byggherre','Burettslag/sameige','Næringseigedom',
  'Industri','Helse/omsorg','Utdanning','Kultur/idrett','Bustadutvikling','Anna',
]

const FAKTURERING = ['EHF (e-faktura)','E-post','Post','Anna']

const ROLLER = [
  'Dagleg leiar','Prosjektleiar','Eigar','Byggjeleiar','Innkjøpsansvarleg',
  'Fagansvarleg','Arkitekt','Rådgivar','Kontakt','Anna',
]

// ── Tom kunde ─────────────────────────────────────────────────────
function tomKunde() {
  return {
    companyName: '', orgNr: '',
    address: '', postnr: '', poststad: '',
    email: '', phone: '', website: '',
    bransje: '', organisasjonsform: '', naeringskode: '',
    invoiceAddress: '', invoicePostnr: '', invoicePoststad: '', invoiceEmail: '',
    invoiceMethod: '', paymentTerms: 30,
    invoiceSameAsVisit: true,
    notes: '',
    contacts: [], // { id, name, role, email, phone, mobile, isPrimary }
  }
}

// ══════════════════════════════════════════════════════════════════
export default function KundeModule({ userId, activeOfficeId }) {
  const [clients, setClients]     = useState([])
  const [selected, setSelected]   = useState(null)
  const [form, setForm]           = useState(null)
  const [dirty, setDirty]         = useState(false)
  const [loading, setLoading]     = useState(true)
  const [view, setView]           = useState('dashboard') // dashboard | detail
  const [searchQ, setSearchQ]     = useState('')
  const [orgLookup, setOrgLookup] = useState(false)
  const [brregResults, setBrregResults] = useState([])
  const [brregQuery, setBrregQuery]     = useState('')
  const searchRef = useRef(null)

  // ── Last kundar ──────────────────────────────────────────────
  const loadClients = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase.from('clients').select('*')
      .eq('user_id', userId)
      .order('company_name')
    setClients((data || []).map(c => ({
      id: c.id,
      companyName: c.company_name || '',
      orgNr: c.org_nr || '',
      officeId: c.office_id,
      details: c.details || {},
      createdAt: c.created_at,
    })))
    setLoading(false)
  }, [userId])

  useEffect(() => { loadClients() }, [loadClients])

  // ── Hjelpefunksjonar ─────────────────────────────────────────
  const allContacts = clients.reduce((acc, c) => {
    const contacts = c.details?.contacts || []
    return [...acc, ...contacts.map(ct => ({ ...ct, companyName: c.companyName, clientId: c.id }))]
  }, [])

  const filteredClients = clients.filter(c => {
    if (activeOfficeId && c.officeId && c.officeId !== activeOfficeId) return false
    if (!searchQ) return true
    const q = searchQ.toLowerCase()
    if (c.companyName.toLowerCase().includes(q)) return true
    if (c.orgNr?.includes(q)) return true
    const contacts = c.details?.contacts || []
    return contacts.some(ct => ct.name?.toLowerCase().includes(q) || ct.email?.toLowerCase().includes(q))
  })

  // ── Vel kunde ────────────────────────────────────────────────
  const selectClient = (id) => {
    if (dirty && !window.confirm('Du har ulagra endringar. Vil du forkaste dei?')) return
    setSelected(id)
    const c = clients.find(x => x.id === id)
    if (c) {
      setForm({ companyName: c.companyName, orgNr: c.orgNr, ...tomKunde(), ...c.details })
    }
    setView('detail')
    setDirty(false)
  }

  // ── Ny kunde ─────────────────────────────────────────────────
  const nyKunde = async () => {
    if (dirty && !window.confirm('Du har ulagra endringar. Vil du forkaste dei?')) return
    const id = Date.now()
    const row = {
      id, user_id: userId, company_name: '', org_nr: '',
      office_id: activeOfficeId, details: tomKunde(),
      created_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('clients').insert(row)
    if (!error) {
      await loadClients()
      setSelected(id)
      setForm(tomKunde())
      setView('detail')
      setDirty(false)
      // Fokuser på bedriftsnamn-feltet
      setTimeout(() => document.getElementById('k-companyName')?.focus(), 100)
    }
  }

  // ── Ny kunde frå Brønnøysund-søk ────────────────────────────
  const nyKundeFraBrreg = async (result) => {
    // Sjekk duplikat
    const existing = clients.find(c => c.orgNr === result.orgnr)
    if (existing) {
      alert(`«${result.namn}» (org.nr. ${result.orgnr}) finst allereie i kundelista.`)
      selectClient(existing.id)
      setBrregResults([])
      setBrregQuery('')
      return
    }
    const id = Date.now()
    const details = {
      ...tomKunde(),
      companyName: result.namn, orgNr: result.orgnr,
      address: result.adresse, postnr: result.postnr, poststad: result.poststad,
      naeringskode: result.naeringskode || '',
    }
    const row = {
      id, user_id: userId, company_name: result.namn, org_nr: result.orgnr,
      office_id: activeOfficeId, details,
      created_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('clients').insert(row)
    if (!error) {
      await loadClients()
      setSelected(id)
      setForm(details)
      setView('detail')
      setDirty(false)
      setBrregResults([])
      setBrregQuery('')
    }
  }

  // ── Lagre ────────────────────────────────────────────────────
  const lagreKunde = async () => {
    if (!selected || !form) return
    // Sjekk duplikat org.nr. (ikkje seg sjølv)
    if (form.orgNr) {
      const dup = clients.find(c => c.orgNr === form.orgNr && c.id !== selected)
      if (dup) {
        alert(`Org.nr. ${form.orgNr} er allereie registrert under «${dup.companyName}». Kvart firma skal berre ha éi oppføring.`)
        return
      }
    }
    await supabase.from('clients').update({
      company_name: form.companyName,
      org_nr: form.orgNr,
      details: form,
      updated_at: new Date().toISOString(),
    }).eq('id', selected).eq('user_id', userId)
    setDirty(false)
    await loadClients()
  }

  // ── Slett kunde ──────────────────────────────────────────────
  const slettKunde = async () => {
    if (!selected) return
    const c = clients.find(x => x.id === selected)
    if (!window.confirm(`Vil du slette «${c?.companyName || 'Ukjend'}» frå kundelista?\n\nDette kan ikkje angrast.`)) return
    await supabase.from('clients').delete().eq('id', selected).eq('user_id', userId)
    setSelected(null)
    setForm(null)
    setView('dashboard')
    await loadClients()
  }

  // ── Oppdater felt ────────────────────────────────────────────
  const set = (key, val) => { setForm(f => ({ ...f, [key]: val })); setDirty(true) }

  // ── Org.nr.-oppslag ──────────────────────────────────────────
  const doOrgLookup = async () => {
    if (!form?.orgNr) return
    setOrgLookup(true)
    const result = await sokBrreg(form.orgNr)
    setOrgLookup(false)
    if (!result) { alert('Fann ikkje organisasjonen i Brønnøysund-registeret.'); return }
    // Sjekk duplikat
    const dup = clients.find(c => c.orgNr === result.orgnr && c.id !== selected)
    if (dup) {
      alert(`Org.nr. ${result.orgnr} er allereie registrert under «${dup.companyName}».`)
      return
    }
    setForm(f => ({
      ...f, companyName: result.namn, orgNr: result.orgnr,
      address: result.adresse, postnr: result.postnr, poststad: result.poststad,
      naeringskode: result.naeringskode, organisasjonsform: result.organisasjonsform,
    }))
    setDirty(true)
  }

  // ── Kontaktperson CRUD ───────────────────────────────────────
  const addContact = () => {
    const ct = { id: Date.now(), name:'', role:'', email:'', phone:'', mobile:'', isPrimary: (form.contacts||[]).length===0 }
    set('contacts', [...(form.contacts || []), ct])
  }
  const updateContact = (ctId, key, val) => {
    set('contacts', (form.contacts||[]).map(c => c.id===ctId ? { ...c, [key]: val } : c))
  }
  const removeContact = (ctId) => {
    set('contacts', (form.contacts||[]).filter(c => c.id !== ctId))
  }
  const setPrimary = (ctId) => {
    set('contacts', (form.contacts||[]).map(c => ({ ...c, isPrimary: c.id === ctId })))
  }

  // ── Input-komponentar ────────────────────────────────────────
  const F = ({ label, id, type='text', half, third, quarter, ...props }) => (
    <div style={{ flex: quarter ? '0 0 25%' : third ? '0 0 33.33%' : half ? '0 0 50%' : 1, minWidth:0 }}>
      <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text3)',
        marginBottom:3, letterSpacing:'.03em' }}>{label}</label>
      {type === 'textarea' ? (
        <textarea id={`k-${id}`} value={form?.[id]||''} onChange={e => set(id, e.target.value)}
          rows={3} {...props}
          style={{ width:'100%', padding:'8px 10px', borderRadius:'var(--r)',
            border:'1.5px solid var(--border)', background:'var(--bg2)',
            fontSize:14, fontFamily:'var(--font)', color:'var(--text)',
            resize:'vertical', outline:'none', ...props.style }}/>
      ) : type === 'select' ? (
        <select id={`k-${id}`} value={form?.[id]||''} onChange={e => set(id, e.target.value)}
          style={{ width:'100%', padding:'8px 10px', borderRadius:'var(--r)',
            border:'1.5px solid var(--border)', background:'var(--bg2)',
            fontSize:14, fontFamily:'var(--font)', color:'var(--text)', outline:'none' }}>
          <option value="">— Vel —</option>
          {(props.options||[]).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input id={`k-${id}`} type={type} value={form?.[id]||''} onChange={e => set(id, e.target.value)}
          {...props}
          style={{ width:'100%', padding:'8px 10px', borderRadius:'var(--r)',
            border:'1.5px solid var(--border)', background:'var(--bg2)',
            fontSize:14, fontFamily:'var(--font)', color:'var(--text)',
            outline:'none', boxSizing:'border-box', ...props.style }}/>
      )}
    </div>
  )

  const Section = ({ title, children }) => (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:13, fontWeight:700, color:'var(--brand)', letterSpacing:'-0.01em',
        marginBottom:10, paddingBottom:6, borderBottom:'2px solid var(--brandbg2)' }}>{title}</div>
      {children}
    </div>
  )

  const Row = ({ children, gap=10 }) => (
    <div style={{ display:'flex', gap, marginBottom:8, flexWrap:'wrap' }}>{children}</div>
  )

  // ── Statistikk-kort ──────────────────────────────────────────
  const Stat = ({ label, value, accent }) => (
    <div style={{ flex:1, minWidth:140, padding:'18px 20px', borderRadius:12,
      background:'var(--bg2)', border:'1.5px solid var(--border)',
      boxShadow:'var(--shadow-sm)' }}>
      <div style={{ fontSize:28, fontWeight:800, color: accent || 'var(--brand)',
        letterSpacing:'-0.03em', fontFamily:'var(--mono)' }}>{value}</div>
      <div style={{ fontSize:12, fontWeight:600, color:'var(--text3)', marginTop:2 }}>{label}</div>
    </div>
  )

  // ══════════════════════════════════════════════════════════════
  return (
    <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

      {/* ── Sidebar ── */}
      <aside className="sidebar-brand" style={{
        width:240, minWidth:240, flexShrink:0,
        display:'flex', flexDirection:'column', overflow:'hidden',
      }}>
        {/* Header */}
        <div style={{ padding:'18px 16px 14px', borderBottom:'1px solid rgba(255,255,255,.12)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
            <div style={{ width:32, height:32, borderRadius:9,
              background:'rgba(255,255,255,.15)', display:'flex', alignItems:'center',
              justifyContent:'center', fontSize:16, fontWeight:800, color:'#fff',
              flexShrink:0, border:'1.5px solid rgba(255,255,255,.25)' }}>K</div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:16, color:'#fff', letterSpacing:'-0.02em' }}>Kundar</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.55)', fontWeight:500 }}>
                {clients.length} bedrifter · {allContacts.length} kontaktar
              </div>
            </div>
          </div>

          {/* Ny kunde-knapp */}
          <button onClick={nyKunde}
            style={{ width:'100%', padding:'9px 12px', borderRadius:'var(--r)',
              border:'1.5px solid rgba(255,255,255,.35)', background:'rgba(255,255,255,.12)',
              color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer',
              fontFamily:'var(--font)', textAlign:'left', marginBottom:8 }}>
            ＋ Ny kunde
          </button>

          {/* Søk i sidebar */}
          <input ref={searchRef} value={searchQ} onChange={e => setSearchQ(e.target.value)}
            placeholder="Søk firma eller kontakt…"
            style={{ width:'100%', padding:'7px 10px', borderRadius:'var(--r)',
              border:'1.5px solid rgba(255,255,255,.2)', background:'rgba(255,255,255,.08)',
              color:'#fff', fontSize:12, fontFamily:'var(--font)', outline:'none',
              boxSizing:'border-box' }}/>
        </div>

        {/* Kundeliste */}
        <div style={{ flex:1, overflowY:'auto', paddingTop:4 }}>
          {/* Dashboard-lenke */}
          <div onClick={() => { setView('dashboard'); setSelected(null); setForm(null) }}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 16px',
              cursor:'pointer', borderLeft: `3px solid ${view==='dashboard' && !selected ? 'rgba(255,255,255,.85)' : 'transparent'}`,
              background: view==='dashboard' && !selected ? 'rgba(255,255,255,.15)' : 'transparent' }}
            onMouseEnter={e => { if (view!=='dashboard') e.currentTarget.style.background='rgba(255,255,255,.06)' }}
            onMouseLeave={e => { if (view!=='dashboard') e.currentTarget.style.background='transparent' }}>
            <span style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,.7)' }}>Oversikt</span>
          </div>

          <div style={{ height:1, background:'rgba(255,255,255,.08)', margin:'4px 12px' }}/>

          {loading && <div style={{ padding:'12px 16px', color:'rgba(255,255,255,.4)', fontSize:12 }}>Lastar…</div>}
          {!loading && filteredClients.length === 0 && searchQ && (
            <div style={{ padding:'16px', color:'rgba(255,255,255,.35)', fontSize:12, textAlign:'center' }}>
              Ingen treff for «{searchQ}»
            </div>
          )}
          {filteredClients.map(c => {
            const ac = selected === c.id
            const contactCount = (c.details?.contacts || []).length
            return (
              <div key={c.id} onClick={() => selectClient(c.id)}
                style={{ display:'flex', alignItems:'center', gap:8,
                  padding:'8px 12px 8px 16px', cursor:'pointer',
                  background: ac ? 'rgba(255,255,255,.15)' : 'transparent',
                  borderLeft: `3px solid ${ac ? 'rgba(255,255,255,.85)' : 'transparent'}`,
                  transition:'background .1s' }}
                onMouseEnter={e => { if (!ac) e.currentTarget.style.background='rgba(255,255,255,.06)' }}
                onMouseLeave={e => { if (!ac) e.currentTarget.style.background='transparent' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight: ac ? 700 : 500,
                    color: ac ? '#fff' : 'rgba(255,255,255,.8)',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {c.companyName || 'Ny kunde'}
                  </div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,.4)', marginTop:1 }}>
                    {c.orgNr ? `Org. ${c.orgNr}` : ''}{contactCount > 0 ? ` · ${contactCount} kontakt${contactCount > 1 ? 'ar' : ''}` : ''}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ padding:'8px 16px', borderTop:'1px solid rgba(255,255,255,.1)',
          fontSize:11, color:'rgba(255,255,255,.3)' }}>
          {clients.length} kundar totalt
        </div>
      </aside>

      {/* ── Hovudinnhald ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Topbar */}
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 16px',
          height:50, flexShrink:0, background:'var(--brand)',
          borderBottom:'1px solid rgba(255,255,255,.1)' }}>
          <span style={{ fontSize:15, fontWeight:800, color:'#fff', letterSpacing:'-0.02em' }}>Kundar</span>
          {form && (
            <>
              <span style={{ color:'rgba(255,255,255,.3)' }}>·</span>
              <span style={{ fontSize:13, color:'rgba(255,255,255,.7)' }}>{form.companyName || 'Ny kunde'}</span>
              <div style={{ flex:1 }}/>
              {dirty && (
                <button onClick={lagreKunde}
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

        {/* Innhald */}
        <div style={{ flex:1, overflowY:'auto', padding:'22px 28px' }}>

          {/* ════ DASHBOARD ════ */}
          {view === 'dashboard' && (
            <div style={{ maxWidth:820 }}>
              {/* Statistikk */}
              <div style={{ display:'flex', gap:14, marginBottom:28, flexWrap:'wrap' }}>
                <Stat label="Kundar" value={clients.length}/>
                <Stat label="Kontaktpersonar" value={allContacts.length} accent="var(--brand2)"/>
                <Stat label="Med org.nr." value={clients.filter(c => c.orgNr).length} accent="var(--brand3)"/>
                <Stat label="Utan kontakt" value={clients.filter(c => !(c.details?.contacts||[]).length).length} accent="var(--warn)"/>
              </div>

              {/* Brønnøysund-søk */}
              <div style={{ marginBottom:28 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:10 }}>
                  Legg til kunde frå Brønnøysundregistera
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <input value={brregQuery} onChange={e => setBrregQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sokBrregNamn(brregQuery).then(setBrregResults)}
                    placeholder="Søk etter bedriftsnamn…"
                    style={{ flex:1, padding:'10px 14px', borderRadius:'var(--r)',
                      border:'1.5px solid var(--border)', background:'var(--bg2)',
                      fontSize:14, fontFamily:'var(--font)', color:'var(--text)', outline:'none' }}/>
                  <button onClick={() => sokBrregNamn(brregQuery).then(setBrregResults)}
                    style={{ padding:'10px 18px', borderRadius:'var(--r)',
                      border:'1.5px solid var(--border)', background:'var(--bg3)',
                      fontSize:13, fontWeight:600, cursor:'pointer', color:'var(--text2)',
                      fontFamily:'var(--font)', whiteSpace:'nowrap' }}>
                    Søk i Brønnøysund
                  </button>
                </div>
                {brregResults.length > 0 && (
                  <div style={{ border:'1.5px solid var(--brand3)', borderRadius:'var(--r2)',
                    marginTop:8, overflow:'hidden', background:'var(--bg2)', boxShadow:'var(--shadow)' }}>
                    {brregResults.map((r, i) => {
                      const exists = clients.some(c => c.orgNr === r.orgnr)
                      return (
                        <div key={i} onClick={() => nyKundeFraBrreg(r)}
                          style={{ padding:'10px 14px', cursor:'pointer',
                            borderBottom: i < brregResults.length - 1 ? '1px solid var(--border)' : 'none',
                            transition:'background .1s',
                            opacity: exists ? .5 : 1 }}
                          onMouseEnter={e => e.currentTarget.style.background='var(--bg3)'}
                          onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>{r.namn}</span>
                            {exists && <span style={{ fontSize:10, padding:'2px 6px', borderRadius:4,
                              background:'var(--brandbg)', color:'var(--brand)', fontWeight:700 }}>finst</span>}
                          </div>
                          <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
                            Org. {r.orgnr} · {r.adresse}, {r.postnr} {r.poststad}
                            {r.naeringskode ? ` · ${r.naeringskode}` : ''}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Søk etter kontaktperson */}
              <div style={{ marginBottom:28 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:10 }}>
                  Søk etter kontaktperson
                </div>
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  placeholder="Namn, e-post eller firma…"
                  style={{ width:'100%', maxWidth:500, padding:'10px 14px', borderRadius:'var(--r)',
                    border:'1.5px solid var(--border)', background:'var(--bg2)',
                    fontSize:14, fontFamily:'var(--font)', color:'var(--text)', outline:'none' }}/>
                {searchQ && allContacts.filter(ct =>
                  ct.name?.toLowerCase().includes(searchQ.toLowerCase()) ||
                  ct.email?.toLowerCase().includes(searchQ.toLowerCase()) ||
                  ct.companyName?.toLowerCase().includes(searchQ.toLowerCase())
                ).length > 0 && (
                  <div style={{ marginTop:8, border:'1px solid var(--border)', borderRadius:'var(--r2)',
                    overflow:'hidden', background:'var(--bg2)' }}>
                    {allContacts.filter(ct =>
                      ct.name?.toLowerCase().includes(searchQ.toLowerCase()) ||
                      ct.email?.toLowerCase().includes(searchQ.toLowerCase()) ||
                      ct.companyName?.toLowerCase().includes(searchQ.toLowerCase())
                    ).slice(0, 10).map((ct, i) => (
                      <div key={ct.id || i} onClick={() => selectClient(ct.clientId)}
                        style={{ padding:'8px 14px', cursor:'pointer',
                          borderBottom:'1px solid var(--border)', transition:'background .1s' }}
                        onMouseEnter={e => e.currentTarget.style.background='var(--bg3)'}
                        onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{ct.name || '—'}</div>
                        <div style={{ fontSize:11, color:'var(--text3)' }}>
                          {ct.role ? `${ct.role} · ` : ''}{ct.companyName}{ct.email ? ` · ${ct.email}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Siste kundar */}
              {clients.length > 0 && (
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:10 }}>
                    Siste registrerte kundar
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:10 }}>
                    {[...clients].sort((a, b) => (b.createdAt||'').localeCompare(a.createdAt||'')).slice(0, 6).map(c => (
                      <div key={c.id} onClick={() => selectClient(c.id)}
                        style={{ padding:'14px 16px', borderRadius:10, background:'var(--bg2)',
                          border:'1.5px solid var(--border)', cursor:'pointer',
                          transition:'border-color .15s, box-shadow .15s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor='var(--brand3)'; e.currentTarget.style.boxShadow='var(--shadow)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.boxShadow='none' }}>
                        <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:4 }}>
                          {c.companyName || 'Ukjend'}
                        </div>
                        <div style={{ fontSize:11, color:'var(--text3)' }}>
                          {c.orgNr ? `Org. ${c.orgNr}` : 'Ingen org.nr.'}
                          {' · '}{(c.details?.contacts||[]).length} kontakt{(c.details?.contacts||[]).length !== 1 ? 'ar' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ DETALJ-VISNING ════ */}
          {view === 'detail' && form && (
            <div style={{ maxWidth:780 }}>

              {/* ── Bedrift ── */}
              <Section title="Bedrift">
                <Row>
                  <F label="Org.nr." id="orgNr" half/>
                  <div style={{ display:'flex', alignItems:'flex-end', paddingBottom:1 }}>
                    <button onClick={doOrgLookup} disabled={orgLookup}
                      style={{ padding:'8px 14px', borderRadius:'var(--r)',
                        border:'1.5px solid var(--border)', background:'var(--bg3)',
                        fontSize:12, fontWeight:600, cursor:'pointer', color:'var(--text2)',
                        fontFamily:'var(--font)', whiteSpace:'nowrap' }}>
                      {orgLookup ? 'Søkjer…' : 'Hent frå Brønnøysund'}
                    </button>
                  </div>
                </Row>
                <Row><F label="Bedriftsnamn" id="companyName"/></Row>
                <Row>
                  <F label="Adresse" id="address"/>
                  <F label="Postnr." id="postnr" quarter/>
                  <F label="Poststad" id="poststad" third/>
                </Row>
                <Row>
                  <F label="E-post" id="email" type="email"/>
                  <F label="Telefon" id="phone" type="tel"/>
                  <F label="Heimeside" id="website" type="url" placeholder="https://"/>
                </Row>
                <Row>
                  <F label="Bransje" id="bransje" type="select" options={BRANSJAR}/>
                  {form.naeringskode && (
                    <div style={{ flex:1 }}>
                      <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text3)',
                        marginBottom:3, letterSpacing:'.03em' }}>Næringskode (frå Brreg)</label>
                      <div style={{ padding:'8px 10px', fontSize:13, color:'var(--text3)', fontStyle:'italic' }}>
                        {form.naeringskode}
                      </div>
                    </div>
                  )}
                </Row>
              </Section>

              {/* ── Fakturering ── */}
              <Section title="Fakturering">
                <div style={{ marginBottom:10 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13,
                    color:'var(--text2)', cursor:'pointer' }}>
                    <input type="checkbox" checked={form.invoiceSameAsVisit ?? true}
                      onChange={e => set('invoiceSameAsVisit', e.target.checked)}
                      style={{ width:16, height:16 }}/>
                    Fakturaadresse same som besøksadresse
                  </label>
                </div>
                {!form.invoiceSameAsVisit && (
                  <Row>
                    <F label="Fakturaadresse" id="invoiceAddress"/>
                    <F label="Postnr." id="invoicePostnr" quarter/>
                    <F label="Poststad" id="invoicePoststad" third/>
                  </Row>
                )}
                <Row>
                  <F label="Faktura-epost" id="invoiceEmail" type="email" placeholder="faktura@firma.no"/>
                  <F label="Faktureringsmåte" id="invoiceMethod" type="select" options={FAKTURERING}/>
                  <F label="Betalingsfrist (dagar)" id="paymentTerms" type="number" quarter/>
                </Row>
              </Section>

              {/* ── Kontaktpersonar ── */}
              <Section title="Kontaktpersonar">
                {(form.contacts || []).length === 0 && (
                  <div style={{ padding:'12px 0', color:'var(--text3)', fontSize:13 }}>
                    Ingen kontaktpersonar registrert enno.
                  </div>
                )}
                {(form.contacts || []).map((ct, idx) => (
                  <div key={ct.id} style={{
                    padding:'14px 16px', marginBottom:10, borderRadius:10,
                    background: ct.isPrimary ? 'var(--brandbg)' : 'var(--bg3)',
                    border: ct.isPrimary ? '1.5px solid var(--brand3)' : '1.5px solid var(--border)',
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                      <span style={{ fontSize:12, fontWeight:700, color:'var(--text2)' }}>
                        Kontakt {idx + 1}
                      </span>
                      {ct.isPrimary && (
                        <span style={{ fontSize:10, padding:'2px 8px', borderRadius:4,
                          background:'var(--brand)', color:'#fff', fontWeight:700 }}>
                          Hovudkontakt
                        </span>
                      )}
                      <div style={{ flex:1 }}/>
                      {!ct.isPrimary && (
                        <button onClick={() => setPrimary(ct.id)}
                          style={{ fontSize:11, padding:'3px 8px', borderRadius:4,
                            border:'1px solid var(--border)', background:'var(--bg2)',
                            color:'var(--text3)', cursor:'pointer', fontFamily:'var(--font)' }}>
                          Sett som hovudkontakt
                        </button>
                      )}
                      <button onClick={() => removeContact(ct.id)}
                        style={{ fontSize:11, padding:'3px 8px', borderRadius:4,
                          border:'1px solid var(--border)', background:'var(--bg2)',
                          color:'var(--danger)', cursor:'pointer', fontFamily:'var(--font)' }}>
                        Fjern
                      </button>
                    </div>
                    <div style={{ display:'flex', gap:10, marginBottom:6, flexWrap:'wrap' }}>
                      <div style={{ flex:1, minWidth:160 }}>
                        <label style={{ fontSize:10, color:'var(--text3)', fontWeight:600 }}>Namn</label>
                        <input value={ct.name||''} onChange={e => updateContact(ct.id, 'name', e.target.value)}
                          style={{ width:'100%', padding:'6px 8px', borderRadius:5,
                            border:'1px solid var(--border)', background:'var(--bg2)',
                            fontSize:13, fontFamily:'var(--font)', color:'var(--text)', outline:'none' }}/>
                      </div>
                      <div style={{ flex:1, minWidth:140 }}>
                        <label style={{ fontSize:10, color:'var(--text3)', fontWeight:600 }}>Rolle</label>
                        <select value={ct.role||''} onChange={e => updateContact(ct.id, 'role', e.target.value)}
                          style={{ width:'100%', padding:'6px 8px', borderRadius:5,
                            border:'1px solid var(--border)', background:'var(--bg2)',
                            fontSize:13, fontFamily:'var(--font)', color:'var(--text)', outline:'none' }}>
                          <option value="">— Vel rolle —</option>
                          {ROLLER.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                      <div style={{ flex:1, minWidth:160 }}>
                        <label style={{ fontSize:10, color:'var(--text3)', fontWeight:600 }}>E-post</label>
                        <input type="email" value={ct.email||''} onChange={e => updateContact(ct.id, 'email', e.target.value)}
                          style={{ width:'100%', padding:'6px 8px', borderRadius:5,
                            border:'1px solid var(--border)', background:'var(--bg2)',
                            fontSize:13, fontFamily:'var(--font)', color:'var(--text)', outline:'none' }}/>
                      </div>
                      <div style={{ flex:'0 0 130px' }}>
                        <label style={{ fontSize:10, color:'var(--text3)', fontWeight:600 }}>Telefon</label>
                        <input type="tel" value={ct.phone||''} onChange={e => updateContact(ct.id, 'phone', e.target.value)}
                          style={{ width:'100%', padding:'6px 8px', borderRadius:5,
                            border:'1px solid var(--border)', background:'var(--bg2)',
                            fontSize:13, fontFamily:'var(--font)', color:'var(--text)', outline:'none' }}/>
                      </div>
                      <div style={{ flex:'0 0 130px' }}>
                        <label style={{ fontSize:10, color:'var(--text3)', fontWeight:600 }}>Mobil</label>
                        <input type="tel" value={ct.mobile||''} onChange={e => updateContact(ct.id, 'mobile', e.target.value)}
                          style={{ width:'100%', padding:'6px 8px', borderRadius:5,
                            border:'1px solid var(--border)', background:'var(--bg2)',
                            fontSize:13, fontFamily:'var(--font)', color:'var(--text)', outline:'none' }}/>
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={addContact}
                  style={{ padding:'8px 16px', borderRadius:'var(--r)',
                    border:'1.5px dashed var(--border2)', background:'transparent',
                    fontSize:13, fontWeight:600, cursor:'pointer', color:'var(--text3)',
                    fontFamily:'var(--font)', transition:'all .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='var(--brand3)'; e.currentTarget.style.color='var(--brand)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border2)'; e.currentTarget.style.color='var(--text3)' }}>
                  ＋ Legg til kontaktperson
                </button>
              </Section>

              {/* ── Notat ── */}
              <Section title="Notat">
                <F label="" id="notes" type="textarea" placeholder="Interne notat om kunden…"/>
              </Section>

              {/* ── Handlingsrad ── */}
              <div style={{ display:'flex', gap:10, marginTop:12, paddingBottom:40, alignItems:'center' }}>
                <button onClick={lagreKunde} disabled={!dirty}
                  style={{ padding:'10px 24px', borderRadius:'var(--r)', border:'none',
                    background: dirty ? 'var(--brand)' : 'var(--bg4)',
                    color: dirty ? '#fff' : 'var(--text3)',
                    fontSize:14, fontWeight:700, cursor: dirty ? 'pointer' : 'default',
                    fontFamily:'var(--font)', transition:'all .15s' }}>
                  Lagre kunde
                </button>
                {dirty && (
                  <span style={{ fontSize:12, color:'var(--warn)', fontWeight:500 }}>Ulagra endringar</span>
                )}
                <div style={{ flex:1 }}/>
                <button onClick={slettKunde}
                  style={{ padding:'8px 16px', borderRadius:'var(--r)',
                    border:'1px solid var(--danger)', background:'transparent',
                    fontSize:12, fontWeight:600, cursor:'pointer', color:'var(--danger)',
                    fontFamily:'var(--font)' }}>
                  Slett kunde
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
