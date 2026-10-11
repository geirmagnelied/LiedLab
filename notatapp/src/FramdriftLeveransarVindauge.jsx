import { useMemo, useState } from 'react'
import useFlyttbartVindauge, { handtakStil } from './useFlyttbartVindauge'
import { leveransarFerdig } from './framdriftFerdig'

// ═══════════════════════════════════════════════════════════════════
//  «Kople leveransar til aktivitet» — flytande vindauge (flyttbart/skalerbart).
//  Venstre: alle dokument/teikningar frå DTM i prosjektet. Høgre: dei som er
//  kopla til aktiviteten. Dra eit dokument over til høgre (eller klikk ＋ /
//  marker fleire), og trykk × for å fjerne. Framdrifta til aktiviteten kan
//  reknast ut frå «Ferdigstillelse» i DTM (auto), eller overstyrast med eit
//  skjønnsmessig tal. Endringar vert lagra med ein gong (ingen OK-knapp).
// ═══════════════════════════════════════════════════════════════════

const Linje = ({ p, farge = 'var(--brand)' }) => (
  <div style={{ height: 6, borderRadius: 3, background: 'var(--bg3)', overflow: 'hidden', width: 70, flexShrink: 0 }}>
    <div style={{ width: `${Math.max(0, Math.min(100, p))}%`, height: '100%', background: farge }}/>
  </div>
)

