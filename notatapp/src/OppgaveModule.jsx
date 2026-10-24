import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import KanbanTavle from './KanbanTavle'
import KanbanKortModal from './KanbanKortModal'
import { KANBAN_MALAR } from './kanbanMalar'
import { FASEKODAR, kortIKolonne, planFlytting, filtrer, faseNamn, fmtDato } from './kanbanLogikk'

// ═══════════════════════════════════════════════════════════════════
//  OppgaveModule = Kanban-tavle per prosjekt (Gjeremål → Oppgåver). Sjå claude/kanban-modul.md.
//  Tabell: kanban_kort (supabase-kanban.sql). Fase-filter, person-filter, søk, WIP-grense (av/på, lagra lokalt),
//  Aktive/Arkiv (ferdige kort), malar per fase og rask oppretting. Lenkjer til sak/oppgåve/Framdrift-aktivitet er referansar.
// ═══════════════════════════════════════════════════════════════════
const SEL = { padding: '6px 9px', border: '1.5px solid var(--border)', borderRadius: 7, fontSize: 12.5, fontFamily: 'var(--font)', background: 'var(--bg2)', color: 'var(--text2)', outline: 'none' }
const lagraWip = () => { try { return Number(localStorage.getItem('liedlab-kanban-wip')) || 0 } catch { return 0 } }
const tomtKort = (userId, projectId) => ({ user_id: userId, project_id: projectId, tittel: '', skildring: '', status: 'ide', ansvarleg: '', fase: null, frist: null, farge: null, sak_id: null, oppgave_ref: null, framdrift_aktivitet_ref: null, sortering: 0 })

