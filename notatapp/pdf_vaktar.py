"""
pdf_vaktar.py — Leveransekontroll mappevaktar for Kontor KS-modul
=================================================================
Overvåkar mappa «til kontroll» for nye PDF-filer, les tittelfelt-metadata,
og synkroniserer med Supabase slik at KS-modulen i Kontor viser teikningane.

Ved ferdigstilling: FLYTTAR (ikkje kopierer) filene frå «til kontroll»
til «Kontrollkopiar/<løpenr>_<namn>/».

Mappestruktur:
  <rot>/<prosjektnr>/03 Resultatdokumenter/kontroll/
    ├── til kontroll/          ← brukar legg PDF-ar her
    ├── Kontrollkopiar/        ← ferdigstilte kontrollar hamnar her
    │   ├── 01_Forprosjekt/
    │   ├── 02_Rammesøknad/
    │   └── ...
    └── kontrolldata.json      ← lokal kopi av metadata (backup)

Bruk:
  python pdf_vaktar.py --rot "P:\\Prosjekt" --prosjekt 26001

Krav:
  pip install watchdog pdfplumber supabase --break-system-packages
"""

import os
import sys
import json
import time
import shutil
import argparse
import re
from datetime import datetime
from pathlib import Path

try:
    import pdfplumber
except ImportError:
    pdfplumber = None
    print("[ÅTVARING] pdfplumber ikkje installert — kan ikkje lese tittelfelt.")
    print("           Køyr: pip install pdfplumber --break-system-packages")

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
except ImportError:
    Observer = None
    print("[ÅTVARING] watchdog ikkje installert — kan ikkje overvåke mappa.")
    print("           Køyr: pip install watchdog --break-system-packages")

try:
    from supabase import create_client
except ImportError:
    create_client = None
    print("[INFO] supabase ikkje installert — brukar kun lokal JSON-fil.")


# ── Konfigurasjon ─────────────────────────────────────────
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
TABELL_TEIKNINGAR = "ks_drawings"
TABELL_KONTROLLAR = "ks_controls"

# Kjende initialar → brukar-id (utvidast etter behov)
INITIALAR_MAP = {
    "GML": "gm", "GM": "gm",
    "KL": "kl",
    "OS": "os",
    "MH": "mh",
}


# ── Tittelfelt-parsing ────────────────────────────────────
def parse_filnamn(filnamn):
    """
    Tolkar filnamn på forma: A-20-01_B.pdf → nr=A-20-01, rev=B
    Støttar også: A-20-01 rev B.pdf, A-20-01(B).pdf
    """
    namn = Path(filnamn).stem
    
    # Mønster 1: A-20-01_B
    m = re.match(r'^(.+?)_([A-Z])$', namn)
    if m:
        return m.group(1), m.group(2)
    
    # Mønster 2: A-20-01 rev B
    m = re.match(r'^(.+?)\s+rev\s+([A-Z])$', namn, re.IGNORECASE)
    if m:
        return m.group(1), m.group(2)
    
    # Mønster 3: A-20-01(B)
    m = re.match(r'^(.+?)\(([A-Z])\)$', namn)
    if m:
        return m.group(1), m.group(2)
    
    # Fallback: heile namnet utan revisjon
    return namn, "A"


