import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { addDays, parseISO } from 'date-fns'
import { supabase } from './supabase'
import FramdriftTidslinje from './FramdriftTidslinje'
import FramdriftTabell from './FramdriftTabell'
import FramdriftImportModal from './FramdriftImportModal'
import { MALAR } from './framdriftMalar'
import { iso, tilDato, parseDato, nesteArbeidsdag, forrigeArbeidsdag, formaterDato } from './framdriftDato'
import {
  rullOpp, harBorn, beregnDatoar, settElement, avhengnadFeil, leggTilAvhengnad, fjernAvhengnad, slettElement,
  flyttRekkjefolgje, visingsrader, nyttElement, byggFraMal, FASEKODAR, antalArbeidsdagar,
} from './framdriftLogikk'

// ═══════════════════════════════════════════════════════════════════
//  Framdrift — forenkla prosjektstyring (faseplan/Gantt) per prosjekt.
//  Sjå claude/framdrift-modul.md. Heile planen ligg i ÉI rad per prosjekt
//  i framdrift_planar (JSONB, supabase-framdrift.sql) og vert lagra
//  automatisk kort tid etter kvar endring. Fristar og møte vert lesne frå
//  notat/oppgåver (same data som Kalender-modulen), ikkje registrert på nytt.
// ═══════════════════════════════════════════════════════════════════

const CSS = `
.fd-knapp { border:1.5px solid var(--border); background:var(--bg2); color:var(--text2); border-radius:7px;
  padding:6px 12px; font-size:12.5px; font-weight:700; font-family:var(--font); cursor:pointer; transition:all .15s; white-space:nowrap }
.fd-knapp:hover:not(:disabled) { border-color:var(--brand2); color:var(--brand); background:var(--brandbg) }
.fd-knapp:disabled { opacity:.45; cursor:default }
.fd-knapp.hovud { background:var(--brand); border-color:var(--brand); color:#fff }
.fd-knapp.hovud:hover:not(:disabled) { background:var(--brand); color:#fff; opacity:.9 }
.fd-knapp.fare:hover:not(:disabled) { border-color:var(--danger); color:var(--danger); background:transparent }
.fd-seg { display:inline-flex; background:var(--bg3); border:1px solid var(--border); border-radius:8px; padding:2px; gap:2px }
.fd-seg button { border:0; background:transparent; padding:5px 12px; border-radius:6px; font-size:12.5px; font-weight:700;
  color:var(--text3); font-family:var(--font); cursor:pointer }
.fd-seg button:hover { color:var(--text) }
.fd-seg button.pa { background:var(--bg2); color:var(--brand); box-shadow:var(--shadow-sm) }
.fd-input { width:100%; padding:6px 8px; border:1.5px solid var(--border); border-radius:6px; font-size:12.5px;
  font-family:var(--font); background:var(--bg2); color:var(--text); outline:none; box-sizing:border-box }
.fd-input:focus { border-color:var(--brand2) }
.fd-etikett { font-size:10px; letter-spacing:.09em; text-transform:uppercase; color:var(--text3); font-weight:700 }
`

const ZOOM = [['dag', 'Dag'], ['veke', 'Veke'], ['manad', 'Månad'], ['kvartal', 'Kvartal']]
const TYPE_NAMN = { fase: 'Fase', aktivitet: 'Aktivitet', milepael: 'Milepæl' }

// Tekstfelt som fyrst lagrar ved Enter/forlating av feltet (ikkje kvar tast)
function TekstFelt({ verdi, onLagre, type = 'text', ...rest }) {
  const [v, setV] = useState(verdi)
  useEffect(() => setV(verdi), [verdi])
  const lagre = () => { if (String(v) !== String(verdi)) onLagre(v) }
  return <input className="fd-input" type={type} value={v ?? ''} onChange={e => setV(e.target.value)} onBlur={lagre}
    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} {...rest}/>
}

