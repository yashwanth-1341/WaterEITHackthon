// Analyse one company's submission against the corpus: its trends and projections, the same
// integrity checks, where it ranks among peers, and plain-language findings and actions.
import type { Corpus } from "@/lib/corpus/types";
import { Series } from "@/lib/corpus/series";
import { companyProfiles, INDICATORS, type CompanyProfile, type IndicatorId } from "@/lib/corpus/indicators";
import { integritySignals, integrityScore, type Signal } from "@/lib/corpus/integrity";
import { HORIZONS, median } from "@/lib/corpus/trends";
import type { Submission } from "./format";

export interface PeerRank {
  id: IndicatorId;
  label: string;
  value: number;
  peerMedian: number | null;
  /** 1 = best among the companies that report this indicator. */
  rank: number;
  of: number;
  better: "down" | "up";
}

export interface Finding {
  tone: "good" | "bad" | "neutral";
  text: string;
}

export interface Analysis {
  company: string;
  corpus: Corpus;
  profiles: CompanyProfile[];
  profile: CompanyProfile;
  signals: Signal[];
  score: number;
  ranks: PeerRank[];
  findings: Finding[];
  actions: string[];
}

export function analyseSubmission(base: Corpus, sub: Submission): Analysis {
  // Replace the company if it's already in the corpus (e.g. an existing company re-submitting).
  const corpus: Corpus = {
    ...base,
    companies: [...base.companies.filter((c) => c !== sub.company), sub.company],
    files: [...base.files.filter((f) => f.company !== sub.company), ...sub.files],
    sites: [...base.sites.filter((s) => s.company !== sub.company), ...sub.sites],
    records: [...base.records.filter((r) => r.company !== sub.company), ...sub.records],
    observations: base.observations.filter((o) => o.company !== sub.company),
  };
  const series = new Series(corpus);
  const profiles = companyProfiles(corpus, series);
  const profile = profiles.find((p) => p.company === sub.company)!;
  const signals = integritySignals(corpus).filter((s) => s.company === sub.company);
  const score = integrityScore(signals, sub.company, sub.records.length).score;

  const ranks: PeerRank[] = [];
  for (const ind of INDICATORS) {
    const value = profile.latest[ind.id];
    if (value === undefined) continue;
    const all = profiles.map((p) => p.latest[ind.id]).filter((v): v is number => v !== undefined);
    if (all.length < 3) continue;
    const peers = profiles.filter((p) => p.company !== sub.company).map((p) => p.latest[ind.id]).filter((v): v is number => v !== undefined);
    const sorted = [...all].sort((a, b) => (ind.better === "down" ? a - b : b - a));
    ranks.push({ id: ind.id, label: ind.label, value, peerMedian: median(peers), rank: sorted.indexOf(value) + 1, of: all.length, better: ind.better });
  }

  return { company: sub.company, corpus, profiles, profile, signals, score, ranks, findings: findings(profile, ranks, signals), actions: actions(profile, ranks, signals, sub) };
}

const pctTxt = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;
const n0 = (x: number) => Math.round(x).toLocaleString("en-US");