def les_tittelfelt(pdf_sti):
    """
    Les tittelfelt frå PDF ved å søke etter kjende mønster
    i den siste sida (tittelfeltet ligg vanlegvis der).
    
    Returnerer dict med: tittel, målestokk, teikna_av, ek_person, fk_person
    """
    resultat = {
        "tittel": "",
        "målestokk": "",
        "teikna_av": "",
        "ek_person": "",
        "fk_person": "",
        "dato": "",
        "format": "",
    }
    
    if not pdfplumber:
        return resultat
    
    try:
        with pdfplumber.open(pdf_sti) as pdf:
            if len(pdf.pages) == 0:
                return resultat
            
            # Les siste side (tittelfeltet)
            siste = pdf.pages[-1]
            tekst = siste.extract_text() or ""
            
            # Prøv også fyrste side viss siste er tom
            if len(tekst.strip()) < 20 and len(pdf.pages) > 1:
                tekst = (pdf.pages[0].extract_text() or "") + "\n" + tekst
            
            linjer = tekst.split("\n")
            
            for linje in linjer:
                l = linje.strip()
                
                # Målestokk
                m = re.search(r'(?:målestokk|scale|m[aå]l)\s*[:\s]*(\d+\s*:\s*\d+)', l, re.IGNORECASE)
                if m:
                    resultat["målestokk"] = m.group(1).replace(" ", "")
                
                # Direkte målestokk-format
                m = re.search(r'\b(1\s*:\s*\d+)\b', l)
                if m and not resultat["målestokk"]:
                    resultat["målestokk"] = m.group(1).replace(" ", "")
                
                # Tittel (ofte etter "tittel:" eller "title:")
                m = re.search(r'(?:tittel|title|teikning)\s*[:\s]+(.+)', l, re.IGNORECASE)
                if m and not resultat["tittel"]:
                    resultat["tittel"] = m.group(1).strip()
                
                # Teikna av
                m = re.search(r'(?:teikna|tegnet|drawn|drwn)\s*(?:av|by)?\s*[:\s]+(\w{2,4})', l, re.IGNORECASE)
                if m:
                    resultat["teikna_av"] = m.group(1).upper()
                
                # Egenkontroll
                m = re.search(r'(?:egenkontroll|kontrollert|checked|chkd|ek)\s*(?:av|by)?\s*[:\s]+(\w{2,4})', l, re.IGNORECASE)
                if m:
                    resultat["ek_person"] = m.group(1).upper()
                
                # Fagkontroll
                m = re.search(r'(?:fagkontroll|godkjent|approved|appd|fk)\s*(?:av|by)?\s*[:\s]+(\w{2,4})', l, re.IGNORECASE)
                if m:
                    resultat["fk_person"] = m.group(1).upper()
                
                # Dato
                m = re.search(r'(?:dato|date)\s*[:\s]+(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})', l, re.IGNORECASE)
                if m:
                    resultat["dato"] = m.group(1)
                
                # Format (A1, A2, A3 etc.)
                m = re.search(r'\b(A[0-4])\b', l)
                if m and not resultat["format"]:
                    resultat["format"] = m.group(1)
            
            # Fallback tittel: bruk filnamnet
            if not resultat["tittel"]:
                nr, rev = parse_filnamn(os.path.basename(pdf_sti))
                resultat["tittel"] = nr
    
    except Exception as e:
        print(f"  [FEIL] Kunne ikkje lese tittelfelt: {e}")
    
    return resultat


def map_initialar(ini):
    """Mapper initialar til brukar-id"""
    return INITIALAR_MAP.get(ini.upper(), ini.lower()) if ini else ""


# ── Supabase-synkronisering ───────────────────────────────
class SupabaseSync:
    def __init__(self):
        self.client = None
        if create_client and SUPABASE_URL and SUPABASE_KEY:
            try:
                self.client = create_client(SUPABASE_URL, SUPABASE_KEY)
                print("[SUPABASE] Kopla til Supabase.")
            except Exception as e:
                print(f"[SUPABASE] Klarte ikkje kople til: {e}")
    
    def upsert_teikning(self, data):
        if not self.client:
            return
        try:
            self.client.table(TABELL_TEIKNINGAR).upsert(data, on_conflict="project_nr,drawing_nr,revision").execute()
        except Exception as e:
            print(f"  [SUPABASE FEIL] {e}")
    
    def slett_teikning(self, prosjekt_nr, teiknings_nr, revisjon):
        if not self.client:
            return
        try:
            self.client.table(TABELL_TEIKNINGAR).delete().match({
                "project_nr": prosjekt_nr,
                "drawing_nr": teiknings_nr,
                "revision": revisjon,
            }).execute()
        except Exception as e:
            print(f"  [SUPABASE FEIL] {e}")


# ── Lokal JSON-lagring (backup / offline) ─────────────────
class LokalLagring:
    def __init__(self, json_sti):
        self.sti = json_sti
        self.data = self._les()
    
    def _les(self):
        if os.path.exists(self.sti):
            with open(self.sti, "r", encoding="utf-8") as f:
                return json.load(f)
        return {"teikningar": [], "kontrollar": []}
    
    def _lagre(self):
        os.makedirs(os.path.dirname(self.sti), exist_ok=True)
        with open(self.sti, "w", encoding="utf-8") as f:
            json.dump(self.data, f, indent=2, ensure_ascii=False)
    
    def upsert_teikning(self, entry):
        eksisterande = [t for t in self.data["teikningar"]
                       if t["nr"] == entry["nr"] and t["rev"] == entry["rev"]]
        if eksisterande:
            idx = self.data["teikningar"].index(eksisterande[0])
            self.data["teikningar"][idx] = entry
        else:
            self.data["teikningar"].append(entry)
        self._lagre()
    
    def fjern_teikning(self, nr, rev):
        self.data["teikningar"] = [t for t in self.data["teikningar"]
                                    if not (t["nr"] == nr and t["rev"] == rev)]
        self._lagre()
    
    def registrer_kontroll(self, kontroll):
        self.data["kontrollar"].append(kontroll)
        self._lagre()


