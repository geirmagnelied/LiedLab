import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import DatePicker from './DatePicker'
import { supabase } from './supabase'
import KanbanTavle from './KanbanTavle'
import KanbanKortModal from './KanbanKortModal'
import KanbanKilder from './KanbanKilder'
import { KANBAN_MALAR } from './kanbanMalar'
import { medKortNummer, TAVLE_FASAR, DTM_KOLONNER, kortIKolonne, planFlytting, planDtmSync, filtrer, faseNamn, fmtDato } from './kanbanLogikk'

// ═══════════════════════════════════════════════════════════════════
//  OppgaveModule = Kanban per prosjekt (Gjeremål → Oppgåver). Sjå claude/kanban-modul.md.
//  Ei TAVLE PER FASE (Skisseprosjekt / Forprosjekt / Byggesøknad / Detaljprosjekt — normalt berre éi aktiv om gongen).
//  Tabellar: kanban_tavler + kanban_kort (supabase-kanban.sql). DTM-leveransar for same fase kjem automatisk som kort og
//  følgjer leveranselista (kontroll/utsending) — sjå planDtmSync i kanbanLogikk.js.
// ═══════════════════════════════════════════════════════════════════
const SEL = { padding: '6px 9px', border: '1.5px solid var(--border)', borderRadius: 7, fontSize: 12.5, fontFamily: 'var(--font)', background: 'var(--bg2)', color: 'var(--text2)', outline: 'none' }
const lagraWip = () => { try { return Number(localStorage.getItem('liedlab-kanban-wip')) || 0 } catch { return 0 } }
const tomtKort = (userId, projectId, tavle, status = 'ide') => ({ user_id: userId, project_id: projectId, tavle_id: tavle?.id || null, tittel: '', skildring: '', status, ansvarleg: '', fase: tavle?.fase || null, frist: null, farge: null, sak_id: null, oppgave_ref: null, framdrift_aktivitet_ref: null, sortering: 0 })

