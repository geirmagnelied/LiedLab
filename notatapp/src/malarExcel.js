// ═══════════════════════════════════════════════════════════════════
//  malarExcel — Excel-malar (.xlsx) via exceljs (lasta først ved nedlasting). Same friske, enkle uttrykk som Word-malane:
//  prosjekttopp (frå prosjektopplysningane), grøn overskriftsrad, rolege rammer, frosne rader og klar for utskrift.
// ═══════════════════════════════════════════════════════════════════
import { eigedomAdresse, gbnr } from './malarData'

const AKSENT = 'FF1B4332', LYS = 'FFEEF5F1', LINJE = 'FFD5DDD8', GRAA = 'FF6B7280'
const kant = { top: { style: 'thin', color: { argb: LINJE } }, bottom: { style: 'thin', color: { argb: LINJE } }, left: { style: 'thin', color: { argb: LINJE } }, right: { style: 'thin', color: { argb: LINJE } } }

async function nyBok(f, tittel, kolonner, o = {}) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook(); wb.creator = f.avsendar_namn || 'LiedLab'; wb.created = new Date()
  const ws = wb.addWorksheet(o.blad || tittel, { views: [{ state: 'frozen', ySplit: 7, showGridLines: false }], pageSetup: { orientation: o.liggande === false ? 'portrait' : 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, margins: { left: .5, right: .5, top: .6, bottom: .6, header: .3, footer: .3 } } })
  ws.columns = kolonner.map(k => ({ width: k.b }))
  const n = kolonner.length
  // tittel + prosjektinfo
  ws.mergeCells(1, 1, 1, n); const t = ws.getCell(1, 1); t.value = tittel; t.font = { name: 'Calibri', size: 20, bold: true, color: { argb: AKSENT } }; ws.getRow(1).height = 30
  ws.mergeCells(2, 1, 2, n); const u = ws.getCell(2, 1); u.value = [f.prosjektnr, f.prosjektnamn].filter(Boolean).join(' – ') || '[prosjekt]'; u.font = { name: 'Calibri', size: 12, color: { argb: GRAA } }
  const info = [['Byggherre', f.tiltakshavar_namn || ''], ['Eigedom', [eigedomAdresse(f), gbnr(f) ? `gnr. ${f.gnr || '–'} / bnr. ${f.bnr || '–'}` : '', f.kommune].filter(Boolean).join(' · ')], ['Dato / av', [f.dato, f.avsendar_namn].filter(Boolean).join(' · ')]]
  info.forEach(([k, v], i) => {
    const r = 3 + i
    const a = ws.getCell(r, 1); a.value = k; a.font = { name: 'Calibri', size: 10, bold: true, color: { argb: AKSENT } }
    ws.mergeCells(r, 2, r, Math.max(2, n)); const b = ws.getCell(r, 2); b.value = v; b.font = { name: 'Calibri', size: 10 }
  })
  // overskriftsrad (rad 7)
  const h = ws.getRow(7); h.height = 24
  kolonner.forEach((k, i) => { const c = h.getCell(i + 1); c.value = k.t; c.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AKSENT } }; c.alignment = { vertical: 'middle', horizontal: k.hogre ? 'right' : 'left', wrapText: true, indent: 1 }; c.border = kant })
  return { wb, ws, n }
}
function rader(ws, n, fra, antal, hogreKol = []) {
  for (let r = fra; r < fra + antal; r++) {
    const row = ws.getRow(r); row.height = 20
    for (let c = 1; c <= n; c++) { const cell = row.getCell(c); cell.border = kant; cell.font = { name: 'Calibri', size: 11 }; cell.alignment = { vertical: 'middle', horizontal: hogreKol.includes(c) ? 'right' : 'left', indent: 1 }; if ((r - fra) % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FBF9' } } }
  }
}
async function blob(wb) { const buf = await wb.xlsx.writeBuffer(); return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) }

// ── 1. Teikningsliste ──
export async function teikningsliste(f, o) {
  const t = (nn, b) => (o.bm ? b : nn)
  const kol = [{ t: t('Teikningsnr.', 'Tegningsnr.'), b: 20 }, { t: 'Tittel', b: 38 }, { t: 'Fag', b: 10 }, { t: 'Fase', b: 14 }, { t: t('Målestokk', 'Målestokk'), b: 11 }, { t: 'Format', b: 9 }, { t: 'Rev.', b: 7 }, { t: 'Dato', b: 12 }, { t: t('Utarbeidd av', 'Utarbeidet av'), b: 16 }, { t: 'Status', b: 14 }]
  const { wb, ws, n } = await nyBok(f, t('Teikningsliste', 'Tegningsliste'), kol)
  rader(ws, n, 8, 40)
  ws.autoFilter = { from: { row: 7, column: 1 }, to: { row: 7, column: n } }
  ws.dataValidations.add('J8:J47', { type: 'list', allowBlank: true, formulae: [`"${t('Utkast,Til kontroll,Godkjent,Utsendt,Utgår', 'Utkast,Til kontroll,Godkjent,Utsendt,Utgår')}"`] })
  ws.dataValidations.add('F8:F47', { type: 'list', allowBlank: true, formulae: ['"A0,A1,A2,A3,A4"'] })
  return blob(wb)
}

// ── 2. Arealoppstilling (BRA) med summar ──
export async function arealoppstilling(f, o) {
  const t = (nn, b) => (o.bm ? b : nn)
  const kol = [{ t: t('Etasje / bygg', 'Etasje / bygg'), b: 20 }, { t: t('Rom / funksjon', 'Rom / funksjon'), b: 34 }, { t: 'BRA (m²)', b: 13, hogre: true }, { t: 'BYA (m²)', b: 13, hogre: true }, { t: t('Merknad', 'Merknad'), b: 36 }]
  const { wb, ws, n } = await nyBok(f, t('Arealoppstilling', 'Arealoppstilling'), kol, { liggande: false })
  rader(ws, n, 8, 30, [3, 4])
  for (let r = 8; r < 38; r++) { ws.getCell(r, 3).numFmt = '#,##0.0'; ws.getCell(r, 4).numFmt = '#,##0.0' }
  const sum = ws.getRow(38); sum.height = 24
  ws.getCell(38, 1).value = t('Sum', 'Sum')
  ws.getCell(38, 3).value = { formula: 'SUM(C8:C37)' }; ws.getCell(38, 4).value = { formula: 'SUM(D8:D37)' }
  for (let c = 1; c <= n; c++) { const cell = sum.getCell(c); cell.font = { name: 'Calibri', bold: true, color: { argb: AKSENT } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LYS } }; cell.border = kant; if (c === 3 || c === 4) { cell.numFmt = '#,##0.0'; cell.alignment = { horizontal: 'right', indent: 1 } } }
  const oppg = Number(String(f.bra || '').replace(',', '.').replace(/\s/g, ''))
  ws.getCell(40, 1).value = t('Oppgitt BRA i prosjektopplysningane', 'Oppgitt BRA i prosjektopplysningene'); ws.getCell(40, 1).font = { name: 'Calibri', size: 10, color: { argb: GRAA } }
  ws.getCell(40, 3).value = Number.isFinite(oppg) && oppg > 0 ? oppg : null; ws.getCell(40, 3).numFmt = '#,##0.0'
  ws.getCell(41, 1).value = t('Differanse mot oppgitt', 'Differanse mot oppgitt'); ws.getCell(41, 1).font = { name: 'Calibri', size: 10, color: { argb: GRAA } }
  ws.getCell(41, 3).value = { formula: 'IF(C40="","",C38-C40)' }; ws.getCell(41, 3).numFmt = '#,##0.0;[Red]-#,##0.0'
  return blob(wb)
}

