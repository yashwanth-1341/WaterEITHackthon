// Mine Water Passport: the site-level data unit, its mass balance, KPIs, per-commodity footprint,
// transparency score (A–E) and screening flags. Ported from the MineWater Passport prototype
// (02-mining-water-reporting/prototype/js/metrics.js). Weights and thresholds are design proposals,
// to be calibrated in a pilot.

export type Quality = "cat1" | "cat2" | "cat3";
export type DQ = "measured" | "calculated" | "estimated";
export type StressKey = "low" | "low_medium" | "medium_high" | "high" | "extremely_high" | "arid_low_water_use";
export type Assurance = "none" | "internal_review" | "limited" | "reasonable";

export interface Withdrawal {
  /** Missing when a report gives only a total, not a split by source. */
  source?: "surface_water" | "groundwater" | "seawater" | "third_party";
  volume_ml: number;
  dq?: DQ;
  subtype?: string;
  quality?: Quality;
}
export interface Discharge {
  destination: string;
  volume_ml: number;
  dq?: DQ;
  quality?: Quality;
  treated?: boolean;
}
export interface Product {
  commodity: string;
  metal_content_t?: number;
  basis?: "contained_metal" | "LCE";
  allocation_share?: number;
  product_form?: string;
}

export interface Passport {
  passport_version: string;
  synthetic?: boolean;
  /** Where the record came from: self-reported passport, or backfilled from a public report. */
  origin?: "passport" | "backfilled";
  tier: "tier1" | "tier2";
  site: {
    site_id: string;
    name: string;
    operator?: string;
    country: string;
    latitude?: number | null;
    longitude?: number | null;
    location_precision?: string;
    primary_commodity?: string;
    mine_type?: string;
    processing_route?: string[];
    lifecycle_stage?: string;
    basin?: { name?: string; bws_score?: number | null; bws_category?: StressKey | null; bws_source?: string };
  };
  period: { year: number };
  production: { products?: Product[]; ore_processed_t?: number; brine_processed_m3?: number };
  water: {
    withdrawals: Withdrawal[];
    /** Undefined = not disclosed. An empty array means "no discharge". */
    discharges?: Discharge[];
    consumption: { total_ml?: number; total_dq?: DQ; evaporation_ml?: number; entrainment_ml?: number; other_ml?: number };
    reuse: { reused_recycled_ml?: number; dq?: DQ; task_water_ml?: number };
    /** change_ml: reported net change when opening/closing volumes aren't given. */
    storage?: { opening_ml?: number; closing_ml?: number; change_ml?: number };
    monthly?: { month: number; withdrawal_ml: number; consumption_ml: number }[];
  };
  assurance: { level?: Assurance; methodology?: string; provider?: string };
  context?: { competing_users?: string[]; water_grievances?: number; water_incidents?: number; seasonality?: string };
  sources?: { title?: string; url?: string; page?: string }[];
}

export const BAL_TOL = 0.05;

export const STRESS: Record<StressKey, { label: string; w: number; color: string; rank: number }> = {
  low: { label: "Low", w: 0.1, color: "#f3cf9c", rank: 1 },
  low_medium: { label: "Low-medium", w: 0.3, color: "#eca567", rank: 2 },
  medium_high: { label: "Medium-high", w: 0.5, color: "#dd7438", rank: 3 },
  high: { label: "High", w: 0.8, color: "#bb4a1d", rank: 4 },
  extremely_high: { label: "Extremely high", w: 1.0, color: "#86270b", rank: 5 },
  arid_low_water_use: { label: "Arid & low water use", w: 1.0, color: "#5a2d56", rank: 5 },
};
export const STRESS_UNKNOWN = { label: "Not assessed", w: 0, color: "#b7c2c4", rank: 0 };

export const QUALITY_LABEL: Record<Quality | "unknown", string> = {
  cat1: "Cat 1 (freshwater grade)",
  cat2: "Cat 2 (needs treatment)",
  cat3: "Cat 3 (saline / brine)",
  unknown: "Quality not stated",
};
export const QUALITY_COLOR: Record<Quality | "unknown", string> = { cat1: "#2a6fdb", cat2: "#e8743b", cat3: "#1faa7a", unknown: "#b7c2c4" };

const DQW: Record<DQ, number> = { measured: 1, calculated: 0.6, estimated: 0.2 };
const ASSW: Record<Assurance, number> = { none: 0, internal_review: 4, limited: 11, reasonable: 16 };

