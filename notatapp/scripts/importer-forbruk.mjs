// Les timeføringsrapportar (*.xlsx) frå ei mappe og skriv ut SQL som erstattar forbruket for kvar rapport sin periode
// (idempotent: å køyre same fil fleire gonger gjev same resultat). Brukt av den ukentlege automatiske importen
// (sjå claude/framdrift-modul.md) — SQL-en vert køyrd mot Supabase, og prosjektet vert funne på prosjektnummeret i fila.
//   node scripts/importer-forbruk.mjs "<mappe>"        → skriv ein SQL-blokk per fil + ei oppsummering til stderr
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { parseForbruk } from '../src/framdriftForbruk.js'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const mappe = process.argv[2]
if (!mappe || !fs.existsSync(mappe)) { console.error('Mappa finst ikkje: ' + mappe); process.exit(2) }
const q = (s) => "'" + String(s ?? '').replace(/'/g, "''") + "'"
const filer = fs.readdirSync(mappe).filter(f => /\.xlsx$/i.test(f) && !f.startsWith('~$'))
  .map(f => ({ f, t: fs.statSync(path.join(mappe, f)).mtimeMs })).sort((a, b) => a.t - b.t)

let tot = 0
for (const { f } of filer) {
  const wb = XLSX.readFile(path.join(mappe, f), { cellDates: true })
  const ark = wb.Sheets[wb.SheetNames[0]]
  const res = parseForbruk(XLSX.utils.sheet_to_json(ark, { header: 1, defval: '', raw: true }))
  if (!res.rader.length || !res.prosjektNr) { console.error(`HOPPAR OVER ${f}: ${res.feil.join(' ') || 'ingen timeføringar eller manglar oppdragsnummer'}`); continue }
  const sum = res.rader.reduce((a, r) => a + r.timar, 0)
  console.error(`${f}: oppdrag ${res.prosjektNr}, ${res.fra} – ${res.til}, ${res.rader.length} føringar, ${sum} t`)
  tot += res.rader.length
  const verdiar = res.rader.map(r => `(${q(r.dato)}::date,${r.vekeaar},${r.vekenr},${q(r.ansatt)},${q(r.ansattNamn)},${q(r.aktivitet)},${q(r.kode)},${r.timar},${q(r.beskrivelse)})`).join(',\n')
  console.log(`-- ${f}
with p as (select id, user_id from projects where project_number = ${q(res.prosjektNr)} order by created_at limit 1),
slett as (delete from framdrift_forbruk f using p where f.project_id = p.id and f.dato between ${q(res.fra)}::date and ${q(res.til)}::date returning 1)
insert into framdrift_forbruk (user_id, project_id, dato, vekeaar, vekenr, ansatt, ansatt_namn, aktivitet, kode, timar, beskrivelse, kilde)
select p.user_id, p.id, v.dato, v.vekeaar, v.vekenr, v.ansatt, v.ansatt_namn, v.aktivitet, v.kode, v.timar, v.beskrivelse, ${q(f)}
from p, (values
${verdiar}
) as v(dato, vekeaar, vekenr, ansatt, ansatt_namn, aktivitet, kode, timar, beskrivelse);
`)
}
console.error(`Ferdig: ${filer.length} fil(er), ${tot} føringar.`)
