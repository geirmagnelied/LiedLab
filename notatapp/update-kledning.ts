// supabase/functions/update-kledning/index.ts
// ═══════════════════════════════════════════════════════════
// Supabase Edge Function: Auto-oppdatering av kledningsprodukt
// Køyrer den 1. og 14. kvar månad via pg_cron
// Hentar profilar og dimensjonar frå Bergene Holm, Moelven og MøreRoyal
// ═══════════════════════════════════════════════════════════
//
// pg_cron setup (køyr i SQL Editor):
//
//   SELECT cron.schedule(
//     'update-kledning-1st',
//     '0 6 1 * *',
//     $$SELECT net.http_post(
//       url := 'https://<project-ref>.supabase.co/functions/v1/update-kledning',
//       headers := '{"Authorization": "Bearer <service-role-key>"}'::jsonb
//     )$$
//   );
//
//   SELECT cron.schedule(
//     'update-kledning-14th',
//     '0 6 14 * *',
//     $$SELECT net.http_post(
//       url := 'https://<project-ref>.supabase.co/functions/v1/update-kledning',
//       headers := '{"Authorization": "Bearer <service-role-key>"}'::jsonb
//     )$$
//   );
//
// Tabell (køyr i SQL Editor):
//
//   CREATE TABLE IF NOT EXISTS kledning_products (
//     id          TEXT PRIMARY KEY,
//     supplier    TEXT NOT NULL,
//     name        TEXT NOT NULL,
//     orient      TEXT NOT NULL DEFAULT 'b',
//     dims        JSONB DEFAULT '[]',
//     description TEXT DEFAULT '',
//     fals        INT,
//     source_url  TEXT DEFAULT '',
//     updated_at  TIMESTAMPTZ DEFAULT NOW()
//   );
//
//   CREATE TABLE IF NOT EXISTS kledning_sync_log (
//     id          BIGSERIAL PRIMARY KEY,
//     supplier    TEXT NOT NULL,
//     status      TEXT NOT NULL,
//     products    INT DEFAULT 0,
//     error       TEXT,
//     run_at      TIMESTAMPTZ DEFAULT NOW()
//   );

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Leverandør-konfigurasjoner ──────────────────────────

interface Product {
  id: string;
  supplier: string;
  name: string;
  orient: string;
  dims: string[];
  description: string;
  fals?: number;
  source_url: string;
}

// ── Bergene Holm ────────────────────────────────────────
async function fetchBergeneHolm(): Promise<Product[]> {
  const url = "https://www.bergeneholm.no/produkter/?m=Eksteri%C3%B8r&c=Kledning";
  const products: Product[] = [];

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Kontor-KledningSync/1.0 (arkitektverktoy)" },
    });
    const html = await res.text();

    // Parse profil-filter frå HTML
    // Bergene Holm brukar filter-tags i sideinnhaldet
    const profileMatches = html.matchAll(
      /data-profile="([^"]+)"[^>]*>([^<]+)</g
    );

    const profiles = new Set<string>();
    for (const m of profileMatches) {
      profiles.add(m[1].trim());
    }

    // Parse produktkort for dimensjonar
    const productBlocks = html.matchAll(
      /<div[^>]*class="[^"]*product-card[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g
    );

    const dimsByProfile: Record<string, Set<string>> = {};
    for (const block of productBlocks) {
      const content = block[1];
      // Hent profilnamn
      const nameMatch = content.match(/class="[^"]*product-name[^"]*"[^>]*>([^<]+)/);
      // Hent dimensjon (t.d. "19x148")
      const dimMatch = content.match(/(\d{2})x(\d{2,3})/);

      if (nameMatch && dimMatch) {
        const profile = nameMatch[1].trim();
        const dim = `${dimMatch[1]}×${dimMatch[2]}`;

        if (!dimsByProfile[profile]) dimsByProfile[profile] = new Set();
        dimsByProfile[profile].add(dim);
      }
    }

    // Bygg produktliste
    for (const [profile, dims] of Object.entries(dimsByProfile)) {
      const orient = detectOrient(profile);
      const fals = detectFals(profile);

      products.push({
        id: `bh_${slugify(profile)}`,
        supplier: "bh",
        name: profile,
        orient,
        dims: Array.from(dims).sort(),
        description: `Bergene Holm ${profile}`,
        fals,
        source_url: url,
      });
    }
  } catch (err) {
    console.error("Bergene Holm feil:", err);
    throw err;
  }

  return products;
}

