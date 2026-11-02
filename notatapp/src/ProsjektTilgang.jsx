import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

// Kven har tilgang til DETTE prosjektet. Kontoradministrasjon (kven som er med i kontoret) ligg i Innstillingar;
// her vel ein av kontorets aktive medlemmar kven som skal sjå prosjektet (project_members). Å vere administrator gjev ikkje automatisk tilgang.
export default function ProsjektTilgang({ prosjekt, userId, kanRedigere = false }) {
  const [medlemmar, setMedlemmar] = useState([])   // aktive kontormedlemmar
  const [tilgang, setTilgang]     = useState(new Set())   // user_id med tilgang
  const [lastar, setLastar]       = useState(true)
  const [feil, setFeil]           = useState('')
  const [opptatt, setOpptatt]     = useState(null)

  const last = useCallback(async () => {
    if (!prosjekt) return
    setLastar(true); setFeil('')
    const [m, t] = await Promise.all([
      prosjekt.officeId
        ? supabase.from('office_members').select('user_id, invited_email, role').eq('office_id', prosjekt.officeId).eq('status', 'active')
        : Promise.resolve({ data: [] }),
      supabase.from('project_members').select('user_id').eq('project_id', prosjekt.id),
    ])
    setMedlemmar((m.data || []).filter(x => x.user_id))
    setTilgang(new Set((t.data || []).map(x => x.user_id)))
    setLastar(false)
  }, [prosjekt?.id, prosjekt?.officeId])
  useEffect(() => { last() }, [last])

  const veksle = async (uid) => {
    setFeil(''); setOpptatt(uid)
    const har = tilgang.has(uid)
    if (har && uid === userId && !window.confirm('Du fjernar deg sjølv frå prosjektet og mister tilgangen. Fortsette?')) { setOpptatt(null); return }
    if (har && tilgang.size <= 1 && !window.confirm('Dette er siste med tilgang. Då vil ingen kunne opne prosjektet. Fortsette?')) { setOpptatt(null); return }
    const { error } = har
      ? await supabase.from('project_members').delete().eq('project_id', prosjekt.id).eq('user_id', uid)
      : await supabase.from('project_members').insert({ project_id: prosjekt.id, user_id: uid, lagt_til_av: userId })
    setOpptatt(null)
    if (error) { setFeil('Klarte ikkje endre tilgangen: ' + error.message); return }
    setTilgang(prev => { const n = new Set(prev); har ? n.delete(uid) : n.add(uid); return n })
  }

  if (!prosjekt) return null
  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)', marginBottom: 6 }}>Tilgang til prosjektet</div>
      <p style={{ fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 14 }}>
        Berre dei du kryssar av for kan sjå notat, saker, filer og alt anna i dette prosjektet. Nye medlemmer vert inviterte til kontoret under Innstillingar, og dukkar opp her etter at dei har logga inn første gong.
      </p>
      {!kanRedigere && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>Trykk «Endre prosjekt» (administrator) for å endre tilgangen.</div>}
      {feil && <div style={{ background: 'rgba(220,38,38,.12)', border: '1px solid rgba(220,38,38,.4)', borderRadius: 8, padding: '8px 12px', color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{feil}</div>}
      {lastar ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Lastar…</div>
        : !prosjekt.officeId ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Prosjektet høyrer ikkje til noko kontor, og er berre synleg for deg.</div>
        : medlemmar.length === 0 ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Ingen aktive medlemmer i kontoret.</div>
        : medlemmar.map(m => (
          <label key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r)', marginBottom: 6, background: 'var(--bg2)', cursor: opptatt ? 'wait' : kanRedigere ? 'pointer' : 'default' }}>
            <input type="checkbox" checked={tilgang.has(m.user_id)} disabled={!!opptatt || !kanRedigere} onChange={() => veksle(m.user_id)}/>
            <span style={{ flex: 1, fontSize: 13.5, color: 'var(--text)' }}>{m.invited_email}{m.user_id === userId ? ' (deg)' : ''}</span>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{m.role === 'admin' ? 'Administrator' : 'Medlem'}</span>
          </label>
        ))}
    </div>
  )
}
