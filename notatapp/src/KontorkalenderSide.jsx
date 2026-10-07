import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { nb } from 'date-fns/locale'
import useKontorkalender from './useKontorkalender'
import { fridagarIAar, arbeidsdagarOgTimarIAar, stilleVeke, STANDARD_KONTORKALENDER } from './kontorkalender'

// ═══════════════════════════════════════════════════════════════════
//  Kontorkalender (Prosjekt-modulen, eiga side) — arbeidstid og fridagar som
//  Framdrift bruker til å rekne kapasitet og fordele timar over veker.
//  Standard: 8 t/dag måndag–fredag; fri stille veke i påska, julaften og veka
//  mellom julaften og nyttår, elles norske helligdagar. Sjå kontorkalender.js.
// ═══════════════════════════════════════════════════════════════════

const DAGAR = [[1, 'Måndag'], [2, 'Tysdag'], [3, 'Onsdag'], [4, 'Torsdag'], [5, 'Fredag'], [6, 'Laurdag'], [0, 'Søndag']]
const VAL = [
  ['helligdagar', 'Norske helligdagar', 'Nyttårsdag, påske, 1. og 17. mai, Kristi himmelfart, pinse og jul'],
  ['stilleVekePaaske', 'Stille veke i påska', 'Måndag–fredag veka før påskedag'],
  ['julaften', 'Julaften', '24. desember'],
  ['juleveka', 'Veka mellom julaften og nyttår', '24.–31. desember'],
]
const etikett = { fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 700 }
const inp = { padding: '6px 8px', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 12.5, fontFamily: 'var(--font)',
  background: 'var(--bg2)', color: 'var(--text)' }
const knapp = { padding: '6px 12px', border: '1.5px solid var(--border)', borderRadius: 7, background: 'var(--bg2)', color: 'var(--text2)',
  fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font)', cursor: 'pointer' }

