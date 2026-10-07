import { useState, useMemo, useEffect, useCallback } from 'react'
import DataTabell from './DataTabell'
import useFlyttbartVindauge from './useFlyttbartVindauge'
import NummereringVal from './NummereringVal'
import { STANDARD_NUMMERERING, dømeDelar } from './teikningsnummer'
import {
  PROSJEKTTYPAR, TEIKNINGSTYPAR, TYPE_NAMN_LISTE, typeKeyFraNamn, STANDARD_MALESTOKK, STANDARD_DETALJAR,
  nyttBygg, nyByggId, genererRader, genererForslag, FAG_NAMN,
} from './leveranseplanGenerator'

// ═══════════════════════════════════════════════════════════════════
//  Leveranseplan (DTM, sjå claude/dtm-modul.md) — justerbart vindauge der
//  brukar legg inn prosjekttype og bygg (matrise), og appen foreslår
//  teikningane som ei redigerbar tabell. «Opprett» lagar PLANLAGDE rader i
//  DTM-registeret (utan fil) — når den ferdige fila seinare vert importert
//  med same dokumentnummer, vert den kopla til same rad.
//  Reglane for kva teikningar som vert foreslått ligg i leveranseplan-
//  Generator.js. Utkastet (bygg + val) vert hugsa per prosjekt i localStorage.
// ═══════════════════════════════════════════════════════════════════

const TALFELT = [
  { key: 'fasadar',   namn: 'Fasadar',          min: 0, tips: 'Tal fasadar — ei fasadeteikning per fasade' },
  { key: 'etasjar',   namn: 'Etasjar',          min: 0, tips: 'Tal etasjar over bakken (utan kjeller/underetasje, som er eigne val)' },
  { key: 'vatrom',    namn: 'Ulike våtrom',     min: 0, tips: 'Tal ULIKE våtromstypar — eitt våtromsskjema kvar. 0 = bygget har ikkje våtrom' },
  { key: 'trapperom', namn: 'Trapperom',        min: 0, tips: 'Tal trapperom — eitt trappeskjema kvart' },
]
const MALESTOKK_FELT = [
  ['plan', 'Planar'], ['takplan', 'Takplan'], ['himlingsplan', 'Himlingsplanar'], ['snitt', 'Snitt'],
  ['fasade', 'Fasadar'], ['detalj', 'Detaljar'], ['skjema', 'Skjema'], ['trappeskjema', 'Trappeskjema'],
  ['situasjonsplan', 'Situasjonsplan'],
]
const BYGGNAMN_VAL = [['ingen', 'Ikkje med'], ['for', 'Før namnet'], ['etter', 'Etter namnet']]

// v2: standardane vart endra 8. okt. 2026 (detalj 1:5, skjema 1:20, ny nummerering) —
// eit gamalt utkast skal ikkje overstyre dei.
const lagringsNokkel = (pid) => `liedlab-leveranseplan2:${pid}`
function lesUtkast(pid) {
  try { return JSON.parse(localStorage.getItem(lagringsNokkel(pid))) || null } catch { return null }
}

const KOLONNAR = [
  { key: 'bygg',      label: 'Bygg',        art: 'val',   redigerbar: true, w: 150 },
  { key: 'typeNamn',  label: 'Type',        art: 'val',   redigerbar: true, val: TYPE_NAMN_LISTE, w: 140 },
  { key: 'nr',        label: 'Nummer',      art: 'tekst', redigerbar: true, mono: true, w: 150 },
  { key: 'tittel',    label: 'Namn',        art: 'tekst', redigerbar: true, utanFilter: true, w: 340 },
  { key: 'malestokk', label: 'Målestokk',   art: 'val',   redigerbar: true, w: 100 },
  { key: 'status',    label: 'Status',      art: 'val',   beregna: true, w: 130 },
]

const feltEtikett = { fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 700 }
const tallInput = { width: 64, padding: '5px 6px', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 12.5,
  fontFamily: 'var(--font)', background: 'var(--bg2)', color: 'var(--text)', textAlign: 'center' }

