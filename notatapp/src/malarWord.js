// ═══════════════════════════════════════════════════════════════════
//  malarWord — Word-malar (.docx) via biblioteket «docx» (lasta først ved nedlasting). Alle malane tek det flate
//  fletteobjektet frå malarData.js; manglande felt vert gule [plasshaldarar]. Same enkle, friske formgjeving i alle:
//  grøn aksent, Calibri, rolege tabellar, firmanamn i toppteksten og sidetal i botnen.
// ═══════════════════════════════════════════════════════════════════
import { gbnr, eigedomAdresse, brevBlokkar, brevEmne, brevHelsing } from './malarData'

const AKSENT = '1B4332', GRAA = '6B7280', LINJE = 'D5DDD8', LYS = 'EEF5F1'
const BREDDE = 9412   // innhaldsbreidd i twips (A4, 2,2 cm marg)

async function dx() { return await import('docx') }

// Segment → TextRun-ar. Segment = streng | { t, b, ph }
function runs(D, seg, base = {}) {
  return (Array.isArray(seg) ? seg : [seg]).filter(x => x !== '' && x != null).map(x => {
    const o = typeof x === 'string' ? { t: x } : x
    return new D.TextRun({ text: o.t, bold: o.b || base.bold, italics: base.italics, color: o.ph ? '7A5B00' : base.color, highlight: o.ph ? 'yellow' : undefined, size: base.size, font: 'Calibri' })
  })
}
const mangel = (f, k, etikett) => (f[k] && String(f[k]).trim() ? String(f[k]).trim() : { t: `[${etikett}]`, ph: true })

function absatz(D, seg, o = {}) {
  return new D.Paragraph({ children: runs(D, seg, o), spacing: { after: o.after ?? 140, line: 300 }, alignment: o.align, indent: o.indent, keepNext: o.keepNext })
}
function overskrift(D, tekst, o = {}) {
  return new D.Paragraph({ children: [new D.TextRun({ text: tekst, bold: true, size: o.size || 24, color: AKSENT, font: 'Calibri' })], spacing: { before: o.before ?? 240, after: 100 }, keepNext: true,
    border: o.linje === false ? undefined : { bottom: { style: D.BorderStyle.SINGLE, size: 6, color: LINJE, space: 2 } } })
}
const kant = (D, c = LINJE) => ({ style: D.BorderStyle.SINGLE, size: 4, color: c })
const ramme = (D) => ({ top: kant(D), bottom: kant(D), left: kant(D), right: kant(D) })
function celle(D, innhald, bredde, o = {}) {
  return new D.TableCell({
    width: { size: bredde, type: D.WidthType.DXA }, borders: ramme(D), margins: { top: 70, bottom: 70, left: 110, right: 110 },
    shading: o.fyll ? { type: D.ShadingType.CLEAR, color: 'auto', fill: o.fyll } : undefined, verticalAlign: D.VerticalAlign.CENTER,
    children: [new D.Paragraph({ children: runs(D, innhald, { bold: o.bold, color: o.farge, size: o.size }), spacing: { after: 0 } })],
  })
}
// Rolig oppsummeringstabell: etikett | verdi
function metaTabell(D, rader, bredder = [2400, BREDDE - 2400]) {
  return new D.Table({
    width: { size: BREDDE, type: D.WidthType.DXA }, columnWidths: bredder,
    rows: rader.map(([k, v]) => new D.TableRow({ children: [celle(D, k, bredder[0], { fyll: LYS, bold: true, farge: AKSENT }), celle(D, v, bredder[1])] })),
  })
}
// Rutenett med overskriftsrad og tomme rader
function rutenett(D, kolonner, bredder, tomRader = 6) {
  return new D.Table({
    width: { size: BREDDE, type: D.WidthType.DXA }, columnWidths: bredder,
    rows: [
      new D.TableRow({ tableHeader: true, children: kolonner.map((k, i) => celle(D, k, bredder[i], { fyll: AKSENT, bold: true, farge: 'FFFFFF' })) }),
      ...Array.from({ length: tomRader }, () => new D.TableRow({ height: { value: 520, rule: D.HeightRule.ATLEAST }, children: kolonner.map((_, i) => celle(D, '', bredder[i])) })),
    ],
  })
}
function avsendarBlokk(D, f, bm) {
  const l = []
  if (f.avsendar_firma) l.push(f.avsendar_firma)
  if (f.avsendar_adresse) l.push(f.avsendar_adresse)
  return l.map((t, i) => new D.Paragraph({ children: [new D.TextRun({ text: t, bold: i === 0, color: i === 0 ? AKSENT : GRAA, size: i === 0 ? 24 : 19, font: 'Calibri' })], spacing: { after: 0 } }))
}
function dokument(D, f, bm, barn, tittelTopp) {
  const topp = new D.Header({ children: [new D.Paragraph({ spacing: { after: 0 }, tabStops: [{ type: D.TabStopType.RIGHT, position: BREDDE }],
    border: { bottom: { style: D.BorderStyle.SINGLE, size: 12, color: AKSENT, space: 4 } },
    children: [new D.TextRun({ text: f.avsendar_firma || ' ', bold: true, color: AKSENT, size: 22, font: 'Calibri' }),
      new D.TextRun({ text: '\t' + [f.prosjektnr, f.prosjektnamn].filter(Boolean).join(' · '), color: GRAA, size: 18, font: 'Calibri' })] })] })
  const botn = new D.Footer({ children: [new D.Paragraph({ alignment: D.AlignmentType.RIGHT, spacing: { after: 0 },
    children: [new D.TextRun({ text: (tittelTopp ? tittelTopp + '  ·  ' : '') + (bm ? 'Side ' : 'Side '), color: GRAA, size: 16, font: 'Calibri' }), new D.TextRun({ children: [D.PageNumber.CURRENT], color: GRAA, size: 16, font: 'Calibri' }),
      new D.TextRun({ text: bm ? ' av ' : ' av ', color: GRAA, size: 16, font: 'Calibri' }), new D.TextRun({ children: [D.PageNumber.TOTAL_PAGES], color: GRAA, size: 16, font: 'Calibri' })] })] })
  return new D.Document({
    creator: f.avsendar_namn || 'LiedLab', title: tittelTopp || '', styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1500, bottom: 1300, left: 1247, right: 1247, header: 600, footer: 500 } } }, headers: { default: topp }, footers: { default: botn }, children: barn }],
  })
}
async function tilBlob(D, doc) { return await D.Packer.toBlob(doc) }

