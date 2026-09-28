// Data integrity and tamper signals on the corpus. None of these prove manipulation:
// they point an analyst to the numbers that need a second look, with the evidence.
import { canonical, fileYears, key } from "./series";
import { modelComparisons } from "@/lib/research/lutter";
import { CORPORATE, isAggregate, type Corpus, type CorpusRecord, type Metric } from "./types";

export type SignalKind =
  | "restatement"
  | "sites-vs-total"
  | "components-vs-total"
  | "balance"
  | "jump"
  | "unit-error"
  | "duplicate"
  | "impossible"
  | "benford"
  | "rounding"
  | "model-gap";

export interface Signal {
  kind: SignalKind;
  severity: "high" | "medium" | "low";
  company: string;
  site?: string;
  year?: number;
  metric?: Metric;
  title: string;
  detail: string;
  evidence: { label: string; value: number; source: string; location: string }[];
}

export const SIGNAL_LABEL: Record<SignalKind, string> = {
  restatement: "Restated between reports",
  "sites-vs-total": "Sites do not add up to the total",
  "components-vs-total": "Sources do not add up to the total",
  balance: "Water balance does not close",
  jump: "Unexplained jump",
  "unit-error": "Probable unit error",
  duplicate: "Identical figure repeated",
  impossible: "Impossible value",
  benford: "Digit pattern unusual",
  rounding: "Heavy rounding",
  "model-gap": "Differs from independent model",
};

const WATER_VOLUME: Metric[] = [
  "withdrawal_total",
  "withdrawal_surface",
  "withdrawal_ground",
  "withdrawal_sea",
  "withdrawal_third_party",
  "withdrawal_rain_runoff",
  "withdrawal_entrained_ore",
  "withdrawal_other",
  "withdrawal_fresh",
  "withdrawal_low_quality",
  "withdrawal_water_stressed",
  "discharge_total",
  "consumption_total",
  "reused_recycled",
];
const METRIC_NAME: Record<string, string> = {
  withdrawal_total: "Withdrawal",
  withdrawal_fresh: "Freshwater",
  withdrawal_water_stressed: "Stressed-area withdrawal",
  discharge_total: "Discharge",
  consumption_total: "Consumption",
  reused_recycled: "Reuse",
};
const ratioTxt = (r: number) => (r >= 1 ? `×${fmt(r)}` : `÷${fmt(1 / r)}`);
const isVolume = (m: string) => (WATER_VOLUME as string[]).includes(m);
const ev = (r: CorpusRecord, label?: string) => ({ label: label ?? `${r.site === CORPORATE ? "Company total" : r.site} ${r.year}`, value: r.value, source: r.sourceFile, location: r.location });
const pctDiff = (a: number, b: number) => (b === 0 ? (a === 0 ? 0 : Infinity) : (a - b) / Math.abs(b));
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });
const siteLabel = (s: string) => (s === CORPORATE ? "company total" : s);

