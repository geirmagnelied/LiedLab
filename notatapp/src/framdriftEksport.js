import { addDays, format, getISOWeek } from 'date-fns'
import { tilDato } from './framdriftDato'
import { visingsrader, harBorn, forfedrar } from './framdriftLogikk'
import { fordelTimar, personDelar } from './framdriftTimar'
import { vekeStart } from './kontorkalender'
import { KOLONNE_DEF, bygVerdiar } from './framdriftVerdiar'
import { personFarge } from './personFarge'

// ═══════════════════════════════════════════════════════════════════
//  Excel-eksport av framdriftsplanen (exceljs, lasta først ved bruk):
//    «tabell»     — kolonnane + timar per veke (tal)
//    «tidslinje»  — same tabell, men vekekolonnane teiknar stolpane i fargar (og viser timar i cella)
//  I tillegg eit ark «Timar per person» (person × veke, med sum). Hierarkiet vert vist med innrykk og PNS-nivå;
//  personar vert eksporterte som underrader under kvar aktivitet.
// ═══════════════════════════════════════════════════════════════════

const FASEFARGAR = ['#2D6A4F', '#1565C0', '#B5296B', '#C2570C', '#0E7490', '#6D28D9', '#8A6D00']
const argb = (hex) => 'FF' + hex.replace('#', '').toUpperCase()
const lysare = (hex, a = 0.78) => {
  const n = parseInt(hex.replace('#', ''), 16)
  const mix = (c) => Math.round(c + (255 - c) * a).toString(16).padStart(2, '0')
  return '#' + mix((n >> 16) & 255) + mix((n >> 8) & 255) + mix(n & 255)
}

