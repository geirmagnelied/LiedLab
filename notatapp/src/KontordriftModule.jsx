import AnsatteSide from './AnsatteSide'
import KontorkalenderSide from './KontorkalenderSide'

// ═══════════════════════════════════════════════════════════════════
//  KontordriftModule — paraplyen «Kontordrift» (VN) med NL2: Prosjekt · Kundar · Ansatte · Kontorkalender (AppRailUndermeny).
//  Denne komponenten viser dei to sidene som høyrer til sjølve kontordrifta (Ansatte = register + invitasjon, Kontorkalender);
//  Prosjekt og Kundar er eigne moduler som berre ligg under same paraply. Sjå claude/kontordrift-modul.md.
// ═══════════════════════════════════════════════════════════════════
export default function KontordriftModule({ side = 'ansatte', userId, userEmail, visNamn }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 28px' }}>
        {side === 'ansatte' ? <AnsatteSide userId={userId} userEmail={userEmail} visNamn={visNamn}/> : <KontorkalenderSide userId={userId}/>}
      </div>
    </div>
  )
}
