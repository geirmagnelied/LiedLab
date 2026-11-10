import { useState, useEffect, useCallback } from 'react'
import { addDays, format, getISOWeek, getISOWeekYear } from 'date-fns'
import { supabase } from './supabase'
import DatePicker from './DatePicker'

// ═══════════════════════════════════════════════════════════════════
//  Lagre status / hent tidlegare lagra status (Prosjektplan). Ein status er eit frosse bilete av planen (elementer + påløpt til periodeslutten),
//  lagra i framdrift_statusar. Namn = <periode> <dato lagra>, t.d. «2026-44 2026-11-10» (veke) eller «2026-10 2026-11-10» (månad).
//  Før ein status vert henta fram, kan gjeldande plan lagrast som KLADD — berre den siste kladden vert teken vare på (type = 'kladd').
// ═══════════════════════════════════════════════════════════════════
const z = (n) => String(n).padStart(2, '0')
const isoDato = (d) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
const vekeStr = (d) => `${getISOWeekYear(d)}-W${z(getISOWeek(d))}`
function mandagIVeke(aar, veke) {
  const jan4 = new Date(aar, 0, 4), dag = jan4.getDay() || 7
  return addDays(new Date(aar, 0, 4 - (dag - 1)), (veke - 1) * 7)
}
const parseVeke = (s) => { const m = /^(\d{4})-W(\d{2})$/.exec(s || ''); return m ? { aar: +m[1], veke: +m[2] } : null }
const FELT = { padding: '6px 9px', borderRadius: 'var(--r)', border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font)', outline: 'none', width: '100%', boxSizing: 'border-box' }
const ETT = { fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.07em', margin: '14px 0 6px' }
const knapp = (prim, fare) => ({ padding: '8px 14px', borderRadius: 'var(--r)', border: prim ? 'none' : '1.5px solid ' + (fare ? 'var(--danger)' : 'var(--border)'), background: prim ? 'var(--brand)' : 'var(--bg2)', color: prim ? '#fff' : fare ? 'var(--danger)' : 'var(--text2)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' })
const datoNo = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('.') : '')

