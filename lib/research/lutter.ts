// Independent benchmark: WU Vienna model predictions of water use at 507 copper mines, 2015–2019
// (Lutter, Maus, Luckeneder & Tost 2025, Ecological Economic Papers 49/2025). "New water" is the
// modelled freshwater intake in ML/yr. The model's stated fit is R² 0.79, so a single mine can be
// off by a third or more; it is a cross-check, not ground truth.
import data from "@/lib/data/lutter-copper.json";
import { canonical } from "@/lib/corpus/series";
import { CORPORATE, type Corpus } from "@/lib/corpus/types";

export interface LutterMine {
  mine: string;
  country: string;
  cc: string;
  region: string;
  newWater: Record<string, number | null>;
  total: Record<string, number | null>;
}

export const LUTTER = data as { source: string; url: string; mines: LutterMine[] };
export const LUTTER_CITATION =
  "Lutter, S., Maus, V., Luckeneder, S. & Tost, M. (2025). Increasing Water Use in Global Copper Production Threatens Freshwater Availability. WU Vienna, Ecological Economic Papers 49/2025.";
export const LUTTER_DOI = "https://doi.org/10.57938/441b6e21-b914-4565-a2af-623f78ed92c6";
/** Relative error assumed for one mine-year of the model (as in the MineWater Ledger). */
export const MODEL_SIGMA = 0.35;

const YEARS = ["2015", "2016", "2017", "2018", "2019"];

/** Global totals and growth across all modelled mines (only mines with a value in both end years). */
export function lutterTotals() {
  const tot = (y: string) => LUTTER.mines.reduce((a, m) => a + (m.newWater[y] ?? 0), 0);
  const both = LUTTER.mines.filter((m) => m.newWater["2015"] != null && m.newWater["2019"] != null);
  const like = (y: string) => both.reduce((a, m) => a + (m.newWater[y] ?? 0), 0);
  return {
    mines: LUTTER.mines.length,
    countries: new Set(LUTTER.mines.map((m) => m.country)).size,
    byYear: YEARS.map((y) => ({ year: Number(y), ml: tot(y) })),
    growth: tot("2019") / tot("2015") - 1,
    likeForLikeGrowth: like("2019") / like("2015") - 1,
    likeForLikeMines: both.length,
    annual: (tot("2019") / tot("2015")) ** (1 / 4) - 1,
  };
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\b(mine|mines|operations?|copper|complex|project|mining|division|s\.a\.|sx-ew)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const COUNTRY: Record<string, string> = { "united states": "usa", "democratic republic of congo": "dem rep congo", "democratic republic of the congo": "dem rep congo", "kyrgyz republic": "kyrgyzstan" };
const normCountry = (c: string) => {
  const t = c.toLowerCase().replace(/[.]/g, "").trim();
  return COUNTRY[t] ?? t;
};
/** Reported names that differ from the model's mine names. */
const ALIAS: Record<string, string> = {
  "PT-FI (Grasberg)": "Grasberg",
  "Copper Mining - Indonesia (PT-FI)": "Grasberg",
  "Peru (Constancia)": "Constancia",
  Sentinel: "Trident - Sentinel",
  "Cobre Las Cruces": "Las Cruces",
  "Mina Aguas Teñidas": "Minas De Aguas Teñidas (MATSA)",
  "Mina Sotiel": "Sotiel",
  Cadia: "Cadia East",
};

/** Find the model mine for a reported site. Country must agree, so same-named mines elsewhere don't match. */
export function matchMine(site: string, country: string | null): LutterMine | null {
  const alias = ALIAS[site];
  const cands = LUTTER.mines.filter((m) => !country || normCountry(m.country) === normCountry(country) || country.includes("/"));
  if (alias) return cands.find((m) => m.mine === alias) ?? null;
  const k = norm(site);
  if (k.length < 3) return null;
  return cands.find((m) => norm(m.mine) === k) ?? cands.find((m) => {
    const a = norm(m.mine);
    return a.length > 3 && (a.startsWith(k + " ") || k.startsWith(a + " "));
  }) ?? null;
}

export interface ModelComparison {
  company: string;
  site: string;
  mine: string;
  year: number;
  reported: number;
  reportedMetric: "withdrawal_fresh" | "withdrawal_total";
  modelled: number;
  ratio: number;
  /** z-score of the gap using the model's error (±35%) and ±10% on the reported figure. */
  z: number;
  /** The model reproduces the report exactly: WU Vienna used the reported figure, so this is not an independent check. */
  sameSource: boolean;
  source: string;
  location: string;
}

/** Reported vs modelled freshwater intake, for every matched site-year in 2015–2019. */
export function modelComparisons(corpus: Corpus): ModelComparison[] {
  const canon = canonical(corpus);
  const out: ModelComparison[] = [];
  for (const s of corpus.sites) {
    if (s.site === CORPORATE) continue;
    const m = matchMine(s.site, s.country);
    if (!m) continue;
    for (const y of YEARS) {
      const modelled = m.newWater[y];
      if (modelled == null || modelled <= 0) continue;
      const fresh = canon.get(`${s.company}|${s.site}|${y}|withdrawal_fresh`);
      const total = canon.get(`${s.company}|${s.site}|${y}|withdrawal_total`);
      // Compare like with like: freshwater if reported, otherwise total withdrawal (which overstates new freshwater at seawater sites).
      const rec = fresh ?? total;
      if (!rec || rec.value <= 0) continue;
      const sd = Math.hypot(modelled * MODEL_SIGMA, rec.value * 0.1);
      out.push({
        company: s.company,
        site: s.site,
        mine: m.mine,
        year: Number(y),
        reported: rec.value,
        reportedMetric: fresh ? "withdrawal_fresh" : "withdrawal_total",
        modelled,
        ratio: rec.value / modelled,
        z: (rec.value - modelled) / sd,
        sameSource: Math.abs(rec.value / modelled - 1) < 0.005,
        source: rec.sourceFile,
        location: rec.location,
      });
    }
  }
  return out.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
}
