// ═══════════════════════════════════════════════════════════════════
//  Teikningsnummer — delt struktur og lesing, Norconsult DS-356 (sjå
//  claude/dtm-modul.md). Brukt av KS-modulen, sjekklistene, Prosjekt-modulen
//  og Leveranseplan-vindauget.
//
//  Eit teikningsnummer er bygd av ledd i denne rekkjefølgja:
//
//     Fag - [Bygningsfagkode] - Type - [Bygg, sone/del] - Etasje - [Løpenr] - [Fase]
//     A   -  23               - 20   -  1A               - 01     -  01      -  3
//
//  Ledd i [klammer] er VALFRIE og vert valt PER PROSJEKT (details.nummerering),
//  sidan eit tal-ledd ikkje fortel kva det er — éin og same tekst, t.d.
//  «A-20-01-01», les ulikt alt etter oppsettet. Fag, type og etasje er alltid med.
//  «Fase» er eit tillegg ut over DS-356: éitt siffer 1/2/3 (skisse/forprosjekt/
//  detalj). Eldre teikningar har ofte to-sifra fasekodar 01–05 (KS-oppsettet før
//  DS-356) — dei vert framleis kjende att på sifferlengda.
// ═══════════════════════════════════════════════════════════════════

export const STANDARD_NUMMERERING = {
  medBygningsfagkode: false,
  medBygg: false,
  medLopenummer: true,
  medFase: true,
}

export const hentNummerering = (details) => ({ ...STANDARD_NUMMERERING, ...(details?.nummerering || {}) })

// DS-356 typekodar (45 er den gamle KS-koden for fasade, behalden for lesing av eldre nummer)
export const TYPEKODE = {
  '00': 'Sammensatt', '05': 'Eksisterande', '10': 'Situasjonsplan', '20': 'Plan', '30': 'Himlingsplan',
  '40': 'Snitt', '45': 'Fasade', '50': 'Detalj', '60': 'Skjema', '70': 'Systemskjema',
  '80': 'Heis', '90': 'Diverse', '95': 'Armering',
}

export const FASEKODE_NY = { '1': 'Skisseprosjekt', '2': 'Forprosjekt', '3': 'Detaljprosjekt' }
export const FASEKODE_ELDRE = { '01': 'Skisseprosjekt', '02': 'Forprosjekt', '03': 'Tilbodsteikning', '04': 'Søknadsteikning', '05': 'Detaljprosjekt' }
export const faseNamn = (kode) => (kode == null || kode === '' ? '' : (kode.length === 1 ? FASEKODE_NY[kode] : FASEKODE_ELDRE[kode]) || '')

// Les eit teikningsnummer ut frå prosjektet sitt oppsett. Gjev `null` viss det
// ikkje liknar eit teikningsnummer. Er nummeret kortare enn oppsettet seier,
// får ein det ein klarar å lese (t.d. berre fag + type).
export function tolkNummer(nr, cfg = STANDARD_NUMMERERING) {
  const d = String(nr || '').trim().split('-')
  if (d.length < 2 || !/^[A-Za-zÆØÅæøå]{1,4}$/.test(d[0])) return null
  const ut = { fag: d[0].toUpperCase() }
  if (d.length === 2) return ut // IFC-forma («A-01») — ingen type/etasje-ledd
  let i = 1
  if (cfg.medBygningsfagkode) ut.bygningsfagkode = d[i++]
  const type = d[i++]
  if (!/^\d{2}$/.test(type || '')) return ut
  ut.type = type
  if (cfg.medBygg) ut.bygg = d[i++]
  const etasje = d[i]
  if (etasje !== undefined && /^(\d{2}|U\d)$/i.test(etasje)) { ut.etasje = etasje.toUpperCase(); i++ }
  if (cfg.medLopenummer && d[i] !== undefined && /^\d{1,3}$/.test(d[i])) ut.lopenr = d[i++]
  if (cfg.medFase && d[i] !== undefined && /^\d{1,2}$/.test(d[i])) ut.fase = d[i++]
  return ut
}

// Til KS-registeret: «fag»-kolonna er i praksis typen (Plan/Snitt …), «fase» fasenamnet.
export function tolkTeikningsnr(nr, cfg) {
  const t = tolkNummer(nr, cfg)
  return { fag: (t?.type && TYPEKODE[t.type]) || 'Anna', fase: faseNamn(t?.fase) }
}