export default function FramdriftLeveransarVindauge({ el, dokument, elementer, onLeveransar, onModus, onFerdig, onLukk }) {
  const { v, startFlytt, startEndring, retningar } = useFlyttbartVindauge('liedlab-framdrift-leveransar-vindauge', { breidd: 980, hogd: 640, minW: 700, minH: 420 })
  const [sok, setSok] = useState('')
  const [filter, setFilter] = useState('ledige') // 'ledige' | 'alle' | 'leveranseplan'
  const [valde, setValde] = useState(() => new Set())
  const [dragOver, setDragOver] = useState(false)

  const dokMap = useMemo(() => new Map(dokument.map(d => [d.id, d])), [dokument])
  const kopla = new Set(el.leveransar || [])
  // dokument-id → aktivitet(ar) det alt er kopla til (elles enn denne)
  const andreKopling = useMemo(() => {
    const m = new Map()
    for (const e of elementer) if (e.id !== el.id) for (const id of e.leveransar || []) m.set(id, [...(m.get(id) || []), e.namn])
    return m
  }, [elementer, el.id])

  const treff = useMemo(() => {
    const q = sok.trim().toLowerCase()
    return dokument.filter(d => {
      if (kopla.has(d.id)) return false
      if (filter === 'ledige' && andreKopling.has(d.id)) return false
      if (filter === 'leveranseplan' && !d.i_leveranseplan) return false
      return !q || `${d.nr} ${d.tittel || ''} ${d.fag || ''} ${d.delprosjekt || ''}`.toLowerCase().includes(q)
    }).sort((a, b) => String(a.nr).localeCompare(String(b.nr), 'nb', { numeric: true }))
  }, [dokument, sok, filter, kopla, andreKopling]) // eslint-disable-line react-hooks/exhaustive-deps

  const koplaListe = (el.leveransar || []).map(id => dokMap.get(id) || { id, nr: `(slett/manglar) #${id}`, manglar: true })
  const res = leveransarFerdig(el, dokMap)
  const modus = el.ferdigModus === 'skjonn' ? 'skjonn' : 'auto'

  const leggTil = (ids) => { if (ids.length) onLeveransar([...(el.leveransar || []), ...ids.filter(id => !kopla.has(id))]) }
  const fjern = (id) => onLeveransar((el.leveransar || []).filter(x => x !== id))
  const toggleValgt = (id) => setValde(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const radStil = { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: '1px solid var(--border)', fontSize: 12.5 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 200 }}>
      <div style={{ position: 'fixed', left: v.x, top: v.y, width: v.w, height: v.h, background: 'var(--bg2)', borderRadius: 'var(--r2)',
        display: 'flex', flexDirection: 'column', boxShadow: '0 24px 70px rgba(0,0,0,.35)' }}>
        {retningar.map(d => <div key={d} onMouseDown={e => startEndring(d, e)} style={handtakStil(d)}/>)}

        <div onMouseDown={startFlytt} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', flexShrink: 0,
          background: '#0F766E', cursor: 'move', borderRadius: 'var(--r2) var(--r2) 0 0' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Kople leveransar</span>
          <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>— {el.namn}</span>
          <div style={{ flex: 1 }}/>
          <button onClick={onLukk} title="Lukk" style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'rgba(255,255,255,.9)', lineHeight: 1 }}>×</button>
        </div>

        {/* Framdrift-samandrag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '10px 18px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', flexShrink: 0 }}>
          <div className="fd-seg">
            <button className={modus === 'auto' ? 'pa' : ''} onClick={() => onModus('auto')} title="Framdrifta vert rekna ut frå ferdigstillelse på dei kopla dokumenta i DTM">Automatisk frå leveransar</button>
            <button className={modus === 'skjonn' ? 'pa' : ''} onClick={() => onModus('skjonn')} title="Set framdrifta sjølv (skjønn) — overstyrer utrekninga">Skjønn</button>
          </div>
          {modus === 'auto' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text)' }}>
              <span style={{ fontSize: 22, fontWeight: 800 }}>{res.prosent ?? '–'}{res.prosent != null ? ' %' : ''}</span>
              <Linje p={res.prosent || 0}/>
              <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                {res.prosent == null ? 'Kople minst eitt dokument for å rekne ut framdrifta.'
                  : res.vekta ? 'Snitt vekta med timebudsjett' : 'Enkelt snitt av ferdigstillelse'}
                {res.manglar > 0 ? ` · ${res.manglar} kopla dokument finst ikkje lenger` : ''}
              </span>
            </div>
          ) : (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
              <b style={{ fontSize: 22, minWidth: 60 }}>{el.ferdig || 0} %</b>
              <input type="range" min="0" max="100" step="5" value={el.ferdig || 0} onChange={e => onFerdig(+e.target.value)} style={{ width: 200 }}/>
              {res.prosent != null && <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>Frå leveransar ville vore {res.prosent} %</span>}
            </label>
          )}
        </div>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Venstre: tilgjengelege dokument */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, borderRight: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 8, padding: '10px 12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input className="fd-input" style={{ flex: 1, minWidth: 140 }} placeholder="Søk nr, tittel, fag…" value={sok} onChange={e => setSok(e.target.value)}/>
              <div className="fd-seg">
                {[['ledige', 'Ledige'], ['leveranseplan', 'Leveranseplan'], ['alle', 'Alle']].map(([k, t]) => (
                  <button key={k} className={filter === k ? 'pa' : ''} onClick={() => setFilter(k)}>{t}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px 6px', fontSize: 11.5, color: 'var(--text3)' }}>
              <span>{treff.length} dokument</span>
              <div style={{ flex: 1 }}/>
              <button className="fd-knapp" style={{ padding: '3px 9px', fontSize: 11.5 }} disabled={!treff.length}
                onClick={() => setValde(valde.size === treff.length ? new Set() : new Set(treff.map(d => d.id)))}>
                {valde.size === treff.length && treff.length ? 'Fjern val' : 'Vel alle viste'}
              </button>
              <button className="fd-knapp hovud" style={{ padding: '3px 9px', fontSize: 11.5 }} disabled={!valde.size}
                onClick={() => { leggTil([...valde]); setValde(new Set()) }}>Kople valde ({valde.size}) ›</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', borderTop: '1px solid var(--border)' }}>
              {dokument.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>Ingen dokument i DTM for dette prosjektet enno.</div>}
              {treff.map(d => (
                <div key={d.id} draggable onDragStart={e => { e.dataTransfer.setData('text/plain', String(d.id)); e.dataTransfer.effectAllowed = 'copy' }}
                  style={{ ...radStil, cursor: 'grab', background: valde.has(d.id) ? 'var(--brandbg)' : 'transparent' }}
                  onDoubleClick={() => leggTil([d.id])}>
                  <input type="checkbox" checked={valde.has(d.id)} onChange={() => toggleValgt(d.id)}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.nr}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {d.tittel || ''}{andreKopling.has(d.id) ? ` · alt kopla til: ${andreKopling.get(d.id).join(', ')}` : ''}
                    </div>
                  </div>
                  <Linje p={d.ferdigstillelse || 0}/>
                  <span style={{ width: 34, textAlign: 'right', fontSize: 11.5, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{d.ferdigstillelse || 0}%</span>
                  <button className="fd-knapp" style={{ padding: '2px 8px' }} title="Kople til aktiviteten" onClick={() => leggTil([d.id])}>＋</button>
                </div>
              ))}
              {dokument.length > 0 && treff.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>Ingen treff.</div>}
            </div>
          </div>

          {/* Høgre: kopla til aktiviteten (slippsone) */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: dragOver ? 'var(--brandbg)' : 'transparent', transition: 'background .12s' }}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const id = +e.dataTransfer.getData('text/plain'); if (id) leggTil([id]) }}>
            <div style={{ padding: '14px 14px 8px', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>
              Kopla til aktiviteten ({koplaListe.length})
            </div>
            <div style={{ flex: 1, overflow: 'auto', borderTop: '1px solid var(--border)' }}>
              {koplaListe.length === 0 && (
                <div style={{ margin: 16, padding: 24, border: '2px dashed var(--border)', borderRadius: 'var(--r2)', textAlign: 'center', color: 'var(--text3)', fontSize: 12.5, lineHeight: 1.6 }}>
                  Dra dokument hit frå lista til venstre,<br/>eller dobbeltklikk / trykk ＋.
                </div>
              )}
              {koplaListe.map(d => (
                <div key={d.id} style={radStil}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: d.manglar ? 'var(--danger)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.nr}</div>
                    {d.tittel && <div style={{ fontSize: 11.5, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.tittel}</div>}
                  </div>
                  {!d.manglar && <><Linje p={d.ferdigstillelse || 0}/>
                    <span style={{ width: 34, textAlign: 'right', fontSize: 11.5, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{d.ferdigstillelse || 0}%</span></>}
                  <button onClick={() => fjern(d.id)} title="Fjern kopling" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 17, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>Ferdigstillelse per dokument vert sett i DTM-tabellen. Endringar her vert lagra automatisk.</span>
          <div style={{ flex: 1 }}/>
          <button className="fd-knapp hovud" onClick={onLukk}>Ferdig</button>
        </div>
      </div>
    </div>
  )
}
