import { useMemo, useState } from 'react'
import { fordelPaaUlaaste, likeDelar } from './FramdriftPersonarPanel'
import { personDelar, prisFor } from './framdriftTimar'
import { personerMedForbruk, faktiskFor, nokkelNamn } from './framdriftForbruk'
import { personFarge } from './personFarge'

// ═══════════════════════════════════════════════════════════════════
//  Bemanning / leveransar for vald aktivitet — eige vindauge UNDER tabellen, same oppsett som «Bemanningsregister» i
//  ISY Prosjekt Plan: éi rad per ressurs med andel (% av TIMANE), timerate, planlagde timar og kostnad, påløpt (frå
//  importert forbruk) og gjenståande. Alt kan skrivast inn direkte i cellene. Fana «Leveransar» viser dei kopla
//  DTM-dokumenta og kva som styrer framdrifta (auto frå ferdigstillelse / skjønn).
// ═══════════════════════════════════════════════════════════════════

const sumDel = (l) => l.reduce((a, p) => a + p.del, 0)
const kr = (n) => (n ? Math.round(n).toLocaleString('nb-NO') : '')
const t1 = (n) => (n ? String(Math.round(n * 10) / 10).replace('.', ',') : '')

// Rene endringar av personlista (andel alltid prosent av timane; låste delar held seg)
function leggTilPerson(personar, namn) {
  namn = (namn || '').trim()
  if (!namn || personar.some(p => nokkelNamn(p.namn) === nokkelNamn(namn))) return null
  if (!personar.length) return [{ namn, del: 100 }]
  const lastSum = sumDel(personar.filter(p => p.last))
  if (!personar.some(p => !p.last)) return null
  const tilgjengeleg = 100 - lastSum
  const nyDel = Math.min(Math.round(100 / (personar.length + 1)), tilgjengeleg)
  return [...fordelPaaUlaaste(personar, tilgjengeleg - nyDel), { namn, del: nyDel }]
}
function fjernPerson(personar, i) {
  const rest = personar.filter((_, j) => j !== i)
  if (!rest.length) return []
  const grunnlag = rest.some(p => !p.last) ? rest : rest.map(p => ({ ...p, last: false }))
  return fordelPaaUlaaste(grunnlag, 100 - sumDel(grunnlag.filter(p => p.last)))
}
function settDelPerson(personar, i, v) {
  if (personar.length < 2 || personar[i].last) return null
  if (!personar.some((p, j) => j !== i && !p.last)) return null
  const maks = 100 - sumDel(personar.filter((p, j) => j !== i && p.last))
  v = Math.max(0, Math.min(maks, Math.round(+v || 0)))
  const tmp = personar.map((p, j) => (j === i ? { ...p, del: v, last: true } : p))
  return fordelPaaUlaaste(tmp, 100 - sumDel(tmp.filter(p => p.last))).map((p, j) => (j === i ? { ...p, last: !!personar[i].last } : p))
}

const TH = { textAlign: 'right', fontSize: 10.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text3)', padding: '6px 8px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', background: 'var(--bg3)', position: 'sticky', top: 0, zIndex: 1 }
const TD = { padding: '3px 8px', fontSize: 12.5, borderBottom: '1px solid var(--border)', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--text)' }

function Tal({ verdi, onLagre, placeholder, disabled, bredde = 62, tittel }) {
  const [v, setV] = useState(null)
  const vis = v ?? (verdi ?? '')
  const lagre = () => { if (v != null && String(v) !== String(verdi ?? '')) onLagre(v); setV(null) }
  return <input type="number" min="0" step="any" value={vis} disabled={disabled} placeholder={placeholder} title={tittel}
    onChange={e => setV(e.target.value)} onBlur={lagre} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setV(null); e.currentTarget.blur() } }}
    style={{ width: bredde, padding: '2px 5px', border: '1px solid var(--border)', borderRadius: 5, fontSize: 12.5, textAlign: 'right', fontFamily: 'var(--mono)', background: disabled ? 'var(--bg3)' : 'var(--bg2)', color: 'var(--text)' }}/>
}

