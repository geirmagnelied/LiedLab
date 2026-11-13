// Bygg src/data/norgipsVeggtabell.json frå råfilene i scripts/norgips-raw/*.txt
// (uttrekk frå Norgips sine veggtabell-sider, sjå claude/verktoy-modul.md for prosedyren).
// Køyr frå notatapp/:  node scripts/bygg-norgips.js [yyyy-mm-dd]   (dato = innlesingsdato; standard = i dag)
const fs = require('fs'), path = require('path'), crypto = require('crypto')

const RAA = path.join(__dirname, 'norgips-raw')
const UT = path.join(__dirname, '..', 'src', 'data', 'norgipsVeggtabell.json')
const dato = process.argv[2] || new Date().toISOString().slice(0, 10)

// Forklaring frå Norgips (tabellane «Type veggløysing/stålprofil/…» og «Platetype»)
const PLATETYPAR = {
  STD: 'Standard 12,5 mm (type A)', HRD: 'Hard 12,5 mm (type IR)', HB: 'Humidboard 12,5 mm (type GM-H2)', LB: 'Light Board 12,5 mm (type A)',
  BRN: 'Brann 15 mm (type DF)', UB13: 'Ultra Board 13, 12,5 mm (type DFIR)', UB15: 'Ultra Board 15, 15,5 mm (type DFIR)',
  SIB: 'Silentboard 12,5 mm (type DF)', SAB: 'Safeboard 12,5 mm (type DF)', AQ: 'Aquapanel 12,5 mm',
}
const FORKLARING = {
  veggloysing: { SE: 'Stål enkeltvegg', SD: 'Stål dobbelvegg' },
  stalprofil: { 'C dB+': 'Vår vanlige stender', CF: 'Vår forsterkingsprofil' },
  platelag: { '1/1': 'Ett lag gips på hver side av veggen', '0/2': 'To lag gips på ene siden av sjaktvegg' },
  isolasjon: { M: 'Mineralull densitet 13 kg/m3', S: 'Steinull type A1, densitet min. 30 kg/m3 og smeltepunkt 1000°' },
}

const tal = (s) => { const t = String(s ?? '').replace(/\s/g, '').replace(',', '.').replace(/\*/g, ''); const n = parseFloat(t); return Number.isFinite(n) ? n : null }

// «60 (30)» + «5000* (6000)*» → [{ ei:60, maks:5000, stjerne:true }, { ei:30, maks:6000, stjerne:true }]
function eiMaks(eiTxt, maksTxt) {
  const ei = String(eiTxt).match(/\d+/g)?.map(Number) || []
  const mk = String(maksTxt).replace(/\*/g, '*').match(/(\d+)(\*?)/g) || []
  const ut = []
  ei.forEach((e, i) => { const m = mk[i]; if (!m) return; ut.push({ ei: e, maks: parseInt(m, 10), stjerne: m.includes('*') }) })
  return ut
}

function dekodKode(kode) {
  const k = kode.replace(/\s+/g, ' ').trim().replace('dB+', ' dB+').replace(/\s+/g, ' ')   // «C95dB+» → «C95 dB+»
  const m = k.match(/^(SE|SD) C(\d+) dB\+ (\S+(?: \d)?) (.+)$/)
  if (!m) return { kode: k }
  const [, loysing, bredde, lagTxt, isoTxt] = m
  const lag = lagTxt.replace(/\s/g, '')
  const sjakt = /^0\//.test(lag)
  // Hovudplate (for robustheit/romtype): BRN, UB13, UB15, LB, SIB, SAB, AQ eller standard (tal)
  const pl = (lag.match(/(BRN|UB13|UB15|LB|SIB|SAB|AQ)/) || [])[1] || 'STD'
  // Tal lag per side (største sida)
  const sider = lag.split('/')
  const tel = (s) => { const t = s.match(/^(\d+)x/) || s.match(/x(\d+)$/); const p = s.match(/\+/g); return (t ? parseInt(t[1], 10) : 1) + (p ? p.length : 0) + (/^\d+$/.test(s) ? parseInt(s, 10) - 1 : 0) }
  const lagPerSide = Math.max(...sider.map(tel))
  const iso = isoTxt.match(/([MS])(\d+|\/M0|\s?0)?/)
  return { kode: k, loysing, stenderBredde: +bredde, lagKode: lag, sjakt, hovudplate: pl, lagPerSide, isolasjon: isoTxt, isolasjonMateriale: iso ? iso[1] : null }
}

