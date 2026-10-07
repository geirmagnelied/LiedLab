// ═══════════════════════════════════════════════════════════════════
//  Leveranseplan — generator for TEIKNINGSFORSLAG (DTM, sjå
//  claude/dtm-modul.md «Leveranseplan»). Reine funksjonar utan React:
//  brukar legg inn bygg (matrise) og appen lagar ei liste med teikningar som
//  forslag, som brukar justerer før dei vert oppretta som PLANLAGDE rader.
//
//  Berre DETALJPROSJEKT er bygd enno (brukar sitt val 7. okt. 2026).
//
//  Nummerering etter Norconsult DS-356 (8. okt. 2026):
//      Fag - Typetegning - [Bygg, sone/del] - Etasje - Løpenummer [- Fase]
//      t.d.  A-20-01-03   (arkitekt, plan, 1. etasje, løpenr 3)
//            A-20-1A-01-01-3   (med bygg «1A» og fasenummer 3 = detaljprosjekt)
//  • Typekodar: 10 utomhus (situasjonsplan) · 20 plan · 30 himlingsplan ·
//    40 snitt · 45 fasade (DS-356 har begge som 40; kontoret skil dei) · 50 detalj · 60 skjema.
//  • Etasje: 01, 02 … · U1 = kjeller/1. underetasje · U2 = 2. underetasje ·
//    00 = gjennomgåande/ingen etasje.
//  • Bygg, bygningsfagkode, løpenummer og fase er valfrie ledd — styrt av prosjektet sitt
//    nummereringsoppsett (details.nummerering, sjå teikningsnummer.js).
//  • FASENUMMER SIST er eit tillegg ut over DS-356 (brukar sitt ønske):
//    1 = skisseprosjekt, 2 = forprosjekt, 3 = detaljprosjekt.
//  • Løpenummer er unike per (fag, type, bygg, etasje); utan byggnummer
//    held dei fram på tvers av bygga.
//  • IFC-modellar følgjer DTM sin eksisterande IFC-regel: <fag>-<tosifra nr>.
// ═══════════════════════════════════════════════════════════════════

export const PROSJEKTTYPAR = [
  { key: 'skisse',      namn: 'Skisseprosjekt', fasekode: '1', klar: false },
  { key: 'forprosjekt', namn: 'Forprosjekt',    fasekode: '2', klar: false },
  { key: 'detalj',      namn: 'Detaljprosjekt', fasekode: '3', klar: true },
]

export const TEIKNINGSTYPAR = {
  situasjonsplan: { namn: 'Situasjonsplan', kode: '10' },
  plan:           { namn: 'Plan',           kode: '20' },
  takplan:        { namn: 'Takplan',        kode: '20' },
  himlingsplan:   { namn: 'Himlingsplan',   kode: '30' },
  snitt:          { namn: 'Snitt',          kode: '40' },
  fasade:         { namn: 'Fasade',         kode: '45' }, // kontoret skil fasade (45) frå snitt (40)
  detalj:         { namn: 'Detalj',         kode: '50' },
  dorliste:       { namn: 'Dørliste',       kode: '60' },
  dorskjema:      { namn: 'Dørskjema',      kode: '60' },
  vatromsskjema:  { namn: 'Våtromsskjema',  kode: '60' },
  trappeskjema:   { namn: 'Trappeskjema',   kode: '60' },
  glasfasadeskjema: { namn: 'Glasfasade',   kode: '60' },
  ifc:            { namn: 'IFC-modell',     kode: '' },
  anna:           { namn: 'Anna',           kode: '' },
}
export const TYPE_NAMN_LISTE = Object.values(TEIKNINGSTYPAR).map(t => t.namn)
export const typeKeyFraNamn = (namn) => Object.keys(TEIKNINGSTYPAR).find(k => TEIKNINGSTYPAR[k].namn === namn) || 'anna'

// Målestokkar (nøkkel = målestokk-felt i vindauget). Planar, takplan, himlings-
// planar, snitt og fasadar 1:50 · situasjonsplan 1:200 · detaljar 1:5 ·
// skjemateikningar 1:20 (dørskjema, våtromsskjema, glasfasade) · trappeskjema 1:20.
// Dørlista er ei liste, ikkje ei teikning — ingen målestokk.
export const STANDARD_MALESTOKK = {
  situasjonsplan: '1:200', plan: '1:50', takplan: '1:50', himlingsplan: '1:50',
  snitt: '1:50', fasade: '1:50', detalj: '1:5', skjema: '1:20', trappeskjema: '1:20',
}
const MALESTOKK_NOKKEL = { dorskjema: 'skjema', vatromsskjema: 'skjema', glasfasadeskjema: 'skjema', dorliste: null, ifc: null, anna: null }

