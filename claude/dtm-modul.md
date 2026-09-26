# DTM — Dokument, tegningar og modellar (under utvikling, frå 24. sept. 2026)

**Status: under bygging, fleire fasar.** Denne fila er spesifikasjonen slik
han vart avklara med brukar 24. sept. 2026, og vert oppdatert etter kvar
fase er levert. Les denne FØR du gjer noko i DTM-relatert kode — ho er den
autoritative kjelda for design-avgjerder teke undervegs (mange av dei var
uklare i utgangspunktet og vart avklara over fleire rundar med brukar).

## Kva DTM er, og kva han IKKJE er

DTM erstattar **Resultatdokument-modulen** som den einaste staden i appen
der brukar lastar opp/importerer dokument og teikningar, og held oversikt
over alle versjonar av dei. **Kvalitetssystem-modulen** (`KvalitetModule.jsx`)
held fram som ein **separat** modul for å *planleggje* kvalitetskontrollen
(sjekklister, egenkontroll/fagkontroll-arbeidsflyt) — men sjølve
dokumenthandteringa (opplasting, skanning, arkivering, register) skjer
**berre** i DTM. (KvalitetModule.jsx sin eksisterande scan-og-registrer-flyt
frå Del A vert ikkje fjerna i denne runden, men er no overflødig — sjå
oppgåveliste nedst.)

Systemet er bygd rundt **dokumentnummeret** som identifikator — det som
minst sannsynleg endrar seg gjennom prosjektet (ikkje filnamn, ikkje kva
mappe det ligg i akkurat no).

## Mappestruktur (oppdatert `OPPDRAGSMAPPER`)

```
1 Oppdragsleiing
2 Informasjonsflyt
3 Arbeidsdokument      (+ Arkiv-undermappe)
4 Resultatdokument     (+ Arkiv-undermappe)
5 Kontrolldokument     (+ Arkiv-undermappe)
6 Styrande dokument    (+ Arkiv-undermappe)
7 BIM
8 Diverse
9 Foreløpig
```

Definert i **to** stader som må haldast i sync: `electron/main.js` og
`ProsjektModule.jsx` (begge har sin eigen `OPPDRAGSMAPPER`-konstant — ikkje
del kode mellom prosess og renderar i Electron, difor duplikatet).

`resultatdokument:opprett-oppdragsmapper`-IPC-en (kalla når brukar låser ein
oppdragssti i Prosjekt-modulen) lagar no òg alle 9 mappene + `Arkiv` under
kvar av dei fire DTM-kategorimappene (3–6). `mkdirSync(..., {recursive:true})`
er trygt å køyre om att på eit alt-låst prosjekt — han rører aldri
eksisterande filer/mapper. **Planen er at DTM-modulen kallar denne IPC-en
på nytt kvar gong ho vert opna** (ikkje berre ved fyrste låsing), slik at
eksisterande låste prosjekt får dei nye mappene automatisk utan manuelt
steg — dette er enno IKKJE kopla opp (jf. oppgåveliste).

**Kjend, godteke avvik:** eitt prosjekt («Løpsmarka 29») er alt låst med
den GAMLE mappelista (berre «5 BIM», ikkje «7 BIM»). Den gamle «5 BIM»-mappa
vert IKKJE automatisk flytta/omdøypt til «7 BIM» — ho vil liggje att side om
side med den nye «5 Kontrolldokument». Brukar ryddar dette manuelt om
ønskjeleg.

## Dokumentnummer — korleis det vert fastsett

| Kategori | Kjelde |
|---|---|
| Arbeids-/Resultat-/Kontrolldokument (PDF) | Same som i dag: `parseFilnamn()` (filnamn) + `lesTittelfelt()` (PDF-tittelfelt-scan via pdfjs-dist) — sjå `claude/kvalitetsmodul-teikningar.md` |
| IFC-filer | Fyrste delen av filnamnet: `<fagbokstav>-<tosifra løpenr>` (t.d. `A-01` frå `A-01_NavnPaaModell.ifc`) |
| Styrande dokument | **Eige, uavhengig nummerserie**: `SD-<tresifra løpenummer>` (SD-001, SD-002 …), tildelt av appen — IKKJE henta frå fil/innhald |
| Alt anna der ingen av dei over gjev eit nummer | Fallback: `<fag>-D-<løpenummer>` (t.d. `A-D-01`) — `fag` er gjetta frå filnamnet der mogleg, elles `X` inntil brukar rettar det manuelt i gjennomgangs-matrisa |

Styrande dokument har alltid sitt eige, unike nummer (aldri delt med ei
teikning) — dei tek difor ALDRI del i status-samanlikninga under.

## Datamodell (Supabase)

**`dtm_dokumenter`** — éi rad per dokumentnummer (per prosjekt). Kan ha éin,
fleire, eller alle fire kategori-felta utfylte samstundes (same
dokumentnummer kan vere aktivt som arbeidsdokument OG resultatdokument OG
kontrolldokument på éin gong — det er heile poenget med registeret).

| Felt | Type | Merknad |
|---|---|---|
| `nr` | text | Dokumentnummer, sjå tabellen over. Unik per (user_id, project_id). |
| `tittel`, `fag`, `fase`, `malestokk`, `format` | text | Same felt/kjelde som i dag (KS-modulen) |
| `delprosjekt` | text | Nytt, reint manuelt/redigerbart felt — ikkje henta frå scan |
| `utarbeida_av` | text | Erstattar det gamle namnet «teikna_av» (same regex/kjelde) |
| `ek_person`, `fk_person` | text | Same som i dag |
| `lagra_av` | text | Brukaren (e-post) som gjorde importen — sett automatisk, ikkje redigerbar |
| `status` | text[] | Fleire samstundes gjeldande taggar, rekna ut (sjå under) — IKKJE fritt redigerbar |
| `arbeidsdokument`, `resultatdokument`, `kontrolldokument`, `styrande_dokument` | jsonb, kan vere null | `{ filnamn, revisjon, dato, lasta_opp }` — «dato» er datoen lese frå PDF-tittelfeltet (fell tilbake til `lasta_opp` om ikkje funne) |

**`dtm_versjonar`** — historikk/Arkiv per kategori (ei rad per arkivert
revisjon), FK til `dtm_dokumenter.id`. Felt: `kategori`
(`arbeidsdokument`\|`resultatdokument`\|`kontrolldokument`\|`styrande_dokument`),
`filnamn`, `revisjon`, `dato`, `lasta_opp`.

## `status`-kolonna — utrekningslogikk

**Formål:** fortelje brukar at dokumentet muligens er under endring, ved å
samanlikne datoen på kvart kategori-felt for SAME dokumentnummer.

For ei rad som viser kategori **K** (t.d. Resultatdokument), samanlikn `K`
sin dato mot dei to ANDRE kategoriane sine datoar (Arbeidsdokument,
Kontrolldokument — IKKJE Styrande dokument, som aldri tek del):

- Er `K` sin dato **seinare enn** (eller lik) begge dei andre → status =
  **«Siste versjon»**.
- Er Arbeidsdokument-datoen seinare → legg til taggen **«Nytt
  arbeidsdokument»**.
- Er Kontrolldokument-datoen seinare → legg til taggen **«Ny
  kontrollkopi»**.
- Er Resultatdokument-datoen seinare (når `K` sjølv er Arbeids- eller
  Kontrolldokument) → legg til taggen **«Nytt resultatdokument»**.

Fleire taggar kan stå samstundes (t.d. både «Nytt arbeidsdokument» og «Ny
kontrollkopi» på éin gong). Kategoriar som manglar (ikkje importert enno)
tek ikkje del i samanlikninga.

**Kva dato vert brukt?** Datoen lese frå PDF-tittelfeltet
(`meta.dato`/`lesTittelfelt()`), IKKJE opplastingstidspunktet — fell
tilbake til opplastingstidspunkt (`lasta_opp`) berre om tittelfeltet ikkje
hadde nokon dato. **Denne avgjerda er ei anteke tolking, ikkje eksplisitt
stadfesta av brukar** — rett opp om det er feil.

Den tidlegare skildra separate «kontrollstatus»-kolonna (med taggar
«Kontroll pågår»/«Kontroll ferdigstilt») er **slått saman inn i denne eine
`status`-kolonna** etter brukar sitt eige forslag om «vi klarer oss med ei
kolonne til» — dei gamle konkrete tagg-namna vert ikkje brukt, erstatta av
dato-samanlikningslogikken over.

## `Kategori`-kolonna

