// Company, country and industry indicators built on the corpus series.
import { Series, type Point } from "./series";
import { fitLinearPct, fitTrend, median, type Trend } from "./trends";
import { CORPORATE, isAggregate, type Corpus, type Metric, type SeriesBreak } from "./types";

export type IndicatorId = "withdrawal" | "fresh" | "intensity" | "reuse" | "stressedShare" | "discharge" | "consumption";

export const INDICATORS: { id: IndicatorId; label: string; unit: string; better: "down" | "up"; pct?: boolean; explain: string }[] = [
  { id: "withdrawal", label: "Total water withdrawal", unit: "ML", better: "down", explain: "All water taken in, from every source." },
  { id: "fresh", label: "Freshwater withdrawal", unit: "ML", better: "down", explain: "High-quality water that competes with people, farms and ecosystems." },
  { id: "intensity", label: "Water per tonne of ore", unit: "m³/t", better: "down", explain: "Withdrawal divided by ore processed. Separates efficiency from growth." },
  { id: "reuse", label: "Reuse share of demand", unit: "%", better: "up", pct: true, explain: "The company's reported reuse rate where it publishes one; otherwise reused ÷ (reused + withdrawal). Definitions differ between companies (e.g. Teck's own rate covers mines only, ours includes the Trail smelter)." },
  { id: "stressedShare", label: "Withdrawal in water-stressed areas", unit: "%", better: "down", pct: true, explain: "Share of withdrawal from basins rated high or extremely high stress." },
  { id: "discharge", label: "Discharge", unit: "ML", better: "down", explain: "Water released back to the environment or to third parties." },
  { id: "consumption", label: "Consumption", unit: "ML", better: "down", explain: "Water evaporated, entrained in tailings or otherwise not returned." },
];

export function indicatorSeries(s: Series, company: string, id: IndicatorId): Point[] {
  switch (id) {
    case "withdrawal":
      return s.withdrawal(company);
    case "fresh":
      return s.company(company, "withdrawal_fresh");
    case "intensity":
      return s.ratio(company, "withdrawal_total", "ore_processed_t", 1000); // ML→m³ per t
    case "reuse":
      return s.reuseShare(company);
    case "stressedShare": {
      const w = new Map(s.withdrawal(company).map((p) => [p.year, p.value]));
      return s
        .company(company, "withdrawal_water_stressed")
        .filter((p) => w.get(p.year))
        .map((p) => ({ ...p, value: Math.min(100, (100 * p.value) / w.get(p.year)!) }));
    }
    case "discharge":
      return s.company(company, "discharge_total");
    case "consumption":
      return s.company(company, "consumption_total");
  }
}

export function fitIndicator(points: Point[], id: IndicatorId, anchor?: Point): Trend | null {
  return INDICATORS.find((i) => i.id === id)?.pct ? fitLinearPct(points, anchor) : fitTrend(points, anchor);
}

const applies = (b: SeriesBreak, company: string, id: IndicatorId) => b.company === company && (b.indicators === "all" || b.indicators.includes(id));

/**
 * The comparable stretch of a series to fit a trend on: split at documented breaks, drop excluded
 * years, then take the latest segment with 3+ points, else the longest (latest on ties).
 */
export function comparableSegment(points: Point[], breaks: SeriesBreak[], company: string, id: IndicatorId) {
  const own = breaks.filter((b) => applies(b, company, id));
  const excluded = new Set(own.filter((b) => b.kind === "exclude").map((b) => b.year));
  const cuts = own.filter((b) => b.kind === "break").map((b) => b.year).sort((a, b) => a - b);
  const segments: Point[][] = [[]];
  for (const p of points) {
    if (excluded.has(p.year)) continue;
    const seg = cuts.filter((c) => c <= p.year).length;
    while (segments.length <= seg) segments.push([]);
    segments[seg].push(p);
  }
  const nonEmpty = segments.filter((s) => s.length);
  const latest3 = [...nonEmpty].reverse().find((s) => s.length >= 3);
  const chosen = latest3 ?? nonEmpty.reduce<Point[]>((best, s) => (s.length >= best.length ? s : best), []);
  // Project from the latest usable reported year, even if the rate comes from an earlier stretch.
  const usable = points.filter((p) => !excluded.has(p.year));
  return { points: chosen, anchor: usable.at(-1), breaks: own, dropped: points.length - chosen.length };
}

const CORE: Metric[] = [
  "withdrawal_total",
  "withdrawal_surface",
  "withdrawal_ground",
  "withdrawal_third_party",
  "withdrawal_fresh",
  "withdrawal_water_stressed",
  "discharge_total",
  "consumption_total",
  "reused_recycled",
  "ore_processed_t",
];
export const CORE_LABEL: Record<string, string> = {
  withdrawal_total: "Total withdrawal",
  withdrawal_surface: "Surface water",
  withdrawal_ground: "Groundwater",
  withdrawal_third_party: "Third-party water",
  withdrawal_fresh: "Freshwater share",
  withdrawal_water_stressed: "Water-stressed areas",
  discharge_total: "Discharge",
  consumption_total: "Consumption",
  reused_recycled: "Reuse and recycling",
  ore_processed_t: "Ore processed",
};

