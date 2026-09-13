import { useState, useMemo } from 'react'
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter,
  addDays, addWeeks, addMonths, addQuarters, addYears,
  isSameMonth, isSameDay, isToday, getISOWeek, parseISO,
} from 'date-fns'
import { nb } from 'date-fns/locale'
import { helligdagNamn } from './helligdagar'

// ═══════════════════════════════════════════════════════════════════
//  Kalendermodul — eigen modul (kalenderbaren nedst i notatmodulen
//  dekkjer den daglege dra-og-slepp-arbeidsflyten for fristar; denne
//  modulen er den store, lesbare oversikta: dag/veke/månad/kvartal/år,
//  norske heilagdagar, og alle oppføringar (møte + fristar på opne
//  oppgåver) for det prosjektet som er valt i den globale toppbaren.
//  Ingen eiga prosjektveljar her — same mønster som Kvalitetsmodulen
//  og Resultatdokument-modulen.
// ═══════════════════════════════════════════════════════════════════

const VISNINGAR = [
  { key:'dag',     label:'Dag' },
  { key:'veke',    label:'Veke' },
  { key:'manad',   label:'Månad' },
  { key:'kvartal', label:'Kvartal' },
  { key:'ar',      label:'År' },
]

const PALETTE = ['#1B4332','#2D6A4F','#40916C','#1565C0','#5E35B1',
                 '#B5296B','#0E7490','#7C3500','#1D4ED8','#6B21A8']
const FRIST_FARGE = '#B45309'
const MOTE_FARGE  = '#1565C0'
const DOW_KORT = ['ma','ti','on','to','fr','lø','sø']

function nokkel(d) { return format(d, 'yyyy-MM-dd') }

// ── Liten type-merkelapp (F = frist, M = møte) — same «bokstav i boks»-
// språk som resten av appen bruker (sjå LetterIcon i NoteList.jsx) ──
function Merke({ type, size = 16 }) {
  const moete = type === 'møte'
  return (
    <span title={moete ? 'Møte' : 'Frist'} style={{
      width:size, height:size, borderRadius:size > 14 ? 5 : 4,
      background: moete ? MOTE_FARGE : FRIST_FARGE, color:'#fff', fontWeight:800,
      fontSize:Math.round(size * 0.55), display:'inline-flex', alignItems:'center',
      justifyContent:'center', flexShrink:0, lineHeight:1 }}>
      {moete ? 'M' : 'F'}
    </span>
  )
}

function HendingRad({ h, farge, onClick }) {
  return (
    <div onClick={onClick} style={{ display:'flex', alignItems:'flex-start', gap:7, padding:'6px 8px',
      borderRadius:'var(--r)', border:'1px solid var(--border)', background:'var(--bg2)',
      marginBottom:5, cursor: onClick ? 'pointer' : 'default', borderLeft:`3px solid ${farge}` }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.background = 'var(--bg3)' }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.background = 'var(--bg2)' }}>
      <Merke type={h.type}/>
      <div style={{ minWidth:0, flex:1 }}>
        {h.type === 'møte' && h.tid && (
          <div style={{ fontSize:11, fontWeight:700, color:MOTE_FARGE }}>
            {format(new Date(h.tid), 'HH:mm')}
          </div>
        )}
        <div style={{ fontSize:12.5, fontWeight:600, color:'var(--text)', overflow:'hidden',
          textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {h.type === 'møte' ? h.tittel : h.tekst}
        </div>
        {h.projName && <div style={{ fontSize:11, color:'var(--text3)' }}>{h.projName}</div>}
      </div>
    </div>
  )
}

