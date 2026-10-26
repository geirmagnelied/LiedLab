import { useState, useRef } from 'react'
import DatePicker from './DatePicker'
import FlyttbartModal, { FELT, ETT } from './FlyttbartModal'
import PersonVelger from './PersonVelger'
import OppgaveInnfoering, { OppgaveRad } from './OppgaveInnfoering'

// ═══════════════════════════════════════════════════════════════════
//  OppgaveVindauge — flytande vindauge for oppgåver i Saksbehandling.
//    ny:   same inndata som «Ny oppgåve» i Notatar (OppgaveInnfoering), fleire oppgåver kan leggjast til før lagring; valfri sak-kopling.
//    edit: endre ei eksisterande oppgåve (same fem felt + ferdig).
//  Oppgåver er vanlege notat-oppgåver (notes.tasks) — ikkje Kanban-kort.
// ═══════════════════════════════════════════════════════════════════
export default function OppgaveVindauge({ modus, oppgave, saker = [], personar = [], meg = '', sakNr = '', onLagreNye, onLagreEndring, onSlett, onLukk }) {
  const [liste, setListe] = useState([])
  const [sakId, setSakId] = useState('')
  const [tekstUnderVeg, setTekstUnderVeg] = useState('')
  const [d, setD] = useState(() => oppgave ? { text: oppgave.text || '', date: oppgave.date || '', ansvarleg: oppgave.ansvarleg || '', hours: oppgave.hours ?? '', startDate: oppgave.startDate || '', done: !!oppgave.done } : null)
  const inRef = useRef(null)
  const sett = (k, v) => setD(p => ({ ...p, [k]: v }))
  const skitten = modus === 'ny' ? (liste.length > 0 || tekstUnderVeg.trim() !== '') : JSON.stringify(d) !== JSON.stringify({ text: oppgave.text || '', date: oppgave.date || '', ansvarleg: oppgave.ansvarleg || '', hours: oppgave.hours ?? '', startDate: oppgave.startDate || '', done: !!oppgave.done })
  const lukk = () => { if (skitten && !window.confirm('Forkaste ulagra endringar?')) return; onLukk() }

  const lagreNye = async () => {
    const vent = inRef.current?.hentVentande?.()
    const alle = vent ? [...liste, vent] : liste
    if (!alle.length) return
    await onLagreNye(alle, sakId ? Number(sakId) : null)
  }
  const lagreEndring = () => {
    if (!d.text.trim()) return
    const hours = d.hours === '' || d.hours == null ? undefined : parseFloat(d.hours)
    onLagreEndring({ text: d.text.trim(), date: d.date || null, ansvarleg: d.ansvarleg, hours, startDate: d.startDate || null, done: d.done })
  }
  const SMA = { padding: '7px 16px', borderRadius: 7, fontSize: 12.5, fontFamily: 'var(--font)', cursor: 'pointer' }

  return (
    <FlyttbartModal tittel={modus === 'ny' ? 'Ny oppgåve' : `Oppgåve${oppgave?.nr ? ' ' + oppgave.nr : ''}`} onLukk={lukk} lagringsNokkel="liedlab-oppgave-vindauge" breidd={900} hogd={modus === 'ny' ? 520 : 480} minW={560} minH={340}
      bunn={modus === 'ny' ? <>
        <button onClick={lagreNye} disabled={!skitten} style={{ ...SMA, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 700, opacity: skitten ? 1 : .55 }}>{`Lagre ${liste.length + (tekstUnderVeg.trim() ? 1 : 0) || ''} ${liste.length + (tekstUnderVeg.trim() ? 1 : 0) === 1 ? 'oppgåve' : 'oppgåver'}`}</button>
        <button onClick={lukk} style={{ ...SMA, border: '1.5px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)', fontWeight: 600 }}>Lukk</button>
      </> : <>
        <button onClick={lagreEndring} disabled={!skitten || !d.text.trim()} style={{ ...SMA, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 700, opacity: (skitten && d.text.trim()) ? 1 : .55 }}>Lagre</button>
        <button onClick={lukk} style={{ ...SMA, border: '1.5px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)', fontWeight: 600 }}>Lukk</button>
        <div style={{ flex: 1 }}/>
        <button onClick={() => { if (window.confirm('Slette oppgåva?')) onSlett() }} style={{ ...SMA, border: '1.5px solid var(--danger, #c0392b)', background: 'transparent', color: 'var(--danger, #c0392b)', fontWeight: 600 }}>Slett</button>
      </>}>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {modus === 'ny' ? (<>
          {saker.length > 0 && <label style={{ maxWidth: 420 }}><span style={ETT}>Høyrer til sak (valfritt)</span>
            <select value={sakId} onChange={e => setSakId(e.target.value)} style={FELT}>
              <option value="">— Frittståande oppgåve —</option>{saker.map(s => <option key={s.id} value={s.id}>{s.nr} {s.title}</option>)}</select></label>}
          {liste.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{liste.map((o, i) => <OppgaveRad key={o.id} o={o} onFjern={() => setListe(l => l.filter((_, j) => j !== i))}/>)}</div>}
          <OppgaveInnfoering ref={inRef} autoFocus personar={personar} standardAnsvarleg={meg} onTekst={setTekstUnderVeg} onLeggTil={t => setListe(l => [...l, t])}/>
        </>) : (<>
          {sakNr && <div style={{ fontSize: 12, color: 'var(--text3)' }}>Høyrer til sak {sakNr}</div>}
          <label><span style={ETT}>Kva skal gjerast?</span><textarea autoFocus rows={2} value={d.text} onChange={e => sett('text', e.target.value)} style={{ ...FELT, resize: 'vertical', fontWeight: 600 }}/></label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <label><span style={ETT}>Frist</span><DatePicker value={d.date} onChange={v => sett('date', v)} style={FELT}/></label>
            <label><span style={ETT}>Ansvarleg</span><PersonVelger value={d.ansvarleg} onChange={v => sett('ansvarleg', v)} personar={personar}/></label>
            <label><span style={ETT}>Estimat (timar)</span><input type="number" min="0" step="0.5" value={d.hours} onChange={e => sett('hours', e.target.value)} style={FELT}/></label>
            <label><span style={ETT}>Startar seinast</span><DatePicker value={d.startDate} onChange={v => sett('startDate', v)} style={FELT}/></label>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}><input type="checkbox" checked={d.done} onChange={e => sett('done', e.target.checked)}/>Ferdig (oppgåva er lukka)</label>
        </>)}
      </div>
    </FlyttbartModal>
  )
}
