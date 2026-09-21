# Kalendermodulen (ny, 2. sept. 2026)

Ny, eigen modul i venstremenyen (`AppRail.jsx`): «Kalender», bokstavkode
**«Ka»** (fargekode `#2A9D8F`). Erstattar det gamle, kompakte kalenderfeltet
som tidlegare låg heilt til høgre i notatmodulen (`CalendarView.jsx`,
med resize-handtak og av/på-knapp «K») — det feltet er no fjerna i sin
heilskap (sjå `claude/notatmodul-tabellvisning.md`). Notatmodulen har att
berre den nedre `Timeline`-baren, uendra.

`CalendarView.jsx` sjølve fila er **ikkje** sletta (ligg framleis i
prosjektet), men er ikkje lenger importert eller brukt noko stad.

## Fem visingar

`KalenderModule.jsx` har fem knappar øvst for å byte vising: **Dag, Veke,
Månad, Kvartal, År**. Alle visingar brukar `date-fns` (v4, alt ein
avhengigheit i prosjektet) med `weekStartsOn: 1` gjennomgåande, slik at
veka alltid startar på **måndag**. Vekenummer vert vist tydeleg (ISO-
vekenummer via `getISOWeek`) i månadsrutenettet.

- **Dag** — lista over alle hendingar (fristar/møte) for éin valt dag.
- **Veke** — sju kolonnar (måndag–søndag), kvar med dato, vekedag,
  vekenummer i kolonneheader og ei rulleliste over hendingar den dagen.
- **Månad** — eit stort, interaktivt rutenett (måndag–søndag), med
  vekenummer i ein eigen kolonne heilt til venstre, heilagdagsnamn vist på
  raude/heilagdagar, «i dag» og valt dag markert, og inntil 4 hendingsmerke
  per dag (+ «flere»-teljar ved overflow). Eit sidepanel til høgre listar
  alle hendingar for valt dag i detalj. Klikk på ein dag vel han og
  oppdaterer sidepanelet.
- **Kvartal** — tre mini-månadsrutenett (kvar av dei tre månadene i
  kvartalet) side ved side, med små fargeprikkar i staden for fulle merke.
  Klikk på ein dag hoppar til Månad-vising, anka på den månaden.
- **År** — tolv mini-månadsrutenett i eit 4-kolonners rutenett, same
  drill-down-åtferd som Kvartal.

Navigering: «‹» / «I dag» / «›»-knappar flytter «anker»-datoen eitt steg om
gongen i eininga som svarar til aktiv vising (dag/veke/månad/kvartal/år via
`addDays`/`addWeeks`/`addMonths`/`addQuarters`/`addYears`).

## Norske heilagdagar

Nytt, sjølvstendig hjelpefil `helligdagar.js` (ingen ny npm-avhengigheit)
reknar ut norske heilagdagar/fridagar for eit gjeve år:

Fyrste nyttårsdag, Skjærtorsdag, Langfredag, Fyrste og andre påskedag,
Arbeidarane sin dag (1. mai), Grunnlovsdagen (17. mai), Kristi
himmelfartsdag, Fyrste og andre pinsedag, Fyrste og andre juledag.

Påskedag vert rekna ut med Meeus/Jones/Butcher-algoritmen (verifisert mot
kjende påskedatoar 2024–2028 og kjende norske heilagdagar for 2026).
Dei andre rørlege heilagdagane er definerte som forskyvingar frå påskedag
(t.d. Skjærtorsdag = påskedag − 3 dagar). Resultatet vert mellomlagra
(cache) per år.

Månadsrutenettet i `KalenderModule.jsx` viser heilagdagsnamnet under
datotalet på dei aktuelle dagane, og fargelegg søndagar/heilagdagar raudt,
slik ein forventar av ein norsk kalender.

## Hendingar — fristar og møte, henta frå eksisterande data

Kalenderen introduserer **ingen ny database-tabell**. Hendingane vert
utleia direkte frå dei same felta som alt finst på notat/oppgåver:

- **Fristar** («F»-merke, brunoransje `#B45309`) — opne (ikkje fullførte)
  oppgåver (`task.date`, `!task.done`) på notat som ikkje er arkiverte.
- **Møte** («M»-merke, blå `#1565C0`) — notat med `isMeeting && meetingTime`.

Merka er enkle bokstavmerke (same visuelle mønster som «Notatapp»-appen
alt brukar andre stader, t.d. `LetterIcon` i `NoteList.jsx`) — ikkje
ikonbibliotek — for å unngå å innføre nye, uverifiserte avhengigheiter.

Hendingane vert filtrerte til **valt prosjekt** (`activeProjectId`) når eit
prosjekt er valt i den globale `TopBar`; er ingen prosjekt valt, vert
hendingar frå alle prosjekt i gjeldande kontor viste. Kvar hending er
fargelagd med prosjektet sin farge (frå ein fast fargepalett, tildelt etter
prosjektindeks) i ein venstrekant-strek, slik at fleire prosjekt er lette å
skilje i vekevisinga og i overflow-lista.

Klikk på ei hending opnar notatet ho høyrer til, via `onEdit` — same
redigeringsvindauge (`NoteInput`) som resten av appen brukar.

## Filer

- `src/helligdagar.js` — ny, sjølvstendig, ingen avhengigheiter.
- `src/KalenderModule.jsx` — ny hovudkomponent for modulen.
- `src/AppRail.jsx` — lagt til ny modul-oppføring («kalender» / «Ka»).
- `src/App.jsx` — kopla inn `KalenderModule` (skrivebord + mobil), fjerna
  det gamle kalenderfeltet (`CalendarView`-bruken, resize-logikk,
  av/på-knapp «K») frå notatmodulen.
