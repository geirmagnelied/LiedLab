import { Fragment, useEffect, useMemo, useState } from 'react'
import { likeDelar, fordelPaaUlaaste } from './FramdriftPersonarPanel'
import { prisFor } from './framdriftTimar'
import { BTYPAR, normAktType, ENDR_STATUSAR, ENDR_STATUS_FARGE } from './framdriftVerdiar'
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
function Tekst({ verdi, onLagre, list, bredde = 150, placeholder, disabled }) {
  return <input defaultValue={verdi || ''} list={list} placeholder={placeholder} key={verdi} disabled={disabled}
    onBlur={e => { const n = e.target.value.trim(); if (n !== (verdi || '')) onLagre(n); e.target.style.border = '1px solid transparent' }}
    onFocus={e => { e.target.style.border = '1px solid var(--brand2)' }}
    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
    style={{ width: bredde, padding: '1px 5px', border: '1px solid transparent', borderRadius: 3, fontSize: 12.5, fontFamily: 'var(--font)', background: 'transparent', color: 'var(--text)' }}/>
}

// ── Endringsregister: endringsmeldingar kopla til ein aktivitet. Revidert (kontoret) og godkjent av kunde har dei same kolonnane;
//    haka LEGG TIL godkjent verdi (elles revidert) på aktiviteten, og kan angrast ved å fjerne haka. ──
const tilTal = (v) => { const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return n > 0 ? n : null }
export const INNFELT = { padding: '2px 5px', border: '1px solid var(--border)', borderRadius: 3, fontSize: 12.5, background: 'var(--bg2)', color: 'var(--text)' }
// Talfelt utan opp/ned-piler: vanleg tekstfelt med same ramme som namnefeltet
export function TalFelt({ verdi, onLagre, disabled, bredde = 84 }) {
  const [v, setV] = useState(null)
  const vis = v ?? (verdi ? String(verdi).replace('.', ',') : '')
  const lagre = () => { if (v != null && v !== String(verdi ?? '').replace('.', ',')) onLagre(v); setV(null) }
  return <input type="text" inputMode="decimal" value={vis} disabled={disabled} onChange={e => setV(e.target.value)} onBlur={lagre}
    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setV(null); e.currentTarget.blur() } }}
    style={{ ...INNFELT, width: bredde, textAlign: 'right', fontFamily: 'var(--mono)', background: disabled ? 'var(--bg3)' : 'var(--bg2)' }}/>
}
function TekstFelt({ verdi, onLagre, bredde = 150, placeholder, disabled }) {
  return <input defaultValue={verdi || ''} placeholder={placeholder} key={verdi} disabled={disabled}
    onBlur={e => { const n = e.target.value.trim(); if (n !== (verdi || '')) onLagre(n) }}
    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
    style={{ ...INNFELT, width: bredde, fontFamily: 'var(--font)' }}/>
}
const krTekst = (n) => (n > 0 ? Math.round(n).toLocaleString('nb-NO') : '')

