# Saksmodul — ny tabell (august 2026)

Saksmatrisa i LiedLab-appen er skriven om. Tabellen ligg no i ein eigen
komponent, `src/SakerTabell.jsx`, med felles konstantar i
`src/sakerKonstantar.js`. `SakerModule.jsx` held fram med data, modalar og
Supabase-kall, og renderer tabellen.

**Oppdatering:** Sjølve tabellmotoren (sortering, filter, kolonnestyring,
tettleik, eigne kolonnar osv.) er sidan flytta ut i ein generisk komponent,
`src/DataTabell.jsx` — dette er no **standard tabellkomponent for heile
appen**. `SakerTabell.jsx` er ein tynn wrapper rundt `DataTabell` som berre
set opp kolonnedefinisjonar og celle-visning for saker; ekstern oppførsel
(prop-grensesnitt, `localStorage`-nøkkelen `liedlab-saker-tabell-v2`) er
uendra, så eksisterande brukarar sitt lagra visingsoppsett følgjer med.
Teikningsregisteret i Kvalitetsmodulen (`TeikningTabell.jsx`) er bygd på same
måte — sjå `claude/kvalitetsmodul-teikningar.md`. Nye tabellar bør følgje
same mønster: ein liten wrapper med `hentVerdi`/`hentSorteringsverdi`/
`lagCelle` rundt `DataTabell`, ikkje ein ny tabell frå botnen.

## Funksjonar

- **Prosjektnummer** er fyrste kolonne. Saksnummeret er difor berre eit
  løpande tal (1, 2, 3 …) utan prefiks. Eldre saker lagra som `K-2451-007`
  blir viste som `7` — `caseNoText()` plukkar ut talet, så ingenting må
  skrivast om i databasen.
- **Klikk på overskrift** sorterer; **▾** opnar meny med sorteringsval
  tilpassa kolonnetypen, filter med teljing per verdi, nøkkeltal for tal- og
  datokolonnar, «Skjul kolonnen» og «Ny kolonne…».
- **Ny kolonne** (tekst / tal / dato) kan lagast frå kolonnemenyen eller frå
  «+ Kolonnar». Kolonnen høyrer til prosjektet og ligg i databasen, så han er
  der same kvar du opnar saksregisteret. Celler i eigne kolonnar er
  redigerbare med eitt klikk. (Dette er valfritt i `DataTabell` — er
  `onNyKolonne` ikkje sett, som i teikningsregisteret, er heile
  «eigne kolonnar»-flyten skjult.)
- **Fargekode av/på**, tettleik (tett/normal/luftig), kolonnebreidd med drag,
  kolonneflytting med drag, skjul/vis kolonnar, nullstilling. Dette er
  personleg visingsoppsett og ligg lokalt i nettlesaren
  (`liedlab-saker-tabell-v2`).

## Datamodell

| Kva | Kvar |
|---|---|
| Kolonnedefinisjon (namn, type, rekkjefølgje) | tabellen `case_columns`, per prosjekt |
| Verdiane i kolonnen | `cases.ekstra` (JSONB), per sak |
| Personleg visingsoppsett | localStorage |

Må køyrast i Supabase SQL Editor (ligg i `supabase-cases.sql`, trygt å køyre
fleire gonger):

```sql
ALTER TABLE cases ADD COLUMN IF NOT EXISTS ekstra JSONB DEFAULT '{}';
-- + CREATE TABLE case_columns (...) med RLS, sjå supabase-cases.sql
```

Slettar du ei eiga kolonne, blir definisjonen borte for prosjektet, medan
verdiane blir liggjande i `cases.ekstra` (uskadelege, og kjem attende dersom
kolonnen blir laga med same nøkkel).

## Rutenettvisning (grid-redigering) — 25. sept. 2026, valfri per tabell

Bygd for DTM-matrisa (sjå `claude/dtm-modul.md`), men implementert generisk i
`DataTabell.jsx` bak ein NY, opt-in prop: `rutenettRedigering` (default av).
Andre tabellar (Saker, Notat, Kvalitet) er **heilt upåverka** med mindre dei
sjølv set denne propen — utan han oppfører DataTabell seg nøyaktig som før.

