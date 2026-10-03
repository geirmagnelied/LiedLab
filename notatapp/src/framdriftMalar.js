// ═══════════════════════════════════════════════════════════════════
//  Malar for vanlege forløp (Framdrift-modulen, claude/framdrift-modul.md).
//  Varigheiter er TYPISKE tal i arbeidsdagar (5 = ei veke) — meint som
//  utgangspunkt brukar justerer, ikkje fasit. Alt vert lagt i ei kjede
//  (kvar aktivitet startar når førre er ferdig), sjå byggFraMal().
//
//  Nabovarsel: merknadsfristen er 2 veker (14 dagar) frå nabane har fått
//  varselet — 11 arbeidsdagar gjev same sluttdato som fristen (nesten
//  alltid måndagen to veker seinare). Kommunal saksbehandling: 12 veker er
//  den lovbestemte fristen for søknad som krev full saksbehandling, 3 veker
//  for enkle tiltak — begge i arbeidsdagar her (60 / 15).
// ═══════════════════════════════════════════════════════════════════

const A = (namn, varig) => ({ type: 'aktivitet', namn, varig })
const M = (namn) => ({ type: 'milepael', namn })

export const MALAR = [
  {
    id: 'byggesak_dispensasjon',
    namn: 'Byggesak med dispensasjon',
    skildring: 'Frå forprosjekt til igangsetjingsløyve, med nabovarsel (2 vekers merknadsfrist) og dispensasjonssøknad.',
    fasar: [
      { namn: 'Skisseprosjekt', fasekode: '01', element: [
        A('Innhenting av grunnlag og avklaring med kommunen', 5),
        A('Skisser og moglegheitsstudie', 15),
        M('Skisser godkjende av byggherre'),
      ] },
      { namn: 'Forprosjekt og dispensasjon', fasekode: '02', element: [
        A('Forprosjekt', 15),
        A('Førehandskonferanse med kommunen', 5),
        A('Søknad om dispensasjon med grunngjeving', 10),
        A('Nabovarsel — merknadsfrist 2 veker', 11),
        M('Nabovarsel utløpt'),
        A('Kommentarar frå nabo og tilsvar', 5),
      ] },
      { namn: 'Søknad om løyve', fasekode: '04', element: [
        A('Søknadsteikningar og gjennomføringsplan', 15),
        A('Samordna søknad om rammeløyve (inkl. dispensasjon)', 5),
        A('Kommunal saksbehandling (12 veker)', 60),
        M('Rammeløyve mottatt'),
      ] },
      { namn: 'Detaljprosjekt', fasekode: '05', element: [
        A('Detaljprosjektering og samordning', 30),
        A('Søknad om igangsetjingsløyve', 5),
        A('Saksbehandling igangsetjingsløyve', 15),
        M('Igangsetjingsløyve mottatt'),
      ] },
    ],
  },
  {
    id: 'byggesak_enkel',
    namn: 'Byggesak utan dispensasjon',
    skildring: 'Søknadspliktig tiltak utan dispensasjon: nabovarsel, søknad og igangsetjing.',
    fasar: [
      { namn: 'Skisse- og forprosjekt', fasekode: '02', element: [
        A('Skisser og avklaring med byggherre', 10),
        A('Forprosjekt', 10),
        M('Forprosjekt godkjent'),
      ] },
      { namn: 'Søknad', fasekode: '04', element: [
        A('Nabovarsel — merknadsfrist 2 veker', 11),
        M('Nabovarsel utløpt'),
        A('Søknadsteikningar og søknadsdokument', 10),
        A('Kommunal saksbehandling (3 veker, enkelt tiltak)', 15),
        M('Løyve mottatt'),
      ] },
      { namn: 'Detaljprosjekt', fasekode: '05', element: [
        A('Detaljprosjektering', 20),
        A('Søknad om igangsetjingsløyve', 5),
        M('Igangsetjingsløyve mottatt'),
      ] },
    ],
  },
  {
    id: 'prosjektering_fasar',
    namn: 'Prosjektering — fase 01–05',
    skildring: 'Dei fem prosjekteringsfasane som i teikningsnummereringa (Kvalitetssystemet), med typiske varigheiter.',
    fasar: [
      { namn: 'Skisseprosjekt', fasekode: '01', element: [A('Skisser og moglegheitsstudie', 15), M('Skisseprosjekt godkjent')] },
      { namn: 'Forprosjekt', fasekode: '02', element: [A('Forprosjekt', 20), M('Forprosjekt godkjent')] },
      { namn: 'Tilbodsteikning', fasekode: '03', element: [A('Tilbodsteikningar og beskriving', 20), M('Tilbodsgrunnlag sendt')] },
      { namn: 'Søknadsteikning', fasekode: '04', element: [A('Søknadsteikningar', 15), M('Søknad sendt kommunen')] },
      { namn: 'Detaljprosjekt', fasekode: '05', element: [A('Detaljprosjektering', 40), A('Arbeidsteikningar og kontroll', 10), M('Arbeidsteikningar utsendt')] },
    ],
  },
]
