// Trend fitting and projection. Log-linear least squares: a constant annual rate of change,
// which is what reported water volumes and intensities look like over a few years.
// Projections are extrapolations of disclosed history, not forecasts of what companies will do.
import type { Point } from "./series";

export const NOW_YEAR = 2026;
export const HORIZONS = [
  { id: "now", label: "Now", year: NOW_YEAR },
  { id: "2y", label: "+2 years", year: NOW_YEAR + 2 },
  { id: "5y", label: "+5 years", year: NOW_YEAR + 5 },
  { id: "10y", label: "+10 years", year: NOW_YEAR + 10 },
] as const;
export type HorizonId = (typeof HORIZONS)[number]["id"];

export interface Trend {
  n: number;
  firstYear: number;
  lastYear: number;
  lastValue: number;
  /** Annual rate of change, e.g. -0.03 = 3% less each year. */
  annualChange: number;
  /** Rough 80% range on the annual rate (null with fewer than 3 points). */
  annualChangeRange: [number, number] | null;
  confidence: "low" | "medium" | "high";
  project: (year: number) => { mid: number; low: number; high: number };
}

/** Minimum residual spread: few-point fits look far more certain than reported water data is. */
const MIN_LOG_SPREAD = 0.05;
const MIN_PCT_SPREAD = 2;

/**
 * `anchor`: start projections from this reported point (usually the latest year) while keeping the
 * rate from `points`. Used when the rate has to come from an earlier comparable stretch.
 */
export function fitTrend(points: Point[], anchor?: Point): Trend | null {
  const pts = points.filter((p) => p.value > 0);
  if (pts.length < 2) return null;
  const xs = pts.map((p) => p.year);
  const ys = pts.map((p) => Math.log(p.value));
  const n = pts.length;
  const xbar = xs.reduce((a, b) => a + b, 0) / n;
  const ybar = ys.reduce((a, b) => a + b, 0) / n;
  const sxx = xs.reduce((a, x) => a + (x - xbar) ** 2, 0);
  if (sxx === 0) return null;
  const b = xs.reduce((a, x, i) => a + (x - xbar) * (ys[i] - ybar), 0) / sxx;
  const a = ybar - b * xbar;
  const resid = ys.map((y, i) => y - (a + b * xs[i]));
  // With 2 points the fit is exact; fall back to a wide default spread (15%/yr in log terms).
  const s = n > 2 ? Math.max(MIN_LOG_SPREAD, Math.sqrt(resid.reduce((acc, r) => acc + r * r, 0) / (n - 2))) : 0.15;
  const seB = s / Math.sqrt(sxx);
  const z = 1.28; // ~80% band
  const span = xs[xs.length - 1] - xs[0];
  const confidence: Trend["confidence"] = n >= 5 && span >= 4 && seB < 0.05 ? "high" : n >= 3 && seB < 0.12 ? "medium" : "low";

  const useAnchor = anchor && anchor.value > 0 && anchor.year >= xs[xs.length - 1];
  const last = useAnchor ? anchor : pts[pts.length - 1];
  // Anchored: level from the anchor, rate from the fit; uncertainty grows with distance from the anchor.
  const level = (year: number) => (useAnchor ? Math.log(anchor.value) + b * (year - anchor.year) : a + b * year);
  const spread = (year: number) =>
    useAnchor ? Math.sqrt(s * s + (seB * (year - anchor.year)) ** 2) : s * Math.sqrt(1 + 1 / n + (year - xbar) ** 2 / sxx);
  return {
    n,
    firstYear: xs[0],
    lastYear: last.year,
    lastValue: last.value,
    annualChange: Math.expm1(b),
    annualChangeRange: n > 2 ? [Math.expm1(b - z * seB), Math.expm1(b + z * seB)] : null,
    confidence,
    project(year) {
      const mid = level(year);
      const se = spread(year);
      return { mid: Math.exp(mid), low: Math.exp(mid - z * se), high: Math.exp(mid + z * se) };
    },
  };
}

/** Linear fit for bounded percentages (reuse rate, stressed share), clamped to 0..100. */
export function fitLinearPct(points: Point[], anchor?: Point): Trend | null {
  if (points.length < 2) return null;
  const xs = points.map((p) => p.year);
  const ys = points.map((p) => p.value);
  const n = points.length;
  const xbar = xs.reduce((a, b) => a + b, 0) / n;
  const ybar = ys.reduce((a, b) => a + b, 0) / n;
  const sxx = xs.reduce((a, x) => a + (x - xbar) ** 2, 0);
  if (sxx === 0) return null;
  const b = xs.reduce((a, x, i) => a + (x - xbar) * (ys[i] - ybar), 0) / sxx;
  const a = ybar - b * xbar;
  const s = n > 2 ? Math.max(MIN_PCT_SPREAD, Math.sqrt(ys.reduce((acc, y, i) => acc + (y - (a + b * xs[i])) ** 2, 0) / (n - 2))) : 5;
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  const useAnchor = anchor && anchor.year >= xs[xs.length - 1];
  const last = useAnchor ? anchor : points[points.length - 1];
  const seB = s / Math.sqrt(sxx);
  return {
    n,
    firstYear: xs[0],
    lastYear: last.year,
    lastValue: last.value,
    annualChange: b / 100, // percentage points per year, as a fraction
    annualChangeRange: n > 2 ? [(b - 1.28 * seB) / 100, (b + 1.28 * seB) / 100] : null,
    confidence: n >= 5 && seB < 1 ? "high" : n >= 3 && seB < 3 ? "medium" : "low",
    project(year) {
      const mid = useAnchor ? anchor.value + b * (year - anchor.year) : a + b * year;
      const se = useAnchor ? Math.sqrt(s * s + (seB * (year - anchor.year)) ** 2) : s * Math.sqrt(1 + 1 / n + (year - xbar) ** 2 / sxx);
      return { mid: clamp(mid), low: clamp(mid - 1.28 * se), high: clamp(mid + 1.28 * se) };
    },
  };
}

export const median = (xs: number[]) => {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