function Ramme({ tittel, onLukk, breidd, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 410 }}>
      <div style={{ background: 'var(--bg2)', borderRadius: 'var(--r2)', width: `min(94vw, ${breidd}px)`, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 70px rgba(0,0,0,.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', background: 'var(--brand)' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{tittel}</span>
          <div style={{ flex: 1 }}/>
          <button onClick={onLukk} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'rgba(255,255,255,.85)', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Lagre ny status ──
export function LagreStatusVindauge({ onLukk, prosjekt, userId, elementer, byggPalop, onLagra }) {
  const no = new Date()
  const [modus, setModus] = useState('manad')                                     // 'manad' | 'veke'
  const [manad, setManad] = useState(() => format(new Date(no.getFullYear(), no.getMonth() - 1, 1), 'yyyy-MM'))
  const [fraVeke, setFraVeke] = useState(() => vekeStr(addDays(no, -7)))
  const [tilVeke, setTilVeke] = useState(() => vekeStr(addDays(no, -7)))
  const [besk, setBesk] = useState('')
  const [opptatt, setOpptatt] = useState(false)
  const [feil, setFeil] = useState('')

  let fra = null, til = null, periodeNamn = ''
  if (modus === 'manad' && /^\d{4}-\d{2}$/.test(manad)) {
    const y = +manad.slice(0, 4), m = +manad.slice(5, 7)
    fra = `${manad}-01`; til = isoDato(new Date(y, m, 0)); periodeNamn = manad
  } else if (modus === 'veke') {
    const a = parseVeke(fraVeke), b = parseVeke(tilVeke)
    if (a && b && fraVeke <= tilVeke) {
      fra = isoDato(mandagIVeke(a.aar, a.veke)); til = isoDato(addDays(mandagIVeke(b.aar, b.veke), 6))
      periodeNamn = fraVeke === tilVeke ? `${a.aar}-${z(a.veke)}` : a.aar === b.aar ? `${a.aar}-${z(a.veke)}–${z(b.veke)}` : `${a.aar}-${z(a.veke)}–${b.aar}-${z(b.veke)}`
    }
  }
  const namn = periodeNamn ? `${periodeNamn} ${isoDato(no)}` : ''

  const lagre = async () => {
    if (!fra) { setFeil(modus === 'veke' ? 'Vel ei gyldig vekeperiode (frå-veke kan ikkje vere etter til-veke).' : 'Vel ein månad.'); return }
    setOpptatt(true); setFeil('')
    const { error } = await supabase.from('framdrift_statusar').insert({
      project_id: prosjekt.id, type: 'status', namn: `${periodeNamn} ${isoDato(new Date())}`, beskriving: besk.trim(), periode_type: modus, periode_fra: fra, periode_til: til,
      elementer, palop: byggPalop(til), created_by: userId })
    setOpptatt(false)
    if (error) { setFeil('Klarte ikkje lagre: ' + error.message + ' (er tabellen framdrift_statusar oppretta?)'); return }
    onLagra?.(`Status «${periodeNamn} ${isoDato(new Date())}» er lagra.`)
  }
  const radio = { display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }
  const dpStil = { ...FELT, padding: '5px 28px 5px 7px' }
  return (
    <Ramme tittel="Lagre status" onLukk={onLukk} breidd={470}>
      <div style={{ padding: '16px 22px', overflowY: 'auto' }}>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.5 }}>Lagrar eit bilete av prosjektplanen og påløpt til slutten av tidsrommet du vel.</div>
        <div style={ETT}>Tidsrom for påløpt</div>
        <div style={{ display: 'flex', gap: 22, marginBottom: 8 }}>
          <label style={radio}><input type="radio" checked={modus === 'manad'} onChange={() => setModus('manad')}/> Heil rekneskapsmånad</label>
          <label style={radio}><input type="radio" checked={modus === 'veke'} onChange={() => setModus('veke')}/> Heile veker</label>
        </div>
        {modus === 'manad'
          ? <DatePicker modus="manad" value={manad} vedTom={false} onChange={v => v && setManad(v)} wrapStyle={{ width: 200 }} style={dpStil}/>
          : <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <DatePicker modus="veke" value={fraVeke} vedTom={false} onChange={v => v && setFraVeke(v)} wrapStyle={{ width: 170 }} style={dpStil}/>
              <span style={{ color: 'var(--text3)' }}>til og med</span>
              <DatePicker modus="veke" value={tilVeke} vedTom={false} onChange={v => v && setTilVeke(v)} wrapStyle={{ width: 170 }} style={dpStil}/>
            </div>}
        {fra && <div style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 700, marginTop: 6 }}>{datoNo(fra)} – {datoNo(til)}</div>}
        <div style={ETT}>Namn på lagringa</div>
        <div style={{ ...FELT, background: 'var(--bg3)', fontFamily: 'var(--mono)' }}>{namn || '—'}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4 }}>Perioden, så datoen du trykker «Lagre status».</div>
        <div style={ETT}>Kort beskriving</div>
        <textarea value={besk} onChange={e => setBesk(e.target.value)} rows={3} placeholder="Til dømes kvifor statusen vart lagra …" style={{ ...FELT, resize: 'vertical' }}/>
        {feil && <div style={{ fontSize: 12.5, color: 'var(--danger)', fontWeight: 600, marginTop: 8 }}>{feil}</div>}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
        <div style={{ flex: 1 }}/>
        <button style={knapp(false)} onClick={onLukk}>Avbryt</button>
        <button style={knapp(true)} onClick={lagre} disabled={opptatt || !fra}>{opptatt ? 'Lagrar …' : 'Lagre status'}</button>
      </div>
    </Ramme>
  )
}

