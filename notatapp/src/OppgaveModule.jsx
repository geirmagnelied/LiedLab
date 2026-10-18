import { useState } from 'react'

export default function OppgaveModule({ userId, projects, activeOfficeId }) {
  return (
    <div style={{ display:'flex', flex:1, flexDirection:'column', overflow:'hidden' }}>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
        <div style={{ width:72, height:72, borderRadius:18, background:'var(--brandbg2)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:32, fontWeight:900, color:'var(--brand)' }}>O</div>
        <p style={{ fontSize:14, color:'var(--text3)', textAlign:'center', maxWidth:400, lineHeight:1.7 }}>
          Oppg\u00E5vemodulen med kanban-tavle, sjekkpunkt og fil-drop er under utvikling.
        </p>
      </div>
    </div>
  )
}
