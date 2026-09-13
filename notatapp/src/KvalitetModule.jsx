import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import TeikningTabell, { FAG_COLORS } from './TeikningTabell'

// ═══════════════════════════════════════════════════════════════════
//  Kvalitetsmodul (KS)
//
//  Del A (denne versjonen): eit ekte teikningsregister per prosjekt.
//  Brukar dreg teikningar/dokument inn kor som helst i vindauget, appen
//  flyttar dei til <resultatDokSti>/kontroll/til kontroll/, skannar
//  filnamn + PDF-tittelfelt (same logikk som det gamle pdf_vaktar.py-
//  skriptet), og lagrar éi rad per fil i Supabase-tabellen
//  ks_teikningar. Feil frå skanninga rettar ein med dobbeltklikk i
//  tabellcella, som i eit reknearkprogram (Tab går til neste kolonne).
//  Registeret er tilgjengeleg og redigerbart både frå skrivebordsappen
//  og frå nettlesar — berre sjølve dra-og-slepp-innlesinga krev
//  skrivebordsversjonen (fil-tilgang).
//
//  Del B (seinare, ikkje i denne versjonen): sjølve leveranse-
//  kontrollen (egenkontroll/fagkontroll-arbeidsflyten under) er framleis
//  berre lokal skjermtilstand — ho vert ikkje lagra, og «Ferdigstill»
//  flyttar ikkje filer på disk enno. Det kjem som eiga oppfølging.
// ═══════════════════════════════════════════════════════════════════

const CTRL_TYPES = [
  { id: 'skisse',      label: 'Skisseprosjekt',  col: '#6B7280' },
  { id: 'forprosjekt', label: 'Forprosjekt',     col: '#0891B2' },
  { id: 'ramme',       label: 'Rammesøknad',     col: '#2563EB' },
  { id: 'detalj',      label: 'Detaljprosjekt',  col: '#059669' },
  { id: 'anna',        label: 'Anna',            col: '#9333EA' },
]

// Sjekkpunkt per fag — brukt til å byggje egenkontroll-/fagkontroll-
// sjekklista når ein teikning inngår i ein leveransekontroll.
const CPS = {
  Plan: [
    { id: 'P01', txt: 'Målestokk og nord-pil korrekt' },
    { id: 'P02', txt: 'Romnamn og areal vist (NS 3940)' },
    { id: 'P03', txt: 'Dører: retning, nr, fri opning' },
    { id: 'P04', txt: 'Vindaugssymbol konsistente' },
    { id: 'P05', txt: 'Rømningsvegar tydeleg vist' },
    { id: 'P06', txt: 'BRA/BYA stemmer med søknad' },
    { id: 'P07', txt: 'Snuareal Ø1500 dokumentert' },
    { id: 'P08', txt: 'Tekniske sjakter markerte' },
    { id: 'P09', txt: 'Veggtjukkelsar korrekte' },
    { id: 'P10', txt: 'Snitt-referansar korrekte' },
  ],
  Snitt: [
    { id: 'S01', txt: 'Etasjehøgder korrekte' },
    { id: 'S02', txt: 'Golv/tak-konstruksjon vist' },
    { id: 'S03', txt: 'Fundament og drenering korrekt' },
    { id: 'S04', txt: 'Isolasjon og U-verdiar angitt' },
    { id: 'S05', txt: 'Trapp: stigning/inntrinn OK' },
    { id: 'S06', txt: 'Referansekote stemmer' },
    { id: 'S07', txt: 'Takvinkel korrekt' },
  ],
  Fasade: [
    { id: 'F01', txt: 'Alle fasadar teikna' },
    { id: 'F02', txt: 'Material spesifisert' },
    { id: 'F03', txt: 'Opningar stemmer med plan' },
    { id: 'F04', txt: 'Terrenglinje korrekt' },
    { id: 'F05', txt: 'Kotehøgder angitt' },
    { id: 'F06', txt: 'NCS-fargekodar inkluderte' },
  ],
  Situasjonsplan: [
    { id: 'SI01', txt: 'Kartgrunnlag oppdatert' },
    { id: 'SI02', txt: 'Koordinatsystem korrekt' },
    { id: 'SI03', txt: 'Avstandar nabogrense målesett' },
    { id: 'SI04', txt: 'Byggjegrenser vist' },
    { id: 'SI05', txt: 'Tilkomst og parkering vist' },
    { id: 'SI06', txt: 'BYA dokumentert' },
  ],
  Detalj: [
    { id: 'D01', txt: 'Målestokk eigna' },
    { id: 'D02', txt: 'Materiale spesifiserte' },
    { id: 'D03', txt: 'Fuge/tetting angitt' },
    { id: 'D04', txt: 'Festemiddel vist' },
  ],
  Anna: [
    { id: 'A01', txt: 'Innhald stemmer med tittel' },
    { id: 'A02', txt: 'Målestokk/format angitt' },
  ],
}

