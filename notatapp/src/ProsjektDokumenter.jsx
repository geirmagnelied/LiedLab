import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import DTMTabell from './DTMTabell'
import { løysAktivtSett, PROSJEKTDOK_KATEGORIAR } from './dtmKonstantar'

// ═══════════════════════════════════════════════════════════════════
//  Prosjektdokumenter (Prosjektstyring): kontrakt, oppdragsbekreftingar og endringsavtalar for det aktive prosjektet.
//  Dette er DTM-dokument (dtm_dokumenter) der «Kategori eksternt dok.» er Kontrakt, Oppdragsbekreftelse eller Endringsavtale —
//  dei vert difor òg viste i DTM, og kan leggast inn derifrå (Import → sett kategori). Same tabell (DTMTabell) som i DTM/Kvalitet.
// ═══════════════════════════════════════════════════════════════════
const NESTA_FELT = { rev: 'revisjon', dato: 'dato' }

export default function ProsjektDokumenter({ userId, prosjekt, onOpneModul }) {
  const [dokumenter, setDokumenter] = useState([])
  const [oppdragsSti, setOppdragsSti] = useState('')
  const [lastar, setLastar] = useState(true)
  const harBru = typeof window !== 'undefined' && !!window.resultatdokumentAPI
  const pid = prosjekt?.id

  const last = useCallback(async () => {
    if (!pid) { setDokumenter([]); setLastar(false); return }
    setLastar(true)
    const [{ data: p }, { data: d }] = await Promise.all([
      supabase.from('projects').select('details').eq('id', pid).single(),
      supabase.from('dtm_dokumenter').select('*').eq('project_id', pid).order('nr'),
    ])
    setOppdragsSti(p?.details?.oppdragsStiLast && p?.details?.oppdragsSti ? p.details.oppdragsSti : '')
    setDokumenter((d || []).filter(x => PROSJEKTDOK_KATEGORIAR.includes(x.ekstern_kategori)))
    setLastar(false)
  }, [pid])
  useEffect(() => { last() }, [last])
  useEffect(() => {   // DTM er eit anna område i same app: hent på nytt når vindauget får fokus att
    window.addEventListener('focus', last)
    return () => window.removeEventListener('focus', last)
  }, [last])

  const settVerdi = async (id, felt, verdi) => {
    const d = dokumenter.find(x => x.id === id); if (!d) return
    const no = new Date().toISOString()
    if (NESTA_FELT[felt]) {
      const sett = løysAktivtSett(d, 'alle'); if (!sett) return
      const nytt = { ...(d[sett] || {}), [NESTA_FELT[felt]]: verdi }
      setDokumenter(ds => ds.map(x => x.id === id ? { ...x, [sett]: nytt, updated_at: no } : x))
      await supabase.from('dtm_dokumenter').update({ [sett]: nytt, updated_at: no }).eq('id', id)
      return
    }
    setDokumenter(ds => ds.map(x => x.id === id ? { ...x, [felt]: verdi, updated_at: no } : x))
    const { error } = await supabase.from('dtm_dokumenter').update({ [felt]: verdi, updated_at: no }).eq('id', id)
    if (error) { alert('Klarte ikkje lagre endringa: ' + error.message); last() }
    else if (felt === 'ekstern_kategori' && !PROSJEKTDOK_KATEGORIAR.includes(verdi)) setDokumenter(ds => ds.filter(x => x.id !== id))   // er ikkje lenger eit prosjektdokument
  }
  const opneFil = (rad) => {
    const sett = løysAktivtSett(rad, 'alle'); const filnamn = sett && rad[sett]?.filnamn
    if (!filnamn || !harBru || !oppdragsSti) return
    window.resultatdokumentAPI.dtmApneFil(oppdragsSti, sett, filnamn, false)
  }

  if (!prosjekt) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 14 }}>Vel eit prosjekt øvst for å sjå prosjektdokumenta.</div>
  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '20px 24px', gap: 14, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>Prosjektdokumenter</div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.6, marginTop: 3, maxWidth: 760 }}>
            Kontrakt, oppdragsbekreftingar og endringsavtalar for {prosjekt.projectNumber ? prosjekt.projectNumber + ' ' : ''}{prosjekt.name}. Dokumenta ligg i DTM — legg dei inn der
            (Eksternt dokument) og set «Kategori eksternt dok.» til Kontrakt, Oppdragsbekreftelse eller Endringsavtale, så dukkar dei opp her.
          </div>
        </div>
        <button onClick={() => onOpneModul?.('dtm')} className="dt-knapp hovud" style={{ padding: '7px 14px' }}>Opne DTM</button>
      </div>
      {lastar ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Lastar…</div>
        : dokumenter.length === 0 ? (
          <div style={{ border: '1.5px dashed var(--border)', borderRadius: 'var(--r2)', padding: '40px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 13.5 }}>
            Ingen kontrakt, oppdragsbekreftingar eller endringsavtalar er registrerte i dette prosjektet enno.
          </div>
        ) : (
          <DTMTabell
            dokumenter={dokumenter}
            aktivtSett="alle"
            onSetVerdi={settVerdi}
            onOpneFil={opneFil}
            oppdragsSti={oppdragsSti}
            prefsKeySuffix="prosjektdok"
            standardSynlegeKolonnar={['ekstern_kategori', 'nr', 'tittel', 'filtype', 'rev', 'dato', 'lagra_av']}
          />
        )}
    </div>
  )
}
