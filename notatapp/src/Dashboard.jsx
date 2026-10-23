import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase'
import { useT } from './sprak'

// Startsida: midtstilte, flytande «kort» med siste aktivitet og status.
// Notat/oppgåver kjem frå den alt innlasta store (props); timar og DTM-endringar
// vert henta her (lette spørjingar, berre lesing).

function ymd(d) { const z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` }
function mandag(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }
function relTid(iso) {
  if (!iso) return ''
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'no'
  if (min < 60) return `${min} min sidan`
  if (min < 60 * 24) return `${Math.round(min / 60)} t sidan`
  const dg = Math.round(min / 1440)
  return dg === 1 ? 'i går' : `${dg} dagar sidan`
}
const fmtKort = (s) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}.${m}.` }

function Kort({ tittel, ikon, farge, eigenKnapp, onKlikk, children, breidd = 1 }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r2)',
      boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', minHeight: 220, maxHeight: 360,
      gridColumn: breidd > 1 ? `span ${breidd}` : undefined, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg3)' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: farge }}/>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text2)', flex: 1 }}>{ikon} {tittel}</span>
        {onKlikk && <button onClick={onKlikk} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--brand)' }}>{eigenKnapp || 'Opne'} ›</button>}
      </div>
      <div style={{ padding: '6px 6px 10px', overflowY: 'auto', flex: 1 }}>{children}</div>
    </div>
  )
}
const Tom = ({ tekst }) => <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 12.5, color: 'var(--text3)' }}>{tekst}</div>
const Rad = ({ hovud, under, hogre, onKlikk }) => (
  <div onClick={onKlikk} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 8px', borderRadius: 6, cursor: onKlikk ? 'pointer' : 'default' }}
    onMouseEnter={e => { if (onKlikk) e.currentTarget.style.background = 'var(--bg3)' }} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hovud}</div>
      {under && <div style={{ fontSize: 11.5, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{under}</div>}
    </div>
    {hogre && <div style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap', fontFamily: 'var(--mono)' }}>{hogre}</div>}
  </div>
)

export default function Dashboard({ userId, userEmail, projects, notes, onOpneModul, onVelgProsjekt }) {
  const { t, sprak } = useT()
  const prosjektNamn = useMemo(() => Object.fromEntries((projects || []).map(p => [p.id, p.name])), [projects])
  const prosjektIds = useMemo(() => new Set((projects || []).map(p => p.id)), [projects])
  const [timar, setTimar] = useState(null)   // { 'YYYY-MM-DD': timar }
  const [dtm, setDtm] = useState(null)

  const mnd = useMemo(() => mandag(new Date()), [])
  useEffect(() => {
    let avbrutt = false
    const fra = ymd(mnd); const til = ymd(new Date(mnd.getFullYear(), mnd.getMonth(), mnd.getDate() + 6))
    supabase.from('time_entries').select('date,hours').eq('user_id', userId).gte('date', fra).lte('date', til)
      .then(({ data }) => {
        if (avbrutt) return
        const m = {}; for (const r of data || []) m[r.date] = (m[r.date] || 0) + (Number(r.hours) || 0)
        setTimar(m)
      })
    supabase.from('dtm_dokumenter').select('id,nr,tittel,project_id,updated_at').eq('user_id', userId)
      .order('updated_at', { ascending: false }).limit(40)
      .then(({ data }) => { if (!avbrutt) setDtm(data || []) })
    return () => { avbrutt = true }
  }, [userId, mnd])

  const sisteNotat = useMemo(() =>
    [...(notes || [])].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)).slice(0, 8), [notes])
  const opneOppgaver = useMemo(() => {
    const liste = []
    for (const n of notes || []) for (const t of n.tasks || []) if (!t.done) liste.push({ ...t, notat: n })
    return liste.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')).slice(0, 8)
  }, [notes])
  const idag = ymd(new Date())
  const dtmSiste = (dtm || []).filter(d => prosjektIds.has(d.project_id)).slice(0, 8)

  const dagar = ['Man', 'Tys', 'Ons', 'Tor', 'Fre', 'Lau', 'Sø']
  const dagDatoar = dagar.map((_, i) => ymd(new Date(mnd.getFullYear(), mnd.getMonth(), mnd.getDate() + i)))
  const sumVeke = timar ? Object.values(timar).reduce((a, b) => a + b, 0) : 0
  const maks = Math.max(8, ...dagDatoar.map(d => timar?.[d] || 0))
  const forfalne = opneOppgaver.filter(t => t.date && t.date < idag).length

  const timeNo = new Date().getHours()
  const helsing = timeNo < 10 ? t('dash.godmorgon') : timeNo < 18 ? t('dash.goddag') : t('dash.godkveld')

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 1760, padding: '34px 24px 48px' }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--text)' }}>{helsing}</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
            {new Date().toLocaleDateString(sprak === 'bm' ? 'nb-NO' : 'nn-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {' · '}{(projects || []).length} prosjekt · {opneOppgaver.length ? `${opneOppgaver.length}+ opne oppgåver` : 'ingen opne oppgåver'}{forfalne ? ` · ${forfalne} forfalne` : ''}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, alignItems: 'start' }}>
          <Kort tittel={t('dash.sisteNotat')} ikon="✎" farge="#52B788" onKlikk={() => onOpneModul('notatar')}>
            {sisteNotat.length === 0 ? <Tom tekst="Ingen notat enno."/> : sisteNotat.map(n => (
              <Rad key={n.id} hovud={n.title || '(utan tittel)'} under={prosjektNamn[n.projectId] || 'Utan prosjekt'}
                hogre={relTid(n.updatedAt || n.createdAt)} onKlikk={() => { if (n.projectId) onVelgProsjekt?.(n.projectId); onOpneModul('notatar') }}/>
            ))}
          </Kort>

          <Kort tittel={t('dash.opneOppgaver')} ikon="☑" farge="#4EADA3" onKlikk={() => onOpneModul('oppgaver')}>
            {opneOppgaver.length === 0 ? <Tom tekst="Ingen opne oppgåver 🎉"/> : opneOppgaver.map(t => (
              <Rad key={t.notat.id + '-' + t.id} hovud={t.text} under={`${t.notat.title || 'Notat'} · ${prosjektNamn[t.notat.projectId] || 'Utan prosjekt'}`}
                hogre={t.date ? <span style={{ color: t.date < idag ? 'var(--danger, #c0392b)' : undefined, fontWeight: t.date < idag ? 700 : 400 }}>{fmtKort(t.date)}</span> : ''}
                onKlikk={() => onOpneModul('oppgaver')}/>
            ))}
          </Kort>

          <Kort tittel={t('dash.timarVeka')} ikon="◷" farge="#60A5D4" onKlikk={() => onOpneModul('timar')} eigenKnapp="Før timar">
            {timar === null ? <Tom tekst="Lastar…"/> : (
              <div style={{ padding: '10px 10px 4px' }}>
                <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{sumVeke.toFixed(1)} <span style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>t av 37,5</span></div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 110, marginTop: 16 }}>
                  {dagDatoar.map((d, i) => {
                    const t = timar[d] || 0
                    return (
                      <div key={d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                        <div style={{ fontSize: 10.5, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{t ? t.toFixed(1) : ''}</div>
                        <div title={`${dagar[i]} ${fmtKort(d)}: ${t.toFixed(2)} t`} style={{ width: '100%', maxWidth: 30, height: `${(t / maks) * 70}%`, minHeight: t ? 3 : 0,
                          background: d === idag ? 'var(--brand)' : '#60A5D4', borderRadius: '4px 4px 0 0', opacity: i > 4 ? .6 : 1 }}/>
                        <div style={{ fontSize: 11, fontWeight: d === idag ? 800 : 500, color: d === idag ? 'var(--text)' : 'var(--text3)' }}>{dagar[i]}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </Kort>

          <Kort tittel={t('dash.sisteDtm')} ikon="▤" farge="#E9C46A" onKlikk={() => onOpneModul('dtm')}>
            {dtm === null ? <Tom tekst="Lastar…"/> : dtmSiste.length === 0 ? <Tom tekst="Ingen dokumentaktivitet enno."/> : dtmSiste.map(d => (
              <Rad key={d.id} hovud={<span style={{ fontFamily: 'var(--mono)' }}>{d.nr}</span>} under={`${d.tittel || ''}${prosjektNamn[d.project_id] ? ' · ' + prosjektNamn[d.project_id] : ''}`}
                hogre={relTid(d.updated_at)} onKlikk={() => { onVelgProsjekt?.(d.project_id); onOpneModul('dtm') }}/>
            ))}
          </Kort>
        </div>
      </div>
    </div>
  )
}
