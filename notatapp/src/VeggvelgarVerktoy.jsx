import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import VeggvalTabell from './VeggvalTabell'
import { foreslaVeggar, flaskehalsar, VEGGDATA } from './veggvelgarLogikk'
import { BRANNKLASSAR, ROBUSTHEITSNIVA, ROMTYPAR, MATERIALAR, FAMILIE_KORT, PROFILNAMN, BREDDEGRUPPER, LYDKRAV_STANDARD } from './veggvelgarKonfig'
import { ProsjektVeggarTabell, PrintArk } from './ProsjektVeggar'

// ═══════════════════════════════════════════════════════════════════
//  Veggvelgar — foreslår innvendige stenderveggar frå Norgips sin veggtabell ut frå krav (brann, lyd, høgde, robustheit, romtype).
//  Data: data/norgipsVeggtabell.json (lese frå nettsida, sjå claude/verktoy-modul.md). Val kan lagrast per prosjekt (verktoy_veggval).
// ═══════════════════════════════════════════════════════════════════

const STANDARD_KRAV = { materiale: 'alle', romtype: 'innvendig', brann: 0, lyd: 0, lydMaal: 'rw', hogde: 2700, robust: 0, cf: true, cc: 'auto', stender: 'enkel', bredder: [], lydPreset: 'ingen' }
const SQL_MELDING = 'Databasen manglar kolonnar/tabell for veggval. Køyr SQL-filene supabase-verktoy-veggval.sql og supabase-verktoy-veggval-2.sql i Supabase SQL Editor.'
const sqlFeil = (e) => (/verktoy_veggval|relation|schema cache|lopenr|prosjektkrav|column/i.test(e.message) ? SQL_MELDING : e.message)
const KRAV_KEY = 'liedlab-veggvelgar-krav-v1'
const NORGIPS_URL = 'https://byggeteknikk.norgips.no/prosjektering/innervegger/veggtabell/'

const lesKrav = () => { try { return { ...STANDARD_KRAV, ...JSON.parse(localStorage.getItem(KRAV_KEY)) } } catch { return STANDARD_KRAV } }

const INN = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5, fontFamily: 'var(--font)', boxSizing: 'border-box' }
const LBL = { display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '14px 0 5px' }

const tilTabellRad = (t, krav) => {
  const r = t.rad, v = t.variant
  const best = krav.brann > 0 ? r.brann.filter(b => b.ei >= krav.brann).sort((a, b) => a.ei - b.ei)[0] : r.brann.slice().sort((a, b) => b.ei - a.ei)[0]
  return {
    id: r.id, rad: r, familie: FAMILIE_KORT[r.familie] || r.familie, kode: r.kode, tjukkleik: r.veggTjukkleik, plater: r.plateTjukkleik + ' mm', isolasjon: r.isolasjon,
    brann: best?.ei ?? null, rw: r.rw, rwC: r.rwC, maksHogde: v?.maks ?? null, oppsett: v ? (PROFILNAMN[v.profil] || v.profil) + (v.profil === 'N' || v.profil === 'CFN' ? '' : ' c/c ' + v.cc) : '',
    variant: v ? { profil: v.profil, cc: v.cc } : null, margin: t.margin, robust: t.robust, merknad: t.merknader.join(' '), treff: t,
  }
}