// ── 3. Timekalkyle (timar × timepris) ──
export async function timekalkyle(f, o) {
  const t = (nn, b) => (o.bm ? b : nn)
  const kol = [{ t: t('Aktivitet', 'Aktivitet'), b: 36 }, { t: 'Fag', b: 12 }, { t: t('Timar', 'Timer'), b: 12, hogre: true }, { t: t('Timepris (kr)', 'Timepris (kr)'), b: 15, hogre: true }, { t: 'Sum (kr)', b: 16, hogre: true }, { t: t('Merknad', 'Merknad'), b: 30 }]
  const { wb, ws, n } = await nyBok(f, t('Timekalkyle', 'Timekalkyle'), kol, { liggande: false })
  rader(ws, n, 8, 20, [3, 4, 5])
  for (let r = 8; r < 28; r++) { ws.getCell(r, 5).value = { formula: `IF(OR(C${r}="",D${r}=""),"",C${r}*D${r})` }; ws.getCell(r, 4).numFmt = '#,##0'; ws.getCell(r, 5).numFmt = '#,##0'; ws.getCell(r, 3).numFmt = '#,##0.0' }
  const sum = ws.getRow(28); sum.height = 24
  ws.getCell(28, 1).value = t('Totalt', 'Totalt')
  ws.getCell(28, 3).value = { formula: 'SUM(C8:C27)' }; ws.getCell(28, 5).value = { formula: 'SUM(E8:E27)' }
  for (let c = 1; c <= n; c++) { const cell = sum.getCell(c); cell.font = { name: 'Calibri', bold: true, color: { argb: AKSENT } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LYS } }; cell.border = kant; if ([3, 5].includes(c)) { cell.numFmt = c === 3 ? '#,##0.0' : '#,##0'; cell.alignment = { horizontal: 'right', indent: 1 } } }
  const num = (v) => { const x = Number(String(v || '').replace(',', '.').replace(/\s/g, '')); return Number.isFinite(x) && x > 0 ? x : null }
  const lab = (r, tx) => { const c = ws.getCell(r, 1); c.value = tx; c.font = { name: 'Calibri', size: 10, color: { argb: GRAA } } }
  lab(30, t('Estimerte timar i tilbodet', 'Estimerte timer i tilbudet')); ws.getCell(30, 3).value = num(f.timeestimat); ws.getCell(30, 3).numFmt = '#,##0.0'
  lab(31, t('Tilbodspris (kr)', 'Tilbudspris (kr)')); ws.getCell(31, 5).value = num(f.tilbodssum); ws.getCell(31, 5).numFmt = '#,##0'
  lab(32, t('Differanse timar', 'Differanse timer')); ws.getCell(32, 3).value = { formula: 'IF(C30="","",C28-C30)' }; ws.getCell(32, 3).numFmt = '#,##0.0;[Red]-#,##0.0'
  lab(33, t('Differanse kr', 'Differanse kr')); ws.getCell(33, 5).value = { formula: 'IF(E31="","",E28-E31)' }; ws.getCell(33, 5).numFmt = '#,##0;[Red]-#,##0'
  return blob(wb)
}