export const GRADES = [
  { g: "A", min: 90, color: "#0b8a0b", text: "Transparent & comparable" },
  { g: "B", min: 75, color: "#5f9e1f", text: "Good, minor gaps" },
  { g: "C", min: 58, color: "#c98500", text: "Partial: key gaps" },
  { g: "D", min: 45, color: "#d0632f", text: "Weak: mostly estimates" },
  { g: "E", min: -1, color: "#c23434", text: "Not decision-grade" },
] as const;

const isNum = (v: unknown): v is number => typeof v === "number" && !Number.isNaN(v);
const sum = <T,>(a: T[] | undefined, f: (x: T) => number | undefined) => (a ?? []).reduce((s, x) => s + (isNum(f(x)) ? (f(x) as number) : 0), 0);

export const TIER1: { no: number; label: string; test: (r: Passport) => boolean }[] = [
  { no: 1, label: "Site ID & name", test: (r) => !!r.site.site_id && !!r.site.name },
  { no: 2, label: "Coordinates & country", test: (r) => isNum(r.site.latitude) && isNum(r.site.longitude) && !!r.site.country },
  { no: 3, label: "Primary commodity", test: (r) => !!r.site.primary_commodity },
  { no: 4, label: "Mine type & processing route", test: (r) => !!r.site.mine_type && !!r.site.processing_route?.length },
  { no: 5, label: "Reporting year", test: (r) => isNum(r.period.year) },
  { no: 6, label: "Ore (or brine) processed", test: (r) => isNum(r.production.ore_processed_t) || isNum(r.production.brine_processed_m3) },
  { no: 7, label: "Contained metal / LCE produced", test: (r) => !!r.production.products?.length && r.production.products.every((p) => isNum(p.metal_content_t)) },
  { no: 8, label: "Withdrawal by source", test: (r) => !!r.water.withdrawals.length && r.water.withdrawals.every((x) => !!x.source && isNum(x.volume_ml) && !!x.dq) },
  { no: 9, label: "Discharge by destination", test: (r) => Array.isArray(r.water.discharges) && r.water.discharges.every((x) => !!x.destination && isNum(x.volume_ml) && !!x.dq) },
  { no: 10, label: "Consumption total", test: (r) => isNum(r.water.consumption.total_ml) && !!r.water.consumption.total_dq },
  { no: 11, label: "Reused / recycled water", test: (r) => isNum(r.water.reuse.reused_recycled_ml) },
  { no: 12, label: "Assurance status", test: (r) => !!r.assurance.level },
];

export function balance(r: Passport) {
  const w = r.water;
  const W = sum(w.withdrawals, (x) => x.volume_ml);
  const D = w.discharges ? sum(w.discharges, (x) => x.volume_ml) : NaN;
  const C = isNum(w.consumption.total_ml) ? w.consumption.total_ml : NaN;
  const st = w.storage ?? {};
  const dS = isNum(st.closing_ml) && isNum(st.opening_ml) ? st.closing_ml - st.opening_ml : isNum(st.change_ml) ? st.change_ml : 0;
  const resid = W - D - C - dS;
  const pct = W ? resid / W : NaN;
  const known = !Number.isNaN(pct);
  return { W, D, C, dS, resid, pct, known, ok: known && Math.abs(pct) <= BAL_TOL };
}

export function stressOf(r: Passport) {
  const k = r.site.basin?.bws_category;
  return k && STRESS[k] ? { key: k, ...STRESS[k] } : { key: null, ...STRESS_UNKNOWN };
}

export function primaryProduct(r: Passport, commodity?: string) {
  const c = commodity ?? r.site.primary_commodity;
  return (r.production.products ?? []).find((p) => p.commodity === c) ?? null;
}

export function byQuality(r: Passport) {
  const q = { cat1: 0, cat2: 0, cat3: 0, unknown: 0 };
  for (const x of r.water.withdrawals) q[x.quality ?? "unknown"] += x.volume_ml || 0;
  return q;
}

