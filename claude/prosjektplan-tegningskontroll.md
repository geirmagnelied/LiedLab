# Prosjektplan / Tegningskontroll — separat Python-verktøy (referanse)

**Dette er IKKJE ein del av LiedLab Notatapp-repoet.** Det er eit anna,
frittståande verktøy — «Prosjektplan» (også kalla Tegningskontroll) — som
ligg i `C:\Tools\Tegningskontroll\` på brukaren si maskin, med sin eigen
kodebase (Python/Flask), ikkje i dette Git-repoet. Det er dokumentert her
fordi det er **tematisk sams** med `KvalitetModule.jsx` i Notatapp (begge
handterer teikningsregister/kvalitetskontroll for arkitektteikningar), og
fordi delar av Notatappen sin KS-modul alt har **porta logikk direkte
herifrå** — sjå kryssreferansen nedst.

Brukar la tre samandrags-filer (`PROSJEKTPLAN_SAMANDRAG_1.md`,
`PDF_ANALYSE_SAMANDRAG_1.md`, `PDF_TITTELFELT_SAMANDRAG_2.md`) i repo-rota
24. sept. 2026 for at Claude Code skulle lese dei inn; dei er konsoliderte
i denne eine fila (same «éin fil per tema»-konvensjon som resten av
`claude/`-mappa) og sletta frå rota.

---

## Kva Prosjektplan er

Flask-webapp + SPA (`templates/index.html`, vanilla JS) for
kvalitetskontroll av arkitektteikningar. Prosjektfil: `*.tkontroll` (JSON,
éin fil per prosjekt — ikkje ein database som Notatapp/Supabase).

**Teknisk stack:**
- Backend: Python Flask (`app.py`)
- Frontend: éi HTML-fil — vanilla JS SPA
- Lagring: JSON-fil per prosjekt (`.tkontroll`)
- PDF-generering: `reportlab`
- PDF-analyse: `pdfminer.six` + `pypdf`
- Word-generering: `python-docx`
- Mappeovervaking: `watchdog`

**Navigasjonsstruktur (faner):** Dashboard | Leveransekontroll | Styrande
dokumenter | Rapport | Resultatdokumenter | Prosjektadministrasjon |
Prosjektinfo (modal)

**Demo-prosjekt:** GreenH Langstranda, nr. 2025-0234, arkitekt Norconsult,
fagansvarleg Geir Magne Lied, kunde Consto Anlegg Nord AS.

### Datamodell (`.tkontroll`-JSON)

```json
{
  "prosjekt": { "namn", "nr", "stad", "prosjekttype", "kontrollmappe",
    "styrande_mappe", "fag_forkortelse", "arkitekt", "ansvarleg",
    "fagansvarleg", "kunde", "avtale_sti", "mal_8401", "mal_8402" },
  "teikningar": [{ "id", "nr", "rev", "type", "tittel", "filsti",
    "dato", "status", "historikk" }],
  "kontrollar": { "tId": { "sjekk_id": { "status", "kommentar" },
    "egenkontroll_ferdig", "fagkontroll_ferdig",
    "egenkontroll_dato", "fagkontroll_dato" } },
  "sjekklister": [{ "id", "namn", "type", "status", "kommentarar": {
    "paragraf_id": { "ek", "fk", "nf", "na" } } }],
  "styrande_v2": { "filer": { "gruppe_id": { "filnamn": "sti" } },
    "avkryssing": { "fid": { "ek_ok", "ek_kmt", "fk_ok", "fk_kmt" } } },
  "milepalar": [{ "id", "namn", "dato", "status", "beskriving", "kommentar" }],
  "endringar": [{ "id", "nr", "standard", "tittel", "dato",
    "oppdragsleiar", "status", "beskriving", "grunnlag",
    "krav_kr", "krav_tid" }]
}
```

**Teikningstatusflyt:** `til_kontroll → egenkontroll_pagaar → til_fagkontroll
→ fagkontroll_pagaar → ferdigstilt` (forenkla til 3 viste statusar:
Egenkontroll | Fagkontroll | Ferdigstilt — same 3-stegs idé som
`KvalitetModule.jsx`s Del B, ikkje starta enno i Notatapp).

**Sjekklister (type-id):** `tek17` (TEK17 kap. 5–17, 96 paragrafar),
`pbl` (Plan- og bygningslova, 10 §§), `arealplan` (Reguleringsplan/
kommuneplan, 10 punkt), `sak` (SAK10 Byggesaksforskriften, 8 §§).

**Tegningsliste-PDF** (A3 liggjande, reportlab): header
`[Arkitekt venstre] | TEGNINGSLISTE (senter) | Prosjekt/oppdragsnr. (høgre)`,
mørkgrå tabellheader med kvit tekst, kolonnar Tegningsnummer | Tegningsnavn
| Dato første rev. | Rev. | Dato gjeld. rev. | Målestokk | Fase, vekslande
rad-fargar per type, footer `Side X av Y` senter + logo høgre. Kjelda er
filer i `[kontrollmappe]\Kontroll ferdigstilt\`.

### API-endepunkt

```
GET/POST /api/data                        – les/skriv prosjektdata
POST     /api/analyser-pdf                – PDF-kvalitetssjekk (linje, tekst, nordpil)
POST     /api/generer-tegningsliste       – A3 PDF-tegningsliste
POST     /api/skann-kontroll-ferdigstilt  – finn ferdigstilte PDF-ar
POST     /api/skann-styrande              – skann undermapper styrande
POST     /api/generer-endringsvarsel      – Word-dokument frå mal
POST     /api/ferdigstill-egenkontroll / -fagkontroll
POST     /api/ferdigstill-sjekkliste-ek / -fk
```

---

## PDF-kvalitetsanalyse (`/api/analyser-pdf`)

Les ein teiknings-PDF og sjekkar linjebreidder, tekststorleik og nordpil
mot NS-standardar (NS-EN ISO 5457 + NS 3420):

| Parameter     | Grenseverdi   | Merknad               |
|---------------|---------------|-----------------------|
| Linjebreidde  | ≥ 0,09 mm     | Tynn linje min.       |
| Tekststorleik | ≥ 1,5 mm      | Lesbar på utskrift    |
| Nordpil       | Obligatorisk  | For situasjonsplan    |

**Metode:**
- **Linjebreidde** — `pikepdf` les rå content stream, finn alle `X w`
  (PDF-operatoren `setLineWidth`) med regex, reknar om frå PDF-einingar til
  mm via sideformatet (`MediaBox`), skalerer mot A3 (297mm) eller A4 (210mm)
  breidd etter kva som er størst.
- **Tekststorleik** — `pdfminer.six` sin `extract_pages()` + `LTChar`, les
  `teikn.size` (i pt) → mm, berre side 1.
- **Nordpil** — regex `\((N|NORD|NORTH)\)` mot rå content stream, avgrensa
  til øvste 85% av sida (over `h * 0.15` frå botn).
- **Sideformat-gjetting** for skaleringa:
  ```python
  FORMAT = {'A0': (1189, 841), 'A1': (841, 594), 'A2': (594, 420),
            'A3': (420, 297), 'A4': (297, 210)}
  ```

Frontend: knapp per teikning → POST → modal med grøn OK-rad/raud AVVIK-rad
per målt element, DIBK-lenkje til veiledning, og eit samandrag
(«X linjebreidder OK / Y avvik», «Z tekstelement OK / W avvik»).

---

## PDF-tittelfelt-lesing og metadata-skriving

System for å lese Norconsult-tittelfelt automatisk frå PDF-ar og skrive
resultata tilbake til fila som metadata (Info-dictionary + XMP).

**⚠️ Denne logikken er alt PORTA til Notatapp** — sjå
[`claude/kvalitetsmodul-teikningar.md`](kvalitetsmodul-teikningar.md),
avsnittet «PDF-tittelfelt: `pdfjs-dist`»: `lesTittelfelt()` i
`electron/main.js` er ein direkte port av `les_tittelfelt()` under, med
alle sju regex-mønstera uendra. Den opphavlege porten hadde ein bug (limte
tekstbitar saman i feil rekkjefølgje i staden for å klyngje dei etter
Y-posisjon til linjer, slik `pdfplumber` gjer gratis) — retta 30. august.
**Regex-mønstera nedanfor er difor den autoritative kjelda** dersom
tittelfelt-tolkinga i Notatapp nokon gong treng justerast eller utvidast.

**Tittelfelt-plassering** (Norconsult-mal): nedre høgre hjørne av
teikningsbladet. Ekstraksjonssone (`pdfplumber`):
`x > (side_breidde * 0.78)` og `y < (side_høgd * 0.50)`.

Felt ovanifrå og ned i tittelblokka: PROSJEKTNAVN → ADRESSE/STAD +
OPPDRAGSNUMMER → TEIKNINGSTITTEL → TEIKNING NR. | REV. →
DATO | MÅLESTOKK | FORMAT → PROSJEKTLEIAR/TEIKNAR/KONTROLL.

```python
# 1. Les PDF → sida → ekstraher tekst frå tittelfelt-sone
def les_tittelfelt(pdf_sti):
    with pdfplumber.open(pdf_sti) as pdf:
        side = pdf.pages[0]
        w, h = side.width, side.height
        krop = side.crop((w * 0.78, 0, w, h * 0.50))
        tekst = krop.extract_text() or ""
        if not tekst.strip():
            img = krop.to_image(resolution=300)
            tekst = pytesseract.image_to_string(img.original)  # OCR-fallback
        return tekst

