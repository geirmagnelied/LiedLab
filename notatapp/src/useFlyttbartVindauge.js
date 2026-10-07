import { useState } from 'react'

// Flyttbart + skalerbart flytande vindauge (åtte hjørne-/kant-handtak) —
// same eigendefinerte mousedown/mousemove/mouseup-på-window-mønster som
// TegningslisteModal.jsx (ALDRI CSS `resize`, sjå CLAUDE.md). Posisjon og
// storleik vert hugsa i localStorage under `lagringsNokkel`.
export default function useFlyttbartVindauge(lagringsNokkel, { breidd = 1040, hogd = 720, minW = 640, minH = 460 } = {}) {
  const [v, setV] = useState(() => {
    try {
      const lagra = JSON.parse(localStorage.getItem(lagringsNokkel))
      if (lagra && lagra.w > 0 && lagra.h > 0) return lagra
    } catch { /* privat modus */ }
    const w = Math.max(minW, Math.min(Math.round(window.innerWidth * 0.96), breidd))
    const h = Math.max(minH, Math.min(Math.round(window.innerHeight * 0.94), hogd))
    return { x: Math.round((window.innerWidth - w) / 2), y: Math.round((window.innerHeight - h) / 2), w, h }
  })
  const lagre = (n) => { try { localStorage.setItem(lagringsNokkel, JSON.stringify(n)) } catch { /* privat modus */ } }

  const startFlytt = (e) => {
    if (e.target.closest('button')) return
    e.preventDefault()
    const x0 = e.clientX, y0 = e.clientY
    const start = { ...v }
    const flytt = (ev) => setV({ ...start,
      x: Math.max(-(start.w - 160), Math.min(window.innerWidth - 160, start.x + (ev.clientX - x0))),
      y: Math.max(0, Math.min(window.innerHeight - 60, start.y + (ev.clientY - y0))) })
    const slepp = () => {
      window.removeEventListener('mousemove', flytt)
      window.removeEventListener('mouseup', slepp)
      setV(n => { lagre(n); return n })
    }
    window.addEventListener('mousemove', flytt)
    window.addEventListener('mouseup', slepp)
  }

  const startEndring = (dir, e) => {
    e.preventDefault(); e.stopPropagation()
    const x0 = e.clientX, y0 = e.clientY
    const start = { ...v }
    const flytt = (ev) => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0
      let { x, y, w, h } = start
      if (dir.includes('e')) w = Math.max(minW, start.w + dx)
      if (dir.includes('s')) h = Math.max(minH, start.h + dy)
      if (dir.includes('w')) { w = Math.max(minW, start.w - dx); x = start.x + (start.w - w) }
      if (dir.includes('n')) { h = Math.max(minH, start.h - dy); y = start.y + (start.h - h) }
      setV({ x, y, w, h })
    }
    const slepp = () => {
      window.removeEventListener('mousemove', flytt)
      window.removeEventListener('mouseup', slepp)
      document.body.style.cursor = ''
      setV(n => { lagre(n); return n })
    }
    document.body.style.cursor = handtakStil(dir).cursor
    window.addEventListener('mousemove', flytt)
    window.addEventListener('mouseup', slepp)
  }

  return { v, startFlytt, startEndring, handtakStil, retningar: ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] }
}

export function handtakStil(dir) {
  const RAND = 8, HJORNE = 16
  const cursor = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
    ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' }[dir]
  const basis = { position: 'absolute', zIndex: 25, cursor }
  switch (dir) {
    case 'n': return { ...basis, top: -RAND / 2, left: HJORNE, right: HJORNE, height: RAND }
    case 's': return { ...basis, bottom: -RAND / 2, left: HJORNE, right: HJORNE, height: RAND }
    case 'e': return { ...basis, right: -RAND / 2, top: HJORNE, bottom: HJORNE, width: RAND }
    case 'w': return { ...basis, left: -RAND / 2, top: HJORNE, bottom: HJORNE, width: RAND }
    case 'ne': return { ...basis, top: -HJORNE / 2, right: -HJORNE / 2, width: HJORNE, height: HJORNE }
    case 'nw': return { ...basis, top: -HJORNE / 2, left: -HJORNE / 2, width: HJORNE, height: HJORNE }
    case 'se': return { ...basis, bottom: -HJORNE / 2, right: -HJORNE / 2, width: HJORNE, height: HJORNE }
    case 'sw': return { ...basis, bottom: -HJORNE / 2, left: -HJORNE / 2, width: HJORNE, height: HJORNE }
    default: return basis
  }
}
