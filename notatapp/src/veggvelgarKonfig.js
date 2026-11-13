// ═══════════════════════════════════════════════════════════════════
//  Veggvelgar — innstillingar Geir Magne kan justere utan å røre logikken.
//  Dataa sjølve (Norgips) ligg i data/norgipsVeggtabell.json.
//  MERK: robustheit- og romtype-mappinga under er EIGNE tolkingar (ikkje frå Norgips) og skal stadfestast av fagperson.
// ═══════════════════════════════════════════════════════════════════

export const BRANNKLASSAR = [0, 30, 60, 90, 120]   // EI-minutt; 0 = ingen brannkrav

// Robustheit: poeng per hovudplate (støt/slitasje), + 1 poeng når veggen har to eller fleire lag per side. Maks 3.
//   0 = lett (Light Board), 1 = normal, 2 = auka, 3 = høg
export const PLATE_ROBUSTHEIT = { LB: 0, STD: 1, BRN: 1, SIB: 1, SAB: 2, AQ: 2, UB13: 2, UB15: 3 }
export const TILLEGG_FLEIRE_LAG = 1
export const ROBUSTHEITSNIVA = [
  { verdi: 0, namn: 'Ingen krav' },
  { verdi: 1, namn: 'Normal' },
  { verdi: 2, namn: 'Auka' },
  { verdi: 3, namn: 'Høg' },
]

// Romtype → kva rader som kjem i tale
export const ROMTYPAR = [
  { verdi: 'innvendig', namn: 'Innvendig (skillevegg)', hjelp: 'Skillevegger med plater på begge sider' },
  { verdi: 'sjakt', namn: 'Sjakt', hjelp: 'Sjaktvegger: plater berre på ei side (0/x-oppbygging, t.d. W628 B)' },
  { verdi: 'vatrom', namn: 'Våtrom', hjelp: 'Rader der fuktbestandig plate (Humidboard eller Aquapanel) kan brukast' },
]
export const FUKTPLATER = ['HB', 'AQ']
export const SJAKT_FAMILIE = 'W628B'

// Over denne høgda med brannkrav skal sjakt- og dobbeltvegger prosjekterast særskilt av RIB (Norgips)
export const RIB_GRENSE_MM = 4000

// Vegtype (materiale): filter i skjemaet. Familiane står i data/norgipsVeggtabell.json (felt `materiale`).
export const MATERIALAR = [
  { verdi: 'alle', namn: 'Alle typar' },
  { verdi: 'stal', namn: 'Stål (W111, W112, W115, W628 B)' },
  { verdi: 'tre', namn: 'Trestender' },
  { verdi: 'nailit', namn: 'Nail It (Indoor og Safety)' },
]

// Robustheit: tillegg per Nail It-familie (spikra Ultra Board; Safety er sikkerheitsklasse 3 / RC4)
export const FAMILIE_ROBUSTHEIT_TILLEGG = { NailItIndoor: 1, NailItSafety: 2 }

// Kortnamn i tabellen
export const FAMILIE_KORT = { Trestender: 'Tre', TrestenderUB: 'Tre UB', NailItIndoor: 'Nail It', NailItSafety: 'Nail It S' }
// Profilnamn i resultat (nøkkel = profil i `hogde`)
export const PROFILNAMN = { dB: 'dB+', CF: 'CF', Tre: 'Tre', N: 'Nail It', CFN: 'Nail It CF' }
