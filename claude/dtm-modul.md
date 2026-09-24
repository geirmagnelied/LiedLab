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
