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

## Oppgåveliste / fasar

- [x] **Fase 1 — mapper og datamodell.** `OPPDRAGSMAPPER` oppdatert i
      `main.js`+`ProsjektModule.jsx`, Arkiv-undermapper lagt til i
      opprett-oppdragsmapper-IPC-en. `dtm_dokumenter`+`dtm_versjonar`
      oppretta i Supabase (sjå `supabase-dtm.sql`).
- [ ] **Fase 2 — Electron-fil-bru.** Nye IPC-endepunkt i `main.js`:
      skann fleire filer (attributt-uttrekk per kategori-reglane over),
      bekreft-import (flytt + `_REV`-namngjeving + arkiver gamal versjon),
      list gjeldande + arkiverte filer per kategori.
- [ ] **Fase 3 — DTM-modulen sjølv.** Ny fil (truleg omdøyping/omskriving
      av `ResultatdokumentModule.jsx`), fire importknappar + modal-flyt,
      matrise-vising via utvida `DataTabell`, sjølvlegande
      mappeoppretting (kallar opprett-oppdragsmapper-IPC-en ved opning).
      `AppRail.jsx` oppdatert med nytt namn/forkorting «DTM».
- [ ] **Fase 4 — ekspanderbare rader i `DataTabell.jsx`.** Ny generisk
      `underrader(rad)`-type prop, brukt av DTM men tilgjengeleg for alle
      tabellar.
- [ ] **Rydding:** Vurder om `KvalitetModule.jsx` sin eksisterande
      scan-og-registrer-funksjonalitet (Del A, `ks:skann-og-legg-til`,
      `ks_teikningar`-tabellen) skal fjernast/erstattast av DTM, eller
      leve vidare parallelt ei stund. Ikkje avklara med brukar enno.
