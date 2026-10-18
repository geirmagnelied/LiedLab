import { useState, useEffect, useRef } from 'react'
import { useT } from './sprak'
import { signerteUrlar, lastOppBilete, slettBilete } from './useBrukar'

// ═══════════════════════════════════════════════════════════════════
//  Brukar-modulen (opnar frå namnet øvst til høgre eller knappen nedst i venstrefana). Tre sider:
//    1 Brukarinfo   — namn, adresse, fødselsår, tittel, bilete, ønskt språk (nynorsk/bokmål)
//    2 Kompetanse   — kategoriar som kan ekspanderast, med tabell: årstal (frå–til), utdanning/kurs, institusjon, studiepoeng
//    3 Prosjekterfaring — matrise med prosjekt som kan ekspanderast (skildring og bilete får god plass)
//  Alt vert lagra automatisk i brukar_profil (sjå useBrukar.js). Bygd for å utvidast med fleire sider.
// ═══════════════════════════════════════════════════════════════════

const nyId = () => Date.now() * 1000 + Math.floor(Math.random() * 1000)
const CSS = `
.bk-input { width:100%; padding:7px 9px; border:1.5px solid var(--border); border-radius:6px; font-size:13px; font-family:var(--font); background:var(--bg2); color:var(--text); outline:none; box-sizing:border-box }
.bk-input:focus { border-color:var(--brand2) }
.bk-celle { width:100%; padding:5px 7px; border:1px solid transparent; border-radius:4px; font-size:13px; font-family:var(--font); background:transparent; color:var(--text); outline:none; box-sizing:border-box }
.bk-celle:hover { border-color:var(--border) } .bk-celle:focus { border-color:var(--brand2); background:var(--bg2) }
.bk-knapp { border:1.5px solid var(--border); background:var(--bg2); color:var(--text2); border-radius:7px; padding:6px 12px; font-size:12.5px; font-weight:700; font-family:var(--font); cursor:pointer; white-space:nowrap }
.bk-knapp:hover { border-color:var(--brand2); color:var(--brand); background:var(--brandbg) }
.bk-knapp.hovud { background:var(--brand); border-color:var(--brand); color:#fff }
.bk-etikett { font-size:10.5px; letter-spacing:.09em; text-transform:uppercase; color:var(--text3); font-weight:700; margin-bottom:4px; display:block }
.bk-th { text-align:left; font-size:10.5px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:var(--text3); padding:8px 8px; border-bottom:2px solid var(--border); background:var(--bg3); white-space:nowrap }
.bk-td { padding:3px 4px; border-bottom:1px solid var(--border); vertical-align:top }
`

const Felt = ({ etikett, children, stil }) => <label style={{ display: 'block', ...stil }}><span className="bk-etikett">{etikett}</span>{children}</label>

