import { useState, useEffect, useMemo, useRef, useCallback } from 'react'

// ═══════════════════════════════════════════════════════════════════
//  DataTabell — standard datatabell for heile LiedLab-appen.
//
//  Generisk tabellmotor: sortering, filter med teljing per verdi,
//  nøkkeltal for tal-/datokolonnar, kolonnebreidd (drag), kolonneflytting
//  (drag), vis/skjul kolonnar, tettleik, valfri fargekode, og valfrie
//  «eigne kolonnar» (lagra av kallar, t.d. i databasen — sjå onNyKolonne/
//  onSlettKolonne/onSetExtra).
//
//  Opphavleg bygd for saksmodulen (SakerTabell.jsx), som no berre set opp
//  kolonnedefinisjonar og celle-visning og let denne komponenten gjere
//  sjølve tabelljobben. Same mønster skal brukast for alle nye tabellar
//  i appen (t.d. teikningsregisteret i Kvalitetsmodulen).
//
//  Props:
//    rader           — liste med objekt som skal visast (éin per rad)
//    kolonnar        — [{ key, label, w, art:'tekst'|'tal'|'dato'|'val',
//                         mono, utanFilter, standardSkjult, redigerbar, val }]
//    hentVerdi(rad, key)       → tekst/verdi for visning, filter og søk
//    hentRedigerVerdi(rad,key) → valfri; råverdi å redigere (utan «—»-fallback
//                       o.l.). Fell tilbake til hentVerdi når ikkje sett.
//    hentSorteringsverdi(rad,key) → valfri; fell tilbake til hentVerdi
//    lagCelle(rad, kol, { farge }) → valfri; fell tilbake til hentVerdi
//    rangering(key)  → valfri; returnerer ei ordna liste med tekstverdiar
//                       for kolonnar som ikkje skal filter-sorterast A–Å
//                       (t.d. status i logisk rekkjefølgje)
//    radId(rad)      → valfri, default rad.id
//    radStil(rad)    → valfri, ekstra style-objekt per rad (t.d. opacity)
//    eigne           — [{ key, label, w, art }] eigendefinerte kolonnar
//                       (redigerast med eitt klikk, sjå onSetExtra)
//    onOpenRad(rad)  — dobbeltklikk på ei rad (utanfor ei redigerbar celle)
//    onOpneFil(rad, key) — enkeltklikk på ei celle merkt «opnaFil:true»
//                       (t.d. for å opne ei fil i systemet sitt standard-
//                       program). Er kolonnen òg «redigerbar», ventar
//                       klikket kort (for å skilje frå dobbeltklikk som
//                       startar redigering) før det utløyser onOpneFil.
//    onSetExtra(id, key, verdi) — lagre verdi i ein eigen kolonne
//    onSetVerdi(id, key, verdi) — lagre verdi i ein vanleg kolonne merkt
//                       «redigerbar:true». Redigering skjer med dobbeltklikk
//                       på cella, som i eit reknearkprogram — Tab/Shift+Tab
//                       flytter til neste/førre redigerbare kolonne i rada,
//                       Enter lagrar og lukkar, Escape avbryt. Kolonnar med
//                       ei fast liste med verdiar (kol.val = [...]) vert vist
//                       som nedtrekksmeny under redigering.
//    onNyKolonne(label, art) → Promise<key> → lagar ein ny eigen kolonne.
//                       Er denne ikkje sett, er heile «Ny kolonne»-flyten skjult.
//    onSlettKolonne(key)
//    merking         — valfri; { valde:Set<id>, onEndre(nyttSett) } for fleirval
//                       av rader med shift-/ctrl-klikk (t.d. massesletting).
//    innhaldstilpassaBreidd — valfri; standardkolonnebreidd tek då omsyn
//                       til dei FAKTISKE verdiane i kolonnen (målt via
//                       hentVerdi), ikkje berre overskrifta.
//    prefsKey        — unik nøkkel for personleg visingsoppsett i localStorage
//    itemNamn        — namn brukt i teljetekst/tomt-resultat (t.d. «saker»)
//    rutenettRedigering — valfri (default av); slår PÅ eit «Redigering»-
//                       av/på-val i verktøylinja + eit Angre-tastar, i
//                       SharePoint sin «rutenettvisning»-stil. Med dette
//                       slege på kan ALLE celler (utanom «opnaFil»- og
//                       «beregna»-merkte kolonnar) redigerast med dobbelt-
//                       klikk, ikkje berre kolonnar merkt «redigerbar».
//                       Dobbeltklikk på ein slik celle når modus er AV
//                       slår sjølv på modus fyrst (snarveg). Har òg eit
//                       Excel-liknande dra-handtak nede til høgre i den
//                       sist redigerte/valde cella, som fyller verdien inn
//                       i alle radene ein dreg over. IKKJE sett denne på
//                       for tabellar der kolonnane manglar tydeleg peiking
//                       på kva som er lagra flatt vs. utrekna — sjå
//                       «beregna» under.
//    kol.beregna     — valfri kolonneflagg; kolonnen sin verdi er UTREKNA
//                       (ikkje eit flatt felt på rada) og skal ALDRI kunne
//                       redigerast generisk via rutenettRedigering, sjølv
//                       om modus er på (t.d. DTM sine Kategori/Status/
//                       Filtype/Rev./Dato/Lasta opp/Filsti/Utsendingar).
// ═══════════════════════════════════════════════════════════════════

function les(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback }
  catch { return fallback }
}
function skriv(key, verdi) {
  try { localStorage.setItem(key, JSON.stringify(verdi)) } catch { /* privat modus */ }
}
function slett(key) {
  try { localStorage.removeItem(key) } catch { /* privat modus */ }
}

const samanlikn = new Intl.Collator('no', { numeric:true, sensitivity:'base' })

// ── Automatisk standardbreidd ──────────────────────────────────────
// Kvar kolonne skal FRÅ START vere brei nok til å vise heile overskrifta
// (inkludert plassen sorteringspila og filter-/meny-knappen tek), pluss
// litt margin — ikkje ei fast, manuelt vald pikselbreidd som må stemme
// med akkurat den norske teksten. Målt med ein gøymd <canvas> i same
// skrift/vekt som .dt-th faktisk brukar, så det stemmer uansett ordlengd.
let måleCanvas = null
function tekstbreidd(tekst, font) {
  if (typeof document === 'undefined') return tekst.length * 7
  if (!måleCanvas) måleCanvas = document.createElement('canvas')
  const ctx = måleCanvas.getContext('2d')
  ctx.font = font
  return ctx.measureText(tekst).width
}
function standardKolonnebreidd(label, font) {
  const PADDING    = 20 // .dt-th: padding: 0 10px, venstre + høgre
  const GAP_PIL     = 5 // gap mellom namn og sorteringspil
  const PIL         = 9 // ▲/▼-teiknet
  const GAP_CARET   = 5 // gap mellom pil og filter-/meny-knapp
  const CARET       = 20 // .dt-caret: width 20px
  const MARGIN      = 12 // litt ekstra margin, som ønskt
  return Math.ceil(tekstbreidd(label, font)) + PADDING + GAP_PIL + PIL + GAP_CARET + CARET + MARGIN
}
// Maks breidd ei innhaldstilpassa kolonne kan få automatisk (sjå
// innhaldstilpassaBreidd-prop) — ein einskild uvanleg lang verdi skal
// ikkje kunne blåse opp heile tabellen; brukar kan alltid dra breiare sjølv.
const MAKS_INNHALDS_BREIDD = 420

