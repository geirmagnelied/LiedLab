import { useState } from 'react'
import { supabase } from './supabase'
import { Lock } from 'lucide-react'

// Vist etter at ein invitert (eller «gløymt passord») har opna lenkja frå e-posten: brukaren er innlogga, men har ikkje valt passord enno.
export default function SettPassord({ onFerdig }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [feil, setFeil] = useState('')
  const [lagrar, setLagrar] = useState(false)

  const lagre = async (e) => {
    e.preventDefault()
    setFeil('')
    if (pw.length < 8) { setFeil('Passordet må vere minst 8 teikn.'); return }
    if (pw !== pw2) { setFeil('Passorda er ikkje like.'); return }
    setLagrar(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setLagrar(false)
    if (error) { setFeil(error.message); return }
    onFerdig()
  }

  const fi = { width: '100%', padding: '10px 14px 10px 40px', background: 'rgba(255,255,255,.08)', border: '1.5px solid rgba(255,255,255,.2)',
    borderRadius: 'var(--r2)', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'var(--font)', boxSizing: 'border-box' }
  const felt = (v, set, ph) => (
    <div style={{ position: 'relative', marginBottom: 14 }}>
      <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,.4)' }}/>
      <input type="password" value={v} onChange={e => set(e.target.value)} placeholder={ph} required minLength={8} style={fi}/>
    </div>
  )
  return (
    <div style={{ minHeight: '100vh', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <form onSubmit={lagre} style={{ width: '100%', maxWidth: 400, background: 'rgba(255,255,255,.06)', borderRadius: 16, border: '1px solid rgba(255,255,255,.12)', padding: 32 }}>
        <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>Vel passord</h2>
        <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 13, textAlign: 'center', marginBottom: 22 }}>Vel eit passord for å ta i bruk kontoen din.</p>
        {felt(pw, setPw, 'Nytt passord (minst 8 teikn)')}
        {felt(pw2, setPw2, 'Gjenta passordet')}
        {feil && <div style={{ background: 'rgba(220,38,38,.2)', border: '1px solid rgba(220,38,38,.4)', borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 13, marginBottom: 14 }}>{feil}</div>}
        <button type="submit" disabled={lagrar} style={{ width: '100%', padding: '11px 0', background: 'rgba(255,255,255,.9)', border: 'none', borderRadius: 'var(--r2)', color: 'var(--brand)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          {lagrar ? 'Lagrar…' : 'Lagre passord'}
        </button>
      </form>
    </div>
  )
}
