import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { fmtDato, fristForfalt, initialar, personFarge, statusNamn } from './kanbanLogikk'

// ═══════════════════════════════════════════════════════════════════
//  KanbanKort — eitt kort på tavla: tittel, ansvarleg, frist, fase, lenkje-merke og «Flytt til…» (reserve for touch).
//  Lyfter seg ved hover og når det vert dratt (skugge + svak skalering).
// ═══════════════════════════════════════════════════════════════════
export default function KanbanKort({ k, overskrid, dratt, nytt, sett, onApne, onFlytt, onDragStart, onDragEnd, lenkjer }) {
  const forfalt = fristForfalt(k)
  const pf = personFarge(k.ansvarleg)
  // Hover i ro ei lita stund → heile oppgåva i komprimert form (popover)
  const [hover, setHover] = useState(null)   // { x, y } eller null
  const timer = useRef(null)
  const skjul = () => { clearTimeout(timer.current); timer.current = null; setHover(null) }
  useEffect(() => () => clearTimeout(timer.current), [])
  const startHover = (e) => {
    clearTimeout(timer.current)
    const el = e.currentTarget
    timer.current = setTimeout(() => { const r = el.getBoundingClientRect(); setHover({ x: r.right, y: r.top, venstre: r.left }) }, 700)
  }
  const lang = (k.skildring || '').length > 2 || lenkjer.length > 0 || (k.tittel || '').length > 60
  return (
    <div data-kort={k.id} draggable onDragStart={e => { skjul(); onDragStart(e, k) }} onDragEnd={onDragEnd}
      onMouseEnter={startHover} onMouseLeave={skjul} onMouseDown={skjul}
      onClick={() => { skjul(); onApne(k) }}
      className={'kb-kort' + (dratt ? ' kb-dratt' : '') + (nytt ? ' kb-inn' : '') + (sett ? ' kb-sett' : '') + (overskrid ? ' kb-over' : '')}
      style={{ position: 'relative' }}>
      {k.farge && <span style={{ position: 'absolute', left: 0, top: 9, bottom: 9, width: 4, borderRadius: '0 3px 3px 0', background: k.farge }}/>}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.35, wordBreak: 'break-word' }}>{k.tittel}</div>
      {k.skildring && <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{k.skildring}</div>}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {k.ansvarleg && (
          <span title={k.ansvarleg} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: pf ? pf.fg : 'var(--text2)', fontWeight: 600 }}>
            <span style={{ width: 20, height: 20, borderRadius: '50%', background: pf ? pf.bg : 'var(--brandbg)', color: pf ? pf.fg : 'var(--brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 800 }}>{initialar(k.ansvarleg)}</span>
            {k.ansvarleg.split(/\s+/)[0]}
          </span>
        )}
        {k.frist && <span style={{ fontSize: 10.5, fontWeight: forfalt ? 800 : 500, color: forfalt ? 'var(--danger, #c0392b)' : 'var(--text3)' }}>⏱ {fmtDato(k.frist)}</span>}
        <span style={{ flex: 1 }}/>
        {lenkjer.map(l => <span key={l.t} title={l.tittel} style={{ fontSize: 9.5, fontWeight: 800, width: 17, height: 17, borderRadius: 5, background: 'var(--brandbg)', color: 'var(--brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{l.t}</span>)}
      </div>
      {hover && lang && createPortal(
        <div style={{ position: 'fixed', top: Math.max(8, Math.min(hover.y, window.innerHeight - 260)), left: Math.min(hover.x + 8, window.innerWidth - 330), width: 320, zIndex: 500, pointerEvents: 'none',
          background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,.25)', padding: '11px 13px', animation: 'kbInn .18s ease-out' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.35, wordBreak: 'break-word' }}>{k.tittel}</div>
          {k.skildring && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 5, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 140, overflow: 'hidden' }}>{k.skildring}</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 12px', marginTop: 8, fontSize: 11, color: 'var(--text3)' }}>
            <span><b>Status:</b> {statusNamn(k.status)}</span>
            {k.ansvarleg && <span><b>Ansvarleg:</b> {k.ansvarleg}</span>}
            {k.frist && <span style={forfalt ? { color: 'var(--danger, #c0392b)', fontWeight: 700 } : undefined}><b>Frist:</b> {fmtDato(k.frist)}</span>}
          </div>
          {lenkjer.length > 0 && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text3)', lineHeight: 1.45 }}>{lenkjer.map(l => <div key={l.t}>{l.t} · {l.tittel}</div>)}</div>}
        </div>, document.body)}
    </div>
  )
}
