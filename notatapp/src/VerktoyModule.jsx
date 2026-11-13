import { lazy, Suspense, useState } from 'react'

// ═══════════════════════════════════════════════════════════════════
//  Verktøy — samling av små faglege verktøy. Fyrste verktøy: Veggvelgar (Norgips veggtabell).
//  Nye verktøy: legg ein oppføring i VERKTOY og ein komponent som får { userId, projects, activeProjectId }.
// ═══════════════════════════════════════════════════════════════════

const VeggvelgarVerktoy = lazy(() => import('./VeggvelgarVerktoy'))

const VERKTOY = [
  { id: 'veggvelgar', namn: 'Veggvelgar', farge: '#0891B2', bokstav: 'V', komponent: VeggvelgarVerktoy,
    skildring: 'Foreslår innvendige stenderveggar frå Norgips sin veggtabell ut frå brannkrav, lydkrav, romhøgde, robustheit og romtype. Val kan lagrast på prosjektet.' },
]

export default function VerktoyModule({ userId, projects, activeProjectId }) {
  const [aktivt, setAktivt] = useState(() => { try { return localStorage.getItem('liedlab-verktoy-aktivt') || null } catch { return null } })
  const opne = (id) => { setAktivt(id); try { id ? localStorage.setItem('liedlab-verktoy-aktivt', id) : localStorage.removeItem('liedlab-verktoy-aktivt') } catch { /* privat modus */ } }
  const verktoy = VERKTOY.find(v => v.id === aktivt)

  return (
    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', height: 50, flexShrink: 0, background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => opne(null)} style={{ border: 'none', background: 'transparent', fontSize: 15, fontWeight: 800, color: verktoy ? 'var(--text3)' : 'var(--text)', cursor: verktoy ? 'pointer' : 'default', fontFamily: 'var(--font)', padding: 0 }}>Verktøy</button>
        {verktoy && <><span style={{ color: 'var(--text3)' }}>›</span><span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{verktoy.namn}</span></>}
      </div>

      {!verktoy && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14, maxWidth: 1000 }}>
            {VERKTOY.map(v => (
              <button key={v.id} onClick={() => opne(v.id)}
                style={{ display: 'flex', gap: 14, alignItems: 'flex-start', textAlign: 'left', padding: '16px 18px', borderRadius: 14, border: '1.5px solid var(--border)', background: 'var(--bg2)', cursor: 'pointer', fontFamily: 'var(--font)', boxShadow: '0 1px 2px rgba(0,0,0,.04)', transition: 'transform .15s, box-shadow .15s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 5px 14px rgba(0,0,0,.09)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,.04)' }}>
                <span style={{ width: 46, height: 46, borderRadius: 12, background: v.farge, color: '#fff', fontWeight: 800, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{v.bokstav}</span>
                <span>
                  <span style={{ display: 'block', fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{v.namn}</span>
                  <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text2)', marginTop: 4, lineHeight: 1.5 }}>{v.skildring}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {verktoy && (
        <Suspense fallback={<div style={{ padding: 24, color: 'var(--text3)', fontSize: 13 }}>Lastar…</div>}>
          <verktoy.komponent userId={userId} projects={projects} activeProjectId={activeProjectId}/>
        </Suspense>
      )}
    </div>
  )
}
