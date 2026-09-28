// The two passport sets the app works with. "real" = backfilled from the public reports in the
// corpus (Tier 1, only what was disclosed); "demo" = 17 fictional Tier-2 passports from the
// MineWater Passport prototype, showing what full reporting makes possible. Never mix them silently.
import rawCorpus from "@/lib/data/corpus.json";
import demo from "@/lib/data/passports-demo.json";
import type { Corpus } from "@/lib/corpus/types";
import { backfilledPassports } from "./fromCorpus";
import type { Passport } from "./metrics";

export type PassportSet = "real" | "demo";

let cache: Passport[] | null = null;

export function realPassports(): Passport[] {
  if (cache) return cache;
  const corpus = rawCorpus as Corpus;
  const locations = corpus.sites.map((s) => ({ company: s.company, site: s.site, lat: s.lat ?? null, lon: s.lon ?? null, precision: s.locationPrecision ?? "none", place: s.place }));
  cache = backfilledPassports(corpus, locations);
  return cache;
}

export const demoPassports = (): Passport[] => (demo as unknown as Passport[]).map((p) => ({ ...p, origin: "passport" as const }));

export const passportsFor = (set: PassportSet) => (set === "real" ? realPassports() : demoPassports());

export const SET_LABEL: Record<PassportSet, { short: string; long: string }> = {
  real: { short: "Disclosed (real)", long: "Real sites backfilled from 24 public reports: only what the companies disclosed" },
  demo: { short: "Passport demo (fictional)", long: "17 fictional sites reported in full MineWater Passport Tier 2 format: what complete data enables" },
};
