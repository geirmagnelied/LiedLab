import { vedleggUrl } from './vedlegg'
// ═══════════════════════════════════════════════════════════════════
//  notatPdf — eksport av notat / møtenotat / referat til PDF som VEKTOR (ekte tekst, linjer og flater — ikkje bilete).
//  1) Notatet vert lagt ut i ein skjult A4-breidd-boks av nettlesaren sjølv (så tabellar, lister, fargar m.m. får same
//     utforming som på skjermen), 2) DOM-en vert gått gjennom: tekst (linje for linje, med eksakt posisjon), bakgrunnar,
//     kantlinjer, listemerke og bilete, 3) alt vert teikna med pdf-lib (Helvetica) på A4-sider med brot mellom linjer og
//     botntekst (kven som eksporterte + tidspunkt + sidetal), 4) PDF-vedlegg frå notatet vert lagde inn bak notatsidene.
//  Biblioteket (pdf-lib) vert lasta først ved eksport. Berre bileta (skisse/innlimte) er pikslar.
// ═══════════════════════════════════════════════════════════════════

const PX = 0.75                                  // 1 CSS-piksel = 0.75 pt
const SIDE_B = 595.28, SIDE_H = 841.89           // A4 i pt
const MARG_PT = 42                               // ytre marg (pt)
const INN_B = Math.round((SIDE_B - 2 * MARG_PT) / PX)          // innhaldsbreidd i CSS-px (≈ 682)
const INN_H = Math.round((SIDE_H - MARG_PT - 54) / PX)         // innhaldshøgd i CSS-px (botnen har plass til botntekst)

let eksportBrukar = ''
export function settEksportBrukar(namn) { eksportBrukar = namn || '' }

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const typeFor = (n) => n.isMeeting ? 'Møte' : n.isReferat ? 'Referat' : 'Notat'
const fmtTid = (t) => { try { return new Date(t).toLocaleString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) } catch { return '' } }
const fmtDato = (t) => { try { return new Date(t).toLocaleDateString('nb-NO') } catch { return '' } }

function byggHtml(note, prosjektNamn) {
  const tittel = note.title || (note.text || '').substring(0, 60) || 'Utan tittel'
  const rader = []
  if (note.isMeeting) {
    if (note.meetingTime) rader.push(['Tidspunkt', fmtTid(note.meetingTime)])
    if (note.meetingLocation) rader.push(['Stad', note.meetingLocation])
    if (note.attendees?.length) rader.push(['Deltakarar', note.attendees.join(', ')])
  }
  const meta = rader.length
    ? `<table class="meta">${rader.map(([k, v]) => `<tr><td style="font-weight:700;padding-right:14px">${k}</td><td>${esc(v)}</td></tr>`).join('')}</table>` : ''
  const innhald = note.html ? note.html : `<div style="white-space:pre-wrap">${esc(note.text || '')}</div>`
  const boks = (done) => `<span style="display:inline-block;width:9px;height:9px;border:1px solid #333;margin-right:7px;vertical-align:-1px;background:${done ? '#1B4332' : '#fff'}"></span>`
  const oppg = note.tasks?.length
    ? `<h3>Arbeidsoppgåver</h3>` + note.tasks.map(t => `<div style="margin:3px 0;font-size:13px">${boks(t.done)}${esc(t.text)}${t.date ? ` <span style="color:#666">(${esc(fmtDato(t.date))})</span>` : ''}</div>`).join('') : ''
  const skisse = note.sketchDataUrl ? `<div style="margin-top:18px"><img src="${note.sketchDataUrl}" style="max-width:100%"/></div>` : ''
  const vedlegg = note.attachments?.length
    ? `<h3>Vedlegg</h3>` + note.attachments.map(a => `<div style="font-size:12.5px;margin:2px 0">${esc(a.name)}${a.type?.includes('pdf') || /\.pdf$/i.test(a.name || '') ? ' <span style="color:#666">(lagt inn bak i dokumentet)</span>' : ''}</div>`).join('') : ''
  return `
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#1B4332">${typeFor(note)}${note.nr != null ? ' nr. ' + esc(note.nr) : ''}</div>
    <h1>${esc(tittel)}</h1>
    <div class="under">${prosjektNamn ? esc(prosjektNamn) + ' · ' : ''}${esc(fmtDato(note.updatedAt || note.createdAt || new Date()))}</div>
    ${meta}
    <div style="font-size:14px;line-height:1.65">${innhald}</div>
    ${oppg}${skisse}${vedlegg}`
}

