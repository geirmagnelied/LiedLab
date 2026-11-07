import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from './supabase'
import DatePicker from './DatePicker'
import {
  SEKSJONAR, KOLONNER, STANDARD_RAPPORTAR, tomtOppsett, periodeFra, datoNo, byggRapportData, valdeKolonnar, fmtVerdi,
  lagRapportPdf, lastNedPdf, rapportFilnamn,
} from './framdriftRapport'

// ═══════════════════════════════════════════════════════════════════
//  Rapport-vindauge i Prosjektplan: vel standardrapport (låst) eller ei delt eigen rapport, vel periode, førehandsvis og last ned PDF.
//  Eigne rapportar (framdrift_rapportar) vert lagra i prosjektet og er synlege for alle med tilgang til prosjektet.
//  Standardrapportane kan ikkje endrast — «Lag eigen kopi» startar ein ny rapport frå dei.
// ═══════════════════════════════════════════════════════════════════
const FELT = { padding: '6px 9px', borderRadius: 'var(--r)', border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font)', outline: 'none', width: '100%', boxSizing: 'border-box' }
const ETT = { fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.07em', margin: '14px 0 6px' }
const kopi = (o) => JSON.parse(JSON.stringify(o))

export default function FramdriftRapportModal({ onLukk, prosjekt, userId, brukarNamn, elementer, forbrukRader, personell, kal, startValg = 'std-kunde' }) {
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

  const last = useCallback(async () => {
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
    setOppsett(o => ({ ...ny, periode: o.periode }))   // valt periode følgjer med mellom rapportane
  }
  const endre = (patch) => { setOppsett(o => ({ ...o, ...patch })); setDirty(true) }
  const setPeriode = (p) => setOppsett(o => ({ ...o, periode: { ...o.periode, ...p } }))   // periode er alltid redigerbar (rører ikkje «ulagra»)
  const veksleSek = (s) => endre({ seksjonar: { ...oppsett.seksjonar, [s]: !oppsett.seksjonar[s] } })
  const veksleKol = (s, k) => {
    const no = oppsett.kolonnar[s] || []
    endre({ kolonnar: { ...oppsett.kolonnar, [s]: no.includes(k) ? no.filter(x => x !== k) : KOLONNER[s].map(c => c.key).filter(x => x === k || no.includes(x)) } })
  }

  const periode = useMemo(() => periodeFra(oppsett), [oppsett])
  const data = useMemo(() => byggRapportData({ elementer, forbrukRader, personell, kal, periode, oppsett }), [elementer, forbrukRader, personell, kal, periode, oppsett])
  const grupper = useMemo(() => valdeKolonnar(oppsett), [oppsett])
  const kol = grupper.flatMap(g => g.kol.map((k, i) => ({ ...k, sek: g.key, forst: i === 0 })))

  const lastNed = async () => {
    setOpptatt(true); setMelding('')
    try {
      const bytes = await lagRapportPdf({ data, oppsett, periode, prosjektNamn: prosjekt.name, prosjektNr: prosjekt.projectNumber, brukar: brukarNamn })
      lastNedPdf(bytes, rapportFilnamn(oppsett, prosjekt.projectNumber))
    } catch (e) { setMelding('Klarte ikkje lage PDF: ' + e.message) }
    setOpptatt(false)
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

  return (
    <div onMouseDown={e => { if (e.target === e.currentTarget && !dirty) onLukk() }} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: 'min(1320px, 98vw)', height: 'min(860px, 94vh)', background: 'var(--bg2)', borderRadius: 'var(--r2)', boxShadow: '0 20px 60px rgba(0,0,0,.35)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', flex: 1 }}>Rapport — {prosjekt.projectNumber ? prosjekt.projectNumber + ' ' : ''}{prosjekt.name}</div>
          <button onClick={() => { if (!dirty || window.confirm('Lukke utan å lagre endringar i rapporten?')) onLukk() }} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text3)', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Oppsett */}
          <div style={{ width: 330, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '4px 18px 18px' }}>
            <div style={ETT}>Rapport</div>
            <select value={laget ? 'ny' : valt} onChange={e => velg(e.target.value === 'ny' ? 'ny' : (STANDARD_RAPPORTAR.some(r => r.id === e.target.value) ? e.target.value : Number(e.target.value)))} style={FELT}>
              <optgroup label="Standard (låst)">{STANDARD_RAPPORTAR.map(r => <option key={r.id} value={r.id}>{r.namn}</option>)}</optgroup>
              <optgroup label="Delte rapportar i prosjektet">{eigne.map(r => <option key={r.id} value={r.id}>{r.namn}</option>)}{eigne.length === 0 && <option disabled>(ingen enno)</option>}</optgroup>
              {laget && <optgroup label="Ny"><option value="ny">Ny rapport (ikkje lagra)</option></optgroup>}
            </select>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <button onClick={nyTom} style={{ ...knapp(false), padding: '5px 10px', fontSize: 12 }}>＋ Ny rapport</button>
              {lasen && <button onClick={lagKopi} style={{ ...knapp(false), padding: '5px 10px', fontSize: 12 }}>Lag eigen kopi</button>}
            </div>
            {lasen && <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8, lineHeight: 1.5 }}>Standardrapportar er faste og kan ikkje endrast. Velg «Lag eigen kopi» for å tilpasse innhaldet.</div>}

            <div style={ETT}>Periode</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, marginBottom: 4, cursor: 'pointer' }}>
              <input type="radio" checked={oppsett.periode.modus !== 'eigen'} onChange={() => setPeriode({ modus: 'forrigeManad' })}/> Førre månad
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
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
              <div style={{ color: 'var(--text3)', fontWeight: 500 }}>Påløpt totalt: til og med {datoNo(periode.til)}. Prognose: frå dagen etter.</div>
            </div>

            {!lasen && (<>
              <div style={ETT}>Tittel</div>
              <input value={oppsett.tittel || ''} onChange={e => endre({ tittel: e.target.value })} placeholder="Tittel" style={FELT}/>
              <input value={oppsett.undertittel || ''} onChange={e => endre({ undertittel: e.target.value })} placeholder="Undertittel / merknad (valfri)" style={{ ...FELT, marginTop: 6 }}/>

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
              {[['fasar', 'Vis fasar/delsummar (hierarki)'], ['sumrad', 'Sum-rad nedst'], ['berreMedTal', 'Skjul aktivitetar utan tal']].map(([k, t]) => (
                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, marginBottom: 3, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!oppsett[k]} onChange={e => endre({ [k]: e.target.checked })}/> {t}
                </label>
              ))}
            </>)}
          </div>

          {/* Førehandsvising */}
          <div style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: 18 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{oppsett.tittel || 'Rapport'}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 12 }}>
              {[prosjekt.projectNumber, prosjekt.name].filter(Boolean).join(' ')}{oppsett.undertittel ? ' · ' + oppsett.undertittel : ''} · Periode {datoNo(periode.fra)} – {datoNo(periode.til)}
            </div>
            {kol.length === 0 ? <div style={{ color: 'var(--danger)', fontSize: 13 }}>Vel minst ein seksjon og ei kolonne.</div> : (
              <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
                <thead>
                  <tr>{grupper.map(g => <th key={g.key} colSpan={g.kol.length} style={{ background: 'var(--tabell-hovud)', color: '#000', fontWeight: 800, textAlign: 'left', padding: '5px 8px', border: '1px solid var(--border)' }}>{g.namn}</th>)}</tr>
                  <tr>{kol.map(k => <th key={k.sek + k.key} style={{ background: 'var(--tabell-hovud)', color: '#000', fontWeight: 800, textAlign: k.type === 'tekst' ? 'left' : 'right', padding: '5px 8px', border: '1px solid var(--border)', fontSize: 11 }}>{k.namn}</th>)}</tr>
                </thead>
                <tbody>
                  {data.rader.map(r => (
                    <tr key={r.id} style={{ background: r.gruppe ? '#EEF3F9' : 'transparent', fontWeight: r.gruppe ? 800 : 400 }}>
                      {kol.map(k => <td key={k.sek + k.key} style={{ padding: '3px 8px', border: '1px solid var(--border)', textAlign: k.type === 'tekst' ? 'left' : 'right', paddingLeft: k.key === 'namn' ? 8 + r.nivaa * 14 : 8, whiteSpace: k.type === 'tekst' ? 'normal' : 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtVerdi(r[k.key], k.type)}</td>)}
                    </tr>
                  ))}
                  {oppsett.sumrad && (
                    <tr style={{ fontWeight: 800, borderTop: '2px solid #000' }}>
                      {kol.map(k => <td key={k.sek + k.key} style={{ padding: '4px 8px', border: '1px solid var(--border)', textAlign: k.type === 'tekst' ? 'left' : 'right', fontVariantNumeric: 'tabular-nums' }}>{k.key === 'namn' ? 'Sum' : k.type === 'tekst' ? '' : fmtVerdi(data.sum[k.key], k.type)}</td>)}
                    </tr>
                  )}
                </tbody>
              </table>
            )}
            {data.rader.length === 0 && kol.length > 0 && <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 10 }}>Ingen aktivitetar i planen enno.</div>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap' }}>
          {melding && <span style={{ fontSize: 12.5, color: /^Klarte|berre|Vel/.test(melding) ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>{melding}</span>}
          <div style={{ flex: 1 }}/>
          {eigenRad && <button onClick={slett} style={{ ...knapp(false), color: 'var(--danger)', borderColor: 'var(--danger)' }}>Slett rapport</button>}
          {!lasen && !laget && eigenRad && <button onClick={lagreEndring} disabled={opptatt || !dirty} style={{ ...knapp(false), opacity: dirty ? 1 : .5 }}>Lagre endringar</button>}
          {!lasen && <button onClick={lagreNy} disabled={opptatt} style={knapp(false)}>{laget ? 'Lagre rapport…' : 'Lagre som ny…'}</button>}
          {lasen && <button onClick={lagreNy} disabled={opptatt} style={knapp(false)}>Lagre kopi som eigen rapport…</button>}
          <button onClick={lastNed} disabled={opptatt || kol.length === 0} style={{ ...knapp(true), opacity: kol.length ? 1 : .5 }}>{opptatt ? 'Lagar PDF…' : '⬇ Last ned PDF'}</button>
        </div>
      </div>
    </div>
  )
}
