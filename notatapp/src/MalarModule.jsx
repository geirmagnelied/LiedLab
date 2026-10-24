import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase'
import { FELT, lagFletting, STANDARD_VEDLEGG, FOREKOMMER_VEDLEGG_AV, brevBlokkar, brevEmne, brevHelsing, eigedomAdresse } from './malarData'

// ═══════════════════════════════════════════════════════════════════
//  MalarModule — dokumentmalar til prosjekteringa (Word og Excel) som vert fylte ut frå prosjektopplysningane
//  (Prosjekt → kort) + brukarprofil + kontor. Vel mal → sjå/rett flettefelta → last ned ferdig .docx/.xlsx.
//  Manglande felt vert gule [plasshaldarar] i dokumentet. Mal-generatorane ligg i malarWord.js / malarExcel.js.
//  Sjå claude/malar-modul.md.
// ═══════════════════════════════════════════════════════════════════
const PROSJEKT_FELT = ['prosjektnr', 'prosjektnamn', 'tiltakshavar_namn', 'eigedom_adresse', 'eigedom_postnr', 'eigedom_poststad', 'kommune', 'gnr', 'bnr', 'avsendar_firma', 'avsendar_namn', 'dato']
const MALAR = [
  { id: 'foelgebrev', type: 'word', namn: 'Følgebrev – søknad om rammetillatelse', gruppe: 'Brev', farge: '#2B579A',
    skildring: 'Ferdig utkast til følgebrev til kommunen med tiltakshavar, eigedom, tiltak, standard vedleggsliste og underskrift. Rett vedlegga før du lastar ned.',
    felt: ['prosjektnr', 'prosjektnamn', 'tiltakshavar_namn', 'tiltakshavar_orgnr', 'eigedom_adresse', 'eigedom_postnr', 'eigedom_poststad', 'kommune', 'gnr', 'bnr', 'festenr', 'seksjonsnr', 'tiltakstype', 'bygningskategori', 'bra', 'tiltaksbeskrivelse', 'avsendar_firma', 'avsendar_orgnr', 'avsendar_namn', 'avsendar_tittel', 'avsendar_epost', 'avsendar_tlf', 'avsendar_adresse', 'dato'],
    bygg: async (f, o) => (await import('./malarWord')).foelgebrevRammetillatelse(f, o), vedlegg: true },
  { id: 'innkalling', type: 'word', namn: 'Møteinnkalling', gruppe: 'Møter', farge: '#2B579A', skildring: 'Innkalling med møtedata, deltakarliste og standard saksliste.', felt: PROSJEKT_FELT, bygg: async (f, o) => (await import('./malarWord')).moteinnkalling(f, o) },
  { id: 'referat', type: 'word', namn: 'Møtereferat', gruppe: 'Møter', farge: '#2B579A', skildring: 'Referatmal med til-stades-liste og tabell for sak, vedtak, ansvarleg og frist.', felt: PROSJEKT_FELT, bygg: async (f, o) => (await import('./malarWord')).motereferat(f, o) },
  { id: 'notat', type: 'word', namn: 'Prosjekteringsnotat', gruppe: 'Notat og rapport', farge: '#2B579A', skildring: 'Notatmal med forside, prosjektopplysningar og fast oppbygging: føremål, grunnlag, vurderingar, konklusjon.', felt: PROSJEKT_FELT, bygg: async (f, o) => (await import('./malarWord')).prosjekteringsnotat(f, o) },
  { id: 'teikningsliste', type: 'excel', namn: 'Teikningsliste', gruppe: 'Lister', farge: '#217346', skildring: 'Tom teikningsliste med prosjekttopp, filter, nedtrekk for status og format, klar til utskrift.', felt: PROSJEKT_FELT, bygg: async (f, o) => (await import('./malarExcel')).teikningsliste(f, o) },
  { id: 'areal', type: 'excel', namn: 'Arealoppstilling (BRA/BYA)', gruppe: 'Kalkyler', farge: '#217346', skildring: 'Arealoppstilling med summar og samanlikning mot BRA frå prosjektopplysningane.', felt: [...PROSJEKT_FELT, 'bra'], bygg: async (f, o) => (await import('./malarExcel')).arealoppstilling(f, o) },
  { id: 'timekalkyle', type: 'excel', namn: 'Timekalkyle', gruppe: 'Kalkyler', farge: '#217346', skildring: 'Timar × timepris med summar, og differanse mot estimerte timar og tilbodspris frå prosjektet.', felt: [...PROSJEKT_FELT, 'timeestimat', 'tilbodssum'], bygg: async (f, o) => (await import('./malarExcel')).timekalkyle(f, o) },
  { id: 'aksjonsliste', type: 'excel', namn: 'Aksjonsliste', gruppe: 'Lister', farge: '#217346', skildring: 'Oppfølgingsliste med ansvarleg, frist og status (ferdige aksjonar vert gråa ut automatisk).', felt: PROSJEKT_FELT, bygg: async (f, o) => (await import('./malarExcel')).aksjonsliste(f, o) },
]
const BRED = ['tiltaksbeskrivelse']

