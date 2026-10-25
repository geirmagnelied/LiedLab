import { useState, useRef, useMemo } from 'react'
import { supabase } from './supabase'
import { parseForbruk, kopleForbruk } from './framdriftForbruk'

// ═══════════════════════════════════════════════════════════════════
//  Importer forbruk (påløpte timar) frå timeføringsrapporten (Excel: Dato, Periode, Ansatt, Aktivitet, Timer,
//  Beskrivelse). Rapporten sin periode (t.d. 01.09.–30.09.) vert ERSTATTA i prosjektet, så ein kan importere ei
//  oppdatert rapport utan å få timane dobbelt. Aktivitetar vert kopla på aktivitetsNUMMERET som står først i namnet («611 ARK …») eller i feltet Aktivitetskode —
//  namnet elles vert ikkje brukt, så det kan endrast fritt; timar utan kopling vert lista her og lagra, og kjem med så snart ein aktivitet får rett kode.
//  Same format vert lese av den ukentlege automatiske importen (scripts/importer-forbruk.mjs).
// ═══════════════════════════════════════════════════════════════════

const fmt = (n) => Math.round(n * 100) / 100

export default function FramdriftForbrukModal({ userId, prosjekt, elementer, onLukk, onFerdig }) {
  const filRef = useRef(null)
  const [res, setRes] = useState(null)
  const [filnamn, setFilnamn] = useState('')
  const [feil, setFeil] = useState('')
  const [lagrar, setLagrar] = useState(false)
  const [opprettNye, setOpprettNye] = useState(true)   // hovudregel: opprett aktivitetar som manglar i planen (brukaren vert spurd)

  const les = async (fil) => {
    setFeil(''); setRes(null)
    if (!fil) return
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await fil.arrayBuffer(), { cellDates: true })
      const ark = wb.Sheets[wb.SheetNames[0]]
      const r = parseForbruk(XLSX.utils.sheet_to_json(ark, { header: 1, defval: '', raw: true }))
      if (!r.rader.length) { setFeil(r.feil[0] || 'Fann ingen timeføringar i fila.'); return }
      setFilnamn(fil.name); setRes(r)
    } catch (e) { setFeil('Klarte ikkje lese fila: ' + e.message) }
  }

  const kopl = useMemo(() => (res ? kopleForbruk(elementer, res.rader) : null), [res, elementer])
  const sum = res ? res.rader.reduce((a, r) => a + r.timar, 0) : 0
  const nrFeil = res && prosjekt?.projectNumber && res.prosjektNr && String(prosjekt.projectNumber).trim() !== String(res.prosjektNr).trim()
  // Aktivitetar i rapporten som ikkje finst i planen (på nummeret) — kan opprettast automatisk: kode = nummeret, namn = resten av teksten
  const nyeAkt = useMemo(() => {
    if (!res || !kopl) return []
    const utanKopling = new Set([...kopl.utan.keys()])
    const per = new Map()
    for (const r of res.rader) {
      if (!utanKopling.has(r.aktivitet) || !r.kode) continue
      const k = r.kode.toLowerCase()
      const x = per.get(k) || { kode: r.kode, namn: r.aktNamn || '', fra: r.dato, til: r.dato, timar: 0 }
      if (r.dato < x.fra) x.fra = r.dato
      if (r.dato > x.til) x.til = r.dato
      if (!x.namn && r.aktNamn) x.namn = r.aktNamn
      x.timar += r.timar
      per.set(k, x)
    }
    return [...per.values()].sort((a, c) => String(a.kode).localeCompare(String(c.kode), 'nb', { numeric: true }))
  }, [res, kopl])
  const koplaTimar = kopl ? [...kopl.perAkt.values()].flat().reduce((a, r) => a + r.timar, 0) : 0

  const importer = async () => {
    setLagrar(true); setFeil('')
    try {
      const { error: e1 } = await supabase.from('framdrift_forbruk').delete().eq('user_id', userId).eq('project_id', prosjekt.id).gte('dato', res.fra).lte('dato', res.til)
      if (e1) throw e1
      const rader = res.rader.map(r => ({ user_id: userId, project_id: prosjekt.id, dato: r.dato, vekeaar: r.vekeaar, vekenr: r.vekenr, ansatt: r.ansatt, ansatt_namn: r.ansattNamn,
        aktivitet: r.aktivitet, kode: r.kode, timar: r.timar, beskrivelse: r.beskrivelse, kilde: filnamn || 'app' }))
      for (let i = 0; i < rader.length; i += 200) {
        const { error } = await supabase.from('framdrift_forbruk').insert(rader.slice(i, i + 200))
        if (error) throw error
      }
      onFerdig?.({ nyeAktivitetar: opprettNye ? nyeAkt : [] })
    } catch (e) { setFeil('Klarte ikkje importere: ' + e.message + (/relation|does not exist/.test(e.message) ? ' (er migrasjonen for framdrift_forbruk køyrd?)' : '')); setLagrar(false) }
  }

  const th = { textAlign: 'left', fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text3)', padding: '6px 8px', borderBottom: '1px solid var(--border)' }
  const td = { padding: '5px 8px', fontSize: 12.5, borderBottom: '1px solid var(--border)' }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: 'var(--bg2)', borderRadius: 'var(--r2)', width: 'min(94vw, 760px)', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 70px rgba(0,0,0,.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', background: '#1565C0' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Importer forbruk (påløpte timar)</span>
          <div style={{ flex: 1 }}/>
          <button onClick={onLukk} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'rgba(255,255,255,.9)', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.6 }}>
            Vel timeføringsrapporten (Excel, t.d. «52607575_september_spesifisert.xlsx»). Perioden i rapporten vert <b>erstatta</b> i prosjektet, så same rapport kan importerast fleire gonger.
          </div>
          <div>
            <input ref={filRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => les(e.target.files?.[0])}/>
            <button className="fd-knapp hovud" onClick={() => filRef.current?.click()}>{filnamn ? 'Vel ei anna fil…' : 'Vel fil…'}</button>
            {filnamn && <span style={{ marginLeft: 10, fontSize: 12.5, color: 'var(--text2)' }}>{filnamn}</span>}
          </div>
          {feil && <div style={{ color: 'var(--danger)', fontSize: 12.5 }}>{feil}</div>}
          {res && kopl && (
            <>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--text2)' }}>
                <span><b>{res.oppdrag || '(oppdrag ikkje oppgjeve)'}</b></span>
                <span>Periode <b>{res.fra} – {res.til}</b></span>
                <span><b>{res.rader.length}</b> føringar · <b>{fmt(sum)} t</b></span>
              </div>
              {nrFeil && <div style={{ background: 'var(--dangerbg, #fdecea)', color: 'var(--danger)', padding: '8px 12px', borderRadius: 8, fontSize: 12.5 }}>
                Rapporten gjeld oppdrag <b>{res.prosjektNr}</b>, men valt prosjekt har nummer <b>{prosjekt.projectNumber}</b>. Sjekk at du har valt rett prosjekt før du importerer.</div>}
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead><tr><th style={th}>Aktivitet i rapporten</th><th style={th}>Kopla til i planen</th><th style={{ ...th, textAlign: 'right' }}>Timar</th></tr></thead>
                <tbody>
                  {[...new Set(res.rader.map(r => r.aktivitet))].map(a => {
                    const rader = res.rader.filter(r => r.aktivitet === a)
                    const t = rader.reduce((x, r) => x + r.timar, 0)
                    const id = [...kopl.perAkt.entries()].find(([, rr]) => rr.some(r => r.aktivitet === a))?.[0]
                    const e = id != null ? elementer.find(x => x.id === id) : null
                    return (
                      <tr key={a}>
                        <td style={td}>{a || '(utan aktivitet)'}</td>
                        <td style={{ ...td, color: e ? 'var(--text)' : 'var(--danger)', fontWeight: e ? 600 : 700 }}>{e ? '✓ ' + e.namn : 'Ikkje kopla — legg nummeret ' + (rader[0].kode || '') + ' foran aktivitetsnamnet (t.d. «' + (rader[0].kode || '') + ' …»)'}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmt(t)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {nyeAkt.length > 0 && (
                <div style={{ background: 'var(--brandbg)', border: '1.5px solid var(--brand3)', borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{nyeAkt.length} aktivitet{nyeAkt.length === 1 ? '' : 'ar'} finst ikkje i planen</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.55, marginBottom: 6 }}>
                    Teikna før fyrste mellomrom i kolonna «Aktivitet» er aktivitetsnummeret, resten er namnet:{' '}
                    {nyeAkt.slice(0, 5).map(a => <span key={a.kode} style={{ display: 'inline-block', margin: '0 6px 2px 0', padding: '1px 8px', borderRadius: 10, background: 'var(--bg2)', fontWeight: 600 }}><b style={{ fontFamily: 'var(--mono)' }}>{a.kode}</b> {a.namn}</span>)}
                    {nyeAkt.length > 5 && <span>… og {nyeAkt.length - 5} til</span>}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--text)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={opprettNye} onChange={e => setOpprettNye(e.target.checked)} style={{ width: 16, height: 16 }}/>
                    Opprett {nyeAkt.length === 1 ? 'denne aktiviteten' : 'desse aktivitetane'} i planen (anbefalt)
                  </label>
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                {fmt(koplaTimar)} t av {fmt(sum)} t vert kopla til aktivitetar. Timar utan kopling vert likevel lagra, og kjem med så snart ein aktivitet får rett nummer foran namnet (eller i kolonnen «Aktivitetskode»).
              </div>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
          <div style={{ flex: 1 }}/>
          <button className="fd-knapp" onClick={onLukk}>Avbryt</button>
          <button className="fd-knapp hovud" onClick={importer} disabled={!res || lagrar}>{lagrar ? 'Importerer…' : res ? `Importer ${res.rader.length} føringar` : 'Importer'}</button>
        </div>
      </div>
    </div>
  )
}
