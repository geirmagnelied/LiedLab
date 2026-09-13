import { fmtDateShort } from './sakerKonstantar'

// ═══════════════════════════════════════════════════════════════════
//  NotePreview — skriveverna førehandsvisning av notatet som er
//  markert (enkeltklikka) i NoteTabell. Venstre halvdel av den todelte
//  dashboard-visinga i notatmodulen (sjå claude/notatmodul-tabellvisning.md).
//  Oppgåvene sine avkryssingsboksar er interaktive (via onUpdateTask),
//  elles er visinga rein lesevising — full redigering skjer via
//  «Rediger»-knappen, som opnar NoteModal (same som dobbeltklikk i tabellen).
// ═══════════════════════════════════════════════════════════════════

function typeFor(n) {
  if (n.isMeeting) return 'Møte'
  if (n.isReferat) return 'Referat'
  return 'Notat'
}
function tittelFor(n) {
  return n.title || n.text?.substring(0, 60) || 'Utan tittel'
}

export default function NotePreview({ note, projects, onEdit, onUpdateTask }) {
  if (!note) {
    return (
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
        padding:24, textAlign:'center' }}>
        <p style={{ fontSize:13, color:'var(--text3)', lineHeight:1.7, maxWidth:220 }}>
          Vel eit notat i tabellen for å sjå innhaldet her
        </p>
      </div>
    )
  }

  const prosjekt = note.projectId ? (projects || []).find(p => p.id === note.projectId) : null

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:15, fontWeight:700, color:'var(--text)', lineHeight:1.35,
              wordBreak:'break-word' }}>
              {tittelFor(note)}
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:6, alignItems:'center' }}>
              <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 8px', borderRadius:20,
                background:'var(--brandbg)', color:'var(--brand)', textTransform:'uppercase',
                letterSpacing:'.03em' }}>
                {typeFor(note)}
              </span>
              {prosjekt && (
                <span style={{ fontSize:12, color:'var(--text3)' }}>{prosjekt.name}</span>
              )}
            </div>
          </div>
          <button onClick={() => onEdit?.(note)}
            style={{ padding:'6px 12px', borderRadius:'var(--r)', border:'1.5px solid var(--brand2)',
              background:'var(--brandbg)', color:'var(--brand)', fontWeight:700, fontSize:12,
              cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
            Rediger
          </button>
        </div>
        <div style={{ display:'flex', gap:14, marginTop:10, fontSize:11, color:'var(--text3)' }}>
          <span>Nr. {note.nr ?? '—'}</span>
          <span>Registrert {fmtDateShort(note.createdAt)}</span>
          <span>Endra {fmtDateShort(note.updatedAt || note.createdAt)}</span>
        </div>
      </div>

      {note.isMeeting && (
        <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--border)',
          background:'var(--bg3)', flexShrink:0, fontSize:12.5, color:'var(--text2)',
          display:'flex', flexDirection:'column', gap:4 }}>
          {note.meetingTime && (
            <div><b>Tidspunkt:</b> {new Date(note.meetingTime).toLocaleString('no-NO',
              { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</div>
          )}
          {note.meetingLocation && <div><b>Stad:</b> {note.meetingLocation}</div>}
          {note.attendees?.length > 0 && <div><b>Deltakarar:</b> {note.attendees.join(', ')}</div>}
        </div>
      )}

      <div style={{ flex:1, overflowY:'auto', padding:'16px 18px' }}>
        {note.html
          ? <div style={{ fontSize:13.5, lineHeight:1.7, color:'var(--text)' }}
              dangerouslySetInnerHTML={{ __html: note.html }}/>
          : note.text
            ? <div style={{ fontSize:13.5, lineHeight:1.7, color:'var(--text)', whiteSpace:'pre-wrap' }}>{note.text}</div>
            : <div style={{ fontSize:12.5, color:'var(--text3)', fontStyle:'italic' }}>Ingen tekst i notatet</div>}

        {note.tasks?.length > 0 && (
          <div style={{ marginTop:20 }}>
            <div style={{ fontSize:10.5, fontWeight:700, color:'var(--text3)', textTransform:'uppercase',
              letterSpacing:'.05em', marginBottom:8 }}>
              Arbeidsoppgåver
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {note.tasks.map(t => (
                <div key={t.id} style={{ display:'flex', alignItems:'center', gap:8,
                  padding:'6px 8px', background:'var(--bg3)', borderRadius:'var(--r)' }}>
                  <button onClick={() => onUpdateTask?.(note.id, t.id, { done: !t.done })}
                    style={{ width:16, height:16, borderRadius:4, flexShrink:0,
                      border:`2px solid ${t.done ? 'var(--success)' : 'var(--border2)'}`,
                      background: t.done ? 'var(--success)' : 'transparent',
                      cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {t.done && <span style={{color:'#fff',fontWeight:900,fontSize:9}}>✓</span>}
                  </button>
                  <span style={{ flex:1, fontSize:12.5, color:'var(--text)',
                    textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? .55 : 1 }}>
                    {t.text}
                  </span>
                  {t.date && <span style={{ fontSize:10.5, color:'var(--text3)' }}>{fmtDateShort(t.date)}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {note.attachments?.length > 0 && (
          <div style={{ marginTop:20 }}>
            <div style={{ fontSize:10.5, fontWeight:700, color:'var(--text3)', textTransform:'uppercase',
              letterSpacing:'.05em', marginBottom:8 }}>
              Vedlegg
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {note.attachments.map((att, i) => (
                <a key={i} href={att.url} target="_blank" rel="noreferrer"
                  style={{ fontSize:12.5, color:'var(--brand)', textDecoration:'none' }}>
                  {att.name}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