export interface CompanyProfile {
  company: string;
  sites: number;
  countries: string[];
  commodities: string[];
  years: number[];
  lastYear: number | null;
  /** Share of the core disclosure set present in the latest year (company or any site). */
  disclosure: number;
  disclosed: Record<string, boolean>;
  siteLevel: boolean;
  latest: Partial<Record<IndicatorId, number>>;
  trends: Partial<Record<IndicatorId, Trend>>;
  series: Partial<Record<IndicatorId, Point[]>>;
  /** Years the trend was fitted on, and the documented breaks that shaped that choice. */
  fitted: Partial<Record<IndicatorId, { from: number; to: number; dropped: number; breaks: SeriesBreak[] }>>;
}

export function companyProfiles(corpus: Corpus, s: Series): CompanyProfile[] {
  return corpus.companies.map((company) => {
    const recs = [...s.byKey.values()].filter((r) => r.company === company);
    const years = [...new Set(recs.map((r) => r.year))].sort();
    const water = recs.filter((r) => r.metric.startsWith("withdrawal") || r.metric.startsWith("discharge") || r.metric === "consumption_total");
    const lastYear = water.length ? Math.max(...water.map((r) => r.year)) : years.at(-1) ?? null;
    const disclosed: Record<string, boolean> = {};
    for (const m of CORE) disclosed[m] = recs.some((r) => r.year === lastYear && r.metric === m);
    const sites = corpus.sites.filter((x) => x.company === company && x.site !== CORPORATE && !isAggregate(x.site));
    const series: CompanyProfile["series"] = {};
    const trends: CompanyProfile["trends"] = {};
    const latest: CompanyProfile["latest"] = {};
    const fitted: CompanyProfile["fitted"] = {};
    for (const ind of INDICATORS) {
      const pts = indicatorSeries(s, company, ind.id);
      if (!pts.length) continue;
      series[ind.id] = pts;
      latest[ind.id] = pts[pts.length - 1].value;
      const seg = comparableSegment(pts, corpus.breaks ?? [], company, ind.id);
      if (seg.points.length) fitted[ind.id] = { from: seg.points[0].year, to: seg.points.at(-1)!.year, dropped: seg.dropped, breaks: seg.breaks };
      const t = fitIndicator(seg.points, ind.id, seg.anchor);
      if (t) trends[ind.id] = t;
    }
    return {
      company,
      sites: s.sitesOf(company).length || sites.length,
      countries: [...new Set(sites.map((x) => x.country).filter((c): c is string => !!c))].sort(),
      commodities: [...new Set(sites.flatMap((x) => x.commodity.map((c) => c.toLowerCase())))].sort(),
      years,
      lastYear,
      disclosure: CORE.filter((m) => disclosed[m]).length / CORE.length,
      disclosed,
      siteLevel: recs.some((r) => r.site !== CORPORATE && r.metric === "withdrawal_total"),
      latest,
      trends,
      series,
      fitted,
    };
  });
}

/** Industry view of one indicator: median annual change across companies with a usable trend. */
export function industryTrend(profiles: CompanyProfile[], id: IndicatorId) {
  const withTrend = profiles.filter((p) => p.trends[id] && p.trends[id]!.n >= 3);
  const changes = withTrend.map((p) => p.trends[id]!.annualChange);
  const improving = withTrend.filter((p) => {
    const better = INDICATORS.find((i) => i.id === id)!.better;
    return better === "down" ? p.trends[id]!.annualChange < 0 : p.trends[id]!.annualChange > 0;
  });
  return { companies: withTrend.length, medianChange: median(changes), improving: improving.length, changes: withTrend.map((p) => ({ company: p.company, change: p.trends[id]!.annualChange })) };
}

export const UNALLOCATED = "Not allocable (regional totals)";

export interface CountryRow {
  country: string;
  companies: string[];
  sites: number;
  latestWithdrawal: number;
  latestFresh: number;
  stressedSites: number;
  sitesWithData: number;
  incidents: number;
  fines: number;
}

/** Per country: each site's latest disclosed figures. Regulators think in jurisdictions and basins, not companies. */
export function countryRows(corpus: Corpus, s: Series): CountryRow[] {
  const rows = new Map<string, CountryRow>();
  for (const site of corpus.sites.filter((x) => x.site !== CORPORATE && !isAggregate(x.site))) {
    const country = site.country ?? UNALLOCATED;
    const row = rows.get(country) ?? { country, companies: [], sites: 0, latestWithdrawal: 0, latestFresh: 0, stressedSites: 0, sitesWithData: 0, incidents: 0, fines: 0 };
    if (!row.companies.includes(site.company)) row.companies.push(site.company);
    row.sites++;
    const w = s.site(site.company, site.site, "withdrawal_total").at(-1);
    const f = s.site(site.company, site.site, "withdrawal_fresh").at(-1);
    if (w) {
      row.latestWithdrawal += w.value;
      row.sitesWithData++;
    }
    if (f) row.latestFresh += f.value;
    const stress = (site.waterStressReported ?? "").toLowerCase();
    const stressedVolume = s.site(site.company, site.site, "withdrawal_water_stressed").at(-1)?.value ?? 0;
    if (/high|extreme/.test(stress) || stressedVolume > 0) row.stressedSites++;
    row.incidents += s.site(site.company, site.site, "water_incidents_count").reduce((a, p) => a + p.value, 0);
    row.fines += s.site(site.company, site.site, "water_fines_usd").reduce((a, p) => a + p.value, 0);
    rows.set(country, row);
  }
  return [...rows.values()].sort((a, b) => Number(a.country === UNALLOCATED) - Number(b.country === UNALLOCATED) || b.latestWithdrawal - a.latestWithdrawal);
}
