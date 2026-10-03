// ═══════════════════════════════════════════════════════════════════
//  KontordriftModule — placeholder, sjå brukar sitt krav 30. sept. 2026
//  (undermodul av «Admin», saman med Prosjekt/Kundar). Ingen funksjonalitet
//  enno — berre eit synleg punkt i navigasjonen å byggje vidare på.
// ═══════════════════════════════════════════════════════════════════
export default function KontordriftModule() {
  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 16px',
        height:50, flexShrink:0, background:'var(--brand)', borderBottom:'1px solid rgba(255,255,255,.1)' }}>
        <span style={{ fontSize:15, fontWeight:800, color:'#fff', letterSpacing:'-0.02em' }}>Kontordrift</span>
      </div>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:14 }}>
        <div style={{ width:72, height:72, borderRadius:18, background:'var(--brandbg2)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, fontWeight:900, color:'var(--brand)' }}>
          Kd
        </div>
        <p style={{ fontSize:14, color:'var(--text3)', textAlign:'center', maxWidth:380, lineHeight:1.7 }}>
          Kontordrift er ein plasshaldar enno — kjem etter kvart.
        </p>
      </div>
    </div>
  )
}
