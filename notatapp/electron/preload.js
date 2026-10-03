// electron/preload.js
// ─────────────────────────────────────────────────────────────────────
// Køyrer i den vanlege (live) nettsida sin kontekst, men med tilgang
// til nokre få, nøye avgrensa Node/Electron-funksjonar. Alt som vert
// eksponert her hamnar på window.resultatdokumentAPI i nettsida —
// resten av sida (Notatar, Oppgåver, Saker, osv.) merkar ingenting,
// og køyrer akkurat likt som i ein vanleg nettlesar.
// ─────────────────────────────────────────────────────────────────────

const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('resultatdokumentAPI', {
  // Hentar den absolutte filstien til ei fil som vart droppa frå
  // Windows Utforskar (File-objekt frå ein drop-event).
  hentFilsti: (file) => {
    try { return webUtils.getPathForFile(file) } catch { return null }
  },

  // Opnar ein native mappe-veljar. Returnerer vald sti, eller null.
  velgMappe: () => ipcRenderer.invoke('resultatdokument:velg-mappe'),

  // Opprettar standard-mappestrukturen (1 Oppdragsleiing, 2 Informasjons-
  // flyt, 3 Arbeidsdokumenter, 4 Resultatdokumenter, 5 BIM) inni ein
  // brukarvald/-stadfesta oppdragssti. Trygg å kalle fleire gongar
  // (mkdir -p-semantikk) — brukast av ProsjektModule sin «Lås denne
  // stien»-knapp. Returnerer { ok, melding? }.
  opprettOppdragsmapper: (oppdragsSti) => ipcRenderer.invoke('resultatdokument:opprett-oppdragsmapper', { oppdragsSti }),

  // Opnar mappa i Windows Utforskar.
  apneMappe: (sti) => ipcRenderer.invoke('resultatdokument:apne-mappe', sti),

  // Listar filene som ligg i resultatdokument-mappa for eit prosjekt.
  listFiler: (prosjektSti) => ipcRenderer.invoke('resultatdokument:list', { prosjektSti }),

  // Legg til éin eller fleire filer i resultatdokument-mappa.
  // Flyttar automatisk eksisterande fil(er) med same teikningsnummer
  // til «Versjoner»-undermappa med _REVx lagt til filnamnet.
  leggTilFiler: (prosjektSti, filPathar) =>
    ipcRenderer.invoke('resultatdokument:legg-til', { prosjektSti, filPathar }),

  // Opnar ei fil i resultatdokument-mappa i systemet sitt standardprogram.
  // Filene er skriveverna (berre-lesing) — dei er ferdige, leverte
  // dokument; ein ny revisjon skal alltid leggjast inn via appen.
  apneFil: (prosjektSti, filnamn) =>
    ipcRenderer.invoke('resultatdokument:apne-fil', { prosjektSti, filnamn }),

  // ── Kvalitetsmodul (KS) — same bru, eigne endepunkt ────────────────
  // Listar filene som ligg i «<prosjektSti>/kontroll/til kontroll».
  ksListFiler: (prosjektSti) => ipcRenderer.invoke('ks:list', { prosjektSti }),

  // Flyttar dropa filer til «til kontroll», skannar filnamn + PDF-
  // tittelfelt, og returnerer metadata (nr/rev/tittel/målestokk/
  // teikna_av/ek_person/fk_person/dato/format) for kvar fil.
  ksSkannOgLeggTil: (prosjektSti, filPathar) =>
    ipcRenderer.invoke('ks:skann-og-legg-til', { prosjektSti, filPathar }),

  // Flyttar namngjevne filer frå «til kontroll» til
  // «Kontrollkopiar/<løpenr>_<namn>/» ved ferdigstilt kontroll.
  ksFerdigstill: (prosjektSti, seq, namn, filnamn) =>
    ipcRenderer.invoke('ks:ferdigstill', { prosjektSti, seq, namn, filnamn }),

  // Opnar ei fil i «til kontroll» i systemet sitt standardprogram. IKKJE
  // skriveverna — desse er framleis under kontroll og kan redigerast.
  ksApneFil: (prosjektSti, filnamn) =>
    ipcRenderer.invoke('ks:apne-fil', { prosjektSti, filnamn }),

  // ── DTM (Dokument, tegningar og modellar) — same bru, eigne endepunkt ──
  // Sjå claude/dtm-modul.md. «kategori» er éin av: arbeidsdokument,
  // resultatdokument, kontrolldokument, styrande_dokument.

  // Skannar filer (nr/rev/fag + PDF-tittelfelt) UTAN å flytte dei — brukast
  // til gjennomgangsmatrisa før brukar stadfestar importen.
  dtmSkannFiler: (filPathar, kategori) =>
    ipcRenderer.invoke('dtm:skann-filer', { filPathar, kategori }),

  // Flyttar dei (evt. retta) dokumenta til rett kategorimappe med
  // _REV<revisjon|dato-tidsstempel>-namngjeving, og arkiverer eventuell
  // eksisterande fil for same dokumentnummer fyrst.
  dtmBekreftImport: (oppdragsSti, kategori, dokument) =>
    ipcRenderer.invoke('dtm:bekreft-import', { oppdragsSti, kategori, dokument }),

  // Listar gjeldande + arkiverte filer for éin kategori.
  dtmListFiler: (oppdragsSti, kategori) =>
    ipcRenderer.invoke('dtm:list', { oppdragsSti, kategori }),

  // Opnar ei fil (gjeldande eller arkivert) i systemet sitt standardprogram.
  dtmApneFil: (oppdragsSti, kategori, filnamn, arkivert) =>
    ipcRenderer.invoke('dtm:apne-fil', { oppdragsSti, kategori, filnamn, arkivert }),

  // Les ei gjeldande DTM-fil sine rå bytes (base64) — sjå skyopplastinga
  // av resultatdokument, claude/dtm-modul.md.
  dtmLesFilBytes: (oppdragsSti, kategori, filnamn) =>
    ipcRenderer.invoke('dtm:les-fil-bytes', { oppdragsSti, kategori, filnamn }),

  // «Del fil» — kopierer filstien(ane) til utklippstavla og opnar e-post-
  // programmet med dei lima inn. «stiar» er fulle filstiar (kan vere fleire).
  dtmDelFil: (stiar) => ipcRenderer.invoke('dtm:del-fil', { stiar }),

  // Registrering av utsendingar — lagrar/opnar ei kvitteringsfil (t.d. ein
  // sendt e-post dregen ut som .msg) i «2 Informasjonsflyt\Utsendingar».
  dtmLagreKvittering: (oppdragsSti, kjeldeSti) =>
    ipcRenderer.invoke('dtm:lagre-kvittering', { oppdragsSti, kjeldeSti }),
  dtmApneKvittering: (oppdragsSti, filnamn) =>
    ipcRenderer.invoke('dtm:apne-kvittering', { oppdragsSti, filnamn }),

  // Opnar ein ny e-post i skrivebords-Outlook MED EKTE VEDLEGG (COM-
  // automatisering, med fallback til mailto: om Outlook ikkje er
  // tilgjengeleg/feilar — sjå claude/dtm-modul.md).
  dtmOpneEpostMedVedlegg: (mottakar, emne, kropp, stiar) =>
    ipcRenderer.invoke('dtm:opne-epost-med-vedlegg', { mottakar, emne, kropp, stiar }),

  // Native fil-veljar for kvitteringsfil (alternativ til drag-og-slepp,
  // som ikkje er stadfesta å fungere frå Outlook — sjå claude/dtm-modul.md).
  dtmVelgKvitteringsfil: () => ipcRenderer.invoke('dtm:velg-kvitteringsfil'),

  // Rendrar ferdig HTML (bygd av TegningslisteModal.jsx, éi <div class="side">
  // per side) til ei ekte PDF-fil via Chromium sin eigen printToPDF, og
  // lagrar DIREKTE i vald DTM-kategorimappe (ingen «lagre som»-dialog).
  // `snapshotData` (valfri) vert lagra som eit vesle status-JSON attmed PDF-
  // en, brukt til å oppdage KVA CELLER som er endra neste gong same
  // tegningsliste (kategori+dokumentnummer) vert generert.
  dtmGenererTegningslistePdf: (html, oppdragsSti, kategori, filnamn, dokumentnummer, snapshotData) =>
    ipcRenderer.invoke('dtm:generer-tegningsliste-pdf', { html, oppdragsSti, kategori, filnamn, dokumentnummer, snapshotData }),

  // Les status-snapshotet frå FØRRE generering av same tegningsliste (eller
  // null om det ikkje finst nokon endå) — sjå dtmGenererTegningslistePdf.
  dtmLesTegningslisteSnapshot: (oppdragsSti, kategori, dokumentnummer) =>
    ipcRenderer.invoke('dtm:les-tegningsliste-snapshot', { oppdragsSti, kategori, dokumentnummer }),

  // Excel-eksport (Tegningsliste/Dokumentleveranseplan) — same generiske
  // kolonne/rad-oppsett som PDF-en, berre skrive til .xlsx i staden.
  dtmGenererExcel: (rader, kolonnar, oppdragsSti, kategori, filnamn) =>
    ipcRenderer.invoke('dtm:generer-excel', { rader, kolonnar, oppdragsSti, kategori, filnamn }),

  // Opnar det skalerbare sjekkliste-vindauget for kontroll av teikningar
  // (egenkontroll/fagkontroll/godkjenning) — sjå KvalitetModule.jsx og
  // SjekklisteVindauge.jsx.
  ksApneSjekklisteVindauge: (dokumentId, kontrolltype) =>
    ipcRenderer.invoke('ks:apne-sjekkliste-vindauge', { dokumentId, kontrolltype }),

  // Bilete-modulen, sjå claude/bilete-modul.md.
  biliteImporter: (filPathar, oppdragsSti, kjenteNr, brukarNamn) =>
    ipcRenderer.invoke('bilete:importer', { filPathar, oppdragsSti, kjenteNr, brukarNamn }),
  biliteImporterFraBytar: (filer, oppdragsSti, kjenteNr, brukarNamn) =>
    ipcRenderer.invoke('bilete:importer-fra-bytar', { filer, oppdragsSti, kjenteNr, brukarNamn }),
  biliteApneFil: (oppdragsSti, filnamn) =>
    ipcRenderer.invoke('bilete:apne-fil', { oppdragsSti, filnamn }),
})