export default function OppgaveModule({ userId, projects, activeOfficeId, activeProjectId, notes }) {
  const [tavler, setTavler] = useState([])
  const [kort, setKort] = useState([])
  const [lastar, setLastar] = useState(false)
  const [feil, setFeil] = useState('')
  const [personell, setPersonell] = useState([])
  const [saker, setSaker] = useState([])
  const [planElement, setPlanElement] = useState([])
  const [valgtTavle, setValgtTavle] = useState(null)
  const [visArkiv, setVisArkiv] = useState(false)
  const [visKilder, setVisKilder] = useState(false)
  const [person, setPerson] = useState('')
  const [sok, setSok] = useState('')
  const [wip, setWip] = useState(lagraWip)
  const [modal, setModal] = useState(null)
  const [meny, setMeny] = useState(false)
  const [nyeIds, setNyeIds] = useState(new Set())
  const [sistFlytta, setSistFlytta] = useState(null)
  const [arkFra, setArkFra] = useState('')
  const [arkTil, setArkTil] = useState('')
  const menyRef = useRef(null)
  const kortRef = useRef([]); kortRef.current = kort
  const tavlerRef = useRef([]); tavlerRef.current = tavler
  const syncer = useRef(false)

  const prosjektNotat = useMemo(() => (notes || []).filter(n => n.projectId === activeProjectId), [notes, activeProjectId])
  const tavle = tavler.find(t => t.id === valgtTavle) || null
  const apne = tavler.filter(t => !t.avslutta)
  const avslutta = tavler.filter(t => t.avslutta)

  const merkNy = (ids) => { setNyeIds(new Set(ids)); setTimeout(() => setNyeIds(new Set()), 700) }
  const lagreEndring = useCallback(async (id, patch) => {
    const { error } = await supabase.from('kanban_kort').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId)
    if (error) setFeil('Lagring feila: ' + error.message)
  }, [userId])

  // DTM-leveransar → kort (nye kort + statusjustering). Køyrer ved opning, fokus og når ei tavle vert oppretta.
  const synkDtm = useCallback(async (tavlerListe, kortListe) => {
    if (!userId || !activeProjectId || syncer.current) return
    const aktive = (tavlerListe || tavlerRef.current).filter(t => !t.avslutta)
    if (!aktive.length) return
    syncer.current = true
    try {
      const { data: dok, error } = await supabase.from('dtm_dokumenter').select(DTM_KOLONNER.join(',')).eq('user_id', userId).eq('project_id', activeProjectId)
      if (error || !dok) return
      let alle = kortListe || kortRef.current
      const endringar = []
      for (const t of aktive) {
        const plan = planDtmSync(t, alle, dok, userId)
        endringar.push(...plan.endre)
        if (plan.opprett.length) {
          const { data } = await supabase.from('kanban_kort').insert(medKortNummer(plan.opprett, alle)).select()
          if (data) { alle = [...alle, ...data]; setKort(prev => [...prev, ...data]); merkNy(data.map(d => d.id)) }
        }
      }
      if (endringar.length) {
        setKort(prev => prev.map(k => { const e = endringar.find(x => x.id === k.id); return e ? { ...k, ...e.patch } : k }))
        for (const e of endringar) await lagreEndring(e.id, e.patch)
      }
    } finally { syncer.current = false }
  }, [userId, activeProjectId, lagreEndring])

  // lasting per prosjekt
  useEffect(() => {
    setTavler([]); setKort([]); setFeil(''); setPersonell([]); setSaker([]); setPlanElement([]); setValgtTavle(null); setVisArkiv(false)
    if (!userId || !activeProjectId) return undefined
    let avbrote = false
    setLastar(true)
    Promise.all([
      supabase.from('kanban_tavler').select('*').eq('user_id', userId).eq('project_id', activeProjectId).order('id'),
      supabase.from('kanban_kort').select('*').eq('user_id', userId).eq('project_id', activeProjectId).order('sortering').order('id'),
      supabase.from('prosjekt_personell').select('id,namn').eq('user_id', userId).eq('project_id', activeProjectId).order('sortering').order('id'),
      supabase.from('cases').select('*').eq('user_id', userId).eq('project_id', activeProjectId).order('id', { ascending: false }),
      supabase.from('framdrift_planar').select('elementer').eq('user_id', userId).eq('project_id', activeProjectId).maybeSingle(),
    ]).then(([t, k, p, s, f]) => {
      if (avbrote) return
      if (t.error) setFeil('Klarte ikkje laste tavler: ' + t.error.message + ' (er supabase-kanban.sql køyrt?)')
      if (k.error) setFeil('Klarte ikkje laste kort: ' + k.error.message)
      const tl = t.data || []
      setTavler(tl); setKort(k.data || []); setPersonell(p.data || []); setSaker(s.data || [])
      setPlanElement(Array.isArray(f.data?.elementer) ? f.data.elementer : [])
      const fyrste = tl.find(x => !x.avslutta); if (fyrste) setValgtTavle(fyrste.id)
      setLastar(false)
      synkDtm(tl, k.data || [])
    })
    return () => { avbrote = true }
  }, [userId, activeProjectId, synkDtm])

  useEffect(() => {
    const fokus = () => { if (document.visibilityState === 'visible') synkDtm() }
    window.addEventListener('focus', fokus); document.addEventListener('visibilitychange', fokus)
    return () => { window.removeEventListener('focus', fokus); document.removeEventListener('visibilitychange', fokus) }
  }, [synkDtm])

  useEffect(() => {
    if (!meny) return undefined
    const lukk = e => { if (menyRef.current && !menyRef.current.contains(e.target)) setMeny(false) }
    document.addEventListener('mousedown', lukk); return () => document.removeEventListener('mousedown', lukk)
  }, [meny])

  const settWip = (v) => { const n = Math.max(0, parseInt(v, 10) || 0); setWip(n); try { localStorage.setItem('liedlab-kanban-wip', String(n)) } catch { /* privat modus */ } }

  // ── tavler ──
  const lagTavle = async (faseKey) => {
    setMeny(false)
    const { data, error } = await supabase.from('kanban_tavler').insert({ user_id: userId, project_id: activeProjectId, fase: faseKey }).select().single()
    if (error) { setFeil('Klarte ikkje opprette tavla: ' + error.message); return }
    const nyeTavler = [...tavlerRef.current, data]
    setTavler(nyeTavler); setValgtTavle(data.id); setVisArkiv(false)
    // standard Kanban-kort for fasen → Komande oppgåver
    const std = (KANBAN_MALAR[faseKey] || []).map((tittel, i) => ({ ...tomtKort(userId, activeProjectId, data, 'komande'), tittel, sortering: i }))
    let alle = kortRef.current
    if (std.length) {
      const { data: kd } = await supabase.from('kanban_kort').insert(medKortNummer(std, alle)).select()
      if (kd) { alle = [...alle, ...kd]; setKort(alle); merkNy(kd.map(k => k.id)) }
    }
    synkDtm(nyeTavler, alle)
  }
  const settAvslutta = async (t, verdi) => {
    setMeny(false)
    await supabase.from('kanban_tavler').update({ avslutta: verdi }).eq('id', t.id).eq('user_id', userId)
    const ny = tavlerRef.current.map(x => x.id === t.id ? { ...x, avslutta: verdi } : x)
    setTavler(ny)
    if (verdi && valgtTavle === t.id) setValgtTavle((ny.find(x => !x.avslutta) || {}).id || null)
    if (!verdi) { setValgtTavle(t.id); synkDtm(ny) }
  }

  // ── kort ──
  const flytt = useCallback((id, tilStatus, indeks) => {
    const alle = kortRef.current
    const k = alle.find(x => x.id === id); if (!k) return
    const endringar = planFlytting(alle.filter(x => x.tavle_id === k.tavle_id), id, tilStatus, indeks)
    if (!endringar.length) return
    setKort(prev => prev.map(x => { const e = endringar.find(y => y.id === x.id); return e ? { ...x, ...e.patch } : x }))
    setSistFlytta(id); setTimeout(() => setSistFlytta(null), 600)
    endringar.forEach(e => lagreEndring(e.id, e.patch))
  }, [lagreEndring])

  const opprettMange = async (liste) => {
    const { data, error } = await supabase.from('kanban_kort').insert(medKortNummer(liste, kortRef.current)).select()
    if (error) { setFeil('Klarte ikkje opprette: ' + error.message); return [] }
    setKort(prev => [...prev, ...(data || [])]); merkNy((data || []).map(d => d.id))
    return data || []
  }
  const sorteringSist = (status, tavleId) => kortIKolonne(kortRef.current.filter(k => k.tavle_id === tavleId), status).length
  const nyttKortI = (status) => setModal(tomtKort(userId, activeProjectId, tavle, status))

  // kort frå «Kjelder» (oppgåve / sak) sleppt i ei kolonne
  const frakilde = async (status, kilde, idx) => {
    if (!tavle) return
    const grunn = { ...tomtKort(userId, activeProjectId, tavle, status), tittel: kilde.tittel || '', ansvarleg: kilde.ansvarleg || '', frist: kilde.frist || null, sortering: sorteringSist(status, tavle.id) }
    if (kilde.type === 'oppgave') grunn.oppgave_ref = { note_id: kilde.note_id, task_id: kilde.task_id }
    if (kilde.type === 'sak') grunn.sak_id = kilde.sak_id
    const ny = await opprettMange([grunn])
    if (ny[0] && idx != null) flytt(ny[0].id, status, idx)
  }

  const lagreModal = async (d) => {
    if (d.id) {
      const { id, user_id, created_at, ...resten } = d
      const patch = { ...resten }
      const gammal = kortRef.current.find(k => k.id === id)
      if (gammal && gammal.status !== d.status) patch.ferdig_dato = d.status === 'ferdig' ? new Date().toISOString() : null
      if (gammal && gammal.tavle_id !== d.tavle_id) {
        const mal = tavler.find(t => t.id === d.tavle_id)
        patch.fase = mal?.fase || null; patch.sortering = sorteringSist(d.status, d.tavle_id)
      }
      setKort(prev => prev.map(k => k.id === id ? { ...k, ...patch } : k))
      await lagreEndring(id, patch)
    } else {
      await opprettMange([{ ...d, sortering: sorteringSist(d.status, d.tavle_id), ferdig_dato: d.status === 'ferdig' ? new Date().toISOString() : null }])
    }
    setModal(null)
  }
  const slett = async (id) => {
    const k = kortRef.current.find(x => x.id === id); setModal(null)
    if (k?.dtm_ref) {                      // DTM-kort: skjul (så synkroniseringa ikkje lagar det på nytt)
      const patch = { dtm_ref: { ...k.dtm_ref, skjult: true } }
      setKort(prev => prev.map(x => x.id === id ? { ...x, ...patch } : x)); await lagreEndring(id, patch); return
    }
    setKort(prev => prev.filter(x => x.id !== id))
    const { error } = await supabase.from('kanban_kort').delete().eq('id', id).eq('user_id', userId)
    if (error) setFeil('Sletting feila: ' + error.message)
  }

  const tavleKort = useMemo(() => kort.filter(k => k.tavle_id === valgtTavle && !(k.dtm_ref && k.dtm_ref.skjult)), [kort, valgtTavle])
  const personNamn = useMemo(() => [...new Set([...personell.map(p => p.namn), ...tavleKort.map(k => k.ansvarleg).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'nb')), [personell, tavleKort])
  const aktive = useMemo(() => filtrer(tavleKort.filter(k => k.status !== 'ferdig'), { person, sok }), [tavleKort, person, sok])
  const arkivListe = useMemo(() => filtrer(tavleKort.filter(k => k.status === 'ferdig'), { person, sok })
    .filter(k => (!arkFra || (k.ferdig_dato || '').slice(0, 10) >= arkFra) && (!arkTil || (k.ferdig_dato || '').slice(0, 10) <= arkTil))
    .sort((a, b) => String(b.ferdig_dato || '').localeCompare(String(a.ferdig_dato || ''))), [tavleKort, person, sok, arkFra, arkTil])
  const ferdigAntal = tavleKort.filter(k => k.status === 'ferdig').length
  const mangler = TAVLE_FASAR.filter(f => !tavler.some(t => t.fase === f.key))

  const TAB = (aktiv) => ({ padding: '6px 14px', border: '1.5px solid ' + (aktiv ? '#0A0A0A' : 'transparent'), borderRadius: 8, background: aktiv ? '#0A0A0A' : 'rgba(255,255,255,.5)', color: aktiv ? '#fff' : 'var(--text2)', fontSize: 13, fontWeight: aktiv ? 700 : 500, cursor: 'pointer', fontFamily: 'var(--font)' })

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
        <button onClick={() => tavle ? nyttKortI('ide') : setMeny(true)} disabled={!tavle && !mangler.length} title={tavle ? 'Nytt kort' : 'Opprett ei tavle for ei fase fyrst'}
          style={{ padding: '7px 16px', border: 'none', borderRadius: 8, background: 'var(--brand)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)', whiteSpace: 'nowrap' }}>+ Nytt kort</button>
        <div style={{ width: 6 }}/>
        {apne.map(t => <button key={t.id} onClick={() => { setValgtTavle(t.id); setVisArkiv(false) }} style={TAB(valgtTavle === t.id)}>{faseNamn(t.fase)}</button>)}
        <div ref={menyRef} style={{ position: 'relative' }}>
          <button onClick={() => setMeny(v => !v)} title="Fasar og tavler" style={{ ...SEL, padding: '5px 10px', cursor: 'pointer', fontWeight: 700, color: 'var(--text3)', background: 'transparent', border: '1.5px solid transparent' }}>⋯</button>
          {meny && (
            <div style={{ position: 'absolute', left: 0, top: 'calc(100% + 6px)', zIndex: 60, minWidth: 250, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-lg)', padding: 6 }}>
              {mangler.map(f => <MenyValg key={f.key} onClick={() => lagTavle(f.key)}>＋ Ny tavle: {f.namn}</MenyValg>)}
              {tavle && <MenyValg onClick={() => settAvslutta(tavle, true)}>✓ Avslutt fasen «{faseNamn(tavle.fase)}»</MenyValg>}
              {avslutta.map(t => <MenyValg key={t.id} onClick={() => settAvslutta(t, false)}>↺ Opne att: {faseNamn(t.fase)} (avslutta)</MenyValg>)}
              {!mangler.length && !tavle && !avslutta.length && <div style={{ padding: 8, fontSize: 12, color: 'var(--text3)' }}>Ingen val.</div>}
            </div>
          )}
        </div>
        {tavle && <>
          <div style={{ width: 6 }}/>
          <button onClick={() => setVisArkiv(false)} style={TAB(!visArkiv)}>Tavle</button>
          <button onClick={() => setVisArkiv(true)} style={TAB(visArkiv)}>Arkiv{ferdigAntal ? ` (${ferdigAntal})` : ''}</button>
        </>}
        <div style={{ width: 6 }}/>
        <select value={person} onChange={e => setPerson(e.target.value)} style={SEL} title="Filtrer på ansvarleg">
          <option value="">Alle personar</option><option value="__ingen__">Utan ansvarleg</option>{personNamn.map(n => <option key={n} value={n}>{n}</option>)}</select>
        <input value={sok} onChange={e => setSok(e.target.value)} placeholder="Søk i kort…" style={{ ...SEL, width: 150 }}/>
        <div style={{ flex: 1 }}/>
        {tavle && !visArkiv && (
          <label title="Maks tal kort per person i Under arbeid og dei to godkjenning-kolonnane. 0 = av. Berre ei visuell åtvaring." style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
            WIP-grense
            <input type="number" min="0" value={wip} onChange={e => settWip(e.target.value)} style={{ ...SEL, width: 56, padding: '5px 6px' }}/>
          </label>
        )}
        {tavle && !visArkiv && <button onClick={() => setVisKilder(v => !v)} style={{ ...SEL, cursor: 'pointer', fontWeight: 600, background: visKilder ? '#fff' : SEL.background }}>Kjelder {visKilder ? '▸' : '◂'}</button>}
      </div>

      {feil && <div style={{ margin: '10px 20px 0', padding: '8px 12px', background: 'rgba(185,28,28,.08)', border: '1.5px solid var(--danger)', borderRadius: 8, fontSize: 13, color: 'var(--danger)' }}>{feil}</div>}

      {lastar ? (
        <div style={{ padding: 30, color: 'var(--text3)', fontSize: 13 }}>Lastar…</div>
      ) : !tavle ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, padding: 30, textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Start ei tavle for fasen prosjektet er i</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', maxWidth: 460, lineHeight: 1.6 }}>Tavla får standardkort for fasen, og leveransane for same fase i DTM-leveranselista kjem inn som komande oppgåver og følgjer kontroll og utsending automatisk.</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            {mangler.map(f => <button key={f.key} onClick={() => lagTavle(f.key)} style={{ padding: '9px 18px', border: 'none', borderRadius: 9, background: '#0A0A0A', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'var(--font)' }}>{f.namn}</button>)}
          </div>
          {avslutta.length > 0 && <div style={{ fontSize: 12, color: 'var(--text3)' }}>Avslutta fasar finst under «⋯».</div>}
        </div>
      ) : !visArkiv ? (
        <div style={{ flex: 1, display: 'flex', minHeight: 0, minWidth: 0 }}>
          <KanbanTavle kort={aktive} wipGrense={wip} notes={prosjektNotat} planElement={planElement}
            nyeIds={nyeIds} sistFlytta={sistFlytta} onApne={setModal} onFlytt={flytt} onNyttKort={nyttKortI} onKilde={frakilde}/>
          {visKilder && <KanbanKilder notes={prosjektNotat} saker={saker} kort={kort} onLukk={() => setVisKilder(false)}/>}
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, fontSize: 12, color: 'var(--text3)' }}>
            Ferdigstilt frå <DatePicker value={arkFra} onChange={setArkFra} style={{ ...SEL, width: '100%' }} wrapStyle={{ display: 'inline-block', width: 150 }}/> til <DatePicker value={arkTil} onChange={setArkTil} style={{ ...SEL, width: '100%' }} wrapStyle={{ display: 'inline-block', width: 150 }}/>
            <span>{arkivListe.length} kort</span>
          </div>
          {arkivListe.length === 0 ? <div style={{ color: 'var(--text3)', fontSize: 13, padding: 20 }}>Ingen ferdigstilte kort{ferdigAntal ? ' i dette utvalet' : ' enno'}.</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr>{['Tittel', 'Ansvarleg', 'Ferdigstilt', ''].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text3)', borderBottom: '2px solid var(--border)' }}>{h}</th>)}</tr></thead>
              <tbody>{arkivListe.map(k => (
                <tr key={k.id} onClick={() => setModal(k)} style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '9px 10px', fontWeight: 600, color: 'var(--text)' }}>{k.tittel}</td>
                  <td style={{ padding: '9px 10px', color: 'var(--text2)' }}>{k.ansvarleg || '—'}</td>
                  <td style={{ padding: '9px 10px', color: 'var(--text2)' }}>{fmtDato(k.ferdig_dato)}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                    <button onClick={e => { e.stopPropagation(); flytt(k.id, 'komande', null) }} style={{ ...SEL, padding: '3px 10px', cursor: 'pointer' }}>Gjenopne</button>
                  </td>
                </tr>))}</tbody>
            </table>
          )}
        </div>
      )}

      {modal && <KanbanKortModal key={modal.id || 'ny'} kort={modal} saker={saker} notes={prosjektNotat} planElement={planElement} personell={personell} tavler={tavler}
        onLagre={lagreModal} onSlett={slett} onLukk={() => setModal(null)}/>}
    </div>
  )
}

function MenyValg({ onClick, children }) {
  return (
    <button onClick={onClick} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', borderRadius: 6, background: 'transparent', color: 'var(--text)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>{children}</button>
  )
}
