// Data helpers for MapBasinsView: one memoised row per passport, summary tiles, balance notes,
// hotspot-chart points. Ported from the MineWater Passport prototype Explorer / Hotspots tabs.
import { isHot, kpis, transparency, type Passport } from "@/lib/passport/metrics";

export type SizeKey = "C" | "W";

export interface Row {
  p: Passport;
  id: string;
  k: ReturnType<typeof kpis>;
  t: ReturnType<typeof transparency>;
  hot: boolean;
  onMap: boolean;
}

const num = (v: unknown): v is number => typeof v === "number" && !Number.isNaN(v);

export function buildRows(ps: Passport[]): Row[] {
  return ps.map((p) => ({
    p,
    id: p.site.site_id,
    k: kpis(p),
    t: transparency(p),
    hot: isHot(p),
    onMap: num(p.site.latitude) && num(p.site.longitude),
  }));
}

/** Value used for marker size; NaN (not disclosed) becomes 0 = smallest dot. */
export const sizeVal = (r: Row, key: SizeKey) => (num(r.k[key]) ? r.k[key] : 0);

export function radius(v: number, max: number) {
  return 4 + Math.sqrt(max > 0 ? Math.max(0, v) / max : 0) * 24;
}

export function summary(rows: Row[]) {
  let W = 0,
    C = 0,
    Wc = 0,
    hs = 0,
    open = 0,
    noClose = 0,
    cSites = 0;
  for (const r of rows) {
    W += r.k.W || 0;
    if (num(r.k.C)) {
      C += r.k.C;
      Wc += r.k.W || 0;
      cSites++;
      if (r.k.stress.rank >= 4) hs += r.k.C;
    }
    if (!r.k.balance.known) open++;
    else if (!r.k.balance.ok) noClose++;
  }
  return {
    sites: rows.length,
    onMap: rows.filter((r) => r.onMap).length,
    tier2: rows.filter((r) => r.p.tier === "tier2").length,
    W,
    C,
    cSites,
    notReturned: Wc ? C / Wc : NaN,
    highStressShare: C ? hs / C : NaN,
    open,
    noClose,
  };
}

/** Plain-English balance status: residual, or which flow is missing. */
export function balanceNote(r: Row): { text: string; tone: "good" | "bad" | "warn" } {
  const b = r.k.balance;
  if (b.known) {
    const t = `${(b.pct * 100).toFixed(1)}% of withdrawal`;
    return b.ok ? { text: `${t}, closes`, tone: "good" } : { text: `${t}, does not close`, tone: "bad" };
  }
  const missing: string[] = [];
  if (!r.k.W) missing.push("withdrawal");
  if (!r.p.water.discharges) missing.push("discharge");
  if (!num(r.p.water.consumption.total_ml)) missing.push("consumption");
  return { text: `cannot close: ${missing.join(" and ") || "a flow"} not disclosed`, tone: "warn" };
}

export const esc = (s: string | undefined | null) =>
  (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

const f0 = (v: number) => (num(v) ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "n/d");

export function tooltipHtml(r: Row) {
  const s = r.p.site;
  return `<div style="font-size:12px;line-height:1.35"><b>${esc(s.name)}</b><br>${esc(s.operator)} · ${esc(s.country)}<br>Withdrawal ${f0(r.k.W)} ML · Consumption ${f0(r.k.C)} ML<br>Basin stress: ${esc(r.k.stress.label)} · Grade ${r.t.grade.g}${r.hot ? "<br><b>Hotspot</b>" : ""}</div>`;
}

/** Deterministic jitter in [-0.3, 0.3] from the site id, so points don't overlap and don't move between renders. */
function jitter(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (((h >>> 0) % 1000) / 1000 - 0.5) * 0.6;
}

export interface Pt {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  zKnown: boolean;
  color: string;
  stress: string;
  hot: boolean;
}

/** Hotspot bubble points. Uses the WRI score (0–5) when every site has one, else stress rank with jitter; unknown stress sits at x≈0. */
export function hotspotPoints(rows: Row[]) {
  const useScore = rows.length > 0 && rows.every((r) => num(r.p.site.basin?.bws_score));
  const pts: Pt[] = [];
  let skipped = 0;
  for (const r of rows) {
    if (!num(r.k.C) || r.k.C <= 0) {
      skipped++;
      continue;
    }
    const x = useScore ? (r.p.site.basin!.bws_score as number) : Math.max(-0.4, r.k.stress.rank + jitter(r.id));
    pts.push({ id: r.id, name: r.p.site.name, x, y: r.k.C, z: num(r.k.cPerOre) ? r.k.cPerOre : 0, zKnown: num(r.k.cPerOre), color: r.k.stress.color, stress: r.k.stress.label, hot: r.hot });
  }
  const zs = pts.filter((p) => p.zKnown).map((p) => p.z);
  const zMin = zs.length ? Math.min(...zs) : 0;
  for (const p of pts) if (!p.zKnown) p.z = zMin;
  return { pts, skipped, useScore, xThreshold: useScore ? 3 : 3.5 };
}
