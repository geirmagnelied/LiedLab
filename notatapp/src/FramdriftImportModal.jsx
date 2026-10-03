import { useState, useMemo, useRef } from 'react'
import { format } from 'date-fns'
import { lesFil, gjettKolonnar, byggFraTabell, parseMspXml, IMPORT_FELT } from './framdriftImport'
import { formaterDato } from './framdriftDato'

// ═══════════════════════════════════════════════════════════════════
//  Importvindauge for Framdrift (Excel/CSV og MS Project XML) i steg:
//  1) slepp fil  2) (berre tabellfiler) kople kolonnar  3) førehandsvising
//  og stadfesting. Fungerer i vanleg nettlesar — treng ikkje Electron-brua.
//  Sjølve parsinga ligg i framdriftImport.js.
// ═══════════════════════════════════════════════════════════════════

const TYPE_NAMN = { fase: 'Fase', aktivitet: 'Aktivitet', milepael: 'Milepæl' }
const bokstav = (i) => (i < 26 ? String.fromCharCode(65 + i) : `K${i + 1}`)

export default function FramdriftImportModal({ harPlan, onLukk, onImporter }) {
  const [steg, setSteg] = useState('drop') // 'drop' | 'kolonner' | 'forhandsvising'
  const [dragOver, setDragOver] = useState(false)
  const [feil, setFeil] = useState('')
  const [lastar, setLastar] = useState(false)
  const [filnamn, setFilnamn] = useState('')
  const [ark, setArk] = useState([])
  const [arkIdx, setArkIdx] = useState(0)
  const [harOverskrift, setHarOverskrift] = useState(true)
  const [kol, setKol] = useState({})
  const [resultat, setResultat] = useState(null)
  const [erstatt, setErstatt] = useState(!harPlan)
  const filRef = useRef(null)

  const rader = ark[arkIdx]?.rader || []
  const bredde = Math.max(0, ...rader.slice(0, 50).map(r => r.length))
  const overskrifter = useMemo(
    () => Array.from({ length: bredde }, (_, i) => (harOverskrift && String(rader[0]?.[i] ?? '').trim()) || `Kolonne ${bokstav(i)}`),
    [rader, bredde, harOverskrift])

  const handterFil = async (fil) => {
    if (!fil) return
    setFeil(''); setLastar(true); setFilnamn(fil.name)
    try {
      const les = await lesFil(fil)
      if (les.type === 'msp') {
        setResultat(parseMspXml(les.tekst))
        setSteg('forhandsvising')
      } else {
        setArk(les.ark); setArkIdx(0)
        setKol(gjettKolonnar(les.ark[0].rader[0].map(String)))
        setHarOverskrift(true)
        setSteg('kolonner')
      }
    } catch (e) { setFeil(e.message) }
    setLastar(false)
  }

  const byttArk = (i) => {
    setArkIdx(i)
    setKol(gjettKolonnar(ark[i].rader[0].map(String)))
  }
  const byttOverskrift = (v) => {
    setHarOverskrift(v)
    if (v) setKol(gjettKolonnar((rader[0] || []).map(String)))
  }

  const lagForhandsvising = () => {
    setFeil('')
    if (kol.namn == null || kol.namn < 0) { setFeil('Vel kva kolonne som inneheld aktivitetsnamnet.'); return }
    const r = byggFraTabell(rader, kol, { harOverskrift })
    if (!r.elementer.length) { setFeil('Fann ingen rader med både namn og datoar. Sjekk kolonnekoplinga.'); return }
    setResultat(r)
    setSteg('forhandsvising')
  }

  const tal = (t) => resultat?.elementer.filter(e => e.type === t).length || 0
  const avhTal = resultat?.elementer.reduce((s, e) => s + (e.avh?.length || 0), 0) || 0
  const namnPaId = (id) => resultat.elementer.find(e => e.id === id)?.namn || ''

  const bokseStil = { border: '1.5px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.42)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: 'var(--bg2)', borderRadius: 'var(--r2)', width: steg === 'drop' ? 520 : 'min(94vw, 1000px)',
        maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 70px rgba(0,0,0,.35)' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', background: 'var(--brand)', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Importer framdriftsplan</span>
          {filnamn && <span style={{ fontSize: 12, color: 'rgba(255,255,255,.75)' }}>{filnamn}</span>}
          <div style={{ flex: 1 }}/>
          <button onClick={onLukk} title="Lukk" style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer',
            color: 'rgba(255,255,255,.85)', lineHeight: 1, padding: '2px 6px' }}>×</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>

          {steg === 'drop' && (
            <>
              <div onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handterFil(e.dataTransfer.files?.[0]) }}
                onClick={() => filRef.current?.click()}
                style={{ border: `2px dashed ${dragOver ? 'var(--brand)' : 'var(--border2)'}`, borderRadius: 'var(--r2)',
                  background: dragOver ? 'var(--bg3)' : 'var(--bg2)', padding: '44px 20px', textAlign: 'center', cursor: 'pointer' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                  {lastar ? 'Les fila…' : 'Slepp fil her, eller klikk for å velje'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
                  Excel (.xlsx, .xls), CSV, eller MS Project XML.<br/>
                  I MS Project: Fil → Lagre som → «XML-format».
                </div>
              </div>
              <input ref={filRef} type="file" accept=".xlsx,.xls,.csv,.tsv,.txt,.xml,.mpp" style={{ display: 'none' }}
                onChange={e => { handterFil(e.target.files?.[0]); e.target.value = '' }}/>
              {feil && <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--danger)', lineHeight: 1.5 }}>{feil}</div>}
            </>
          )}

          {steg === 'kolonner' && (
            <>
              <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 12, lineHeight: 1.6 }}>
                Appen har gjetta kva kolonne som er kva. Rett på nedtrekksmenyane om noko er feil — «Aktivitet» må vere med,
                resten er valfritt. Har du berre varigheit (ikkje slutt), reknar appen ut sluttdatoen i arbeidsdagar.
              </div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
                {IMPORT_FELT.map(f => (
                  <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase',
                      color: f.krevd && (kol[f.key] ?? -1) < 0 ? 'var(--danger)' : 'var(--text3)' }}>
                      {f.namn}{f.krevd ? ' *' : ''}
                    </span>
                    <select className="fd-input" value={kol[f.key] ?? -1}
                      onChange={e => setKol(k => ({ ...k, [f.key]: +e.target.value }))}>
                      <option value={-1}>— ikkje med —</option>
                      {overskrifter.map((h, i) => <option key={i} value={i}>{bokstav(i)}: {h}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 12, fontSize: 12.5, color: 'var(--text2)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={harOverskrift} onChange={e => byttOverskrift(e.target.checked)}/>
                  Fyrste rad er overskrift
                </label>
                {ark.length > 1 && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    Ark:
                    <select className="fd-input" style={{ width: 'auto' }} value={arkIdx} onChange={e => byttArk(+e.target.value)}>
                      {ark.map((a, i) => <option key={i} value={i}>{a.namn}</option>)}
                    </select>
                  </label>
                )}
              </div>
              <div style={{ ...bokseStil, overflow: 'auto', maxHeight: 280 }}>
                <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg3)' }}>
                      {overskrifter.map((h, i) => {
                        const felt = IMPORT_FELT.find(f => kol[f.key] === i)
                        return (
                          <th key={i} style={{ textAlign: 'left', padding: '6px 8px', whiteSpace: 'nowrap',
                            borderBottom: '1px solid var(--border)', color: felt ? 'var(--brand)' : 'var(--text3)', fontWeight: 700 }}>
                            {h}{felt && <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.05em' }}>→ {felt.namn}</div>}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {rader.slice(harOverskrift ? 1 : 0, (harOverskrift ? 1 : 0) + 12).map((r, ri) => (
                      <tr key={ri}>
                        {overskrifter.map((_, i) => {
                          const v = r[i]
                          const tekst = v instanceof Date ? format(new Date(v.getTime() + 12 * 3600e3), 'dd.MM.yyyy') : String(v ?? '')
                          return <td key={i} style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                            maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text2)' }}>{tekst}</td>
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {feil && <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--danger)' }}>{feil}</div>}
            </>
          )}

          {steg === 'forhandsvising' && resultat && (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                {[['Fasar', tal('fase')], ['Aktivitetar', tal('aktivitet')], ['Milepælar', tal('milepael')], ['Avhengnader', avhTal]].map(([n, t]) => (
                  <div key={n} style={{ ...bokseStil, padding: '8px 16px', textAlign: 'center', minWidth: 90 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand)' }}>{t}</div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text3)' }}>{n}</div>
                  </div>
                ))}
              </div>
              {resultat.merknader.length > 0 && (
                <ul style={{ margin: '0 0 14px', paddingLeft: 18, fontSize: 12, color: 'var(--text3)', lineHeight: 1.7 }}>
                  {resultat.merknader.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              )}
              <div style={{ ...bokseStil, overflow: 'auto', maxHeight: 300 }}>
                <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg3)' }}>
                      {['Type', 'Namn', 'Start', 'Slutt', 'Ansvarleg', 'Startar etter'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resultat.elementer.slice(0, 60).map(e => (
                      <tr key={e.id}>
                        <td style={{ padding: '4px 8px', color: 'var(--text3)' }}>{TYPE_NAMN[e.type]}</td>
                        <td style={{ padding: '4px 8px', paddingLeft: e.forelder != null ? 24 : 8, fontWeight: e.type === 'fase' ? 800 : 500, color: 'var(--text)' }}>{e.namn}</td>
                        <td style={{ padding: '4px 8px', fontFamily: 'var(--mono)' }}>{formaterDato(e.start)}</td>
                        <td style={{ padding: '4px 8px', fontFamily: 'var(--mono)' }}>{formaterDato(e.slutt)}</td>
                        <td style={{ padding: '4px 8px', color: 'var(--text2)' }}>{e.ansvarleg}</td>
                        <td style={{ padding: '4px 8px', color: 'var(--text3)' }}>{(e.avh || []).map(namnPaId).join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {resultat.elementer.length > 60 && (
                <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 6 }}>…og {resultat.elementer.length - 60} til.</div>
              )}
              {harPlan && (
                <div style={{ display: 'flex', gap: 18, marginTop: 14, fontSize: 12.5, color: 'var(--text2)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="radio" checked={!erstatt} onChange={() => setErstatt(false)}/> Legg til i eksisterande plan
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="radio" checked={erstatt} onChange={() => setErstatt(true)}/> Erstatt eksisterande plan
                  </label>
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ flex: 1 }}/>
          {steg !== 'drop' && (
            <button className="fd-knapp" onClick={() => { setFeil(''); setSteg(steg === 'forhandsvising' && ark.length ? 'kolonner' : 'drop') }}>← Tilbake</button>
          )}
          <button className="fd-knapp" onClick={onLukk}>Avbryt</button>
          {steg === 'kolonner' && <button className="fd-knapp hovud" onClick={lagForhandsvising}>Førehandsvis →</button>}
          {steg === 'forhandsvising' && (
            <button className="fd-knapp hovud" onClick={() => onImporter(resultat.elementer, { erstatt })}>
              Importer {resultat.elementer.length} element
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