Syner kva for éi av dei fire kategori-mappene (utan talprefiks) den
KONKRETE fila som vert vist i rada, høyrer til — altså IKKJE eit felt på
sjølve `dtm_dokumenter`-rada, men avhenger av kva «sett» (fane) som er ope
og/eller kva for underrad (versjon) som vert vist. BIM og Diverse er
**ikkje** kategoriar i denne omgangen (ingen importknapp for dei enno).

## Kolonnar i matrisa (utgangspunkt, kan utvidast seinare)

`nr`, `tittel`, `Kategori`, `status`, `rev`, `fag`, `fase`, `delprosjekt`,
`malestokk`, `format`, `dato`, `utarbeida_av`, `ek_person`, `fk_person`,
`lagra_av`, `registrert`/`endra` (same mønster som NoteTabell). Same
DataTabell-mønster som resten av appen: kolonnedefinisjon + `hentVerdi`/
`lagCelle`, pluss støtte for prosjekt-spesifikke eigne kolonnar (som i
notat-/saks-tabellen).

## Fire importknappar (toppen av modulen)

| Knapp | Farge | Målmappe (ved bekrefta import) |
|---|---|---|
| Import arbeidsdokument | Blå, kvit tekst | `3 Arbeidsdokument` |
| Import resultatdokument | Svart, kvit tekst | `4 Resultatdokument` |
| Import dokumentkontroll | Oransje, kvit tekst | `5 Kontrolldokument` |
| Import styrande dokument | Lilla, kvit tekst | `6 Styrande dokument` |

Kvar knapp opnar eit **modal-vindauge inni appen** (same mønster som
`NoteModal`/`CaseDetailModal` — sentrert overlegg, header med tittel + X),
med ei dra-og-slepp-sone for filer frå Windows Utforskar.

### Importflyt (lik for alle fire, presisert per kategori under)

1. Brukar dreg éi eller fleire filer inn i modalen.
2. Appen skannar kvar fil (filnamn-tolking + PDF-tittelfelt-scan der
   aktuelt — sjå dokumentnummer-tabellen over) og viser resultatet i ei
   **redigerbar matrise** inni same modal (brukar kan rette felt, fjerne
   enkeltfiler, før stadfesting).
3. Brukar stadfestar («Bekreft import»). Då:
   - Fila vert flytta til rett kategorimappe, med filnamnet utvida med
     `_REV<revisjon>` (t.d. `_REVB`), eller — dersom ingen revisjon vart
     funnen i skanninga — `_REV<dato-tidsstempel>` i staden.
   - **Finst dokumentnummeret IKKJE frå før** i `dtm_dokumenter` → ny rad
     vert oppretta.
   - **Finst dokumentnummeret alt** → den aktuelle kategorien sitt
     jsonb-felt på EKSISTERANDE rad vert oppdatert. Var det alt ei fil i
     denne kategorien frå før, vert DEN gamle fila flytta til
     kategorien sin `Arkiv`-undermappe (med sitt eige `_REV…`-namn) og ei
     rad vert lagt til i `dtm_versjonar`.
   - `status` vert rekna ut på nytt for heile dokumentet (sjå over).

**Særtilfelle import dokumentkontroll:** når kontrolldokument vert
importert for eit dokumentnummer som alt finst som arbeids- og/eller
resultatdokument, påverkar IKKJE dette dei andre kategorienes eigne felt —
berre den felles `status` vert rekna på nytt (kan gje «Ny kontrollkopi» på
dei andre kategorienes rader).

**Særtilfelle import styrande dokument:** dokumentnummeret vert alltid
tildelt av appen (`SD-XXX`), aldri lese frå fil. Tek ikkje del i
status-samanlikninga.

## Visning: fire «sett» (faner) + ekspanderbare rader

Faner: **Arbeidsdokument | Resultatdokument | Kontrolldokument | Styrande
dokument**. Kvar fane filtrerer SAME matrise/register til dei radene som
har ei gjeldande fil i akkurat den kategorien (dvs. kategori-jsonb-feltet
er ikkje null) — syner då den kategorien sine felt (filnamn, rev, dato)
som «hovudrada».

**Eitt klikk på ei rad ekspanderer henne** og syner alle eldre revisjonar
av DENNE kategorien (frå `dtm_versjonar`/Arkiv-mappa) som under-rader.
Dette er ny generisk funksjonalitet som må byggjast i `DataTabell.jsx`
(finst ikkje i dag) — sjå oppgåveliste.

## Fase 2 — Electron-fil-bru: grensesnitt (`window.resultatdokumentAPI`)

Skanning og bekrefta import er MEDVITE to separate IPC-kall (i motsetnad
til `ks:skann-og-legg-til`, som gjer begge på éin gong) — ingen fil vert
flytta før brukar har fått rette/fjerne dokument i gjennomgangsmatrisa.

**`dtmSkannFiler(filPathar, kategori) → [{ kjeldeSti, filnamn, status,
nr, nrUsikker, rev, fag, tittel, malestokk, utarbeida_av, ek_person,
fk_person, dato, format }]`** — les, flyttar INGENTING.
- `nr`: dokumentnummer via `parseFilnamn()` (filnamn), med eit
  IFC-spesialtilfelle (`^[A-Za-zÆØÅæøå]{1,4}-\d{2}` frå starten av
  filnamnet). **Fag-D-løpenummer-fallnummeret og SD-løpenummeret er IKKJE
  implementerte i denne fasen** — dei krev tilgang til dei ALT eksisterande
  dokumenta i prosjektet sitt register for å finne neste ledige løpenummer,
  og `main.js` har ingen Supabase-tilgang (all DB-tilgang skjer i
  renderar-koden). Dette må gjerast i **Fase 3**, i sjølve DTM-modulen
  (same stad som `nextNoteNumber()`/`nextTaskNumber()` i `useStore.js` reknar
  ut sine løpenummer client-side).
- `nrUsikker: true` når `nr` berre er parseFilnamn() sin fallback (heile
  filnamnet, ser ikkje ut som ein ekte dokumentkode) — eit signal til Fase 3
  om at denne rada bør få eit generert Fag-D-nummer i staden, eller
  markerast tydeleg for brukar i gjennomgangsmatrisa.
- `rev`: berre sett dersom FAKTISK funnen (filnamn ELLER PDF-tittelfelt,
  `lesTittelfelt()` har no òg fått ei `revisjon`-utrekning som ikkje fanst i
  den opphavlege KS-porten) — tom streng elles, ALDRI ein fallback-verdi
  (ulikt `parseFilnamn()` sin `rev:'A'`-fallback, sidan DTM treng å skilje
  «ikkje funnen» frå «funnen, og er A»).
- `fag`: gjetta frå nr sitt fyrste ledd (`FAG_KODAR` i `main.js`).

**`dtmBekreftImport(oppdragsSti, kategori, dokument) → [{ ...dokument,
status, filnamn, rev }]`** — `dokument` er lista slik brukar har retta ho
(kan ha andre nr/rev enn skanninga fann). For kvar fil:
1. Filnamn vert sett til `<nr>_REV<rev>.<ext>` (kollisjon løyst med
   `(2)`, `(3)` …) — **MERK: bruker dokumentnummeret som stem, IKKJE det
   opphavlege filnamnet** — ei tolking av brukar sitt krav, ikkje eksplisitt
   stadfesta. Rett opp om original-filnamnet skulle vore halde på i staden.
2. Manglar `rev` (tom/ikkje sett) → eit dato-tidsstempel
   (`YYYYMMDD-HHmm`) vert brukt i staden.
3. Finst det alt ei fil i kategorimappa som startar med `<nr>_REV` (altså
   ei gjeldande fil for same dokumentnummer)? Han vert flytta til
   `Arkiv`-undermappa fyrst (kollisjon løyst likt).
4. Kjeldefila vert så flytta til kategorimappa med det nye namnet.

**`dtmListFiler(oppdragsSti, kategori) → { finst, filer, arkiverte }`**
og **`dtmApneFil(oppdragsSti, kategori, filnamn, arkivert)`** — same
mønster som `resultatdokumentAPI.listFiler`/`apneFil`, filtrert til éin
DTM-kategori og med eit `arkivert`-flagg for å opne frå Arkiv-undermappa.

Testa berre med `node --check` (syntaktisk) + full `npm run build` —
**IKKJE funksjonelt testa** i den ekte skrivebordsappen enno (krev
Electron + ekte filer, ikkje mogleg frå Browser-pane-verktøyet). Bør
røykprøvast i praksis så snart Fase 3-UI-et finst å teste gjennom.

