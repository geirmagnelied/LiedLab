import useFlyttbartVindauge from './useFlyttbartVindauge'

// ═══════════════════════════════════════════════════════════════════
//  FlyttbartModal — felles ramme for flytande vindauge som kan flyttast (dra i toppfeltet) og skaleres (åtte handtak).
//  Mørk blå (var(--brand)) toppline med tittel + X, som i Nytt notat. Storleik/plassering vert hugsa i localStorage.
//  `onLukk` vert kalla når brukar trykkjer X — den som brukar komponenten spør om ulagra endringar sjølv.
// ═══════════════════════════════════════════════════════════════════
export default function FlyttbartModal({ tittel, hogre, onLukk, lagringsNokkel, breidd = 720, hogd = 640, minW = 520, minH = 340, bunn, z = 300, children }) {
  const { v, startFlytt, startEndring, handtakStil, retningar } = useFlyttbartVindauge(lagringsNokkel, { breidd, hogd, minW, minH })
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.38)', zIndex: z }}>
      <div style={{ position: 'absolute', left: v.x, top: v.y, width: v.w, height: v.h, maxWidth: '99vw', maxHeight: '99vh', display: 'flex', flexDirection: 'column',
        background: 'var(--bg2)', borderRadius: 14, boxShadow: '0 24px 70px rgba(0,0,0,.38)' }}>
        <div onMouseDown={startFlytt} title="Dra for å flytte vindauget"
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 20px', flexShrink: 0, background: 'var(--brand)', borderRadius: '14px 14px 0 0', cursor: 'move', userSelect: 'none' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tittel}</span>
          <div style={{ flex: 1 }}/>
          {hogre}
          <button onClick={onLukk} title="Lukk" style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'rgba(255,255,255,.88)', lineHeight: 1, padding: '0 6px' }}>×</button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>{children}</div>
        {bunn && <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', flexShrink: 0, borderTop: '1px solid var(--border)', background: 'var(--bg3)', borderRadius: '0 0 14px 14px' }}>{bunn}</div>}
        {retningar.map(d => <div key={d} onMouseDown={e => startEndring(d, e)} style={handtakStil(d)}/>)}
      </div>
    </div>
  )
}

// Felles inndatastil — same som i Kanban-kortet (og andre skjema i appen)
export const FELT = { width: '100%', boxSizing: 'border-box', padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 7, fontSize: 13, fontFamily: 'var(--font)', background: 'var(--bg)', color: 'var(--text)', outline: 'none' }
export const ETT = { fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4, display: 'block' }
