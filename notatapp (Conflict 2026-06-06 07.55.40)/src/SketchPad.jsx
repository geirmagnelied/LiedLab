import { useRef, useState, useEffect, useCallback } from 'react'
import { X, Trash2, Undo2, Download, Check, Pen, Eraser, Minus, Plus,
         Grid3x3, Monitor, Slash, Ruler } from 'lucide-react'

const COLORS_SK = [
  '#1B4332','#000000','#374151','#B91C1C','#1565C0',
  '#B45309','#5E35B1','#166534','#BE185D','#ffffff',
]

function drawGrid(ctx, w, h, spacing, color = 'rgba(100,160,130,.22)') {
  ctx.clearRect(0, 0, w, h)
  ctx.strokeStyle = color
  ctx.lineWidth   = 0.5
  for (let x = spacing; x < w; x += spacing) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
  }
  for (let y = spacing; y < h; y += spacing) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  }
}

// ── Scale tool state machine ──────────────────────────────────────────────
// phases: idle → measure-start → measure-end → input-real → done
const SCALE_IDLE = 'idle'
const SCALE_P1   = 'p1'
const SCALE_P2   = 'p2'
const SCALE_IN   = 'input'
const SCALE_DONE = 'done'

export default function SketchPad({ onSave, onClose, existingDataUrl }) {
  const canvasRef  = useRef(null)
  const overlayRef = useRef(null)
  const wrapRef    = useRef(null)
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 })

  const [tool,        setTool]        = useState('pen')
  const [color,       setColor]       = useState('#1B4332')
  const [penSize,     setPenSize]     = useState(3)
  const [history,     setHistory]     = useState([])
  const [showGrid,    setShowGrid]    = useState(false)
  const [gridSpacing, setGridSpacing] = useState(40)
  const [lineStart,   setLineStart]   = useState(null)

  // Scale tool
  const [scalePhase,    setScalePhase]    = useState(SCALE_IDLE)
  const [scaleP1,       setScaleP1]       = useState(null)
  const [scaleP2,       setScaleP2]       = useState(null)
  const [scaleRealInput, setScaleRealInput] = useState('')
  const [scaleRealUnit,  setScaleRealUnit]  = useState('m')
  const [scalePxPerUnit, setScalePxPerUnit] = useState(null)   // px per real unit
  const [scaleLabel,     setScaleLabel]     = useState('')
  const [mousePosForOverlay, setMousePosForOverlay] = useState(null)

  const isDrawing = useRef(false)
  const lastPos   = useRef(null)

  // ── Measure container and set canvas size ────────────────────────────
  useEffect(() => {
    const measure = () => {
      if (!wrapRef.current) return
      const { width, height } = wrapRef.current.getBoundingClientRect()
      setCanvasSize({ w: Math.floor(width), h: Math.floor(height) })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  // ── Init canvas when size changes ────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || canvasSize.w < 10) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (existingDataUrl) {
      const img = new Image()
      img.onload = () => { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); saveSnap() }
      img.src = existingDataUrl
    } else { saveSnap() }
  }, [canvasSize])

  useEffect(() => { redrawOverlay() }, [showGrid, gridSpacing, canvasSize, lineStart, scalePhase, scaleP1, scaleP2, scalePxPerUnit, mousePosForOverlay])

  const saveSnap = () => {
    const c = canvasRef.current
    if (!c) return
    setHistory(h => [...h.slice(-30), c.toDataURL()])
  }

  // ── Overlay: grid + line-preview + scale line ────────────────────────
  const redrawOverlay = useCallback(() => {
    const ov = overlayRef.current
    if (!ov) return
    const ctx = ov.getContext('2d')
    ctx.clearRect(0, 0, ov.width, ov.height)

    if (showGrid) drawGrid(ctx, ov.width, ov.height, gridSpacing)

    // Shift-line preview
    if (lineStart && mousePosForOverlay) {
      ctx.save()
      ctx.setLineDash([6, 4])
      ctx.strokeStyle = color
      ctx.lineWidth   = 1.5
      ctx.globalAlpha = 0.55
      ctx.beginPath()
      ctx.moveTo(lineStart.ox, lineStart.oy)
      ctx.lineTo(mousePosForOverlay.ox, mousePosForOverlay.oy)
      ctx.stroke()
      ctx.restore()
    }

    // Scale measurement line
    if ((scalePhase === SCALE_P2 || scalePhase === SCALE_IN || scalePhase === SCALE_DONE) && scaleP1) {
      const p2 = scaleP2 || mousePosForOverlay
      if (!p2) return
      ctx.save()
      ctx.strokeStyle = '#E85D00'
      ctx.lineWidth   = 2
      ctx.setLineDash([])
      ctx.beginPath(); ctx.moveTo(scaleP1.ox, scaleP1.oy); ctx.lineTo(p2.ox, p2.oy); ctx.stroke()
      // end caps
      ;[scaleP1, p2].forEach(pt => {
        ctx.beginPath(); ctx.arc(pt.ox, pt.oy, 5, 0, Math.PI*2)
        ctx.fillStyle = '#E85D00'; ctx.fill()
      })
      // distance label
      const dx = p2.ox - scaleP1.ox, dy = p2.oy - scaleP1.oy
      const pxDist = Math.sqrt(dx*dx+dy*dy)
      const mid = { x: (scaleP1.ox+p2.ox)/2, y: (scaleP1.oy+p2.oy)/2 }
      const labelTxt = scalePxPerUnit
        ? `${(pxDist/scalePxPerUnit).toFixed(2)} ${scaleRealUnit}`
        : `${Math.round(pxDist)} px`
      ctx.font = 'bold 12px DM Sans, sans-serif'
      ctx.fillStyle = '#fff'
      const tw = ctx.measureText(labelTxt).width
      ctx.fillRect(mid.x - tw/2 - 5, mid.y - 18, tw + 10, 22)
      ctx.fillStyle = '#E85D00'
      ctx.fillText(labelTxt, mid.x - tw/2, mid.y - 2)
      ctx.restore()
    }

    // Drawn scale bar (when done)
    if (scalePhase === SCALE_DONE && scaleLabel) {
      ctx.save()
      ctx.font = 'bold 11px DM Sans, sans-serif'
      ctx.fillStyle = 'rgba(27,67,50,.85)'
      ctx.fillText(`Målestokk: ${scaleLabel}`, 10, ov.height - 10)
      ctx.restore()
    }
  }, [showGrid, gridSpacing, lineStart, color, scalePhase, scaleP1, scaleP2, scalePxPerUnit, scaleRealUnit, scaleLabel, mousePosForOverlay])

  // ── Coordinate helpers ────────────────────────────────────────────────
  const getPos = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return { x:0, y:0, ox:0, oy:0 }
    const rect   = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    const src    = e.touches ? e.touches[0] : e
    const ox     = src.clientX - rect.left   // overlay coords (CSS px)
    const oy     = src.clientY - rect.top
    return { x: ox * scaleX, y: oy * scaleY, ox, oy }
  }

  // ── Pointer events ────────────────────────────────────────────────────
  const onPointerDown = (e) => {
    e.preventDefault()
    const pos = getPos(e)

    // Scale tool clicks
    if (scalePhase === SCALE_P1) {
      setScaleP1(pos); setScalePhase(SCALE_P2); return
    }
    if (scalePhase === SCALE_P2) {
      setScaleP2(pos); setScalePhase(SCALE_IN); return
    }

    // Shift+click straight line
    if (e.shiftKey) {
      if (!lineStart) {
        setLineStart(pos)
        const ctx = canvasRef.current.getContext('2d')
        ctx.beginPath(); ctx.arc(pos.x, pos.y, penSize/2, 0, Math.PI*2)
        ctx.fillStyle = tool==='eraser'?'#ffffff':color; ctx.fill()
      } else {
        const ctx = canvasRef.current.getContext('2d')
        ctx.beginPath(); ctx.moveTo(lineStart.x, lineStart.y); ctx.lineTo(pos.x, pos.y)
        ctx.strokeStyle = tool==='eraser'?'#ffffff':color
        ctx.lineWidth   = tool==='eraser'?penSize*4:penSize
        ctx.lineCap = 'round'; ctx.stroke()
        setLineStart(null); saveSnap()
      }
      return
    }

    if (lineStart) { setLineStart(null) }

    isDrawing.current = true
    lastPos.current   = pos
    const ctx = canvasRef.current.getContext('2d')
    ctx.beginPath(); ctx.arc(pos.x, pos.y, (tool==='eraser'?penSize*4:penSize)/2, 0, Math.PI*2)
    ctx.fillStyle = tool==='eraser'?'#ffffff':color; ctx.fill()
  }

  const onPointerMove = (e) => {
    e.preventDefault()
    const pos = getPos(e)
    setMousePosForOverlay(pos)

    if (!isDrawing.current) return
    const ctx = canvasRef.current.getContext('2d')
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = tool==='eraser'?'#ffffff':color
    ctx.lineWidth   = tool==='eraser'?penSize*4:penSize
    ctx.lineCap='round'; ctx.lineJoin='round'; ctx.stroke()
    lastPos.current = pos
  }

  const onPointerUp = () => {
    if (isDrawing.current) { isDrawing.current=false; saveSnap() }
  }

  // ── Scale tool: confirm real-world distance ───────────────────────────
  const confirmScale = () => {
    const realVal = parseFloat(scaleRealInput)
    if (!realVal || !scaleP1 || !scaleP2) return
    const dx = scaleP2.x - scaleP1.x, dy = scaleP2.y - scaleP1.y
    const pxDist = Math.sqrt(dx*dx+dy*dy)
    const pxPerUnit = pxDist / realVal
    setScalePxPerUnit(pxPerUnit)
    setScaleLabel(`1 ${scaleRealUnit} = ${Math.round(pxPerUnit)} px  (målt ${realVal} ${scaleRealUnit})`)
    setScalePhase(SCALE_DONE)
  }

  const resetScale = () => {
    setScalePhase(SCALE_IDLE); setScaleP1(null); setScaleP2(null)
    setScaleRealInput(''); setScalePxPerUnit(null); setScaleLabel('')
  }

  const startMeasure = () => {
    resetScale(); setScalePhase(SCALE_P1)
  }

  // ── Screen capture ────────────────────────────────────────────────────
  const captureScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'never', displaySurface: 'window' },
        audio: false,
      })
      // Wait for stream to be ready
      const track = stream.getVideoTracks()[0]
      const video = document.createElement('video')
      video.srcObject = stream
      video.muted     = true

      await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => resolve()
        video.onerror          = reject
        setTimeout(reject, 5000)
      })

      await video.play()

      // Wait a couple frames so first frame is real content
      await new Promise(r => setTimeout(r, 150))

      const canvas = canvasRef.current
      const ctx    = canvas.getContext('2d')

      // Draw scaled to fit canvas
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      const vw = video.videoWidth  || track.getSettings().width  || 1920
      const vh = video.videoHeight || track.getSettings().height || 1080
      const ratio  = Math.min(canvas.width / vw, canvas.height / vh)
      const dw = vw * ratio, dh = vh * ratio
      const dx = (canvas.width  - dw) / 2
      const dy = (canvas.height - dh) / 2
      ctx.drawImage(video, dx, dy, dw, dh)

      stream.getTracks().forEach(t => t.stop())
      saveSnap()
    } catch (err) {
      if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
        alert('Skjermopptak feila. Prøv i Chrome eller Edge, og godkjenn tilgang.')
      }
    }
  }

  const undo = () => {
    if (history.length <= 1) return
    const prev = history[history.length - 2]
    const img  = new Image()
    img.onload = () => canvasRef.current.getContext('2d').drawImage(img, 0, 0)
    img.src    = prev
    setHistory(h => h.slice(0, -1))
    setLineStart(null)
  }

  const clear = () => {
    const ctx = canvasRef.current.getContext('2d')
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    setLineStart(null); resetScale(); saveSnap()
  }

  const handleSave = () => onSave(canvasRef.current.toDataURL('image/png'))

  const download = () => {
    const a = document.createElement('a')
    a.href = canvasRef.current.toDataURL('image/png'); a.download = 'skisse.png'; a.click()
  }

  // ── Cursor ────────────────────────────────────────────────────────────
  const cursorStyle = (scalePhase === SCALE_P1 || scalePhase === SCALE_P2)
    ? 'crosshair'
    : tool === 'eraser' ? 'cell' : 'crosshair'

  // ── Toolbar button style ──────────────────────────────────────────────
  const tb = (active=false, warn=false) => ({
    display:'flex', alignItems:'center', gap:5, padding:'5px 10px',
    borderRadius:'var(--r)', border:'1px solid',
    borderColor: active ? '#fff' : warn ? 'rgba(248,113,113,.5)' : 'rgba(255,255,255,.18)',
    background:  active ? 'rgba(255,255,255,.9)' : warn ? 'rgba(239,68,68,.18)' : 'rgba(255,255,255,.08)',
    color:       active ? 'var(--brand)' : warn ? 'rgb(252,165,165)' : 'rgba(255,255,255,.85)',
    fontSize:12, fontWeight: active?700:500, cursor:'pointer',
    transition:'all .15s', whiteSpace:'nowrap', flexShrink:0,
  })

  const isScaleActive = scalePhase !== SCALE_IDLE

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000, background:'#1a1a1a',
      display:'flex', flexDirection:'column', overflow:'hidden' }}>

      {/* ── Toolbar ── */}
      <div style={{ display:'flex', alignItems:'center', gap:5, padding:'0 10px',
        height:50, background:'var(--brand)', flexShrink:0,
        overflowX:'auto', overflowY:'hidden' }}>

        {/* SAVE — leftmost */}
        <button onClick={handleSave} style={{ ...tb(true), marginRight:4 }}>
          <Check size={14}/> Lagre skisse
        </button>

        <div style={{ width:1, height:20, background:'rgba(255,255,255,.2)', flexShrink:0 }}/>

        {/* Tools */}
        <button onClick={() => { setTool('pen'); if(scalePhase!==SCALE_IDLE) resetScale() }} style={tb(tool==='pen'&&!isScaleActive)}>
          <Pen size={13}/> Penn
        </button>
        <button onClick={() => { setTool('eraser'); if(scalePhase!==SCALE_IDLE) resetScale() }} style={tb(tool==='eraser'&&!isScaleActive)}>
          <Eraser size={13}/> Visk
        </button>

        {/* Shift-line */}
        <button
          onClick={() => { if(lineStart){setLineStart(null)} }}
          style={{ ...tb(!!lineStart), borderColor: lineStart?'rgba(255,220,50,.8)':'rgba(255,255,255,.18)',
            background: lineStart?'rgba(255,220,50,.15)':'rgba(255,255,255,.08)',
            color: lineStart?'rgb(255,230,80)':'rgba(255,255,255,.65)' }}
          title="Shift+klikk for startpunkt, shift+klikk for sluttpunkt = rett linje">
          <Slash size={13}/>
          {lineStart ? 'Klikk sluttpunkt…' : 'Shift+klikk=rett linje'}
        </button>

        <div style={{ width:1, height:20, background:'rgba(255,255,255,.2)', flexShrink:0 }}/>

        {/* Pen size */}
        <button onClick={() => setPenSize(s=>Math.max(1,s-1))} style={{ ...tb(), padding:'5px 7px' }}><Minus size={12}/></button>
        <span style={{ fontSize:12, color:'#fff', fontWeight:600, minWidth:18, textAlign:'center', flexShrink:0 }}>{penSize}</span>
        <button onClick={() => setPenSize(s=>Math.min(60,s+1))} style={{ ...tb(), padding:'5px 7px' }}><Plus size={12}/></button>

        <div style={{ width:1, height:20, background:'rgba(255,255,255,.2)', flexShrink:0 }}/>

        {/* Colors */}
        <div style={{ display:'flex', gap:3, alignItems:'center', flexShrink:0 }}>
          {COLORS_SK.map(c => (
            <div key={c} onClick={() => { setColor(c); setTool('pen') }}
              style={{ width:c===color?20:15, height:c===color?20:15, borderRadius:'50%',
                background:c, flexShrink:0, cursor:'pointer', transition:'all .15s',
                border:`2px solid ${c===color?'#fff':'rgba(255,255,255,.25)'}`,
                boxShadow: c==='#ffffff'?'0 0 0 1px rgba(0,0,0,.3)':'none' }}/>
          ))}
        </div>

        <div style={{ width:1, height:20, background:'rgba(255,255,255,.2)', flexShrink:0 }}/>

        {/* Grid */}
        <button onClick={() => setShowGrid(v=>!v)} style={tb(showGrid)}>
          <Grid3x3 size={13}/> Grid
        </button>
        {showGrid && <>
          <button onClick={() => setGridSpacing(s=>Math.max(10,s-10))} style={{ ...tb(), padding:'5px 7px' }}><Minus size={11}/></button>
          <span style={{ fontSize:11, color:'rgba(255,255,255,.65)', minWidth:30, textAlign:'center', flexShrink:0 }}>{gridSpacing}px</span>
          <button onClick={() => setGridSpacing(s=>Math.min(200,s+10))} style={{ ...tb(), padding:'5px 7px' }}><Plus size={11}/></button>
        </>}

        <div style={{ width:1, height:20, background:'rgba(255,255,255,.2)', flexShrink:0 }}/>

        {/* Scale tool */}
        <button onClick={isScaleActive ? resetScale : startMeasure} style={tb(isScaleActive)}>
          <Ruler size={13}/>
          {scalePhase===SCALE_IDLE && 'Målestokk'}
          {scalePhase===SCALE_P1   && 'Klikk startpunkt…'}
          {scalePhase===SCALE_P2   && 'Klikk sluttpunkt…'}
          {scalePhase===SCALE_IN   && 'Legg inn avstand…'}
          {scalePhase===SCALE_DONE && (scaleLabel || 'Målestokk sett')}
        </button>

        {/* Real-world distance input */}
        {scalePhase === SCALE_IN && (
          <div style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
            <span style={{ fontSize:11, color:'rgba(255,255,255,.7)' }}>= </span>
            <input type="number" value={scaleRealInput} onChange={e=>setScaleRealInput(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&confirmScale()}
              placeholder="t.d. 5"
              autoFocus
              style={{ width:70, padding:'4px 7px', borderRadius:'var(--r)',
                border:'1.5px solid rgba(255,255,255,.4)', background:'rgba(255,255,255,.12)',
                color:'#fff', fontSize:12, outline:'none', fontFamily:'var(--font)' }}/>
            <select value={scaleRealUnit} onChange={e=>setScaleRealUnit(e.target.value)}
              style={{ padding:'4px 6px', borderRadius:'var(--r)', border:'1px solid rgba(255,255,255,.3)',
                background:'rgba(255,255,255,.1)', color:'#fff', fontSize:12, cursor:'pointer' }}>
              {['mm','cm','dm','m','km','in','ft'].map(u=><option key={u} value={u}>{u}</option>)}
            </select>
            <button onClick={confirmScale} style={{ ...tb(true), padding:'4px 10px' }}>OK</button>
          </div>
        )}

        <div style={{ flex:1, minWidth:6 }}/>

        {/* Screen capture */}
        <button onClick={captureScreen} style={tb()}>
          <Monitor size={13}/> Hent skjermbilete
        </button>

        <div style={{ width:1, height:20, background:'rgba(255,255,255,.2)', flexShrink:0 }}/>

        <button onClick={undo}    style={tb()}><Undo2 size={13}/> Angre</button>
        <button onClick={clear}   style={tb(false,true)}><Trash2 size={13}/> Tøm</button>
        <button onClick={download} style={tb()}><Download size={13}/></button>
        <button onClick={onClose} style={tb()}><X size={13}/> Avbryt</button>
      </div>

      {/* ── Canvas area — fills ALL remaining space ── */}
      <div ref={wrapRef} style={{ flex:1, position:'relative', overflow:'hidden' }}>

        <canvas ref={canvasRef}
          width={canvasSize.w} height={canvasSize.h}
          onMouseDown={onPointerDown} onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}     onMouseLeave={onPointerUp}
          onTouchStart={onPointerDown} onTouchMove={onPointerMove} onTouchEnd={onPointerUp}
          style={{ position:'absolute', inset:0, width:'100%', height:'100%',
            cursor:cursorStyle, touchAction:'none', display:'block', background:'#fff' }}/>

        <canvas ref={overlayRef}
          width={canvasSize.w} height={canvasSize.h}
          style={{ position:'absolute', inset:0, width:'100%', height:'100%',
            pointerEvents:'none', display:'block' }}/>

        {/* Status hints */}
        {lineStart && (
          <div style={{ position:'absolute', bottom:12, left:'50%', transform:'translateX(-50%)',
            background:'rgba(27,67,50,.9)', color:'#fff', fontSize:12, fontWeight:600,
            padding:'6px 14px', borderRadius:20, pointerEvents:'none' }}>
            Shift+klikk for å fullføre linja — eller trykk Escape
          </div>
        )}
        {(scalePhase===SCALE_P1||scalePhase===SCALE_P2) && (
          <div style={{ position:'absolute', bottom:12, left:'50%', transform:'translateX(-50%)',
            background:'rgba(232,93,0,.9)', color:'#fff', fontSize:12, fontWeight:600,
            padding:'6px 14px', borderRadius:20, pointerEvents:'none' }}>
            {scalePhase===SCALE_P1 ? '📍 Klikk startpunkt på teikninga' : '📍 Klikk sluttpunkt'}
          </div>
        )}
      </div>
    </div>
  )
}
