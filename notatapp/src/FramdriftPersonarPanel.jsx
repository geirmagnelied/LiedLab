import { useRef, useState } from 'react'

// ═══════════════════════════════════════════════════════════════════
//  «Fordel timar på personell» for ein aktivitet (eigenskapspanelet i
//  Framdrift). Ei samansett stolpe viser kor stor del av timane kvar person
//  tek; dra i skiljelinjene mellom personane for å flytte delen (snapp til 5 %,
//  hald Alt for 1 %). Delane summerer alltid til 100 %. Timar per person =
//  forventa timar totalt × del. Vert brukt i «Timar per veke»-rada og i
//  overbelastningsvarselet (framdriftTimar.js → personDelar).
// ═══════════════════════════════════════════════════════════════════

export const PERSONFARGAR = ['#0F766E', '#1565C0', '#B5296B', '#C2570C', '#6D28D9', '#8A6D00', '#0E7490', '#B91C1C']

// Fordel 100 % jamt på n personar (rest til dei fyrste)
export function likeDelar(namnListe) {
  const n = namnListe.length
  if (!n) return []
  const grunn = Math.floor(100 / n)
  let rest = 100 - grunn * n
  return namnListe.map(namn => ({ namn, del: grunn + (rest-- > 0 ? 1 : 0) }))
}

