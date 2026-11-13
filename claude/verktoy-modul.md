# Verktøy-modulen og Veggvelgar (13. nov. 2026)

Ny modul **Verktøy** (venstremenyen, `AppRail.jsx` → `verktoy`, ikon Wrench) med éi verktøysamling. Fyrste verktøy: **Veggvelgar**, som foreslår innvendige stenderveggar frå Norgips sin veggtabell. Ingen eldre kode fanst (sjekka i repo og git-historikk).

## Filer
- `notatapp/src/VerktoyModule.jsx` — forside med kort per verktøy (`VERKTOY`-lista); nye verktøy = ny oppføring + komponent som får `{ userId, projects, activeProjectId }`.
- `notatapp/src/VeggvelgarVerktoy.jsx` — kravskjema (romtype, brann EI, lyd, romhøgde, robustheit, c/c, CF), resultat, detalj, «Lagre på prosjekt», fane «Lagra på prosjekt». Krav hugsast i `localStorage` (`liedlab-veggvelgar-krav-v1`).
- `notatapp/src/VeggvalTabell.jsx` — resultattabell, tynn wrapper rundt `DataTabell` (standard sortering: tjukkleik).
- `notatapp/src/veggvelgarLogikk.js` — rein logikk: `foreslaVeggar(krav)`, `evaluerRad`, `flaskehalsar` (kva krav som hindrar treff).
- `notatapp/src/veggvelgarKonfig.js` — justerbare tolkingar: robustheit-poeng per platetype, romtype-regler, RIB-grense.
- `notatapp/src/data/norgipsVeggtabell.json` — genererte data (365 rader: W111 70, W112 95, W115 104, W628B 96) + `henta`, kjelder, kontrollsum per familie, forklaringar og Norgips sine merknader.
- `notatapp/scripts/norgips-raw/*.txt` — råuttrekk frå Norgips (ei fil per familie), `notatapp/scripts/bygg-norgips.js` — bygger JSON frå råfilene (`node scripts/bygg-norgips.js [yyyy-mm-dd]`).
- `notatapp/supabase-verktoy-veggval.sql` — tabell `verktoy_veggval` (RLS via `kan_se_prosjekt`/`kan_administrere_prosjekt`). **Må køyrast manuelt i Supabase SQL Editor.** Utan tabellen viser fana ei feilmelding om det.

## Norgips-sida og datakjelde
- `byggeteknikk.norgips.no` svarar 403 på automatiske kall (Cloudflare). Ikkje forsøk å omgå dette (spoofing av nettlesar-UA vart avvist). Sidene kan lesast i nettlesarpanet i Claude-appen.
- Kvar veggfamilie har eiga underside, t.d. `.../veggtabell/veggtabell-w111-vegger-med-ett-platelag/`. Tabellane er opne HTML-tabellar (TablePress, `table[id^=tablepress]`) utan JSON-API. Åtte familiar finst (W111, W112, W115, W628B, Trestender, Trestender m/Ultra Board, Nail It Indoor, Nail It Safety); **berre dei fire stålfamiliane er med i versjon 1.**
- PDF-en kjem berre via e-postskjema (Geir Magne må laste ned sjølv); Norgips sender ny PDF automatisk ved oppdatering.

### Oppdatere data (manuelt, ved varsel frå vekekontrollen eller ny PDF)
1. Opne kvar underside i nettlesarpanet. Kjør denne i sidekonteksten og lim resultatet i `scripts/norgips-raw/<familie>.txt` (fyrste linje `## kjelde=<url> familie=<W111|...>`):
```js
const rens = s => s.replace(/\s+/g,' ').trim(), ut = []
for (const x of document.querySelectorAll('table[id^=tablepress]')) {
  const hode = [...(x.tHead?.rows||[])].map(r => [...r.cells].map(c => rens(c.innerText)))
  if (hode.length < 3) continue
  const h3 = hode[2], plater = h3.slice(0, h3.findIndex(c => /maks/i.test(c))).filter(c => c && c !== '.')
  const rader = [...(x.tBodies[0]?.rows||[])].map(r => [...r.cells].map(c => rens(c.innerText)))
  ut.push('## ' + x.id + ' plater=' + plater.join(',') + '\n' + rader.map(r => r.join('|')).join('\n'))
}
ut.join('\n')
```
2. `node scripts/bygg-norgips.js` frå `notatapp/`, kontroller radtal, køyr `npx vite build`, og kryssjekk stikkprøver mot PDF-en.
3. Kontrollsummen i JSON-fila er hash av råfila; den vekentlege kontrollen samanliknar nye uttrekk mot denne.

## Datamodell og tolking av Norgips-tabellen
Kolonnar per rad: Nr., veggkode (t.d. `SE C70 dB+ 1/1 S/M0`), **EI-brannklasse**, kryss for tillatne plater (kolonnenamn står i tabellhovudet: STD, HRD, HB, LB, BRN, UB13, UB15, SIB, SAB, AQ), platetjukkleik, veggtjukkleik, **maks høgde med brannkrav** («EI klassifisert», dB+), høgde **utan** brannkrav for c/c 450 og c/c 600 (dB+), R'w, R'w+C, og høgder for CF-profil (c/c 450/600).
- Celler kan ha to verdiar: `60 (30)` + `5000* (6000)` = EI 60 opp til 5000 mm, EI 30 opp til 6000 mm → `brann: [{ei, maks, stjerne}]`. `*` = avgrensing frå NS-EN 15254-3.
- Norgips-merknader (lagra i JSON): maks EI-høgde krev ofte c/c 450; sjakt/doble vegger over 4 m med brannkrav skal prosjekterast av RIB; CF kan runde EI-høgda opp til hel meter.
- Nokre råtabellar har desimalpunktum («12.5») eller småfeil i kodar (t.d. `C95dB+`); `bygg-norgips.js` normaliserer.

