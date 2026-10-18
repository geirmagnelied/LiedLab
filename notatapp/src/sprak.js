import { createContext, useContext } from 'react'

// ═══════════════════════════════════════════════════════════════════
//  Språk i appen: nynorsk (nn, standard) eller bokmål (bm). Valet ligg i brukarprofilen (Brukar → Brukarinfo) og i
//  localStorage (`liedlab-sprak`). Namn/ord som skal endre seg etter språkvalet hentar ein med `t('nøkkel')` (useT()).
//  Ordlista dekkjer navigasjon, toppfelt, Brukar-modulen og dashboardet; resten av appen vert omsett etter kvart —
//  legg nye ord i ORD under (nn alltid, bm der ordet skil seg).
// ═══════════════════════════════════════════════════════════════════

const ORD = {
  nn: {
    // navigasjon (venstrefane)
    'nav.dashboard': 'Dashboard', 'nav.dtm': 'Dokument, tegningar og modellar', 'nav.gjeremaal': 'Gjeremål', 'nav.timar': 'Timar',
    'nav.kvalitet': 'Kvalitetssystem', 'nav.farge': 'Farge', 'nav.bilete': 'Bilete', 'nav.framdrift': 'Framdrift', 'nav.kalender': 'Kalender', 'nav.bruker': 'Brukar',
    'nav.prosjekt': 'Prosjekt', 'nav.kunde': 'Kundar', 'nav.kontordrift': 'Kontordrift', 'nav.notatar': 'Notatar', 'nav.oppgaver': 'Oppgåver', 'nav.saker': 'Saker',
    'nav.breidde': 'Breidde', 'nav.berreIkon': 'Berre ikon', 'nav.ikonBokstav': 'Ikon og bokstav', 'nav.ikonTekst': 'Ikon og full tekst',
    // toppfelt
    'topp.prosjekt': 'Prosjekt', 'topp.alleProsjekt': '— Alle prosjekt —', 'topp.sokProsjekt': 'Søk prosjekt…', 'topp.ingenTreff': 'Ingen treff.',
    'topp.innstillingar': 'Innstillingar', 'topp.meny': 'Meny', 'topp.minSide': 'Min side', 'topp.favoritt': 'Marker som favoritt', 'topp.fjernFavoritt': 'Fjern favoritt',
    // brukar-modulen
    'bruker.tittel': 'Brukar', 'bruker.info': 'Brukarinfo', 'bruker.kompetanse': 'Kompetanse', 'bruker.prosjekterfaring': 'Prosjekterfaring',
    'bruker.namn': 'Namn', 'bruker.adresse': 'Adresse', 'bruker.postnr': 'Postnummer', 'bruker.poststad': 'Poststad', 'bruker.fodselsaar': 'Fødselsår', 'bruker.fodselsdato': 'Fødselsdato', 'bruker.tittelFelt': 'Tittel',
    'bruker.epost': 'E-post', 'bruker.bilete': 'Bilete', 'bruker.lastOpp': 'Last opp bilete', 'bruker.fjernBilete': 'Fjern bilete', 'bruker.sprak': 'Språk', 'bruker.nynorsk': 'Nynorsk', 'bruker.bokmal': 'Bokmål',
    'bruker.lagrar': 'Lagrar…', 'bruker.lagra': 'Lagra ✓', 'bruker.feil': 'Klarte ikkje lagre',
    'komp.kategori': 'Kategori', 'komp.nyKategori': 'Ny kategori', 'komp.nyRad': 'Ny rad', 'komp.arstal': 'Årstal (frå–til)', 'komp.fra': 'Frå', 'komp.til': 'Til', 'komp.namn': 'Namn på utdanning/kurs',
    'komp.institusjon': 'Utdanningsinstitusjon', 'komp.poeng': 'Studiepoeng', 'komp.sum': 'Sum', 'komp.utdanning': 'Utdanning', 'komp.kurs': 'Kurs og vidareutdanning', 'komp.sert': 'Sertifiseringar og autorisasjonar',
    'erf.nytt': 'Nytt prosjekt', 'erf.arstal': 'Årstal (frå–til)', 'erf.namn': 'Prosjektnamn', 'erf.kategori': 'Prosjektkategori', 'erf.skildring': 'Prosjektskildring', 'erf.storleik': 'Prosjektstorleik (BRA m²)',
    'erf.rolle': 'Rolle', 'erf.kontakt': 'Kontaktperson kunde', 'erf.kontaktinfo': 'Kontaktinfo kunde', 'erf.bilete': 'Bilete', 'erf.leggTilBilete': 'Legg til bilete', 'erf.ingen': 'Ingen prosjekt lagt inn enno.',
    'felles.slett': 'Slett', 'felles.ekspander': 'Vis detaljar', 'felles.skjul': 'Skjul detaljar',
    // dashboard
    'dash.godmorgon': 'God morgon', 'dash.goddag': 'God dag', 'dash.godkveld': 'God kveld', 'dash.sisteNotat': 'Siste notat', 'dash.opneOppgaver': 'Opne oppgåver', 'dash.timarVeka': 'Timar denne veka', 'dash.sisteDtm': 'Siste i DTM',
  },
  bm: {
    'nav.dtm': 'Dokumenter, tegninger og modeller', 'nav.gjeremaal': 'Gjøremål', 'nav.timar': 'Timer', 'nav.bilete': 'Bilder', 'nav.framdrift': 'Fremdrift', 'nav.bruker': 'Bruker',
    'nav.kunde': 'Kunder', 'nav.notatar': 'Notater', 'nav.oppgaver': 'Oppgaver', 'nav.breidde': 'Bredde', 'nav.berreIkon': 'Bare ikon', 'nav.ikonBokstav': 'Ikon og bokstav', 'nav.ikonTekst': 'Ikon og full tekst',
    'topp.sokProsjekt': 'Søk prosjekt…', 'topp.innstillingar': 'Innstillinger', 'topp.minSide': 'Min side', 'topp.fjernFavoritt': 'Fjern favoritt',
    'bruker.tittel': 'Bruker', 'bruker.info': 'Brukerinfo', 'bruker.namn': 'Navn', 'bruker.fodselsaar': 'Fødselsår', 'bruker.bilete': 'Bilde', 'bruker.lastOpp': 'Last opp bilde', 'bruker.fjernBilete': 'Fjern bilde',
    'bruker.sprak': 'Språk', 'bruker.lagrar': 'Lagrer…', 'bruker.feil': 'Klarte ikke lagre',
    'komp.nyRad': 'Ny rad', 'komp.arstal': 'Årstall (fra–til)', 'komp.fra': 'Fra', 'komp.namn': 'Navn på utdanning/kurs', 'komp.institusjon': 'Utdanningsinstitusjon', 'komp.poeng': 'Studiepoeng',
    'komp.kurs': 'Kurs og videreutdanning', 'komp.sert': 'Sertifiseringer og autorisasjoner',
    'erf.nytt': 'Nytt prosjekt', 'erf.arstal': 'Årstall (fra–til)', 'erf.namn': 'Prosjektnavn', 'erf.skildring': 'Prosjektbeskrivelse', 'erf.storleik': 'Prosjektstørrelse (BRA m²)',
    'erf.kontakt': 'Kontaktperson kunde', 'erf.bilete': 'Bilder', 'erf.leggTilBilete': 'Legg til bilder', 'erf.ingen': 'Ingen prosjekter lagt inn ennå.',
    'felles.ekspander': 'Vis detaljer', 'felles.skjul': 'Skjul detaljer',
    'dash.godmorgon': 'God morgen', 'dash.opneOppgaver': 'Åpne oppgaver', 'dash.timarVeka': 'Timer denne uken',
  },
}

export const lagT = (sprak) => (nokkel, reserve) => (ORD[sprak] && ORD[sprak][nokkel]) ?? ORD.nn[nokkel] ?? reserve ?? nokkel
export const SprakKontekst = createContext({ sprak: 'nn', t: lagT('nn'), settSprak: () => {} })
export const useT = () => useContext(SprakKontekst)
