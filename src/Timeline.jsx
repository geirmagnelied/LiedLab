import { useState, useRef, useEffect } from 'react'
import { parseISO, format, startOfWeek, endOfWeek, addDays, addWeeks, addMonths,
  startOfMonth, endOfMonth, getISOWeek, isSameDay, isToday, isSameMonth } from 'date-fns'
import { nb } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Filter, CalendarDays } from 'lucide-react'

const PALETTE = ['#1B4332','#2D6A4F','#40916C','#1565C0','#5E35B1',
                 '#B5296B','#0E7490','#7C3500','#1D4ED8','#6B21A8']
const pc = i => PALETTE[i % PALETTE.length]

const DOW_NB = ['man','tir','ons','tor','fre','lør','søn']
const MON_NB = ['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des']

export default function Timeline({ notes, projects, height, onResize }) {
  const [mode,        setMode]        = useState('month-week')
  const [anchor,      setAnchor]      = useState(new Date())
  const [filterProjs, setFilterProjs] = useState([])
  const [showFilter,  setShowFilter]  = useState(false)
  const [tooltip,     setTooltip]     = useState(null)
  const [dragOver,    setDragOver]    = useState(null)
  const scrollRef = useRef(null)

  const projIdx  = Object.fromEntries(projects.map((p,i) => [p.id, i]))
  const getColor = pid => pid != null ? pc(projIdx[pid] ?? 0) : '#888'

  const allTasks = notes
    .filter(n => !n.done && (filterProjs.length===0 || filterProjs.includes(n.projectId)))
    .flatMap(n =>
      (n.tasks||[]).filter(t => !t.done && t.date).map(t => ({
        ...t, noteId:n.id,
        noteTitle: n.title || n.text?.substring(0,30) || 'Utan tittel',
        projectId: n.projectId, color: getColor(n.projectId),
        projName: projects.find(p=>p.id===n.projectId)?.name || null,
      }))
    )

  const tasksOnDate = d => allTasks.filter(t => isSameDay(parseISO(t.date), d))
  const tasksInWeek = ws => {
    const we = endOfWeek(ws,{weekStartsOn:1})
    return allTasks.filter(t => { const d=parseISO(t.date); return d>=ws && d<=we })
  }
  const tasksInMonth = ms => {
    const me = endOfMonth(ms)
    return allTasks.filter(t => { const d=parseISO(t.date); return d>=ms && d<=me })
  }

  // Resize
  const onResizeMD = e => {
    e.preventDefault()
    const sy=e.clientY, sh=height
    const mm=ev=>onResize(Math.min(400,Math.max(90,sh+(sy-ev.clientY))))
    const mu=()=>{window.removeEventListener('mousemove',mm);window.removeEventListener('mouseup',mu)}
    window.addEventListener('mousemove',mm); window.addEventListener('mouseup',mu)
  }

  const onDrop = (e, dateStr) => {
    e.preventDefault(); setDragOver(null)
    const noteId = parseInt(e.dataTransfer.getData('noteId'))
    if (!noteId) return
    window.dispatchEvent(new CustomEvent('timeline-drop',{detail:{noteId,date:dateStr}}))
  }

  const Chip = ({task}) => (
    <div style={{position:'relative'}}>
      <div onClick={e=>{e.stopPropagation();setTooltip(tooltip?.id===task.id&&tooltip?.noteId===task.noteId?null:task)}}
        style={{display:'flex',alignItems:'flex-start',gap:3,padding:'2px 4px',
          background:task.color+'1A',border:`1.5px solid ${task.color}55`,
          borderLeft:`3px solid ${task.color}`,borderRadius:4,cursor:'pointer',marginBottom:2}}
        onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 2px 6px ${task.color}44`}
        onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
        <span style={{width:6,height:6,borderRadius:'50%',background:task.color,flexShrink:0,marginTop:3}}/>
        <div style={{minWidth:0}}>
          <div style={{fontSize:9,fontWeight:700,color:task.color,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',lineHeight:1.3}}>
            {task.projName||task.noteTitle}
          </div>
          <div style={{fontSize:9,color:'var(--text2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',lineHeight:1.3}}>
            {task.text}
          </div>
        </div>
      </div>
      {tooltip?.id===task.id&&tooltip?.noteId===task.noteId&&(
        <div style={{position:'absolute',bottom:'110%',left:0,zIndex:300,
          background:'var(--bg2)',border:`2px solid ${task.color}`,
          borderRadius:'var(--r2)',padding:'10px 13px',
          minWidth:190,maxWidth:250,boxShadow:'var(--shadow-lg)'}}>
          <div style={{fontSize:11,fontWeight:700,color:task.color,marginBottom:4}}>{task.projName||'–'}</div>
          <div style={{fontSize:12,fontWeight:600,color:'var(--text)',marginBottom:3}}>{task.noteTitle}</div>
          <div style={{fontSize:12,color:'var(--text2)',marginBottom:6}}>{task.text}</div>
          <div style={{fontSize:11,color:'var(--text3)',display:'flex',alignItems:'center',gap:4}}>
            📅 {format(parseISO(task.date),'d. MMMM yyyy',{locale:nb})}
          </div>
        </div>
      )}
    </div>
  )

  const ColCell = ({dateStr, tasks, isNow, headerContent, w, flex}) => {
    const isDT = dragOver===dateStr
    return (
      <div onDragOver={e=>{e.preventDefault();setDragOver(dateStr)}}
        onDragLeave={()=>setDragOver(null)}
        onDrop={e=>onDrop(e,dateStr)}
        style={{
          ...(flex ? {flex:1} : {width:w,minWidth:w}),
          height:'100%', borderRight:'1px solid var(--border)',
          background: isDT?'rgba(27,67,50,.14)':isNow?'rgba(27,67,50,.06)':'transparent',
          outline: isDT?'2px solid var(--brand3)':'none', outlineOffset:-2,
          flexShrink:0, display:'flex', flexDirection:'column',
        }}>
        <div style={{padding:'3px 5px 4px',borderBottom:'1px solid var(--border)',flexShrink:0,
          background:isNow?'rgba(27,67,50,.12)':'var(--bg3)'}}>
          {headerContent}
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'3px 3px',display:'flex',flexDirection:'column',gap:2}}>
          {tasks.map(t=><Chip key={`${t.noteId}-${t.id}`} task={t}/>)}
          {isDT&&<div style={{border:'2px dashed var(--brand3)',borderRadius:4,padding:'3px 5px',
            textAlign:'center',fontSize:9,color:'var(--brand)',fontWeight:700}}>Slepp her</div>}
        </div>
      </div>
    )
  }

  // ── MODE: month-week ──────────────────────────────────────────────────
  // Top row: months. Bottom row: weeks.
  // Key fix: weeks are placed UNDER the correct month by checking week's Thursday
  // (ISO standard: a week belongs to the month/year of its Thursday)
  const renderMonthWeek = () => {
    const today = new Date()
    // Build 18 months centred on anchor
    const baseMonth = startOfMonth(anchor)
    const months = Array.from({length:18},(_,i)=>addMonths(baseMonth,-3+i))

    // Build all weeks that fall within these months
    // A week "belongs" to a month if its Thursday falls in that month
    const allWeeks = []
    const seen = new Set()
    months.forEach(ms => {
      const me = endOfMonth(ms)
      // iterate days to find all week starts
      let d = startOfWeek(ms,{weekStartsOn:1})
      while (d <= me) {
        const key = format(d,'yyyy-MM-dd')
        if (!seen.has(key)) {
          seen.add(key)
          allWeeks.push(d)
        }
        d = addWeeks(d,1)
      }
    })
    allWeeks.sort((a,b)=>a-b)

    // Map each week → which month it belongs to (Thursday rule)
    const weekToMonth = w => {
      const thu = addDays(w,3) // Thursday of the week
      return startOfMonth(thu)
    }

    // Group weeks by month
    const monthWeekMap = new Map()
    months.forEach(ms => monthWeekMap.set(format(ms,'yyyy-MM'), []))
    allWeeks.forEach(w => {
      const mKey = format(weekToMonth(w),'yyyy-MM')
      if (monthWeekMap.has(mKey)) monthWeekMap.get(mKey).push(w)
    })

    const W = 88 // week column width

    return (
      <div style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}>
        {/* Top: months — width proportional to week count */}
        <div style={{display:'flex',borderBottom:'2px solid var(--brand)',flexShrink:0,overflowX:'hidden'}}>
          {months.map((ms,i) => {
            const wks = monthWeekMap.get(format(ms,'yyyy-MM')) || []
            if (!wks.length) return null
            const isNow = isSameMonth(ms,today)
            return (
              <div key={i} style={{width:wks.length*W,minWidth:wks.length*W,flexShrink:0,
                borderRight:'2px solid var(--brand)',padding:'4px 8px',
                background:isNow?'var(--brandbg2)':'var(--bg3)',
                display:'flex',alignItems:'center',gap:7,overflow:'hidden'}}>
                <span style={{fontSize:12,fontWeight:800,color:isNow?'var(--brand)':'var(--text)',
                  textTransform:'capitalize',whiteSpace:'nowrap'}}>
                  {format(ms,'MMMM yyyy',{locale:nb})}
                </span>
                {tasksInMonth(ms).length>0&&(
                  <span style={{fontSize:10,fontWeight:700,background:'var(--brand)',
                    color:'#fff',borderRadius:10,padding:'1px 6px',flexShrink:0}}>
                    {tasksInMonth(ms).length}
                  </span>
                )}
              </div>
            )
          }).filter(Boolean)}
        </div>
        {/* Bottom: weeks scrollable */}
        <div ref={scrollRef} style={{flex:1,display:'flex',overflowX:'auto',overflowY:'hidden'}}>
          {allWeeks.map((ws,i) => {
            const we = endOfWeek(ws,{weekStartsOn:1})
            const isNow = ws<=today && we>=today
            return (
              <ColCell key={i}
                dateStr={format(ws,'yyyy-MM-dd')}
                tasks={tasksInWeek(ws)}
                isNow={isNow}
                w={W}
                headerContent={<>
                  <div style={{fontSize:10,fontWeight:700,
                    color:isNow?'var(--brand)':'var(--text2)'}}>
                    Veke {getISOWeek(ws)}
                  </div>
                  <div style={{fontSize:9,color:'var(--text3)'}}>
                    {format(ws,'d. MMM',{locale:nb})}–{format(we,'d. MMM',{locale:nb})}
                  </div>
                </>}
              />
            )
          })}
        </div>
      </div>
    )
  }

  // ── MODE: week-day ─────────────────────────────────────────────────────
  const renderWeekDay = () => {
    const today = new Date()
    const base  = startOfWeek(anchor,{weekStartsOn:1})
    const weeks = Array.from({length:16},(_,i)=>addWeeks(base,-2+i))
    const W = 76

    return (
      <div style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}>
        {/* Top: weeks */}
        <div style={{display:'flex',borderBottom:'2px solid var(--brand)',flexShrink:0,overflowX:'hidden'}}>
          {weeks.map((ws,i) => {
            const we = endOfWeek(ws,{weekStartsOn:1})
            const isNow = ws<=today&&we>=today
            return (
              <div key={i} style={{width:W*7,minWidth:W*7,flexShrink:0,
                borderRight:'2px solid var(--brand)',padding:'4px 8px',
                background:isNow?'var(--brandbg2)':'var(--bg3)',
                display:'flex',alignItems:'center',gap:6,overflow:'hidden'}}>
                <span style={{fontSize:12,fontWeight:800,color:isNow?'var(--brand)':'var(--text)',whiteSpace:'nowrap'}}>
                  Veke {getISOWeek(ws)}
                </span>
                <span style={{fontSize:10,color:'var(--text3)',whiteSpace:'nowrap'}}>
                  {format(ws,'d. MMM',{locale:nb})}–{format(we,'d. MMM',{locale:nb})}
                </span>
              </div>
            )
          })}
        </div>
        {/* Bottom: days */}
        <div ref={scrollRef} style={{flex:1,display:'flex',overflowX:'auto',overflowY:'hidden'}}>
          {weeks.flatMap((ws,wi) =>
            Array.from({length:7},(_,di) => {
              const d = addDays(ws,di)
              return (
                <ColCell key={wi*7+di}
                  dateStr={format(d,'yyyy-MM-dd')}
                  tasks={tasksOnDate(d)}
                  isNow={isToday(d)}
                  w={W}
                  headerContent={<>
                    <div style={{fontSize:10,fontWeight:700,
                      color:isToday(d)?'var(--brand)':'var(--text2)'}}>
                      {DOW_NB[di]} {format(d,'d.',{locale:nb})}
                    </div>
                    <div style={{fontSize:9,color:'var(--text3)'}}>
                      {format(d,'MMM',{locale:nb})}
                    </div>
                  </>}
                />
              )
            })
          )}
        </div>
      </div>
    )
  }

  // ── MODE: day (7 days fills full width) ───────────────────────────────
  const renderDay = () => {
    const ws   = startOfWeek(anchor,{weekStartsOn:1})
    const days = Array.from({length:7},(_,i)=>addDays(ws,i))
    return (
      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
        {days.map((d,i) => (
          <ColCell key={i}
            dateStr={format(d,'yyyy-MM-dd')}
            tasks={tasksOnDate(d)}
            isNow={isToday(d)}
            flex={true}
            headerContent={<>
              <div style={{fontSize:11,fontWeight:800,
                color:isToday(d)?'var(--brand)':'var(--text)'}}>
                {DOW_NB[i]}
              </div>
              <div style={{fontSize:10,color:'var(--text2)',fontWeight:500}}>
                {format(d,'d. MMM',{locale:nb})}
              </div>
            </>}
          />
        ))}
      </div>
    )
  }

  const navigate = dir => {
    if (mode==='day')       setAnchor(a=>addWeeks(a,dir))
    else if (mode==='week-day') setAnchor(a=>addWeeks(a,dir*4))
    else                    setAnchor(a=>addMonths(a,dir*3))
  }
  const goToday = () => { setAnchor(new Date()); setTimeout(scrollToToday,60) }

  const scrollToToday = () => {
    if (!scrollRef.current) return
    const el = scrollRef.current
    // scroll to ~15% from left to show some past context
    el.scrollLeft = el.scrollWidth * 0.13
  }

  useEffect(() => { setTimeout(scrollToToday,80) }, [mode, anchor])

  const toggleProjFilter = id => setFilterProjs(p => p.includes(id)?p.filter(x=>x!==id):[...p,id])

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden',
      background:'var(--bg2)',userSelect:'none'}}>

      {/* Resize bar */}
      <div onMouseDown={onResizeMD}
        style={{height:6,cursor:'row-resize',flexShrink:0,
          background:'var(--border)',display:'flex',alignItems:'center',justifyContent:'center'}}
        onMouseEnter={e=>e.currentTarget.style.background='var(--brand3)'}
        onMouseLeave={e=>e.currentTarget.style.background='var(--border)'}>
        <div style={{width:50,height:2,borderRadius:2,background:'var(--border2)'}}/>
      </div>

      {/* Toolbar */}
      <div style={{display:'flex',alignItems:'center',gap:6,padding:'0 14px',
        height:40,borderBottom:'1px solid var(--border)',flexShrink:0,
        background:'var(--brand)',color:'#fff'}}>
        <CalendarDays size={14} color="rgba(255,255,255,.7)"/>
        <span style={{fontSize:11,fontWeight:800,letterSpacing:'.08em',
          textTransform:'uppercase',color:'rgba(255,255,255,.85)'}}>Tidslinje</span>

        {/* Mode */}
        <div style={{display:'flex',gap:2,marginLeft:8,
          background:'rgba(255,255,255,.12)',borderRadius:8,padding:2}}>
          {[['month-week','Månad/Veke'],['week-day','Veke/Dag'],['day','7 Dagar']].map(([m,lbl])=>(
            <button key={m} onClick={()=>setMode(m)}
              style={{padding:'2px 10px',borderRadius:6,border:'none',
                background:mode===m?'#fff':'transparent',
                color:mode===m?'var(--brand)':'rgba(255,255,255,.7)',
                fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
              {lbl}
            </button>
          ))}
        </div>

        <button onClick={()=>navigate(-1)} style={{background:'none',border:'none',color:'rgba(255,255,255,.7)',cursor:'pointer',padding:'2px 3px',borderRadius:4,display:'flex'}}><ChevronLeft size={15}/></button>
        <button onClick={goToday} style={{padding:'2px 10px',borderRadius:10,border:'1px solid rgba(255,255,255,.3)',background:'rgba(255,255,255,.1)',color:'rgba(255,255,255,.9)',fontSize:11,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>I dag</button>
        <button onClick={()=>navigate(1)} style={{background:'none',border:'none',color:'rgba(255,255,255,.7)',cursor:'pointer',padding:'2px 3px',borderRadius:4,display:'flex'}}><ChevronRight size={15}/></button>

        <div style={{flex:1}}/>
        <span style={{fontSize:10,color:'rgba(255,255,255,.4)',marginRight:4}}>{allTasks.length} oppgåver · dra notat hit</span>

        {/* Filter */}
        <div style={{position:'relative'}}>
          <button onClick={()=>setShowFilter(v=>!v)}
            style={{display:'flex',alignItems:'center',gap:5,padding:'3px 10px',borderRadius:10,
              border:'1px solid',borderColor:filterProjs.length>0?'#fff':'rgba(255,255,255,.3)',
              background:filterProjs.length>0?'rgba(255,255,255,.25)':'rgba(255,255,255,.1)',
              color:'#fff',fontSize:11,fontWeight:700,cursor:'pointer'}}>
            <Filter size={11}/>
            {filterProjs.length>0?`${filterProjs.length} prosjekt`:'Alle'}
          </button>
          {showFilter&&(
            <div style={{position:'absolute',right:0,bottom:'110%',
              background:'var(--bg2)',border:'1.5px solid var(--brand3)',
              borderRadius:'var(--r2)',padding:8,zIndex:200,minWidth:220,boxShadow:'var(--shadow-lg)'}}>
              <div style={{fontSize:10,fontWeight:800,color:'var(--brand)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:6,padding:'0 4px'}}>Filtrer prosjekt</div>
              <button onClick={()=>setFilterProjs([])} style={{width:'100%',textAlign:'left',padding:'5px 8px',background:filterProjs.length===0?'var(--bg4)':'none',border:'none',borderRadius:5,cursor:'pointer',fontSize:12,color:'var(--text)',marginBottom:4,fontWeight:filterProjs.length===0?700:400}}>✓ Alle prosjekt</button>
              {projects.map((p,i)=>(
                <button key={p.id} onClick={()=>toggleProjFilter(p.id)}
                  style={{width:'100%',textAlign:'left',padding:'5px 8px',background:filterProjs.includes(p.id)?'var(--bg4)':'none',border:'none',borderRadius:5,cursor:'pointer',fontSize:12,color:'var(--text)',display:'flex',alignItems:'center',gap:7,marginBottom:2}}>
                  <span style={{width:9,height:9,borderRadius:'50%',background:pc(i),flexShrink:0}}/>
                  <span style={{flex:1}}>{p.name}</span>
                  {filterProjs.includes(p.id)&&<span style={{color:'var(--brand)',fontWeight:700}}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0}}>
        {mode==='month-week'&&renderMonthWeek()}
        {mode==='week-day'&&renderWeekDay()}
        {mode==='day'&&renderDay()}
      </div>

      {tooltip&&<div style={{position:'fixed',inset:0,zIndex:299}} onClick={()=>setTooltip(null)}/>}
    </div>
  )
}
