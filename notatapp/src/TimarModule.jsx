import TimeTracker from './TimeTracker'
import ForecastView from './ForecastView'
import { useState } from 'react'

export default function TimarModule({ userId, projects, addProject, mode, activeOfficeId }) {
  const [subView, setSubView] = useState('registrer')

  const Tab = ({ v, letter, label }) => {
    const active = subView === v
    return (
      <button onClick={() => setSubView(v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '7px 14px',
          border: '1.5px solid',
          borderColor: active ? 'rgba(255,255,255,.6)' : 'transparent',
          background: active ? 'rgba(255,255,255,.18)' : 'transparent',
          borderRadius: 'var(--r)',
          color: active ? '#fff' : 'rgba(255,255,255,.7)',
          fontSize: 14, cursor: 'pointer',
          fontWeight: active ? 700 : 500,
          transition: 'all .15s',
          fontFamily: 'var(--font)',
        }}>
        <span style={{
          width: 20, height: 20, borderRadius: 5,
          background: active ? 'rgba(255,255,255,.92)' : 'rgba(255,255,255,.18)',
          color: active ? 'var(--brand)' : '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 800, flexShrink: 0,
        }}>{letter}</span>
        {label}
      </button>
    )
  }

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
          letterSpacing: '-0.02em', marginRight: 12,
        }}>Timar</span>
        <Tab v="registrer" letter="T" label="Timeregistrering"/>
        <Tab v="prognose"  letter="P" label="Prognose"/>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 26px' }}>
        {subView === 'registrer' && (
          <TimeTracker
            userId={userId}
            projects={projects}
            addProject={(n, t) => addProject(n, t, activeOfficeId)}
            mode={mode}
          />
        )}
        {subView === 'prognose' && (
          <ForecastView
            userId={userId}
            projects={projects}
            mode={mode}
          />
        )}
      </div>
    </div>
  )
}
