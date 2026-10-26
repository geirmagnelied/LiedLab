import { FELT } from './FlyttbartModal'
import { personFarge } from './kanbanLogikk'

// ═══════════════════════════════════════════════════════════════════
//  PersonVelger — nedtrekksmeny for ansvarleg, lik Status-menyen (vanleg <select>). Fargepunkt viser personen sin eigen farge.
//  Utan namneliste (ingen personell lagt inn) vert det eit vanleg tekstfelt.
// ═══════════════════════════════════════════════════════════════════
export default function PersonVelger({ value, onChange, personar = [], stil }) {
  const namn = [...new Set((personar || []).filter(Boolean))]
  if (value && !namn.includes(value)) namn.push(value)
  const f = personFarge(value)
  if (!namn.length) return <input value={value || ''} onChange={e => onChange(e.target.value)} placeholder="Namn" style={{ ...FELT, ...stil }}/>
  return (
    <div style={{ position: 'relative' }}>
      {f && <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 9, height: 9, borderRadius: '50%', background: f.fg, pointerEvents: 'none' }}/>}
      <select value={value || ''} onChange={e => onChange(e.target.value)} style={{ ...FELT, ...stil, paddingLeft: f ? 26 : 10 }}>
        <option value="">— Ingen —</option>
        {namn.map(n => <option key={n} value={n}>{n}</option>)}
      </select>
    </div>
  )
}
