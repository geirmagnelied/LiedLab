import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

// ═══════════════════════════════════════════════════════════════════
//  Ansatte (Kontordrift → Ansatte): administrator registrerer dei ansatte på kontoret. Kvar ansatt kan få ein
//  invitasjon på e-post (edge-funksjonen «inviter-ansatt», Supabase) for å ta i bruk appen. Personell under
//  Prosjekt veljast frå denne lista (PersonellSide). Tabell: ansatte (supabase — sjå claude/kontordrift-modul.md).
// ═══════════════════════════════════════════════════════════════════

const CSS = `
.an-in { width:100%; padding:5px 7px; border:1px solid transparent; border-radius:4px; font-size:13px; font-family:var(--font); background:transparent; color:var(--text); outline:none; box-sizing:border-box }
.an-in:hover { border-color:var(--border) } .an-in:focus { border-color:var(--brand2); background:var(--bg2) }
.an-th { text-align:left; font-size:10.5px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:var(--text3); padding:9px 8px; border-bottom:2px solid var(--border); background:var(--bg3); white-space:nowrap }
.an-td { padding:3px 4px; border-bottom:1px solid var(--border); vertical-align:middle }
.an-kn { border:1.5px solid var(--border); background:var(--bg2); color:var(--text2); border-radius:7px; padding:5px 11px; font-size:12px; font-weight:700; font-family:var(--font); cursor:pointer; white-space:nowrap }
.an-kn:hover:not(:disabled) { border-color:var(--brand2); color:var(--brand); background:var(--brandbg) } .an-kn:disabled { opacity:.5; cursor:default }
.an-kn.hovud { background:var(--brand); border-color:var(--brand); color:#fff }
`
const STATUS = {
  ikkje:  { tekst: 'Ikkje invitert', farge: '#64748B' },
  sendt:  { tekst: 'Invitasjon sendt', farge: '#B45309' },
  medlem: { tekst: 'Har konto', farge: '#15803D' },
  feil:   { tekst: 'Feila', farge: '#B91C1C' },
}

