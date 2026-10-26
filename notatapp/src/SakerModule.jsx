import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import DatePicker from './DatePicker'
import SakerTabell from './SakerTabell'
import SokeFelt from './SokeFelt'
import NySakModal from './NySakModal'
import KanbanKortModal from './KanbanKortModal'
import PersonVelger from './PersonVelger'
import { FELT } from './FlyttbartModal'
import { ALLE_STATUSAR, statusNamn, personFarge, fmtDato as fmtKortDato } from './kanbanLogikk'
import {
  FAG, TYPE,
  STATUS_LABELS, STATUS_ORDER, STATUS_COLORS,
  PRIO_LABELS, caseNoText,
} from './sakerKonstantar'

function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('no-NO', { day:'2-digit', month:'short' }) + ' ' + d.toLocaleTimeString('no-NO', { hour:'2-digit', minute:'2-digit', hour12:false })
}
function fmtDate(iso) {
  if (!iso) return '\u2014'
  return new Date(iso).toLocaleDateString('no-NO', { day:'2-digit', month:'short', year:'numeric' })
}
function fmtDateShort(iso) {
  if (!iso) return '\u2014'
  return new Date(iso).toLocaleDateString('no-NO', { day:'2-digit', month:'2-digit', year:'2-digit' })
}
function initials(name) { return (name || '?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() }

export default function SakerModule({ userId, userEmail, activeProjectId, projects, notes, activeOfficeId }) {
  const activeProject = (projects || []).find(p => p.id === activeProjectId)
  // Berre notat frå det aktive prosjektet skal kunne koplast til ei sak
  const projectNotes = (notes || []).filter(n => n.projectId === activeProjectId)
  // Personell-forslag henta frå deltakarlister i prosjektets møtereferat (inga eiga personelliste finst enno)
  const personnelList = Array.from(new Set(projectNotes.flatMap(n => n.attendees || []).filter(Boolean))).sort()

  const [cases, setCases]           = useState([])
  const [comments, setComments]     = useState({}) // caseId -> [comment,...]
  const [eigneKolonnar, setEigneKolonnar] = useState([]) // eigendefinerte kolonnar for prosjektet
  const [loading, setLoading]       = useState(true)
  const [statusFilter, setStatusFilter] = useState('alle')
  const [fagFilter, setFagFilter]   = useState('alle')
  const [search, setSearch]         = useState('')
  const [openCaseId, setOpenCaseId] = useState(null)
  const [showNewModal, setShowNewModal] = useState(false)
  // Oppgåver (Kanban-kort) i same liste som sakene — Gjeremål = saker (S-nr) + oppgåver (O-nr)
  const [kort, setKort]             = useState([])
  const [tavler, setTavler]         = useState([])
  const [personell, setPersonell]   = useState([])
  const [planElement, setPlanElement] = useState([])
  const [kortModal, setKortModal]   = useState(null)
  const [visSaker, setVisSaker]     = useState(true)
  const [visOppgaver, setVisOppgaver] = useState(true)
  const [skjulFerdige, setSkjulFerdige] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const currentUser = userEmail || 'Ukjend brukar'

  // ── Last saker + kommentarar for aktivt prosjekt ──────────────
  const loadCases = useCallback(async () => {
    if (!userId || !activeProjectId) { setCases([]); setComments({}); setEigneKolonnar([]); setLoading(false); return }
    setLoading(true)
    const { data: caseData, error: caseErr } = await supabase.from('cases').select('*')
      .eq('user_id', userId).eq('project_id', activeProjectId).is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (caseErr) { console.error(caseErr); setLoading(false); return }
    const list = caseData || []
    setCases(list.map(c => ({
      id: c.id, number: c.number, title: c.title, description: c.description || '',
      fag: c.fag, type: c.type, status: c.status, prioritet: c.prioritet,
      ansvarlig: c.ansvarlig || '', involverte: c.involverte || [], frist: c.frist || '', tegning: c.tegning || '',
      linkedNotes: c.linked_notes || [], linkedTasks: c.linked_tasks || [],
      attachments: c.attachments || [],
      ekstra: c.ekstra || {},
      opprettet: c.created_at, opprettetAv: c.created_by,
    })))

    if (list.length > 0) {
      const { data: commentData } = await supabase.from('case_comments').select('*')
        .in('case_id', list.map(c => c.id)).order('created_at', { ascending: true })
      const grouped = {}
      ;(commentData || []).forEach(cm => {
        if (!grouped[cm.case_id]) grouped[cm.case_id] = []
        grouped[cm.case_id].push({ id: cm.id, author: cm.author, text: cm.text, system: cm.system, time: cm.created_at })
      })
      setComments(grouped)
    } else {
      setComments({})
    }
    // Eigendefinerte kolonnar for dette prosjektet
    const { data: colData, error: colErr } = await supabase.from('case_columns').select('*')
      .eq('user_id', userId).eq('project_id', activeProjectId)
      .order('sortering', { ascending: true })
    if (colErr) {
      console.warn('Klarte ikkje hente eigne kolonnar (er case_columns oppretta?)', colErr.message)
      setEigneKolonnar([])
    } else {
      setEigneKolonnar((colData || []).map(k => ({ key: k.key, label: k.label, art: k.art || 'tekst' })))
    }

    setLoading(false)
  }, [userId, activeProjectId])

  useEffect(() => { loadCases() }, [loadCases])

  // ── Oppgåver (kanban_kort), tavler og personell for aktivt prosjekt ──
  const lastKort = useCallback(async () => {
    if (!userId || !activeProjectId) { setKort([]); setTavler([]); setPersonell([]); setPlanElement([]); return }
    const [k, t, p, f] = await Promise.all([
      supabase.from('kanban_kort').select('*').eq('user_id', userId).eq('project_id', activeProjectId).order('id'),
      supabase.from('kanban_tavler').select('*').eq('user_id', userId).eq('project_id', activeProjectId).order('id'),
      supabase.from('prosjekt_personell').select('id,namn').eq('user_id', userId).eq('project_id', activeProjectId).order('sortering').order('id'),
      supabase.from('framdrift_planar').select('elementer').eq('user_id', userId).eq('project_id', activeProjectId).maybeSingle(),
    ])
    setKort((k.data || []).filter(x => !(x.dtm_ref && x.dtm_ref.skjult)))
    setTavler(t.data || []); setPersonell(p.data || [])
    setPlanElement(Array.isArray(f.data?.elementer) ? f.data.elementer : [])
  }, [userId, activeProjectId])
  useEffect(() => { lastKort() }, [lastKort])
  const personarListe = Array.from(new Set([...personell.map(p => p.namn), ...personnelList].filter(Boolean)))

  const nesteOppgaveNr = async () => {
    const { data } = await supabase.from('kanban_kort').select('nummer').eq('project_id', activeProjectId).order('nummer', { ascending: false }).limit(1)
    return (data?.[0]?.nummer || 0) + 1
  }
  // oppgåver oppretta frå ei sak: vert kort i fyrste opne Kanban-tavle (Komande oppgåver), lenkja til saka
  const opprettOppgaver = async (sakId, liste) => {
    const tavle = tavler.find(t => !t.avslutta) || null
    const base = await nesteOppgaveNr()
    const rader = liste.map((o, i) => ({ user_id: userId, project_id: activeProjectId, tavle_id: tavle?.id || null, tittel: o.tittel.trim(), skildring: '', status: 'komande',
      ansvarleg: o.ansvarleg || '', fase: tavle?.fase || null, frist: o.frist || null, sak_id: sakId, nummer: base + i, sortering: i }))
    const { error } = await supabase.from('kanban_kort').insert(rader)
    if (error) alert('Oppgåvene vart ikkje oppretta: ' + error.message)
    await lastKort()
  }
  const nyttKort = () => {
    const tavle = tavler.find(t => !t.avslutta) || null
    setKortModal({ user_id: userId, project_id: activeProjectId, tavle_id: tavle?.id || null, tittel: '', skildring: '', status: 'komande', ansvarleg: '', fase: tavle?.fase || null, frist: null, farge: null, sak_id: null, oppgave_ref: null, framdrift_aktivitet_ref: null, sortering: 0 })
  }
  const lagreKort = async (d) => {
    if (d.id) {
      const { id, user_id, created_at, ...resten } = d
      const patch = { ...resten }
      const gammal = kort.find(k => k.id === id)
      if (gammal && gammal.status !== d.status) patch.ferdig_dato = d.status === 'ferdig' ? new Date().toISOString() : null
      if (gammal && gammal.tavle_id !== d.tavle_id) patch.fase = tavler.find(t => t.id === d.tavle_id)?.fase || null
      const { error } = await supabase.from('kanban_kort').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId)
      if (error) { alert('Lagring feila: ' + error.message); return }
    } else {
      const { id, ...ny } = d
      const { error } = await supabase.from('kanban_kort').insert({ ...ny, nummer: await nesteOppgaveNr(), ferdig_dato: d.status === 'ferdig' ? new Date().toISOString() : null })
      if (error) { alert('Klarte ikkje opprette oppgåva: ' + error.message); return }
    }
    setKortModal(null); await lastKort()
  }
  const slettKort = async (id) => {
    const k = kort.find(x => x.id === id); setKortModal(null)
    if (k?.dtm_ref) await supabase.from('kanban_kort').update({ dtm_ref: { ...k.dtm_ref, skjult: true } }).eq('id', id).eq('user_id', userId)
    else await supabase.from('kanban_kort').delete().eq('id', id).eq('user_id', userId)
    await lastKort()
  }

  // ── Saksnummer per prosjekt ───────────────────────────────────
  // Saksnummeret er berre eit lopande tal. Prosjektet går fram av
  // prosjektnummer-kolonna, så nummeret treng ikkje prefiks.
  const nextCaseNumber = () => {
    const nums = cases.map(c => parseInt(caseNoText(c.number), 10)).filter(n => !isNaN(n))
    return String((nums.length ? Math.max(...nums) : 0) + 1)
  }

  // ── Opprett sak ────────────────────────────────────────────────
  const createCase = async (fields, stagedFiles) => {
    if (!fields.title.trim()) { alert('Tittel er p\u00E5krevd'); return false }
    const id = Date.now()
    const row = {
      id, user_id: userId, project_id: activeProjectId,
      number: nextCaseNumber(), title: fields.title.trim(), description: fields.description.trim(),
      fag: fields.fag, type: fields.type, status: 'ny', prioritet: fields.prioritet,
      ansvarlig: fields.ansvarlig.trim(), involverte: fields.involverte || [],
      frist: fields.frist || null, tegning: '',
      linked_notes: [], linked_tasks: [], attachments: [],
      created_at: new Date().toISOString(), created_by: currentUser,
    }
    const { error } = await supabase.from('cases').insert(row)
    if (error) { alert('Klarte ikkje opprette sak: ' + error.message); return false }
    const commentId = Date.now() + 1
    await supabase.from('case_comments').insert({
      id: commentId, case_id: id, user_id: userId, author: currentUser,
      text: 'Sak oppretta.', system: false, created_at: new Date().toISOString(),
    })

    // Last opp filer/utklipp som vart lagt til i registreringsvindauget
    if (stagedFiles && stagedFiles.length > 0) {
      const uploaded = []
      for (const file of stagedFiles) {
        try {
          const path = `${Date.now()}_${Math.random().toString(36).slice(2)}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
          const { error: upErr } = await supabase.storage.from('Vedlegg').upload(path, file)
          if (upErr) throw upErr
          const { data: urlData } = supabase.storage.from('Vedlegg').getPublicUrl(path)
          uploaded.push({ name: file.name, path, url: urlData.publicUrl, size: file.size, type: file.type })
        } catch (e) { console.error('Opplasting feila:', file.name, e) }
      }
      if (uploaded.length > 0) {
        await supabase.from('cases').update({ attachments: uploaded }).eq('id', id).eq('user_id', userId)
      }
    }

    if ((fields.oppgaver || []).length) await opprettOppgaver(id, fields.oppgaver)
    setShowNewModal(false)
    await loadCases()
    setOpenCaseId(id)
    return true
  }

  // ── Statusendring ──────────────────────────────────────────────
  const setCaseStatus = async (caseId, newStatus) => {
    const c = cases.find(x => x.id === caseId)
    if (!c || c.status === newStatus) return
    const oldLabel = STATUS_LABELS[c.status]
    const { error } = await supabase.from('cases').update({
      status: newStatus, updated_at: new Date().toISOString(),
    }).eq('id', caseId).eq('user_id', userId)
    if (error) { alert('Klarte ikkje lagre statusendring: ' + error.message); return }
    const commentId = Date.now()
    await supabase.from('case_comments').insert({
      id: commentId, case_id: caseId, user_id: userId, author: currentUser, system: true,
      text: `${currentUser} endra status fr\u00E5 "${oldLabel}" til "${STATUS_LABELS[newStatus]}"`,
      created_at: new Date().toISOString(),
    })
    await loadCases()
  }

  // ── Kommentar ──────────────────────────────────────────────────
  const addComment = async (caseId, text) => {
    if (!text.trim()) return
    const id = Date.now()
    const { error } = await supabase.from('case_comments').insert({
      id, case_id: caseId, user_id: userId, author: currentUser, text: text.trim(),
      system: false, created_at: new Date().toISOString(),
    })
    if (error) { alert('Klarte ikkje lagre kommentar: ' + error.message); return }
    await loadCases()
  }

  // ── Kopling til notat/oppgåve ────────────────────────────────
  const addNoteLink = async (caseId, noteId) => {
    const c = cases.find(x => x.id === caseId)
    if (!c || c.linkedNotes.includes(noteId)) return
    const newLinks = [...c.linkedNotes, noteId]
    const { error } = await supabase.from('cases').update({ linked_notes: newLinks }).eq('id', caseId).eq('user_id', userId)
    if (error) { alert('Klarte ikkje kople notat: ' + error.message); return }
    const note = (notes || []).find(n => n.id === noteId)
    await supabase.from('case_comments').insert({
      id: Date.now(), case_id: caseId, user_id: userId, author: currentUser, system: true,
      text: `${currentUser} kopla til notat: "${note?.title || note?.text?.slice(0,40) || 'Notat'}"`,
      created_at: new Date().toISOString(),
    })
    await loadCases()
  }
  const removeNoteLink = async (caseId, noteId) => {
    const c = cases.find(x => x.id === caseId)
    if (!c) return
    const newLinks = c.linkedNotes.filter(id => id !== noteId)
    await supabase.from('cases').update({ linked_notes: newLinks }).eq('id', caseId).eq('user_id', userId)
    await loadCases()
  }
  const addTaskLink = async (caseId, noteId, taskId) => {
    const c = cases.find(x => x.id === caseId)
    if (!c) return
    if (c.linkedTasks.some(t => t.noteId === noteId && t.taskId === taskId)) return
    const newLinks = [...c.linkedTasks, { noteId, taskId }]
    const { error } = await supabase.from('cases').update({ linked_tasks: newLinks }).eq('id', caseId).eq('user_id', userId)
    if (error) { alert('Klarte ikkje kople oppg\u00E5ve: ' + error.message); return }
    const note = (notes || []).find(n => n.id === noteId)
    const task = note?.tasks?.find(t => t.id === taskId)
    await supabase.from('case_comments').insert({
      id: Date.now(), case_id: caseId, user_id: userId, author: currentUser, system: true,
      text: `${currentUser} kopla til oppg\u00E5ve: "${task?.text || 'Oppg\u00E5ve'}"`,
      created_at: new Date().toISOString(),
    })
    await loadCases()
  }
  const removeTaskLink = async (caseId, noteId, taskId) => {
    const c = cases.find(x => x.id === caseId)
    if (!c) return
    const newLinks = c.linkedTasks.filter(t => !(t.noteId === noteId && t.taskId === taskId))
    await supabase.from('cases').update({ linked_tasks: newLinks }).eq('id', caseId).eq('user_id', userId)
    await loadCases()
  }

  // ── Vedlegg ──────────────────────────────────────────────────
  const uploadAttachment = async (caseId, file) => {
    try {
      const path = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error: upErr } = await supabase.storage.from('Vedlegg').upload(path, file)
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('Vedlegg').getPublicUrl(path)
      const att = { name: file.name, path, url: urlData.publicUrl, size: file.size, type: file.type }
      const c = cases.find(x => x.id === caseId)
      const newAtt = [...(c?.attachments || []), att]
      await supabase.from('cases').update({ attachments: newAtt }).eq('id', caseId).eq('user_id', userId)
      await supabase.from('case_comments').insert({
        id: Date.now(), case_id: caseId, user_id: userId, author: currentUser, system: true,
        text: `${currentUser} la ved fil: "${file.name}"`, created_at: new Date().toISOString(),
      })
      await loadCases()
    } catch (e) {
      alert('Klarte ikkje laste opp vedlegg: ' + e.message)
    }
  }
  const removeAttachment = async (caseId, path) => {
    const c = cases.find(x => x.id === caseId)
    if (!c) return
    const newAtt = c.attachments.filter(a => a.path !== path)
    await supabase.from('cases').update({ attachments: newAtt }).eq('id', caseId).eq('user_id', userId)
    await loadCases()
  }

  // ── Eigendefinerte kolonnar ───────────────────────────────────
  // Definisjonen ligg i case_columns og høyrer til prosjektet, slik at
  // kolonnen dukkar opp same kvar du opnar saksregisteret.
  const addColumn = async (label, art) => {
    const key = 'eigen_' + Date.now().toString(36)
    const rad = {
      id: Date.now(), user_id: userId, project_id: activeProjectId,
      key, label, art, sortering: eigneKolonnar.length,
      created_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('case_columns').insert(rad)
    if (error) {
      alert('Klarte ikkje lagre kolonnen.\n\nHar du køyrt SQL-en som opprettar tabellen «case_columns»?\n\n' + error.message)
      return null
    }
    setEigneKolonnar(prev => [...prev, { key, label, art }])
    return key
  }

  const deleteColumn = async (key) => {
    const { error } = await supabase.from('case_columns').delete()
      .eq('key', key).eq('user_id', userId).eq('project_id', activeProjectId)
    if (error) { alert('Klarte ikkje slette kolonnen: ' + error.message); return }
    setEigneKolonnar(prev => prev.filter(k => k.key !== key))
  }

  // ── Verdi i eigendefinert kolonne ─────────────────────────────
  // Kolonnedefinisjonen ligg lokalt i nettlesaren, verdiane i databasen
  // (cases.ekstra). Krev at SQL-en som legg til «ekstra» er køyrd.
  const setExtraValue = async (caseId, key, value) => {
    const c = cases.find(x => x.id === caseId)
    if (!c) return
    const neste = { ...(c.ekstra || {}), [key]: value }
    setCases(prev => prev.map(x => x.id === caseId ? { ...x, ekstra: neste } : x))
    const { error } = await supabase.from('cases')
      .update({ ekstra: neste, updated_at: new Date().toISOString() })
      .eq('id', caseId).eq('user_id', userId)
    if (error) {
      alert('Klarte ikkje lagre verdien.\n\nHar du køyrt SQL-en som legg til kolonnen «ekstra» i cases-tabellen?\n\n' + error.message)
      await loadCases()
    }
  }

  // ── Samla liste: saker (S-nr) og oppgåver (O-nr) ──────────────
  const prosjektNr = activeProject?.projectNumber || ''
  const sakNrAvId = Object.fromEntries(cases.map(c => [c.id, caseNoText(c.number)]))
  const alleRader = [
    ...cases.map(c => ({ ...c, rad: 'sak', radId: 'S' + c.id, prosjektNr, statusLabel: STATUS_LABELS[c.status] || c.status, statusFarge: STATUS_COLORS[c.status], ferdig: c.status === 'lukka',
      number: caseNoText(c.number) })),
    ...kort.map(k => ({ rad: 'oppgave', radId: 'O' + k.id, id: k.id, number: k.nummer, title: k.tittel, status: k.status, statusLabel: statusNamn(k.status),
      statusFarge: (ALLE_STATUSAR.find(s => s.key === k.status) || {}).farge, ansvarlig: k.ansvarleg || '', frist: k.frist || '', opprettet: k.created_at,
      prosjektNr, sakNr: k.sak_id ? sakNrAvId[k.sak_id] : '', ferdig: k.status === 'ferdig', ekstra: {}, linkedNotes: [], linkedTasks: [] })),
  ]
  const rader = alleRader.filter(r => {
    if (r.rad === 'sak' ? !visSaker : !visOppgaver) return false
    if (skjulFerdige && r.ferdig) return false
    if (fagFilter !== 'alle' && (r.rad !== 'sak' || r.fag !== fagFilter)) return false
    if (search && !((r.title || '') + ' ' + (r.rad === 'sak' ? 'S-' : 'O-') + r.number).toLowerCase().includes(search.toLowerCase())) return false
    return true
  })
  const aktiveFilter = (visSaker ? 0 : 1) + (visOppgaver ? 0 : 1) + (skjulFerdige ? 1 : 0) + (fagFilter !== 'alle' ? 1 : 0)
  const openCase = cases.find(c => c.id === openCaseId)

  // ── Ingen prosjekt valt ────────────────────────────────────────
  if (!activeProjectId) {
    return (
      <div style={{ display:'flex', flex:1, flexDirection:'column', overflow:'hidden' }}>
        <ModuleTopbar/>
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:14 }}>
          <div style={{ width:72, height:72, borderRadius:18, background:'var(--brandbg2)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, fontWeight:900, color:'var(--brand)' }}>S</div>
          <p style={{ fontSize:14, color:'var(--text3)', textAlign:'center', maxWidth:380, lineHeight:1.7 }}>
            {'Gjeremål (saker og oppgåver) er organisert per prosjekt. Vel eit prosjekt i nedtrekksmenyen \u00F8vst for \u00E5 sj\u00E5 og opprette saker og oppgåver.'}
          </p>
        </div>
      </div>
    )
  }

  function ModuleTopbar() {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0 16px',
        height:50, flexShrink:0, background:'var(--bg3)', borderBottom:'1px solid var(--border)' }}>
        {activeProject && (
          <span style={{ fontSize:12, color:'var(--text2)', fontFamily:'var(--mono)' }}>
            {activeProject.projectNumber}{' \u00B7 '}{activeProject.name}
          </span>
        )}
        {/* Søk — i den blå overskriftslinja, til høgre for overskrifta (brukar sitt krav 2. okt. 2026) */}
        {activeProjectId && (
          <div style={{ marginLeft:8 }}>
            <SokeFelt projectId={activeProjectId} kjelder={['cases']}
              onVelgResultat={r => setOpenCaseId(r.kjelde_id)} plassholder="Søk i saker…"/>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flex:1, flexDirection:'column', overflow:'hidden' }}>
      {/* Kalla som funksjon (ikkje <ModuleTopbar/>) slik at SokeFelt i han ikkje vert remonta
          (og mistar innskrive tekst) kvar gong SakerModule re-rendrar */}
      {ModuleTopbar()}

      {/* Verktøylinje */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 16px',
        background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexWrap:'wrap' }}>
        <button onClick={()=>setShowNewModal(true)}
          style={{ padding:'7px 14px', borderRadius:'var(--r)', border:'none',
            background:'var(--brand)', color:'#fff', fontWeight:700, fontSize:12.5, cursor:'pointer', fontFamily:'var(--font)' }}>
          + Ny sak
        </button>
        <button onClick={nyttKort}
          style={{ padding:'7px 14px', borderRadius:'var(--r)', border:'1.5px solid var(--brand2)',
            background:'var(--brandbg)', color:'var(--brand)', fontWeight:700, fontSize:12.5, cursor:'pointer', fontFamily:'var(--font)' }}>
          + Ny oppgåve
        </button>
        <div style={{ width:1, height:22, background:'var(--border)' }}/>
        <input placeholder={'S\u00F8k i gjeremål...'} value={search} onChange={e=>setSearch(e.target.value)}
          style={{ padding:'7px 12px', borderRadius:'var(--r)', border:'1.5px solid var(--border)',
            fontSize:12.5, fontFamily:'var(--font)', outline:'none', width:220 }}/>
        <div style={{ position:'relative' }}>
          <button onClick={()=>setFilterOpen(v=>!v)}
            style={{ padding:'7px 14px', borderRadius:'var(--r)', border:'1.5px solid '+(aktiveFilter ? 'var(--brand2)' : 'var(--border)'),
              background: aktiveFilter ? 'var(--brandbg)' : 'var(--bg2)', color: aktiveFilter ? 'var(--brand)' : 'var(--text2)',
              fontWeight:700, fontSize:12.5, cursor:'pointer', fontFamily:'var(--font)' }}>
            Filter{aktiveFilter ? ' ('+aktiveFilter+')' : ''} ▾
          </button>
          {filterOpen && (<>
            <div onClick={()=>setFilterOpen(false)} style={{ position:'fixed', inset:0, zIndex:90 }}/>
            <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:100, width:260, padding:'10px 12px', background:'var(--bg2)',
              border:'1px solid var(--border)', borderRadius:'var(--r2)', boxShadow:'var(--shadow-lg)', display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{ fontSize:10.5, fontWeight:800, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.07em' }}>Vis</div>
              <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer' }}>
                <input type="checkbox" checked={visSaker} onChange={e=>setVisSaker(e.target.checked)}/>Saker (S) <span style={{ color:'var(--text3)' }}>({cases.length})</span></label>
              <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer' }}>
                <input type="checkbox" checked={visOppgaver} onChange={e=>setVisOppgaver(e.target.checked)}/>Oppgåver (O) <span style={{ color:'var(--text3)' }}>({kort.length})</span></label>
              <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer' }}>
                <input type="checkbox" checked={skjulFerdige} onChange={e=>setSkjulFerdige(e.target.checked)}/>Skjul lukka / ferdigstilte</label>
              <div style={{ fontSize:10.5, fontWeight:800, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.07em', marginTop:4 }}>Fag (berre saker)</div>
              <select value={fagFilter} onChange={e=>setFagFilter(e.target.value)} style={FELT}>
                <option value="alle">Alle fag</option>{FAG.map(f => <option key={f} value={f}>{f}</option>)}</select>
              {aktiveFilter > 0 && <button onClick={()=>{ setVisSaker(true); setVisOppgaver(true); setSkjulFerdige(false); setFagFilter('alle') }}
                style={{ alignSelf:'flex-start', background:'none', border:'none', color:'var(--brand)', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'var(--font)', padding:0 }}>Nullstill filter</button>}
            </div>
          </>)}
        </div>
        <span style={{ fontSize:12, color:'var(--text3)' }}>{rader.length} av {alleRader.length}</span>
      </div>

      {/* Matrise */}
      {loading ? (
        <div style={{ padding:20, color:'var(--text3)', fontSize:13 }}>{'Lastar\u2026'}</div>
      ) : (
        <SakerTabell
          rader={rader}
          comments={comments}
          eigne={eigneKolonnar}
          onOpenRad={id => { const n = Number(String(id).slice(1)); if (String(id)[0] === 'S') setOpenCaseId(n); else setKortModal(kort.find(k => k.id === n) || null) }}
          onSetExtra={setExtraValue}
          onNyKolonne={addColumn}
          onSlettKolonne={deleteColumn}
        />
      )}

      {openCase && (
        <CaseDetailModal
          c={{ ...openCase, prosjektNr }}
          comments={comments[openCase.id] || []}
          notes={projectNotes}
          currentUser={currentUser}
          onClose={()=>setOpenCaseId(null)}
          onSetStatus={setCaseStatus}
          onAddComment={addComment}
          onAddNoteLink={addNoteLink}
          onRemoveNoteLink={removeNoteLink}
          onAddTaskLink={addTaskLink}
          onRemoveTaskLink={removeTaskLink}
          onUploadAttachment={uploadAttachment}
          onRemoveAttachment={removeAttachment}
          oppgaver={kort.filter(k => k.sak_id === openCase.id)}
          personar={personarListe}
          onAddOppgave={(o) => opprettOppgaver(openCase.id, [o])}
          onOpenOppgave={setKortModal}
        />
      )}

      {kortModal && (
        <KanbanKortModal key={kortModal.id || 'ny'} kort={kortModal} saker={cases} notes={projectNotes} planElement={planElement} personell={personell} tavler={tavler}
          onLagre={lagreKort} onSlett={slettKort} onLukk={() => setKortModal(null)}/>
      )}

      {showNewModal && (
        <NySakModal
          nextNumber={nextCaseNumber()}
          personnel={personarListe}
          onClose={()=>setShowNewModal(false)}
          onCreate={createCase}
        />
      )}
    </div>
  )
}

// ── Filter-chip ────────────────────────────────────────────────────
function FilterChip({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      style={{ padding:'5px 11px', borderRadius:20, border:'1.5px solid', borderColor: active ? 'var(--brand2)' : 'var(--border)',
        background: active ? 'var(--brandbg2)' : 'var(--bg2)', color: active ? 'var(--brand)' : 'var(--text3)',
        fontSize:11.5, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)', whiteSpace:'nowrap' }}>
      {children}
    </button>
  )
}

// ── Detaljmodal ──────────────────────────────────────────────────
function CaseDetailModal({ c, comments, notes, currentUser, onClose, onSetStatus, onAddComment,
                            onAddNoteLink, onRemoveNoteLink, onAddTaskLink, onRemoveTaskLink,
                            onUploadAttachment, onRemoveAttachment, oppgaver = [], personar = [], onAddOppgave, onOpenOppgave }) {
  const [nyOppg, setNyOppg] = useState({ tittel: '', ansvarleg: '', frist: '' })
  const [commentText, setCommentText] = useState('')
  const [linkNoteSel, setLinkNoteSel] = useState('')
  const [linkTaskSel, setLinkTaskSel] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef(null)

  const linkableNotes = notes.filter(n => !c.linkedNotes.includes(n.id))
  const selNoteForTask = notes.find(n => n.id === Number(linkNoteSel) || n.id === linkNoteSel)
  const linkableTasksForNote = selNoteForTask ? (selNoteForTask.tasks || [])
    .filter(t => !c.linkedTasks.some(lt => lt.noteId === selNoteForTask.id && lt.taskId === t.id)) : []

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return
    setUploading(true)
    for (const file of files) { await onUploadAttachment(c.id, file) }
    setUploading(false)
  }

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          e.preventDefault()
          const named = new File([file], `utklipp_${Date.now()}.png`, { type: file.type })
          await handleFiles([named])
        }
      }
    }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.42)', display:'flex',
        alignItems:'center', justifyContent:'center', zIndex:200 }}>
      <div onPaste={handlePaste}
        style={{ background:'var(--bg2)', borderRadius:'var(--r2)', width:640, maxWidth:'94vw', maxHeight:'90vh',
          display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>

        {/* Head */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'16px 20px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <span style={{ fontFamily:'var(--mono)', fontWeight:800, fontSize:15, color:'var(--brand)' }}>
            {c.prosjektNr ? c.prosjektNr + ' \u00B7 ' : ''}{'Sak '}{caseNoText(c.number)}
          </span>
          <span style={{ color:'var(--text3)', fontSize:12 }}>{c.fag}{' \u00B7 '}{c.type}</span>
          <button onClick={onClose} style={{ marginLeft:'auto', background:'none', border:'none', fontSize:20,
            cursor:'pointer', color:'var(--text3)', lineHeight:1, padding:4 }}>{'\u00D7'}</button>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:'18px 20px' }}>
          <div style={{ fontSize:17, fontWeight:700, marginBottom:4 }}>{c.title}</div>
          {c.description && <div style={{ fontSize:13, color:'var(--text2)', marginBottom:16, lineHeight:1.6 }}>{c.description}</div>}

          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'12px 20px', marginBottom:16,
            padding:'14px 16px', background:'var(--bg3)', borderRadius:'var(--r)' }}>
            <Field label="Ansvarleg" value={c.ansvarlig || '\u2014'}/>
            <Field label="Frist" value={fmtDate(c.frist)}/>
            <Field label="Tegning" value={c.tegning || '\u2014'}/>
            <Field label="Prioritet" value={PRIO_LABELS[c.prioritet]}/>
          </div>

          {/* Status */}
          <div style={{ marginBottom:18 }}>
            <SectionLabel>Status</SectionLabel>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:6 }}>
              {STATUS_ORDER.map(s => (
                <button key={s} onClick={()=>onSetStatus(c.id, s)}
                  style={{ padding:'7px 13px', borderRadius:'var(--r)', fontSize:12, fontWeight:700, cursor:'pointer',
                    fontFamily:'var(--font)',
                    border: c.status===s ? `2px solid ${STATUS_COLORS[s]}` : '1.5px solid var(--border)',
                    background: c.status===s ? STATUS_COLORS[s] : 'var(--bg2)',
                    color: c.status===s ? '#fff' : 'var(--text3)' }}>
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Oppgåver i saka */}
          <div style={{ marginBottom:18 }}>
            <SectionLabel>{'Oppg\u00E5ver i saka'} ({oppgaver.length})</SectionLabel>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
              {oppgaver.map(k => {
                const pf = personFarge(k.ansvarleg)
                return (
                  <div key={k.id} onClick={() => onOpenOppgave?.(k)} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'var(--bg3)', borderRadius:'var(--r)', cursor:'pointer', fontSize:12.5 }}>
                    <span style={{ fontFamily:'var(--mono)', fontWeight:700, color:'#2F8A80' }}>O-{k.nummer}</span>
                    <span style={{ flex:1, fontWeight:600, color:'var(--text)' }}>{k.tittel}</span>
                    {k.ansvarleg && <span style={{ fontWeight:600, color: pf ? pf.fg : 'var(--text2)' }}>{k.ansvarleg}</span>}
                    {k.frist && <span style={{ color:'var(--text3)' }}>{'\u23F1 '}{fmtKortDato(k.frist)}</span>}
                    <span style={{ fontSize:10.5, fontWeight:700, textTransform:'uppercase', color:(ALLE_STATUSAR.find(s=>s.key===k.status)||{}).farge }}>{statusNamn(k.status)}</span>
                  </div>
                )
              })}
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <input value={nyOppg.tittel} onChange={e=>setNyOppg(o=>({ ...o, tittel:e.target.value }))} placeholder={'Ny oppg\u00E5ve i saka\u2026'} style={{ ...FELT, flex:'2 1 180px', width:'auto' }}/>
                <div style={{ flex:'1 1 140px' }}><PersonVelger value={nyOppg.ansvarleg} onChange={v=>setNyOppg(o=>({ ...o, ansvarleg:v }))} personar={personar}/></div>
                <div style={{ flex:'1 1 130px' }}><DatePicker value={nyOppg.frist} onChange={v=>setNyOppg(o=>({ ...o, frist:v }))} placeholder="Frist" style={FELT}/></div>
                <button disabled={!nyOppg.tittel.trim()} onClick={async()=>{ await onAddOppgave?.(nyOppg); setNyOppg({ tittel:'', ansvarleg:'', frist:'' }) }}
                  style={{ padding:'7px 14px', borderRadius:7, border:'1.5px solid var(--brand2)', background:'var(--brandbg)', color:'var(--brand)', fontWeight:700, fontSize:12.5,
                    cursor:'pointer', fontFamily:'var(--font)', opacity: nyOppg.tittel.trim() ? 1 : .5 }}>Legg til</button>
              </div>
            </div>
          </div>

          {/* Vedlegg */}
          <div style={{ marginBottom:18 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <SectionLabel>Vedlegg{uploading ? ' \u2014 lastar opp\u2026' : ''}</SectionLabel>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={()=>fileInputRef.current?.click()}
                  style={{ padding:'6px 12px', borderRadius:'var(--r)', border:'1.5px solid var(--brand2)',
                    background:'var(--brandbg)', color:'var(--brand)', fontWeight:700, fontSize:11.5,
                    cursor:'pointer', fontFamily:'var(--font)' }}>
                  {'\u{1F4CE}'} Legg til fil / utklipp
                </button>
                <input ref={fileInputRef} type="file" multiple style={{ display:'none' }}
                  onChange={e => { handleFiles([...e.target.files]); e.target.value = '' }}/>
              </div>
            </div>
            <div
              onDragOver={e=>{ e.preventDefault(); setDragActive(true) }}
              onDragLeave={()=>setDragActive(false)}
              onDrop={e=>{ e.preventDefault(); setDragActive(false); handleFiles([...e.dataTransfer.files]) }}
              style={{ border:`1.5px dashed ${dragActive ? 'var(--brand2)' : 'var(--border)'}`,
                borderRadius:'var(--r)', padding: c.attachments.length ? 10 : 18,
                background: dragActive ? 'var(--brandbg)' : 'var(--bg3)', transition:'all .15s' }}>
              {c.attachments.length === 0 ? (
                <div style={{ textAlign:'center', color:'var(--text3)', fontSize:12 }}>
                  Dra og slepp filer hit, eller lim inn eit utklipp (Ctrl+V) direkte i vindauget
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  {c.attachments.map((att, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px',
                      background:'var(--bg2)', borderRadius:'var(--r)', border:'1px solid var(--border)' }}>
                      <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 7px', borderRadius:5,
                        background:'var(--brandbg)', color:'var(--brand)', flexShrink:0 }}>
                        {att.type?.includes('image') ? 'BILETE' : att.type?.includes('pdf') ? 'PDF' : 'FIL'}
                      </span>
                      <a href={att.url} target="_blank" rel="noreferrer"
                        style={{ flex:1, fontSize:12.5, color:'var(--brand)', fontWeight:500, textDecoration:'none',
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {att.name}
                      </a>
                      <span style={{ fontSize:10.5, color:'var(--text3)' }}>{(att.size/1024).toFixed(0)} KB</span>
                      <button onClick={()=>onRemoveAttachment(c.id, att.path)}
                        style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer', padding:2 }}>
                        <span style={{ fontWeight:800, fontSize:13 }}>{'\u00D7'}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Kopla notat */}
          <div style={{ marginBottom:18 }}>
            <SectionLabel>Kopla notat</SectionLabel>
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <select value={linkNoteSel} onChange={e=>setLinkNoteSel(e.target.value)}
                style={{ flex:1, padding:'7px 10px', borderRadius:'var(--r)', border:'1.5px solid var(--border)',
                  fontFamily:'var(--font)', fontSize:12.5, outline:'none' }}>
                <option value="">{'Vel notat \u00E5 kople til...'}</option>
                {linkableNotes.map(n => <option key={n.id} value={n.id}>{n.title || n.text?.slice(0,50) || 'Notat'}</option>)}
              </select>
              <button onClick={()=>{ if (linkNoteSel) { onAddNoteLink(c.id, Number(linkNoteSel)); setLinkNoteSel('') } }}
                style={{ padding:'7px 12px', borderRadius:'var(--r)', border:'1.5px solid var(--brand2)',
                  background:'var(--brandbg)', color:'var(--brand)', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'var(--font)' }}>
                Kople
              </button>
            </div>
            {c.linkedNotes.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:8 }}>
                {c.linkedNotes.map(id => {
                  const n = notes.find(x => x.id === id)
                  if (!n) return null
                  return (
                    <div key={id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px',
                      background:'var(--bg3)', borderRadius:6, fontSize:12.5 }}>
                      <span style={{ width:20, height:20, borderRadius:5, display:'flex', alignItems:'center',
                        justifyContent:'center', fontSize:10, fontWeight:800, color:'#fff', background:'#52B788', flexShrink:0 }}>N</span>
                      <span style={{ flex:1, fontWeight:500 }}>{n.title || n.text?.slice(0,50) || 'Notat'}</span>
                      <button onClick={()=>onRemoveNoteLink(c.id, id)}
                        style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:13, padding:'2px 5px' }}>{'\u00D7'}</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Kopla oppgåve */}
          <div style={{ marginBottom:18 }}>
            <SectionLabel>{'Kopla oppg\u00E5ve'}</SectionLabel>
            <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
              <select value={linkNoteSel} onChange={e=>{ setLinkNoteSel(e.target.value); setLinkTaskSel('') }}
                style={{ flex:'1 1 200px', padding:'7px 10px', borderRadius:'var(--r)', border:'1.5px solid var(--border)',
                  fontFamily:'var(--font)', fontSize:12.5, outline:'none' }}>
                <option value="">{'Vel notat med oppg\u00E5va...'}</option>
                {notes.filter(n => (n.tasks||[]).length > 0).map(n => (
                  <option key={n.id} value={n.id}>{n.title || n.text?.slice(0,40) || 'Notat'}</option>
                ))}
              </select>
              <select value={linkTaskSel} onChange={e=>setLinkTaskSel(e.target.value)} disabled={!selNoteForTask}
                style={{ flex:'1 1 200px', padding:'7px 10px', borderRadius:'var(--r)', border:'1.5px solid var(--border)',
                  fontFamily:'var(--font)', fontSize:12.5, outline:'none' }}>
                <option value="">{'Vel oppg\u00E5ve...'}</option>
                {linkableTasksForNote.map(t => <option key={t.id} value={t.id}>{t.text}</option>)}
              </select>
              <button onClick={()=>{
                  if (selNoteForTask && linkTaskSel) {
                    onAddTaskLink(c.id, selNoteForTask.id, Number(linkTaskSel) || linkTaskSel)
                    setLinkTaskSel('')
                  }
                }}
                style={{ padding:'7px 12px', borderRadius:'var(--r)', border:'1.5px solid var(--brand2)',
                  background:'var(--brandbg)', color:'var(--brand)', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'var(--font)' }}>
                Kople
              </button>
            </div>
            {c.linkedTasks.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:8 }}>
                {c.linkedTasks.map((lt, i) => {
                  const note = notes.find(n => n.id === lt.noteId)
                  const task = note?.tasks?.find(t => t.id === lt.taskId)
                  if (!task) return null
                  return (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px',
                      background:'var(--bg3)', borderRadius:6, fontSize:12.5 }}>
                      <span style={{ width:20, height:20, borderRadius:5, display:'flex', alignItems:'center',
                        justifyContent:'center', fontSize:10, fontWeight:800, color:'#fff', background:'#4EADA3', flexShrink:0 }}>O</span>
                      <span style={{ flex:1, fontWeight:500 }}>{task.text}</span>
                      <button onClick={()=>onRemoveTaskLink(c.id, lt.noteId, lt.taskId)}
                        style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:13, padding:'2px 5px' }}>{'\u00D7'}</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Aktivitet / kommentarar */}
          <div>
            <SectionLabel>Aktivitet ({comments.length})</SectionLabel>
            <div style={{ display:'flex', flexDirection:'column', gap:12, marginTop:10 }}>
              {comments.map(cm => (
                <div key={cm.id} style={{ display:'flex', gap:10 }}>
                  <div style={{ width:30, height:30, borderRadius:'50%', background:'var(--brandbg2)', color:'var(--brand)',
                    display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:11.5, flexShrink:0 }}>
                    {initials(cm.author)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'baseline', gap:7, marginBottom:2 }}>
                      <span style={{ fontWeight:700, fontSize:12.5 }}>{cm.author}</span>
                      <span style={{ fontSize:10.5, color:'var(--text3)' }}>{fmtTime(cm.time)}</span>
                    </div>
                    {cm.system ? (
                      <div style={{ color:'var(--text3)', fontStyle:'italic', fontSize:11.5 }}>{cm.text}</div>
                    ) : (
                      <div style={{ fontSize:12.5, color:'var(--text2)', background:'var(--bg3)', padding:'8px 12px',
                        borderRadius:'var(--r)', lineHeight:1.5 }}>{cm.text}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop:16, paddingTop:14, borderTop:'1px solid var(--border)', display:'flex', gap:8, alignItems:'flex-start' }}>
              <div style={{ width:30, height:30, borderRadius:'50%', background:'var(--brandbg2)', color:'var(--brand)',
                display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:11.5, flexShrink:0 }}>
                {initials(currentUser)}
              </div>
              <textarea value={commentText} onChange={e=>setCommentText(e.target.value)}
                placeholder="Skriv ein kommentar..."
                style={{ flex:1, padding:'8px 12px', borderRadius:'var(--r)', border:'1.5px solid var(--border)',
                  fontFamily:'var(--font)', fontSize:12.5, resize:'vertical', minHeight:40, outline:'none' }}/>
              <button onClick={()=>{ onAddComment(c.id, commentText); setCommentText('') }}
                style={{ padding:'8px 16px', borderRadius:'var(--r)', border:'none', background:'var(--brand)',
                  color:'#fff', fontWeight:700, fontSize:12.5, cursor:'pointer', fontFamily:'var(--font)', whiteSpace:'nowrap' }}>
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:10, fontWeight:700, color:'var(--text3)', letterSpacing:'.04em',
        textTransform:'uppercase', marginBottom:3 }}>{label}</label>
      <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{value}</div>
    </div>
  )
}
function SectionLabel({ children }) {
  return (
    <label style={{ fontSize:11, fontWeight:700, color:'var(--text3)', letterSpacing:'.04em', textTransform:'uppercase' }}>
      {children}
    </label>
  )
}