export default function FramdriftBemanning({ el, summ, personell, prisar, forbrukKart, fargeKart, dokument, onEndrePersonar, onKopleLeveransar, onFerdigModus, onFerdig, hogde, onHogde, open, onOpen }) {
  const [fane, setFane] = useState('bemanning')
  const fk = el ? forbrukKart?.get(el.id) : null
  const personar = useMemo(() => {
    if (!el) return []
    return (el.personar && el.personar.length) ? el.personar : ((el.ansvarleg || '').trim() ? [{ namn: el.ansvarleg.trim(), del: 100 }] : [])
  }, [el])
  const rader = useMemo(() => (el ? personerMedForbruk(personar.map(p => ({ ...p })), fk) : []), [el, personar, fk])
  const timar = +el?.timar || 0
  const fallbackRate = +el?.timerate || 0
  const rateFor = (p) => prisFor(p, prisar) || fallbackRate

  const sumR = rader.reduce((a, p) => {
    const plan = timar * p.del / 100, r = rateFor(p), paa = faktiskFor(fk, p.namn)?.total || 0
    return { plan: a.plan + plan, kostPlan: a.kostPlan + plan * r, paa: a.paa + paa, kostPaa: a.kostPaa + paa * r }
  }, { plan: 0, kostPlan: 0, paa: 0, kostPaa: 0 })

  const ledige = (personell || []).filter(p => !personar.some(x => nokkelNamn(x.namn) === nokkelNamn(p.namn)))
  const leggTil = (namn) => { const ny = leggTilPerson(personar, namn); if (ny) onEndrePersonar(ny); else window.alert('Kan ikkje leggje til — alle delane er låste, eller personen finst alt.') }

  // draghandtak for høgda
  const startHogde = (ev) => {
    ev.preventDefault()
    const y0 = ev.clientY, h0 = hogde
    const mv = (e2) => onHogde(Math.max(120, Math.min(Math.round(window.innerHeight * 0.7), Math.round(h0 - (e2.clientY - y0)))), false)
    const opp = (e2) => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', opp); document.body.style.cursor = ''; onHogde(Math.max(120, Math.min(Math.round(window.innerHeight * 0.7), Math.round(h0 - (e2.clientY - y0)))), true) }
    document.body.style.cursor = 'row-resize'
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', opp)
  }

  const tittel = el ? `${el.kode ? el.kode + ' ' : ''}${el.namn}` : null

  return (
    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', marginTop: 8, border: '1.5px solid var(--border)', borderRadius: 'var(--r2)', background: 'var(--bg2)', overflow: 'hidden',
      height: open ? hogde : 36, minHeight: open ? 120 : 36, position: 'relative' }}>
      {open && <div onMouseDown={startHogde} title="Dra for å endre høgda" style={{ position: 'absolute', top: -3, left: 0, right: 0, height: 7, cursor: 'row-resize', zIndex: 5 }}/>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', height: 36, flexShrink: 0, background: 'var(--bg3)', borderBottom: open ? '1px solid var(--border)' : undefined }}>
        <button onClick={() => onOpen(!open)} title={open ? 'Skjul vindauget' : 'Vis vindauget'} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text3)', padding: 0 }}>{open ? '▾' : '▸'}</button>
        <div className="fd-seg">
          <button className={fane === 'bemanning' ? 'pa' : ''} onClick={() => { setFane('bemanning'); onOpen(true) }}>Bemanning</button>
          <button className={fane === 'leveransar' ? 'pa' : ''} onClick={() => { setFane('leveransar'); onOpen(true) }}>Leveransar</button>
        </div>
        <span style={{ fontSize: 12.5, color: 'var(--text2)' }}>{tittel ? <>Valgt aktivitet: <b style={{ color: 'var(--text)' }}>{tittel}</b></> : 'Vel ein aktivitet i planen'}</span>
      </div>

      {open && (!el || summ ? (
        <div style={{ padding: 20, fontSize: 12.5, color: 'var(--text3)' }}>
          {summ ? 'Summasjonsaktivitetar og fasar har ikkje eiga bemanning — sum av underaktivitetane vert vist i tabellen. Vel ein underaktivitet.' : 'Klikk på ei aktivitetsrad i tidslinja eller tabellen for å sjå og endre bemanning og leveransar.'}
        </div>
      ) : fane === 'bemanning' ? (
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <datalist id="fd-bem-personell">{(personell || []).map(p => <option key={p.id} value={p.namn}/>)}</datalist>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ ...TH, textAlign: 'left' }}>Ressursnamn</th>
                <th style={TH}>Andel % av timar</th><th style={{ ...TH, width: 28 }}/>
                <th style={TH}>Planlagde timar</th><th style={TH}>Timerate kr/t</th><th style={TH}>Planlagd kostnad</th>
                <th style={TH}>Påløpte timar</th><th style={TH}>Påløpt kostnad</th><th style={TH}>Gjenst. timar</th><th style={TH}>Gjenst. kostnad</th><th style={{ ...TH, width: 28 }}/>
              </tr>
            </thead>
            <tbody>
              {rader.length === 0 && <tr><td colSpan={11} style={{ padding: 18, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>Ingen ressursar enno — vel ei ressurs under, så får ho 100 % av timane.</td></tr>}
              {rader.map((p, i) => {
                const idxPlan = personar.findIndex(x => nokkelNamn(x.namn) === nokkelNamn(p.namn))
                const iPlan = idxPlan >= 0
                const plan = timar * p.del / 100, r = rateFor(p), paa = faktiskFor(fk, p.namn)?.total || 0
                return (
                  <tr key={p.namn} style={{ background: p.utanPlan ? 'var(--bg3)' : 'transparent' }}>
                    <td style={{ ...TD, textAlign: 'left', fontFamily: 'var(--font)', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: personFarge(p.namn, fargeKart), marginRight: 8, verticalAlign: 'middle' }}/>
                      {iPlan ? (
                        <input list="fd-bem-personell" defaultValue={p.namn} onBlur={e => { const n = e.target.value.trim(); if (n && n !== p.namn) onEndrePersonar(personar.map((x, j) => (j === idxPlan ? { ...x, namn: n } : x))) }}
                          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                          style={{ width: 210, padding: '2px 5px', border: '1px solid var(--border)', borderRadius: 5, fontSize: 12.5, fontFamily: 'var(--font)', background: 'var(--bg2)', color: 'var(--text)' }}/>
                      ) : <span style={{ fontWeight: 600 }}>{p.namn} <span style={{ fontSize: 11, color: 'var(--text3)' }}>(har ført timar, ikkje i planen)</span></span>}
                    </td>
                    <td style={TD}>{iPlan ? (personar.length > 1
                      ? <Tal verdi={p.del} disabled={p.last} bredde={56} onLagre={v => { const ny = settDelPerson(personar, idxPlan, v); if (ny) onEndrePersonar(ny) }} tittel="Andel av timane (ikkje av beløpet)"/>
                      : '100') : ''}</td>
                    <td style={{ ...TD, padding: '3px 2px' }}>{iPlan && personar.length > 1 && (
                      <button onClick={() => onEndrePersonar(personar.map((x, j) => (j === idxPlan ? { ...x, last: !x.last } : x)))} title={p.last ? 'Låst — klikk for å låse opp' : 'Lås andelen'}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, opacity: p.last ? 1 : .4 }}>{p.last ? '🔒' : '🔓'}</button>)}</td>
                    <td style={TD}>{iPlan ? t1(Math.round(plan * 2) / 2) : ''}</td>
                    <td style={TD}>{iPlan ? <Tal verdi={p.pris || ''} placeholder={r ? String(Math.round(r)) : 'kr/t'} bredde={72} tittel={p.pris ? 'Eigen timerate i denne aktiviteten' : 'Tomt = timerate frå Personell'}
                      onLagre={v => { const n = parseFloat(v); onEndrePersonar(personar.map((x, j) => (j === idxPlan ? { ...x, pris: n > 0 ? n : null } : x))) }}/> : kr(r)}</td>
                    <td style={TD}>{kr(plan * r)}</td>
                    <td style={{ ...TD, color: '#1565C0', fontWeight: 700 }}>{t1(paa)}</td>
                    <td style={{ ...TD, color: '#1565C0' }}>{kr(paa * r)}</td>
                    <td style={{ ...TD, color: plan - paa < 0 ? 'var(--danger)' : undefined }}>{iPlan || paa ? t1(Math.round((plan - paa) * 10) / 10) : ''}</td>
                    <td style={{ ...TD, color: (plan - paa) * r < 0 ? 'var(--danger)' : undefined }}>{iPlan || paa ? kr((plan - paa) * r) : ''}</td>
                    <td style={{ ...TD, padding: '3px 4px' }}>{iPlan
                      ? <button onClick={() => onEndrePersonar(fjernPerson(personar, idxPlan))} title="Fjern frå aktiviteten" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 16, lineHeight: 1 }}>×</button>
                      : <button className="fd-knapp" style={{ padding: '1px 7px', fontSize: 11 }} onClick={() => leggTil(p.namn)} title="Ta med i bemanninga">＋</button>}</td>
                  </tr>
                )
              })}
              {rader.length > 0 && (
                <tr style={{ background: 'var(--bg3)', fontWeight: 800 }}>
                  <td style={{ ...TD, textAlign: 'left', fontFamily: 'var(--font)' }}>Sum</td>
                  <td style={TD}>{personar.length ? sumDel(personar) : ''}</td><td style={TD}/>
                  <td style={TD}>{t1(Math.round(sumR.plan * 2) / 2)}</td><td style={TD}>{sumR.plan ? kr(sumR.kostPlan / sumR.plan) : ''}</td><td style={TD}>{kr(sumR.kostPlan)}</td>
                  <td style={{ ...TD, color: '#1565C0' }}>{t1(sumR.paa)}</td><td style={{ ...TD, color: '#1565C0' }}>{kr(sumR.kostPaa)}</td>
                  <td style={TD}>{t1(Math.round((sumR.plan - sumR.paa) * 10) / 10)}</td><td style={TD}>{kr(sumR.kostPlan - sumR.kostPaa)}</td><td style={TD}/>
                </tr>
              )}
            </tbody>
          </table>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', flexWrap: 'wrap' }}>
            <select value="" onChange={e => { if (e.target.value) leggTil(e.target.value) }} className="fd-input" style={{ width: 230 }}>
              <option value="">＋ Legg til ressurs frå personell…</option>
              {ledige.map(p => <option key={p.id} value={p.namn}>{p.namn}{p.timepris ? ` (${p.timepris} kr/t)` : ''}</option>)}
            </select>
            {personar.length > 1 && <button className="fd-knapp" onClick={() => onEndrePersonar(likeDelar(personar))} title="Fordel like mykje på alle ulåste">Jamt</button>}
            <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>Andel er alltid prosent av <b>timane</b>. Planlagde timar og budsjett skriv du i tabellen over; timerate her overstyrer prosjektets timerate for denne aktiviteten.</span>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(() => {
            const ids = el.leveransar || []
            const dok = ids.map(id => dokument.find(d => d.id === id) || { id, nr: '(finst ikkje lenger) #' + id, manglar: true })
            const auto = ids.length > 0 && el.ferdigModus !== 'skjonn'
            return (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <button className="fd-knapp hovud" onClick={onKopleLeveransar}>⛓ Kople leveransar…</button>
                  {ids.length > 0 && <div className="fd-seg" title="Kva styrer framdrifta">
                    <button className={auto ? 'pa' : ''} onClick={() => onFerdigModus('auto')}>Auto frå leveransar</button>
                    <button className={!auto ? 'pa' : ''} onClick={() => onFerdigModus('skjonn')}>Skjønn</button>
                  </div>}
                  {!auto && <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>Framdrift <b>{el.ferdig || 0} %</b>
                    <input type="range" min="0" max="100" step="5" value={el.ferdig || 0} onChange={e => onFerdig(+e.target.value)} style={{ width: 160 }}/></label>}
                </div>
                {dok.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>Ingen leveransar kopla til aktiviteten enno.</div> : (
                  <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 760 }}>
                    <thead><tr><th style={{ ...TH, textAlign: 'left' }}>Dokumentnummer</th><th style={{ ...TH, textAlign: 'left' }}>Tittel</th><th style={TH}>Ferdigstillelse %</th><th style={TH}>Timebudsjett</th></tr></thead>
                    <tbody>{dok.map(d => (
                      <tr key={d.id}><td style={{ ...TD, textAlign: 'left', color: d.manglar ? 'var(--danger)' : undefined }}>{d.nr}</td><td style={{ ...TD, textAlign: 'left', fontFamily: 'var(--font)' }}>{d.tittel || ''}</td>
                        <td style={TD}>{d.manglar ? '' : (d.ferdigstillelse || 0)}</td><td style={TD}>{d.timebudsjett || ''}</td></tr>))}</tbody>
                  </table>
                )}
              </>
            )
          })()}
        </div>
      ))}
    </div>
  )
}
