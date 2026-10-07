import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import DataTabell from './DataTabell'
import useKontorkalender from './useKontorkalender'
import { kapasitetPerVeke } from './kontorkalender'

// ═══════════════════════════════════════════════════════════════════
//  Personell per prosjekt (Prosjekt-modulen, eiga side) — kven som arbeider
//  på prosjektet og kor stor del av arbeidstida dei har til det. Brukt i
//  Framdrift: «Ansvarleg» på ein aktivitet kan veljast frå denne lista, og
//  planlagde timar per veke vert samanlikna med kapasiteten (kontorkalender ×
//  prosent) for å varsle om overbelastning. Tabell: prosjekt_personell
//  (supabase-personell.sql). Tynn wrapper rundt DataTabell.
// ═══════════════════════════════════════════════════════════════════

const knapp = { padding: '6px 12px', border: '1.5px solid var(--border)', borderRadius: 7, background: 'var(--bg2)', color: 'var(--text2)',
  fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font)', cursor: 'pointer' }

export default function PersonellSide({ userId, prosjekt, prosjektListe }) {
  const [personar, setPersonar] = useState([])
  const [lastar, setLastar] = useState(true)
  const [feil, setFeil] = useState('')
  const { kal } = useKontorkalender(userId)
  const pid = prosjekt?.id

  const last = useCallback(async () => {
    if (!userId || !pid) { setPersonar([]); setLastar(false); return }
    setLastar(true)
    const { data, error } = await supabase.from('prosjekt_personell').select('*')
      .eq('user_id', userId).eq('project_id', pid).order('sortering').order('id')
    if (error) setFeil('Klarte ikkje lese personell — er migrasjonen køyrd? ' + error.message)
    setPersonar(data || [])
    setLastar(false)
  }, [userId, pid])
  useEffect(() => { last() }, [last])

  const leggTil = async (felt = {}) => {
    setFeil('')
    const rad = { user_id: userId, project_id: pid, namn: 'Ny person', rolle: '', prosent: 100, epost: '', merknad: '',
      sortering: personar.length, ...felt }
    const { data, error } = await supabase.from('prosjekt_personell').insert(rad).select().single()
    if (error) { setFeil('Klarte ikkje legge til: ' + error.message); return null }
    setPersonar(p => [...p, data])
    return data
  }

  const settVerdi = async (id, key, verdi) => {
    const gammal = personar.find(p => p.id === id)
    if (!gammal) return
    let ny = verdi
    if (key === 'prosent') ny = Math.max(0, Math.min(100, parseFloat(String(verdi).replace(',', '.')) || 0))
    if (key === 'namn') { ny = String(verdi).trim(); if (!ny) return }
    setPersonar(ps => ps.map(p => (p.id === id ? { ...p, [key]: ny } : p)))
    const { error } = await supabase.from('prosjekt_personell').update({ [key]: ny, updated_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', userId)
    if (error) { setFeil('Klarte ikkje lagre: ' + error.message); setPersonar(ps => ps.map(p => (p.id === id ? gammal : p))) }
  }

  const slett = async (id) => {
    const p = personar.find(x => x.id === id)
    if (!p || !window.confirm(`Fjerne ${p.namn} frå prosjektet?`)) return
    const { error } = await supabase.from('prosjekt_personell').delete().eq('id', id).eq('user_id', userId)
    if (error) { setFeil('Klarte ikkje slette: ' + error.message); return }
    setPersonar(ps => ps.filter(x => x.id !== id))
  }

  const kopierFra = async (fraId) => {
    if (!fraId) return
    const { data } = await supabase.from('prosjekt_personell').select('*').eq('user_id', userId).eq('project_id', +fraId).order('sortering')
    const finst = new Set(personar.map(p => p.namn.trim().toLowerCase()))
    const nye = (data || []).filter(p => !finst.has(p.namn.trim().toLowerCase()))
      .map((p, i) => ({ user_id: userId, project_id: pid, namn: p.namn, rolle: p.rolle, prosent: p.prosent, epost: p.epost, merknad: '', sortering: personar.length + i }))
    if (!nye.length) { setFeil('Ingen nye personar å kopiere (dei finst alt, eller prosjektet har ingen).'); return }
    const { data: lagt, error } = await supabase.from('prosjekt_personell').insert(nye).select()
    if (error) { setFeil('Klarte ikkje kopiere: ' + error.message); return }
    setPersonar(p => [...p, ...lagt])
  }

  const kolonnar = [
    { key: 'namn',    label: 'Namn',        art: 'tekst', redigerbar: true, w: 220, utanFilter: true },
    { key: 'rolle',   label: 'Rolle',       art: 'val',   redigerbar: true, w: 180 },
    { key: 'prosent', label: 'Prosent',     art: 'tal',   redigerbar: true, w: 90, ikkjeSummer: true },
    { key: 'kapasitet', label: 'Kapasitet t/veke', art: 'tal', beregna: true, w: 140, ikkjeSummer: true },
    { key: 'epost',   label: 'E-post',      art: 'tekst', redigerbar: true, w: 220, utanFilter: true },
    { key: 'merknad', label: 'Merknad',     art: 'tekst', redigerbar: true, w: 260, utanFilter: true },
  ]
  const hentVerdi = (p, key) => {
    if (key === 'kapasitet') return kapasitetPerVeke(kal, +p.prosent || 0)
    if (key === 'prosent') return p.prosent ?? ''
    return p[key] ?? ''
  }
  const andreProsjekt = (prosjektListe || []).filter(p => p.id !== pid && !p.deletedAt)

  if (!pid) return <div style={{ color: 'var(--text3)', fontSize: 13 }}>Vel eit prosjekt i lista til venstre.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', minHeight: 0 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Personell — {prosjekt.name}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.6, maxWidth: 720 }}>
          Kven som arbeider på prosjektet. «Prosent» er kor stor del av full arbeidstid personen har til dette prosjektet
          (full kapasitet = {kapasitetPerVeke(kal)} t/veke etter kontorkalenderen). I Framdrift kan «Ansvarleg» veljast frå lista, og
          overbelastning vert varsla. Dobbeltklikk ei celle for å rette.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button style={{ ...knapp, background: 'var(--brand)', borderColor: 'var(--brand)', color: '#fff' }} onClick={() => leggTil()}>+ Legg til person</button>
        {andreProsjekt.length > 0 && (
          <select value="" onChange={e => kopierFra(e.target.value)}
            style={{ padding: '6px 8px', border: '1.5px solid var(--border)', borderRadius: 7, fontSize: 12.5, fontFamily: 'var(--font)', background: 'var(--bg2)', color: 'var(--text2)' }}>
            <option value="">Kopier personell frå anna prosjekt…</option>
            {andreProsjekt.map(p => <option key={p.id} value={p.id}>{p.projectNumber ? p.projectNumber + ' · ' : ''}{p.name}</option>)}
          </select>
        )}
        {feil && <span style={{ fontSize: 12.5, color: 'var(--danger)' }}>{feil}</span>}
      </div>
      <div style={{ flex: 1, minHeight: 260, display: 'flex', flexDirection: 'column', border: '1.5px solid var(--border)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
        {lastar ? <div style={{ padding: 16, color: 'var(--text3)', fontSize: 13 }}>Lastar…</div> : (
          <DataTabell rader={personar} kolonnar={kolonnar} hentVerdi={hentVerdi} radId={p => p.id}
            onSetVerdi={settVerdi} radMeny={{ onSlett: (id) => slett(id) }} rutenettRedigering
            prefsKey="liedlab-personell-v1" itemNamn="personar" defaultSortering={{ key: 'namn', dir: 'asc' }}/>
        )}
      </div>
    </div>
  )
}
