import { useState, useRef } from 'react'
import DatePicker from './DatePicker'
import FlyttbartModal, { FELT, ETT } from './FlyttbartModal'
import PersonVelger from './PersonVelger'
import OppgaveInnfoering, { OppgaveRad } from './OppgaveInnfoering'
import { FAG, PRIO_LABELS } from './sakerKonstantar'

// ═══════════════════════════════════════════════════════════════════
//  NySakModal — «Ny sak»: flytande vindauge som kan flyttast og skaleres (mørk blå toppline med X), same inndatadesign som elles i appen.
//  Oppgåver kan leggjast inn direkte i saka med same inndata som «Ny oppgåve» (OppgaveInnfoering) — dei vert vanlege oppgåver (notat-oppgåver) lenkja til saka, ikkje Kanban-kort.
//  Vedlegg-delen ligg til høgre og kan ekspanderast.
//  Utkastet vert lagra fortløpande i localStorage; X/Lukk åtvarar om at saka ikkje er lagra (opprett ho med «Opprett sak» nede til venstre).
// ═══════════════════════════════════════════════════════════════════
const DRAFT_KEY = 'liedlab-saker-newcase-draft'
const emptyDraft = { title: '', description: '', fag: FAG[0], prioritet: 'normal', ansvarlig: '', involverte: [], frist: '', oppgaver: [] }

