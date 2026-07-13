export default function KvalitetModule() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 16px', height: 50, flexShrink: 0,
        background: 'var(--brand)',
        borderBottom: '1px solid rgba(255,255,255,.1)',
      }}>
        <span style={{
          fontSize: 15, fontWeight: 800, color: '#fff',
          letterSpacing: '-0.02em',
        }}>Kvalitet</span>
      </div>

      {/* Placeholder content */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16, padding: 40,
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: 18,
          background: 'var(--brandbg2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, fontWeight: 900, color: 'var(--brand)',
          fontFamily: 'var(--font)',
        }}>K</div>

        <h2 style={{
          fontSize: 22, fontWeight: 800, color: 'var(--text)',
          letterSpacing: '-0.02em',
        }}>Kvalitetsmodul</h2>

        <p style={{
          fontSize: 14, color: 'var(--text3)', textAlign: 'center',
          maxWidth: 420, lineHeight: 1.7,
        }}>
          Kvalitetsmodulen kjem snart. Her vil du kunne handsame TEK17-sjekklister,
          leveransekontroll, styrande dokument og kvalitetsplanar for prosjekta dine.
        </p>

        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center',
          marginTop: 8,
        }}>
          {['TEK17-sjekkliste', 'Leveransekontroll', 'Styrande dokument', 'Endringsmelding'].map(item => (
            <span key={item} style={{
              padding: '6px 14px', borderRadius: 20,
              background: 'var(--bg3)', border: '1px solid var(--border)',
              fontSize: 12, color: 'var(--text3)', fontWeight: 500,
            }}>{item}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