export default function FramdriftModule({ userId, projects, notes, activeProjectId }) {
  const [elementer, setElementer] = useState([])
  const [lastar, setLastar] = useState(true)
  const [lagringStatus, setLagringStatus] = useState('') // '' | 'lagrar' | 'lagra' | 'feil'
  const [valgt, setValgt] = useState(null)
  const [visning, setVisning] = useState('tidslinje')
  const [zoom, setZoom] = useState('veke')
  const [visHendingar, setVisHendingar] = useState(true)
  const [lukka, setLukka] = useState(() => new Set())
  const [malOpen, setMalOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [angreAntal, setAngreAntal] = useState(0)

  const aktivtProsjekt = projects.find(p => p.id === activeProjectId)
  const elRef = useRef([])           // siste plan (for lagring/angre utan stale closure)
  const historikk = useRef([])
  const lagreTimer = useRef(null)
  const skitten = useRef(false)
  const prosjektRef = useRef(null)

  // ── Lagring ──
  const lagreNo = useCallback(async (prosjektId, els) => {
    if (!userId || !prosjektId) return
    setLagringStatus('lagrar')
    const { error } = await supabase.from('framdrift_planar').upsert(
      { user_id: userId, project_id: prosjektId, elementer: els, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,project_id' })
    if (error) { console.warn('[Framdrift] lagring feila:', error.message); setLagringStatus('feil'); return }
    skitten.current = false
    setLagringStatus('lagra')
  }, [userId])

  const planleggLagring = useCallback(() => {
    skitten.current = true
    clearTimeout(lagreTimer.current)
    const pid = prosjektRef.current
    lagreTimer.current = setTimeout(() => lagreNo(pid, elRef.current), 700)
  }, [lagreNo])

  // ── Last plan ved prosjektbyte (lagre ein evt. ulagra plan for FØRRE prosjekt først) ──
  useEffect(() => {
    let avbrote = false
    const forrige = prosjektRef.current
    if (skitten.current && forrige) { clearTimeout(lagreTimer.current); lagreNo(forrige, elRef.current) }
    prosjektRef.current = activeProjectId
    historikk.current = []; setAngreAntal(0); setValgt(null); setLukka(new Set()); setLagringStatus('')
    if (!userId || !activeProjectId) { elRef.current = []; setElementer([]); setLastar(false); return }
    setLastar(true)
    supabase.from('framdrift_planar').select('elementer').eq('user_id', userId).eq('project_id', activeProjectId).maybeSingle()
      .then(({ data, error }) => {
        if (avbrote) return
        if (error) console.warn('[Framdrift] kunne ikkje lese plan:', error.message)
        const els = Array.isArray(data?.elementer) ? data.elementer : []
        elRef.current = els; setElementer(els); setLastar(false)
      })
    return () => { avbrote = true }
  }, [userId, activeProjectId, lagreNo])

  // Lagre ulagra endringar når modulen vert lukka
  useEffect(() => () => {
    if (skitten.current && prosjektRef.current) { clearTimeout(lagreTimer.current); lagreNo(prosjektRef.current, elRef.current) }
  }, [lagreNo])

  // ── Oppdatering (med angre-historikk) ──
  const oppdater = useCallback((ny, { utanHistorikk = false } = {}) => {
    if (!utanHistorikk) {
      historikk.current = [...historikk.current.slice(-29), elRef.current]
      setAngreAntal(historikk.current.length)
    }
    elRef.current = ny
    setElementer(ny)
    planleggLagring()
  }, [planleggLagring])

  const angre = () => {
    const forrige = historikk.current.pop()
    setAngreAntal(historikk.current.length)
    if (forrige) oppdater(forrige, { utanHistorikk: true })
  }

  useEffect(() => {
    const tast = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) {
        e.preventDefault(); angre()
      }
    }
    window.addEventListener('keydown', tast)
    return () => window.removeEventListener('keydown', tast)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fristar og møte frå notat/oppgåver (same kjelde som Kalender-modulen) ──
  const hendingar = useMemo(() => {
    const ut = []
    ;(notes || []).filter(n => n.projectId === activeProjectId && !n.done).forEach(n => {
      const tittel = n.title || n.text?.substring(0, 40) || 'Utan tittel'
      ;(n.tasks || []).forEach(t => {
        if (t.done || !t.date) return
        ut.push({ id: `t${t.id}`, dato: parseISO(t.date), type: 'frist', tekst: t.text, tittel })
      })
      if (n.isMeeting && n.meetingTime) ut.push({ id: `m${n.id}`, dato: new Date(n.meetingTime), type: 'møte', tittel })
    })
    return ut.sort((a, b) => a.dato - b.dato)
  }, [notes, activeProjectId])

  const rader = useMemo(() => visingsrader(elementer, lukka), [elementer, lukka])
  const sel = elementer.find(e => e.id === valgt) || null

  // ── Handlingar ──
  const endreFraTidslinje = (id, modus, d) => {
    const e = elementer.find(x => x.id === id)
    if (!e) return
    const n = beregnDatoar(e, modus, d)
    oppdater(settElement(elementer, id, n.start, n.slutt, { beholdVarigheit: modus === 'flytt' }))
  }

  const erRullaFase = (e) => e?.type === 'fase' && harBorn(elementer, e.id)

  const settStart = (id, startIso) => {
    const e = elementer.find(x => x.id === id)
    if (!e || erRullaFase(e) || !startIso) return
    const s = iso(nesteArbeidsdag(tilDato(startIso)))
    oppdater(settElement(elementer, id, s, e.slutt < s ? s : e.slutt))
  }
  const settSlutt = (id, sluttIso) => {
    const e = elementer.find(x => x.id === id)
    if (!e || erRullaFase(e) || !sluttIso) return
    const s = iso(forrigeArbeidsdag(tilDato(sluttIso)))
    oppdater(settElement(elementer, id, e.start, s < e.start ? e.start : s))
  }
  const settFelt = (id, felt, verdi) => oppdater(elementer.map(e => (e.id === id ? { ...e, [felt]: verdi } : e)))

  const endreFraTabell = (id, key, verdi) => {
    if (key === 'namn') { if (String(verdi).trim()) settFelt(id, 'namn', String(verdi).trim()); return }
    if (key === 'ansvarleg') { settFelt(id, 'ansvarleg', String(verdi).trim()); return }
    if (key === 'ferdig') {
      const n = Math.max(0, Math.min(100, parseInt(verdi, 10) || 0)); settFelt(id, 'ferdig', n); return
    }
    if (key === 'start' || key === 'slutt') {
      const d = parseDato(verdi)
      if (!d) { alert('Skriv datoen som dd.mm.åååå, t.d. 05.10.2026.'); return }
      const e = elementer.find(x => x.id === id)
      if (erRullaFase(e)) { alert('Datoane til ei fase med aktivitetar følgjer aktivitetane — endre dei i staden.'); return }
      key === 'start' ? settStart(id, iso(d)) : settSlutt(id, iso(d))
    }
  }

  const leggTil = (type) => {
    const valdFase = sel?.type === 'fase' ? sel.id : sel?.forelder ?? null
    let start = new Date()
    const forelder = type === 'fase' ? null : valdFase
    const søsken = elementer.filter(e => (e.forelder ?? null) === (forelder ?? null) && (type === 'fase' ? e.type === 'fase' : true))
    if (søsken.length) start = addDays(tilDato(søsken.reduce((m, e) => (e.slutt > m ? e.slutt : m), søsken[0].slutt)), 1)
    const nytt = nyttElement(type, { start, forelder })
    oppdater(rullOpp([...elementer, nytt]))
    setValgt(nytt.id)
    if (forelder != null) setLukka(l => { const n = new Set(l); n.delete(forelder); return n })
  }

  const slett = (id) => {
    const e = elementer.find(x => x.id === id)
    if (!e) return
    const antall = e.type === 'fase' ? elementer.filter(c => c.forelder === id).length : 0
    if (!window.confirm(`Slette «${e.namn}»${antall ? ` og dei ${antall} aktivitetane under` : ''}?`)) return
    oppdater(slettElement(elementer, id)); setValgt(null)
  }

  const brukMal = (mal, startIso, erstatt) => {
    const nye = byggFraMal(mal, startIso)
    oppdater(erstatt ? nye : rullOpp([...elementer, ...nye]))
    setMalOpen(false)
    setValgt(null)
  }

  const importer = (nye, { erstatt }) => {
    oppdater(erstatt ? nye : rullOpp([...elementer, ...nye]))
    setImportOpen(false); setValgt(null)
  }

  const lagStatusTekst = lagringStatus === 'lagrar' ? 'Lagrar…' : lagringStatus === 'lagra' ? 'Lagra ✓'
    : lagringStatus === 'feil' ? 'Klarte ikkje lagre — sjekk at migrasjonen er køyrd' : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0 }}>
      <style>{CSS}</style>

      {/* Topbar — modulnamn fyrst */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', height: 50, flexShrink: 0,
        background: 'var(--brand)', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>Framdrift</span>
        <div style={{ flex: 1 }}/>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: lagringStatus === 'feil' ? '#FCA5A5' : 'rgba(255,255,255,.75)' }}>{lagStatusTekst}</span>
      </div>

      {!aktivtProsjekt ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: 'var(--brandbg2)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900, color: 'var(--brand)' }}>Fd</div>
          <p style={{ fontSize: 14, color: 'var(--text3)', textAlign: 'center', maxWidth: 380, lineHeight: 1.7 }}>
            Framdriftsplanen er laga per prosjekt. Vel eit prosjekt øvst i vindauget.
          </p>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '14px 20px', minHeight: 0 }}>

          {/* Verktøylinje */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12, flexShrink: 0 }}>
            <div className="fd-seg">
              <button className={visning === 'tidslinje' ? 'pa' : ''} onClick={() => setVisning('tidslinje')}>Tidslinje</button>
              <button className={visning === 'tabell' ? 'pa' : ''} onClick={() => setVisning('tabell')}>Tabell</button>
            </div>
            {visning === 'tidslinje' && (
              <div className="fd-seg">
                {ZOOM.map(([k, t]) => <button key={k} className={zoom === k ? 'pa' : ''} onClick={() => setZoom(k)}>{t}</button>)}
              </div>
            )}
            <span style={{ width: 1, height: 22, background: 'var(--border)' }}/>
            <button className="fd-knapp hovud" onClick={() => leggTil('fase')}>+ Fase</button>
            <button className="fd-knapp" onClick={() => leggTil('aktivitet')}>+ Aktivitet</button>
            <button className="fd-knapp" onClick={() => leggTil('milepael')}>+ Milepæl</button>
            <span style={{ width: 1, height: 22, background: 'var(--border)' }}/>
            <button className="fd-knapp" onClick={() => setMalOpen(true)}>Malar…</button>
            <button className="fd-knapp" onClick={() => setImportOpen(true)}>Importer…</button>
            <button className="fd-knapp" onClick={angre} disabled={!angreAntal} title="Angre siste endring (Ctrl+Z)">↶ Angre</button>
            <div style={{ flex: 1 }}/>
            {visning === 'tidslinje' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={visHendingar} onChange={e => setVisHendingar(e.target.checked)}/>
                Vis fristar og møte ({hendingar.length})
              </label>
            )}
          </div>

          {lastar ? (
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>Lastar plan…</div>
          ) : (
            <div style={{ flex: 1, display: 'flex', gap: 12, minHeight: 0 }}>
              {visning === 'tidslinje' ? (
                <FramdriftTidslinje rader={rader} elementer={elementer} valgt={valgt} onVelg={setValgt}
                  onEndre={endreFraTidslinje} hendingar={hendingar} visHendingar={visHendingar} zoom={zoom}
                  lukka={lukka} onToggleLukka={id => setLukka(l => { const n = new Set(l); n.has(id) ? n.delete(id) : n.add(id); return n })}/>
              ) : (
                <FramdriftTabell elementer={elementer} valgt={valgt} onVelg={setValgt} onEndreFelt={endreFraTabell}/>
              )}

              {/* Eigenskapspanel for valt element */}
              {sel && (
                <div style={{ width: 290, flexShrink: 0, overflow: 'auto', border: '1.5px solid var(--border)',
                  borderRadius: 'var(--r2)', background: 'var(--bg2)', padding: 14, display: 'flex', flexDirection: 'column', gap: 11 }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--brand)' }}>
                      {TYPE_NAMN[sel.type]}
                    </span>
                    <div style={{ flex: 1 }}/>
                    <button onClick={() => setValgt(null)} title="Lukk"
                      style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text3)', lineHeight: 1 }}>×</button>
                  </div>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span className="fd-etikett">Namn</span>
                    <TekstFelt verdi={sel.namn} onLagre={v => v.trim() && settFelt(sel.id, 'namn', v.trim())}/>
                  </label>

                  {erRullaFase(sel) ? (
                    <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
                      {formaterDato(sel.start)} – {formaterDato(sel.slutt)}<br/>
                      Datoane følgjer aktivitetane i fasen. Dra fasen på tidslinja for å flytte alle samstundes.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                        <span className="fd-etikett">{sel.type === 'milepael' ? 'Dato' : 'Start'}</span>
                        <TekstFelt type="date" verdi={sel.start} onLagre={v => settStart(sel.id, v)}/>
                      </label>
                      {sel.type !== 'milepael' && (
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                          <span className="fd-etikett">Slutt</span>
                          <TekstFelt type="date" verdi={sel.slutt} onLagre={v => settSlutt(sel.id, v)}/>
                        </label>
                      )}
                    </div>
                  )}
                  {sel.type !== 'milepael' && (
                    <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{antalArbeidsdagar(sel)} arbeidsdagar</div>
                  )}

                  {sel.type === 'fase' && (
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span className="fd-etikett">Fasekode (teikningsnummer)</span>
                      <select className="fd-input" value={sel.fasekode || ''} onChange={e => settFelt(sel.id, 'fasekode', e.target.value)}>
                        <option value="">—</option>
                        {FASEKODAR.map(f => <option key={f.kode} value={f.kode}>{f.kode} {f.namn}</option>)}
                      </select>
                    </label>
                  )}
                  {sel.type !== 'fase' && (
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span className="fd-etikett">Fase</span>
                      <select className="fd-input" value={sel.forelder ?? ''}
                        onChange={e => oppdater(rullOpp(elementer.map(x => (x.id === sel.id ? { ...x, forelder: e.target.value === '' ? null : +e.target.value } : x))))}>
                        <option value="">(ingen fase)</option>
                        {elementer.filter(f => f.type === 'fase').map(f => <option key={f.id} value={f.id}>{f.namn}</option>)}
                      </select>
                    </label>
                  )}
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span className="fd-etikett">Ansvarleg</span>
                    <TekstFelt verdi={sel.ansvarleg || ''} onLagre={v => settFelt(sel.id, 'ansvarleg', v.trim())}/>
                  </label>
                  {sel.type === 'aktivitet' && (
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span className="fd-etikett">Ferdig: {sel.ferdig || 0} %</span>
                      <input type="range" min="0" max="100" step="5" value={sel.ferdig || 0}
                        onChange={e => settFelt(sel.id, 'ferdig', +e.target.value)}/>
                    </label>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span className="fd-etikett">Startar når dette er ferdig</span>
                    {(sel.avh || []).map(pid => {
                      const p = elementer.find(x => x.id === pid)
                      return p && (
                        <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text)',
                          background: 'var(--bg3)', borderRadius: 6, padding: '4px 8px' }}>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.namn}</span>
                          <button onClick={() => oppdater(fjernAvhengnad(elementer, sel.id, pid))} title="Fjern avhengnad"
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 15, lineHeight: 1 }}>×</button>
                        </div>
                      )
                    })}
                    <select className="fd-input" value="" onChange={e => {
                      if (!e.target.value) return
                      const pid = +e.target.value
                      const feil = avhengnadFeil(elementer, sel.id, pid)
                      if (feil) alert(feil); else oppdater(leggTilAvhengnad(elementer, sel.id, pid))
                    }}>
                      <option value="">+ Legg til avhengnad…</option>
                      {elementer.filter(x => x.id !== sel.id && !avhengnadFeil(elementer, sel.id, x.id)).map(x => (
                        <option key={x.id} value={x.id}>{x.type === 'fase' ? '▸ ' : '   '}{x.namn}</option>
                      ))}
                    </select>
                    {(sel.avh || []).length > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
                        Startar tidlegast dagen etter at føregangaren er ferdig. Flyttar du føregangaren, fylgjer denne med.
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <button className="fd-knapp" style={{ flex: 1 }} onClick={() => oppdater(flyttRekkjefolgje(elementer, sel.id, -1))}>↑ Opp</button>
                    <button className="fd-knapp" style={{ flex: 1 }} onClick={() => oppdater(flyttRekkjefolgje(elementer, sel.id, 1))}>↓ Ned</button>
                    <button className="fd-knapp fare" onClick={() => slett(sel.id)}>Slett</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {malOpen && <MalVindauge harPlan={elementer.length > 0} onLukk={() => setMalOpen(false)} onBruk={brukMal}/>}
      {importOpen && <FramdriftImportModal harPlan={elementer.length > 0} onLukk={() => setImportOpen(false)} onImporter={importer}/>}
    </div>
  )
}