// ── 1. Følgebrev — søknad om rammetillatelse ──────────────────────
export async function foelgebrevRammetillatelse(f, o) {
  const D = await dx(); const bm = o.bm
  const mottakar = f.kommune ? `${f.kommune} kommune` : { t: '[kommune]', ph: true }
  const barn = [
    ...avsendarBlokk(D, f, bm),
    new D.Paragraph({ children: [], spacing: { after: 260 } }),
    absatz(D, [{ t: bm ? 'Til: ' : 'Til: ', b: true }, mottakar, bm ? ' – Byggesak' : ' – Byggesak'], { after: 40 }),
    absatz(D, [{ t: (bm ? 'Dato: ' : 'Dato: '), b: true }, f.dato || ''], { after: 40 }),
    absatz(D, [{ t: (bm ? 'Vår ref.: ' : 'Vår ref.: '), b: true }, mangel(f, 'prosjektnr', 'prosjektnr.')], { after: 260 }),
    new D.Paragraph({ children: [new D.TextRun({ text: brevEmne(f, bm), bold: true, size: 30, color: AKSENT, font: 'Calibri' })], spacing: { after: 200 } }),
  ]
  for (const b of brevBlokkar(f, bm, o.vedlegg || [])) {
    if (b.t === 'meta') { barn.push(metaTabell(D, b.rader)); barn.push(new D.Paragraph({ children: [], spacing: { after: 160 } })) }
    else if (b.t === 'p') barn.push(absatz(D, b.seg))
    else if (b.t === 'h') barn.push(overskrift(D, b.tekst, { before: 200, linje: false }))
    else if (b.t === 'li') barn.push(new D.Paragraph({ children: runs(D, [b.nr + '.\t', b.tekst]), spacing: { after: 60 }, indent: { left: 460, hanging: 460 }, tabStops: [{ type: D.TabStopType.LEFT, position: 460 }] }))
  }
  barn.push(new D.Paragraph({ children: [], spacing: { after: 120 } }))
  barn.push(absatz(D, brevHelsing(bm), { after: 560 }))
  barn.push(absatz(D, [{ t: f.avsendar_namn || '[namn]', b: true, ph: !f.avsendar_namn }], { after: 0 }))
  if (f.avsendar_tittel) barn.push(absatz(D, f.avsendar_tittel, { after: 0, color: GRAA }))
  barn.push(absatz(D, [f.avsendar_firma || ''], { after: 0, color: GRAA }))
  const kont = [f.avsendar_epost, f.avsendar_tlf].filter(Boolean).join('  ·  ')
  if (kont) barn.push(absatz(D, kont, { after: 0, color: GRAA }))
  return tilBlob(D, dokument(D, f, bm, barn, bm ? 'Søknad om rammetillatelse' : 'Søknad om rammetillatelse'))
}

