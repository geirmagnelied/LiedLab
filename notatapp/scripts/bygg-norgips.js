// Bygg src/data/norgipsVeggtabell.json frå råfilene i scripts/norgips-raw/*.txt
// (uttrekk frå Norgips sine veggtabell-sider, sjå claude/verktoy-modul.md for prosedyren).
// Køyr frå notatapp/:  node scripts/bygg-norgips.js [yyyy-mm-dd]   (dato = innlesingsdato; standard = i dag)
//
// Råformat: fyrste linje «## kjelde=<url> familie=<namn> [format=stal|tre|treub|nailit]», så ei «## <tabell-id> plater=A,B[ rwmodus=cc]»-linje per tabell,
// så rader med «|» mellom cellene. Format:
//   stal   (W111/W112/W115/W628B): nr|kode|EI|4 plate-kryss|platetjukkleik|veggtjukkleik|maks høgde EI|c/c450|c/c600|R'w|R'w+C|CF c/c450|CF c/c600
//   tre    (Trestender):  nr|kode|EI (IB)|B1|B2|4 plate-kryss|platetjukkleik|veggtjukkleik|høgde B1/B2|høgde IB|R'w|R'w+C
//   treub  (Trestender m/Ultra Board): nr|kode|EI|1 kryss|platetjukkleik|veggtjukkleik|c/c450|c/c600|R'w(a)|R'w(b)   (rwmodus=cc: a/b = c/c 450/600)
//   nailit (Nail It Indoor/Safety): nr|kode|EI|kryss per plate|veggtjukkleik|maks høgde EI|høgde utan EI|R'w|R'w+C
const fs = require('fs'), path = require('path'), crypto = require('crypto')

const RAA = path.join(__dirname, 'norgips-raw')
const UT = path.join(__dirname, '..', 'src', 'data', 'norgipsVeggtabell.json')
const dato = process.argv[2] || new Date().toISOString().slice(0, 10)

const PLATETYPAR = {
  STD: 'Standard 12,5 mm (type A)', HRD: 'Hard 12,5 mm (type IR)', HB: 'Humidboard 12,5 mm (type GM-H2)', LB: 'Light Board 12,5 mm (type A)',
  BRN: 'Brann 15 mm (type DF)', UB13: 'Ultra Board 13, 12,5 mm (type DFIR)', UB15: 'Ultra Board 15, 15,5 mm (type DFIR)',
  SIB: 'Silentboard 12,5 mm (type DF)', SAB: 'Safeboard 12,5 mm (type DF)', AQ: 'Aquapanel 12,5 mm',
}
const FORKLARING = {
  veggloysing: { SE: 'Stål enkeltvegg', SD: 'Stål dobbelvegg', TE: 'Tre enkeltvegg', TD: 'Tre dobbeltvegg' },
  stalprofil: { 'C dB+': 'Vår vanlige stender', CF: 'Vår forsterkingsprofil', 'C N': 'Nail It-stender', 'CF N': 'Nail It Safety-stender' },
  platelag: { '1/1': 'Ett lag gips på hver side av veggen', '0/2': 'To lag gips på ene siden av sjaktvegg' },
  isolasjon: { M: 'Mineralull densitet 13 kg/m3', S: 'Steinull type A1, densitet min. 30 kg/m3 og smeltepunkt 1000°' },
}
const FAMILIE_NAMN = {
  W111: 'W111 – ett lag gips', W112: 'W112 – to lag gips', W115: 'W115 – doble vegger', W628B: 'W628 B – sjaktvegger',
  Trestender: 'Trestender', TrestenderUB: 'Trestender med Ultra Board', NailItIndoor: 'Nail It Indoor', NailItSafety: 'Nail It Safety',
}
const MATERIALE = { W111: 'stal', W112: 'stal', W115: 'stal', W628B: 'stal', Trestender: 'tre', TrestenderUB: 'tre', NailItIndoor: 'nailit', NailItSafety: 'nailit' }

const tal = (s) => { const t = String(s ?? '').replace(/\s/g, '').replace(',', '.').replace(/\*/g, ''); const n = parseFloat(t); return Number.isFinite(n) ? n : null }

// «60 (30)» + «5000* (6000)*» → [{ ei:60, maks:5000, stjerne:true }, { ei:30, maks:6000, stjerne:true }]
function eiMaks(eiTxt, maksTxt) {
  const ei = String(eiTxt).match(/\d+/g)?.map(Number) || []
  const mk = String(maksTxt).match(/(\d+)(\*?)/g) || []
  const ut = []
  ei.forEach((e, i) => { const m = mk[i] ?? mk[mk.length - 1]; if (!m) return; ut.push({ ei: e, maks: parseInt(m, 10), stjerne: m.includes('*') }) })
  return ut
}

