import { fmtDateShort } from './sakerKonstantar'

// ═══════════════════════════════════════════════════════════════════
//  DTMUtsendingarListe — oversikt over alle registrerte utsendingar for
//  det aktive prosjektet. Brukast til å attopne ei kladd (leggje til
//  fleire dokument, stadfeste sending) eller sjå historikken. Sjå
//  claude/dtm-modul.md.
// ═══════════════════════════════════════════════════════════════════

export default function DTMUtsendingarListe({ utsendingar, onOpne, onSlett, onLukk }) {
  const kladdar = utsendingar.filter(u => u.status !== 'sendt')
  const sendte  = utsendingar.filter(u => u.status === 'sendt')

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.42)', display:'flex',
      alignItems:'center', justifyContent:'center', zIndex:200 }}>
      <div style={{ background:'var(--bg2)', borderRadius:'var(--r2)', width:'min(94vw, 680px)',
        maxHeight:'85vh', overflow:'hidden', display:'flex', flexDirection:'column',
        boxShadow:'0 24px 70px rgba(0,0,0,.35)' }}>

        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 20px',
          borderBottom:'1px solid rgba(255,255,255,.12)', flexShrink:0, background:'#2563EB' }}>
          <span style={{ fontSize:15, fontWeight:800, color:'#fff' }}>Utsendingar</span>
          <div style={{ flex:1 }}/>
          <button onClick={onLukk} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer',
            color:'rgba(255,255,255,.85)', lineHeight:1, padding:'2px 6px' }}>×</button>
        </div>

        <div style={{ flex:1, overflow:'auto', padding:'16px 20px' }}>
          {utsendingar.length === 0 && (
            <div style={{ fontSize:13, color:'var(--text3)', textAlign:'center', padding:'30px 0' }}>
              Ingen utsendingar registrerte enno. Bruk «Registrer utsending» i radmenyen (☰) på eitt eller fleire dokument.
            </div>
          )}

          {kladdar.length > 0 && (<>
            <div className="dt-etikett" style={{ marginBottom:8 }}>Uferdige kladdar ({kladdar.length})</div>
            <div style={{ border:'1.5px solid var(--border)', borderRadius:'var(--r)', overflow:'hidden', marginBottom:18 }}>
              {kladdar.map((u, i) => <UtsendingRad key={u.id} u={u} i={i} onOpne={onOpne} onSlett={onSlett}/>)}
            </div>
          </>)}

          {sendte.length > 0 && (<>
            <div className="dt-etikett" style={{ marginBottom:8 }}>Sendt ({sendte.length})</div>
            <div style={{ border:'1.5px solid var(--border)', borderRadius:'var(--r)', overflow:'hidden' }}>
              {sendte.map((u, i) => <UtsendingRad key={u.id} u={u} i={i} onOpne={onOpne}/>)}
            </div>
          </>)}
        </div>
      </div>
    </div>
  )
}

function UtsendingRad({ u, i, onOpne, onSlett }) {
  const sendt = u.status === 'sendt'
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
      borderTop: i > 0 ? '1px solid var(--border)' : 'none', cursor:'pointer' }}
      onClick={() => onOpne(u.id)}>
      <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 8px', borderRadius:20,
        background: sendt ? 'rgba(22,101,52,.12)' : 'var(--brandbg)',
        color: sendt ? 'var(--success)' : 'var(--brand)' }}>{sendt ? 'Sendt' : 'Kladd'}</span>
      <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{u.mottakar || '(ingen mottakar sett)'}</span>
      <span style={{ fontSize:12, color:'var(--text3)' }}>{(u.dokument || []).length} dokument</span>
      <div style={{ flex:1 }}/>
      <span style={{ fontSize:11.5, color:'var(--text3)' }}>{u.dato ? fmtDateShort(u.dato) : ''}</span>
      {!sendt && onSlett && (
        <button onClick={e => { e.stopPropagation(); onSlett(u.id) }} title="Slett kladden"
          style={{ border:'none', background:'transparent', color:'var(--text3)', fontSize:14, cursor:'pointer', fontWeight:800 }}>🗑</button>
      )}
    </div>
  )
}
