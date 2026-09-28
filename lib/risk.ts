// Water-at-Risk engine: reconcile -> predict -> decide.
// Faithful port of 02-mining-water-reporting/minewater-ledger/js/risk.js, driven by an AquaTrace Dataset.
// Volumes in ML/yr, money in US$ millions unless stated. Everything marked "assumption" is a planning value.

import type { Dataset, Site } from "@/lib/types";
import { highQualityWithdrawal, sumKnown, totalWithdrawal } from "@/lib/metrics";
import lutterJson from "@/lib/data/lutter-copper.json";

/* ---------- WU Vienna copper-mine model (Lutter et al. 2025) ---------- */

interface LutterMine { mine: string; country: string; newWater: Record<string, number | null | undefined> }
const LUTTER = (lutterJson as { mines: LutterMine[] }).mines;
export const LUTTER_SOURCE = (lutterJson as { source: string; url: string });

/** Report site name -> model mine names (all 2019 values found are summed). Mirrors 02's newcrest.js "lutter" map. */
export const MODEL_ALIASES: Record<string, string[]> = {
  cadia: ["Cadia East", "Cadia Valley", "Cadia Hill", "Ridgeway"],
  telfer: ["Telfer"],
  "red chris": ["Red Chris"],
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const countryOf = (c: string) => norm(c.replace(/\(.*\)/, ""));

export interface ModelMatch { value: number; mines: string[] }

/** 2019 modelled new water for a copper site, or null (gold-only sites and unmatched names). */
export function modelNewWater2019(site: Site): ModelMatch | null {
  if (!site.commodity.some((c) => norm(c) === "copper")) return null;
  const names = MODEL_ALIASES[norm(site.name)] ?? [site.name];
  const wanted = new Set(names.map(norm));
  const hits = LUTTER.filter((m) => wanted.has(norm(m.mine)) && countryOf(site.country).includes(countryOf(m.country)))
    .filter((m) => typeof m.newWater["2019"] === "number");
  if (!hits.length) return null;
  return { value: hits.reduce((a, m) => a + (m.newWater["2019"] as number), 0), mines: hits.map((m) => m.mine) };
}

/* ---------- 1. Reconcile ---------- */

export type SourceKind = "report" | "balance" | "model";
export interface RecSource { kind: SourceKind; label: string; v: number; sd: number; use: boolean; note: string }
export type RecStatus = "single" | "agree" | "tension" | "conflict";
export interface Reconciled {
  src: RecSource[];
  f: number; // fused withdrawal, ML
  sf: number; // its standard deviation, ML
  maxZ: number;
  status: RecStatus;
  trust: number;
  share: number; // high-quality share of withdrawal
  fresh0: number;
  freshSd: number;
}

export function reconcile(site: Site, verified: boolean): Reconciled | null {
  const W = totalWithdrawal(site);
  const C = site.consumption;
  const D = site.discharge ? sumKnown(site.discharge) : null;
  const dS = site.deltaStorage ?? 0;
  const src: RecSource[] = [];
  if (W != null) src.push({ kind: "report", label: "Company report", v: W, sd: verified ? 0.03 : 0.1, use: true, note: "Reported total withdrawal" });
  if (W != null && C != null && D != null) {
    const bal = verified ? W : C + D + dS;
    // Closes by construction when consumption was set to withdrawal minus discharge: then it cannot confirm anything.
    const indep = !(W > 0 && Math.abs(C - (W - D)) < 0.005 * W);
    src.push({
      kind: "balance",
      label: "Water balance",
      v: bal,
      sd: 0.1,
      use: indep,
      note: indep ? "consumption + discharge + storage change" : "not independent: consumption equals withdrawal − discharge",
    });
  }
  const m = modelNewWater2019(site);
  if (m) src.push({ kind: "model", label: "WU Vienna model", v: m.value, sd: 0.35, use: true, note: `2019 new water (${m.mines.join(" + ")}), R² 0.79` });

  const used = src.filter((x) => x.use && x.v > 0);
  if (!used.length) return null;
  let wsum = 0, vsum = 0;
  for (const x of used) { const sd = x.v * x.sd, w = 1 / (sd * sd); wsum += w; vsum += w * x.v; }
  const f = vsum / wsum, sf = 1 / Math.sqrt(wsum);
  let maxZ = 0;
  for (let i = 0; i < used.length; i++)
    for (let j = i + 1; j < used.length; j++) {
      const a = used[i], b = used[j];
      maxZ = Math.max(maxZ, Math.abs(a.v - b.v) / Math.hypot(a.v * a.sd, b.v * b.sd));
    }
  const status: RecStatus = used.length < 2 ? "single" : maxZ < 1 ? "agree" : maxZ < 2 ? "tension" : "conflict";
  const trust = Math.max(5, Math.min(99, Math.round(100 - (150 * sf) / f - 12 * Math.max(0, maxZ - 1) - (used.length < 2 ? 15 : 0))));
  const hq = highQualityWithdrawal(site);
  const share = hq != null && W ? hq / W : 1;
  return { src, f, sf, maxZ, status, trust, share, fresh0: f * share, freshSd: sf * share };
}

/* ---------- 2. Predict (seeded Monte Carlo) ---------- */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function normal(r: () => number) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
export const YEARS = Array.from({ length: 11 }, (_, i) => 2020 + i); // t=0 is FY20 (not scored), 2021-2030 scored
export const N_RUNS = 1000;
function quant(arr: number[], p: number) { const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.max(0, Math.floor(p * (a.length - 1))))]; }
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

