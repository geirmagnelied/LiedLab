import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from './supabase'
import { TalFelt, INNFELT } from './FramdriftBemanning'
import { ENDR_STATUSAR, ENDR_STATUS_FARGE } from './framdriftVerdiar'
import { lagVarselPdf, varselFilnamn } from './framdriftVarselPdf'
import { lastNedPdf } from './framdriftRapport'

// ═══════════════════════════════════════════════════════════════════
//  Endringsvarsel (Prosjektplan → ＋ Ny → Ny endring). Flyttbart/skalerbart/maksimerbart vindauge.
//  Innhald: tittel · koplingar til endringar i endringstabellen · val (budsjett / endringsforslag / anna) med beskriving og
//  konsekvensar for framdrift · honorar og utgifter per aktivitet (kostnadstabell med sum per aktivitet og totalt) ·
//  utarbeidd av + dato · vedlegg (dra inn, velg fil eller frå Dokument-modulen). Lagra i framdrift_endringsvarsel som utkast eller ferdig.
// ═══════════════════════════════════════════════════════════════════
const VINDU_NOKKEL = 'liedlab.endringsvarselVindu'
const MINB = 640, MINH = 440
const PUNKT = [['budsjett', '1. Behov for å justere budsjettet'], ['forslag', '2. Endringsforslag'], ['anna', '3. Anna']]
const idag = () => new Date().toISOString().slice(0, 10)
const nyId = () => Math.random().toString(36).slice(2, 9)
const tomt = (namn) => ({
  endringar: [], val: { budsjett: false, forslag: false, anna: false },
  punkt: { budsjett: { besk: '', framdrift: '' }, forslag: { besk: '', framdrift: '' }, anna: { besk: '', framdrift: '' } },
  honorar: [], utgifter: [], utarbeidd: namn || '', dato: idag(), vedlegg: [],
  utsending: { status: 'Utkast', sendtDato: '', sendtTil: '', sendtMetode: 'E-post', svarDato: '', svarFra: '', merknad: '', logg: [] },
  mappe: (crypto.randomUUID?.() || nyId() + nyId()),
})
const tilTal = (v) => { const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return n > 0 ? n : null }
const kr = (n) => Math.round(n || 0).toLocaleString('nb-NO')
const FELT = { padding: '6px 9px', borderRadius: 'var(--r)', border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font)', outline: 'none', width: '100%', boxSizing: 'border-box' }
const ETT = { fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.07em', margin: '16px 0 6px' }
const TH = { fontSize: 10.5, fontWeight: 800, letterSpacing: '.04em', padding: '6px 8px', border: '1px solid var(--border)', whiteSpace: 'nowrap', background: 'var(--tabell-hovud, #A9C8EC)', color: '#000', textAlign: 'right' }
const TD = { padding: '2px 5px', border: '1px solid var(--border)', fontSize: 12.5, textAlign: 'right', fontFamily: 'var(--mono)' }
const knapp = (prim) => ({ padding: '8px 14px', borderRadius: 'var(--r)', border: prim ? 'none' : '1.5px solid var(--border)', background: prim ? 'var(--brand)' : 'var(--bg2)', color: prim ? '#fff' : 'var(--text2)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' })
const rensNamn = (n) => n.replace(/[^\w.\-æøåÆØÅ]+/g, '_')

export default function FramdriftEndringsvarsel({ onLukk, prosjekt, userId, brukarNamn, aktivitetar, endringar, onSettEndringar }) {
  const [liste, setListe] = useState([])
  const [id, setId] = useState(null)
  const [tittel, setTittel] = useState('')
  const [status, setStatus] = useState('utkast')
  const [d, setD] = useState(() => tomt(brukarNamn))
  const [dirty, setDirty] = useState(false)
  const [melding, setMelding] = useState('')
  const [opptatt, setOpptatt] = useState(false)
  const [spør, setSpør] = useState(false)               // «lagre utkastet?»-dialog ved lukking
  const [dtmOpen, setDtmOpen] = useState(false)
  const [dtmDok, setDtmDok] = useState(null)
  const [dtmSok, setDtmSok] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const filRef = useRef(null)
  const revRef = useRef(0)                          // teljar for ulagra endringar (lagring sluker ikkje det du skriv medan ho går)
  const lagrarRef = useRef(false)
  const merkEndra = () => { revRef.current++; setDirty(true) }

  const aktNamn = (aid) => { const a = aktivitetar.find(x => String(x.id) === String(aid)); return a ? (a.kode ? a.kode + ' ' : '') + a.namn : '(ukjend aktivitet)' }
  const endr = (patch) => { setD(x => ({ ...x, ...patch })); merkEndra() }

  // ── Vindauge ──
  const [geo, setGeo] = useState(() => {
    try { const g = JSON.parse(localStorage.getItem(VINDU_NOKKEL)); if (g && g.w >= MINB && g.h >= MINH) return { ...g, maks: false } } catch { /* ingen lagra */ }
    const w = Math.min(1100, window.innerWidth - 40), h = Math.min(820, window.innerHeight - 40)
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
  const kantar = [['n', { top: -3, left: 10, right: 10, height: 7, cursor: 'ns-resize' }], ['s', { bottom: -3, left: 10, right: 10, height: 7, cursor: 'ns-resize' }],
    ['w', { left: -3, top: 10, bottom: 10, width: 7, cursor: 'ew-resize' }], ['e', { right: -3, top: 10, bottom: 10, width: 7, cursor: 'ew-resize' }],
    ['nw', { left: -3, top: -3, width: 14, height: 14, cursor: 'nwse-resize' }], ['ne', { right: -3, top: -3, width: 14, height: 14, cursor: 'nesw-resize' }],
    ['sw', { left: -3, bottom: -3, width: 14, height: 14, cursor: 'nesw-resize' }], ['se', { right: -3, bottom: -3, width: 14, height: 14, cursor: 'nwse-resize' }]]
  const vinduStil = geo.maks ? { left: 0, top: 0, width: '100vw', height: '100vh', borderRadius: 0 } : { left: geo.x, top: geo.y, width: geo.w, height: geo.h, borderRadius: 'var(--r2)' }

  // ── Lagra varsel ──
  const lastListe = async () => {
    const { data, error } = await supabase.from('framdrift_endringsvarsel').select('id, tittel, status, updated_at, utsending:innhald->utsending->>status').eq('project_id', prosjekt.id).order('updated_at', { ascending: false })
    if (error) { setMelding('Klarte ikkje hente lagra varsel: ' + error.message + ' (er tabellen framdrift_endringsvarsel oppretta?)'); return }
    setListe(data || [])
  }
  useEffect(() => { lastListe() }, [prosjekt.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const opne = async (valId) => {
    if (dirty && !window.confirm('Forkaste ulagra endringar i varselet du har open?')) return
    if (!valId) { setId(null); setTittel(''); setStatus('utkast'); setD(tomt(brukarNamn)); setDirty(false); setMelding(''); return }
    const { data, error } = await supabase.from('framdrift_endringsvarsel').select('*').eq('id', valId).single()
    if (error) { setMelding('Klarte ikkje opne varselet: ' + error.message); return }
    setId(data.id); setTittel(data.tittel || ''); setStatus(data.status); setD({ ...tomt(brukarNamn), ...data.innhald, utsending: { ...tomt().utsending, ...(data.innhald?.utsending || {}) } }); setDirty(false); setMelding('')
  }
  const lagre = async (nyStatus, stille) => {
    if (!tittel.trim()) { if (!stille) setMelding('Skriv ein tittel på endringa først.'); return false }
    if (lagrarRef.current) return false
    lagrarRef.current = true; setOpptatt(true); if (!stille) setMelding('')
    const teljar = revRef.current
    const lagraStatus = d.utsending?.status && d.utsending.status !== 'Utkast' ? 'ferdig' : nyStatus      // sendt/godkjent/avvist er alltid «ferdig»
    const rad = { tittel: tittel.trim(), status: lagraStatus, innhald: d, updated_at: new Date().toISOString() }
    let feil, varselId = id
    if (id) ({ error: feil } = await supabase.from('framdrift_endringsvarsel').update(rad).eq('id', id))
    else {
      const { data, error } = await supabase.from('framdrift_endringsvarsel').insert({ ...rad, project_id: prosjekt.id, created_by: userId }).select('id').single()
      feil = error; if (data) { setId(data.id); varselId = data.id }
    }
    lagrarRef.current = false; setOpptatt(false)
    if (feil) { setMelding('Klarte ikkje lagre: ' + feil.message); return false }
    setStatus(lagraStatus); setDirty(revRef.current !== teljar)
    setMelding(stille ? 'Lagra automatisk.' : lagraStatus === 'utkast' ? 'Utkast lagra.' : 'Varselet er lagra som ferdig.'); lastListe()
    synkEndringar(varselId)
    return true
  }
  // Statusen i varselet vert førd til endringane det er kopla til (kolonnen «Status» i endringstabellen) — berre når varselet er nytt for endringa
  // eller utsendingsstatusen har endra seg, slik at ei manuell endring i tabellen ikkje vert overskrive ved kvar lagring.
  const synkEndringar = (varselId) => {
    if (!onSettEndringar) return
    const u = d.utsending || {}
    const dato = u.status === 'Sendt til kunde' ? (u.sendtDato || idag()) : (u.status === 'Godkjent' || u.status === 'Avvist') ? (u.svarDato || idag()) : (d.dato || idag())
    const harKost = (v) => !!(v && (v.timar || v.fastpris || v.timepris))
    const patchar = []
    for (const k of d.endringar) {
      const en = endringar.find(x => x.id === k.id); if (!en) continue
      if (en.varselId === varselId && en.varselStatus === u.status) { if (en.varselTittel !== tittel.trim()) patchar.push({ akt: en.akt, id: en.id, patch: { varselTittel: tittel.trim() } }); continue }
      patchar.push({ akt: en.akt, id: en.id, patch: { status: u.status, statusDato: dato, varselId, varselStatus: u.status, varselTittel: tittel.trim() }, kanKopiere: u.status === 'Godkjent' && !harKost(en.god) && harKost(en.rev) ? en.rev : null })
    }
    if (!patchar.length) return
    const kopi = patchar.filter(p => p.kanKopiere)
    const kopier = kopi.length > 0 && window.confirm('Kunden har godkjent varselet. Skal dei reviderte kostnadene bli førte til «Godkjent av kunde» for ' + kopi.length + ' endring' + (kopi.length > 1 ? 'ar' : '') + ' der dette feltet er tomt?')
    onSettEndringar(patchar.map(p => ({ akt: p.akt, id: p.id, patch: kopier && p.kanKopiere ? { ...p.patch, god: { ...p.kanKopiere } } : p.patch })))
  }
  const slettVarsel = async () => {
    if (!id || !window.confirm('Slette endringsvarselet «' + tittel + '»? Dette kan ikkje angrast.')) return
    const { error } = await supabase.from('framdrift_endringsvarsel').delete().eq('id', id)
    if (error) { setMelding('Klarte ikkje slette: ' + error.message); return }
    setId(null); setTittel(''); setD(tomt(brukarNamn)); setDirty(false); setMelding('Varselet er sletta.'); lastListe()
  }
  // Autolagring: eit varsel som alt er lagra vert lagra på nytt 12 s etter siste endring (nye varsel må lagrast ein gong manuelt)
  useEffect(() => {
    if (!dirty || !id || !tittel.trim()) return
    const t = setTimeout(() => { lagre(status, true) }, 12000)
    return () => clearTimeout(t)
  }, [d, tittel, dirty, id, status]) // eslint-disable-line react-hooks/exhaustive-deps
  const lukkKnapp = () => { if (dirty) setSpør(true); else onLukk() }

  // ── Koplingar til endringstabellen ──
  const kopla = d.endringar
  const veksleEndring = (en) => {
    const finst = kopla.some(k => k.id === en.id)
    endr({ endringar: finst ? kopla.filter(k => k.id !== en.id) : [...kopla, { id: en.id, akt: en.akt, nr: en.nr, namn: en.namn }] })
  }
  const hentKostnader = () => {
    const nye = []
    for (const k of kopla) {
      const en = endringar.find(x => x.id === k.id); if (!en) continue
      if (d.honorar.some(h => h.endring === k.id)) continue
      const v = en.rev || {}
      if (v.timar || v.fastpris || v.timepris) nye.push({ id: nyId(), akt: en.akt, endring: k.id, tekst: [en.nr, en.namn].filter(Boolean).join(' '), timar: v.timar || null, timepris: v.timepris || null, fastpris: v.fastpris || null })
    }
    if (!nye.length) { setMelding('Ingen nye kostnader å hente (endringane er tomme eller alt henta).'); return }
    endr({ honorar: [...d.honorar, ...nye] }); setMelding(`${nye.length} honorarlinje(r) henta frå endringstabellen (reviderte verdiar).`)
  }
  // Før honorarlinjene tilbake til «Revidert»-kolonnene i endringstabellen (timar, fastpris, vekta timepris per endring)
  const fyrTilbake = () => {
    if (!onSettEndringar) return
    const patchar = [], oppsum = [], hoppa = []
    for (const k of kopla) {
      const en = endringar.find(x => x.id === k.id); if (!en) continue
      let linjer = d.honorar.filter(h => h.endring === k.id)
      if (kopla.filter(x => String(x.akt) === String(k.akt)).length === 1) linjer = linjer.concat(d.honorar.filter(h => !h.endring && String(h.akt) === String(k.akt)))
      if (!linjer.length) continue
      if (en.overfort) { hoppa.push(en.nr || en.namn); continue }
      const timar = linjer.reduce((a, h) => a + (h.timar || 0), 0), fast = linjer.reduce((a, h) => a + (h.fastpris || 0), 0)
      const produkt = linjer.reduce((a, h) => a + (h.timar || 0) * (h.timepris || 0), 0)
      const timepris = timar ? Math.round(produkt / timar * 100) / 100 || null : (linjer.find(h => h.timepris)?.timepris || null)
      patchar.push({ akt: en.akt, id: en.id, patch: { rev: { ...(en.rev || {}), timar: timar || null, fastpris: fast || null, timepris } } })
      oppsum.push((en.nr || en.namn || '?') + ': ' + (timar ? String(timar).replace('.', ',') + ' t' : '0 t') + (timepris ? ' à kr ' + kr(timepris) : '') + (fast ? ' + fastpris kr ' + kr(fast) : ''))
    }
    if (!patchar.length) { setMelding(hoppa.length ? 'Ingen endringar å føre tilbake: ' + hoppa.join(', ') + ' er alt lagt til aktiviteten.' : 'Ingen endringar å føre tilbake — kople honorarlinjene til ei endring (kolonnen «Endring»).'); return }
    if (!window.confirm('Føre honorarlinjene tilbake til «Revidert» i endringstabellen? Eksisterande reviderte verdiar for desse endringane vert erstatta:\n\n' + oppsum.join('\n') + (hoppa.length ? '\n\nHoppar over (alt lagt til aktiviteten): ' + hoppa.join(', ') : '') + '\n\nUtgifter har ingen kolonne i endringstabellen og vert ikkje førte tilbake.')) return
    onSettEndringar(patchar); setMelding(patchar.length + ' endring' + (patchar.length > 1 ? 'ar' : '') + ' oppdatert i endringstabellen.')
  }
  const settUtsending = (patch) => endr({ utsending: { ...d.utsending, ...patch } })
  const byttStatus = (ny) => {
    const u = d.utsending; if (ny === u.status) return
    const patch = { status: ny }
    if (ny === 'Sendt til kunde' && !u.sendtDato) patch.sendtDato = idag()
    if ((ny === 'Godkjent' || ny === 'Avvist') && !u.svarDato) patch.svarDato = idag()
    const dato = ny === 'Sendt til kunde' ? (patch.sendtDato || u.sendtDato) : (ny === 'Godkjent' || ny === 'Avvist') ? (patch.svarDato || u.svarDato) : idag()
    patch.logg = [...(u.logg || []), { status: ny, dato, av: brukarNamn || '', tekst: '' }]
    settUtsending(patch)
  }
  const byggPdf = () => lagVarselPdf({ innhald: d, tittel: tittel.trim(), prosjektNamn: prosjekt.name, prosjektNr: prosjekt.projectNumber, aktNamn, brukar: brukarNamn })
  const lastNedVarsel = async () => {
    setOpptatt(true)
    try { const b = await byggPdf(); lastNedPdf(b, varselFilnamn(tittel.trim(), prosjekt.projectNumber)); setMelding('PDF laga.') }
    catch (e) { setMelding('Klarte ikkje lage PDF: ' + e.message) }
    setOpptatt(false)
  }
  const pdfSomVedlegg = async () => {
    setOpptatt(true)
    try {
      const b = await byggPdf(), namn = varselFilnamn(tittel.trim(), prosjekt.projectNumber)
      const sti = `${userId}/${prosjekt.id}/endringsvarsel/${d.mappe}/${Date.now().toString(36)}_${rensNamn(namn)}`
      const { error } = await supabase.storage.from('dtm-resultatdokument').upload(sti, new Blob([b], { type: 'application/pdf' }), { contentType: 'application/pdf' })
      if (error) throw error
      setD(x => ({ ...x, vedlegg: [...x.vedlegg, { id: nyId(), kilde: 'fil', namn, sti, storleik: b.length }] })); merkEndra()
      setMelding('PDF-en er lagt til som vedlegg (lagre varselet for å ta vare på det).')
    } catch (e) { setMelding('Klarte ikkje lagre PDF som vedlegg: ' + (e.message || e)) }
    setOpptatt(false)
  }
  const standardAkt = () => kopla[0]?.akt ?? aktivitetar[0]?.id ?? ''

  // ── Kostnader ──
  const honorarSum = (h) => (h.timar || 0) * (h.timepris || 0) + (h.fastpris || 0)
  const perAkt = useMemo(() => {
    const m = new Map()
    const hent = (a) => { if (!m.has(String(a))) m.set(String(a), { akt: a, honorar: 0, utgift: 0 }); return m.get(String(a)) }
    for (const h of d.honorar) hent(h.akt).honorar += honorarSum(h)
    for (const u of d.utgifter) hent(u.akt).utgift += u.belop || 0
    return [...m.values()]
  }, [d.honorar, d.utgifter])
  const totHon = perAkt.reduce((a, x) => a + x.honorar, 0), totUtg = perAkt.reduce((a, x) => a + x.utgift, 0)
  const settHon = (hid, patch) => endr({ honorar: d.honorar.map(h => (h.id === hid ? { ...h, ...patch } : h)) })
  const settUtg = (uid, patch) => endr({ utgifter: d.utgifter.map(u => (u.id === uid ? { ...u, ...patch } : u)) })
  const aktVal = (verdi, onVal) => (
    <select value={verdi} onChange={e => onVal(Number(e.target.value) || e.target.value)} style={{ ...INNFELT, width: 190 }}>
      {aktivitetar.map(a => <option key={a.id} value={a.id}>{a.kode ? a.kode + ' ' : ''}{a.namn}</option>)}
    </select>
  )

  // ── Vedlegg ──
  const leggTilFiler = async (filer) => {
    const nye = []
    for (const fil of filer) {
      const sti = `${userId}/${prosjekt.id}/endringsvarsel/${d.mappe}/${Date.now().toString(36)}_${rensNamn(fil.name)}`
      const { error } = await supabase.storage.from('dtm-resultatdokument').upload(sti, fil, { contentType: fil.type || undefined })
      if (error) { setMelding('Klarte ikkje laste opp «' + fil.name + '»: ' + error.message); continue }
      nye.push({ id: nyId(), kilde: 'fil', namn: fil.name, sti, storleik: fil.size })
    }
    if (nye.length) setD(x => ({ ...x, vedlegg: [...x.vedlegg, ...nye] })), merkEndra()
  }
  const opneVedlegg = async (v) => {
    if (v.kilde !== 'fil') return
    const { data, error } = await supabase.storage.from('dtm-resultatdokument').createSignedUrl(v.sti, 300)
    if (error) { setMelding('Klarte ikkje opne fila: ' + error.message); return }
    window.open(data.signedUrl, '_blank', 'noreferrer')
  }
  const fjernVedlegg = async (v) => {
    if (v.kilde === 'fil') await supabase.storage.from('dtm-resultatdokument').remove([v.sti])
    endr({ vedlegg: d.vedlegg.filter(x => x.id !== v.id) })
  }
  const opneDtm = async () => {
    setDtmOpen(o => !o)
    if (dtmDok) return
    const { data, error } = await supabase.from('dtm_dokumenter').select('id, nr, tittel, fag').eq('project_id', prosjekt.id).order('nr')
    if (error) { setMelding('Klarte ikkje hente dokumentlista: ' + error.message); return }
    setDtmDok(data || [])
  }
  const leggTilDtm = (doc) => {
    if (d.vedlegg.some(v => v.kilde === 'dtm' && v.dokId === doc.id)) return
    endr({ vedlegg: [...d.vedlegg, { id: nyId(), kilde: 'dtm', dokId: doc.id, namn: [doc.nr, doc.tittel].filter(Boolean).join(' – ') }] })
  }
  const dtmTreff = (dtmDok || []).filter(x => !dtmSok.trim() || (x.nr + ' ' + x.tittel + ' ' + (x.fag || '')).toLowerCase().includes(dtmSok.trim().toLowerCase())).slice(0, 60)

  const tekstFelt = (verdi, onChange, rader = 3, ph) => <textarea value={verdi} onChange={e => onChange(e.target.value)} rows={rader} placeholder={ph} style={{ ...FELT, resize: 'vertical', lineHeight: 1.45 }}/>
  const valde = PUNKT.filter(([k]) => d.val[k])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', ...vinduStil, background: 'var(--bg2)', boxShadow: '0 20px 60px rgba(0,0,0,.4)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', pointerEvents: 'auto' }}>
        {!geo.maks && kantar.map(([m, st]) => <div key={m} onMouseDown={e => startDra(e, m)} style={{ position: 'absolute', zIndex: 5, ...st }}/>)}
        <div onMouseDown={e => { if (e.target.closest('button,select,input')) return; startDra(e, 'flytt') }} onDoubleClick={e => { if (!e.target.closest('button,select,input')) veksleMaks() }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px 11px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0, cursor: geo.maks ? 'default' : 'move', userSelect: 'none', background: 'var(--bg3)', borderRadius: geo.maks ? 0 : 'var(--r2) var(--r2) 0 0' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Endringsvarsel — {prosjekt.projectNumber ? prosjekt.projectNumber + ' ' : ''}{prosjekt.name}
            <span style={{ fontSize: 11.5, fontWeight: 700, marginLeft: 10, padding: '2px 8px', borderRadius: 10, background: id ? (ENDR_STATUS_FARGE[d.utsending?.status] || 'var(--bg4)') : 'var(--bg4)', color: id ? '#fff' : 'var(--text2)' }}>{id ? (d.utsending?.status || 'Utkast') + (status === 'ferdig' && (d.utsending?.status || 'Utkast') === 'Utkast' ? ' · ferdig' : '') : 'Nytt'}{dirty ? ' · ulagra' : ''}</span>
          </div>
          <select value={id || ''} onChange={e => opne(e.target.value ? Number(e.target.value) : null)} style={{ ...INNFELT, width: 230 }} title="Opne eit lagra varsel">
            <option value="">＋ Nytt varsel</option>
            {liste.map(v => <option key={v.id} value={v.id}>{v.tittel || '(utan tittel)'} · {v.utsending || (v.status === 'ferdig' ? 'ferdig' : 'utkast')}</option>)}
          </select>
          <button onClick={veksleMaks} title={geo.maks ? 'Gjenopprett storleik' : 'Maksimer'} style={{ background: 'none', border: 'none', fontSize: 17, cursor: 'pointer', color: 'var(--text3)', lineHeight: 1, padding: '2px 6px' }}>{geo.maks ? '❐' : '☐'}</button>
          <button onClick={lukkKnapp} title="Lukk" style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text3)', lineHeight: 1, padding: '0 6px' }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 22px 22px', pointerEvents: dra ? 'none' : 'auto' }}>
          <div style={ETT}>Tittel på endringa</div>
          <input value={tittel} onChange={e => { setTittel(e.target.value); merkEndra() }} placeholder="Tittel" style={FELT}/>

          <div style={ETT}>Endringsnummer (frå endringstabellen)</div>
          {endringar.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>Ingen endringar er førte opp i endringstabellen enno. Legg dei til under «Endringar» nederst i Prosjektplan.</div> : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {endringar.map(en => {
                const på = kopla.some(k => k.id === en.id)
                return <button key={en.akt + ':' + en.id} onClick={() => veksleEndring(en)} title={aktNamn(en.akt)}
                  style={{ padding: '4px 10px', borderRadius: 14, border: '1.5px solid ' + (på ? 'var(--brand)' : 'var(--border)'), background: på ? 'var(--brand)' : 'var(--bg2)', color: på ? '#fff' : 'var(--text2)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  {på ? '✓ ' : ''}{[en.nr, en.namn].filter(Boolean).join(' – ') || '(utan namn)'}</button>
              })}
            </div>
          )}

          <div style={ETT}>Gjeld</div>
          {PUNKT.map(([k, t]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700, marginBottom: 4, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!d.val[k]} onChange={e => endr({ val: { ...d.val, [k]: e.target.checked } })}/> {t}
            </label>
          ))}

          {valde.map(([k, t]) => (
            <div key={k} style={{ marginTop: 14, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--bg)' }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 6 }}>{t}</div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', marginBottom: 3 }}>Beskriving</div>
              {tekstFelt(d.punkt[k].besk, v => endr({ punkt: { ...d.punkt, [k]: { ...d.punkt[k], besk: v } } }), 4, 'Beskriv endringa …')}
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', margin: '8px 0 3px' }}>Konsekvensar for framdrift</div>
              {tekstFelt(d.punkt[k].framdrift, v => endr({ punkt: { ...d.punkt, [k]: { ...d.punkt[k], framdrift: v } } }), 3, 'Kva betyr endringa for framdrifta?')}
            </div>
          ))}

          {valde.length > 0 && (<>
            <div style={{ ...ETT, display: 'flex', alignItems: 'center', gap: 10 }}>
              Honorar
              <button onClick={hentKostnader} disabled={!kopla.length} style={{ ...knapp(false), padding: '3px 10px', fontSize: 11.5, textTransform: 'none', letterSpacing: 0, opacity: kopla.length ? 1 : .5 }} title="Hentar reviderte verdiar frå valde endringar i endringstabellen">↓ Hent frå valde endringar</button>
              <button onClick={fyrTilbake} disabled={!kopla.length || !d.honorar.length} style={{ ...knapp(false), padding: '3px 10px', fontSize: 11.5, textTransform: 'none', letterSpacing: 0, opacity: kopla.length && d.honorar.length ? 1 : .5 }} title="Skriv honorarlinjene tilbake til Revidert-kolonnene i endringstabellen">↑ Før tilbake til endringstabellen</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', minWidth: 1040 }}>
                <thead><tr>
                  <th style={{ ...TH, textAlign: 'left' }}>Aktivitet</th><th style={{ ...TH, textAlign: 'left' }} title="Kva endring i endringstabellen linja høyrer til (brukt ved tilbakeføring)">Endring</th><th style={{ ...TH, textAlign: 'left' }}>Beskriving</th>
                  <th style={TH}>Timebudsjett (t)</th><th style={TH}>Timepris (kr/t)</th><th style={TH}>Timer × pris (kr)</th><th style={TH}>Endring fastpris (kr)</th><th style={TH}>Sum (kr)</th><th style={{ ...TH, width: 24 }}/>
                </tr></thead>
                <tbody>
                  {d.honorar.map(h => (
                    <tr key={h.id}>
                      <td style={{ ...TD, textAlign: 'left' }}>{aktVal(h.akt, v => settHon(h.id, { akt: v }))}</td>
                      <td style={{ ...TD, textAlign: 'left' }}>
                        <select value={h.endring || ''} onChange={e => settHon(h.id, { endring: e.target.value || null })} style={{ ...INNFELT, width: 120 }}>
                          <option value="">(ingen)</option>
                          {kopla.map(k => <option key={k.id} value={k.id}>{k.nr || k.namn || '?'}</option>)}
                        </select>
                      </td>
                      <td style={{ ...TD, textAlign: 'left' }}><input value={h.tekst || ''} onChange={e => settHon(h.id, { tekst: e.target.value })} style={{ ...INNFELT, width: 230, fontFamily: 'var(--font)' }}/></td>
                      <td style={TD}><TalFelt verdi={h.timar || ''} onLagre={v => settHon(h.id, { timar: tilTal(v) })}/></td>
                      <td style={TD}><TalFelt verdi={h.timepris || ''} onLagre={v => settHon(h.id, { timepris: tilTal(v) })}/></td>
                      <td style={{ ...TD, background: 'var(--bg3)' }}>{(h.timar || 0) * (h.timepris || 0) ? kr((h.timar || 0) * (h.timepris || 0)) : ''}</td>
                      <td style={TD}><TalFelt verdi={h.fastpris || ''} onLagre={v => settHon(h.id, { fastpris: tilTal(v) })}/></td>
                      <td style={{ ...TD, background: 'var(--bg3)', fontWeight: 700 }}>{honorarSum(h) ? kr(honorarSum(h)) : ''}</td>
                      <td style={{ ...TD, padding: '1px 4px' }}><button onClick={() => endr({ honorar: d.honorar.filter(x => x.id !== h.id) })} title="Fjern linja" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 16 }}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={() => endr({ honorar: [...d.honorar, { id: nyId(), akt: standardAkt(), tekst: '', timar: null, timepris: null, fastpris: null }] })} disabled={!aktivitetar.length} style={{ ...knapp(false), marginTop: 6, padding: '4px 12px', fontSize: 12 }}>＋ Honorarlinje</button>

            <div style={ETT}>Utgifter</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', minWidth: 640 }}>
                <thead><tr><th style={{ ...TH, textAlign: 'left' }}>Aktivitet</th><th style={{ ...TH, textAlign: 'left' }}>Beskriving</th><th style={TH}>Beløp (kr)</th><th style={{ ...TH, width: 24 }}/></tr></thead>
                <tbody>
                  {d.utgifter.map(u => (
                    <tr key={u.id}>
                      <td style={{ ...TD, textAlign: 'left' }}>{aktVal(u.akt, v => settUtg(u.id, { akt: v }))}</td>
                      <td style={{ ...TD, textAlign: 'left' }}><input value={u.tekst || ''} onChange={e => settUtg(u.id, { tekst: e.target.value })} style={{ ...INNFELT, width: 300, fontFamily: 'var(--font)' }}/></td>
                      <td style={TD}><TalFelt verdi={u.belop || ''} onLagre={v => settUtg(u.id, { belop: tilTal(v) })}/></td>
                      <td style={{ ...TD, padding: '1px 4px' }}><button onClick={() => endr({ utgifter: d.utgifter.filter(x => x.id !== u.id) })} title="Fjern linja" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 16 }}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={() => endr({ utgifter: [...d.utgifter, { id: nyId(), akt: standardAkt(), tekst: '', belop: null }] })} disabled={!aktivitetar.length} style={{ ...knapp(false), marginTop: 6, padding: '4px 12px', fontSize: 12 }}>＋ Utgiftslinje</button>

            <div style={ETT}>Kostnader som følgjer av endringa</div>
            {perAkt.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>Legg inn honorar og utgifter ovanfor, så vert kostnadene summerte her.</div> : (
              <table style={{ borderCollapse: 'collapse', minWidth: 640 }}>
                <thead><tr><th style={{ ...TH, textAlign: 'left' }}>Aktivitet</th><th style={TH}>Honorar (kr)</th><th style={TH}>Utgifter (kr)</th><th style={TH}>Sum (kr)</th></tr></thead>
                <tbody>
                  {perAkt.map(x => (
                    <tr key={x.akt}><td style={{ ...TD, textAlign: 'left', fontFamily: 'var(--font)' }}>{aktNamn(x.akt)}</td><td style={TD}>{kr(x.honorar)}</td><td style={TD}>{kr(x.utgift)}</td><td style={{ ...TD, fontWeight: 700 }}>{kr(x.honorar + x.utgift)}</td></tr>
                  ))}
                  <tr style={{ background: 'var(--bg3)', fontWeight: 800 }}>
                    <td style={{ ...TD, textAlign: 'left', fontFamily: 'var(--font)', borderTop: '2px solid var(--text)' }}>Totalt</td>
                    <td style={{ ...TD, borderTop: '2px solid var(--text)' }}>{kr(totHon)}</td><td style={{ ...TD, borderTop: '2px solid var(--text)' }}>{kr(totUtg)}</td><td style={{ ...TD, borderTop: '2px solid var(--text)' }}>{kr(totHon + totUtg)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </>)}

          <div style={ETT}>Vedlegg</div>
          <div onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); leggTilFiler([...e.dataTransfer.files]) }}
            style={{ border: '2px dashed ' + (dragOver ? 'var(--brand)' : 'var(--border)'), borderRadius: 'var(--r)', padding: '14px', textAlign: 'center', fontSize: 13, color: 'var(--text3)', background: dragOver ? 'var(--bg3)' : 'transparent' }}>
            Dra dokument hit, eller{' '}
            <button onClick={() => filRef.current?.click()} style={{ ...knapp(false), padding: '3px 10px', fontSize: 12 }}>vel fil …</button>{' '}
            <button onClick={opneDtm} style={{ ...knapp(false), padding: '3px 10px', fontSize: 12 }}>velg frå Dokument-modulen …</button>
            <input ref={filRef} type="file" multiple hidden onChange={e => { leggTilFiler([...e.target.files]); e.target.value = '' }}/>
          </div>
          {dtmOpen && (
            <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 8, background: 'var(--bg)' }}>
              <input value={dtmSok} onChange={e => setDtmSok(e.target.value)} placeholder="Søk i dokument (nummer, tittel, fag) …" style={FELT}/>
              <div style={{ maxHeight: 180, overflowY: 'auto', marginTop: 6 }}>
                {dtmDok == null ? <div style={{ fontSize: 12.5, color: 'var(--text3)', padding: 6 }}>Hentar …</div>
                  : dtmTreff.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--text3)', padding: 6 }}>Ingen dokument funne.</div>
                  : dtmTreff.map(x => {
                    const lagt = d.vedlegg.some(v => v.kilde === 'dtm' && v.dokId === x.id)
                    return <div key={x.id} onClick={() => !lagt && leggTilDtm(x)} style={{ padding: '4px 8px', fontSize: 12.5, cursor: lagt ? 'default' : 'pointer', opacity: lagt ? .5 : 1, borderRadius: 4 }}
                      onMouseEnter={e => { if (!lagt) e.currentTarget.style.background = 'var(--bg3)' }} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <b>{x.nr}</b> {x.tittel} {x.fag && <span style={{ color: 'var(--text3)' }}>· {x.fag}</span>} {lagt && '✓'}</div>
                  })}
              </div>
            </div>
          )}
          {d.vedlegg.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {d.vedlegg.map(v => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--bg)' }}>
                  <span>{v.kilde === 'fil' ? '📎' : '📁'}</span>
                  <span onClick={() => opneVedlegg(v)} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: v.kilde === 'fil' ? 'pointer' : 'default', color: v.kilde === 'fil' ? 'var(--brand)' : 'var(--text)' }}>{v.namn}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{v.kilde === 'fil' ? Math.max(1, Math.round((v.storleik || 0) / 1024)) + ' kB' : 'Dokument-modulen'}</span>
                  <button onClick={() => fjernVedlegg(v)} title="Fjern vedlegget" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 16 }}>×</button>
                </div>
              ))}
            </div>
          )}

          <div style={ETT}>Utarbeidd av</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input value={d.utarbeidd} onChange={e => endr({ utarbeidd: e.target.value })} placeholder="Namn" style={{ ...FELT, width: 280 }}/>
            <input type="date" value={d.dato} onChange={e => endr({ dato: e.target.value })} style={{ ...FELT, width: 170 }}/>
          </div>

          <div style={ETT}>Utsending til kunde</div>
          <div style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--bg)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>Status</span>
              <select value={d.utsending.status} onChange={e => byttStatus(e.target.value)} style={{ ...FELT, width: 190, fontWeight: 800, color: ENDR_STATUS_FARGE[d.utsending.status] }}>
                {ENDR_STATUSAR.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>Statusen vert førd til endringane varselet er kopla til (kolonnen «Status» i endringstabellen) når du lagrar.</span>
            </div>
            {d.utsending.status !== 'Utkast' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10, marginTop: 10 }}>
                <div><div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', marginBottom: 3 }}>Sendt dato</div><input type="date" value={d.utsending.sendtDato || ''} onChange={e => settUtsending({ sendtDato: e.target.value })} style={FELT}/></div>
                <div><div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', marginBottom: 3 }}>Sendt til (kontaktperson)</div><input value={d.utsending.sendtTil || ''} onChange={e => settUtsending({ sendtTil: e.target.value })} placeholder="Namn / e-post" style={FELT}/></div>
                <div><div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', marginBottom: 3 }}>Sendt via</div>
                  <select value={d.utsending.sendtMetode || 'E-post'} onChange={e => settUtsending({ sendtMetode: e.target.value })} style={FELT}>{['E-post', 'Post', 'Prosjektweb', 'Møte', 'Anna'].map(t => <option key={t}>{t}</option>)}</select></div>
                {(d.utsending.status === 'Godkjent' || d.utsending.status === 'Avvist') && (<>
                  <div><div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', marginBottom: 3 }}>{d.utsending.status === 'Godkjent' ? 'Godkjent dato' : 'Avvist dato'}</div><input type="date" value={d.utsending.svarDato || ''} onChange={e => settUtsending({ svarDato: e.target.value })} style={FELT}/></div>
                  <div><div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', marginBottom: 3 }}>Svar frå</div><input value={d.utsending.svarFra || ''} onChange={e => settUtsending({ svarFra: e.target.value })} placeholder="Namn hos kunden" style={FELT}/></div>
                </>)}
              </div>
            )}
            {d.utsending.status !== 'Utkast' && (<>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', margin: '10px 0 3px' }}>Merknad</div>
              {tekstFelt(d.utsending.merknad || '', v => settUtsending({ merknad: v }), 2, 'Til dømes kva kunden svara …')}
            </>)}
            {(d.utsending.logg || []).length > 0 && (
              <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text2)' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', marginBottom: 3 }}>Logg</div>
                {d.utsending.logg.map((l, i) => <div key={i}><span style={{ fontFamily: 'var(--mono)' }}>{(l.dato || '').split('-').reverse().join('.')}</span> · <b style={{ color: ENDR_STATUS_FARGE[l.status] }}>{l.status}</b>{l.av ? ' · ' + l.av : ''}</div>)}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap' }}>
          {melding && <span style={{ fontSize: 12.5, color: /^Klarte|Skriv|Ingen/.test(melding) ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>{melding}</span>}
          <div style={{ flex: 1 }}/>
          <button onClick={lastNedVarsel} disabled={opptatt} style={knapp(false)} title="Lag ein PDF av varselet slik det står no">⬇ PDF</button>
          <button onClick={pdfSomVedlegg} disabled={opptatt} style={knapp(false)} title="Lag PDF og legg han til som vedlegg i varselet (t.d. versjonen som vart sendt)">PDF → vedlegg</button>
          {id && <button onClick={slettVarsel} style={{ ...knapp(false), color: 'var(--danger)', borderColor: 'var(--danger)' }}>Slett</button>}
          <button onClick={() => lagre('utkast')} disabled={opptatt} style={knapp(false)}>Lagre utkast</button>
          <button onClick={() => lagre('ferdig')} disabled={opptatt} style={knapp(true)}>Lagre som ferdig</button>
        </div>

        {spør && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'inherit' }}>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '20px 24px', maxWidth: 420, boxShadow: '0 10px 40px rgba(0,0,0,.4)' }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>Vil du lagre utkastet?</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>Endringsvarselet har ulagra endringar.</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button onClick={() => setSpør(false)} style={knapp(false)}>Avbryt</button>
                <button onClick={onLukk} style={{ ...knapp(false), color: 'var(--danger)', borderColor: 'var(--danger)' }}>Lukk utan å lagre</button>
                <button onClick={async () => { setSpør(false); if (await lagre('utkast')) onLukk() }} style={knapp(true)}>Lagre utkast</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
