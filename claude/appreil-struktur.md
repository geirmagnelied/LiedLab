# AppRail — paraply-struktur (30. sept. 2026)

## Kva endra seg

Venstre navigasjon er no TO NIVÅ, ikkje eitt flatt rail av 11 ikon:

- **Rail 1** (`AppRail.jsx`, uendra breidd/posisjon) viser no BERRE 8
  topp-nivå-val: **Admin** (A), **Gjeremål** (G), Timar, Kvalitetssystem,
  Farge, DTM, Bilete, Kalender. Admin og Gjeremål er reine
  NAVIGASJONS-PARAPLYAR — dei har ingen eigen modul-komponent.
- **Rail 2** (`AppRailUndermeny.jsx`, ny) dukkar opp TIL HØGRE for rail 1,
  BERRE når gjeldande modul høyrer til éin av paraplyane:
  - **Admin** → Prosjekt, Kundar, Kontordrift (ny plasshaldar-modul,
    `KontordriftModule.jsx` — ingen funksjonalitet enno).
  - **Gjeremål** → Notatar, Oppgåver, Saker.

**`activeModule`-verdiane sjølve er HEILT UENDRA** (`'prosjekt'`,
`'kunde'`, `'notatar'`, `'oppgaver'`, `'saker'`, pluss den nye
`'kontordrift'`) — restruktureringa er REIN NAVIGASJON. Alle
`activeModule === '...'`-grenene i App.jsx som renderer sjølve
modulkomponentane er urørte.

## Korleis det heng saman

`AppRail.jsx` eksporterer:
- `UNDERMODULAR` — `{ admin: [...], gjeremaal: [...] }`, kvar ei liste av
  `{ key, letter, label, color }` (dei faktiske `activeModule`-verdiane).
- `PARENT_AV_MODUL` — omvendt oppslag (`{ prosjekt:'admin', notatar:
  'gjeremaal', ... }`), rekna ut automatisk FRÅ `UNDERMODULAR` (aldri
  halde synkronisert manuelt).

`App.jsx` bruker `PARENT_AV_MODUL[activeModule]` til å avgjere om
`<AppRailUndermeny>` skal visast i det heile, og kva paraply ho skal vise
born for. `AppRail.jsx` sjølv bruker same oppslag til å avgjere KVA
TOPP-NIVÅ-IKON som skal syne som aktivt (t.d. viser «A»-ikonet som aktivt
når `activeModule === 'kunde'`).

Klikk på eit paraply-ikon i rail 1 hoppar til FYRSTE barn (`mod.born[0]`)
MEDMINDRE brukar alt er ein stad inni same paraply — då vert gjeldande
undermodul verande urørt (unngår å hoppe attende til Prosjekt kvar gong
ein klikkar «A» medan ein alt står i Kundar).

## Lagt til, ikkje endra

Mobil-layouten (den smale pille-rada i mobil-topbaren) er FRAMLEIS FLAT —
ingen paraply-nivå der, sidan skjermplassen uansett ikkje ville hatt rom
for eit ekstra rail. Berre `bilete` vart lagt til pille-lista (var
tidlegare mangla, urelatert hòl frå Bilete-modulen sin eigen leveranse).

## Kjent avvik

`OPPDRAGSMAPPER`/`DTM_KATEGORI_MAPPE`-mappenummer-kollisjonen («8 Diverse»
vs «8 Bilete», sjå claude/bilete-modul.md) er IKKJE knytt til denne
restruktureringa — reint samanfallande tidspunkt.