# ── Skann mappa ───────────────────────────────────────────
def skann_mappe(til_kontroll_sti, prosjekt_nr, lokal, supabase):
    """Skannar alle PDF-ar i «til kontroll»-mappa og registrerer dei."""
    print(f"\n[SKANN] Skannar {til_kontroll_sti}")
    
    if not os.path.exists(til_kontroll_sti):
        print(f"  Mappa finst ikkje: {til_kontroll_sti}")
        return []
    
    teikningar = []
    
    for fil in sorted(os.listdir(til_kontroll_sti)):
        if not fil.lower().endswith(".pdf"):
            continue
        
        full_sti = os.path.join(til_kontroll_sti, fil)
        nr, rev = parse_filnamn(fil)
        
        print(f"  📄 {fil}")
        print(f"     Nr: {nr}  Rev: {rev}")
        
        # Les tittelfelt
        meta = les_tittelfelt(full_sti)
        print(f"     Tittel: {meta['tittel']}")
        print(f"     Målestokk: {meta['målestokk']}")
        print(f"     EK: {meta['ek_person']}  FK: {meta['fk_person']}")
        
        entry = {
            "nr": nr,
            "rev": rev,
            "tittel": meta["tittel"] or nr,
            "målestokk": meta["målestokk"],
            "teikna_av": map_initialar(meta["teikna_av"]),
            "ek_person": map_initialar(meta["ek_person"]),
            "fk_person": map_initialar(meta["fk_person"]),
            "dato": meta["dato"],
            "format": meta["format"],
            "filnamn": fil,
            "filsti": full_sti,
            "skanna": datetime.now().isoformat(),
        }
        
        teikningar.append(entry)
        lokal.upsert_teikning(entry)
        
        supabase.upsert_teikning({
            "project_nr": prosjekt_nr,
            "drawing_nr": nr,
            "revision": rev,
            "title": entry["tittel"],
            "scale": entry["målestokk"],
            "drawn_by": entry["teikna_av"],
            "ek_person": entry["ek_person"],
            "fk_person": entry["fk_person"],
            "file_name": fil,
            "scanned_at": entry["skanna"],
        })
    
    print(f"  → {len(teikningar)} teikningar registrert.\n")
    return teikningar


# ── Ferdigstilling: FLYTT filer ───────────────────────────
def ferdigstill_kontroll(til_kontroll_sti, kontrollkopiar_sti,
                          kontroll_lnr, kontroll_namn, filnamn_liste,
                          lokal, supabase, prosjekt_nr):
    """
    FLYTTAR (ikkje kopierer!) teikningane frå «til kontroll» til
    «Kontrollkopiar/<lnr>_<namn>/» og oppdaterer registeret.
    """
    mappenamn = f"{kontroll_lnr}_{kontroll_namn.replace(' ', '_')}"
    mål_mappe = os.path.join(kontrollkopiar_sti, mappenamn)
    os.makedirs(mål_mappe, exist_ok=True)
    
    print(f"\n[FERDIGSTILL] Kontroll {kontroll_lnr}: {kontroll_namn}")
    print(f"  Mål: {mål_mappe}")
    
    flytta = []
    
    for filnamn in filnamn_liste:
        kjelde = os.path.join(til_kontroll_sti, filnamn)
        mål = os.path.join(mål_mappe, filnamn)
        
        if not os.path.exists(kjelde):
            print(f"  ⚠ Fann ikkje: {filnamn}")
            continue
        
        # FLYTT fila (ikkje kopi!)
        shutil.move(kjelde, mål)
        print(f"  ✓ {filnamn} → {mappenamn}/")
        flytta.append(filnamn)
        
        # Fjern frå «til kontroll»-registeret
        nr, rev = parse_filnamn(filnamn)
        lokal.fjern_teikning(nr, rev)
        supabase.slett_teikning(prosjekt_nr, nr, rev)
    
    # Registrer kontrollen i logg
    kontroll_logg = {
        "lnr": kontroll_lnr,
        "namn": kontroll_namn,
        "dato": datetime.now().isoformat(),
        "filer": flytta,
        "mål_mappe": mål_mappe,
    }
    lokal.registrer_kontroll(kontroll_logg)
    
    print(f"  → {len(flytta)} filer flytta.\n")
    return flytta


