import { SOURCES, type QMatrix, type Quality, type Site } from "@/lib/types";

/** Sum a quality matrix. Returns null if any included cell is undisclosed. */
export function sumMatrix(m: QMatrix | null, q?: Quality, opts: { excludeSea?: boolean } = {}): number | null {
  if (!m) return null;
  let total = 0;
  for (const src of SOURCES) {
    if (opts.excludeSea && src === "sea") continue;
    for (const qq of q ? [q] : (["high", "low"] as Quality[])) {
      const v = m[src][qq];
      if (v === null) return null;
      total += v;
    }
  }
  return total;
}

/** Like sumMatrix but treats undisclosed cells as zero (for charts). */
export function sumKnown(m: QMatrix | null, q?: Quality): number {
  if (!m) return 0;
  let total = 0;
  for (const src of SOURCES) for (const qq of q ? [q] : (["high", "low"] as Quality[])) total += m[src][qq] ?? 0;
  return total;
}

export const totalWithdrawal = (s: Site) => sumMatrix(s.withdrawal);
export const totalDischarge = (s: Site) => sumMatrix(s.discharge);
export const highQualityWithdrawal = (s: Site) => sumMatrix(s.withdrawal, "high");

export type BalanceStatus = "closes" | "gap" | "over" | "unverifiable";

export interface Balance {
  withdrawal: number | null;
  discharge: number | null;
  consumption: number | null;
  deltaStorage: number | null;
  /** discharge + consumption + change in storage */
  accounted: number | null;
  /** withdrawal - accounted. Positive: water unaccounted for. Negative: more water reported out than in. */
  gap: number | null;
  gapPct: number | null;
  status: BalanceStatus;
  missing: string[];
}

/**
 * ICMM site water balance: withdrawal = discharge + consumption + change in storage.
 * (Reuse/recycle is internal to the site and does not enter the balance.)
 */
export function balanceOf(s: Site, tolerancePct: number): Balance {
  const w = totalWithdrawal(s);
  const knownDischarge = s.discharge ? sumKnown(s.discharge) : null;
  const d = totalDischarge(s);
  const c = s.consumption;
  const ds = s.deltaStorage;
  const missing: string[] = [];
  if (w === null) missing.push("withdrawal");
  if (s.discharge === null) missing.push("discharge");
  else if (d === null) missing.push("part of discharge");
  if (c === null) missing.push("consumption");
  if (ds === null) missing.push("change in storage (treated as zero)");

  if (w === null || knownDischarge === null || c === null) {
    return { withdrawal: w, discharge: knownDischarge, consumption: c, deltaStorage: ds, accounted: null, gap: null, gapPct: null, status: "unverifiable", missing };
  }
  const accounted = knownDischarge + c + (ds ?? 0);
  const gap = w - accounted;
  const gapPct = w > 0 ? (gap / w) * 100 : 0;
  const status: BalanceStatus = Math.abs(gapPct) <= tolerancePct ? "closes" : gap > 0 ? "gap" : "over";
  return { withdrawal: w, discharge: knownDischarge, consumption: c, deltaStorage: ds, accounted, gap, gapPct, status, missing };
}

/** High-quality (freshwater) withdrawal per 1,000 oz gold-equivalent. */
export function freshwaterPerKoz(s: Site): number | null {
  const hq = highQualityWithdrawal(s);
  if (hq === null || !s.productionOzAuEq) return null;
  return hq / (s.productionOzAuEq / 1000);
}

/** Total withdrawal in m³ per tonne of ore milled. */
export function m3PerTonneOre(s: Site): number | null {
  const w = totalWithdrawal(s);
  if (w === null || !s.oreMilledT) return null;
  return (w * 1000) / s.oreMilledT;
}

/** Freshwater m³ per tonne of ore milled. */
export function freshM3PerTonneOre(s: Site): number | null {
  const hq = highQualityWithdrawal(s);
  if (hq === null || !s.oreMilledT) return null;
  return (hq * 1000) / s.oreMilledT;
}

/** Share of the site's water demand met by recycled/reused water. */
export function recycledShare(s: Site): number | null {
  const w = totalWithdrawal(s);
  if (w === null || s.reuse === null) return null;
  return s.reuse / (s.reuse + w);
}

export const isStressed = (s: Site) => s.waterStress === "high" || s.waterStress === "extremely-high";

export function median(xs: number[]) {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
