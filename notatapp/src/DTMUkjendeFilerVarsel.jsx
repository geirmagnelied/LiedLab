import { KATEGORI_LABEL, KATEGORI_FARGE } from './dtmKonstantar'

// ═══════════════════════════════════════════════════════════════════
//  DTMUkjendeFilerVarsel — vist når DTMModule.jsx sin automatiske skanning
//  (ved opning/prosjektbyte, sjå claude/dtm-modul.md) finn filer i DTM-
//  mappene som IKKJE er registrerte i appen — truleg lagt inn direkte i
//  Windows Utforskar/OneDrive, utanom Import-knappen.
//
//  Gjer INGEN eiga skanning/import sjølv — rein presentasjon + vidaresend
//  til den EKSISTERANDE, velprøvde import-flyten (DTMImportModal.jsx sin
//  nye `forhandsvalde`-prop), gruppert per kategori sidan kvar import-
//  modal-instans berre handterer éin kategori om gongen.
// ═══════════════════════════════════════════════════════════════════

export default function DTMUkjendeFilerVarsel({ funne, onLukk, onIgnorer, onImporter }) {
  const perKategori = {}
  for (const f of funne) (perKategori[f.kategori] ??= []).push(f)

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.42)', display:'flex',
      alignItems:'center', justifyContent:'center', zIndex:200 }}>
      <div style={{ background:'var(--bg2)', borderRadius:'var(--r2)', width:'min(94vw, 560px)',
        maxHeight:'85vh', overflow:'hidden', display:'flex', flexDirection:'column',
        boxShadow:'0 24px 70px rgba(0,0,0,.35)' }}>

        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 20px',
          borderBottom:'1px solid rgba(255,255,255,.12)', flexShrink:0, background:'#B45309' }}>
          <span style={{ fontSize:15, fontWeight:800, color:'#fff' }}>Ukjende filer funne</span>
          <div style={{ flex:1 }}/>
          <button onClick={onLukk} title="Lukk" style={{ background:'none', border:'none', fontSize:22,
            cursor:'pointer', color:'rgba(255,255,255,.85)', lineHeight:1, padding:'2px 6px' }}>×</button>
        </div>

        <div style={{ flex:1, overflow:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:18 }}>
          <p style={{ fontSize:12.5, color:'var(--text3)', lineHeight:1.6, margin:0 }}>
            Desse filene ligg i DTM-mappene, men er ikkje registrerte i appen enno — truleg lagt inn
            direkte utanom Import-knappen. Trykk «Registrer» for å gå gjennom dei med den vanlege
            import-gjennomgangen (same steg som ved vanleg import), eller «Ignorer» for filer som ikkje
            høyrer heime i registeret.
          </p>

          {Object.entries(perKategori).map(([kategori, filer]) => (
            <div key={kategori} style={{ border:'1.5px solid var(--border)', borderRadius:'var(--r)', overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:'var(--bg3)' }}>
                <span style={{ width:9, height:9, borderRadius:'50%', background:KATEGORI_FARGE[kategori], flexShrink:0 }}/>
                <span style={{ fontSize:12.5, fontWeight:700, color:'var(--text)' }}>
                  {KATEGORI_LABEL[kategori]} ({filer.length})
                </span>
              </div>
              {filer.map(f => (
                <div key={f.filnamn} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px',
                  borderTop:'1px solid var(--border)' }}>
                  <span style={{ flex:1, fontSize:12, color:'var(--text2)', overflow:'hidden',
                    textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={f.filnamn}>{f.filnamn}</span>
                  <button onClick={() => onIgnorer(kategori, f.filnamn)} className="dt-knapp" style={{ fontSize:11, padding:'3px 8px' }}>
                    Ignorer
                  </button>
                </div>
              ))}
              <div style={{ padding:10, borderTop:'1px solid var(--border)' }}>
                <button onClick={() => onImporter(kategori, filer)} className="dt-knapp hovud" style={{ width:'100%' }}>
                  Registrer {filer.length} fil{filer.length === 1 ? '' : 'er'} i {KATEGORI_LABEL[kategori].toLowerCase()}…
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display:'flex', gap:8, padding:'14px 20px', borderTop:'1px solid var(--border)', flexShrink:0 }}>
          <div style={{ flex:1 }}/>
          <button onClick={onLukk} className="dt-knapp">Lukk</button>
        </div>
      </div>
    </div>
  )
}
