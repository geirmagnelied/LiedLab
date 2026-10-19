// ═══════════════════════════════════════════════════════════════════
//  notatPdf — eksport av notat / møtenotat / referat til PDF.
//  1) Notatet vert teikna (html2canvas) i ein A4-breidd og skore i sider (brotpunkt på ei kvit rad, så tekstlinjer
//     sjeldan vert kutta), 2) PDF-vedlegg frå notatet vert henta og lagde inn bak notatsidene (pdf-lib).
//  Biblioteka vert lasta først ved eksport (dynamisk import) så hovud-bunten ikkje veks.
// ═══════════════════════════════════════════════════════════════════

const SIDE_B = 794, SIDE_H = 1123, MARG = 56            // A4 i CSS-pikslar (96 dpi)
const INN_B = SIDE_B - 2 * MARG, INN_H = SIDE_H - 2 * MARG
const SKALA = 2

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
    ? `<table style="border-collapse:collapse;margin:0 0 14px;font-size:12.5px">${rader.map(([k, v]) => `<tr><td style="padding:2px 14px 2px 0;font-weight:700;vertical-align:top">${k}</td><td style="padding:2px 0">${esc(v)}</td></tr>`).join('')}</table>` : ''
  const innhald = note.html
    ? note.html
    : `<div style="white-space:pre-wrap">${esc(note.text || '')}</div>`
  const oppg = note.tasks?.length
    ? `<h3 style="font-size:13px;margin:22px 0 8px;text-transform:uppercase;letter-spacing:.05em">Arbeidsoppgåver</h3>` +
      note.tasks.map(t => `<div style="margin:3px 0;font-size:13px">${t.done ? '☑' : '☐'} ${esc(t.text)}${t.date ? ` <span style="color:#666">(${esc(fmtDato(t.date))})</span>` : ''}</div>`).join('') : ''
  const skisse = note.sketchDataUrl ? `<div style="margin-top:18px"><img src="${note.sketchDataUrl}" style="max-width:100%;border:1px solid #ccc"/></div>` : ''
  const vedlegg = note.attachments?.length
    ? `<h3 style="font-size:13px;margin:22px 0 6px;text-transform:uppercase;letter-spacing:.05em">Vedlegg</h3>` +
      note.attachments.map(a => `<div style="font-size:12.5px;margin:2px 0">${esc(a.name)}${a.type?.includes('pdf') ? ' <span style="color:#666">(lagt inn bak i dokumentet)</span>' : ''}</div>`).join('') : ''
  return `
    <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#1B4332">${typeFor(note)}${note.nr != null ? ' nr. ' + esc(note.nr) : ''}</div>
    <h1 style="font-size:24px;margin:4px 0 6px;line-height:1.25">${esc(tittel)}</h1>
    <div style="font-size:12px;color:#555;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid #1B4332">
      ${prosjektNamn ? esc(prosjektNamn) + ' · ' : ''}${esc(fmtDato(note.updatedAt || note.createdAt || new Date()))}</div>
    ${meta}
    <div style="font-size:14px;line-height:1.65">${innhald}</div>
    ${oppg}${skisse}${vedlegg}`
}

// Finn ei rad nær botnen av sida utan "blekk", så sida ikkje kuttar midt i ei tekstlinje
function finnBrot(ctx, bredde, frå, til, minst) {
  const data = ctx.getImageData(0, frå, bredde, til - frå).data
  const h = til - frå
  for (let y = h - 1; y >= minst; y--) {
    let kvit = true
    for (let x = 0; x < bredde; x += 3) {
      const i = (y * bredde + x) * 4
      if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) { kvit = false; break }
    }
    if (kvit) return frå + y
  }
  return til
}

export function filnamnFor(note) {
  const tittel = (note.title || 'notat').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 80) || 'notat'
  return tittel + '.pdf'
}

// Gjev { advarslar: [...] }. Lastar ned fila i nettlesaren.
export async function eksporterNotatPdf(note, prosjektNamn = '') {
  const [{ default: html2canvas }, { PDFDocument }] = await Promise.all([import('html2canvas'), import('pdf-lib')])
  const advarslar = []

  const boks = document.createElement('div')
  boks.setAttribute('data-notranslate', '')
  boks.style.cssText = `position:fixed;left:-10000px;top:0;width:${INN_B}px;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;`
  boks.innerHTML = `<style>
      .pdf-notat table{border-collapse:collapse;max-width:100%} .pdf-notat td,.pdf-notat th{border:1px solid #999;padding:4px 8px;vertical-align:top}
      .pdf-notat img{max-width:100%} .pdf-notat p{margin:0 0 .5em} .pdf-notat ul,.pdf-notat ol{margin:.3em 0 .6em 1.4em;padding:0}
    </style><div class="pdf-notat">${byggHtml(note, prosjektNamn)}</div>`
  document.body.appendChild(boks)

  let lerret
  try {
    lerret = await html2canvas(boks, { scale: SKALA, backgroundColor: '#ffffff', useCORS: true, logging: false })
  } finally { boks.remove() }

  const doc = await PDFDocument.create()
  const ctx = lerret.getContext('2d', { willReadFrequently: true })
  const sideHPx = INN_H * SKALA
  let y = 0
  while (y < lerret.height) {
    let slutt = Math.min(y + sideHPx, lerret.height)
    if (slutt < lerret.height) slutt = finnBrot(ctx, lerret.width, y, slutt, Math.floor(sideHPx * 0.6))
    const h = slutt - y
    const del = document.createElement('canvas')
    del.width = lerret.width; del.height = h
    del.getContext('2d').drawImage(lerret, 0, y, lerret.width, h, 0, 0, lerret.width, h)
    const jpg = await doc.embedJpg(del.toDataURL('image/jpeg', 0.92))
    const side = doc.addPage([SIDE_B * 0.75, SIDE_H * 0.75])        // pt (1 px = 0.75 pt)
    side.drawImage(jpg, { x: MARG * 0.75, y: side.getHeight() - MARG * 0.75 - (h / SKALA) * 0.75, width: INN_B * 0.75, height: (h / SKALA) * 0.75 })
    y = slutt
  }

  // PDF-vedlegg bak notatsidene
  for (const a of (note.attachments || [])) {
    if (!(a.type?.includes('pdf') || /\.pdf$/i.test(a.name || ''))) continue
    try {
      const svar = await fetch(a.url)
      if (!svar.ok) throw new Error('HTTP ' + svar.status)
      const kjelde = await PDFDocument.load(await svar.arrayBuffer(), { ignoreEncryption: true })
      const sider = await doc.copyPages(kjelde, kjelde.getPageIndices())
      sider.forEach(s => doc.addPage(s))
    } catch (e) {
      console.error('PDF-vedlegg feila:', a.name, e)
      advarslar.push(a.name)
    }
  }

  doc.setTitle(note.title || 'Notat')
  const bytes = await doc.save()
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  const lenke = document.createElement('a')
  lenke.href = url; lenke.download = filnamnFor(note)
  document.body.appendChild(lenke); lenke.click(); lenke.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  return { advarslar }
}
