# Malar-modul (dokumentmalar til prosjekteringa) — bygd 25. okt. 2026

Ny modul i venstremenyen («Malar», `activeModule === 'malar'`, ikon FileText). Genererer **ferdig utfylte Word- og Excel-filer** frå
prosjektopplysningane, utan å lagre noko i databasen (alt skjer i nettlesaren, nedlasting som vanleg fil).

## Korleis det fungerer
1. Vel prosjekt øvst (TN). Modulen les `projects.details` (kunde/tiltakshavar, eigedom, tiltak, areal, tilbod) + brukarprofilen (namn, tittel,
   adresse, e-post) + kontoret (valt kontor = firmanamn) og lagar eitt flatt fletteobjekt (`lagFletting()` i `malarData.js`).
2. Vel mal i lista til venstre (filter Alle/Word/Excel; språk nynorsk/bokmål øvst til høgre — standard følgjer brukarprofilen).
3. Flettefelta vert viste og kan rettast (tomme felt er gule: «Manglar»). Manglande verdiar vert **gule [plasshaldarar]** i dokumentet.
4. «Last ned .docx / .xlsx» byggjer fila (bibliotek vert lasta først då: `docx` og `exceljs`).

## Malane
| Mal | Type | Merknad |
|---|---|---|
| **Følgebrev – søknad om rammetillatelse** | Word | Mottakar = kommune (frå prosjektet), emne med adresse og gnr/bnr, oppsummeringstabell (tiltakshavar, ansvarleg søkjar, eigedom, tiltak, areal, vår ref.), tiltaksomtale, juridisk avsnitt (pbl. § 20-1/20-3, SAK10, TEK17), plasshaldar for avvik/dispensasjon, **vedleggsliste du kan hake av og utvide**, underskrift. Førehandsvising i modulen. |
| Møteinnkalling | Word | møtedata, deltakartabell, standard saksliste |
| Møtereferat | Word | til stades, tabell sak/referat/ansvarleg/frist |
| Prosjekteringsnotat | Word | forside med prosjektopplysningar + føremål/grunnlag/vurderingar/konklusjon |
| Teikningsliste | Excel | filter, nedtrekk (status, format), 40 rader |
| Arealoppstilling | Excel | BRA/BYA med SUM og differanse mot BRA frå prosjektet |
| Timekalkyle | Excel | timar × pris, sum, differanse mot estimerte timar/tilbodspris frå prosjektet |
| Aksjonsliste | Excel | status-nedtrekk, ferdige rader vert gråa ut (betinga formatering) |

Formgjeving: friskt og enkelt — grøn aksent (`#1B4332`), Calibri, lyse tabellar, firmanamn og prosjekt i topptekst, sidetal i botn (Word); prosjekttopp,
grøn overskriftsrad, rolege rammer, frosne rader og utskriftsoppsett (Excel).

## Filer (`notatapp/src/`)
`MalarModule.jsx` (UI, malliste, flettefelt, vedlegg, brevførehandsvising) · `malarData.js` (flettedata, standard vedlegg, **brevinnhaldet** `brevBlokkar()` som både
Word-generatoren og førehandsvisinga les) · `malarWord.js` (docx-generatorar) · `malarExcel.js` (exceljs-generatorar). Ny mal = ei oppføring i `MALAR` i
`MalarModule.jsx` + ein generator-funksjon `(f, {bm, vedlegg}) => Blob`.

## Avgrensingar / opne punkt
- Firmaadresse, telefon og org.nr. for ansvarleg søkjar finst ikkje i datamodellen (kontor har berre namn) — er tomme felt du fyller ut i modulen
  (ikkje lagra). Eit tilsvarande felt på kontoret/brukaren kan leggjast til seinare.
- Brevteksten er eit *forslag* — kontoret bør lese gjennom og justere formuleringane (særleg avsnitta om regelverk og dispensasjon).
- Ikkje opna i Word/Excel på maskina som bygde det; generatorane vart køyrde i nettlesaren og Excel-filene vart lese inn att (formlar OK). Tilgjengeleg på skrivebord, ikkje med i mobilradene.
- Mogleg vidare: eigne malar brukaren lastar opp (.docx med flettekodar), PDF-eksport av brevet, lagring av utfylte dokument i DTM.
