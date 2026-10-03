// ═══════════════════════════════════════════════════════════════════
//  Konverterer «Sjekkliste_tegningskontroll_LiedLab.xlsx» (kontoret sin
//  redigerbare kjelde) til éin JSON-fil appen faktisk les frå
//  (src/sjekklister/tegningskontroll.json). Køyr på nytt kvar gong Excel-
//  fila vert oppdatert:
//
//    node scripts/konverter-sjekkliste.cjs
//
//  Kvart ark har same kolonneoppsett (rad 0 = header): ID, Tekst, Ref,
//  Stadium, Kritisk, Auto, Merknad. Rader der ALT unnateke kolonne A er
//  tomt, er ein REIN GRUPPEOVERSKRIFT internt i arket (t.d. «Planar –
//  overordna») — reint kosmetisk i Excel-fila, hoppa over her (kan
//  visast som ei eiga gruppelinje i UI-en seinare om ønskt).
// ═══════════════════════════════════════════════════════════════════
const path = require('path')
const fs = require('fs')
const XLSX = require('xlsx')

const KJELDE = path.join('C:', 'Users', 'gemli', 'Jottacloud', 'Lied Lab', 'Web', 'LiedLab', 'Sjekkliste', 'Sjekkliste_tegningskontroll_LiedLab.xlsx')
const MAAL = path.join(__dirname, '..', 'src', 'sjekklister', 'tegningskontroll.json')

// Ark-namn (Excel) → intern nøkkel (JSON). «Tittelfelt» er ikkje ein
// «type» — han vert alltid lagt til I TILLEGG til typearket (sjå
// hentGjeldandeSjekkliste i dtmKonstantar.js), difor eiga handsaming.
const TYPE_ARK = {
  Situasjonsplan: 'situasjonsplan',
  Plan: 'plan',
  Snitt: 'snitt',
  Fasade: 'fasade',
  Skjema: 'skjema',
  Detaljar: 'detaljar',
  'IFC og DWG': 'ifc_og_dwg',
}

function lesArk(ark) {
  const rows = XLSX.utils.sheet_to_json(ark, { header: 1, defval: '' })
  const punkt = []
  for (let i = 1; i < rows.length; i++) { // rad 0 = kolonneoverskrifter
    const [id, tekst, ref, stadium, kritisk, auto, merknad] = rows[i]
    if (!id || !tekst) continue // tom rad eller gruppeoverskrift (berre kolonne A/tom)
    punkt.push({
      id: String(id).trim(),
      tekst: String(tekst).trim(),
      ref: String(ref || '').trim(),
      stadium: String(stadium || '').split(',').map(s => s.trim()).filter(Boolean),
      kritisk: String(kritisk).trim().toUpperCase() === 'JA',
      auto: String(auto).trim().toUpperCase() === 'JA',
      merknad: String(merknad || '').trim(),
    })
  }
  return punkt
}

function main() {
  const wb = XLSX.readFile(KJELDE)
  const resultat = {
    generert: new Date().toISOString(),
    kjelde: path.basename(KJELDE),
    tittelfelt: wb.Sheets['Tittelfelt'] ? lesArk(wb.Sheets['Tittelfelt']) : [],
    typar: {},
  }
  for (const [arkNamn, nokkel] of Object.entries(TYPE_ARK)) {
    if (!wb.Sheets[arkNamn]) { console.warn(`Fann ikkje arket «${arkNamn}» — hoppar over.`); continue }
    resultat.typar[nokkel] = { namn: arkNamn, punkt: lesArk(wb.Sheets[arkNamn]) }
  }
  fs.mkdirSync(path.dirname(MAAL), { recursive: true })
  fs.writeFileSync(MAAL, JSON.stringify(resultat, null, 2), 'utf8')

  const talPunkt = resultat.tittelfelt.length + Object.values(resultat.typar).reduce((s, t) => s + t.punkt.length, 0)
  console.log(`Skreiv ${MAAL}`)
  console.log(`  Tittelfelt: ${resultat.tittelfelt.length} punkt`)
  for (const [nokkel, t] of Object.entries(resultat.typar)) console.log(`  ${t.namn}: ${t.punkt.length} punkt`)
  console.log(`  Totalt: ${talPunkt} kontrollpunkt`)
}

main()