## Fase 3 — DTM-modulen sjølv

**Nye filer:** `DTMModule.jsx` (hovudmodul — erstattar
`ResultatdokumentModule.jsx` i `AppRail.jsx`/`App.jsx`, men den gamle fila
ligg framleis urørt i `src/` som referanse, same konvensjon som
`NoteList.jsx` — sletta ikkje utan å spørje), `DTMTabell.jsx` (tynn
DataTabell-wrapper, same mønster som NoteTabell/SakerTabell),
`DTMImportModal.jsx` (sjølve import-flyten), `dtmKonstantar.js` (delte
konstantar/hjelparar: kategori-namn/-fargar/-mapper, `reknStatus()`,
`tolkDato()`, `genererDNummer()`/`genererSDNummer()`).

`AppRail.jsx` og `App.jsx` sin modul-nøkkel er endra frå `resultatdokument`
til `dtm` (fire stader i `App.jsx` + éin i `AppRail.jsx`), venstremeny-
bokstaven er no «DTM» (var «Rd»).

**Avgjerder/presiseringar teke i denne fasen** (les gjennom desse — dei er
IKKJE alle eksplisitt stadfesta av brukar):

- **`status` vert REKNA UT LEVANDE i visinga** (`reknStatus()` i
  `dtmKonstantar.js`), IKKJE lagra/oppdatert i databasen ved kvar import
  slik fyrste utkastet av spesifikasjonen la opp til. Grunngjeving: status
  er heilt utleia av dei tre kategori-datoane som alt ligg lagra — å i
  tillegg lagre eit statisk `status`-øyeblikksbilete ville krevd
  gjenutrekning for ALLE dokument som deler nummer kvar gong éin kategori
  vert importert, og kunne lett gå ut av synk. `status`-kolonna i
  `dtm_dokumenter` (frå `supabase-dtm.sql`) er difor **ubrukt** i denne
  fasen — kan fjernast seinare, eller takast i bruk til noko anna.
- **Fag-D-/SD-løpenummer** vert generert i `DTMImportModal.jsx` (rett
  etter skanning, før gjennomgangsmatrisa vert vist), ikkje i Electron-fil-
  brua (som planlagt i Fase 2-avsnittet over) — `genererDNummer()`/
  `genererSDNummer()` i `dtmKonstantar.js` tek omsyn til BÅDE dei alt
  lagra dokumenta OG dei som alt er tildelt tidlegare i same importrunde
  (elles ville fleire ukjende filer i éin og same drop fått same nummer).
- **Gjennomgangsmatrisa i importmodalen er EI VANLEG HTML-TABELL** med
  alltid-redigerbare tekstfelt (`<input>` per celle), IKKJE ein
  `DataTabell`-instans. Dette er ei medviten forenkling for eit
  kortvarig, «midlertidig utval»-steg — sortering/filter/kolonnestyring
  gjev inga meirverdi der, og alltid-synlege inputfelt er raskare å rette
  fleire felt i enn eit dobbeltklikk-per-celle-mønster.
- **Filnamnet ved import bruker dokumentnummeret som stem**
  (`<nr>_REV<rev>.<ext>`), ikkje det opphavlege filnamnet — sjå Fase 2-
  avsnittet, same atterhald der.
- **«Kategori»-kolonna** i `DTMTabell.jsx` er ikkje lagt til enno som eigen
  kolonne (kvart «sett» viser berre éin kategori om gongen, så verdien
  ville vore konstant per vising) — kan leggjast til om DTM seinare får
  ei samla, ufiltrert vising av alle kategoriar på éin gong.
- **Eigne kolonnar** («+ Ny kolonne…», `dtm_columns`/`dtm_dokumenter.ekstra`)
  er kopla opp med same mønster som Notat-/Saks-tabellen.
- **`delprosjekt`** er sett opp som `redigerbar:true` — rettast med
  dobbeltklikk direkte i matrisa (fritekst, ingen fast liste).

**IKKJE bygd i denne fasen** (attståande, sjå Fase 4 og oppgåveliste):

- Ekspanderbare rader (vising av eldre Arkiv-versjonar ved klikk) — Fase 4.
- «Kategori»-kolonne (sjå over).
- Funksjonell testing mot ekte filer i skrivebordsappen — berre
  `npm run build` + eit røyk-sjekk av at nettsida framleis lastar utan
  konsoll-feil er gjort. Krev Electron for å teste importflyten i praksis.

## Retta 24. sept. 2026 — tittelfelt-tolking fungerte ikkje i praksis

Fyrste røyktest i skrivebordsappen synte at INGENTING vart tolka frå eit
ekte Norconsult-tittelfelt (alle felt tomme i gjennomgangsmatrisa, bortsett
frå nr/fag som kjem frå filnamnet). Årsak: det Python-porta mønsteret
(«merkelapp: verdi» på ei og same linje) passar ikkje med korleis dette
tittelfeltet faktisk er bygd opp — merkelappen («Oppdragsgiver») og verdien
(«Gunvald Johansen Bygg AS») ligg på TO ULIKE linjer (merkelapp øvst, verdi
rett under, i same rute), ikkje kolon-skilt på éi linje. I tillegg gav
pdfjs-dist ofte kvart siffer/teikn som eit HEILT EIGE «item», og den gamle
koda limte ALLE item i ei linje saman med mellomrom mellom kvart einaste
eitt — det gjorde om t.d. «100» til «1 0 0», så \d+-regexen berre fanga
fyrste sifferet («1:1» i staden for «1:100», synleg i det feilslegne
skjermbiletet brukaren sende).

**Ny tolkingsstrategi** (`lesLinjerFraSide()`/`tolkStablaFelt()`/
`tolkRevisjonstabell()`/`tolkInlineMerkelappar()` i `main.js`):

1. Tekst vert no gruppert i BÅDE linjer OG celler (kolonnar) innanfor kvar
   linje, med tre avstandsnivå (nesten-null/vanleg ord/ny kolonne) — fiksar
   sifferfragmenteringa.
2. **Stabla merkelapp/verdi-par** (Oppdragsgiver, Tiltakshaver, Tegningsnavn
   → tittel, Målestokk, Oppdragsnummer, Tegningsnummer, Revisjon): finn
   merkelapp-cella, hentar verdien frå cella i NESTE linje som ligg nærast
   same x-posisjon (rett under, same rute).
3. **Revisjonstabellen** (Rev./Dato/Beskrivelse/…/Utarbeidet/Fagkontroll/
   Godkjent): finn header-rada, les kolonneindeksane frå henne, og skannar
   BÅDE OVER OG UNDER header-rada etter data-rader (verifisert mot eit ekte
   tittelfelt at data-rada med gjeldande revisjon ligg RETT OVER header-
   rada i denne malen — ikkje under, som elles ville vore det vanlege). Vel
   rada som samsvarar med revisjonen frå steg 2 (fell tilbake til siste
   rad).
4. Det gamle, kolon-baserte mønsteret køyrer framleis som eit siste steg,
   for tittelfelt-malar som skulle bruke den enklare stilen.

**Nye felt** (frå tittelfeltet, i tillegg til dei frå før): `oppdragsgivar`,
`tiltakshavar`, `oppdragsnr` (prosjektnummeret PÅ SJØLVE TEIKNINGA — kan i
prinsippet avvike frå appen sitt eige `projectNumber`, ikkje kryssjekka
enno), `godkjent_av` (frå «Godkjent»-kolonna i revisjonstabellen — eit anna
omgrep enn `ek_person`/egenkontroll, som denne malen ikkje har). Lagt til
som eigne kolonnar i `dtm_dokumenter` (sjå `supabase-dtm.sql`), redigerbare
felt i `DTMImportModal.jsx`, og skjulte-som-standard kolonnar i
`DTMTabell.jsx`. **Tegningsnummeret lese FRÅ SJØLVE PDF-en vert no
FØRETRUKKE over filnamn-gjettinga** når det ser ut som ein gyldig kode —
same tanke som i det opphavlege `pdf_vaktar.py`.

**Verifisert** med eit reint offline Node-testskript (handlaga «linjer»-
struktur etter skjermbiletet brukaren sende — ikkje ein ekte PDF) at
`tolkStablaFelt()`/`tolkRevisjonstabell()` koda riktig ut ALLE felt frå
eksempelet. **IKKJE verifisert**: at den rå pdfjs-item-til-celle-gruppe-
ringa (`TEIKN_GAP`/`ORD_GAP`-grensene i `lesLinjerFraSide()`) faktisk
produserer akkurat denne celle-strukturen på ekte PDF-koordinatar — dette
er den attverande uvissa. `lesTittelfelt()` loggar no den fulle linje/
celle-strukturen til konsollen (`[DTM] ... — lesne linjer:`) — send dette
hit om ei teikning framleis ikkje vert tolka rett, så kan grensene
justerast mot faktiske tal i staden for gjetting.

