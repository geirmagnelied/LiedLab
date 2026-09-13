import { useRef, useState } from 'react'
import NoteInput from './NoteInput'

// ═══════════════════════════════════════════════════════════════════
//  NoteModal — flytande vindauge for å opprette/redigere notat, møte,
//  referat og oppgåver. Same visuelle mønster som dei flytande
//  vindauga i saksmodulen (SakerModule.jsx: NewCaseModal/CaseDetailModal).
//
//  Sjølve skjemaet (NoteInput) autolagrar fortløpande som før — denne
//  komponenten legg berre eit flytande vindauge rundt det, med ein
//  eksplisitt X-knapp. Dersom brukar trykkjer X medan det finst ei
//  endring som enno ikkje er stadfesta lagra (NoteInput sitt
//  onDirtyChange-signal), vert det spurt om brukar vil lagre først,
//  i staden for å lukke stille.
// ═══════════════════════════════════════════════════════════════════

const SIZE_KEY = 'liedlab-notemodal-size'
const MIN_W = 420, MIN_H = 360

export default function NoteModal(props) {
  const { editNote, isMeeting, isReferat, isTaskOnly, onCancelEdit } = props
  const innerRef = useRef(null)
  const [dirty, setDirty] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)

  // ── Justerbar storleik ────────────────────────────────────────────
  // Bruker eit eige, dragbart hjørne (nedst til høgre) i staden for CSS
  // sin innebygde `resize`-eigenskap, som synte seg upåliteleg å bruke i
  // praksis (verka som vindauget berre hadde éin storleik). Storleiken
  // vert hugsa i localStorage til neste gong eit notat vert opna.
  const [size, setSize] = useState(() => {
    try {
      const lagra = JSON.parse(localStorage.getItem(SIZE_KEY))
      if (lagra && lagra.w > 0 && lagra.h > 0) return lagra
    } catch { /* privat modus */ }
    return {
      w: Math.min(1040, Math.round(window.innerWidth * 0.94)),
      h: Math.min(820, Math.round(window.innerHeight * 0.92)),
    }
  })

  const startResize = (e) => {
    e.preventDefault()
    const startX = e.clientX, startY = e.clientY
    const startW = size.w, startH = size.h
    const flytt = (ev) => {
      const w = Math.max(MIN_W, Math.min(Math.round(window.innerWidth * 0.97), Math.round(startW + (ev.clientX - startX))))
      const h = Math.max(MIN_H, Math.min(Math.round(window.innerHeight * 0.97), Math.round(startH + (ev.clientY - startY))))
      setSize({ w, h })
    }
    const slepp = () => {
      window.removeEventListener('mousemove', flytt)
      window.removeEventListener('mouseup', slepp)
      document.body.style.cursor = ''
      setSize(s => { try { localStorage.setItem(SIZE_KEY, JSON.stringify(s)) } catch { /* privat modus */ } ; return s })
    }
    document.body.style.cursor = 'nwse-resize'
    window.addEventListener('mousemove', flytt)
    window.addEventListener('mouseup', slepp)
  }

  const tittel = editNote ? 'Rediger notat'
    : isTaskOnly ? 'Ny oppgåve'
    : isReferat  ? 'Nytt referat'
    : isMeeting  ? 'Nytt møte'
    : 'Nytt notat'

  const requestClose = () => {
    if (dirty) { setConfirmClose(true); return }
    onCancelEdit?.()
  }
  const saveAndClose = async () => {
    await innerRef.current?.save?.()
    setConfirmClose(false)
    // For redigering av eksisterande notat kallar sjølve lagringa
    // (onAutoSave-vegen i NoteInput) alt onCancelEdit — berre kall han
    // her for dei tilfella der det ikkje skjer automatisk (nytt notat/
    // møte/referat/oppgåve).
    if (!editNote) onCancelEdit?.()
  }
  const closeWithoutSaving = () => {
    setConfirmClose(false)
    onCancelEdit?.()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.42)', display:'flex',
      alignItems:'center', justifyContent:'center', zIndex:200 }}>
      <div style={{ background:'var(--bg2)', borderRadius:'var(--r2)',
        width:size.w, height:size.h,
        minWidth:MIN_W, minHeight:MIN_H, maxWidth:'97vw', maxHeight:'97vh',
        overflow:'hidden', display:'flex', flexDirection:'column',
        boxShadow:'0 24px 70px rgba(0,0,0,.35)', position:'relative' }}>

        {/* Head */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 20px',
          borderBottom:'1px solid rgba(255,255,255,.12)', flexShrink:0, background:'var(--brand)' }}>
          <span style={{ fontSize:15, fontWeight:800, color:'#fff' }}>{tittel}</span>
          <div style={{ flex:1 }}/>
          <button onClick={requestClose} title="Lukk"
            style={{ background:'none', border:'none', fontSize:22, cursor:'pointer',
              color:'rgba(255,255,255,.85)', lineHeight:1, padding:'2px 6px' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>
          <NoteInput ref={innerRef} {...props} onDirtyChange={setDirty}/>
        </div>

        {/* Dragbart hjørne — endrar storleiken på heile vindauget */}
        <div onMouseDown={startResize} title="Dra for å endre storleiken på vindauget"
          style={{ position:'absolute', right:0, bottom:0, width:20, height:20,
            cursor:'nwse-resize', zIndex:20,
            backgroundImage:'repeating-linear-gradient(135deg, var(--text3) 0, var(--text3) 1.5px, transparent 1.5px, transparent 5px)',
            opacity:.55, WebkitMaskImage:'linear-gradient(315deg, black 0 45%, transparent 46%)',
            maskImage:'linear-gradient(315deg, black 0 45%, transparent 46%)' }}/>

        {/* Stadfestingsdialog — vises berre om det finst ulagra endringar når X vert trykt */}
        {confirmClose && (
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.35)',
            display:'flex', alignItems:'center', justifyContent:'center', zIndex:10 }}>
            <div style={{ background:'var(--bg2)', borderRadius:'var(--r2)', padding:'22px 26px',
              width:320, boxShadow:'0 16px 50px rgba(0,0,0,.35)', border:'1px solid var(--border)' }}>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:8, color:'var(--text)' }}>
                Du har ulagra endringar
              </div>
              <div style={{ fontSize:13, color:'var(--text2)', marginBottom:18, lineHeight:1.5 }}>
                Vil du lagre før du lukkar vindauget?
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <button onClick={saveAndClose}
                  style={{ padding:'9px 16px', borderRadius:'var(--r)', border:'none',
                    background:'var(--brand)', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                  Lagre og lukk
                </button>
                <button onClick={closeWithoutSaving}
                  style={{ padding:'9px 16px', borderRadius:'var(--r)', border:'1.5px solid var(--border)',
                    background:'var(--bg2)', color:'var(--text2)', fontWeight:600, fontSize:13, cursor:'pointer' }}>
                  Lukk utan å lagre
                </button>
                <button onClick={() => setConfirmClose(false)}
                  style={{ padding:'8px 16px', border:'none', background:'none',
                    color:'var(--text3)', fontSize:12.5, cursor:'pointer' }}>
                  Avbryt
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
