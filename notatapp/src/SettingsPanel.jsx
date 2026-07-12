import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

const OFFICE_COLORS = [
  { label: 'Grøn',    value: '#1B4332' },
  { label: 'Fersken', value: '#C2570A' },
  { label: 'Blå',     value: '#1A56A0' },
  { label: 'Lilla',   value: '#5E35B1' },
  { label: 'Raud',    value: '#B91C1C' },
]

export default function SettingsPanel({ onClose, offices, activeOfficeId, userId, userEmail,
  onAddOffice, onUpdateOffice, onDeleteOffice }) {
  const [tab,        setTab]        = useState('office')  // 'office' | 'profile'
  const [members,    setMembers]    = useState([])
  const [loadingM,   setLoadingM]   = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole,  setInviteRole]  = useState('member')
  const [sending,    setSending]    = useState(false)
  const [feedback,   setFeedback]   = useState(null)
  const [editName,   setEditName]   = useState('')
  const [editColor,  setEditColor]  = useState('')
  const panelRef = useRef(null)

  const activeOffice = offices.find(o => o.id === activeOfficeId)
  // Admin = aktiv admin-medlem ELLER eigar av kontoret (offices-radene er
  // lasta per innlogga brukar, så eit aktivt kontor i lista er alltid eigd av deg)
  const isAdmin = !!activeOffice
    || members.some(m => m.user_id === userId && m.role === 'admin' && m.status === 'active')

  // Load members for active office
  useEffect(() => {
    if (!activeOfficeId) return
    setLoadingM(true)
    supabase.from('office_members')
      .select('*')
      .eq('office_id', activeOfficeId)
      .order('invited_at')
      .then(({ data }) => {
        setMembers(data || [])
        setLoadingM(false)
      })
  }, [activeOfficeId])

  // Initialise edit fields when office changes
  useEffect(() => {
    if (activeOffice) {
      setEditName(activeOffice.name)
      setEditColor(activeOffice.color || '#1B4332')
    }
  }, [activeOfficeId])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose()
    }
    setTimeout(() => document.addEventListener('mousedown', handler), 10)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return
    setSending(true); setFeedback(null)
    try {
      // Generate a unique token
      const token = crypto.randomUUID()
      const { error } = await supabase.from('office_members').insert({
        office_id:     activeOfficeId,
        invited_email: inviteEmail.trim().toLowerCase(),
        role:          inviteRole,
        status:        'pending',
        invite_token:  token,
      })
      if (error) throw error

      // Send invite email via our Edge Function
      const appUrl = window.location.origin
      const inviteLink = `${appUrl}/?invite=${token}`

      const res = await fetch('https://hcdtagtkyewhrbrvrbqh.supabase.co/functions/v1/send-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjZHRhZ3RreWV3aHJicnZyYnFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2ODk0MDksImV4cCI6MjA5NjI2NTQwOX0.1Kg8MnI-ffWa5Ecc54BT_wP_mnftH9B1ZPIOoGaADfM`,
        },
        body: JSON.stringify({
          to:          inviteEmail.trim(),
          inviteLink,
          officeName:  activeOffice?.name || 'Notatapp',
          inviterEmail: userEmail,
          role:         inviteRole,
        }),
      })

      if (!res.ok) throw new Error('Klarte ikkje sende e-post')

      setMembers(prev => [...prev, {
        invited_email: inviteEmail.trim().toLowerCase(),
        role: inviteRole, status: 'pending', invite_token: token
      }])
      setInviteEmail('')
      setFeedback({ type: 'ok', msg: `Invitasjon sendt til ${inviteEmail.trim()}` })
    } catch (err) {
      setFeedback({ type: 'err', msg: `Feil: ${err.message}` })
    }
    setSending(false)
  }

  const removeMember = async (memberId) => {
    if (!window.confirm('Fjerne dette medlemmet frå kontoret?')) return
    await supabase.from('office_members').delete().eq('id', memberId)
    setMembers(prev => prev.filter(m => m.id !== memberId))
  }

  const changeRole = async (memberId, newRole) => {
    await supabase.from('office_members').update({ role: newRole }).eq('id', memberId)
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m))
  }

  const saveOfficeName = async () => {
    if (!editName.trim() || !activeOfficeId) return
    await onUpdateOffice(activeOfficeId, { name: editName.trim(), color: editColor })
    setFeedback({ type: 'ok', msg: 'Kontor oppdatert' })
    setTimeout(() => setFeedback(null), 2000)
  }

  const s = {
    overlay: { position:'fixed', inset:0, zIndex:900, background:'rgba(0,0,0,.35)',
      display:'flex', alignItems:'flex-start', justifyContent:'flex-start', padding:'0' },
    panel:   { width:480, height:'100vh', background:'var(--bg2)', boxShadow:'var(--shadow-lg)',
      display:'flex', flexDirection:'column', overflow:'hidden' },
    header:  { background:'var(--brand)', padding:'20px 22px', display:'flex',
      alignItems:'center', justifyContent:'space-between', flexShrink:0 },
    tabs:    { display:'flex', borderBottom:'2px solid var(--border)',
      background:'var(--bg3)', flexShrink:0 },
    tab:     (active) => ({ flex:1, padding:'12px 0', border:'none', cursor:'pointer',
      background:active?'var(--bg2)':'transparent',
      color:active?'var(--brand)':'var(--text3)',
      fontSize:14, fontWeight:active?700:500,
      borderBottom:active?'2px solid var(--brand)':'2px solid transparent',
      marginBottom:'-2px' }),
    body:    { flex:1, overflowY:'auto', padding:'22px' },
    label:   { fontSize:11, fontWeight:700, color:'var(--text3)',
      textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5, display:'block' },
    input:   { width:'100%', padding:'9px 12px', border:'1.5px solid var(--border)',
      borderRadius:'var(--r)', fontSize:14, fontFamily:'var(--font)',
      background:'var(--bg)', color:'var(--text)', outline:'none' },
    btn:     (primary) => ({ padding:'9px 18px', border:'none', borderRadius:'var(--r)',
      fontSize:13, fontWeight:700, cursor:'pointer',
      background:primary?'var(--brand)':'var(--bg3)',
      color:primary?'#fff':'var(--text2)' }),
  }

  return (
    <div style={s.overlay}>
      <div ref={panelRef} style={s.panel}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <div style={{ fontSize:17, fontWeight:800, color:'#fff' }}>Innstillingar</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,.6)', marginTop:2 }}>
              {activeOffice?.name || 'Ingen kontor valt'}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background:'rgba(255,255,255,.15)', border:'none', borderRadius:6,
              color:'#fff', fontSize:18, fontWeight:700, cursor:'pointer',
              width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center' }}>
            ×
          </button>
        </div>

        {/* Tabs */}
        <div style={s.tabs}>
          <button style={s.tab(tab==='office')}  onClick={() => setTab('office')}>Kontor</button>
          <button style={s.tab(tab==='members')} onClick={() => setTab('members')}>Medlemmar</button>
          <button style={s.tab(tab==='profile')} onClick={() => setTab('profile')}>Min profil</button>
        </div>

        <div style={s.body}>
          {/* ── Kontor-fana ── */}
          {tab === 'office' && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <label style={s.label}>Namn</label>
                <input style={s.input} value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveOfficeName()}/>
              </div>
              <div>
                <label style={s.label}>Farge / tema</label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {OFFICE_COLORS.map(c => (
                    <button key={c.value} onClick={() => setEditColor(c.value)}
                      title={c.label}
                      style={{ width:36, height:36, borderRadius:9, background:c.value,
                        border:`3px solid ${editColor===c.value?'var(--text)':'transparent'}`,
                        cursor:'pointer', transition:'border .15s' }}/>
                  ))}
                </div>
              </div>
              <button onClick={saveOfficeName} style={{ ...s.btn(true), alignSelf:'flex-start' }}>
                Lagre endringar
              </button>
              {feedback && (
                <div style={{ fontSize:13, color: feedback.type==='ok' ? 'var(--success)' : 'var(--danger)',
                  fontWeight:600 }}>{feedback.msg}</div>
              )}

              {/* Other offices */}
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:16, marginTop:8 }}>
                <label style={s.label}>Alle kontor</label>
                {offices.map(o => (
                  <div key={o.id} style={{ display:'flex', alignItems:'center', gap:10,
                    padding:'8px 10px', borderRadius:'var(--r)', marginBottom:4,
                    background: o.id===activeOfficeId ? 'var(--brandbg)' : 'transparent' }}>
                    <span style={{ width:14, height:14, borderRadius:'50%',
                      background:o.color, flexShrink:0 }}/>
                    <span style={{ flex:1, fontSize:14, fontWeight: o.id===activeOfficeId ? 700 : 400 }}>
                      {o.name}
                    </span>
                    {offices.length > 1 && o.id !== activeOfficeId && (
                      <button onClick={() => {
                        if (window.confirm(`Slette kontoret «${o.name}»? Prosjekta blir ikkje sletta.`))
                          onDeleteOffice(o.id)
                      }}
                        style={{ background:'none', border:'none', color:'var(--text3)',
                          cursor:'pointer', fontSize:12 }}>Slett</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Medlemmar-fana ── */}
          {tab === 'members' && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              {isAdmin && (
                <div style={{ background:'var(--bg3)', borderRadius:'var(--r2)',
                  padding:'16px', display:'flex', flexDirection:'column', gap:10 }}>
                  <label style={s.label}>Inviter nytt medlem</label>
                  <input style={s.input} type="email" value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="epost@eksempel.no"
                    onKeyDown={e => e.key === 'Enter' && sendInvite()}/>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                      style={{ ...s.input, width:'auto', flex:1 }}>
                      <option value="member">Medlem</option>
                      <option value="admin">Administrator</option>
                    </select>
                    <button onClick={sendInvite} disabled={sending}
                      style={{ ...s.btn(true), whiteSpace:'nowrap',
                        opacity: sending ? 0.7 : 1 }}>
                      {sending ? 'Sender…' : 'Send invitasjon'}
                    </button>
                  </div>
                  {feedback && (
                    <div style={{ fontSize:13, fontWeight:600,
                      color: feedback.type==='ok' ? 'var(--success)' : 'var(--danger)' }}>
                      {feedback.msg}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label style={s.label}>Medlemmar ({members.length})</label>
                {loadingM ? (
                  <div style={{ color:'var(--text3)', fontSize:13 }}>Lastar…</div>
                ) : members.length === 0 ? (
                  <div style={{ color:'var(--text3)', fontSize:13 }}>
                    Ingen medlemmar enno. Send ei invitasjon!
                  </div>
                ) : (
                  members.map(m => (
                    <div key={m.id || m.invite_token}
                      style={{ display:'flex', alignItems:'center', gap:10,
                        padding:'10px 12px', borderRadius:'var(--r)',
                        border:'1px solid var(--border)', marginBottom:6,
                        background: m.status==='pending' ? 'var(--bg3)' : 'var(--bg2)' }}>
                      <div style={{ width:34, height:34, borderRadius:'50%',
                        background:'var(--brand)', display:'flex', alignItems:'center',
                        justifyContent:'center', color:'#fff', fontWeight:800,
                        fontSize:14, flexShrink:0 }}>
                        {(m.invited_email||'?')[0].toUpperCase()}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:600, color:'var(--text)',
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {m.invited_email}
                        </div>
                        <div style={{ fontSize:11, color:'var(--text3)', marginTop:1 }}>
                          {m.status === 'pending' ? 'Invitasjon sendt — ventar på aksept' : 'Aktiv'}
                        </div>
                      </div>
                      {isAdmin && (
                        <>
                          <select value={m.role}
                            onChange={e => m.id && changeRole(m.id, e.target.value)}
                            style={{ fontSize:12, padding:'4px 6px', borderRadius:5,
                              border:'1px solid var(--border)', background:'var(--bg)',
                              color:'var(--text)', cursor:'pointer' }}>
                            <option value="member">Medlem</option>
                            <option value="admin">Admin</option>
                          </select>
                          {m.user_id !== userId && (
                            <button onClick={() => m.id && removeMember(m.id)}
                              style={{ background:'none', border:'none',
                                color:'var(--text3)', cursor:'pointer', fontSize:18,
                                fontWeight:800, lineHeight:1 }}
                              onMouseEnter={e=>e.currentTarget.style.color='var(--danger)'}
                              onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}>
                              ×
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── Profil-fana ── */}
          {tab === 'profile' && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:14,
                padding:'16px', background:'var(--bg3)', borderRadius:'var(--r2)' }}>
                <div style={{ width:48, height:48, borderRadius:'50%',
                  background:'var(--brand)', display:'flex', alignItems:'center',
                  justifyContent:'center', color:'#fff', fontWeight:800, fontSize:20 }}>
                  {(userEmail||'?')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:'var(--text)' }}>
                    {userEmail}
                  </div>
                  <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>
                    {members.find(m=>m.user_id===userId)?.role === 'admin'
                      ? 'Administrator' : 'Medlem'}
                  </div>
                </div>
              </div>
              <div style={{ fontSize:13, color:'var(--text2)', lineHeight:1.6 }}>
                For å endre passord, bruk "Gløymt passord"-funksjonen på innloggingssida.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