# ── Filsystem-vaktar ──────────────────────────────────────
class PDFHandler(FileSystemEventHandler):
    def __init__(self, prosjekt_nr, lokal, supabase, til_kontroll_sti):
        self.prosjekt_nr = prosjekt_nr
        self.lokal = lokal
        self.supabase = supabase
        self.sti = til_kontroll_sti
    
    def on_created(self, event):
        if event.is_directory:
            return
        if not event.src_path.lower().endswith(".pdf"):
            return
        
        # Vent litt slik at fila er ferdig skriven
        time.sleep(1)
        
        fil = os.path.basename(event.src_path)
        print(f"\n[NY FIL] {fil}")
        skann_mappe(self.sti, self.prosjekt_nr, self.lokal, self.supabase)
    
    def on_deleted(self, event):
        if event.is_directory:
            return
        if not event.src_path.lower().endswith(".pdf"):
            return
        
        fil = os.path.basename(event.src_path)
        nr, rev = parse_filnamn(fil)
        print(f"\n[SLETTA] {fil}")
        self.lokal.fjern_teikning(nr, rev)
        self.supabase.slett_teikning(self.prosjekt_nr, nr, rev)


# ── Hovudprogram ──────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="KS Leveransekontroll — PDF-vaktar")
    parser.add_argument("--rot", required=True, help="Rotmappe for prosjekt (t.d. P:\\Prosjekt)")
    parser.add_argument("--prosjekt", required=True, help="Prosjektnummer (t.d. 26001)")
    parser.add_argument("--skann", action="store_true", help="Berre skann éin gong, ikkje overvåk")
    parser.add_argument("--ferdigstill", type=str, help="Ferdigstill kontroll: format 'lnr:namn:fil1.pdf,fil2.pdf'")
    args = parser.parse_args()
    
    # Bygg stiar
    kontroll_rot = os.path.join(args.rot, args.prosjekt, "03 Resultatdokumenter", "kontroll")
    til_kontroll = os.path.join(kontroll_rot, "til kontroll")
    kontrollkopiar = os.path.join(kontroll_rot, "Kontrollkopiar")
    json_sti = os.path.join(kontroll_rot, "kontrolldata.json")
    
    print("=" * 60)
    print(f"  KS Leveransekontroll — PDF-vaktar")
    print(f"  Prosjekt:      {args.prosjekt}")
    print(f"  Til kontroll:  {til_kontroll}")
    print(f"  Kontrollkopiar:{kontrollkopiar}")
    print("=" * 60)
    
    # Opprett mapper om dei ikkje finst
    os.makedirs(til_kontroll, exist_ok=True)
    os.makedirs(kontrollkopiar, exist_ok=True)
    
    # Init lagring
    lokal = LokalLagring(json_sti)
    supabase = SupabaseSync()
    
    # Ferdigstilling
    if args.ferdigstill:
        delar = args.ferdigstill.split(":")
        if len(delar) != 3:
            print("FEIL: --ferdigstill format: 'lnr:namn:fil1.pdf,fil2.pdf'")
            sys.exit(1)
        lnr, namn, filer = delar[0], delar[1], delar[2].split(",")
        ferdigstill_kontroll(til_kontroll, kontrollkopiar, lnr, namn, filer,
                             lokal, supabase, args.prosjekt)
        return
    
    # Fyrste skanning
    skann_mappe(til_kontroll, args.prosjekt, lokal, supabase)
    
    if args.skann:
        print("Eingangs-skann ferdig.")
        return
    
    # Start overvåking
    if not Observer:
        print("Kan ikkje overvåke utan watchdog. Køyr med --skann for eingangs-skann.")
        return
    
    handler = PDFHandler(args.prosjekt, lokal, supabase, til_kontroll)
    observer = Observer()
    observer.schedule(handler, til_kontroll, recursive=False)
    observer.start()
    
    print(f"[VAKTAR] Overvåkar {til_kontroll}")
    print("         Trykk Ctrl+C for å stoppe.\n")
    
    try:
        while True:
            time.sleep(2)
    except KeyboardInterrupt:
        observer.stop()
        print("\n[STOPPA] Vaktaren er stoppa.")
    
    observer.join()


if __name__ == "__main__":
    main()