// ── Moelven ─────────────────────────────────────────────
async function fetchMoelven(): Promise<Product[]> {
  const url = "https://www.moelven.com/no/no/fasade-og-utemiljo/kledning/";
  const products: Product[] = [];

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Kontor-KledningSync/1.0 (arkitektverktoy)" },
    });
    const html = await res.text();

    // Moelven har filter-knappar med profilnamn
    const filterMatches = html.matchAll(
      /data-filter-value="([^"]+)"[^>]*>[^<]*<span[^>]*>([^<]+)/g
    );

    const profileNames: string[] = [];
    for (const m of filterMatches) {
      if (m[1] && !["Vis alle", "Gran", "Furu", "Ask"].includes(m[2].trim())) {
        profileNames.push(m[2].trim());
      }
    }

    // Hent individuelle produktsider for dimensjonar
    const productLinks = html.matchAll(
      /href="(\/no\/no\/fasade-og-utemiljo\/kledning\/[^"]+)"/g
    );

    const visited = new Set<string>();
    for (const link of productLinks) {
      const productUrl = `https://www.moelven.com${link[1]}`;
      if (visited.has(productUrl)) continue;
      visited.add(productUrl);

      try {
        const pRes = await fetch(productUrl, {
          headers: { "User-Agent": "Kontor-KledningSync/1.0" },
        });
        const pHtml = await pRes.text();

        // Hent produktnamn
        const titleMatch = pHtml.match(/<h1[^>]*>([^<]+)<\/h1>/);
        if (!titleMatch) continue;

        const name = titleMatch[1]
          .replace(/^(Ubehandlet|Heftig \w+)\s+(gran|furu|ask)\s+/i, "")
          .trim();

        // Hent dimensjonar
        const dims = new Set<string>();
        const dimMatches = pHtml.matchAll(/(\d{2})x(\d{2,3})/g);
        for (const dm of dimMatches) {
          dims.add(`${dm[1]}×${dm[2]}`);
        }

        if (dims.size > 0) {
          const id = `mo_${slugify(name)}`;
          if (!products.find((p) => p.id === id)) {
            products.push({
              id,
              supplier: "mo",
              name,
              orient: detectOrient(name),
              dims: Array.from(dims).sort(),
              description: `Moelven ${name}`,
              fals: detectFals(name),
              source_url: productUrl,
            });
          }
        }
      } catch {
        // Ignorer individuelle feil
      }
    }
  } catch (err) {
    console.error("Moelven feil:", err);
    throw err;
  }

  return products;
}

