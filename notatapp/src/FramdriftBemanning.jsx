import { useMemo, useState } from 'react'
import { likeDelar, fordelPaaUlaaste } from './FramdriftPersonarPanel'
import { prisFor } from './framdriftTimar'
import { personerMedForbruk, faktiskFor, nokkelNamn } from './framdriftForbruk'
import { personFarge } from './personFarge'

// ═══════════════════════════════════════════════════════════════════
//  Bemanning / leveransar for vald aktivitet — eige vindauge UNDER tabellen, bygd som «Bemanningsregister» i ISY
//  Prosjekt Plan: Aktivitetskode · Navn · Ressursnamn · Ressurs timer · Ressurs rate · Ressurs faste kostnader ·
//  Kostnad · Belastning · Kommentar (+ påløpt og gjenståande frå importert forbruk). Som i ISY er det TIMANE per
//  ressurs du skriv inn: aktivitetens timar vert summen av ressurstimane, og Belastning er ressursens del av dei (%).
//  Å skrive Belastning % direkte fordeler dei samla timane på nytt (alltid prosent av timane, ikkje av beløpet).
//  Fana «Leveransar» viser kopla DTM-dokument og styring av framdrift.
// ═══════════════════════════════════════════════════════════════════

const sumDel = (l) => l.reduce((a, p) => a + p.del, 0)
const kr = (n) => (n ? Math.round(n).toLocaleString('nb-NO') : '')
const t1 = (n) => (n ? String(Math.round(n * 100) / 100).replace('.', ',') : '')
const avr2 = (n) => Math.round(n * 100) / 100

// Normaliser delane til sum 100 (2 desimalar)
function normaliser(personar) {
  const sum = sumDel(personar)
  if (sum <= 0) return personar.map(p => ({ ...p, del: 0 }))
  const ny = personar.map(p => ({ ...p, del: avr2((p.del / sum) * 100) }))
  const avvik = avr2(100 - sumDel(ny))
  if (avvik) { const st = ny.reduce((m, p) => (p.del > m.del ? p : m), ny[0]); st.del = avr2(st.del + avvik) }
  return ny
}
// Belastning % for éin ressurs; resten skalerast på dei andre ulåste i same forhold
function settBelastning(personar, i, v) {
  if (personar.length < 2) return null
  const andreUlaaste = personar.filter((p, j) => j !== i && !p.last)
  if (!andreUlaaste.length) return null
  const maks = 100 - sumDel(personar.filter((p, j) => j !== i && p.last))
  v = avr2(Math.max(0, Math.min(maks, +v || 0)))
  const rest = avr2(100 - sumDel(personar.filter((p, j) => j !== i && p.last)) - v)
  const grunn = sumDel(andreUlaaste)
  const ny = personar.map((p, j) => {
    if (j === i) return { ...p, del: v }
    if (p.last) return { ...p }
    return { ...p, del: avr2(grunn > 0 ? (p.del / grunn) * rest : rest / andreUlaaste.length) }
  })
  const avvik = avr2(100 - sumDel(ny))
  if (avvik) { const st = ny.filter((p, j) => j !== i && !p.last).reduce((m, p) => (p.del > m.del ? p : m)); st.del = avr2(st.del + avvik) }
  return ny
}
function leggTilPerson(personar, namn) {
  namn = (namn || '').trim()
  if (!namn || personar.some(p => nokkelNamn(p.namn) === nokkelNamn(namn))) return null
  if (!personar.length) return [{ namn, del: 100 }]
  if (!personar.some(p => !p.last)) return null
  const lastSum = sumDel(personar.filter(p => p.last))
  const tilgjengeleg = 100 - lastSum
  const nyDel = Math.min(Math.round(100 / (personar.length + 1)), tilgjengeleg)
  return [...fordelPaaUlaaste(personar, tilgjengeleg - nyDel), { namn, del: nyDel }]
}
function fjernPerson(personar, i) {
  const rest = personar.filter((_, j) => j !== i)
  if (!rest.length) return []
  const grunnlag = rest.some(p => !p.last) ? rest : rest.map(p => ({ ...p, last: false }))
  return normaliser(grunnlag)
}