export default function VeggvelgarVerktoy({ userId, projects = [], activeProjectId }) {
  const [krav, setKrav] = useState(lesKrav)
  const [valgt, setValgt] = useState(null)       // tabellrad
  const [fane, setFane] = useState('forslag')    // 'forslag' | 'lagra'
  const sett = (k, v) => setKrav(x => { const n = { ...x, [k]: v }; try { localStorage.setItem(KRAV_KEY, JSON.stringify(n)) } catch { /* privat modus */ } return n })

  const treff = useMemo(() => foreslaVeggar(krav), [krav])
  const rader = useMemo(() => treff.map(t => tilTabellRad(t, krav)), [treff, krav])
  const hjelp = useMemo(() => (treff.length ? [] : flaskehalsar(krav).slice(0, 3)), [treff, krav])
  useEffect(() => { if (valgt && !rader.some(r => r.id === valgt.id)) setValgt(null) }, [rader, valgt])

  // ── Lagra veggval per prosjekt ──
  const [prosjektId, setProsjektId] = useState(activeProjectId || '')
  const [lagra, setLagra] = useState([])
  const [feil, setFeil] = useState('')
  const [romnamn, setRomnamn] = useState('')
  const [merknad, setMerknad] = useState('')
  const [melding, setMelding] = useState('')
  useEffect(() => { if (activeProjectId) setProsjektId(activeProjectId) }, [activeProjectId])
  const last = async (pid) => {
    setFeil('')
    if (!pid) { setLagra([]); return }
    const { data, error } = await supabase.from('verktoy_veggval').select('*').eq('project_id', pid).order('created_at', { ascending: false })
    if (error) { setFeil(sqlFeil(error)); setLagra([]); return }
    setLagra(data || [])
  }
  useEffect(() => { last(prosjektId) }, [prosjektId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Legg ei tabellrad til prosjektet. Krava frå skjemaet vert føreslåtte som prosjektkrav (kan endrast i prosjekttabellen).
  const leggTil = async (tr, rom = '', mrk = '') => {
    if (!tr || !prosjektId) return
    setFeil(''); setMelding('')
    const lopenr = lagra.reduce((m, x) => Math.max(m, x.lopenr || 0), 0) + 1
    const { error } = await supabase.from('verktoy_veggval').insert({
      project_id: prosjektId, veggkode: tr.kode, familie: tr.rad.familie, romnamn: rom.trim(), merknad: mrk.trim(), datakjelde_dato: VEGGDATA.henta, lopenr,
      krav, prosjektkrav: { brann: krav.brann || 0, lyd: krav.lyd || 0, hogde: krav.hogde || 0, robust: krav.robust || 0 },
      resultat: { tjukkleik: tr.tjukkleik, brann: tr.brann, rw: tr.rw, rwC: tr.rwC, maksHogde: tr.maksHogde, oppsett: tr.oppsett, margin: tr.margin, robust: tr.robust, merknader: tr.treff.merknader, rad_id: tr.id, variant: tr.variant },
    })
    if (error) { setFeil(sqlFeil(error)); return }
    setMelding('Lagt til som ID ' + String(lopenr).padStart(2, '0') + '.'); setRomnamn(''); setMerknad(''); last(prosjektId)
    setTimeout(() => setMelding(''), 4000)
  }
  const lagre = () => leggTil(valgt, romnamn, merknad)
  const endre = async (id, patch) => {
    setLagra(l => l.map(x => (x.id === id ? { ...x, ...patch } : x)))
    const { error } = await supabase.from('verktoy_veggval').update(patch).eq('id', id)
    if (error) { setFeil(sqlFeil(error)); last(prosjektId) }
  }
  const slett = async (rad) => {
    if (!window.confirm('Fjerne veggen «' + rad.veggkode + '» frå prosjektet?')) return
    const { error } = await supabase.from('verktoy_veggval').delete().eq('id', rad.id)
    if (error) setFeil(error.message); else last(prosjektId)
  }
  const [skrivUt, setSkrivUt] = useState(false)
  const erLagt = useCallback((tr) => lagra.some(x => x.resultat?.rad_id === tr.id), [lagra])
  const sorterte = useMemo(() => [...lagra].sort((a, b) => (a.lopenr || 0) - (b.lopenr || 0)), [lagra])

  const prosjektNamn = (id) => { const p = projects.find(x => x.id === id); return p ? ((p.projectNumber || p.project_number || '') + ' ' + (p.name || '')).trim() : '' }
  const TAB = (a) => ({ padding: '6px 14px', border: '1.5px solid ' + (a ? '#0A0A0A' : 'transparent'), borderRadius: 8, background: a ? '#0A0A0A' : 'rgba(255,255,255,.5)', color: a ? '#fff' : 'var(--text2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' })
  const smal = typeof window !== 'undefined' && window.innerWidth < 768
  const forklar = VEGGDATA.forklaring

  return (
    <div style={{ display: 'flex', flex: 1, flexDirection: smal ? 'column' : 'row', minHeight: 0, minWidth: 0, overflow: smal ? 'auto' : 'hidden' }}>
      {/* Krav */}
      <div style={{ width: smal ? 'auto' : 300, flexShrink: 0, overflowY: smal ? 'visible' : 'auto', padding: '8px 16px 24px', borderRight: smal ? 'none' : '1px solid var(--border)', borderBottom: smal ? '1px solid var(--border)' : 'none', background: 'var(--bg2)' }}>
        <label style={{ ...LBL, marginTop: 6 }}>Veggtype</label>
        <select value={krav.materiale} onChange={e => sett('materiale', e.target.value)} style={INN}>{MATERIALAR.map(m => <option key={m.verdi} value={m.verdi}>{m.namn}</option>)}</select>

        <label style={LBL}>Stenderbreidd (mm)</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {BREDDEGRUPPER.map(g => {
            const pa = krav.bredder.includes(g.namn)
            return <button key={g.namn} onClick={() => sett('bredder', pa ? krav.bredder.filter(x => x !== g.namn) : [...krav.bredder, g.namn])} style={{ padding: '4px 10px', borderRadius: 14, border: '1.5px solid ' + (pa ? '#0A0A0A' : 'var(--border)'), background: pa ? '#0A0A0A' : 'transparent', color: pa ? '#fff' : 'var(--text2)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>{g.namn}</button>
          })}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4 }}>{krav.bredder.length ? 'Berre valde stenderbreidder. 95 og 100 mm vert rekna som same stender.' : 'Ingen valde = alle breidder.'}</div>

        <label style={LBL}>Enkle eller doble stendarar</label>
        <select value={krav.stender} onChange={e => sett('stender', e.target.value)} style={INN}><option value="enkel">Enkle (standard)</option><option value="dobbel">Doble</option><option value="alle">Begge</option></select>

        <label style={LBL}>Romtype</label>
        <select value={krav.romtype} onChange={e => sett('romtype', e.target.value)} style={INN}>{ROMTYPAR.map(r => <option key={r.verdi} value={r.verdi}>{r.namn}</option>)}</select>
        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4 }}>{ROMTYPAR.find(r => r.verdi === krav.romtype)?.hjelp}</div>

        <label style={LBL}>Brannkrav (EI, minutt)</label>
        <select value={krav.brann} onChange={e => sett('brann', +e.target.value)} style={INN}>{BRANNKLASSAR.map(b => <option key={b} value={b}>{b === 0 ? 'Ingen brannkrav' : 'EI ' + b}</option>)}</select>

        <label style={LBL}>Lydkrav (dB, minst)</label>
        <select value={krav.lydPreset} style={{ ...INN, marginBottom: 6 }} onChange={e => {
          const p = e.target.value, f = LYDKRAV_STANDARD.find(x => x.id === p)
          setKrav(x => { const n = { ...x, lydPreset: p, lyd: f ? f.rw : p === 'ingen' ? 0 : x.lyd, lydMaal: f ? 'rw' : x.lydMaal }; try { localStorage.setItem(KRAV_KEY, JSON.stringify(n)) } catch { /* */ } return n })
        }}>
          <option value="ingen">Ingen lydkrav</option>
          {LYDKRAV_STANDARD.map(f => <option key={f.id} value={f.id}>{f.namn} — R'w ≥ {f.rw}</option>)}
          <option value="manuell">Eige krav (skriv inn)</option>
        </select>
        <div style={{ fontSize: 11, color: 'var(--text3)', margin: '-2px 0 6px', lineHeight: 1.4 }}>Typiske krav etter NS 8175 klasse C (veiledande — kontroller mot standarden og prosjektet).</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input type="number" min="0" max="90" value={krav.lyd || ''} placeholder="Ingen" onChange={e => { const v = Math.max(0, parseInt(e.target.value, 10) || 0); setKrav(x => { const n = { ...x, lyd: v, lydPreset: v ? 'manuell' : 'ingen' }; try { localStorage.setItem(KRAV_KEY, JSON.stringify(n)) } catch { /* */ } return n }) }} style={{ ...INN, flex: 1 }}/>
          <select value={krav.lydMaal} onChange={e => sett('lydMaal', e.target.value)} style={{ ...INN, width: 110 }}><option value="rw">R'w</option><option value="rwC">R'w + C</option></select>
        </div>

        <label style={LBL}>Romhøgde (mm)</label>
        <input type="number" min="0" step="50" value={krav.hogde || ''} placeholder="Ikkje oppgitt" onChange={e => sett('hogde', Math.max(0, parseInt(e.target.value, 10) || 0))} style={INN}/>

        <label style={LBL}>Krav til robustheit</label>
        <select value={krav.robust} onChange={e => sett('robust', +e.target.value)} style={INN}>{ROBUSTHEITSNIVA.map(r => <option key={r.verdi} value={r.verdi}>{r.namn}</option>)}</select>
        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4, lineHeight: 1.4 }}>Avleidd frå platetype og tal lag (vår tolking, ikkje frå Norgips).</div>

        <label style={LBL}>Stenderavstand</label>
        <select value={krav.cc} onChange={e => sett('cc', e.target.value)} style={INN}><option value="auto">Valfri (c/c 600 føretrekt)</option><option value="600">Berre c/c 600</option><option value="450">Berre c/c 450</option></select>

        <label style={{ ...LBL, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', letterSpacing: 0, fontSize: 13, color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}>
          <input type="checkbox" checked={krav.cf} onChange={e => sett('cf', e.target.checked)}/> Tillat forsterkingsprofil (CF)
        </label>
        <button onClick={() => { setKrav(STANDARD_KRAV); try { localStorage.removeItem(KRAV_KEY) } catch { /* */ } }} style={{ marginTop: 14, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'transparent', color: 'var(--text2)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'var(--font)' }}>Nullstill krav</button>

        <div style={{ marginTop: 20, padding: '10px 12px', background: 'var(--brandbg)', borderRadius: 10, fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.5 }}>
          Data frå <a href={NORGIPS_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--brand)' }}>Norgips veggtabell</a>, lese {VEGGDATA.henta}. Kontroller alltid mot gjeldande veggtabell før bruk i prosjekt.
        </div>
      </div>

      {/* Resultat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: smal ? 420 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', height: 46, flexShrink: 0, background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setFane('forslag')} style={TAB(fane === 'forslag')}>Forslag ({treff.length})</button>
          <button onClick={() => setFane('lagra')} style={TAB(fane === 'lagra')}>Veggar på prosjektet ({lagra.length})</button>
          <select value={prosjektId} onChange={e => setProsjektId(e.target.value ? +e.target.value || e.target.value : '')} style={{ ...INN, width: 240, marginLeft: 'auto', padding: '5px 8px' }} title="Prosjekt som veggar vert lagde til">
            <option value="">Vel prosjekt…</option>{projects.map(p => <option key={p.id} value={p.id}>{prosjektNamn(p.id)}</option>)}
          </select>
          {melding && <span style={{ fontSize: 12.5, color: '#166534', fontWeight: 700 }}>{melding}</span>}
        </div>

        {fane === 'forslag' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {treff.length === 0 && (
              <div style={{ padding: '18px 20px', fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.6 }}>
                <b style={{ color: 'var(--text)' }}>Ingen veggar i Norgips sin veggtabell oppfyller alle krava.</b>
                {hjelp.length > 0 && (<div style={{ marginTop: 8 }}>Lettast å mjuke opp: {hjelp.map(h => h.namn + ' (' + h.antal + ' veggar utan det kravet)').join(' · ')}.</div>)}
                {krav.brann > 0 && krav.hogde > 4000 && <div style={{ marginTop: 8 }}>Høgder over 4 m med brannkrav skal prosjekterast særskilt av RIB.</div>}
              </div>
            )}
            {treff.length > 0 && <div style={{ flex: 1, minHeight: 0, display: 'flex' }}><VeggvalTabell rader={rader} onVelg={setValgt} onLeggTil={leggTil} erLagt={erLagt} kanLeggeTil={!!prosjektId}/></div>}

            {valgt && (
              <div style={{ flexShrink: 0, maxHeight: smal ? 'none' : '42%', overflowY: 'auto', borderTop: '2px solid var(--brand)', background: 'var(--bg2)', padding: '12px 18px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 15, color: 'var(--brand)' }}>{valgt.kode}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>{valgt.familie} · Norgips veggtabell nr. {valgt.rad.nr}</span>
                  <button onClick={() => setValgt(null)} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: 'var(--text3)', fontSize: 18, cursor: 'pointer' }} title="Lukk">×</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '6px 22px', marginTop: 10, fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>
                  <div><b style={{ color: 'var(--text)' }}>Veggløysing:</b> {forklar.veggloysing[valgt.rad.loysing] || valgt.rad.loysing}</div>
                  <div><b style={{ color: 'var(--text)' }}>Stender:</b> {valgt.rad.materiale === 'tre' ? 'Trestender ' + valgt.rad.stenderBredde + ' mm' : valgt.rad.profilKode + ' ' + valgt.rad.stenderBredde + (forklar.stalprofil[valgt.rad.profilKode] ? ' (' + forklar.stalprofil[valgt.rad.profilKode] + ')' : '')}</div>
                  <div><b style={{ color: 'var(--text)' }}>Platelag:</b> {valgt.rad.lagKode}{valgt.plater !== ' mm' ? ', ' + valgt.plater : ''}</div>
                  <div><b style={{ color: 'var(--text)' }}>Isolasjon:</b> {valgt.isolasjon}</div>
                  <div><b style={{ color: 'var(--text)' }}>Plater som kan brukast:</b> {valgt.rad.tillattePlater.map(p => forklar.platetypar[p] || p).join('; ')}</div>
                  <div><b style={{ color: 'var(--text)' }}>Brann:</b> {valgt.rad.brann.map(b => 'EI ' + b.ei + ' opp til ' + b.maks + ' mm' + (b.stjerne ? '*' : '')).join(' / ')}</div>
                  {Object.entries(valgt.rad.hogde).map(([pr, h]) => <div key={pr}><b style={{ color: 'var(--text)' }}>Høgde utan brannkrav ({PROFILNAMN[pr] || pr}):</b> {[h.c450 != null && 'c/c 450: ' + h.c450 + ' mm', h.c600 != null && 'c/c 600: ' + h.c600 + ' mm'].filter(Boolean).join(' · ')}</div>)}
                  {valgt.rad.baerende && (valgt.rad.baerende.b1 != null || valgt.rad.baerende.b2 != null) && <div><b style={{ color: 'var(--text)' }}>Bærande (brannklasse B1/B2):</b> {valgt.rad.baerende.b1 ?? '–'} / {valgt.rad.baerende.b2 ?? '–'} min, maks høgde {valgt.rad.baerende.hogde ?? '–'} mm</div>}
                  <div><b style={{ color: 'var(--text)' }}>Lydreduksjon:</b> R'w {valgt.rw ?? '–'} dB · R'w+C {valgt.rwC ?? '–'} dB</div>
                </div>
                {valgt.merknad && <div style={{ marginTop: 8, fontSize: 12.5, color: '#B45309' }}>⚠ {valgt.merknad}</div>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
                  <select value={prosjektId} onChange={e => setProsjektId(e.target.value ? +e.target.value || e.target.value : '')} style={{ ...INN, width: 220 }}>
                    <option value="">Vel prosjekt…</option>{projects.map(p => <option key={p.id} value={p.id}>{prosjektNamn(p.id)}</option>)}
                  </select>
                  <input value={romnamn} onChange={e => setRomnamn(e.target.value)} placeholder="Rom / vegg (t.d. «Sjakt 2.etg»)" style={{ ...INN, width: 220 }}/>
                  <input value={merknad} onChange={e => setMerknad(e.target.value)} placeholder="Merknad (valfri)" style={{ ...INN, width: 220 }}/>
                  <button onClick={lagre} disabled={!prosjektId} style={{ padding: '8px 18px', border: 'none', borderRadius: 9, background: prosjektId ? 'var(--brand)' : 'var(--border)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: prosjektId ? 'pointer' : 'default', fontFamily: 'var(--font)' }}>Lagre på prosjekt</button>
                  {melding && <span style={{ fontSize: 12.5, color: '#166534', fontWeight: 700 }}>{melding}</span>}
                </div>
              </div>
            )}
            {feil && <div style={{ margin: 10, padding: '8px 12px', background: 'rgba(185,28,28,.08)', border: '1.5px solid var(--danger)', borderRadius: 8, fontSize: 13, color: 'var(--danger)' }}>{feil}</div>}
          </div>
        )}

        {fane === 'lagra' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {feil && <div style={{ margin: 10, padding: '8px 12px', background: 'rgba(185,28,28,.08)', border: '1.5px solid var(--danger)', borderRadius: 8, fontSize: 13, color: 'var(--danger)' }}>{feil}</div>}
            {!prosjektId && <div style={{ padding: '18px 20px', fontSize: 13.5, color: 'var(--text3)' }}>Vel eit prosjekt øvst til høgre.</div>}
            {prosjektId && <ProsjektVeggarTabell veggar={sorterte} onEndre={endre} onSlett={slett} onSkrivUt={() => setSkrivUt(true)}/>}
          </div>
        )}
        {skrivUt && <PrintArk veggar={sorterte} prosjekt={{ id: prosjektId, nr: (projects.find(p => p.id === prosjektId)?.projectNumber || ''), namn: projects.find(p => p.id === prosjektId)?.name || '' }} onLukk={() => setSkrivUt(false)}/>}
      </div>
    </div>
  )
}
