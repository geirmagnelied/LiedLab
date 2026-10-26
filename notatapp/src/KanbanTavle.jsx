import { useState, useRef, useLayoutEffect } from 'react'
import KanbanKort from './KanbanKort'
import { KOLONNER, FERDIG, kortIKolonne, wipOverskrid, finnOppgave, finnAktivitet, aktivitetNamn } from './kanbanLogikk'

// ═══════════════════════════════════════════════════════════════════
//  KanbanTavle — kolonnene, dra-og-slepp (HTML5, berre mus — «Flytt til…» på kvart kort er reserve for touch),
//  mjuk flytting av andre kort (FLIP) og WIP-indikator (jamn overgang til raud).
//  Nytt kort: «+» i kolonneoverskrifta eller dobbeltklikk på tomt område i kolonna (opnar kort-vindauget med kolonna førehandsvald).
//  Ei oppgåve/sak dratt frå «Kjelder»-panelet og sleppt i ei kolonne vert eit kort med lenkje (onKilde).
// ═══════════════════════════════════════════════════════════════════
export const KILDE_TYPE = 'application/x-kanban-kilde'
const CSS = `
.kb-kolonne{display:flex;flex-direction:column;min-width:0;flex:1 1 0;background:var(--bg2);border:1px solid var(--border);border-radius:12px;transition:background .2s,box-shadow .2s,border-color .2s}
.kb-kolonne.kb-mal{background:var(--brandbg);border-color:var(--brand);box-shadow:0 0 0 2px var(--brandbg)}
.kb-kort{background:var(--bg);border:1px solid var(--border);border-radius:9px;padding:10px 11px;cursor:default;
  transition:box-shadow .18s,transform .18s,border-color .4s,background .4s;box-shadow:0 1px 2px rgba(0,0,0,.05)}
.kb-kort:hover{box-shadow:0 6px 16px rgba(0,0,0,.12);transform:translateY(-2px) scale(1.012)}
.kb-kort.kb-dratt{opacity:.45;transform:scale(.97);box-shadow:none}
.kb-kort.kb-over{border-color:var(--danger,#c0392b);background:rgba(192,57,43,.06)}
.kb-inn{animation:kbInn .35s cubic-bezier(.2,.8,.2,1)}
.kb-sett{animation:kbSett .4s cubic-bezier(.3,1.4,.5,1)}
@keyframes kbInn{from{opacity:0;transform:translateY(-10px) scale(.97)}to{opacity:1;transform:none}}
@keyframes kbSett{0%{transform:scale(1.05);box-shadow:0 12px 28px rgba(0,0,0,.22)}100%{transform:none}}
.kb-flytt{border:1px solid var(--border);background:var(--bg2);color:var(--text3);border-radius:6px;font-size:10px;padding:1px 2px;max-width:22px;cursor:pointer;font-family:var(--font);opacity:.55}
.kb-flytt:hover{opacity:1;max-width:150px}
.kb-wip{font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;background:var(--bg3);color:var(--text2);transition:background .5s,color .5s}
.kb-wip.kb-rod{background:rgba(192,57,43,.16);color:var(--danger,#c0392b)}
.kb-plus{width:24px;height:24px;border-radius:7px;border:1.5px solid var(--border);background:var(--bg);color:var(--text2);font-size:16px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s,color .15s,border-color .15s}
.kb-plus:hover{background:var(--brand);color:#fff;border-color:var(--brand)}
`