// ── 1 Brukarinfo ────────────────────────────────────────────────────────
function BrukarInfo({ profil, oppdater, bileteUrl, userId, userEmail, t }) {
  const filRef = useRef(null)
  const [feil, setFeil] = useState('')
  const lastOpp = async (fil) => {
    if (!fil) return
    setFeil('')
    try {
      const sti = await lastOppBilete(userId, 'profil', fil, 700)
      const gamal = profil.bilete_sti
      oppdater({ bilete_sti: sti })
      if (gamal) slettBilete(gamal)
    } catch (e) { setFeil(e.message) }
  }
  const initial = ((profil.namn || userEmail || '?').trim()[0] || '?').toUpperCase()
  return (
    <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', gap: 34, flexWrap: 'wrap', padding: '10px 4px' }}>
      <div style={{ width: 190, flexShrink: 0, textAlign: 'center' }}>
        <div style={{ width: 170, height: 170, borderRadius: '50%', margin: '0 auto 12px', overflow: 'hidden', background: 'var(--brandbg2)', border: '3px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64, fontWeight: 800, color: 'var(--brand)' }}>
          {bileteUrl ? <img src={bileteUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : initial}
        </div>
        <input ref={filRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { lastOpp(e.target.files?.[0]); e.target.value = '' }}/>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="bk-knapp" onClick={() => filRef.current?.click()}>{t('bruker.lastOpp')}</button>
          {profil.bilete_sti && <button className="bk-knapp" onClick={() => { slettBilete(profil.bilete_sti); oppdater({ bilete_sti: '' }) }}>{t('bruker.fjernBilete')}</button>}
        </div>
        {feil && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 8 }}>{feil}</div>}
      </div>

      <div style={{ flex: 1, minWidth: 320, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Felt etikett={t('bruker.namn')}><input className="bk-input" value={profil.namn || ''} onChange={e => oppdater({ namn: e.target.value })} placeholder="Fornamn Etternamn"/></Felt>
        <Felt etikett={t('bruker.tittelFelt')}><input className="bk-input" value={profil.tittel || ''} onChange={e => oppdater({ tittel: e.target.value })} placeholder="T.d. Arkitekt MNAL / Prosjektleiar"/></Felt>
        <Felt etikett={t('bruker.adresse')}><input className="bk-input" value={profil.adresse || ''} onChange={e => oppdater({ adresse: e.target.value })}/></Felt>
        <div style={{ display: 'flex', gap: 12 }}>
          <Felt etikett={t('bruker.postnr')} stil={{ width: 140 }}><input className="bk-input" value={profil.postnr || ''} onChange={e => oppdater({ postnr: e.target.value })} inputMode="numeric"/></Felt>
          <Felt etikett={t('bruker.poststad')} stil={{ flex: 1 }}><input className="bk-input" value={profil.poststad || ''} onChange={e => oppdater({ poststad: e.target.value })}/></Felt>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Felt etikett={t('bruker.fodselsaar')} stil={{ width: 140 }}><input className="bk-input" type="number" min="1900" max="2100" value={profil.fodselsaar || ''} onChange={e => oppdater({ fodselsaar: e.target.value ? +e.target.value : null })}/></Felt>
          <Felt etikett={t('bruker.epost')} stil={{ flex: 1 }}><input className="bk-input" value={userEmail || ''} disabled style={{ background: 'var(--bg3)' }}/></Felt>
        </div>
        <div>
          <span className="bk-etikett">{t('bruker.sprak')}</span>
          <div className="bk-seg" style={{ display: 'inline-flex', gap: 8 }}>
            {[['nn', t('bruker.nynorsk')], ['bm', t('bruker.bokmal')]].map(([k, namn]) => (
              <button key={k} onClick={() => oppdater({ sprak: k })} className="bk-knapp" style={profil.sprak === k ? { background: 'var(--brand)', borderColor: 'var(--brand)', color: '#fff' } : undefined}>{namn}</button>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 6 }}>Valet gjeld heile appen (navigasjon, toppfelt og dei sidene som er omsette).</div>
        </div>
      </div>
    </div>
  )
}

// ── 2 Kompetanse ────────────────────────────────────────────────────────
function Kompetanse({ profil, oppdater, t }) {
  const kat = profil.kompetanse || []
  const [ope, setOpe] = useState(() => new Set(kat.map(k => k.id)))
  const sett = (nyKat) => oppdater({ kompetanse: nyKat })
  // Fyrste gong: standardkategoriar
  useEffect(() => {
    if (!kat.length) {
      const k = [t('komp.utdanning'), t('komp.kurs'), t('komp.sert')].map(namn => ({ id: nyId(), namn, rader: [] }))
      sett(k); setOpe(new Set(k.map(x => x.id)))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const endreKat = (id, patch) => sett(kat.map(k => (k.id === id ? { ...k, ...patch } : k)))
  const endreRad = (kid, rid, patch) => sett(kat.map(k => (k.id === kid ? { ...k, rader: k.rader.map(r => (r.id === rid ? { ...r, ...patch } : r)) } : k)))
  const toggle = (id) => setOpe(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {kat.map(k => {
        const apen = ope.has(k.id)
        const sum = k.rader.reduce((a, r) => a + (+r.poeng || 0), 0)
        return (
          <div key={k.id} style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--r2)', background: 'var(--bg2)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg3)' }}>
              <button onClick={() => toggle(k.id)} title={apen ? t('felles.skjul') : t('felles.ekspander')} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--brand)', width: 20 }}>{apen ? '▾' : '▸'}</button>
              <input className="bk-celle" value={k.namn} onChange={e => endreKat(k.id, { namn: e.target.value })} style={{ fontWeight: 800, fontSize: 14, maxWidth: 360 }}/>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{k.rader.length} rad{k.rader.length === 1 ? '' : 'er'}{sum ? ` · ${sum} ${t('komp.poeng').toLowerCase()}` : ''}</span>
              <div style={{ flex: 1 }}/>
              <button className="bk-knapp" onClick={() => { endreKat(k.id, { rader: [...k.rader, { id: nyId(), fra: '', til: '', namn: '', institusjon: '', poeng: '' }] }); setOpe(s => new Set(s).add(k.id)) }}>＋ {t('komp.nyRad')}</button>
              <button className="bk-knapp" title={t('felles.slett')} onClick={() => { if (!k.rader.length || window.confirm(`Slette kategorien «${k.namn}» med ${k.rader.length} rader?`)) sett(kat.filter(x => x.id !== k.id)) }}>×</button>
            </div>
            {apen && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th className="bk-th" style={{ width: 80 }}>{t('komp.fra')}</th><th className="bk-th" style={{ width: 80 }}>{t('komp.til')}</th>
                  <th className="bk-th">{t('komp.namn')}</th><th className="bk-th" style={{ width: '30%' }}>{t('komp.institusjon')}</th><th className="bk-th" style={{ width: 100 }}>{t('komp.poeng')}</th><th className="bk-th" style={{ width: 34 }}/>
                </tr></thead>
                <tbody>
                  {k.rader.length === 0 && <tr><td colSpan={6} style={{ padding: 16, color: 'var(--text3)', fontSize: 12.5 }}>Ingen rader enno — trykk «＋ {t('komp.nyRad')}».</td></tr>}
                  {k.rader.map(r => (
                    <tr key={r.id}>
                      <td className="bk-td"><input className="bk-celle" value={r.fra} placeholder="ÅÅÅÅ" maxLength={4} onChange={e => endreRad(k.id, r.id, { fra: e.target.value })}/></td>
                      <td className="bk-td"><input className="bk-celle" value={r.til} placeholder="ÅÅÅÅ" maxLength={4} onChange={e => endreRad(k.id, r.id, { til: e.target.value })}/></td>
                      <td className="bk-td"><input className="bk-celle" value={r.namn} onChange={e => endreRad(k.id, r.id, { namn: e.target.value })}/></td>
                      <td className="bk-td"><input className="bk-celle" value={r.institusjon} onChange={e => endreRad(k.id, r.id, { institusjon: e.target.value })}/></td>
                      <td className="bk-td"><input className="bk-celle" type="number" min="0" step="any" value={r.poeng} onChange={e => endreRad(k.id, r.id, { poeng: e.target.value })} style={{ textAlign: 'right' }}/></td>
                      <td className="bk-td"><button onClick={() => endreKat(k.id, { rader: k.rader.filter(x => x.id !== r.id) })} title={t('felles.slett')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 16 }}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      })}
      <div><button className="bk-knapp hovud" onClick={() => { const k = { id: nyId(), namn: t('komp.nyKategori'), rader: [] }; sett([...kat, k]); setOpe(s => new Set(s).add(k.id)) }}>＋ {t('komp.nyKategori')}</button></div>
    </div>
  )
}

// ── 3 Prosjekterfaring ──────────────────────────────────────────────────
const KATEGORIAR = ['Bolig', 'Næringsbygg', 'Offentleg bygg', 'Skule/barnehage', 'Helse/omsorg', 'Industri', 'Kultur/idrett', 'Rehabilitering', 'Reguleringsplan/utvikling', 'Anna']

function Prosjekterfaring({ profil, oppdater, userId, t }) {
  const pr = profil.prosjekterfaring || []
  const [ope, setOpe] = useState(() => new Set())
  const [urlar, setUrlar] = useState({})
  const [feil, setFeil] = useState('')
  const sett = (n) => oppdater({ prosjekterfaring: n })
  const endre = (id, patch) => sett(pr.map(p => (p.id === id ? { ...p, ...patch } : p)))
  const toggle = (id) => setOpe(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  // signerte URL-ar for bileta i opne prosjekt
  useEffect(() => {
    const stiar = pr.filter(p => ope.has(p.id)).flatMap(p => p.bilete || []).filter(s => !urlar[s])
    if (!stiar.length) return
    let avbrote = false
    signerteUrlar(stiar).then(m => { if (!avbrote) setUrlar(u => ({ ...u, ...m })) })
    return () => { avbrote = true }
  }, [ope, pr]) // eslint-disable-line react-hooks/exhaustive-deps

  const leggTilBilete = async (p, filer) => {
    setFeil('')
    try {
      const nye = []
      for (const f of Array.from(filer || [])) nye.push(await lastOppBilete(userId, 'prosjekt', f, 1600))
      if (nye.length) endre(p.id, { bilete: [...(p.bilete || []), ...nye] })
    } catch (e) { setFeil(e.message) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <datalist id="bk-kategoriar">{KATEGORIAR.map(k => <option key={k} value={k}/>)}</datalist>
      {feil && <div style={{ color: 'var(--danger)', fontSize: 12.5 }}>{feil}</div>}
      <div style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--r2)', background: 'var(--bg2)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1250 }}>
          <thead><tr>
            <th className="bk-th" style={{ width: 34 }}/>
            <th className="bk-th" style={{ width: 70 }}>{t('komp.fra')}</th><th className="bk-th" style={{ width: 70 }}>{t('komp.til')}</th>
            <th className="bk-th" style={{ minWidth: 200 }}>{t('erf.namn')}</th><th className="bk-th" style={{ width: 150 }}>{t('erf.kategori')}</th>
            <th className="bk-th" style={{ minWidth: 220 }}>{t('erf.skildring')}</th><th className="bk-th" style={{ width: 110 }}>BRA m²</th>
            <th className="bk-th" style={{ width: 150 }}>{t('erf.rolle')}</th><th className="bk-th" style={{ width: 160 }}>{t('erf.kontakt')}</th><th className="bk-th" style={{ width: 170 }}>{t('erf.kontaktinfo')}</th>
            <th className="bk-th" style={{ width: 70 }}>{t('erf.bilete')}</th><th className="bk-th" style={{ width: 34 }}/>
          </tr></thead>
          <tbody>
            {pr.length === 0 && <tr><td colSpan={12} style={{ padding: 22, color: 'var(--text3)', fontSize: 13 }}>{t('erf.ingen')}</td></tr>}
            {pr.map(p => {
              const apen = ope.has(p.id)
              return [
                <tr key={p.id} style={{ background: apen ? 'var(--brandbg)' : undefined }}>
                  <td className="bk-td"><button onClick={() => toggle(p.id)} title={apen ? t('felles.skjul') : t('felles.ekspander')} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--brand)', padding: '4px 6px' }}>{apen ? '▾' : '▸'}</button></td>
                  <td className="bk-td"><input className="bk-celle" value={p.fra || ''} placeholder="ÅÅÅÅ" maxLength={4} onChange={e => endre(p.id, { fra: e.target.value })}/></td>
                  <td className="bk-td"><input className="bk-celle" value={p.til || ''} placeholder="ÅÅÅÅ" maxLength={4} onChange={e => endre(p.id, { til: e.target.value })}/></td>
                  <td className="bk-td"><input className="bk-celle" value={p.namn || ''} style={{ fontWeight: 700 }} onChange={e => endre(p.id, { namn: e.target.value })}/></td>
                  <td className="bk-td"><input className="bk-celle" list="bk-kategoriar" value={p.kategori || ''} onChange={e => endre(p.id, { kategori: e.target.value })}/></td>
                  <td className="bk-td" style={{ color: 'var(--text2)', fontSize: 12.5, padding: '8px 8px', cursor: 'pointer' }} onClick={() => toggle(p.id)} title="Klikk for å skrive/lese heile skildringa">
                    <div style={{ maxHeight: 40, overflow: 'hidden', lineHeight: 1.45 }}>{p.skildring ? p.skildring.slice(0, 140) + (p.skildring.length > 140 ? '…' : '') : <span style={{ color: 'var(--text3)' }}>Klikk for å skrive…</span>}</div></td>
                  <td className="bk-td"><input className="bk-celle" type="number" min="0" step="any" value={p.bra || ''} style={{ textAlign: 'right' }} onChange={e => endre(p.id, { bra: e.target.value })}/></td>
                  <td className="bk-td"><input className="bk-celle" value={p.rolle || ''} onChange={e => endre(p.id, { rolle: e.target.value })}/></td>
                  <td className="bk-td"><input className="bk-celle" value={p.kontakt || ''} onChange={e => endre(p.id, { kontakt: e.target.value })}/></td>
                  <td className="bk-td"><input className="bk-celle" value={p.kontaktinfo || ''} onChange={e => endre(p.id, { kontaktinfo: e.target.value })}/></td>
                  <td className="bk-td" style={{ padding: '8px 8px', fontSize: 12, color: 'var(--text2)', textAlign: 'center' }}>{(p.bilete || []).length ? '🖼 ' + p.bilete.length : ''}</td>
                  <td className="bk-td"><button onClick={() => { if (window.confirm(`Slette prosjektet «${p.namn || '(utan namn)'}»?`)) { (p.bilete || []).forEach(slettBilete); sett(pr.filter(x => x.id !== p.id)) } }} title={t('felles.slett')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 16 }}>×</button></td>
                </tr>,
                apen && (
                  <tr key={p.id + 'x'} style={{ background: 'var(--brandbg)' }}>
                    <td/>
                    <td colSpan={11} style={{ padding: '6px 10px 18px', borderBottom: '2px solid var(--border)' }}>
                      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
                        <div style={{ flex: '2 1 440px', minWidth: 320 }}>
                          <span className="bk-etikett">{t('erf.skildring')}</span>
                          <textarea className="bk-input" value={p.skildring || ''} onChange={e => endre(p.id, { skildring: e.target.value })}
                            style={{ minHeight: 220, resize: 'vertical', lineHeight: 1.55, fontSize: 13.5 }} placeholder="Beskriv prosjektet: omfang, utfordringar, løysingar, resultat …"/>
                        </div>
                        <div style={{ flex: '1 1 320px', minWidth: 260 }}>
                          <span className="bk-etikett">{t('erf.bilete')}</span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                            {(p.bilete || []).map(s => (
                              <div key={s} style={{ position: 'relative', width: 120, height: 90, borderRadius: 6, overflow: 'hidden', background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                                {urlar[s] && <img src={urlar[s]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>}
                                <button onClick={() => { slettBilete(s); endre(p.id, { bilete: (p.bilete || []).filter(x => x !== s) }) }} title={t('felles.slett')}
                                  style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.6)', color: '#fff', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
                              </div>
                            ))}
                          </div>
                          <label className="bk-knapp" style={{ display: 'inline-block' }}>＋ {t('erf.leggTilBilete')}
                            <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { leggTilBilete(p, e.target.files); e.target.value = '' }}/></label>
                        </div>
                      </div>
                    </td>
                  </tr>
                ),
              ]
            })}
          </tbody>
        </table>
      </div>
      <div><button className="bk-knapp hovud" onClick={() => { const p = { id: nyId(), fra: '', til: '', namn: '', kategori: '', skildring: '', bra: '', rolle: '', kontakt: '', kontaktinfo: '', bilete: [] }; sett([p, ...pr]); setOpe(s => new Set(s).add(p.id)) }}>＋ {t('erf.nytt')}</button></div>
    </div>
  )
}

// ── Modul ───────────────────────────────────────────────────────────────
export default function BrukarModule({ userId, userEmail, brukar }) {
  const { t } = useT()
  const [side, setSide] = useState(() => { try { return localStorage.getItem('liedlab-bruker-side') || 'info' } catch { return 'info' } })
  const byt = (s) => { setSide(s); try { localStorage.setItem('liedlab-bruker-side', s) } catch { /* privat modus */ } }
  const { profil, oppdater, bileteUrl, status, lastar } = brukar
  const statusTekst = status === 'lagrar' ? t('bruker.lagrar') : status === 'lagra' ? t('bruker.lagra') : status === 'feil' ? t('bruker.feil') + ' — sjekk at migrasjonen er køyrd' : ''
  const SIDER = [['info', t('bruker.info')], ['kompetanse', t('bruker.kompetanse')], ['erfaring', t('bruker.prosjekterfaring')]]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0, background: 'var(--bg)' }}>
      <style>{CSS}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '0 20px', height: 50, flexShrink: 0, background: 'var(--brand)' }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>{t('bruker.tittel')}</span>
        <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
          {SIDER.map(([k, namn]) => (
            <button key={k} onClick={() => byt(k)} style={{ border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)',
              background: side === k ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.14)', color: side === k ? 'var(--brand)' : '#fff' }}>{namn}</button>
          ))}
        </div>
        <div style={{ flex: 1 }}/>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: status === 'feil' ? '#FCA5A5' : 'rgba(255,255,255,.8)' }}>{statusTekst}</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '22px 26px 40px' }}>
        {lastar ? <div style={{ color: 'var(--text3)' }}>…</div>
          : side === 'info' ? <BrukarInfo profil={profil} oppdater={oppdater} bileteUrl={bileteUrl} userId={userId} userEmail={userEmail} t={t}/>
          : side === 'kompetanse' ? <Kompetanse profil={profil} oppdater={oppdater} t={t}/>
          : <Prosjekterfaring profil={profil} oppdater={oppdater} userId={userId} t={t}/>}
      </div>
    </div>
  )
}
