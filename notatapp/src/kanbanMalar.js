// ═══════════════════════════════════════════════════════════════════
//  kanbanMalar — standardkort per fase (same tanke som framdriftMalar.js). Fyrste versjon er ein enkel startpakke;
//  innhaldet skal avklarast med kontoret og utvidast (sjå «Opne punkt» i claude/kanban-modul.md). Rediger lista under.
// ═══════════════════════════════════════════════════════════════════
export const KANBAN_MALAR = {
  '01': ['Avklare føresetnader og rammer (reguleringsplan, krav)', 'Skisser alternativ og volumstudiar', 'Presentere skisseprosjekt for byggherre'],
  '02': ['Avklare prinsippløysingar med fag (RIB, RIV, RIE)', 'Utarbeide forprosjektteikningar', 'Kostnadsoverslag / mengder til kalkyle'],
  '03': ['Samle tilbodsteikningar og beskrivingar', 'Kontrollere tilbodsgrunnlaget (egenkontroll)', 'Sende ut tilbodsgrunnlag'],
  '04': ['Utarbeide søknadsteikningar', 'Samle dokumentasjon til rammesøknad', 'Sende søknad til kommunen'],
  '05': ['Detaljere plan, snitt og fasadar', 'Koordinere detaljløysingar med fag', 'Frigje teikningar til bygging'],
}