export interface RiskParams {
  verified: boolean;
  growthPct: number; // demand growth, %/yr
  headroomPct: number; // licence above FY20 freshwater use
  tightenPct: number; // licence tightening, %/yr
  sensPct: number; // output lost per unit of shortfall
  goldPrice: number; // US$/oz AuEq, for revenue
  drought: Record<string, number>; // % chance per year, by site id
}
export interface Levers { rr: number; rrc: number; alt: number; altc: number } // cut %, US$/m³, new source %, US$/m³

export const DROUGHT_DEFAULT: Record<string, number> = { cadia: 25, telfer: 15, lihir: 5, "red chris": 10 };
export const droughtDefault = (s: Site) => DROUGHT_DEFAULT[norm(s.name)] ?? 10;
export function defaultRiskParams(ds: Dataset): RiskParams {
  return { verified: false, growthPct: 1.5, headroomPct: 25, tightenPct: 0.25, sensPct: 50, goldPrice: 1770, drought: Object.fromEntries(ds.sites.map((s) => [s.id, droughtDefault(s)])) };
}
export const DEFAULT_LEVERS: Levers = { rr: 10, rrc: 1.2, alt: 0, altc: 2 };

export type Band = [number, number, number]; // P5, P50, P95
export interface SimResult {
  rc: Reconciled;
  rev: number; // US$m per year
  Wf: number;
  licence: number;
  bands: { dB: Band[]; dL: Band[]; aB: Band[]; aL: Band[] };
  pB: number; pL: number; // P(at least one short year), base / with lever
  elB: number; elL: number; // expected loss 2021-2030, US$m
  varB: number; varL: number; // P95 loss (water-at-risk), US$m
  cost: number; // lever cost 2021-2030, US$m
  revPerML: number | null; // US$ per ML of freshwater
}

export const siteRevenue = (s: Site, goldPrice: number) => (s.productionOzAuEq ? (s.productionOzAuEq * goldPrice) / 1e6 : 0);

