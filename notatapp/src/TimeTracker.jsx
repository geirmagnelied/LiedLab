import { useState, useEffect, useRef, useMemo } from 'react'
import DatePicker from './DatePicker'
import { supabase } from './supabase'
import { favorittForst, prosjektValTekst } from './projectFavoritt'

// ── Time parsing ──────────────────────────────────────────────────────────
export function parseTimeInput(raw) {
  if (!raw) return { hours: 0, startTime: null, endTime: null, error: null }
  const s = String(raw).trim().toLowerCase()

  const rangeMatch = s.match(/^(\d{1,2})[.:]?(\d{0,2})\s*[-–—]\s*(\d{1,2})[.:]?(\d{0,2})$/)
  if (rangeMatch) {
    const sh = parseInt(rangeMatch[1])
    const sm = rangeMatch[2] ? parseInt(rangeMatch[2].padEnd(2,'0')) : 0
    const eh = parseInt(rangeMatch[3])
    const em = rangeMatch[4] ? parseInt(rangeMatch[4].padEnd(2,'0')) : 0
    if (sh < 0 || sh > 23 || eh < 0 || eh > 24 || sm > 59 || em > 59) {
      return { hours: 0, error: 'Ugyldig klokkeslett' }
    }
    const startMin = sh * 60 + sm
    let endMin     = eh * 60 + em
    if (endMin <= startMin) endMin += 24 * 60
    const hours    = (endMin - startMin) / 60
    const fmt = (h,m) => `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
    return {
      hours: Math.round(hours * 100) / 100,
      startTime: fmt(sh, sm), endTime: fmt(eh, em), error: null,
    }
  }

  const tMinMatch = s.match(/^(\d+)\s*t(?:imar?)?\s*(\d+)\s*m(?:in)?$/)
  if (tMinMatch) {
    const h = parseInt(tMinMatch[1]) + parseInt(tMinMatch[2])/60
    return { hours: Math.round(h*100)/100, error: null }
  }

  const colonMatch = s.match(/^(\d+):(\d{2})$/)
  if (colonMatch) {
    const h = parseInt(colonMatch[1]) + parseInt(colonMatch[2])/60
    return { hours: Math.round(h*100)/100, error: null }
  }

  const numMatch = s.match(/^([\d,.]+)\s*(t|timar?|time|h|hr|hour|hours)?$/)
  if (numMatch) {
    const n = parseFloat(numMatch[1].replace(',', '.'))
    if (isNaN(n)) return { hours: 0, error: 'Ugyldig tal' }
    return { hours: Math.round(n*100)/100, error: null }
  }

  return { hours: 0, error: 'Forstår ikkje formatet' }
}

function ymd(d) { return d.toISOString().slice(0,10) }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate()+n); return r }
function dayName(d) {
  const days = ['Sundag','Måndag','Tysdag','Onsdag','Torsdag','Fredag','Laurdag']
  return days[d.getDay()]
}
function fmtDate(d) {
  const months = ['januar','februar','mars','april','mai','juni',
                  'juli','august','september','oktober','november','desember']
  return `${dayName(d)} ${d.getDate()}. ${months[d.getMonth()]}`
}

export default function TimeTracker({ userId, projects, addProject, mode, initDato, activeOfficeId }) {
  const [date,       setDate]       = useState(() => (initDato ? new Date(initDato + 'T12:00:00') : new Date()))
  const [entries,    setEntries]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [errorMsg,   setErrorMsg]   = useState(null)
  const debounceRef = useRef({})
  // «Flytt timar»: alle lagra oppføringar for dagen kan flyttast til ein annan dag
  const [flyttApen, setFlyttApen]     = useState(false)
  const [flyttDato, setFlyttDato]     = useState('')
  const [sisteFlytting, setSisteFlytting] = useState(null) // { ids, fraDato, tilDato } — grunnlag for «Angre»
  // CRITICAL FIX: keep a live ref mirror of entries so debounced saves
  // always read the LATEST state, not a stale closure
  const entriesRef = useRef([])
  useEffect(() => { entriesRef.current = entries }, [entries])

  // clientId er ein STABIL nøkkel som aldri endrar seg gjennom heile rada
  // sitt liv — i motsetnad til `id`, som byrjar som ein mellombels, lokalt
  // generert verdi og vert BYTT UT med den ekte databaseIDen straks rada
  // er lagra fyrste gong (sjå persistRow under). Radene sin React `key`
  // MÅ bruke clientId, ikkje id — elles ser React ein heilt ny rad (ny
  // key) i det same augeblikket lagringa fullfører, og byter ut heile
  // DOM-noden for rada. Det var difor markøren/fokuset i eit felt (t.d.
  // «Tidsbruk») kunne forsvinne midt i skriving: den debounsa lagringa
  // (700ms etter t.d. eit prosjektval) treff akkurat medan brukar har
  // rokke å tabbe vidare og byrja skrive i neste felt.
  const nyClientId = () => (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID() : `c${Date.now()}_${Math.random()}`

  const emptyRow = () => ({
    id: Date.now() + Math.random(), clientId: nyClientId(),
    projectId: null, newProjName: '', activityNr: '',
    rawInput: '', hours: 0,
    startTime: null, endTime: null,
    description: '', submitted: false, isPersisted: false,
  })

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setLoading(true)
    let q = supabase.from('time_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('date', ymd(date))
    if (activeOfficeId) q = q.eq('office_id', activeOfficeId) // timelista er spesifikk for kvart kontor
    q.order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Klarte ikkje laste timeoppføringar:', error)
          setErrorMsg(`Feil ved lasting: ${error.message} (${error.code || 'ukjent kode'})`)
          setLoading(false)
          return
        }
        setErrorMsg(null)
        const rows = (data || []).map(r => ({
          id:          r.id,
          clientId:    String(r.id), // alt lagra, id endrar seg aldri meir
          projectId:   r.project_id,
          newProjName: '',
          activityNr:  r.activity_nr || '',
          rawInput:    r.raw_input || '',
          hours:       r.hours || 0,
          startTime:   r.start_time,
          endTime:     r.end_time,
          description: r.description || '',
          submitted:   r.submitted || false,
          isPersisted: true,
        }))
        rows.push(emptyRow())
        setEntries(rows)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [date, userId, activeOfficeId])

  // Aktivitetsnummer = aktivitetskode frå Framdrift-planen til prosjektet. Prosjekt med kodar i planen får nedtrekksmeny,
  // andre prosjekt eit fritt felt (kode eller ingenting). Kode = feltet «Aktivitetskode», elles talet fremst i aktivitetsnamnet («611 ARK …»).
  const [planKoder, setPlanKoder] = useState({})
  useEffect(() => {
    if (!userId) return
    supabase.from('framdrift_planar').select('project_id, elementer').eq('user_id', userId)
      .then(({ data }) => {
        const m = {}
        for (const p of (data || [])) {
          const liste = []
          for (const e of (Array.isArray(p.elementer) ? p.elementer : [])) {
            if (e.type !== 'aktivitet') continue
            const namn = String(e.namn || '').trim()
            const forste = /^(\d[\w.-]*)\s*(.*)$/.exec(namn)
            const kode = String(e.kode || '').trim() || (forste ? forste[1] : '')
            if (!kode) continue
            const rest = forste && forste[1] === kode ? forste[2] : namn
            if (!liste.some(x => x.kode === kode)) liste.push({ kode, namn: rest })
          }
          if (liste.length) m[p.project_id] = liste.sort((x, y) => x.kode.localeCompare(y.kode, 'nb', { numeric: true }))
        }
        setPlanKoder(m)
      })
  }, [userId])

  const updateRow = (rowId, changes) => {
    setEntries(prev => {
      const updated = prev.map(r => r.id === rowId ? { ...r, ...changes } : r)
      if ('rawInput' in changes) {
        const target = updated.find(r => r.id === rowId)
        const { hours, startTime, endTime } = parseTimeInput(changes.rawInput)
        target.hours     = hours
        target.startTime = startTime
        target.endTime   = endTime
      }
      const idx = updated.findIndex(r => r.id === rowId)
      const isLast = idx === updated.length - 1
      const row = updated[idx]
      const hasContent = row.rawInput || row.description || row.projectId || row.newProjName?.trim() || row.activityNr
      if (isLast && hasContent) {
        updated.push(emptyRow())
      }
      return updated
    })
    queueSave(rowId)
  }

  // Mark / unmark a row as "submitted" to an external time-tracking system.
  // Optimistic + immediate persist (no debounce needed for a simple toggle).
  const toggleSubmitted = async (rowId) => {
    const row = entries.find(r => r.id === rowId)
    if (!row || !row.isPersisted) return  // can't submit an unsaved row
    const newVal = !row.submitted
    setEntries(prev => prev.map(r => r.id === rowId ? { ...r, submitted: newVal } : r))
    try {
      const { error } = await supabase.from('time_entries')
        .update({ submitted: newVal, updated_at: new Date().toISOString() })
        .eq('id', row.id).eq('user_id', userId)
      if (error) throw error
    } catch (err) {
      console.error('Klarte ikkje oppdatere innsendt-status:', err)
      // Revert on failure
      setEntries(prev => prev.map(r => r.id === rowId ? { ...r, submitted: !newVal } : r))
      setErrorMsg(`Klarte ikkje oppdatere status: ${err.message || err}`)
    }
  }

  const queueSave = (rowId) => {
    if (debounceRef.current[rowId]) clearTimeout(debounceRef.current[rowId])
    setSaveStatus('saving')
    debounceRef.current[rowId] = setTimeout(() => {
      persistRow(rowId)
    }, 700)
  }

  // FIXED: read from entriesRef.current (always fresh) instead of a stale closure
  const persistRow = async (rowId) => {
    const row = entriesRef.current.find(r => r.id === rowId)
    if (!row) {
      console.warn('persistRow: fann ikkje rad', rowId)
      setSaveStatus('idle')
      return
    }
    const hasContent = row.rawInput || row.description || row.projectId || row.newProjName?.trim() || row.activityNr
    if (!hasContent) { setSaveStatus('idle'); return }

    let pid = row.projectId
    if (row.newProjName?.trim() && !pid) {
      try {
        const p = await addProject(row.newProjName.trim(), mode || 'work')
        pid = p?.id || null
        setEntries(prev => prev.map(r => r.id === rowId ? { ...r, projectId: pid, newProjName: '' } : r))
      } catch (err) {
        console.error('Klarte ikkje lage nytt prosjekt:', err)
      }
    }

    const payload = {
      id:          row.isPersisted ? row.id : Math.floor(Date.now() + Math.random() * 1000),
      user_id:     userId,
      project_id:  pid,
      office_id:   row.isPersisted ? undefined : (activeOfficeId || null), // kontor vert sett ved første lagring og endra ikkje seinare
      sort_order:  Math.max(0, entriesRef.current.findIndex(r => r.id === rowId)),
      date:        ymd(date),
      activity_nr: row.activityNr?.trim() || null,
      raw_input:   row.rawInput,
      hours:       row.hours || 0,
      start_time:  row.startTime,
      end_time:    row.endTime,
      description: row.description,
      submitted:   row.submitted || false,
      updated_at:  new Date().toISOString(),
    }

    try {
      if (row.isPersisted) {
        const { error } = await supabase.from('time_entries')
          .update(payload).eq('id', row.id).eq('user_id', userId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('time_entries')
          .insert(payload).select().single()
        if (error) throw error
        if (data) {
          setEntries(prev => prev.map(r => r.id === rowId
            ? { ...r, id: data.id, isPersisted: true }
            : r))
        }
      }
      setErrorMsg(null)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    } catch (err) {
      console.error('Klarte ikkje lagre timeoppføring:', err)
      setSaveStatus('idle')
      setErrorMsg(`Lagring feila: ${err.message || err} ${err.code ? '(' + err.code + ')' : ''} ${err.hint ? '— ' + err.hint : ''}`)
    }
  }

  // Flyttar ALLE lagra timeoppføringar for gjeldande dag til `tilYmd` (t.d. ført på feil dag).
  // Går til måldagen etterpå, og «Angre» set dei attende.
  const flyttAlleTil = async (tilYmd) => {
    if (!tilYmd || tilYmd === ymd(date)) return
    const lagra = entries.filter(r => r.isPersisted)
    const ulagra = entries.filter(r => !r.isPersisted && (r.rawInput || r.description || r.projectId || r.newProjName?.trim()))
    if (ulagra.length) { setErrorMsg('Vent til alle oppføringane er lagra (Lagrar…) før du flyttar timane.'); return }
    if (!lagra.length) { setErrorMsg('Ingen lagra timar å flytte på denne dagen.'); return }
    const innsendt = lagra.filter(r => r.submitted).length
    const sum = lagra.reduce((a, r) => a + (r.hours || 0), 0)
    const [y, m, d] = tilYmd.split('-').map(Number)
    if (!window.confirm(`Flytte ${lagra.length} oppføring${lagra.length === 1 ? '' : 'ar'} (${sum.toFixed(2)} t) frå ${fmtDate(date)} til ${fmtDate(new Date(y, m - 1, d, 12))}?` +
      (innsendt ? `

${innsendt} av dei er markert «sendt inn» og vert òg flytta.` : ''))) return
    const ids = lagra.map(r => r.id)
    const { error } = await supabase.from('time_entries')
      .update({ date: tilYmd, updated_at: new Date().toISOString() }).in('id', ids).eq('user_id', userId)
    if (error) { setErrorMsg('Klarte ikkje flytte timane: ' + error.message); return }
    setErrorMsg(null); setFlyttApen(false)
    setSisteFlytting({ ids, fraDato: ymd(date), tilDato: tilYmd })
    setDate(new Date(y, m - 1, d, 12))
  }
  const angreFlytting = async () => {
    if (!sisteFlytting) return
    const { error } = await supabase.from('time_entries')
      .update({ date: sisteFlytting.fraDato, updated_at: new Date().toISOString() }).in('id', sisteFlytting.ids).eq('user_id', userId)
    if (error) { setErrorMsg('Klarte ikkje angre flyttinga: ' + error.message); return }
    const [y, m, d] = sisteFlytting.fraDato.split('-').map(Number)
    setSisteFlytting(null); setErrorMsg(null)
    setDate(new Date(y, m - 1, d, 12))
  }

  // Ordnar dagens oppføringar etter starttid (09.00 før 10.30). Oppføringar utan klokkeslett (berre timetal) ligg etter, i same rekkjefølgje som før.
  const tilMin = (hm) => { const [h, m] = String(hm).split(':').map(Number); return h * 60 + (m || 0) }
  const harInnhald = (r) => r.rawInput || r.description || r.projectId || r.newProjName?.trim() || r.activityNr
  // Sant når oppføringane med klokkeslett alt står i rekkjefølgje (då er sorteringsknappen unødvendig)
  const erKronologisk = (() => {
    const med = entries.filter(r => harInnhald(r) && r.startTime)
    return med.every((r, k) => k === 0 || tilMin(med[k - 1].startTime) <= tilMin(r.startTime))
  })()
  const sorterKronologisk = async () => {
    const innhald = entries.filter(harInnhald)
    const tomme = entries.filter(r => !harInnhald(r))
    const medTid = innhald.filter(r => r.startTime).sort((a, b) => tilMin(a.startTime) - tilMin(b.startTime) || tilMin(a.endTime) - tilMin(b.endTime))
    const utanTid = innhald.filter(r => !r.startTime)
    const ny = [...medTid, ...utanTid, ...tomme]
    entriesRef.current = ny
    setEntries(ny)
    const lagra = ny.map((r, i) => ({ r, i })).filter(x => x.r.isPersisted)
    setSaveStatus('saving')
    const res = await Promise.all(lagra.map(({ r, i }) => supabase.from('time_entries').update({ sort_order: i, updated_at: new Date().toISOString() }).eq('id', r.id).eq('user_id', userId)))
    const feil = res.find(x => x.error)
    if (feil) { setSaveStatus('idle'); setErrorMsg('Klarte ikkje lagre rekkjefølgja: ' + feil.error.message); return }
    setErrorMsg(null); setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 1500)
  }

  const deleteRow = async (rowId) => {
    const row = entries.find(r => r.id === rowId)
    if (!row) return
    if (row.isPersisted) {
      if (!window.confirm('Slette denne timeoppføringa?')) return
      await supabase.from('time_entries').delete().eq('id', row.id).eq('user_id', userId)
    }
    setEntries(prev => {
      const filtered = prev.filter(r => r.id !== rowId)
      if (filtered.length === 0 || filtered[filtered.length - 1].isPersisted) {
        filtered.push(emptyRow())
      }
      return filtered
    })
  }

  const projectMap = Object.fromEntries((projects || []).map(p => [p.id, p]))
  const realEntries = entries.filter(e => e.isPersisted || e.rawInput || e.description)

  const totalsByProject = {}
  const totalsByAkt = {} // prosjektnøkkel -> { aktivitetsnr ('' = utan) -> timar }
  let grandTotal = 0
  for (const e of realEntries) {
    if (e.hours > 0) {
      const key = e.projectId || '__nopr__'
      const akt = (e.activityNr || '').trim()
      totalsByProject[key] = (totalsByProject[key] || 0) + e.hours
      totalsByAkt[key] = totalsByAkt[key] || {}
      totalsByAkt[key][akt] = (totalsByAkt[key][akt] || 0) + e.hours
      grandTotal += e.hours
    }
  }
  const aktNamn = (pid, kode) => (planKoder[pid] || []).find(x => x.kode === kode)?.namn || ''
  const antallGrupper = Object.values(totalsByAkt).reduce((a, m) => a + Object.keys(m).length, 0)

  const modeProjects = favorittForst(projects)

  // ── Overlappande tidspunkt: to oppføringar same dag kan ikkje ha overlappande klokkeslett (09.30-10 mot 09.45-11). Rører/endar-mot-start er OK. ──
  const overlapp = useMemo(() => {
    const tilMin = (hm) => { const [h, m] = String(hm).split(':').map(Number); return h * 60 + (m || 0) }
    const liste = entries.map((r, i) => ({ r, nr: i + 1 })).filter(x => x.r.startTime && x.r.endTime).map(x => { const s = tilMin(x.r.startTime); let e = tilMin(x.r.endTime); if (e <= s) e += 1440; return { ...x, s, e } })
    const kart = new Map(), par = []
    for (let i = 0; i < liste.length; i++) for (let j = i + 1; j < liste.length; j++) {
      const a = liste[i], c = liste[j]
      if (a.s < c.e && c.s < a.e) {
        par.push([a, c])
        for (const [x, y] of [[a, c], [c, a]]) { if (!kart.has(x.r.id)) kart.set(x.r.id, []); kart.get(x.r.id).push(y) }
      }
    }
    return { kart, par }
  }, [entries])

  // ── Kolonnebreidder (dra i kanten på kolonneoverskrifta; dobbeltklikk = standard). 0 = fleksibel (1fr) ──
  const KOL_STD = [220, 150, 120, 0, 80, 90, 40]
  const [kolB, setKolB] = useState(() => { try { const v = JSON.parse(localStorage.getItem('liedlab-timar-kolb')); return Array.isArray(v) && v.length === 7 ? v : KOL_STD } catch { return KOL_STD } })
  const malKol = kolB.map(w => (w > 0 ? w + 'px' : 'minmax(160px, 1fr)')).join(' ')
  const startKolResize = (i, ev) => {
    ev.preventDefault(); ev.stopPropagation()
    const x0 = ev.clientX, b0 = ev.currentTarget.parentElement.getBoundingClientRect().width
    let siste = b0
    const mv = (e2) => { siste = Math.max(48, Math.round(b0 + e2.clientX - x0)); setKolB(p => p.map((w, j) => (j === i ? siste : w))) }
    const opp = () => {
      window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', opp); document.body.style.cursor = ''
      setKolB(p => { try { localStorage.setItem('liedlab-timar-kolb', JSON.stringify(p)) } catch { /* privat modus */ } return p })
    }
    document.body.style.cursor = 'col-resize'
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', opp)
  }
  const nullstillKol = (i) => setKolB(p => { const n = p.map((w, j) => (j === i ? KOL_STD[i] : w)); try { localStorage.setItem('liedlab-timar-kolb', JSON.stringify(n)) } catch { /* privat modus */ } return n })

  const cellInput = {
    width: '100%', border: 'none', background: 'transparent',
    fontFamily: 'var(--font)', fontSize: 13, padding: '8px 10px',
    color: 'var(--text)', outline: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {errorMsg && (
        <div style={{ background: 'rgba(185,28,28,.08)', border: '1.5px solid var(--danger)',
          borderRadius: 'var(--r)', padding: '12px 16px', marginBottom: 14,
          fontSize: 14, color: 'var(--danger)', fontWeight: 600 }}>
          Feil: {errorMsg}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => setDate(addDays(date, -1))}
          style={{ padding: '6px 10px', background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 'var(--r)', cursor: 'pointer', color: 'var(--text2)', display:'flex' }}>
          <span style={{fontWeight:800,fontSize:15}}>‹</span>
        </button>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
          {fmtDate(date)}
        </div>
        <button onClick={() => setDate(addDays(date, 1))}
          style={{ padding: '6px 10px', background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 'var(--r)', cursor: 'pointer', color: 'var(--text2)', display:'flex' }}>
          <span style={{fontWeight:800,fontSize:15}}>›</span>
        </button>
        <button onClick={() => setDate(new Date())}
          style={{ padding: '6px 12px', background: 'var(--brand)', border: 'none',
            borderRadius: 'var(--r)', cursor: 'pointer', color: '#fff',
            fontSize: 12, fontWeight: 600 }}>
          I dag
        </button>
        <DatePicker value={ymd(date)} onChange={v => v && setDate(new Date(v + 'T12:00:00'))} vedTom={false} wrapStyle={{ width: 150 }}
          style={{ padding: '6px 30px 6px 10px', background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 'var(--r)', fontSize: 12, fontFamily: 'var(--font)' }}/>
        <div style={{ position: 'relative' }}>
          <button onClick={() => { setFlyttDato(ymd(addDays(date, 1))); setFlyttApen(v => !v) }}
            title="Flytt alle timane på denne dagen til ein annan dag"
            style={{ padding: '6px 12px', background: flyttApen ? 'var(--brandbg)' : 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 'var(--r)', cursor: 'pointer', color: 'var(--text2)', fontSize: 12, fontWeight: 600 }}>
            ⇄ Flytt timar
          </button>
          {flyttApen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: 280, zIndex: 50, background: 'var(--bg2)',
              border: '1px solid var(--border)', borderRadius: 'var(--r2)', boxShadow: 'var(--shadow-lg)', padding: 14,
              display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
                Flyttar <b>alle</b> lagra timar frå {fmtDate(date)}.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => flyttAlleTil(ymd(addDays(date, -1)))}
                  style={{ flex: 1, padding: '8px 6px', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--bg2)', cursor: 'pointer', fontWeight: 700, fontSize: 12.5, color: 'var(--text2)' }}>
                  ‹ Ein dag tilbake
                </button>
                <button onClick={() => flyttAlleTil(ymd(addDays(date, 1)))}
                  style={{ flex: 1, padding: '8px 6px', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--bg2)', cursor: 'pointer', fontWeight: 700, fontSize: 12.5, color: 'var(--text2)' }}>
                  Ein dag fram ›
                </button>
              </div>
              <div style={{ fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 700 }}>Eller vel dag</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <DatePicker value={flyttDato} onChange={setFlyttDato} vedTom={false} wrapStyle={{ flex: 1 }}
                  style={{ padding: '6px 30px 6px 8px', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 12.5, fontFamily: 'var(--font)', background: 'var(--bg2)', color: 'var(--text)' }}/>
                <button onClick={() => flyttAlleTil(flyttDato)} disabled={!flyttDato || flyttDato === ymd(date)}
                  style={{ padding: '6px 12px', border: 'none', borderRadius: 'var(--r)', background: 'var(--brand)', color: '#fff', fontWeight: 700, fontSize: 12.5,
                    cursor: 'pointer', opacity: !flyttDato || flyttDato === ymd(date) ? .5 : 1 }}>
                  Flytt
                </button>
              </div>
            </div>
          )}
        </div>
        {sisteFlytting && (
          <button onClick={angreFlytting} title="Flytt timane attende til dagen dei kom frå"
            style={{ padding: '6px 12px', background: 'rgba(15,118,110,.10)', border: '1.5px solid #0F766E', borderRadius: 'var(--r)',
              cursor: 'pointer', color: '#0F766E', fontSize: 12, fontWeight: 700 }}>
            ↶ Angre flytting ({sisteFlytting.ids.length})
          </button>
        )}
        <button onClick={sorterKronologisk} disabled={erKronologisk && overlapp.par.length === 0}
          title="Ordnar oppføringane for dagen etter starttid og kontrollerer at tidspunkta ikkje overlappar"
          style={{ padding: '6px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--r)', color: 'var(--text2)',
            fontSize: 12, fontWeight: 600, cursor: erKronologisk && overlapp.par.length === 0 ? 'default' : 'pointer', opacity: erKronologisk && overlapp.par.length === 0 ? .55 : 1 }}>
          ↕ Sorter etter tid
        </button>
        <div style={{ flex: 1 }}/>
        <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {saveStatus === 'saving' && <><span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:'var(--warn)',animation:'pulse 1s infinite'}}/>Lagrar…</>}
          {saveStatus === 'saved' && <><span style={{color:'var(--success)',fontWeight:600}}>Lagra</span></>}
        </div>
        <div style={{ padding: '6px 14px', background: 'var(--brandbg2)', border: '1.5px solid var(--brand3)',
          borderRadius: 'var(--r)', fontWeight: 700, color: 'var(--brand)', fontSize: 14 }}>
          
          {grandTotal.toFixed(2)}t
        </div>
      </div>

      {overlapp.par.length > 0 && (
        <div role="alert" style={{ background: 'rgba(220,38,38,.09)', border: '1.5px solid var(--danger)', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 12, fontSize: 13, color: 'var(--danger)', fontWeight: 600, lineHeight: 1.55 }}>
          ⚠ Overlappande tidspunkt — to oppføringar same dag kan ikkje ha overlappande klokkeslett:
          {overlapp.par.map(([x, y], i) => (
            <div key={i} style={{ fontWeight: 500, color: 'var(--text)' }}>
              Rad {x.nr} ({x.r.startTime}–{x.r.endTime}) overlappar med rad {y.nr} ({y.r.startTime}–{y.r.endTime})
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--border)',
        borderRadius: 'var(--r2)', background: 'var(--bg2)' }}>

        <div style={{ display: 'grid', gridTemplateColumns: malKol, minWidth: 'min-content',
          background: 'var(--bg3)', borderBottom: '2px solid var(--border)',
          position: 'sticky', top: 0, zIndex: 5 }}>
          {[['Prosjekt', 'Prosjekt', 'left'], ['Aktivitetsnr.', 'Aktivitetsnummer = aktivitetskode i Framdrift. Vel frå lista når prosjektet har kodar, elles skriv du kode (eller lèt vere).', 'left'], ['Tidsbruk', 'Tidsbruk', 'left'],
            ['Beskriving', 'Beskriving', 'left'], ['Timar', 'Timar', 'right'], ['Sendt inn', 'Sendt inn', 'center']].map(([namn, tittel, just], i) => (
            <div key={namn} title={tittel} style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', position: 'relative',
              textTransform: 'uppercase', letterSpacing: '.05em', borderRight: '1px solid var(--border)', textAlign: just }}>
              {namn}
              <div onMouseDown={e => startKolResize(i, e)} onDoubleClick={() => nullstillKol(i)} title="Dra for å endre kolonnebreidda (dobbeltklikk = standard)"
                style={{ position: 'absolute', right: -3, top: 0, bottom: 0, width: 7, cursor: 'col-resize', zIndex: 6 }}/>
            </div>
          ))}
          <div></div>
        </div>

        {entries.map((row) => {
          const proj = row.projectId ? projectMap[row.projectId] : null
          const isEmpty = !row.rawInput && !row.description && !row.projectId && !row.newProjName?.trim()
          const isSubmitted = row.submitted && row.isPersisted

          return (
            <div key={row.clientId}
              style={{ display: 'grid', gridTemplateColumns: malKol, minWidth: 'min-content',
                borderBottom: '1px solid var(--border)',
                background: isSubmitted ? 'var(--bg3)' : 'var(--bg2)',
                opacity: isEmpty ? 0.7 : (isSubmitted ? 0.65 : 1),
                transition: 'background .15s, opacity .15s' }}>

              <div style={{ borderRight: '1px solid var(--border)', position: 'relative' }}>
                {!row.newProjName ? (
                  <select value={row.projectId || ''}
                    disabled={isSubmitted}
                    onChange={e => {
                      const v = e.target.value
                      if (v === '__new__') {
                        updateRow(row.id, { projectId: null, newProjName: ' ' })
                      } else {
                        updateRow(row.id, { projectId: v ? parseInt(v) : null, newProjName: '' })
                      }
                    }}
                    style={{ ...cellInput, fontWeight: proj ? 600 : 400,
                      color: isSubmitted ? 'var(--text3)' : (proj ? 'var(--text)' : 'var(--text3)'),
                      cursor: isSubmitted ? 'default' : 'pointer',
                      appearance: 'none', backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%236B9A80' stroke-width='3'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
                      backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
                      paddingRight: 24 }}>
                    <option value="">— Vel prosjekt —</option>
                    {modeProjects.map(p => <option key={p.id} value={p.id}>{prosjektValTekst(p)}</option>)}
                    <option value="__new__">＋ Nytt prosjekt…</option>
                  </select>
                ) : (
                  <input type="text"
                    autoFocus
                    value={row.newProjName.trim()}
                    onChange={e => updateRow(row.id, { newProjName: e.target.value })}
                    onBlur={e => {
                      if (!e.target.value.trim()) updateRow(row.id, { newProjName: '' })
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Escape') updateRow(row.id, { newProjName: '' })
                      if (e.key === 'Enter')  e.target.blur()
                    }}
                    placeholder="Skriv prosjektnummer / namn"
                    style={{ ...cellInput, fontWeight: 600, color: 'var(--brand)',
                      background: 'var(--brandbg)' }}/>
                )}
              </div>

              <div style={{ borderRight: '1px solid var(--border)', position: 'relative' }}>
                {(planKoder[row.projectId] || []).length > 0 ? (
                  <select value={row.activityNr || ''} disabled={isSubmitted}
                    onChange={e => updateRow(row.id, { activityNr: e.target.value })}
                    style={{ ...cellInput, fontFamily: 'var(--mono)', cursor: isSubmitted ? 'default' : 'pointer',
                      color: isSubmitted ? 'var(--text3)' : (row.activityNr ? 'var(--text)' : 'var(--text3)'),
                      appearance: 'none', backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%236B9A80' stroke-width='3'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
                      backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', paddingRight: 24 }}>
                    <option value="">— Ingen —</option>
                    {row.activityNr && !planKoder[row.projectId].some(x => x.kode === row.activityNr) && <option value={row.activityNr}>{row.activityNr}</option>}
                    {planKoder[row.projectId].map(x => <option key={x.kode} value={x.kode}>{x.kode}{x.namn ? ' ' + x.namn : ''}</option>)}
                  </select>
                ) : (
                  <input type="text" value={row.activityNr || ''} disabled={isSubmitted}
                    onChange={e => updateRow(row.id, { activityNr: e.target.value })}
                    placeholder="Kode (valfritt)"
                    style={{ ...cellInput, fontFamily: 'var(--mono)', color: isSubmitted ? 'var(--text3)' : 'var(--text)' }}/>
                )}
              </div>

              <div style={{ borderRight: '1px solid var(--border)', position: 'relative' }}>
                <input type="text" value={row.rawInput}
                  disabled={isSubmitted}
                  onChange={e => updateRow(row.id, { rawInput: e.target.value })}
                  placeholder="t.d. 9.30-10"
                  title={(overlapp.kart.has(row.id) ? '⚠ Overlappar med rad ' + overlapp.kart.get(row.id).map(o => o.nr + ' (' + o.r.startTime + '–' + o.r.endTime + ')').join(', ') + '\n\n' : '') + 'Fleksibelt format:\n09.30-10  ·  2,5  ·  2,5t  ·  1:30  ·  2t30min'}
                  style={{ ...cellInput, fontFamily: 'var(--mono)', ...(overlapp.kart.has(row.id) ? { background: 'rgba(220,38,38,.12)', boxShadow: 'inset 0 0 0 2px var(--danger)', color: 'var(--danger)', fontWeight: 700 } : { color: isSubmitted ? 'var(--text3)' : 'var(--text)' }) }}/>
              </div>

              <div style={{ borderRight: '1px solid var(--border)' }}>
                <input type="text" value={row.description}
                  disabled={isSubmitted}
                  onChange={e => updateRow(row.id, { description: e.target.value })}
                  placeholder="Kva har du jobba med?"
                  style={{ ...cellInput, color: isSubmitted ? 'var(--text3)' : 'var(--text)' }}/>
              </div>

              <div style={{ borderRight: '1px solid var(--border)',
                padding: '8px 12px', textAlign: 'right',
                fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600,
                color: isSubmitted ? 'var(--text3)' : (row.hours > 0 ? 'var(--brand)' : 'var(--text3)') }}>
                {row.hours > 0 ? row.hours.toFixed(2) + 't' : '–'}
              </div>

              <div style={{ borderRight: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {row.isPersisted && (
                  <button onClick={() => toggleSubmitted(row.id)}
                    title={isSubmitted ? 'Marker som ikkje sendt inn' : 'Marker som sendt inn'}
                    style={{ display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 9px', borderRadius: 6, cursor: 'pointer',
                      fontSize: 12, fontWeight: 700,
                      border: `1.5px solid ${isSubmitted ? 'var(--text3)' : 'var(--border2)'}`,
                      background: isSubmitted ? 'var(--text3)' : 'transparent',
                      color: isSubmitted ? '#fff' : 'var(--text3)',
                      transition: 'all .15s' }}
                    onMouseEnter={e => { if (!isSubmitted) { e.currentTarget.style.borderColor = 'var(--brand3)'; e.currentTarget.style.color = 'var(--brand)' } }}
                    onMouseLeave={e => { if (!isSubmitted) { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text3)' } }}>
                    {isSubmitted ? '✓ Sendt' : 'Send inn'}
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {!isEmpty && (
                  <button onClick={() => deleteRow(row.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text3)',
                      cursor: 'pointer', padding: 4, display: 'flex' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}>
                    <span style={{fontWeight:800,fontSize:12}}>S</span>
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {antallGrupper > 1 && (
          <div style={{ borderTop: '2px solid var(--brand3)', background: 'var(--bg3)' }}>
            <div style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700,
              color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Oppsummering per prosjekt og aktivitet
            </div>
            {Object.entries(totalsByProject).sort((a,b) => b[1]-a[1]).map(([key, total]) => {
              const proj = key === '__nopr__' ? null : projectMap[parseInt(key)]
              const aktar = Object.entries(totalsByAkt[key] || {}).sort((x, y) => x[0] === '' ? 1 : y[0] === '' ? -1 : x[0].localeCompare(y[0], 'nb', { numeric: true }))
              const visAktar = aktar.length > 1 || (aktar.length === 1 && aktar[0][0] !== '')
              return (
                <div key={key} style={{ borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: malKol, minWidth: 'min-content' }}>
                    <div style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>
                      {proj ? `📁 ${proj.name}` : '— Utan prosjekt —'}
                    </div>
                    <div></div>
                    <div></div>
                    <div></div>
                    <div style={{ padding: '8px 12px', textAlign: 'right',
                      fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>
                      {total.toFixed(2)}t
                    </div>
                    <div></div>
                    <div></div>
                  </div>
                  {visAktar && aktar.map(([kode, t]) => (
                    <div key={kode} style={{ display: 'grid', gridTemplateColumns: malKol, minWidth: 'min-content' }}>
                      <div style={{ padding: '4px 12px 4px 34px', fontSize: 12.5, color: 'var(--text2)' }}>
                        {kode ? <><span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{kode}</span>{aktNamn(parseInt(key), kode) ? ' ' + aktNamn(parseInt(key), kode) : ''}</> : <span style={{ color: 'var(--text3)' }}>Utan aktivitetsnr.</span>}
                      </div>
                      <div></div>
                      <div></div>
                      <div></div>
                      <div style={{ padding: '4px 12px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--text2)' }}>
                        {t.toFixed(2)}t
                      </div>
                      <div></div>
                      <div></div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ background: 'var(--bg3)', color: 'var(--text)', borderTop: '2px solid var(--border)',
          display: 'grid', gridTemplateColumns: malKol, minWidth: 'min-content' }}>
          <div style={{ gridColumn: '1 / 5', padding: '12px 14px', fontWeight: 700, whiteSpace: 'nowrap',
            textTransform: 'uppercase', letterSpacing: '.06em', fontSize: 13 }}>
            Totalt {fmtDate(date)}
          </div>
          <div style={{ padding: '12px 12px', textAlign: 'right',
            fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700 }}>
            {grandTotal.toFixed(2)}t
          </div>
          <div></div>
          <div></div>
        </div>
      </div>
    </div>
  )
}
