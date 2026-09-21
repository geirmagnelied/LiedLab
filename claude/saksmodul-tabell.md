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

## Prototype

Designet vart testa som frittståande html-side før implementeringa, publisert
som artifact «Saksregister». Same oppførsel som i appen, men prototypen har
ingen database.
