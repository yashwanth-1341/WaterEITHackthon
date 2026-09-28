// Small non-visual helpers shared by SupplyChainView and ReportCardView.
import { QUALITY_COLOR, type Passport, type Quality } from "@/lib/passport/metrics";

export const COMMODITY_NAME: Record<string, string> = {
  Cu: "Copper",
  Li: "Lithium (LCE)",
  Ni: "Nickel",
  Co: "Cobalt",
  Au: "Gold",
  Zn: "Zinc",
  Mo: "Molybdenum",
  Ag: "Silver",
};

export const BATTERY = new Set(["Li", "Ni", "Co"]);

export const unitFor = (commodity: string) => (commodity === "Li" ? "m³/t LCE" : `m³/t ${commodity}`);

export const QUALITY_KEYS: (Quality | "unknown")[] = ["cat1", "cat2", "cat3", "unknown"];
export const QUALITY_SHORT: Record<Quality | "unknown", string> = { cat1: "Cat 1", cat2: "Cat 2", cat3: "Cat 3", unknown: "Quality not stated" };
export { QUALITY_COLOR };

export const isFiniteNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export const shortName = (name: string) => name.replace(/ \(project\)/, "*");

/** Human mine-type / route strings for the card header. */
export function siteDescriptor(r: Passport) {
  const s = r.site;
  const mt = s.mine_type ? s.mine_type.replace(/_/g, " ") : null;
  const route = s.processing_route?.length ? s.processing_route.map((x) => x.replace(/_/g, " ")).join(" + ") : null;
  return [mt && mt[0].toUpperCase() + mt.slice(1), route, s.lifecycle_stage].filter(Boolean).join(" · ");
}

export const coords = (r: Passport) =>
  isFiniteNum(r.site.latitude) && isFiniteNum(r.site.longitude) ? `${r.site.latitude.toFixed(2)}, ${r.site.longitude.toFixed(2)}` : "coordinates not disclosed";

export const assuranceText = (r: Passport) => (r.assurance.level ? r.assurance.level.replace("_", " ") : "not stated");