// Dekodar veggkoden (stål, tre og Nail It) til delane vi treng
function dekodKode(kode0) {
  const kode = kode0.replace(/\s+/g, ' ').trim().replace(/(\d)dB\+/, '$1 dB+')   // «C95dB+» → «C95 dB+»
  const tk = kode.split(' ')
  const loysing = tk[0]
  // lag-token: første token med «/» som ikkje er eit rein tal/tal-par ≥ 10 (t.d. «95/95» i ein Nail It-kode er skrivefeil for c/c)
  const lagIdx = tk.findIndex((t, i) => i > 0 && /\//.test(t) && !/^\d{2,}\/\d{2,}$/.test(t))
  if (lagIdx < 0) return { kode, loysing }
  const lag = tk[lagIdx].replace(/\s/g, '')
  const isolasjon = tk.slice(lagIdx + 1).join(' ')
  const stenderTxt = tk[1] || ''
  const bredde = +(stenderTxt.match(/(\d+)/)?.[1] || 0)
  const nailIt = tk.includes('N')
  const profilKode = loysing === 'TE' || loysing === 'TD' ? 'Tre' : nailIt ? (/^CF/.test(stenderTxt) ? 'CF N' : 'C N') : (/^CF/.test(stenderTxt) ? 'CF' : 'C dB+')
  const sjakt = /^0\//.test(lag)
  const pl = (lag.match(/(BRN|UB13|UB15|LB|SIB|SAB|AQ)/) || [])[1] || 'STD'
  const tel = (s) => { const le = s.match(/^(\d+)\+/), tr = s.match(/\+(\d+)$/); if (le || tr) return (le ? +le[1] : 0) + (tr ? +tr[1] : 0) + 1; const t = s.match(/^(\d+)x/) || s.match(/x(\d+)$/); const p = s.match(/\+/g); return (t ? parseInt(t[1], 10) : 1) + (p ? p.length : 0) + (/^\d+$/.test(s) ? parseInt(s, 10) - 1 : 0) }
  const lagPerSide = Math.max(...lag.split('/').map(tel))
  const iso = isolasjon.match(/([MS])/)
  return { kode, loysing, stenderBredde: bredde, profilKode, lagKode: lag, sjakt, hovudplate: pl, lagPerSide, isolasjon, isolasjonMateriale: iso ? iso[1] : null }
}

const kryssPlater = (kryss, plater) => plater.filter((_, i) => /[●•]/.test(kryss[i] || ''))

const FORMAT = {
  stal(c, plater) {
    if (c.length < 16) return null
    const [nr, kode, ei, ...rest] = c
    const kryss = rest.slice(0, 4), [plateTxt, veggTjukkleik, maksEI, c450, c600, rw, rwC, cf450, cf600] = rest.slice(4)
    return { nr, kode, brann: eiMaks(ei, maksEI), tillatte: kryssPlater(kryss, plater), plateTxt, veggTjukkleik,
      hogde: { dB: { c450: tal(c450), c600: tal(c600) }, CF: { c450: tal(cf450), c600: tal(cf600) } }, rw: tal(rw), rwC: tal(rwC) }
  },
  tre(c, plater) {
    if (c.length < 15) return null
    const [nr, kode, ei, b1, b2, ...rest] = c
    const kryss = rest.slice(0, 4), [plateTxt, veggTjukkleik, hB, hIB, rw, rwC] = rest.slice(4)
    const h = tal(hIB)
    return { nr, kode, brann: eiMaks(ei, hIB), tillatte: kryssPlater(kryss, plater), plateTxt, veggTjukkleik,
      hogde: { Tre: { c450: h, c600: h } }, rw: tal(rw), rwC: tal(rwC),
      baerende: { b1: tal(b1), b2: tal(b2), hogde: tal(hB) } }
  },
  treub(c, plater, opt) {
    if (c.length < 10) return null
    const [nr, kode, ei, kryss, plateTxt, veggTjukkleik, c450, c600, a, b] = c
    const mx = Math.max(tal(c450) || 0, tal(c600) || 0)
    const ut = { nr, kode, brann: eiMaks(ei, String(mx || '')), tillatte: kryssPlater([kryss], plater), plateTxt, veggTjukkleik, hogde: { Tre: { c450: tal(c450), c600: tal(c600) } } }
    if (opt.rwmodus === 'cc') { ut.rw = Math.min(tal(a), tal(b)); ut.rwC = null; ut.rwMerknad = "R'w oppgitt for c/c 450 og c/c 600 (" + a + '/' + b + "); lågaste verdi er brukt, R'w+C er ikkje oppgitt." }
    else { ut.rw = tal(a); ut.rwC = tal(b) }
    return ut
  },
  nailit(c, plater) {
    const n = plater.length
    if (c.length < 8 + n - 1) return null
    const [nr, kode, ei, ...rest] = c
    const kryss = rest.slice(0, n), [veggTjukkleik, maksEI, utan, rw, rwC] = rest.slice(n)
    const profil = /CF/.test(kode) ? 'CFN' : 'N'
    return { nr, kode, brann: eiMaks(ei, maksEI), tillatte: kryssPlater(kryss, plater), plateTxt: '', veggTjukkleik,
      hogde: { [profil]: { c450: null, c600: tal(utan) } }, rw: tal(rw), rwC: tal(rwC) }
  },
}

const rader = [], kontrollsum = {}, kjelder = []
for (const f of fs.readdirSync(RAA).filter(x => x.endsWith('.txt')).sort()) {
  const txt = fs.readFileSync(path.join(RAA, f), 'utf8').replace(/\r\n/g, '\n')
  kontrollsum[f.replace('.txt', '')] = crypto.createHash('sha256').update(txt.trim()).digest('hex').slice(0, 16)
  let familie = '', format = 'stal', plater = [], tabell = '', opt = {}
  for (const l of txt.split('\n')) {
    if (!l.trim()) continue
    if (l.startsWith('## kjelde=')) {
      const kjelde = l.match(/kjelde=(\S+)/)[1]; familie = l.match(/familie=(\S+)/)[1]; format = (l.match(/format=(\S+)/) || [])[1] || 'stal'
      kjelder.push({ familie, namn: FAMILIE_NAMN[familie] || familie, url: kjelde }); continue
    }
    if (l.startsWith('## ')) { tabell = l.match(/## (\S+)/)[1]; plater = (l.match(/plater=(\S+)/) || [, ''])[1].split(',').filter(Boolean); opt = { rwmodus: (l.match(/rwmodus=(\S+)/) || [])[1] }; continue }
    const r = FORMAT[format](l.split('|'), plater, opt)
    if (!r) { console.error('Hoppar over rad med feil kolonnetal i', f, ':', l.slice(0, 60)); continue }
    const dk = dekodKode(r.kode)
    rader.push({
      id: familie + '-' + tabell + '-' + r.nr, familie, materiale: MATERIALE[familie] || 'stal', tabell, nr: +r.nr, ...dk,
      brann: r.brann,                      // [{ ei, maks (mm, med brannkrav), stjerne }]
      plateTjukkleik: String(r.plateTxt || '').replace('.', ','), tillattePlater: r.tillatte.length ? r.tillatte : [dk.hovudplate],
      veggTjukkleik: tal(r.veggTjukkleik),
      hogde: r.hogde,                      // per profil (dB, CF, Tre, N, CFN): { c450, c600 } i mm, utan brannkrav
      rw: r.rw, rwC: r.rwC, ...(r.rwMerknad ? { rwMerknad: r.rwMerknad } : {}), ...(r.baerende ? { baerende: r.baerende } : {}),
    })
  }
}

const ut = {
  henta: dato,
  kjelde: 'Norgips veggtabell (byggeteknikk.norgips.no)', kjelder, familiar: FAMILIE_NAMN,
  forklaring: { ...FORKLARING, platetypar: PLATETYPAR },
  merknad: [
    'Maks vegghøgde med brannkrav (EI) er sett opp under «EI klassifisert»; høgder utan brannkrav (c/c 450 og c/c 600) er oppgitt separat. Det kan vere nødvendig med c/c 450 for å nå maks vegghøgde.',
    'For sjakt- og doble vegger skal høgder med brannkrav over 4 m prosjekterast særskilt av RIB, med mindre anna er oppgitt.',
    'Vegger med forsterkingsstål (CF) kan runde verdiane for «EI klassifisert maks høgde» opp til næraste hele meter; ut over dette må RIB prosjektere.',
    'Brannmessig hulromsisolasjon skal vere fastholdt, og utførast med den typen og tettleiken mineralull som er oppgitt i veggtabellen. Ved høgder over 3500 mm skal mineralull sikrast mot å sige.',
    '* Vegghøgda sin avgrensing med EI-klassifisering er gitt i NS-EN 15254-3 (2019).',
    'Trestender: høgdene er anbefalte for ikkje-bærande vegger. Trestendere skal ha ei anleggsflate på 48 mm til bærande og brannskiljande konstruksjonar (36 mm kan brukast utan bæringskrav og med brannklasse inntil EI 30).',
    'Nail It Safety tilfredsstiller sikkerheitsklasse 3 (RC4).',
  ],
  kontrollsum, rader,
}
fs.mkdirSync(path.dirname(UT), { recursive: true })
fs.writeFileSync(UT, JSON.stringify(ut, null, 1))
const per = {}; rader.forEach(r => { per[r.familie] = (per[r.familie] || 0) + 1 })
console.log('Skreiv', UT, '—', rader.length, 'rader', JSON.stringify(per), ', innlesingsdato', dato)