const CSS = `
  .pdf-notat{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:14px}
  .pdf-notat h1{font-size:24px;margin:4px 0 6px;line-height:1.25}
  .pdf-notat h2{font-size:18px;margin:14px 0 6px} .pdf-notat h3{font-size:13px;margin:22px 0 8px;text-transform:uppercase;letter-spacing:.05em}
  .pdf-notat .under{font-size:12px;color:#555;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid #1B4332}
  .pdf-notat table{border-collapse:collapse;max-width:100%;font-size:13px} .pdf-notat table.meta{margin:0 0 14px;font-size:12.5px}
  .pdf-notat td,.pdf-notat th{border:1px solid #999;padding:4px 8px;vertical-align:top} .pdf-notat table.meta td{border:none;padding:2px 0}
  .pdf-notat p{margin:0 0 .5em} .pdf-notat ul,.pdf-notat ol{margin:.3em 0 .6em 1.5em;padding:0} .pdf-notat img{max-width:100%}`

// ── Hjelp: fargar ───────────────────────────────────────────────────
function farge(css) {
  const m = /rgba?\(([^)]+)\)/.exec(css || '')
  if (!m) return null
  const p = m[1].split(',').map(x => parseFloat(x))
  const a = p.length > 3 ? p[3] : 1
  if (a === 0) return null
  const bland = (c) => Math.round(c * a + 255 * (1 - a))
  return [bland(p[0]) / 255, bland(p[1]) / 255, bland(p[2]) / 255]
}

// ── Gå gjennom DOM-en og samle teikneelement (koordinatar i CSS-px relativt til boksen) ──
function samle(rot) {
  const o = rot.getBoundingClientRect()
  const rektar = [], tekstar = [], bilete = [], merke = []
  const rel = (r) => ({ x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height })

  for (const el of rot.querySelectorAll('*')) {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    const r = el.getBoundingClientRect()
    if (el.tagName === 'STYLE' || (r.width === 0 && r.height === 0)) continue
    const bg = farge(cs.backgroundColor)
    if (bg && r.width > 0 && r.height > 0) rektar.push({ ...rel(r), fill: bg })
    for (const [side, bw, bs, bc] of [['t', cs.borderTopWidth, cs.borderTopStyle, cs.borderTopColor], ['b', cs.borderBottomWidth, cs.borderBottomStyle, cs.borderBottomColor],
      ['l', cs.borderLeftWidth, cs.borderLeftStyle, cs.borderLeftColor], ['r', cs.borderRightWidth, cs.borderRightStyle, cs.borderRightColor]]) {
      const w = parseFloat(bw); const c = farge(bc)
      if (!(w > 0) || bs === 'none' || bs === 'hidden' || !c) continue
      const b = rel(r)
      if (side === 't') rektar.push({ x: b.x, y: b.y, w: b.w, h: w, fill: c })
      if (side === 'b') rektar.push({ x: b.x, y: b.y + b.h - w, w: b.w, h: w, fill: c })
      if (side === 'l') rektar.push({ x: b.x, y: b.y, w, h: b.h, fill: c })
      if (side === 'r') rektar.push({ x: b.x + b.w - w, y: b.y, w, h: b.h, fill: c })
    }
    if (el.tagName === 'IMG') bilete.push({ ...rel(r), src: el.currentSrc || el.src })
    if (el.tagName === 'LI') merke.push({ el, cs })
  }

  // tekst, linje for linje
  const tw = document.createTreeWalker(rot, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const txt = n.nodeValue
    if (!txt || !txt.trim()) continue
    const el = n.parentElement
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('style')) continue
    const fs = parseFloat(cs.fontSize)
    const bold = parseInt(cs.fontWeight, 10) >= 600 || cs.fontWeight === 'bold'
    const kursiv = cs.fontStyle === 'italic' || cs.fontStyle === 'oblique'
    const col = farge(cs.color) || [0, 0, 0]
    const understrek = (cs.textDecorationLine || '').includes('underline')
    const spacing = cs.letterSpacing !== 'normal' && parseFloat(cs.letterSpacing) !== 0
    const fra = tekstar.length
    let linje = null
    const push = () => { if (linje && linje.tegn.some(t => t.c.trim())) tekstar.push({ ...linje, fs, bold, kursiv, col, understrek, spacing }); linje = null }
    for (let i = 0; i < txt.length; i++) {
      range.setStart(n, i); range.setEnd(n, i + 1)
      const rr = range.getClientRects()[0]
      if (!rr || (rr.width === 0 && /\s/.test(txt[i]))) continue
      const y = rr.top - o.top
      if (!linje || Math.abs(y - linje.y) > 2) { push(); linje = { y, h: rr.height, tegn: [] } }
      linje.tegn.push({ c: txt[i], x: rr.left - o.left, w: rr.width })
    }
    push()
    if (cs.textTransform === 'uppercase' || cs.textTransform === 'capitalize') {
      for (const l of tekstar.slice(fra)) l.tegn.forEach((t, j, arr) => { t.c = cs.textTransform === 'uppercase' ? t.c.toUpperCase() : (j === 0 || arr[j - 1].c === ' ' ? t.c.toUpperCase() : t.c) })
    }
  }

  // listemerke (punkt / nummer) — ved første tekstlinje i kvar li
  for (const { el, cs } of merke) {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let tn = null
    for (let n = w.nextNode(); n; n = w.nextNode()) { if (n.nodeValue.trim()) { tn = n; break } }
    if (!tn) continue
    const idx = tn.nodeValue.search(/\S/)
    range.setStart(tn, idx); range.setEnd(tn, idx + 1)
    const rr = range.getClientRects()[0]; if (!rr) continue
    const ordnet = el.parentElement?.tagName === 'OL'
    const nr = ordnet ? [...el.parentElement.children].filter(c => c.tagName === 'LI').indexOf(el) + (parseInt(el.parentElement.getAttribute('start') || '1', 10)) : 0
    const tekst = ordnet ? nr + '.' : '•'
    const fs = parseFloat(cs.fontSize)
    const bredde = tekst.length * fs * 0.55
    tekstar.push({ y: rr.top - o.top, h: rr.height, fs, bold: false, kursiv: false, col: farge(cs.color) || [0, 0, 0], understrek: false, spacing: false,
      tegn: [...tekst].map((c, j) => ({ c, x: el.getBoundingClientRect().left - o.left - 6 - bredde + j * fs * 0.55, w: fs * 0.55 })) })
  }
  return { rektar, tekstar, bilete, hoyde: o.height }
}