export default function AnsatteSide({ userId, userEmail, visNamn }) {
  const [rader, setRader] = useState([])
  const [lastar, setLastar] = useState(true)
  const [melding, setMelding] = useState('')
  const [feil, setFeil] = useState('')
  const [sender, setSender] = useState(null)

  const last = useCallback(async () => {
    const { data, error } = await supabase.from('ansatte').select('*').eq('user_id', userId).order('sortering').order('id')
    if (error) { setFeil('Klarte ikkje lese ansatte: ' + error.message); setLastar(false); return }
    let liste = data || []
    // fyrste gong: legg inn deg sjølv som administrator
    if (!liste.length) {
      const namn = (visNamn || (userEmail || '').split('@')[0] || '').trim()
      const del = namn.split(/\s+/)
      const rad = { user_id: userId, fornamn: del.slice(0, -1).join(' ') || namn, etternamn: del.length > 1 ? del[del.length - 1] : '', namn, epost: userEmail || '', rolle: 'administrator', invitasjon_status: 'medlem', sortering: 0 }
      const { data: ny } = await supabase.from('ansatte').insert(rad).select().single()
      if (ny) liste = [ny]
    }
    setRader(liste); setLastar(false)
  }, [userId, userEmail, visNamn])
  useEffect(() => { last() }, [last])

  const oppdater = async (id, patch) => {
    setFeil('')
    const gammal = rader.find(r => r.id === id)
    const ny = { ...gammal, ...patch }
    if ('fornamn' in patch || 'etternamn' in patch) ny.namn = [ny.fornamn, ny.etternamn].filter(Boolean).join(' ')
    setRader(rs => rs.map(r => (r.id === id ? ny : r)))
    const { namn, fornamn, etternamn, epost, tittel, rolle, timepris, aktiv, merknad } = ny
    const { error } = await supabase.from('ansatte').update({ namn, fornamn, etternamn, epost, tittel, rolle, timepris, aktiv, merknad, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId)
    if (error) { setFeil('Klarte ikkje lagre: ' + error.message); setRader(rs => rs.map(r => (r.id === id ? gammal : r))) }
  }
  const nyAnsatt = async () => {
    setFeil('')
    const { data, error } = await supabase.from('ansatte').insert({ user_id: userId, fornamn: '', etternamn: '', namn: '', epost: '', rolle: 'ansatt', sortering: rader.length }).select().single()
    if (error) { setFeil('Klarte ikkje legge til: ' + error.message); return }
    setRader(rs => [...rs, data])
  }
  const slett = async (r) => {
    if (!window.confirm(`Fjerne ${r.namn || 'denne ansatte'} frå registeret? (Personen vert òg fjerna som valbar i personell.)`)) return
    const { error } = await supabase.from('ansatte').delete().eq('id', r.id).eq('user_id', userId)
    if (error) { setFeil('Klarte ikkje slette: ' + error.message); return }
    setRader(rs => rs.filter(x => x.id !== r.id))
  }
  const inviter = async (r) => {
    setFeil(''); setMelding('')
    if (!r.epost || !/.+@.+\..+/.test(r.epost)) { setFeil('Legg inn ei gyldig e-postadresse før du sender invitasjon.'); return }
    if (!window.confirm(`Sende invitasjon til ${r.epost}? Personen får ein e-post med lenke for å ta i bruk appen.`)) return
    setSender(r.id)
    try {
      const { data, error } = await supabase.functions.invoke('inviter-ansatt', { body: { ansattId: r.id, redirectTo: window.location.origin + window.location.pathname } })
      if (error) throw new Error((await error.context?.json?.().catch(() => null))?.feil || error.message)
      if (data?.feil) throw new Error(data.feil)
      setMelding(data?.melding || 'Invitasjon sendt.')
    } catch (e) { setFeil('Invitasjonen feila: ' + e.message) }
    setSender(null); last()
  }

  return (
    <div style={{ maxWidth: 1300 }}>
      <style>{CSS}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Ansatte</div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.6, maxWidth: 760 }}>
            Registrer dei som arbeider på kontoret. Trykk «Send invitasjon» for at ein ansatt skal få e-post og ta i bruk appen. Personell under Prosjekt vert valt frå denne lista.
          </div>
        </div>
        <div style={{ flex: 1 }}/>
        <button className="an-kn hovud" onClick={nyAnsatt}>＋ Ny ansatt</button>
      </div>
      {feil && <div style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 8 }}>{feil}</div>}
      {melding && <div style={{ color: '#15803D', fontSize: 12.5, marginBottom: 8, fontWeight: 600 }}>{melding}</div>}
      <div style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--r2)', background: 'var(--bg2)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
          <thead><tr>
            <th className="an-th">Fornamn</th><th className="an-th">Etternamn</th><th className="an-th" style={{ minWidth: 220 }}>E-post</th><th className="an-th">Tittel</th>
            <th className="an-th" style={{ width: 130 }}>Rolle</th><th className="an-th" style={{ width: 110 }}>Timepris kr/t</th><th className="an-th" style={{ width: 60 }}>Aktiv</th>
            <th className="an-th" style={{ width: 240 }}>Invitasjon</th><th className="an-th" style={{ width: 34 }}/>
          </tr></thead>
          <tbody>
            {lastar && <tr><td colSpan={9} style={{ padding: 18, color: 'var(--text3)' }}>Lastar…</td></tr>}
            {rader.map(r => {
              const st = STATUS[r.invitasjon_status] || STATUS.ikkje
              const meg = (r.epost || '').toLowerCase() === (userEmail || '').toLowerCase()
              return (
                <tr key={r.id} style={{ opacity: r.aktiv ? 1 : .55 }}>
                  <td className="an-td"><input className="an-in" defaultValue={r.fornamn} key={r.fornamn} onBlur={e => e.target.value !== r.fornamn && oppdater(r.id, { fornamn: e.target.value.trim() })}/></td>
                  <td className="an-td"><input className="an-in" defaultValue={r.etternamn} key={r.etternamn} onBlur={e => e.target.value !== r.etternamn && oppdater(r.id, { etternamn: e.target.value.trim() })}/></td>
                  <td className="an-td"><input className="an-in" type="email" defaultValue={r.epost} key={r.epost} onBlur={e => e.target.value !== r.epost && oppdater(r.id, { epost: e.target.value.trim() })}/></td>
                  <td className="an-td"><input className="an-in" defaultValue={r.tittel || ''} key={r.tittel} placeholder="T.d. Arkitekt" onBlur={e => e.target.value !== (r.tittel || '') && oppdater(r.id, { tittel: e.target.value.trim() })}/></td>
                  <td className="an-td"><select className="an-in" value={r.rolle} onChange={e => oppdater(r.id, { rolle: e.target.value })}><option value="ansatt">Ansatt</option><option value="administrator">Administrator</option></select></td>
                  <td className="an-td"><input className="an-in" type="number" min="0" step="any" defaultValue={r.timepris ?? ''} key={r.timepris} style={{ textAlign: 'right' }}
                    onBlur={e => { const n = parseFloat(e.target.value); const nytt = n >= 0 ? n : null; if (nytt !== (r.timepris ?? null)) oppdater(r.id, { timepris: nytt }) }}/></td>
                  <td className="an-td" style={{ textAlign: 'center' }}><input type="checkbox" checked={!!r.aktiv} onChange={e => oppdater(r.id, { aktiv: e.target.checked })}/></td>
                  <td className="an-td">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: st.farge, borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap' }}>{st.tekst}</span>
                      {!meg && <button className="an-kn" disabled={sender === r.id || !r.epost} onClick={() => inviter(r)}>{sender === r.id ? 'Sender…' : r.invitasjon_status === 'sendt' || r.invitasjon_status === 'feil' ? 'Send på nytt' : 'Send invitasjon'}</button>}
                    </div>
                  </td>
                  <td className="an-td">{!meg && <button onClick={() => slett(r)} title="Fjern frå registeret" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 16 }}>×</button>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
