import { useState } from 'react'
import { KILDE_TYPE } from './KanbanTavle'

// ═══════════════════════════════════════════════════════════════════
//  KanbanKilder — sidepanel med opne oppgåver (frå notat) og saker i prosjektet. Dra ei oppgåve/sak inn i ei kolonne
//  på tavla for å lage eit kort lenkja til henne (berre referanse). Allereie lenkja element vert skjulte.
// ═══════════════════════════════════════════════════════════════════
export default function KanbanKilder({ notes, saker, kort, onLukk }) {
  const [fane, setFane] = useState('oppgaver')
  const lenkjaOppg = new Set(kort.filter(k => k.oppgave_ref).map(k => `${k.oppgave_ref.note_id}|${k.oppgave_ref.task_id}`))
  const lenkjaSak = new Set(kort.filter(k => k.sak_id).map(k => k.sak_id))
  const oppgaver = []
  for (const n of (notes || [])) for (const t of (n.tasks || [])) if (!t.done && !lenkjaOppg.has(`${n.id}|${t.id}`)) oppgaver.push({ n, t })
  const sakerFri = (saker || []).filter(s => !lenkjaSak.has(s.id) && !s.deleted_at && !/lukka|ferdig|avslutta/i.test(s.status || ''))

  const start = (e, payload) => { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData(KILDE_TYPE, JSON.stringify(payload)); e.dataTransfer.setData('text/plain', payload.tittel) }
  const TAB = (a) => ({ flex: 1, padding: '7px 6px', border: 'none', borderBottom: '2px solid ' + (a ? '#0A0A0A' : 'transparent'), background: 'none', color: a ? 'var(--text)' : 'var(--text3)', fontWeight: a ? 700 : 500, fontSize: 12.5, cursor: 'pointer', fontFamily: 'var(--font)' })
  const RAD = { padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', fontSize: 12.5, color: 'var(--text)', lineHeight: 1.35, cursor: 'default' }

  return (
    <div style={{ width: 270, flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border)', background: 'var(--bg2)', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px 0 14px' }}>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Kjelder</span>
        <button onClick={onLukk} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--text3)', cursor: 'pointer' }}>×</button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', padding: '2px 14px 8px', lineHeight: 1.4 }}>Dra ei oppgåve eller sak inn i ei kolonne for å lage eit kort.</div>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        <button style={TAB(fane === 'oppgaver')} onClick={() => setFane('oppgaver')}>Oppgåver ({oppgaver.length})</button>
        <button style={TAB(fane === 'saker')} onClick={() => setFane('saker')}>Saker ({sakerFri.length})</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {fane === 'oppgaver' && (oppgaver.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text3)', padding: 8 }}>Ingen opne oppgåver i prosjektet.</div> : oppgaver.map(({ n, t }) => (
          <div key={n.id + '|' + t.id} draggable style={RAD}
            onDragStart={e => start(e, { type: 'oppgave', note_id: n.id, task_id: t.id, tittel: t.text, frist: t.date || null })}>
            <div style={{ fontWeight: 600 }}>{t.text}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{n.title || 'Notat'}{t.date ? ' · ⏱ ' + t.date : ''}</div>
          </div>)))}
        {fane === 'saker' && (sakerFri.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text3)', padding: 8 }}>Ingen opne saker i prosjektet.</div> : sakerFri.map(s => (
          <div key={s.id} draggable style={RAD}
            onDragStart={e => start(e, { type: 'sak', sak_id: s.id, tittel: (s.number ? s.number + ' ' : '') + s.title, ansvarleg: s.ansvarlig || '', frist: s.frist || null })}>
            <div style={{ fontWeight: 600 }}>{s.number ? s.number + ' ' : ''}{s.title}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{[s.ansvarlig, s.frist && '⏱ ' + s.frist].filter(Boolean).join(' · ')}</div>
          </div>)))}
      </div>
    </div>
  )
}
