import { useRef, useState } from 'react'

// ═══════════════════════════════════════════════════════════════════
//  «Fordel timar på personell» for ein aktivitet (eigenskapspanelet i
//  Framdrift). Ei samansett stolpe viser kor stor del av timane kvar person
//  tek; dra i skiljelinjene mellom personane for å flytte delen (snapp til 5 %,
//  hald Alt for 1 %). Delane summerer alltid til 100 %. Ein person sin del kan
//  LÅSAST (🔒): då vert han aldri endra av dragingar eller av at andre vert
//  lagt til/fjerna — berre dei ulåste delane flyttar seg. Timar per person =
//  forventa timar totalt × del. Brukt i «Timar per veke» og overbelastning
//  (framdriftTimar.js → personDelar).
// ═══════════════════════════════════════════════════════════════════

import { PALETT, personFarge } from './personFarge'
export const PERSONFARGAR = PALETT

const sum = (liste) => liste.reduce((a, p) => a + p.del, 0)

// Fordel `mengd` prosent på dei ulåste (i same forhold som dei har no, elles jamt); rest til den største
export function fordelPaaUlaaste(personar, mengd) {
  const ny = personar.map(p => ({ ...p }))
  const fri = ny.filter(p => !p.last)
  if (!fri.length) return ny
  const grunnlag = sum(fri)
  fri.forEach(p => { p.del = grunnlag > 0 ? Math.round(p.del * mengd / grunnlag) : Math.floor(mengd / fri.length) })
  const avvik = mengd - sum(fri)
  if (avvik !== 0) { const st = fri.reduce((m, p) => (p.del > m.del ? p : m), fri[0]); st.del += avvik }
  fri.forEach(p => { if (p.del < 0) p.del = 0 })
  return ny
}

// Fordel 100 % jamt (låste delar held seg)
export function likeDelar(personar) {
  const ny = personar.map(p => ({ ...p }))
  const fri = ny.filter(p => !p.last)
  if (!fri.length) return ny
  const rest = 100 - sum(ny.filter(p => p.last))
  const grunn = Math.max(0, Math.floor(rest / fri.length))
  let r = Math.max(0, rest - grunn * fri.length)
  fri.forEach(p => { p.del = grunn + (r-- > 0 ? 1 : 0) })
  return ny
}

