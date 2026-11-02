import { STATUS_LABELS, STATUS_COLORS, PRIO_LABELS, caseNoText, fmtDateShort } from './sakerKonstantar'
import { opneVedlegg } from './vedlegg'
import { Pille } from './DataTabell'

// ═══════════════════════════════════════════════════════════════════
//  Førehandsvising til høgre i Saksbehandling (som notat-førehandsvisinga, NotePreview):
//  markert sak eller oppgåve vert vist skriveverna her; dobbeltklikk/«Opne» gjev full redigering.
//  Notat brukar NotePreview direkte.
// ═══════════════════════════════════════════════════════════════════

const KNAPP = { padding: '6px 12px', borderRadius: 'var(--r)', border: '1.5px solid var(--brand2)', background: 'var(--brandbg)', color: 'var(--brand)', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'var(--font)' }
const ETIKETT = { fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }

export function TomForhandsvising() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
      <p style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.7, maxWidth: 230 }}>Vel ei rad i tabellen (sak, oppgåve eller notat) for å sjå innhaldet her</p>
    </div>
  )
}

function Hovud({ tittel, merke, merkeFarge, under, knappar }) {
  return (
    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.35, wordBreak: 'break-word' }}>{tittel}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: merkeFarge || 'var(--brandbg)', color: merkeFarge ? '#fff' : 'var(--brand)', textTransform: 'uppercase', letterSpacing: '.03em' }}>{merke}</span>
            {under}
          </div>
        </div>
        {knappar}
      </div>
    </div>
  )
}

function Felt({ namn, verdi }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 2 }}>{namn}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{verdi || '—'}</div>
    </div>
  )
}

export function SakForhandsvising({ c, comments = [], notat = [], onOpne, onToggleOppgave, onOpenOppgave, onVelgRad }) {
  const oppgaver = (c.linkedTasks || []).map(l => {
    const n = notat.find(x => String(x.id) === String(l.noteId)); const t = (n?.tasks || []).find(x => String(x.id) === String(l.taskId))
    return t ? { ...t, noteId: n.id } : null
  }).filter(Boolean)
  const lenkjaNotat = (c.linkedNotes || []).map(id => notat.find(n => String(n.id) === String(id))).filter(Boolean)
  const sisteKommentarar = comments.filter(cm => !cm.system).slice(-3)
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Hovud tittel={c.title} merke={'Sak ' + caseNoText(c.number)} merkeFarge="#1F6B4A"
        under={<Pille tekst={STATUS_LABELS[c.status] || c.status} farge={STATUS_COLORS[c.status]}/>}
        knappar={<button onClick={onOpne} style={KNAPP}>Opne</button>}/>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
        {c.description && <div style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--text)', whiteSpace: 'pre-wrap', marginBottom: 16 }}>{c.description}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 16px', padding: '12px 14px', background: 'var(--bg3)', borderRadius: 'var(--r)' }}>
          <Felt namn="Ansvarleg" verdi={c.ansvarlig}/>
          <Felt namn="Frist" verdi={fmtDateShort(c.frist)}/>
          <Felt namn="Fag" verdi={c.fag}/>
          <Felt namn="Prioritet" verdi={PRIO_LABELS[c.prioritet]}/>
        </div>
        {oppgaver.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={ETIKETT}>Oppgåver i saka</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {oppgaver.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'var(--bg3)', borderRadius: 'var(--r)' }}>
                  <input type="checkbox" checked={!!t.done} onChange={e => onToggleOppgave?.(t.noteId, t.id, e.target.checked)}/>
                  <span onClick={() => onOpenOppgave?.('O' + t.noteId + '_' + t.id)} style={{ flex: 1, fontSize: 12.5, cursor: 'pointer', textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? .55 : 1 }}>{t.text}</span>
                  {t.date && <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>{fmtDateShort(t.date)}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        {lenkjaNotat.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={ETIKETT}>Kopla notat</div>
            {lenkjaNotat.map(n => (
              <div key={n.id} onClick={() => onVelgRad?.('N' + n.id)} style={{ fontSize: 12.5, color: 'var(--brand)', cursor: 'pointer', padding: '3px 0' }}>{n.title || n.text?.slice(0, 50) || 'Notat'}</div>
            ))}
          </div>
        )}
        {(c.attachments || []).length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={ETIKETT}>Vedlegg</div>
            {c.attachments.map((att, i) => (
              <a key={i} href={att.url} target="_blank" rel="noreferrer" onClick={e => opneVedlegg(e, att)}
                style={{ display: 'block', fontSize: 12.5, color: 'var(--brand)', textDecoration: 'none', padding: '2px 0' }}>{att.name}</a>
            ))}
          </div>
        )}
        {sisteKommentarar.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={ETIKETT}>Siste kommentarar</div>
            {sisteKommentarar.map(cm => (
              <div key={cm.id} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}><b>{cm.author}</b></div>
                <div style={{ fontSize: 12.5, color: 'var(--text2)', background: 'var(--bg3)', padding: '7px 10px', borderRadius: 'var(--r)', lineHeight: 1.5 }}>{cm.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function OppgaveForhandsvising({ rad, onToggle, onRediger, onVelgRad }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Hovud tittel={rad.title} merke="Oppgåve" merkeFarge="#4EADA3"
        under={<Pille tekst={rad.statusLabel} farge={rad.statusFarge}/>}
        knappar={<button onClick={onRediger} style={KNAPP}>Rediger</button>}/>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 16 }}>
          <input type="checkbox" checked={!!rad.ferdig} onChange={e => onToggle?.(rad.noteId, rad.id, e.target.checked)}/> Ferdig
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 16px', padding: '12px 14px', background: 'var(--bg3)', borderRadius: 'var(--r)' }}>
          <Felt namn="Ansvarleg" verdi={rad.ansvarlig}/>
          <Felt namn="Frist" verdi={fmtDateShort(rad.frist)}/>
          <Felt namn="Nr" verdi={rad.number}/>
          <Felt namn="Sak" verdi={rad.sakNr ? 'Sak ' + rad.sakNr : ''}/>
        </div>
        {rad.noteTittel && (
          <div style={{ marginTop: 18 }}>
            <div style={ETIKETT}>Ligg i notat</div>
            <div onClick={() => onVelgRad?.('N' + rad.noteId)} style={{ fontSize: 12.5, color: 'var(--brand)', cursor: 'pointer' }}>{rad.noteTittel}</div>
          </div>
        )}
      </div>
    </div>
  )
}