Med `rutenettRedigering` slege på:
- Eit «Redigering»-av/på-val dukkar opp i verktøylinja, like til venstre for
  «Fargekode»-etiketten.
- **Modus AV** (uendra frå før): berre kolonnar merkt `redigerbar:true`
  kan redigerast, med DOBBELTKLIKK. Eit dobbeltklikk på ein IKKJE ENNO
  redigerbar celle (som ville blitt redigerbar OM modus var på) slår sjølv
  PÅ modus fyrst, og opnar so redigering med det same — ein snarveg forbi
  den dedikerte knappen.
- **Modus PÅ**: eitt einstaka KLIKK er nok til å opne redigering, i ALLE
  celler — ikkje berre kolonnar merkt `redigerbar:true` — MED UNNTAK av
  kolonnar merkt `opnaFil:true` (opnar fil, ikkje redigering) eller
  **`beregna:true`** (kolonnen sin verdi er UTREKNA, ikkje eit flatt felt
  på rada — t.d. eit join/derivert felt — og skal ALDRI kunne skrivast til
  generisk, sjølv om modus er på). **Kvar tabell som slår på
  `rutenettRedigering` MÅ sjølv merkje sine utrekna/nøsta kolonnar med
  `beregna:true`** — elles vil eit klikk kalle `onSetVerdi(id, key, verdi)`
  med ein nøkkel som ikkje finst som ekte kolonne i databasen.
- **Fleire-celler-val**: eit klikk-og-DRA (rørsle forbi ein liten terskel,
  skil det frå eit reint klikk) over fleire rader i SAME kolonne vel heile
  området (blå kant/bakgrunn), utan å opne redigering. Talet på celler i
  utvalet vert kjelda for dra-og-fyll under.
- **Excel-liknande dra-og-fyll**: eit lite handtak (firkant nede til høgre)
  dukkar opp i BOTN-cella av det valde området. Å dra det nedover/oppover
  fyller/GJENTEK mønsteret av verdiar frå kjeldeutvalet syklisk inn i radene
  ein dreg over (nøyaktig éin kjeldeverdi → same åtferd som før: rein
  kopiering begge vegar). Måleraden vert funne med
  `document.elementFromPoint` (robust mot sortering/filter/tettleik).
- Eit «↶ Angre»-tastar dukkar opp i verktøylinja så snart det finst minst
  éi endring å angre — både enkeltredigeringar og heile dra-og-fyll-
  operasjonar (dra-og-fyll tel som ÉI angre-gruppe). Angre-historikken er
  BERRE i minnet (ikkje lagra), og forsvinn ved sideoppdatering — det er
  meint som eit tryggingsnett mot eit uheldig klikk/dra, ikkje ein full
  versjonshistorikk.
- Eigne kolonnar (`kol.eigen`, t.d. brukardefinerte kolonnar) er IKKJE med
  i fleire-celler-val/dra-og-fyll — dei har alt sin eigen enkeltklikk-
  redigeringsflyt, uendra.

## Totalrad — 25. sept. 2026, alltid tilgjengeleg (ikkje bak nokon prop)

Eit «Totalrad»-av/på-val dukkar opp i verktøylinja (attmed Tettleik) i KVAR
tabell som har minst éin synleg kolonne med `art:'tal'`. Slått på legg det
ei fast rad (`<tfoot>`, sticky nede i scroll-området, same mønster som
`<thead>` sin sticky topp) nedst i tabellen, som viser SUMMEN av kvar synleg
talkolonne for dei FILTRERTE/synlege radene (ikkje eit skjult totaltal for
heile registeret). Det er ei rein VISINGSINNSTILLING (lagra i
`prefs.totalrad`, same localStorage-mønster som Fargekode/Tettleik) — ingen
ny prop, ingen databaseendring.

## Prototype

Designet vart testa som frittståande html-side før implementeringa, publisert
som artifact «Saksregister». Same oppførsel som i appen, men prototypen har
ingen database.