export async function eksporterExcel({ elementer, dokMap, prisar, kal, fargeKart, prosjektNamn, medTidslinje }) {
  const ExcelJS = (await import('exceljs')).default
  const { verdi, erSammen } = bygVerdiar({ elementer, dokMap, prisar })
  const fasar = elementer.filter(e => e.type === 'fase')
  const fargeFor = (e) => {
    if (e.farge) return e.farge
    const rot = e.type === 'fase' ? e : forfedrar(elementer, e.id).find(f => f.type === 'fase')
    const i = rot ? fasar.findIndex(f => f.id === rot.id) : -1
    return i >= 0 ? FASEFARGAR[i % FASEFARGAR.length] : '#475569'
  }
  const foreldre = new Set(elementer.filter(e => e.forelder != null).map(e => e.forelder))
  const vekeKart = new Map(elementer.filter(e => e.type === 'aktivitet' && !foreldre.has(e.id) && +e.timar > 0)
    .map(e => [e.id, new Map(fordelTimar(e, kal).map(v => [v.veke, v.timar]))]))

  // rader (hierarki, alt utvida) + personrader
  const rader = []
  for (const e of visingsrader(elementer, new Set())) {
    rader.push({ e, nivå: e.nivå })
    if (vekeKart.has(e.id)) for (const p of personDelar(e)) rader.push({ person: p, akt: e, nivå: e.nivå + 1 })
  }

  // veker
  const hentVeker = () => {
    let fra, til
    if (medTidslinje && elementer.length) {
      fra = elementer.reduce((m, e) => (e.start < m ? e.start : m), elementer[0].start)
      til = elementer.reduce((m, e) => (e.slutt > m ? e.slutt : m), elementer[0].slutt)
    } else {
      const alle = [...vekeKart.values()].flatMap(k => [...k.keys()]).sort()
      if (!alle.length) return []
      fra = alle[0]; til = alle[alle.length - 1]
    }
    const ut = []
    for (let d = vekeStart(tilDato(fra)); d <= tilDato(til); d = addDays(d, 7)) ut.push(format(d, 'yyyy-MM-dd'))
    return ut
  }
  const veker = hentVeker()

  const wb = new ExcelJS.Workbook()
  wb.creator = 'LiedLab'
  const ws = wb.addWorksheet('Framdrift', { views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }] })
  const kol = KOLONNE_DEF
  const antalFast = 1 + kol.length

  // overskrift (2 rader: månad/veke og kolonnenamn)
  const hov1 = ['', ...kol.map(() => ''), ...veker.map(v => 'v' + getISOWeek(tilDato(v)))]
  const hov2 = [prosjektNamn || 'Framdrift', ...kol.map(k => k.label), ...veker.map(v => format(tilDato(v), 'dd.MM'))]
  ws.addRow(hov1); ws.addRow(hov2)
  for (const r of [1, 2]) {
    ws.getRow(r).font = { bold: true, size: 10 }
    ws.getRow(r).eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4EF' } }; c.alignment = { horizontal: 'center', vertical: 'middle' }; c.border = { bottom: { style: 'thin', color: { argb: 'FF999999' } } } })
  }
  ws.getCell(2, 1).alignment = { horizontal: 'left' }
  ws.getColumn(1).width = 44
  kol.forEach((k, i) => { ws.getColumn(i + 2).width = Math.max(8, Math.round(k.w / 7)) })
  veker.forEach((_, i) => { ws.getColumn(antalFast + i + 1).width = medTidslinje ? 5.5 : 8 })

  // datarader
  for (const r of rader) {
    if (r.person) {
      const t = vekeKart.get(r.akt.id)
      const rad = ws.addRow(['    '.repeat(r.nivå) + r.person.namn + (personDelar(r.akt).length > 1 ? ' (' + r.person.del + '%)' : ''), ...kol.map(k => (k.key === 'timar' ? Math.round((+r.akt.timar || 0) * r.person.del / 100 * 2) / 2 : '')),
        ...veker.map(v => { const x = (t.get(v) || 0) * r.person.del / 100; return x ? Math.round(x * 10) / 10 : '' })])
      rad.font = { size: 9, color: { argb: 'FF555555' } }
      const f = personFarge(r.person.namn, fargeKart)
      rad.getCell(1).font = { size: 9, color: { argb: argb(f) }, bold: true }
      veker.forEach((v, i) => { const c = rad.getCell(antalFast + i + 1); if (c.value !== '') { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(lysare(f, 0.6)) } }; c.alignment = { horizontal: 'center' } } })
      continue
    }
    const e = r.e
    const sam = erSammen(e)
    const rad = ws.addRow(['    '.repeat(r.nivå) + (e.type === 'aktivitet' && sam ? '∑ ' : e.type === 'milepael' ? '◆ ' : '') + e.namn, ...kol.map(k => verdi(e, k.key)),
      ...veker.map(v => {
        if (medTidslinje) {
          const t = vekeKart.get(e.id)?.get(v)
          if (t) return Math.round(t * 10) / 10
          return ''
        }
        // berre tabell: timar per veke (summert for summasjonar/fasar)
        const gaaSum = (x) => (vekeKart.has(x.id) ? (vekeKart.get(x.id).get(v) || 0) : elementer.filter(c => c.forelder === x.id).reduce((a, c) => a + gaaSum(c), 0))
        const t = e.type === 'milepael' ? 0 : gaaSum(e)
        return t ? Math.round(t * 10) / 10 : ''
      })])
    rad.font = { size: 10, bold: sam }
    if (sam) rad.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F4' } } })
    kol.forEach((k, i) => { if (k.hogre) rad.getCell(i + 2).alignment = { horizontal: 'right' } })
    rad.getCell(1).alignment = { indent: 0 }
    if (medTidslinje) {
      const f = fargeFor(e)
      const s = e.start, sl = e.slutt
      veker.forEach((v, i) => {
        const mandag = tilDato(v), søndag = addDays(mandag, 6)
        const c = rad.getCell(antalFast + i + 1)
        const rør = e.type === 'milepael' ? (tilDato(s) >= mandag && tilDato(s) <= søndag) : (tilDato(s) <= søndag && tilDato(sl) >= mandag)
        if (!rør) return
        if (e.type === 'milepael') { c.value = '◆'; c.font = { color: { argb: argb(f) }, bold: true }; c.alignment = { horizontal: 'center' }; return }
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(sam ? f : f) } }
        c.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 9 }
        c.alignment = { horizontal: 'center' }
      })
    }
  }
  // sum-rad per veke (blad-aktivitetar)
  const sumRad = ws.addRow(['Totalt timar', ...kol.map(k => (k.key === 'timar' ? Math.round([...vekeKart.keys()].reduce((a, id) => a + (+elementer.find(x => x.id === id).timar || 0), 0) * 2) / 2 : '')),
    ...veker.map(v => { const t = [...vekeKart.values()].reduce((a, m) => a + (m.get(v) || 0), 0); return t ? Math.round(t * 10) / 10 : '' })])
  sumRad.font = { bold: true }
  sumRad.eachCell(c => { c.border = { top: { style: 'medium', color: { argb: 'FF666666' } } } })

  // ark 2: timar per person per veke
  const ws2 = wb.addWorksheet('Timar per person', { views: [{ state: 'frozen', xSplit: 2, ySplit: 2 }] })
  const alleVeker = [...new Set([...vekeKart.values()].flatMap(m => [...m.keys()]))].sort()
  const perPerson = new Map()
  for (const [id, m] of vekeKart) {
    const e = elementer.find(x => x.id === id)
    for (const p of personDelar(e)) {
      if (!perPerson.has(p.namn)) perPerson.set(p.namn, new Map())
      const pm = perPerson.get(p.namn)
      for (const [v, t] of m) pm.set(v, (pm.get(v) || 0) + t * p.del / 100)
    }
  }
  ws2.addRow(['Person', 'Sum t', ...alleVeker.map(v => 'v' + getISOWeek(tilDato(v)))])
  ws2.addRow(['', '', ...alleVeker.map(v => format(tilDato(v), 'dd.MM'))])
  ;[1, 2].forEach(r => { ws2.getRow(r).font = { bold: true, size: 10 }; ws2.getRow(r).eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4EF' } }; c.alignment = { horizontal: 'center' } }) })
  ws2.getColumn(1).width = 28; ws2.getColumn(2).width = 9
  alleVeker.forEach((_, i) => { ws2.getColumn(i + 3).width = 7 })
  for (const n of [...perPerson.keys()].sort((a, b) => a.localeCompare(b, 'nb'))) {
    const pm = perPerson.get(n)
    const sum = [...pm.values()].reduce((a, b) => a + b, 0)
    const rad = ws2.addRow([n, Math.round(sum * 2) / 2, ...alleVeker.map(v => (pm.get(v) ? Math.round(pm.get(v) * 10) / 10 : ''))])
    const f = personFarge(n, fargeKart)
    rad.getCell(1).font = { bold: true, color: { argb: argb(f) } }
    alleVeker.forEach((v, i) => { const c = rad.getCell(i + 3); if (c.value !== '') { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(lysare(f, 0.6)) } }; c.alignment = { horizontal: 'center' } } })
  }
  const tot = ws2.addRow(['Totalt', Math.round([...perPerson.values()].reduce((a, m) => a + [...m.values()].reduce((x, y) => x + y, 0), 0) * 2) / 2,
    ...alleVeker.map(v => { const t = [...perPerson.values()].reduce((a, m) => a + (m.get(v) || 0), 0); return t ? Math.round(t * 10) / 10 : '' })])
  tot.font = { bold: true }

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const trygg = (prosjektNamn || 'Framdrift').replace(/[\\/:*?"<>|]+/g, ' ').trim()
  a.href = url; a.download = `Framdrift ${trygg} ${medTidslinje ? '(tabell og tidslinje)' : '(tabell)'} ${format(new Date(), 'yyyy-MM-dd')}.xlsx`
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