// Sidebrot: mellom linjer, slik at ingen tekstlinje eller bilete vert kutta
function lagBrot(tekstar, bilete) {
  const boksar = [...tekstar.map(t => ({ top: t.y, bot: t.y + t.h })), ...bilete.map(b => ({ top: b.y, bot: b.y + b.h }))].sort((a, b) => a.top - b.top)
  const brot = [0]
  let start = 0
  for (const b of boksar) {
    if (b.bot - b.top >= INN_H) continue
    if (b.bot > start + INN_H && b.top > start + 1) { start = b.top; brot.push(start) }
  }
  return brot
}
const sideFor = (brot, y) => { let k = 0; for (let i = 0; i < brot.length; i++) if (brot[i] <= y + 0.5) k = i; return k }

async function hentBilete(doc, src) {
  try {
    const svar = await fetch(src)
    const buf = new Uint8Array(await svar.arrayBuffer())
    if (buf[0] === 0x89 && buf[1] === 0x50) return await doc.embedPng(buf)
    if (buf[0] === 0xFF && buf[1] === 0xD8) return await doc.embedJpg(buf)
    const bmp = await createImageBitmap(new Blob([buf]))
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height
    c.getContext('2d').drawImage(bmp, 0, 0)
    return await doc.embedPng(c.toDataURL('image/png'))
  } catch (e) { console.warn('Bilete hoppa over:', e); return null }
}

export function filnamnFor(note) {
  const tittel = (note.title || 'notat').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 80) || 'notat'
  return tittel + '.pdf'
}

