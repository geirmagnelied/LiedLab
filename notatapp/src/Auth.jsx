import { useState } from 'react'
import { supabase } from './supabase'
import { Mail, Lock, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react'

export default function Auth() {
  const [mode,     setMode]     = useState('login')  // 'login' | 'signup'
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [msg,      setMsg]      = useState('')

  const handle = async (e) => {
    e.preventDefault()
    setError(''); setMsg(''); setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMsg('Sjekk e-posten din for stadfestingslenke!')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fi = {
    width: '100%', padding: '10px 14px 10px 40px',
    background: 'rgba(255,255,255,.08)', border: '1.5px solid rgba(255,255,255,.2)',
    borderRadius: 'var(--r2)', color: '#fff', fontSize: 14,
    outline: 'none', fontFamily: 'var(--font)', transition: 'border-color .15s',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--brand)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16,
            background: 'rgba(255,255,255,.15)', border: '2px solid rgba(255,255,255,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 800, color: '#fff', margin: '0 auto 16px' }}>N</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>Notatapp</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', marginTop: 4 }}>LiedLab · liedarkitektur.no</div>
        </div>

        {/* Card */}
        <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: 16,
          border: '1px solid rgba(255,255,255,.12)', padding: 32,
          backdropFilter: 'blur(10px)' }}>

          <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 24,
            textAlign: 'center' }}>
            {mode === 'login' ? 'Logg inn' : 'Opprett konto'}
          </h2>

          <form onSubmit={handle}>
            {/* Email */}
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%',
                transform: 'translateY(-50%)', color: 'rgba(255,255,255,.4)' }}/>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="E-post" required style={fi}
                onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,.5)'}
                onBlur={e  => e.target.style.borderColor = 'rgba(255,255,255,.2)'}/>
            </div>

            {/* Password */}
            <div style={{ position: 'relative', marginBottom: 20 }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%',
                transform: 'translateY(-50%)', color: 'rgba(255,255,255,.4)' }}/>
              <input type={showPw ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Passord" required minLength={6} style={fi}
                onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,.5)'}
                onBlur={e  => e.target.style.borderColor = 'rgba(255,255,255,.2)'}/>
              <button type="button" onClick={() => setShowPw(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%',
                  transform: 'translateY(-50%)', background: 'none', border: 'none',
                  color: 'rgba(255,255,255,.4)', cursor: 'pointer', display: 'flex' }}>
                {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>

            {error && (
              <div style={{ background: 'rgba(220,38,38,.2)', border: '1px solid rgba(220,38,38,.4)',
                borderRadius: 8, padding: '10px 14px', color: '#fca5a5',
                fontSize: 13, marginBottom: 14 }}>{error}</div>
            )}
            {msg && (
              <div style={{ background: 'rgba(34,197,94,.15)', border: '1px solid rgba(34,197,94,.3)',
                borderRadius: 8, padding: '10px 14px', color: '#86efac',
                fontSize: 13, marginBottom: 14 }}>{msg}</div>
            )}

            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: '11px 0',
                background: loading ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.9)',
                border: 'none', borderRadius: 'var(--r2)',
                color: loading ? 'rgba(255,255,255,.4)' : 'var(--brand)',
                fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all .15s' }}>
              {mode === 'login' ? <LogIn size={16}/> : <UserPlus size={16}/>}
              {loading ? 'Ventar…' : mode === 'login' ? 'Logg inn' : 'Opprett konto'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError(''); setMsg('') }}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.55)',
                fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
              {mode === 'login' ? 'Har ikkje konto? Registrer deg' : 'Har allereie konto? Logg inn'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