// ── MøreRoyal (Talgø) ───────────────────────────────────
async function fetchMoreRoyal(): Promise<Product[]> {
  const url = "https://talgo.no/kledning-og-fasade/";
  const products: Product[] = [];

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Kontor-KledningSync/1.0" },
    });
    const html = await res.text();

    // Talgø har produktlenker på hovudsida
    const productLinks = html.matchAll(
      /href="(https:\/\/talgo\.no\/produkter\/[^"]+)"/g
    );

    const visited = new Set<string>();
    for (const link of productLinks) {
      const productUrl = link[1];
      if (visited.has(productUrl)) continue;
      visited.add(productUrl);

      try {
        const pRes = await fetch(productUrl, {
          headers: { "User-Agent": "Kontor-KledningSync/1.0" },
        });
        const pHtml = await pRes.text();

        const titleMatch = pHtml.match(/<h1[^>]*>([^<]+)<\/h1>/);
        if (!titleMatch) continue;

        const name = titleMatch[1].trim();
        const dims = new Set<string>();
        const dimMatches = pHtml.matchAll(/(\d{2})x(\d{2,3})/g);
        for (const dm of dimMatches) {
          dims.add(`${dm[1]}×${dm[2]}`);
        }

        if (dims.size > 0) {
          products.push({
            id: `mr_${slugify(name)}`,
            supplier: "mr",
            name,
            orient: detectOrient(name),
            dims: Array.from(dims).sort(),
            description: `MøreRoyal ${name}. Royalimpregnert.`,
            fals: detectFals(name),
            source_url: productUrl,
          });
        }
      } catch {
        // Ignorer
      }
    }
  } catch (err) {
    console.error("MøreRoyal feil:", err);
    throw err;
  }

  return products;
}

// ── Hjelparar ───────────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[æ]/g, "ae")
    .replace(/[ø]/g, "oe")
    .replace(/[å]/g, "aa")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function detectOrient(name: string): string {
  const n = name.toLowerCase();
  // Profilar som hovudsakleg er liggjande
  if (
    n.includes("vestland") ||
    n.includes("tiur") ||
    n.includes("skygge") ||
    (n.includes("enkelfals") && !n.includes("staff"))
  )
    return "l";
  // Profilar som hovudsakleg er ståande
  if (
    n.includes("rektangul") ||
    n.includes("sveitser") ||
    n.includes("barokk") ||
    n.includes("buer") ||
    n.includes("krager") ||
    n.includes("perlestaff") ||
    n.includes("polse") ||
    n.includes("pølse") ||
    n.includes("empire") ||
    n.includes("rustikk") ||
    n.includes("skrå")
  )
    return "s";
  // Dobbelfals 28/60 er typisk liggjande
  if (n.includes("dobbelfals 28") || n.includes("dobbelfals 60")) return "l";
  // Resten kan brukast begge vegar
  return "b";
}

function detectFals(name: string): number | undefined {
  const m = name.match(/(\d+)\s*°/);
  if (m) return parseInt(m[1]);
  return undefined;
}

// ── Hovudfunksjon ───────────────────────────────────────

serve(async (req: Request) => {
  const results: Record<string, { status: string; count: number; error?: string }> = {};

  // Hent frå alle leverandørar
  const fetchers = [
    { key: "bh", fn: fetchBergeneHolm },
    { key: "mo", fn: fetchMoelven },
    { key: "mr", fn: fetchMoreRoyal },
  ];

  let totalProducts = 0;

  for (const f of fetchers) {
    try {
      const products = await f.fn();
      totalProducts += products.length;

      // Upsert til Supabase
      for (const p of products) {
        await supabase.from("kledning_products").upsert(
          {
            id: p.id,
            supplier: p.supplier,
            name: p.name,
            orient: p.orient,
            dims: p.dims,
            description: p.description,
            fals: p.fals,
            source_url: p.source_url,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
      }

      results[f.key] = { status: "ok", count: products.length };

      // Logg suksess
      await supabase.from("kledning_sync_log").insert({
        supplier: f.key,
        status: "ok",
        products: products.length,
      });
    } catch (err: any) {
      results[f.key] = {
        status: "feil",
        count: 0,
        error: err.message || String(err),
      };

      // Logg feil
      await supabase.from("kledning_sync_log").insert({
        supplier: f.key,
        status: "feil",
        products: 0,
        error: err.message || String(err),
      });
    }
  }

  return new Response(
    JSON.stringify({
      message: "Kledningsoppdatering fullført",
      timestamp: new Date().toISOString(),
      total_products: totalProducts,
      results,
    }),
    {
      headers: { "Content-Type": "application/json" },
      status: 200,
    }
  );
});