const PHASE = {
  ek:     { l: 'Egenkontroll', c: '#D97706' },
  fk:     { l: 'Fagkontroll',  c: '#9333EA' },
  ferdig: { l: 'Ferdigstilt',  c: '#059669' },
}

// ── Teikningsnummer-koden: <fagbokstav>-<type>-<løpenr>-<fase> ──
// T.d. A-40-02-02 = Arkitekt, Snitt, løpenr 2, Forprosjekt.
const TYPEKODE = { '10': 'Situasjonsplan', '20': 'Plan', '40': 'Snitt', '45': 'Fasade', '50': 'Detalj' }
const FASEKODE = { '01': 'Skisseprosjekt', '02': 'Forprosjekt', '03': 'Tilbodsteikning', '04': 'Søknadsteikning', '05': 'Detaljprosjekt' }

function tolkTeikningsnr(nr) {
  const m = String(nr || '').match(/^[A-Za-z]+-(\d{2})-(\d{2})(?:-(\d{2}))?/)
  if (!m) return { fag: 'Anna', fase: '' }
  const [, typeKode, , faseKode] = m
  return { fag: TYPEKODE[typeKode] || 'Anna', fase: faseKode ? (FASEKODE[faseKode] || '') : '' }
}

// Fargar EK/FK/teikna av-initialar konsekvent ut frå teksten sjølv —
// desse kjem no frå automatisk PDF-tolking, ikkje ei fast personliste,
// så fargen er ein hash i staden for eit oppslag i eit fast register.
const MERKE_FARGAR = ['#1B6B4A', '#2563EB', '#9333EA', '#D97706', '#DC2626', '#0891B2', '#7C3AED', '#059669']
function fargeFor(tekst) {
  let h = 0
  for (const c of String(tekst)) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return MERKE_FARGAR[h % MERKE_FARGAR.length]
}
function Initialar({ tekst, size = 20 }) {
  if (!tekst) return <span style={{ fontSize:12, color:'var(--text3)' }}>—</span>
  return (
    <div title={tekst} style={{ width:size, height:size, borderRadius:size, background:fargeFor(tekst),
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:size * 0.4, fontWeight:800, color:'#fff', flexShrink:0 }}>
      {String(tekst).slice(0, 3)}
    </div>
  )
}

function Ring({ size = 36, sw = 3, pct }) {
  const r = (size - sw) / 2, c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={sw}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={pct === 100 ? 'var(--brand4)' : 'var(--brand)'}
        strokeWidth={sw} strokeDasharray={`${(pct/100)*c} ${c}`} strokeLinecap="round"
        style={{ transition:'stroke-dasharray .4s' }}/>
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        style={{ transform:'rotate(90deg)', transformOrigin:'50% 50%',
          fontSize:size * 0.27, fontWeight:800, fill:'var(--text)', fontFamily:'var(--mono)' }}>{pct}</text>
    </svg>
  )
}

function Btn3({ value, onSet }) {
  const items = [['ok', '✓', '#059669'], ['avvik', '!', '#DC2626'], ['na', '—', '#6B7280']]
  return (
    <div style={{ display:'flex', gap:1 }}>
      {items.map(([v, tegn, farge]) => {
        const a = value === v
        return (
          <button key={v} onClick={() => onSet(value === v ? '' : v)}
            style={{ width:22, height:20, borderRadius:4,
              border: a ? `1.5px solid ${farge}` : '1px solid var(--border)',
              background: a ? farge : 'var(--bg2)', color: a ? '#fff' : farge,
              fontSize:13, fontWeight:800, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
              transition:'all .1s', padding:0 }}>{tegn}</button>
        )
      })}
    </div>
  )
}

