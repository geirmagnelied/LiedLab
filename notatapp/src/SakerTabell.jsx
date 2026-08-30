import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  STATUS_LABELS, STATUS_ORDER, STATUS_COLORS,
  PRIO_LABELS, PRIO_ORDER, PRIO_COLORS,
  caseNoValue, caseNoText, fmtDateShort,
} from './sakerKonstantar'

// ═══════════════════════════════════════════════════════════════════
//  Saksmatrise med sortering, filter, kolonnestyring og eigne kolonnar
//  Visingsoppsett (rekkjefølgje, breidd, farge, sortering) er personleg og
//  vert lagra lokalt i nettlesaren.
//  Eigne kolonnar høyrer til prosjektet og ligg i databasen: definisjonen i
//  case_columns, verdiane i cases.ekstra.
// ═══════════════════════════════════════════════════════════════════

const PREFS_KEY = 'liedlab-saker-tabell-v2'

// art: 'tekst' | 'tal' | 'dato' | 'val'  — styrer sorteringsval og meny
const BASE_COLUMNS = [
  { key:'prosjekt',  label:'Prosjektnr',  w:118, art:'val',   mono:true },
  { key:'number',    label:'Saksnr',      w:112, art:'tal',   mono:true },
  { key:'title',     label:'Tittel',      w:300, art:'tekst', utanFilter:true },
  { key:'status',    label:'Status',      w:142, art:'val' },
  { key:'fag',       label:'Fag',         w:92,  art:'val' },
  { key:'type',      label:'Type',        w:176, art:'val' },
  { key:'prioritet', label:'Prioritet',   w:122, art:'val' },
  { key:'ansvarlig', label:'Ansvarleg',   w:142, art:'val' },
  { key:'frist',     label:'Frist',       w:106, art:'dato' },
  { key:'tegning',   label:'Tegning',     w:130, art:'val' },
  { key:'linked',    label:'Koplingar',   w:124, art:'tal' },
  { key:'comments',  label:'Kommentarar', w:152, art:'tal' },
  { key:'opprettet', label:'Oppretta',    w:116, art:'dato' },
]
const DEFAULT_HIDDEN = ['tegning', 'linked', 'opprettet']

const STANDARD_PREFS = {
  farge: false,
  tettleik: 'normal',            // 'tett' | 'normal' | 'luftig'
  rekkje: BASE_COLUMNS.map(c => c.key),
  skjulte: DEFAULT_HIDDEN,
  breidder: Object.fromEntries(BASE_COLUMNS.map(c => [c.key, c.w])),
  sortering: { key:'number', dir:'desc' },
  filter: {},
}

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

