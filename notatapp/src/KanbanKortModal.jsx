import { useState } from 'react'
import DatePicker from './DatePicker'
import FlyttbartModal, { FELT, ETT } from './FlyttbartModal'
import PersonVelger from './PersonVelger'
import BekreftDialog from './BekreftDialog'
import { ALLE_STATUSAR, KORT_FARGAR, aktivitetNamn, faseNamn } from './kanbanLogikk'

// ═══════════════════════════════════════════════════════════════════
//  KanbanKortModal — flytande vindauge (kan flyttast og skaleres) for å sjå/redigere eit kort; mørk blå toppline med X.
//  Spør ved ulagra endringar. Lenkjer til sak / oppgåve / Framdrift-aktivitet er valfrie og berre referansar — dei styrer aldri noko.
// ═══════════════════════════════════════════════════════════════════
export default function KanbanKortModal({ kort, saker, notes, planElement, personell, tavler, onLagre, onSlett, onLukk }) {
  const [d, setD] = useState({ ...kort })
  const sett = (k, v) => setD(p => ({ ...p, [k]: v }))
  const skitten = JSON.stringify(d) !== JSON.stringify(kort)
  const [bekreft, setBekreft] = useState(null) // { tittel, tekst, jaTekst, fare, onJa }
  const [kopleMeny, setKopleMeny] = useState(false)
  const [kopleType, setKopleType] = useState(null) // 'sak' | 'oppgave' | 'aktivitet' — valt under «Kople til»
  const lukk = () => { if (skitten) { setBekreft({ tittel: 'Ulagra endringar', tekst: 'Du har ulagra endringar i kortet. Forkaste dei?', jaTekst: 'Forkast', fare: true, onJa: onLukk }); return } onLukk() }

  const oppgaver = []
  for (const n of (notes || [])) for (const t of (n.tasks || [])) {
    if (!t.done || (d.oppgave_ref && String(d.oppgave_ref.task_id) === String(t.id))) oppgaver.push({ v: `${n.id}|${t.id}`, tekst: `${n.title || 'Notat'} — ${t.text}` })
  }
  const aktivitetar = (planElement || []).filter(e => e.type === 'aktivitet')
  const kanLagre = d.tittel.trim() && (skitten || !kort.id)

  return (
    <FlyttbartModal tittel={kort.id ? 'Kort' : 'Nytt kort'} onLukk={lukk} lagringsNokkel="liedlab-kanbankort-vindauge" breidd={600} hogd={700} minW={440} minH={380}
      bunn={<>
        {kort.id && <button onClick={() => setBekreft({ tittel: kort.dtm_ref ? 'Fjern frå tavla' : 'Slett kort', tekst: kort.dtm_ref ? 'Fjerne kortet frå tavla? Leveransen i DTM vert ikkje endra.' : <>Slette kortet «{kort.tittel}»? Dette kan ikkje angrast.</>, jaTekst: kort.dtm_ref ? 'Fjern' : 'Slett', fare: true, onJa: () => onSlett(kort.id) })} style={{ padding: '7px 14px', border: '1.5px solid var(--danger, #c0392b)', borderRadius: 7, background: 'transparent', color: 'var(--danger, #c0392b)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>{kort.dtm_ref ? 'Fjern frå tavla' : 'Slett'}</button>}
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
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 8 }}>Kopling (valfritt) — berre ein referanse, endrar ingenting i Saksbehandling eller Framdrift.</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {d.sak_id && <Chip tekst={'Sak: ' + ((saker || []).find(x => x.id === d.sak_id)?.title || d.sak_id)} onFjern={() => sett('sak_id', null)}/>}
            {d.oppgave_ref && <Chip tekst={'Oppgåve: ' + (oppgaver.find(o => o.v === d.oppgave_ref.note_id + '|' + d.oppgave_ref.task_id)?.tekst || 'valt')} onFjern={() => sett('oppgave_ref', null)}/>}
            {d.framdrift_aktivitet_ref && <Chip tekst={'Aktivitet: ' + (aktivitetar.find(a => a.id === d.framdrift_aktivitet_ref.element_id) ? aktivitetNamn(aktivitetar.find(a => a.id === d.framdrift_aktivitet_ref.element_id)) : 'valt')} onFjern={() => sett('framdrift_aktivitet_ref', null)}/>}
          </div>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button type="button" onClick={() => setKopleMeny(v => !v)} style={{ padding: '7px 14px', border: '1.5px solid var(--brand2)', borderRadius: 7, background: 'var(--brandbg)', color: 'var(--brand)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'var(--font)' }}>Kople til ▾</button>
            {kopleMeny && (<>
              <div onClick={() => setKopleMeny(false)} style={{ position: 'fixed', inset: 0, zIndex: 90 }}/>
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 100, minWidth: 190, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-lg)', padding: 4 }}>
                {[['sak', 'Sak'], ['oppgave', 'Oppgåve'], ['aktivitet', 'Framdrift-aktivitet']].map(([k, t]) => (
                  <button key={k} type="button" onClick={() => { setKopleType(k); setKopleMeny(false) }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '7px 11px', borderRadius: 6, fontSize: 13, color: 'var(--text)', cursor: 'pointer', fontFamily: 'var(--font)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--brandbg)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>{t}</button>
                ))}
              </div>
            </>)}
          </div>
          {kopleType === 'sak' && (
            <label style={{ display: 'block', marginTop: 10 }}><span style={ETT}>Sak</span>
              <select autoFocus value={d.sak_id || ''} onChange={e => { sett('sak_id', e.target.value ? Number(e.target.value) : null); setKopleType(null) }} style={FELT}>
                <option value="">— Vel sak —</option>{(saker || []).map(s => <option key={s.id} value={s.id}>{s.number ? String(s.number).replace(/^.*?(\d+)\s*$/, '$1') + ' ' : ''}{s.title}</option>)}</select></label>)}
          {kopleType === 'oppgave' && (
            <label style={{ display: 'block', marginTop: 10 }}><span style={ETT}>Oppgåve</span>
              <select autoFocus value="" onChange={e => { const v = e.target.value; if (v) { const [n, t] = v.split('|'); sett('oppgave_ref', { note_id: Number(n), task_id: isNaN(Number(t)) ? t : Number(t) }) } setKopleType(null) }} style={FELT}>
                <option value="">— Vel oppgåve —</option>{oppgaver.map(o => <option key={o.v} value={o.v}>{o.tekst}</option>)}</select></label>)}
          {kopleType === 'aktivitet' && (
            <label style={{ display: 'block', marginTop: 10 }}><span style={ETT}>Framdrift-aktivitet</span>
              <select autoFocus value="" onChange={e => { if (e.target.value) sett('framdrift_aktivitet_ref', { element_id: e.target.value }); setKopleType(null) }} style={FELT}>
                <option value="">— Vel aktivitet —</option>{aktivitetar.map(a => <option key={a.id} value={a.id}>{aktivitetNamn(a)}</option>)}</select></label>)}
        </div>
      </div>
      {bekreft && <BekreftDialog {...bekreft} onJa={() => { const f = bekreft.onJa; setBekreft(null); f() }} onNei={() => setBekreft(null)}/>}
    </FlyttbartModal>
  )
}

function Chip({ tekst, onFjern }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 20, fontSize: 12.5, fontWeight: 600 }}>{tekst}<span onClick={onFjern} style={{ cursor: 'pointer', color: 'var(--text3)', fontSize: 15, lineHeight: 1 }}>×</span></span>
}