export function simulate(site: Site, P: RiskParams, lev: Levers): SimResult | null {
  const rc = reconcile(site, P.verified);
  if (!rc) return null;
  const hq = highQualityWithdrawal(site);
  const Wf = rc.fresh0;
  const base = hq != null ? hq : Wf; // licence and new source are set on the reported (or reconciled) figure
  const licence = base * (1 + P.headroomPct / 100);
  const rev = siteRevenue(site, P.goldPrice);
  const drought = (P.drought[site.id] ?? droughtDefault(site)) / 100;
  const n = site.name;
  const r = mulberry32(1234 + n.length * 97 + n.charCodeAt(0));
  const T = YEARS.length;
  const out = { dB: [] as number[][], dL: [] as number[][], aB: [] as number[][], aL: [] as number[][] };
  for (let t = 0; t < T; t++) { out.dB.push([]); out.dL.push([]); out.aB.push([]); out.aL.push([]); }
  const lossB: number[] = [], lossL: number[] = [];
  let hitsB = 0, hitsL = 0, avoidML = 0, altML = 0;
  for (let k = 0; k < N_RUNS; k++) {
    const d0 = Math.max(Wf * 0.3, Wf + rc.freshSd * normal(r));
    const g = P.growthPct / 100 + 0.01 * normal(r);
    let LB = 0, LL = 0, hitB = false, hitL = false;
    for (let t = 0; t < T; t++) {
      const dr = r() < drought ? 0.05 + 0.25 * r() : 0; // drought cuts supply 5-30%
      const dB = d0 * Math.pow(1 + g, t);
      const dL = dB * (1 - (lev.rr / 100) * Math.min(1, t / 3)); // cut ramps in over 3 years
      const aB = licence * Math.pow(1 - P.tightenPct / 100, t) * (1 - dr);
      const alt = t >= 3 ? (lev.alt / 100) * base : 0;
      const aL = aB + alt;
      out.dB[t].push(dB); out.dL[t].push(dL); out.aB[t].push(aB); out.aL[t].push(aL);
      if (t > 0) {
        const fB = Math.max(0, dB - aB) / dB, fL = Math.max(0, dL - aL) / dL;
        if (fB > 0) hitB = true;
        if (fL > 0) hitL = true;
        LB += Math.min(1, (fB * P.sensPct) / 100) * rev;
        LL += Math.min(1, (fL * P.sensPct) / 100) * rev;
        avoidML += (dB - dL) / N_RUNS;
        altML += alt / N_RUNS;
      }
    }
    lossB.push(LB); lossL.push(LL);
    if (hitB) hitsB++;
    if (hitL) hitsL++;
  }
  const band = (a: number[][]) => a.map((x) => [quant(x, 0.05), quant(x, 0.5), quant(x, 0.95)] as Band);
  return {
    rc, rev, Wf, licence,
    bands: { dB: band(out.dB), dL: band(out.dL), aB: band(out.aB), aL: band(out.aL) },
    pB: hitsB / N_RUNS, pL: hitsL / N_RUNS,
    elB: mean(lossB), elL: mean(lossL), varB: quant(lossB, 0.95), varL: quant(lossL, 0.95),
    cost: (avoidML * 1000 * lev.rrc + altML * 1000 * lev.altc) / 1e6,
    revPerML: rev > 0 && base > 0 ? (rev * 1e6) / base : null,
  };
}

/* ---------- 3. Decide ---------- */

export interface Option { key: "none" | "cut" | "alt" | "both"; label: string; R: SimResult; p: number; el: number; var95: number; saved: number; net: number }

/** Do nothing / Cut / New source / Both, all on the same random numbers (same seed per site). */
export function options(site: Site, P: RiskParams, L: Levers): Option[] {
  const base: Levers = { rr: 0, rrc: L.rrc, alt: 0, altc: L.altc };
  const list: [Option["key"], string, Levers, boolean][] = [
    ["none", "Do nothing", base, true],
    ["cut", `Cut freshwater ${L.rr}%`, { ...base, rr: L.rr }, L.rr > 0],
    ["alt", `New source ${L.alt}%`, { ...base, alt: L.alt }, L.alt > 0],
    ["both", "Both", { ...L }, L.rr > 0 && L.alt > 0],
  ];
  const outp: Option[] = [];
  for (const [key, label, lev, on] of list) {
    if (!on) continue;
    const R = simulate(site, P, lev);
    if (!R) return [];
    const none = key === "none";
    outp.push({ key, label, R, p: none ? R.pB : R.pL, el: none ? R.elB : R.elL, var95: none ? R.varB : R.varL, saved: R.elB - R.elL, net: R.elB - R.elL - R.cost });
  }
  return outp;
}
export const bestFix = (O: Option[]) => O.slice(1).sort((a, b) => b.net - a.net)[0] ?? null;

export interface PortfolioRow { site: Site; R: SimResult; best: Option | null }
export function portfolio(ds: Dataset, P: RiskParams, L: Levers) {
  const rows: PortfolioRow[] = [];
  for (const s of ds.sites) {
    const O = options(s, P, L);
    if (!O.length) continue;
    rows.push({ site: s, R: O[0].R, best: bestFix(O) });
  }
  const pays = (r: PortfolioRow) => r.best != null && r.best.net > 0;
  return {
    rows,
    skipped: ds.sites.filter((s) => !rows.some((r) => r.site.id === s.id)),
    totalLoss: rows.reduce((a, r) => a + r.R.elB, 0),
    totalAfter: rows.reduce((a, r) => a + (pays(r) ? r.best!.el : r.R.elB), 0),
    totalNet: rows.reduce((a, r) => a + (pays(r) ? r.best!.net : 0), 0),
  };
}
