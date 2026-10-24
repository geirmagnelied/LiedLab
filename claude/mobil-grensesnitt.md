# Mobil-grensesnitt og navigasjonsrydding — spesifikasjon (24. okt. 2026) — BYGD 24. okt. 2026 (sjå «Implementering» nedst)

Spesifisert i samtale med Geir Magne 24. okt. 2026, før implementering i
Claude Code. Dekker to ting som høyrer saman og bør byggjast samla:

1. Eit forbedra mobil-grensesnitt (den separate `isMobile`-grenen i `App.jsx`).
2. Ei rydding av kor Innstillingar/Logg ut/admin-snarvegar bor — gjeld
   **BÅDE** skrivebord (`AppRail.jsx`/`TopBar.jsx`) og mobil.

## Bakgrunn — status i dag (funne ved gjennomgang av koden, 24. okt.)

- Mobil bruker **ikkje** `AppRail`/`TopBar`/`AppRailUndermeny`. Det er ein
  heilt separat, flat gren i `App.jsx` (`if (isMobile) return (...)`, frå
  ca. linje 375) — modulane er alle nåbare (ingen er mangla), men UI-et er
  eit anna.
- Mobil-toppfeltet i dag er **éi** 52px-rad med alt klemt inn: hamburger,
  prosjekt/modulnamn, 12 små bokstav-piller (eitt per modul: D, N, Ka, P,
  K, O, S, T, KS, DTM, B, Fd), innstillings-tannhjul, Logg ut-knapp. Dette
  er trolig hovudårsaka til kjensla av at det ikkje er plass til teksten.
- Mobil har **ingen fast venstre-rail** — hamburgeren opnar `Sidebar.jsx`
  som eit fullskjerm-overlegg (skuff). Dette dekkjer i praksis allereie
  kravet om at «VN skal kunne komprimerast heilt».
- Botnnavigasjonen i dag har tre faner: **Nytt** / **Notatar** / **Fristar**.
- Bilete-opplasting frå mobil er **allereie løyst teknisk**
  (`BileteModule.jsx`: fil-input med `capture="environment"`, altså direkte
  kameratilgang, kø som skrivebordsappen hentar ned seinare). Flaskehalsen
  er å finne fram til Bilete-modulen i dagens overfylte toppfelt — ikkje
  sjølve opplastinga.
- Skrivebordet (`TopBar.jsx`) har i dag ein «⋮»-meny med: Prosjekt/Kunde/
  Kontordrift-snarvegar, delelinje, Innstillingar, Logg ut. Brukarmenyen
  (avatar + namn, `onOpenBruker`) ligg separat frå denne, alltid synleg
  oppe til høgre.

## Endring 1 — Innstillingar/Logg ut/admin-snarvegar flytta til botnen av venstre navigasjon (gjeld BÅDE skrivebord og mobil)

- **Skrivebord (`AppRail.jsx`)**: TopBar sin «⋮»-meny fjernast heilt.
  Innhaldet hans (Prosjekt/Kunde/Kontordrift-snarvegar, Innstillingar,
  Logg ut) flytter til **botnen av AppRail**, under modullista, saman med
  den eksisterande «Brukar»-knappen som alt ligg der.
- **Mobil (`Sidebar`-skuffen)**: same prinsipp — skuffen som hamburgeren
  opnar får ein tilsvarande botn-sone med Innstillingar/Logg ut/
  admin-snarvegar. Tannhjul-knappen forsvinn frå mobil-toppfeltet.
- **Brukarmenyen** (avatar + namn) ligg framleis alltid synleg **oppe til
  høgre**, på både skrivebord (uendra) og mobil (ny — toppfeltet manglar
  i dag ein brukarknapp; kommer i staden for tannhjulet, sjå Endring 2).
- **Medvite duplikat, ikkje ein feil**: Prosjekt/Kunde/Kontordrift er
  framleis nåbare via Admin-paraplyen øvst i AppRail (uendra). Snarvegane
  nedst er eit ekstra, raskare alternativ — ikkje ei erstatning. Nemnt
  eksplisitt her sidan det no finst to vegar til same stad; avklar i
  Claude Code om dette skal markeres visuelt som «snarvegar».

## Endring 2 — Mobil toppfelt: to rader i staden for éi

- **Rad 1 (fastspikra topp)**: hamburger (opnar Sidebar-skuffen) +
  prosjektnamn (får mesteparten av plassen, `…`-avkorting berre om
  nødvendig) + brukarmeny (ny, flytta inn hit i staden for tannhjulet).