// Gjev { advarslar: [...] }. Lastar ned fila i nettlesaren.
export async function eksporterNotatPdf(note, prosjektNamn = '') {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const advarslar = []

  const boks = document.createElement('div')
  boks.setAttribute('data-notranslate', '')
  boks.style.cssText = `position:fixed;left:-10000px;top:0;width:${INN_B}px;background:#fff;`
  boks.innerHTML = `<style>${CSS}</style><div class="pdf-notat">${byggHtml(note, prosjektNamn)}</div>`
  document.body.appendChild(boks)
  let data
  try {
    if (document.fonts?.ready) await document.fonts.ready
    await Promise.all([...boks.querySelectorAll('img')].map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r })))
    data = samle(boks.querySelector('.pdf-notat'))
  } finally { boks.remove() }

  const doc = await PDFDocument.create()
  const fonter = {
    n: await doc.embedFont(StandardFonts.Helvetica), b: await doc.embedFont(StandardFonts.HelveticaBold),
    i: await doc.embedFont(StandardFonts.HelveticaOblique), bi: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
  }
  const gyldig = (f, c) => { try { f.encodeText(c); return true } catch { return false } }
  const rens = (f, c) => c === ' ' ? ' ' : (gyldig(f, c) ? c : '?')

  const { rektar, tekstar, bilete, hoyde } = data
  const brot = lagBrot(tekstar, bilete)
  const antal = brot.length
  const sider = Array.from({ length: antal }, () => doc.addPage([SIDE_B, SIDE_H]))
  const slutt = (k) => k + 1 < antal ? brot[k + 1] : Math.max(hoyde, brot[k] + 1)
  const pdfY = (y, k) => SIDE_H - MARG_PT - (y - brot[k]) * PX
  const pdfX = (x) => MARG_PT + x * PX

  // flater og linjer (klipt per side)
  for (const r of rektar) {
    for (let k = 0; k < antal; k++) {
      const a = Math.max(r.y, brot[k]), b = Math.min(r.y + r.h, slutt(k))
      if (b <= a + 0.01) continue
      sider[k].drawRectangle({ x: pdfX(r.x), y: pdfY(b, k), width: Math.max(r.w * PX, 0.3), height: Math.max((b - a) * PX, 0.3), color: rgb(...r.fill) })
    }
  }
  // bilete
  for (const b of bilete) {
    const img = await hentBilete(doc, b.src)
    if (!img) { advarslar.push('bilete'); continue }
    const k = sideFor(brot, b.y)
    sider[k].drawImage(img, { x: pdfX(b.x), y: pdfY(b.y + b.h, k), width: b.w * PX, height: b.h * PX })
  }
  // tekst (ekte vektortekst)
  for (const t of tekstar) {
    const k = sideFor(brot, t.y)
    const f = fonter[(t.bold ? 'b' : '') + (t.kursiv ? 'i' : '') || 'n']
    const size = t.fs * PX
    const base = pdfY(t.y + t.h - t.fs * 0.212, k)
    const farga = rgb(...t.col)
    if (t.spacing) {
      for (const g of t.tegn) { if (g.c.trim()) sider[k].drawText(rens(f, g.c), { x: pdfX(g.x), y: base, size, font: f, color: farga }) }
    } else {
      const str = t.tegn.map(g => rens(f, g.c)).join('').replace(/\s+$/, '')
      sider[k].drawText(str, { x: pdfX(t.tegn[0].x), y: base, size, font: f, color: farga })
    }
    if (t.understrek) {
      const sist = t.tegn[t.tegn.length - 1]
      sider[k].drawLine({ start: { x: pdfX(t.tegn[0].x), y: base - 1.5 }, end: { x: pdfX(sist.x + sist.w), y: base - 1.5 }, thickness: 0.6, color: farga })
    }
  }

  // botntekst: kven som eksporterte + tidspunkt + sidetal
  const no = new Date()
  const stempel = `Eksportert av ${eksportBrukar || 'ukjend brukar'} · ${no.toLocaleDateString('nb-NO')} kl. ${no.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}`
  const grå = rgb(0.4, 0.4, 0.4)
  sider.forEach((s, k) => {
    s.drawLine({ start: { x: MARG_PT, y: 38 }, end: { x: SIDE_B - MARG_PT, y: 38 }, thickness: 0.5, color: rgb(0.75, 0.75, 0.75) })
    s.drawText(stempel.split('').map(c => rens(fonter.n, c)).join(''), { x: MARG_PT, y: 26, size: 8, font: fonter.n, color: grå })
    const sidetekst = `Side ${k + 1} av ${antal}`
    s.drawText(sidetekst, { x: SIDE_B - MARG_PT - fonter.n.widthOfTextAtSize(sidetekst, 8), y: 26, size: 8, font: fonter.n, color: grå })
  })

  // PDF-vedlegg bak notatsidene
  for (const a of (note.attachments || [])) {
    if (!(a.type?.includes('pdf') || /\.pdf$/i.test(a.name || ''))) continue
    try {
      const svar = await fetch(await vedleggUrl(a))
      if (!svar.ok) throw new Error('HTTP ' + svar.status)
      const kjelde = await PDFDocument.load(await svar.arrayBuffer(), { ignoreEncryption: true })
      const kopiar = await doc.copyPages(kjelde, kjelde.getPageIndices())
      kopiar.forEach(s => doc.addPage(s))
    } catch (e) {
      console.error('PDF-vedlegg feila:', a.name, e)
      advarslar.push(a.name)
    }
  }

  doc.setTitle(note.title || 'Notat')
  doc.setCreator('LiedLab')
  doc.setAuthor(eksportBrukar || '')
  const bytes = await doc.save()
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  const lenke = document.createElement('a')
  lenke.href = url; lenke.download = filnamnFor(note)
  document.body.appendChild(lenke); lenke.click(); lenke.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  return { advarslar }
}