export function kpis(r: Passport) {
  const b = balance(r);
  const ore = r.production.ore_processed_t;
  const s = stressOf(r);
  const pp = primaryProduct(r);
  const alloc = pp && isNum(pp.allocation_share) ? pp.allocation_share : 1;
  return {
    ...b,
    balance: b,
    byQ: byQuality(r),
    consumptionRatio: b.W ? b.C / b.W : NaN,
    wPerOre: ore ? (b.W * 1000) / ore : NaN,
    cPerOre: ore ? (b.C * 1000) / ore : NaN,
    cPerMetal: pp?.metal_content_t ? (b.C * 1000 * alloc) / pp.metal_content_t : NaN,
    metalBasis: pp?.basis ?? null,
    stress: s,
    stressWeightedC: s.rank ? b.C * s.w : NaN,
    reuseRate: r.water.reuse.task_water_ml ? (r.water.reuse.reused_recycled_ml ?? 0) / r.water.reuse.task_water_ml : NaN,
  };
}

/** Water footprint per tonne of metal (m³/t), with economic allocation between co-products. */
export function footprint(r: Passport, commodity: string) {
  const pp = primaryProduct(r, commodity) ?? (r.production.products ?? []).find((p) => p.commodity === commodity) ?? null;
  if (!pp?.metal_content_t) return null;
  const b = balance(r);
  const alloc = isNum(pp.allocation_share) ? pp.allocation_share : 1;
  const f = (1000 * alloc) / pp.metal_content_t;
  const q = byQuality(r);
  return {
    c: Number.isNaN(b.C) ? NaN : b.C * f,
    w: b.W * f,
    byQ: { cat1: q.cat1 * f, cat2: q.cat2 * f, cat3: q.cat3 * f, unknown: q.unknown * f },
    basis: pp.basis ?? "contained_metal",
    alloc,
    metal_t: pp.metal_content_t,
  };
}

/** 0–100 reporting-quality score and grade. Rates disclosure, not water performance. */
export function transparency(r: Passport) {
  const parts: { k: string; v: number; max: number; note: string }[] = [];
  const t1 = TIER1.map((f) => {
    let ok = false;
    try {
      ok = f.test(r);
    } catch {
      ok = false;
    }
    return { no: f.no, label: f.label, ok };
  });
  const n1 = t1.filter((x) => x.ok).length;
  parts.push({ k: "Tier-1 completeness", v: n1 * 2, max: 24, note: `${n1}/12 must-report data points` });

  const w = r.water;
  let d2 = 0;
  const notes: string[] = [];
  if (w.withdrawals.length && w.withdrawals.every((x) => x.subtype && x.quality)) (d2 += 4), notes.push("source sub-type & quality");
  const c = w.consumption;
  if ([c.evaporation_ml, c.entrainment_ml, c.other_ml].every(isNum)) (d2 += 4), notes.push("consumption components");
  if (isNum(w.storage?.opening_ml) && isNum(w.storage?.closing_ml)) (d2 += 3), notes.push("storage");
  if (isNum(w.reuse.task_water_ml)) (d2 += 2), notes.push("task water");
  if (w.monthly?.length === 12) (d2 += 4), notes.push("monthly profile");
  if (r.context?.competing_users?.length) (d2 += 3), notes.push("basin context");
  parts.push({ k: "Tier-2 depth", v: d2, max: 20, note: notes.join(", ") || "none" });

  const vols: [number, DQ | undefined][] = [...w.withdrawals.map((x) => [x.volume_ml, x.dq] as [number, DQ | undefined]), ...(w.discharges ?? []).map((x) => [x.volume_ml, x.dq] as [number, DQ | undefined])];
  if (isNum(c.total_ml)) vols.push([c.total_ml, c.total_dq]);
  const tv = sum(vols, (x) => x[0]);
  const q = tv ? sum(vols, (x) => (x[0] || 0) * (x[1] ? DQW[x[1]] : 0)) / tv : 0;
  const measuredShare = tv ? sum(vols, (x) => (x[1] === "measured" ? x[0] : 0)) / tv : 0;
  const dqStated = vols.some((x) => x[1]);
  parts.push({ k: "Data quality", v: Math.round(q * 300) / 10, max: 30, note: dqStated ? `${Math.round(measuredShare * 100)}% of volume measured` : "measured / estimated not stated" });

  const lvl = r.assurance.level;
  parts.push({ k: "Assurance", v: lvl ? ASSW[lvl] : 0, max: 16, note: lvl ? lvl.replace("_", " ") : "not stated" });

  const b = balance(r);
  const bv = !b.known ? 0 : Math.abs(b.pct) <= 0.02 ? 10 : Math.abs(b.pct) <= BAL_TOL ? 5 : 0;
  parts.push({ k: "Balance closure", v: bv, max: 10, note: b.known ? `residual ${(b.pct * 100).toFixed(1)}% of withdrawal` : "cannot close: a flow is missing" });

  const score = Math.round(parts.reduce((s, p) => s + p.v, 0));
  const grade = GRADES.find((g) => score >= g.min)!;
  return { score, grade, parts, tier1: t1, n1, measuredShare, dqStated };
}