## Justeringar 24. sept. 2026 (etter fyrste test i skrivebordsappen)

- **Importknappane flytta**: låg fyrst til høgre i den grøne topbaren
  (lette å oversjå mot fargen) — ligg no i ei eiga, venstrestilt rad øvst
  i sjølve innhaldsområdet til modulen, over «sett»-fanene.
- **Nytt felt `revisjonsbeskriving`** — «Beskrivelse»-kolonna i
  revisjonstabellen (t.d. «Arbeidstegninger for bruk»), lagt til heile
  vegen (schema, skanning, gjennomgangsmatrise, tabellkolonne «Revisjons-
  skildring»).
- **`oppdragsgivar`/`tiltakshavar`** er no synlege som standard (var
  `standardSkjult` — brukar såg dei ikkje og bad om at dei vart lagt til,
  sjølv om dei alt fanst frå tittelfelt-fiksen tidlegare same dag).
- **«Format»-kolonna heiter no «Arkstørrelse»** i visinga (same
  underliggande felt/verdi, berre nytt namn — brukar sitt eige omgrep for
  A0–A4-papirstorleik) og er no synleg som standard.

## Retta 25. sept. 2026 — verifisert mot to ekte PDF-ar frå brukar

Brukar la over to ekte teikningar (`A-60-02 Dørskjema.pdf` og
`A-45-01-02 Fasader Øst og Vest.pdf`) og gav detaljert tilbakemelding på 14
punkt etter fyrste import-forsøk. Kunne lese sjølve PDF-teksten direkte
(Read-verktøyet) og stadfeste fleire konkrete rotårsaker:

1. **Importvindauget var for smalt** — no `90vw` (var `min(94vw, 1180px)`),
   og kolonnebreidda i gjennomgangsmatrisa er no rekna ut frå faktisk
   innhald (`ch`-einingar via ein `kolonneBreidd`-`useMemo` i
   `DTMImportModal.jsx`) i staden for faste pikselbreidder.
2. **Ny kolonne «Filtype»** — utleia frå filendinga, lagt til både i
   gjennomgangsmatrisa og som (skjult som standard) kolonne i
   `DTMTabell.jsx`.
3. **Tegningsnummer feil lese** — stadfesta rotårsak: `parseFilnamn()`
   sin fallback (heile filnamnet, t.d. «A-60-02 Dørskjema», sidan filnamnet
   ikkje hadde noko revisjonssuffiks) vart ikkje alltid overstyrt av
   PDF-innhaldet, sidan `tolkStablaFelt()` sitt merkelapp/verdi-oppslag
   berre såg på DEN NESTE linja. Retta: søkjer no i eit VINDAUGE på inntil
   tre linjer under merkelappen (ikkje berre éi), og finn næraste x-
   posisjon blant dei.
4. Revisjonsnummer var korrekt — inga endring nødvendig.
5. og 12. **Revisjonsskildring/Utarbeida/Godkjent frå feil kolonne** —
   stadfesta rotårsak: kolonnane i revisjonstabellen vart slått opp med
   ORDINAL CELLE-INDEKS (kolonne nr. 3, nr. 4 …), som forskyv seg dersom
   éi celle i akkurat DENNE rada tilfeldigvis slo seg saman eller delte
   seg annleis enn i header-rada. Retta: `tolkRevisjonstabell()` slår no
   opp kvar kolonne ved X-POSISJON (næraste celle til DER header-cella
   står), ikkje ved indeks — robust mot at data- og header-rada har ulikt
   celletal.
6. **Fag skal vise fullt namn, ikkje kodebokstaven** — `gjettFag()`
   returnerer no «Arkitekt» (osb., sjå `FAG_NAMN` i `main.js`) i staden
   for berre «A».
7. Tittel var korrekt — inga endring.
8. **Oppdragsgivar inkonsekvent mellom dei to filene** — sannsynleg same
   rotårsak som punkt 3/5 (linjevindauge/kolonne-oppslag), bør vere retta
   av same fiksar — IKKJE særskilt stadfesta mot akkurat denne fila enno.
9. **Tiltakshavar ikkje lese** — same rotårsak/fiks som punkt 3.
10. **Målestokk ikkje lese (dørskjema)** — verifisert mot den faktiske
    PDF-teksten at dette IKKJE er ein kode-feil: eit dørskjema er eit
    tabelldokument utan reell teikningsmålestokk, og feltet er rett og
    slett tomt på denne sida. Fasadeteikninga (som HAR ein målestokk,
    «1:100») bør lesast korrekt av same logikk.
11. Arkstørrelse var korrekt — inga endring.
13. **Oppdragsnummer inneheldt både oppdragsnummer og tegningsnummer**
    — stadfesta rotårsak: cella-grensa i `lesLinjerFraSide()`
    (`ORD_GAP`) var for STOR for denne tronge talkolonnen, så
    «52406865» og «A-60-02» vart lima saman til éi celle. To tiltak:
    (a) cella-grensene er no RELATIVE til gjennomsnittleg teiknbreidd i
    staden for ein fast punktverdi (skalerer med skriftstorleiken ulike
    stader på sida), og (b) eit forsvar i `tolkStablaFelt()` splittar
    automatisk eit oppdragsnummer-felt som framleis inneheld eit
    tegningsnummer-mønster på slutten.

**Verifisert** med eit utvida offline Node-testskript (framleis handlaga
«linjer»/«celler»-strukturar, ikkje ekte PDF-koordinatar) at både det
opphavlege scenarioet OG splitt-forsvaret for punkt 13 fungerer som
tiltenkt. **IKKJE verifisert**: at dei nye, RELATIVE cella-grensene i
`lesLinjerFraSide()` faktisk gjev rette celleskilje på ekte PDF-
koordinatar frå desse to filene — dette krev testing inne i
skrivebordsappen (kan ikkje køyrast herifrå, sidan pdfjs-dist/Electron
ikkje er tilgjengeleg i dette miljøet). Send `[DTM] ... — lesne
linjer:`-loggen frå konsollen om noko framleis er feil, så kan grensene
justerast mot faktiske tal.

## Retta 25. sept. 2026 (runde 2) — framleis feil på fleire felt

Etter runde 1-fiksane var enkelte felt framleis feil/tomme (revisjons-
skildring, oppdragsgivar inkonsekvent, tiltakshavar, oppdragsnummer).
Tre djupare rotårsaker vart identifiserte og retta:

1. **Heile sida vart lese, ikkje berre tittelfeltet.** `lesLinjerFraSide()`
   prosesserte ALLE tekstelement på arket — på ei full arbeidsteikning
   (mål, romnamn, tegnforklaring osv.) fleire hundre stykk — som la støy
   inn i linje/celle-oppdelinga akkurat i det området det monar mest.
   Retta: **avgrensar no til nedre høgre hjørne** av arket (same
   konvensjon som det opphavlege `pdf_vaktar.py` brukte — sjå
   `claude/prosjektplan-tegningskontroll.md`), med automatisk fallback
   til heile sida om avgrensinga gav for lite tekst att (uvanleg
   sideoppsett).
2. **«Næraste EINE celle» var for skjørt for fleirords-verdiar.** Eit
   firmanamn som «Gunvald Johansen Bygg AS» kan hamne som fleire separate
   celler (om interne ordmellomrom vart tolka som cellegrenser), og då
   fanga det gamle «vel den næraste eine cella»-oppslaget berre eitt ord,
   eller bomma heilt. Retta: **`tolkStablaFelt()` reknar no ut eit
   KOLONNE-OMRÅDE** (avgrensa av neste merkelapp på same rad, t.d.
   Oppdragsgiver vs. Målestokk som deler ei rad) og **set saman ALLE
   celler** innanfor det området, i staden for å plukke éi.
3. **Same prinsipp gjeld revisjonstabellen** — `tolkRevisjonstabell()`
   brukar no òg kolonne-område (via `REVISJONSKOL`) i staden for
   «næraste eine celle», som fiksar revisjonsskildringa av same grunn.

**Andre justeringar:**
- «Nr.»-kolonna heiter no **«Dokumentnummer»**.
- **EK-kolonna er fjerna** (både i registeret og gjennomgangsmatrisa) —
  `ek_person`-feltet i databasen/skanninga ligg urørt, berre ikkje vist.

