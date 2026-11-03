# Kontordrift: Ansatte og Kontorkalender (18. okt. 2026)

- **Kontordrift** (opnar frå trestripa øvst til høgre) har to sider: **Ansatte** og **Kontorkalender** (flytta hit frå Prosjekt; `KontorkalenderSide.jsx` er uendra).
- **Ansatte** (`AnsatteSide.jsx`, tabell `ansatte`, RLS per administrator = innlogga brukar): fornamn, etternamn, e-post, tittel, rolle (ansatt/administrator), standard timepris (kr/t), aktiv, invitasjonsstatus. Første gong vert innlogga brukar lagd inn som administrator. «**Send invitasjon**» kallar Supabase-funksjonen `inviter-ansatt` (Edge Function, `verify_jwt`) som sjekkar at du eig rada og kallar `auth.admin.inviteUserByEmail` — personen får e-post med lenke for å lage passord og logge inn. Status: Ikkje invitert / Invitasjon sendt / Har konto / Feila.
  - NB: appen er per i dag **éin brukar = éi eiga datamengd** (RLS `auth.uid() = user_id`). Ein invitert får ein eigen konto, men ser ikkje administratoren sine prosjekt. Delt arbeidsområde (felles prosjekt/data) er neste steg og krev ny RLS-modell.
- **Personell** (Prosjekt → Personell) vert no valt frå dei registrerte ansatte («＋ Legg til frå ansatte…»); namn, e-post, tittel (→ rolle) og standard timepris følgjer med (`prosjekt_personell.ansatt_id`). «Legg meg til» og «Kopier frå anna prosjekt» finst framleis.
- **Prosjekt-landingsside**: når «Alle prosjekt» er valt øvst, viser Prosjekt-modulen ei landingsside med søk (namn, nummer, oppdragsgjevar), filter (Alle/Tilbod/Aktive/Arkiv/Papirkorg) og prosjektkort; den gamle blå prosjektlista til venstre er fjerna.

## Bokmål (omsetjar)
`bokmalOmsetjar.js`: kjeldespråket er nynorsk; med språk = bokmål (Brukar → Brukarinfo → Språk) vert synleg tekst, placeholder og title omsett ord for ord i DOM-en (MutationObserver) — heile appen følgjer valet. Redigerbart innhald (contenteditable/input/textarea) og kode vert ikkje rørt, og nynorsk kan gjenopprettast utan omlasting. Legg nye ord i `ORD`; presise formuleringar legg ein i `sprak.js` (`t('nøkkel')`, går føre).

## Skisse (VN) — retta 18. okt. 2026
«Skisse» i VN er ein vanleg modul (`activeModule === 'skisse'`) som opnar `SketchPad` **innbygd i hovudvindauget** (`<SketchPad innbygd …>`, ikkje fullskjerm-overlegg). «Lagre» lagar skissa som notat (tittel «Skisse dato klokkeslett», valt prosjekt); «Avbryt» går til Dashboard. Fyrste versjon la overlegget i mobil-greina av `App.jsx`, så det vart aldri synleg på skrivebord.

## Prosjektstyring (2. nov. 2026)
Nytt toppikon rett under Dashboard: **Prosjektstyring** (`prosjektstyring` i `AppRail.jsx`) med undermodulane Prosjekt, Framdrift og Kalender, til å styre det aktive prosjektet. Prosjekt er flytta ut av Kontordrift (som no har Kundar, Ansatte, Kontorkalender og innstillingane), og Framdrift/Kalender har ikkje lenger eigne toppikon. Utan valt prosjekt sender `App.jsx` Framdrift/Kalender til Prosjekt-sida (prosjektlista der ein vel prosjekt).

## «Endre prosjekt» (2. nov. 2026)
Verktøylinja øvst i Prosjekt-modulen («Lagra» + «Slett prosjekt») er fjerna. Nøkkelinfo (prosjektkortet), personell og tilgang er skrivevern til ein administrator i kontoret trykker **✎ Endre prosjekt** (på fanelinja). I endringsmodus finst **Lagre** (lagrar og går ut av modusen) og **Avbryt**; **Slett prosjekt** ligg nedst i prosjektkortet (berre i endringsmodus). Nye prosjekt (utkast) startar i endringsmodus. Dette er ei UI-sperre — databasen (RLS) er uendra.

## Prosjektstyring: rekkjefølgje, Prosjektplan, Prosjektdokumenter, farger, husk sist prosjekt (3. nov. 2026)
- Undermenyen i Prosjektstyring: **Prosjekt · Dashboard · Prosjektplan · Prosjektdokumenter · Kalender**. Klikk på Prosjektstyring-ikonet opnar Dashboard (`start: 'prosjektdash'` i `AppRail.jsx`). «Framdrift» heiter no **Prosjektplan** (berre namnet; modulnøkkelen `framdrift` er uendra).
- **Prosjektdokumenter** (`ProsjektDokumenter.jsx`, nøkkel `prosjektdok`): `DTMTabell` med dei DTM-dokumenta i prosjektet der «Kategori eksternt dok.» er Kontrakt, Oppdragsbekreftelse eller Endringsavtale (`PROSJEKTDOK_KATEGORIAR` i `dtmKonstantar.js`, lagt til i `EKSTERN_DOK_KATEGORIAR`). Dokumenta vert lagde inn i DTM; kategorien kan òg setjast i denne tabellen.
- **Farger:** `--bg` er kvit i alle tema, `--bg3`/`--bg4` er nøytrale grå, og tabelloverskrifter bruker `--tabell-hovud` (blå, `#D6E4F4`). Merkevarefargane (`--brand*`) er uendra.
- **Husk sist:** `App.jsx` lagrar kontor og prosjekt per brukar i `localStorage` (`liedlab-sist:<userId>`) og gjenopprettar dei ved oppstart (prosjektet vert sjekka mot kontoret ved fyrste innlasting).

## Tabelloverskrifter og Timar (3. nov. 2026)
- Tabelloverskrifter: `--tabell-hovud` er no `#A9C8EC` (blå) med svart, feit tekst (`--tabell-hovud-tekst`) i alle tabellar.
- **Timar** (`TimeTracker.jsx`): oppsummeringa per prosjekt og aktivitet har ingen fyll og ingen ikon (overskrifta er ei vanleg overskrift). Oppføringane vert **sorterte etter tid automatisk** 3 sekund etter siste endring i «Tidsbruk». Ei **pil** (↑) i Tidsbruk-cella lyser gult når det er eit udekka tidsrom mellom det som kom før (etter starttid) og denne oppføringa; peikar viser frå–til.