export function integritySignals(corpus: Corpus, opts: { tolerancePct?: number } = {}): Signal[] {
  const tol = (opts.tolerancePct ?? 5) / 100;
  const out: Signal[] = [];
  const fy = fileYears(corpus);
  const canon = canonical(corpus);

  // 1. Restatements: the same figure stated differently in two reports.
  const groups = new Map<string, CorpusRecord[]>();
  for (const r of corpus.records) {
    const k = key(r);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  for (const rs of groups.values()) {
    const files = new Set(rs.map((r) => r.sourceFile));
    if (files.size < 2) continue;
    const sorted = [...rs].sort((a, b) => (fy.get(a.sourceFile) ?? 0) - (fy.get(b.sourceFile) ?? 0));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const d = pctDiff(last.value, first.value);
    if (Math.abs(d) < 0.005) continue;
    const explained = rs.some((r) => /restat|revis|correct|recalcul|updated/i.test(r.note ?? ""));
    out.push({
      kind: "restatement",
      severity: explained ? "low" : Math.abs(d) > 0.1 ? "high" : "medium",
      company: first.company,
      site: first.site,
      year: first.year,
      metric: first.metric,
      title: `${METRIC_NAME[first.metric] ?? first.metric} for ${siteLabel(first.site)} ${first.year} changed by ${d > 0 ? "+" : ""}${(d * 100).toFixed(1)}% between reports`,
      detail: explained
        ? "The later report flags this as a restatement."
        : "The later report does not say this figure was restated. Silent restatements are the most common way historical baselines drift.",
      evidence: sorted.map((r) => ev(r, `As stated in ${r.sourceFile}`)),
    });
  }

  // Index canonical values.
  const at = (company: string, site: string, year: number, metric: Metric) => canon.get(`${company}|${site}|${year}|${metric}`);
  const cells = [...canon.values()];
  const companySiteYears = new Map<string, { company: string; site: string; year: number }>();
  for (const r of cells) companySiteYears.set(`${r.company}|${r.site}|${r.year}`, { company: r.company, site: r.site, year: r.year });

  // 2. Sites vs published company total.
  for (const r of cells) {
    if (r.site !== CORPORATE || !isVolume(r.metric)) continue;
    const siteRecs = cells.filter((s) => s.company === r.company && s.year === r.year && s.metric === r.metric && s.site !== CORPORATE && !isAggregate(s.site));
    if (siteRecs.length < 2) continue;
    const sum = siteRecs.reduce((a, s) => a + s.value, 0);
    const d = pctDiff(sum, r.value);
    // Sites summing to less than the total is expected when not every site is itemised, so a shortfall is only
    // an error when every listed site reported this metric.
    const listed = corpus.sites.filter((x) => x.company === r.company && x.site !== CORPORATE && !isAggregate(x.site)).length;
    const complete = listed > 0 && siteRecs.length >= listed;
    if (d > tol || d < -0.25 || (complete && d < -tol)) {
      const label = METRIC_NAME[r.metric] ?? r.metric;
      out.push({
        kind: "sites-vs-total",
        severity: d > tol || complete ? "high" : "low",
        company: r.company,
        year: r.year,
        metric: r.metric,
        title: `${label}: ${siteRecs.length} sites sum to ${fmt(sum)} ML against a reported total of ${fmt(r.value)} ML (${d > 0 ? "+" : ""}${(d * 100).toFixed(1)}%)`,
        detail:
          d > 0
            ? "The sites add up to more than the company total. At least one figure is wrong."
            : complete
              ? "Every site is reported, yet the company total is larger than their sum: something is double-counted or a site figure is missing."
              : "Sites cover less than three quarters of the total. Some operations are not itemised, so site-level analysis misses part of the footprint.",
        evidence: [ev(r), ...siteRecs.map((s) => ev(s))],
      });
    }
  }

  // 3. Components vs total, and 4. water balance, per site-year.
  const sourceParts: Metric[] = ["withdrawal_surface", "withdrawal_ground", "withdrawal_sea", "withdrawal_third_party", "withdrawal_rain_runoff", "withdrawal_entrained_ore", "withdrawal_other"];
  for (const { company, site, year } of companySiteYears.values()) {
    const total = at(company, site, year, "withdrawal_total");
    if (total && total.value > 0) {
      const parts = sourceParts.map((m) => at(company, site, year, m)).filter((x): x is CorpusRecord => !!x);
      if (parts.length >= 2) {
        const sum = parts.reduce((a, p) => a + p.value, 0);
        const d = pctDiff(sum, total.value);
        if (Math.abs(d) > tol) {
          out.push({
            kind: "components-vs-total",
            severity: d > tol ? "high" : "medium",
            company,
            site,
            year,
            metric: "withdrawal_total",
            title: `Withdrawal by source sums to ${fmt(sum)} ML, total says ${fmt(total.value)} ML (${d > 0 ? "+" : ""}${(d * 100).toFixed(1)}%)`,
            detail: d > 0 ? "The parts exceed the whole." : "Part of the withdrawal is not assigned to any source.",
            evidence: [ev(total, "Total withdrawal"), ...parts.map((p) => ev(p, p.metric.replace("withdrawal_", "")))],
          });
        }
      }
      const fresh = at(company, site, year, "withdrawal_fresh");
      if (fresh && fresh.value > total.value * (1 + tol)) {
        out.push({
          kind: "impossible",
          severity: "high",
          company,
          site,
          year,
          metric: "withdrawal_fresh",
          title: `Freshwater withdrawal (${fmt(fresh.value)} ML) exceeds total withdrawal (${fmt(total.value)} ML)`,
          detail: "A subset cannot be larger than the whole.",
          evidence: [ev(fresh, "Freshwater"), ev(total, "Total")],
        });
      }
      const stressed = at(company, site, year, "withdrawal_water_stressed");
      if (stressed && stressed.value > total.value * (1 + tol)) {
        out.push({
          kind: "impossible",
          severity: "high",
          company,
          site,
          year,
          metric: "withdrawal_water_stressed",
          title: `Withdrawal in water-stressed areas (${fmt(stressed.value)} ML) exceeds total withdrawal (${fmt(total.value)} ML)`,
          detail: "A subset cannot be larger than the whole.",
          evidence: [ev(stressed, "Stressed areas"), ev(total, "Total")],
        });
      }
      const dis = at(company, site, year, "discharge_total");
      const con = at(company, site, year, "consumption_total");
      if (dis && con) {
        const st = at(company, site, year, "water_stored_change");
        // ICMM 2021 "other managed water" (dewatering or diversions discharged without use) is outside withdrawal,
        // and reports differ on whether their discharge figure includes it. Test both readings; keep the closer one.
        const omw = at(company, site, year, "other:other_managed_water") ?? at(company, site, year, "other:other_managed_water_withdrawal");
        const base = total.value - dis.value - con.value - (st?.value ?? 0);
        const gap = omw && Math.abs(base + omw.value) < Math.abs(base) ? base + omw.value : base;
        const g = gap / total.value;
        if (Math.abs(g) > Math.max(tol, 0.1)) {
          out.push({
            kind: "balance",
            severity: g < -0.1 ? "high" : "medium",
            company,
            site,
            year,
            title: `Withdrawal minus discharge and consumption leaves ${fmt(gap)} ML (${(g * 100).toFixed(0)}% of withdrawal)`,
            detail:
              g < 0
                ? "More water is reported leaving than entering. Either a source is missing or a volume is overstated."
                : "Water enters and is not accounted for. ICMM expects withdrawal = discharge + consumption + change in storage.",
            evidence: [ev(total, "Withdrawal"), ...(omw ? [ev(omw, "Other managed water")] : []), ev(dis, "Discharge"), ev(con, "Consumption"), ...(st ? [ev(st, "Change in storage")] : [])],
          });
        }
      }
    }
    const rate = at(company, site, year, "reuse_rate_pct");
    if (rate && (rate.value < 0 || rate.value > 100)) {
      out.push({ kind: "impossible", severity: "high", company, site, year, metric: "reuse_rate_pct", title: `Reuse rate of ${fmt(rate.value)}%`, detail: "Rates must lie between 0 and 100%.", evidence: [ev(rate)] });
    }
  }
  for (const r of cells) {
    if (isVolume(r.metric) && r.value < 0) {
      out.push({ kind: "impossible", severity: "high", company: r.company, site: r.site, year: r.year, metric: r.metric, title: `Negative volume: ${fmt(r.value)} ML`, detail: "Volumes cannot be negative.", evidence: [ev(r)] });
    }
  }

  // 5. Jumps and unit errors year on year, for the headline metrics.
  const seriesKeys = new Map<string, CorpusRecord[]>();
  for (const r of cells) {
    if (!["withdrawal_total", "withdrawal_fresh", "withdrawal_water_stressed", "discharge_total", "consumption_total", "reused_recycled"].includes(r.metric)) continue;
    const k = `${r.company}|${r.site}|${r.metric}`;
    seriesKeys.set(k, [...(seriesKeys.get(k) ?? []), r]);
  }
  for (const rs of seriesKeys.values()) {
    const s = rs.sort((a, b) => a.year - b.year);
    for (let i = 1; i < s.length; i++) {
      const prev = s[i - 1];
      const cur = s[i];
      if (cur.year - prev.year !== 1 || prev.value <= 0 || cur.value <= 0) continue;
      const ratio = cur.value / prev.value;
      const near1000 = Math.abs(Math.log10(ratio) - 3) < 0.15 || Math.abs(Math.log10(ratio) + 3) < 0.15;
      if (near1000) {
        out.push({
          kind: "unit-error",
          severity: "high",
          company: cur.company,
          site: cur.site,
          year: cur.year,
          metric: cur.metric,
          title: `${METRIC_NAME[cur.metric] ?? cur.metric} for ${siteLabel(cur.site)} moves ${ratioTxt(ratio)} from ${prev.year} to ${cur.year}`,
          detail: "A change of about a thousandfold usually means m³ and ML (or ML and GL) were mixed up.",
          evidence: [ev(prev), ev(cur)],
        });
      } else if ((ratio > 2.5 || ratio < 0.4) && Math.max(prev.value, cur.value) > 100) {
        const crossed = (corpus.breaks ?? []).find((b) => b.company === cur.company && b.kind === "break" && prev.year < b.year && b.year <= cur.year);
        const explained = !!crossed || /divest|acqui|closure|closed|care and maintenance|expan|commission|ramp|drought|flood|scope|restat|methodolog/i.test(`${cur.note ?? ""} ${prev.note ?? ""}`);
        out.push({
          kind: "jump",
          severity: explained ? "low" : "medium",
          company: cur.company,
          site: cur.site,
          year: cur.year,
          metric: cur.metric,
          title: `${METRIC_NAME[cur.metric] ?? cur.metric} for ${siteLabel(cur.site)} ${ratio > 1 ? "rises" : "falls"} ${ratio > 1 ? `×${fmt(ratio)}` : `${((1 - ratio) * 100).toFixed(0)}%`} from ${prev.year} to ${cur.year}`,
          detail: crossed
            ? `Crosses a documented change of basis in ${crossed.year}: ${crossed.reason}`
            : explained
              ? `Explained in the report: ${(cur.note ?? prev.note ?? "").slice(0, 160)}`
              : "No explanation recorded next to the figure. Check for scope changes, new methodology or a data error.",
          evidence: [ev(prev), ev(cur)],
        });
      }
    }
  }

  // 6. Identical non-round figures reused for different sites, years or metrics.
  const byCompanyValue = new Map<string, CorpusRecord[]>();
  for (const r of cells) {
    if (!isVolume(r.metric) || r.value < 100 || Number.isInteger(r.value / 100)) continue;
    const k = `${r.company}|${r.value}`;
    byCompanyValue.set(k, [...(byCompanyValue.get(k) ?? []), r]);
  }
  for (const rs of byCompanyValue.values()) {
    const distinct = new Set(rs.map((r) => `${r.site}|${r.year}`));
    // Same site-year with two metrics equal is often legitimate (e.g. total = freshwater). Flag across site-years.
    if (distinct.size < 2) continue;
    const years = new Set(rs.map((r) => r.year));
    const sites = new Set(rs.map((r) => r.site));
    out.push({
      kind: "duplicate",
      severity: "medium",
      company: rs[0].company,
      title: `${fmt(rs[0].value)} ML appears ${rs.length} times (${sites.size} site${sites.size > 1 ? "s" : ""}, ${years.size} year${years.size > 1 ? "s" : ""})`,
      detail: "An exact, non-round figure repeated for a different site or year is a sign of a carried-forward or copy-pasted value.",
      evidence: rs.map((r) => ev(r, `${siteLabel(r.site)} ${r.year} ${r.metric}`)),
    });
  }

  // 7. Benford first-digit test and 8. rounding, per company.
  for (const company of corpus.companies) {
    const vals = cells.filter((r) => r.company === company && isVolume(r.metric) && r.value >= 10).map((r) => r.value);
    if (vals.length >= 60) {
      const b = benford(vals);
      if (b.mad > 0.015) {
        out.push({
          kind: "benford",
          severity: "low",
          company,
          title: `First digits of ${vals.length} water figures deviate from Benford's law (MAD ${b.mad.toFixed(3)})`,
          detail: `Most over-represented leading digit: ${b.worstDigit} (${(b.observed[b.worstDigit - 1] * 100).toFixed(0)}% observed vs ${(b.expected[b.worstDigit - 1] * 100).toFixed(0)}% expected). Above 0.015 is "nonconformity" in Nigrini's scale. Worth a look, not proof: small sets and site-size clustering can do this.`,
          evidence: [],
        });
      }
    }
    const big = cells.filter((r) => r.company === company && isVolume(r.metric) && r.value >= 1000);
    if (big.length >= 20) {
      const round = big.filter((r) => Number.isInteger(r.value / 1000)).length / big.length;
      // Chance that a figure ≥1,000 ML is an exact multiple of 1,000 is ~0.1% for precise measurements.
      if (round > 0.3) {
        out.push({
          kind: "rounding",
          severity: "low",
          company,
          title: `${(round * 100).toFixed(0)}% of figures over 1,000 ML are exact thousands`,
          detail: "Metered data is rarely this round. The company either rounds heavily or estimates these volumes. That is not wrong, but it limits what trends can show.",
          evidence: [],
        });
      }
    }
  }

  // 9. Reported freshwater vs the WU Vienna copper-mine model (independent estimate, ±35%).
  for (const m of modelComparisons(corpus)) {
    if (m.sameSource || Math.abs(m.z) < 1.5) continue;
    out.push({
      kind: "model-gap",
      severity: Math.abs(m.z) >= 2 ? "medium" : "low",
      company: m.company,
      site: m.site,
      year: m.year,
      metric: m.reportedMetric,
      title: `Reported ${m.reportedMetric === "withdrawal_fresh" ? "freshwater" : "withdrawal"} is ${m.ratio < 1 ? `${Math.round((1 - m.ratio) * 100)}% below` : `${m.ratio.toFixed(1)}× above`} the WU Vienna model (${fmt(m.reported)} vs ${fmt(m.modelled)} ML)`,
      detail: `An independent machine-learning estimate for ${m.mine} (Lutter et al. 2025, R² 0.79) disagrees by more than its own error band. Either the report uses a narrower definition (e.g. excludes dewatering or recycled make-up) or a figure is wrong.`,
      evidence: [
        { label: `Reported ${m.year}`, value: m.reported, source: m.source, location: m.location },
        { label: `Modelled ${m.year} (new water)`, value: Math.round(m.modelled), source: "Lutter et al. 2025, WU Vienna", location: m.mine },
      ],
    });
  }

  const rank = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity] || a.company.localeCompare(b.company));
}

