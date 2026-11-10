import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import DatePicker from './DatePicker'
import {
  SEKSJONAR, KOLONNER, STANDARD_RAPPORTAR, ARK, tomtOppsett, periodeFra, datoNo, byggRapportData, valdeKolonnar,
  lagRapportPdf, lastNedPdf, rapportFilnamn, rapportArkivNamn,
} from './framdriftRapport'

// ═══════════════════════════════════════════════════════════════════
//  Rapport-vindauge i Prosjektplan: vel standardrapport (låst) eller ei delt eigen rapport, vel periode, førehandsvis og last ned PDF.
//  Eigne rapportar (framdrift_rapportar) vert lagra i prosjektet og er synlege for alle med tilgang til prosjektet.
//  Standardrapportane kan ikkje endrast — «Lag eigen kopi» startar ein ny rapport frå dei.
// ═══════════════════════════════════════════════════════════════════
const FELT = { padding: '6px 9px', borderRadius: 'var(--r)', border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font)', outline: 'none', width: '100%', boxSizing: 'border-box' }
const ETT = { fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.07em', margin: '14px 0 6px' }
const kopi = (o) => JSON.parse(JSON.stringify(o))
const VINDU_NOKKEL = 'liedlab.rapportVindu'
const MINB = 760, MINH = 460
const STANDARD_UT = { prognoseModus: 'manad', ark: { storleik: 'A4', retning: 'landskap' } }

export default function FramdriftRapportModal({ onLukk, prosjekt, userId, brukarNamn, kontorNamn, dokMap, elementer, forbrukRader, personell, kal, startValg = 'std-kunde' }) {
  const [eigne, setEigne] = useState([])
  const startNy = startValg === 'ny'
  const [valt, setValt] = useState(startNy ? 'ny' : startValg)        // 'std-…' | rapport-id (tal)
  const [oppsett, setOppsett] = useState(() => kopi(startNy ? tomtOppsett() : (STANDARD_RAPPORTAR.find(r => r.id === startValg) || STANDARD_RAPPORTAR[0]).oppsett))
  const [dirty, setDirty] = useState(startNy)
  const [laget, setLaget] = useState(startNy)            // «Ny rapport» som ikkje er lagra enno
  const [opptatt, setOpptatt] = useState(false)
  const [melding, setMelding] = useState('')
  const std = STANDARD_RAPPORTAR.find(r => r.id === valt)
  const lasen = !!std && !laget

  // ── Flyttbart/skalerbart vindauge (eigne dra-handtak, storleik hugsa i localStorage) ──
  const [geo, setGeo] = useState(() => {
    try { const g = JSON.parse(localStorage.getItem(VINDU_NOKKEL)); if (g && g.w >= MINB && g.h >= MINH) return { ...g, maks: false } } catch { /* ingen lagra storleik */ }
    const w = Math.min(1320, window.innerWidth - 40), h = Math.min(860, window.innerHeight - 40)
    return { x: Math.round((window.innerWidth - w) / 2), y: Math.round((window.innerHeight - h) / 2), w, h, maks: false }
  })
  const [dra, setDra] = useState(false)
  useEffect(() => { try { localStorage.setItem(VINDU_NOKKEL, JSON.stringify({ ...geo, maks: false })) } catch { /* ignorer */ } }, [geo])
  const startDra = (e, modus) => {
    if (geo.maks || e.button !== 0) return
    e.preventDefault(); setDra(true)
    const s = { mx: e.clientX, my: e.clientY, ...geo }
    const flytt = (ev) => {
      const dx = ev.clientX - s.mx, dy = ev.clientY - s.my
      let { x, y, w, h } = s
      if (modus === 'flytt') { x = s.x + dx; y = s.y + dy } else {
        if (modus.includes('e')) w = Math.max(MINB, s.w + dx)
        if (modus.includes('s')) h = Math.max(MINH, s.h + dy)
        if (modus.includes('w')) { const nw = Math.max(MINB, s.w - dx); x = s.x + (s.w - nw); w = nw }
        if (modus.includes('n')) { const nh = Math.max(MINH, s.h - dy); y = s.y + (s.h - nh); h = nh }
      }
      x = Math.min(Math.max(x, 120 - w), window.innerWidth - 120); y = Math.min(Math.max(y, 0), window.innerHeight - 40)
      setGeo(g => ({ ...g, x, y, w, h }))
    }
    const slutt = () => { window.removeEventListener('mousemove', flytt); window.removeEventListener('mouseup', slutt); setDra(false) }
    window.addEventListener('mousemove', flytt); window.addEventListener('mouseup', slutt)
  }
  const veksleMaks = () => setGeo(g => ({ ...g, maks: !g.maks }))

  const last =useCallback(async () => {
    const { data, error } = await supabase.from('framdrift_rapportar').select('*').eq('project_id', prosjekt.id).order('namn')
    if (error) { setMelding('Klarte ikkje hente delte rapportar: ' + error.message); return }
    setEigne(data || [])
  }, [prosjekt.id])
  useEffect(() => { last() }, [last])

  const velg = (v) => {
    if (dirty && !window.confirm('Forkaste ulagra endringar i rapporten?')) return
    setLaget(false); setDirty(false); setMelding('')
    const s = STANDARD_RAPPORTAR.find(r => r.id === v)
    const e = s ? null : eigne.find(r => String(r.id) === String(v))
    setValt(s ? s.id : e ? e.id : v)
    const ny = kopi(s ? s.oppsett : e ? { ...tomtOppsett(), ...e.oppsett } : tomtOppsett())
    setOppsett(o => ({ ...ny, periode: o.periode, prognoseModus: o.prognoseModus, ark: o.ark }))   // periode, prognose-visning og arkformat følgjer med mellom rapportane
  }
  const endre = (patch) => { setOppsett(o => ({ ...o, ...patch })); setDirty(true) }
  const setPeriode = (p) => setOppsett(o => ({ ...o, periode: { ...o.periode, ...p } }))   // periode er alltid redigerbar (rører ikkje «ulagra»)
  const setUt = (patch) => setOppsett(o => ({ ...o, ...patch }))                           // prognose-visning og arkformat er val ved utskrift — alltid redigerbare, òg for standardrapportar
  const setArk = (p) => setOppsett(o => ({ ...o, ark: { ...(o.ark || STANDARD_UT.ark), ...p } }))
  const veksleSek = (s) => endre({ seksjonar: { ...oppsett.seksjonar, [s]: !oppsett.seksjonar[s] } })
  const veksleKol = (s, k) => {
    const no = oppsett.kolonnar[s] || []
    endre({ kolonnar: { ...oppsett.kolonnar, [s]: no.includes(k) ? no.filter(x => x !== k) : KOLONNER[s].map(c => c.key).filter(x => x === k || no.includes(x)) } })
  }

  const periode = useMemo(() => periodeFra(oppsett), [oppsett])
  const data = useMemo(() => byggRapportData({ elementer, forbrukRader, personell, kal, periode, oppsett, dokMap }), [elementer, forbrukRader, personell, kal, periode, oppsett, dokMap])
  const antKol = useMemo(() => valdeKolonnar(oppsett, data.perioder).reduce((a, g) => a + g.kol.length, 0), [oppsett, data.perioder])
  const ark = oppsett.ark || STANDARD_UT.ark
  const prognoseModus = oppsett.prognoseModus || 'manad'

  // Førehandsvising = den ferdige PDF-en (laga på nytt, litt utsett, når noko vert endra)
  const [pdf, setPdf] = useState({ url: null, bytes: null, skala: 1, feil: '', lagar: false })
  const urlRef = useRef(null)
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current) }, [])
  useEffect(() => {
    if (!antKol) { setPdf(p => ({ ...p, url: null, bytes: null, feil: '', lagar: false })); return }
    let avbrutt = false
    setPdf(p => ({ ...p, lagar: true }))
    const t = setTimeout(async () => {
      try {
        const bytes = await lagRapportPdf({ data, oppsett, periode, prosjektNamn: prosjekt.name, prosjektNr: prosjekt.projectNumber, brukar: brukarNamn, kontor: kontorNamn })
        if (avbrutt) return
        const gammal = urlRef.current
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
        urlRef.current = url
        setPdf({ url, bytes, skala: bytes.skala || 1, feil: '', lagar: false })
        if (gammal) setTimeout(() => URL.revokeObjectURL(gammal), 2000)
      } catch (e) { if (!avbrutt) setPdf(p => ({ ...p, feil: e.message, lagar: false })) }
    }, 350)
    return () => { avbrutt = true; clearTimeout(t) }
  }, [data, oppsett, periode, antKol, prosjekt.name, prosjekt.projectNumber, brukarNamn, kontorNamn])

  // Oppdragsstien (låst i prosjektet): rapporten vert lagra i «1 Oppdragsleiing\4 Rapportering» når skrivebordsappen og stien finst
  const [oppdragsSti, setOppdragsSti] = useState('')
  useEffect(() => {
    let ok = true
    supabase.from('projects').select('details').eq('id', prosjekt.id).single().then(({ data: p }) => {
      if (ok) setOppdragsSti(p?.details?.oppdragsStiLast && p?.details?.oppdragsSti ? p.details.oppdragsSti : '')
    })
    return () => { ok = false }
  }, [prosjekt.id])
  const [lagraSti, setLagraSti] = useState(null)       // { mappe } etter vellykka lagring
  const harBru = typeof window !== 'undefined' && !!window.resultatdokumentAPI?.framdriftLagreRapport
  const lastNed = () => { if (pdf.bytes) lastNedPdf(pdf.bytes, rapportFilnamn(oppsett, prosjekt.projectNumber)) }
  const lagrePdf = async () => {
    if (!pdf.bytes) return
    const namn = rapportArkivNamn(oppsett, prosjekt.projectNumber, prosjekt.name, periode)
    if (!harBru || !oppdragsSti) {          // ingen mappe å lagre i (nettleser, gammal skrivebordsapp eller oppdragsstien er ikkje låst): vanleg nedlasting
      lastNedPdf(pdf.bytes, namn)
      setMelding(harBru ? 'Oppdragsstien er ikkje låst i prosjektet, so PDF-en vart lasta ned i staden. Lås stien under Prosjekt for automatisk arkivering.' : 'Automatisk arkivering krev oppdatert skrivebordsapp (start appen på nytt) — PDF-en vart lasta ned.')
      return
    }
    setOpptatt(true); setMelding('')
    const svar = await window.resultatdokumentAPI.framdriftLagreRapport(oppdragsSti, namn, pdf.bytes)
    setOpptatt(false)
    if (!svar?.ok) { setMelding('Klarte ikkje lagre i oppdragsmappa: ' + (svar?.melding || 'ukjend feil')); return }
    setLagraSti({ mappe: svar.mappe })
    setMelding('Lagra i 1 Oppdragsleiing / 4 Rapportering: ' + String(svar.sti).split('/').pop().split(String.fromCharCode(92)).pop())
  }

  const lagreNy = async () => {
    const forslag = lasen ? STANDARD_RAPPORTAR.find(r => r.id === valt).namn + ' (eigen)' : (oppsett.tittel || 'Ny rapport')
    const namn = window.prompt('Namn på rapporten (synleg for alle i prosjektet):', forslag)
    if (!namn || !namn.trim()) return
    setOpptatt(true); setMelding('')
    const { data: rad, error } = await supabase.from('framdrift_rapportar').insert({ project_id: prosjekt.id, namn: namn.trim(), oppsett: { ...oppsett, tittel: oppsett.tittel || namn.trim() }, created_by: userId }).select().single()
    setOpptatt(false)
    if (error) { setMelding('Klarte ikkje lagre: ' + error.message); return }
    await last(); setValt(rad.id); setLaget(false); setDirty(false); setMelding('Rapporten «' + rad.namn + '» er lagra og delt med prosjektet.')
  }
  const lagreEndring = async () => {
    setOpptatt(true); setMelding('')
    const { data: rad, error } = await supabase.from('framdrift_rapportar').update({ oppsett, updated_at: new Date().toISOString() }).eq('id', valt).select()
    setOpptatt(false)
    if (error || !rad?.length) { setMelding('Klarte ikkje lagre' + (error ? ': ' + error.message : ' — berre forfattaren eller ein administrator kan endre rapporten. Bruk «Lagre som ny».')); return }
    await last(); setDirty(false); setMelding('Endringane er lagra.')
  }
  const slett = async () => {
    const r = eigne.find(x => x.id === valt); if (!r) return
    if (!window.confirm('Slette rapporten «' + r.namn + '» for alle i prosjektet?')) return
    const { error } = await supabase.from('framdrift_rapportar').delete().eq('id', valt)
    if (error) { setMelding('Klarte ikkje slette: ' + error.message); return }
    await last(); setDirty(false); setValt('std-kunde'); setOppsett(o => ({ ...kopi(STANDARD_RAPPORTAR[0].oppsett), periode: o.periode }))
  }
  const lagKopi = () => { setLaget(true); setValt('ny'); setDirty(true); setOppsett(o => ({ ...o, tittel: o.tittel })) }
  const nyTom = () => {
    if (dirty && !window.confirm('Forkaste ulagra endringar i rapporten?')) return
    setLaget(true); setValt('ny'); setDirty(true); setMelding('')
    setOppsett(o => ({ ...tomtOppsett(), periode: o.periode }))
  }

  const eigenRad = !lasen && typeof valt === 'number' ? eigne.find(r => r.id === valt) : null
  const knapp = (prim) => ({ padding: '8px 14px', borderRadius: 'var(--r)', border: prim ? 'none' : '1.5px solid var(--border)', background: prim ? 'var(--brand)' : 'var(--bg2)', color: prim ? '#fff' : 'var(--text2)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' })

  const kantar = [['n', { top: -3, left: 10, right: 10, height: 7, cursor: 'ns-resize' }], ['s', { bottom: -3, left: 10, right: 10, height: 7, cursor: 'ns-resize' }],
    ['w', { left: -3, top: 10, bottom: 10, width: 7, cursor: 'ew-resize' }], ['e', { right: -3, top: 10, bottom: 10, width: 7, cursor: 'ew-resize' }],
    ['nw', { left: -3, top: -3, width: 14, height: 14, cursor: 'nwse-resize' }], ['ne', { right: -3, top: -3, width: 14, height: 14, cursor: 'nesw-resize' }],
    ['sw', { left: -3, bottom: -3, width: 14, height: 14, cursor: 'nesw-resize' }], ['se', { right: -3, bottom: -3, width: 14, height: 14, cursor: 'nwse-resize' }]]
  const vinduStil = geo.maks
    ? { left: 0, top: 0, width: '100vw', height: '100vh', borderRadius: 0 }
    : { left: geo.x, top: geo.y, width: geo.w, height: geo.h, borderRadius: 'var(--r2)' }
  const radioStil = { display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, marginBottom: 3, cursor: 'pointer' }

  return (
    // Flytande vindauge utan mørk bakgrunn: appen bak kan brukast medan rapporten er open
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', ...vinduStil, background: 'var(--bg2)', boxShadow: '0 20px 60px rgba(0,0,0,.4)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', pointerEvents: 'auto' }}>
        {!geo.maks && kantar.map(([m, st]) => <div key={m} onMouseDown={e => startDra(e, m)} style={{ position: 'absolute', zIndex: 5, ...st }}/>)}
        <div onMouseDown={e => { if (e.target.closest('button')) return; startDra(e, 'flytt') }} onDoubleClick={e => { if (!e.target.closest('button')) veksleMaks() }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px 11px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0, cursor: geo.maks ? 'default' : 'move', userSelect: 'none', background: 'var(--bg3)', borderRadius: geo.maks ? 0 : 'var(--r2) var(--r2) 0 0' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Rapport — {prosjekt.projectNumber ? prosjekt.projectNumber + ' ' : ''}{prosjekt.name}</div>
          <button onClick={veksleMaks} title={geo.maks ? 'Gjenopprett storleik' : 'Maksimer'} style={{ background: 'none', border: 'none', fontSize: 17, cursor: 'pointer', color: 'var(--text3)', lineHeight: 1, padding: '2px 6px' }}>{geo.maks ? '❐' : '☐'}</button>
          <button onClick={() => { if (!dirty || window.confirm('Lukke utan å lagre endringar i rapporten?')) onLukk() }} title="Lukk" style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text3)', lineHeight: 1, padding: '0 6px' }}>×</button>
        </div>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Oppsett */}
          <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '4px 18px 18px' }}>
            <div style={ETT}>Rapport</div>
            <select value={laget ? 'ny' : valt} onChange={e => velg(e.target.value === 'ny' ? 'ny' : (STANDARD_RAPPORTAR.some(r => r.id === e.target.value) ? e.target.value : Number(e.target.value)))} style={FELT}>
              <optgroup label="Standard (låst)">{STANDARD_RAPPORTAR.map(r => <option key={r.id} value={r.id}>{r.namn}</option>)}</optgroup>
              <optgroup label="Delte rapportar i prosjektet">{eigne.map(r => <option key={r.id} value={r.id}>{r.namn}</option>)}{eigne.length === 0 && <option disabled>(ingen enno)</option>}</optgroup>
              {laget && <optgroup label="Ny"><option value="ny">Ny rapport (ikkje lagra)</option></optgroup>}
            </select>
            {lasen && <div style={{ display: 'flex', gap: 6, marginTop: 8 }}><button onClick={lagKopi} style={{ ...knapp(false), padding: '5px 10px', fontSize: 12 }}>Lag eigen kopi</button></div>}
            {lasen && <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8, lineHeight: 1.5 }}>Standardrapportar er faste og kan ikkje endrast. Velg «Lag eigen kopi» for å tilpasse innhaldet.</div>}

            <div style={ETT}>Periode</div>
            <label style={radioStil}>
              <input type="radio" checked={oppsett.periode.modus !== 'eigen'} onChange={() => setPeriode({ modus: 'forrigeManad' })}/> Førre månad
            </label>
            <label style={radioStil}>
              <input type="radio" checked={oppsett.periode.modus === 'eigen'} onChange={() => setPeriode({ modus: 'eigen', fra: oppsett.periode.fra || periode.fra, til: oppsett.periode.til || periode.til })}/> Eigen periode
            </label>
            {oppsett.periode.modus === 'eigen' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <DatePicker modus="dato" value={oppsett.periode.fra || ''} vedTom={false} onChange={v => setPeriode({ fra: v })} style={{ ...FELT, padding: '5px 28px 5px 7px' }}/>
                <span style={{ color: 'var(--text3)' }}>–</span>
                <DatePicker modus="dato" value={oppsett.periode.til || ''} vedTom={false} onChange={v => setPeriode({ til: v })} style={{ ...FELT, padding: '5px 28px 5px 7px' }}/>
              </div>
            )}
            <div style={{ fontSize: 11.5, color: 'var(--brand)', fontWeight: 700, marginTop: 6, lineHeight: 1.5 }}>
              {datoNo(periode.fra)} – {datoNo(periode.til)}
              <div style={{ color: 'var(--text3)', fontWeight: 500 }}>Påløpt akkumulert: til og med {datoNo(periode.til)}. Prognose: frå dagen etter.</div>
            </div>

            <div style={ETT}>Prognose</div>
            {[['manad', 'Per månad'], ['veke', 'Per veke'], ['resterande', 'Berre resterande (sum)']].map(([v, t]) => (
              <label key={v} style={radioStil}><input type="radio" checked={prognoseModus === v} onChange={() => setUt({ prognoseModus: v })}/> {t}</label>
            ))}

            <div style={ETT}>Ark (PDF)</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={ark.storleik} onChange={e => setArk({ storleik: e.target.value })} style={{ ...FELT, flex: 1 }}>
                {Object.keys(ARK).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <select value={ark.retning} onChange={e => setArk({ retning: e.target.value })} style={{ ...FELT, flex: 2 }}>
                <option value="landskap">Landskap</option>
                <option value="portrett">Portrett</option>
              </select>
            </div>
            {pdf.skala < 0.85 && <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 6, lineHeight: 1.5 }}>Mange kolonnar: teksten er forminska til {Math.round(pdf.skala * 100)} % for å få plass på {ark.storleik} {ark.retning}. Vel eit større ark, portrett/landskap, eller færre kolonnar.</div>}

            <div style={ETT}>Overskrift</div>
            <input value={oppsett.tittel || ''} onChange={e => (lasen ? setUt : endre)({ tittel: e.target.value })} placeholder="Overskrift på rapporten" style={FELT}/>
            <input value={oppsett.undertittel || ''} onChange={e => (lasen ? setUt : endre)({ undertittel: e.target.value })} placeholder="Undertittel / merknad (valfri)" style={{ ...FELT, marginTop: 6 }}/>
            {lasen && <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 5, lineHeight: 1.5 }}>Overskrifta gjeld berre denne utskrifta av standardrapporten.</div>}

            {!lasen && (<>
              <div style={ETT}>Innhald</div>
              {SEKSJONAR.map(s => (
                <div key={s.key} style={{ marginBottom: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!oppsett.seksjonar[s.key]} onChange={() => veksleSek(s.key)}/> {s.namn}
                  </label>
                  {oppsett.seksjonar[s.key] && (
                    <div style={{ margin: '3px 0 0 24px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {KOLONNER[s.key].map(k => (
                        <label key={k.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text2)', cursor: 'pointer' }}>
                          <input type="checkbox" checked={(oppsett.kolonnar[s.key] || []).includes(k.key)} onChange={() => veksleKol(s.key, k.key)}/> {k.namn}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div style={ETT}>Rader</div>
              {[['fasar', 'Vis fasar/delaktivitetar (hierarki)'], ['delsum', 'Sum-rad for kvar delaktivitet/fase'], ['perPerson', 'Vis kvar person under aktiviteten (forbruk og prognose)'], ['sumrad', 'Sum-rad nedst'], ['berreMedTal', 'Skjul aktivitetar utan tal']].map(([k, t]) => (
                <label key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 13, marginBottom: 3, cursor: 'pointer' }}>
                  <input type="checkbox" style={{ marginTop: 3 }} checked={!!oppsett[k]} onChange={e => endre({ [k]: e.target.checked })}/> {t}
                </label>
              ))}
            </>)}
          </div>

          {/* Førehandsvising: den ferdige PDF-en */}
          <div style={{ flex: 1, minWidth: 0, position: 'relative', background: 'var(--bg4)', display: 'flex', flexDirection: 'column' }}>
            {antKol === 0 ? <div style={{ color: 'var(--danger)', fontSize: 13, padding: 18 }}>Vel minst ein seksjon og ei kolonne.</div>
              : pdf.feil ? <div style={{ color: 'var(--danger)', fontSize: 13, padding: 18 }}>Klarte ikkje lage PDF: {pdf.feil}</div>
              : pdf.url ? <iframe key={pdf.url} title="Førehandsvising av rapporten (PDF)" src={pdf.url + '#view=FitH'} style={{ flex: 1, border: 'none', width: '100%', pointerEvents: dra ? 'none' : 'auto', background: '#fff' }}/>
              : <div style={{ color: 'var(--text3)', fontSize: 13, padding: 18 }}>Lagar PDF…</div>}
            {pdf.lagar && pdf.url && <div style={{ position: 'absolute', top: 8, right: 22, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '2px 10px', fontSize: 11.5, color: 'var(--text3)', pointerEvents: 'none' }}>Oppdaterer…</div>}
            {pdf.url && <a href={pdf.url} target="_blank" rel="noreferrer" style={{ position: 'absolute', bottom: 8, right: 22, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '2px 10px', fontSize: 11.5, color: 'var(--brand)', textDecoration: 'none' }}>Opne PDF i eige fane ↗</a>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap' }}>
          <button onClick={nyTom} style={knapp(false)} title="Lag ein ny, eigen rapport frå botnen">＋ Ny</button>
          {melding && <span style={{ fontSize: 12.5, color: /^Klarte|berre|Vel/.test(melding) ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>{melding}</span>}
          <div style={{ flex: 1 }}/>
          {eigenRad && <button onClick={slett} style={{ ...knapp(false), color: 'var(--danger)', borderColor: 'var(--danger)' }}>Slett rapport</button>}
          {!lasen && !laget && eigenRad && <button onClick={lagreEndring} disabled={opptatt || !dirty} style={{ ...knapp(false), opacity: dirty ? 1 : .5 }}>Lagre endringar</button>}
          {!lasen && <button onClick={lagreNy} disabled={opptatt} style={knapp(false)}>{laget ? 'Lagre rapport…' : 'Lagre som ny…'}</button>}
          {lasen && <button onClick={lagreNy} disabled={opptatt} style={knapp(false)}>Lagre kopi som eigen rapport…</button>}
          {lagraSti && <button onClick={() => window.resultatdokumentAPI?.apneMappe?.(lagraSti.mappe)} style={knapp(false)}>Opne mappa</button>}
          <button onClick={lastNed} disabled={!pdf.bytes || pdf.lagar} style={{ ...knapp(false), opacity: pdf.bytes && !pdf.lagar ? 1 : .5 }} title="Last ned PDF-en til ei valfri mappe (ingen arkivering)">⬇ Last ned</button>
          <button onClick={lagrePdf} disabled={!pdf.bytes || pdf.lagar || opptatt} style={{ ...knapp(true), opacity: pdf.bytes && !pdf.lagar ? 1 : .5 }}
            title={harBru && oppdragsSti ? 'Lagrar PDF-en i oppdragsmappa: 1 Oppdragsleiing / 4 Rapportering' : 'Lastar ned PDF-en (arkivering krev skrivebordsappen og låst oppdragssti)'}>{pdf.lagar ? 'Lagar PDF…' : '💾 Lagre PDF'}</button>
        </div>
      </div>
    </div>
  )
}