// ── Malvindauge ────────────────────────────────────────────────────────
function MalVindauge({ harPlan, onLukk, onBruk }) {
  const [malId, setMalId] = useState(MALAR[0].id)
  const [start, setStart] = useState(() => iso(nesteArbeidsdag(addDays(new Date(), 1))))
  const [erstatt, setErstatt] = useState(false)
  const mal = MALAR.find(m => m.id === malId)
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.42)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: 'var(--bg2)', borderRadius: 'var(--r2)', width: 'min(94vw, 600px)', maxHeight: '90vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', boxShadow: '0 24px 70px rgba(0,0,0,.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', background: 'var(--brand)' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Start frå mal</span>
          <div style={{ flex: 1 }}/>
          <button onClick={onLukk} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'rgba(255,255,255,.85)', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MALAR.map(m => (
              <label key={m.id} style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 'var(--r)', cursor: 'pointer',
                border: `1.5px solid ${malId === m.id ? 'var(--brand)' : 'var(--border)'}`, background: malId === m.id ? 'var(--brandbg)' : 'transparent' }}>
                <input type="radio" checked={malId === m.id} onChange={() => setMalId(m.id)} style={{ marginTop: 3 }}/>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>{m.namn}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>{m.skildring}</div>
                </div>
              </label>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
            <b style={{ color: 'var(--text2)' }}>Innhald:</b>{' '}
            {mal.fasar.map(f => `${f.namn} (${f.element.filter(e => e.type === 'aktivitet').length} aktivitetar)`).join(' · ')}.
            Varigheitene er typiske utgangspunkt — juster dei i planen.
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 190 }}>
            <span className="fd-etikett">Startdato</span>
            <input className="fd-input" type="date" value={start} onChange={e => e.target.value && setStart(e.target.value)}/>
          </label>
          {harPlan && (
            <div style={{ display: 'flex', gap: 18, fontSize: 12.5, color: 'var(--text2)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="radio" checked={!erstatt} onChange={() => setErstatt(false)}/> Legg til i eksisterande plan
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="radio" checked={erstatt} onChange={() => setErstatt(true)}/> Erstatt eksisterande plan
              </label>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
          <div style={{ flex: 1 }}/>
          <button className="fd-knapp" onClick={onLukk}>Avbryt</button>
          <button className="fd-knapp hovud" onClick={() => onBruk(mal, start, erstatt)}>Lag plan</button>
        </div>
      </div>
    </div>
  )
}