export default function OppgaveModule({ userId, projects, activeOfficeId, activeProjectId, notes }) {
  const [kort, setKort] = useState([])
  const [lastar, setLastar] = useState(false)
  const [feil, setFeil] = useState('')
  const [personell, setPersonell] = useState([])
  const [saker, setSaker] = useState([])
  const [planElement, setPlanElement] = useState([])
  const [visArkiv, setVisArkiv] = useState(false)
  const [fase, setFase] = useState('')
  const [person, setPerson] = useState('')
  const [sok, setSok] = useState('')
  const [wip, setWip] = useState(lagraWip)
  const [modal, setModal] = useState(null)
  const [malApen, setMalApen] = useState(false)
  const [nyeIds, setNyeIds] = useState(new Set())
  const [sistFlytta, setSistFlytta] = useState(null)
  const [arkFra, setArkFra] = useState('')
  const [arkTil, setArkTil] = useState('')
  const malRef = useRef(null)
  const kortRef = useRef([]); kortRef.current = kort

  const prosjekt = (projects || []).find(p => p.id === activeProjectId)
  const prosjektNotat = useMemo(() => (notes || []).filter(n => n.projectId === activeProjectId), [notes, activeProjectId])

  // lasting per prosjekt
  useEffect(() => {
    setKort([]); setFeil(''); setPersonell([]); setSaker([]); setPlanElement([])
    if (!userId || !activeProjectId) return undefined
    let avbrote = false
    setLastar(true)
    Promise.all([
      supabase.from('kanban_kort').select('*').eq('user_id', userId).eq('project_id', activeProjectId).order('sortering').order('id'),
      supabase.from('prosjekt_personell').select('id,namn').eq('user_id', userId).eq('project_id', activeProjectId).order('sortering').order('id'),
      supabase.from('cases').select('id,number,title').eq('user_id', userId).eq('project_id', activeProjectId).order('id', { ascending: false }),
      supabase.from('framdrift_planar').select('elementer').eq('user_id', userId).eq('project_id', activeProjectId).maybeSingle(),
    ]).then(([k, p, s, f]) => {
      if (avbrote) return
      if (k.error) setFeil('Klarte ikkje laste kort: ' + k.error.message)
      setKort(k.data || []); setPersonell(p.data || []); setSaker(s.data || [])
      setPlanElement(Array.isArray(f.data?.elementer) ? f.data.elementer : [])
      setLastar(false)
    })
    return () => { avbrote = true }
  }, [userId, activeProjectId])

  useEffect(() => {
    if (!malApen) return undefined
    const lukk = e => { if (malRef.current && !malRef.current.contains(e.target)) setMalApen(false) }
    document.addEventListener('mousedown', lukk); return () => document.removeEventListener('mousedown', lukk)
  }, [malApen])

  const settWip = (v) => { const n = Math.max(0, parseInt(v, 10) || 0); setWip(n); try { localStorage.setItem('liedlab-kanban-wip', String(n)) } catch { /* privat modus */ } }
  const merkNy = (ids) => { setNyeIds(new Set(ids)); setTimeout(() => setNyeIds(new Set()), 700) }

  const lagreEndring = useCallback(async (id, patch) => {
    const { error } = await supabase.from('kanban_kort').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId)
    if (error) setFeil('Lagring feila: ' + error.message)
  }, [userId])

  const flytt = useCallback((id, tilStatus, indeks) => {
    const alle = kortRef.current
    const endringar = planFlytting(alle, id, tilStatus, indeks)
    if (!endringar.length) return
    setKort(prev => prev.map(k => { const e = endringar.find(x => x.id === k.id); return e ? { ...k, ...e.patch } : k }))
    setSistFlytta(id); setTimeout(() => setSistFlytta(null), 600)
    endringar.forEach(e => lagreEndring(e.id, e.patch))
  }, [lagreEndring])

  const opprettMange = async (liste) => {
    const { data, error } = await supabase.from('kanban_kort').insert(liste).select()
    if (error) { setFeil('Klarte ikkje opprette: ' + error.message); return [] }
    setKort(prev => [...prev, ...(data || [])]); merkNy((data || []).map(d => d.id))
    return data || []
  }
  const nyttRaskt = (status, tittel, ansvarleg) => {
    const sortering = kortIKolonne(kortRef.current, status).length
    opprettMange([{ ...tomtKort(userId, activeProjectId), status, tittel, ansvarleg, sortering }])
  }
  const lagreModal = async (d) => {
    if (d.id) {
      const { id, user_id, created_at, ...resten } = d
      const patch = { ...resten }
      const gammal = kort.find(k => k.id === id)
      if (gammal && gammal.status !== d.status) patch.ferdig_dato = d.status === 'ferdig' ? new Date().toISOString() : null
      setKort(prev => prev.map(k => k.id === id ? { ...k, ...patch } : k))
      await lagreEndring(id, patch)
    } else {
      const sortering = kortIKolonne(kortRef.current, d.status).length
      await opprettMange([{ ...d, sortering, ferdig_dato: d.status === 'ferdig' ? new Date().toISOString() : null }])
    }
    setModal(null)
  }
  const slett = async (id) => {
    setKort(prev => prev.filter(k => k.id !== id)); setModal(null)
    const { error } = await supabase.from('kanban_kort').delete().eq('id', id).eq('user_id', userId)
    if (error) setFeil('Sletting feila: ' + error.message)
  }
  const leggInnMal = async (faseKode, status) => {
    setMalApen(false)
    const tekstar = KANBAN_MALAR[faseKode] || []
    const start = kortIKolonne(kortRef.current, status).length
    await opprettMange(tekstar.map((tittel, i) => ({ ...tomtKort(userId, activeProjectId), status, tittel, fase: faseKode, sortering: start + i })))
  }

  const personNamn = useMemo(() => [...new Set([...personell.map(p => p.namn), ...kort.map(k => k.ansvarleg).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'nb')), [personell, kort])
  const aktive = useMemo(() => filtrer(kort.filter(k => k.status !== 'ferdig'), { fase, person, sok }), [kort, fase, person, sok])
  const arkivListe = useMemo(() => filtrer(kort.filter(k => k.status === 'ferdig'), { fase, person, sok })
    .filter(k => (!arkFra || (k.ferdig_dato || '').slice(0, 10) >= arkFra) && (!arkTil || (k.ferdig_dato || '').slice(0, 10) <= arkTil))
    .sort((a, b) => String(b.ferdig_dato || '').localeCompare(String(a.ferdig_dato || ''))), [kort, fase, person, sok, arkFra, arkTil])
  const ferdigAntal = kort.filter(k => k.status === 'ferdig').length

  const TAB = (aktiv) => ({ padding: '6px 14px', border: '1.5px solid ' + (aktiv ? 'var(--brand)' : 'transparent'), borderRadius: 8, background: aktiv ? '#fff' : 'rgba(255,255,255,.5)', color: aktiv ? 'var(--brand)' : 'var(--text2)', fontSize: 13, fontWeight: aktiv ? 700 : 500, cursor: 'pointer', fontFamily: 'var(--font)' })

  if (!activeProjectId) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: 'var(--text3)' }}>
        <div style={{ fontSize: 30 }}>▦</div>
        <p style={{ fontSize: 14, maxWidth: 380, textAlign: 'center', lineHeight: 1.7 }}>Vel eit prosjekt øvst i vindauget for å sjå kanban-tavla.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', height: 50, flexShrink: 0, background: 'var(--bg3)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <button onClick={() => setVisArkiv(false)} style={TAB(!visArkiv)}>Tavle</button>
        <button onClick={() => setVisArkiv(true)} style={TAB(visArkiv)}>Arkiv{ferdigAntal ? ` (${ferdigAntal})` : ''}</button>
        <div style={{ width: 8 }}/>
        <select value={fase} onChange={e => setFase(e.target.value)} style={SEL} title="Filtrer på fase">
          <option value="">Alle fasar</option>{FASEKODAR.map(f => <option key={f.kode} value={f.kode}>{f.kode} {f.namn}</option>)}</select>
        <select value={person} onChange={e => setPerson(e.target.value)} style={SEL} title="Filtrer på ansvarleg">
          <option value="">Alle personar</option><option value="__ingen__">Utan ansvarleg</option>{personNamn.map(n => <option key={n} value={n}>{n}</option>)}</select>
        <input value={sok} onChange={e => setSok(e.target.value)} placeholder="Søk i kort…" style={{ ...SEL, width: 150 }}/>
        <div style={{ flex: 1 }}/>
        {!visArkiv && (
          <label title="Maks tal kort per person i Under arbeid og dei to godkjenning-kolonnane. 0 = av. Berre ei visuell åtvaring." style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
            WIP-grense
            <input type="number" min="0" value={wip} onChange={e => settWip(e.target.value)} style={{ ...SEL, width: 56, padding: '5px 6px' }}/>
          </label>
        )}
        {!visArkiv && (
          <div ref={malRef} style={{ position: 'relative' }}>
            <button onClick={() => setMalApen(v => !v)} style={{ ...SEL, cursor: 'pointer', fontWeight: 600 }}>Malar ▾</button>
            {malApen && (
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 60, width: 270, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-lg)', padding: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', padding: '2px 6px 6px', lineHeight: 1.4 }}>Legg standardkort for ein fase i kolonna Idé eller Komande oppgåver:</div>
                {FASEKODAR.map(f => (
                  <div key={f.kode} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', fontSize: 12.5, color: 'var(--text)' }}>
                    <span style={{ flex: 1 }}>{f.kode} {f.namn}</span>
                    <button onClick={() => leggInnMal(f.kode, 'ide')} style={{ ...SEL, padding: '2px 8px', cursor: 'pointer' }}>→ Idé</button>
                    <button onClick={() => leggInnMal(f.kode, 'komande')} style={{ ...SEL, padding: '2px 8px', cursor: 'pointer' }}>→ Komande</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <button onClick={() => setModal(tomtKort(userId, activeProjectId))} style={{ padding: '7px 16px', border: 'none', borderRadius: 8, background: 'var(--brand)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}>+ Nytt kort</button>
      </div>

      {feil && <div style={{ margin: '10px 20px 0', padding: '8px 12px', background: 'rgba(185,28,28,.08)', border: '1.5px solid var(--danger)', borderRadius: 8, fontSize: 13, color: 'var(--danger)' }}>{feil}</div>}

      {lastar ? (
        <div style={{ padding: 30, color: 'var(--text3)', fontSize: 13 }}>Lastar…</div>
      ) : !visArkiv ? (
        <KanbanTavle kort={aktive} wipGrense={wip} personell={personell} notes={prosjektNotat} planElement={planElement}
          nyeIds={nyeIds} sistFlytta={sistFlytta} onApne={setModal} onFlytt={flytt} onNytt={nyttRaskt}/>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, fontSize: 12, color: 'var(--text3)' }}>
            Ferdigstilt frå <input type="date" value={arkFra} onChange={e => setArkFra(e.target.value)} style={SEL}/> til <input type="date" value={arkTil} onChange={e => setArkTil(e.target.value)} style={SEL}/>
            <span>{arkivListe.length} kort</span>
          </div>
          {arkivListe.length === 0 ? <div style={{ color: 'var(--text3)', fontSize: 13, padding: 20 }}>Ingen ferdigstilte kort{ferdigAntal ? ' i dette utvalet' : ' enno'}.</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr>{['Tittel', 'Ansvarleg', 'Fase', 'Ferdigstilt', ''].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text3)', borderBottom: '2px solid var(--border)' }}>{h}</th>)}</tr></thead>
              <tbody>{arkivListe.map(k => (
                <tr key={k.id} onClick={() => setModal(k)} style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '9px 10px', fontWeight: 600, color: 'var(--text)' }}>{k.tittel}</td>
                  <td style={{ padding: '9px 10px', color: 'var(--text2)' }}>{k.ansvarleg || '—'}</td>
                  <td style={{ padding: '9px 10px', color: 'var(--text2)' }}>{k.fase ? `${k.fase} ${faseNamn(k.fase)}` : '—'}</td>
                  <td style={{ padding: '9px 10px', color: 'var(--text2)' }}>{fmtDato(k.ferdig_dato)}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                    <button onClick={e => { e.stopPropagation(); flytt(k.id, 'komande', null) }} style={{ ...SEL, padding: '3px 10px', cursor: 'pointer' }}>Gjenopne</button>
                  </td>
                </tr>))}</tbody>
            </table>
          )}
        </div>
      )}

      {modal && <KanbanKortModal key={modal.id || 'ny'} kort={modal} saker={saker} notes={prosjektNotat} planElement={planElement} personell={personell}
        onLagre={lagreModal} onSlett={slett} onLukk={() => setModal(null)}/>}
    </div>
  )
}
