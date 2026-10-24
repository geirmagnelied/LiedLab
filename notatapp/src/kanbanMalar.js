// ═══════════════════════════════════════════════════════════════════
//  kanbanMalar — standard Kanban-kort per fase (Skisseprosjekt, Forprosjekt, Byggesøknad, Detaljprosjekt). Vert lagde i kolonna
//  «Komande oppgåver» når ei tavle for fasen vert oppretta (DTM-leveransar for same fase kjem i tillegg, sjå kanbanLogikk.js).
//  Startpakke — innhaldet skal avklarast med kontoret og utvidast. Rediger lista under.
// ═══════════════════════════════════════════════════════════════════
export const KANBAN_MALAR = {
  skisse: ['Avklare føresetnader og rammer (reguleringsplan, krav)', 'Skisser alternativ og volumstudiar', 'Presentere skisseprosjekt for byggherre'],
  forprosjekt: ['Avklare prinsippløysingar med fag (RIB, RIV, RIE)', 'Utarbeide forprosjektteikningar', 'Kostnadsoverslag / mengder til kalkyle'],
  soknad: ['Utarbeide søknadsteikningar', 'Samle dokumentasjon til rammesøknad', 'Sende søknad til kommunen'],
  detalj: ['Detaljere plan, snitt og fasadar', 'Koordinere detaljløysingar med fag', 'Frigje teikningar til bygging'],
}
