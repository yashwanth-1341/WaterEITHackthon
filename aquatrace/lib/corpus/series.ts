// Turns the long-format corpus into time series.
// Where several reports state the same (company, site, year, metric), the most recent
// report wins (it carries any restatement); the others stay visible in the integrity checks.
import { CORPORATE, isAggregate, type Corpus, type CorpusRecord, type Metric } from "./types";

export const SOURCE_PARTS: Metric[] = [
  "withdrawal_surface",
  "withdrawal_ground",
  "withdrawal_sea",
  "withdrawal_third_party",
  "withdrawal_rain_runoff",
  "withdrawal_entrained_ore",
  "withdrawal_other",
];

export const key = (r: Pick<CorpusRecord, "company" | "site" | "year" | "metric">) => `${r.company}|${r.site}|${r.year}|${r.metric}`;

/** Report year of a file: the latest year it covers. */
export function fileYears(corpus: Corpus): Map<string, number> {
  const m = new Map<string, number>();
  for (const f of corpus.files) m.set(f.file, f.yearsCovered.length ? Math.max(...f.yearsCovered) : 0);
  return m;
}

/** One value per (company, site, year, metric): the one from the latest report. */
export function canonical(corpus: Corpus): Map<string, CorpusRecord> {
  const fy = fileYears(corpus);
  const out = new Map<string, CorpusRecord>();
  for (const r of corpus.records) {
    const k = key(r);
    const prev = out.get(k);
    if (!prev || (fy.get(r.sourceFile) ?? 0) > (fy.get(prev.sourceFile) ?? 0)) out.set(k, r);
  }
  return out;
}

export interface Point {
  year: number;
  value: number;
  /** "reported" = company-wide figure as published; "sum-of-sites" = our sum of site figures. */
  basis: "reported" | "sum-of-sites" | "sum-of-sources" | "site";
  sources: string[];
}

export class Series {
  readonly byKey: Map<string, CorpusRecord>;
  constructor(readonly corpus: Corpus) {
    this.byKey = canonical(corpus);
  }

  site(company: string, site: string, metric: Metric): Point[] {
    const pts: Point[] = [];
    for (const r of this.byKey.values()) {
      if (r.company === company && r.site === site && r.metric === metric) pts.push({ year: r.year, value: r.value, basis: "site", sources: [r.sourceFile] });
    }
    return pts.sort((a, b) => a.year - b.year);
  }

  /** Company-wide series: the reported total where published, otherwise the sum of the sites that year. */
  company(company: string, metric: Metric): Point[] {
    const reported = new Map<number, CorpusRecord>();
    const sums = new Map<number, { v: number; n: number; files: Set<string> }>();
    for (const r of this.byKey.values()) {
      if (r.company !== company || r.metric !== metric) continue;
      if (r.site === CORPORATE) reported.set(r.year, r);
      else if (!isAggregate(r.site)) {
        const s = sums.get(r.year) ?? { v: 0, n: 0, files: new Set<string>() };
        s.v += r.value;
        s.n += 1;
        s.files.add(r.sourceFile);
        sums.set(r.year, s);
      }
    }
    const years = new Set([...reported.keys(), ...sums.keys()]);
    const pts: Point[] = [];
    for (const y of years) {
      const r = reported.get(y);
      if (r) pts.push({ year: y, value: r.value, basis: "reported", sources: [r.sourceFile] });
      else if (!metric.endsWith("_pct")) {
        const s = sums.get(y)!;
        pts.push({ year: y, value: s.v, basis: "sum-of-sites", sources: [...s.files] });
      }
    }
    return pts.sort((a, b) => a.year - b.year);
  }

  /**
   * Total withdrawal; where no total is published for a year, the sum of the withdrawal sources
   * (surface, ground, sea, third-party, rain, entrained, other), labelled "sum-of-sources".
   */
  withdrawal(company: string): Point[] {
    const total = this.company(company, "withdrawal_total");
    const have = new Set(total.map((p) => p.year));
    const parts = SOURCE_PARTS.map((m) => this.company(company, m));
    const years = new Set(parts.flat().map((p) => p.year));
    const extra: Point[] = [];
    for (const y of years) {
      if (have.has(y)) continue;
      const pts = parts.map((ps) => ps.find((p) => p.year === y)).filter((p): p is Point => !!p);
      if (pts.length < 2) continue;
      extra.push({ year: y, value: pts.reduce((a, p) => a + p.value, 0), basis: "sum-of-sources", sources: [...new Set(pts.flatMap((p) => p.sources))] });
    }
    return [...total, ...extra].sort((a, b) => a.year - b.year);
  }

  sitesOf(company: string): string[] {
    const s = new Set<string>();
    for (const r of this.byKey.values()) if (r.company === company && r.site !== CORPORATE && !isAggregate(r.site)) s.add(r.site);
    return [...s].sort();
  }

  /** Metric ratio per year (e.g. withdrawal / ore processed), aligned on years where both exist. */
  ratio(company: string, num: Metric, den: Metric, scale = 1): Point[] {
    const d = new Map(this.company(company, den).map((p) => [p.year, p]));
    return (num === "withdrawal_total" ? this.withdrawal(company) : this.company(company, num))
      .filter((p) => d.get(p.year)?.value)
      .map((p) => ({ year: p.year, value: (p.value / d.get(p.year)!.value) * scale, basis: p.basis, sources: [...p.sources, ...d.get(p.year)!.sources] }));
  }

  /** Reuse share of total demand: reused / (reused + withdrawal). Uses the reported rate if there is one. */
  reuseShare(company: string): Point[] {
    const rate = this.company(company, "reuse_rate_pct");
    if (rate.length >= 2) return rate;
    const w = new Map(this.withdrawal(company).map((p) => [p.year, p]));
    return this.company(company, "reused_recycled")
      .filter((p) => w.get(p.year)?.value)
      .map((p) => ({ year: p.year, value: (100 * p.value) / (p.value + w.get(p.year)!.value), basis: p.basis, sources: p.sources }));
  }
}
