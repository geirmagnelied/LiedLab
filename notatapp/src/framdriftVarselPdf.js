// PDF av eit endringsvarsel (A4 ståande). Køyrer med pdf-lib (lasta ved behov). Same stil som rapport-PDF-en: blå overskriftsceller, mørkeblå strek.
export const varselFilnamn = (tittel, prosjektNr) =>
  (`${prosjektNr ? prosjektNr + ' ' : ''}Endringsvarsel ${tittel || ''}`.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim() || 'Endringsvarsel') + '.pdf'

const datoNo = (s) => (s ? String(s).split('-').reverse().join('.') : '')
const kr = (n) => Math.round(n || 0).toLocaleString('nb-NO').replace(/ | /g, ' ')
const tal = (n) => (n ? String(Math.round(n * 100) / 100).replace('.', ',') : '')
const PUNKT = [['budsjett', '1. Behov for å justere budsjettet'], ['forslag', '2. Endringsforslag'], ['anna', '3. Anna']]

// innhald: lagra innhald-objekt; aktNamn(id) → visingsnamn på aktivitet
export async function lagVarselPdf({ innhald: d, tittel, prosjektNamn, prosjektNr, aktNamn, brukar }) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  const fn = await doc.embedFont(StandardFonts.Helvetica), fb = await doc.embedFont(StandardFonts.HelveticaBold)
  const rens = (f, s) => String(s ?? '').replace(/\r/g, '').split('').map(c => { if (c === '\n') return c; try { f.encodeText(c); return c } catch { return c === '–' || c === '−' ? '-' : c === '’' ? "'" : '?' } }).join('')
  const B = 595.28, H = 841.89, M = 48, bredd = B - 2 * M
  const blaa = rgb(0.663, 0.784, 0.925), mork = rgb(0.04, 0.17, 0.4), svart = rgb(0, 0, 0), graa = rgb(0.35, 0.35, 0.35), lys = rgb(0.93, 0.95, 0.98)
  const sider = []
  let side, y
  const nySide = () => { side = doc.addPage([B, H]); sider.push(side); y = H - M }
  const plass = (h) => { if (y - h < M + 22) nySide() }
  const bryt = (tekst, font, size, maks) => {
    const ut = []
    for (const avsn of rens(font, tekst).split('\n')) {
      const ord = avsn.split(/\s+/).filter(Boolean); let l = ''
      if (!ord.length) { ut.push(''); continue }
      for (const o of ord) {
        const t = l ? l + ' ' + o : o
        if (font.widthOfTextAtSize(t, size) <= maks || !l) l = t; else { ut.push(l); l = o }
      }
      if (l) ut.push(l)
    }
    return ut.length ? ut : ['']
  }
  const tekst = (t, x, yy, size, font = fn, color = svart) => side.drawText(rens(font, t), { x, y: yy, size, font, color })
  const hoger = (t, xHoger, yy, size, font = fn, color = svart) => { const s = rens(font, t); side.drawText(s, { x: xHoger - font.widthOfTextAtSize(s, size), y: yy, size, font, color }) }

  const avsnitt = (t) => { plass(34); y -= 14; tekst(t.toUpperCase(), M, y, 9, fb, mork); y -= 4; side.drawLine({ start: { x: M, y }, end: { x: M + bredd, y }, thickness: 0.8, color: mork }); y -= 11 }
  const brødtekst = (t, size = 10, indent = 0, font = fn) => {
    const lh = size * 1.35
    for (const l of bryt(t, font, size, bredd - indent)) { plass(lh); tekst(l, M + indent, y - size, size, font); y -= lh }
  }
  const merkelapp = (t) => { plass(14); tekst(t, M, y - 8, 8.5, fb, graa); y -= 12 }

  // Generell tabell: kol = [{namn, b (relativ breidd), hogre}], rader = [[celle,…]], sumRad = [celle,…] valfri
  const tabell = (kol, rader, sumRad) => {
    const tot = kol.reduce((a, k) => a + k.b, 0), W = kol.map(k => k.b / tot * bredd), SZ = 8.5, pad = 4, lh = 10.5
    const X = W.reduce((a, w, i) => (a.push(i ? a[i - 1] + W[i - 1] : M), a), [])
    const hov = () => {
      const linjer = kol.map((k, i) => bryt(k.namn, fb, 8, W[i] - 2 * pad)), hh = Math.max(...linjer.map(l => l.length)) * 10 + 6
      plass(hh + 22)
      kol.forEach((k, i) => {
        side.drawRectangle({ x: X[i], y: y - hh, width: W[i], height: hh, color: blaa, borderColor: svart, borderWidth: 0.5 })
        linjer[i].forEach((l, j) => { const yy = y - 9.5 - j * 10; k.hogre ? hoger(l, X[i] + W[i] - pad, yy, 8, fb) : tekst(l, X[i] + pad, yy, 8, fb) })
      })
      y -= hh
      side.drawLine({ start: { x: M, y }, end: { x: M + bredd, y }, thickness: 1.4, color: mork })
    }
    hov()
    const rad = (celler, fet, bakgrunn, ovre) => {
      const font = fet ? fb : fn
      const linjer = celler.map((c, i) => bryt(String(c ?? ''), font, SZ, W[i] - 2 * pad)), rh = Math.max(...linjer.map(l => l.length)) * lh + 5
      if (y - rh < M + 22) { nySide(); hov() }
      kol.forEach((k, i) => {
        side.drawRectangle({ x: X[i], y: y - rh, width: W[i], height: rh, color: bakgrunn, borderColor: svart, borderWidth: 0.4 })
        linjer[i].forEach((l, j) => { const yy = y - 9 - j * lh; k.hogre ? hoger(l, X[i] + W[i] - pad, yy, SZ, font) : tekst(l, X[i] + pad, yy, SZ, font) })
      })
      if (ovre) side.drawLine({ start: { x: M, y }, end: { x: M + bredd, y }, thickness: 1.6, color: svart })
      y -= rh
    }
    rader.forEach(r => rad(r, false, rgb(1, 1, 1)))
    if (sumRad) rad(sumRad, true, lys, true)
    y -= 4
  }

  // ── Tittelfelt ──
  nySide()
  tekst('ENDRINGSVARSEL', M, y - 9, 9, fb, mork)
  hoger([prosjektNr, prosjektNamn].filter(Boolean).join(' '), M + bredd, y - 9, 9, fn, graa)
  y -= 20
  side.drawLine({ start: { x: M, y }, end: { x: M + bredd, y }, thickness: 1.6, color: mork }); y -= 8
  for (const l of bryt(tittel || '(utan tittel)', fb, 17, bredd)) { plass(22); tekst(l, M, y - 15, 17, fb); y -= 22 }
  y -= 4
  const u = d.utsending || {}
  const meta = [['Utarbeidd av', d.utarbeidd || brukar || ''], ['Dato', datoNo(d.dato)]]
  if (u.status && u.status !== 'Utkast') {
    meta.push(['Status', u.status])
    if (u.sendtDato) meta.push(['Sendt til kunde', datoNo(u.sendtDato) + (u.sendtTil ? ' · ' + u.sendtTil : '') + (u.sendtMetode ? ' (' + u.sendtMetode + ')' : '')])
    if (u.svarDato && (u.status === 'Godkjent' || u.status === 'Avvist')) meta.push([u.status === 'Godkjent' ? 'Godkjent' : 'Avvist', datoNo(u.svarDato) + (u.svarFra ? ' · ' + u.svarFra : '')])
  } else meta.push(['Status', 'Utkast'])
  for (const [k, v] of meta) { plass(14); tekst(k, M, y - 9, 9, fb, graa); tekst(v, M + 95, y - 9, 9.5); y -= 13.5 }

  // ── Endringar ──
  if ((d.endringar || []).length) {
    avsnitt('Gjeld endring')
    for (const e of d.endringar) brødtekst('• ' + [e.nr, e.namn].filter(Boolean).join(' – ') + (e.akt != null ? '  (' + aktNamn(e.akt) + ')' : ''))
  }

  // ── Punkt (beskriving + framdrift) ──
  for (const [k, t] of PUNKT) {
    if (!d.val?.[k]) continue
    avsnitt(t)
    const p = d.punkt?.[k] || {}
    merkelapp('Beskriving'); brødtekst(p.besk || '–')
    y -= 3; merkelapp('Konsekvensar for framdrift'); brødtekst(p.framdrift || '–')
  }

  // ── Honorar ──
  const sumH = (h) => (h.timar || 0) * (h.timepris || 0) + (h.fastpris || 0)
  const honorar = (d.honorar || []).filter(h => h.timar || h.timepris || h.fastpris || h.tekst)
  const utgifter = (d.utgifter || []).filter(x => x.belop || x.tekst)
  if (honorar.length) {
    avsnitt('Honorar')
    tabell([{ namn: 'Aktivitet', b: 3 }, { namn: 'Beskriving', b: 3.4 }, { namn: 'Timebudsjett (t)', b: 1.5, hogre: true }, { namn: 'Timepris (kr/t)', b: 1.4, hogre: true }, { namn: 'Timer × pris (kr)', b: 1.6, hogre: true }, { namn: 'Endring fastpris (kr)', b: 1.6, hogre: true }, { namn: 'Sum (kr)', b: 1.5, hogre: true }],
      honorar.map(h => [aktNamn(h.akt), h.tekst || '', tal(h.timar), tal(h.timepris), (h.timar || 0) * (h.timepris || 0) ? kr((h.timar || 0) * (h.timepris || 0)) : '', h.fastpris ? kr(h.fastpris) : '', sumH(h) ? kr(sumH(h)) : '']),
      ['Sum honorar', '', tal(honorar.reduce((a, h) => a + (h.timar || 0), 0)), '', kr(honorar.reduce((a, h) => a + (h.timar || 0) * (h.timepris || 0), 0)), kr(honorar.reduce((a, h) => a + (h.fastpris || 0), 0)), kr(honorar.reduce((a, h) => a + sumH(h), 0))])
  }
  if (utgifter.length) {
    avsnitt('Utgifter')
    tabell([{ namn: 'Aktivitet', b: 3 }, { namn: 'Beskriving', b: 5 }, { namn: 'Beløp (kr)', b: 1.6, hogre: true }],
      utgifter.map(x => [aktNamn(x.akt), x.tekst || '', x.belop ? kr(x.belop) : '']), ['Sum utgifter', '', kr(utgifter.reduce((a, x) => a + (x.belop || 0), 0))])
  }

  // ── Kostnader per aktivitet ──
  if (honorar.length || utgifter.length) {
    const m = new Map(); const hent = (a) => { if (!m.has(String(a))) m.set(String(a), { akt: a, h: 0, u: 0 }); return m.get(String(a)) }
    honorar.forEach(h => { hent(h.akt).h += sumH(h) }); utgifter.forEach(x => { hent(x.akt).u += x.belop || 0 })
    const rader = [...m.values()]
    const tH = rader.reduce((a, x) => a + x.h, 0), tU = rader.reduce((a, x) => a + x.u, 0)
    avsnitt('Kostnader som følgjer av endringa')
    tabell([{ namn: 'Aktivitet', b: 4 }, { namn: 'Honorar (kr)', b: 1.6, hogre: true }, { namn: 'Utgifter (kr)', b: 1.6, hogre: true }, { namn: 'Sum (kr)', b: 1.6, hogre: true }],
      rader.map(x => [aktNamn(x.akt), kr(x.h), kr(x.u), kr(x.h + x.u)]), ['Totalt', kr(tH), kr(tU), kr(tH + tU)])
  }

  // ── Vedlegg ──
  if ((d.vedlegg || []).length) {
    avsnitt('Vedlegg')
    d.vedlegg.forEach((v, i) => brødtekst((i + 1) + '. ' + v.namn))
  }

  // ── Utsending ──
  if (u.status && u.status !== 'Utkast') {
    avsnitt('Utsending')
    ;(u.logg || []).forEach(l => brødtekst(datoNo(l.dato) + '  ' + l.status + (l.av ? ' – ' + l.av : '') + (l.tekst ? ': ' + l.tekst : '')))
    if (u.merknad) { y -= 3; merkelapp('Merknad'); brødtekst(u.merknad) }
  }

  // ── Bunntekst ──
  sider.forEach((s, i) => {
    s.drawLine({ start: { x: M, y: 34 }, end: { x: B - M, y: 34 }, thickness: 0.4, color: graa })
    s.drawText(rens(fn, 'Endringsvarsel – ' + (tittel || '')).slice(0, 90), { x: M, y: 22, size: 7.5, font: fn, color: graa })
    const st = `Side ${i + 1} av ${sider.length}`
    s.drawText(st, { x: B - M - fn.widthOfTextAtSize(st, 7.5), y: 22, size: 7.5, font: fn, color: graa })
  })
  doc.setTitle('Endringsvarsel ' + (tittel || '')); doc.setCreator('LiedLab'); doc.setAuthor(d.utarbeidd || brukar || '')
  return doc.save()
}
