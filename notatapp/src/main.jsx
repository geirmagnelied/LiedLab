import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Auth from './Auth.jsx'
import SjekklisteVindauge from './SjekklisteVindauge.jsx'
import './index.css'
import { supabase } from './supabase.js'
import { useState, useEffect } from 'react'

// Utan denne fanga ALDRI appen opp uventa render-/effekt-feil — éin einaste
// ukjend feil (t.d. eit kall til ein preload-metode som endå ikkje er lasta
// på nytt etter ei electron/main.js-endring) kræsja HEILE React-treet til
// ein tom, kvit skjerm utan noka feilmelding eller veg attende, og einaste
// utveg var å lukke og opne heile skrivebordsappen på nytt. Ei rein
// tryggingsnett-komponent (må vere ein klassekomponent — det finst ingen
// hook-ekvivalent til componentDidCatch), IKKJE eit forsøk på å SKJULE
// eller REDDE ut av feilen (brukar sitt eige funn 30. sept. 2026).
class Feilfangar extends React.Component {
  constructor(props) { super(props); this.state = { feil: null } }
  static getDerivedStateFromError(feil) { return { feil } }
  componentDidCatch(feil, info) { console.error('[Feilfangar]', feil, info) }
  render() {
    if (!this.state.feil) return this.props.children
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg, #f4f4f4)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 440, textAlign: 'center', fontFamily: 'sans-serif' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 18, marginBottom: 8 }}>Noko gjekk gale</h1>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
            Ein uventa feil oppstod og appen kunne ikkje fortsette. Prøv å laste inn på nytt —
            arbeidet ditt er lagra fortløpande i Supabase, så ingenting bør gå tapt.
          </p>
          <p style={{ fontSize: 11, color: '#999', marginBottom: 16, fontFamily: 'monospace' }}>
            {String(this.state.feil?.message || this.state.feil)}
          </p>
          <button onClick={() => window.location.reload()} style={{ padding: '8px 20px', borderRadius: 8,
            border: 'none', background: '#2563EB', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            Last inn på nytt
          </button>
        </div>
      </div>
    )
  }
}

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

// Sjekkliste-vindauget (opna av KvalitetModule.jsx via ks:apne-sjekkliste-
// vindauge, sjå electron/main.js) er eit HEILT ANNA Electron-BrowserWindow
// enn hovudvindauget, men lastar SAME index.html/bundle — skil dei via ein
// enkel spørjestreng i staden for eit eige HTML-inngangspunkt, sidan Vite
// sitt dev-oppsett/base-sti elles måtte duplisert for eit multi-page-bygg.
const spørjeparametrar = new URLSearchParams(window.location.search)
const erSjekklisteVindauge = spørjeparametrar.get('sjekkliste') === '1'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Feilfangar>
      {erSjekklisteVindauge
        ? <SjekklisteVindauge
            dokumentId={Number(spørjeparametrar.get('dokumentId'))}
            kontrolltype={spørjeparametrar.get('kontrolltype')}/>
        : <Root/>}
    </Feilfangar>
  </React.StrictMode>
)
