import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

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

export default function TimeTracker({ userId, projects, addProject, mode }) {
  const [date,       setDate]       = useState(new Date())
  const [entries,    setEntries]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [errorMsg,   setErrorMsg]   = useState(null)
  const debounceRef = useRef({})
  // CRITICAL FIX: keep a live ref mirror of entries so debounced saves
  // always read the LATEST state, not a stale closure
  const entriesRef = useRef([])
  useEffect(() => { entriesRef.current = entries }, [entries])

  const emptyRow = () => ({
    id: Date.now() + Math.random(),
    projectId: null, newProjName: '',
    rawInput: '', hours: 0,
    startTime: null, endTime: null,
    description: '', submitted: false, isPersisted: false,
  })

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setLoading(true)
    supabase.from('time_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('date', ymd(date))
      .order('sort_order', { ascending: true })
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
          projectId:   r.project_id,
          newProjName: '',
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
  }, [date, userId])

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
      const hasContent = row.rawInput || row.description || row.projectId || row.newProjName?.trim()
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
    const hasContent = row.rawInput || row.description || row.projectId || row.newProjName?.trim()
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
      date:        ymd(date),
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
  let grandTotal = 0
  for (const e of realEntries) {
    if (e.hours > 0) {
      const key = e.projectId || '__nopr__'
      totalsByProject[key] = (totalsByProject[key] || 0) + e.hours
      grandTotal += e.hours
    }
  }

  const modeProjects = (projects || []).filter(p => (p.type || 'work') === (mode || 'work'))

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
        <input type="date" value={ymd(date)} onChange={e => setDate(new Date(e.target.value))}
          style={{ padding: '6px 10px', background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 'var(--r)', fontSize: 12, fontFamily: 'var(--font)' }}/>
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

      <div style={{ background: 'var(--bg3)', borderRadius: 'var(--r)', padding: '10px 14px',
        marginBottom: 14, fontSize: 12, color: 'var(--text2)' }}>
        Tidsbruk-formatet er fleksibelt: <b>09.30-10</b> · <b>2,5</b> · <b>2,5t</b> · <b>1:30</b> · <b>2t30min</b>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)',
        borderRadius: 'var(--r2)', background: 'var(--bg2)' }}>

        <div style={{ display: 'grid', gridTemplateColumns: '220px 120px 1fr 80px 90px 40px',
          background: 'var(--bg3)', borderBottom: '2px solid var(--border)',
          position: 'sticky', top: 0, zIndex: 5 }}>
          <div style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text3)',
            textTransform: 'uppercase', letterSpacing: '.05em', borderRight: '1px solid var(--border)' }}>Prosjekt</div>
          <div style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text3)',
            textTransform: 'uppercase', letterSpacing: '.05em', borderRight: '1px solid var(--border)' }}>Tidsbruk</div>
          <div style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text3)',
            textTransform: 'uppercase', letterSpacing: '.05em', borderRight: '1px solid var(--border)' }}>Beskriving</div>
          <div style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text3)',
            textTransform: 'uppercase', letterSpacing: '.05em', borderRight: '1px solid var(--border)', textAlign:'right' }}>Timar</div>
          <div style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text3)',
            textTransform: 'uppercase', letterSpacing: '.05em', borderRight: '1px solid var(--border)', textAlign:'center' }}>Sendt inn</div>
          <div></div>
        </div>

        {entries.map((row) => {
          const proj = row.projectId ? projectMap[row.projectId] : null
          const isEmpty = !row.rawInput && !row.description && !row.projectId && !row.newProjName?.trim()
          const isSubmitted = row.submitted && row.isPersisted

          return (
            <div key={row.id}
              style={{ display: 'grid', gridTemplateColumns: '220px 120px 1fr 80px 90px 40px',
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
                    {modeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
                <input type="text" value={row.rawInput}
                  disabled={isSubmitted}
                  onChange={e => updateRow(row.id, { rawInput: e.target.value })}
                  placeholder="t.d. 9.30-10"
                  style={{ ...cellInput, fontFamily: 'var(--mono)',
                    color: isSubmitted ? 'var(--text3)' : 'var(--text)' }}/>
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

        {Object.keys(totalsByProject).length > 1 && (
          <div style={{ borderTop: '2px solid var(--brand3)', background: 'var(--bg3)' }}>
            <div style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700,
              color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Oppsummering per prosjekt
            </div>
            {Object.entries(totalsByProject).sort((a,b) => b[1]-a[1]).map(([key, total]) => {
              const proj = key === '__nopr__' ? null : projectMap[parseInt(key)]
              return (
                <div key={key} style={{ display: 'grid',
                  gridTemplateColumns: '220px 120px 1fr 80px 90px 40px',
                  borderTop: '1px solid var(--border)' }}>
                  <div style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>
                    {proj ? `📁 ${proj.name}` : '— Utan prosjekt —'}
                  </div>
                  <div></div>
                  <div></div>
                  <div style={{ padding: '8px 12px', textAlign: 'right',
                    fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>
                    {total.toFixed(2)}t
                  </div>
                  <div></div>
                  <div></div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ background: 'var(--brand)', color: '#fff',
          display: 'grid', gridTemplateColumns: '220px 120px 1fr 80px 90px 40px' }}>
          <div style={{ padding: '12px 14px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '.06em', fontSize: 13 }}>
            Totalt {fmtDate(date)}
          </div>
          <div></div>
          <div></div>
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