# 2. Parser tekst med regex
REGEX = {
    "teikning_nr": r'\b([A-Z]{1,3}\d{3,4}(?:[_-][A-Z0-9]+)?)\b',
    "revisjon":    r'\bREV(?:ISJON)?[:\s\.]+([A-Z0-9]+)\b|^([A-Z])$',
    "maalestokk":  r'1\s*[:\/]\s*(\d{1,5})',
    "dato":        r'\b(\d{2}[./-]\d{2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2})\b',
    "adresse":     r'\b(Gnr\.?\s*\d+\s*[,/]\s*Bnr\.?\s*\d+)\b',
    "prosjektnr":  r'\b(\d{4}-\d{3,4})\b',
    "format":      r'\b(A[0-4])\b',
    "fase":        r'\b(SK|FP|RS|AT|FORPROSJEKT|ARBEIDSTEIKN|RAMMESØKNAD)\b',
}
```

**Metadata-skriving** (`pikepdf`, Info-dictionary + eige XMP-namnerom
`http://www.norconsult.no/tegning/`):

```python
def skriv_metadata(pdf_sti, felt):
    with pikepdf.open(pdf_sti, allow_overwriting_input=True) as pdf:
        with pdf.open_metadata() as meta:
            meta['dc:title']       = felt.get('tittel', '')
            meta['dc:description'] = felt.get('teikning_nr', '')
        xmp = pdf.open_metadata()
        xmp.load_from_docinfo()
        felt_map = {
            'norconsult:TegningNr': felt.get('teikning_nr', ''),
            'norconsult:Revisjon':  felt.get('revisjon', ''),
            'norconsult:Dato':      felt.get('dato', ''),
            'norconsult:Maalestokk':felt.get('maalestokk', ''),
            'norconsult:Fase':      felt.get('fase', ''),
        }
        for k, v in felt_map.items():
            if v: xmp[k] = v
        pdf.save()
```

