import { dømeDelar, NUMMERERINGSMALAR } from './teikningsnummer'

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
  // Vald mal = den lagra malen så lenge avkryssingane framleis samsvarar med han; ellers «Eige oppsett»
  const malSamsvarar = (m) => ['medBygningsfagkode', 'medBygg', 'medLopenummer', 'medFase'].every(k => !!verdi[k] === !!m.verdi[k])
  const gjeldandeMal = NUMMERERINGSMALAR.find(m => m.key === verdi.mal && malSamsvarar(m))?.key || 'eige'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: kompakt ? 6 : 8 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text2)' }}>
        Mal
        <select value={gjeldandeMal} onChange={e => {
            const m = NUMMERERINGSMALAR.find(x => x.key === e.target.value)
            onEndre(m ? { ...verdi, ...m.verdi, mal: m.key } : { ...verdi, mal: 'eige' })
          }}
          style={{ padding: '4px 8px', borderRadius: 'var(--r)', border: '1.5px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12.5, fontFamily: 'var(--font)' }}>
          {NUMMERERINGSMALAR.map(m => <option key={m.key} value={m.key}>{m.namn}</option>)}
          <option value="eige">Eige oppsett</option>
        </select>
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
        {VAL.map(([k, namn, tips]) => (
          <label key={k} title={tips} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!verdi[k]} onChange={e => onEndre({ ...verdi, [k]: e.target.checked, mal: 'eige' })}/>
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
