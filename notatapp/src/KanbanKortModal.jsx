import { useState } from 'react'
import DatePicker from './DatePicker'
import FlyttbartModal, { FELT, ETT } from './FlyttbartModal'
import PersonVelger from './PersonVelger'
import { ALLE_STATUSAR, KORT_FARGAR, aktivitetNamn, faseNamn } from './kanbanLogikk'

// ═══════════════════════════════════════════════════════════════════
//  KanbanKortModal — flytande vindauge (kan flyttast og skaleres) for å sjå/redigere eit kort; mørk blå toppline med X.
//  Spør ved ulagra endringar. Lenkjer til sak / oppgåve / Framdrift-aktivitet er valfrie og berre referansar — dei styrer aldri noko.
// ═══════════════════════════════════════════════════════════════════
export default function KanbanKortModal({ kort, saker, notes, planElement, personell, tavler, onLagre, onSlett, onLukk }) {
  const [d, setD] = useState({ ...kort })
  const sett = (k, v) => setD(p => ({ ...p, [k]: v }))
  const skitten = JSON.stringify(d) !== JSON.stringify(kort)
  const lukk = () => { if (skitten && !window.confirm('Forkaste ulagra endringar?')) return; onLukk() }

  const oppgaver = []
  for (const n of (notes || [])) for (const t of (n.tasks || [])) {
    if (!t.done || (d.oppgave_ref && String(d.oppgave_ref.task_id) === String(t.id))) oppgaver.push({ v: `${n.id}|${t.id}`, tekst: `${n.title || 'Notat'} — ${t.text}` })
  }
  const aktivitetar = (planElement || []).filter(e => e.type === 'aktivitet')
  const kanLagre = d.tittel.trim() && (skitten || !kort.id)

  return (
    <FlyttbartModal tittel={kort.id ? `Kort${kort.nummer ? ' · O-' + kort.nummer : ''}` : 'Nytt kort'} onLukk={lukk} lagringsNokkel="liedlab-kanbankort-vindauge" breidd={600} hogd={700} minW={440} minH={380}
      bunn={<>
        {kort.id && <button onClick={() => { if (window.confirm(kort.dtm_ref ? 'Fjerne kortet frå tavla? Leveransen i DTM vert ikkje endra.' : 'Slette kortet?')) onSlett(kort.id) }} style={{ padding: '7px 14px', border: '1.5px solid var(--danger, #c0392b)', borderRadius: 7, background: 'transparent', color: 'var(--danger, #c0392b)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>{kort.dtm_ref ? 'Fjern frå tavla' : 'Slett'}</button>}
        {kort.id && (tavler || []).length > 1 && (
          <select value={d.tavle_id || ''} onChange={e => sett('tavle_id', Number(e.target.value))} title="Flytt kortet til tavla for ei anna fase"
            style={{ padding: '5px 6px', border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', color: 'var(--text3)', fontSize: 11, fontFamily: 'var(--font)', cursor: 'pointer', opacity: .75 }}>
            {tavler.map(t => <option key={t.id} value={t.id}>Fase: {faseNamn(t.fase)}</option>)}
          </select>
        )}
        <div style={{ flex: 1 }}/>
        <button onClick={lukk} style={{ padding: '7px 14px', border: '1.5px solid var(--border)', borderRadius: 7, background: 'var(--bg2)', color: 'var(--text2)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>Avbryt</button>
        <button disabled={!kanLagre} onClick={() => onLagre(d)}
          style={{ padding: '7px 18px', border: 'none', borderRadius: 7, background: 'var(--brand)', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', opacity: kanLagre ? 1 : .5 }}>Lagre</button>
      </>}>
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 13 }}>
        {kort.dtm_ref && <div style={{ fontSize: 12, color: 'var(--text2)', background: 'var(--brandbg)', borderRadius: 8, padding: '8px 11px', lineHeight: 1.45 }}>Leveranse frå DTM — tittel, frist og status følgjer leveranselista automatisk (kontroll/utsending). Du kan likevel flytte kortet sjølv; neste DTM-endring set det tilbake.</div>}
        <label><span style={ETT}>Tittel</span><input autoFocus value={d.tittel} onChange={e => sett('tittel', e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && kanLagre) onLagre(d) }} style={{ ...FELT, fontWeight: 600 }}/></label>
        <label><span style={ETT}>Skildring</span><textarea value={d.skildring || ''} onChange={e => sett('skildring', e.target.value)} rows={3} style={{ ...FELT, resize: 'vertical' }}/></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label><span style={ETT}>Status</span>
            <select value={d.status} onChange={e => sett('status', e.target.value)} style={FELT}>{ALLE_STATUSAR.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
          <label><span style={ETT}>Ansvarleg</span>
            <PersonVelger value={d.ansvarleg || ''} onChange={v => sett('ansvarleg', v)} personar={(personell || []).map(p => p.namn)}/></label>
          <label><span style={ETT}>Frist</span><DatePicker value={d.frist || ''} onChange={v => sett('frist', v || null)} style={FELT}/></label>
        </div>
        <div>
          <span style={ETT}>Merkefarge</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => sett('farge', null)} title="Ingen" style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid ' + (!d.farge ? 'var(--text)' : 'var(--border)'), background: 'var(--bg)', cursor: 'pointer', fontSize: 11, color: 'var(--text3)' }}>∅</button>
            {KORT_FARGAR.map(c => <button key={c} onClick={() => sett('farge', c)} style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid ' + (d.farge === c ? 'var(--text)' : 'transparent'), background: c, cursor: 'pointer' }}/>)}
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 8 }}>Lenkjer (valfritt) — berre referansar, dei endrar ingenting i Saker, Oppgåver eller Framdrift.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label><span style={ETT}>Sak</span>
              <select value={d.sak_id || ''} onChange={e => sett('sak_id', e.target.value ? Number(e.target.value) : null)} style={FELT}>
                <option value="">— Ingen —</option>{(saker || []).map(s => <option key={s.id} value={s.id}>{s.number ? 'S-' + String(s.number).replace(/^.*?(\d+)\s*$/, '$1') + ' ' : ''}{s.title}</option>)}</select></label>
            <label><span style={ETT}>Oppgåve i notat</span>
              <select value={d.oppgave_ref ? `${d.oppgave_ref.note_id}|${d.oppgave_ref.task_id}` : ''}
                onChange={e => { const v = e.target.value; if (!v) sett('oppgave_ref', null); else { const [n, t] = v.split('|'); sett('oppgave_ref', { note_id: Number(n), task_id: isNaN(Number(t)) ? t : Number(t) }) } }} style={FELT}>
                <option value="">— Ingen —</option>{oppgaver.map(o => <option key={o.v} value={o.v}>{o.tekst}</option>)}</select></label>
            <label><span style={ETT}>Framdrift-aktivitet</span>
              <select value={d.framdrift_aktivitet_ref?.element_id || ''} onChange={e => sett('framdrift_aktivitet_ref', e.target.value ? { element_id: e.target.value } : null)} style={FELT}>
                <option value="">— Ingen —</option>{aktivitetar.map(a => <option key={a.id} value={a.id}>{aktivitetNamn(a)}</option>)}</select></label>
          </div>
        </div>
      </div>
    </FlyttbartModal>
  )
}