export default function KanbanTavle({ kort, wipGrense, notes, planElement, nyeIds, sistFlytta, onApne, onFlytt, onNyttKort, onKilde }) {
  const [draId, setDraId] = useState(null)
  const [overKol, setOverKol] = useState(null)
  const [overIdx, setOverIdx] = useState(null)
  const rot = useRef(null)
  const pos = useRef(new Map())

  // FLIP: kort som skiftar plass glir mjukt til den nye plassen
  useLayoutEffect(() => {
    if (!rot.current) return
    rot.current.querySelectorAll('[data-kort]').forEach(el => {
      const r = el.getBoundingClientRect(); const id = el.dataset.kort; const p = pos.current.get(id)
      if (p && (Math.abs(p.top - r.top) > 1 || Math.abs(p.left - r.left) > 1)) {
        el.style.transition = 'none'; el.style.transform = `translate(${p.left - r.left}px,${p.top - r.top}px)`
        requestAnimationFrame(() => { el.style.transition = 'transform .28s cubic-bezier(.2,.8,.2,1)'; el.style.transform = '' })
      }
      pos.current.set(id, { top: r.top, left: r.left })
    })
  })

  const startDra = (e, k) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(k.id)); setTimeout(() => setDraId(k.id), 0) }
  const sluttDra = () => { setDraId(null); setOverKol(null); setOverIdx(null) }
  const erKilde = (e) => [...(e.dataTransfer?.types || [])].includes(KILDE_TYPE)
  const overKolonne = (e, status) => {
    const kilde = erKilde(e)
    if (draId == null && !kilde) return
    if (kilde && status === 'ferdig') return
    e.preventDefault(); e.dataTransfer.dropEffect = kilde ? 'copy' : 'move'
    const kortEl = [...e.currentTarget.querySelectorAll('[data-kort]')].filter(el => el.dataset.kort !== String(draId))
    let idx = kortEl.length
    for (let i = 0; i < kortEl.length; i++) { const r = kortEl[i].getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { idx = i; break } }
    if (overKol !== status) setOverKol(status)
    if (overIdx !== idx) setOverIdx(idx)
  }
  const slepp = (e, status) => {
    e.preventDefault()
    const idx = overKol === status ? overIdx : null
    if (erKilde(e)) {
      try { onKilde(status, JSON.parse(e.dataTransfer.getData(KILDE_TYPE)), idx) } catch { /* ugyldig data */ }
      sluttDra(); return
    }
    const id = draId != null ? draId : Number(e.dataTransfer.getData('text/plain'))
    if (id) onFlytt(id, status, idx)
    sluttDra()
  }

  const lenkjerFor = (k) => {
    const l = []
    if (k.dtm_ref) l.push({ t: 'D', tittel: 'Leveranse frå DTM — status følgjer leveranselista' })
    if (k.sak_id) l.push({ t: 'S', tittel: 'Lenkja til sak' })
    const o = finnOppgave(notes, k.oppgave_ref); if (k.oppgave_ref) l.push({ t: 'O', tittel: o ? `Oppgåve: ${o.task.text}` : 'Lenkja til oppgåve' })
    const a = finnAktivitet(planElement, k.framdrift_aktivitet_ref); if (k.framdrift_aktivitet_ref) l.push({ t: 'A', tittel: a ? `Framdrift: ${aktivitetNamn(a)}` : 'Lenkja til Framdrift-aktivitet' })
    return l
  }

  const ferdigAntal = kort.filter(k => k.status === 'ferdig').length

  return (
    <div ref={rot} style={{ flex: 1, display: 'flex', gap: 12, padding: '16px 20px', overflowX: 'auto', minHeight: 0, minWidth: 0 }}>
      <style>{CSS}</style>
      {KOLONNER.map(kol => {
        const liste = kortIKolonne(kort, kol.key)
        const over = kol.wip ? wipOverskrid(liste, wipGrense) : []
        const overNamn = new Set(over.map(o => o.namn))
        const visAntal = liste.filter(k => k.id !== draId).length
        let vi = 0
        return (
          <div key={kol.key} className={'kb-kolonne' + (overKol === kol.key ? ' kb-mal' : '')} style={{ minWidth: 210 }}
            onDragOver={e => overKolonne(e, kol.key)} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) { setOverKol(null); setOverIdx(null) } }}
            onDrop={e => slepp(e, kol.key)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 10px 9px 12px', borderLeft: `4px solid ${kol.farge}`, borderRadius: '12px 0 0 0' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', flex: 1, minWidth: 0 }}>{kol.label}</span>
              <span className={'kb-wip' + (over.length ? ' kb-rod' : '')}
                title={over.length ? 'Over WIP-grensa (' + wipGrense + '): ' + over.map(o => `${o.namn} ${o.n}`).join(', ') : (kol.wip && wipGrense ? 'WIP-grense per person: ' + wipGrense : '')}>
                {over.length ? '⚠ ' : ''}{liste.length}
              </span>
              <button className="kb-plus" title="Nytt kort i denne kolonna" onClick={() => onNyttKort(kol.key)}>+</button>
            </div>
            <div onDoubleClick={e => { if (e.target === e.currentTarget) onNyttKort(kol.key) }}
              title={liste.length ? '' : 'Dobbeltklikk for nytt kort'}
              style={{ flex: 1, overflowY: 'auto', padding: '2px 10px 12px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 80 }}>
              {liste.map((k) => {
                const erDratt = k.id === draId
                const markor = !erDratt && overKol === kol.key && overIdx === vi
                if (!erDratt) vi++
                return (
                  <div key={k.id} style={{ display: 'contents' }}>
                    {markor && <div style={{ height: 3, borderRadius: 2, background: 'var(--brand)', flexShrink: 0 }}/>}
                    <KanbanKort k={k} overskrid={overNamn.has((k.ansvarleg || '').trim())} dratt={erDratt} nytt={nyeIds.has(k.id)} sett={sistFlytta === k.id}
                      lenkjer={lenkjerFor(k)} onApne={onApne} onFlytt={onFlytt} onDragStart={startDra} onDragEnd={sluttDra}/>
                  </div>
                )
              })}
              {overKol === kol.key && overIdx === visAntal && <div style={{ height: 3, borderRadius: 2, background: 'var(--brand)', flexShrink: 0 }}/>}
              {!liste.length && overKol !== kol.key && <div style={{ fontSize: 11.5, color: 'var(--text3)', textAlign: 'center', padding: '14px 4px', pointerEvents: 'none', opacity: .7 }}>Dobbeltklikk for nytt kort</div>}
            </div>
          </div>
        )
      })}

      {/* Smal slepp-sone: ferdigstilte kort går til arkivet */}
      <div className={'kb-kolonne' + (overKol === 'ferdig' ? ' kb-mal' : '')} style={{ flex: '0 0 112px', alignItems: 'center', justifyContent: 'center', gap: 8, textAlign: 'center', padding: 10, borderStyle: 'dashed', borderLeft: `4px solid ${FERDIG.farge}` }}
        onDragOver={e => overKolonne(e, 'ferdig')} onDrop={e => slepp(e, 'ferdig')}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) { setOverKol(null); setOverIdx(null) } }}>
        <div style={{ fontSize: 22 }}>✓</div>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text)' }}>Ferdigstilt</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.4 }}>Slepp her — kortet går til arkivet ({ferdigAntal})</div>
      </div>
    </div>
  )
}