// Typiske detaljteikningar per bygg (brukar sin liste). NB: summen er 23, ikkje
// «20» som brukar skreiv — lista er redigerbar i vindauget. `krev` = berre
// med viss bygget har dette (våtrom / glasfasade).
export const STANDARD_DETALJAR = [
  { namn: 'Dørinnsetting',            tal: 2 },
  { namn: 'Vindu',                    tal: 1 },
  { namn: 'Sokkel',                   tal: 2 },
  { namn: 'Dekkeforkant',             tal: 3 },
  { namn: 'Gesims',                   tal: 3 },
  { namn: 'Glasfasade',               tal: 1, krev: 'glasfasade' },
  { namn: 'Tak',                      tal: 3 },
  { namn: 'Våtrom',                   tal: 2, krev: 'vatrom' },
  { namn: 'Tekniske gjennomføringar', tal: 2 },
  { namn: 'Balkong',                  tal: 2 },
  { namn: 'Takterrasse',              tal: 2 },
]

let teljar = 0
export const nyByggId = () => `b${Date.now().toString(36)}${(teljar++).toString(36)}`

export function nyttBygg(namn = '') {
  return { id: nyByggId(), namn, nummer: '', fasadar: 4, etasjar: 2, kjeller: false, underetasje: false,
    vatrom: 0, trapperom: 2, glasfasade: false, ifc: false }
}

// Etasjar i bygget, nedanfrå: kjeller (U1), underetasje (U1 om kjeller ikkje er
// med, elles U2), 1. etasje (01) …
export function etasjar(b) {
  const ut = []
  let u = 0
  if (b.kjeller) ut.push({ namn: 'kjeller', kode: `U${++u}` })
  if (b.underetasje) ut.push({ namn: 'underetasje', kode: `U${++u}` })
  for (let i = 1; i <= Math.max(0, +b.etasjar || 0); i++) ut.push({ namn: `${i}. etasje`, kode: String(i).padStart(2, '0') })
  return ut
}

// Dei fire fyrste fasadane får himmelretning (Nord, Øst, Sør, Vest), eventuelle fleire vert nummererte (Fasade 5 …).
const FASADE_RETNING = ['Nord', 'Øst', 'Sør', 'Vest']
const fasadeNamn = (i) => (i < FASADE_RETNING.length ? `Fasade ${FASADE_RETNING[i]}` : `Fasade ${i + 1}`)

// Lagar rå forslagsrader (UTAN nummer) frå innlagt info.
//   inn = { bygg:[…], situasjonsplan:bool, malestokk:{…}, detaljar:[…], byggnamnPlass:'ingen'|'for'|'etter' }
export function genererRader(inn) {
  const m = { ...STANDARD_MALESTOKK, ...(inn.malestokk || {}) }
  const detaljar = inn.detaljar || STANDARD_DETALJAR
  const plass = inn.byggnamnPlass || 'ingen'
  const ut = []
  const malFor = (type) => {
    const nk = type in MALESTOKK_NOKKEL ? MALESTOKK_NOKKEL[type] : type
    return nk ? (m[nk] || '') : ''
  }
  const tittelMed = (b, t) => {
    if (!b?.namn || plass === 'ingen') return t
    return plass === 'for' ? `${b.namn} – ${t}` : `${t} – ${b.namn}`
  }
  const leggTil = (b, type, tittel, etasje = '00') => ut.push({
    bygg: b?.namn || '', byggId: b?.id || null, byggNr: (b?.nummer || '').trim(), etasje, type, nr: '',
    tittel: tittelMed(b, tittel), malestokk: malFor(type),
  })

  if (inn.situasjonsplan !== false) leggTil(null, 'situasjonsplan', 'Situasjonsplan')

  for (const b of inn.bygg || []) {
    const et = etasjar(b)
    for (const e of et) leggTil(b, 'plan', `Plan ${e.namn}`, e.kode)
    for (const e of et) leggTil(b, 'himlingsplan', `Himlingsplan ${e.namn}`, e.kode)
    leggTil(b, 'takplan', 'Takplan')
    leggTil(b, 'snitt', 'Snitt A-A')
    leggTil(b, 'snitt', 'Snitt B-B')
    const fas = Math.max(0, +b.fasadar || 0)
    for (let i = 0; i < fas; i++) leggTil(b, 'fasade', fasadeNamn(i))
    leggTil(b, 'dorliste', 'Dørliste')
    leggTil(b, 'dorskjema', 'Dørskjema')
    const vatrom = Math.max(0, +b.vatrom || 0)
    for (let i = 1; i <= vatrom; i++) leggTil(b, 'vatromsskjema', `Våtromsskjema${vatrom > 1 ? ' ' + i : ''}`)
    const trapper = Math.max(0, +b.trapperom || 0)
    for (let i = 1; i <= trapper; i++) leggTil(b, 'trappeskjema', `Trappeskjema${trapper > 1 ? ' ' + i : ''}`)
    if (b.glasfasade) leggTil(b, 'glasfasadeskjema', 'Glasfasade')
    for (const d of detaljar) {
      if (d.krev === 'vatrom' && !(+b.vatrom > 0)) continue
      if (d.krev === 'glasfasade' && !b.glasfasade) continue
      for (let i = 1; i <= Math.max(0, +d.tal || 0); i++) {
        leggTil(b, 'detalj', `Detalj ${d.namn.charAt(0).toLowerCase() + d.namn.slice(1)}${d.tal > 1 ? ' ' + i : ''}`)
      }
    }
    if (b.ifc) leggTil(b, 'ifc', 'IFC-modell')
  }
  return ut
}