// ── 2. Møteinnkalling ─────────────────────────────────────────────
export async function moteinnkalling(f, o) {
  const D = await dx(); const bm = o.bm; const t = (nn, b) => (bm ? b : nn)
  const barn = [
    new D.Paragraph({ children: [new D.TextRun({ text: t('Innkalling til møte', 'Innkalling til møte'), bold: true, size: 40, color: AKSENT, font: 'Calibri' })], spacing: { after: 60 } }),
    absatz(D, [[f.prosjektnr, f.prosjektnamn].filter(Boolean).join(' – ') || { t: '[prosjekt]', ph: true }], { color: GRAA, after: 240, size: 24 }),
    metaTabell(D, [
      [t('Tema', 'Tema'), [{ t: t('[møtetema]', '[møtetema]'), ph: true }]], [t('Dato og tid', 'Dato og tid'), [{ t: '[dato, klokkeslett]', ph: true }]],
      [t('Stad', 'Sted'), [{ t: t('[møtestad / Teams-lenkje]', '[møtested / Teams-lenke]'), ph: true }]],
      [t('Innkalla av', 'Innkalt av'), [mangel(f, 'avsendar_namn', 'namn'), f.avsendar_firma ? `, ${f.avsendar_firma}` : '']],
      [t('Tiltakshavar', 'Tiltakshaver'), [mangel(f, 'tiltakshavar_namn', 'tiltakshavar')]],
      [t('Eigedom', 'Eiendom'), [eigedomAdresse(f) || { t: '[adresse]', ph: true }, gbnr(f) ? ` (gnr. ${f.gnr || '–'} / bnr. ${f.bnr || '–'})` : '']],
    ]),
    overskrift(D, t('Deltakarar', 'Deltakere')),
    rutenett(D, [t('Namn', 'Navn'), t('Firma / fag', 'Firma / fag'), t('E-post', 'E-post'), t('Svar', 'Svar')], [2700, 2500, 3012, 1200], 5),
    overskrift(D, t('Saksliste', 'Saksliste')),
    ...[t('Godkjenning av innkalling og førre referat', 'Godkjenning av innkalling og forrige referat'), t('Status frå fag og framdrift', 'Status fra fag og fremdrift'), t('Tema til diskusjon', 'Tema til diskusjon'), t('Oppfølging av aksjonar', 'Oppfølging av aksjoner'), t('Eventuelt og neste møte', 'Eventuelt og neste møte')]
      .map((tx, i) => new D.Paragraph({ children: runs(D, [(i + 1) + '.\t', tx]), spacing: { after: 70 }, indent: { left: 460, hanging: 460 }, tabStops: [{ type: D.TabStopType.LEFT, position: 460 }] })),
    absatz(D, [{ t: t('Legg gjerne ved underlag som skal gjennomgåast.', 'Legg gjerne ved underlag som skal gjennomgås.'), ph: true }], { after: 0 }),
  ]
  return tilBlob(D, dokument(D, f, bm, barn, t('Møteinnkalling', 'Møteinnkalling')))
}

