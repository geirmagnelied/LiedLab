import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import VeggTegning, { figurHogde } from './VeggTegning'
import { ALLE_RADER, vurderVegg } from './veggvelgarLogikk'
import { ROBUSTHEITSNIVA } from './veggvelgarKonfig'

// ═══════════════════════════════════════════════════════════════════
//  Veggvelgar — «Veggar på prosjektet»: kvar lagra vegg med ID (løpenummer 2 siffer), grafisk snitt, eigenskapar frå Norgips-tabellen,
//  kolonne for krav brukaren skriv inn per eigenskap, og kolonne med åtvaring når kravet er strengare enn veggen toler.
//  Utskrift: A3 liggande, valfritt standard tittelfelt (PrintArk).
// ═══════════════════════════════════════════════════════════════════

const finnRad = (v) => ALLE_RADER.find(r => r.id === v.resultat?.rad_id) || ALLE_RADER.find(r => r.kode === v.veggkode && r.familie === v.familie) || null
export const idTekst = (n) => String(n ?? 0).padStart(2, '0')
const ROBUST_NAMN = ['Lett', 'Normal', 'Auka', 'Høg']

const EIGENSKAPAR = [
  { k: 'tjukkleik', namn: 'Tjukkleik', eining: 'mm', kravNamn: 'Maks', verdi: v => v.tjukkleik },
  { k: 'brann', namn: 'Brann EI', eining: 'min', kravNamn: 'Krav', verdi: v => v.brann || '–' },
  { k: 'rw', namn: "R'w", eining: 'dB', kravNamn: 'Krav', verdi: v => v.rw ?? '–' },
  { k: 'hogde', namn: 'Maks høgde', eining: 'mm', kravNamn: 'Romhøgde', verdi: v => v.hogde ?? '–' },
  { k: 'robust', namn: 'Robustheit', eining: '', kravNamn: 'Krav', verdi: v => ROBUST_NAMN[v.robust] },
]
const pkKey = (k) => (k === 'rw' ? 'lyd' : k)   // namn i prosjektkrav-objektet

function Oppbygging({ v, rad }) {
  const bredd = (rad.materiale === 'tre' ? 'Tre' : rad.profilKode) + ' ' + rad.stenderBredde
  return (
    <div style={{ lineHeight: 1.35 }}>
      <div style={{ fontFamily: 'var(--mono, monospace)', fontWeight: 700, fontSize: '0.95em' }}>{rad.kode}</div>
      <div style={{ opacity: .75 }}>{rad.loysing === 'SD' || rad.loysing === 'TD' ? 'Dobbel' : 'Enkel'} stender, {bredd} mm</div>
      <div style={{ opacity: .75 }}>Plater {rad.lagKode}{rad.plateTjukkleik ? ' (' + rad.plateTjukkleik + ')' : ''}</div>
      {v.resultat?.variant && <div style={{ opacity: .75 }}>c/c {v.resultat.variant.cc}{v.resultat.variant.profil === 'CF' ? ', CF-profil' : ''}</div>}
    </div>
  )
}

