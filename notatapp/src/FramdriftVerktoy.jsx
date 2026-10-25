import { useState } from 'react'
import { palopSlutt, palopTekst } from './framdriftPalop'

// ═══════════════════════════════════════════════════════════════════
//  Verktøylinja i Framdrift (NL3): nedtrekksmenyar «Påløpt innan», «Ny», «Import», «Eksport», «Visning» og «PNS».
//  Meny = knapp + popover (klikk utanfor lukkar). Sjå FramdriftModule.jsx.
// ═══════════════════════════════════════════════════════════════════
export function FdMeny({ etikett, hovud, disabled, tittel, breidd = 270, hogre, aktiv, children }) {
  const [open, setOpen] = useState(false)
  return (
    <span style={{ position: 'relative' }}>
      <button className={'fd-knapp' + (hovud ? ' hovud' : '')} disabled={disabled} title={tittel} onClick={() => setOpen(v => !v)}
        style={aktiv ? { borderColor: 'var(--brand)', background: 'var(--brandbg)', color: 'var(--brand)' } : undefined}>{etikett} ▾</button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 90 }}/>
          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', [hogre ? 'right' : 'left']: 0, zIndex: 100, width: breidd, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', boxShadow: '0 10px 30px rgba(0,0,0,.22)', padding: 6 }}>
            {children(() => setOpen(false))}
          </div>
        </>
      )}
    </span>
  )
}

export function MenyPunkt({ onClick, tittel, under, disabled, merkt }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', borderRadius: 6, background: merkt ? 'var(--brandbg)' : 'transparent', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? .45 : 1, fontFamily: 'var(--font)' }}
      onMouseEnter={e => { if (!disabled && !merkt) e.currentTarget.style.background = 'var(--bg3)' }} onMouseLeave={e => { if (!merkt) e.currentTarget.style.background = 'transparent' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{merkt ? '✓ ' : ''}{tittel}</div>
      {under && <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2, lineHeight: 1.4 }}>{under}</div>}
    </button>
  )
}
export const MenyTittel = ({ children }) => <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.07em', padding: '6px 10px 2px' }}>{children}</div>
export const MenySkilje = () => <div style={{ height: 1, background: 'var(--border)', margin: '5px 4px' }}/>

// «Påløpt innan» — tydeleg vindauge oppe til venstre: vel dato, veke eller månad (påløpt tid vert teke med til og med den perioden)
export function PalopInnanMeny({ verdi, onEndre }) {
  const slutt = palopSlutt(verdi)
  const val = verdi || { modus: 'alle', verdi: '' }
  const VAL = [['alle', 'Ingen avgrensing', null], ['dato', 'Dato', 'date'], ['veke', 'Veke', 'week'], ['manad', 'Månad', 'month']]
  return (
    <FdMeny etikett={<><span style={{ fontWeight: 600, opacity: .75 }}>Påløpt innan:</span> <b>{palopTekst(val)}</b></>} breidd={300} aktiv={!!slutt}
      tittel="Avgrens kva påløpt tid tabellen viser (timar og honorar frå timeføringa)">
      {() => (
        <div style={{ padding: '4px 6px 8px' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', padding: '4px 4px 2px' }}>Påløpt innan</div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', padding: '0 4px 8px', lineHeight: 1.45 }}>Vel ein periode — påløpt tid vert vist til og med denne. Timeføringar etter datoen vert ikkje teke med.</div>
          {VAL.map(([k, namn, type]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, fontSize: 13, fontWeight: val.modus === k ? 800 : 600, color: 'var(--text)', cursor: 'pointer' }}>
                <input type="radio" name="palop-modus" checked={val.modus === k} onChange={() => onEndre({ modus: k, verdi: k === val.modus ? val.verdi : '' })}/>{namn}
              </label>
              {type && <input type={type} value={val.modus === k ? val.verdi : ''} onFocus={() => { if (val.modus !== k) onEndre({ modus: k, verdi: '' }) }} onChange={e => onEndre({ modus: k, verdi: e.target.value })}
                style={{ padding: '4px 6px', border: '1.5px solid ' + (val.modus === k ? 'var(--brand)' : 'var(--border)'), borderRadius: 6, fontSize: 12.5, fontFamily: 'var(--font)', background: 'var(--bg)', color: 'var(--text)' }}/>}
            </div>
          ))}
          {slutt && <div style={{ fontSize: 11.5, color: 'var(--brand)', fontWeight: 700, padding: '6px 4px 0' }}>Viser påløpt til og med {slutt.split('-').reverse().join('.')}</div>}
        </div>
      )}
    </FdMeny>
  )
}
