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
  'Sakbehandlar','Fagansvarleg','Arkitekt','Rådgivar','Kontakt','Anna',
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
    contacts: [], // { id, name, role, avdeling, email, phone, mobile, isPrimary }
  }
}

// ── Stabile inndata-komponentar (module-nivå, så fokus ikkje forsvinn ved kvar tastetrykk) ──
const INN = { width: '100%', padding: '8px 10px', borderRadius: 'var(--r)', border: '1.5px solid var(--border)', background: 'var(--bg2)', fontSize: 14, fontFamily: 'var(--font)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }
function FeltInput({ form, set, label, id, type = 'text', half, third, quarter, options, ...props }) {
  return (
    <div style={{ flex: quarter ? '0 0 25%' : third ? '0 0 33.33%' : half ? '0 0 50%' : 1, minWidth: 0 }}>
      {label && <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 3, letterSpacing: '.03em' }}>{label}</label>}
      {type === 'textarea'
        ? <textarea id={`k-${id}`} value={form?.[id] || ''} onChange={e => set(id, e.target.value)} rows={3} {...props} style={{ ...INN, resize: 'vertical' }}/>
        : type === 'select'
          ? <select id={`k-${id}`} value={form?.[id] || ''} onChange={e => set(id, e.target.value)} style={INN}><option value="">— Vel —</option>{(options || []).map(o => <option key={o} value={o}>{o}</option>)}</select>
          : <input id={`k-${id}`} type={type} value={form?.[id] || ''} onChange={e => set(id, e.target.value)} {...props} style={INN}/>}
    </div>
  )
}
function Seksjon({ title, children, hogre }) {
  return (
    <div style={{ marginBottom: 22, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.06em', flex: 1 }}>{title}</div>{hogre}
      </div>
      {children}
    </div>
  )
}
const Rad = ({ children }) => <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>{children}</div>
const STATUS_NAMN = { tilbod: 'Tilbod', sendt: 'Sendt', aktiv: 'Aktiv', tapt: 'Tapt', fullfort: 'Fullført' }
const STATUS_FARGE = { tilbod: '#2D6A4F', sendt: '#1565C0', aktiv: '#166534', tapt: '#B91C1C', fullfort: '#4A7560' }
const norm = (s) => String(s || '').trim().toLowerCase()
const orgNorm = (s) => String(s || '').replace(/\s/g, '')

const TAB = (a) => ({ padding: '6px 16px', border: '1.5px solid ' + (a ? '#0A0A0A' : 'transparent'), borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 13, fontWeight: a ? 700 : 500, background: a ? '#0A0A0A' : 'transparent', color: a ? '#fff' : 'var(--text2)' })
const SMAL = { padding: '6px 9px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', fontSize: 13, fontFamily: 'var(--font)', color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box' }

// ══════════════════════════════════════════════════════════════
//  KundeModule (Kontordrift → Kundar). Landingsside med søk og kort; kunde-vindauge med fanene Kundeinfo · Kontaktpersonar · Prosjekt.
//  Kontaktpersonar = tilsette/sakbehandlarar hos kunden; Prosjekt = register over prosjekt som er gjennomførte for kunden og kva
//  sakbehandlar hos kunden som var kontakt (skriv til prosjektet sitt kundekontakt-felt). Sjå claude/kunde-modul.md.
// ══════════════════════════════════════════════════════════════
export default function KundeModule({ userId, activeOfficeId }) {
  const [clients, setClients]     = useState([])
  const [prosjekter, setProsjekter] = useState([])
  const [selected, setSelected]   = useState(null)
  const [form, setForm]           = useState(null)
  const [dirty, setDirty]         = useState(false)
  const [loading, setLoading]     = useState(true)
  const [view, setView]           = useState('liste') // liste | detail
  const [tab, setTab]             = useState('info')  // info | kontakt | prosjekt
  const [searchQ, setSearchQ]     = useState('')
  const [orgLookup, setOrgLookup] = useState(false)
  const [brregResults, setBrregResults] = useState([])
  const [brregQuery, setBrregQuery]     = useState('')
  const [nyKt, setNyKt]           = useState({ name: '', role: '', email: '', phone: '' })
  const [kobleVal, setKobleVal]   = useState('')
  const nyKtNavnRef = useRef(null)

  const loadClients = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase.from('clients').select('*').eq('user_id', userId).order('company_name')
    setClients((data || []).map(c => ({ id: c.id, companyName: c.company_name || '', orgNr: c.org_nr || '', officeId: c.office_id, details: c.details || {}, createdAt: c.created_at })))
    setLoading(false)
  }, [userId])
  const loadProsjekter = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase.from('projects').select('id,name,project_number,project_status,details,deleted_at').is('deleted_at', null).order('created_at', { ascending: false })
    setProsjekter((data || []).map(p => ({ id: p.id, name: p.name, nr: p.project_number || '', status: p.project_status || 'tilbod', details: p.details || {} })))
  }, [userId])
  useEffect(() => { loadClients(); loadProsjekter() }, [loadClients, loadProsjekter])

  // prosjekt som høyrer til ein kunde: lenkja via klient-id, org.nr. eller firmanamn i prosjektopplysningane
  const prosjekterFor = useCallback((c) => prosjekter.filter(p => {
    const d = p.details || {}
    return d.clientId === c.id || (c.orgNr && d.clientOrgNr && orgNorm(d.clientOrgNr) === orgNorm(c.orgNr)) || (c.companyName && norm(d.clientName) === norm(c.companyName))
  }), [prosjekter])

  const allContacts = clients.reduce((acc, c) => [...acc, ...(c.details?.contacts || []).map(ct => ({ ...ct, companyName: c.companyName, clientId: c.id }))], [])
  const filteredClients = clients.filter(c => {
    if (activeOfficeId && c.officeId && c.officeId !== activeOfficeId) return false
    if (!searchQ) return true
    const q = searchQ.toLowerCase()
    return c.companyName.toLowerCase().includes(q) || (c.orgNr || '').includes(q) || (c.details?.contacts || []).some(ct => ct.name?.toLowerCase().includes(q) || ct.email?.toLowerCase().includes(q))
  })
  const kontaktTreff = searchQ ? allContacts.filter(ct => ct.name?.toLowerCase().includes(searchQ.toLowerCase()) || ct.email?.toLowerCase().includes(searchQ.toLowerCase()) || ct.companyName?.toLowerCase().includes(searchQ.toLowerCase())).slice(0, 8) : []

  const gaaTilListe = () => {
    if (dirty && !window.confirm('Du har ulagra endringar. Vil du forkaste dei?')) return
    setView('liste'); setSelected(null); setForm(null); setDirty(false)
  }
  const selectClient = (id, fane = 'info') => {
    if (dirty && selected !== id && !window.confirm('Du har ulagra endringar. Vil du forkaste dei?')) return
    const c = clients.find(x => x.id === id)
    if (c) setForm({ ...tomKunde(), companyName: c.companyName, orgNr: c.orgNr, ...c.details })
    setSelected(id); setView('detail'); setTab(fane); setDirty(false)
  }

  const nyKunde = async () => {
    if (dirty && !window.confirm('Du har ulagra endringar. Vil du forkaste dei?')) return
    const id = Date.now()
    const { error } = await supabase.from('clients').insert({ id, user_id: userId, company_name: '', org_nr: '', office_id: activeOfficeId, details: tomKunde(), created_at: new Date().toISOString() })
    if (!error) { await loadClients(); setSelected(id); setForm(tomKunde()); setView('detail'); setTab('info'); setDirty(false); setTimeout(() => document.getElementById('k-companyName')?.focus(), 100) }
  }
  const nyKundeFraBrreg = async (result) => {
    const existing = clients.find(c => c.orgNr === result.orgnr)
    if (existing) { alert(`«${result.namn}» (org.nr. ${result.orgnr}) finst allereie i kundelista.`); selectClient(existing.id); setBrregResults([]); setBrregQuery(''); return }
    const id = Date.now()
    const details = { ...tomKunde(), companyName: result.namn, orgNr: result.orgnr, address: result.adresse, postnr: result.postnr, poststad: result.poststad, naeringskode: result.naeringskode || '' }
    const { error } = await supabase.from('clients').insert({ id, user_id: userId, company_name: result.namn, org_nr: result.orgnr, office_id: activeOfficeId, details, created_at: new Date().toISOString() })
    if (!error) { await loadClients(); setSelected(id); setForm(details); setView('detail'); setTab('info'); setDirty(false); setBrregResults([]); setBrregQuery('') }
  }
  const lagreKunde = async () => {
    if (!selected || !form) return
    if (form.orgNr) {
      const dup = clients.find(c => c.orgNr === form.orgNr && c.id !== selected)
      if (dup) { alert(`Org.nr. ${form.orgNr} er allereie registrert under «${dup.companyName}». Kvart firma skal berre ha éi oppføring.`); return }
    }
    await supabase.from('clients').update({ company_name: form.companyName, org_nr: form.orgNr, details: form, updated_at: new Date().toISOString() }).eq('id', selected).eq('user_id', userId)
    setDirty(false); await loadClients()
  }
  const slettKunde = async () => {
    if (!selected) return
    const c = clients.find(x => x.id === selected)
    if (!window.confirm(`Vil du slette «${c?.companyName || 'Ukjend'}» frå kundelista?\n\nDette kan ikkje angrast.`)) return
    await supabase.from('clients').delete().eq('id', selected).eq('user_id', userId)
    setSelected(null); setForm(null); setView('liste'); setDirty(false); await loadClients()
  }
  const set = (key, val) => { setForm(f => ({ ...f, [key]: val })); setDirty(true) }
  const doOrgLookup = async () => {
    if (!form?.orgNr) return
    setOrgLookup(true); const result = await sokBrreg(form.orgNr); setOrgLookup(false)
    if (!result) { alert('Fann ikkje organisasjonen i Brønnøysund-registeret.'); return }
    const dup = clients.find(c => c.orgNr === result.orgnr && c.id !== selected)
    if (dup) { alert(`Org.nr. ${result.orgnr} er allereie registrert under «${dup.companyName}».`); return }
    setForm(f => ({ ...f, companyName: result.namn, orgNr: result.orgnr, address: result.adresse, postnr: result.postnr, poststad: result.poststad, naeringskode: result.naeringskode, organisasjonsform: result.organisasjonsform }))
    setDirty(true)
  }

  // ── Kontaktpersonar (tilsette / sakbehandlarar hos kunden) ──
  const addContact = (ct) => set('contacts', [...(form.contacts || []), { id: Date.now(), name: '', role: '', email: '', phone: '', mobile: '', avdeling: '', isPrimary: (form.contacts || []).length === 0, ...ct }])
  const leggTilFraSkjema = () => {
    if (!nyKt.name.trim()) { nyKtNavnRef.current?.focus(); return }
    addContact({ name: nyKt.name.trim(), role: nyKt.role, email: nyKt.email.trim(), phone: nyKt.phone.trim() })
    setNyKt({ name: '', role: '', email: '', phone: '' }); setTimeout(() => nyKtNavnRef.current?.focus(), 50)
  }
  const updateContact = (ctId, key, val) => set('contacts', (form.contacts || []).map(c => c.id === ctId ? { ...c, [key]: val } : c))
  const removeContact = (ctId) => set('contacts', (form.contacts || []).filter(c => c.id !== ctId))
  const setPrimary = (ctId) => set('contacts', (form.contacts || []).map(c => ({ ...c, isPrimary: c.id === ctId })))

  // ── Prosjektregister: sakbehandlar per prosjekt (skriv til prosjektopplysningane) ──
  const oppdaterProsjektDetails = async (p, patch) => {
    const details = { ...p.details, ...patch }
    setProsjekter(list => list.map(x => x.id === p.id ? { ...x, details } : x))
    const { error } = await supabase.from('projects').update({ details, updated_at: new Date().toISOString() }).eq('id', p.id)
    if (error) { alert('Klarte ikkje lagre: ' + error.message); loadProsjekter() }
  }
  const settSakbehandlar = (p, ctId) => {
    const ct = (form.contacts || []).find(c => String(c.id) === String(ctId))
    oppdaterProsjektDetails(p, { clientContactName: ct?.name || '', clientContactEmail: ct?.email || '', clientContactPhone: ct?.phone || ct?.mobile || '' })
  }
  const kobleProsjekt = async () => {
    const p = prosjekter.find(x => String(x.id) === String(kobleVal)); if (!p) return
    await oppdaterProsjektDetails(p, { clientId: selected, clientName: form.companyName, clientOrgNr: form.orgNr, clientAddress: form.address, clientPostnr: form.postnr, clientPoststad: form.poststad })
    setKobleVal('')
  }
  const frakobleProsjekt = async (p) => {
    if (!window.confirm(`Fjerne «${p.name}» frå ${form.companyName || 'kunden'}? (Kundeopplysningane i prosjektet vert tomme.)`)) return
    await oppdaterProsjektDetails(p, { clientId: null, clientName: '', clientOrgNr: '', clientAddress: '', clientPostnr: '', clientPoststad: '', clientContactName: '', clientContactEmail: '', clientContactPhone: '' })
  }

  const fk = (p) => <FeltInput form={form} set={set} {...p}/>
  const kunde = clients.find(c => c.id === selected)
  const kundeProsjekt = kunde ? prosjekterFor({ ...kunde, companyName: form?.companyName ?? kunde.companyName, orgNr: form?.orgNr ?? kunde.orgNr }).sort((a, b) => String(b.nr).localeCompare(String(a.nr), 'nb', { numeric: true })) : []
  const prosjektForContact = (ct) => kundeProsjekt.filter(p => ct.name && norm(p.details?.clientContactName) === norm(ct.name))
  const ukoblaProsjekt = prosjekter.filter(p => !kundeProsjekt.some(k => k.id === p.id))

  const Stat = ({ label, value, accent }) => (
    <div style={{ flex: 1, minWidth: 140, padding: '16px 20px', borderRadius: 12, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent || 'var(--brand)', letterSpacing: '-0.03em', fontFamily: 'var(--mono)' }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginTop: 2 }}>{label}</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      {/* Verktøylinje (NL3) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', height: 50, flexShrink: 0, background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
        {view === 'liste' ? (
          <>
            <button onClick={nyKunde} style={{ padding: '7px 16px', border: 'none', borderRadius: 8, background: 'var(--brand)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}>＋ Ny kunde</button>
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Søk firma, org.nr. eller kontaktperson…"
              style={{ ...SMAL, width: 300, padding: '7px 11px', fontSize: 13, background: 'var(--bg2)' }}/>
            <div style={{ flex: 1 }}/>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>{filteredClients.length} av {clients.length} kundar</span>
          </>
        ) : (
          <>
            <button onClick={gaaTilListe} style={{ padding: '6px 12px', border: '1.5px solid var(--border)', borderRadius: 8, background: 'var(--bg2)', color: 'var(--text2)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}>← Alle kundar</button>
            <div style={{ width: 6 }}/>
            {[['info', 'Kundeinfo'], ['kontakt', `Kontaktpersonar${(form?.contacts || []).length ? ' (' + form.contacts.length + ')' : ''}`], ['prosjekt', `Prosjekt${kundeProsjekt.length ? ' (' + kundeProsjekt.length + ')' : ''}`]].map(([k, t]) => <button key={k} onClick={() => setTab(k)} style={TAB(tab === k)}>{t}</button>)}
            <div style={{ flex: 1 }}/>
            {dirty && <><span style={{ fontSize: 12, color: 'var(--warn)', fontWeight: 600 }}>Ulagra endringar</span>
              <button onClick={lagreKunde} style={{ padding: '7px 18px', border: 'none', borderRadius: 8, background: 'var(--brand)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}>Lagre</button></>}
          </>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 28px' }}>
        {/* ════ LANDINGSSIDE ════ */}
        {view === 'liste' && (
          <div style={{ maxWidth: 1100 }}>
            <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
              <Stat label="Kundar" value={clients.length}/>
              <Stat label="Kontaktpersonar" value={allContacts.length} accent="var(--brand2)"/>
              <Stat label="Prosjekt med kunde" value={prosjekter.filter(p => clients.some(c => prosjekterFor(c).some(x => x.id === p.id))).length} accent="var(--brand3)"/>
              <Stat label="Utan kontaktperson" value={clients.filter(c => !(c.details?.contacts || []).length).length} accent="var(--warn)"/>
            </div>

            {kontaktTreff.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Kontaktpersonar</div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--bg2)' }}>
                  {kontaktTreff.map((ct, i) => (
                    <div key={ct.id || i} onClick={() => selectClient(ct.clientId, 'kontakt')} style={{ padding: '9px 14px', cursor: 'pointer', borderBottom: i < kontaktTreff.length - 1 ? '1px solid var(--border)' : 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{ct.name || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{ct.role ? `${ct.role} · ` : ''}{ct.companyName}{ct.email ? ` · ${ct.email}` : ''}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Kundar</div>
            {loading ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Lastar…</div> : filteredClients.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 13, padding: '14px 0' }}>{searchQ ? `Ingen treff for «${searchQ}».` : 'Ingen kundar enno — trykk «＋ Ny kunde» eller søk i Brønnøysund under.'}</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12, marginBottom: 30 }}>
                {filteredClients.map(c => {
                  const kt = c.details?.contacts || []; const hk = kt.find(x => x.isPrimary) || kt[0]; const np = prosjekterFor(c).length
                  return (
                    <div key={c.id} onClick={() => selectClient(c.id)}
                      style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg2)', border: '1.5px solid var(--border)', cursor: 'pointer', transition: 'transform .15s, box-shadow .15s' }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,.1)' }}
                      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}>
                      <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>{c.companyName || 'Utan namn'}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{c.orgNr ? `Org. ${c.orgNr}` : 'Ingen org.nr.'}{c.details?.poststad ? ` · ${c.details.poststad}` : ''}</div>
                      {hk && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>👤 {hk.name}{hk.role ? ` (${hk.role})` : ''}</div>}
                      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'var(--bg3)', color: 'var(--text2)' }}>{kt.length} kontakt{kt.length === 1 ? '' : 'ar'}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: np ? 'var(--brandbg)' : 'var(--bg3)', color: np ? 'var(--brand)' : 'var(--text3)' }}>{np} prosjekt</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <Seksjon title="Legg til kunde frå Brønnøysundregistera">
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input value={brregQuery} onChange={e => setBrregQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && sokBrregNamn(brregQuery).then(setBrregResults)} placeholder="Søk etter bedriftsnamn…" style={{ ...INN, flex: 1 }}/>
                <button onClick={() => sokBrregNamn(brregQuery).then(setBrregResults)} style={{ padding: '8px 18px', borderRadius: 'var(--r)', border: '1.5px solid var(--border)', background: 'var(--bg3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text2)', fontFamily: 'var(--font)', whiteSpace: 'nowrap' }}>Søk i Brønnøysund</button>
              </div>
              {brregResults.length > 0 && (
                <div style={{ border: '1.5px solid var(--brand3)', borderRadius: 'var(--r2)', overflow: 'hidden', background: 'var(--bg2)' }}>
                  {brregResults.map((r, i) => {
                    const exists = clients.some(c => c.orgNr === r.orgnr)
                    return (
                      <div key={i} onClick={() => nyKundeFraBrreg(r)} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: i < brregResults.length - 1 ? '1px solid var(--border)' : 'none', opacity: exists ? .5 : 1 }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{r.namn}</span>{exists && <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--brandbg)', color: 'var(--brand)', fontWeight: 700 }}>finst</span>}
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Org. {r.orgnr} · {r.adresse}, {r.postnr} {r.poststad}{r.naeringskode ? ` · ${r.naeringskode}` : ''}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Seksjon>
          </div>
        )}

        {/* ════ KUNDEVINDAUGE ════ */}
        {view === 'detail' && form && (
          <div style={{ maxWidth: 900 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 18 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.02em' }}>{form.companyName || 'Ny kunde'}</div>
              {form.orgNr && <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>Org. {form.orgNr}</div>}
            </div>

            {tab === 'info' && (<>
              <Seksjon title="Bedrift">
                <Rad>
                  {fk({ label: 'Org.nr.', id: 'orgNr', half: true })}
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 1 }}>
                    <button onClick={doOrgLookup} disabled={orgLookup} style={{ padding: '8px 14px', borderRadius: 'var(--r)', border: '1.5px solid var(--border)', background: 'var(--bg3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--text2)', fontFamily: 'var(--font)', whiteSpace: 'nowrap' }}>{orgLookup ? 'Søkjer…' : 'Hent frå Brønnøysund'}</button>
                  </div>
                </Rad>
                <Rad>{fk({ label: 'Bedriftsnamn', id: 'companyName' })}</Rad>
                <Rad>{fk({ label: 'Adresse', id: 'address' })}{fk({ label: 'Postnr.', id: 'postnr', quarter: true })}{fk({ label: 'Poststad', id: 'poststad', third: true })}</Rad>
                <Rad>{fk({ label: 'E-post', id: 'email', type: 'email' })}{fk({ label: 'Telefon', id: 'phone', type: 'tel' })}{fk({ label: 'Heimeside', id: 'website', type: 'url', placeholder: 'https://' })}</Rad>
                <Rad>{fk({ label: 'Bransje', id: 'bransje', type: 'select', options: BRANSJAR })}
                  {form.naeringskode && <div style={{ flex: 1 }}><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 3 }}>Næringskode (frå Brreg)</label><div style={{ padding: '8px 10px', fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>{form.naeringskode}</div></div>}</Rad>
              </Seksjon>
              <Seksjon title="Fakturering">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)', cursor: 'pointer', marginBottom: 10 }}>
                  <input type="checkbox" checked={form.invoiceSameAsVisit ?? true} onChange={e => set('invoiceSameAsVisit', e.target.checked)} style={{ width: 16, height: 16 }}/>Fakturaadresse same som besøksadresse
                </label>
                {!form.invoiceSameAsVisit && <Rad>{fk({ label: 'Fakturaadresse', id: 'invoiceAddress' })}{fk({ label: 'Postnr.', id: 'invoicePostnr', quarter: true })}{fk({ label: 'Poststad', id: 'invoicePoststad', third: true })}</Rad>}
                <Rad>{fk({ label: 'Faktura-epost', id: 'invoiceEmail', type: 'email', placeholder: 'faktura@firma.no' })}{fk({ label: 'Faktureringsmåte', id: 'invoiceMethod', type: 'select', options: FAKTURERING })}{fk({ label: 'Betalingsfrist (dagar)', id: 'paymentTerms', type: 'number', quarter: true })}</Rad>
              </Seksjon>
              <Seksjon title="Notat">{fk({ label: '', id: 'notes', type: 'textarea', placeholder: 'Interne notat om kunden…' })}</Seksjon>
              <div style={{ display: 'flex', paddingBottom: 30 }}>
                <div style={{ flex: 1 }}/>
                <button onClick={slettKunde} style={{ padding: '8px 16px', borderRadius: 'var(--r)', border: '1px solid var(--danger)', background: 'transparent', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--danger)', fontFamily: 'var(--font)' }}>Slett kunde</button>
              </div>
            </>)}

            {tab === 'kontakt' && (<>
              <Seksjon title="Legg til tilsett hos kunden">
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px,1.3fr) minmax(130px,1fr) minmax(160px,1.3fr) minmax(110px,.8fr) auto', gap: 8, alignItems: 'end' }}>
                  <div><label style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 600 }}>Namn</label><input ref={nyKtNavnRef} value={nyKt.name} onChange={e => setNyKt(k => ({ ...k, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && leggTilFraSkjema()} placeholder="Fornamn Etternamn" style={SMAL}/></div>
                  <div><label style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 600 }}>Rolle</label><select value={nyKt.role} onChange={e => setNyKt(k => ({ ...k, role: e.target.value }))} style={SMAL}><option value="">— Rolle —</option>{ROLLER.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                  <div><label style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 600 }}>E-post</label><input value={nyKt.email} onChange={e => setNyKt(k => ({ ...k, email: e.target.value }))} onKeyDown={e => e.key === 'Enter' && leggTilFraSkjema()} style={SMAL}/></div>
                  <div><label style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 600 }}>Telefon</label><input value={nyKt.phone} onChange={e => setNyKt(k => ({ ...k, phone: e.target.value }))} onKeyDown={e => e.key === 'Enter' && leggTilFraSkjema()} style={SMAL}/></div>
                  <button onClick={leggTilFraSkjema} style={{ padding: '7px 16px', border: 'none', borderRadius: 7, background: 'var(--brand)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}>＋ Legg til</button>
                </div>
              </Seksjon>

              {(form.contacts || []).length === 0 && <div style={{ padding: '10px 2px', color: 'var(--text3)', fontSize: 13 }}>Ingen kontaktpersonar registrert enno.</div>}
              {(form.contacts || []).map(ct => {
                const ps = prosjektForContact(ct)
                return (
                  <div key={ct.id} style={{ padding: '14px 16px', marginBottom: 10, borderRadius: 12, background: ct.isPrimary ? 'var(--brandbg)' : 'var(--bg2)', border: ct.isPrimary ? '1.5px solid var(--brand3)' : '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>{ct.name || 'Utan namn'}</span>
                      {ct.role && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{ct.role}{ct.avdeling ? ' · ' + ct.avdeling : ''}</span>}
                      {ct.isPrimary && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'var(--brand)', color: '#fff', fontWeight: 700 }}>Hovudkontakt</span>}
                      <div style={{ flex: 1 }}/>
                      {!ct.isPrimary && <button onClick={() => setPrimary(ct.id)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text3)', cursor: 'pointer', fontFamily: 'var(--font)' }}>Sett som hovudkontakt</button>}
                      <button onClick={() => removeContact(ct.id)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'var(--font)' }}>Fjern</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                      <div><label style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>Namn</label><input value={ct.name || ''} onChange={e => updateContact(ct.id, 'name', e.target.value)} style={SMAL}/></div>
                      <div><label style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>Rolle</label><select value={ct.role || ''} onChange={e => updateContact(ct.id, 'role', e.target.value)} style={SMAL}><option value="">—</option>{ROLLER.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                      <div><label style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>Avdeling / etat</label><input value={ct.avdeling || ''} onChange={e => updateContact(ct.id, 'avdeling', e.target.value)} placeholder="T.d. Byggesak" style={SMAL}/></div>
                      <div><label style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>E-post</label><input type="email" value={ct.email || ''} onChange={e => updateContact(ct.id, 'email', e.target.value)} style={SMAL}/></div>
                      <div><label style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>Telefon</label><input type="tel" value={ct.phone || ''} onChange={e => updateContact(ct.id, 'phone', e.target.value)} style={SMAL}/></div>
                      <div><label style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>Mobil</label><input type="tel" value={ct.mobile || ''} onChange={e => updateContact(ct.id, 'mobile', e.target.value)} style={SMAL}/></div>
                    </div>
                    <div style={{ marginTop: 9, fontSize: 11.5, color: 'var(--text3)' }}>
                      {ps.length ? <>Prosjekt med denne kontakten: {ps.map(p => <span key={p.id} style={{ display: 'inline-block', margin: '2px 4px 0 0', padding: '1px 8px', borderRadius: 10, background: 'var(--bg3)', color: 'var(--text2)', fontWeight: 600 }}>{p.nr ? p.nr + ' ' : ''}{p.name}</span>)}</> : 'Ikkje knytt til noko prosjekt enno.'}
                    </div>
                  </div>
                )
              })}
            </>)}

            {tab === 'prosjekt' && (<>
              <Seksjon title="Prosjekt for kunden"
                hogre={<span style={{ fontSize: 11.5, color: 'var(--text3)' }}>Vel sakbehandlar hos kunden — vert lagra i prosjektet</span>}>
                {kundeProsjekt.length === 0 ? <div style={{ color: 'var(--text3)', fontSize: 13, padding: '4px 0 10px' }}>Ingen prosjekt er knytte til kunden enno. Koble eit prosjekt under, eller registrer kunden i prosjektopplysningane.</div> : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
                    <thead><tr>{['Prosjekt', 'Status', 'Sakbehandlar hos kunden', ''].map(h => <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text3)', borderBottom: '2px solid var(--border)' }}>{h}</th>)}</tr></thead>
                    <tbody>{kundeProsjekt.map(p => {
                      const valt = (form.contacts || []).find(c => c.name && norm(c.name) === norm(p.details?.clientContactName))
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px', fontWeight: 600, color: 'var(--text)' }}><span style={{ fontFamily: 'var(--mono)', color: 'var(--text3)', fontWeight: 500, marginRight: 6 }}>{p.nr}</span>{p.name}</td>
                          <td style={{ padding: '8px' }}><span style={{ padding: '2px 8px', borderRadius: 4, background: STATUS_FARGE[p.status] || '#666', color: '#fff', fontSize: 10, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase' }}>{STATUS_NAMN[p.status] || p.status}</span></td>
                          <td style={{ padding: '8px', minWidth: 220 }}>
                            <select value={valt ? valt.id : (p.details?.clientContactName ? '__annan__' : '')} onChange={e => { if (e.target.value !== '__annan__') settSakbehandlar(p, e.target.value) }} style={SMAL}>
                              <option value="">— Ingen vald —</option>
                              {p.details?.clientContactName && !valt && <option value="__annan__">{p.details.clientContactName} (ikkje i kontaktlista)</option>}
                              {(form.contacts || []).filter(c => c.name).map(c => <option key={c.id} value={c.id}>{c.name}{c.role ? ` — ${c.role}` : ''}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right' }}><button onClick={() => frakobleProsjekt(p)} title="Fjern kunde frå prosjektet" style={{ border: 'none', background: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 12 }}>Fjern</button></td>
                        </tr>)
                    })}</tbody>
                  </table>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <select value={kobleVal} onChange={e => setKobleVal(e.target.value)} style={{ ...SMAL, maxWidth: 360 }}>
                    <option value="">＋ Koble eit prosjekt til kunden…</option>
                    {ukoblaProsjekt.map(p => <option key={p.id} value={p.id}>{p.nr ? p.nr + ' ' : ''}{p.name}{p.details?.clientName ? ` (${p.details.clientName})` : ''}</option>)}
                  </select>
                  <button onClick={kobleProsjekt} disabled={!kobleVal} style={{ padding: '6px 16px', border: 'none', borderRadius: 7, background: 'var(--brand)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: kobleVal ? 'pointer' : 'default', opacity: kobleVal ? 1 : .5, fontFamily: 'var(--font)' }}>Koble</button>
                </div>
              </Seksjon>

              <Seksjon title="Register: sakbehandlar → prosjekt">
                {(form.contacts || []).filter(c => prosjektForContact(c).length).length === 0 ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Ingen sakbehandlarar er knytte til prosjekt enno — vel sakbehandlar i tabellen over.</div> : (
                  (form.contacts || []).filter(c => prosjektForContact(c).length).map(c => (
                    <div key={c.id} style={{ display: 'flex', gap: 14, padding: '9px 0', borderBottom: '1px solid var(--border)', alignItems: 'baseline' }}>
                      <div style={{ width: 230, flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{[c.role, c.avdeling, c.email].filter(Boolean).join(' · ')}</div>
                      </div>
                      <div style={{ flex: 1, fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.7 }}>
                        {prosjektForContact(c).map(p => <span key={p.id} style={{ display: 'inline-block', margin: '0 6px 4px 0', padding: '2px 10px', borderRadius: 10, background: 'var(--bg3)', fontWeight: 600 }}>{p.nr ? p.nr + ' ' : ''}{p.name} <span style={{ color: 'var(--text3)', fontWeight: 500 }}>· {STATUS_NAMN[p.status] || p.status}</span></span>)}
                      </div>
                    </div>))
                )}
              </Seksjon>
            </>)}
          </div>
        )}
      </div>
    </div>
  )
}