// Til sjekklistene (typear i tegningskontroll.json: situasjonsplan, plan, snitt,
// fasade, skjema, detaljar, ifc_og_dwg; stadium SK/FP/RS/AT).
const SJEKKLISTE_TYPE = { '10': 'situasjonsplan', '20': 'plan', '40': 'snitt', '45': 'fasade', '50': 'detaljar', '60': 'skjema' }
const SJEKKLISTE_STADIUM_NY = { '1': 'SK', '2': 'FP', '3': 'AT' }
const SJEKKLISTE_STADIUM_ELDRE = { '01': 'SK', '02': 'FP', '03': 'RS', '04': 'RS', '05': 'AT' }
export function tolkSjekklisteTypeFraNummer(nr, cfg, tittel = '') {
  const t = tolkNummer(nr, cfg)
  if (!t?.type) return { type: null, stadium: null }
  const type = SJEKKLISTE_TYPE[t.type] || null // 40 = snitt, 45 = fasade (kontoret skil på dei)
  const stadium = t.fase ? (t.fase.length === 1 ? SJEKKLISTE_STADIUM_NY : SJEKKLISTE_STADIUM_ELDRE)[t.fase] || null : null
  return { type, stadium }
}

// Døme-nummer for gjeldande oppsett, som delar (til å utheve aktive ledd i UI).
export function dømeDelar(cfg) {
  const d = [{ tekst: 'A', aktiv: true, namn: 'Fag' }]
  if (cfg.medBygningsfagkode) d.push({ tekst: '23', aktiv: true, namn: 'Bygningsfagkode' })
  d.push({ tekst: '20', aktiv: true, namn: 'Type' })
  if (cfg.medBygg) d.push({ tekst: '1A', aktiv: true, namn: 'Bygg, sone/del' })
  d.push({ tekst: '01', aktiv: true, namn: 'Etasje' })
  if (cfg.medLopenummer) d.push({ tekst: '01', aktiv: true, namn: 'Løpenummer' })
  if (cfg.medFase) d.push({ tekst: '3', aktiv: true, namn: 'Fase' })
  return d
}

// Lagrar oppsettet i prosjektet sine `details` (les-endre-skriv mot fersk rad, slik at ikkje
// andre felt i prosjektkortet vert overskrivne med ei gammal kopi).
export async function lagreNummerering(supabase, prosjektId, userId, nummerering) {
  const { data, error: lesFeil } = await supabase.from('projects').select('details')
    .eq('id', prosjektId).eq('user_id', userId).single()
  if (lesFeil) throw new Error(lesFeil.message)
  const { error } = await supabase.from('projects')
    .update({ details: { ...(data?.details || {}), nummerering }, updated_at: new Date().toISOString() })
    .eq('id', prosjektId).eq('user_id', userId)
  if (error) throw new Error(error.message)
}

// ── Renummerering av løpenummer ─────────────────────────────────────────
// Posisjonen til løpenummeret i nummeret (etter prosjektet sitt oppsett), eller
// null viss nummeret ikkje følgjer oppsettet / oppsettet ikkje har løpenummer.
export function lopenummerDelar(nr, cfg = STANDARD_NUMMERERING) {
  if (!cfg.medLopenummer) return null
  const t = tolkNummer(nr, cfg)
  if (!t || t.etasje === undefined || t.lopenr === undefined) return null
  const delar = String(nr).trim().split('-')
  const idx = 1 + (cfg.medBygningsfagkode ? 1 : 0) + 1 + (cfg.medBygg ? 1 : 0) + 1
  if (delar[idx] !== t.lopenr) return null
  return { delar, idx, lopenr: t.lopenr }
}

// Gjev nye løpenummer til `rader` ([{ id, nr }], i den REKKJEFØLGJA dei skal ha),
// per gruppe (same nummer elles: fag, type, bygg, etasje, fase) fortløpande frå 01.
// `annaNr` er nummer som er opptekne av andre rader — dei vert hoppa over, så ingen
// får dobbeltnummer. Rader der nummeret ikkje følgjer oppsettet vert ikkje rørte.
// Gjev { endringar:[{ id, gammal, ny }], hoppaOver:[rad] }.
export function nyeLopenummer(rader, annaNr, cfg = STANDARD_NUMMERERING) {
  const brukt = new Set([...annaNr].map(n => String(n).toUpperCase()))
  const grupper = new Map()
  const hoppaOver = []
  for (const r of rader) {
    const p = lopenummerDelar(r.nr, cfg)
    if (!p) { hoppaOver.push(r); brukt.add(String(r.nr).toUpperCase()); continue }
    const nokkel = p.delar.filter((_, i) => i !== p.idx).join('-')
    if (!grupper.has(nokkel)) grupper.set(nokkel, [])
    grupper.get(nokkel).push({ ...r, p })
  }
  const endringar = []
  for (const liste of grupper.values()) {
    let n = 1
    for (const r of liste) {
      const breidd = Math.max(2, r.p.lopenr.length)
      let ny
      do { const d = [...r.p.delar]; d[r.p.idx] = String(n).padStart(breidd, '0'); ny = d.join('-'); n++ } while (brukt.has(ny.toUpperCase()))
      brukt.add(ny.toUpperCase())
      if (ny !== r.nr) endringar.push({ id: r.id, gammal: r.nr, ny })
    }
  }
  return { endringar, hoppaOver }
}