function CRow({ cp, ekV, fkV, ekK, fkK, canFK, onEk, onFk, onEkK, onFkK }) {
  const ek = ekV || '', fk = fkV || ''
  const [open, setOpen] = useState(Boolean(ekK) || Boolean(fkK) || ek === 'avvik' || fk === 'avvik')
  const bg = (fk === 'avvik' || ek === 'avvik') ? 'rgba(185,28,28,.06)'
    : (ek === 'ok' && (fk === 'ok' || !canFK)) ? 'rgba(5,150,105,.06)' : 'transparent'

  return (
    <div style={{ background:bg, borderBottom:'1px solid var(--border)', transition:'background .2s' }}>
      <div style={{ display:'flex', alignItems:'center', padding:'6px 10px', gap:6 }}>
        <span style={{ width:32, fontSize:11, fontWeight:700, color:'var(--text3)', fontFamily:'var(--mono)', flexShrink:0 }}>{cp.id}</span>
        <span style={{ flex:1, fontSize:13, color:'var(--text)',
          opacity: (ek === 'na' && (!canFK || fk === 'na')) ? .4 : 1,
          textDecoration: (ek === 'ok' && (fk === 'ok' || !canFK)) ? 'line-through' : 'none' }}>{cp.txt}</span>
        <Btn3 value={ek} onSet={v => { onEk(v); if (v === 'avvik') setOpen(true) }}/>
        {canFK ? (
          <Btn3 value={fk} onSet={v => { onFk(v); if (v === 'avvik') setOpen(true) }}/>
        ) : (
          <div style={{ width:70, height:20, borderRadius:4, background:'var(--bg3)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'var(--text3)' }}>—</div>
        )}
        <button onClick={() => setOpen(!open)}
          style={{ background:'none', border:'none', cursor:'pointer', fontSize:13,
            color: (ekK || fkK) ? '#D97706' : 'var(--border2)', padding:'0 2px', flexShrink:0 }}>💬</button>
      </div>
      {open && (
        <div style={{ display:'flex', gap:8, padding:'0 10px 8px 40px' }}>
          <textarea value={ekK} onChange={e => onEkK(e.target.value)} rows={1} placeholder="EK-kommentar…"
            style={{ flex:1, padding:'5px 8px', borderRadius:'var(--r)',
              border:`1px solid ${ek === 'avvik' ? '#FCA5A5' : 'var(--border)'}`,
              background: ek === 'avvik' ? 'rgba(220,38,38,.05)' : 'var(--bg3)',
              fontSize:12.5, color:'var(--text)', resize:'vertical', outline:'none', fontFamily:'var(--font)' }}/>
          {canFK && (
            <textarea value={fkK} onChange={e => onFkK(e.target.value)} rows={1} placeholder="FK-kommentar…"
              style={{ flex:1, padding:'5px 8px', borderRadius:'var(--r)',
                border:`1px solid ${fk === 'avvik' ? '#DDD6FE' : 'var(--border)'}`,
                background: fk === 'avvik' ? 'rgba(147,51,234,.05)' : 'var(--bg3)',
                fontSize:12.5, color:'var(--text)', resize:'vertical', outline:'none', fontFamily:'var(--font)' }}/>
          )}
        </div>
      )}
    </div>
  )
}

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
function InfoKnapp() {
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
            color:'var(--text3)', margin:'10px 0 5px' }}>Teikningsnummer-koden</div>
          <div style={{ fontSize:12, fontFamily:'var(--mono)', color:'var(--brand)', fontWeight:700, marginBottom:6 }}>
            fag-type-løpenr-fase, t.d. A-40-02-02
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2px 12px', marginBottom:2 }}>
            <Kode tal="10" tekst="Situasjonsplan"/>
            <Kode tal="01" tekst="Skisseprosjekt"/>
            <Kode tal="20" tekst="Plan"/>
            <Kode tal="02" tekst="Forprosjekt"/>
            <Kode tal="40" tekst="Snitt"/>
            <Kode tal="03" tekst="Tilbodsteikning"/>
            <Kode tal="45" tekst="Fasade"/>
            <Kode tal="04" tekst="Søknadsteikning"/>
            <Kode tal="50" tekst="Detalj"/>
            <Kode tal="05" tekst="Detaljprosjekt"/>
          </div>
          <p style={{ fontSize:11, color:'var(--text3)', lineHeight:1.6, marginTop:8 }}>
            Fag og fase vert gjetta automatisk ut frå desse kodane, og kan alltid rettast for hand.
            Leveransekontrollen (Oversikt/＋Ny/Leveransekontroll/Arkiv) er framleis mellombels og
            vert nullstilt ved omlasting.
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
  const [detaljLastar, setDetaljLastar]         = useState(true)
  const [teikningar, setTeikningar]             = useState([])
  const [teikningarLastar, setTeikningarLastar] = useState(true)
  const [dragOver, setDragOver]                 = useState(false)
  const [arbeider, setArbeider]                 = useState(false)
  const [sisteSkann, setSisteSkann]             = useState(null)

  // ── Leveransekontroll (Del B — framleis berre skjermtilstand) ──
  const [ctrls, setCtrls] = useState([])
  const [chk, setChk]     = useState({})
  const [aId, setAId]     = useState(null)
  const [aDid, setADid]   = useState(null)
  const [nType, setNT]    = useState('')
  const [nName, setNN]    = useState('')
  const [nDrw, setND]     = useState([])

  const harBru = typeof window !== 'undefined' && !!window.resultatdokumentAPI
  const aktivtProsjekt = projects.find(p => p.id === activeProjectId)
  const sti = details?.resultatDokSti || ''

  // ── Last resultatDokSti for aktivt prosjekt ──
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
  useEffect(() => { setCtrls([]); setChk({}); setAId(null); setADid(null) }, [activeProjectId])

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
      const kode = tolkTeikningsnr(r.nr)
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

  // ── Leveransekontroll-logikk (session-only, sjå merknad øvst) ──
  const nextSeq = String(ctrls.length + 1).padStart(2, '0')
  const aC   = ctrls.find(c => c.id === aId)
  const aD   = teikningar.find(t => t.id === aDid)
  const aPts = aD ? (CPS[aD.fag] || CPS.Anna) : []
  const aEk  = (aC && aDid) ? (chk[`${aC.id}_${aDid}_ek`] || {}) : {}
  const aFk  = (aC && aDid) ? (chk[`${aC.id}_${aDid}_fk`] || {}) : {}
  const canFK = aC ? (aC.phase === 'fk' || aC.phase === 'ferdig') : false

  function sv(cid, did, steg, pid, val) {
    const key = `${cid}_${did}_${steg}`
    setChk(p => { const e = p[key] || {}; return { ...p, [key]: { ...e, [pid]: e[pid] === val ? '' : val } } })
  }
  function sk(cid, did, steg, pid, txt) {
    const key = `${cid}_${did}_${steg}`
    setChk(p => { const e = p[key] || {}; return { ...p, [key]: { ...e, [`${pid}_k`]: txt } } })
  }
  function gPr(cid, did, steg) {
    const d = teikningar.find(x => x.id === did); if (!d) return { pct: 0 }
    const pts = CPS[d.fag] || CPS.Anna, cd = chk[`${cid}_${did}_${steg}`] || {}
    const dn = pts.filter(p => cd[p.id] && cd[p.id] !== '').length
    return { pct: pts.length ? Math.round(dn / pts.length * 100) : 0 }
  }
  function gCPr(cid, steg) {
    const ct = ctrls.find(c => c.id === cid); if (!ct) return 0
    const ps = ct.dids.map(did => gPr(cid, did, steg).pct)
    return ps.length ? Math.round(ps.reduce((a, b) => a + b, 0) / ps.length) : 0
  }
  function create() {
    if (!nType || !nName.trim() || nDrw.length === 0) return
    const id = `k${nextSeq}`
    const rs = {}
    nDrw.forEach(did => { const d = teikningar.find(x => x.id === did); if (d) rs[did] = d.rev })
    setCtrls(p => [...p, { id, seq: nextSeq, ctype: nType, name: nName.trim(),
      date: new Date().toISOString().slice(0, 10), phase: 'ek', dids: nDrw, revSnap: rs }])
    setAId(id); setADid(nDrw[0]); setView('kontroll'); setNT(''); setNN(''); setND([])
  }
  function toFK(cid)   { setCtrls(p => p.map(c => c.id === cid ? { ...c, phase: 'fk' } : c)) }
  function finish(cid) { setCtrls(p => p.map(c => c.id === cid ? { ...c, phase: 'ferdig' } : c)) }
  function togD(did)   { setND(p => p.includes(did) ? p.filter(x => x !== did) : [...p, did]) }

  const ekPr = aC ? gCPr(aC.id, 'ek') : 0
  const fkPr = aC ? gCPr(aC.id, 'fk') : 0

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
        <Fane vk="oversikt"   lb="Oversikt"   view={view} setView={setView}/>
        <Fane vk="ny"         lb="＋ Ny"       view={view} setView={setView}/>
        <Fane vk="kontroll"   lb="Leveransekontroll" view={view} setView={setView}/>
        <Fane vk="arkiv"      lb="Arkiv"      view={view} setView={setView}/>
        <div style={{ flex:1 }}/>
        {aktivtProsjekt && (
          <span style={{ fontSize:13, color:'rgba(255,255,255,.7)', fontFamily:'var(--mono)', marginRight:10 }}>
            {aktivtProsjekt.projectNumber} {aktivtProsjekt.name}
          </span>
        )}
        <InfoKnapp/>
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
                      Ingen resultatdokument-mappe er sett for «{aktivtProsjekt.name}». Gå til Prosjekt-modulen og fyll ho inn for å kunne dra inn nye teikningar.
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

          {/* OVERSIKT — status på pågåande leveransekontrollar */}
          {view === 'oversikt' && (
            <div style={{ flex:1, overflow:'auto', padding:20 }}>
              <div style={{ maxWidth:1000 }}>
                <div style={{ display:'flex', gap:12, marginBottom:22, flexWrap:'wrap' }}>
                  {[['Kontrollar', ctrls.length, 'var(--brand)'],
                    ['Pågåande', ctrls.filter(c => c.phase !== 'ferdig').length, '#D97706'],
                    ['Ferdigstilte', ctrls.filter(c => c.phase === 'ferdig').length, '#059669']].map(([lb, tal, farge]) => (
                    <div key={lb} style={{ flex:1, minWidth:130, padding:14, borderRadius:'var(--r2)',
                      background:'var(--bg2)', border:'1px solid var(--border)' }}>
                      <div style={{ fontSize:24, fontWeight:800, color:farge, fontFamily:'var(--mono)' }}>{tal}</div>
                      <div style={{ fontSize:12.5, fontWeight:600, color:'var(--text3)' }}>{lb}</div>
                    </div>
                  ))}
                </div>

                {ctrls.length === 0 ? (
                  <div style={{ fontSize:13, color:'var(--text3)', marginBottom:12 }}>
                    Ingen leveransekontrollar oppretta enno for dette prosjektet.
                  </div>
                ) : ctrls.filter(c => c.phase !== 'ferdig').map(ct => {
                  const p = gCPr(ct.id, ct.phase === 'ek' ? 'ek' : 'fk')
                  return (
                    <div key={ct.id} onClick={() => { setAId(ct.id); setADid(ct.dids[0]); setView('kontroll') }}
                      style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px',
                        background:'var(--bg2)', borderRadius:'var(--r2)', border:'1px solid var(--border)',
                        marginBottom:8, cursor:'pointer', borderLeft:`4px solid ${(PHASE[ct.phase] || PHASE.ek).c}` }}>
                      <div style={{ fontSize:18, fontWeight:800, fontFamily:'var(--mono)', color:'var(--brand)' }}>{ct.seq}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>{ct.name}</div>
                        <div style={{ fontSize:12, color:'var(--text3)' }}>{ct.dids.length} teikningar</div>
                      </div>
                      <Ring pct={p} size={38} sw={3.5}/>
                      <span style={{ fontSize:13, fontWeight:700, color:(PHASE[ct.phase] || PHASE.ek).c }}>
                        {(PHASE[ct.phase] || PHASE.ek).l} →
                      </span>
                    </div>
                  )
                })}
                <button onClick={() => setView('ny')}
                  style={{ padding:'12px 20px', borderRadius:'var(--r2)', border:'2px dashed var(--border2)',
                    background:'transparent', fontSize:13.5, fontWeight:700, color:'var(--text2)',
                    cursor:'pointer', width:'100%', marginTop:8 }}>
                  ＋ Opprett ny leveransekontroll
                </button>
              </div>
            </div>
          )}

          {/* NY KONTROLL */}
          {view === 'ny' && (
            <div style={{ flex:1, overflow:'auto', padding:20 }}>
              <div style={{ maxWidth:760 }}>
                <div style={{ fontSize:15, fontWeight:800, color:'var(--text)', marginBottom:2 }}>Ny leveransekontroll</div>
                <div style={{ fontSize:13, color:'var(--text3)', marginBottom:16 }}>
                  Løpenr: <strong style={{ fontFamily:'var(--mono)' }}>{nextSeq}</strong>
                </div>

                <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.05em', textTransform:'uppercase', color:'var(--text3)', marginBottom:5 }}>Namn</div>
                <input value={nName} onChange={e => setNN(e.target.value)}
                  placeholder="T.d. «Rammesøknad — innsending kommune»"
                  style={{ width:'100%', padding:'10px 12px', borderRadius:'var(--r)', border:'1.5px solid var(--border)',
                    fontSize:13.5, color:'var(--text)', outline:'none', boxSizing:'border-box', marginBottom:14, fontFamily:'var(--font)' }}/>

                <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.05em', textTransform:'uppercase', color:'var(--text3)', marginBottom:5 }}>Type</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
                  {CTRL_TYPES.map(ct => {
                    const s = nType === ct.id
                    return (
                      <button key={ct.id} onClick={() => setNT(ct.id)}
                        style={{ padding:'7px 13px', borderRadius:'var(--r)',
                          border: s ? `1.5px solid ${ct.col}` : '1.5px solid var(--border)',
                          background: s ? `${ct.col}14` : 'var(--bg2)', color: s ? ct.col : 'var(--text2)',
                          fontSize:12.5, fontWeight:600, cursor:'pointer' }}>{ct.label}</button>
                    )
                  })}
                </div>

                <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.05em', textTransform:'uppercase', color:'var(--text3)', marginBottom:5 }}>
                  Teikningar ({nDrw.length})
                </div>
                <div style={{ border:'1px solid var(--border)', borderRadius:'var(--r2)', overflow:'hidden', marginBottom:16 }}>
                  <div style={{ display:'flex', alignItems:'center', padding:'6px 10px', background:'var(--bg3)',
                    borderBottom:'1px solid var(--border)', gap:8 }}>
                    <span style={{ width:18 }}/>
                    <span style={{ width:90, fontSize:10.5, fontWeight:700, color:'var(--text3)' }}>NR.</span>
                    <span style={{ width:26, fontSize:10.5, fontWeight:700, color:'var(--text3)' }}>REV</span>
                    <span style={{ flex:1, fontSize:10.5, fontWeight:700, color:'var(--text3)' }}>TITTEL</span>
                    <span style={{ width:80, fontSize:10.5, fontWeight:700, color:'var(--text3)' }}>FAG</span>
                    <span style={{ width:26, fontSize:10.5, fontWeight:700, color:'var(--text3)', textAlign:'center' }}>EK</span>
                    <span style={{ width:26, fontSize:10.5, fontWeight:700, color:'#9333EA', textAlign:'center' }}>FK</span>
                  </div>
                  {teikningar.length === 0 ? (
                    <div style={{ padding:'16px 10px', fontSize:12.5, color:'var(--text3)', textAlign:'center' }}>
                      Ingen teikningar i registeret enno — dra inn nokre filer i «Teikningar»-fana.
                    </div>
                  ) : teikningar.map(d => {
                    const s = nDrw.includes(d.id)
                    return (
                      <div key={d.id} onClick={() => togD(d.id)}
                        style={{ display:'flex', alignItems:'center', padding:'6px 10px', borderBottom:'1px solid var(--bg3)',
                          cursor:'pointer', background: s ? 'var(--brandbg)' : 'transparent', gap:8 }}>
                        <input type="checkbox" checked={s} readOnly style={{ width:14, height:14, accentColor:'var(--brand)' }}/>
                        <span style={{ width:90, fontSize:12, fontWeight:700, fontFamily:'var(--mono)' }}>{d.nr}</span>
                        <span style={{ width:26, fontSize:12.5, fontWeight:700, fontFamily:'var(--mono)', color:'var(--text2)' }}>{d.rev}</span>
                        <span style={{ flex:1, fontSize:12.5, color:'var(--text2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.tittel}</span>
                        <span style={{ width:80, fontSize:11, color: FAG_COLORS[d.fag] || 'var(--text3)', fontWeight:600 }}>{d.fag}</span>
                        <span style={{ width:26, display:'flex', justifyContent:'center' }}><Initialar tekst={d.ek_person} size={18}/></span>
                        <span style={{ width:26, display:'flex', justifyContent:'center' }}><Initialar tekst={d.fk_person} size={18}/></span>
                      </div>
                    )
                  })}
                </div>

                <button onClick={create} disabled={!nType || !nName.trim() || nDrw.length === 0}
                  style={{ padding:'11px 22px', borderRadius:'var(--r)', border:'none',
                    background: (nType && nName.trim() && nDrw.length) ? 'var(--brand)' : 'var(--bg3)',
                    color: (nType && nName.trim() && nDrw.length) ? '#fff' : 'var(--text3)',
                    fontSize:13.5, fontWeight:700, cursor: (nType && nName.trim() && nDrw.length) ? 'pointer' : 'default' }}>
                  Opprett kontroll {nextSeq}
                </button>
              </div>
            </div>
          )}

          {/* LEVERANSEKONTROLL */}
          {view === 'kontroll' && aC && (
            <div style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', background:'var(--bg3)',
                borderBottom:'1px solid var(--border)', flexShrink:0, flexWrap:'wrap' }}>
                <div style={{ fontSize:18, fontWeight:800, fontFamily:'var(--mono)', color:'var(--brand)' }}>{aC.seq}</div>
                <div style={{ flex:1, minWidth:140 }}>
                  <div style={{ fontSize:13.5, fontWeight:700, color:'var(--text)' }}>{aC.name}</div>
                  <div style={{ fontSize:12, color:'var(--text3)' }}>{aC.dids.length} teikningar</div>
                </div>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)' }}>EK</div><Ring pct={ekPr} size={32} sw={3}/>
                </div>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#9333EA' }}>FK</div><Ring pct={fkPr} size={32} sw={3}/>
                </div>
                {aC.phase === 'ek' && ekPr === 100 && (
                  <button onClick={() => toFK(aC.id)}
                    style={{ padding:'7px 14px', borderRadius:'var(--r)', border:'none', background:'#2563EB',
                      color:'#fff', fontSize:12.5, fontWeight:700, cursor:'pointer' }}>Send til FK →</button>
                )}
                {aC.phase === 'fk' && fkPr === 100 && (
                  <button onClick={() => finish(aC.id)}
                    style={{ padding:'7px 14px', borderRadius:'var(--r)', border:'none', background:'#059669',
                      color:'#fff', fontSize:12.5, fontWeight:700, cursor:'pointer' }}>Ferdigstill ✓</button>
                )}
                {aC.phase === 'ferdig' && (
                  <span style={{ padding:'5px 12px', background:'rgba(5,150,105,.12)', borderRadius:'var(--r)',
                    fontSize:12.5, fontWeight:700, color:'#059669' }}>✓ Ferdigstilt</span>
                )}
                {aC.phase === 'ek' && ekPr < 100 && <span style={{ fontSize:12.5, color:'#D97706' }}>EK pågår</span>}
                {aC.phase === 'fk' && fkPr < 100 && <span style={{ fontSize:12.5, color:'#9333EA' }}>FK pågår</span>}
              </div>

              <div style={{ display:'flex', gap:4, padding:'6px 16px', background:'var(--bg2)',
                borderBottom:'1px solid var(--border)', flexShrink:0, overflowX:'auto' }}>
                {aC.dids.map(did => {
                  const d = teikningar.find(x => x.id === did); if (!d) return null
                  const isA = aDid === did, ep = gPr(aC.id, did, 'ek').pct, fp = gPr(aC.id, did, 'fk').pct
                  return (
                    <button key={did} onClick={() => setADid(did)}
                      style={{ padding:'5px 11px', borderRadius:'var(--r)',
                        border: isA ? '1.5px solid var(--brand)' : '1px solid var(--border)',
                        background: isA ? 'var(--brandbg)' : 'var(--bg2)', fontSize:12.5,
                        fontWeight: isA ? 700 : 500, color: isA ? 'var(--brand)' : 'var(--text2)',
                        cursor:'pointer', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:5 }}>
                      <span style={{ fontFamily:'var(--mono)', fontWeight:700 }}>{d.nr}</span>
                      <span style={{ fontSize:11, color: ep === 100 ? '#059669' : '#D97706' }}>{ep}</span>
                      {canFK && <span style={{ fontSize:11, color: fp === 100 ? '#059669' : '#9333EA' }}>{fp}</span>}
                    </button>
                  )
                })}
              </div>

              {aD && (
                <div style={{ flex:1, overflow:'auto' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 16px',
                    borderBottom:'1px solid var(--border)', background:'var(--bg2)' }}>
                    <span style={{ fontFamily:'var(--mono)', fontWeight:700, fontSize:13 }}>{aD.nr}</span>
                    <span style={{ fontSize:13, fontWeight:600, color:'var(--text2)' }}>{aD.tittel}</span>
                    <span style={{ fontSize:12, color:'var(--text3)' }}>rev. {aD.rev}</span>
                    <span style={{ fontSize:12, color:'var(--text3)', fontFamily:'var(--mono)' }}>{aD.malestokk}</span>
                    <div style={{ flex:1 }}/>
                    <span style={{ fontSize:12, color:'var(--text3)' }}>EK:</span><Initialar tekst={aD.ek_person} size={18}/>
                    <span style={{ fontSize:12, color:'#9333EA' }}>FK:</span><Initialar tekst={aD.fk_person} size={18}/>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', padding:'6px 10px', background:'var(--bg3)',
                    borderBottom:'1.5px solid var(--border)', gap:6, position:'sticky', top:0, zIndex:2 }}>
                    <span style={{ width:32, fontSize:11, fontWeight:700, color:'var(--text3)' }}>NR</span>
                    <span style={{ flex:1, fontSize:11, fontWeight:700, color:'var(--text3)' }}>SJEKKPUNKT</span>
                    <span style={{ width:70, fontSize:11, fontWeight:700, color:'var(--text3)', textAlign:'center' }}>EGENKONTROLL</span>
                    <span style={{ width:70, fontSize:11, fontWeight:700, color: canFK ? '#9333EA' : 'var(--border)', textAlign:'center' }}>FAGKONTROLL</span>
                    <span style={{ width:18 }}/>
                  </div>
                  {aPts.map(cp => (
                    <CRow key={`${aC.id}_${aDid}_${cp.id}`} cp={cp}
                      ekV={aEk[cp.id] || ''} fkV={aFk[cp.id] || ''}
                      ekK={aEk[`${cp.id}_k`] || ''} fkK={aFk[`${cp.id}_k`] || ''}
                      canFK={canFK}
                      onEk={v => sv(aC.id, aDid, 'ek', cp.id, v)}
                      onFk={v => sv(aC.id, aDid, 'fk', cp.id, v)}
                      onEkK={t => sk(aC.id, aDid, 'ek', cp.id, t)}
                      onFkK={t => sk(aC.id, aDid, 'fk', cp.id, t)}/>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'kontroll' && !aC && (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12 }}>
              <div style={{ fontSize:28, fontWeight:900, color:'var(--brand)' }}>KS</div>
              <p style={{ fontSize:13, color:'var(--text3)', textAlign:'center', maxWidth:340 }}>
                Opprett ein kontroll frå «＋ Ny»-fana.
              </p>
            </div>
          )}

          {/* ARKIV */}
          {view === 'arkiv' && (
            <div style={{ flex:1, overflow:'auto', padding:20 }}>
              <div style={{ maxWidth:1000 }}>
                <div style={{ fontSize:15, fontWeight:800, color:'var(--text)', marginBottom:16 }}>Kontrollarkiv</div>
                {ctrls.length === 0 && (
                  <div style={{ fontSize:13, color:'var(--text3)' }}>Ingen leveransekontrollar oppretta enno.</div>
                )}
                {ctrls.map(ct => {
                  const isF = ct.phase === 'ferdig'
                  const folder = `${ct.seq}_${ct.name.replace(/\s/g, '_')}`
                  return (
                    <div key={ct.id} style={{ marginBottom:14, background:'var(--bg2)', borderRadius:'var(--r2)',
                      border:'1px solid var(--border)', overflow:'hidden', borderLeft:`4px solid ${(PHASE[ct.phase] || PHASE.ek).c}` }}>
                      <div onClick={() => { if (!isF) { setAId(ct.id); setADid(ct.dids[0]); setView('kontroll') } }}
                        style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
                          background: isF ? 'rgba(5,150,105,.06)' : 'transparent', cursor: !isF ? 'pointer' : 'default' }}>
                        <div style={{ fontSize:18, fontWeight:800, fontFamily:'var(--mono)', color:'var(--brand)' }}>{ct.seq}</div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13.5, fontWeight:700, color:'var(--text)' }}>{ct.name}</div>
                          <div style={{ fontSize:12, color:'var(--text3)' }}>{ct.date} · {ct.dids.length} teikningar</div>
                        </div>
                        <span style={{ fontSize:12, fontWeight:700, color:(PHASE[ct.phase] || PHASE.ek).c,
                          padding:'3px 9px', background:`${(PHASE[ct.phase] || PHASE.ek).c}18`, borderRadius:'var(--r)' }}>
                          {(PHASE[ct.phase] || PHASE.ek).l}
                        </span>
                      </div>
                      <div style={{ borderTop:'1px solid var(--border)' }}>
                        <div style={{ display:'flex', padding:'5px 16px 5px 50px', background:'var(--bg3)',
                          borderBottom:'1px solid var(--border)', gap:8 }}>
                          <span style={{ width:90, fontSize:10.5, fontWeight:700, color:'var(--text3)' }}>NR.</span>
                          <span style={{ flex:1, fontSize:10.5, fontWeight:700, color:'var(--text3)' }}>TITTEL</span>
                          <span style={{ width:60, fontSize:10.5, fontWeight:700, color:'var(--text3)' }}>MÅLESTOKK</span>
                          <span style={{ width:26, fontSize:10.5, fontWeight:700, color:'var(--text3)' }}>REV</span>
                          <span style={{ width:24, fontSize:10.5, fontWeight:700, color:'var(--text3)' }}>EK</span>
                          <span style={{ width:24, fontSize:10.5, fontWeight:700, color:'#9333EA' }}>FK</span>
                        </div>
                        {ct.dids.map(did => {
                          const d = teikningar.find(x => x.id === did); if (!d) return null
                          const rev = (ct.revSnap || {})[did] || d.rev
                          return (
                            <div key={did} style={{ display:'flex', alignItems:'center', padding:'6px 16px 6px 50px',
                              borderBottom:'1px solid var(--bg3)', gap:8, fontSize:12.5 }}>
                              <span style={{ width:90, fontFamily:'var(--mono)', fontWeight:700, fontSize:11.5 }}>{d.nr}</span>
                              <span style={{ flex:1, color:'var(--text2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.tittel}</span>
                              <span style={{ width:60, fontFamily:'var(--mono)', fontSize:11.5, color:'var(--text3)' }}>{d.malestokk}</span>
                              <span style={{ width:26, fontFamily:'var(--mono)', fontWeight:700, color:'var(--brand)' }}>{rev}</span>
                              <span style={{ width:24, display:'flex', justifyContent:'center' }}><Initialar tekst={d.ek_person} size={16}/></span>
                              <span style={{ width:24, display:'flex', justifyContent:'center' }}><Initialar tekst={d.fk_person} size={16}/></span>
                            </div>
                          )
                        })}
                      </div>
                      {isF && (
                        <div style={{ borderTop:'1px solid var(--border)', padding:'8px 16px', background:'rgba(5,150,105,.06)' }}>
                          <div style={{ fontSize:12, fontWeight:700, color:'#059669' }}>
                            Klar for arkivering → kontroll/Kontrollkopiar/{folder}/
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
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
