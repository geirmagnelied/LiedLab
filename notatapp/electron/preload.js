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
})