export default function DataTabell({
  rader: dataRader, kolonnar,
  hentVerdi, hentRedigerVerdi, hentSorteringsverdi, lagCelle, rangering,
  radId = (r) => r.id, radStil,
  eigne = [],
  onOpenRad, onOpneFil, onRowClick, onSetExtra, onSetVerdi, onNyKolonne, onSlettKolonne,
  radMeny, // valfri; sjå kommentar ved render av radmeny-kolonnen under
  merking, // valfri; { valde:Set<id>, onEndre(nyttSett) } — shift/ctrl-klikk for å velje fleire rader
  innhaldstilpassaBreidd, // valfri; standardbreidd tek då omsyn til FAKTISKE verdiar i kolonnen, ikkje berre overskrifta
  prefsKey, itemNamn = 'rader',
  defaultSortering,
  rutenettRedigering = false, // valfri; sjå kommentar øvst i fila
}) {
  const font = useMemo(() => {
    if (typeof window === 'undefined') return "700 12px sans-serif"
    const fam = getComputedStyle(document.documentElement).getPropertyValue('--font').trim()
    return `700 12px ${fam || 'sans-serif'}`
  }, [])
  // Innhaldstilpassa breidd (valfri): DTM-matrisa vil at kolonnane frå
  // start skal vere breie nok til å vise heile SKANNA INNHALDET (t.d. eit
  // langt firmanamn), ikkje berre overskrifta slik standardmønsteret elles
  // gjer. Målt med same skjulte <canvas>, men i cella sin eigen skrift
  // (normal vekt, 13px, sjå .dt-tabell td i CSS-en under).
  const innhaldsfont = useMemo(() => {
    if (typeof window === 'undefined') return '400 13px sans-serif'
    const fam = getComputedStyle(document.documentElement).getPropertyValue('--font').trim()
    return `400 13px ${fam || 'sans-serif'}`
  }, [])
  const standardBreidder = useMemo(() => Object.fromEntries(kolonnar.map(c => {
    const headerBreidd = standardKolonnebreidd(c.label, font)
    if (!innhaldstilpassaBreidd || !hentVerdi) return [c.key, headerBreidd]
    let maksInnhald = 0
    for (const rad of dataRader || []) {
      const v = hentVerdi(rad, c.key)
      if (v === undefined || v === null || v === '') continue
      const w = tekstbreidd(String(v), innhaldsfont)
      if (w > maksInnhald) maksInnhald = w
    }
    const innhaldsBreidd = Math.ceil(maksInnhald) + 24
    // Kolonnedefinisjonen kan overstyre maksgrensa (t.d. DTM sin Filsti-
    // kolonne, der brukar uttrykkeleg vil sjå HEILE stien, ikkje avkutta).
    const grense = c.maksInnhaldsBreidd ?? MAKS_INNHALDS_BREIDD
    return [c.key, Math.min(grense, Math.max(headerBreidd, innhaldsBreidd))]
  })), [kolonnar, font, innhaldsfont, innhaldstilpassaBreidd, dataRader, hentVerdi])
  const standardSkjulte  = useMemo(() => kolonnar.filter(c => c.standardSkjult).map(c => c.key), [kolonnar])
  const standardRekkje   = useMemo(() => kolonnar.map(c => c.key), [kolonnar])
  const standardPrefs = useMemo(() => ({
    farge: false,
    tettleik: 'normal',
    rekkje: standardRekkje,
    skjulte: standardSkjulte,
    breidder: standardBreidder,
    sortering: defaultSortering || { key: standardRekkje[0], dir: 'desc' },
    filter: {},
  }), [standardRekkje, standardSkjulte, standardBreidder, defaultSortering])

  const [prefs, setPrefsRaw] = useState(() => {
    const lagra = les(prefsKey, {})
    return { ...standardPrefs, ...lagra, breidder: { ...standardPrefs.breidder, ...(lagra.breidder || {}) } }
  })
  const [meny, setMeny]           = useState(null)
  const [redigerer, setRedigerer] = useState(null)
  const klikkTimerRef = useRef(null) // skil enkelt- frå dobbeltklikk på «opnaFil»-celler
  const ankerRef = useRef(null)
  const dragRef  = useRef(null)
  const sisteMerktRef = useRef(null) // sist klikka rad-id, for shift-områdeval

  // ── Rutenettvisning (grid-redigering), sjå prop-kommentaren øvst ────
  const [redigeringsmodus, setRedigeringsmodus] = useState(false)
  const [aktivCelle, setAktivCelle] = useState(null) // { id, key } — syner Excel-dra-handtaket
  const [fyllOmråde, setFyllOmråde] = useState(null) // { key, frå, til } radindeksar, under aktiv drahandling
  const [angreStabel, setAngreStabel] = useState([]) // stack av { endringar:[{type,id,key,gammal}] }

  useEffect(() => { if (!redigeringsmodus) setAktivCelle(null) }, [redigeringsmodus])

  const erModusRedigerbar = useCallback((kol) =>
    rutenettRedigering && !kol.opnaFil && !kol.eigen && !kol.beregna,
  [rutenettRedigering])

  const setPrefs = useCallback((oppdater) => {
    setPrefsRaw(p => {
      const neste = typeof oppdater === 'function' ? oppdater(p) : { ...p, ...oppdater }
      skriv(prefsKey, neste)
      return neste
    })
  }, [prefsKey])

  // ── Kolonner ────────────────────────────────────────────────────
  const alleKolonner = useMemo(() => ([
    ...kolonnar,
    ...eigne.map(e => ({ key:e.key, label:e.label, w:e.w || 140, art:e.art, val:e.val, eigen:true })),
  ]), [kolonnar, eigne])
  const kolMap = useMemo(() => Object.fromEntries(alleKolonner.map(c => [c.key, c])), [alleKolonner])

  const rekkje = useMemo(() => {
    const kjende = prefs.rekkje.filter(k => kolMap[k])
    alleKolonner.forEach(c => { if (!kjende.includes(c.key)) kjende.push(c.key) })
    return kjende
  }, [prefs.rekkje, kolMap, alleKolonner])
  const synlege = useMemo(() => rekkje.filter(k => !prefs.skjulte.includes(k)), [rekkje, prefs.skjulte])
  const breidd  = (k) => prefs.breidder[k] ?? kolMap[k]?.w ?? 130
  // Minstebreidd — same for alle kolonnar (kan overstyrast med eit eige
  // `minW` på kolonnedefinisjonen for særtilfelle). Overskrifta vert klipt
  // med «…» (dt-namn har overflow:hidden) om kolonnen vert smalare enn ho.
  const MIN_KOL_BREIDD = 20
  const minBreidd = (k) => kolMap[k]?.minW ?? MIN_KOL_BREIDD
  const RAD_MENY_BREIDD = 34
  const totalBreidd = useMemo(() => synlege.reduce((sum, k) => sum + breidd(k), 0) + (radMeny ? RAD_MENY_BREIDD : 0),
    [synlege, prefs.breidder, kolMap, radMeny])

  // ── Verdiar ─────────────────────────────────────────────────────
  const tekst = useCallback((rad, key) => {
    const v = hentVerdi(rad, key)
    return v === undefined || v === null ? '' : String(v)
  }, [hentVerdi])

  const sorteringsverdi = useCallback((rad, key) => {
    if (hentSorteringsverdi) {
      const v = hentSorteringsverdi(rad, key)
      if (v !== undefined) return v
    }
    const kol = kolMap[key]
    const t = tekst(rad, key)
    if (kol?.art === 'tal')  { const n = parseFloat(t.replace(',', '.')); return isNaN(n) ? -Infinity : n }
    if (kol?.art === 'dato') { const d = new Date(t).getTime(); return isNaN(d) ? Infinity : d }
    return t
  }, [hentSorteringsverdi, kolMap, tekst])

  // ── Filter + sortering ──────────────────────────────────────────
  const filtrerte = useMemo(() => {
    const aktive = Object.entries(prefs.filter).filter(([, v]) => v && v.length)
    return (dataRader || []).filter(r => aktive.every(([k, valde]) => valde.includes(tekst(r, k))))
  }, [dataRader, prefs.filter, tekst])

  const rader = useMemo(() => {
    const { key, dir } = prefs.sortering || {}
    let sortert = filtrerte
    if (key && kolMap[key]) {
      const teikn = dir === 'desc' ? -1 : 1
      sortert = [...filtrerte].sort((a, b) => {
        const x = sorteringsverdi(a, key), y = sorteringsverdi(b, key)
        if (typeof x === 'number' && typeof y === 'number') return (x - y) * teikn
        return samanlikn.compare(String(x), String(y)) * teikn
      })
    }
    // «Fest til toppen» (radMeny.erFesta) vinn alltid over vanleg sortering —
    // festa rader vert flytta fremst, elles urørt rekkjefølgje.
    if (!radMeny?.erFesta) return sortert
    const festa = sortert.filter(r => radMeny.erFesta(r))
    const resten = sortert.filter(r => !radMeny.erFesta(r))
    return [...festa, ...resten]
  }, [filtrerte, prefs.sortering, kolMap, sorteringsverdi, radMeny])

  // ── Rutenettvisning: lagring med Angre-historikk + Excel-dra-og-fyll ──
  const settVerdiMedAngre = useCallback((id, key, gammalVerdi, nyVerdi) => {
    if (nyVerdi !== gammalVerdi) setAngreStabel(s => [...s, { endringar:[{ type:'normal', id, key, gammal:gammalVerdi }] }])
    onSetVerdi?.(id, key, nyVerdi)
    setAktivCelle({ id, key })
  }, [onSetVerdi])

  const settExtraMedAngre = useCallback((id, key, gammalVerdi, nyVerdi) => {
    if (nyVerdi !== gammalVerdi) setAngreStabel(s => [...s, { endringar:[{ type:'eigen', id, key, gammal:gammalVerdi }] }])
    onSetExtra?.(id, key, nyVerdi)
    setAktivCelle({ id, key })
  }, [onSetExtra])

  const angre = useCallback(() => {
    setAngreStabel(s => {
      if (!s.length) return s
      const siste = s[s.length - 1]
      siste.endringar.forEach(({ type, id, key, gammal }) => {
        if (type === 'eigen') onSetExtra?.(id, key, gammal)
        else onSetVerdi?.(id, key, gammal)
      })
      return s.slice(0, -1)
    })
  }, [onSetExtra, onSetVerdi])

  // Excel-liknande dra-og-fyll frå handtaket nede til høgre i den aktive
  // cella. Finn måleraden via document.elementFromPoint (robust mot
  // sortering/filter/tettleik, treng ikkje faste pikselhøgder), fyller
  // startverdien inn i ALLE radene mellom start og slepp, og lagrar det
  // heile som ÉI Angre-gruppe.
  const startFyll = useCallback((id, key, verdi, e) => {
    e.preventDefault(); e.stopPropagation()
    const kol = kolMap[key]
    const startIndeks = rader.findIndex(r => String(radId(r)) === String(id))
    if (startIndeks === -1) return
    let sluttIndeks = startIndeks
    const flytt = (ev) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY)
      const tr = el?.closest?.('tr[data-radid]')
      if (!tr) return
      const idx = rader.findIndex(r => String(radId(r)) === tr.getAttribute('data-radid'))
      if (idx !== -1) {
        sluttIndeks = idx
        setFyllOmråde({ key, frå:Math.min(startIndeks, idx), til:Math.max(startIndeks, idx) })
      }
    }
    const slepp = () => {
      window.removeEventListener('mousemove', flytt)
      window.removeEventListener('mouseup', slepp)
      document.body.style.cursor = ''
      setFyllOmråde(null)
      const frå = Math.min(startIndeks, sluttIndeks), til = Math.max(startIndeks, sluttIndeks)
      if (frå === til) return
      const endringar = []
      for (let i = frå; i <= til; i++) {
        const rad = rader[i]
        const målId = radId(rad)
        if (String(målId) === String(id)) continue
        const gammalVerdi = kol.eigen ? (rad.ekstra?.[key] ?? '') : (hentRedigerVerdi ? hentRedigerVerdi(rad, key) : tekst(rad, key))
        if (gammalVerdi === verdi) continue
        endringar.push({ type: kol.eigen ? 'eigen' : 'normal', id:målId, key, gammal:gammalVerdi })
        if (kol.eigen) onSetExtra?.(målId, key, verdi); else onSetVerdi?.(målId, key, verdi)
      }
      if (endringar.length) setAngreStabel(s => [...s, { endringar }])
    }
    document.body.style.cursor = 'crosshair'
    window.addEventListener('mousemove', flytt)
    window.addEventListener('mouseup', slepp)
  }, [kolMap, rader, radId, hentRedigerVerdi, tekst, onSetExtra, onSetVerdi])

  // Kolonnenøklar som BERRE er redigerbare fordi rutenettvisninga er på —
  // brukt til Tab/Shift+Tab-navigasjon i RedigerCelle saman med dei vanleg
  // redigerbare/eigne kolonnane.
  const modusRedigerbareKeys = useMemo(() => {
    if (!rutenettRedigering || !redigeringsmodus) return []
    return synlege.filter(k => erModusRedigerbar(kolMap[k]))
  }, [rutenettRedigering, redigeringsmodus, synlege, kolMap, erModusRedigerbar])

  // ── Meny: plassering og lukking ─────────────────────────────────
  const plasser = useCallback(() => {
    const a = ankerRef.current
    if (!a || !a.isConnected) { setMeny(null); return }
    const r = a.getBoundingClientRect()
    setMeny(m => m ? { ...m, left: Math.min(r.left, window.innerWidth - 290), top: r.bottom + 6 } : m)
  }, [])

  useEffect(() => {
    if (!meny) return
    const lukk = (e) => { if (!e.target.closest?.('.dt-meny')) setMeny(null) }
    const esc  = (e) => { if (e.key === 'Escape') setMeny(null) }
    document.addEventListener('mousedown', lukk)
    document.addEventListener('keydown', esc)
    window.addEventListener('resize', plasser)
    window.addEventListener('scroll', plasser, true)
    return () => {
      document.removeEventListener('mousedown', lukk)
      document.removeEventListener('keydown', esc)
      window.removeEventListener('resize', plasser)
      window.removeEventListener('scroll', plasser, true)
    }
  }, [meny, plasser])

  const opneMeny = (slag, key, e) => {
    e.stopPropagation()
    const knapp = e.currentTarget
    if (meny && meny.slag === slag && meny.key === key) { setMeny(null); return }
    ankerRef.current = knapp
    const r = knapp.getBoundingClientRect()
    setMeny({ slag, key, left: Math.min(r.left, window.innerWidth - 290), top: r.bottom + 6 })
  }

  // ── Handlingar ──────────────────────────────────────────────────
  const sorter = (key, dir) => setPrefs(p => ({
    ...p,
    sortering: dir ? { key, dir }
      : (p.sortering?.key === key && p.sortering?.dir === 'asc' ? { key, dir:'desc' } : { key, dir:'asc' }),
  }))
  const veksleFilter = (key, verdi) => setPrefs(p => {
    const no = new Set(p.filter[key] || [])
    no.has(verdi) ? no.delete(verdi) : no.add(verdi)
    const nyeFilter = { ...p.filter }
    if (no.size) nyeFilter[key] = [...no]; else delete nyeFilter[key]
    return { ...p, filter: nyeFilter }
  })
  const tomFilter = (key) => setPrefs(p => { const f = { ...p.filter }; delete f[key]; return { ...p, filter: f } })
  const skjul     = (key) => setPrefs(p => ({ ...p, skjulte: [...new Set([...p.skjulte, key])] }))
  const vis       = (key) => setPrefs(p => ({ ...p, skjulte: p.skjulte.filter(k => k !== key) }))
  const nullstill = () => { slett(prefsKey); setPrefsRaw({ ...standardPrefs, breidder: { ...standardPrefs.breidder } }) }

  const leggTilKolonne = async (label, art, valListe) => {
    const namn = (label || '').trim()
    if (!namn || !onNyKolonne) return
    const key = await onNyKolonne(namn, art, valListe)
    setMeny(null)
    if (!key) return
    setPrefs(p => ({
      ...p,
      rekkje: [...p.rekkje.filter(k => k !== key), key],
      skjulte: p.skjulte.filter(k => k !== key),
      breidder: { ...p.breidder, [key]: 150 },
    }))
  }
  const slettKolonne = async (key) => {
    const kol = kolMap[key]
    if (!window.confirm(`Slette kolonnen «${kol?.label}»? Kolonnen forsvinn for alle som ser tabellen her.`)) return
    setMeny(null)
    await onSlettKolonne?.(key)
    setPrefs(p => ({ ...p, rekkje: p.rekkje.filter(k => k !== key), skjulte: p.skjulte.filter(k => k !== key) }))
  }

  // ── Breiddejustering ────────────────────────────────────────────
  // Dra-handtaket sit på høgre kant av kolonnen. Endrar BERRE breidda på
  // denne eine kolonnen — alle kolonnane etter han flyttar seg naturleg
  // med (dei kjem jo rett etter i tabellrada), utan at DEI sine eigne
  // breidder vert rørte. <table> sin breidd er summen av kolonnebreiddene
  // (ikkje 100%, sjå totalBreidd over) nettopp for at dette skal vere
  // einaste effekten — elles ville nettlesaren fordelt «overflødig» plass
  // proporsjonalt ut over ALLE kolonnar kvar gong éin av dei endra breidd.
  const startResize = (key, e) => {
    e.preventDefault(); e.stopPropagation()
    const startX = e.clientX
    const startW = breidd(key)
    const min = minBreidd(key)
    const flytt = (ev) => {
      const ny = Math.max(min, Math.round(startW + (ev.clientX - startX)))
      setPrefsRaw(p => ({ ...p, breidder: { ...p.breidder, [key]: ny } }))
    }
    const slepp = () => {
      window.removeEventListener('mousemove', flytt)
      window.removeEventListener('mouseup', slepp)
      document.body.style.cursor = ''
      setPrefsRaw(p => { skriv(prefsKey, p); return p })
    }
    document.body.style.cursor = 'col-resize'
    window.addEventListener('mousemove', flytt)
    window.addEventListener('mouseup', slepp)
  }

  // ── Kolonneflytting ─────────────────────────────────────────────
  const slippKolonne = (mal) => {
    const frå = dragRef.current
    dragRef.current = null
    if (!frå || frå === mal) return
    setPrefs(p => {
      const r = p.rekkje.filter(k => k !== frå)
      r.splice(r.indexOf(mal), 0, frå)
      return { ...p, rekkje: r }
    })
  }

  // ── Fleirval (shift/ctrl-klikk) ─────────────────────────────────
  // Vanleg klikk vel berre denne eine rada. Shift-klikk vel heile området
  // frå sist klikka rad (i den viste rekkjefølgja) til denne. Ctrl/Cmd-klikk
  // legg til/fjernar denne eine rada frå det gjeldande utvalet.
  const handterMerkKlikk = (id, e) => {
    if (!merking) return
    const valde = merking.valde instanceof Set ? merking.valde : new Set(merking.valde || [])
    if (e.shiftKey && sisteMerktRef.current != null) {
      const ids = rader.map(r => radId(r))
      const a = ids.indexOf(sisteMerktRef.current), b = ids.indexOf(id)
      if (a !== -1 && b !== -1) {
        const [start, slutt] = a < b ? [a, b] : [b, a]
        const nye = new Set(valde)
        ids.slice(start, slutt + 1).forEach(x => nye.add(x))
        merking.onEndre(nye)
        return
      }
    }
    if (e.ctrlKey || e.metaKey) {
      const nye = new Set(valde)
      nye.has(id) ? nye.delete(id) : nye.add(id)
      merking.onEndre(nye)
      sisteMerktRef.current = id
      return
    }
    merking.onEndre(new Set([id]))
    sisteMerktRef.current = id
  }

  const aktiveFilter = Object.entries(prefs.filter).filter(([, v]) => v && v.length)
  const radhøgd = prefs.tettleik === 'tett' ? 30 : prefs.tettleik === 'luftig' ? 48 : 38
  const cellePad = prefs.tettleik === 'tett' ? '0 8px' : '0 11px'

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>
      <style>{CSS}</style>

      {/* ── Tabellverktøy ── */}
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap',
        padding:'7px 16px', background:'var(--bg2)', borderBottom:'1px solid var(--border)' }}>
        {rutenettRedigering && (<>
          <span className="dt-etikett">Redigering</span>
          <Segment val={redigeringsmodus} sett={v => setRedigeringsmodus(v)} val1={[false, 'Av']} val2={[true, 'På']}/>
          {angreStabel.length > 0 && (
            <button type="button" className="dt-knapp" onClick={angre} title="Angre siste endring">
              ↶ Angre
            </button>
          )}
        </>)}
        <span className="dt-etikett">Fargekode</span>
        <Segment val={prefs.farge} sett={v => setPrefs({ farge:v })}
          val1={[false, 'Av']} val2={[true, 'På']}/>
        <span className="dt-etikett" style={{ marginLeft:6 }}>Tettleik</span>
        <div className="dt-seg">
          {[['tett','Tett'],['normal','Normal'],['luftig','Luftig']].map(([v, t]) => (
            <button key={v} type="button" onClick={()=>setPrefs({ tettleik:v })}
              className={prefs.tettleik === v ? 'på' : ''}>{t}</button>
          ))}
        </div>

        {aktiveFilter.map(([k, v]) => (
          <span key={k} className="dt-chip">
            <b>{kolMap[k]?.label}:</b>{v.length > 2 ? `${v.length} valde` : v.join(', ')}
            <button type="button" onClick={()=>tomFilter(k)} title="Fjern filter">×</button>
          </span>
        ))}

        <div style={{ flex:1 }}/>
        <span style={{ fontSize:11.5, color:'var(--text3)' }}>
          {rader.length}{rader.length !== (dataRader || []).length ? ` av ${(dataRader || []).length}` : ''} {itemNamn}
        </span>
        <button type="button" className="dt-knapp" onClick={e => opneMeny('kolonnar', null, e)}>+ Kolonnar</button>
        <button type="button" className="dt-knapp" onClick={nullstill} title="Tilbake til standard kolonnar, breidder og sortering">
          Nullstill
        </button>
      </div>

      {/* ── Tabell ── */}
      <div className="dt-skroll" style={{ flex:1, overflow:'auto', minHeight:0 }}>
        <table className={'dt-tabell' + (prefs.farge ? ' farge' : '')}
          style={{ tableLayout:'fixed', width:totalBreidd, borderCollapse:'separate', borderSpacing:0 }}>
          <colgroup>
            {radMeny && <col style={{ width:RAD_MENY_BREIDD }}/>}
            {synlege.map(k => <col key={k} style={{ width:breidd(k) }}/>)}
          </colgroup>
          <thead>
            <tr>
              {radMeny && <th className="dt-radmeny-hovud"/>}
              {synlege.map(k => {
                const kol = kolMap[k]
                const sortert = prefs.sortering?.key === k
                return (
                  <th key={k} data-key={k}
                    className={(sortert ? 'sortert ' : '') + (prefs.filter[k]?.length ? 'filtrert' : '')}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => slippKolonne(k)}>
                    <div className="dt-th" draggable
                      onDragStart={() => { dragRef.current = k }}
                      onClick={e => { if (!e.target.closest('.dt-caret')) sorter(k) }}>
                      <span className="dt-namn">{kol.label}</span>
                      <span className="dt-pil">{sortert ? (prefs.sortering.dir === 'asc' ? '▲' : '▼') : '▲'}</span>
                      <button type="button" className="dt-caret" title={`Meny for ${kol.label}`}
                        onClick={e => opneMeny('kolonne', k, e)}>▾</button>
                    </div>
                    <div className="dt-grip" onMouseDown={e => startResize(k, e)}/>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rader.length === 0 && (
              <tr><td colSpan={synlege.length + (radMeny ? 1 : 0)} style={{ textAlign:'center', padding:30, color:'var(--text3)', height:'auto' }}>
                Ingen {itemNamn} matchar filteret
              </td></tr>
            )}
            {rader.map((r, radIndeks) => {
              const id = radId(r)
              const merkt = merking && (merking.valde instanceof Set ? merking.valde.has(id) : merking.valde?.includes(id))
              return (
              <tr key={id} data-radid={id}
                onClick={e => { handterMerkKlikk(id, e); onRowClick?.(id, r) }}
                onDoubleClick={() => onOpenRad?.(id, r)}
                title={onOpenRad ? 'Dobbeltklikk for å opne' : undefined}
                style={{ ...(radStil ? radStil(r) : undefined), ...(merkt ? { background:'var(--brandbg)', boxShadow:'inset 0 0 0 1.5px var(--brand2)' } : undefined) }}>
                {radMeny && (
                  <td style={{ height:radhøgd, padding:0, textAlign:'center' }}
                    onClick={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}>
                    <button type="button" className="dt-radmeny-knapp" title="Rad-meny"
                      onClick={e => opneMeny('rad', id, e)}>
                      ☰{radMeny.erFavoritt?.(r) && <span className="dt-radmeny-stjerne">★</span>}
                    </button>
                  </td>
                )}
                {synlege.map(k => {
                  const kol = kolMap[k]
                  const alleredeRedigerbar = kol.redigerbar
                  const modusKanRedigere = erModusRedigerbar(kol)
                  const kanRedigere = kol.eigen || alleredeRedigerbar || (modusKanRedigere && redigeringsmodus)
                  const redigerast = kanRedigere && redigerer?.id === id && redigerer?.key === k
                  const iFyllOmråde = fyllOmråde && fyllOmråde.key === k
                    && radIndeks >= fyllOmråde.frå && radIndeks <= fyllOmråde.til
                  const erAktivFyllCelle = redigeringsmodus && modusKanRedigere && !redigerast
                    && aktivCelle?.id === id && aktivCelle?.key === k
                  const startverdi = (redigerast || erAktivFyllCelle)
                    ? (kol.eigen ? (r.ekstra?.[k] ?? '') : (hentRedigerVerdi ? hentRedigerVerdi(r, k) : tekst(r, k)))
                    : undefined
                  return (
                    <td key={k} style={{ height:radhøgd, padding:cellePad, position:'relative',
                        cursor: kol.opnaFil ? 'pointer' : undefined,
                        ...(iFyllOmråde ? { boxShadow:'inset 0 0 0 1.5px var(--brand)', background:'var(--brandbg)' } : undefined) }}
                      className={(kol.mono ? 'mono ' : '') + (kol.art === 'tal' ? 'tal ' : '') + (kanRedigere ? 'eigen' : '')}
                      title={kol.opnaFil ? (alleredeRedigerbar ? 'Klikk for å opne, dobbeltklikk for å redigere' : 'Klikk for å opne')
                        : kanRedigere ? (kol.eigen ? 'Klikk for å redigere' : 'Dobbeltklikk for å redigere') : tekst(r, k)}
                      onClick={() => {
                        if (kol.eigen) { setRedigerer({ id, key:k }); return }
                        if (kol.opnaFil) {
                          if (alleredeRedigerbar) {
                            if (klikkTimerRef.current) return
                            klikkTimerRef.current = setTimeout(() => { klikkTimerRef.current = null; onOpneFil?.(r, k) }, 220)
                          } else {
                            onOpneFil?.(r, k)
                          }
                          return
                        }
                        if (redigeringsmodus && modusKanRedigere) setAktivCelle({ id, key:k })
                      }}
                      onDoubleClick={e => {
                        if (kol.eigen || kol.opnaFil) return
                        if (!alleredeRedigerbar && !modusKanRedigere) return
                        if (klikkTimerRef.current) { clearTimeout(klikkTimerRef.current); klikkTimerRef.current = null }
                        e.stopPropagation()
                        if (modusKanRedigere && !redigeringsmodus) setRedigeringsmodus(true)
                        setRedigerer({ id, key:k })
                      }}>
                      {redigerast ? (
                        kol.eigen ? (
                          kol.val ? (
                            <select autoFocus defaultValue={r.ekstra?.[k] ?? ''} className="dt-input"
                              onClick={e => e.stopPropagation()}
                              onChange={e => { settExtraMedAngre(id, k, r.ekstra?.[k] ?? '', e.target.value); setRedigerer(null) }}
                              onBlur={() => setRedigerer(null)}>
                              <option value="">—</option>
                              {kol.val.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                          ) : (
                            <input autoFocus defaultValue={r.ekstra?.[k] ?? ''} className="dt-input"
                              type={kol.art === 'dato' ? 'date' : kol.art === 'tal' ? 'number' : 'text'}
                              onClick={e => e.stopPropagation()}
                              onBlur={e => { settExtraMedAngre(id, k, r.ekstra?.[k] ?? '', e.target.value); setRedigerer(null) }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') e.target.blur()
                                if (e.key === 'Escape') setRedigerer(null)
                              }}/>
                          )
                        ) : (
                          <RedigerCelle kol={kol}
                            startverdi={hentRedigerVerdi ? hentRedigerVerdi(r, k) : tekst(r, k)}
                            synlege={synlege} kolMap={kolMap} modusRedigerbareKeys={modusRedigerbareKeys}
                            onLagre={verdi => settVerdiMedAngre(id, k, hentRedigerVerdi ? hentRedigerVerdi(r, k) : tekst(r, k), verdi)}
                            onFlytt={nesteKey => setRedigerer(nesteKey ? { id, key:nesteKey } : null)}
                            onLukk={() => setRedigerer(null)}/>
                        )
                      ) : (
                        <Celle rad={r} kol={kol} tekst={tekst} farge={prefs.farge} lagCelle={lagCelle}/>
                      )}
                      {erAktivFyllCelle && (
                        <span className="dt-fyllhandtak"
                          onMouseDown={e => startFyll(id, k, startverdi, e)}
                          title="Dra for å fylle verdien inn i radene under/over, som i Excel"/>
                      )}
                    </td>
                  )
                })}
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      {/* ── Menyar ── */}
      {meny?.slag === 'kolonne' && (
        <KolonneMeny
          kol={kolMap[meny.key]} left={meny.left} top={meny.top}
          sortering={prefs.sortering} filter={prefs.filter[meny.key] || []}
          rader={filtrerte} alle={dataRader || []} tekst={tekst} sorteringsverdi={sorteringsverdi}
          rangering={rangering}
          onSorter={dir => { sorter(meny.key, dir); setMeny(null) }}
          onFilter={v => veksleFilter(meny.key, v)}
          onTomFilter={() => tomFilter(meny.key)}
          onStandardBreidd={() => { setPrefs(p => ({ ...p, breidder: { ...p.breidder, [meny.key]: standardBreidder[meny.key] } })); setMeny(null) }}
          onSkjul={() => { skjul(meny.key); setMeny(null) }}
          onSlett={() => slettKolonne(meny.key)}
          onNyKolonne={onNyKolonne ? () => setMeny(m => ({ ...m, slag:'ny' })) : null}
        />
      )}

      {meny?.slag === 'rad' && radMeny && (() => {
        const rad = rader.find(r => radId(r) === meny.key)
        if (!rad) return null
        const favoritt  = !!radMeny.erFavoritt?.(rad)
        const festa     = !!radMeny.erFesta?.(rad)
        const arkivert  = !!radMeny.erArkivert?.(rad)
        return (
          <div className="dt-meny" style={{ left:meny.left, top:meny.top, width:210 }}>
            {radMeny.onFavoritt && (
              <button type="button" className="dt-val" onClick={() => { radMeny.onFavoritt(meny.key, rad); setMeny(null) }}>
                <span className="dt-rmikon">{favoritt ? '★' : '☆'}</span>
                <span>{favoritt ? 'Fjern favoritt' : 'Merk som favoritt'}</span>
              </button>
            )}
            {radMeny.onFestTilTopp && (
              <button type="button" className="dt-val" onClick={() => { radMeny.onFestTilTopp(meny.key, rad); setMeny(null) }}>
                <span className="dt-rmikon">📌</span>
                <span>{festa ? 'Løys frå toppen' : 'Fest til toppen'}</span>
              </button>
            )}
            {radMeny.onArkiver && (<>
              <div className="dt-skilje"/>
              <button type="button" className="dt-val" onClick={() => { radMeny.onArkiver(meny.key, rad); setMeny(null) }}>
                <span className="dt-rmikon">⤓</span>
                <span>{arkivert ? 'Hent ut av arkivet' : 'Arkiver'}</span>
              </button>
            </>)}
            {radMeny.onSlett && (
              <button type="button" className="dt-val" onClick={() => { radMeny.onSlett(meny.key, rad); setMeny(null) }}>
                <span className="dt-rmikon">🗑</span>
                <span>Slett</span>
              </button>
            )}
            {radMeny.ekstraVal?.length > 0 && (<>
              {(radMeny.onFavoritt || radMeny.onFestTilTopp || radMeny.onArkiver || radMeny.onSlett) && <div className="dt-skilje"/>}
              {radMeny.ekstraVal.map((val) => (
                <button key={val.namn} type="button" className="dt-val" onClick={() => { val.onKlikk(meny.key, rad); setMeny(null) }}>
                  <span className="dt-rmikon">{val.ikon}</span>
                  <span>{val.namn}</span>
                </button>
              ))}
            </>)}
          </div>
        )
      })()}

      {meny?.slag === 'kolonnar' && (
        <div className="dt-meny" style={{ left:meny.left, top:meny.top }}>
          <div className="dt-menyhovud">Vis kolonnar</div>
          <div className="dt-menyliste" style={{ maxHeight:'70vh' }}>
            {/* Høgda skal dekke alle vala (brukar sitt krav) — 70vh er
                framleis avgrensa av skjermhøgda, så menyen kan ALDRI
                strekke seg utanfor synsfeltet uansett kor mange kolonnar
                tabellen har. */}
            {rekkje.map(k => {
              const på = !prefs.skjulte.includes(k)
              return (
                <button key={k} type="button" className="dt-val"
                  onClick={() => { if (på) { if (synlege.length > 1) skjul(k) } else vis(k) }}>
                  <span className="hake">{på ? '✓' : ''}</span>
                  <span>{kolMap[k].label}</span>
                  {kolMap[k].eigen && <span className="tal">eigen</span>}
                </button>
              )
            })}
          </div>
          <div className="dt-skilje"/>
          <button type="button" className="dt-val" onClick={() => setPrefs({ skjulte: [] })}>
            <span className="hake">✓</span><span>Vis alle kolonnar</span>
          </button>
          {onNyKolonne && (
            <button type="button" className="dt-val ny" onClick={() => setMeny(m => ({ ...m, slag:'ny' }))}>
              <span className="hake">+</span><span>Ny kolonne…</span>
            </button>
          )}
        </div>
      )}

      {meny?.slag === 'ny' && onNyKolonne && (
        <NyKolonneSkjema left={meny.left} top={meny.top}
          onAvbryt={() => setMeny(null)} onLagre={leggTilKolonne}/>
      )}
    </div>
  )
}

// ── Celle ──────────────────────────────────────────────────────────
function Celle({ rad, kol, tekst, farge, lagCelle }) {
  if (lagCelle) {
    const eigen = lagCelle(rad, kol, { farge })
    if (eigen !== undefined) return eigen
  }
  const t = tekst(rad, kol.key)
  if (kol.mono) return <span style={{ fontFamily:'var(--mono)', fontWeight:600 }}>{t}</span>
  if (kol.eigen) {
    if (!t) return <span style={{ color:'var(--text3)', opacity:.45 }}>—</span>
    return <>{t}</>
  }
  return <>{t}</>
}

// ── RedigerCelle — reknearkstil redigering av vanlege (ikkje-eigne)
// kolonnar merkt «redigerbar:true». Tab/Shift+Tab lagrar og flytter til
// neste/førre redigerbare kolonne i same rad; Enter lagrar og lukkar;
// Escape avbryt utan å lagre. Kolonnar med ei fast verdiliste (kol.val)
// vert redigert med ei nedtrekksmeny i staden for fritekst.
function RedigerCelle({ kol, startverdi, synlege, kolMap, modusRedigerbareKeys = [], onLagre, onFlytt, onLukk }) {
  const [v, setV] = useState(startverdi ?? '')
  const redigerbareKeys = synlege.filter(k => kolMap[k].eigen || kolMap[k].redigerbar || modusRedigerbareKeys.includes(k))

  const flyttTil = (retning) => {
    const i = redigerbareKeys.indexOf(kol.key)
    onFlytt(redigerbareKeys[i + retning])
  }
  const håndterTast = (e) => {
    if (e.key === 'Enter') { onLagre(v); onLukk() }
    else if (e.key === 'Escape') { onLukk() }
    else if (e.key === 'Tab') { e.preventDefault(); onLagre(v); flyttTil(e.shiftKey ? -1 : 1) }
  }

  if (kol.val) {
    return (
      <select autoFocus className="dt-input" value={v}
        onChange={e => setV(e.target.value)}
        onClick={e => e.stopPropagation()}
        onBlur={e => onLagre(e.target.value)}
        onKeyDown={håndterTast}>
        {kol.val.map(x => <option key={x || '_tom'} value={x}>{x || '(ikkje sett)'}</option>)}
      </select>
    )
  }
  return (
    <input autoFocus className="dt-input" value={v}
      type={kol.art === 'tal' ? 'number' : 'text'}
      onChange={e => setV(e.target.value)}
      onClick={e => e.stopPropagation()}
      onBlur={e => onLagre(e.target.value)}
      onKeyDown={håndterTast}/>
  )
}

export function Pille({ tekst, farge }) {
  return (
    <span style={{ display:'inline-block', padding:'2px 9px', borderRadius:20, fontSize:10.5, fontWeight:700,
      letterSpacing:'.02em', textTransform:'uppercase', whiteSpace:'nowrap',
      background: farge ? farge + '1a' : 'var(--bg3)',
      color: farge || 'var(--text3)' }}>
      {tekst}
    </span>
  )
}

function Segment({ val, sett, val1, val2 }) {
  return (
    <div className="dt-seg">
      <button type="button" className={val === val1[0] ? 'på' : ''} onClick={() => sett(val1[0])}>{val1[1]}</button>
      <button type="button" className={val === val2[0] ? 'på' : ''} onClick={() => sett(val2[0])}>{val2[1]}</button>
    </div>
  )
}

// ── Kolonnemeny ────────────────────────────────────────────────────
function KolonneMeny({ kol, left, top, sortering, filter, rader, alle, tekst, sorteringsverdi, rangering,
                       onSorter, onFilter, onTomFilter, onStandardBreidd, onSkjul, onSlett, onNyKolonne }) {
  const [søk, setSøk] = useState('')
  const merkelappar = kol.art === 'tal' ? ['Lågast først', 'Høgast først']
    : kol.art === 'dato' ? ['Eldst først', 'Nyast først']
    : rangering?.(kol.key) ? ['Høgast først', 'Lågast først']
    : ['A → Å', 'Å → A']

  const teljing = useMemo(() => {
    const m = new Map()
    alle.forEach(r => { const v = tekst(r, kol.key); m.set(v, (m.get(v) || 0) + 1) })
    return m
  }, [alle, tekst, kol.key])
  const rangert = rangering?.(kol.key) || null
  const verdiar = useMemo(() => [...teljing.keys()]
    .sort((a, b) => rangert
      ? rangert.indexOf(a) - rangert.indexOf(b)
      : samanlikn.compare(a, b))
    .filter(v => v.toLowerCase().includes(søk.toLowerCase())), [teljing, søk, rangert])

  const talStat = useMemo(() => {
    if (kol.art !== 'tal' && kol.art !== 'dato') return null
    const tal = rader.map(r => sorteringsverdi(r, kol.key)).filter(n => typeof n === 'number' && isFinite(n))
    if (kol.art === 'dato') {
      if (!tal.length) return [['Antal', '0']]
      return [['Antal', String(rader.length)],
              ['Første', new Date(Math.min(...tal)).toLocaleDateString('no-NO')],
              ['Siste',  new Date(Math.max(...tal)).toLocaleDateString('no-NO')]]
    }
    const sum = tal.reduce((a, b) => a + b, 0)
    return [['Antal', String(rader.length)], ['Sum', String(Math.round(sum * 100) / 100)],
            ['Snitt', tal.length ? (sum / tal.length).toFixed(1) : '—'],
            ['Lågast', tal.length ? String(Math.min(...tal)) : '—'],
            ['Høgast', tal.length ? String(Math.max(...tal)) : '—']]
  }, [kol.art, kol.key, rader, sorteringsverdi])

  return (
    <div className="dt-meny" style={{ left, top }}>
      <div className="dt-menyhovud">Sorter</div>
      {['asc', 'desc'].map((dir, i) => (
        <button key={dir} type="button" className="dt-val" onClick={() => onSorter(dir)}>
          <span className="hake">{sortering?.key === kol.key && sortering?.dir === dir ? '✓' : ''}</span>
          <span>{merkelappar[i]}</span>
        </button>
      ))}

      {talStat && (<>
        <div className="dt-skilje"/>
        <div className="dt-menyhovud">Nøkkeltal</div>
        <div className="dt-stat">{talStat.map(([k, v]) => (
          <div key={k} className="rad"><span>{k}</span><b>{v}</b></div>
        ))}</div>
      </>)}

      {!talStat && !kol.utanFilter && (<>
        <div className="dt-skilje"/>
        <div className="dt-menyhovud">Filtrer på verdi</div>
        {teljing.size > 7 && (
          <div style={{ padding:4 }}>
            <input className="dt-input" placeholder="Søk i verdiar…" value={søk}
              onChange={e => setSøk(e.target.value)} onClick={e => e.stopPropagation()}/>
          </div>
        )}
        <div className="dt-menyliste">
          {verdiar.map(v => (
            <button key={v} type="button" className="dt-val" onClick={() => onFilter(v)}>
              <span className="hake">{filter.includes(v) ? '✓' : ''}</span>
              <span>{v || '(tom)'}</span>
              <span className="tal">{teljing.get(v)}</span>
            </button>
          ))}
          {verdiar.length === 0 && <div className="dt-menyhovud">Ingen treff</div>}
        </div>
        {filter.length > 0 && (
          <button type="button" className="dt-val" onClick={onTomFilter}>
            <span className="hake">×</span><span>Tøm filteret</span>
          </button>
        )}
      </>)}

      <div className="dt-skilje"/>
      <button type="button" className="dt-val" onClick={onStandardBreidd}>
        <span className="hake"/><span>Standard breidd</span>
      </button>
      <button type="button" className="dt-val" onClick={onSkjul}>
        <span className="hake">−</span><span>Skjul kolonnen</span>
      </button>
      {onNyKolonne && (
        <button type="button" className="dt-val ny" onClick={onNyKolonne}>
          <span className="hake">+</span><span>Ny kolonne…</span>
        </button>
      )}
      {kol.eigen && (
        <button type="button" className="dt-val fare" onClick={onSlett}>
          <span className="hake">🗑</span><span>Slett kolonnen</span>
        </button>
      )}
    </div>
  )
}

// ── Skjema for ny kolonne ──────────────────────────────────────────
function NyKolonneSkjema({ left, top, onAvbryt, onLagre }) {
  const [namn, setNamn]     = useState('')
  const [art, setArt]       = useState('tekst')
  const [nedtrekk, setNedtrekk] = useState(false)
  const [valTekst, setValTekst] = useState('')

  const lagre = () => {
    const valListe = nedtrekk
      ? valTekst.split('\n').map(v => v.trim()).filter(Boolean)
      : undefined
    onLagre(namn, art, valListe?.length ? valListe : undefined)
  }

  return (
    <div className="dt-meny" style={{ left, top, width:250 }}>
      <div className="dt-menyhovud">Ny kolonne</div>
      <div style={{ padding:'2px 8px 8px', display:'flex', flexDirection:'column', gap:8 }}>
        <input autoFocus className="dt-input" placeholder="Namn på kolonnen" value={namn}
          onChange={e => setNamn(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !nedtrekk) lagre() }}/>
        <select className="dt-input" value={art} onChange={e => setArt(e.target.value)}>
          <option value="tekst">Tekst</option>
          <option value="tal">Tal</option>
          <option value="dato">Dato</option>
        </select>
        <label style={{ display:'flex', alignItems:'center', gap:7, fontSize:12, color:'var(--text2)', cursor:'pointer' }}>
          <input type="checkbox" checked={nedtrekk} onChange={e => setNedtrekk(e.target.checked)}/>
          Avgrens til faste val (nedtrekksliste)
        </label>
        {nedtrekk && (
          <textarea className="dt-input" rows={4} placeholder={'Eitt val per linje, t.d.:\nIkkje starta\nPågår\nFerdig'}
            value={valTekst} onChange={e => setValTekst(e.target.value)}
            style={{ resize:'vertical', fontFamily:'var(--font)' }}/>
        )}
        <div style={{ display:'flex', gap:6 }}>
          <button type="button" className="dt-knapp" style={{ flex:1 }} onClick={onAvbryt}>Avbryt</button>
          <button type="button" className="dt-knapp hovud" style={{ flex:1 }} onClick={lagre}>
            Legg til
          </button>
        </div>
        <div style={{ fontSize:11, color:'var(--text3)', lineHeight:1.45 }}>
          Kolonnen blir lagra, og du fyller inn verdiar ved å klikke i cella.
        </div>
      </div>
    </div>
  )
}

// ── Stil ───────────────────────────────────────────────────────────
const CSS = `
.dt-etikett { font-size:10px; letter-spacing:.09em; text-transform:uppercase; color:var(--text3); font-weight:700 }
.dt-seg { display:inline-flex; background:var(--bg3); border:1px solid var(--border); border-radius:7px; padding:2px; gap:2px }
.dt-seg button { border:0; background:transparent; padding:4px 11px; border-radius:5px; font-size:12px;
  font-weight:600; color:var(--text3); font-family:var(--font); transition:background .15s, color .15s }
.dt-seg button:hover { color:var(--text) }
.dt-seg button.på { background:var(--bg2); color:var(--brand); box-shadow:var(--shadow-sm) }
.dt-knapp { border:1.5px solid var(--border); background:var(--bg2); color:var(--text3); border-radius:7px;
  padding:5px 11px; font-size:12px; font-weight:600; font-family:var(--font); transition:all .15s }
.dt-knapp:hover { border-color:var(--brand2); color:var(--brand); background:var(--brandbg) }
.dt-knapp.hovud { background:var(--brand); border-color:var(--brand); color:#fff }
.dt-chip { display:inline-flex; align-items:center; gap:5px; background:var(--brandbg); color:var(--brand);
  border-radius:20px; padding:3px 5px 3px 10px; font-size:11.5px; font-weight:600 }
.dt-chip b { font-weight:700 }
.dt-chip button { border:0; background:transparent; color:inherit; font-size:14px; line-height:1; padding:0 3px; opacity:.6 }
.dt-chip button:hover { opacity:1 }

.dt-tabell th { position:sticky; top:0; z-index:5; background:var(--bg3); padding:0; text-align:left;
  border-bottom:2px solid var(--border); border-right:1px solid var(--border); white-space:nowrap }
.dt-tabell th::after { content:''; position:absolute; left:0; right:0; bottom:-2px; height:2px; background:var(--brand);
  transform:scaleX(0); transform-origin:left; transition:transform .22s cubic-bezier(.4,0,.2,1) }
.dt-tabell th:hover::after, .dt-tabell th.sortert::after { transform:scaleX(1) }
.dt-th { display:flex; align-items:center; gap:5px; padding:0 10px; height:38px; cursor:pointer; user-select:none;
  font-size:12px; font-weight:700; letter-spacing:0; color:var(--text); transition:background .15s }
.dt-th:hover { background:var(--brandbg) }
.dt-namn { overflow:hidden; text-overflow:ellipsis; min-width:0 }
.dt-pil { display:none; font-size:8px; color:var(--brand); flex:0 0 auto }
.dt-tabell th.sortert .dt-pil { display:inline }
.dt-tabell th.filtrert .dt-namn::after { content:''; display:inline-block; width:5px; height:5px; border-radius:50%;
  background:var(--brand); margin-left:6px; vertical-align:middle }
.dt-caret { margin-left:auto; width:20px; height:20px; border:0; background:transparent; border-radius:5px;
  color:var(--text3); font-size:11px; opacity:0; transition:opacity .18s, background .15s, color .15s; flex:0 0 auto }
.dt-tabell th:hover .dt-caret { opacity:1 }
.dt-caret:hover { background:var(--brand); color:#fff; opacity:1 }
.dt-grip { position:absolute; top:0; right:-3px; width:7px; height:100%; cursor:col-resize; z-index:6 }
.dt-grip:hover { background:var(--brand3); opacity:.5 }
.dt-radmeny-hovud { position:sticky; top:0; z-index:5; background:var(--bg3); border-bottom:2px solid var(--border);
  border-right:1px solid var(--border) }
.dt-radmeny-knapp { width:100%; height:100%; border:0; background:transparent; cursor:pointer;
  color:var(--text3); font-size:17px; display:flex; align-items:center; justify-content:center; gap:2px;
  position:relative }
.dt-radmeny-knapp:hover { background:var(--bg3) }
.dt-radmeny-stjerne { color:var(--text3); font-size:10px; position:absolute; top:2px; right:2px }
.dt-rmikon { width:20px; flex:0 0 auto; text-align:center; font-size:15px; color:var(--text2) }

.dt-tabell td { border-bottom:1px solid var(--border); border-right:1px solid var(--border);
  font-size:13px; color:var(--text2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
.dt-tabell tbody tr:hover td { background:var(--bg3) }
.dt-tabell td.tal { text-align:right; font-variant-numeric:tabular-nums }
.dt-tabell td.mono { font-family:var(--mono) }
.dt-tabell td.eigen { cursor:text }
.dt-tabell td.eigen:hover { box-shadow:inset 0 0 0 1.5px var(--border2) }
.dt-fyllhandtak { position:absolute; right:1px; bottom:1px; width:6px; height:6px;
  background:var(--brand); border:1px solid var(--bg2); cursor:crosshair; z-index:2 }

.dt-input { width:100%; padding:5px 8px; border:1.5px solid var(--border); border-radius:6px; font-size:12.5px;
  font-family:var(--font); background:var(--bg2); color:var(--text); outline:none }
.dt-input:focus { border-color:var(--brand2) }

.dt-meny { position:fixed; z-index:300; width:250px; background:var(--bg2); border:1px solid var(--border);
  border-radius:10px; box-shadow:var(--shadow-lg); padding:5px; animation:dt-inn .13s ease-out }
@keyframes dt-inn { from { opacity:0; transform:translateY(-5px) } to { opacity:1; transform:none } }
.dt-menyhovud { padding:7px 10px 5px; font-size:9.5px; letter-spacing:.11em; text-transform:uppercase;
  color:var(--text3); font-weight:800 }
.dt-menyliste { max-height:210px; overflow:auto }
.dt-val { display:flex; align-items:center; gap:8px; width:100%; text-align:left; border:0; background:transparent;
  padding:6px 10px; border-radius:7px; font-size:12.5px; color:var(--text); font-family:var(--font);
  transition:background .12s, color .12s }
.dt-val:hover { background:var(--brandbg); color:var(--brand) }
.dt-val .hake { width:13px; flex:0 0 auto; color:var(--brand); font-size:11px; font-weight:800 }
.dt-val .tal { margin-left:auto; font-family:var(--mono); font-size:10.5px; color:var(--text3) }
.dt-val.ny { color:var(--brand); font-weight:700 }
.dt-val.fare:hover { background:rgba(185,28,28,.10); color:#B91C1C }
.dt-skilje { height:1px; background:var(--border); margin:5px 4px }
.dt-stat { padding:2px 10px 8px; font-size:12px; color:var(--text3) }
.dt-stat .rad { display:flex; justify-content:space-between; gap:14px; padding:1px 0 }
.dt-stat b { font-family:var(--mono); color:var(--text); font-variant-numeric:tabular-nums }
`