**Verifisert** med tre offline Node-testskript (framleis handlaga
«linjer/celler»-strukturar, ikkje ekte PDF-koordinatar): kolonne-område-
logikken set korrekt saman fragmenterte fleirords-verdiar, skil rett
mellom to merkelappar på same rad (Oppdragsgiver/Målestokk), og
revisjonstabellen si nye kolonne-område-lesing gjev same resultat som før
for det enkle tilfellet, men handterer no ei splitta Beskrivelse-verdi
riktig. **IKKJE verifisert**: at avgrensinga til nedre høgre hjørne
(`grenseX`/`grenseY` i `lesLinjerFraSide()`, sett til 60 %/32 % av
sidebreidd/-høgd) faktisk fangar heile Norconsult-tittelfeltet på ekte
PDF-ar, eller at cella-fragmenteringa i praksis oppfører seg som testane
antek. Send `[DTM] ... — lesne linjer:`-loggen på nytt om noko framleis
er feil.

## Retta 25. sept. 2026 (runde 3) — VERIFISERT KORREKT mot dei to ekte PDF-ane

Runde 2 gjorde det VERRE på nokre felt («resultatet no vart dårlegare enn
i stad»). I staden for å halde fram med gjetting, køyrde eg denne gongen
DEN FAKTISKE parsing-koda frå `main.js` (kopiert til eit mellombels
Node-skript, sletta etter bruk) direkte mot dei to ekte PDF-ane —
`pdfjs-dist` køyrer i vanleg Node utan Electron, så dette gav EKTE
koordinatdata i staden for gjetting. Fann to konkrete, stadfesta feil:

1. **Rotert tekst vart handsama som vassrett.** Den loddrette
   «Arbeidstegning»-labelen (langs venstre kant av tittelfeltet) har ei
   transform-matrise med rotasjonskomponentar — brukt som om ho var vanleg
   vassrett tekst, limte ho seg inn i HEILT ANDRE celler (øydela
   Oppdragsnummer/Tegningsnummer/Revisjon-rada fullstendig: vart til
   `ArbeidstegningARKITEKTUR - BODØ 52406865 A-60-02`). Retta: filtrerer
   no vekk alle tekst-item med ikkje-neglisjerbar rotasjon
   (`transform[1]`/`[2]`) FØR linje/celle-oppdelinga.
2. **Revisjonstabellen sin «siste rad»-fallback var feil veg.** Når
   revisjonen ikkje alt var kjend, fall koden tilbake til `rader[siste
   element]` — men etter ein intern `.reverse()` var «siste element» den
   ELDSTE revisjonen (H01), ikkje den gjeldande (H02). Dette gav feil
   fagkontroll-person, dato og revisjonsskildring. Retta: fell no tilbake
   til rada med NYASTE DATO (strengsamanlikning på `YYYY-MM-DD`-format),
   ikkje ein antatt listeposisjon.
3. **To mindre presiseringar**: (a) `tolkStablaFelt()` sitt vindauge-søk
   kravde no i tillegg at verdien startar NÆRT merkelappen sin eigen
   x-posisjon (< 100 pt) — utan dette kunne eit fritståande felt (ingen
   nabo-merkelapp, difor inga øvre grense) ved eit uhell fange ein
   urelatert verdi lenger nede på sida (stadfesta: «Tiltakshaver» fanga
   arkstørrelse-boksen sin «A1» i staden for firmanamnet). (b) Målestokk
   godtek no berre verdiar som faktisk ser ut som ein målestokk (`N:M`) —
   elles ståande tom, som er korrekt for dokument utan reell teiknings-
   målestokk (t.d. eit dørskjema).

**Verifisert direkte** (ikkje syntetiske testar denne gongen) — begge
filene gav no 100 % korrekt resultat for ALLE felt: tittel, målestokk
(tom for dørskjema, «1:100» for fasaden), utarbeida av, fagkontroll,
godkjent, dato, arkstørrelse, revisjon, oppdragsgivar, tiltakshavar,
oppdragsnummer, tegningsnummer og revisjonsskildring.

## Utvida 25. sept. 2026 (runde 4) — brukskvalitet + fleire felt/kolonnar

Etter at tittelfelt-tolkinga endeleg var verifisert korrekt, kom ei ny
runde forbetringar basert på faktisk bruk:

1. **Nytt felt `tegningsformal`** («Arbeidstegning»/«Søknadstegning»/
   «Tilbodstegning» osv.) — henta frå den loddrette teksten til venstre
   for sjølve tittelfeltet. Denne teksten er ROTERT (transform-matrisa har
   b/c-komponentar ≠ 0), og vart tidlegare filtrert vekk saman med anna
   rotert tekst (jf. runde 3-fiksen for «Arbeidstegning»-bugen). No vert
   rotert tekst INNANFOR same tittelfelt-avgrensing fanga opp særskilt
   (`lesLinjerFraSide()` returnerer no `{ linjer, tegningsformal }`), medan
   rotert tekst ANDRE stader på arket (mål-tal på snitt/fasadar) framleis
   vert ignorert sidan dei fell utanfor avgrensinga. Verifisert direkte mot
   begge dei ekte PDF-ane (gav «Arbeidstegning» på begge).
2. **Fire importknappar → éin nedtrekksmeny.** «+ Import» (blå knapp) øvst
   til venstre i modulen; klikk opnar ei liste med dei fire kategoriane
   (kvar med sin eigen fargeprikk). Reduserer plassbruk monaleg.
3. **Nytt «sett»: «Alle dokumenter»**, heilt til venstre for kategori-
   fanene. Viser ALLE dokument uavhengig av kategori. `løysAktivtSett()`/
   `finnGjeldandeKategori()` (`dtmKonstantar.js`) vel, for kvar rad, kva
   for kategori (av dei som er utfylte) med NYAST opplastingstidspunkt som
   «den gjeldande» — det er DEN sitt filnamn/rev/dato/status som vert vist,
   og DEN sin kategori som vert vist i den nye Kategori-kolonna.
4. **Fleirval (shift/ctrl-klikk) lagt til** i DTM-matrisa, same generiske
   `merking`-prop som notat-tabellen — naudsynt for punkt 7.
5. **Ny generisk `DataTabell`-funksjon: `radMeny.ekstraVal`** — ei liste
   med eigendefinerte trestreksmeny-val (`{ ikon, namn, onKlikk(id, rad) }`),
   i tillegg til dei faste (favoritt/fest/arkiver/slett notat-tabellen
   brukar). DTM sin radmeny har berre eitt val: **«Del fil»** — kopierer
   filstien(ane) til utklippstavla OG opnar systemet sitt standard e-post-
   program med stien(ane) lima inn i meldingsteksten (`dtm:del-fil`-IPC,
   `shell.openExternal('mailto:...')` + `clipboard.writeText()`). Er fleire
   rader markerte (via fleirvalet) når menyen vert opna på éi av dei, vert
   ALLE dei markerte filene delte i same e-post.
6. **Ny generisk `DataTabell`-funksjon: `innhaldstilpassaBreidd`-prop** —
   standard kolonnebreidd tek då omsyn til dei FAKTISKE verdiane i
   kolonnen (målt med same skjulte-canvas-teknikk som før, no i cella sin
   eigen skrift/storleik), ikkje berre overskrifta. Kolonnebreidd cappa på
   420px (`MAKS_INNHALDS_BREIDD`) så éin uvanleg lang verdi ikkje blæs opp
   heile tabellen — brukar kan alltids dra breiare sjølv. Berre slått på
   for DTM-matrisa (notat-/saks-tabellen er urørt, framleis header-basert).
7. **Alle kolonnar synlege som standard** i DTM-matrisa (fjerna
   `standardSkjult` frå kvar einaste kolonne).
8. **Nye kolonnar**: `Kategori` (jf. punkt 3), `Filsti` (utleia av
   `oppdragsSti` + kategori-mappe + filnamn, ikkje lagra i databasen),
   `Status ved ferdigstilling` (fast verdiliste: Moglegheitsstudie,
   Skisseprosjekt, Forprosjekt, Tilbodsunderlag, Arbeidsteikning, Som
   bygd — `FERDIGSTILLING_STATUS` i `dtmKonstantar.js`, redigerbar med
   dobbeltklikk), `Tegningsformål` (jf. punkt 1).
