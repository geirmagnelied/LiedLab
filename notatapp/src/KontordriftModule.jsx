import { useState } from 'react'
import AnsatteSide from './AnsatteSide'
import KontorkalenderSide from './KontorkalenderSide'

// ═══════════════════════════════════════════════════════════════════
//  KontordriftModule (undermodul av «Admin», opna frå toppfeltet): Ansatte (register + invitasjon til appen) og
//  Kontorkalender (flytta hit frå Prosjekt 18. okt. 2026). Fleire sider kan leggjast til. Sjå claude/kontordrift-modul.md.
// ═══════════════════════════════════════════════════════════════════
export default function KontordriftModule({ userId, userEmail, visNamn }) {
  const [side, setSide] = useState(() => { try { return localStorage.getItem('liedlab-kontordrift-side') || 'ansatte' } catch { return 'ansatte' } })
  const byt = (s) => { setSide(s); try { localStorage.setItem('liedlab-kontordrift-side', s) } catch { /* privat modus */ } }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', height: 50, flexShrink: 0, background: 'var(--brand)', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>Kontordrift</span>
      </div>
      <div style={{ display: 'flex', gap: 2, padding: '0 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0 }}>
        {[['ansatte', 'Ansatte'], ['kalender', 'Kontorkalender']].map(([k, t]) => (
          <button key={k} onClick={() => byt(k)}
            style={{ padding: '11px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 13, fontWeight: side === k ? 800 : 600,
              color: side === k ? 'var(--brand)' : 'var(--text3)', borderBottom: side === k ? '2.5px solid var(--brand)' : '2.5px solid transparent', marginBottom: -1 }}>{t}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 28px' }}>
        {side === 'ansatte' ? <AnsatteSide userId={userId} userEmail={userEmail} visNamn={visNamn}/> : <KontorkalenderSide userId={userId}/>}
      </div>
    </div>
  )
}