// Bygningsfagkode (DS-356 vedlegg 1, ARKITEKTUR) per teikningstype — berre brukt når
// prosjektet har «med bygningsfagkode» på. Forslag; rettast i tabellen.
const BYGNINGSFAGKODE = {
  situasjonsplan: '70', plan: '20', takplan: '26', himlingsplan: '25', snitt: '20', fasade: '20', detalj: '20',
  dorliste: '20', dorskjema: '20', vatromsskjema: '20', trappeskjema: '28', glasfasadeskjema: '20',
}

// DS-356-nummer etter prosjektet sitt oppsett (teikningsnummer.js): ledda
// bygningsfagkode, bygg, løpenummer og fase er valfrie, resten er alltid med.
// Løpenummeret er unikt per (fag, type, bygg, etasje); nummer som alt finst i
// registeret vert hoppa over. UTAN løpenummer kan to teikningar få same nummer
// (t.d. fleire fasadar) — tabellen i vindauget merkjer det som «Dobbelt nummer».
export function tildelNummer(rader, { fag = 'A', fasekode = '3', nummerering = {}, eksisterandeNr = [] } = {}) {
  const { medBygg = false, medBygningsfagkode = false, medLopenummer = true, medFase = true } = nummerering
  const brukt = new Set(eksisterandeNr.map(n => String(n).toUpperCase()))
  const neste = {}
  return rader.map(r => {
    if (r.type === 'ifc') {
      let n = neste.ifc || 1
      let nr
      do { nr = `${fag}-${String(n).padStart(2, '0')}`; n++ } while (brukt.has(nr.toUpperCase()))
      neste.ifc = n; brukt.add(nr.toUpperCase())
      return { ...r, nr }
    }
    const kode = TEIKNINGSTYPAR[r.type]?.kode
    if (!kode) return { ...r, nr: '' }
    const bygg = medBygg ? r.byggNr : ''
    const bfk = medBygningsfagkode ? (BYGNINGSFAGKODE[r.type] || '20') : ''
    const gruppe = [fag, bfk, kode, bygg, r.etasje].join('|')
    const lag = (n) => [fag, bfk, kode, bygg, r.etasje || '00', medLopenummer ? String(n).padStart(2, '0') : '',
      medFase ? fasekode : ''].filter(Boolean).join('-')
    let n = neste[gruppe] || 1
    let nr = lag(n)
    if (medLopenummer) {
      while (brukt.has(nr.toUpperCase())) nr = lag(++n)
      neste[gruppe] = n + 1
    }
    brukt.add(nr.toUpperCase())
    return { ...r, nr }
  })
}

export function genererForslag(inn, { fag = 'A', prosjekttype = 'detalj', nummerering = {}, eksisterandeNr = [] } = {}) {
  const pt = PROSJEKTTYPAR.find(p => p.key === prosjekttype)
  if (!pt?.klar) return []
  const rader = tildelNummer(genererRader(inn), { fag, fasekode: pt.fasekode, nummerering, eksisterandeNr })
  return rader.map((r, i) => ({ ...r, id: `r${i}_${Math.random().toString(36).slice(2, 7)}` }))
}

export const FAG_NAMN = { A: 'Arkitekt', ARK: 'Arkitekt', K: 'Konstruksjon', L: 'Landskap' }
