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

## Rutenettvisning (grid-redigering) — 25.–26. sept. 2026, valfri per tabell

Bygd for DTM-matrisa (sjå `claude/dtm-modul.md`), men implementert generisk i
`DataTabell.jsx` bak ein opt-in prop: `rutenettRedigering` (default av).
Andre tabellar (Saker, Notat, Kvalitet) er **heilt upåverka** med mindre dei
sjølv set denne propen — utan han oppfører DataTabell seg nøyaktig som før
(kolonnar merkt `redigerbar:true` vert framleis redigert med reint
dobbeltklikk, ingen av dei nye tre-stega under gjeld).

**INGEN av/på-brytar** — dette var i fyrste utkast (25. sept.) ein eigen
knapp i verktøylinja, men brukar bad om at han vart fjerna att: er
`rutenettRedigering` sett i det heile, er tre-stegs-modellen under ALLTID
aktiv, og kva som kan redigerast vert styrt reint gjennom kva kolonnen er
merkt med (`redigerbar`/`beregna`/`opnaFil`), ikkje ein runtime-brytar.

**Tre-stegs klikk-modell** (skil tydeleg mellom «rad valt», «celle valt» og
«skriv i cella» — brukar sitt eige krav, for å unngå at eit malplassert
klikk endrar innhald ved eit uhell):
1. **Eitt klikk** på ei celle vel RADA (den vanlege `merking`-mekanismen,
   brukt til fleirval/massehandlingar andre stader i appen òg) — inga
   celle vert vald enno.
2. **Dobbeltklikk** på SAME celle vel den EKSAKTE cella (eige, sterkare
   visuelt utheva — sjå kontrastavsnittet under) — enno IKKJE i skrivemodus.
3. **Eit tredje, separat klikk** på ei celle som ALT er cella-vald opnar
   SKRIVEMODUS (viser sjølve inndatafeltet). For kolonnar merkt
   `kol.maskinlest:true` (sjå under) kjem eit `window.confirm`-åtvarings-
   vindauge FØRST — avbryt brukar det, vert cella verande i «celle valt»,
   ikkje skrivemodus.
   - **Tab** i skrivemodus lagrar og går RETT til neste redigerbare kolonne
     i same rad, OGSÅ rett i skrivemodus (hoppar over steg 2 for den neste
     cella) — men syner framleis åtvaringa fyrst om DEN kolonnen er
     `maskinlest`.
   - **Escape** avbryt utan å lagre, og går attende til «celle valt»
     (steg 2), ikkje heilt attende til «ingenting valt».
   - Å klikke UT AV cella (blur) er einaste vegen ut av skrivemodus elles —
     ingen eigen «lukk»-knapp.
- **Klikk-og-DRA** (rørsle forbi ein liten terskel, skil det frå eit reint
  klikk) over fleire rader i SAME kolonne hoppar RETT til eit fleire-
  celler-utval (steg 2 sitt fleircelle-motstykke) UTAN å gå vegen om steg 1
  fyrst — fungerer likt anten ein startar draget frå ei allereie enkelt-
  cella-vald celle eller ei heilt uvald celle.
- **Excel-liknande dra-og-fyll**: eit lite handtak (firkant nede til høgre)
  dukkar opp i BOTN-cella av det valde området (steg 2 eller eit
  klikk-og-dra-utval). Å dra det nedover/oppover fyller/GJENTEK mønsteret
  av verdiar frå kjeldeutvalet syklisk inn i radene ein dreg over (éin
  kjeldeverdi → rein kopiering begge vegar). Måleraden vert funne med
  `document.elementFromPoint` (robust mot sortering/filter/tettleik).
- Eit «↶ Angre»-tastar dukkar opp i verktøylinja så snart det finst minst
  éi endring å angre — både enkeltredigeringar og heile dra-og-fyll-
  operasjonar (dra-og-fyll tel som ÉI angre-gruppe). Angre-historikken er
  BERRE i minnet (ikkje lagra), og forsvinn ved sideoppdatering.
- Eigne kolonnar (`kol.eigen`) er IKKJE med i tre-stegs-modellen/fleire-
  celler-val/dra-og-fyll — dei har sin eigen enkeltklikk-redigeringsflyt.

**Kolonneflagg som styrer kva som kan redigerast:**
- `kol.beregna:true` — verdien er UTREKNA, IKKJE eit flatt, skrivbart felt
  på rada (t.d. eit join/derivert felt) — kan ALDRI redigerast generisk.
  **Kvar tabell som slår på `rutenettRedigering` MÅ sjølv merkje sine
  utrekna/nøsta kolonnar med `beregna:true`** — elles vil eit klikk kalle
  `onSetVerdi(id, key, verdi)` med ein nøkkel som ikkje finst som ekte
  kolonne i databasen.
- `kol.maskinlest:true` — verdien vart lesen AUTOMATISK (t.d. skanna frå
  eit PDF-tittelfelt ved import). Framleis fullt redigerbar (brukar sitt
  eige krav 26. sept.: «profesjonelle brukarar skal kunne redigere ALLE
  celler, også dei maskinlesne») — men syner ei åtvaring («er du sikker på
  at du vil endre han manuelt?») FØR skrivemodus opnar, både ved tredje
  klikk og ved Tab-navigasjon inn i cella.

## Kontrast mellom rad-val og celle-val — 26. sept. 2026

Brukar melde at den fyrste utgåva av rad-/celle-utheving hadde for lite
kontrast til å skilje dei to tydeleg frå kvarandre. No:
- **Rad valt** (`merking`): `var(--brandbg)` bakgrunn (10 % dekning) +
  `inset 0 0 0 2px var(--brand2)` kant.
- **Celle valt/i utval** (`cellOmråde`/`fyllOmråde`): sterkare
  `var(--brandbg2)` bakgrunn (18 % dekning) + tjukkare
  `inset 0 0 0 2.5px var(--brand)` kant. Sidan cella sin bakgrunnsfarge vert
  måla OVANPÅ rada sin (begge er delvis gjennomsiktige), vert ei cella-valt
  celle INNI ei rad-vald rad synleg endå sterkare utheva enn kvar av dei
  åleine — ei naturleg, tydeleg opptrapping i staden for at dei to
  tilstandane flyt saman.

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