export default function LeveranseplanVindauge({ dokumenter, aktivtProsjekt, nummerering, onLagreNummerering, onOpprett, onLukk }) {
  const pid = aktivtProsjekt?.id
  const utkast = useMemo(() => lesUtkast(pid), [pid])
  const { v, startFlytt, startEndring, handtakStil, retningar } = useFlyttbartVindauge('liedlab-leveranseplan-vindauge')

  const [prosjekttype, setProsjekttype] = useState(utkast?.prosjekttype || 'detalj')
  const [bygg, setBygg] = useState(utkast?.bygg?.length ? utkast.bygg : [nyttBygg('Bygg 1')])
  const [situasjonsplan, setSituasjonsplan] = useState(utkast?.situasjonsplan !== false)
  const [malestokk, setMalestokk] = useState({ ...STANDARD_MALESTOKK, ...(utkast?.malestokk || {}) })
  const [detaljar, setDetaljar] = useState(utkast?.detaljar || STANDARD_DETALJAR.map(d => ({ ...d })))
  const [fag, setFag] = useState(utkast?.fag || 'A')
  const [byggnamnPlass, setByggnamnPlass] = useState(utkast?.byggnamnPlass || 'ingen')
  // Prosjektet sitt nummereringsoppsett (delt med KS og Prosjekt-modulen) — endringar vert lagra i prosjektet.
  const [numm, setNumm] = useState(() => ({ ...STANDARD_NUMMERERING, ...(nummerering || {}) }))
  const endreNumm = (n) => { setNumm(n); onLagreNummerering?.(n) }
  const [visDetaljar, setVisDetaljar] = useState(false)

  const [steg, setSteg] = useState('input') // 'input' | 'forslag' | 'ferdig'
  const [rader, setRader] = useState([])
  const [valde, setValde] = useState(() => new Set())
  const [opprettar, setOpprettar] = useState(false)
  const [feil, setFeil] = useState('')
  const [resultat, setResultat] = useState(null)

  useEffect(() => {
    try { localStorage.setItem(lagringsNokkel(pid), JSON.stringify({ prosjekttype, bygg, situasjonsplan, malestokk, detaljar, fag, byggnamnPlass })) }
    catch { /* privat modus */ }
  }, [pid, prosjekttype, bygg, situasjonsplan, malestokk, detaljar, fag, byggnamnPlass])

  const aktivType = PROSJEKTTYPAR.find(p => p.key === prosjekttype)
  const inn = useMemo(() => ({ bygg, situasjonsplan, malestokk, detaljar, byggnamnPlass }), [bygg, situasjonsplan, malestokk, detaljar, byggnamnPlass])
  const antalForventa = useMemo(() => (aktivType?.klar ? genererRader(inn).length : 0), [inn, aktivType])
  const byggNamn = bygg.map(b => b.namn.trim())
  const byggFeil = !bygg.length ? 'Legg til minst eitt bygg.'
    : byggNamn.some(n => !n) ? 'Alle bygg må ha eit namn.'
    : new Set(byggNamn.map(n => n.toLowerCase())).size !== byggNamn.length ? 'Byggnamna må vere ulike.' : ''
  const detaljSum = detaljar.reduce((s, d) => s + (+d.tal || 0), 0)

  const oppdaterBygg = (id, felt, verdi) => setBygg(bs => bs.map(b => (b.id === id ? { ...b, [felt]: verdi } : b)))
  const tal = (verdi, min = 0) => Math.max(min, Math.min(99, parseInt(verdi, 10) || 0))

  const lagForslag = () => {
    const eksisterande = dokumenter.map(d => d.nr)
    setRader(genererForslag(inn, { fag: fag.trim().toUpperCase() || 'A', prosjekttype, nummerering: numm, eksisterandeNr: eksisterande }))
    setValde(new Set()); setFeil(''); setSteg('forslag')
  }

  // ── Forslagstabellen ──
  const eksisterandeNr = useMemo(() => new Set(dokumenter.map(d => d.nr.toUpperCase())), [dokumenter])
  const statusFor = useCallback((r) => {
    const nr = r.nr.trim().toUpperCase()
    if (!nr) return 'Manglar nummer'
    if (rader.filter(x => x.nr.trim().toUpperCase() === nr).length > 1) return 'Dobbelt nummer'
    if (eksisterandeNr.has(nr)) return 'Finst alt i DTM'
    return 'Ny'
  }, [rader, eksisterandeNr])
  const tellingar = useMemo(() => {
    const t = { Ny: 0, 'Finst alt i DTM': 0, 'Manglar nummer': 0, 'Dobbelt nummer': 0 }
    rader.forEach(r => { t[statusFor(r)]++ })
    return t
  }, [rader, statusFor])

  const hentVerdi = useCallback((r, key) => {
    if (key === 'typeNamn') return TEIKNINGSTYPAR[r.type]?.namn || 'Anna'
    if (key === 'status') return statusFor(r)
    return r[key] ?? ''
  }, [statusFor])

  const settVerdi = useCallback((id, key, verdi) => {
    setRader(rs => rs.map(r => {
      if (r.id !== id) return r
      if (key === 'typeNamn') return { ...r, type: typeKeyFraNamn(verdi) }
      return { ...r, [key]: String(verdi) }
    }))
  }, [])

  const leggTilRad = () => {
    setRader(rs => [...rs, { id: `r_${Date.now()}`, bygg: '', byggId: null, type: 'anna', nr: '', tittel: 'Ny teikning', malestokk: '' }])
  }
  const fjernValde = () => {
    setRader(rs => rs.filter(r => !valde.has(r.id)))
    setValde(new Set())
  }

  const opprett = async () => {
    setOpprettar(true); setFeil('')
    try {
      const nye = rader.filter(r => statusFor(r) === 'Ny').map(r => ({
        nr: r.nr.trim(), tittel: r.tittel.trim() || r.nr.trim(), bygg: r.bygg.trim(), malestokk: r.malestokk.trim(),
      }))
      const svar = await onOpprett(nye, { fase: aktivType.namn, fag: FAG_NAMN[fag.trim().toUpperCase()] || '' })
      setResultat({ opprettet: svar.opprettet, hoppaOver: tellingar['Finst alt i DTM'] })
      setSteg('ferdig')
    } catch (e) { setFeil(e.message) }
    setOpprettar(false)
  }

  const kanOpprette = tellingar.Ny > 0 && !tellingar['Manglar nummer'] && !tellingar['Dobbelt nummer']

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.42)', zIndex: 200 }}>
      <div style={{ position: 'fixed', left: v.x, top: v.y, width: v.w, height: v.h, background: 'var(--bg2)', borderRadius: 'var(--r2)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 70px rgba(0,0,0,.35)' }}>

        <div onMouseDown={startFlytt} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', flexShrink: 0,
          background: '#0F766E', cursor: 'move' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Leveranseplan</span>
          {steg === 'forslag' && <span style={{ fontSize: 12, color: 'rgba(255,255,255,.8)' }}>— forslag, {aktivType.namn}</span>}
          <div style={{ flex: 1 }}/>
          <button onClick={onLukk} title="Lukk" style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer',
            color: 'rgba(255,255,255,.85)', lineHeight: 1, padding: '2px 6px' }}>×</button>
        </div>

        {steg === 'input' && (
          <div style={{ flex: 1, overflow: 'auto', padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* 1. Type leveranse */}
            <section>
              <div style={{ ...feltEtikett, marginBottom: 8 }}>1 · Type leveranse</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {PROSJEKTTYPAR.map(p => (
                  <button key={p.key} type="button" onClick={() => setProsjekttype(p.key)}
                    style={{ padding: '10px 18px', borderRadius: 'var(--r)', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)',
                      border: `2px solid ${prosjekttype === p.key ? '#0F766E' : 'var(--border)'}`,
                      background: prosjekttype === p.key ? 'rgba(15,118,110,.10)' : 'var(--bg2)', minWidth: 170 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>{p.namn}</div>
                    <div style={{ fontSize: 11, color: p.klar ? 'var(--text3)' : 'var(--warn)' }}>
                      Fasenummer {p.fasekode}{p.klar ? '' : ' — forslag kjem seinare'}
                    </div>
                  </button>
                ))}
              </div>
              {!aktivType.klar && (
                <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--warn)' }}>
                  Forslag for {aktivType.namn.toLowerCase()} er ikkje bygd enno — vel Detaljprosjekt for å få forslag.
                </div>
              )}
            </section>

            {/* 2. Bygg-matrise */}
            <section>
              <div style={{ ...feltEtikett, marginBottom: 8 }}>2 · Bygg</div>
              <div style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--r)', overflow: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg3)' }}>
                      <th style={{ ...feltEtikett, textAlign: 'left', padding: '7px 10px' }}>Namn på bygg</th>
                      <th title="Byggnummer/sone, t.d. 1 eller 1A — vert ein del av teikningsnummeret (DS-356). Tomt = ingen bygg-del i nummeret" style={{ ...feltEtikett, padding: '7px 6px' }}>Bygg-nr.</th>
                      {TALFELT.slice(0, 2).map(f => <th key={f.key} title={f.tips} style={{ ...feltEtikett, padding: '7px 6px' }}>{f.namn}</th>)}
                      <th title="Eige plan- og himlingsplan for kjellaren (etasje U1)" style={{ ...feltEtikett, padding: '7px 6px' }}>Kjeller</th>
                      <th title="Eige plan- og himlingsplan for underetasjen (U1, eller U2 viss kjeller òg er med)" style={{ ...feltEtikett, padding: '7px 6px' }}>Underetasje</th>
                      {TALFELT.slice(2).map(f => <th key={f.key} title={f.tips} style={{ ...feltEtikett, padding: '7px 6px' }}>{f.namn}</th>)}
                      <th title="Gjev eit skjema «Glasfasade» (og ein glasfasadedetalj)" style={{ ...feltEtikett, padding: '7px 6px' }}>Glasfasade</th>
                      <th title="Skal det leverast IFC-modell for bygget? Då kjem han med i leveranseplanen" style={{ ...feltEtikett, padding: '7px 6px' }}>IFC</th>
                      <th style={{ width: 70 }}/>
                    </tr>
                  </thead>
                  <tbody>
                    {bygg.map(b => (
                      <tr key={b.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '5px 10px' }}>
                          <input value={b.namn} onChange={e => oppdaterBygg(b.id, 'namn', e.target.value)} placeholder="T.d. Hovudbygg"
                            style={{ ...tallInput, width: '100%', minWidth: 160, textAlign: 'left' }}/>
                        </td>
                        <td style={{ textAlign: 'center', padding: '5px 6px' }}>
                          <input value={b.nummer || ''} maxLength={4} placeholder="—" style={{ ...tallInput, width: 56, opacity: numm.medBygg ? 1 : .45 }}
                            title={numm.medBygg ? '' : 'Bygg er ikkje med i teikningsnummeret — slå på «Med bygg, sone/del» under Teikningsnummer'}
                            onChange={e => oppdaterBygg(b.id, 'nummer', e.target.value.toUpperCase().replace(/[^A-Z0-9ÆØÅ]/g, ''))}/>
                        </td>
                        {TALFELT.slice(0, 2).map(f => (
                          <td key={f.key} style={{ textAlign: 'center', padding: '5px 6px' }}>
                            <input type="number" min={f.min} value={b[f.key]} style={tallInput}
                              onChange={e => oppdaterBygg(b.id, f.key, tal(e.target.value, f.min))}/>
                          </td>
                        ))}
                        <td style={{ textAlign: 'center' }}><input type="checkbox" checked={b.kjeller} onChange={e => oppdaterBygg(b.id, 'kjeller', e.target.checked)}/></td>
                        <td style={{ textAlign: 'center' }}><input type="checkbox" checked={b.underetasje} onChange={e => oppdaterBygg(b.id, 'underetasje', e.target.checked)}/></td>
                        {TALFELT.slice(2).map(f => (
                          <td key={f.key} style={{ textAlign: 'center', padding: '5px 6px' }}>
                            <input type="number" min={f.min} value={b[f.key]} style={tallInput}
                              onChange={e => oppdaterBygg(b.id, f.key, tal(e.target.value, f.min))}/>
                          </td>
                        ))}
                        <td style={{ textAlign: 'center' }}><input type="checkbox" checked={!!b.glasfasade} onChange={e => oppdaterBygg(b.id, 'glasfasade', e.target.checked)}/></td>
                        <td style={{ textAlign: 'center' }}><input type="checkbox" checked={!!b.ifc} onChange={e => oppdaterBygg(b.id, 'ifc', e.target.checked)}/></td>
                        <td style={{ whiteSpace: 'nowrap', textAlign: 'right', paddingRight: 8 }}>
                          <button title="Dupliser bygget" className="dt-knapp" style={{ padding: '2px 8px', marginRight: 4 }}
                            onClick={() => setBygg(bs => [...bs, { ...b, id: nyByggId(), namn: `${b.namn} (kopi)` }])}>⧉</button>
                          <button title="Fjern bygget" className="dt-knapp" style={{ padding: '2px 8px' }}
                            onClick={() => setBygg(bs => bs.filter(x => x.id !== b.id))}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="dt-knapp" style={{ marginTop: 8 }} onClick={() => setBygg(bs => [...bs, nyttBygg(`Bygg ${bs.length + 1}`)])}>+ Legg til bygg</button>
              <span style={{ marginLeft: 12, fontSize: 11.5, color: 'var(--text3)' }}>
                Kvart bygg får eige teikningssett med unike nummer og namn.
              </span>
            </section>

            {/* 3. Målestokk og typiske detaljar */}
            <section>
              <div style={{ ...feltEtikett, marginBottom: 8 }}>3 · Målestokk og detaljar</div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                {MALESTOKK_FELT.map(([k, namn]) => (
                  <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={feltEtikett}>{namn}</span>
                    <input value={malestokk[k] || ''} onChange={e => setMalestokk(m => ({ ...m, [k]: e.target.value }))}
                      style={{ ...tallInput, width: 78 }}/>
                  </label>
                ))}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={feltEtikett}>Fagbokstav</span>
                  <input value={fag} maxLength={4} onChange={e => setFag(e.target.value)} style={{ ...tallInput, width: 60 }}/>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text2)', cursor: 'pointer', paddingBottom: 6 }}>
                  <input type="checkbox" checked={situasjonsplan} onChange={e => setSituasjonsplan(e.target.checked)}/>
                  Situasjonsplan (ein for heile prosjektet)
                </label>
              </div>
              <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={feltEtikett}>Byggnamn i teikningsnamnet</span>
                  <div className="dt-seg">
                    {BYGGNAMN_VAL.map(([k, t]) => (
                      <button key={k} type="button" className={byggnamnPlass === k ? 'på' : ''} onClick={() => setByggnamnPlass(k)}>{t}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <button className="dt-knapp" onClick={() => setVisDetaljar(v2 => !v2)}>
                  {visDetaljar ? '▾' : '▸'} Detaljteikningar per bygg ({detaljSum} stk)
                </button>
                {visDetaljar && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '8px 18px' }}>
                    {detaljar.map((d, i) => (
                      <label key={d.namn} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text2)' }}>
                        <input type="number" min={0} value={d.tal} style={{ ...tallInput, width: 52 }}
                          onChange={e => setDetaljar(ds => ds.map((x, j) => (j === i ? { ...x, tal: tal(e.target.value) } : x)))}/>
                        {d.namn}{d.krev === 'vatrom' ? ' (berre bygg med våtrom)' : d.krev === 'glasfasade' ? ' (berre bygg med glasfasade)' : ''}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* 4. Teikningsnummer */}
            <section>
              <div style={{ ...feltEtikett, marginBottom: 8 }}>4 · Teikningsnummer</div>
              <NummereringVal verdi={numm} onEndre={endreNumm}/>
              <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.6 }}>
                Same oppsett som i Prosjekt-modulen og Kvalitetssystemet (lagra i prosjektet). Fag, type og etasje er alltid med (DS-356).
                {!numm.medLopenummer && <b style={{ color: 'var(--warn)' }}> Utan løpenummer kan fleire teikningar få same nummer (t.d. fasadar) — rett dei i tabellen.</b>}
                {numm.medBygg && bygg.some(b => !(b.nummer || '').trim()) && <b style={{ color: 'var(--warn)' }}> Nokre bygg manglar byggnummer — dei får ingen bygg-del i nummeret.</b>}
              </div>
            </section>
          </div>
        )}

        {steg === 'forslag' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '14px 20px 0' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10, flexShrink: 0 }}>
              <button className="dt-knapp" onClick={() => setSteg('input')}>← Tilbake til bygg</button>
              <button className="dt-knapp" onClick={leggTilRad}>+ Legg til teikning</button>
              <button className="dt-knapp" onClick={fjernValde} disabled={!valde.size}>Fjern valde ({valde.size})</button>
              <div style={{ flex: 1 }}/>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                <b style={{ color: 'var(--success)' }}>{tellingar.Ny}</b> nye
                {tellingar['Finst alt i DTM'] > 0 && <> · {tellingar['Finst alt i DTM']} finst alt (vert hoppa over)</>}
                {(tellingar['Manglar nummer'] + tellingar['Dobbelt nummer']) > 0 &&
                  <b style={{ color: 'var(--danger)' }}> · {tellingar['Manglar nummer'] + tellingar['Dobbelt nummer']} må rettast (nummer manglar/dobbelt)</b>}
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 8, flexShrink: 0 }}>
              Nummerert etter DS-356 ({dømeDelar(numm).map(d => d.namn.toLowerCase()).join('-')}). Du kan rette nummer, namn og målestokk direkte i tabellen.
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, border: '1.5px solid var(--border)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
              <DataTabell
                rader={rader} kolonnar={KOLONNAR} hentVerdi={hentVerdi} radId={r => r.id}
                onSetVerdi={settVerdi} merking={{ valde, onEndre: setValde }} rutenettRedigering innhaldstilpassaBreidd
                radStil={r => { const s = statusFor(r); return s === 'Manglar nummer' || s === 'Dobbelt nummer' ? { background: 'rgba(185,28,28,.08)' } : s === 'Finst alt i DTM' ? { opacity: .55 } : undefined }}
                prefsKey="liedlab-leveranseforslag-v1" itemNamn="teikningar" defaultSortering={{ key: 'nr', dir: 'asc' }}
              />
            </div>
          </div>
        )}

        {steg === 'ferdig' && resultat && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 40 }}>✓</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{resultat.opprettet} planlagde dokument oppretta i DTM</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.7, maxWidth: 520 }}>
              {resultat.hoppaOver > 0 && <>{resultat.hoppaOver} fanst allereie og vart hoppa over. </>}
              Dei ligg i «Alle dokument»-fana utan fil. Når du importerer ferdig teikning med same dokumentnummer,
              vert fila kopla til den planlagde rada.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          {steg === 'input' && (
            <span style={{ fontSize: 12, color: byggFeil ? 'var(--danger)' : 'var(--text3)' }}>
              {byggFeil || (aktivType.klar ? `${bygg.length} bygg → ca. ${antalForventa} teikningar` : '')}
            </span>
          )}
          {feil && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{feil}</span>}
          <div style={{ flex: 1 }}/>
          {steg === 'input' && (<>
            <button className="dt-knapp" onClick={onLukk}>Avbryt</button>
            <button className="dt-knapp hovud" disabled={!aktivType.klar || !!byggFeil} onClick={lagForslag}>Lag forslag →</button>
          </>)}
          {steg === 'forslag' && (<>
            <button className="dt-knapp" onClick={onLukk}>Avbryt</button>
            <button className="dt-knapp hovud" disabled={!kanOpprette || opprettar} onClick={opprett}>
              {opprettar ? 'Opprettar…' : `Opprett ${tellingar.Ny} dokument i DTM`}
            </button>
          </>)}
          {steg === 'ferdig' && <button className="dt-knapp hovud" onClick={onLukk}>Lukk</button>}
        </div>

        {retningar.map(dir => (
          <div key={dir} onMouseDown={e => startEndring(dir, e)} title="Dra for å endre storleiken på vindauget" style={handtakStil(dir)}/>
        ))}
      </div>
    </div>
  )
}