export default function SakerTabell({
  cases, comments, eigne = [],
  onOpenCase, onSetExtra, onNyKolonne, onSlettKolonne,
}) {
  const [prefs, setPrefsRaw] = useState(() => {
    const lagra = les(PREFS_KEY, {})
    return { ...STANDARD_PREFS, ...lagra, breidder: { ...STANDARD_PREFS.breidder, ...(lagra.breidder || {}) } }
  })
  const [meny, setMeny]           = useState(null)   // { slag, key, left, top }
  const [redigerer, setRedigerer] = useState(null)   // { id, key }
  const ankerRef = useRef(null)
  const dragRef  = useRef(null)

  const setPrefs = useCallback((oppdater) => {
    setPrefsRaw(p => {
      const neste = typeof oppdater === 'function' ? oppdater(p) : { ...p, ...oppdater }
      skriv(PREFS_KEY, neste)
      return neste
    })
  }, [])

  // ── Kolonner ────────────────────────────────────────────────────
  const alleKolonner = useMemo(() => ([
    ...BASE_COLUMNS,
    ...eigne.map(e => ({ key:e.key, label:e.label, w:e.w || 140, art:e.art, eigen:true })),
  ]), [eigne])
  const kolMap = useMemo(() => Object.fromEntries(alleKolonner.map(c => [c.key, c])), [alleKolonner])

  const rekkje = useMemo(() => {
    const kjende = prefs.rekkje.filter(k => kolMap[k])
    alleKolonner.forEach(c => { if (!kjende.includes(c.key)) kjende.push(c.key) })
    return kjende
  }, [prefs.rekkje, kolMap, alleKolonner])
  const synlege = useMemo(() => rekkje.filter(k => !prefs.skjulte.includes(k)), [rekkje, prefs.skjulte])
  const breidd  = (k) => prefs.breidder[k] ?? kolMap[k]?.w ?? 130

  // ── Verdiar ─────────────────────────────────────────────────────
  const antalKommentarar = useCallback((c) => (comments?.[c.id] || []).length, [comments])

  const tekst = useCallback((c, key) => {
    switch (key) {
      case 'prosjekt':  return c.prosjektNr || '—'
      case 'number':    return caseNoText(c.number)
      case 'title':     return c.title || ''
      case 'status':    return STATUS_LABELS[c.status] || c.status || ''
      case 'prioritet': return PRIO_LABELS[c.prioritet] || c.prioritet || ''
      case 'fag':       return c.fag || '—'
      case 'type':      return c.type || '—'
      case 'ansvarlig': return c.ansvarlig || '—'
      case 'tegning':   return c.tegning || '—'
      case 'frist':     return fmtDateShort(c.frist)
      case 'opprettet': return fmtDateShort(c.opprettet)
      case 'linked':    return String((c.linkedNotes?.length || 0) + (c.linkedTasks?.length || 0))
      case 'comments':  return String(antalKommentarar(c))
      default:          return String(c.ekstra?.[key] ?? '')
    }
  }, [antalKommentarar])

  const sorteringsverdi = useCallback((c, key) => {
    switch (key) {
      case 'number':    return caseNoValue(c.number) || 0
      case 'status':    return STATUS_ORDER.indexOf(c.status)
      case 'prioritet': return PRIO_ORDER.indexOf(c.prioritet)
      case 'frist':     return c.frist ? new Date(c.frist).getTime() : Infinity
      case 'opprettet': return c.opprettet ? new Date(c.opprettet).getTime() : 0
      case 'linked':    return (c.linkedNotes?.length || 0) + (c.linkedTasks?.length || 0)
      case 'comments':  return antalKommentarar(c)
      default: {
        const kol = kolMap[key]
        if (kol?.art === 'tal')  { const n = parseFloat(String(tekst(c, key)).replace(',', '.')); return isNaN(n) ? -Infinity : n }
        if (kol?.art === 'dato') { const t = new Date(tekst(c, key)).getTime(); return isNaN(t) ? Infinity : t }
        return tekst(c, key)
      }
    }
  }, [antalKommentarar, kolMap, tekst])

  // ── Filter + sortering ──────────────────────────────────────────
  const filtrerte = useMemo(() => {
    const aktive = Object.entries(prefs.filter).filter(([, v]) => v && v.length)
    return (cases || []).filter(c => aktive.every(([k, valde]) => valde.includes(tekst(c, k))))
  }, [cases, prefs.filter, tekst])

  const rader = useMemo(() => {
    const { key, dir } = prefs.sortering || {}
    if (!key || !kolMap[key]) return filtrerte
    const teikn = dir === 'desc' ? -1 : 1
    return [...filtrerte].sort((a, b) => {
      const x = sorteringsverdi(a, key), y = sorteringsverdi(b, key)
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * teikn
      return samanlikn.compare(String(x), String(y)) * teikn
    })
  }, [filtrerte, prefs.sortering, kolMap, sorteringsverdi])

  // ── Meny: plassering og lukking ─────────────────────────────────
  const plasser = useCallback(() => {
    const a = ankerRef.current
    if (!a || !a.isConnected) { setMeny(null); return }
    const r = a.getBoundingClientRect()
    setMeny(m => m ? { ...m, left: Math.min(r.left, window.innerWidth - 290), top: r.bottom + 6 } : m)
  }, [])

  useEffect(() => {
    if (!meny) return
    const lukk = (e) => { if (!e.target.closest?.('.sk-meny')) setMeny(null) }
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
  const nullstill = () => { slett(PREFS_KEY); setPrefsRaw({ ...STANDARD_PREFS, breidder: { ...STANDARD_PREFS.breidder } }) }

  // Nye kolonnar blir lagra i databasen og gjeld heile prosjektet
  const leggTilKolonne = async (label, art) => {
    const namn = (label || '').trim()
    if (!namn) return
    const key = await onNyKolonne?.(namn, art)
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
    if (!window.confirm(`Slette kolonnen «${kol?.label}» frå dette prosjektet? Kolonnen forsvinn for alle som ser saksregisteret her. Verdiane blir liggjande i databasen.`)) return
    setMeny(null)
    await onSlettKolonne?.(key)
    setPrefs(p => ({ ...p, rekkje: p.rekkje.filter(k => k !== key), skjulte: p.skjulte.filter(k => k !== key) }))
  }

  // ── Breiddejustering ────────────────────────────────────────────
  const startResize = (key, e) => {
    e.preventDefault(); e.stopPropagation()
    const startX = e.clientX, startW = breidd(key)
    const flytt = (ev) => {
      const ny = Math.max(64, Math.round(startW + (ev.clientX - startX)))
      setPrefsRaw(p => ({ ...p, breidder: { ...p.breidder, [key]: ny } }))
    }
    const slepp = () => {
      window.removeEventListener('mousemove', flytt)
      window.removeEventListener('mouseup', slepp)
      document.body.style.cursor = ''
      setPrefsRaw(p => { skriv(PREFS_KEY, p); return p })
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

  const aktiveFilter = Object.entries(prefs.filter).filter(([, v]) => v && v.length)
  const radhøgd = prefs.tettleik === 'tett' ? 30 : prefs.tettleik === 'luftig' ? 48 : 38
  const cellePad = prefs.tettleik === 'tett' ? '0 8px' : '0 11px'

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>
      <style>{CSS}</style>

      {/* ── Tabellverktøy ── */}
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap',
        padding:'7px 16px', background:'var(--bg2)', borderBottom:'1px solid var(--border)' }}>
        <span className="sk-etikett">Fargekode</span>
        <Segment val={prefs.farge} sett={v => setPrefs({ farge:v })}
          val1={[false, 'Av']} val2={[true, 'På']}/>
        <span className="sk-etikett" style={{ marginLeft:6 }}>Tettleik</span>
        <div className="sk-seg">
          {[['tett','Tett'],['normal','Normal'],['luftig','Luftig']].map(([v, t]) => (
            <button key={v} type="button" onClick={()=>setPrefs({ tettleik:v })}
              className={prefs.tettleik === v ? 'på' : ''}>{t}</button>
          ))}
        </div>

        {aktiveFilter.map(([k, v]) => (
          <span key={k} className="sk-chip">
            <b>{kolMap[k]?.label}:</b>{v.length > 2 ? `${v.length} valde` : v.join(', ')}
            <button type="button" onClick={()=>tomFilter(k)} title="Fjern filter">×</button>
          </span>
        ))}

        <div style={{ flex:1 }}/>
        <span style={{ fontSize:11.5, color:'var(--text3)' }}>
          {rader.length}{rader.length !== (cases || []).length ? ` av ${(cases || []).length}` : ''} saker
        </span>
        <button type="button" className="sk-knapp" onClick={e => opneMeny('kolonnar', null, e)}>+ Kolonnar</button>
        <button type="button" className="sk-knapp" onClick={nullstill} title="Tilbake til standard kolonnar, breidder og sortering">
          Nullstill
        </button>
      </div>

      {/* ── Tabell ── */}
      <div className="sk-skroll" style={{ flex:1, overflow:'auto', minHeight:0 }}>
        <table className={'sk-tabell' + (prefs.farge ? ' farge' : '')}
          style={{ tableLayout:'fixed', width:'100%', borderCollapse:'separate', borderSpacing:0 }}>
          <colgroup>{synlege.map(k => <col key={k} style={{ width:breidd(k) }}/>)}</colgroup>
          <thead>
            <tr>
              {synlege.map(k => {
                const kol = kolMap[k]
                const sortert = prefs.sortering?.key === k
                return (
                  <th key={k} data-key={k}
                    className={(sortert ? 'sortert ' : '') + (prefs.filter[k]?.length ? 'filtrert' : '')}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => slippKolonne(k)}>
                    <div className="sk-th" draggable
                      onDragStart={() => { dragRef.current = k }}
                      onClick={e => { if (!e.target.closest('.sk-caret')) sorter(k) }}>
                      <span className="sk-namn">{kol.label}</span>
                      <span className="sk-pil">{sortert ? (prefs.sortering.dir === 'asc' ? '▲' : '▼') : '▲'}</span>
                      <button type="button" className="sk-caret" title={`Meny for ${kol.label}`}
                        onClick={e => opneMeny('kolonne', k, e)}>▾</button>
                    </div>
                    <div className="sk-grip" onMouseDown={e => startResize(k, e)}/>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rader.length === 0 && (
              <tr><td colSpan={synlege.length} style={{ textAlign:'center', padding:30, color:'var(--text3)', height:'auto' }}>
                Ingen saker matchar filteret
              </td></tr>
            )}
            {rader.map(c => (
              <tr key={c.id} onDoubleClick={() => onOpenCase?.(c.id)} title="Dobbeltklikk for å opne saka"
                style={{ opacity: c.status === 'lukka' ? .6 : 1 }}>
                {synlege.map(k => {
                  const kol = kolMap[k]
                  const redigerast = kol.eigen && redigerer?.id === c.id && redigerer?.key === k
                  return (
                    <td key={k} style={{ height:radhøgd, padding:cellePad }}
                      className={(kol.mono ? 'mono ' : '') + (kol.art === 'tal' ? 'tal ' : '') + (kol.eigen ? 'eigen' : '')}
                      title={kol.eigen ? 'Klikk for å redigere' : tekst(c, k)}
                      onClick={() => { if (kol.eigen) setRedigerer({ id:c.id, key:k }) }}>
                      {redigerast ? (
                        <input autoFocus defaultValue={c.ekstra?.[k] ?? ''} className="sk-input"
                          type={kol.art === 'dato' ? 'date' : kol.art === 'tal' ? 'number' : 'text'}
                          onClick={e => e.stopPropagation()}
                          onBlur={e => { onSetExtra?.(c.id, k, e.target.value); setRedigerer(null) }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') e.target.blur()
                            if (e.key === 'Escape') setRedigerer(null)
                          }}/>
                      ) : (
                        <Celle c={c} kol={kol} tekst={tekst} farge={prefs.farge}/>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Menyar ── */}
      {meny?.slag === 'kolonne' && (
        <KolonneMeny
          kol={kolMap[meny.key]} left={meny.left} top={meny.top}
          sortering={prefs.sortering} filter={prefs.filter[meny.key] || []}
          rader={filtrerte} alle={cases || []} tekst={tekst} sorteringsverdi={sorteringsverdi}
          onSorter={dir => { sorter(meny.key, dir); setMeny(null) }}
          onFilter={v => veksleFilter(meny.key, v)}
          onTomFilter={() => tomFilter(meny.key)}
          onStandardBreidd={() => { setPrefs(p => ({ ...p, breidder: { ...p.breidder, [meny.key]: kolMap[meny.key].w } })); setMeny(null) }}
          onSkjul={() => { skjul(meny.key); setMeny(null) }}
          onSlett={() => slettKolonne(meny.key)}
          onNyKolonne={() => setMeny(m => ({ ...m, slag:'ny' }))}
        />
      )}

      {meny?.slag === 'kolonnar' && (
        <div className="sk-meny" style={{ left:meny.left, top:meny.top }}>
          <div className="sk-menyhovud">Vis kolonnar</div>
          <div className="sk-menyliste">
            {rekkje.map(k => {
              const på = !prefs.skjulte.includes(k)
              return (
                <button key={k} type="button" className="sk-val"
                  onClick={() => { if (på) { if (synlege.length > 1) skjul(k) } else vis(k) }}>
                  <span className="hake">{på ? '✓' : ''}</span>
                  <span>{kolMap[k].label}</span>
                  {kolMap[k].eigen && <span className="tal">eigen</span>}
                </button>
              )
            })}
          </div>
          <div className="sk-skilje"/>
          <button type="button" className="sk-val" onClick={() => setPrefs({ skjulte: [] })}>
            <span className="hake">✓</span><span>Vis alle kolonnar</span>
          </button>
          <button type="button" className="sk-val ny" onClick={() => setMeny(m => ({ ...m, slag:'ny' }))}>
            <span className="hake">+</span><span>Ny kolonne…</span>
          </button>
        </div>
      )}

      {meny?.slag === 'ny' && (
        <NyKolonneSkjema left={meny.left} top={meny.top}
          onAvbryt={() => setMeny(null)} onLagre={leggTilKolonne}/>
      )}
    </div>
  )
}

// ── Celle ──────────────────────────────────────────────────────────
function Celle({ c, kol, tekst, farge }) {
  const t = tekst(c, kol.key)
  if (kol.key === 'status')    return <Pille tekst={t} farge={farge ? STATUS_COLORS[c.status] : null}/>
  if (kol.key === 'prioritet') return <Pille tekst={t} farge={farge ? PRIO_COLORS[c.prioritet] : null}/>
  if (kol.key === 'title')     return <span style={{ fontWeight:600, color:'var(--text)' }}>{t}</span>
  if (kol.key === 'number' || kol.key === 'prosjekt')
    return <span style={{ fontFamily:'var(--mono)', fontWeight:700, color: farge ? 'var(--brand)' : 'var(--text2)' }}>{t}</span>
  if (kol.key === 'linked') {
    const n = c.linkedNotes?.length || 0, o = c.linkedTasks?.length || 0
    if (!n && !o) return <span style={{ color:'var(--text3)', opacity:.5 }}>—</span>
    return <span style={{ fontSize:12 }}>{n ? `${n} notat` : ''}{n && o ? ' · ' : ''}{o ? `${o} oppg.` : ''}</span>
  }
  if (kol.key === 'comments') return <span>{t === '0' ? <span style={{ opacity:.4 }}>—</span> : `💬 ${t}`}</span>
  if (kol.eigen) {
    if (!t) return <span style={{ color:'var(--text3)', opacity:.45 }}>—</span>
    return <>{kol.art === 'dato' ? fmtDateShort(t) : t}</>
  }
  return <>{t}</>
}

function Pille({ tekst, farge }) {
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
    <div className="sk-seg">
      <button type="button" className={val === val1[0] ? 'på' : ''} onClick={() => sett(val1[0])}>{val1[1]}</button>
      <button type="button" className={val === val2[0] ? 'på' : ''} onClick={() => sett(val2[0])}>{val2[1]}</button>
    </div>
  )
}

// ── Kolonnemeny ────────────────────────────────────────────────────
function KolonneMeny({ kol, left, top, sortering, filter, rader, alle, tekst, sorteringsverdi,
                       onSorter, onFilter, onTomFilter, onStandardBreidd, onSkjul, onSlett, onNyKolonne }) {
  const [søk, setSøk] = useState('')
  const merkelappar = kol.art === 'tal' ? ['Lågast først', 'Høgast først']
    : kol.art === 'dato' ? ['Eldst først', 'Nyast først']
    : (kol.key === 'status' || kol.key === 'prioritet') ? ['Høgast først', 'Lågast først']
    : ['A → Å', 'Å → A']

  // Teljing per verdi — bygd på alle saker, slik at ein ser kva som finst
  const teljing = useMemo(() => {
    const m = new Map()
    alle.forEach(c => { const v = tekst(c, kol.key); m.set(v, (m.get(v) || 0) + 1) })
    return m
  }, [alle, tekst, kol.key])
  // Status og prioritet skal liggje i logisk rekkjefølgje, ikkje alfabetisk
  const rangering = kol.key === 'status' ? STATUS_ORDER.map(k => STATUS_LABELS[k])
    : kol.key === 'prioritet' ? PRIO_ORDER.map(k => PRIO_LABELS[k]) : null
  const verdiar = useMemo(() => [...teljing.keys()]
    .sort((a, b) => rangering
      ? rangering.indexOf(a) - rangering.indexOf(b)
      : samanlikn.compare(a, b))
    .filter(v => v.toLowerCase().includes(søk.toLowerCase())), [teljing, søk, rangering])

  const talStat = useMemo(() => {
    if (kol.art !== 'tal' && kol.art !== 'dato') return null
    const tal = rader.map(c => sorteringsverdi(c, kol.key)).filter(n => typeof n === 'number' && isFinite(n))
    if (kol.art === 'dato') {
      if (!tal.length) return [['Antal', '0']]
      return [['Antal', String(rader.length)],
              ['Første', fmtDateShort(new Date(Math.min(...tal)).toISOString())],
              ['Siste',  fmtDateShort(new Date(Math.max(...tal)).toISOString())]]
    }
    const sum = tal.reduce((a, b) => a + b, 0)
    return [['Antal', String(rader.length)], ['Sum', String(Math.round(sum * 100) / 100)],
            ['Snitt', tal.length ? (sum / tal.length).toFixed(1) : '—'],
            ['Lågast', tal.length ? String(Math.min(...tal)) : '—'],
            ['Høgast', tal.length ? String(Math.max(...tal)) : '—']]
  }, [kol.art, kol.key, rader, sorteringsverdi])

  return (
    <div className="sk-meny" style={{ left, top }}>
      <div className="sk-menyhovud">Sorter</div>
      {['asc', 'desc'].map((dir, i) => (
        <button key={dir} type="button" className="sk-val" onClick={() => onSorter(dir)}>
          <span className="hake">{sortering?.key === kol.key && sortering?.dir === dir ? '✓' : ''}</span>
          <span>{merkelappar[i]}</span>
        </button>
      ))}

      {talStat && (<>
        <div className="sk-skilje"/>
        <div className="sk-menyhovud">Nøkkeltal</div>
        <div className="sk-stat">{talStat.map(([k, v]) => (
          <div key={k} className="rad"><span>{k}</span><b>{v}</b></div>
        ))}</div>
      </>)}

      {!talStat && !kol.utanFilter && (<>
        <div className="sk-skilje"/>
        <div className="sk-menyhovud">Filtrer på verdi</div>
        {teljing.size > 7 && (
          <div style={{ padding:4 }}>
            <input className="sk-input" placeholder="Søk i verdiar…" value={søk}
              onChange={e => setSøk(e.target.value)} onClick={e => e.stopPropagation()}/>
          </div>
        )}
        <div className="sk-menyliste">
          {verdiar.map(v => (
            <button key={v} type="button" className="sk-val" onClick={() => onFilter(v)}>
              <span className="hake">{filter.includes(v) ? '✓' : ''}</span>
              <span>{v || '(tom)'}</span>
              <span className="tal">{teljing.get(v)}</span>
            </button>
          ))}
          {verdiar.length === 0 && <div className="sk-menyhovud">Ingen treff</div>}
        </div>
        {filter.length > 0 && (
          <button type="button" className="sk-val" onClick={onTomFilter}>
            <span className="hake">×</span><span>Tøm filteret</span>
          </button>
        )}
      </>)}

      <div className="sk-skilje"/>
      <button type="button" className="sk-val" onClick={onStandardBreidd}>
        <span className="hake"/><span>Standard breidd</span>
      </button>
      <button type="button" className="sk-val" onClick={onSkjul}>
        <span className="hake">−</span><span>Skjul kolonnen</span>
      </button>
      <button type="button" className="sk-val ny" onClick={onNyKolonne}>
        <span className="hake">+</span><span>Ny kolonne…</span>
      </button>
      {kol.eigen && (
        <button type="button" className="sk-val fare" onClick={onSlett}>
          <span className="hake">🗑</span><span>Slett kolonnen</span>
        </button>
      )}
    </div>
  )
}

// ── Skjema for ny kolonne ──────────────────────────────────────────
function NyKolonneSkjema({ left, top, onAvbryt, onLagre }) {
  const [namn, setNamn] = useState('')
  const [art, setArt]   = useState('tekst')
  return (
    <div className="sk-meny" style={{ left, top, width:250 }}>
      <div className="sk-menyhovud">Ny kolonne</div>
      <div style={{ padding:'2px 8px 8px', display:'flex', flexDirection:'column', gap:8 }}>
        <input autoFocus className="sk-input" placeholder="Namn på kolonnen" value={namn}
          onChange={e => setNamn(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onLagre(namn, art) }}/>
        <select className="sk-input" value={art} onChange={e => setArt(e.target.value)}>
          <option value="tekst">Tekst</option>
          <option value="tal">Tal</option>
          <option value="dato">Dato</option>
        </select>
        <div style={{ display:'flex', gap:6 }}>
          <button type="button" className="sk-knapp" style={{ flex:1 }} onClick={onAvbryt}>Avbryt</button>
          <button type="button" className="sk-knapp hovud" style={{ flex:1 }} onClick={() => onLagre(namn, art)}>
            Legg til
          </button>
        </div>
        <div style={{ fontSize:11, color:'var(--text3)', lineHeight:1.45 }}>
          Kolonnen blir lagra på dette prosjektet, og du fyller inn verdiar ved å klikke i cella.
        </div>
      </div>
    </div>
  )
}

// ── Stil ───────────────────────────────────────────────────────────
const CSS = `
.sk-etikett { font-size:10px; letter-spacing:.09em; text-transform:uppercase; color:var(--text3); font-weight:700 }
.sk-seg { display:inline-flex; background:var(--bg3); border:1px solid var(--border); border-radius:7px; padding:2px; gap:2px }
.sk-seg button { border:0; background:transparent; padding:4px 11px; border-radius:5px; font-size:12px;
  font-weight:600; color:var(--text3); font-family:var(--font); transition:background .15s, color .15s }
.sk-seg button:hover { color:var(--text) }
.sk-seg button.på { background:var(--bg2); color:var(--brand); box-shadow:var(--shadow-sm) }
.sk-knapp { border:1.5px solid var(--border); background:var(--bg2); color:var(--text3); border-radius:7px;
  padding:5px 11px; font-size:12px; font-weight:600; font-family:var(--font); transition:all .15s }
.sk-knapp:hover { border-color:var(--brand2); color:var(--brand); background:var(--brandbg) }
.sk-knapp.hovud { background:var(--brand); border-color:var(--brand); color:#fff }
.sk-chip { display:inline-flex; align-items:center; gap:5px; background:var(--brandbg); color:var(--brand);
  border-radius:20px; padding:3px 5px 3px 10px; font-size:11.5px; font-weight:600 }
.sk-chip b { font-weight:700 }
.sk-chip button { border:0; background:transparent; color:inherit; font-size:14px; line-height:1; padding:0 3px; opacity:.6 }
.sk-chip button:hover { opacity:1 }

.sk-tabell th { position:sticky; top:0; z-index:5; background:var(--bg3); padding:0; text-align:left;
  border-bottom:2px solid var(--border); border-right:1px solid var(--border); white-space:nowrap }
.sk-tabell th::after { content:''; position:absolute; left:0; right:0; bottom:-2px; height:2px; background:var(--brand);
  transform:scaleX(0); transform-origin:left; transition:transform .22s cubic-bezier(.4,0,.2,1) }
.sk-tabell th:hover::after, .sk-tabell th.sortert::after { transform:scaleX(1) }
.sk-th { display:flex; align-items:center; gap:5px; padding:0 10px; height:38px; cursor:pointer; user-select:none;
  font-size:12px; font-weight:700; letter-spacing:0; color:var(--text); transition:background .15s }
.sk-th:hover { background:var(--brandbg) }
.sk-namn { overflow:hidden; text-overflow:ellipsis; min-width:0 }
.sk-pil { display:none; font-size:8px; color:var(--brand); flex:0 0 auto }
.sk-tabell th.sortert .sk-pil { display:inline }
.sk-tabell th.filtrert .sk-namn::after { content:''; display:inline-block; width:5px; height:5px; border-radius:50%;
  background:var(--brand); margin-left:6px; vertical-align:middle }
.sk-caret { margin-left:auto; width:20px; height:20px; border:0; background:transparent; border-radius:5px;
  color:var(--text3); font-size:11px; opacity:0; transition:opacity .18s, background .15s, color .15s; flex:0 0 auto }
.sk-tabell th:hover .sk-caret { opacity:1 }
.sk-caret:hover { background:var(--brand); color:#fff; opacity:1 }
.sk-grip { position:absolute; top:0; right:-3px; width:7px; height:100%; cursor:col-resize; z-index:6 }
.sk-grip:hover { background:var(--brand3); opacity:.5 }

.sk-tabell td { border-bottom:1px solid var(--border); border-right:1px solid var(--border);
  font-size:13px; color:var(--text2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
.sk-tabell tbody tr:hover td { background:var(--bg3) }
.sk-tabell td.tal { text-align:right; font-variant-numeric:tabular-nums }
.sk-tabell td.mono { font-family:var(--mono) }
.sk-tabell td.eigen { cursor:text }
.sk-tabell td.eigen:hover { box-shadow:inset 0 0 0 1.5px var(--border2) }

.sk-input { width:100%; padding:5px 8px; border:1.5px solid var(--border); border-radius:6px; font-size:12.5px;
  font-family:var(--font); background:var(--bg2); color:var(--text); outline:none }
.sk-input:focus { border-color:var(--brand2) }

.sk-meny { position:fixed; z-index:300; width:250px; background:var(--bg2); border:1px solid var(--border);
  border-radius:10px; box-shadow:var(--shadow-lg); padding:5px; animation:sk-inn .13s ease-out }
@keyframes sk-inn { from { opacity:0; transform:translateY(-5px) } to { opacity:1; transform:none } }
.sk-menyhovud { padding:7px 10px 5px; font-size:9.5px; letter-spacing:.11em; text-transform:uppercase;
  color:var(--text3); font-weight:800 }
.sk-menyliste { max-height:210px; overflow:auto }
.sk-val { display:flex; align-items:center; gap:8px; width:100%; text-align:left; border:0; background:transparent;
  padding:6px 10px; border-radius:7px; font-size:12.5px; color:var(--text); font-family:var(--font);
  transition:background .12s, color .12s }
.sk-val:hover { background:var(--brandbg); color:var(--brand) }
.sk-val .hake { width:13px; flex:0 0 auto; color:var(--brand); font-size:11px; font-weight:800 }
.sk-val .tal { margin-left:auto; font-family:var(--mono); font-size:10.5px; color:var(--text3) }
.sk-val.ny { color:var(--brand); font-weight:700 }
.sk-val.fare:hover { background:rgba(185,28,28,.10); color:#B91C1C }
.sk-skilje { height:1px; background:var(--border); margin:5px 4px }
.sk-stat { padding:2px 10px 8px; font-size:12px; color:var(--text3) }
.sk-stat .rad { display:flex; justify-content:space-between; gap:14px; padding:1px 0 }
.sk-stat b { font-family:var(--mono); color:var(--text); font-variant-numeric:tabular-nums }
`