**Filnamn-parsing** (Norconsult-konvensjon
`PROSJNR_FORKORTELSE_TEIKNR_REV_BESKRIVING.pdf`, t.d.
`2025-0234_A_A101_RevB_Grunnplan_1etasje.pdf`) — brukt til å fylle tomme
felt som tittelfelt-lesinga ikkje fann:

```python
def parse_filnamn(filnamn):
    base = Path(filnamn).stem
    resultat = {}
    for del_ in base.split('_'):
        if re.match(r'^\d{4}-\d{3,4}$', del_):      resultat['prosjektnr'] = del_
        elif re.match(r'^Rev[A-Z0-9]$', del_, re.I): resultat['revisjon'] = del_[-1].upper()
        elif re.match(r'^[A-Z]{1,3}\d{3,4}$', del_): resultat['teikning_nr'] = del_
        elif del_.upper() in ('A','R','RIB','RIE','RIV','RIVA'): resultat['fag'] = del_.upper()
    return resultat
```

**Mappeovervaking** (`pdf_vaktar.py`, `watchdog`): observerer ei mappe for
nye/endra PDF-ar, les tittelfeltet, fyller tomme felt frå filnamnet,
skriv metadata, oppdaterer tegningslista — automatisk, utan manuell
opplasting. (Notatappen sin variant av dette er
`ksSkannOgLeggTil()`/drag-og-slepp i `KvalitetModule.jsx`, ikkje ei
bakgrunnsteneste som køyrer heile tida.)

**Integrasjon attende i Prosjektplan sjølv:** når appen les filer frå
`[kontrollmappe]\Kontroll ferdigstilt\`, brukar han XMP-metadata (skrive av
steget over) i staden for berre filnamn — `les_pdf_metadata()` les
`norconsult:TegningNr`/`Revisjon`/`Dato`/`Maalestokk`/`Fase` +
`dc:title` via `pikepdf.open_metadata()`.

### Avhengigheiter (Python)

```
pdfplumber      # tekst-ekstraksjon frå PDF-sone
pikepdf         # skriv XMP/Info-metadata
pytesseract     # OCR-fallback for skanna teikningar
Pillow (PIL)    # biletehandtering for OCR
watchdog        # mappe-overvaking
python-docx     # endringsvarsel-malar
reportlab       # generere tegningsliste PDF
```

### Kjende fallgruver

- `pdfplumber` returnerer `None` frå `extract_text()` på skanna PDF → OCR
  (`pytesseract`) nødvendig.
- Tittelfelt-sona varierer litt mellom ArchiCAD-malar → juster
  `0.78`/`0.50`-grensene for prosjektet.
- `pikepdf` krev at fila ikkje er opna i Acrobat samstundes (Windows-lås).
- Norconsult-XMP-namnerommet (`norconsult:`) er ikkje registrert offentleg
  — det er berre eit sjølvvalt namn, men fungerer likevel fint internt.
- Windows-stiar med backslash: bruk `Path(sti).as_posix()` eller
  `r"..."`-raw-strings, aldri vanlege `"..."`-strengar med backslash.