const SEL = { padding: '6px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 12.5, fontFamily: 'var(--font)', background: 'var(--bg2)', color: 'var(--text2)', outline: 'none' }

export default function MalarModule({ userId, userEmail, projects, activeProjectId, brukar, offices, activeOfficeId }) {
  const [prosjekt, setProsjekt] = useState(null)
  const [filter, setFilter] = useState('alle')
  const [valgt, setValgt] = useState('foelgebrev')
  const [bm, setBm] = useState(brukar?.sprak === 'bm')
  const smal = typeof window !== 'undefined' && window.innerWidth < 768
  const [overstyr, setOverstyr] = useState({})
  const [vedleggVal, setVedleggVal] = useState(null)       // { liste: [...], paa: Set(index) }
  const [eigenVedlegg, setEigenVedlegg] = useState('')
  const [lastar, setLastar] = useState(false)
  const [feil, setFeil] = useState('')

  useEffect(() => {
    setProsjekt(null); setOverstyr({})
    if (!userId || !activeProjectId) return undefined
    let avbrote = false
    supabase.from('projects').select('id,name,project_number,details').eq('id', activeProjectId).eq('user_id', userId).maybeSingle()
      .then(({ data }) => { if (!avbrote && data) setProsjekt({ id: data.id, name: data.name, projectNumber: data.project_number || '', details: data.details || {} }) })
    return () => { avbrote = true }
  }, [userId, activeProjectId])
  useEffect(() => { setOverstyr({}) }, [valgt])

  const kontor = (offices || []).find(o => o.id === activeOfficeId) || null
  const base = useMemo(() => lagFletting(prosjekt || (projects || []).find(p => p.id === activeProjectId) || null, brukar?.profil, kontor, userEmail), [prosjekt, projects, activeProjectId, brukar?.profil, kontor, userEmail])
  const f = { ...base, ...overstyr }
  const mal = MALAR.find(m => m.id === valgt) || MALAR[0]

  // vedleggsliste (berre følgebrev) — nullstillast ved språkbyte
  const standard = STANDARD_VEDLEGG[bm ? 'bm' : 'nn']
  const vv = vedleggVal && vedleggVal.bm === bm ? vedleggVal : { bm, liste: standard, paa: new Set(FOREKOMMER_VEDLEGG_AV) }
  const vedlegg = vv.liste.filter((_, i) => vv.paa.has(i))
  const bytVedlegg = (i) => { const paa = new Set(vv.paa); paa.has(i) ? paa.delete(i) : paa.add(i); setVedleggVal({ ...vv, paa }) }
  const leggTilVedlegg = () => { const t = eigenVedlegg.trim(); if (!t) return; const liste = [...vv.liste, t]; const paa = new Set(vv.paa); paa.add(liste.length - 1); setVedleggVal({ bm, liste, paa }); setEigenVedlegg('') }

  const manglar = mal.felt.filter(k => !String(f[k] || '').trim())
  const lastNed = async () => {
    setLastar(true); setFeil('')
    try {
      const b = await mal.bygg(f, { bm, vedlegg })
      const ending = mal.type === 'word' ? 'docx' : 'xlsx'
      const namn = ((f.prosjektnr ? f.prosjektnr + ' ' : '') + mal.namn.replace(/[\\/:*?"<>|]+/g, '')).trim() + '.' + ending
      const url = URL.createObjectURL(b); const a = document.createElement('a'); a.href = url; a.download = namn
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (e) { console.error(e); setFeil('Klarte ikkje lage dokumentet: ' + (e.message || e)) }
    setLastar(false)
  }

  const synlege = MALAR.filter(m => filter === 'alle' || m.type === filter)
  const grupper = [...new Set(synlege.map(m => m.gruppe))]
  const TAB = (a) => ({ padding: '6px 14px', border: '1.5px solid ' + (a ? '#0A0A0A' : 'transparent'), borderRadius: 8, background: a ? '#0A0A0A' : 'rgba(255,255,255,.5)', color: a ? '#fff' : 'var(--text2)', fontSize: 13, fontWeight: a ? 700 : 500, cursor: 'pointer', fontFamily: 'var(--font)' })
  const feltGrupper = [...new Set(mal.felt.map(k => FELT[k][1]))]

  return (
    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', height: 50, flexShrink: 0, background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
        {[['alle', 'Alle malar'], ['word', 'Word'], ['excel', 'Excel']].map(([k, n]) => <button key={k} onClick={() => setFilter(k)} style={TAB(filter === k)}>{n}</button>)}
        <div style={{ flex: 1 }}/>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>Språk i dokumentet</span>
        <select value={bm ? 'bm' : 'nn'} onChange={e => setBm(e.target.value === 'bm')} style={SEL}><option value="nn">Nynorsk</option><option value="bm">Bokmål</option></select>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: smal ? 'column' : 'row', minHeight: 0, overflowY: smal ? 'auto' : 'visible' }}>
        {/* Malliste */}
        <div style={{ width: smal ? 'auto' : 330, flexShrink: 0, maxHeight: smal ? 260 : 'none', overflowY: 'auto', padding: '18px 16px', borderRight: smal ? 'none' : '1px solid var(--border)', borderBottom: smal ? '1px solid var(--border)' : 'none', background: 'var(--bg)' }}>
          {!activeProjectId && <div style={{ fontSize: 12.5, color: 'var(--text2)', background: 'var(--brandbg)', borderRadius: 10, padding: '10px 12px', marginBottom: 14, lineHeight: 1.5 }}>Vel eit prosjekt øvst i vindauget, så vert malane fylte ut automatisk frå prosjektopplysningane.</div>}
          {grupper.map(g => (
            <div key={g} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.07em', margin: '0 4px 8px' }}>{g}</div>
              {synlege.filter(m => m.gruppe === g).map(m => {
                const aktiv = m.id === valgt
                return (
                  <button key={m.id} onClick={() => setValgt(m.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '11px 12px', marginBottom: 8, borderRadius: 12, cursor: 'pointer', fontFamily: 'var(--font)',
                      border: '1.5px solid ' + (aktiv ? 'var(--brand)' : 'var(--border)'), background: aktiv ? 'var(--brandbg)' : 'var(--bg2)', boxShadow: aktiv ? 'none' : '0 1px 2px rgba(0,0,0,.04)', transition: 'transform .15s, box-shadow .15s' }}
                    onMouseEnter={e => { if (!aktiv) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 5px 14px rgba(0,0,0,.09)' } }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = aktiv ? 'none' : '0 1px 2px rgba(0,0,0,.04)' }}>
                    <span style={{ width: 38, height: 38, borderRadius: 10, background: m.farge, color: '#fff', fontWeight: 800, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{m.type === 'word' ? 'W' : 'X'}</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>{m.namn}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{m.type === 'word' ? 'Word-dokument (.docx)' : 'Excel-arbeidsbok (.xlsx)'}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Detalj */}
        <div style={{ flex: smal ? 'none' : 1, overflowY: smal ? 'visible' : 'auto', padding: smal ? '18px 14px 40px' : '24px 30px 40px', minWidth: 0 }}>
          <div style={{ maxWidth: 940, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
              <span style={{ width: 54, height: 54, borderRadius: 14, background: mal.farge, color: '#fff', fontWeight: 800, fontSize: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{mal.type === 'word' ? 'W' : 'X'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.02em' }}>{mal.namn}</div>
                <div style={{ fontSize: 13.5, color: 'var(--text2)', marginTop: 4, lineHeight: 1.55, maxWidth: 640 }}>{mal.skildring}</div>
              </div>
              <button onClick={lastNed} disabled={lastar} style={{ padding: '11px 22px', border: 'none', borderRadius: 11, background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: lastar ? 'wait' : 'pointer', fontFamily: 'var(--font)', whiteSpace: 'nowrap', opacity: lastar ? .7 : 1, boxShadow: '0 4px 12px rgba(0,0,0,.15)' }}>
                {lastar ? 'Lagar…' : `⬇ Last ned ${mal.type === 'word' ? '.docx' : '.xlsx'}`}
              </button>
            </div>
            {feil && <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(185,28,28,.08)', border: '1.5px solid var(--danger)', borderRadius: 8, fontSize: 13, color: 'var(--danger)' }}>{feil}</div>}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, fontSize: 12.5, color: 'var(--text2)' }}>
              <span style={{ fontWeight: 700, color: manglar.length ? '#9A6A00' : 'var(--brand)' }}>{mal.felt.length - manglar.length} av {mal.felt.length} felt fylte ut frå prosjektopplysningane</span>
              {manglar.length > 0 && <span>— {manglar.length} manglar og vert gule plasshaldarar i dokumentet (eller fyll ut under).</span>}
            </div>

            {/* Flettefelt */}
            <div style={{ display: 'grid', gridTemplateColumns: mal.vedlegg && !smal ? 'minmax(0,1fr) minmax(0,1.15fr)' : 'minmax(0,1fr)', gap: 22, alignItems: 'start' }}>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Flettefelt</div>
                {feltGrupper.map(g => (
                  <div key={g} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', marginBottom: 6 }}>{g}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: mal.vedlegg ? '1fr' : 'repeat(auto-fill, minmax(230px, 1fr))', gap: 8 }}>
                      {mal.felt.filter(k => FELT[k][1] === g).map(k => {
                        const tom = !String(f[k] || '').trim()
                        const stil = { width: '100%', boxSizing: 'border-box', padding: '7px 10px', border: '1.5px solid ' + (tom ? '#E3C766' : 'var(--border)'), borderRadius: 8, fontSize: 13, fontFamily: 'var(--font)', background: tom ? '#FFFBEA' : 'var(--bg)', color: 'var(--text)', outline: 'none' }
                        return (
                          <label key={k} style={{ display: 'block' }}>
                            <span style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>{FELT[k][0]}</span>
                            {BRED.includes(k)
                              ? <textarea rows={3} value={f[k] || ''} onChange={e => setOverstyr(o => ({ ...o, [k]: e.target.value }))} placeholder="Manglar" style={{ ...stil, resize: 'vertical' }}/>
                              : <input value={f[k] || ''} onChange={e => setOverstyr(o => ({ ...o, [k]: e.target.value }))} placeholder="Manglar" style={stil}/>}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {mal.vedlegg && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Vedlegg i brevet</div>
                    {vv.liste.map((t, i) => (
                      <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '4px 0', fontSize: 13, color: 'var(--text)', cursor: 'pointer', lineHeight: 1.4 }}>
                        <input type="checkbox" checked={vv.paa.has(i)} onChange={() => bytVedlegg(i)} style={{ marginTop: 3, accentColor: 'var(--brand)' }}/>{t}
                      </label>
                    ))}
                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                      <input value={eigenVedlegg} onChange={e => setEigenVedlegg(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') leggTilVedlegg() }} placeholder="Legg til eige vedlegg…" style={{ ...SEL, flex: 1 }}/>
                      <button onClick={leggTilVedlegg} style={{ ...SEL, cursor: 'pointer', fontWeight: 700 }}>＋</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Førehandsvising av brevet */}
            {mal.vedlegg && (
              <div style={{ marginTop: 26 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Førehandsvising</div>
                <BrevForhandsvising f={f} bm={bm} vedlegg={vedlegg}/>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Seg({ s }) {
  return <>{(Array.isArray(s) ? s : [s]).filter(x => x !== '' && x != null).map((x, i) => {
    const o = typeof x === 'string' ? { t: x } : x
    return <span key={i} style={{ fontWeight: o.b ? 700 : undefined, background: o.ph ? '#FFF176' : undefined, color: o.ph ? '#7A5B00' : undefined, borderRadius: o.ph ? 3 : undefined, padding: o.ph ? '0 2px' : undefined }}>{o.t}</span>
  })}</>
}

function BrevForhandsvising({ f, bm, vedlegg }) {
  const blokkar = brevBlokkar(f, bm, vedlegg)
  return (
    <div style={{ background: '#fff', color: '#1a1a1a', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 8px 30px rgba(0,0,0,.10)', padding: '38px 48px', fontFamily: 'Calibri, Carlito, Arial, sans-serif', fontSize: 13.5, lineHeight: 1.6, maxWidth: 760 }}>
      <div style={{ borderBottom: '3px solid #1B4332', paddingBottom: 6, marginBottom: 22, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <b style={{ color: '#1B4332', fontSize: 15 }}>{f.avsendar_firma || <Seg s={{ t: '[firma]', ph: true }}/>}</b>
        <span style={{ color: '#6B7280', fontSize: 11.5 }}>{[f.prosjektnr, f.prosjektnamn].filter(Boolean).join(' · ')}</span>
      </div>
      <div style={{ fontSize: 12.5, color: '#444', marginBottom: 18 }}>
        <div><b>Til:</b> {f.kommune ? `${f.kommune} kommune` : <Seg s={{ t: '[kommune]', ph: true }}/>} – Byggesak</div>
        <div><b>Dato:</b> {f.dato}</div>
        <div><b>Vår ref.:</b> {f.prosjektnr || <Seg s={{ t: '[prosjektnr.]', ph: true }}/>}</div>
      </div>
      <div style={{ fontSize: 19, fontWeight: 800, color: '#1B4332', marginBottom: 14, lineHeight: 1.3 }}>{brevEmne(f, bm)}</div>
      {blokkar.map((b, i) => {
        if (b.t === 'meta') return (
          <table key={i} style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 14, fontSize: 12.5 }}><tbody>
            {b.rader.map(([k, v], j) => <tr key={j}><td style={{ background: '#EEF5F1', color: '#1B4332', fontWeight: 700, padding: '5px 10px', border: '1px solid #D5DDD8', width: 130 }}>{k}</td><td style={{ padding: '5px 10px', border: '1px solid #D5DDD8' }}><Seg s={v}/></td></tr>)}
          </tbody></table>)
        if (b.t === 'p') return <p key={i} style={{ margin: '0 0 10px' }}><Seg s={b.seg}/></p>
        if (b.t === 'h') return <div key={i} style={{ fontWeight: 800, color: '#1B4332', margin: '14px 0 6px' }}>{b.tekst}</div>
        return <div key={i} style={{ display: 'flex', gap: 8, margin: '0 0 3px 6px' }}><span style={{ width: 20 }}>{b.nr}.</span><span>{b.tekst}</span></div>
      })}
      <div style={{ marginTop: 18 }}>{brevHelsing(bm)}</div>
      <div style={{ marginTop: 26 }}>
        <div style={{ fontWeight: 700 }}>{f.avsendar_namn || <Seg s={{ t: '[namn]', ph: true }}/>}</div>
        {f.avsendar_tittel && <div style={{ color: '#6B7280' }}>{f.avsendar_tittel}</div>}
        <div style={{ color: '#6B7280' }}>{f.avsendar_firma}{f.avsendar_orgnr ? ` · org.nr. ${f.avsendar_orgnr}` : ''}</div>
        <div style={{ color: '#6B7280' }}>{[f.avsendar_epost, f.avsendar_tlf].filter(Boolean).join('  ·  ')}</div>
      </div>
    </div>
  )
}