export default function FramdriftPersonarPanel({ el, personell, onEndre }) {
  const personar = el.personar || []
  const stolpeRef = useRef(null)
  const [dragIdx, setDragIdx] = useState(null)
  const [nyNamn, setNyNamn] = useState('')
  const timar = +el.timar || 0
  const finst = new Set(personar.map(p => p.namn.toLowerCase()))
  const ledige = (personell || []).filter(p => !finst.has(p.namn.trim().toLowerCase()))

  const leggTil = (namn) => {
    namn = (namn || '').trim()
    if (!namn || finst.has(namn.toLowerCase())) return
    if (!personar.length) { onEndre([{ namn, del: 100 }]); return }
    // Ny person får ein jamn del; dei andre vert skalerte ned i same forhold
    const nyDel = Math.round(100 / (personar.length + 1))
    const skalert = personar.map(p => ({ ...p, del: Math.max(0, Math.round(p.del * (100 - nyDel) / 100)) }))
    const sum = skalert.reduce((a, p) => a + p.del, 0) + nyDel
    skalert[0].del += 100 - sum
    onEndre([...skalert, { namn, del: nyDel }])
  }
  const fjern = (i) => {
    const rest = personar.filter((_, j) => j !== i)
    if (!rest.length) { onEndre([]); return }
    const sumRest = rest.reduce((a, p) => a + p.del, 0) || 1
    const ny = rest.map(p => ({ ...p, del: Math.round(p.del * 100 / sumRest) }))
    ny[0].del += 100 - ny.reduce((a, p) => a + p.del, 0)
    onEndre(ny)
  }
  const settDel = (i, v) => {
    // flyttar differansen til/frå nabo-personen (neste, ev. førre) slik at summen held seg 100
    v = Math.max(0, Math.min(100, Math.round(+v || 0)))
    if (personar.length < 2) return
    const ny = personar.map(p => ({ ...p }))
    const nabo = i < ny.length - 1 ? i + 1 : i - 1
    const maks = ny[i].del + ny[nabo].del
    v = Math.min(v, maks)
    ny[nabo].del = maks - v; ny[i].del = v
    onEndre(ny)
  }

  const startSkilje = (ev, i) => {
    ev.preventDefault()
    const breidd = stolpeRef.current?.getBoundingClientRect().width || 1
    const x0 = ev.clientX
    const start = personar.map(p => ({ ...p }))
    const par = start[i].del + start[i + 1].del
    setDragIdx(i)
    const mv = (e2) => {
      const snapp = e2.altKey ? 1 : 5
      let d = start[i].del + ((e2.clientX - x0) / breidd) * 100
      d = Math.max(0, Math.min(par, Math.round(d / snapp) * snapp))
      const ny = start.map(p => ({ ...p }))
      ny[i].del = d; ny[i + 1].del = par - d
      onEndre(ny)
    }
    const opp = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', opp); setDragIdx(null); document.body.style.cursor = '' }
    document.body.style.cursor = 'col-resize'
    window.addEventListener('mousemove', mv)
    window.addEventListener('mouseup', opp)
  }

  const timarFor = (del) => Math.round(timar * del / 100 * 2) / 2
  let akk = 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span className="fd-etikett">Fordel timar på personell</span>
        <div style={{ flex: 1 }}/>
        {personar.length > 1 && <button className="fd-knapp" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => onEndre(likeDelar(personar.map(p => p.namn)))}>Jamt</button>}
      </div>

      {personar.length === 0 ? (
        <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5 }}>
          Legg til personar som arbeider med aktiviteten, så kan du dra for å fordele timane mellom dei.
          {el.ansvarleg ? <> Utan fordeling går alle timane til <b>{el.ansvarleg}</b>.</> : null}
        </div>
      ) : (
        <>
          <div ref={stolpeRef} style={{ position: 'relative', display: 'flex', height: 30, borderRadius: 7, overflow: 'visible',
            background: 'var(--bg3)', border: '1px solid var(--border)', userSelect: 'none' }}>
            {personar.map((p, i) => {
              const farge = PERSONFARGAR[i % PERSONFARGAR.length]
              const venstre = akk; akk += p.del
              return (
                <div key={p.namn} title={`${p.namn}: ${p.del} %${timar ? ` · ${timarFor(p.del)} t` : ''}`}
                  style={{ width: `${p.del}%`, background: farge, color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', overflow: 'hidden', whiteSpace: 'nowrap', borderRadius: i === 0 ? '6px 0 0 6px' : i === personar.length - 1 ? '0 6px 6px 0' : 0,
                    position: 'relative', transition: dragIdx == null ? 'width .12s' : 'none' }} data-venstre={venstre}>
                  {p.del >= 12 ? `${p.del}%` : ''}
                </div>
              )
            })}
            {personar.slice(0, -1).map((_, i) => {
              const posisjon = personar.slice(0, i + 1).reduce((a, p) => a + p.del, 0)
              return (
                <div key={i} onMouseDown={e => startSkilje(e, i)} title="Dra for å flytte delen (Alt = 1 %)"
                  style={{ position: 'absolute', left: `calc(${posisjon}% - 6px)`, top: -3, bottom: -3, width: 12, cursor: 'col-resize', zIndex: 3,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 4, height: '100%', borderRadius: 2, background: '#fff', border: '1px solid rgba(0,0,0,.35)', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }}/>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {personar.map((p, i) => (
              <div key={p.namn} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: PERSONFARGAR[i % PERSONFARGAR.length], flexShrink: 0 }}/>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)', fontWeight: 600 }}>{p.namn}</span>
                {personar.length > 1 && (
                  <input type="number" min="0" max="100" value={p.del} onChange={e => settDel(i, e.target.value)}
                    style={{ width: 46, padding: '2px 4px', border: '1px solid var(--border)', borderRadius: 5, fontSize: 12, textAlign: 'right',
                      background: 'var(--bg2)', color: 'var(--text)', fontFamily: 'var(--mono)' }}/>
                )}
                <span style={{ fontSize: 11, color: 'var(--text3)', width: 12 }}>%</span>
                <span style={{ fontSize: 11.5, color: 'var(--text2)', width: 44, textAlign: 'right', fontFamily: 'var(--mono)' }}>{timar ? `${timarFor(p.del)} t` : ''}</span>
                <button onClick={() => fjern(i)} title="Fjern frå aktiviteten"
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>
              </div>
            ))}
          </div>
          {!timar && <div style={{ fontSize: 11, color: 'var(--text3)' }}>Legg inn «Forventa timar totalt» for å sjå timar per person.</div>}
        </>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {ledige.map(p => (
          <button key={p.id} type="button" className="fd-knapp" style={{ padding: '3px 9px', fontSize: 11.5 }} onClick={() => leggTil(p.namn)}
            title={`Legg til ${p.namn}${p.prosent ? ` (${p.prosent} % stilling)` : ''}`}>＋ {p.namn}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input className="fd-input" value={nyNamn} onChange={e => setNyNamn(e.target.value)} placeholder="Anna namn…"
          onKeyDown={e => { if (e.key === 'Enter') { leggTil(nyNamn); setNyNamn('') } }}/>
        <button className="fd-knapp" onClick={() => { leggTil(nyNamn); setNyNamn('') }} disabled={!nyNamn.trim()}>Legg til</button>
      </div>
    </div>
  )
}
