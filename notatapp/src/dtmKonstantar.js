// ── Felles konstantar/hjelparar for DTM-modulen ──────────────────────
// Sjå claude/dtm-modul.md for full spesifikasjon. Delt mellom
// DTMModule/DTMTabell/DTMImportModal for å unngå sirkulær import og
// halde status-/nummer-logikken på éin stad.

export const KATEGORIAR = ['arbeidsdokument', 'resultatdokument', 'kontrolldokument', 'styrande_dokument', 'eksternt_dokument']

export const KATEGORI_LABEL = {
  arbeidsdokument:   'Arbeidsdokument',
  resultatdokument:  'Resultatdokument',
  kontrolldokument:  'Dokumentkontroll',
  styrande_dokument: 'Styrande dokument',
  eksternt_dokument: 'Eksternt dokument',
}

// Knappefargane brukar bad om, sjå claude/dtm-modul.md.
export const KATEGORI_FARGE = {
  arbeidsdokument:   '#2563EB', // blå
  resultatdokument:  '#111111', // svart
  kontrolldokument:  '#EA580C', // oransje
  styrande_dokument: '#7C3AED', // lilla
  eksternt_dokument: '#0D9488', // teal
}

// «Eksternt dokument» ligg IKKJE i sitt eige tal-merkte oppdragsmappe-ledd
// som dei fire andre — brukar sitt eige val 29. sept. 2026: dokument me
// MOTTEK skal liggje i den alt eksisterande «2 Informasjonsflyt»-mappa,
// i ei ny «Inn»-undermappe (og ei tilsvarande, framleis ikkje DTM-styrt
// «Ut»-mappe for utsendt korrespondanse — sjå OPPDRAGSMAPPER i main.js).
export const KATEGORI_MAPPE = {
  arbeidsdokument:   '3 Arbeidsdokument',
  resultatdokument:  '4 Resultatdokument',
  kontrolldokument:  '5 Kontrolldokument',
  styrande_dokument: '6 Styrande dokument',
  eksternt_dokument: '2 Informasjonsflyt\\Inn',
}

// Dei fire faste vala for «Kategori eksternt dokument»-kolonna (DTMTabell.jsx).
export const EKSTERN_DOK_KATEGORIAR = ['Vedtak', 'Leverandørdokument', 'Tilbodsunderlag', 'Prosjekteringsunderlag']

// Kanalar ei utsending kan gå via — fleirval, sjå DTMUtsendingModal.jsx.
export const UTSENDING_KANALAR = [
  { key:'epost', namn:'E-post' },
  { key:'webhotell', namn:'Webhotell' },
  { key:'anna', namn:'Anna' },
]

// Unikt, klientutrekna løpenummer per prosjekt for utsendingar — same
// mønster som nextNoteNumber()/nextCaseNumber() elles i appen (høgste
// eksisterande + 1, ikkje ein Postgres-sekvens). Vert lima inn i sjølve
// e-posten (sjå DTMModule.jsx) slik at ein seinare — t.d. ved å lese ein
// motteken kvittering — kan slå opp att kva utsending han høyrer til.
export function nesteUtsendingsnummer(alleUtsendingar) {
  const nrs = alleUtsendingar.map(u => u.utsendingsnr).filter(n => typeof n === 'number' && !isNaN(n))
  return (nrs.length ? Math.max(...nrs) : 0) + 1
}
export function utsendingsnrTekst(n) {
  return n ? `U-${String(n).padStart(3, '0')}` : ''
}

// Predefinerte statusar for kor langt prosjektet/dokumentet er kome —
// fritt redigerbart per dokument, sjå «Status ved ferdigstilling»-kolonna.
export const FERDIGSTILLING_STATUS = [
  'Moglegheitsstudie', 'Skisseprosjekt', 'Forprosjekt', 'Tilbodsunderlag', 'Arbeidsteikning', 'Som bygd',
]

