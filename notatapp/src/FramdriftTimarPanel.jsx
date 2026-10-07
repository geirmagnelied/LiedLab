import { useMemo, useState, useEffect } from 'react'
import { getISOWeek } from 'date-fns'
import { fordelTimar, formVekt, FORDELINGAR } from './framdriftTimar'
import { tilDato } from './framdriftDato'

// ═══════════════════════════════════════════════════════════════════
//  Timeprognose for ein aktivitet (eigenskapspanelet i Framdrift): forventa
//  timar totalt + kva måte dei vert fordelt på vekene i perioden. Fire val:
//  fast kvar veke · størst i starten · størst i midten · størst på slutten.
//  Forhandsvisinga viser faktisk timetal per veke etter kontorkalenderen
//  (veker med fri får 0). Sjå framdriftTimar.js.
// ═══════════════════════════════════════════════════════════════════

function Miniform({ type, aktiv }) {
  // 7 stolpar som viser forma på fordelinga
  const v = Array.from({ length: 7 }, (_, i) => formVekt(type, (i + 0.5) / 7))
  const maks = Math.max(...v)
  return (
    <svg width="34" height="18" viewBox="0 0 34 18" aria-hidden="true">
      {v.map((h, i) => (
        <rect key={i} x={i * 5 + 0.5} y={18 - (h / maks) * 17} width="4" height={(h / maks) * 17} rx="1"
          fill={aktiv ? 'var(--brand)' : 'var(--text3)'} opacity={aktiv ? 1 : 0.55}/>
      ))}
    </svg>
  )
}

export default function FramdriftTimarPanel({ el, kal, onTimar, onFordeling }) {
  const [v, setV] = useState(String(el.timar || ''))
  useEffect(() => setV(String(el.timar || '')), [el.id, el.timar])
  const fordeling = el.fordeling || 'fast'
  const veker = useMemo(() => fordelTimar({ ...el, fordeling }, kal), [el, fordeling, kal])
  const maks = Math.max(0, ...veker.map(x => x.timar))
  const lagre = () => {
    const n = Math.max(0, Math.round((parseFloat(String(v).replace(',', '.')) || 0) * 2) / 2)
    if (n !== (el.timar || 0)) onTimar(n)
    setV(n ? String(n) : '')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="fd-etikett">Forventa timar totalt</span>
        <input className="fd-input" type="number" min="0" step="0.5" value={v} placeholder="0"
          onChange={e => setV(e.target.value)} onBlur={lagre} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}/>
      </label>

      <div className="fd-etikett">Fordeling på vekene</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
        {FORDELINGAR.map(f => {
          const pa = fordeling === f.key
          return (
            <button key={f.key} type="button" title={f.tips} onClick={() => onFordeling(f.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 8px', borderRadius: 7, cursor: 'pointer',
                fontFamily: 'var(--font)', fontSize: 12, fontWeight: 700, textAlign: 'left',
                border: `1.5px solid ${pa ? 'var(--brand)' : 'var(--border)'}`, background: pa ? 'var(--brandbg)' : 'var(--bg2)',
                color: pa ? 'var(--brand)' : 'var(--text2)' }}>
              <Miniform type={f.key} aktiv={pa}/>
              {f.namn}
            </button>
          )
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
        {FORDELINGAR.find(f => f.key === fordeling)?.tips}.
      </div>

      {veker.length > 0 ? (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 54, padding: '0 1px' }}>
            {veker.map(x => (
              <div key={x.veke} title={`Veke ${getISOWeek(tilDato(x.veke))}: ${x.timar} t`}
                style={{ flex: 1, minWidth: 2, height: `${maks ? Math.max(6, (x.timar / maks) * 100) : 6}%`, background: 'var(--brand)', opacity: .8, borderRadius: '2px 2px 0 0' }}/>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
            {veker.length} veke{veker.length === 1 ? '' : 'r'} med arbeidstid · snitt {Math.round((veker.reduce((s, x) => s + x.timar, 0) / veker.length) * 10) / 10} t/veke · størst {maks} t.
            Veker med fri (stille veke, jul …) får ingen timar.
          </div>
        </>
      ) : (
        <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>Legg inn timar for å sjå fordelinga.</div>
      )}
    </div>
  )
}