// ── Hent tidlegare lagra status ──
export function HentStatusVindauge({ onLukk, prosjekt, userId, elementer, onHent }) {
  const [liste, setListe] = useState(null)
  const [melding, setMelding] = useState('')
  const [spor, setSpor] = useState(null)             // rad som skal hentast (spør om kladd først)
  const [opptatt, setOpptatt] = useState(false)
  const last = useCallback(async () => {
    const { data, error } = await supabase.from('framdrift_statusar').select('id, type, namn, beskriving, periode_type, periode_fra, periode_til, created_at, created_by').eq('project_id', prosjekt.id).order('created_at', { ascending: false })
    if (error) { setMelding('Klarte ikkje hente lista: ' + error.message + ' (er tabellen framdrift_statusar oppretta?)'); setListe([]); return }
    setListe(data || [])
  }, [prosjekt.id])
  useEffect(() => { last() }, [last])

  const hentFram = async (rad, lagreKladd) => {
    setOpptatt(true); setMelding('')
    const { data, error } = await supabase.from('framdrift_statusar').select('elementer').eq('id', rad.id).single()
    if (error) { setOpptatt(false); setMelding('Klarte ikkje hente statusen: ' + error.message); return }
    if (lagreKladd) {            // berre siste kladd: slett gamal, lagre gjeldande plan som ny
      await supabase.from('framdrift_statusar').delete().eq('project_id', prosjekt.id).eq('type', 'kladd')
      const { error: e2 } = await supabase.from('framdrift_statusar').insert({ project_id: prosjekt.id, type: 'kladd', namn: 'Kladd ' + format(new Date(), 'yyyy-MM-dd HH:mm'),
        beskriving: 'Plan lagra automatisk før «' + rad.namn + '» vart henta fram', elementer, palop: {}, created_by: userId })
      if (e2) { setOpptatt(false); setMelding('Klarte ikkje lagre kladden: ' + e2.message); return }
    }
    setOpptatt(false)
    onHent(data.elementer || [], rad.namn)
  }
  const slett = async (rad) => {
    if (!window.confirm('Slette ' + (rad.type === 'kladd' ? 'kladden' : 'statusen') + ' «' + rad.namn + '»? Dette kan ikkje angrast.')) return
    const { error } = await supabase.from('framdrift_statusar').delete().eq('id', rad.id)
    if (error) { setMelding('Klarte ikkje slette: ' + error.message); return }
    last()
  }
  return (
    <Ramme tittel="Tidlegare lagra statusar" onLukk={onLukk} breidd={860}>
      <div style={{ padding: '14px 20px', overflowY: 'auto', minHeight: 160 }}>
        {liste == null ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Hentar …</div>
          : liste.length === 0 ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Ingen lagra statusar enno. Bruk «Lagre status» → «Lagre ny status».</div>
          : (
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5 }}>
              <thead><tr>{['Namn', 'Periode (påløpt)', 'Beskriving', 'Lagra', ''].map(h => <th key={h} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid var(--border)', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text3)' }}>{h}</th>)}</tr></thead>
              <tbody>
                {liste.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '7px 8px', fontWeight: 700, fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>
                      {r.type === 'kladd' && <span style={{ fontSize: 10.5, fontWeight: 800, background: '#B45309', color: '#fff', borderRadius: 8, padding: '1px 7px', marginRight: 6, fontFamily: 'var(--font)' }}>KLADD</span>}{r.namn}
                    </td>
                    <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>{r.periode_fra ? `${datoNo(r.periode_fra)} – ${datoNo(r.periode_til)}` : '—'}</td>
                    <td style={{ padding: '7px 8px', color: 'var(--text2)' }}>{r.beskriving}</td>
                    <td style={{ padding: '7px 8px', whiteSpace: 'nowrap', color: 'var(--text3)' }}>{format(new Date(r.created_at), 'dd.MM.yyyy HH:mm')}</td>
                    <td style={{ padding: '4px 8px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button style={{ ...knapp(true), padding: '4px 12px', fontSize: 12 }} disabled={opptatt} onClick={() => setSpor(r)}>Hent fram</button>{' '}
                      <button style={{ ...knapp(false, true), padding: '4px 9px', fontSize: 12 }} disabled={opptatt} onClick={() => slett(r)} title="Slett">🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        {melding && <div style={{ fontSize: 12.5, color: 'var(--danger)', fontWeight: 600, marginTop: 10 }}>{melding}</div>}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11.5, color: 'var(--text3)', alignSelf: 'center', flex: 1 }}>Å hente fram ei status erstattar planen din (kan angrast med «Angre»). Berre den siste kladden vert teken vare på.</div>
        <button style={knapp(false)} onClick={onLukk}>Lukk</button>
      </div>
      {spor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 420 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '20px 24px', maxWidth: 460, boxShadow: '0 10px 40px rgba(0,0,0,.4)' }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>Lagre justeringane som kladd?</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.5 }}>Du er i ferd med å hente fram «{spor.namn}». Vil du først lagre planen slik ho står no som kladd? Berre den siste kladden vert teken vare på, og du finn han att i denne lista.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button style={knapp(false)} onClick={() => setSpor(null)}>Avbryt</button>
              <button style={knapp(false, true)} onClick={() => { const r = spor; setSpor(null); hentFram(r, false) }}>Hent fram utan kladd</button>
              <button style={knapp(true)} onClick={() => { const r = spor; setSpor(null); hentFram(r, true) }}>Lagre kladd og hent fram</button>
            </div>
          </div>
        </div>
      )}
    </Ramme>
  )
}
