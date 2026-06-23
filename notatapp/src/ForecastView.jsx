import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from './supabase'

// ── Date helpers ─────────────────────────────────────────────────────────
function ymd(d) { return d.toISOString().slice(0,10) }
function getMonday(d) {
  const r = new Date(d)
  const day = r.getDay()
  const diff = day === 0 ? -6 : 1 - day
  r.setDate(r.getDate() + diff)
  r.setHours(0,0,0,0)
  return r
}
function getMonthStart(d) {
  const r = new Date(d.getFullYear(), d.getMonth(), 1)
  r.setHours(0,0,0,0)
  return r
}
function addWeeks(d, n) { const r = new Date(d); r.setDate(r.getDate() + n*7); return r }
function addMonths(d, n) { const r = new Date(d); r.setMonth(r.getMonth() + n); return r }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function getISOWeek(d) {
  const t = new Date(d); t.setHours(0,0,0,0)
  t.setDate(t.getDate() + 4 - (t.getDay() || 7))
  const y = new Date(t.getFullYear(), 0, 1)
  return Math.ceil(((t - y) / 86400000 + 1) / 7)
}
const MONTH_NAMES = ['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des']

function periodLabel(d, type) {
  if (type === 'week') {
    const mon = getMonday(d)
    const sun = addDays(mon, 6)
    return `Veke ${getISOWeek(mon)} (${mon.getDate()}.${mon.getMonth()+1}–${sun.getDate()}.${sun.getMonth()+1})`
  }
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
}

// Generate N periods starting from `anchor`
function buildPeriods(anchor, type, count) {
  const periods = []
  for (let i = 0; i < count; i++) {
    const d = type === 'week' ? addWeeks(anchor, i) : addMonths(anchor, i)
    const start = type === 'week' ? getMonday(d) : getMonthStart(d)
    periods.push({ start, key: ymd(start), label: periodLabel(start, type) })
  }
  return periods
}