// Kategoriar som tek del i status-samanlikninga (dato mot dato). Styrande
// dokument har sitt eige, uavhengige nummerserie og tek ALDRI del.
const STATUS_KATEGORIAR = ['arbeidsdokument', 'resultatdokument', 'kontrolldokument']
const STATUS_NAMN = {
  arbeidsdokument:  'Nytt arbeidsdokument',
  resultatdokument: 'Nytt resultatdokument',
  kontrolldokument: 'Ny kontrollkopi',
}

// Tolkar både eit ISO-tidsstempel (lasta_opp) og ein norsk dato-streng
// skanna frå eit PDF-tittelfelt (DD.MM.YYYY, DD-MM-YY osv.) til ein Date
// som kan samanliknast. Returnerer null når ingen av delane let seg tolke.
export function tolkDato(verdi) {
  if (!verdi) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(verdi)) {
    const d = new Date(verdi)
    return isNaN(d) ? null : d
  }
  const m = String(verdi).match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$/)
  if (m) {
    let [, dag, manad, år] = m
    if (år.length === 2) år = (Number(år) > 50 ? '19' : '20') + år
    const d = new Date(Number(år), Number(manad) - 1, Number(dag))
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

// I «Alle dokumenter»-settet (sjå DTMModule.jsx) har ei rad ikkje éin fast
// kategori — han kan vere aktiv som fleire samstundes. Vel då kategorien
// med NYAST opplasting som «den gjeldande» å vise filnamn/rev/dato/status
// frå i den rada, og som verdi i den nye Kategori-kolonna.
export function finnGjeldandeKategori(dok) {
  let best = null, bestTid = -1
  for (const k of KATEGORIAR) {
    const g = dok[k]
    if (!g) continue
    const t = g.lasta_opp ? new Date(g.lasta_opp).getTime() : 0
    if (t > bestTid) { bestTid = t; best = k }
  }
  return best
}
export function løysAktivtSett(dok, aktivtSett) {
  return aktivtSett === 'alle' ? finnGjeldandeKategori(dok) : aktivtSett
}

// Statusen for éi rad, sett med det aktive settet (kategorien) ho vert
// vist under. Samanliknar datoen til DENNE kategorien mot dei andre
// kategoriane sine datoar (dato frå PDF-tittelfeltet, fell tilbake til
// opplastingstidspunktet) for same dokumentnummer, og returnerer alle
// taggar for kategoriar som er NYARE — «Siste versjon» om ingen er det.
// Sjå claude/dtm-modul.md, avsnittet «status-kolonna».
export function reknStatus(dok, aktivtSett) {
  // Kategoriar UTANFOR STATUS_KATEGORIAR (styrande dokument frå før, no òg
  // eksterne dokument) har ikkje noko meiningsfylt «er denne nyare enn ein
  // annan kategori sin versjon»-samanlikning — dei er ikkje revisjonar av
  // interne dokument i det heile.
  if (!STATUS_KATEGORIAR.includes(aktivtSett)) return []
  const gjeldande = dok[aktivtSett]
  const eigenDato = gjeldande && tolkDato(gjeldande.dato || gjeldande.lasta_opp)
  if (!eigenDato) return []

  const taggar = []
  for (const k of STATUS_KATEGORIAR) {
    if (k === aktivtSett) continue
    const andre = dok[k]
    const andreDato = andre && tolkDato(andre.dato || andre.lasta_opp)
    if (andreDato && andreDato.getTime() > eigenDato.getTime()) taggar.push(STATUS_NAMN[k])
  }
  return taggar.length ? taggar : ['Siste versjon']
}

// ── Løpenummer-fallback ───────────────────────────────────────────────
// Brukt når appen ikkje klarer å tolke ut eit ekte dokumentnummer
// (Fag-D-<løpenr>), og for styrande dokument (SD-<løpenr>, alltid — aldri
// henta frå fil/innhald). `alleNr` skal vere nr-lista til BÅDE dei
// eksisterande dokumenta OG dei som alt er tildelt tidlegare i same
// importrunde, slik at fleire filer utan nummer i éin og same drop ikkje
// får det same løpenummeret.
function nesteLøpenummer(alleNr, prefix) {
  const nrs = alleNr
    .filter(nr => nr && nr.toUpperCase().startsWith(prefix))
    .map(nr => parseInt(nr.slice(prefix.length), 10))
    .filter(n => !isNaN(n))
  return (nrs.length ? Math.max(...nrs) : 0) + 1
}

export function genererDNummer(alleNr, fag) {
  const prefix = `${(fag || 'X').toUpperCase()}-D-`
  const neste = nesteLøpenummer(alleNr, prefix)
  return `${prefix}${String(neste).padStart(2, '0')}`
}

export function genererSDNummer(alleNr) {
  const neste = nesteLøpenummer(alleNr, 'SD-')
  return `SD-${String(neste).padStart(3, '0')}`
}

// EDOK-<tresifra løpenummer> — ALLTID klientutrekna for eksterne dokument,
// aldri gjetta frå det innkomande filnamnet (som fylgjer kven som helst
// sin eigen, ukontrollerte konvensjon) — brukar sitt eige krav 29. sept.
// 2026. Filnamnet på disk vert bygd av dette + eit beskrivande namn, sjå
// dtm:bekreft-import i electron/main.js.
export function genererEDOKNummer(alleNr) {
  const neste = nesteLøpenummer(alleNr, 'EDOK-')
  return `EDOK-${String(neste).padStart(3, '0')}`
}

// BIL-<tresifra løpenummer>, LØPANDE PER PROSJEKT (Bilete-modulen, sjå
// claude/bilete-modul.md) — `alleNr` skal difor berre vere nr-lista til
// bileta i SAME prosjekt, ikkje på tvers av prosjekt.
export function genererBilNummer(alleNr) {
  const neste = nesteLøpenummer(alleNr, 'BIL-')
  return `BIL-${String(neste).padStart(3, '0')}`
}

// Same mappenamn som BILETE_MAPPE i electron/main.js (dupliserte konstantar,
// same mønster som DTM_KATEGORI_MAPPE) — brukt av BileteModule.jsx til å
// byggje file://-stiar for rutenett-førehandsvisinga.
export const BILETE_MAPPE = '8 Bilete'

// ── Dokumentleveranseplan (1. okt. 2026) ────────────────────────────
// Dei fire faste utsendingsfasane for eit dokument — typisk vert same
// teikning sendt ut fleire gonger i løpet av eit prosjekt (éin gong per
// fase her), brukar sitt eige krav. Delt mellom DTMTabell.jsx (dei åtte
// planlagt_/sendt_-kolonnane i sjølve matrisa, der datoane faktisk vert
// skrivne inn og haka av) og DokumentleveranseplanModal.jsx (PDF-eksporten
// som viser same fasane som eigne, ferdig formaterte kolonnar bakerst i
// tabellen, attåt dei same kolonnane som Tegningsliste).
export const LEVERANSE_FASAR_BASIS = [
  { key: 'prosjekteringsunderlag', namn: 'Prosjekteringsunderlag', kode: 'PU' },
  { key: 'godkjenning',            namn: 'For godkjenning',        kode: 'FG' },
  { key: 'arbeidstegning',         namn: 'Arbeidstegning',         kode: 'AT' },
  { key: 'som_bygd',               namn: 'Som bygd',               kode: 'SB' },
]
// Leveransetypar brukar kan leggje til SJØLV når ei utsending vert registrert
// (DTMUtsendingModal.jsx), også for leveransar som ikkje var planlagde frå
// starten (brukar sitt krav 2. okt. 2026). Skjult i hovudtabellen som standard.
export const LEVERANSE_FASAR_EKSTRA = [
  { key: 'kommentar',          namn: 'For kommentar',          kode: 'KO' },
  { key: 'anbod',              namn: 'Anbudstegning',          kode: 'AB' },
  { key: 'utforing_fabrikk',   namn: 'For utførelse fabrikk',  kode: 'UF' },
  { key: 'soknad',             namn: 'Søknadstegning',         kode: 'SØ' },
]
export const LEVERANSE_FASAR = [...LEVERANSE_FASAR_BASIS, ...LEVERANSE_FASAR_EKSTRA]

// Brukt av skyopplastinga (sjå DTMModule.jsx/lastOppResultatdokumentTilSky)
// til å setje rett Content-Type på Storage-objektet, slik at ein mobil-
// nettlesar VISER t.d. ein PDF i staden for berre å laste han ned blindt.
const MIME_PER_FILTYPE = { pdf:'application/pdf', ifc:'application/octet-stream',
  dwg:'application/octet-stream', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg' }
export function gjettMimeType(filnamn) {
  const ext = /\.([a-z0-9]+)$/i.exec(filnamn || '')?.[1]?.toLowerCase() || ''
  return MIME_PER_FILTYPE[ext] || 'application/octet-stream'
}

// Eit dokument er «forsinka» for ein fase når det er sett ein planlagt
// utsendingsdato som alt har passert, UTAN at fasen er markert sendt —
// einaste staden denne 8-kolonnars planen treng eit eige utrekna signal,
// sjå lagCelle i DTMTabell.jsx (raud/feit tekst på sjølve den planlagde
// datoen, ingen eigen status-kolonne).
export function erForsinka(rad, faseKey) {
  if (rad[`sendt_${faseKey}`]) return false
  const d = tolkDato(rad[`planlagt_${faseKey}`])
  if (!d) return false
  const idag = new Date(); idag.setHours(0, 0, 0, 0)
  return d.getTime() < idag.getTime()
}

// ── Kontroll av teikningar (egenkontroll/fagkontroll/godkjenning) ──────
// Sjå claude/kvalitetsmodul-teikningar.md («Del B») og
// scripts/konverter-sjekkliste.cjs. Bygd oppå DTM sine kontrolldokument-
// rader, IKKJE eit eige, parallelt dokumentregister.

// Éin kolonne (dtm_dokumenter.kontrollstatus) held styr på HEILE flyten,
// sidan stega er strengt sekvensielle — eit dokument er berre ETT stad
// i køen om gongen.
export const KONTROLLSTATUS = {
  IKKJE_STARTA:          'ikkje_starta',
  EGENKONTROLL_PAGAENDE: 'egenkontroll_pagaende',
  KLAR_FAGKONTROLL:      'klar_fagkontroll',
  FAGKONTROLL_PAGAENDE:  'fagkontroll_pagaende',
  KLAR_GODKJENNING:      'klar_godkjenning',
  GODKJENNING_PAGAENDE:  'godkjenning_pagaende',
  GODKJENT:              'godkjent',
}

// Éin oppføring per kontrolltype (dei tre knappane «Start egenkontroll»/
// «Start fagkontroll»/«Start godkjenning»):
//   kø           — kva kontrollstatusar som gjer eit dokument AKTUELT for
//                  denne knappen (både «ikkje starta enno» og «alt i gang»
//                  — ein påbyrja, men ikkje ferdigstilt, kontroll skal
//                  kunne hentast fram att, ikkje gøymast).
//   pågåande     — statusen dokumentet får NÅR kontrollen startar.
//   ferdigStatus — statusen dokumentet får når kontrollen FERDIGSTILLAST
//                  (glir vidare til neste steg i køen, eller «godkjent»).
//   varsleFelt   — kva dtm_dokumenter-felt (fritekst-initialar) som peikar
//                  ut KVEN som skal varslast på e-post når DENNE
//                  kontrolltypen vert ferdigstilt (null = ingen varsling,
//                  sidan godkjenning er siste steget).
export const KONTROLLTYPE = {
  egenkontroll: {
    namn: 'Egenkontroll',
    kø: [KONTROLLSTATUS.IKKJE_STARTA, KONTROLLSTATUS.EGENKONTROLL_PAGAENDE],
    pågåande: KONTROLLSTATUS.EGENKONTROLL_PAGAENDE,
    ferdigStatus: KONTROLLSTATUS.KLAR_FAGKONTROLL,
    varsleFelt: 'fk_person',
  },
  fagkontroll: {
    namn: 'Fagkontroll',
    kø: [KONTROLLSTATUS.KLAR_FAGKONTROLL, KONTROLLSTATUS.FAGKONTROLL_PAGAENDE],
    pågåande: KONTROLLSTATUS.FAGKONTROLL_PAGAENDE,
    ferdigStatus: KONTROLLSTATUS.KLAR_GODKJENNING,
    varsleFelt: 'godkjent_av',
  },
  godkjenning: {
    namn: 'Godkjenning',
    kø: [KONTROLLSTATUS.KLAR_GODKJENNING, KONTROLLSTATUS.GODKJENNING_PAGAENDE],
    pågåande: KONTROLLSTATUS.GODKJENNING_PAGAENDE,
    ferdigStatus: KONTROLLSTATUS.GODKJENT,
    varsleFelt: null,
  },
}

// Teikningsnummer-koden (same mønster som tolkTeikningsnr() i
// KvalitetModule.jsx, <fagbokstav>-<type>-<løpenr>-<fase>) — brukt til å
// FØRESLÅ kva sjekkliste-type/stadium som gjeld for eit dokument. Brukar
// kan alltid overstyre i sjekkliste-vindauget om gjettinga er feil (t.d.
// «Skjema»/«IFC og DWG» har ingen eigen kode i denne tabellen og let seg
// ikkje gjette automatisk i det heile).
const SJEKKLISTE_TYPE_KODE = { '10':'situasjonsplan', '20':'plan', '40':'snitt', '45':'fasade', '50':'detaljar' }
// Sjekklista sine stadium-kodar (SK/FP/RS/AT) har eitt ledd FÆRRE enn dei
// fem fase-kodane (01–05) — «Tilbodsteikning» (03) manglar ein eintydig
// eigen bokstavkode. ANTEKING (rett dette i Excel-fila/her om det er
// feil): 03 vert handsama som RS, same som Søknadsteikning (04), sidan
// begge er før-byggje-fase innsendingspakkar.
const SJEKKLISTE_FASE_KODE = { '01':'SK', '02':'FP', '03':'RS', '04':'RS', '05':'AT' }

export function tolkSjekklisteType(nr) {
  const m = String(nr || '').match(/^[A-Za-z]+-(\d{2})-(\d{2})(?:-(\d{2}))?/)
  if (!m) return { type: null, stadium: null }
  const [, typeKode, , faseKode] = m
  return { type: SJEKKLISTE_TYPE_KODE[typeKode] || null, stadium: faseKode ? (SJEKKLISTE_FASE_KODE[faseKode] || null) : null }
}

// Gjeldande sjekkliste for eit dokument = Tittelfelt (ALLTID) + det valde
// type-arket, avgrensa til punkt som gjeld «Alle» stadium eller nett DETTE
// stadiumet (brukar sitt eige val, sjå AskUserQuestion-svaret 28. sept.
// 2026: «Type-arket + Tittelfelt, filtrert på stadium»).
export function hentGjeldandeSjekkliste(sjekklisteData, type, stadium) {
  const typePunkt = (type && sjekklisteData?.typar?.[type]?.punkt) || []
  const alle = [...(sjekklisteData?.tittelfelt || []), ...typePunkt]
  if (!stadium) return alle
  return alle.filter(p => !p.stadium?.length || p.stadium.includes('Alle') || p.stadium.includes(stadium))
}

// Appen har ikkje noko eige «visingsnamn»-felt for brukaren (berre
// e-postadressa) — brukar sitt krav 25. sept. 2026 var at «Lagra av» skal
// vise eit NAMN, ikkje e-postadressa. Gjettar eit lesbart namn frå den
// lokale delen av e-posten (før @), som fungerer bra for føretak sin
// vanlege konvensjon (fornamn.etternamn@domene) — men er ei GJETTING, ikkje
// eit lagra, verifisert namn. Fell tilbake til heile e-posten om han ikkje
// har noko å dele opp (t.d. reine, uformaterte e-postadresser).
export function namnFraEpost(epost) {
  if (!epost) return ''
  const lokalDel = String(epost).split('@')[0]
  const delar = lokalDel.split(/[._-]+/).filter(Boolean)
  if (delar.length < 2) return epost
  return delar.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(' ')
}