- **Rad 2 (ny, horisontalt scrollbar)**: modulvalet, flytta heilt ut av
  rad 1. **Kortnamn** i pillene (ikkje berre bokstavkode som i dag) — t.d.
  «Notatar», «Bilete», «Oppgåver» — breie nok for touch (~40px høgde),
  scroll-snap, uttona kant i høgre ende som viser at det finst meir å
  scrolle til. Aktiv modul tydeleg markert (same idé som
  `AppRailUndermeny` på skrivebord, berre horisontal i staden for eit
  fast sett born).

## Endring 3 — Botnnavigasjon ersattes av flytande knappar (berre mobil)

- Dagens tre botn-faner (Nytt / Notatar / Fristar) fjernast.
- To flytande, runde knappar nede til høgre: **kamera** (nytt bilete →
  rett til Bilete-modulen sitt mobile opplastingsgrensesnitt) og **pluss**
  (nytt notat → `NoteModal`, som i dag via `handleNewNote('regular')`).
- Gjeld **berre mobil** — skrivebordet har alt god plass og eksisterande
  knappar (t.d. +Notat i notatmodulen), ingen endring der.

## Opne punkt (ikkje avklart enno)

- **«Fristar»-visinga** (frist-oversikt, i dag ein av dei tre botn-fanene)
  har ingen naturleg plass i den nye strukturen, sidan den ikkje er eit
  eige modul, men ei undervising inni notatmodulen (`view==='fristar'`).
  Forslag: gjer den om til ei lita intern fane («Notatar»/«Fristar») øvst
  i sjølve notat-modulinnhaldet på mobil, i staden for ein global
  botn-fane. **Avklar med Geir Magne før bygging.**
- Nøyaktig plassering/stil på den nye botn-sona i `AppRail.jsx` (eigne
  knappar under «Brukar», eller ein liten eigen undermeny der nedst) —
  avklar i Claude Code ved implementering, basert på eksisterande visuelt
  mønster for «Brukar»-knappen.

## Filer (forslag — ikkje bygd enno)

| Fil | Endring |
|---|---|
| `AppRail.jsx` | Ny botn-sone: Innstillingar, Logg ut, Prosjekt/Kunde/Kontordrift-snarvegar |
| `TopBar.jsx` | «⋮»-menyen fjernast heilt (innhaldet flytta til `AppRail.jsx`) |
| `App.jsx` (mobil-gren) | Nytt topbar-oppsett (2 rader), botn-faner → 2 flytande knappar |
| `Sidebar.jsx` | Ny botn-sone (Innstillingar/Logg ut/admin-snarvegar), same som AppRail |

## Implementering (24. okt. 2026)

Alle tre endringane er bygde. Val som vart gjorde undervegs:
- **Endring 1 (skrivebord):** TN sin hamburgermeny er fjerna. `AppRail.jsx` har ei botn-sone (under ei delelinje): Prosjekt / Kundar / Kontordrift (snarvegar, aktivmerka når modulen er open), Innstillingar, Brukar, Logg ut — same `Knapp`-mønster som resten av rail (ikon, tekst i full modus, tooltip i smal). Admin-paraplyen finst ikkje lenger i `MODULES`, så desse knappane er den einaste vegen til Prosjekt/Kundar/Kontordrift (ikkje eit duplikat). `AppRail` tek nye props `onOpenSettings` og `onLogout`.
- **Endring 1 (mobil):** `Sidebar.jsx` (skuffa) har ei botn-sone med Prosjekt/Kundar/Kontordrift, Innstillingar og Logg ut (props `onNavModul`, `onLogout`); tannhjulet i skuffa si overskrift er fjerna.
- **Endring 2:** Rad 1 = hamburger + prosjektnamn (ellipsis berre ved behov) + brukar-avatar (opnar Brukar). Rad 2 = `MobilModulRad.jsx`: kortnamn, 40 px høge pillar, scroll-snap, uttona høgrekant, aktiv modul fylt kvit og scrolla til syne. Tannhjul og Logg ut-knapp er borte frå toppfeltet.
- **Endring 3:** Botn-fanene er erstatta av to flytande knappar nede til høgre: kamera (→ Bilete-modulen) og pluss (→ nytt notat, `handleNewNote('regular')`). Skjulte medan skuffa eller notat-vindauget er open.
- **«Fristar» (opent punkt):** Gjort etter forslaget i spesifikasjonen — to faner «Notatar / Fristar» øvst i Notatar-innhaldet på mobil (`view`-staten som før). Ikkje avklart med Geir Magne på førehand; lett å endre.
- Dashboard: korta er éi kolonne under 768 px (4 side om side på skrivebord).
- Ikkje testa på ei ekte telefon eller med innlogga brukar; rad 2 vart rendra og kontrollert i ein mobil-viewport.
