import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { addDays, parseISO } from 'date-fns'
import { supabase } from './supabase'
import FramdriftTidslinje from './FramdriftTidslinje'
import FramdriftTabell from './FramdriftTabell'
import FramdriftOversikt from './FramdriftOversikt'
import FramdriftImportModal from './FramdriftImportModal'
import FramdriftTimarPanel from './FramdriftTimarPanel'
import { sikrStandardPersonell } from './personellStandard'
import FramdriftBemanning from './FramdriftBemanning'
import FramdriftLeveransarVindauge from './FramdriftLeveransarVindauge'
import { personFargeKart } from './personFarge'
import { eksporterExcel } from './framdriftEksport'
import FramdriftForbrukModal from './FramdriftForbrukModal'
import { FdMeny, MenyPunkt, MenyTittel, MenySkilje, PalopInnanMeny } from './FramdriftVerktoy'
import { palopSlutt } from './framdriftPalop'
import { kopleForbruk, bygForbrukKart, nokkelNamn } from './framdriftForbruk'
import { leveransarFerdig, effektivFerdig, brukarAuto, faseFerdig } from './framdriftFerdig'
import useKontorkalender from './useKontorkalender'
import { timarPerVeke, overbelastning, medEffektiveTimar, personDelar, prisKartFra, snittpris, prisFor } from './framdriftTimar'
import { MALAR } from './framdriftMalar'
import { iso, tilDato, parseDato, nesteArbeidsdag, forrigeArbeidsdag, formaterDato } from './framdriftDato'
import {
  rullOpp, harBorn, beregnDatoar, settElement, avhengnadFeil, leggTilAvhengnad, fjernAvhengnad, slettElement,
  flyttRekkjefolgje, visingsrader, pnsKart, nyttElement, byggFraMal, FASEKODAR, antalArbeidsdagar,
  erSumm, erRulla, flyttNode, innrykk, utrykk, settSumm, moglegeForeldre, forfedrar, etterkommarar, nivåAv, kanFlytteTil,
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

const FARGEVAL = ['#2D6A4F', '#1565C0', '#B5296B', '#C2570C', '#0E7490', '#6D28D9', '#8A6D00', '#B91C1C', '#475569', '#0F766E', '#D97706', '#7C3AED']
function FargeVelgar({ verdi, onVelg }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span className="fd-etikett">Farge</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
        <button type="button" title="Standard (følgjer fasen)" onClick={() => onVelg('')}
          style={{ width: 22, height: 22, borderRadius: 6, cursor: 'pointer', fontSize: 11, color: 'var(--text3)', background: 'var(--bg3)',
            border: !verdi ? '2.5px solid var(--text)' : '1.5px solid var(--border)', padding: 0 }}>⊘</button>
        {FARGEVAL.map(f => (
          <button key={f} type="button" title={f} onClick={() => onVelg(f)}
            style={{ width: 22, height: 22, borderRadius: 6, cursor: 'pointer', background: f, padding: 0,
              border: verdi.toLowerCase() === f.toLowerCase() ? '2.5px solid var(--text)' : '1.5px solid rgba(0,0,0,.15)' }}/>
        ))}
        <input type="color" value={verdi || '#2D6A4F'} onChange={e => onVelg(e.target.value)} title="Eigen farge"
          style={{ width: 26, height: 24, padding: 0, border: '1.5px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer' }}/>
      </div>
    </div>
  )
}

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
  const [visTimar, setVisTimar] = useState(true)
  const [dokument, setDokument] = useState([])     // DTM-dokument for valt prosjekt (til leveransekopling/framdrift)
  const [panelOpen, setPanelOpen] = useState(() => { try { return localStorage.getItem('liedlab-framdrift-panel-open') !== '0' } catch { return true } })
  const veksleOpen = (v) => { setPanelOpen(v); try { localStorage.setItem('liedlab-framdrift-panel-open', v ? '1' : '0') } catch { /* privat modus */ } }
  const [forbrukRader, setForbrukRader] = useState([]) // framdrift_forbruk for valt prosjekt (påløpte timar per dato/person/aktivitet)
  const [forbrukOpen, setForbrukOpen] = useState(false)
  const [bemH, setBemH] = useState(() => { try { const v = +localStorage.getItem('liedlab-framdrift-bem-h'); return v >= 120 ? v : 230 } catch { return 230 } })
  const [bemOpen, setBemOpen] = useState(() => { try { return localStorage.getItem('liedlab-framdrift-bem-open') !== '0' } catch { return true } })
  const lsJson = (k, std) => { try { return { ...std, ...(JSON.parse(localStorage.getItem(k)) || {}) } } catch { return std } }
  const [palopInnan, setPalopInnanRaa] = useState(() => lsJson('liedlab-framdrift-palop-innan', { modus: 'alle', verdi: '' }))
  const setPalopInnan = (v) => { setPalopInnanRaa(v); try { localStorage.setItem('liedlab-framdrift-palop-innan', JSON.stringify(v)) } catch { /* privat modus */ } }
  const [fdVis, setFdVisRaa] = useState(() => lsJson('liedlab-framdrift-vis', { eining: 'timar', delsummer: false }))   // Visning: eining i veke-kolonnane og delsummer
  const setFdVis = (patch) => setFdVisRaa(v => { const n = { ...v, ...patch }; try { localStorage.setItem('liedlab-framdrift-vis', JSON.stringify(n)) } catch { /* privat modus */ } return n })
  const [eksporterer, setEksporterer] = useState(false)
  const [koblingMelding, setKoblingMelding] = useState(null)
  const [leveransarOpen, setLeveransarOpen] = useState(false)
  const [personell, setPersonell] = useState([]) // prosjekt_personell for valt prosjekt (Prosjekt → Personell)
  const { kal } = useKontorkalender(userId)

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

  useEffect(() => {
    let avbrote = false
    if (!userId || !activeProjectId) { setPersonell([]); return }
    supabase.from('prosjekt_personell').select('*').eq('user_id', userId).eq('project_id', activeProjectId).order('sortering').order('id')
      .then(async ({ data }) => {
        let liste = data || []
        const ny = await sikrStandardPersonell(userId, activeProjectId, liste)
        if (ny) liste = [ny]
        if (!avbrote) setPersonell(liste)
      })
    return () => { avbrote = true }
  }, [userId, activeProjectId])

  const lastDokument = useCallback(() => {
    if (!userId || !activeProjectId) { setDokument([]); return Promise.resolve() }
    return supabase.from('dtm_dokumenter').select('id,nr,tittel,fag,fase,delprosjekt,ferdigstillelse,timebudsjett,i_leveranseplan')
      .eq('user_id', userId).eq('project_id', activeProjectId).order('nr')
      .then(({ data }) => setDokument(data || []))
  }, [userId, activeProjectId])
  useEffect(() => { lastDokument() }, [lastDokument])
  const dokMap = useMemo(() => new Map(dokument.map(d => [d.id, d])), [dokument])

  const lastForbruk = useCallback(() => {
    if (!userId || !activeProjectId) { setForbrukRader([]); return Promise.resolve() }
    return supabase.from('framdrift_forbruk').select('dato,vekeaar,vekenr,ansatt,ansatt_namn,aktivitet,kode,timar,beskrivelse')
      .eq('user_id', userId).eq('project_id', activeProjectId).order('dato').limit(20000)
      .then(({ data }) => setForbrukRader((data || []).map(r => ({ dato: r.dato, vekeaar: r.vekeaar, vekenr: r.vekenr, ansatt: r.ansatt, ansattNamn: r.ansatt_namn, aktivitet: r.aktivitet, kode: r.kode, timar: +r.timar || 0, beskrivelse: r.beskrivelse }))))
  }, [userId, activeProjectId])
  useEffect(() => { lastForbruk() }, [lastForbruk])

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

  // Plan med EFFEKTIVE timar (frå budsjett ÷ snittpris når modus = budsjett) — brukt til visning og utrekning; redigering går mot råplanen (elementer)
  const palopSluttDato = palopSlutt(palopInnan)
  const forbrukRaderBruk = useMemo(() => (palopSluttDato ? forbrukRader.filter(r => r.dato <= palopSluttDato) : forbrukRader), [forbrukRader, palopSluttDato])
  const forbruk = useMemo(() => kopleForbruk(elementer, forbrukRaderBruk), [elementer, forbrukRaderBruk])
  const forbrukKart = useMemo(() => bygForbrukKart(forbruk.perAkt), [forbruk])
  const forbrukUtanTimar = useMemo(() => [...forbruk.utan.values()].reduce((a, u) => a + u.timar, 0), [forbruk])
  const elBase = useMemo(() => medEffektiveTimar(elementer, personell), [elementer, personell])
  // Påløpte timar frå forbruksrapporten (importert) går føre manuelt innskrivne
  const elEff = useMemo(() => elBase.map(e => {
    const a = e.type === 'aktivitet' ? forbrukKart.get(e.id) : null
    if (!a || harBorn(elBase, e.id)) return e
    const prisarMap = prisKartFra(personell)
    const delar = personDelar(e)
    const snitt = snittpris(e, prisarMap).pris
    let kost = 0
    for (const [namn, p] of a.personer) {
      const d = delar.find(x => nokkelNamn(x.namn) === nokkelNamn(namn))
      const r = d ? prisFor(d, prisarMap) : (prisarMap.get((namn || '').toLowerCase()) || 0)
      kost += p.total * (r || snitt || 0)
    }
    return { ...e, palopTimar: Math.round(a.total * 100) / 100, palopKilde: 'forbruk', ...(kost > 0 ? { palopHonorar: Math.round(kost) } : {}) }
  }), [elBase, forbrukKart, personell])
  const rader = useMemo(() => visingsrader(elEff, lukka), [elEff, lukka])
  const fargeKart = useMemo(() => personFargeKart(personell), [personell])
  const timarKart = useMemo(() => timarPerVeke(elEff, kal), [elEff, kal])
  const [utvida, setUtvida] = useState(() => new Set()) // aktivitetar med opne person-underrader (tidslinje)
  const toggleUtvida = (id) => setUtvida(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const overlast = useMemo(() => overbelastning(timarKart, personell, kal), [timarKart, personell, kal])
  const talOverlast = overlast.size
  const sel = elementer.find(e => e.id === valgt) || null
  const selEff = elEff.find(e => e.id === valgt) || null

  // ── Handlingar ──
  const endreFraTidslinje = (id, modus, d) => {
    const e = elementer.find(x => x.id === id)
    if (!e) return
    const n = beregnDatoar(e, modus, d)
    oppdater(settElement(elementer, id, n.start, n.slutt, { beholdVarigheit: modus === 'flytt' }))
  }

  const erRullaFase = (e) => erRulla(elementer, e) // overordna med born: datoane følgjer underaktivitetane

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
  const settFelter = (id, patch) => oppdater(elementer.map(e => (e.id === id ? { ...e, ...patch } : e)))
  const settFelt = (id, felt, verdi) => oppdater(elementer.map(e => (e.id === id ? { ...e, [felt]: verdi } : e)))

  const endreFraTabell = (id, key, verdi) => {
    if (key === 'namn') { if (String(verdi).trim()) settFelt(id, 'namn', String(verdi).trim()); return }
    if (key === 'ansvarleg') { settFelt(id, 'ansvarleg', String(verdi).trim()); return }
    if (['timar', 'budsjett', 'btype', 'timerate', 'palopTimar', 'palopHonorar', 'fordeling', 'ferdig'].includes(key) && erSumm(elementer, elementer.find(x => x.id === id))) return // summasjonsaktivitetar/fasar: summen kjem frå underaktivitetane
    if ((key === 'timar' || key === 'fordeling') && elementer.find(x => x.id === id)?.type !== 'aktivitet') return // timar høyrer til aktivitetar
    if (key === 'timar') { settFelter(id, { timar: Math.max(0, Math.round((parseFloat(String(verdi).replace(',', '.')) || 0) * 2) / 2), modus: 'timar' }); return }
    if (key === 'budsjett') { if (elementer.find(x => x.id === id)?.type !== 'aktivitet') return; settFelter(id, { budsjett: Math.max(0, Math.round(parseFloat(String(verdi).replace(/\s/g, '').replace(',', '.')) || 0)), modus: 'budsjett' }); return }
    if (key === 'kode') { settFelt(id, 'kode', String(verdi).trim()); return }
    if (key === 'btype') { const t = ['Fastpris', 'Budsjettpris', 'Ufakturerbart'].find(k => k.toLowerCase() === String(verdi).trim().toLowerCase()); settFelt(id, 'budsjettType', t || ''); return }
    if (key === 'timerate') { const n = parseFloat(String(verdi).replace(/\s/g, '').replace(',', '.')); settFelt(id, 'timerate', n > 0 ? Math.round(n) : null); return }
    if (key === 'palopTimar' || key === 'palopHonorar') {
      const n = parseFloat(String(verdi).replace(/\s/g, '').replace(',', '.'))
      settFelt(id, key, n >= 0 ? (key === 'palopTimar' ? Math.round(n * 2) / 2 : Math.round(n)) : null); return
    }
    if (key === 'fordeling') { const f = ['fast', 'start', 'midt', 'slutt'].find(k => k === String(verdi).toLowerCase()); if (f) settFelt(id, 'fordeling', f); return }
    if (key === 'ferdig') {
      // å skrive eit tal i tabellen er ei skjønnsmessig vurdering → overstyrer utrekning frå leveransar
      const n = Math.max(0, Math.min(100, parseInt(verdi, 10) || 0))
      oppdater(elementer.map(e => (e.id === id ? { ...e, ferdig: n, ferdigModus: 'skjonn' } : e))); return
    }
    if (key === 'start' || key === 'slutt') {
      const d = parseDato(verdi)
      if (!d) { alert('Skriv datoen som dd.mm.åååå, t.d. 05.10.2026.'); return }
      const e = elementer.find(x => x.id === id)
      if (erRullaFase(e)) { alert('Datoane til ei fase med aktivitetar følgjer aktivitetane — endre dei i staden.'); return }
      key === 'start' ? settStart(id, iso(d)) : settSlutt(id, iso(d))
    }
  }

  // «Startar når A er ferdig»-kopling dratt direkte i tidslinja: B (til) startar når A (fra) er ferdig
  const koble = (fraId, tilId) => {
    const feil = avhengnadFeil(elementer, tilId, fraId)
    if (feil) { setKoblingMelding(feil); setTimeout(() => setKoblingMelding(null), 4000); return }
    oppdater(leggTilAvhengnad(elementer, tilId, fraId))
  }
  const fjernAvh = (fraId, tilId) => oppdater(fjernAvhengnad(elementer, tilId, fraId))

  // ── Hierarki: summasjonsaktivitetar, innrykk/utrykk, dra til ny plass ──
  const opneForelder = (id) => { if (id != null) setLukka(l => { const n = new Set(l); n.delete(id); return n }) }
  const flyttHierarki = (id, malId, pos) => {
    if (!kanFlytteTil(elementer, id, malId, pos)) return
    oppdater(flyttNode(elementer, id, malId, pos))
    if (pos === 'inni') opneForelder(malId)
  }
  const gjerInnrykk = (id) => { const ny = innrykk(elementer, id); if (ny !== elementer) { oppdater(ny); const f = ny.find(x => x.id === id)?.forelder; opneForelder(f) } }
  const gjerUtrykk = (id) => { const ny = utrykk(elementer, id); if (ny !== elementer) oppdater(ny) }
  const veksleSumm = (id, pa) => {
    const e = elementer.find(x => x.id === id)
    if (!e) return
    if (!pa && harBorn(elementer, id) && !window.confirm('Oppheve summasjonsaktiviteten «' + e.namn + '»? Underaktivitetane flyttar opp eitt nivå.')) return
    oppdater(settSumm(elementer, id, pa))
  }

  const eksporter = async (medTidslinje) => {
    setEksporterer(true)
    try {
      await eksporterExcel({ elementer: elEff, dokMap, prisar: prisKartFra(personell), kal, fargeKart, prosjektNamn: aktivtProsjekt?.name, medTidslinje })
    } catch (e) { setKoblingMelding('Klarte ikkje eksportere til Excel: ' + e.message); setTimeout(() => setKoblingMelding(null), 6000) }
    setEksporterer(false)
  }

  const leggTil = (type) => {
    const valdFase = sel && erSumm(elementer, sel) && sel.type !== 'milepael' ? sel.id : sel?.forelder ?? null
    let start = new Date()
    const forelder = type === 'fase' ? null : valdFase
    const søsken = elementer.filter(e => (e.forelder ?? null) === (forelder ?? null) && (type === 'fase' ? e.type === 'fase' : true))
    if (søsken.length) start = addDays(tilDato(søsken.reduce((m, e) => (e.slutt > m ? e.slutt : m), søsken[0].slutt)), 1)
    const nytt = nyttElement(type, { start, forelder })
    oppdater(rullOpp([...elementer, nytt]))
    setValgt(nytt.id)
    if (forelder != null) setLukka(l => { const n = new Set(l); n.delete(forelder); return n })
  }

  // PNS (prosjektnedbrytingsstruktur): vis til og med nivå k — alle overordna på nivå k og djupare vert lukka
  const pnsMaks = useMemo(() => { const k = pnsKart(elementer); let m = 0; for (const [id, n] of k) if (harBorn(elementer, id)) m = Math.max(m, n.split('.').length); return m }, [elementer])
  const visPnsNivaa = (k) => {
    const kart = pnsKart(elementer); const n = new Set()
    for (const e of elementer) if (e.type !== 'milepael' && harBorn(elementer, e.id) && (kart.get(e.id) || '').split('.').length >= k) n.add(e.id)
    setLukka(n)
  }

  const slett = (id) => {
    const e = elementer.find(x => x.id === id)
    if (!e) return
    const antall = etterkommarar(elementer, id).length
    if (!window.confirm(`Slette «${e.namn}»${antall ? ` og dei ${antall} underaktivitetane` : ''}?`)) return
    oppdater(slettElement(elementer, id)); setValgt(null)
  }

  const brukMal = (mal, startIso, erstatt) => {
    const nye = byggFraMal(mal, startIso)
    oppdater(erstatt ? nye : rullOpp([...elementer, ...nye]))
    setMalOpen(false)
    setValgt(null)
  }

  // Nye aktivitetar frå forbruksimporten (aktivitetsnummer → kode, resten → namn); datoar frå fyrste/siste timeføring
  const opprettAktivitetar = (liste) => {
    const eksist = new Set(elementer.filter(e => e.type === 'aktivitet').map(e => String(e.kode || '').trim().toLowerCase()).filter(Boolean))
    const nye = []
    for (const a of liste) {
      if (eksist.has(String(a.kode).toLowerCase())) continue
      const el = nyttElement('aktivitet', { start: tilDato(a.fra), namn: a.namn || a.kode })
      el.kode = String(a.kode)
      const slutt = iso(forrigeArbeidsdag(tilDato(a.til)))
      el.slutt = slutt < el.start ? el.start : slutt
      nye.push(el)
    }
    if (nye.length) oppdater(rullOpp([...elementer, ...nye]))
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
      <datalist id="fd-personell">{personell.map(p => <option key={p.id} value={p.namn}/>)}</datalist>

      {/* Verktøylinje (NL3): Påløpt innan · visning · Ny · Import · Eksport · Visning · PNS */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', minHeight: 50, flexShrink: 0, flexWrap: 'wrap', background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
        {aktivtProsjekt && (<>
          <PalopInnanMeny verdi={palopInnan} onEndre={setPalopInnan}/>
          <span style={{ width: 1, height: 22, background: 'var(--border)' }}/>
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
          <FdMeny etikett="＋ Ny" hovud breidd={230}>{lukk => (<>
            <MenyPunkt tittel="Ny aktivitet" onClick={() => { lukk(); leggTil('aktivitet') }}/>
            <MenyPunkt tittel="Ny fase" onClick={() => { lukk(); leggTil('fase') }}/>
            <MenyPunkt tittel="Ny milepæl" onClick={() => { lukk(); leggTil('milepael') }}/>
            <MenySkilje/>
            <MenyPunkt tittel="Frå mal…" under="Start frå ein ferdig fasemal" onClick={() => { lukk(); setMalOpen(true) }}/>
          </>)}</FdMeny>
          <FdMeny etikett="Import" breidd={300}>{lukk => (<>
            <MenyPunkt tittel="Importer plan…" under="MS Project (XML/ISY), Excel eller CSV" onClick={() => { lukk(); setImportOpen(true) }}/>
            <MenyPunkt tittel="Importer forbruk…" under="Påløpte timar frå timeføringsrapport (Excel)" onClick={() => { lukk(); setForbrukOpen(true) }}/>
          </>)}</FdMeny>
          <FdMeny etikett={eksporterer ? 'Eksporterer…' : 'Eksport'} disabled={!elementer.length || eksporterer} breidd={290}>{lukk => (<>
            <MenyPunkt tittel="Excel — berre tabell" under="Alle kolonnar + timar per veke (tal), personar som underrader" onClick={() => { lukk(); eksporter(false) }}/>
            <MenyPunkt tittel="Excel — tabell med tidslinje" under="Same tabell, men vekekolonnane teiknar stolpane i fargar" onClick={() => { lukk(); eksporter(true) }}/>
            <div style={{ fontSize: 11, color: 'var(--text3)', padding: '4px 10px 2px' }}>Eit ekstra ark gir timar per person per veke.</div>
          </>)}</FdMeny>
          <FdMeny etikett="Visning" breidd={290}>{() => (<>
            <MenyTittel>Veke-kolonnar viser</MenyTittel>
            <MenyPunkt tittel="Timar" merkt={fdVis.eining === 'timar'} under="Planlagde og påløpte timar" onClick={() => setFdVis({ eining: 'timar' })}/>
            <MenyPunkt tittel="Påløpt honorar" merkt={fdVis.eining === 'honorar'} under="Timar × timerate (kr)" onClick={() => setFdVis({ eining: 'honorar' })}/>
            <MenySkilje/>
            <MenyPunkt tittel="Vis delsummer" merkt={fdVis.delsummer} under="Ei summelinje etter kvart delnivå i tabellen" onClick={() => setFdVis({ delsummer: !fdVis.delsummer })}/>
            {visning === 'tidslinje' && (<>
              <MenySkilje/>
              <MenyTittel>Tidslinje</MenyTittel>
              <MenyPunkt tittel={'Timar per veke' + (talOverlast > 0 ? ' (' + talOverlast + ' overbelasta)' : '')} merkt={visTimar} onClick={() => setVisTimar(v => !v)}/>
              <MenyPunkt tittel={'Fristar og møte (' + hendingar.length + ')'} merkt={visHendingar} onClick={() => setVisHendingar(v => !v)}/>
            </>)}
          </>)}</FdMeny>
          <FdMeny etikett="PNS" breidd={270} disabled={!elementer.length} tittel="Prosjektnedbrytingsstruktur — vel kor mange nivå som skal vere opne">{lukk => (<>
            <MenyTittel>Vis til og med nivå</MenyTittel>
            {Array.from({ length: pnsMaks }, (_, i) => i + 1).map(k => (
              <MenyPunkt key={k} tittel={'Nivå ' + k} under={'PNS ' + Array.from({ length: k }, (_, j) => j + 1).join('.')} onClick={() => { lukk(); visPnsNivaa(k) }}/>
            ))}
            <MenyPunkt tittel="Alle nivå" under="Fold ut alt" onClick={() => { lukk(); setLukka(new Set()) }}/>
          </>)}</FdMeny>
          <button className="fd-knapp" onClick={angre} disabled={!angreAntal} title="Angre siste endring (Ctrl+Z)">↶ Angre</button>
        </>)}
        <div style={{ flex: 1 }}/>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: lagringStatus === 'feil' ? '#FCA5A5' : 'var(--text2)' }}>{lagStatusTekst}</span>
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

          {koblingMelding && <div style={{ marginBottom: 8, padding: '6px 12px', background: 'var(--dangerbg, #fdecea)', color: 'var(--danger)', borderRadius: 6, fontSize: 12.5, flexShrink: 0 }}>{koblingMelding}</div>}
          {lastar ? (
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>Lastar plan…</div>
          ) : (
            <div style={{ flex: 1, display: 'flex', gap: 12, minHeight: 0 }}>
              {/* Eigenskapspanel for valt element — kollapsbar kolonne heilt til venstre i modulen */}
              {!panelOpen && (
                <div onClick={() => veksleOpen(true)} title="Vis sidefeltet" style={{ width: 30, flexShrink: 0, cursor: 'pointer', border: '1.5px solid var(--border)',
                  borderRadius: 'var(--r2)', background: '#FFFFFF', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 10, gap: 10 }}>
                  <span style={{ fontSize: 15, color: 'var(--text3)' }}>›</span>
                  <span style={{ writingMode: 'vertical-rl', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>{sel ? 'Eigenskapar' : 'Planoversikt'}</span>
                </div>
              )}
              {panelOpen && (
                <div style={{ width: 290, flexShrink: 0, overflow: 'auto', border: '1.5px solid var(--border)',
                  borderRadius: 'var(--r2)', background: '#FFFFFF', padding: 14, display: 'flex', flexDirection: 'column', gap: 11 }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--brand)' }}>
                      {sel ? (sel.type === 'aktivitet' && erSumm(elementer, sel) ? 'Summasjonsaktivitet' : TYPE_NAMN[sel.type]) : 'Planoversikt'}
                    </span>
                    <div style={{ flex: 1 }}/>
                    <button onClick={() => veksleOpen(false)} title="Skjul panelet"
                      style={{ border: 'none', background: 'none', fontSize: 17, cursor: 'pointer', color: 'var(--text3)', lineHeight: 1, marginRight: 4 }}>‹</button>
                    {sel && <button onClick={() => setValgt(null)} title="Fjern utval (vis planoversikt)"
                      style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text3)', lineHeight: 1 }}>×</button>}
                  </div>
                  {!sel && <FramdriftOversikt forbrukKart={forbrukKart} forbrukUtanTimar={forbrukUtanTimar} fargeKart={fargeKart} prosjektNamn={aktivtProsjekt?.name} elementer={elEff} dokMap={dokMap} timarKart={timarKart} overlast={overlast} hendingar={hendingar} onVelg={setValgt}/>}
                  {sel && (<>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span className="fd-etikett">Namn</span>
                    <TekstFelt verdi={sel.namn} onLagre={v => v.trim() && settFelt(sel.id, 'namn', v.trim())}/>
                  </label>

                  <FargeVelgar verdi={sel.farge || ''} onVelg={f => settFelt(sel.id, 'farge', f)}/>
                  <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6, background: 'var(--bg3)', borderRadius: 7, padding: '6px 9px' }}>
                    {formaterDato(sel.start)}{sel.type !== 'milepael' ? ' – ' + formaterDato(sel.slutt) + ' · ' + antalArbeidsdagar(sel) + ' arbeidsdagar' : ''}<br/>
                    <span style={{ fontSize: 11 }}>{erRullaFase(sel) ? 'Datoane følgjer underaktivitetane.' : 'Datoar, timar, budsjett, timerate og ansvarleg skriv du direkte i tabellen (dobbeltklikk).'}</span>
                  </div>
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
                    <>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span className="fd-etikett">Overordna (fase / summasjonsaktivitet)</span>
                        <select className="fd-input" value={sel.forelder ?? ''}
                          onChange={e => (e.target.value === '' ? flyttHierarki(sel.id, null, 'rot') : flyttHierarki(sel.id, +e.target.value, 'inni'))}>
                          <option value="">(ingen — toppnivå)</option>
                          {moglegeForeldre(elementer, sel.id).map(f => <option key={f.id} value={f.id}>{'\u00a0\u00a0'.repeat(nivåAv(elementer, f.id))}{f.type === 'fase' ? '▸ ' : ''}{f.namn}</option>)}
                        </select>
                      </label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="fd-knapp" style={{ flex: 1 }} onClick={() => gjerUtrykk(sel.id)} disabled={sel.forelder == null}
                          title="Flytt eitt nivå ut (blir søsken til overordna)">⇤ Flytt ut</button>
                        <button className="fd-knapp" style={{ flex: 1 }} onClick={() => gjerInnrykk(sel.id)}
                          title="Flytt eitt nivå inn (blir underaktivitet av aktiviteten over, som då vert summasjonsaktivitet)">⇥ Flytt inn</button>
                      </div>
                    </>
                  )}
                  {sel.type === 'aktivitet' && (
                    <button className={'fd-knapp' + (erSumm(elementer, sel) ? ' hovud' : '')} onClick={() => veksleSumm(sel.id, !erSumm(elementer, sel))}
                      disabled={erRulla(elementer, sel) && false}
                      title={erSumm(elementer, sel) ? 'Opphev summasjonsaktivitet (underaktivitetane flyttar opp eitt nivå)' : 'Gjer aktiviteten til ein summasjonsaktivitet som samlar underaktivitetar — dra aktivitetar inn under han, eller bruk «Flytt inn»'}>
                      {erSumm(elementer, sel) ? '✓ Summasjonsaktivitet — opphev' : '∑ Marker som summasjonsaktivitet'}
                    </button>
                  )}
                  {sel.type === 'aktivitet' && !erSumm(elementer, sel) && (
                    <FramdriftTimarPanel el={selEff} kal={kal} personell={personell} onEndre={p => settFelter(sel.id, p)}/>
                  )}
                  {sel.type !== 'milepael' && erSumm(elementer, sel) && (() => {
                    const blad = etterkommarar(elEff, sel.id).filter(c => c.type === 'aktivitet' && !harBorn(elEff, c.id))
                    const t = blad.reduce((a, c) => a + (+c.timar || 0), 0)
                    const b = blad.reduce((a, c) => a + (+c.budsjett || 0), 0)
                    const fd = faseFerdig(elEff, sel, dokMap)
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: 'var(--text2)', background: 'var(--bg3)', borderRadius: 8, padding: '8px 10px' }}>
                        <div><b>{blad.length}</b> underaktivitet{blad.length === 1 ? '' : 'ar'} · <b>{Math.round(t * 2) / 2} t</b>{b > 0 ? <> · <b>{b.toLocaleString('nb-NO')} kr</b> budsjett</> : null}</div>
                        <div>Samla framdrift <b>{fd} %</b></div>
                        {blad.length === 0 && <div style={{ color: 'var(--text3)' }}>Ingen underaktivitetar enno — dra aktivitetar inn under denne i tidslinja, eller bruk «Flytt inn» på ein aktivitet rett under.</div>}
                      </div>
                    )
                  })()}

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
                  </>)}
                </div>
              )}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
              <div style={{ flex: 1, display: 'flex', minHeight: 0, minWidth: 0 }}>
              {visning === 'tidslinje' ? (
                <FramdriftTidslinje personell={personell} onEndreFelt={endreFraTabell} forbrukKart={forbrukKart} fargeKart={fargeKart} prisar={prisKartFra(personell)} rader={rader} elementer={elEff} kal={kal} utvida={utvida} onToggleUtvida={toggleUtvida} valgt={valgt} onVelg={setValgt}
                  onEndre={endreFraTidslinje} hendingar={hendingar} visHendingar={visHendingar} zoom={zoom}
                  timarKart={timarKart} overlast={overlast} visTimar={visTimar} dokMap={dokMap}
                  onKoble={koble} onFjernAvh={fjernAvh} onFlyttHierarki={flyttHierarki}
                  lukka={lukka} onToggleLukka={id => setLukka(l => { const n = new Set(l); n.has(id) ? n.delete(id) : n.add(id); return n })}/>
              ) : (
                <FramdriftTabell eining={fdVis.eining} delsummer={fdVis.delsummer} personell={personell} forbrukKart={forbrukKart} fargeKart={fargeKart} dokMap={dokMap} elementer={elEff} kal={kal} lukka={lukka} onToggleLukka={id => setLukka(l => { const n = new Set(l); n.has(id) ? n.delete(id) : n.add(id); return n })} prisar={prisKartFra(personell)} valgt={valgt} onVelg={setValgt} onEndreFelt={endreFraTabell}/>
              )}
              </div>
              <FramdriftBemanning el={selEff && selEff.type === 'aktivitet' ? selEff : null} summ={!!(sel && erSumm(elementer, sel))} personell={personell} prisar={prisKartFra(personell)}
                forbrukKart={forbrukKart} fargeKart={fargeKart} dokument={dokument} hogde={bemH} open={bemOpen}
                onHogde={(h, ferdig) => { setBemH(h); if (ferdig) { try { localStorage.setItem('liedlab-framdrift-bem-h', String(h)) } catch { /* privat modus */ } } }}
                onOpen={v => { setBemOpen(v); try { localStorage.setItem('liedlab-framdrift-bem-open', v ? '1' : '0') } catch { /* privat modus */ } }}
                onEndre={patch => sel && settFelter(sel.id, patch)}
                onKopleLeveransar={() => { lastDokument(); setLeveransarOpen(true) }}
                onFerdigModus={m => sel && settFelt(sel.id, 'ferdigModus', m)} onFerdig={n => sel && settFelt(sel.id, 'ferdig', n)}/>
              </div>

            </div>
          )}
        </div>
      )}

      {leveransarOpen && sel?.type === 'aktivitet' && (
        <FramdriftLeveransarVindauge el={sel} dokument={dokument} elementer={elementer} onLukk={() => setLeveransarOpen(false)}
          onLeveransar={ids => oppdater(elementer.map(x => (x.id === sel.id ? { ...x, leveransar: ids } : x)))}
          onModus={m => settFelt(sel.id, 'ferdigModus', m)} onFerdig={n => settFelt(sel.id, 'ferdig', n)}/>
      )}
      {malOpen && <MalVindauge harPlan={elementer.length > 0} onLukk={() => setMalOpen(false)} onBruk={brukMal}/>}
      {forbrukOpen && aktivtProsjekt && <FramdriftForbrukModal userId={userId} prosjekt={aktivtProsjekt} elementer={elementer} onLukk={() => setForbrukOpen(false)} onFerdig={(r) => { setForbrukOpen(false); if (r?.nyeAktivitetar?.length) opprettAktivitetar(r.nyeAktivitetar); lastForbruk() }}/>}
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