9. **Fiksa ein fag-kode-regresjon** frå runde 3: `gjettFag()` returnerer
   det FULLE fagnamnet («Arkitekt»), men Fag-D-<løpenr>-fallback-nummeret
   (`genererDNummer()`) treng den KORTE koden («A») som prefiks — elles
   vart det t.d. «ARKITEKT-D-01» i staden for «A-D-01». Lagt til ein eigen
   `gjettFagKode()` i `main.js`, som skanninga no returnerer som eit eige
   `fagKode`-felt attåt det fulle namnet i `fag`.

## Utvida 25. sept. 2026 (runde 5) — filhandtering, favoritt/fest, eigne nedtrekkskolonnar

1. **Import feilar ikkje lenger berre fordi kjeldefila er open andre stader.**
   `flyttFil()` prøvde før `rename` → fall attende til kopi+slett — men
   sjølve SLETTINGA av kjelda etter kopiering kasta eit ufanga unntak
   dersom kjelda var open i eit anna program (t.d. ein PDF-lesar), sjølv
   om SJØLVE KOPIERINGA (det som faktisk tel for importen) lukkast fint.
   Denne feilen stoppa heile importen av den fila unødig. Retta: mislukka
   sletting av kjelda vert no berre logga som ei åtvaring — importen tel
   som vellukka så lenge kopieringa til DTM-mappa gjekk bra (originalen
   ligg då urørt att der ho var). Genuint LÅSTE filer (der sjølve LESINGA
   feilar) gjev no ei forståeleg feilmelding («Fila er open i eit anna
   program…») i staden for eit rått Node-feilnamn, og
   `DTMImportModal.jsx` har fått ein **«Prøv igjen»**-knapp på
   ferdig-skjermen som berre gjer om att DEI FEILA dokumenta (dei som alt
   lukkast vert ikkje rørte).
2. **Filsti-kolonna er ikkje lenger avkutta.** Ny kolonnedefinisjon-
   eigenskap `maksInnhaldsBreidd` i `DataTabell.jsx` — DTM sin Filsti-
   kolonne set denne til `Infinity`, som overstyrer den vanlege
   420px-grensa for innhaldstilpassa breidd.
3. **Filnamnet vert IKKJE lenger endra ved import.** Rota om
   `dtm:bekreft-import` fullstendig: den NYE, gjeldande fila held sitt
   opphavlege filnamn uendra. Berre den GAMLE fila (som vert fortrengt,
   funnen via `gammalFilnamn`/`gammalRevisjon` — no sendt frå
   `DTMModule.jsx` sin `importer()`, henta frå Supabase-raden, IKKJE frå
   eit filnamn-mønster sidan filnamnet ikkje lenger ber dokumentnummeret)
   får eit `_REV<revisjon eller dato-tidsstempel>`-tillegg, i det ho vert
   arkivert. Sidan kollisjonsdeteksjon («finst det alt ei fil for dette
   dokumentnummeret?») no skjer via Supabase-raden i staden for filnamn-
   mønster på disk, er dette ei føresetnad brukar må vere merksam på:
   `dtm_dokumenter`-raden ER sanninga om kva som er «den gjeldande fila»
   for eit dokumentnummer, ikkje filnamnet på disk.
4. **Favoritt/fest-til-topp i radmenyen** — same generiske mønster som
   notat-tabellen (nye kolonnar `favorite`/`pinned` på `dtm_dokumenter`).
5. **Eigne kolonnar kan no avgrensast til ei fast nedtrekksliste.** Nytt
   avkryssingsval i «Ny kolonne»-skjemaet (delt kode, `DataTabell.jsx`) —
   brukar skriv éin verdi per linje. Kravde ei generell utviding: DataTabell
   sin «eigen kolonne»-redigering brukte FØR alltid eit reint tekstfelt,
   uavhengig av om kolonnen hadde ei verdiliste — no vert ein `<select>`
   vist når kolonnen har `val`. Persistert i ny `dtm_columns.val_liste`
   (jsonb) — berre kopla opp for DTM så langt, ikkje Saker/Notat.
6. **«+ Kolonnar»-menyen** viser no opptil 70 % av skjermhøgda (var fast
   210px) — dekker normalt alle vala utan intern rulling.
7. **«Lagra av» viser no eit gjetta NAMN, ikkje e-postadressa.** Appen har
   ikkje noko eige lagra visingsnamn for brukaren — `namnFraEpost()`
   (`dtmKonstantar.js`) gjettar eit namn frå den lokale delen av e-posten
   (fornamn.etternamn@… → «Fornamn Etternamn»). Dette er ei GJETTING, ikkje
   eit verifisert namn — fungerer bra for vanleg firma-e-postkonvensjon,
   dårlegare for t.d. reine gmail-adresser utan punktum.

## Ny funksjon 25. sept. 2026 — registrering av utsendingar

Brukar ønska ein måte å dokumentere at dokument/tegningar faktisk er sendt
ut (t.d. på e-post), for ettertida. Vi vurderte fleire alternativ (eige
Outlook-tillegg, automatisk generert prosjekt-e-postadresse for kopi,
drege-inn .msg-fil som eiga hovudløysing) — landa på å byggje vidare på
den ALT EKSISTERANDE «Del fil»-funksjonen, sidan ho krev null ny
infrastruktur og appen alt veit kva dokument som er involverte. Sjå
avsnittet om Outlook-integrasjon i chat-historikken for den fulle
avveginga mot dei andre alternativa (automatisk generert prosjekt-e-post,
Outlook-tillegg/Graph API) — dei vart vurdert for tunge/avhengige av
IT-rettar brukar ikkje har.

**Datamodell** (`supabase-dtm-utsendingar.sql`): `dtm_utsendingar` (éi rad
per utsending — mottakar, kanal, kommentar, status kladd/sendt, dato,
oppretta_av, bekrefta_av/-tid, kvittering_fil) + `dtm_utsending_dokument`
(join-tabell, snapshottar nr/kategori/filnamn/revisjon PÅ UTSENDINGS-
TIDSPUNKTET — ei seinare ny revisjon skal ikkje skrive om historia).

**Flyt:**
1. **«Registrer utsending»** i radmenyen (☰, saman med «Del fil») —
   respekterer fleirval same måte som «Del fil» (fleire markerte rader →
   alle med i same utsending). Opprettar ein KLADD i Supabase MED DET
   SAME (`DTMModule.jsx` sin `registrerUtsending()`) — ingenting går tapt
   om vindauget vert lukka.
2. **`DTMUtsendingModal.jsx`** — mottakar/kanal/dato/kommentar, liste over
   inkluderte dokument (kan fjernast), eit SØK for å leggje til FLEIRE
   dokument frå heile prosjektregisteret (ikkje avgrensa til det
   opphavlege utvalet) — dette er robustheits-kravet: brukar kan opne
   e-postprogrammet, gå vidare, kome attende og halde fram å leggje til.
   «Opne e-post» kallar den ALT EKSISTERANDE `dtmDelFil`-IPC-en (attgjenbruk,
   ingen ny mekanisme).
