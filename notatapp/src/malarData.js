// ═══════════════════════════════════════════════════════════════════
//  malarData — flettedata til dokumentmalane (Malar-modulen). Alt som kan hentast frå prosjektopplysningane
//  (Prosjekt → kort: kunde/tiltakshavar, eigedom, tiltak, areal) + brukarprofil + kontor vert samla i eitt flatt objekt.
//  Felt som manglar vert synte som gule [plasshaldarar] i dokumenta, og kan fyllast ut i modulen før nedlasting.
// ═══════════════════════════════════════════════════════════════════

export const FELT = {
  // nøkkel: [etikett, gruppe]
  prosjektnr:        ['Prosjektnummer', 'Prosjekt'],
  prosjektnamn:      ['Prosjektnamn', 'Prosjekt'],
  tiltakshavar_namn: ['Tiltakshavar', 'Tiltakshavar'],
  tiltakshavar_orgnr:['Org.nr. / fødselsnr.', 'Tiltakshavar'],
  tiltakshavar_adresse: ['Adresse', 'Tiltakshavar'],
  tiltakshavar_kontakt: ['Kontaktperson', 'Tiltakshavar'],
  tiltakshavar_epost:   ['E-post', 'Tiltakshavar'],
  tiltakshavar_tlf:     ['Telefon', 'Tiltakshavar'],
  eigedom_adresse:   ['Gateadresse', 'Eigedom'],
  eigedom_postnr:    ['Postnummer', 'Eigedom'],
  eigedom_poststad:  ['Poststad', 'Eigedom'],
  kommune:           ['Kommune', 'Eigedom'],
  kommunenr:         ['Kommunenummer', 'Eigedom'],
  gnr:               ['Gårdsnummer (gnr.)', 'Eigedom'],
  bnr:               ['Bruksnummer (bnr.)', 'Eigedom'],
  festenr:           ['Festenummer', 'Eigedom'],
  seksjonsnr:        ['Seksjonsnummer', 'Eigedom'],
  tiltakstype:       ['Type tiltak', 'Tiltak'],
  tiltaksbeskrivelse:['Beskriving av tiltaket', 'Tiltak'],
  bygningskategori:  ['Bygningstype', 'Tiltak'],
  bra:               ['BRA (m²)', 'Tiltak'],
  tilbodssum:        ['Tilbodspris (kr)', 'Tiltak'],
  timeestimat:       ['Estimerte timar', 'Tiltak'],
  avsendar_firma:    ['Firma (ansvarleg søkjar)', 'Avsendar'],
  avsendar_orgnr:    ['Organisasjonsnummer', 'Avsendar'],
  avsendar_namn:     ['Namn', 'Avsendar'],
  avsendar_tittel:   ['Tittel', 'Avsendar'],
  avsendar_epost:    ['E-post', 'Avsendar'],
  avsendar_tlf:      ['Telefon', 'Avsendar'],
  avsendar_adresse:  ['Firmaadresse', 'Avsendar'],
  dato:              ['Dato', 'Dokument'],
}

const s = (v) => (v == null ? '' : String(v).trim())
export const idagTekst = () => new Date().toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })

// prosjekt: { id, name, projectNumber, details }, brukar: useBrukar-profil, kontor: { name }, epost: innlogga e-post
export function lagFletting(prosjekt, brukar, kontor, epost) {
  const d = (prosjekt && prosjekt.details) || {}
  const lik = d.tiltakshavarSameAsClient !== false
  const adrKunde = [s(d.clientAddress), [s(d.clientPostnr), s(d.clientPoststad)].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const tiltakshavar = lik
    ? { namn: s(d.clientName), orgnr: s(d.clientOrgNr), adresse: adrKunde, kontakt: s(d.clientContactName), epost: s(d.clientContactEmail), tlf: s(d.clientContactPhone) }
    : { namn: s(d.tiltakshavarName), orgnr: s(d.tiltakshavarOrgNr), adresse: s(d.tiltakshavarAddress), kontakt: s(d.tiltakshavarContactName), epost: s(d.tiltakshavarContactEmail), tlf: s(d.tiltakshavarContactPhone) }
  const typar = Array.isArray(d.tiltakTypes) ? d.tiltakTypes.filter(Boolean).join(', ') : s(d.tiltakTypes)
  const kat = [s(d.buildingCategory), s(d.buildingSubcategory)].filter(Boolean).join(' – ')
  return {
    prosjektnr: s(prosjekt?.projectNumber), prosjektnamn: s(prosjekt?.name),
    tiltakshavar_namn: tiltakshavar.namn, tiltakshavar_orgnr: tiltakshavar.orgnr, tiltakshavar_adresse: tiltakshavar.adresse,
    tiltakshavar_kontakt: tiltakshavar.kontakt, tiltakshavar_epost: tiltakshavar.epost, tiltakshavar_tlf: tiltakshavar.tlf,
    eigedom_adresse: s(d.propertyAddress), eigedom_postnr: s(d.propertyPostnr), eigedom_poststad: s(d.propertyPoststad),
    kommune: s(d.propertyKommune), kommunenr: s(d.propertyKommunenr), gnr: s(d.propertyGnr), bnr: s(d.propertyBnr), festenr: s(d.propertyFestenr), seksjonsnr: s(d.propertySeksjonsnr),
    tiltakstype: typar, tiltaksbeskrivelse: s(d.tiltakDescription) || s(d.description), bygningskategori: kat, bra: s(d.bra),
    tilbodssum: s(d.offerPrice), timeestimat: s(d.estimatedHours),
    avsendar_firma: s(kontor?.name), avsendar_orgnr: s(kontor?.org_nr), avsendar_namn: s(brukar?.namn), avsendar_tittel: s(brukar?.tittel), avsendar_epost: s(epost) || s(kontor?.epost), avsendar_tlf: s(brukar?.telefon) || s(kontor?.telefon),
    avsendar_adresse: [s(kontor?.adresse), [s(kontor?.postnr), s(kontor?.poststad)].filter(Boolean).join(' ')].filter(Boolean).join(', ') || [s(brukar?.adresse), [s(brukar?.postnr), s(brukar?.poststad)].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    dato: idagTekst(),
  }
}

// «gnr/bnr/festenr/seksjonsnr» i vanleg skrivemåte
export const gbnr = (f) => [f.gnr, f.bnr, f.festenr, f.seksjonsnr].filter(Boolean).join('/')
export const eigedomAdresse = (f) => [f.eigedom_adresse, [f.eigedom_postnr, f.eigedom_poststad].filter(Boolean).join(' ')].filter(Boolean).join(', ')

// Standard vedlegg til søknad om rammetillatelse (kan hakast av / utvidast i modulen)
export const STANDARD_VEDLEGG = {
  nn: ['Søknad om tillatelse til tiltak (skjema)', 'Gjennomføringsplan', 'Situasjonsplan / utomhusplan', 'Plan-, snitt- og fasadeteikningar', 'Nabovarsel med kvittering for utsending og eventuelle merknader',
    'Erklæring om ansvarsrett (søkjar og føretak)', 'Redegjering for tilkomst, vatn og avløp', 'Dokumentasjon av tiltaket sitt areal (BRA/BYA)', 'Søknad om dispensasjon (viss aktuelt)'],
  bm: ['Søknad om tillatelse til tiltak (skjema)', 'Gjennomføringsplan', 'Situasjonsplan / utomhusplan', 'Plan-, snitt- og fasadetegninger', 'Nabovarsel med kvittering for utsendelse og eventuelle merknader',
    'Erklæring om ansvarsrett (søker og foretak)', 'Redegjørelse for adkomst, vann og avløp', 'Dokumentasjon av tiltakets areal (BRA/BYA)', 'Søknad om dispensasjon (hvis aktuelt)'],
}
export const FOREKOMMER_VEDLEGG_AV = [0, 1, 2, 3, 4, 5]  // fyrste seks er førehandsvalde

// ── Følgebrev: søknad om rammetillatelse (blokkar som både Word-generatoren og førehandsvisinga les) ──
// Segment: ein streng, eller { t, b?: fet, ph?: plasshaldar (gul) }
export function brevBlokkar(f, bm, vedlegg) {
  const t = (nn, b) => (bm ? b : nn)
  const v = (k, etikett) => (f[k] && String(f[k]).trim() ? String(f[k]).trim() : { t: `[${etikett}]`, ph: true })
  const adr = eigedomAdresse(f)
  const nr = gbnr(f)
  const eig = adr || nr ? adr : { t: `[${t('eigedomsadresse', 'eiendomsadresse')}]`, ph: true }
  const kommuneTekst = f.kommune ? f.kommune + ' kommune' : { t: `[${t('kommune', 'kommune')}]`, ph: true }
  const gbTekst = nr ? `${t('gnr.', 'gnr.')} ${f.gnr || '–'} / ${t('bnr.', 'bnr.')} ${f.bnr || '–'}${f.festenr ? ' / fnr. ' + f.festenr : ''}${f.seksjonsnr ? ' / snr. ' + f.seksjonsnr : ''}` : { t: `[${t('gnr./bnr.', 'gnr./bnr.')}]`, ph: true }
  const tiltak = f.tiltakstype || { t: `[${t('type tiltak', 'type tiltak')}]`, ph: true }
  const bygg = f.bygningskategori || ''
  const meta = [
    [t('Tiltakshavar', 'Tiltakshaver'), [v('tiltakshavar_namn', t('tiltakshavar', 'tiltakshaver')), f.tiltakshavar_orgnr ? ` (${t('org.nr.', 'org.nr.')} ${f.tiltakshavar_orgnr})` : '']],
    [t('Ansvarleg søkjar', 'Ansvarlig søker'), [v('avsendar_firma', t('firma', 'firma')), f.avsendar_orgnr ? ` (${t('org.nr.', 'org.nr.')} ${f.avsendar_orgnr})` : '']],
    [t('Eigedom', 'Eiendom'), [eig, ' – ', gbTekst, ', ', kommuneTekst]],
    [t('Tiltak', 'Tiltak'), [tiltak, bygg ? ` – ${bygg}` : '']],
    ...(f.bra ? [[t('Areal', 'Areal'), [`${f.bra} m² BRA`]]] : []),
    [t('Vår referanse', 'Vår referanse'), [v('prosjektnr', t('prosjektnr.', 'prosjektnr.')), f.prosjektnamn ? ` – ${f.prosjektnamn}` : '']],
  ]
  const blokkar = [
    { t: 'meta', rader: meta },
    { t: 'p', seg: [t('Vi søkjer med dette om rammetillatelse for ', 'Vi søker med dette om rammetillatelse for '), typeof tiltak === 'string' ? tiltak.toLowerCase() : tiltak, t(' på ', ' på '), eig, ' (', gbTekst, ', ', kommuneTekst, ').'] },
  ]
  if (f.tiltaksbeskrivelse) blokkar.push({ t: 'p', seg: [{ t: t('Om tiltaket: ', 'Om tiltaket: '), b: true }, f.tiltaksbeskrivelse] })
  else blokkar.push({ t: 'p', seg: [{ t: t('Om tiltaket: ', 'Om tiltaket: '), b: true }, { t: `[${t('kort beskriving av tiltaket, bruk og utnytting', 'kort beskrivelse av tiltaket, bruk og utnyttelse')}]`, ph: true }] })
  blokkar.push(
    { t: 'p', seg: [t('Søknaden gjeld tiltak etter plan- og bygningslova § 20-1 og vert sendt inn som søknad om rammetillatelse, jf. § 20-3 og byggesaksforskrifta (SAK10). Etter at rammetillatelse er gitt, vil vi søkje om igangsettingstillatelse for dei delane av tiltaket det er aktuelt for.',
      'Søknaden gjelder tiltak etter plan- og bygningsloven § 20-1 og sendes inn som søknad om rammetillatelse, jf. § 20-3 og byggesaksforskriften (SAK10). Etter at rammetillatelse er gitt, vil vi søke om igangsettingstillatelse for de delene av tiltaket det er aktuelt for.')] },
    { t: 'p', seg: [t('Tiltaket er prosjektert i samsvar med gjeldande reguleringsplan og tekniske krav i byggteknisk forskrift (TEK17). ', 'Tiltaket er prosjektert i samsvar med gjeldende reguleringsplan og tekniske krav i byggteknisk forskrift (TEK17). '),
      { t: t('[Merk eventuelle avvik frå plan eller behov for dispensasjon her, elles slettar du denne setninga.]', '[Merk eventuelle avvik fra plan eller behov for dispensasjon her, ellers sletter du denne setningen.]'), ph: true }] },
    { t: 'h', tekst: t('Vedlegg', 'Vedlegg') },
    ...vedlegg.map((tekst, i) => ({ t: 'li', nr: i + 1, tekst })),
    { t: 'p', seg: [t('Spørsmål til søknaden kan rettast til undertekna. Vi ser fram til handsaminga.', 'Spørsmål til søknaden kan rettes til undertegnede. Vi ser frem til behandlingen.')] },
  )
  return blokkar
}
export const brevEmne = (f, bm) => `${bm ? 'Søknad om rammetillatelse' : 'Søknad om rammetillatelse'} – ${eigedomAdresse(f) || (bm ? 'eiendom' : 'eigedom')}${gbnr(f) ? `, gnr. ${f.gnr || '–'} / bnr. ${f.bnr || '–'}` : ''}`
export const brevHelsing = (bm) => (bm ? 'Med vennlig hilsen' : 'Med vennleg helsing')
