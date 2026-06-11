import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Auth from './Auth.jsx'
import './index.css'
import { supabase } from './supabase.js'
import { useState, useEffect } from 'react'

function Root() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--brand)',
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 14 }}>Lastar…</div>
    </div>
  )

  return session ? <App userId={session.user.id} userEmail={session.user.email}/> : <Auth/>
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><Root /></React.StrictMode>
)