// ── Felles for registertabellane (Endringar, Bemanning): justerbare kolonnebreidder (dra i overskrifta), låsing av kolonnar
//    (høgreklikk overskrifta), høgreklikk-meny på rader, heile cella er innfelt, og hover/fokus-effekt. ──
const REG_CSS = `
.fd-reg td input { min-width: 0; }
.fd-reg { table-layout: fixed; border-collapse: collapse; }
.fd-reg td { padding: 0 !important; position: relative; transition: background .12s; overflow: hidden; }
.fd-reg td:not(:has(input,select)) { padding: 2px 8px !important; }
.fd-reg td input:not([type=checkbox]), .fd-reg td select { width: 100% !important; box-sizing: border-box; height: 100%; min-height: 25px; border: none !important; border-radius: 0 !important; background: transparent !important; padding: 3px 8px !important; outline: none; }
.fd-reg td input:disabled, .fd-reg td select:disabled { opacity: .7; cursor: not-allowed; }
.fd-reg td:focus-within { outline: 2px solid var(--brand); outline-offset: -2px; background: var(--bg2) !important; }
.fd-reg tbody tr:hover td { background: var(--brandbg); }
.fd-reg tbody tr:hover td:first-child { box-shadow: inset 3px 0 0 var(--brand2); }
.fd-reg th { overflow: visible; }
.reg-grip { position: absolute; right: -3px; top: 0; bottom: 0; width: 7px; cursor: col-resize; z-index: 3; }
.reg-grip:hover { background: rgba(21,101,192,.35); }
.fyll-hdl { display: none; position: absolute; right: 0; bottom: 0; width: 9px; height: 9px; background: var(--brand); border: 1px solid var(--bg2); cursor: crosshair; z-index: 4; }
.fd-reg td:focus-within .fyll-hdl { display: block; }
`
function useRegister(nokkel, standard) {
  const [b, setB] = useState(() => { try { const v = JSON.parse(localStorage.getItem(nokkel + '-b')); return Array.isArray(v) && v.length === standard.length ? v : standard } catch { return standard } })
  const [laasa, setLaasa] = useState(() => { try { return JSON.parse(localStorage.getItem(nokkel + '-l')) || [] } catch { return [] } })
  const [meny, setMeny] = useState(null)         // { x, y, kol } (overskrift) eller { x, y, rad } (rad)
  const lagreB = (n) => { try { localStorage.setItem(nokkel + '-b', JSON.stringify(n)) } catch { /* privat modus */ } }
  const start = (i, ev) => {
    ev.preventDefault(); ev.stopPropagation()
    const x0 = ev.clientX, b0 = b[i]
    const mv = (e2) => { const w = Math.max(36, Math.min(700, Math.round(b0 + e2.clientX - x0))); setB(x => x.map((v, j) => (j === i ? w : v))) }
    const opp = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', opp); setB(x => { lagreB(x); return x }) }
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', opp)
  }
  const tilbake = (i) => setB(x => { const n = x.map((v, j) => (j === i ? standard[i] : v)); lagreB(n); return n })
  const veksleLaas = (key) => setLaasa(l => { const n = l.includes(key) ? l.filter(k => k !== key) : [...l, key]; try { localStorage.setItem(nokkel + '-l', JSON.stringify(n)) } catch { /* privat modus */ } return n })
  return {
    b, tot: b.reduce((a, w) => a + w, 0), meny, setMeny, laast: (k) => laasa.includes(k), veksleLaas,
    kolonnar: () => <colgroup>{b.map((w, i) => <col key={i} style={{ width: w }}/>)}</colgroup>,
    grip: (i) => <span className="reg-grip" onMouseDown={e => start(i, e)} onDoubleClick={e => { e.stopPropagation(); tilbake(i) }} title="Dra for å endre breidda (dobbeltklikk = standard)"/>,
  }
}
// Høgreklikk-meny: lås/lås opp kolonne, eller slett rad (raud, nedst)
function RegMeny({ meny, onLukk, laast, onLaas, onSlett, slettTekst, slettBlokkert }) {
  if (!meny) return null
  const knapp = (fare, disabled) => ({ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', borderRadius: 6, background: 'transparent', color: fare ? '#B91C1C' : 'var(--text)', opacity: disabled ? .45 : 1, fontSize: 13, fontWeight: 600, cursor: disabled ? 'default' : 'pointer', fontFamily: 'var(--font)' })
  const hov = (fare, disabled) => ({ onMouseEnter: e => { if (!disabled) e.currentTarget.style.background = fare ? 'rgba(185,28,28,.10)' : 'var(--bg3)' }, onMouseLeave: e => { e.currentTarget.style.background = 'transparent' } })
  return (<>
    <div onMouseDown={onLukk} onContextMenu={e => { e.preventDefault(); onLukk() }} style={{ position: 'fixed', inset: 0, zIndex: 399 }}/>
    <div style={{ position: 'fixed', left: Math.min(meny.x, window.innerWidth - 280), top: Math.min(meny.y, window.innerHeight - 140), width: 270, zIndex: 400, padding: 5, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', boxShadow: 'var(--shadow-lg)' }}>
      {meny.kol != null && <>
        <button {...hov()} style={knapp()} onClick={() => { onLaas(meny.kol); onLukk() }}>{laast(meny.kol) ? '🔓 Lås opp kolonnen' : '🔒 Lås kolonnen for redigering'}</button>
        <div style={{ fontSize: 11, color: 'var(--text3)', padding: '4px 12px 6px', lineHeight: 1.4 }}>Låsing hindrar redigering for hand i kolonnen. Automatiske oppdateringar og import vert ikkje stoppa.</div>
      </>}
      {meny.rad != null && <>
        <div style={{ height: 1, background: 'var(--border)', margin: '0 4px 5px' }}/>
        <button {...hov(true, slettBlokkert)} style={knapp(true, slettBlokkert)} title={slettBlokkert || 'Slettinga må stadfestast og kan gjenopprettast med Angre'}
          onClick={() => { if (slettBlokkert) return; onSlett(meny.rad); onLukk() }}>🗑 {slettTekst}</button>
      </>}
    </div>
  </>)
}

// ── Endringsregister: endringsmeldingar kopla til ein aktivitet. Revidert (kontoret) og godkjent av kunde har dei same kolonnane;
//    haka LEGG TIL godkjent verdi (elles revidert) på aktiviteten, og kan angrast ved å fjerne haka. ──
const ENDR_KOL = ['nr', 'namn', 'akt', 'akttype', 'status', 'statusdato', 'rev.timar', 'rev.fastpris', 'rev.timepris', 'rev.produkt', 'god.timar', 'god.fastpris', 'god.timepris', 'god.produkt', 'overfor', 'slett']
const ENDR_STD = [86, 230, 220, 140, 140, 124, 104, 118, 104, 112, 104, 118, 104, 112, 130, 30]
function EndringsRegister({ aktivitetar, endringar, valgtId, nesteNr, onNy, onSett, onSettSamla, onFlytt, onSlett, onOverfor }) {
  const [utkast, setUtkast] = useState({ akt: '', namn: '' })
  const [fyll, setFyll] = useState(null)       // { key, kilde, mal } — pågåande dra-og-fyll
  const reg = useRegister('liedlab-fd-endr', ENDR_STD)
  const aktId = utkast.akt || (aktivitetar.some(a => a.id === valgtId) ? valgtId : (aktivitetar[0]?.id ?? ''))
  const legg = () => {
    if (!aktId) return
    onNy(aktId, { namn: utkast.namn.trim() })
    setUtkast(u => ({ ...u, namn: '' }))
  }
  const GRP = { ...TH, textAlign: 'center', background: 'var(--tabell-hovud, #A9C8EC)', color: '#000', borderLeft: '2px solid var(--text)' }
  const TH2 = { ...TH, background: 'var(--tabell-hovud, #A9C8EC)', color: '#000', fontWeight: 800 }
  const VENSTRE = { borderLeft: '2px solid var(--text)' }
  const i0 = (k) => ENDR_KOL.indexOf(k)
  const th = (k, innhald, stil, tittel) => (
    <th key={k} style={{ ...TH2, position: 'relative', ...(stil || {}) }} title={tittel} onContextMenu={e => { e.preventDefault(); reg.setMeny({ x: e.clientX, y: e.clientY, kol: k }) }}>
      {reg.laast(k) && <span style={{ fontSize: 9, marginRight: 3 }}>🔒</span>}{innhald}{reg.grip(i0(k))}
    </th>
  )
  const fyllTreff = (ri, k) => { if (!fyll || fyll.key !== k) return false; const [a, b] = fyll.mal > fyll.kilde ? [fyll.kilde + 1, fyll.mal] : [fyll.mal, fyll.kilde - 1]; return ri >= a && ri <= b }
  const fyllPatch = (en, key, kilde) => {
    if (key === 'namn') return { namn: kilde.namn }
    if (key === 'akttype') return { akttype: kilde.akttype || '' }
    if (key === 'status') return { status: kilde.status || '', statusDato: kilde.status ? (kilde.statusDato || new Date().toISOString().slice(0, 10)) : '' }
    const [g, felt] = key.split('.')
    return { [g]: { ...(en[g] || {}), [felt]: kilde[g]?.[felt] ?? null } }
  }
  const startFyll = (ev, ri, key) => {
    ev.preventDefault(); ev.stopPropagation()
    let mal = ri
    const mv = (e2) => { const tr = document.elementFromPoint(e2.clientX, e2.clientY)?.closest?.('tr[data-rad]'); if (!tr) return; mal = +tr.getAttribute('data-rad'); setFyll({ key, kilde: ri, mal }) }
    const opp = () => {
      window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', opp); setFyll(null)
      if (mal === ri) return
      const [a, b] = mal > ri ? [ri + 1, mal] : [mal, ri - 1]
      const patchar = []
      for (let i = a; i <= b; i++) { const en = endringar[i]; if (en && !en.overfort) patchar.push({ akt: en.akt, id: en.id, patch: fyllPatch(en, key, endringar[ri]) }) }
      if (patchar.length) { if (onSettSamla) onSettSamla(patchar); else patchar.forEach(p => onSett(p.akt, p.id, p.patch)) }
    }
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', opp)
  }
  // Celle-ramme: fyll-handtak (vist når cella har fokus) og markering av området som vert fylt
  const celle = (ri, k, stil, innhald, redigerbar) => (
    <td key={k} style={{ ...TD, ...(stil || {}), ...(fyllTreff(ri, k) ? { background: 'rgba(21,101,192,.18)' } : {}) }}>
      {innhald}{redigerbar && !reg.laast(k) && <span className="fyll-hdl" onMouseDown={e => startFyll(e, ri, k)} title="Dra opp eller ned for å fylle same verdi i radene"/>}
    </td>
  )
  const talCelle = (ri, en, g, felt, ekstra) => celle(ri, g + '.' + felt, ekstra,
    <TalFelt verdi={en[g]?.[felt] || ''} bredde={84} disabled={!!en.overfort || reg.laast(g + '.' + felt)}
      onLagre={v => onSett(en.akt, en.id, { [g]: { ...(en[g] || {}), [felt]: tilTal(v) } })}/>, !en.overfort)
  const produktCelle = (en, g) => <td key={g + '.produkt'} style={{ ...TD, ...GRAA }} title="Timebudsjett × timepris">{krTekst((en[g]?.timar || 0) * (en[g]?.timepris || 0))}</td>
  const slettEn = (en) => {
    if (en.overfort) { window.alert('Endringa er lagt til aktiviteten. Fjern haka «Lagt til» fyrst for å kunne slette ho.'); return }
    if (window.confirm('Slette endringa ' + (en.nr || '') + (en.namn ? ' «' + en.namn + '»' : '') + '?\n\nSlettinga kan gjenopprettast med «Angre» (Ctrl+Z) øvst i Prosjektplan.')) onSlett(en.akt, en.id)
  }
  const menyEn = reg.meny?.rad != null ? endringar.find(e => e.id === reg.meny.rad) : null
  return (
    <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
      <style>{REG_CSS}</style>
      <table className="fd-reg" style={{ width: reg.tot }}>
        {reg.kolonnar()}
        <thead>
          <tr>
            <th style={{ ...TH2, textAlign: 'left' }} colSpan={6}/>
            <th style={GRP} colSpan={4}>Revidert (frå kontoret)</th>
            <th style={GRP} colSpan={4}>Godkjent av kunde</th>
            <th style={{ ...TH2, ...VENSTRE }} colSpan={2}/>
          </tr>
          <tr>
            {th('nr', 'Endringsnr.', { textAlign: 'left' })}
            {th('namn', 'Namn på endring', { textAlign: 'left' })}
            {th('akt', 'Aktivitet', { textAlign: 'left' })}
            {th('akttype', 'Aktivitetstype', { textAlign: 'left' })}
            {th('status', 'Status', { textAlign: 'left' }, 'Utkast → Sendt til kunde → Godkjent / Avvist. Vert sett automatisk frå endringsvarselet, men kan òg endrast her.')}
            {th('statusdato', 'Statusdato', { textAlign: 'left' })}
            {['rev', 'god'].map((g, gi) => (
              <Fragment key={g}>
                {th(g + '.timar', 'Timebudsjett (t)', VENSTRE)}
                {th(g + '.fastpris', 'Endring fastpris (kr)')}
                {th(g + '.timepris', 'Timepris (kr/t)')}
                {th(g + '.produkt', 'Timer × pris (kr)', null, 'Timebudsjett × timepris')}
              </Fragment>
            ))}
            {th('overfor', 'Legg til aktivitet', VENSTRE, 'Legg til godkjende kostnader (elles reviderte) på aktiviteten. Fjern haka for å gå tilbake.')}
            <th style={{ ...TH2, position: 'relative' }}/>
          </tr>
        </thead>
        <tbody>
          {endringar.map((en, ri) => (
            <tr key={en.akt + ':' + en.id} data-rad={ri} style={{ background: en.overfort ? 'var(--bg3)' : 'transparent' }}
              onContextMenu={e => { e.preventDefault(); reg.setMeny({ x: e.clientX, y: e.clientY, rad: en.id }) }}>
              {celle(ri, 'nr', { textAlign: 'left', fontFamily: 'var(--font)' }, <TekstFelt verdi={en.nr} disabled={reg.laast('nr')} onLagre={n => onSett(en.akt, en.id, { nr: n })}/>)}
              {celle(ri, 'namn', { textAlign: 'left', fontFamily: 'var(--font)' }, <TekstFelt verdi={en.namn} placeholder="Namn på endring" disabled={reg.laast('namn')} onLagre={n => onSett(en.akt, en.id, { namn: n })}/>, true)}
              {celle(ri, 'akt', { textAlign: 'left', fontFamily: 'var(--font)' },
                <select value={en.akt} disabled={!!en.overfort || reg.laast('akt')} onChange={e => onFlytt(en.akt, Number(e.target.value) || e.target.value, en.id)} style={INNFELT}>
                  {aktivitetar.map(a => <option key={a.id} value={a.id}>{a.kode ? a.kode + ' ' : ''}{a.namn}</option>)}
                </select>)}
              {celle(ri, 'akttype', { textAlign: 'left', fontFamily: 'var(--font)' },
                <select value={normAktType(en.akttype)} disabled={!!en.overfort || reg.laast('akttype')} onChange={e => onSett(en.akt, en.id, { akttype: e.target.value })} style={INNFELT}>
                  {BTYPAR.map(t => <option key={t} value={t}>{t || '(ikkje sett)'}</option>)}
                </select>, !en.overfort)}
              {celle(ri, 'status', { textAlign: 'left', fontFamily: 'var(--font)' },
                <select value={en.status || ''} disabled={reg.laast('status')} title={en.varselTittel ? 'Endringsvarsel: ' + en.varselTittel : 'Ikkje kopla til eit endringsvarsel'}
                  onChange={e => onSett(en.akt, en.id, { status: e.target.value, statusDato: e.target.value ? new Date().toISOString().slice(0, 10) : '' })}
                  style={{ ...INNFELT, fontWeight: 700, color: ENDR_STATUS_FARGE[en.status] || 'var(--text3)' }}>
                  <option value="">(ingen)</option>
                  {ENDR_STATUSAR.map(t => <option key={t} value={t}>{t}</option>)}
                </select>, true)}
              {celle(ri, 'statusdato', { textAlign: 'left', fontFamily: 'var(--font)' },
                <input type="date" value={en.statusDato || ''} disabled={!en.status || reg.laast('statusdato')} onChange={e => onSett(en.akt, en.id, { statusDato: e.target.value })} style={INNFELT}/>)}
              {talCelle(ri, en, 'rev', 'timar', VENSTRE)}{talCelle(ri, en, 'rev', 'fastpris')}{talCelle(ri, en, 'rev', 'timepris')}{produktCelle(en, 'rev')}
              {talCelle(ri, en, 'god', 'timar', VENSTRE)}{talCelle(ri, en, 'god', 'fastpris')}{talCelle(ri, en, 'god', 'timepris')}{produktCelle(en, 'god')}
              <td style={{ ...TD, ...VENSTRE, textAlign: 'center', fontFamily: 'var(--font)' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: reg.laast('overfor') ? 'not-allowed' : 'pointer', fontSize: 12 }}
                  title={en.overfort ? 'Lagt til aktiviteten — fjern haka for å gå tilbake til førre verdiar' : 'Legg godkjende kostnader (elles reviderte) til aktiviteten'}>
                  <input type="checkbox" checked={!!en.overfort} disabled={reg.laast('overfor')} onChange={() => onOverfor(en.akt, en.id)} style={{ width: 16, height: 16, cursor: 'pointer' }}/>
                  {en.overfort ? <span style={{ color: 'var(--success)', fontWeight: 700 }}>Lagt til</span> : <span style={{ color: 'var(--text3)' }}>Legg til</span>}
                </label>
              </td>
              <td style={{ ...TD, padding: '1px 4px' }}>
                <button onClick={() => slettEn(en)} title="Slett endringa (høgreklikk på rada gir same val)" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 16, lineHeight: 1 }}>×</button>
              </td>
            </tr>
          ))}
          {/* Rad for ny endring */}
          <tr>
            <td style={{ ...TD, ...GRAA, textAlign: 'left', fontFamily: 'var(--font)' }}>{nesteNr}</td>
            <td style={{ ...TD, textAlign: 'left', fontFamily: 'var(--font)' }}>
              <input value={utkast.namn} placeholder="＋ Namn på ny endring" onChange={e => setUtkast(u => ({ ...u, namn: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') legg() }} style={INNFELT}/>
            </td>
            <td style={{ ...TD, textAlign: 'left', fontFamily: 'var(--font)' }}>
              <select value={aktId} onChange={e => setUtkast(u => ({ ...u, akt: Number(e.target.value) || e.target.value }))} style={INNFELT}>
                {aktivitetar.map(a => <option key={a.id} value={a.id}>{a.kode ? a.kode + ' ' : ''}{a.namn}</option>)}
              </select>
            </td>
            {Array.from({ length: 11 }, (_, i) => <td key={i} style={{ ...TD, ...(i === 3 || i === 7 ? VENSTRE : {}) }}/>)}
            <td style={{ ...TD, ...VENSTRE, textAlign: 'center' }}>
              <button className="fd-knapp hovud" style={{ padding: '2px 10px', fontSize: 12 }} disabled={!aktId} onClick={legg} title="Legg til endringa — fyll deretter inn kostnadane i rada">＋ Legg til</button>
            </td>
            <td style={TD}/>
          </tr>
        </tbody>
      </table>
      <div style={{ padding: '8px 12px', fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5 }}>
        Fyll inn timebudsjett, endring av fastpris og timepris, og den same raden med det kunden har godkjent. Haka LEGG TIL godkjende verdiar (er dei tomme, brukast dei reviderte) på aktiviteten:
        timane vert lagde til aktivitetens timar, og beløpet (fastpris + timar × timepris) vert lagt til budsjettet. Timepris gjeld berre timane i endringa — tidlegare estimerte timar og summar er uendra.
        Dra i kolonneoverskrifta for å endre breidd, høgreklikk for å låse kolonnen, og dra handtaket nede til høgre i ei vald celle for å fylle nedover. Høgreklikk ei rad for å slette (kan angrast).
        Du kan òg høgreklikke ein aktivitet og velje «Legg til endring».
      </div>
      <RegMeny meny={reg.meny} onLukk={() => reg.setMeny(null)} laast={reg.laast} onLaas={reg.veksleLaas}
        onSlett={(id) => { const en = endringar.find(e => e.id === id); if (en) slettEn(en) }}
        slettTekst={'Slett endringa ' + (menyEn?.nr || '')} slettBlokkert={menyEn?.overfort ? 'Endringa er lagt til aktiviteten — fjern haka «Lagt til» fyrst' : ''}/>
    </div>
  )
}

const BEM_KOL = ['kode', 'navn', 'ressurs', 'timer', 'rate', 'fast', 'kostnad', 'belastning', 'laas', 'kommentar', 'paaT', 'paaK', 'gjT', 'gjK', 'slett']
const BEM_STD = [100, 190, 230, 100, 90, 120, 100, 120, 30, 210, 100, 110, 100, 110, 30]
export default function FramdriftBemanning({ endr, fanePuls, el, summ, personell, prisar, forbrukKart, fargeKart, dokument, onEndre, onKopleLeveransar, onFerdigModus, onFerdig, hogde, onHogde, open, onOpen }) {
  const [fane, setFane] = useState('bemanning')
  const reg = useRegister('liedlab-fd-bem', BEM_STD)
  useEffect(() => { if (fanePuls?.n) { setFane(fanePuls.fane); onOpen(true) } }, [fanePuls?.n]) // eslint-disable-line react-hooks/exhaustive-deps
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

  // Fjern ressurs frå aktiviteten: ikkje mogleg når det er ført timar på ressursen; stadfesting, og kan angrast (Ctrl+Z i Prosjektplan)
  const fjernRes = (namn) => {
    const idx = personar.findIndex(x => nokkelNamn(x.namn) === nokkelNamn(namn)); if (idx < 0) return
    if ((faktiskFor(fk, namn)?.total || 0) > 0) { window.alert('«' + namn + '» kan ikkje fjernast: det er ført timar på ressursen i denne aktiviteten.'); return }
    if (window.confirm('Fjerne ressursen «' + namn + '» frå aktiviteten?\n\nSlettinga kan gjenopprettast med «Angre» (Ctrl+Z) øvst i Prosjektplan.')) settPersonar(fjernPerson(personar, idx))
  }
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
          <button className={fane === 'endringar' ? 'pa' : ''} onClick={() => { setFane('endringar'); onOpen(true) }}>Endringar{endr?.liste?.length ? ' (' + endr.liste.length + ')' : ''}</button>
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

      {open && (fane === 'endringar' && endr ? (
        <EndringsRegister aktivitetar={endr.aktivitetar} endringar={endr.liste} valgtId={el?.id} nesteNr={endr.nesteNr} onNy={endr.onNy} onSett={endr.onSett} onSettSamla={endr.onSettSamla} onFlytt={endr.onFlytt} onSlett={endr.onSlett} onOverfor={endr.onOverfor}/>
      ) : !el || summ ? (
        <div style={{ padding: 20, fontSize: 12.5, color: 'var(--text3)' }}>
          {summ ? 'Summasjonsaktivitetar og fasar har ikkje eiga bemanning — sum av underaktivitetane vert vist i tabellen. Vel ein underaktivitet.' : 'Klikk på ei aktivitetsrad i tidslinja eller tabellen for å sjå og endre bemanning og leveransar.'}
        </div>
      ) : fane === 'bemanning' ? (
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <datalist id="fd-bem-personell">{(personell || []).map(p => <option key={p.id} value={p.namn}/>)}</datalist>
          <style>{REG_CSS}</style>
          <table className="fd-reg" style={{ width: reg.tot }}>
            {reg.kolonnar()}
            <thead>
              <tr>
                {[['kode', 'Aktivitetskode', 'l'], ['navn', 'Navn', 'l'], ['ressurs', 'Ressursnavn', 'l'], ['timer', 'Ressurs timer'], ['rate', 'Ressurs rate'], ['fast', 'Ressurs faste kostnader'], ['kostnad', 'Kostnad'], ['belastning', 'Belastning'], ['laas', ''],
                  ['kommentar', 'Kommentar', 'l'], ['paaT', 'Påløpte timer'], ['paaK', 'Påløpt kostnad'], ['gjT', 'Gjenst. timer'], ['gjK', 'Gjenst. kostnad'], ['slett', '']].map(([k, t, l], i) => (
                  <th key={k} style={{ ...TH, position: 'sticky', textAlign: l ? 'left' : 'right' }} onContextMenu={e => { e.preventDefault(); if (k !== 'laas' && k !== 'slett') reg.setMeny({ x: e.clientX, y: e.clientY, kol: k }) }}>
                    {reg.laast(k) && <span style={{ fontSize: 9, marginRight: 3 }}>🔒</span>}{t}{reg.grip(i)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rader.map((p) => {
                const idx = personar.findIndex(x => nokkelNamn(x.namn) === nokkelNamn(p.namn))
                const iPlan = idx >= 0
                const t = timar * p.del / 100, r = rateFor(p), paa = faktiskFor(fk, p.namn)?.total || 0, fast = +p.fast || 0
                const kost = t * r + fast
                return (
                  <tr key={p.namn} style={{ background: p.utanPlan ? 'var(--bg3)' : 'transparent' }} onContextMenu={e => { e.preventDefault(); reg.setMeny({ x: e.clientX, y: e.clientY, rad: p.namn }) }}>
                    <td style={{ ...TD, ...GRAA, textAlign: 'left' }}>{el.kode || ''}</td>
                    <td style={{ ...TD, ...GRAA, textAlign: 'left', fontFamily: 'var(--font)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 190 }}>{el.namn}</td>
                    <td style={{ ...TD, textAlign: 'left', fontFamily: 'var(--font)', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ display: 'inline-block', flexShrink: 0, width: 10, height: 10, borderRadius: 3, background: personFarge(p.namn, fargeKart), margin: '0 6px 0 8px' }}/>
                      {nokkelNamn(p.namn) === nokkelNamn(el.ansvarleg) && <span title="Ansvarleg for aktiviteten" style={{ color: '#B45309', marginRight: 3 }}>★</span>}{iPlan ? <Tekst verdi={p.namn} list="fd-bem-personell" bredde={176} disabled={reg.laast('ressurs')} onLagre={n => { if (n) settPersonar(personar.map((x, j) => (j === idx ? { ...x, namn: n } : x))) }}/>
                        : <span style={{ fontWeight: 600 }}>{p.namn} <span style={{ fontSize: 11, color: 'var(--text3)' }}>(ført timar, ikkje i planen)</span></span>}
                      </div>
                    </td>
                    <td style={TD}>{iPlan ? <Tal verdi={avr2(t) || ''} bredde={78} disabled={reg.laast('timer')} tittel="Planlagde timar for ressursen — aktivitetens timar vert summen av ressurstimane"
                      onLagre={h => settTimar(idx, h)}/> : ''}</td>
                    <td style={TD}>{iPlan ? <Tal verdi={p.pris || ''} placeholder={r ? String(Math.round(r)) : 'kr/t'} bredde={72} disabled={reg.laast('rate')} tittel={p.pris ? 'Eigen timerate i denne aktiviteten' : 'Tomt = timerate frå Personell (eller aktivitetens timerate)'}
                      onLagre={v => { const n = parseFloat(v); settPersonar(personar.map((x, j) => (j === idx ? { ...x, pris: n > 0 ? n : null } : x))) }}/> : kr(r)}</td>
                    <td style={TD}>{iPlan ? <Tal verdi={p.fast || ''} bredde={84} disabled={reg.laast('fast')} tittel="Faste kostnader (utlegg o.l.) som kjem i tillegg til timer × rate"
                      onLagre={v => { const n = parseFloat(v); settPersonar(personar.map((x, j) => (j === idx ? { ...x, fast: n > 0 ? n : null } : x))) }}/> : ''}</td>
                    <td style={{ ...TD, ...GRAA }}>{kr(kost)}</td>
                    <td style={TD}>{iPlan ? (personar.length > 1
                      ? <div style={{ display: 'flex', alignItems: 'center', paddingRight: 8 }}><Tal verdi={Math.round(p.del * 10) / 10} disabled={p.last || reg.laast('belastning')} bredde={58} tittel="Ressursens del av aktivitetens timar (%)" onLagre={v => { const ny = settBelastning(personar, idx, v); if (ny) settPersonar(ny) }}/><span style={{ color: 'var(--text3)' }}>%</span></div>
                      : '100 %') : ''}</td>
                    <td style={{ ...TD, padding: '1px 2px' }}>{iPlan && personar.length > 1 && (
                      <button onClick={() => settPersonar(personar.map((x, j) => (j === idx ? { ...x, last: !x.last } : x)))} title={p.last ? 'Belastninga er låst — klikk for å låse opp' : 'Lås belastninga'}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, opacity: p.last ? 1 : .35 }}>{p.last ? '🔒' : '🔓'}</button>)}</td>
                    <td style={{ ...TD, textAlign: 'left', fontFamily: 'var(--font)' }}>{iPlan ? <Tekst verdi={p.kommentar} bredde={190} placeholder="Kommentar" disabled={reg.laast('kommentar')} onLagre={n => settPersonar(personar.map((x, j) => (j === idx ? { ...x, kommentar: n } : x)))}/> : ''}</td>
                    <td style={{ ...TD, color: '#1565C0', fontWeight: 700 }}>{t1(paa)}</td>
                    <td style={{ ...TD, color: '#1565C0' }}>{kr(paa * r)}</td>
                    <td style={{ ...TD, color: t - paa < 0 ? 'var(--danger)' : undefined }}>{iPlan || paa ? t1(avr2(t - paa)) : ''}</td>
                    <td style={{ ...TD, color: kost - paa * r < 0 ? 'var(--danger)' : undefined }}>{iPlan || paa ? kr(kost - paa * r) : ''}</td>
                    <td style={{ ...TD, padding: '1px 4px' }}>{iPlan
                      ? <button onClick={() => fjernRes(p.namn)} title="Fjern ressursen frå aktiviteten (høgreklikk på rada gir same val)" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 16, lineHeight: 1 }}>×</button>
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
          <RegMeny meny={reg.meny} onLukk={() => reg.setMeny(null)} laast={reg.laast} onLaas={reg.veksleLaas} onSlett={fjernRes}
            slettTekst={'Fjern ressursen ' + (reg.meny?.rad || '')} slettBlokkert={reg.meny?.rad && (faktiskFor(fk, reg.meny.rad)?.total || 0) > 0 ? 'Det er ført timar på ressursen — kan ikkje fjernast' : (reg.meny?.rad && !personar.some(x => nokkelNamn(x.namn) === nokkelNamn(reg.meny.rad)) ? 'Ressursen er ikkje med i planen' : '')}/>
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
