import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'

// Enkel prosjektchat v1: éin kronologisk straum per prosjekt. Same tilgang som resten av prosjektet (RLS: kan_se_prosjekt).
// Ingen redigering/sletting. Meldingar vert vist som rein tekst (aldri HTML).
const namnFraEpost = (e) => (e || '?').split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
const dagTekst = (iso) => new Date(iso).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })
const klokke = (iso) => new Date(iso).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })

export default function ProsjektChat({ prosjekt, userId }) {
  const [meldingar, setMeldingar] = useState([])
  const [namn, setNamn]           = useState({})   // user_id → visingsnamn
  const [tekst, setTekst]         = useState('')
  const [lastar, setLastar]       = useState(true)
  const [feil, setFeil]           = useState('')
  const [sender, setSender]       = useState(false)
  const botnRef = useRef(null)
  const pid = prosjekt?.id

  const leggTil = useCallback((rad) => {
    setMeldingar(prev => prev.some(m => m.id === rad.id) ? prev : [...prev, rad].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id))
  }, [])

  useEffect(() => {
    if (!pid) return undefined
    let avbrote = false
    setLastar(true); setFeil(''); setMeldingar([])
    ;(async () => {
      const [m, k] = await Promise.all([
        supabase.from('prosjekt_meldingar').select('*').eq('project_id', pid).order('created_at', { ascending: true }).limit(500),
        prosjekt.officeId ? supabase.from('office_members').select('user_id, invited_email').eq('office_id', prosjekt.officeId).eq('status', 'active') : Promise.resolve({ data: [] }),
      ])
      if (avbrote) return
      if (m.error) setFeil('Klarte ikkje hente meldingar: ' + m.error.message)
      setMeldingar(m.data || [])
      setNamn(Object.fromEntries((k.data || []).filter(x => x.user_id).map(x => [x.user_id, namnFraEpost(x.invited_email)])))
      setLastar(false)
    })()
    const kanal = supabase.channel('prosjekt-chat-' + pid)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'prosjekt_meldingar', filter: `project_id=eq.${pid}` }, p => leggTil(p.new))
      .subscribe()
    return () => { avbrote = true; supabase.removeChannel(kanal) }
  }, [pid, prosjekt?.officeId, leggTil])

  useEffect(() => { botnRef.current?.scrollIntoView({ block: 'end' }) }, [meldingar.length, lastar])

  const send = async () => {
    const t = tekst.trim()
    if (!t || sender) return
    setSender(true); setFeil('')
    const { data, error } = await supabase.from('prosjekt_meldingar').insert({ project_id: pid, user_id: userId, tekst: t }).select().single()
    setSender(false)
    if (error) { setFeil('Klarte ikkje sende: ' + error.message); return }
    setTekst('')
    leggTil(data)
  }

  if (!prosjekt) return null
  let sisteDag = ''
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: 760, minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 2px 12px', minHeight: 0 }}>
        {lastar ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Lastar…</div>
          : meldingar.length === 0 ? <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: 30 }}>Ingen meldingar enno. Skriv ei kort melding til alle i prosjektet.</div>
          : meldingar.map(m => {
            const dag = dagTekst(m.created_at); const nyDag = dag !== sisteDag; sisteDag = dag
            const eg = m.user_id === userId
            return (
              <div key={m.id}>
                {nyDag && <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3)', margin: '14px 0 8px', textTransform: 'capitalize' }}>{dag}</div>}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: eg ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>{eg ? 'Du' : (namn[m.user_id] || 'Ukjend')} · {klokke(m.created_at)}</div>
                  <div style={{ maxWidth: '80%', padding: '8px 12px', borderRadius: 12, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    background: eg ? 'var(--brand)' : 'var(--bg3)', color: eg ? '#fff' : 'var(--text)', border: eg ? 'none' : '1px solid var(--border)' }}>{m.tekst}</div>
                </div>
              </div>
            )
          })}
        <div ref={botnRef}/>
      </div>
      {feil && <div style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 6 }}>{feil}</div>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
        <textarea value={tekst} onChange={e => setTekst(e.target.value)} rows={2} maxLength={4000} placeholder="Skriv ei melding… (Enter sender, Shift+Enter gir ny linje)"
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          style={{ flex: 1, padding: '8px 10px', borderRadius: 'var(--r)', border: '1.5px solid var(--border)', background: 'var(--bg2)', fontSize: 14, fontFamily: 'var(--font)', color: 'var(--text)', resize: 'none', outline: 'none' }}/>
        <button onClick={send} disabled={!tekst.trim() || sender}
          style={{ padding: '9px 18px', borderRadius: 'var(--r)', border: 'none', background: tekst.trim() ? 'var(--brand)' : 'var(--bg3)', color: tekst.trim() ? '#fff' : 'var(--text3)', fontWeight: 700, fontSize: 13, cursor: tekst.trim() ? 'pointer' : 'default' }}>
          Send
        </button>
      </div>
    </div>
  )
}