## Logikk (`veggvelgarLogikk.js`)
- **Brann:** rader der minst éi `brann`-oppføring har `ei >= krav`. **Høgde med brannkrav** = lågaste av EI-maks og høgda utan brannkrav for valt c/c (CF: EI-maks rundast opp til hel meter). Utan brannkrav: berre c/c-høgdene. Variantrekkjefølgje: dB+ c/c 600, dB+ c/c 450, CF c/c 600, CF c/c 450.
- **Lyd:** R'w (eller R'w+C) ≥ krav. **Romtype:** innvendig = W111/W112/W115; sjakt = W628B; våtrom = rader der HB eller AQ kan brukast.
- **Robustheit (EIGEN tolking, må stadfestast):** poeng = plate (LB 0, STD 1, BRN 1, SIB 1, SAB 2, AQ 2, UB13 2, UB15 3) + 1 om ≥ 2 lag per side, maks 3. Nivå: Ingen/Normal(≥1)/Auka(≥2)/Høg(≥3). Endre i `veggvelgarKonfig.js`.
- **Rangering:** tynnast vegg → færrast lag → dB+ før CF → c/c 600 før 450 → høgast R'w.
- Testa med esbuild-bunt (17 sjekkar: grenser, EI-filter, sjakt, våtrom, CF, c/c).

## Vekentleg Norgips-kontroll
Planlagd oppgåve måndagar kl. 12 (sjå nedst i denne fila for status). Samanliknar nye uttrekk mot kontrollsummane og varslar Geir Magne (varsel + e-post) om endringar. Oppdaterer IKKJE data automatisk: ny PDF må lastast ned og kvalitetssikrast fyrst.

## Opne punkt
- Stadfest robustheit- og romtype-tolkingane.
- Trestender/Nail It ikkje med (andre tabellar, må tilpassast parsaren).
- `verktoy_veggval`-SQL må køyrast manuelt.

## 13. nov. 2026 (seinare) — Trestender og Nail It med
- Nye råfiler i `notatapp/scripts/norgips-raw/`: `tre.txt` (Trestender), `treub.txt` (Trestender med Ultra Board), `nailit.txt` (Nail It Indoor), `nailit-safety.txt` (Nail It Safety). Totalt 483 rader (W111 70, W112 95, W115 104, W628B 96, Trestender 18, TrestenderUB 39, NailItIndoor 38, NailItSafety 23). Råformata `stal|tre|treub|nailit` er dokumenterte øvst i `scripts/bygg-norgips.js`; format og familie står i fyrste linje i kvar råfil.
- **Oppdatert uttrekksskript** (erstattar det over; tek alle format): same som i den vekentlege kontrollen. Finn `plater=` frå siste hovudrad (kodane STD/HRD/HB/LB/BRN/UB13/UB15/SIB/SAB/AQ før fyrste «maks/c/c/R'w/B1 / B2»-celle) og hoppar over forklaringstabellar (rader der fyrste celle ikkje er eit tal).
- **Kryssjekk mot PDF** (`Underlag/NORGIPS_Veggtabell_WEB.pdf`, 58 sider, tekst henta med `pdfjs-dist`): 477 av 483 rader stemmer. Seks avvik mellom PDF og nettside, alle i stålfamiliane:
  - W628B, C120 `0/UB15+1` (S/M0 og S120): c/c 600 = 4550 på nettsida, 4800 i PDF-en. Nettsida (lågaste verdi) er brukt til avklaring.
  - W115 `2xAQ/2xAQ 2xS45/2xS70/2xS95/2xS120`: PDF-en skriv `S45` osb. utan «2x»; verdiane er like.
- **Trestender:** kolonnane «IB» = EI for ikkje-bærande vegg, «B1/B2» = bærande brannklasse. Høgdene er anbefalte for ikkje-bærande vegger. Same høgd for c/c 450 og c/c 600. Bærande verdiar vert vist i detaljen, men filtrerer ikkje.
- **Trestender med Ultra Board:** to tabellar (89, 91) har overskrifta «c/c 450 R'w / c/c 600 R'w» (same i PDF) med verdiar som 30/33; vi bruker lågaste som R'w (`rwModus=cc` i råfila) og R'w+C manglar. Kan vere skrivefeil hos Norgips; verifiser ved behov.
- **Nail It:** høgde finst berre for c/c 600 (kode «N 600») eller utan c/c (Safety, `CF N`). «N»-profil vert ikkje styrt av «Tillat CF»-valet. Robustheit: Indoor +1, Safety +2 poeng (Safety = sikkerheitsklasse 3 / RC4) — eiga tolking i `veggvelgarKonfig.js`.
- Sjakt = rader med `0/`-oppbygging i alle familiar (ikkje berre W628B). UI har fått filter «Veggtype» (Alle/Stål/Trestender/Nail It).
- Den vekentlege kontrollen les no alle råfilene (oppdatert oppgåve).