// Ei rad (skjerm eller utskrift). `redig` = inputfelt, elles ren tekst.
function VeggRad({ v, rad, redig, onEndre, onSlett, px, hRadMm }) {
  const pk = v.prosjektkrav || {}
  const vur = vurderVegg(rad, pk, v.resultat?.variant)
  const sett = (k, val) => onEndre(v.id, { prosjektkrav: { ...pk, [k]: val } })
  const celle = { padding: redig ? '8px 8px' : '1.2mm 1.6mm', borderBottom: redig ? '1px solid var(--border)' : '0.25mm solid #000', borderRight: redig ? 'none' : '0.25mm solid #000', verticalAlign: 'top', fontSize: redig ? 12.5 : '2.9mm' }
  const INN = { width: redig ? 74 : '100%', padding: '3px 5px', border: '1px solid var(--border)', borderRadius: 5, fontSize: 12.5, background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font)' }
  return (
    <tr style={redig ? undefined : { height: hRadMm + 'mm' }}>
      <td style={{ ...celle, textAlign: 'center', fontWeight: 800, fontSize: redig ? 18 : '6mm' }}>{idTekst(v.lopenr)}</td>
      <td style={{ ...celle, background: '#fff' }}><VeggTegning rad={rad} cc={v.resultat?.variant?.cc} bredde={px}/></td>
      <td style={celle}><Oppbygging v={v} rad={rad}/></td>
      {EIGENSKAPAR.map(e => {
        const feil = vur.felt[e.k], pkv = pk[pkKey(e.k)]
        return (
          <td key={e.k} style={{ ...celle, background: feil ? (redig ? 'rgba(185,28,28,.07)' : '#f3d5d5') : undefined }}>
            <div style={{ fontWeight: 800, fontSize: redig ? 15 : '4mm', color: feil ? '#B91C1C' : undefined }}>{e.verdi(vur.verdi)}<span style={{ fontWeight: 400, opacity: .6, fontSize: '0.75em' }}> {e.eining}</span></div>
            <div style={{ marginTop: redig ? 6 : '1.2mm', fontSize: redig ? 11 : '2.5mm', opacity: redig ? 1 : .85 }}>
              <span style={{ opacity: .65 }}>{e.kravNamn}: </span>
              {redig
                ? (e.k === 'robust'
                  ? <select value={pkv || 0} onChange={ev => sett('robust', +ev.target.value)} style={INN}>{ROBUSTHEITSNIVA.map(r => <option key={r.verdi} value={r.verdi}>{r.namn}</option>)}</select>
                  : <input type="number" min="0" value={pkv || ''} placeholder="–" onChange={ev => sett(pkKey(e.k), Math.max(0, parseInt(ev.target.value, 10) || 0))} style={INN}/>)
                : <b>{e.k === 'robust' ? (pkv ? ROBUST_NAMN[pkv] : '–') : (pkv || '–')}</b>}
            </div>
          </td>
        )
      })}
      <td style={celle}>
        {redig
          ? (<>
            <input defaultValue={v.romnamn} onBlur={e => e.target.value !== v.romnamn && onEndre(v.id, { romnamn: e.target.value })} placeholder="Rom / bruk" style={{ ...INN, width: '100%', boxSizing: 'border-box', marginBottom: 4 }}/>
            <textarea defaultValue={v.merknad} onBlur={e => e.target.value !== v.merknad && onEndre(v.id, { merknad: e.target.value })} placeholder="Merknad" rows={2} style={{ ...INN, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}/>
          </>)
          : (<><b>{v.romnamn}</b><div style={{ opacity: .8 }}>{v.merknad}</div></>)}
      </td>
      <td style={{ ...celle, color: vur.adv.length ? '#B91C1C' : '#166534' }}>
        {vur.adv.length ? vur.adv.map((a, i) => <div key={i} style={{ marginBottom: 3 }}>⚠ {a}</div>) : <span style={{ opacity: .8 }}>{Object.values(pk).some(x => +x > 0) ? '✓ Krava er dekte' : ''}</span>}
        {redig && <button onClick={() => onSlett(v)} style={{ display: 'block', marginTop: 8, border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0 }}>Fjern frå prosjekt</button>}
      </td>
    </tr>
  )
}

const KOLONNEHODE = ['ID', 'Snitt', 'Oppbygging', ...EIGENSKAPAR.map(e => e.namn), 'Rom / merknad', 'Åtvaring']
// kolonnebreidder i mm (utskrift, sum 400)
const BREDDER_MM = [12, 100, 62, 22, 22, 22, 26, 24, 46, 64]

// ── Skjermvising ──
export function ProsjektVeggarTabell({ veggar, onEndre, onSlett, onSkrivUt }) {
  const rader = useMemo(() => veggar.map(v => ({ v, rad: finnRad(v) })), [veggar])
  const TH = { textAlign: 'left', padding: '8px 8px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text3)', background: 'var(--bg3)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 1 }
  if (!veggar.length) return <div style={{ padding: '18px 20px', fontSize: 13.5, color: 'var(--text3)' }}>Ingen veggar er lagde til dette prosjektet enno. Bruk <b>＋</b>-knappen framfor ei rad i forslaga.</div>
  return (
    <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
      <div style={{ padding: '10px 16px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>Skriv inn krava i kvar eigenskap. Appen åtvarar i siste kolonne når kravet er strengare enn veggen toler.</span>
        <button onClick={onSkrivUt} style={{ marginLeft: 'auto', padding: '7px 16px', border: 'none', borderRadius: 9, background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}>Skriv ut A3…</button>
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1050, marginTop: 8 }}>
        <thead><tr>{KOLONNEHODE.map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
        <tbody>{rader.map(({ v, rad }) => rad
          ? <VeggRad key={v.id} v={v} rad={rad} redig onEndre={onEndre} onSlett={onSlett} px={190}/>
          : <tr key={v.id}><td colSpan={KOLONNEHODE.length} style={{ padding: 10, fontSize: 12.5, color: 'var(--text3)' }}>{idTekst(v.lopenr)} · {v.veggkode} finst ikkje lenger i veggtabellen. <button onClick={() => onSlett(v)} style={{ border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer' }}>Fjern</button></td></tr>)}</tbody>
      </table>
    </div>
  )
}

// ── A3-utskrift ──
const TITTEL_KEY = (pid) => 'liedlab-veggark-tittel-v1-' + pid
const SKRIV_CSS = `
@page { size: A3 landscape; margin: 0 }
@media print {
  body > *:not(.veggark-portal) { display: none !important }
  .veggark-portal .no-print { display: none !important }
  .veggark-overlay { position: static !important; background: none !important; overflow: visible !important; padding: 0 !important }
  .veggark-ark { zoom: 1 !important; box-shadow: none !important; margin: 0 !important; page-break-after: always; break-after: page }
  html, body { background: #fff !important }
}`

export function PrintArk({ veggar, prosjekt, onLukk }) {
  const lagra = (() => { try { return JSON.parse(localStorage.getItem(TITTEL_KEY(prosjekt.id))) || {} } catch { return {} } })()
  const [tf, setTf] = useState({ vis: true, firma: 'Lied Arkitektur', tittel: 'Veggtypar', teikningsnr: '', rev: 'A', dato: new Date().toLocaleDateString('nb-NO'), teikna: '', kontrollert: '', ...lagra })
  const sett = (k, v) => setTf(x => { const n = { ...x, [k]: v }; try { localStorage.setItem(TITTEL_KEY(prosjekt.id), JSON.stringify(n)) } catch { /* */ } return n })
  const rader = useMemo(() => veggar.map(v => ({ v, rad: finnRad(v) })).filter(x => x.rad), [veggar])

  // Del radene i ark etter tilgjengeleg høgd (mm)
  const ark = useMemo(() => {
    const tilgj = 297 - 20 - 9 - 3 - (tf.vis ? 34 : 0)
    const sider = [[]]; let brukt = 0
    for (const x of rader) {
      const h = Math.max(24, figurHogde(x.rad, 0.1) + 6)
      if (brukt + h > tilgj && sider[sider.length - 1].length) { sider.push([]); brukt = 0 }
      sider[sider.length - 1].push({ ...x, h }); brukt += h
    }
    return sider
  }, [rader, tf.vis])

  const zoom = Math.min(1, Math.max(0.3, (window.innerWidth - 60) / 1587))
  const FELT = { padding: '1.5mm 2mm', borderRight: '0.25mm solid #000', fontSize: '2.8mm' }
  const inn = { padding: '5px 8px', border: '1px solid #bbb', borderRadius: 6, fontSize: 13, fontFamily: 'var(--font)', width: 130 }

  return createPortal((
    <div className="veggark-portal">
      <style>{SKRIV_CSS}</style>
      <div className="veggark-overlay" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(30,30,30,.78)', overflow: 'auto', padding: '16px 24px 40px' }}>
        <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', background: '#fff', borderRadius: 10, padding: '10px 14px', marginBottom: 14, position: 'sticky', top: 0, zIndex: 2, boxShadow: '0 2px 10px rgba(0,0,0,.25)' }}>
          <b style={{ fontSize: 14 }}>Utskrift A3 liggande</b>
          <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={tf.vis} onChange={e => sett('vis', e.target.checked)}/> Tittelfelt</label>
          {tf.vis && (<>
            <input style={inn} value={tf.firma} onChange={e => sett('firma', e.target.value)} placeholder="Føretak"/>
            <input style={inn} value={tf.tittel} onChange={e => sett('tittel', e.target.value)} placeholder="Teikningstittel"/>
            <input style={{ ...inn, width: 100 }} value={tf.teikningsnr} onChange={e => sett('teikningsnr', e.target.value)} placeholder="Teikn.nr"/>
            <input style={{ ...inn, width: 60 }} value={tf.rev} onChange={e => sett('rev', e.target.value)} placeholder="Rev"/>
            <input style={{ ...inn, width: 100 }} value={tf.dato} onChange={e => sett('dato', e.target.value)} placeholder="Dato"/>
            <input style={{ ...inn, width: 90 }} value={tf.teikna} onChange={e => sett('teikna', e.target.value)} placeholder="Teikna"/>
            <input style={{ ...inn, width: 90 }} value={tf.kontrollert} onChange={e => sett('kontrollert', e.target.value)} placeholder="Kontr."/>
          </>)}
          <button onClick={() => window.print()} style={{ marginLeft: 'auto', padding: '7px 18px', border: 'none', borderRadius: 9, background: '#0A0A0A', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Skriv ut / lagre som PDF</button>
          <button onClick={onLukk} style={{ padding: '7px 14px', border: '1px solid #bbb', borderRadius: 9, background: '#fff', cursor: 'pointer' }}>Lukk</button>
        </div>

        {ark.map((sida, si) => (
          <div key={si} className="veggark-ark" style={{ zoom, width: '420mm', height: '297mm', background: '#fff', color: '#000', margin: '0 auto 18px', boxShadow: '0 4px 24px rgba(0,0,0,.4)', position: 'relative', boxSizing: 'border-box', fontFamily: 'Arial, Helvetica, sans-serif', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: '10mm', top: '10mm', width: '400mm', height: '277mm', border: '0.5mm solid #000', boxSizing: 'border-box' }}>
              <table style={{ borderCollapse: 'collapse', width: '400mm', tableLayout: 'fixed' }}>
                <colgroup>{BREDDER_MM.map((b, i) => <col key={i} style={{ width: b + 'mm' }}/>)}</colgroup>
                <thead><tr style={{ height: '9mm' }}>{KOLONNEHODE.map(h => <th key={h} style={{ ...FELT, background: '#eee', textAlign: 'left', fontSize: '2.8mm', borderBottom: '0.35mm solid #000', textTransform: 'uppercase' }}>{h}</th>)}</tr></thead>
                <tbody>{sida.map(({ v, rad, h }) => <VeggRad key={v.id} v={v} rad={rad} redig={false} hRadMm={h} px="96mm"/>)}</tbody>
              </table>
              {tf.vis && (
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '30mm', borderTop: '0.5mm solid #000', display: 'grid', gridTemplateColumns: '70mm 1fr 40mm 40mm 28mm 28mm', background: '#fff' }}>
                  <div style={{ ...FELT, fontSize: '4.5mm', fontWeight: 800, display: 'flex', alignItems: 'center' }}>{tf.firma}</div>
                  <div style={FELT}><div style={{ opacity: .6 }}>Prosjekt</div><b style={{ fontSize: '4mm' }}>{prosjekt.nr} {prosjekt.namn}</b><div style={{ opacity: .6, marginTop: '2mm' }}>Tittel</div><b style={{ fontSize: '4.5mm' }}>{tf.tittel}</b></div>
                  <div style={FELT}><div style={{ opacity: .6 }}>Teikn.nr</div><b>{tf.teikningsnr}</b><div style={{ opacity: .6, marginTop: '2mm' }}>Rev.</div><b>{tf.rev}</b></div>
                  <div style={FELT}><div style={{ opacity: .6 }}>Dato</div><b>{tf.dato}</b><div style={{ opacity: .6, marginTop: '2mm' }}>Format / mål</div><b>A3 · 1:10 (snitt)</b></div>
                  <div style={FELT}><div style={{ opacity: .6 }}>Teikna</div><b>{tf.teikna}</b><div style={{ opacity: .6, marginTop: '2mm' }}>Kontr.</div><b>{tf.kontrollert}</b></div>
                  <div style={{ ...FELT, borderRight: 'none' }}><div style={{ opacity: .6 }}>Blad</div><b>{si + 1} / {ark.length}</b></div>
                </div>
              )}
            </div>
          </div>
        ))}
        {!ark[0]?.length && <div style={{ color: '#fff', textAlign: 'center', padding: 40 }}>Ingen veggar å skrive ut.</div>}
      </div>
    </div>
  ), document.body)
}