const rader = [], kontrollsum = {}, kjelder = []
for (const f of fs.readdirSync(RAA).filter(x => x.endsWith('.txt')).sort()) {
  const txt = fs.readFileSync(path.join(RAA, f), 'utf8').replace(/\r\n/g, '\n')
  kontrollsum[f.replace('.txt', '')] = crypto.createHash('sha256').update(txt.trim()).digest('hex').slice(0, 16)
  let familie = '', kjelde = '', plater = [], tabell = ''
  for (const l of txt.split('\n')) {
    if (!l.trim()) continue
    if (l.startsWith('## kjelde=')) { kjelde = l.match(/kjelde=(\S+)/)[1]; familie = l.match(/familie=(\S+)/)[1]; kjelder.push({ familie, url: kjelde }); continue }
    if (l.startsWith('## ')) { tabell = l.match(/## (\S+)/)[1]; plater = l.match(/plater=(\S+)/)[1].split(','); continue }
    const c = l.split('|')
    if (c.length < 16) { console.error('Hoppar over rad med feil kolonnetal i', f, ':', l.slice(0, 60)); continue }
    const [nr, kode, ei, ...rest] = c
    const kryss = rest.slice(0, 4), [plateTxt, veggTjukkleik, maksEI, c450, c600, rw, rwC, cf450, cf600] = rest.slice(4)
    const dk = dekodKode(kode)
    const tillatte = plater.filter((_, i) => kryss[i] === '●')
    rader.push({
      id: familie + '-' + tabell + '-' + nr, familie, tabell, nr: +nr, ...dk,
      brann: eiMaks(ei, maksEI),          // [{ ei, maks (mm, med brannkrav), stjerne }]
      plateTjukkleik: plateTxt.replace('.', ','), tillattePlater: tillatte.length ? tillatte : [dk.hovudplate],
      veggTjukkleik: tal(veggTjukkleik),
      hogde: { dB: { c450: tal(c450), c600: tal(c600) }, CF: { c450: tal(cf450), c600: tal(cf600) } },   // mm, utan brannkrav
      rw: tal(rw), rwC: tal(rwC),
    })
  }
}

const ut = {
  henta: dato,
  kjelde: 'Norgips veggtabell (byggeteknikk.norgips.no)', kjelder,
  forklaring: { ...FORKLARING, platetypar: PLATETYPAR },
  merknad: [
    'Maks vegghøgde med brannkrav (EI) er sett opp under «EI klassifisert»; høgder utan brannkrav (c/c 450 og c/c 600) er oppgitt separat. Det kan vere nødvendig med c/c 450 for å nå maks vegghøgde.',
    'For sjakt- og doble vegger skal høgder med brannkrav over 4 m prosjekterast særskilt av RIB, med mindre anna er oppgitt.',
    'Vegger med forsterkingsstål (CF) kan runde verdiane for «EI klassifisert maks høgde» opp til næraste hele meter; ut over dette må RIB prosjektere.',
    'Brannmessig hulromsisolasjon skal vere fastholdt, og utførast med den typen og tettleiken mineralull som er oppgitt i veggtabellen. Ved høgder over 3500 mm skal mineralull sikrast mot å sige.',
    '* Vegghøgda sin avgrensing med EI-klassifisering er gitt i NS-EN 15254-3 (2019).',
  ],
  kontrollsum, rader,
}
fs.mkdirSync(path.dirname(UT), { recursive: true })
fs.writeFileSync(UT, JSON.stringify(ut, null, 1))
console.log('Skreiv', UT, '—', rader.length, 'rader,', Object.keys(kontrollsum).length, 'familiar, innlesingsdato', dato)