export default function ForecastView({ userId, projects, mode }) {
  const [periodType, setPeriodType] = useState('month')   // 'week' | 'month'
  const [anchor,     setAnchor]     = useState(() => new Date())
  const [forecast,   setForecast]  = useState({})  // key: `${projectId}:${periodKey}` -> hours
  const [actual,     setActual]    = useState({})  // key: `${projectId}:${periodKey}` -> hours (from time_entries)
  const [loading,    setLoading]   = useState(true)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [errorMsg,   setErrorMsg]  = useState(null)
  const debounceRef = useRef({})

  const PERIOD_COUNT = 6
  const periods = useMemo(() => buildPeriods(anchor, periodType, PERIOD_COUNT), [anchor, periodType])
  const modeProjects = (projects || []).filter(p => (p.type || 'work') === (mode || 'work'))

  const rangeStart = periods[0]?.start
  const rangeEnd = periodType === 'week'
    ? addDays(periods[periods.length-1].start, 6)
    : new Date(periods[periods.length-1].start.getFullYear(), periods[periods.length-1].start.getMonth()+1, 0)

  // ── Load forecast + actual data for the visible range ─────────────────
  useEffect(() => {
    if (!userId || !rangeStart) return
    let cancelled = false
    setLoading(true)
    setErrorMsg(null)

    Promise.all([
      supabase.from('forecast_entries').select('*')
        .eq('user_id', userId).eq('period_type', periodType)
        .gte('period_start', ymd(rangeStart)).lte('period_start', ymd(periods[periods.length-1].start)),
      supabase.from('time_entries').select('project_id, date, hours')
        .eq('user_id', userId)
        .gte('date', ymd(rangeStart)).lte('date', ymd(rangeEnd)),
    ]).then(([fcRes, teRes]) => {
      if (cancelled) return
      if (fcRes.error) {
        setErrorMsg(`Feil ved lasting av prognose: ${fcRes.error.message}`)
        setLoading(false)
        return
      }
      const fc = {}
      for (const row of fcRes.data || []) {
        fc[`${row.project_id}:${row.period_start}`] = row.hours
      }
      setForecast(fc)

      // Aggregate actual time_entries into periods
      const ac = {}
      for (const row of teRes.data || []) {
        const d = new Date(row.date + 'T00:00:00')
        const periodStart = periodType === 'week' ? getMonday(d) : getMonthStart(d)
        const key = `${row.project_id}:${ymd(periodStart)}`
        ac[key] = (ac[key] || 0) + (row.hours || 0)
      }
      setActual(ac)
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [userId, periodType, anchor])

  // ── Save a single forecast cell (debounced) ────────────────────────────
  const updateForecast = (projectId, periodKey, value) => {
    const hours = value === '' ? 0 : parseFloat(value.replace(',', '.')) || 0
    const cellKey = `${projectId}:${periodKey}`
    setForecast(prev => ({ ...prev, [cellKey]: hours }))

    const debKey = cellKey
    if (debounceRef.current[debKey]) clearTimeout(debounceRef.current[debKey])
    setSaveStatus('saving')
    debounceRef.current[debKey] = setTimeout(async () => {
      try {
        const { error } = await supabase.from('forecast_entries')
          .upsert({
            id: Math.floor(Date.now() + Math.random()*1000),
            user_id: userId, project_id: projectId,
            period_type: periodType, period_start: periodKey,
            hours, updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,project_id,period_type,period_start' })
        if (error) throw error
        setErrorMsg(null)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 1200)
      } catch (err) {
        console.error('Feil ved lagring av prognose:', err)
        setErrorMsg(`Lagring feila: ${err.message || err}`)
        setSaveStatus('idle')
      }
    }, 600)
  }

  const navigate = (dir) => {
    setAnchor(prev => periodType === 'week' ? addWeeks(prev, dir * PERIOD_COUNT) : addMonths(prev, dir * PERIOD_COUNT))
  }
  const goToday = () => setAnchor(new Date())

  // ── Totals ──────────────────────────────────────────────────────────────
  const colTotals = periods.map(p => {
    let plan = 0, act = 0
    for (const proj of modeProjects) {
      plan += forecast[`${proj.id}:${p.key}`] || 0
      act  += actual[`${proj.id}:${p.key}`] || 0
    }
    return { plan, act }
  })
  const grandPlan = colTotals.reduce((s, c) => s + c.plan, 0)
  const grandAct  = colTotals.reduce((s, c) => s + c.act, 0)

  const cellInput = {
    width: '100%', border: 'none', background: 'transparent',
    fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600,
    padding: '8px 6px', color: 'var(--brand)', outline: 'none', textAlign: 'center',
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

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {/* Week/Month toggle */}
        <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 'var(--r2)',
          padding: 3, border: '1.5px solid var(--border)' }}>
          <button onClick={() => setPeriodType('week')}
            style={{ padding: '7px 14px', border: 'none', borderRadius: 'var(--r)',
              background: periodType === 'week' ? 'var(--brand)' : 'transparent',
              color: periodType === 'week' ? '#fff' : 'var(--text2)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Veke
          </button>
          <button onClick={() => setPeriodType('month')}
            style={{ padding: '7px 14px', border: 'none', borderRadius: 'var(--r)',
              background: periodType === 'month' ? 'var(--brand)' : 'transparent',
              color: periodType === 'month' ? '#fff' : 'var(--text2)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Månad
          </button>
        </div>

        <button onClick={() => navigate(-1)}
          style={{ padding: '7px 12px', background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 'var(--r)', cursor: 'pointer', color: 'var(--text2)',
            fontWeight: 800, fontSize: 15 }}>‹</button>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', minWidth: 180, textAlign:'center' }}>
          {periods[0]?.label} – {periods[periods.length-1]?.label}
        </div>
        <button onClick={() => navigate(1)}
          style={{ padding: '7px 12px', background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 'var(--r)', cursor: 'pointer', color: 'var(--text2)',
            fontWeight: 800, fontSize: 15 }}>›</button>
        <button onClick={goToday}
          style={{ padding: '7px 14px', background: 'var(--brand)', border: 'none',
            borderRadius: 'var(--r)', cursor: 'pointer', color: '#fff',
            fontSize: 13, fontWeight: 700 }}>
          I dag
        </button>

        <div style={{ flex: 1 }}/>
        <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {saveStatus === 'saving' && <><span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:'var(--warn)',animation:'pulse 1s infinite'}}/>Lagrar…</>}
          {saveStatus === 'saved' && <span style={{color:'var(--success)',fontWeight:600}}>Lagra</span>}
        </div>
      </div>

      <div style={{ background: 'var(--bg3)', borderRadius: 'var(--r)', padding: '10px 14px',
        marginBottom: 14, fontSize: 13, color: 'var(--text2)' }}>
        Planlagde timar per prosjekt og periode. Grå tal under er faktisk loggført tid frå Timar-fana.
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--border)',
        borderRadius: 'var(--r2)', background: 'var(--bg2)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `220px repeat(${periods.length}, 1fr)`,
          minWidth: 220 + periods.length * 110 }}>

          {/* Header row */}
          <div style={{ position: 'sticky', left: 0, top: 0, zIndex: 6, background: 'var(--bg3)',
            borderBottom: '2px solid var(--border)', borderRight: '1px solid var(--border)',
            padding: '12px 14px', fontSize: 12, fontWeight: 700, color: 'var(--text3)',
            textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Prosjekt
          </div>
          {periods.map(p => (
            <div key={p.key} style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--bg3)',
              borderBottom: '2px solid var(--border)', borderRight: '1px solid var(--border)',
              padding: '10px 8px', fontSize: 12, fontWeight: 700, color: 'var(--text2)',
              textAlign: 'center' }}>
              {p.label}
            </div>
          ))}

          {/* Project rows */}
          {modeProjects.map(proj => (
            <>
              <div key={`label-${proj.id}`} style={{ position: 'sticky', left: 0, zIndex: 2,
                background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
                borderRight: '1px solid var(--border)', padding: '10px 14px',
                fontSize: 14, fontWeight: 600, color: 'var(--text)',
                display: 'flex', alignItems: 'center' }}>
                {proj.name}
              </div>
              {periods.map(p => {
                const cellKey = `${proj.id}:${p.key}`
                const planVal = forecast[cellKey]
                const actVal  = actual[cellKey] || 0
                return (
                  <div key={cellKey} style={{ borderBottom: '1px solid var(--border)',
                    borderRight: '1px solid var(--border)', display:'flex', flexDirection:'column' }}>
                    <input type="text"
                      defaultValue={planVal ? String(planVal).replace('.', ',') : ''}
                      placeholder="–"
                      onChange={e => updateForecast(proj.id, p.key, e.target.value)}
                      style={cellInput}/>
                    {actVal > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center',
                        paddingBottom: 4, fontFamily: 'var(--mono)' }}>
                        {actVal.toFixed(1)}t faktisk
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          ))}

          {/* Totals row */}
          <div style={{ position: 'sticky', left: 0, zIndex: 2, background: 'var(--brand)',
            borderRight: '1px solid var(--border)', padding: '12px 14px',
            fontSize: 13, fontWeight: 700, color: '#fff', textTransform: 'uppercase',
            letterSpacing: '.05em', display: 'flex', alignItems: 'center' }}>
            Totalt
          </div>
          {colTotals.map((t, i) => (
            <div key={i} style={{ background: 'var(--brand)', borderRight: '1px solid var(--border)',
              padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: 'var(--mono)' }}>
                {t.plan.toFixed(1)}t
              </div>
              {t.act > 0 && (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', fontFamily: 'var(--mono)' }}>
                  {t.act.toFixed(1)}t faktisk
                </div>
              )}
            </div>
          ))}
        </div>

        {modeProjects.length === 0 && (
          <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text3)' }}>
            Ingen prosjekt enno. Legg til eit prosjekt i sidemenyen først.
          </div>
        )}
      </div>

      {/* Grand total summary */}
      <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
        <div style={{ flex: 1, background: 'var(--brandbg)', border: '1.5px solid var(--brand3)',
          borderRadius: 'var(--r2)', padding: '12px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)',
            textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
            Planlagt totalt
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand)', fontFamily: 'var(--mono)' }}>
            {grandPlan.toFixed(1)}t
          </div>
        </div>
        <div style={{ flex: 1, background: 'var(--bg3)', border: '1.5px solid var(--border)',
          borderRadius: 'var(--r2)', padding: '12px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)',
            textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
            Faktisk totalt
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
            {grandAct.toFixed(1)}t
          </div>
        </div>
      </div>
    </div>
  )
}