function findings(p: CompanyProfile, ranks: PeerRank[], signals: Signal[]): Finding[] {
  const out: Finding[] = [];
  const w = p.trends.withdrawal;
  if (w) {
    const end = w.project(HORIZONS[3].year).mid;
    out.push({
      tone: w.annualChange > 0 ? "bad" : "good",
      text: `Water withdrawn ${w.annualChange > 0 ? "rises" : "falls"} ${(Math.abs(w.annualChange) * 100).toFixed(1)}% a year (${w.firstYear}–${w.lastYear}). If nothing changes it reaches ${n0(end)} ML by ${HORIZONS[3].year}, ${pctTxt(end / w.lastValue - 1)} on ${w.lastYear}.`,
    });
  }
  const it = p.trends.intensity;
  if (it) {
    out.push({
      tone: it.annualChange > 0.005 ? "bad" : it.annualChange < -0.005 ? "good" : "neutral",
      text:
        it.annualChange > 0.005
          ? `Water per tonne of ore is getting worse (${pctTxt(it.annualChange)} a year): the growth in water use is not only from mining more.`
          : it.annualChange < -0.005
            ? `Water per tonne of ore improves ${(Math.abs(it.annualChange) * 100).toFixed(1)}% a year, so part of the growth is offset by efficiency.`
            : "Water per tonne of ore is flat: water use grows in step with production.",
    });
  }
  const f = p.trends.fresh;
  if (f) out.push({ tone: f.annualChange < 0 ? "good" : "bad", text: `Freshwater withdrawal ${f.annualChange < 0 ? "falls" : "rises"} ${(Math.abs(f.annualChange) * 100).toFixed(1)}% a year.` });
  const st = p.latest.stressedShare;
  if (st !== undefined) out.push({ tone: st > 50 ? "bad" : "neutral", text: `${Math.round(st)}% of its water comes from water-stressed areas${st > 50 ? ", where caps and price rises will hit first" : ""}.` });
  const reuse = ranks.find((r) => r.id === "reuse");
  if (reuse) out.push({ tone: reuse.peerMedian !== null && reuse.value < reuse.peerMedian ? "bad" : "good", text: `Reuse share is ${Math.round(reuse.value)}%, against a peer median of ${Math.round(reuse.peerMedian ?? 0)}% (rank ${reuse.rank} of ${reuse.of}).` });
  const high = signals.filter((s) => s.severity === "high").length;
  out.push({
    tone: high ? "bad" : "good",
    text: high ? `${high} figure${high > 1 ? "s" : ""} failed a consistency check and should be corrected before the data is published or audited.` : "No figure failed a high-severity consistency check.",
  });
  return out;
}

function actions(p: CompanyProfile, ranks: PeerRank[], signals: Signal[], sub: Submission): string[] {
  const out: string[] = [];
  const sites = (kind: Signal["kind"]) => [...new Set(signals.filter((s) => s.kind === kind && s.severity !== "low").map((s) => (s.site && s.site !== "_corporate" ? s.site : "company total")))];
  if (sub.issues.length) out.push(`Fix ${sub.issues.length} problem${sub.issues.length > 1 ? "s" : ""} in the file itself (unknown metrics, units or sites) and resubmit.`);
  const unit = sites("unit-error");
  if (unit.length) out.push(`Check units at ${unit.join(", ")}: a figure moved about a thousandfold, which usually means m³ was entered as ML.`);
  const bal = sites("balance");
  if (bal.length) out.push(`Make the water balance close at ${bal.join(", ")}: water in should equal water out, consumed and stored.`);
  const sum = [...sites("sites-vs-total"), ...sites("components-vs-total")];
  if (sum.length) out.push(`Reconcile totals (${[...new Set(sum)].join(", ")}): the parts don't add up to the reported total.`);
  const rest = signals.filter((s) => s.kind === "restatement" && s.severity !== "low");
  if (rest.length) out.push(`Explain ${rest.length} restated figure${rest.length > 1 ? "s" : ""} from the previous submission in the note column.`);
  if ((p.latest.stressedShare ?? 0) > 50) out.push("Put water-stressed sites first: set a freshwater cap per site and a date to meet it.");
  const reuse = ranks.find((r) => r.id === "reuse");
  if (reuse && reuse.peerMedian !== null && reuse.value < reuse.peerMedian) out.push(`Raise reuse from ${Math.round(reuse.value)}% towards the peer median of ${Math.round(reuse.peerMedian)}% (thickened tailings, closed circuits).`);
  if ((p.trends.intensity?.annualChange ?? 0) > 0.005) out.push("Reverse the rise in water per tonne before expanding output further.");
  const missing = Object.entries(p.disclosed).filter(([, v]) => !v).map(([k]) => k.replace(/_/g, " "));
  if (missing.length) out.push(`Start reporting: ${missing.join(", ")}.`);
  return out;
}
