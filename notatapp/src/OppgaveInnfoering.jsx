import { useState, forwardRef, useImperativeHandle } from 'react'
import DatePicker from './DatePicker'
import PersonVelger from './PersonVelger'
import { FELT } from './FlyttbartModal'
import { nextFriday } from './dateUtils'

// ═══════════════════════════════════════════════════════════════════
//  OppgaveInnfoering — felles inndata for ei oppgåve, brukt på ALLE flater (Ny oppgåve, notat, Ny sak, sak-vindauget, Gjeremål):
//    1. Kva skal gjerast?  2. Frist  3. Ansvarleg  4. Estimert tidsforbruk (timar)  5. Startdato
//  Berre punkt 1 er påkravd. Enter utan resten gjev frist = fredag denne veka (neste fredag om fredag er passert) og ansvarleg = den som skreiv
//  oppgåva (`standardAnsvarleg`). Estimat og start står blanke. `lagOppgave` er den same konstruksjonen brukt av alle som lagar oppgåveobjekt.
// ═══════════════════════════════════════════════════════════════════
export function lagOppgave({ tekst, frist, ansvarleg, timar, start }, standardAnsvarleg = '', idOffset = 0) {
  const t = { id: Date.now() + idOffset, text: String(tekst || '').trim(), done: false,
    date: frist || nextFriday(), ansvarleg: ansvarleg || standardAnsvarleg || '' }
  if (start) t.startDate = start
  if (timar !== '' && timar != null && !isNaN(parseFloat(timar))) t.hours = parseFloat(timar)
  return t
}

const ETIKETT = { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3, display: 'block' }

const OppgaveInnfoering = forwardRef(function OppgaveInnfoering({ personar = [], standardAnsvarleg = '', onLeggTil, onTekst, autoFocus = false, plassholder = 'Kva skal gjerast? (Enter for å legge til)', hjelp = true, knapp = false }, ref) {
  const tom = { tekst: '', frist: '', ansvarleg: '', timar: '', start: '' }
  const [f, setF] = useState(tom)
  const sett = (k, v) => { setF(p => ({ ...p, [k]: v })); if (k === 'tekst') onTekst?.(v) }
  const legg = () => {
    if (!f.tekst.trim()) return
    onLeggTil(lagOppgave(f, standardAnsvarleg)); setF(tom); onTekst?.('')
  }
  // Ei halvferdig oppgåve (tekst skriven, Enter ikkje trykt) kan hentast ut når skjemaet lagrast
  useImperativeHandle(ref, () => ({
    hentVentande: () => { if (!f.tekst.trim()) return null; const t = lagOppgave(f, standardAnsvarleg); setF(tom); onTekst?.(''); return t },
  }))
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ flex: '3 1 260px', minWidth: 200 }}><span style={ETIKETT}>Kva skal gjerast?</span>
          <textarea value={f.tekst} autoFocus={autoFocus} rows={f.tekst.includes('\n') ? Math.min(5, f.tekst.split('\n').length + 1) : 1}
            onChange={e => sett('tekst', e.target.value)} placeholder={plassholder}
            onKeyDown={e => {
              if (e.key === 'Enter' && e.altKey) { e.preventDefault(); const ta = e.currentTarget, s = ta.selectionStart; sett('tekst', ta.value.slice(0, s) + '\n' + ta.value.slice(ta.selectionEnd)); setTimeout(() => { ta.selectionStart = ta.selectionEnd = s + 1 }, 0) }
              else if (e.key === 'Enter') { e.preventDefault(); legg() }
            }}
            style={{ ...FELT, resize: 'none', lineHeight: 1.5, minHeight: 38, fontWeight: 600, border: '2px solid var(--brand3, var(--brand2))' }}/></label>
        <label style={{ flex: '1 1 140px', minWidth: 130 }}><span style={ETIKETT}>Frist</span>
          <DatePicker value={f.frist} onChange={v => sett('frist', v)} tittel={`Frist (standard: fredag = ${nextFriday()})`} style={FELT}/></label>
        <label style={{ flex: '1 1 150px', minWidth: 130 }}><span style={ETIKETT}>Ansvarleg</span>
          <PersonVelger value={f.ansvarleg} onChange={v => sett('ansvarleg', v)} personar={personar} tom={standardAnsvarleg ? 'Meg (standard)' : '— Ingen —'}/></label>
        <label style={{ flex: '0 0 78px' }}><span style={ETIKETT}>Estimat (t)</span>
          <input type="number" min="0" step="0.5" value={f.timar} onChange={e => sett('timar', e.target.value)} placeholder="t" title="Estimert tidsforbruk i timar"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); legg() } }} style={{ ...FELT, textAlign: 'center' }}/></label>
        <label style={{ flex: '1 1 140px', minWidth: 130 }}><span style={ETIKETT}>Startar seinast</span>
          <DatePicker value={f.start} onChange={v => sett('start', v)} tittel="Når må oppgåva starte" style={FELT}/></label>
        {knapp && <button type="button" onClick={legg} disabled={!f.tekst.trim()} style={{ padding: '8px 14px', borderRadius: 7, border: '1.5px solid var(--brand2)', background: 'var(--brandbg)', color: 'var(--brand)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'var(--font)', opacity: f.tekst.trim() ? 1 : .5 }}>Legg til</button>}
      </div>
      {hjelp && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>Berre «Kva skal gjerast?» må fyllast ut · Enter legg til · Utan frist → fredag denne veka · Utan ansvarleg → deg · Alt+Enter for ny linje</div>}
    </div>
  )
})
export default OppgaveInnfoering

// Kompakt rad for ei registrert oppgåve (liste under inndata)
export function OppgaveRad({ o, personar, onEndre, onFjern }) {
  const pf = o.ansvarleg
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', fontSize: 13, flexWrap: 'wrap' }}>
      <span style={{ flex: '1 1 200px', fontWeight: 600, color: 'var(--text)' }}>{o.text}</span>
      {pf && <span style={{ color: 'var(--text2)', fontWeight: 600 }}>{pf}</span>}
      {o.hours != null && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', background: 'var(--brandbg)', borderRadius: 5, padding: '2px 8px' }}>{o.hours}t</span>}
      {o.startDate && <span style={{ fontSize: 12, color: 'var(--text3)' }}>Start: {o.startDate}</span>}
      {o.date && <span style={{ fontSize: 12, color: 'var(--text3)' }}>Frist: {o.date}</span>}
      <button type="button" title="Fjern" onClick={onFjern} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontWeight: 800, fontSize: 14 }}>×</button>
    </div>
  )
}
