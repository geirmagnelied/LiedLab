import { useState, useEffect, useMemo } from 'react'
import { addDays, startOfWeek, getISOWeek, getISOWeekYear, format } from 'date-fns'
import { nb } from 'date-fns/locale'
import { supabase } from './supabase'
import DatePicker from './DatePicker'

// ═══════════════════════════════════════════════════════════════════
//  TimeVeke — timane for ei HEIL veke (måndag–søndag): éi rad per prosjekt/aktivitetsnummer, ei kolonne per dag, sum per rad og dag.
//  Beskriving er skjult (den ligg i dagvisinga). Trykk på ein dag for å opne han i Timeregistrering.
// ═══════════════════════════════════════════════════════════════════
const z = (n) => String(n).padStart(2, '0')
const ymdLokal = (d) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
const fmtT = (n) => (n > 0 ? (Math.round(n * 100) / 100).toLocaleString('nb-NO') : '')

export default function TimeVeke({ userId, projects, onGaaTilDag, activeOfficeId }) {
  const [mandag, setMandag] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [rader, setRader] = useState([])
  const [lastar, setLastar] = useState(true)
  const dagar = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(mandag, i)), [mandag])
  const fra = ymdLokal(dagar[0]), til = ymdLokal(dagar[6])

  useEffect(() => {
    if (!userId) return undefined
    let avbrote = false
    setLastar(true)
    let q = supabase.from('time_entries').select('date, project_id, activity_nr, hours, submitted').eq('user_id', userId).gte('date', fra).lte('date', til)
    if (activeOfficeId) q = q.eq('office_id', activeOfficeId)
    q.then(({ data }) => { if (!avbrote) { setRader(data || []); setLastar(false) } })
    return () => { avbrote = true }
  }, [userId, fra, til, activeOfficeId])

  const prosjektKart = useMemo(() => Object.fromEntries((projects || []).map(p => [p.id, p])), [projects])
  const grupper = useMemo(() => {
    const m = new Map()
    for (const r of rader) {
      const k = `${r.project_id || ''}|${r.activity_nr || ''}`
      if (!m.has(k)) m.set(k, { prosjekt: r.project_id, akt: r.activity_nr || '', dag: {}, sum: 0 })
      const g = m.get(k); const h = +r.hours || 0
      g.dag[r.date] = (g.dag[r.date] || 0) + h; g.sum += h
    }
    return [...m.values()].sort((a, b) => String(prosjektKart[a.prosjekt]?.projectNumber || 'zzz').localeCompare(String(prosjektKart[b.prosjekt]?.projectNumber || 'zzz'), 'nb', { numeric: true }) || String(a.akt).localeCompare(String(b.akt), 'nb', { numeric: true }))
  }, [rader, prosjektKart])
  const dagSum = dagar.map(d => grupper.reduce((a, g) => a + (g.dag[ymdLokal(d)] || 0), 0))
  const totalt = dagSum.reduce((a, b) => a + b, 0)
  const idag = ymdLokal(new Date())

  const nav = { padding: '6px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--r)', cursor: 'pointer', color: 'var(--text2)', display: 'flex', fontWeight: 800, fontSize: 15 }
  const TH = { padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', borderRight: '1px solid var(--border)' }
  const KOL = '230px 130px repeat(7, minmax(78px, 1fr)) 90px'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => setMandag(d => addDays(d, -7))} style={nav}>‹</button>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>
          Veke {getISOWeek(mandag)} · {format(dagar[0], 'd. MMM', { locale: nb })} – {format(dagar[6], 'd. MMM yyyy', { locale: nb })}
        </div>
        <button onClick={() => setMandag(d => addDays(d, 7))} style={nav}>›</button>
        <button onClick={() => setMandag(startOfWeek(new Date(), { weekStartsOn: 1 }))} style={{ padding: '6px 12px', background: 'var(--brand)', border: 'none', borderRadius: 'var(--r)', cursor: 'pointer', color: '#fff', fontSize: 12, fontWeight: 600 }}>Denne veka</button>
        <DatePicker modus="veke" value={`${getISOWeekYear(mandag)}-W${z(getISOWeek(mandag))}`} vedTom={false} wrapStyle={{ width: 170 }}
          onChange={v => { const m = /^(\d{4})-W(\d{2})$/.exec(v); if (m) setMandag(addDays(startOfWeek(new Date(+m[1], 0, 4), { weekStartsOn: 1 }), (+m[2] - 1) * 7)) }}
          style={{ padding: '6px 30px 6px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--r)', fontSize: 12, fontFamily: 'var(--font)' }}/>
        <div style={{ flex: 1 }}/>
        <div style={{ padding: '6px 14px', background: 'var(--brandbg2)', border: '1.5px solid var(--brand3)', borderRadius: 'var(--r)', fontWeight: 700, color: 'var(--brand)', fontSize: 14 }}>{totalt.toFixed(2)}t</div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r2)', background: 'var(--bg2)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: KOL, minWidth: 'min-content', background: 'var(--bg3)', borderBottom: '2px solid var(--border)', position: 'sticky', top: 0, zIndex: 5 }}>
          <div style={TH}>Prosjekt</div>
          <div style={TH}>Aktivitetsnr.</div>
          {dagar.map(d => {
            const helg = d.getDay() === 0 || d.getDay() === 6
            return (
              <div key={d} onClick={() => onGaaTilDag?.(ymdLokal(d))} title="Opne dagen i Timeregistrering"
                style={{ ...TH, textAlign: 'center', cursor: 'pointer', color: ymdLokal(d) === idag ? 'var(--brand)' : helg ? 'var(--danger)' : 'var(--text3)', background: ymdLokal(d) === idag ? 'var(--brandbg)' : undefined }}>
                {format(d, 'EEE', { locale: nb })}<div style={{ fontWeight: 600, letterSpacing: 0, textTransform: 'none' }}>{format(d, 'dd.MM')}</div>
              </div>
            )
          })}
          <div style={{ ...TH, textAlign: 'right', borderRight: 'none' }}>Sum</div>
        </div>
        {lastar ? <div style={{ padding: 20, color: 'var(--text3)', fontSize: 13 }}>Lastar…</div> : grupper.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Ingen timar ført denne veka.</div>
        ) : grupper.map((g, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: KOL, minWidth: 'min-content', borderBottom: '1px solid var(--border)' }}>
            <div style={{ padding: '9px 12px', fontSize: 13, fontWeight: 600, color: 'var(--text)', borderRight: '1px solid var(--border)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {g.prosjekt ? ((prosjektKart[g.prosjekt]?.projectNumber ? prosjektKart[g.prosjekt].projectNumber + ' ' : '') + (prosjektKart[g.prosjekt]?.name || '')) : '— Utan prosjekt —'}
            </div>
            <div style={{ padding: '9px 12px', fontSize: 13, fontFamily: 'var(--mono)', color: 'var(--text2)', borderRight: '1px solid var(--border)' }}>{g.akt}</div>
            {dagar.map(d => (
              <div key={d} style={{ padding: '9px 8px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)', borderRight: '1px solid var(--border)', background: ymdLokal(d) === idag ? 'var(--brandbg)' : undefined }}>{fmtT(g.dag[ymdLokal(d)] || 0)}</div>
            ))}
            <div style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>{fmtT(g.sum)}</div>
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: KOL, minWidth: 'min-content', background: 'var(--bg3)', borderTop: '2px solid var(--border)', position: 'sticky', bottom: 0 }}>
          <div style={{ gridColumn: '1 / 3', padding: '11px 12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', fontSize: 12.5, whiteSpace: 'nowrap' }}>Totalt veke {getISOWeek(mandag)}</div>
          {dagSum.map((t, i) => <div key={i} style={{ padding: '11px 8px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700 }}>{fmtT(t)}</div>)}
          <div style={{ padding: '11px 12px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 800, color: 'var(--brand)' }}>{fmtT(totalt)}</div>
        </div>
      </div>
    </div>
  )
}
