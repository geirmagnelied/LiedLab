import TimeTracker from './TimeTracker'
import TimeVeke from './TimeVeke'
import ForecastView from './ForecastView'
import { useState } from 'react'

export default function TimarModule({ userId, projects, addProject, mode, activeOfficeId }) {
  const [subView, setSubView] = useState('registrer')
  const [dagFraVeke, setDagFraVeke] = useState(null)   // dag valt i vekeoversikta → opnar Timeregistrering på den dagen

  const Tab = ({ v, letter, label }) => {
    const active = subView === v
    return (
      <button onClick={() => setSubView(v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '7px 14px',
          border: '1.5px solid',
          borderColor: active ? '#0A0A0A' : 'transparent',
          background: active ? '#0A0A0A' : 'transparent',
          borderRadius: 'var(--r)',
          color: active ? '#fff' : 'var(--text2)',
          fontSize: 13, cursor: 'pointer',
          fontWeight: active ? 700 : 500,
          transition: 'all .15s',
          fontFamily: 'var(--font)',
        }}>
        <span style={{
          width: 20, height: 20, borderRadius: 5,
          background: active ? '#fff' : 'rgba(27,42,58,.1)',
          color: active ? '#0A0A0A' : 'var(--text2)',
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
        background:'var(--bg3)',
        borderBottom: '1px solid var(--border)',
      }}>
        <Tab v="registrer" letter="T" label="Timeregistrering"/>
        <Tab v="veke" letter="V" label="Veke"/>
        <Tab v="prognose"  letter="P" label="Prognose"/>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 26px' }}>
        {subView === 'registrer' && (
          <TimeTracker
            key={dagFraVeke || 'i-dag'} initDato={dagFraVeke}
            userId={userId}
            projects={projects}
            addProject={(n, t) => addProject(n, t, activeOfficeId)}
            mode={mode}
          />
        )}
        {subView === 'veke' && <TimeVeke userId={userId} projects={projects} onGaaTilDag={d => { setDagFraVeke(d); setSubView('registrer') }}/>}
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