export default function NySakModal({ nextNumber, personnel, meg = '', onClose, onCreate }) {
  const [fields, setFields] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY))
      return saved && typeof saved === 'object' ? { ...emptyDraft, ...saved } : { ...emptyDraft }
    } catch { return { ...emptyDraft } }
  })
  const [involvertInput, setInvolvertInput] = useState('')
  const [stagedFiles, setStagedFiles] = useState([])
  const [dragActive, setDragActive] = useState(false)
  const [oppretter, setOppretter] = useState(false)
  const [vedleggOpen, setVedleggOpen] = useState(false)
  const oppgRef = useRef(null)
  const fileInputRef = useRef(null)

  const set = (key, val) => setFields(f => {
    const next = { ...f, [key]: val }
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(next)) } catch { /* privat modus */ }
    return next
  })
  const oppgaver = (fields.oppgaver || []).filter(o => o.text) // eldre utkast kan ha gammalt format

  const addInvolvert = (name) => {
    const n = (name || '').trim()
    if (!n || fields.involverte.includes(n)) return
    set('involverte', [...fields.involverte, n]); setInvolvertInput('')
  }
  const handleFiles = (files) => { if (files && files.length) setStagedFiles(prev => [...prev, ...files]) }
  const handlePaste = (e) => {
    for (const item of (e.clipboardData?.items || [])) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) { e.preventDefault(); handleFiles([new File([file], `utklipp_${Date.now()}.png`, { type: file.type })]) }
      }
    }
  }

  const hasDraftContent = fields.title || fields.description || fields.ansvarlig || fields.involverte.length > 0 || fields.frist
    || stagedFiles.length > 0 || oppgaver.length > 0

  const lukk = () => {
    if (hasDraftContent && !window.confirm('Saka er ikkje lagra!\n\nTrykk «Avbryt» for å bli i vindauget og opprette saka. Trykk «OK» for å lukke utan å opprette saka (utkastet vert hugsa til neste gong).')) return
    onClose()
  }
  const opprett = async () => {
    if (oppretter) return
    setOppretter(true)
    try {
      const vent = oppgRef.current?.hentVentande()
      const ok = await onCreate({ ...fields, oppgaver: vent ? [...oppgaver, vent] : oppgaver }, stagedFiles)
      if (ok !== false) { try { localStorage.removeItem(DRAFT_KEY) } catch { /* privat modus */ } }
    } finally { setOppretter(false) }
  }
  const discardDraft = () => {
    if (!window.confirm('Forkaste utkastet? Alt du har fylt ut i dette skjemaet går tapt.')) return
    try { localStorage.removeItem(DRAFT_KEY) } catch { /* privat modus */ }
    setFields({ ...emptyDraft }); setStagedFiles([])
  }

  const SMA = { padding: '7px 14px', borderRadius: 7, fontSize: 12.5, fontFamily: 'var(--font)', cursor: 'pointer' }

  return (
    <FlyttbartModal tittel={`Ny sak — nr ${nextNumber}`} onLukk={lukk} lagringsNokkel="liedlab-nysak-vindauge-v2" breidd={860} hogd={760} minW={520} minH={420}
      hogre={hasDraftContent ? <span style={{ fontSize: 11, color: 'rgba(255,255,255,.8)', background: 'rgba(255,255,255,.14)', padding: '3px 9px', borderRadius: 20, fontWeight: 600 }}>Utkast lagra fortløpande</span> : null}
      bunn={<>
        <button onClick={opprett} disabled={oppretter || !fields.title.trim()} style={{ ...SMA, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 700, opacity: (oppretter || !fields.title.trim()) ? .55 : 1 }}>{oppretter ? 'Opprettar…' : 'Opprett sak'}</button>
        <button onClick={lukk} style={{ ...SMA, border: '1.5px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)', fontWeight: 600 }}>Lukk</button>
        <div style={{ flex: 1 }}/>
        {hasDraftContent && <button onClick={discardDraft} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)', textDecoration: 'underline' }}>Forkast utkast</button>}
      </>}>
      <div onPaste={handlePaste} style={{ flex: 1, display: 'flex', flexWrap: 'nowrap', minHeight: 0 }}>
        <div style={{ flex: '1 1 380px', minWidth: 0, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 13, boxSizing: 'border-box', overflowY: 'auto' }}>
          <label><span style={ETT}>Tittel</span>
            <input autoFocus value={fields.title} onChange={e => set('title', e.target.value)} placeholder="Kort, beskrivande tittel" style={{ ...FELT, fontWeight: 600 }}/></label>
          <label><span style={ETT}>Skildring</span>
            <textarea rows={5} value={fields.description} onChange={e => set('description', e.target.value)} placeholder="Beskriv problemstillinga i detalj" style={{ ...FELT, resize: 'vertical' }}/></label>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <label><span style={ETT}>Ansvarleg</span>
              <PersonVelger value={fields.ansvarlig} onChange={v => set('ansvarlig', v)} personar={personnel}/></label>
            <label><span style={ETT}>Frist</span><DatePicker value={fields.frist} onChange={v => set('frist', v)} style={FELT}/></label>
            <label><span style={ETT}>Fag</span>
              <select value={fields.fag} onChange={e => set('fag', e.target.value)} style={FELT}>{FAG.map(f => <option key={f}>{f}</option>)}</select></label>
            <label><span style={ETT}>Prioritet</span>
              <select value={fields.prioritet} onChange={e => set('prioritet', e.target.value)} style={FELT}>{Object.entries(PRIO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          </div>

          <div>
            <span style={ETT}>Involverte</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input list="saker-personnel-list" value={involvertInput} onChange={e => setInvolvertInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addInvolvert(involvertInput) } }}
                placeholder="Vel eller skriv namn, Enter for å legge til" style={FELT}/>
              <button type="button" onClick={() => addInvolvert(involvertInput)} style={{ ...SMA, padding: '0 16px', border: '1.5px solid var(--brand2)', background: 'var(--brandbg)', color: 'var(--brand)', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>Legg til</button>
            </div>
            {fields.involverte.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {fields.involverte.map(name => (
                  <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 11px', background: 'var(--bg3)', borderRadius: 20, fontSize: 12.5, fontWeight: 500 }}>
                    {name}<span onClick={() => set('involverte', fields.involverte.filter(x => x !== name))} style={{ cursor: 'pointer', color: 'var(--text3)', fontSize: 14 }}>×</span>
                  </span>
                ))}
              </div>
            )}
            <datalist id="saker-personnel-list">{personnel.map(p => <option key={p} value={p}/>)}</datalist>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <span style={ETT}>Oppgåver i saka</span>
            {oppgaver.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {oppgaver.map(o => <OppgaveRad key={o.id} o={o} onFjern={() => set('oppgaver', oppgaver.filter(x => x.id !== o.id))}/>)}
            </div>}
            <OppgaveInnfoering ref={oppgRef} personar={personnel} standardAnsvarleg={meg} onLeggTil={t => set('oppgaver', [...oppgaver, t])}/>
          </div>
        </div>

        {/* Vedlegg — ekspanderbar kolonne til høgre */}
        {!vedleggOpen ? (
          <button type="button" onClick={() => setVedleggOpen(true)} title="Vis vedlegg (filer, tegningar, utklipp)"
            style={{ flex: '0 0 44px', alignSelf: 'stretch', border: 'none', borderLeft: '1px solid var(--border)', background: 'var(--bg3)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: 10, padding: '16px 0', color: 'var(--text2)', fontFamily: 'var(--font)' }}>
            <span style={{ fontSize: 16 }}>‹</span>
            <span style={{ writingMode: 'vertical-rl', fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>Vedlegg{stagedFiles.length ? ` (${stagedFiles.length})` : ''}</span>
          </button>
        ) : (
        <div style={{ flex: '0 0 320px', minWidth: 0, padding: '18px 22px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', borderLeft: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ ...ETT, marginBottom: 0, flex: 1 }}>Vedlegg / tegningar / utklipp</span>
            <button type="button" onClick={() => setVedleggOpen(false)} title="Skjul vedlegg" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text3)', lineHeight: 1 }}>›</button>
          </div>
          <div onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragActive(true) }} onDragLeave={() => setDragActive(false)}
            onDrop={e => { e.preventDefault(); setDragActive(false); handleFiles([...e.dataTransfer.files]) }}
            style={{ flex: 1, minHeight: 170, border: `2px dashed ${dragActive ? 'var(--brand2)' : 'var(--border)'}`, borderRadius: 10, background: dragActive ? 'var(--brandbg)' : 'var(--bg3)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', transition: 'all .15s', padding: 18, textAlign: 'center' }}>
            <span style={{ fontSize: 28 }}>📎</span>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>Dra og slepp PDF-ar eller bilete hit</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>eller klikk for å velje filer — du kan også lime inn eit skjermutklipp (Ctrl+V) direkte i vindauget</div>
          </div>
          <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={e => { handleFiles([...e.target.files]); e.target.value = '' }}/>
          {stagedFiles.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
              {stagedFiles.map((file, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: 'var(--brandbg)', color: 'var(--brand)', flexShrink: 0 }}>{file.type?.includes('image') ? 'BILETE' : file.type?.includes('pdf') ? 'PDF' : 'FIL'}</span>
                  <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>{(file.size / 1024).toFixed(0)} KB</span>
                  <button onClick={() => setStagedFiles(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 2, fontWeight: 800, fontSize: 14 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
        )}
      </div>
    </FlyttbartModal>
  )
}