export default function KontorkalenderSide({ userId }) {
  const { kal, lagre, lastar, feil } = useKontorkalender(userId)
  const [aar, setAar] = useState(new Date().getFullYear())
  const fridagar = useMemo(() => fridagarIAar(aar, kal), [aar, kal])
  const sum = useMemo(() => arbeidsdagarOgTimarIAar(aar, kal), [aar, kal])
  const sv = stilleVeke(aar)
  const endre = (delvis) => lagre({ ...kal, ...delvis })

  return (
    <div style={{ maxWidth: 980, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Kontorkalender</div>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.6, maxWidth: 680 }}>
          Arbeidstid og fridagar for kontoret. Framdrift bruker kalenderen til å rekne kor mange timar det er tilgjengeleg kvar veke,
          og til å fordele forventa timar på aktivitetane. Endringar vert lagra med ein gong.
          {lastar && ' Lastar…'}
        </div>
        {feil && <div style={{ fontSize: 12.5, color: 'var(--danger)', marginTop: 6 }}>{feil}</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(280px, 1fr)', gap: 32, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 150 }}>
            <span style={etikett}>Timar per arbeidsdag</span>
            <input type="number" min={0} max={24} step={0.5} value={kal.timarPerDag} style={inp}
              onChange={e => endre({ timarPerDag: Math.max(0, Math.min(24, +e.target.value || 0)) })}/>
          </label>

          <div>
            <div style={{ ...etikett, marginBottom: 6 }}>Arbeidsdagar</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DAGAR.map(([n, namn]) => {
                const pa = kal.arbeidsdagar.includes(n)
                return (
                  <button key={n} type="button" style={{ ...knapp, background: pa ? 'var(--brandbg)' : 'var(--bg2)', color: pa ? 'var(--brand)' : 'var(--text3)',
                    borderColor: pa ? 'var(--brand)' : 'var(--border)' }}
                    onClick={() => endre({ arbeidsdagar: pa ? kal.arbeidsdagar.filter(x => x !== n) : [...kal.arbeidsdagar, n].sort() })}>
                    {namn.slice(0, 3)}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={etikett}>Fri</div>
            {VAL.map(([k, namn, tips]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 12.5, color: 'var(--text2)' }}>
                <input type="checkbox" checked={!!kal[k]} onChange={e => endre({ [k]: e.target.checked })} style={{ marginTop: 2 }}/>
                <span><b>{namn}</b><br/><span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{tips}</span></span>
              </label>
            ))}
          </div>

          <div>
            <div style={{ ...etikett, marginBottom: 6 }}>Eigne fridagar og ferie</div>
            {(kal.ekstraFri || []).map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <input type="date" value={f.fra || ''} style={{ ...inp, width: 138 }}
                  onChange={e => endre({ ekstraFri: kal.ekstraFri.map((x, j) => (j === i ? { ...x, fra: e.target.value, til: x.til && x.til >= e.target.value ? x.til : e.target.value } : x)) })}/>
                <span style={{ color: 'var(--text3)' }}>–</span>
                <input type="date" value={f.til || ''} min={f.fra || undefined} style={{ ...inp, width: 138 }}
                  onChange={e => endre({ ekstraFri: kal.ekstraFri.map((x, j) => (j === i ? { ...x, til: e.target.value } : x)) })}/>
                <input value={f.namn || ''} placeholder="Namn, t.d. Sommarferie" style={{ ...inp, flex: 1, minWidth: 120 }}
                  onChange={e => endre({ ekstraFri: kal.ekstraFri.map((x, j) => (j === i ? { ...x, namn: e.target.value } : x)) })}/>
                <button style={{ ...knapp, padding: '4px 9px' }} title="Fjern" onClick={() => endre({ ekstraFri: kal.ekstraFri.filter((_, j) => j !== i) })}>×</button>
              </div>
            ))}
            <button style={knapp} onClick={() => { const i = format(new Date(), 'yyyy-MM-dd'); endre({ ekstraFri: [...(kal.ekstraFri || []), { fra: i, til: i, namn: '' }] }) }}>
              + Legg til fridag/periode
            </button>
          </div>

          <button style={{ ...knapp, alignSelf: 'flex-start' }}
            onClick={() => { if (window.confirm('Tilbakestille kalenderen til standard (8 t, man–fre, stille veke, jul, norske helligdagar)? Eigne fridagar vert fjerna.')) lagre({ ...STANDARD_KONTORKALENDER }) }}>
            Tilbakestill til standard
          </button>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <button style={knapp} onClick={() => setAar(a => a - 1)}>‹</button>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', minWidth: 52, textAlign: 'center' }}>{aar}</span>
            <button style={knapp} onClick={() => setAar(a => a + 1)}>›</button>
            <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 8 }}>
              {sum.dagar} arbeidsdagar · {sum.timar} timar
            </span>
          </div>
          {kal.stilleVekePaaske && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
              Stille veke {aar}: {format(sv.fra, 'd. MMM', { locale: nb })} – {format(sv.til, 'd. MMM', { locale: nb })}
            </div>
          )}
          <div style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: 'var(--bg3)' }}>
                  <th style={{ ...etikett, textAlign: 'left', padding: '7px 10px' }}>Dato</th>
                  <th style={{ ...etikett, textAlign: 'left', padding: '7px 10px' }}>Dag</th>
                  <th style={{ ...etikett, textAlign: 'left', padding: '7px 10px' }}>Fri fordi</th>
                </tr>
              </thead>
              <tbody>
                {fridagar.map((f, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '4px 10px', fontFamily: 'var(--mono)' }}>{format(f.dato, 'dd.MM.yyyy')}</td>
                    <td style={{ padding: '4px 10px', color: 'var(--text3)' }}>{format(f.dato, 'EEEE', { locale: nb })}</td>
                    <td style={{ padding: '4px 10px', color: 'var(--text)' }}>{f.namn}</td>
                  </tr>
                ))}
                {!fridagar.length && <tr><td colSpan={3} style={{ padding: 12, color: 'var(--text3)' }}>Ingen fridagar.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
