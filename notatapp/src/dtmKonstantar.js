// ── Felles konstantar/hjelparar for DTM-modulen ──────────────────────
// Sjå claude/dtm-modul.md for full spesifikasjon. Delt mellom
// DTMModule/DTMTabell/DTMImportModal for å unngå sirkulær import og
// halde status-/nummer-logikken på éin stad.

export const KATEGORIAR = ['arbeidsdokument', 'resultatdokument', 'kontrolldokument', 'styrande_dokument']

export const KATEGORI_LABEL = {
  arbeidsdokument:   'Arbeidsdokument',
  resultatdokument:  'Resultatdokument',
  kontrolldokument:  'Dokumentkontroll',
  styrande_dokument: 'Styrande dokument',
}

// Knappefargane brukar bad om, sjå claude/dtm-modul.md.
export const KATEGORI_FARGE = {
  arbeidsdokument:   '#2563EB', // blå
  resultatdokument:  '#111111', // svart
  kontrolldokument:  '#EA580C', // oransje
  styrande_dokument: '#7C3AED', // lilla
}

export const KATEGORI_MAPPE = {
  arbeidsdokument:   '3 Arbeidsdokument',
  resultatdokument:  '4 Resultatdokument',
  kontrolldokument:  '5 Kontrolldokument',
  styrande_dokument: '6 Styrande dokument',
}

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
  if (aktivtSett === 'styrande_dokument') return []
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
