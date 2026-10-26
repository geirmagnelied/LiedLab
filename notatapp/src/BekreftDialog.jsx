// Bekreftelsesdialog i appen sin eigen stil (erstatning for window.confirm). Ligg over andre vindauge; Escape = avbryt.
import { useEffect } from 'react'

export default function BekreftDialog({ tittel, tekst, jaTekst = 'OK', neiTekst = 'Avbryt', fare = false, onJa, onNei, z = 500 }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onNei() }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [onNei])
  const farge = fare ? 'var(--danger, #c0392b)' : 'var(--brand)'
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onNei() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: z, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 400, maxWidth: '92vw', background: 'var(--bg2)', borderRadius: 14, boxShadow: '0 24px 70px rgba(0,0,0,.4)', overflow: 'hidden' }}>
        <div style={{ background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 14.5, padding: '12px 20px' }}>{tittel}</div>
        <div style={{ padding: '18px 20px', fontSize: 13.5, color: 'var(--text)', lineHeight: 1.55 }}>{tekst}</div>
        <div style={{ display: 'flex', gap: 10, padding: '12px 20px', background: 'var(--bg3)', borderTop: '1px solid var(--border)' }}>
          <button autoFocus onClick={onJa} style={{ padding: '7px 18px', border: 'none', borderRadius: 7, background: farge, color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'var(--font)' }}>{jaTekst}</button>
          <button onClick={onNei} style={{ padding: '7px 16px', border: '1.5px solid var(--border)', borderRadius: 7, background: 'var(--bg2)', color: 'var(--text2)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', fontFamily: 'var(--font)' }}>{neiTekst}</button>
        </div>
      </div>
    </div>
  )
}