export default function FramdriftPersonarPanel({ el, personell, prisar, fargeKart, onEndre }) {
  // Er ingen fordelt, men ein person er sett som ANSVARLEG, står han her som 100 % — slik at timepris kan setjast utan å leggje han til på nytt
  const personar = (el.personar && el.personar.length) ? el.personar : ((el.ansvarleg || '').trim() ? [{ namn: el.ansvarleg.trim(), del: 100 }] : [])
  const stolpeRef = useRef(null)
  const [dragIdx, setDragIdx] = useState(null)
  const [nyNamn, setNyNamn] = useState('')
  const timar = +el.timar || 0
  const finst = new Set(personar.map(p => p.namn.toLowerCase()))
  const ledige = (personell || []).filter(p => !finst.has(p.namn.trim().toLowerCase()))
  const lastSum = sum(personar.filter(p => p.last))

  const leggTil = (namn) => {
    namn = (namn || '').trim()
    if (!namn || finst.has(namn.toLowerCase())) return
    if (!personar.length) { onEndre([{ namn, del: 100 }]); return }
    const fri = personar.filter(p => !p.last)
    if (!fri.length) { window.alert('Alle delane er låste — lås opp minst ein person for å gi plass til ein ny.'); return }
    const tilgjengeleg = 100 - lastSum
    const nyDel = Math.min(Math.round(100 / (personar.length + 1)), tilgjengeleg)
    const ny = fordelPaaUlaaste(personar, tilgjengeleg - nyDel)
    onEndre([...ny, { namn, del: nyDel }])
  }
  const fjern = (i) => {
    const rest = personar.filter((_, j) => j !== i)
    if (!rest.length) { onEndre([]); return }
    const harFri = rest.some(p => !p.last)
    const grunnlag = harFri ? rest : rest.map(p => ({ ...p, last: false })) // alle låste → lås opp så summen kan bli 100
    onEndre(fordelPaaUlaaste(grunnlag, 100 - sum(grunnlag.filter(p => p.last))).map(p => ({ ...p })))
  }
  const veksleLas = (i) => onEndre(personar.map((p, j) => (j === i ? { ...p, last: !p.last } : p)))

  // Sett éin persons del med tal; differansen går til dei andre ulåste
  const settDel = (i, v) => {
    if (personar.length < 2 || personar[i].last) return
    const andreUlaaste = personar.filter((p, j) => j !== i && !p.last)
    if (!andreUlaaste.length) return
    const maks = 100 - sum(personar.filter((p, j) => j !== i && p.last))
    v = Math.max(0, Math.min(maks, Math.round(+v || 0)))
    const tmp = personar.map((p, j) => (j === i ? { ...p, del: v, last: true } : p)) // hald denne fast medan resten fordeler seg
    const ny = fordelPaaUlaaste(tmp, 100 - sum(tmp.filter(p => p.last)))
    onEndre(ny.map((p, j) => (j === i ? { ...p, last: !!personar[i].last } : p)))
  }

  // Skilje i: veks nærmaste ulåste til venstre (≤ i), skrumpar nærmaste ulåste til høgre (≥ i+1)
  const skiljePar = (i) => {
    let g = i; while (g >= 0 && personar[g].last) g--
    let s2 = i + 1; while (s2 < personar.length && personar[s2].last) s2++
    return g >= 0 && s2 < personar.length ? [g, s2] : null
  }
  const startSkilje = (ev, i) => {
    const par = skiljePar(i)
    if (!par) return
    ev.preventDefault()
    const [g, s2] = par
    const breidd = stolpeRef.current?.getBoundingClientRect().width || 1
    const x0 = ev.clientX
    const start = personar.map(p => ({ ...p }))
    const sumPar = start[g].del + start[s2].del
    setDragIdx(i)
    const mv = (e2) => {
      const snapp = e2.altKey ? 1 : 5
      let d = start[g].del + ((e2.clientX - x0) / breidd) * 100
      d = Math.max(0, Math.min(sumPar, Math.round(d / snapp) * snapp))
      const ny = start.map(p => ({ ...p }))
      ny[g].del = d; ny[s2].del = sumPar - d
      onEndre(ny)
    }
    const opp = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', opp); setDragIdx(null); document.body.style.cursor = '' }
    document.body.style.cursor = 'col-resize'
    window.addEventListener('mousemove', mv)
    window.addEventListener('mouseup', opp)
  }

  const timarFor = (del) => Math.round(timar * del / 100 * 2) / 2

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span className="fd-etikett">Fordel timar på personell</span>
        <div style={{ flex: 1 }}/>
        {personar.length > 1 && <button className="fd-knapp" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => onEndre(likeDelar(personar))}
          title="Fordel like mykje på alle ulåste">Jamt</button>}
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
            {personar.map((p, i) => (
              <div key={p.namn} title={`${p.namn}: ${p.del} %${timar ? ` · ${timarFor(p.del)} t` : ''}${p.last ? ' (låst)' : ''}`}
                style={{ width: `${p.del}%`, background: personFarge(p.namn, fargeKart), color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', overflow: 'hidden', whiteSpace: 'nowrap', borderRadius: i === 0 ? '6px 0 0 6px' : i === personar.length - 1 ? '0 6px 6px 0' : 0,
                  boxShadow: p.last ? 'inset 0 0 0 2px rgba(255,255,255,.55)' : undefined, transition: dragIdx == null ? 'width .12s' : 'none' }}>
                {p.del >= 14 ? `${p.last ? '🔒 ' : ''}${p.del}%` : ''}
              </div>
            ))}
            {personar.slice(0, -1).map((_, i) => {
              const posisjon = personar.slice(0, i + 1).reduce((a, p) => a + p.del, 0)
              const kan = !!skiljePar(i)
              return (
                <div key={i} onMouseDown={e => startSkilje(e, i)} title={kan ? 'Dra for å flytte delen (Alt = 1 %)' : 'Låst — lås opp ein av personane for å flytte'}
                  style={{ position: 'absolute', left: `calc(${posisjon}% - 6px)`, top: -3, bottom: -3, width: 12, cursor: kan ? 'col-resize' : 'not-allowed', zIndex: 3,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: kan ? 1 : 0.45 }}>
                  <div style={{ width: 4, height: '100%', borderRadius: 2, background: '#fff', border: '1px solid rgba(0,0,0,.35)', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }}/>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {personar.map((p, i) => (
              <div key={p.namn} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: personFarge(p.namn, fargeKart), flexShrink: 0 }}/>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)', fontWeight: 600 }}>{p.namn}</span>
                {personar.length > 1 && (
                  <input type="number" min="0" max="100" value={p.del} disabled={p.last} onChange={e => settDel(i, e.target.value)}
                    style={{ width: 46, padding: '2px 4px', border: '1px solid var(--border)', borderRadius: 5, fontSize: 12, textAlign: 'right',
                      background: p.last ? 'var(--bg3)' : 'var(--bg2)', color: 'var(--text)', fontFamily: 'var(--mono)' }}/>
                )}
                <span style={{ fontSize: 11, color: 'var(--text3)', width: 12 }}>%</span>
                <span style={{ fontSize: 11.5, color: 'var(--text2)', width: 44, textAlign: 'right', fontFamily: 'var(--mono)' }}>{timar ? `${timarFor(p.del)} t` : ''}</span>
                {personar.length > 1 && (
                  <button onClick={() => veksleLas(i)} title={p.last ? 'Låst — klikk for å låse opp' : 'Lås prosentdelen til ' + p.namn}
                    style={{ border: 'none', background: p.last ? 'var(--brandbg2)' : 'none', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '2px 3px', borderRadius: 4,
                      opacity: p.last ? 1 : .45 }}>{p.last ? '🔒' : '🔓'}</button>
                )}
                <button onClick={() => fjern(i)} title="Fjern frå aktiviteten"
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 17, fontSize: 11, color: 'var(--text3)' }}>
                <span>Timepris i aktiviteten</span>
                <input type="number" min="0" step="50" value={p.pris || ''} placeholder={prisar?.get(p.namn.toLowerCase()) ? String(prisar.get(p.namn.toLowerCase())) : 'kr/t'}
                  onChange={e => { const n = parseFloat(e.target.value); onEndre(personar.map((x, j) => (j === i ? { ...x, pris: n > 0 ? n : null } : x))) }}
                  title={p.pris ? 'Eigen timepris for denne aktiviteten (overstyrer prosjektets)' : 'Tomt = prosjektets timepris frå Personell'}
                  style={{ width: 68, padding: '1px 4px', border: '1px solid ' + (p.pris ? 'var(--brand)' : 'var(--border)'), borderRadius: 5, fontSize: 11.5, textAlign: 'right',
                    background: 'var(--bg2)', color: 'var(--text)', fontFamily: 'var(--mono)' }}/>
                <span>kr/t{p.pris ? '' : prisar?.get(p.namn.toLowerCase()) ? ' (standard)' : ''}</span>
              </div>
              </div>
            ))}
          </div>
          {!el.personar?.length && el.ansvarleg && <div style={{ fontSize: 11, color: 'var(--text3)' }}>Ansvarleg ({el.ansvarleg}) tek alle timane. Endre prosenten ved å leggje til fleire personar, eller sett timepris her.</div>}
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
