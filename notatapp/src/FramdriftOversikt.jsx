import { useMemo } from 'react'
import { differenceInCalendarDays, format } from 'date-fns'
import { effektivFerdig } from './framdriftFerdig'
import { antalArbeidsdagar } from './framdriftLogikk'
import { formaterDato, tilDato } from './framdriftDato'
import { PERSONFARGAR } from './FramdriftPersonarPanel'

// Planoversikt — vist i det faste venstrefeltet i Framdrift når ingenting er valt.
// (Når ein aktivitet/fase/milepæl er vald, tek eigenskapane over same felt.)
const Tal = ({ verdi, tekst }) => (
  <div style={{ flex: 1, background: 'var(--bg3)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
    <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>{verdi}</div>
    <div style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{tekst}</div>
  </div>
)

export default function FramdriftOversikt({ prosjektNamn, elementer, dokMap, timarKart, overlast, hendingar, onVelg }) {
  const d = useMemo(() => {
    const fasar = elementer.filter(e => e.type === 'fase')
    const foreldre = new Set(elementer.filter(e => e.forelder != null).map(e => e.forelder))
    const akt = elementer.filter(e => e.type === 'aktivitet' && !foreldre.has(e.id) && !e.summ) // blad-aktivitetar (summasjonsaktivitetar tel ikkje)
    const mil = elementer.filter(e => e.type === 'milepael')
    const dagar = akt.map(a => Math.max(1, antalArbeidsdagar(a)))
    const sumDagar = dagar.reduce((a, b) => a + b, 0)
    const framdrift = sumDagar ? Math.round(akt.reduce((s, a, i) => s + effektivFerdig(a, dokMap) * dagar[i], 0) / sumDagar) : 0
    const timar = akt.reduce((a, e) => a + (+e.timar || 0), 0)
    const start = elementer.length ? elementer.reduce((m, e) => (e.start < m ? e.start : m), elementer[0].start) : null
    const slutt = elementer.length ? elementer.reduce((m, e) => (e.slutt > m ? e.slutt : m), elementer[0].slutt) : null
    const perPerson = {}
    for (const v of timarKart.values()) for (const [n, t] of Object.entries(v.perPerson)) perPerson[n] = (perPerson[n] || 0) + t
    const idag = format(new Date(), 'yyyy-MM-dd')
    const kommande = elementer.filter(e => e.type !== 'fase' && e.slutt >= idag).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 6)
    return { fasar, akt, mil, framdrift, timar, start, slutt, perPerson, kommande }
  }, [elementer, dokMap, timarKart])

  const overlastAntal = overlast?.size || 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', lineHeight: 1.3 }}>{prosjektNamn}</div>
        {d.start && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{formaterDato(d.start)} – {formaterDato(d.slutt)}</div>}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Tal verdi={d.fasar.length} tekst="Fasar"/>
        <Tal verdi={d.akt.length} tekst="Aktivitetar"/>
        <Tal verdi={d.mil.length} tekst="Milepælar"/>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span className="fd-etikett">Samla framdrift</span><span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{d.framdrift} %</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: 'var(--bg3)', overflow: 'hidden', marginTop: 5 }}>
          <div style={{ width: d.framdrift + '%', height: '100%', background: '#0F766E' }}/>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Vekta med varigheit; aktivitetar med kopla leveransar bruker ferdigstillelse frå DTM.</div>
      </div>

      {d.timar > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="fd-etikett">Planlagde timar</span><span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{Math.round(d.timar * 2) / 2} t</span>
            {overlastAntal > 0 && <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--danger)' }}>{overlastAntal} overbelasta veke{overlastAntal === 1 ? '' : 'r'}</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
            {Object.entries(d.perPerson).sort((a, b) => b[1] - a[1]).map(([n, t], i) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: PERSONFARGAR[i % PERSONFARGAR.length], flexShrink: 0 }}/>
                <span style={{ flex: 1, color: 'var(--text)', fontWeight: 600 }}>{n}</span>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{Math.round(t * 2) / 2} t</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {d.kommande.length > 0 && (
        <div>
          <span className="fd-etikett">Neste i planen</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
            {d.kommande.map(e => {
              const dg = differenceInCalendarDays(tilDato(e.start), new Date())
              return (
                <div key={e.id} onClick={() => onVelg(e.id)} style={{ display: 'flex', gap: 8, padding: '5px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12.5 }}
                  onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--bg3)')} onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>{e.type === 'milepael' ? '◆ ' : ''}{e.namn}</span>
                  <span style={{ color: 'var(--text3)', fontSize: 11.5, whiteSpace: 'nowrap' }}>{dg <= 0 ? 'pågår' : dg === 1 ? 'i morgon' : `om ${dg} d`}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {hendingar.length > 0 && <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{hendingar.length} frist/møte frå notat er kopla til prosjektet.</div>}

      <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        Vel ein fase, aktivitet eller milepæl i tidslinja eller tabellen for å sjå og endre eigenskapane her.
      </div>
    </div>
  )
}
