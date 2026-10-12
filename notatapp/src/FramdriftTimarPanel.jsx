import { useMemo, useRef, useState, useEffect } from 'react'
import { getISOWeek } from 'date-fns'
import { fordelTimar, formVekt, FORDELINGAR, STYRKE_MAKS, prisKartFra, snittpris, personDelar, prisFor } from './framdriftTimar'
import { tilDato } from './framdriftDato'

// ═══════════════════════════════════════════════════════════════════
//  Timar, budsjett og timefordeling for ein aktivitet (eigenskapspanelet i Framdrift).
//  – Anten FORVENTA TIMAR (fast) eller BUDSJETT (fastpris i kr): med budsjett er timane eit resultat
//    = budsjett ÷ snittpris, der snittprisen er vekta med personfordelinga (% av TIMANE, ikkje av beløpet).
//  – FORDELING på vekene: Fast/Start/Midt/Slutt + ein graf der du justerer kor stor forskjell det skal vere
//    (dra sirkelen over høgaste stolpe opp/ned, eller skyvekontrollen), eller dreg einskilde stolpar sjølv
//    («Eigen»). Forhandsvisinga viser faktisk timetal per veke etter kontorkalenderen.
// ═══════════════════════════════════════════════════════════════════

function Miniform({ type, aktiv }) {
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

const kr = (n) => Math.round(n).toLocaleString('nb-NO').replace(/ /g, ' ')
const GRAF_H = 96

export default function FramdriftTimarPanel({ el, kal, personell, onEndre }) {
  const modus = el.modus === 'budsjett' ? 'budsjett' : 'timar'
  const fordeling = el.fordeling || 'fast'
  const styrke = el.fordelingStyrke ?? 1
  const [tv, setTv] = useState(String(el.timar || ''))
  const [bv, setBv] = useState(String(el.budsjett || ''))
  useEffect(() => setTv(String(el.modus === 'budsjett' ? '' : (el.timar || ''))), [el.id, el.timar, el.modus])
  useEffect(() => setBv(String(el.budsjett || '')), [el.id, el.budsjett])

  const prisar = useMemo(() => prisKartFra(personell), [personell])
  const sp = useMemo(() => snittpris(el, prisar), [el, prisar])
  const veker = useMemo(() => fordelTimar({ ...el, fordeling }, kal), [el, fordeling, kal])
  const snitt = veker.length ? veker.reduce((s, x) => s + x.timar, 0) / veker.length : 0
  const maks = Math.max(0, ...veker.map(x => x.timar))
  const grafRef = useRef(null)

  const lagreTimar = () => {
    const n = Math.max(0, Math.round((parseFloat(String(tv).replace(',', '.')) || 0) * 2) / 2)
    if (n !== (el.timar || 0)) onEndre({ timar: n })
    setTv(n ? String(n) : '')
  }
  const lagreBudsjett = () => {
    const n = Math.max(0, Math.round(parseFloat(String(bv).replace(/\s/g, '').replace(',', '.')) || 0))
    if (n !== (el.budsjett || 0)) onEndre({ budsjett: n })
    setBv(n ? String(n) : '')
  }

  // Høgde per stolpe: skalert mot ein fast referanse (snitt × 2,5) så forskjellen er synleg også ved flat fordeling
  const ref = Math.max(snitt * 2.5, maks, 1)
  const hogde = (t) => Math.max(3, Math.min(GRAF_H, (t / ref) * GRAF_H))

  // Dra sirkelen: loddrett flytting endrar kor kraftig forma er (styrke 0 … 2)
  const startStyrke = (ev) => {
    ev.preventDefault(); ev.stopPropagation()
    const y0 = ev.clientY, s0 = styrke
    const mv = (e2) => onEndre({ fordelingStyrke: Math.max(0, Math.min(STYRKE_MAKS, Math.round((s0 + ((y0 - e2.clientY) / GRAF_H) * 1.6) * 20) / 20)) })
    const opp = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', opp); document.body.style.cursor = '' }
    document.body.style.cursor = 'ns-resize'
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', opp)
  }
  // Dra ein enkelt stolpe: går over til «Eigen» (kvar veke får ei eiga vekt)
  const startStolpe = (ev, x, i) => {
    ev.preventDefault()
    const y0 = ev.clientY
    const vekt = fordeling === 'eigen' ? { ...(el.eigenVekt || {}) } : Object.fromEntries(veker.map(v => [v.veke, snitt > 0 ? v.timar / snitt : 1]))
    const v0 = vekt[x.veke] ?? 1
    const mv = (e2) => {
      const ny = Math.max(0.05, Math.round((v0 + ((y0 - e2.clientY) / GRAF_H) * (ref / Math.max(snitt, 0.001))) * 20) / 20)
      onEndre({ fordeling: 'eigen', eigenVekt: { ...vekt, [x.veke]: ny } })
    }
    const opp = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', opp); document.body.style.cursor = '' }
    document.body.style.cursor = 'ns-resize'
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', opp)
  }

  const toppIdx = veker.findIndex(v => v.timar === maks)
  const kanStyrke = fordeling !== 'fast' && fordeling !== 'eigen'
  const personar = personDelar(el)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <div className="fd-seg" style={{ alignSelf: 'flex-start' }}>
        <button className={modus === 'timar' ? 'pa' : ''} onClick={() => onEndre({ modus: 'timar' })} title="Skriv inn forventa timar direkte">Timar</button>
        <button className={modus === 'budsjett' ? 'pa' : ''} onClick={() => onEndre({ modus: 'budsjett' })}
          title="Skriv inn budsjett/fastpris — timane vert rekna ut frå timeprisane og personfordelinga">Budsjett (fastpris)</button>
      </div>

      {modus === 'timar' ? (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="fd-etikett">Forventa timar totalt</span>
          <input className="fd-input" type="number" min="0" step="0.5" value={tv} placeholder="0"
            onChange={e => setTv(e.target.value)} onBlur={lagreTimar} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}/>
        </label>
      ) : (
        <>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="fd-etikett">Budsjett / fastpris (kr)</span>
            <input className="fd-input" inputMode="numeric" value={bv} placeholder="0"
              onChange={e => setBv(e.target.value)} onBlur={lagreBudsjett} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}/>
          </label>
          <div style={{ fontSize: 12, lineHeight: 1.55, background: 'var(--bg3)', borderRadius: 7, padding: '7px 9px', color: 'var(--text2)' }}>
            {sp.utanPersonar ? <>Legg til personar (under) og sett timepris i Prosjekt → Personell for å rekne ut timane.</>
              : sp.manglar.length ? <span style={{ color: 'var(--danger)' }}>Manglar timepris for: <b>{sp.manglar.join(', ')}</b> — sett han under personfordelinga, eller i Prosjekt → Personell.</span>
              : <>Snittpris <b>{kr(sp.pris)} kr/t</b> (vekta etter personfordelinga) → <b>{el.timar || 0} timar</b>.</>}
            {!sp.utanPersonar && !sp.manglar.length && personar.length > 0 && el.timar > 0 && (
              <div style={{ marginTop: 3, color: 'var(--text3)' }}>
                {personar.map(p => `${p.namn.split(' ')[0]}: ${Math.round(el.timar * p.del / 100 * 2) / 2} t = ${kr(el.timar * p.del / 100 * prisFor(p, prisar))} kr`).join(' · ')}
              </div>
            )}
          </div>
        </>
      )}

      <div className="fd-etikett">Fordeling på vekene</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
        {FORDELINGAR.map(f => {
          const pa = fordeling === f.key
          return (
            <button key={f.key} type="button" title={f.tips} onClick={() => onEndre({ fordeling: f.key })}
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

      {kanStyrke && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span className="fd-etikett">Forskjell mellom veker: {Math.round(styrke * 100)} %</span>
          <input type="range" min="0" max={STYRKE_MAKS * 100} step="5" value={Math.round(styrke * 100)}
            onChange={e => onEndre({ fordelingStyrke: +e.target.value / 100 })}/>
        </label>
      )}
      {fordeling === 'eigen' && (
        <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>
          Eigen fordeling — dra stolpane opp/ned. <button className="fd-knapp" style={{ padding: '1px 8px', fontSize: 11 }} onClick={() => onEndre({ fordeling: 'fast', eigenVekt: null })}>Nullstill</button>
        </div>
      )}

      {veker.length > 0 ? (
        <>
          <div ref={grafRef} style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 2, height: GRAF_H + 22, padding: '18px 1px 0',
            background: 'linear-gradient(var(--border) 1px, transparent 1px) 0 0 / 100% 25%', borderBottom: '1px solid var(--border)', userSelect: 'none' }}>
            {veker.map((x, i) => (
              <div key={x.veke} onMouseDown={e => startStolpe(e, x, i)}
                title={`Veke ${getISOWeek(tilDato(x.veke))}: ${x.timar} t — dra opp/ned for å justere sjølv`}
                style={{ flex: 1, minWidth: 2, height: hogde(x.timar), background: 'var(--brand)', opacity: fordeling === 'eigen' ? 1 : .8, borderRadius: '2px 2px 0 0', cursor: 'ns-resize', position: 'relative' }}>
                {kanStyrke && i === toppIdx && (
                  <div onMouseDown={startStyrke} title="Dra opp/ned: kor stor forskjell det skal vere mellom veker"
                    style={{ position: 'absolute', left: '50%', top: -8, width: 16, height: 16, marginLeft: -8, borderRadius: '50%', background: '#fff',
                      border: '3px solid var(--brand)', boxShadow: '0 1px 4px rgba(0,0,0,.35)', cursor: 'ns-resize', zIndex: 2 }}/>
                )}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
            {veker.length} veke{veker.length === 1 ? '' : 'r'} med arbeidstid · snitt {Math.round(snitt * 10) / 10} t/veke · størst {maks} t.
            Veker med fri (stille veke, jul …) får ingen timar.
          </div>
        </>
      ) : (
        <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{modus === 'budsjett' ? 'Legg inn budsjett, personar og timepris for å sjå fordelinga.' : 'Legg inn timar for å sjå fordelinga.'}</div>
      )}
    </div>
  )
}
