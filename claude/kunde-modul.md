# Kundar-modul (Kontordrift → Kundar) — redesigna 25. okt. 2026

Plassering: paraplyen **Kontordrift** (VN) har NL2: **Prosjekt · Kundar · Ansatte · Kontorkalender** (`UNDERMODULAR.admin` i `AppRail.jsx`). Dei gamle
modulnøklane `prosjekt`/`kunde` er uendra; `ansatte` og `kontorkalender` er nye nøklar (begge viser `KontordriftModule` med `side`), `kontordrift` er alias for `ansatte`.
Aktiv fane i alle navigasjonslinjer er **svart med kvit tekst** (`#0A0A0A`) — gjort konsekvent i Notatar/NL2, Prosjekt (Prosjektinfo/Personell),
Kundar, Timar, Kvalitet, Kalender, Brukar, Tidslinje og Kanban.

## Kundar
- Den blå vertikale sidebaren er fjerna. Landingsside (som Prosjekt): «＋ Ny kunde» + søk i NL3, statistikk, kundekort (hovudkontakt, tal kontaktar/prosjekt), kontaktperson-treff og Brønnøysund-søk. Trykk på eit kort for å opne kunden.
- Kunde-vindauget har faner: **Kundeinfo** (bedrift, fakturering, notat) · **Kontaktpersonar** · **Prosjekt**. «← Alle kundar» tilbake.
- **Kontaktpersonar** = tilsette/sakbehandlarar hos kunden. Rask innlegging øvst (namn, rolle, e-post, telefon, Enter), utvida kort med avdeling/etat, mobil, hovudkontakt, og kva prosjekt kontakten er knytt til. Ny rolle: «Sakbehandlar».
- **Prosjekt** = register: alle prosjekt knytte til kunden (via `details.clientId`, org.nr. eller firmanamn i prosjektopplysningane), med nedtrekk for **sakbehandlar hos kunden** (skriv `clientContactName/Email/Phone` i prosjektet), «Koble prosjekt» (set kundeopplysningar + `clientId` i prosjektet) og «Fjern», og eit register **sakbehandlar → prosjekt** nedst.
- Ingen ny tabell: kontaktar ligg i `clients.details.contacts`, koplinga ligg i `projects.details`.

## Anna samtidig
- VN: Brukar- og Logg ut-knappen er fjerna. Brukar opnar ein frå namnet i TN; **Logg ut** ligg nedst i Brukar → Brukarinfo. VN har berre Innstillingar nedst.
- Prosjekt-fana «Prosjektkort» heiter no «Prosjektinfo».
