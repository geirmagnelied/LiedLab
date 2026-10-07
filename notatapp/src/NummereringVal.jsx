import { dømeDelar } from './teikningsnummer'

// ═══════════════════════════════════════════════════════════════════
//  NummereringVal — overordna val for korleis teikningsnummera i prosjektet er
//  bygde (sjå teikningsnummer.js, DS-356). Same komponent i Prosjekt-modulen,
//  Leveranseplan-vindauget og Kvalitetssystemet — alle les/skriv same oppsett
//  (projects.details.nummerering). Fag, type og etasje er alltid med.
// ═══════════════════════════════════════════════════════════════════

const VAL = [
  ['medBygg',            'Bygg, sone/del',   'Byggnummer eller sone (t.d. 1A) etter typen'],
  ['medBygningsfagkode', 'Bygningsfagkode',  'Tosifra kode rett etter faget (t.d. 23 for stålkonstruksjon)'],
  ['medLopenummer',      'Løpenummer',       'Fortløpande nummer (01, 02 …) innanfor type/etasje'],
  ['medFase',            'Fasenummer sist',  '1 = skisseprosjekt, 2 = forprosjekt, 3 = detaljprosjekt'],
]

export default function NummereringVal({ verdi, onEndre, kompakt = false }) {
  const delar = dømeDelar(verdi)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: kompakt ? 6 : 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
        {VAL.map(([k, namn, tips]) => (
          <label key={k} title={tips} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!verdi[k]} onChange={e => onEndre({ ...verdi, [k]: e.target.checked })}/>
            Med {namn.toLowerCase()}
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>Slik les og lagar appen nummer:</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>
          {delar.map(d => d.tekst).join('-')}
        </span>
        <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>({delar.map(d => d.namn.toLowerCase()).join(' · ')})</span>
      </div>
    </div>
  )
}
