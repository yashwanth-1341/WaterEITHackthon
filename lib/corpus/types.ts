// Multi-company corpus: long-format records extracted from published reports.
// One record = one number, as stated in one file. Volumes in megalitres (ML).
// Built by scripts/build-corpus.ts from data/extracted/*.json.

export type WaterMetric =
  | "withdrawal_total"
  | "withdrawal_surface"
  | "withdrawal_ground"
  | "withdrawal_sea"
  | "withdrawal_third_party"
  | "withdrawal_rain_runoff"
  | "withdrawal_entrained_ore"
  | "withdrawal_other"
  | "withdrawal_fresh"
  | "withdrawal_low_quality"
  | "withdrawal_water_stressed"
  | "discharge_total"
  | "discharge_surface"
  | "discharge_ground"
  | "discharge_sea"
  | "discharge_third_party"
  | "consumption_total"
  | "reused_recycled"
  | "reuse_rate_pct"
  | "water_stored_change";

export type ProductionMetric =
  | "ore_processed_t"
  | "copper_production_t"
  | "gold_production_oz"
  | "silver_production_oz"
  | "zinc_production_t"
  | "nickel_production_t"
  | "iron_ore_production_t"
  | "coal_production_t"
  | "molybdenum_production_t";

export type Metric = WaterMetric | ProductionMetric | "water_intensity_reported" | "water_incidents_count" | "water_fines_usd" | `other:${string}`;

export const CORPORATE = "_corporate";

/** Subtotal rows reported alongside sites (e.g. "Copper Mining - Total"). Kept for checks, never summed. */
export const isAggregate = (site: string) => /\b(sub)?totals?\b|\baggregate\b/i.test(site);

export interface CorpusRecord {
  company: string;
  site: string;
  year: number;
  metric: Metric;
  value: number;
  rawValue?: string;
  rawUnit?: string;
  sourceFile: string;
  location: string;
  note?: string;
}

export interface CorpusFile {
  file: string;
  company: string;
  relevant: boolean;
  yearsCovered: number[];
  granularity?: string;
  reason: string;
  /** SHA-256 of the file as first ingested. The tamper baseline. */
  sha256: string | null;
}

export interface CorpusSite {
  company: string;
  site: string;
  country: string | null;
  commodity: string[];
  waterStressReported: string | null;
  status: string | null;
  /** Approximate location (data/extracted/_site_locations.json), null if not locatable. */
  lat?: number | null;
  lon?: number | null;
  locationPrecision?: string;
  place?: string;
}

/** A documented change of basis in a company's series (method, scope, classification). */
export interface SeriesBreak {
  company: string;
  /** First year on the new basis ("break"), or the one year to leave out ("exclude"). */
  year: number;
  indicators: string[] | "all";
  kind: "break" | "exclude";
  reason: string;
  source: string;
}

export interface Corpus {
  builtAt: string;
  breaks: SeriesBreak[];
  companies: string[];
  files: CorpusFile[];
  sites: CorpusSite[];
  records: CorpusRecord[];
  observations: { company: string; text: string }[];
}

export const METRIC_LABEL: Record<string, string> = {
  withdrawal_total: "Total withdrawal",
  withdrawal_fresh: "Freshwater withdrawal",
  withdrawal_low_quality: "Low-quality water withdrawal",
  withdrawal_water_stressed: "Withdrawal in water-stressed areas",
  withdrawal_surface: "Surface water",
  withdrawal_ground: "Groundwater",
  withdrawal_sea: "Seawater",
  withdrawal_third_party: "Third-party water",
  withdrawal_rain_runoff: "Rainfall and runoff",
  withdrawal_entrained_ore: "Water entrained in ore",
  withdrawal_other: "Other withdrawal",
  discharge_total: "Total discharge",
  consumption_total: "Consumption",
  reused_recycled: "Reused and recycled water",
  reuse_rate_pct: "Reuse rate",
  ore_processed_t: "Ore processed",
  copper_production_t: "Copper produced",
  gold_production_oz: "Gold produced",
};