export type FlagLevel = "critical" | "serious" | "warning" | "good";

/** Supplier screening flags for due diligence (EU Batteries Regulation / CRMA context). */
export function ddFlags(r: Passport) {
  const k = kpis(r);
  const t = transparency(r);
  const flags: { lvl: FlagLevel; t: string }[] = [];
  if (k.stress.w >= 0.8) flags.push({ lvl: "critical", t: `Operates in a ${k.stress.label.toLowerCase()} water-stress basin` });
  if ((r.context?.water_grievances ?? 0) >= 5) flags.push({ lvl: "serious", t: `${r.context!.water_grievances} water-related community grievances reported` });
  if ((r.context?.water_incidents ?? 0) >= 2) flags.push({ lvl: "serious", t: `${r.context!.water_incidents} water incidents / permit exceedances` });
  if (!k.balance.ok) flags.push({ lvl: "serious", t: k.balance.known ? `Water balance does not close (${(k.balance.pct * 100).toFixed(1)}%)` : "Water balance cannot be checked: a flow is not disclosed" });
  if (t.dqStated && t.measuredShare < 0.4) flags.push({ lvl: "warning", t: `Only ${Math.round(t.measuredShare * 100)}% of reported volume is metered` });
  if (!t.dqStated) flags.push({ lvl: "warning", t: "Report doesn't say which volumes are metered and which are estimated" });
  const lvl = r.assurance.level;
  if (!lvl || lvl === "none" || lvl === "internal_review") flags.push({ lvl: "warning", t: "No independent assurance of water data" });
  if (r.context?.competing_users?.includes("agriculture") && k.stress.w >= 0.5) flags.push({ lvl: "warning", t: "Competes with agriculture in a stressed basin" });
  if (!flags.length) flags.push({ lvl: "good", t: "No red flags on the screening criteria" });
  return flags;
}

/** Hotspot: high basin stress and large consumption. */
export const isHot = (r: Passport) => {
  const k = kpis(r);
  return k.stress.rank >= 4 && k.C >= 3000;
};

/** Framework coverage of one passport: which disclosures it can answer (rules from the MWP prototype). */
export function frameworkCoverage(r: Passport) {
  const w = r.water;
  const has = (x: unknown) => x !== undefined && x !== null;
  type S = "ok" | "partial" | "no";
  const srcOk = w.withdrawals.length > 0 && w.withdrawals.every((x) => x.source);
  const gri3: S = srcOk ? (w.withdrawals.every((x) => has((x as { freshwater_gri?: boolean }).freshwater_gri) || has(x.quality)) ? "ok" : "partial") : "no";
  const gri4: S = w.discharges ? (w.discharges.every((x) => has(x.quality)) ? "ok" : "partial") : "no";
  const gri5: S = has(w.consumption.total_ml) ? (w.storage ? "ok" : "partial") : "no";
  const esrs: S = has(w.consumption.total_ml) && has(w.reuse.reused_recycled_ml) ? (w.storage && r.context ? "ok" : "partial") : "no";
  const cdp: S = srcOk && w.discharges ? "ok" : "partial";
  const icmm: S = w.withdrawals.every((x) => x.quality) && has(w.reuse.reused_recycled_ml) ? (isNum(w.consumption.evaporation_ml) ? "ok" : "partial") : "partial";
  const irma: S = w.monthly && r.context ? "ok" : "partial";
  return [
    { id: "GRI 303-3", status: gri3 },
    { id: "GRI 303-4", status: gri4 },
    { id: "GRI 303-5", status: gri5 },
    { id: "ESRS E3-4", status: esrs },
    { id: "CDP 9.2.x", status: cdp },
    { id: "ICMM 2021", status: icmm },
    { id: "IRMA 4.2.5", status: irma },
  ];
}