export function benford(values: number[]) {
  const expected = Array.from({ length: 9 }, (_, i) => Math.log10(1 + 1 / (i + 1)));
  const counts = new Array(9).fill(0);
  let n = 0;
  for (const v of values) {
    const d = Number(String(Math.abs(v)).replace(/^[0.]+/, "")[0]);
    if (d >= 1 && d <= 9) {
      counts[d - 1]++;
      n++;
    }
  }
  const observed = counts.map((c) => (n ? c / n : 0));
  const diffs = observed.map((o, i) => o - expected[i]);
  const mad = diffs.reduce((a, d) => a + Math.abs(d), 0) / 9;
  const worstDigit = diffs.indexOf(Math.max(...diffs)) + 1;
  return { n, observed, expected, mad, worstDigit };
}

/**
 * 0-100 integrity score, normalised by disclosure size so a company isn't penalised for publishing more:
 * weighted signals (high 8, medium 3, low 1) per 100 figures, mapped as 100·e^(−density/10).
 */
export function integrityScore(signals: Signal[], company: string, figures: number) {
  const w = { high: 8, medium: 3, low: 1 };
  const own = signals.filter((s) => s.company === company);
  const density = (100 * own.reduce((a, s) => a + w[s.severity], 0)) / Math.max(figures, 1);
  return { score: Math.round(100 * Math.exp(-density / 10)), density, high: own.filter((s) => s.severity === "high").length, total: own.length };
}

export const figureCounts = (corpus: Corpus) => {
  const m = new Map<string, number>();
  for (const r of corpus.records) m.set(r.company, (m.get(r.company) ?? 0) + 1);
  return m;
};
