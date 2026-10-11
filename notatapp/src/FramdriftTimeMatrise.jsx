import { useMemo, useState } from 'react'
import { addDays, getISOWeek, format } from 'date-fns'
import { fordelTimar, personDelar, timarPerVeke } from './framdriftTimar'
import { vekeStart } from './kontorkalender'
import { tilDato } from './framdriftDato'
import { PERSONFARGAR } from './FramdriftPersonarPanel'

// ═══════════════════════════════════════════════════════════════════
//  Timefordeling per veke i tabellvisinga: éin rad per aktivitet (ekspander med
//  ▸ for å sjå kva kvar person har kvar veke), pluss ein totalrad med sum per
//  person. Heile seksjonen kan foldast ut/inn. Data frå framdriftTimar.js
//  (fordelTimar × personDelar), så tala stemmer med «Timar per veke» i tidslinja.
// ═══════════════════════════════════════════════════════════════════

const KOL_B = 46
const NAMN_B = 230
const SUM_B = 64
const fmt = (n) => (n ? String(Math.round(n * 10) / 10).replace('.', ',') : '')

export default function FramdriftTimeMatrise({ elementer, kal }) {
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('liedlab-framdrift-matrise-open') === '1' } catch { return false } })
  const [utvida, setUtvida] = useState(() => new Set())
  const veksle = () => setOpen(o => { try { localStorage.setItem('liedlab-framdrift-matrise-open', o ? '0' : '1') } catch { /* privat modus */ } return !o })

  const data = useMemo(() => {
    const akt = elementer.filter(e => e.type === 'aktivitet' && +e.timar > 0)
    const rader = akt.map(e => {
      const veker = new Map(fordelTimar(e, kal).map(v => [v.veke, v.timar]))
      return { e, veker, personar: personDelar(e), fase: elementer.find(f => f.id === e.forelder)?.namn || '' }
    })
    const alleVeker = new Set(rader.flatMap(r => [...r.veker.keys()]))
    let veker = []
    if (alleVeker.size) {
      const sortert = [...alleVeker].sort()
      for (let m = vekeStart(tilDato(sortert[0])); m <= tilDato(sortert[sortert.length - 1]); m = addDays(m, 7)) veker.push(format(m, 'yyyy-MM-dd'))
    }
    const totalt = timarPerVeke(elementer, kal)
    const personNamn = [...new Set(rader.flatMap(r => r.personar.map(p => p.namn)))]
    return { rader, veker, totalt, personNamn }
  }, [elementer, kal])

  const toggleRad = (id) => setUtvida(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const alleUtvida = data.rader.length > 0 && data.rader.every(r => utvida.has(r.e.id))
  const sumTotal = data.rader.reduce((a, r) => a + [...r.veker.values()].reduce((x, y) => x + y, 0), 0)
  const maks = Math.max(1, ...data.rader.flatMap(r => [...r.veker.values()]))

  const celleStil = (v, ramme) => ({ width: KOL_B, minWidth: KOL_B, height: 24, textAlign: 'center', fontSize: 11, fontFamily: 'var(--mono)', lineHeight: '24px',
    borderRight: '1px solid var(--border)', background: v ? `rgba(15,118,110,${0.10 + 0.45 * Math.min(1, v / maks)})` : 'transparent',
    color: 'var(--text)', ...(ramme || {}) })
  const rad = { display: 'flex', borderBottom: '1px solid var(--border)', minWidth: 'max-content' }
  const venstre = (bg) => ({ position: 'sticky', left: 0, zIndex: 2, width: NAMN_B, minWidth: NAMN_B, background: bg, borderRight: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontSize: 12.5 })
  const sumKol = (bg) => ({ position: 'sticky', left: NAMN_B, zIndex: 2, width: SUM_B, minWidth: SUM_B, background: bg, borderRight: '2px solid var(--border)',
    textAlign: 'center', fontSize: 11.5, fontWeight: 700, lineHeight: '24px', fontFamily: 'var(--mono)' })

  return (
    <div style={{ marginTop: 12, border: '1.5px solid var(--border)', borderRadius: 'var(--r2)', background: 'var(--bg2)', overflow: 'hidden', flexShrink: 0 }}>
      <div onClick={veksle} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer', background: 'var(--bg3)' }}>
        <span style={{ fontSize: 13, color: 'var(--text3)', width: 12 }}>{open ? '▾' : '▸'}</span>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text2)' }}>Personar og timefordeling per veke</span>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>
          {data.rader.length ? `${data.rader.length} aktivitetar · ${Math.round(sumTotal * 2) / 2} t · ${data.personNamn.length} person${data.personNamn.length === 1 ? '' : 'ar'}` : 'ingen timar lagt inn enno'}
        </span>
        <div style={{ flex: 1 }}/>
        {open && data.rader.length > 0 && (
          <button className="fd-knapp" style={{ padding: '3px 10px', fontSize: 11.5 }}
            onClick={e => { e.stopPropagation(); setUtvida(alleUtvida ? new Set() : new Set(data.rader.map(r => r.e.id))) }}>
            {alleUtvida ? 'Fold saman alle' : 'Utvid alle'}
          </button>
        )}
      </div>

      {open && (data.rader.length === 0 ? (
        <div style={{ padding: 18, fontSize: 12.5, color: 'var(--text3)' }}>Legg inn «Forventa timar totalt» på aktivitetane (eigenskapspanelet) for å sjå timefordelinga her.</div>
      ) : (
        <div style={{ overflow: 'auto', maxHeight: 360 }}>
          {/* overskrift */}
          <div style={{ ...rad, position: 'sticky', top: 0, zIndex: 4, background: 'var(--bg3)' }}>
            <div style={{ ...venstre('var(--bg3)'), fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', height: 38 }}>Aktivitet / person</div>
            <div style={{ ...sumKol('var(--bg3)'), lineHeight: '38px', fontSize: 11, color: 'var(--text3)' }}>Sum t</div>
            {data.veker.map(v => (
              <div key={v} style={{ width: KOL_B, minWidth: KOL_B, height: 38, textAlign: 'center', borderRight: '1px solid var(--border)', fontSize: 10, color: 'var(--text3)', lineHeight: '14px', paddingTop: 5 }}
                title={'Veke ' + getISOWeek(tilDato(v)) + ' (frå ' + format(tilDato(v), 'dd.MM.yyyy') + ')'}>
                <div style={{ fontWeight: 800, color: 'var(--text2)' }}>{getISOWeek(tilDato(v))}</div>
                <div>{format(tilDato(v), 'dd.MM')}</div>
              </div>
            ))}
          </div>

          {data.rader.map(r => {
            const ope = utvida.has(r.e.id)
            const sumA = [...r.veker.values()].reduce((a, b) => a + b, 0)
            return (
              <div key={r.e.id}>
                <div style={{ ...rad, background: 'var(--bg2)' }}>
                  <div onClick={() => toggleRad(r.e.id)} style={{ ...venstre('var(--bg2)'), cursor: 'pointer', fontWeight: 700 }} title={r.e.namn}>
                    <span style={{ width: 12, color: 'var(--text3)', fontSize: 11 }}>{ope ? '▾' : '▸'}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.e.namn}</span>
                    {r.fase && <span style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 500 }}>· {r.fase}</span>}
                  </div>
                  <div style={sumKol('var(--bg2)')}>{fmt(sumA)}</div>
                  {data.veker.map(v => <div key={v} style={celleStil(r.veker.get(v) || 0)}>{fmt(r.veker.get(v))}</div>)}
                </div>
                {ope && (r.personar.length ? r.personar : [{ namn: '(ingen person valt)', del: 100, tom: true }]).map((p, i) => (
                  <div key={p.namn} style={{ ...rad, background: 'var(--bg3)' }}>
                    <div style={{ ...venstre('var(--bg3)'), paddingLeft: 30, fontWeight: 500, color: p.tom ? 'var(--text3)' : 'var(--text)' }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: PERSONFARGAR[i % PERSONFARGAR.length], flexShrink: 0 }}/>
                      {p.namn}{!p.tom && r.personar.length > 1 ? <span style={{ color: 'var(--text3)', fontSize: 11 }}> {p.del}%</span> : null}
                    </div>
                    <div style={sumKol('var(--bg3)')}>{fmt(sumA * p.del / 100)}</div>
                    {data.veker.map(v => <div key={v} style={celleStil((r.veker.get(v) || 0) * p.del / 100)}>{fmt((r.veker.get(v) || 0) * p.del / 100)}</div>)}
                  </div>
                ))}
              </div>
            )
          })}

          {/* totalt + per person (alle aktivitetar) */}
          <div style={{ ...rad, background: 'var(--bg3)', borderTop: '2px solid var(--border)' }}>
            <div style={{ ...venstre('var(--bg3)'), fontWeight: 800 }}>Totalt alle aktivitetar</div>
            <div style={sumKol('var(--bg3)')}>{fmt(sumTotal)}</div>
            {data.veker.map(v => <div key={v} style={{ ...celleStil(0), fontWeight: 800 }}>{fmt(data.totalt.get(v)?.total)}</div>)}
          </div>
          {data.personNamn.map((n, i) => {
            const sumP = data.veker.reduce((a, v) => a + (data.totalt.get(v)?.perPerson[n] || 0), 0)
            return (
              <div key={n} style={{ ...rad, background: 'var(--bg2)' }}>
                <div style={{ ...venstre('var(--bg2)'), paddingLeft: 20, fontWeight: 600 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: PERSONFARGAR[i % PERSONFARGAR.length], flexShrink: 0 }}/>{n}
                </div>
                <div style={sumKol('var(--bg2)')}>{fmt(sumP)}</div>
                {data.veker.map(v => { const t = data.totalt.get(v)?.perPerson[n] || 0; return <div key={v} style={celleStil(t)}>{fmt(t)}</div> })}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