const TH = { textAlign: 'right', fontSize: 10.5, fontWeight: 800, letterSpacing: '.04em', color: 'var(--text2)', padding: '6px 8px', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', background: 'var(--bg3)', position: 'sticky', top: 0, zIndex: 1 }
const TD = { padding: '2px 6px', fontSize: 12.5, borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--text)', height: 25 }
const GRAA = { background: 'var(--bg3)', color: 'var(--text2)' }

function Tal({ verdi, onLagre, placeholder, disabled, bredde = 80, tittel }) {
  const [v, setV] = useState(null)
  const vis = v ?? (verdi ?? '')
  const lagre = () => { if (v != null && String(v) !== String(verdi ?? '')) onLagre(v); setV(null) }
  return <input type="number" min="0" step="any" value={vis} disabled={disabled} placeholder={placeholder} title={tittel}
    onChange={e => setV(e.target.value)} onBlur={lagre} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setV(null); e.currentTarget.blur() } }}
    style={{ width: bredde, padding: '1px 5px', border: '1px solid transparent', borderRadius: 3, fontSize: 12.5, textAlign: 'right', fontFamily: 'var(--mono)', background: disabled ? 'var(--bg3)' : 'transparent', color: 'var(--text)' }}
    onFocus={e => { e.target.style.border = '1px solid var(--brand2)'; e.target.style.background = 'var(--bg2)' }}
    onBlurCapture={e => { e.target.style.border = '1px solid transparent'; e.target.style.background = disabled ? 'var(--bg3)' : 'transparent' }}/>
}
function Tekst({ verdi, onLagre, list, bredde = 150, placeholder }) {
  return <input defaultValue={verdi || ''} list={list} placeholder={placeholder} key={verdi}
    onBlur={e => { const n = e.target.value.trim(); if (n !== (verdi || '')) onLagre(n); e.target.style.border = '1px solid transparent' }}
    onFocus={e => { e.target.style.border = '1px solid var(--brand2)' }}
    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
    style={{ width: bredde, padding: '1px 5px', border: '1px solid transparent', borderRadius: 3, fontSize: 12.5, fontFamily: 'var(--font)', background: 'transparent', color: 'var(--text)' }}/>
}

