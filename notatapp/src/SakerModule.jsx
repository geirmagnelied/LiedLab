import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import DatePicker from './DatePicker'
import SakerTabell from './SakerTabell'
import NySakModal from './NySakModal'
import OppgaveVindauge from './OppgaveVindauge'
import OppgaveInnfoering from './OppgaveInnfoering'
import Timeline from './Timeline'
import usePersonar from './usePersonar'
import { opneVedlegg } from './vedlegg'
import { FELT } from './FlyttbartModal'
import { personFarge, fmtDato as fmtKortDato } from './kanbanLogikk'
import {
  FAG,
  STATUS_LABELS, STATUS_ORDER, STATUS_COLORS, normaliserStatus, fristIPeriode,
  PRIO_LABELS, caseNoText,
} from './sakerKonstantar'

function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('no-NO', { day:'2-digit', month:'short' }) + ' ' + d.toLocaleTimeString('no-NO', { hour:'2-digit', minute:'2-digit', hour12:false })
}
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('no-NO', { day:'2-digit', month:'short', year:'numeric' })
}
function initials(name) { return (name || '?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() }

// ═══════════════════════════════════════════════════════════════════
//  Saksbehandling — saker (cases) og oppgåver (notat-oppgåver, notes.tasks) i éi tabell.
//  Oppgåver er IKKJE Kanban-kort: dei vert laga med same inndata som «Ny oppgåve» i Notatar (OppgaveInnfoering) og kan høyre til ei sak
//  (cases.linked_tasks). Kanban-kort er eigne kort som brukaren sjølv lagar i Kanban-modulen.
//  Saksstatus: Registrert (raud) → Påbegynt (gul) → Lukka (grøn).
// ═══════════════════════════════════════════════════════════════════
const oppgRadId = (noteId, taskId) => 'O' + noteId + '_' + taskId

export default function SakerModule({ userId, userEmail, activeProjectId, projects, notes, activeOfficeId, onAddNote, onUpdateTask, onDeleteTask }) {
  const activeProject = (projects || []).find(p => p.id === activeProjectId)
  // Berre notat frå det aktive prosjektet skal kunne koplast til ei sak
  const projectNotes = (notes || []).filter(n => n.projectId === activeProjectId)
  // Personell-forslag: prosjektets personell, brukaren sjølv og deltakarlister i prosjektets møtereferat
  const personnelList = Array.from(new Set(projectNotes.flatMap(n => n.attendees || []).filter(Boolean))).sort()
  const { personar: personarHook, meg } = usePersonar(userId, activeProjectId)
  const personarListe = Array.from(new Set([...personarHook, ...personnelList].filter(Boolean)))

  const [cases, setCases]           = useState([])
  const [comments, setComments]     = useState({}) // caseId -> [comment,...]
  const [eigneKolonnar, setEigneKolonnar] = useState([]) // eigendefinerte kolonnar for prosjektet
  const [loading, setLoading]       = useState(true)
  const [fagFilter, setFagFilter]   = useState('alle')
  const [search, setSearch]         = useState('')
  const [openCaseId, setOpenCaseId] = useState(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [oppgModal, setOppgModal]   = useState(null) // { modus: 'ny' } | { modus: 'edit', noteId, task }
  const [visSaker, setVisSaker]     = useState(true)
  const [visOppgaver, setVisOppgaver] = useState(true)
  const [skjulFerdige, setSkjulFerdige] = useState(false)
  const [fristFilter, setFristFilter] = useState('alle') // 'alle' | 'veke' | 'manad'
  const [filterOpen, setFilterOpen] = useState(false)
  const [tidslinje, setTidslinje]   = useState(() => { try { return localStorage.getItem('liedlab-gjeremaal-tidslinje') === '1' } catch { return false } })
  const [tlHogd, setTlHogd]         = useState(() => { try { return Number(localStorage.getItem('liedlab-gjeremaal-tidslinje-h')) || 230 } catch { return 230 } })
  const currentUser = userEmail || 'Ukjend brukar'

  const settTidslinje = (v) => { setTidslinje(v); try { localStorage.setItem('liedlab-gjeremaal-tidslinje', v ? '1' : '0') } catch { /* privat modus */ } }
  const settTlHogd = (h) => { setTlHogd(h); try { localStorage.setItem('liedlab-gjeremaal-tidslinje-h', String(h)) } catch { /* privat modus */ } }

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
      fag: c.fag, type: c.type, status: normaliserStatus(c.status), prioritet: c.prioritet,
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

  // ── Saksnummer per prosjekt ───────────────────────────────────
  // Saksnummeret er berre eit lopande tal. Prosjektet går fram av
  // prosjektnummer-kolonna, så nummeret treng ikkje prefiks.
  const nextCaseNumber = () => {
    const nums = cases.map(c => parseInt(caseNoText(c.number), 10)).filter(n => !isNaN(n))
    return String((nums.length ? Math.max(...nums) : 0) + 1)
  }

  // ── Oppgåver: vanlege notat-oppgåver (lagt i eit «oppgåve»-notat, som i Ny oppgåve), valfritt lenkja til ei sak ──
  const opprettOppgaver = async (liste, sakId = null) => {
    if (!liste?.length || !onAddNote) return
    const tasks = liste.map((t, i) => ({ ...t, id: Date.now() + i }))
    const tittel = tasks.length === 1 ? `Oppgåve: ${tasks[0].text.substring(0, 50)}` : `${tasks.length} arbeidsoppgåver`
    const res = await onAddNote({ title: tittel, text: '', html: '', tasks, tag: 'oppgåve', projectId: activeProjectId, sketchDataUrl: null, attachments: [], isMeeting: false })
    if (sakId && res?.id) {
      const eksisterande = cases.find(x => x.id === sakId)?.linkedTasks || []
      const nye = [...eksisterande, ...tasks.map(t => ({ noteId: res.id, taskId: t.id }))]
      const { error } = await supabase.from('cases').update({ linked_tasks: nye }).eq('id', sakId).eq('user_id', userId)
      if (error) { alert('Oppgåvene vart lagra, men kopling til saka feila: ' + error.message); return }
      await supabase.from('case_comments').insert({
        id: Date.now() + 500, case_id: sakId, user_id: userId, author: currentUser, system: true,
        text: `${currentUser} la til ${tasks.length === 1 ? 'oppgåva' : tasks.length + ' oppgåver'}: ${tasks.map(t => '«' + t.text.substring(0, 40) + '»').join(', ')}`,
        created_at: new Date().toISOString(),
      })
      await loadCases()
    }
  }

  // ── Opprett sak ────────────────────────────────────────────────
  // Saka vert registrert (status «Registrert») og vindauget lukkar seg — ingen ny dialog.
  const createCase = async (fields, stagedFiles) => {
    if (!fields.title.trim()) { alert('Tittel er påkrevd'); return false }
    const id = Date.now()
    const row = {
      id, user_id: userId, project_id: activeProjectId,
      number: nextCaseNumber(), title: fields.title.trim(), description: fields.description.trim(),
      fag: fields.fag, type: '', status: 'ny', prioritet: fields.prioritet,
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

    if ((fields.oppgaver || []).length) await opprettOppgaver(fields.oppgaver, id)
    setShowNewModal(false)
    await loadCases()
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
      text: `${currentUser} endra status frå "${oldLabel}" til "${STATUS_LABELS[newStatus]}"`,
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


  // ── Samla liste: saker og oppgåver ────────────────────────────
  const prosjektNr = activeProject?.projectNumber || ''
  const sakNrAvOppgave = {}
  cases.forEach(c => (c.linkedTasks || []).forEach(l => { sakNrAvOppgave[l.noteId + '|' + l.taskId] = caseNoText(c.number) }))
  const oppgaveRader = projectNotes.flatMap(n => (n.tasks || []).map(t => ({
    rad: 'oppgave', radId: oppgRadId(n.id, t.id), id: t.id, noteId: n.id, number: t.nr ?? '', title: t.text || '',
    status: t.done ? 'lukka' : 'ny', statusLabel: STATUS_LABELS[t.done ? 'lukka' : 'ny'], statusFarge: STATUS_COLORS[t.done ? 'lukka' : 'ny'],
    ansvarlig: t.ansvarleg || '', frist: t.date || '', opprettet: t.id > 1e12 ? new Date(t.id).toISOString() : (n.createdAt || ''),
    prosjektNr, sakNr: sakNrAvOppgave[n.id + '|' + t.id] || '', ferdig: !!t.done, ekstra: {}, linkedNotes: [], linkedTasks: [],
  })))
  const alleRader = [
    ...cases.map(c => ({ ...c, rad: 'sak', radId: 'S' + c.id, prosjektNr, statusLabel: STATUS_LABELS[c.status] || c.status, statusFarge: STATUS_COLORS[c.status], ferdig: c.status === 'lukka',
      number: caseNoText(c.number) })),
    ...oppgaveRader,
  ]
  const soek = search.trim().toLowerCase()
  const rader = alleRader.filter(r => {
    if (r.rad === 'sak' ? !visSaker : !visOppgaver) return false
    if (skjulFerdige && r.ferdig) return false
    if (fagFilter !== 'alle' && (r.rad !== 'sak' || r.fag !== fagFilter)) return false
    if (fristFilter !== 'alle' && !fristIPeriode(r.frist, fristFilter)) return false
    if (soek && ![r.title, r.number, r.description, r.ansvarlig, r.fag, r.statusLabel, r.rad === 'sak' ? 'sak' : 'oppgåve'].join(' ').toLowerCase().includes(soek)) return false
    return true
  })
  const aktiveFilter = (visSaker ? 0 : 1) + (visOppgaver ? 0 : 1) + (skjulFerdige ? 1 : 0) + (fagFilter !== 'alle' ? 1 : 0) + (fristFilter !== 'alle' ? 1 : 0)
  const openCase = cases.find(c => c.id === openCaseId)
  const nullstillFilter = () => { setVisSaker(true); setVisOppgaver(true); setSkjulFerdige(false); setFagFilter('alle'); setFristFilter('alle') }

  const opneRad = (id) => {
    const s = String(id)
    if (s[0] === 'S') { setOpenCaseId(Number(s.slice(1))); return }
    const m = s.match(/^O(\d+)_(\d+)$/); if (!m) return
    const note = (notes || []).find(n => String(n.id) === m[1]); const task = (note?.tasks || []).find(t => String(t.id) === m[2])
    if (note && task) setOppgModal({ modus: 'edit', noteId: note.id, task })
  }

  // Tidslinja (same komponent som i Notatar) får ei «notat»-rad per sak/oppgåve med frist
  const tidslinjeNotat = rader.filter(r => r.frist).map(r => ({
    id: r.radId, title: r.title, text: r.title, html: '', done: false, projectId: activeProjectId,
    tasks: [{ id: r.radId, text: (r.rad === 'sak' ? 'Sak ' : '') + r.title, date: String(r.frist).slice(0, 10), done: false }],
  }))

  // ── Ingen prosjekt valt ────────────────────────────────────────
  if (!activeProjectId) {
    return (
      <div style={{ display:'flex', flex:1, flexDirection:'column', overflow:'hidden' }}>
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:14 }}>
          <div style={{ width:72, height:72, borderRadius:18, background:'var(--brandbg2)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, fontWeight:900, color:'var(--brand)' }}>S</div>
          <p style={{ fontSize:14, color:'var(--text3)', textAlign:'center', maxWidth:380, lineHeight:1.7 }}>
            {'Saksbehandling (saker og oppgåver) er organisert per prosjekt. Vel eit prosjekt i nedtrekksmenyen øvst for å sjå og opprette saker og oppgåver.'}
          </p>
        </div>
      </div>
    )
  }

  const KNAPP_PRIM = { padding:'7px 14px', borderRadius:'var(--r)', border:'none', background:'var(--brand)', color:'#fff', fontWeight:700, fontSize:12.5, cursor:'pointer', fontFamily:'var(--font)' }
  const KNAPP_SEK = { padding:'7px 14px', borderRadius:'var(--r)', border:'1.5px solid var(--brand2)', background:'var(--brandbg)', color:'var(--brand)', fontWeight:700, fontSize:12.5, cursor:'pointer', fontFamily:'var(--font)' }
  const ETIKETT = { fontSize:10.5, fontWeight:800, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.07em' }

  // Verktøylinja i tabellen: ny sak/oppgåve, søk (i både saker og oppgåver, etter filteret), filter — og Visning/kolonnar står til høgre for dei
  const verktoyForan = (<>
    <button onClick={()=>setShowNewModal(true)} style={KNAPP_PRIM}>+ Ny sak</button>
    <button onClick={()=>setOppgModal({ modus: 'ny' })} style={KNAPP_SEK}>{'+ Ny oppgåve'}</button>
    <div style={{ width:1, height:22, background:'var(--border)' }}/>
    <input placeholder={'Søk i saker og oppgåver…'} value={search} onChange={e=>setSearch(e.target.value)}
      style={{ padding:'7px 12px', borderRadius:'var(--r)', border:'1.5px solid var(--border)', background:'var(--bg)', color:'var(--text)',
        fontSize:12.5, fontFamily:'var(--font)', outline:'none', width:230 }}/>
    <div style={{ position:'relative' }}>
      <button type="button" className="dt-knapp" onClick={()=>setFilterOpen(v=>!v)}
        style={aktiveFilter ? { borderColor:'var(--brand2)', background:'var(--brandbg)', color:'var(--brand)' } : undefined}>
        Filter{aktiveFilter ? ' ('+aktiveFilter+')' : ''} ▾
      </button>
      {filterOpen && (<>
        <div onClick={()=>setFilterOpen(false)} style={{ position:'fixed', inset:0, zIndex:90 }}/>
        <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:100, width:270, padding:'10px 12px', background:'var(--bg2)',
          border:'1px solid var(--border)', borderRadius:'var(--r2)', boxShadow:'var(--shadow-lg)', display:'flex', flexDirection:'column', gap:8 }}>
          <div style={ETIKETT}>Vis</div>
          <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer' }}>
            <input type="checkbox" checked={visSaker} onChange={e=>setVisSaker(e.target.checked)}/>Saker <span style={{ color:'var(--text3)' }}>({cases.length})</span></label>
          <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer' }}>
            <input type="checkbox" checked={visOppgaver} onChange={e=>setVisOppgaver(e.target.checked)}/>{'Oppgåver'} <span style={{ color:'var(--text3)' }}>({oppgaveRader.length})</span></label>
          <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer' }}>
            <input type="checkbox" checked={skjulFerdige} onChange={e=>setSkjulFerdige(e.target.checked)}/>Skjul lukka</label>
          <div style={{ ...ETIKETT, marginTop:4 }}>Frist</div>
          {[['alle', 'Alle fristar'], ['veke', 'Frist denne veka'], ['manad', 'Frist denne månaden']].map(([v, t]) => (
            <label key={v} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer' }}>
              <input type="radio" name="gjeremaal-frist" checked={fristFilter === v} onChange={()=>setFristFilter(v)}/>{t}</label>
          ))}
          <div style={{ ...ETIKETT, marginTop:4 }}>Fag (berre saker)</div>
          <select value={fagFilter} onChange={e=>setFagFilter(e.target.value)} style={FELT}>
            <option value="alle">Alle fag</option>{FAG.map(f => <option key={f} value={f}>{f}</option>)}</select>
          {aktiveFilter > 0 && <button onClick={nullstillFilter}
            style={{ alignSelf:'flex-start', background:'none', border:'none', color:'var(--brand)', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'var(--font)', padding:0 }}>Nullstill filter</button>}
        </div>
      </>)}
    </div>
  </>)
  const verktoyEtter = (
    <button type="button" className="dt-knapp" onClick={()=>settTidslinje(!tidslinje)} title="Vis frist-tidslinja (same som i Notatar) for saker og oppgåver"
      style={tidslinje ? { borderColor:'var(--brand2)', background:'var(--brandbg)', color:'var(--brand)' } : undefined}>Tidslinje</button>
  )

  return (
    <div style={{ display:'flex', flex:1, flexDirection:'column', overflow:'hidden' }}>
      {/* Matrise */}
      {loading ? (
        <div style={{ padding:20, color:'var(--text3)', fontSize:13 }}>{'Lastar…'}</div>
      ) : (
        <SakerTabell
          rader={rader}
          comments={comments}
          eigne={eigneKolonnar}
          onOpenRad={opneRad}
          onSetExtra={setExtraValue}
          onNyKolonne={addColumn}
          onSlettKolonne={deleteColumn}
          verktoyForan={verktoyForan}
          verktoyEtter={verktoyEtter}
        />
      )}

      {tidslinje && (
        <div style={{ height:tlHogd, minHeight:90, maxHeight:600, flexShrink:0 }}>
          <Timeline notes={tidslinjeNotat} projects={activeProject ? [activeProject] : []} height={tlHogd} onResize={settTlHogd}
            onSelectNote={opneRad} onEditNote={opneRad}/>
        </div>
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
          personar={personarListe}
          meg={meg}
          onAddOppgave={(t) => opprettOppgaver([t], openCase.id)}
          onOpenOppgave={opneRad}
          onToggleOppgave={(noteId, taskId, done) => onUpdateTask?.(noteId, taskId, { done })}
        />
      )}

      {oppgModal && (
        <OppgaveVindauge key={oppgModal.task?.id || 'ny'} modus={oppgModal.modus} oppgave={oppgModal.task}
          saker={cases.filter(c => c.status !== 'lukka').map(c => ({ id: c.id, title: c.title, nr: 'Sak ' + caseNoText(c.number) }))}
          sakNr={oppgModal.task ? (sakNrAvOppgave[oppgModal.noteId + '|' + oppgModal.task.id] ? 'Sak ' + sakNrAvOppgave[oppgModal.noteId + '|' + oppgModal.task.id] : '') : ''}
          personar={personarListe} meg={meg}
          onLagreNye={async (liste, sakId) => { await opprettOppgaver(liste, sakId); setOppgModal(null) }}
          onLagreEndring={async (changes) => { await onUpdateTask?.(oppgModal.noteId, oppgModal.task.id, changes); setOppgModal(null) }}
          onSlett={async () => { await onDeleteTask?.(oppgModal.noteId, oppgModal.task.id); setOppgModal(null) }}
          onLukk={() => setOppgModal(null)}/>
      )}

      {showNewModal && (
        <NySakModal
          nextNumber={nextCaseNumber()}
          personnel={personarListe}
          meg={meg}
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
                            onUploadAttachment, onRemoveAttachment, personar = [], meg = '', onAddOppgave, onOpenOppgave, onToggleOppgave }) {
  const [nyStatus, setNyStatus] = useState(null) // status valt av brukaren i svarfeltet (null = ikkje rørt)
  const [commentText, setCommentText] = useState('')
  const [linkNoteSel, setLinkNoteSel] = useState('')
  const [linkTaskSel, setLinkTaskSel] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef(null)

  // Oppgåver som høyrer til saka (lenkja via linked_tasks)
  const oppgaver = (c.linkedTasks || []).map(l => {
    const note = notes.find(n => String(n.id) === String(l.noteId)); const task = (note?.tasks || []).find(t => String(t.id) === String(l.taskId))
    return task ? { ...task, noteId: note.id } : null
  }).filter(Boolean)
  // Svarar nokon på ei registrert sak, vert «Påbegynt» foreslått (kan stillast tilbake til Registrert)
  const foreslaattStatus = nyStatus ?? ((c.status === 'ny' && commentText.trim()) ? 'arbeid' : c.status)

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
          <span style={{ color:'var(--text3)', fontSize:12 }}>{[c.fag, c.type].filter(Boolean).join(' \u00B7 ')}</span>
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

          {/* Oppgåver i saka — same inndata som Ny oppgåve */}
          <div style={{ marginBottom:18 }}>
            <SectionLabel>{'Oppgåver i saka'} ({oppgaver.length})</SectionLabel>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
              {oppgaver.map(t => {
                const pf = personFarge(t.ansvarleg)
                return (
                  <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'var(--bg3)', borderRadius:'var(--r)', fontSize:12.5 }}>
                    <input type="checkbox" checked={!!t.done} onChange={e => onToggleOppgave?.(t.noteId, t.id, e.target.checked)} title="Ferdig"/>
                    {t.nr != null && <span style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--text3)' }}>{t.nr}</span>}
                    <span onClick={() => onOpenOppgave?.('O' + t.noteId + '_' + t.id)} style={{ flex:1, fontWeight:600, color:'var(--text)', cursor:'pointer', textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? .6 : 1 }}>{t.text}</span>
                    {t.ansvarleg && <span style={{ fontWeight:600, color: pf ? pf.fg : 'var(--text2)' }}>{t.ansvarleg}</span>}
                    {t.date && <span style={{ color:'var(--text3)' }}>{'⏱ '}{fmtKortDato(t.date)}</span>}
                  </div>
                )
              })}
              <div style={{ padding:'10px 12px', background:'var(--bg3)', borderRadius:'var(--r)' }}>
                <OppgaveInnfoering personar={personar} standardAnsvarleg={meg} knapp hjelp={false} onLeggTil={t => onAddOppgave?.(t)}/>
              </div>
            </div>
          </div>


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
                      <a href={att.url} target="_blank" rel="noreferrer" onClick={e => opneVedlegg(e, att)}
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
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <select value={foreslaattStatus} onChange={e => setNyStatus(e.target.value)} title="Status for saka etter svaret"
                style={{ padding:'7px 8px', borderRadius:'var(--r)', border:'1.5px solid ' + STATUS_COLORS[foreslaattStatus], background:'var(--bg)', color:STATUS_COLORS[foreslaattStatus], fontWeight:700, fontSize:12, fontFamily:'var(--font)', outline:'none' }}>
                {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
              <button onClick={async ()=>{
                  if (!commentText.trim() && foreslaattStatus === c.status) return
                  if (commentText.trim()) await onAddComment(c.id, commentText)
                  if (foreslaattStatus !== c.status) await onSetStatus(c.id, foreslaattStatus)
                  setCommentText(''); setNyStatus(null)
                }}
                style={{ padding:'8px 16px', borderRadius:'var(--r)', border:'none', background:'var(--brand)',
                  color:'#fff', fontWeight:700, fontSize:12.5, cursor:'pointer', fontFamily:'var(--font)', whiteSpace:'nowrap' }}>
                Send
              </button>
              </div>
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

