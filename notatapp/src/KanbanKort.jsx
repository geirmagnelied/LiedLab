import { fmtDato, fristForfalt, initialar, personFarge } from './kanbanLogikk'

// ═══════════════════════════════════════════════════════════════════
//  KanbanKort — eitt kort på tavla: tittel, ansvarleg, frist, fase, lenkje-merke og «Flytt til…» (reserve for touch).
//  Lyfter seg ved hover og når det vert dratt (skugge + svak skalering).
// ═══════════════════════════════════════════════════════════════════
export default function KanbanKort({ k, overskrid, dratt, nytt, sett, onApne, onFlytt, onDragStart, onDragEnd, lenkjer }) {
  const forfalt = fristForfalt(k)
  const pf = personFarge(k.ansvarleg)
  return (
    <div data-kort={k.id} draggable onDragStart={e => onDragStart(e, k)} onDragEnd={onDragEnd}
      onClick={() => onApne(k)}
      className={'kb-kort' + (dratt ? ' kb-dratt' : '') + (nytt ? ' kb-inn' : '') + (sett ? ' kb-sett' : '') + (overskrid ? ' kb-over' : '')}
      style={{ position: 'relative' }}>
      {k.farge && <span style={{ position: 'absolute', left: 0, top: 9, bottom: 9, width: 4, borderRadius: '0 3px 3px 0', background: k.farge }}/>}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.35, wordBreak: 'break-word' }}>{k.nummer ? <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', marginRight: 6 }}>O-{k.nummer}</span> : null}{k.tittel}</div>
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
    </div>
  )
}