// ── Månadsrutenett — brukt både som stor, interaktiv månadsvisning og
// som vesle oversiktsrutenett i kvartal-/årsvisninga (stor=false) ──
function Manadsrutenett({ maanad, stor, valgtDag, onVelgDag, hendingarPaDag, onDrill }) {
  const start = startOfMonth(maanad)
  const slutt = endOfMonth(maanad)
  const gridStart = startOfWeek(start, { weekStartsOn:1 })
  const gridEnd   = endOfWeek(slutt, { weekStartsOn:1 })
  const rows = []
  let day = gridStart
  while (day <= gridEnd) {
    const week = []
    for (let i = 0; i < 7; i++) { week.push(day); day = addDays(day, 1) }
    rows.push(week)
  }
  const cellH = stor ? 88 : 22

  return (
    <div>
      {stor && (
        <div style={{ display:'grid', gridTemplateColumns:'32px repeat(7,1fr)', gap:1, marginBottom:2 }}>
          <div/>
          {DOW_KORT.map((dv, i) => (
            <div key={dv} style={{ fontSize:10, fontWeight:700, textAlign:'center', padding:'3px 0',
              color: i >= 5 ? 'var(--danger)' : 'var(--text3)', textTransform:'uppercase', letterSpacing:'.04em' }}>
              {dv}
            </div>
          ))}
        </div>
      )}
      {rows.map((week, wi) => (
        <div key={wi} style={{ display:'grid', gridTemplateColumns:'32px repeat(7,1fr)', gap:1, marginBottom:1 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
            fontSize: stor ? 10 : 8, fontWeight:700, color:'var(--text3)', background:'var(--bg3)',
            border:'1px solid var(--border)', borderRadius:4 }}>
            {getISOWeek(week[0])}
          </div>
          {week.map((dag, di) => {
            const inMonth = isSameMonth(dag, maanad)
            const isSel   = isSameDay(dag, valgtDag)
            const isT     = isToday(dag)
            const helg    = helligdagNamn(dag)
            const sundag  = dag.getDay() === 0
            const liste   = hendingarPaDag(dag)
            return (
              <button key={di}
                onClick={() => { onVelgDag(dag); onDrill?.(dag) }}
                title={helg || undefined}
                style={{ minHeight:cellH, borderRadius:6, padding: stor ? '4px 5px' : '2px',
                  cursor:'pointer', textAlign:'left', display:'flex', flexDirection:'column', gap:2,
                  border:`1px solid ${isSel ? 'var(--brand3)' : 'transparent'}`,
                  background: isSel ? 'var(--brandbg)' : isT ? 'var(--brandbg2)' : 'transparent' }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--bg3)' }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = isT ? 'var(--brandbg2)' : 'transparent' }}>
                <span style={{ fontSize: stor ? 13 : 9, fontWeight: isT ? 800 : 500,
                  color: !inMonth ? 'var(--text3)' : (helg || sundag) ? 'var(--danger)' : 'var(--text)' }}>
                  {format(dag, 'd')}
                </span>
                {stor && helg && (
                  <span style={{ fontSize:9, color:'var(--danger)', overflow:'hidden',
                    textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{helg}</span>
                )}
                {liste.length > 0 && (
                  stor ? (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:2 }}>
                      {liste.slice(0, 4).map(h => <Merke key={h.id} type={h.type} size={14}/>)}
                      {liste.length > 4 && <span style={{ fontSize:9, color:'var(--text3)', fontWeight:700 }}>+{liste.length - 4}</span>}
                    </div>
                  ) : (
                    <div style={{ display:'flex', gap:1 }}>
                      {liste.slice(0, 3).map(h => (
                        <span key={h.id} style={{ width:4, height:4, borderRadius:2,
                          background: h.type === 'møte' ? MOTE_FARGE : FRIST_FARGE }}/>
                      ))}
                    </div>
                  )
                )}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export default function KalenderModule({ projects, notes, activeProjectId, onEdit }) {
  const [visning,  setVisning]  = useState('manad')
  const [anker,    setAnker]    = useState(new Date())
  const [valgtDag, setValgtDag] = useState(new Date())

  const aktivtProsjekt = projects.find(p => p.id === activeProjectId)
  const projIdx  = useMemo(() => Object.fromEntries(projects.map((p, i) => [p.id, i])), [projects])
  const fargeFor = pid => pid != null ? PALETTE[(projIdx[pid] ?? 0) % PALETTE.length] : 'var(--text3)'

  // ── Oppføringar: opne oppgåvefristar + møte, for valt prosjekt (eller alle) ──
  const hendingar = useMemo(() => {
    const relevante = activeProjectId ? notes.filter(n => n.projectId === activeProjectId) : notes
    const ut = []
    relevante.forEach(n => {
      if (n.done) return
      const projName = n.projectId ? (projects.find(p => p.id === n.projectId)?.name || null) : null
      const tittel = n.title || n.text?.substring(0, 40) || 'Utan tittel'
      ;(n.tasks || []).forEach(t => {
        if (t.done || !t.date) return
        ut.push({ id:`t${t.id}`, dato:parseISO(t.date), type:'frist', tekst:t.text,
          noteId:n.id, projectId:n.projectId, projName, tittel })
      })
      if (n.isMeeting && n.meetingTime) {
        ut.push({ id:`m${n.id}`, dato:new Date(n.meetingTime), type:'møte',
          noteId:n.id, projectId:n.projectId, projName, tittel, tid:n.meetingTime })
      }
    })
    return ut
  }, [notes, projects, activeProjectId])

  const forDag = useMemo(() => {
    const m = new Map()
    hendingar.forEach(h => {
      const k = nokkel(h.dato)
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(h)
    })
    m.forEach(liste => liste.sort((a, b) => {
      if (a.tid && b.tid) return new Date(a.tid) - new Date(b.tid)
      return a.tid ? -1 : b.tid ? 1 : 0
    }))
    return m
  }, [hendingar])

  const hendingarPaDag = d => forDag.get(nokkel(d)) || []

  const gaa = (dir) => {
    if (visning === 'dag')          setAnker(a => addDays(a, dir))
    else if (visning === 'veke')    setAnker(a => addWeeks(a, dir))
    else if (visning === 'manad')   setAnker(a => addMonths(a, dir))
    else if (visning === 'kvartal') setAnker(a => addQuarters(a, dir))
    else                            setAnker(a => addYears(a, dir))
  }
  const iDag = () => { const n = new Date(); setAnker(n); setValgtDag(n) }

  const tittelForVisning = () => {
    if (visning === 'dag')   return format(anker, 'EEEE d. MMMM yyyy', { locale:nb })
    if (visning === 'veke') {
      const s = startOfWeek(anker, { weekStartsOn:1 })
      return `Veke ${getISOWeek(s)}, ${format(s, 'yyyy')}`
    }
    if (visning === 'manad')   return format(anker, 'MMMM yyyy', { locale:nb })
    if (visning === 'kvartal') {
      const s = startOfQuarter(anker)
      return `${Math.floor(s.getMonth() / 3) + 1}. kvartal ${s.getFullYear()}`
    }
    return String(anker.getFullYear())
  }

  const renderDag = () => {
    const helg  = helligdagNamn(anker)
    const liste = hendingarPaDag(anker)
    return (
      <div style={{ maxWidth:640 }}>
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:20, fontWeight:800, color:'var(--text)', textTransform:'capitalize' }}>
            {format(anker, 'EEEE d. MMMM yyyy', { locale:nb })}
          </div>
          <div style={{ fontSize:13, color: helg ? 'var(--danger)' : 'var(--text3)', marginTop:2, fontWeight: helg ? 700 : 400 }}>
            Veke {getISOWeek(anker)}{helg ? ` · ${helg}` : ''}
          </div>
        </div>
        {liste.length === 0 ? (
          <div style={{ fontSize:13, color:'var(--text3)' }}>Ingen oppføringar denne dagen.</div>
        ) : liste.map(h => (
          <HendingRad key={h.id} h={h} farge={fargeFor(h.projectId)}
            onClick={() => onEdit?.(notes.find(n => n.id === h.noteId))}/>
        ))}
      </div>
    )
  }

  const renderVeke = () => {
    const start = startOfWeek(anker, { weekStartsOn:1 })
    const dagar = Array.from({ length:7 }, (_, i) => addDays(start, i))
    return (
      <div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:8 }}>
          {dagar.map((d, i) => {
            const helg  = helligdagNamn(d)
            const liste = hendingarPaDag(d)
            return (
              <div key={i} style={{ border:'1.5px solid var(--border)', borderRadius:'var(--r2)',
                overflow:'hidden', display:'flex', flexDirection:'column', minHeight:260 }}>
                <div style={{ padding:'8px 10px', background: isToday(d) ? 'var(--brandbg2)' : 'var(--bg3)',
                  borderBottom:'1px solid var(--border)' }}>
                  <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase',
                    color: (helg || d.getDay() === 0) ? 'var(--danger)' : 'var(--text2)' }}>
                    {DOW_KORT[i]}
                  </div>
                  <div style={{ fontSize:16, fontWeight:800, color:'var(--text)' }}>{format(d, 'd.')}</div>
                  {helg && <div style={{ fontSize:10, color:'var(--danger)', fontWeight:600 }}>{helg}</div>}
                </div>
                <div style={{ flex:1, padding:6, overflowY:'auto' }}>
                  {liste.map(h => (
                    <HendingRad key={h.id} h={h} farge={fargeFor(h.projectId)}
                      onClick={() => onEdit?.(notes.find(n => n.id === h.noteId))}/>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderManad = () => (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:20 }}>
      <Manadsrutenett maanad={anker} stor valgtDag={valgtDag} onVelgDag={setValgtDag}
        hendingarPaDag={hendingarPaDag}/>
      <div>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:10,
          paddingBottom:8, borderBottom:'1px solid var(--border)', textTransform:'capitalize' }}>
          {format(valgtDag, 'EEEE d. MMMM', { locale:nb })}
          {helligdagNamn(valgtDag) && <span style={{ color:'var(--danger)', fontWeight:700 }}> · {helligdagNamn(valgtDag)}</span>}
        </div>
        {hendingarPaDag(valgtDag).length === 0 ? (
          <div style={{ fontSize:12, color:'var(--text3)' }}>Ingen oppføringar.</div>
        ) : hendingarPaDag(valgtDag).map(h => (
          <HendingRad key={h.id} h={h} farge={fargeFor(h.projectId)}
            onClick={() => onEdit?.(notes.find(n => n.id === h.noteId))}/>
        ))}
      </div>
    </div>
  )

  const renderKvartal = () => {
    const start = startOfQuarter(anker)
    const maanader = [start, addMonths(start, 1), addMonths(start, 2)]
    return (
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20 }}>
        {maanader.map((m, i) => (
          <div key={i}>
            <div style={{ fontSize:12.5, fontWeight:700, color:'var(--text2)', marginBottom:6, textTransform:'capitalize' }}>
              {format(m, 'MMMM', { locale:nb })}
            </div>
            <Manadsrutenett maanad={m} stor={false} valgtDag={valgtDag} onVelgDag={setValgtDag}
              hendingarPaDag={hendingarPaDag}
              onDrill={(d) => { setAnker(d); setVisning('manad') }}/>
          </div>
        ))}
      </div>
    )
  }

  const renderAr = () => {
    const y = anker.getFullYear()
    const maanader = Array.from({ length:12 }, (_, i) => new Date(y, i, 1))
    return (
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:18 }}>
        {maanader.map((m, i) => (
          <div key={i}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text2)', marginBottom:5, textTransform:'capitalize' }}>
              {format(m, 'MMMM', { locale:nb })}
            </div>
            <Manadsrutenett maanad={m} stor={false} valgtDag={valgtDag} onVelgDag={setValgtDag}
              hendingarPaDag={hendingarPaDag}
              onDrill={(d) => { setAnker(d); setVisning('manad') }}/>
          </div>
        ))}
      </div>
    )
  }

  const NavBtn = ({ onClick, children, title }) => (
    <button onClick={onClick} title={title}
      style={{ background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.2)',
        borderRadius:'var(--r)', color:'#fff', cursor:'pointer', padding:'5px 9px',
        fontSize:13, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>
      {children}
    </button>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      {/* Topbar */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 16px', height:50,
        flexShrink:0, background:'var(--brand)', borderBottom:'1px solid rgba(255,255,255,.1)', flexWrap:'wrap' }}>
        <span style={{ fontSize:15, fontWeight:800, color:'#fff', letterSpacing:'-0.02em', marginRight:6 }}>
          Kalender
        </span>

        <div style={{ display:'flex', gap:2, background:'rgba(255,255,255,.12)', borderRadius:8, padding:2 }}>
          {VISNINGAR.map(v => (
            <button key={v.key} onClick={() => setVisning(v.key)}
              style={{ padding:'5px 12px', borderRadius:6, border:'none',
                background: visning === v.key ? '#fff' : 'transparent',
                color: visning === v.key ? 'var(--brand)' : 'rgba(255,255,255,.75)',
                fontSize:12.5, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
              {v.label}
            </button>
          ))}
        </div>

        <NavBtn onClick={() => gaa(-1)} title="Førre">‹</NavBtn>
        <NavBtn onClick={iDag} title="Gå til i dag">I dag</NavBtn>
        <NavBtn onClick={() => gaa(1)} title="Neste">›</NavBtn>

        <span style={{ fontSize:13.5, fontWeight:700, color:'#fff', textTransform:'capitalize', whiteSpace:'nowrap' }}>
          {tittelForVisning()}
        </span>

        <div style={{ flex:1 }}/>

        {aktivtProsjekt ? (
          <span style={{ fontSize:12, color:'rgba(255,255,255,.8)', fontFamily:'var(--mono)', whiteSpace:'nowrap' }}>
            {aktivtProsjekt.projectNumber} {aktivtProsjekt.name}
          </span>
        ) : (
          <span style={{ fontSize:12, color:'rgba(255,255,255,.55)', whiteSpace:'nowrap' }}>Alle prosjekt</span>
        )}
      </div>

      <div style={{ flex:1, overflow:'auto', padding:'20px 24px' }}>
        {visning === 'dag'     && renderDag()}
        {visning === 'veke'    && renderVeke()}
        {visning === 'manad'   && renderManad()}
        {visning === 'kvartal' && renderKvartal()}
        {visning === 'ar'      && renderAr()}
      </div>
    </div>
  )
}