// ── 4. Aksjonsliste ──
export async function aksjonsliste(f, o) {
  const t = (nn, b) => (o.bm ? b : nn)
  const kol = [{ t: 'Nr.', b: 7 }, { t: 'Dato', b: 12 }, { t: t('Aksjon', 'Aksjon'), b: 48 }, { t: t('Ansvarleg', 'Ansvarlig'), b: 18 }, { t: 'Frist', b: 12 }, { t: 'Status', b: 13 }, { t: t('Merknad', 'Merknad'), b: 30 }]
  const { wb, ws, n } = await nyBok(f, t('Aksjonsliste', 'Aksjonsliste'), kol)
  rader(ws, n, 8, 40)
  for (let r = 8; r < 48; r++) ws.getCell(r, 1).value = r - 7
  ws.autoFilter = { from: { row: 7, column: 1 }, to: { row: 7, column: n } }
  ws.dataValidations.add('F8:F47', { type: 'list', allowBlank: true, formulae: [`"${t('Open,Pågår,Ferdig', 'Åpen,Pågår,Ferdig')}"`] })
  ws.addConditionalFormatting({ ref: 'A8:G47', rules: [{ type: 'expression', formulae: ['$F8="Ferdig"'], style: { font: { color: { argb: 'FF9CA3AF' }, strike: true } } }] })
  return blob(wb)
}