// ── 3. Møtereferat ────────────────────────────────────────────────
export async function motereferat(f, o) {
  const D = await dx(); const bm = o.bm; const t = (nn, b) => (bm ? b : nn)
  const barn = [
    new D.Paragraph({ children: [new D.TextRun({ text: t('Møtereferat', 'Møtereferat'), bold: true, size: 40, color: AKSENT, font: 'Calibri' })], spacing: { after: 60 } }),
    absatz(D, [[f.prosjektnr, f.prosjektnamn].filter(Boolean).join(' – ') || { t: '[prosjekt]', ph: true }], { color: GRAA, after: 240, size: 24 }),
    metaTabell(D, [
      [t('Møte nr.', 'Møte nr.'), [{ t: '[nr.]', ph: true }]], [t('Dato / stad', 'Dato / sted'), [{ t: t('[dato, stad]', '[dato, sted]'), ph: true }]],
      [t('Referent', 'Referent'), [mangel(f, 'avsendar_namn', 'namn')]], [t('Tiltakshavar', 'Tiltakshaver'), [mangel(f, 'tiltakshavar_namn', 'tiltakshavar')]],
    ]),
    overskrift(D, t('Til stades', 'Til stede')),
    rutenett(D, [t('Namn', 'Navn'), t('Firma / fag', 'Firma / fag'), t('Til stades', 'Til stede')], [3600, 3812, 2000], 5),
    overskrift(D, t('Referat og oppfølging', 'Referat og oppfølging')),
    rutenett(D, ['Sak', t('Referat / vedtak', 'Referat / vedtak'), t('Ansvarleg', 'Ansvarlig'), 'Frist'], [700, 5012, 1900, 1800], 8),
    absatz(D, '', { after: 80 }),
    absatz(D, [{ t: t('Neste møte: ', 'Neste møte: '), b: true }, { t: '[dato]', ph: true }], { after: 0 }),
  ]
  return tilBlob(D, dokument(D, f, bm, barn, t('Møtereferat', 'Møtereferat')))
}

// ── 4. Prosjekteringsnotat (forside + oppsett) ────────────────────
export async function prosjekteringsnotat(f, o) {
  const D = await dx(); const bm = o.bm; const t = (nn, b) => (bm ? b : nn)
  const avsn = (h, hjelp) => [overskrift(D, h), absatz(D, [{ t: hjelp, ph: true }])]
  const barn = [
    new D.Paragraph({ children: [new D.TextRun({ text: t('Notat', 'Notat'), bold: true, size: 20, color: GRAA, allCaps: true, font: 'Calibri' })], spacing: { after: 40 } }),
    new D.Paragraph({ children: [new D.TextRun({ text: '[tittel på notatet]', bold: true, size: 44, color: AKSENT, font: 'Calibri', highlight: 'yellow' })], spacing: { after: 100 } }),
    absatz(D, [[f.prosjektnr, f.prosjektnamn].filter(Boolean).join(' – ') || { t: '[prosjekt]', ph: true }], { color: GRAA, after: 240, size: 24 }),
    metaTabell(D, [
      [t('Oppdragsgivar', 'Oppdragsgiver'), [mangel(f, 'tiltakshavar_namn', 'tiltakshavar')]],
      [t('Eigedom', 'Eiendom'), [eigedomAdresse(f) || { t: '[adresse]', ph: true }, gbnr(f) ? ` (gnr. ${f.gnr || '–'} / bnr. ${f.bnr || '–'})` : '', f.kommune ? ', ' + f.kommune + ' kommune' : '']],
      [t('Fag', 'Fag'), [{ t: '[fag]', ph: true }]], [t('Utarbeidd av', 'Utarbeidet av'), [mangel(f, 'avsendar_namn', 'namn')]],
      [t('Dato / rev.', 'Dato / rev.'), [(f.dato || '') + ' / ', { t: '[rev.]', ph: true }]],
    ]),
    ...avsn(t('1  Føremål', '1  Formål'), t('[Kva skal notatet avklare?]', '[Hva skal notatet avklare?]')),
    ...avsn(t('2  Grunnlag', '2  Grunnlag'), t('[Underlag, føresetnader og referansar (teikningsnr., regelverk).]', '[Underlag, forutsetninger og referanser (tegningsnr., regelverk).]')),
    ...avsn(t('3  Vurderingar', '3  Vurderinger'), t('[Vurderingar og alternativ.]', '[Vurderinger og alternativer.]')),
    ...avsn(t('4  Konklusjon og vidare arbeid', '4  Konklusjon og videre arbeid'), t('[Konklusjon, tiltak og kven som gjer kva.]', '[Konklusjon, tiltak og hvem som gjør hva.]')),
  ]
  return tilBlob(D, dokument(D, f, bm, barn, t('Notat', 'Notat')))
}
