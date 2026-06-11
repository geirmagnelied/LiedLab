import { useRef, useState, useEffect, useCallback } from 'react'
import { X, Trash2, Undo2, Download, Check, Pen, Eraser, Minus, Plus,
         Grid3x3, Monitor, Slash, Ruler, Type } from 'lucide-react'

const COLORS_SK = [
  '#1B4332','#000000','#374151','#B91C1C','#1565C0',
  '#B45309','#5E35B1','#166534','#BE185D','#ffffff',
]

function drawGrid(ctx, w, h, spacing, color = 'rgba(100,160,130,.22)') {
  ctx.clearRect(0, 0, w, h)
  ctx.strokeStyle = color; ctx.lineWidth = 0.5
  for (let x = spacing; x < w; x += spacing) {
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke()
  }
  for (let y = spacing; y < h; y += spacing) {
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke()
  }
}

function drawArrowhead(ctx, from, to, col, w) {
  const dx = to.x - from.x, dy = to.y - from.y
  const len = Math.sqrt(dx*dx + dy*dy)
  if (len < 1) return
  const headLen = Math.max(10, w * 5)
  ctx.save()
  ctx.fillStyle = col; ctx.strokeStyle = col
  ctx.lineWidth = w; ctx.globalAlpha = 0.95
  ctx.translate(to.x, to.y)
  ctx.rotate(Math.atan2(dy, dx))
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(-headLen, -headLen * 0.38)
  ctx.lineTo(-headLen * 0.6, 0)
  ctx.lineTo(-headLen,  headLen * 0.38)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

const SCALE_IDLE = 'idle', SCALE_P1 = 'p1', SCALE_P2 = 'p2'
const SCALE_IN = 'input', SCALE_DONE = 'done'

// Text+arrow state
const TXT_IDLE = 'idle', TXT_TIP = 'tip', TXT_ANCHOR = 'anchor'

export default function SketchPad({ onSave, onClose, existingDataUrl }) {
  const canvasRef  = useRef(null)
  const overlayRef = useRef(null)
  const wrapRef    = useRef(null)
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 })

  const [tool,        setToolState]  = useState('pen')
  const [color,       setColor]      = useState('#1B4332')
  const [penSize,     setPenSize]    = useState(3)
  const [fontSize,    setFontSize]   = useState(14)
  const [history,     setHistory]    = useState([])
  const [showGrid,    setShowGrid]   = useState(false)
  const [gridSpacing, setGridSpacing] = useState(40)
  const [lineStart,   setLineStart]  = useState(null)

  // Scale
  const [scalePhase,     setScalePhase]     = useState(SCALE_IDLE)
  const [scaleP1,        setScaleP1]        = useState(null)
  const [scaleP2,        setScaleP2]        = useState(null)
  const [scaleRealInput, setScaleRealInput] = useState('')
  const [scaleRealUnit,  setScaleRealUnit]  = useState('m')
  const [scalePxPerUnit, setScalePxPerUnit] = useState(null)
  const [scaleLabel,     setScaleLabel]     = useState('')

  // Text+arrow
  const [txtState,  setTxtState]  = useState(TXT_IDLE)
  const txtTipRef    = useRef(null)   // arrowhead (thing being annotated)
  const txtAnchorRef = useRef(null)   // text label position
  const txtInputRef  = useRef(null)   // floating DOM input

  const [mousePos, setMousePos] = useState(null)
  const isDrawing = useRef(false)
  const lastPos   = useRef(null)

  // ── Canvas size ──────────────────────────────────────────────────────
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

  // ── Init canvas ───────────────────────────────────────────────────────
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

  // ── Overlay ───────────────────────────────────────────────────────────
  useEffect(() => { redrawOverlay() },
    [showGrid, gridSpacing, canvasSize, lineStart, color, penSize,
     scalePhase, scaleP1, scaleP2, scalePxPerUnit, scaleLabel, mousePos, txtState])

  const redrawOverlay = useCallback(() => {
    const ov = overlayRef.current
    if (!ov) return
    const ctx = ov.getContext('2d')
    ctx.clearRect(0, 0, ov.width, ov.height)

    if (showGrid) drawGrid(ctx, ov.width, ov.height, gridSpacing)

    // Shift-line preview
    if (lineStart && mousePos) {
      ctx.save(); ctx.setLineDash([6,4])
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.55
      ctx.beginPath(); ctx.moveTo(lineStart.ox, lineStart.oy)
      ctx.lineTo(mousePos.ox, mousePos.oy); ctx.stroke(); ctx.restore()
    }

    // Scale measurement
    if ((scalePhase===SCALE_P2||scalePhase===SCALE_IN||scalePhase===SCALE_DONE) && scaleP1) {
      const p2 = scaleP2 || mousePos
      if (!p2) return
      ctx.save(); ctx.strokeStyle='#E85D00'; ctx.lineWidth=2; ctx.setLineDash([])
      ctx.beginPath(); ctx.moveTo(scaleP1.ox,scaleP1.oy); ctx.lineTo(p2.ox,p2.oy); ctx.stroke()
      ;[scaleP1,p2].forEach(pt => {
        ctx.beginPath(); ctx.arc(pt.ox,pt.oy,5,0,Math.PI*2)
        ctx.fillStyle='#E85D00'; ctx.fill()
      })
      const dx=p2.ox-scaleP1.ox, dy=p2.oy-scaleP1.oy
      const pxDist=Math.sqrt(dx*dx+dy*dy)
      const mid={x:(scaleP1.ox+p2.ox)/2,y:(scaleP1.oy+p2.oy)/2}
      const labelTxt=scalePxPerUnit?`${(pxDist/scalePxPerUnit).toFixed(2)} ${scaleRealUnit}`:`${Math.round(pxDist)} px`
      ctx.font='bold 12px DM Sans,sans-serif'; ctx.fillStyle='#fff'
      const tw=ctx.measureText(labelTxt).width
      ctx.fillRect(mid.x-tw/2-5,mid.y-18,tw+10,22)
      ctx.fillStyle='#E85D00'; ctx.fillText(labelTxt,mid.x-tw/2,mid.y-2)
      ctx.restore()
    }
    if (scalePhase===SCALE_DONE&&scaleLabel) {
      ctx.save(); ctx.font='bold 11px DM Sans,sans-serif'
      ctx.fillStyle='rgba(27,67,50,.85)'; ctx.fillText(`Målestokk: ${scaleLabel}`,10,ov.height-10)
      ctx.restore()
    }

    // Text+arrow preview (arrow being positioned)
    if (txtState===TXT_TIP && mousePos) {
      ctx.save()
      ctx.setLineDash([5,4]); ctx.strokeStyle=color; ctx.lineWidth=penSize
      ctx.globalAlpha=0.6; ctx.lineCap='round'
      ctx.beginPath(); ctx.moveTo(mousePos.ox,mousePos.oy); ctx.lineTo(mousePos.ox,mousePos.oy); ctx.stroke()
      // hint
      ctx.setLineDash([]); ctx.globalAlpha=0.85
      ctx.font='11px DM Sans,sans-serif'; ctx.fillStyle='rgba(27,67,50,.9)'
      const msg='Klikk på det du vil peike på (pilspiss)'
      const tw=ctx.measureText(msg).width
      ctx.fillRect(mousePos.ox+8,mousePos.oy-28,tw+12,22)
      ctx.fillStyle='#fff'; ctx.fillText(msg,mousePos.ox+14,mousePos.oy-12)
      ctx.restore()
    }

    if (txtState===TXT_ANCHOR && txtTipRef.current && mousePos) {
      const tip = txtTipRef.current
      ctx.save()
      ctx.setLineDash([5,4]); ctx.strokeStyle=color; ctx.lineWidth=penSize
      ctx.globalAlpha=0.65; ctx.lineCap='round'
      ctx.beginPath(); ctx.moveTo(mousePos.ox,mousePos.oy); ctx.lineTo(tip.ox,tip.oy); ctx.stroke()
      ctx.setLineDash([])
      drawArrowhead(ctx,{x:mousePos.ox,y:mousePos.oy},{x:tip.ox,y:tip.oy},color,penSize)
      ctx.beginPath(); ctx.arc(tip.ox,tip.oy,4,0,Math.PI*2)
      ctx.fillStyle=color; ctx.globalAlpha=0.8; ctx.fill()
      ctx.globalAlpha=0.85
      ctx.font='11px DM Sans,sans-serif'; ctx.fillStyle='rgba(27,67,50,.9)'
      const msg='Klikk der teksten skal stå'
      const tw2=ctx.measureText(msg).width
      ctx.fillRect(mousePos.ox+8,mousePos.oy-28,tw2+12,22)
      ctx.fillStyle='#fff'; ctx.fillText(msg,mousePos.ox+14,mousePos.oy-12)
      ctx.restore()
    }
  }, [showGrid, gridSpacing, lineStart, color, penSize, scalePhase, scaleP1, scaleP2,
      scalePxPerUnit, scaleRealUnit, scaleLabel, mousePos, txtState])

  const saveSnap = () => {
    const c = canvasRef.current; if (!c) return
    setHistory(h => [...h.slice(-30), c.toDataURL()])
  }

  // ── Coords ────────────────────────────────────────────────────────────
  const getPos = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return { x:0, y:0, ox:0, oy:0 }
    const rect   = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const src    = e.touches ? e.touches[0] : e
    const ox = src.clientX - rect.left
    const oy = src.clientY - rect.top
    return { x: ox*scaleX, y: oy*scaleY, ox, oy }
  }

  // ── Text+arrow handlers ───────────────────────────────────────────────
  const handleTextClick = (pos) => {
    if (txtState === TXT_IDLE) {
      // Start: set arrowTIP (where the arrow points TO)
      txtTipRef.current = pos
      setTxtState(TXT_ANCHOR)
    } else if (txtState === TXT_ANCHOR) {
      // Second click: set text anchor
      txtAnchorRef.current = pos
      setTxtState(TXT_IDLE)
      showTextInput(pos)
    }
  }

  const showTextInput = (anchor) => {
    if (txtInputRef.current) { txtInputRef.current.remove(); txtInputRef.current = null }
    const r  = canvasRef.current.getBoundingClientRect()
    const fs = fontSize
    const el = document.createElement('input')
    el.type        = 'text'
    el.placeholder = 'Skriv forklaring…'
    el.style.cssText = `
      position:fixed;
      left:${r.left + anchor.ox + 4}px;
      top:${r.top + anchor.oy - fs - 6}px;
      min-width:160px; max-width:300px;
      padding:5px 10px;
      font-size:${fs}px;
      font-family:DM Sans,sans-serif;
      font-weight:500;
      color:${color};
      background:rgba(255,255,255,.97);
      border:2px solid ${color};
      border-radius:6px;
      outline:none;
      box-shadow:0 4px 14px rgba(0,0,0,.22);
      z-index:9999;
    `
    document.body.appendChild(el)
    txtInputRef.current = el
    el.focus()
    el.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { ev.preventDefault(); commitText(el.value.trim()) }
      if (ev.key === 'Escape') cancelText()
    })
    el.addEventListener('blur', () => {
      setTimeout(() => {
        if (txtInputRef.current && document.body.contains(txtInputRef.current)) {
          if (el.value.trim()) commitText(el.value.trim())
          else cancelText()
        }
      }, 150)
    })
  }

  const commitText = (text) => {
    const tip    = txtTipRef.current
    const anchor = txtAnchorRef.current
    if (!text || !tip || !anchor) { cancelText(); return }
    const fs = fontSize
    saveSnap()
    const ctx = canvasRef.current.getContext('2d')

    // Arrow line
    ctx.save()
    ctx.strokeStyle = color; ctx.lineWidth = penSize
    ctx.lineCap = 'round'; ctx.setLineDash([])
    ctx.beginPath(); ctx.moveTo(anchor.x, anchor.y); ctx.lineTo(tip.x, tip.y); ctx.stroke()
    ctx.restore()

    // Arrowhead at tip
    drawArrowhead(ctx, anchor, tip, color, penSize)

    // Text label with background
    ctx.save()
    ctx.font = `600 ${fs}px DM Sans, sans-serif`
    const tw  = ctx.measureText(text).width
    const pad = 6
    const tx  = anchor.x - tw / 2
    const ty  = anchor.y - fs / 2
    ctx.fillStyle = 'rgba(255,255,255,.93)'
    ctx.beginPath()
    if (ctx.roundRect) ctx.roundRect(tx-pad, ty-fs, tw+pad*2, fs+pad*2, 5)
    else ctx.rect(tx-pad, ty-fs, tw+pad*2, fs+pad*2)
    ctx.fill()
    ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.stroke()
    ctx.fillStyle = color; ctx.fillText(text, tx, ty)
    ctx.restore()

    saveSnap()
    cancelText()
  }

  const cancelText = () => {
    if (txtInputRef.current) { txtInputRef.current.remove(); txtInputRef.current = null }
    txtTipRef.current    = null
    txtAnchorRef.current = null
    setTxtState(TXT_IDLE)
  }

  const setTool = (t) => {
    setToolState(t)
    if (t !== 'text') { cancelText(); setTxtState(TXT_IDLE) }
  }

  // ── Pointer events ────────────────────────────────────────────────────
  const onPointerDown = (e) => {
    e.preventDefault()
    const pos = getPos(e)

    if (tool === 'text') { handleTextClick(pos); return }

    if (scalePhase === SCALE_P1) { setScaleP1(pos); setScalePhase(SCALE_P2); return }
    if (scalePhase === SCALE_P2) { setScaleP2(pos); setScalePhase(SCALE_IN); return }

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

    if (lineStart) setLineStart(null)
    isDrawing.current = true; lastPos.current = pos
    const ctx = canvasRef.current.getContext('2d')
    ctx.beginPath(); ctx.arc(pos.x, pos.y, (tool==='eraser'?penSize*4:penSize)/2, 0, Math.PI*2)
    ctx.fillStyle = tool==='eraser'?'#ffffff':color; ctx.fill()
  }

  const onPointerMove = (e) => {
    e.preventDefault()
    const pos = getPos(e)
    setMousePos(pos)

    if (!isDrawing.current) return
    if (tool === 'text') return
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

  // ── Scale ─────────────────────────────────────────────────────────────
  const confirmScale = () => {
    const realVal = parseFloat(scaleRealInput)
    if (!realVal||!scaleP1||!scaleP2) return
    const dx=scaleP2.x-scaleP1.x, dy=scaleP2.y-scaleP1.y
    const pxDist=Math.sqrt(dx*dx+dy*dy)
    setScalePxPerUnit(pxDist/realVal)
    setScaleLabel(`1 ${scaleRealUnit} = ${Math.round(pxDist/realVal)} px`)
    setScalePhase(SCALE_DONE)
  }
  const resetScale = () => { setScalePhase(SCALE_IDLE);setScaleP1(null);setScaleP2(null);setScaleRealInput('');setScalePxPerUnit(null);setScaleLabel('') }
  const startMeasure = () => { resetScale(); setScalePhase(SCALE_P1) }

  // ── Screen capture ────────────────────────────────────────────────────
  const captureScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video:{ cursor:'never', displaySurface:'window' }, audio:false })
      const track  = stream.getVideoTracks()[0]
      const video  = document.createElement('video')
      video.srcObject = stream; video.muted = true
      await new Promise((res,rej)=>{ video.onloadedmetadata=res; video.onerror=rej; setTimeout(rej,5000) })
      await video.play()
      await new Promise(r=>setTimeout(r,150))
      const canvas=canvasRef.current, ctx=canvas.getContext('2d')
      ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height)
      const vw=video.videoWidth||track.getSettings().width||1920
      const vh=video.videoHeight||track.getSettings().height||1080
      const ratio=Math.min(canvas.width/vw,canvas.height/vh)
      const dw=vw*ratio,dh=vh*ratio
      ctx.drawImage(video,(canvas.width-dw)/2,(canvas.height-dh)/2,dw,dh)
      stream.getTracks().forEach(t=>t.stop()); saveSnap()
    } catch(err) {
      if(err.name!=='NotAllowedError'&&err.name!=='AbortError')
        alert('Skjermopptak feila. Prøv i Chrome eller Edge.')
    }
  }

  const undo = () => {
    if(history.length<=1) return
    const prev=history[history.length-2]
    const img=new Image(); img.onload=()=>canvasRef.current.getContext('2d').drawImage(img,0,0); img.src=prev
    setHistory(h=>h.slice(0,-1)); setLineStart(null)
  }
  const clear = () => {
    const ctx=canvasRef.current.getContext('2d')
    ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,canvasRef.current.width,canvasRef.current.height)
    setLineStart(null); resetScale(); cancelText(); saveSnap()
  }

  // ── Keyboard ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (txtInputRef.current) return  // don't intercept while typing
      if (e.key==='z'||e.key==='Z') undo()
      if (e.key==='l'||e.key==='L') setTool('pen')
      if (e.key==='t'||e.key==='T') setTool('text')
      if (e.key==='e'||e.key==='E') setTool('eraser')
      if (e.key==='Escape') cancelText()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [tool, history])

  // ── Toolbar button style ──────────────────────────────────────────────
  const isScaleActive = scalePhase !== SCALE_IDLE
  const tb = (active=false, warn=false) => ({
    display:'flex', alignItems:'center', gap:5, padding:'5px 10px',
    borderRadius:'var(--r)', border:'1px solid',
    borderColor: active?'#fff': warn?'rgba(248,113,113,.5)':'rgba(255,255,255,.18)',
    background:  active?'rgba(255,255,255,.9)': warn?'rgba(239,68,68,.18)':'rgba(255,255,255,.08)',
    color:       active?'var(--brand)': warn?'rgb(252,165,165)':'rgba(255,255,255,.85)',
    fontSize:12, fontWeight:active?700:500, cursor:'pointer',
    transition:'all .15s', whiteSpace:'nowrap', flexShrink:0,
    fontFamily:'var(--font)',
  })

  const cursorStyle = (scalePhase===SCALE_P1||scalePhase===SCALE_P2) ? 'crosshair'
    : tool==='eraser' ? 'cell'
    : tool==='text'   ? 'crosshair'
    : 'crosshair'

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000, background:'#1a1a1a',
      display:'flex', flexDirection:'column', overflow:'hidden' }}>

      {/* ── Toolbar ── */}
      <div style={{ display:'flex', alignItems:'center', gap:5, padding:'0 10px',
        height:50, background:'var(--brand)', flexShrink:0, overflowX:'auto', overflowY:'hidden' }}>

        {/* Save — leftmost */}
        <button onClick={() => onSave(canvasRef.current.toDataURL('image/png'))} style={{ ...tb(true), marginRight:4 }}>
          <Check size={14}/> Lagre skisse
        </button>

        <div style={{ width:1,height:20,background:'rgba(255,255,255,.2)',flexShrink:0 }}/>

        {/* Tools */}
        <button onClick={() => setTool('pen')}    style={tb(tool==='pen')}><Pen size={13}/>    Penn</button>
        <button onClick={() => setTool('eraser')} style={tb(tool==='eraser')}><Eraser size={13}/> Visk</button>
        <button onClick={() => setTool('text')}   style={{ ...tb(tool==='text'),
          borderColor: tool==='text'?'#fff':txtState!==TXT_IDLE?'rgba(255,220,50,.8)':'rgba(255,255,255,.18)',
          background:  tool==='text'?'rgba(255,255,255,.9)':txtState!==TXT_IDLE?'rgba(255,220,50,.15)':'rgba(255,255,255,.08)',
          color:       tool==='text'?'var(--brand)':txtState!==TXT_IDLE?'rgb(255,230,80)':'rgba(255,255,255,.85)',
        }}>
          <Type size={13}/>
          {txtState===TXT_IDLE && 'Tekst+pil'}
          {txtState===TXT_ANCHOR && 'Klikk sluttpunkt…'}
        </button>

        {/* Shift-line */}
        <button onClick={() => lineStart && setLineStart(null)}
          style={{ ...tb(!!lineStart),
            borderColor: lineStart?'rgba(255,220,50,.8)':'rgba(255,255,255,.18)',
            background:  lineStart?'rgba(255,220,50,.15)':'rgba(255,255,255,.08)',
            color:       lineStart?'rgb(255,230,80)':'rgba(255,255,255,.65)',
          }}
          title="Shift+klikk for startpunkt, Shift+klikk sluttpunkt = rett linje">
          <Slash size={13}/>{lineStart?'Klikk sluttpunkt…':'Shift+klikk=rett linje'}
        </button>

        <div style={{ width:1,height:20,background:'rgba(255,255,255,.2)',flexShrink:0 }}/>

        {/* Pen size */}
        <button onClick={() => setPenSize(s=>Math.max(1,s-1))} style={{ ...tb(), padding:'5px 7px' }}><Minus size={12}/></button>
        <span style={{ fontSize:12,color:'#fff',fontWeight:600,minWidth:18,textAlign:'center',flexShrink:0 }}>{penSize}</span>
        <button onClick={() => setPenSize(s=>Math.min(60,s+1))} style={{ ...tb(), padding:'5px 7px' }}><Plus size={12}/></button>

        {/* Font size (text tool) */}
        {tool==='text' && <>
          <div style={{ width:1,height:20,background:'rgba(255,255,255,.2)',flexShrink:0 }}/>
          <span style={{ fontSize:11,color:'rgba(255,255,255,.6)',flexShrink:0 }}>Tekststorleik:</span>
          <button onClick={() => setFontSize(s=>Math.max(8,s-2))}  style={{ ...tb(), padding:'5px 7px' }}><Minus size={12}/></button>
          <span style={{ fontSize:12,color:'#fff',fontWeight:600,minWidth:22,textAlign:'center',flexShrink:0 }}>{fontSize}</span>
          <button onClick={() => setFontSize(s=>Math.min(48,s+2))} style={{ ...tb(), padding:'5px 7px' }}><Plus size={12}/></button>
        </>}

        <div style={{ width:1,height:20,background:'rgba(255,255,255,.2)',flexShrink:0 }}/>

        {/* Colors */}
        <div style={{ display:'flex',gap:3,alignItems:'center',flexShrink:0 }}>
          {COLORS_SK.map(c => (
            <div key={c} onClick={() => setColor(c)}
              style={{ width:c===color?20:15, height:c===color?20:15, borderRadius:'50%',
                background:c, flexShrink:0, cursor:'pointer', transition:'all .15s',
                border:`2px solid ${c===color?'#fff':'rgba(255,255,255,.25)'}`,
                boxShadow:c==='#ffffff'?'0 0 0 1px rgba(0,0,0,.3)':'none' }}/>
          ))}
        </div>

        <div style={{ width:1,height:20,background:'rgba(255,255,255,.2)',flexShrink:0 }}/>

        {/* Grid */}
        <button onClick={() => setShowGrid(v=>!v)} style={tb(showGrid)}><Grid3x3 size={13}/> Grid</button>
        {showGrid && <>
          <button onClick={() => setGridSpacing(s=>Math.max(10,s-10))} style={{ ...tb(), padding:'5px 7px' }}><Minus size={11}/></button>
          <span style={{ fontSize:11,color:'rgba(255,255,255,.65)',minWidth:30,textAlign:'center',flexShrink:0 }}>{gridSpacing}px</span>
          <button onClick={() => setGridSpacing(s=>Math.min(200,s+10))} style={{ ...tb(), padding:'5px 7px' }}><Plus size={11}/></button>
        </>}

        <div style={{ width:1,height:20,background:'rgba(255,255,255,.2)',flexShrink:0 }}/>

        {/* Scale */}
        <button onClick={isScaleActive?resetScale:startMeasure} style={tb(isScaleActive)}>
          <Ruler size={13}/>
          {scalePhase===SCALE_IDLE && 'Målestokk'}
          {scalePhase===SCALE_P1   && 'Klikk startpunkt…'}
          {scalePhase===SCALE_P2   && 'Klikk sluttpunkt…'}
          {scalePhase===SCALE_IN   && 'Legg inn avstand…'}
          {scalePhase===SCALE_DONE && (scaleLabel||'Målestokk sett')}
        </button>
        {scalePhase===SCALE_IN && (
          <div style={{ display:'flex',alignItems:'center',gap:4,flexShrink:0 }}>
            <span style={{ fontSize:11,color:'rgba(255,255,255,.7)' }}>= </span>
            <input type="number" value={scaleRealInput} onChange={e=>setScaleRealInput(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&confirmScale()}
              placeholder="t.d. 5" autoFocus
              style={{ width:65,padding:'4px 7px',borderRadius:'var(--r)',border:'1.5px solid rgba(255,255,255,.4)',background:'rgba(255,255,255,.12)',color:'#fff',fontSize:12,outline:'none',fontFamily:'var(--font)' }}/>
            <select value={scaleRealUnit} onChange={e=>setScaleRealUnit(e.target.value)}
              style={{ padding:'4px 6px',borderRadius:'var(--r)',border:'1px solid rgba(255,255,255,.3)',background:'rgba(255,255,255,.1)',color:'#fff',fontSize:12,cursor:'pointer' }}>
              {['mm','cm','dm','m','km'].map(u=><option key={u} value={u}>{u}</option>)}
            </select>
            <button onClick={confirmScale} style={{ ...tb(true),padding:'4px 10px' }}>OK</button>
          </div>
        )}

        <div style={{ flex:1,minWidth:6 }}/>

        <button onClick={captureScreen} style={tb()}><Monitor size={13}/> Hent skjermbilete</button>
        <div style={{ width:1,height:20,background:'rgba(255,255,255,.2)',flexShrink:0 }}/>
        <button onClick={undo}    style={tb()}><Undo2 size={13}/> Angre</button>
        <button onClick={clear}   style={tb(false,true)}><Trash2 size={13}/> Tøm</button>
        <button onClick={() => { const a=document.createElement('a');a.href=canvasRef.current.toDataURL();a.download='skisse.png';a.click() }} style={tb()}><Download size={13}/></button>
        <button onClick={onClose} style={tb()}><X size={13}/> Avbryt</button>
      </div>

      {/* ── Canvas ── */}
      <div ref={wrapRef} style={{ flex:1, position:'relative', overflow:'hidden' }}>
        <canvas ref={canvasRef}
          width={canvasSize.w} height={canvasSize.h}
          onMouseDown={onPointerDown} onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}     onMouseLeave={onPointerUp}
          onTouchStart={onPointerDown} onTouchMove={onPointerMove} onTouchEnd={onPointerUp}
          style={{ position:'absolute',inset:0,width:'100%',height:'100%',cursor:cursorStyle,touchAction:'none',display:'block',background:'#fff' }}/>

        <canvas ref={overlayRef}
          width={canvasSize.w} height={canvasSize.h}
          style={{ position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',display:'block' }}/>

        {/* Status hints */}
        {lineStart && (
          <div style={{ position:'absolute',bottom:12,left:'50%',transform:'translateX(-50%)',background:'rgba(27,67,50,.9)',color:'#fff',fontSize:12,fontWeight:600,padding:'6px 14px',borderRadius:20,pointerEvents:'none' }}>
            Shift+klikk for å fullføre linja
          </div>
        )}
        {(scalePhase===SCALE_P1||scalePhase===SCALE_P2) && (
          <div style={{ position:'absolute',bottom:12,left:'50%',transform:'translateX(-50%)',background:'rgba(232,93,0,.9)',color:'#fff',fontSize:12,fontWeight:600,padding:'6px 14px',borderRadius:20,pointerEvents:'none' }}>
            {scalePhase===SCALE_P1?'📍 Klikk startpunkt på teikninga':'📍 Klikk sluttpunkt'}
          </div>
        )}
        {tool==='text' && txtState===TXT_IDLE && (
          <div style={{ position:'absolute',bottom:12,left:'50%',transform:'translateX(-50%)',background:'rgba(27,67,50,.9)',color:'#fff',fontSize:12,fontWeight:600,padding:'6px 14px',borderRadius:20,pointerEvents:'none' }}>
            📍 Klikk på det du vil peike på (pilspiss)
          </div>
        )}
        {tool==='text' && txtState===TXT_ANCHOR && (
          <div style={{ position:'absolute',bottom:12,left:'50%',transform:'translateX(-50%)',background:'rgba(27,67,50,.9)',color:'#fff',fontSize:12,fontWeight:600,padding:'6px 14px',borderRadius:20,pointerEvents:'none' }}>
            📍 Klikk der teksten skal stå
          </div>
        )}
      </div>
    </div>
  )
}
