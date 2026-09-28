// Backfilled passports: every real site in the corpus, as a Mine Water Passport for its latest
// disclosed year. Only what the report states is filled in. Metering status (dq), water-quality
// category and assurance are left empty unless disclosed, so the transparency score shows the gap
// instead of hiding it.
import { canonical } from "@/lib/corpus/series";
import { CORPORATE, isAggregate, type Corpus, type CorpusRecord } from "@/lib/corpus/types";
import type { Passport, StressKey, Withdrawal } from "./metrics";

const COMMODITY: Record<string, string> = {
  copper: "Cu",
  gold: "Au",
  silver: "Ag",
  lithium: "Li",
  nickel: "Ni",
  cobalt: "Co",
  zinc: "Zn",
  lead: "Pb",
  molybdenum: "Mo",
  "iron ore": "Fe",
  iron: "Fe",
  coal: "Coal",
  "metallurgical coal": "Coal",
  "energy coal": "Coal",
  potash: "K",
  diamonds: "Diamonds",
  platinum: "PGM",
  "platinum group metals": "PGM",
};
export const commoditySymbol = (c: string) => COMMODITY[c.toLowerCase().trim()] ?? c;

/** Company-reported stress labels → WRI Aqueduct-style categories. */
function stressKey(s: string | null): StressKey | null {
  if (!s) return null;
  const t = s.toLowerCase();
  if (/arid/.test(t)) return "arid_low_water_use";
  if (/extreme|very high/.test(t)) return "extremely_high";
  if (/\bhigh\b/.test(t) && !/medium/.test(t)) return "high";
  if (/medium/.test(t)) return "medium_high";
  if (/low/.test(t)) return "low";
  return null;
}

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const OZ_TO_T = 31.1034768 / 1e6;

export interface Location {
  company: string;
  site: string;
  lat: number | null;
  lon: number | null;
  precision: string;
  place?: string;
  confidence?: string;
}

export function backfilledPassports(corpus: Corpus, locations: Location[] = []): Passport[] {
  const canon = canonical(corpus);
  const loc = new Map(locations.map((l) => [`${l.company}|${l.site}`, l]));
  const bySite = new Map<string, CorpusRecord[]>();
  for (const r of canon.values()) {
    if (r.site === CORPORATE || isAggregate(r.site)) continue;
    const k = `${r.company}|${r.site}`;
    bySite.set(k, [...(bySite.get(k) ?? []), r]);
  }
  const out: Passport[] = [];
  for (const [k, recs] of bySite) {
    const [company, site] = k.split("|");
    const waterYears = recs.filter((r) => r.metric.startsWith("withdrawal") || r.metric === "consumption_total").map((r) => r.year);
    if (!waterYears.length) continue;
    const year = Math.max(...waterYears);
    const at = (m: string) => recs.find((r) => r.year === year && r.metric === m)?.value;
    const meta = corpus.sites.find((s) => s.company === company && s.site === site);
    const l = loc.get(k);

    const withdrawals: Withdrawal[] = [];
    const add = (m: string, w: Omit<Withdrawal, "volume_ml">) => {
      const v = at(m);
      if (v !== undefined && v > 0) withdrawals.push({ ...w, volume_ml: v });
    };
    add("withdrawal_surface", { source: "surface_water" });
    add("withdrawal_rain_runoff", { source: "surface_water", subtype: "precipitation_runoff" });
    add("withdrawal_ground", { source: "groundwater" });
    add("withdrawal_entrained_ore", { source: "groundwater", subtype: "ore_entrainment" });
    add("withdrawal_sea", { source: "seawater", quality: "cat3" });
    add("withdrawal_third_party", { source: "third_party" });
    const total = at("withdrawal_total");
    const parts = withdrawals.reduce((a, w) => a + w.volume_ml, 0);
    // Only a total, or a total larger than the itemised sources: the rest is withdrawal of unstated source.
    if (total !== undefined && total - parts > Math.max(1, 0.02 * total)) withdrawals.push({ volume_ml: total - parts });

    const discharge = at("discharge_total");
    const products = [
      ["Cu", at("copper_production_t")],
      ["Au", at("gold_production_oz") !== undefined ? at("gold_production_oz")! * OZ_TO_T : undefined],
      ["Zn", at("zinc_production_t")],
      ["Ni", at("nickel_production_t")],
      ["Mo", at("molybdenum_production_t")],
    ]
      .filter((p): p is [string, number] => typeof p[1] === "number" && p[1] > 0)
      .map(([commodity, t]) => ({ commodity, metal_content_t: t, basis: "contained_metal" as const }));
    const primary = meta?.commodity[0] ? commoditySymbol(meta.commodity[0]) : products[0]?.commodity;
    const stress = stressKey(meta?.waterStressReported ?? null) ?? ((at("withdrawal_water_stressed") ?? 0) > 0 ? "high" : null);
    const stored = at("water_stored_change");

    out.push({
      passport_version: "0.1",
      origin: "backfilled",
      tier: "tier1",
      site: {
        site_id: `BF-${slug(company)}-${slug(site)}`,
        name: site,
        operator: company,
        country: meta?.country ?? "",
        latitude: l?.lat ?? null,
        longitude: l?.lon ?? null,
        location_precision: l?.precision,
        primary_commodity: primary,
        lifecycle_stage: meta?.status ?? undefined,
        basin: stress ? { bws_category: stress, bws_source: "company-reported classification" } : undefined,
      },
      period: { year },
      production: { products: products.length ? products : undefined, ore_processed_t: at("ore_processed_t") },
      water: {
        withdrawals,
        discharges: discharge !== undefined ? [{ destination: "not specified", volume_ml: discharge }] : undefined,
        consumption: { total_ml: at("consumption_total") },
        reuse: { reused_recycled_ml: at("reused_recycled") },
        storage: stored !== undefined ? { change_ml: stored } : undefined,
      },
      assurance: {},
      context: at("water_incidents_count") !== undefined ? { water_incidents: at("water_incidents_count") } : undefined,
      sources: [...new Set(recs.filter((r) => r.year === year).map((r) => r.sourceFile))].map((title) => ({ title })),
    });
  }
  return out.sort((a, b) => (a.site.operator ?? "").localeCompare(b.site.operator ?? "") || a.site.name.localeCompare(b.site.name));
}