export default function FramdriftBemanning({ el, summ, personell, prisar, forbrukKart, fargeKart, dokument, onEndre, onKopleLeveransar, onFerdigModus, onFerdig, hogde, onHogde, open, onOpen }) {
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
  const settPersonar = (arr) => onEndre({ personar: arr })

  const sum = rader.reduce((a, p) => {
    const t = timar * p.del / 100, r = rateFor(p), paa = faktiskFor(fk, p.namn)?.total || 0, fast = +p.fast || 0
    return { t: a.t + t, kost: a.kost + t * r + fast, fast: a.fast + fast, paa: a.paa + paa, kostPaa: a.kostPaa + paa * r }
  }, { t: 0, kost: 0, fast: 0, paa: 0, kostPaa: 0 })

  const ledige = (personell || []).filter(p => !personar.some(x => nokkelNamn(x.namn) === nokkelNamn(p.namn)))
  const leggTil = (namn) => { const ny = leggTilPerson(personar, namn); if (ny) settPersonar(ny); else window.alert('Kan ikkje leggje til — alle delane er låste, eller personen finst alt.') }

  // Ressurs timer (ISY): nye timar for éin ressurs → aktivitetens timar vert summen, belastning reknast om
  const settTimar = (idx, h) => {
    const nyH = Math.max(0, parseFloat(String(h).replace(',', '.')) || 0)
    const timarPer = personar.map((p, j) => (j === idx ? nyH : timar * p.del / 100))
    const total = timarPer.reduce((a, b) => a + b, 0)
    if (total <= 0) { onEndre({ personar: personar.map(p => ({ ...p, del: 100 / personar.length })), timar: 0, modus: 'timar' }); return }
    onEndre({ personar: normaliser(personar.map((p, j) => ({ ...p, del: timarPer[j] }))), timar: avr2(total), modus: 'timar' })
  }

  const startHogde = (ev) => {
    ev.preventDefault()
    const y0 = ev.clientY, h0 = hogde
    const klem = (e2) => Math.max(120, Math.min(Math.round(window.innerHeight * 0.7), Math.round(h0 - (e2.clientY - y0))))
    const mv = (e2) => onHogde(klem(e2), false)
    const opp = (e2) => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', opp); document.body.style.cursor = ''; onHogde(klem(e2), true) }
    document.body.style.cursor = 'row-resize'
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', opp)
  }

  const tittel = el ? `${el.namn}${el.kode ? ' (' + el.kode + ')' : ''}` : null

  return (
    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', marginTop: 8, border: '1.5px solid var(--border)', borderRadius: 'var(--r2)', background: 'var(--bg2)', overflow: 'hidden',
      height: open ? hogde : 36, minHeight: open ? 120 : 36, position: 'relative' }}>
      {open && <div onMouseDown={startHogde} title="Dra for å endre høgda" style={{ position: 'absolute', top: -3, left: 0, right: 0, height: 7, cursor: 'row-resize', zIndex: 5 }}/>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', height: 36, flexShrink: 0, background: 'var(--bg3)', borderBottom: open ? '1px solid var(--border)' : undefined }}>
        <button onClick={() => onOpen(!open)} title={open ? 'Skjul vindauget' : 'Vis vindauget'} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text3)', padding: 0 }}>{open ? '▾' : '▸'}</button>
        <span style={{ fontSize: 12.5, color: 'var(--text2)' }}>{tittel ? <>Valgt aktivitet: <b style={{ color: 'var(--text)' }}>{tittel}</b></> : 'Vel ein aktivitet i planen'}</span>
        <div className="fd-seg" style={{ marginLeft: 8 }}>
          <button className={fane === 'leveransar' ? 'pa' : ''} onClick={() => { setFane('leveransar'); onOpen(true) }}>Leveranseregister</button>
          <button className={fane === 'bemanning' ? 'pa' : ''} onClick={() => { setFane('bemanning'); onOpen(true) }}>Bemanningsregister</button>
        </div>
        <div style={{ flex: 1 }}/>
        {fane === 'bemanning' && el && !summ && (
          <button className="fd-knapp" style={{ padding: '2px 9px', fontSize: 11.5 }} disabled={!sum.kost}
            title="Set aktivitetens budsjett lik samla kostnad frå bemanninga (timar × rate + faste kostnader)"
            onClick={() => onEndre({ budsjett: Math.round(sum.kost), modus: 'timar' })}>Oppdater budsjett frå kostnad</button>
        )}
      </div>

      {open && (!el || summ ? (
        <div style={{ padding: 20, fontSize: 12.5, color: 'var(--text3)' }}>
          {summ ? 'Summasjonsaktivitetar og fasar har ikkje eiga bemanning — sum av underaktivitetane vert vist i tabellen. Vel ein underaktivitet.' : 'Klikk på ei aktivitetsrad i tidslinja eller tabellen for å sjå og endre bemanning og leveransar.'}
        </div>
      ) : fane === 'bemanning' ? (
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <datalist id="fd-bem-personell">{(personell || []).map(p => <option key={p.id} value={p.namn}/>)}</datalist>
          <table style={{ borderCollapse: 'collapse', minWidth: 1280, width: '100%' }}>
            <thead>
              <tr>
                <th style={{ ...TH, textAlign: 'left', width: 96 }}>Aktivitetskode</th>
                <th style={{ ...TH, textAlign: 'left', width: 190 }}>Navn</th>
                <th style={{ ...TH, textAlign: 'left', width: 220 }}>Ressursnavn</th>
                <th style={TH}>Ressurs timer</th><th style={TH}>Ressurs rate</th><th style={TH}>Ressurs faste kostnader</th>
                <th style={TH}>Kostnad</th><th style={TH}>Belastning</th><th style={{ ...TH, width: 26 }}/>
                <th style={{ ...TH, textAlign: 'left', width: 200 }}>Kommentar</th>
                <th style={TH}>Påløpte timer</th><th style={TH}>Påløpt kostnad</th><th style={TH}>Gjenst. timer</th><th style={TH}>Gjenst. kostnad</th><th style={{ ...TH, width: 26 }}/>
              </tr>
            </thead>
            <tbody>
              {rader.map((p) => {
                const idx = personar.findIndex(x => nokkelNamn(x.namn) === nokkelNamn(p.namn))
                const iPlan = idx >= 0
                const t = timar * p.del / 100, r = rateFor(p), paa = faktiskFor(fk, p.namn)?.total || 0, fast = +p.fast || 0
                const kost = t * r + fast
                return (
                  <tr key={p.namn} style={{ background: p.utanPlan ? 'var(--bg3)' : 'transparent' }}>
                    <td style={{ ...TD, ...GRAA, textAlign: 'left' }}>{el.kode || ''}</td>
                    <td style={{ ...TD, ...GRAA, textAlign: 'left', fontFamily: 'var(--font)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 190 }}>{el.namn}</td>
                    <td style={{ ...TD, textAlign: 'left', fontFamily: 'var(--font)', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: personFarge(p.namn, fargeKart), marginRight: 6, verticalAlign: 'middle' }}/>
                      {iPlan ? <Tekst verdi={p.namn} list="fd-bem-personell" bredde={190} onLagre={n => { if (n) settPersonar(personar.map((x, j) => (j === idx ? { ...x, namn: n } : x))) }}/>
                        : <span style={{ fontWeight: 600 }}>{p.namn} <span style={{ fontSize: 11, color: 'var(--text3)' }}>(ført timar, ikkje i planen)</span></span>}
                    </td>
                    <td style={TD}>{iPlan ? <Tal verdi={avr2(t) || ''} bredde={78} tittel="Planlagde timar for ressursen — aktivitetens timar vert summen av ressurstimane"
                      onLagre={h => settTimar(idx, h)}/> : ''}</td>
                    <td style={TD}>{iPlan ? <Tal verdi={p.pris || ''} placeholder={r ? String(Math.round(r)) : 'kr/t'} bredde={72} tittel={p.pris ? 'Eigen timerate i denne aktiviteten' : 'Tomt = timerate frå Personell (eller aktivitetens timerate)'}
                      onLagre={v => { const n = parseFloat(v); settPersonar(personar.map((x, j) => (j === idx ? { ...x, pris: n > 0 ? n : null } : x))) }}/> : kr(r)}</td>
                    <td style={TD}>{iPlan ? <Tal verdi={p.fast || ''} bredde={84} tittel="Faste kostnader (utlegg o.l.) som kjem i tillegg til timer × rate"
                      onLagre={v => { const n = parseFloat(v); settPersonar(personar.map((x, j) => (j === idx ? { ...x, fast: n > 0 ? n : null } : x))) }}/> : ''}</td>
                    <td style={{ ...TD, ...GRAA }}>{kr(kost)}</td>
                    <td style={TD}>{iPlan ? (personar.length > 1
                      ? <><Tal verdi={Math.round(p.del * 10) / 10} disabled={p.last} bredde={58} tittel="Ressursens del av aktivitetens timar (%)" onLagre={v => { const ny = settBelastning(personar, idx, v); if (ny) settPersonar(ny) }}/><span style={{ color: 'var(--text3)' }}>%</span></>
                      : '100 %') : ''}</td>
                    <td style={{ ...TD, padding: '1px 2px' }}>{iPlan && personar.length > 1 && (
                      <button onClick={() => settPersonar(personar.map((x, j) => (j === idx ? { ...x, last: !x.last } : x)))} title={p.last ? 'Belastninga er låst — klikk for å låse opp' : 'Lås belastninga'}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, opacity: p.last ? 1 : .35 }}>{p.last ? '🔒' : '🔓'}</button>)}</td>
                    <td style={{ ...TD, textAlign: 'left', fontFamily: 'var(--font)' }}>{iPlan ? <Tekst verdi={p.kommentar} bredde={190} placeholder="Kommentar" onLagre={n => settPersonar(personar.map((x, j) => (j === idx ? { ...x, kommentar: n } : x)))}/> : ''}</td>
                    <td style={{ ...TD, color: '#1565C0', fontWeight: 700 }}>{t1(paa)}</td>
                    <td style={{ ...TD, color: '#1565C0' }}>{kr(paa * r)}</td>
                    <td style={{ ...TD, color: t - paa < 0 ? 'var(--danger)' : undefined }}>{iPlan || paa ? t1(avr2(t - paa)) : ''}</td>
                    <td style={{ ...TD, color: kost - paa * r < 0 ? 'var(--danger)' : undefined }}>{iPlan || paa ? kr(kost - paa * r) : ''}</td>
                    <td style={{ ...TD, padding: '1px 4px' }}>{iPlan
                      ? <button onClick={() => settPersonar(fjernPerson(personar, idx))} title="Fjern ressursen frå aktiviteten" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 16, lineHeight: 1 }}>×</button>
                      : <button className="fd-knapp" style={{ padding: '1px 7px', fontSize: 11 }} onClick={() => leggTil(p.namn)} title="Ta med i bemanninga">＋</button>}</td>
                  </tr>
                )
              })}
              {/* tom rad for å legge til ressurs (som i ISY) */}
              <tr>
                <td style={{ ...TD, ...GRAA }}/><td style={{ ...TD, ...GRAA }}/>
                <td style={{ ...TD, textAlign: 'left', fontFamily: 'var(--font)' }}>
                  <select value="" onChange={e => { if (e.target.value) leggTil(e.target.value) }} style={{ width: 210, fontSize: 12.5, padding: '2px 3px', border: '1px solid var(--border)', borderRadius: 3, background: 'var(--bg2)', color: 'var(--text)' }}>
                    <option value="">＋ Vel ressurs…</option>
                    {ledige.map(p => <option key={p.id} value={p.namn}>{p.namn}{p.timepris ? ` — ${p.timepris} kr/t` : ''}</option>)}
                  </select>
                </td>
                {Array.from({ length: 12 }, (_, i) => <td key={i} style={TD}/>)}
              </tr>
              {rader.length > 0 && (
                <tr style={{ background: 'var(--bg3)', fontWeight: 800 }}>
                  <td style={{ ...TD, textAlign: 'left', fontFamily: 'var(--font)' }} colSpan={3}>Sum</td>
                  <td style={TD}>{t1(avr2(sum.t))}</td><td style={TD}>{sum.t ? kr((sum.kost - sum.fast) / sum.t) : ''}</td><td style={TD}>{kr(sum.fast)}</td>
                  <td style={TD}>{kr(sum.kost)}</td><td style={TD}>{personar.length ? '100 %' : ''}</td><td style={TD}/><td style={TD}/>
                  <td style={{ ...TD, color: '#1565C0' }}>{t1(sum.paa)}</td><td style={{ ...TD, color: '#1565C0' }}>{kr(sum.kostPaa)}</td>
                  <td style={TD}>{t1(avr2(sum.t - sum.paa))}</td><td style={TD}>{kr(sum.kost - sum.kostPaa)}</td><td style={TD}/>
                </tr>
              )}
            </tbody>
          </table>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', flexWrap: 'wrap' }}>
            {personar.length > 1 && <button className="fd-knapp" onClick={() => settPersonar(likeDelar(personar).map(p => ({ ...p })))} title="Fordel timane likt på alle ulåste ressursar">Jamt</button>}
            <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>Skriv timar per ressurs — aktivitetens timar vert summen. Belastning er ressursens del av timane (ikkje av beløpet). Rate her overstyrer prosjektets timerate for denne aktiviteten.</span>
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