3. **Dokumentasjon på faktisk sending — to nivå:**
   - **Sjølvmelding**: «Stadfest sending»-knapp, set status til sendt.
   - **Ekte kvittering**: dra den FAKTISK SENDTE e-posten (Outlook kan dra
     ein e-post ut som .msg-fil) inn i modalen. Lagra i
     `<oppdragsSti>\2 Informasjonsflyt\Utsendingar\` (nye IPC-endepunkt
     `dtm:lagre-kvittering`/`dtm:apne-kvittering`, kopierer — flyttar
     ikkje — kjelda). Set status til sendt automatisk, sidan ei kvittering
     FRÅ e-postprogrammet er sterkare dokumentasjon enn ei eigenmelding.
   - **IKKJE verifisert**: om å DRA EIN E-POST DIREKTE FRÅ OUTLOOK inn i
     Electron-appen sin nettlesarbaserte droppsone faktisk fungerer —
     Outlook brukar eit «virtuelt fil»-dragformat (FileGroupDescriptor)
     som ikkje alle nettlesarbaserte droppsoner støttar, i motsetnad til
     Windows Utforskar. Reserveløysinga (dra e-posten til skrivebordet
     fyrst, som lagar ei ekte .msg-fil, dra SÅ den inn) er nemnd i
     brukargrensesnittet, men ingen av delane er testa i praksis enno.
4. **`DTMUtsendingarListe.jsx`** — oversikt (nådd via ein ny
   «Utsendingar»-knapp attmed «+ Import»), viser kladdar (kan attopnast
   eller slettast) og sendt-historikk.

**IKKJE bygd:** automatisk tolking av .msg-innhald (mottakar/dato/emne) —
fila vert berre lagra som eit ugjennomsiktig vedlegg, ikkje parsa. Kunne
leggjast til seinare med eit msg-parsingsbibliotek om ønskt.

## Vidareutvikling 25. sept. 2026 — ekte vedlegg, fleire kanalar, utsendingsnr

Sju justeringar av utsendingsfunksjonen over, alle bygd same dag:

1. **Fleire kanalar samstundes.** `dtm_utsendingar.kanal` migrert frå
   `TEXT` til `TEXT[]` (migrasjon `dtm_utsendingar_v2`,
   `supabase-dtm-utsendingar.sql`). `UTSENDING_KANALAR`
   (`dtmKonstantar.js`: e-post/webhotell/anna) + ei avkryssingsgruppe i
   `DTMUtsendingModal.jsx` (i staden for éin `<select>`).
2. **Ekte vedlegg i e-posten.** Ny IPC `dtm:opne-epost-med-vedlegg`
   (`main.js`) automatiserer skrivebords-Outlook via COM
   (`New-Object -ComObject Outlook.Application`, køyrd som eit
   PowerShell-skript via `execFile`, parametrar sendt som ei mellombels
   JSON-fil for å sleppe escaping av norske teikn). Legg filene ved med
   `$mail.Attachments.Add()`, kallar `.Save()` + `.Display()` — ALDRI
   `.Send()`, brukar må sjølv trykke send. **Fell automatisk tilbake**
   til den kjende mailto-metoden (stiar i teksten + utklippstavle) om
   COM-automatiseringa feilar av nokon grunn (Outlook ikkje installert,
   «nye Outlook»/Mac/Web, eller tryggleiksprogramvare som blokkerer
   Object Model-tilgang) — **denne fallback-vegen er verifisert på
   kodenivå, men OM sjølve Outlook-COM-vegen faktisk fungerer i
   Norconsult sitt IT-oppsett er IKKJE testa** (kan ikkje testast frå
   dette miljøet). `DTMModule.jsx` sin `apneEpostForUtsending()` byggjer
   no e-postteksten sjølv (dokumentliste + utsendingsnummer nedst) og
   kallar denne IPC-en i staden for den gamle `dtmDelFil`.
3. **Emnefelt.** Nytt `emne`-tekstfelt i modalen, lagra som
   `dtm_utsendingar.emne` (ny kolonne). Fell tilbake til
   «Oversending av dokument U-xxx» som standard emne om brukar ikkje
   skriv noko.
4. **Dokumentveljar i staden for søk.** Det gamle live-søket med ein
   flytande nedtrekksliste fungerte ikkje pålitileg for brukar. Bytt ut
   med ein eksplisitt «+ Legg til dokument…»-knapp som opnar eit fast
   panel: eit filtreringsfelt + ei avkryssingsliste over HEILE
   prosjektregisteret (minus dei alt inkluderte), med ein eigen
   «Legg til valde (n)»-knapp. Ingen automatisk lukking/blur-logikk å
   få gale.
5. **Unikt utsendingsnummer.** `nesteUtsendingsnummer()`/
   `utsendingsnrTekst()` (`dtmKonstantar.js`) — same mønster som
   `nextNoteNumber()`/`nextCaseNumber()` (høgste eksisterande + 1,
   klientutrekna, ny kolonne `dtm_utsendingar.utsendingsnr`). Format
   `U-001`, `U-002`, … Vist i modalheadinga, i utsendingslista, OG lima
   inn heilt nedst i sjølve e-postteksten — slik at ein seinare (t.d. ved
   å lese ei motteken kvittering eller eit svar) kan sjå kva utsending
   ein konkret e-post høyrer til.
6. **Kvittering: fil-veljar attåt drag-og-slepp.** Brukar melde at
   drag-og-slepp ikkje fungerte. Ny IPC `dtm:velg-kvitteringsfil`
   (native `dialog.showOpenDialog`, filtypar .msg/.eml/.pdf/.txt) gjev ein
   pålitileg «Vel fil…»-knapp attåt (ikkje i staden for — kan framleis
   fungere for nokre) droppsona. **Framleis ikkje verifisert** om sjølve
   Outlook-til-nettlesar-drag-og-slepp-steget fungerer i praksis; fil-
   veljaren er den nye, pålitelege hovudvegen.
7. **Ny «Utsendingar»-kolonne** i DTM-tabellen (`DTMTabell.jsx`) —
   viser kvart dokument sine STADFESTA sende utsendingar (kladdar tel
   ikkje) som grøne piller `U-xxx · dato`. `DTMModule.jsx` reknar ut
   `utsendingarPerDokument` (gruppert på `dokument_id`) med `useMemo` og
   sender det ned som ny prop.

**Framleis IKKJE verifisert i praksis** (kan ikkje testast frå dette
miljøet, sjå òg punkt 2/6 over): om Outlook-COM-automatiseringa faktisk
fungerer i Norconsult sitt konkrete IT-oppsett (tryggleikspopup, COM-
registrering), og om drag-og-slepp frå Outlook nokon gong fungerer i
denne Electron/Chromium-konteksten. Fil-veljaren (punkt 6) og mailto-
fallback (punkt 2) er difor med vilje bygd som dei PÅLITELEGE vegane,
ikkje berre som reserveløysingar.

## Vidareutvikling 25. sept. 2026 (2) — rutenettvisning i matrisa

Tre justeringar av sjølve DTM-tabellen same dag:

1. **Tittel-kolonna opnar no fila** akkurat som Dokumentnummer (fekk
   `opnaFil:true`, same handkurør ved hovring) — brukar peika på at dette
   burde vere likt.
2. **Rutenettvisning / grid-redigering**: bygd generisk i `DataTabell.jsx`
   bak ein ny, opt-in `rutenettRedigering`-prop (sjå
   `claude/saksmodul-tabell.md` for den fulle spesifikasjonen — Angre,
   fleire-celler-val, dra-og-fyll, `beregna`-kolonneflagget osb.). DTM er
   den einaste tabellen som slår han på (`DTMTabell.jsx`). Kolonnane
   Kategori/Status/Filtype/Rev./Dato/Lasta opp/Utsendingar/Filsti/Lagra av
   er UTREKNA (nøsta i kategori-JSON-en eller reint avleia) og difor merkt
   `beregna:true` — dei kan ALDRI redigerast generisk, uansett modus. Alle
   andre kolonnar (Fag, Oppdragsgivar, Tiltakshavar, Fase, Målestokk,
   Format, osb.) kan no redigerast direkte i tabellen når modus er på, i
   tillegg til dei som alt var det (Delprosjekt, Status ved ferdigstilling).
3. **Redigeringsmodus-knapp + Angre** i verktøylinja, like til venstre for
   «Fargekode».

## Vidareutvikling 25. sept. 2026 (3) — eitt klikk, fleire-celler-val, nye kolonnar

Brukarfeedback etter (2): eitt klikk skal vere nok til å redigere når modus
er PÅ (dobbeltklikk sin einaste jobb no er å SLÅ PÅ modus, som ein snarveg,
frå av-tilstanden); i tillegg skal ein kunne VELJE FLEIRE CELLER (klikk-og-
dra i éin kolonne) og dra det valde området vidare opp/ned for å gjenta
mønsteret av verdiar (ikkje berre kopiere éin einskild verdi) — sjå
`claude/saksmodul-tabell.md` for den fulle interaksjonsspesifikasjonen.

Samstundes, tre nye kolonnar i DTM-matrisa (`DTMTabell.jsx`):
- **Ferdigstillelse** — prosent ferdig (0–100), fritt tal sett av brukar.
  EIGEN, uavhengig av «Status ved ferdigstilling» (som er eit fast steg-namn,
  ikkje ein prosent). Ny kolonne `dtm_dokumenter.ferdigstillelse INTEGER`.
- **Timebudsjett** — timebudsjett for DETTE dokumentet. Ny kolonne
  `dtm_dokumenter.timebudsjett NUMERIC`.
- **Gjenståande timer** — `timebudsjett * (1 - ferdigstillelse/100)`,
  RIEN UTREKNA i UI-en (`beregna:true`, IKKJE lagra i databasen — endrar
  seg automatisk når anten Ferdigstillelse eller Timebudsjett vert endra).

Migrasjon `dtm_ferdigstillelse_timebudsjett` (Supabase MCP) +
`supabase-dtm.sql` oppdatert. Merk: sidan desse to ER ekte NUMERIC/INTEGER-
kolonnar (til skilnad frå tekstfelta som brukar `''` som tomt-verdi), måtte
`DTMModule.jsx` sin generiske `settVerdi()` få eit unntak som lagrar `null`
i staden for `''` for akkurat desse to feltnamna når brukar tømmer cella —
elles ville Postgres avvist ein tom streng mot ein talkolonne.

**Totalrad**: DTM-matrisa (som no har fleire talkolonnar) er ein naturleg
brukar av den nye, generelle Totalrad-funksjonen i `DataTabell.jsx` (sjå
`claude/saksmodul-tabell.md`) — ingen eigen DTM-kode kravd, kjem gratis med
Ferdigstillelse/Timebudsjett/Gjenståande timer-kolonnane.

**IKKJE verifisert i praksis** (krev innlogging, kunne ikkje testast frå
dette miljøet): sjølve klikk-og-dra-interaksjonane (mouse-drag +
`elementFromPoint`, både for fleire-celler-val og for sjølve dra-og-fyll-
handtaket) og at Angre faktisk gjenopprettar rett verdi i Supabase for alle
kolonnetypar. Bygget går gjennom utan feil, og logikken er gjennomgått
nøye, men bør prøvast i skrivebordsappen før ein stolar heilt på han i
produksjon.

## Vidareutvikling 26. sept. 2026 — brukartesting av rutenettvisninga, runde 2

Brukar testa (2)/(3) i skrivebordsappen og meldte fire ting attende. Sjå
`claude/saksmodul-tabell.md` for den fulle, oppdaterte spesifikasjonen av
sjølve interaksjonsmodellen (denne seksjonen listar berre KVA som endra
seg og kvifor):

1. **For liten kontrast** på rad-/celle-utheving — retta generisk i
   `DataTabell.jsx` (sterkare kant + bakgrunn for celle-val enn for rad-val).
2. **Redigeringsmodus-knappen vart fjerna heilt.** Brukar meinte det vart
   enklare utan han — rutenettRedigering er no ALLTID «på» når propen er
   sett, styrt reint av kolonneflagg. I staden kom ein eksplisitt
   TRE-STEGS klikk-modell: klikk→rad, dobbeltklikk→cella, tredje
   klikk→skriv (i staden for at eitt klikk gjekk RETT til skrivemodus, som
   i (3) — det viste seg for lett å endre noko ved eit uhell).
3. **Tab i skrivemodus** går rett til neste celle OGSÅ i skrivemodus
   (stadfesta som alt korrekt bygd i (3), ingen endring kravd der).
4. **Alle celler skal kunne redigerast** — også dei som er lesne
   automatisk ved import (t.d. Rev./Dato/Fag/Tiltakshavar/Oppdragsgivar/
   Målestokk/osb.). Rev./Dato var tidlegare `beregna:true` (låst) sidan dei
   ligg NØSTA inni kategori-JSON-en, ikkje som eit flatt Supabase-felt —
   løyst med eit lite spesialtilfelle i `DTMModule.jsx` sin `settVerdi()`
   (skriv inn i heile `rad[aktivKategori]`-objektet for akkurat desse to,
   i staden for eit topp-nivå-felt). Nytt kolonneflagg `kol.maskinlest`
   viser ei åtvaring («er du sikker på at du vil endre han manuelt?») FØR
   skrivemodus opnar for slike kolonnar — både på tredje klikk og ved
   Tab-navigasjon.

**Framleis IKKJE verifisert i praksis** (same avgrensing som over): heile
den nye tre-stegs klikk-sekvensen (særleg om browser-native dblclick-
handteringa faktisk oppfører seg som venta saman med den skreddarsydde
mousedown-dra-logikken).

## Vidareutvikling 26. sept. 2026 (2) — brukartesting, runde 3

Brukar testa runde 2 vidare og meldte attende seks ting. Sjå
`claude/saksmodul-tabell.md` for den fulle, oppdaterte spesifikasjonen —
denne seksjonen listar berre KVA som endra seg:

1. **Dobbeltklikk-basert steg 2 var ein «mellomstadie som ikkje er
   formålstenleg».** Bytt heilt ut med ein REIN klikk-teljar (`steg1Celle`-
   state), null tidsavhengnad — eit klikk tel same kor lenge etter det
   førre det kjem. Dette var den underliggjande årsaka til at dra-og-fyll
   verka upåliteleg: cellOmråde vart for sjeldan sett i praksis så lenge
   steg 2 kravde eit ekte, raskt dobbeltklikk.
2. Presisert tre-stegs-rekkjefølgja (klikk→rad, klikk→celle(r)/dra,
   klikk→skriv) — sjølve modellen var alt tiltenkt slik, men no ER han det.
3. Klikk KVAR SOM HELST ELLERS (anna celle ELLER heilt utanfor tabellen)
   avsluttar eit utval — ny `document`-mousedown-lyttar for
   utanfor-tabellen-tilfellet.
4. **Dokumentnummer OG Kategori er no òg redigerbare** — begge kan
   potensielt vere feil, og brukar (profesjonell) skal kunne rette dei:
   - **Dokumentnummer** (`nr`): fekk `redigerbar:true` attåt det
     eksisterande `opnaFil:true` — kombinasjonen krev at fil-opning (kort
     forseinka, som før) OG den tre-stegs klikk-modellen deler same celle
     utan å kollidere (sjå eige avsnitt i saksmodul-tabell.md). Har ein
     UNIK-indeks i Supabase (`user_id, project_id, nr`) — eit duplikat gjev
     no ei tydeleg åtvaring i staden for ein stille feil, og lokal state
     vert rulla attende.
   - **Kategori**: fekk `redigerbar:true` + ei fast nedtrekksliste (dei
     fire kategorinamna). Å endre han FLYTTAR sjølve metadata-objektet
     (filnamn/revisjon/dato/lasta_opp) frå det gamle til det nye kategori-
     slottet i `dtm_dokumenter` (ny funksjon `settKategori()` i
     `DTMModule.jsx`) — MEN rører ALDRI den fysiske fila på disken, som
     vert liggjande i den opphavlege kategorimappa. Viss målkategorien
     alt har eit aktivt dokument, avviser han endringa med ei tydeleg
     åtvaring i staden for å skrive over stille.
5. Endå tydelegare, ULIK fargetone for rad- vs. celle-val (rav/oransje for
   celle, appen sin vanlege merkefarge for rad) — sjå eige avsnitt i
   saksmodul-tabell.md.
6. Hyperlink-peikaren (Dokumentnummer/Tittel) dekkjer no berre sjølve
   teksten, ikkje heile celleflata — sjå eige avsnitt i saksmodul-tabell.md.

**Framleis IKKJE verifisert i praksis**: heile den nye, reint klikk-talde
sekvensen, særleg samspelet mellom fil-opning-forseinkinga og steg 1↔2 for
Dokumentnummer-kolonna, og om `color-mix()`-CSS-funksjonen faktisk
rendrar rett i den bunta Electron/Chromium-versjonen (bør vere trygt —
støtta sidan Chrome 111, Electron 36 brukar ein nyare Chromium — men ikkje
sett med eigne auge frå dette miljøet).

## Oppgåveliste / fasar

- [x] **Fase 1 — mapper og datamodell.** `OPPDRAGSMAPPER` oppdatert i
      `main.js`+`ProsjektModule.jsx`, Arkiv-undermapper lagt til i
      opprett-oppdragsmapper-IPC-en. `dtm_dokumenter`+`dtm_versjonar`
      oppretta i Supabase (sjå `supabase-dtm.sql`).
- [x] **Fase 2 — Electron-fil-bru.** Sjå eige avsnitt over. `dtmSkannFiler`,
      `dtmBekreftImport`, `dtmListFiler`, `dtmApneFil` på
      `window.resultatdokumentAPI`. **Attståande frå Fase 2, flytta til
      Fase 3:** Fag-D-løpenummer-fallback og SD-løpenummer-tildeling
      (krev tilgang til eksisterande register, gjer det i renderar-koden).
- [x] **Fase 3 — DTM-modulen sjølv.** Sjå eige avsnitt under.
- [ ] **Fase 4 — ekspanderbare rader i `DataTabell.jsx`.** Ny generisk
      `underrader(rad)`-type prop, brukt av DTM men tilgjengeleg for alle
      tabellar.
- [ ] **Rydding:** Vurder om `KvalitetModule.jsx` sin eksisterande
      scan-og-registrer-funksjonalitet (Del A, `ks:skann-og-legg-til`,
      `ks_teikningar`-tabellen) skal fjernast/erstattast av DTM, eller
      leve vidare parallelt ei stund. Ikkje avklara med brukar enno.
