// Market Foresight Canvas: trend line from disclosed data, expected consequences if nothing
// changes, the future we want, and the interventions that bridge the two at each horizon.
// Numbers are computed from the corpus; the narrative is analysis and says where it is.
import type { Corpus } from "./types";
import type { CompanyProfile } from "./indicators";
import { industryTrend } from "./indicators";
import type { Signal } from "./integrity";
import { HORIZONS, median, type HorizonId } from "./trends";

export interface Facts {
  companies: number;
  reports: number;
  firstYear: number;
  lastYear: number;
  figures: number;
  withdrawalChange: number | null;
  withdrawalCompanies: number;
  withdrawalGrowing: number;
  reuseLatestMedian: number | null;
  reuseChangePts: number | null;
  reuseCompanies: number;
  siteLevel: number;
  stressDisclosed: number;
  consumptionDisclosed: number;
  companiesWithHigh: number;
  highSignals: number;
  restatements: number;
  /** Industry withdrawal index (latest median reporting year = 100) at each horizon, if nothing changes. */
  withdrawalIndex: Record<HorizonId, number | null>;
  reuseAt: Record<HorizonId, number | null>;
  baseYear: number;
}

export function computeFacts(corpus: Corpus, profiles: CompanyProfile[], signals: Signal[]): Facts {
  const w = industryTrend(profiles, "withdrawal");
  const r = industryTrend(profiles, "reuse");
  const lastYears = profiles.map((p) => p.lastYear).filter((y): y is number => y !== null);
  const baseYear = Math.round(median(lastYears) ?? 2022);
  const reuseLatest = median(profiles.map((p) => p.latest.reuse).filter((v): v is number => v !== undefined));
  const years = corpus.records.map((x) => x.year);
  const withdrawalIndex = {} as Facts["withdrawalIndex"];
  const reuseAt = {} as Facts["reuseAt"];
  for (const h of HORIZONS) {
    withdrawalIndex[h.id] = w.medianChange === null ? null : 100 * (1 + w.medianChange) ** (h.year - baseYear);
    reuseAt[h.id] = reuseLatest === null || r.medianChange === null ? null : Math.max(0, Math.min(100, reuseLatest + r.medianChange * 100 * (h.year - baseYear)));
  }
  return {
    companies: corpus.companies.length,
    reports: corpus.files.filter((f) => f.relevant).length,
    firstYear: Math.min(...years),
    lastYear: Math.max(...years),
    figures: corpus.records.length,
    withdrawalChange: w.medianChange,
    withdrawalCompanies: w.companies,
    withdrawalGrowing: w.changes.filter((c) => c.change > 0).length,
    reuseLatestMedian: reuseLatest,
    reuseChangePts: r.medianChange === null ? null : r.medianChange * 100,
    reuseCompanies: r.companies,
    siteLevel: profiles.filter((p) => p.siteLevel).length,
    stressDisclosed: profiles.filter((p) => p.disclosed["withdrawal_water_stressed"]).length,
    consumptionDisclosed: profiles.filter((p) => p.disclosed["consumption_total"]).length,
    companiesWithHigh: new Set(signals.filter((s) => s.severity === "high").map((s) => s.company)).size,
    highSignals: signals.filter((s) => s.severity === "high").length,
    restatements: signals.filter((s) => s.kind === "restatement").length,
    withdrawalIndex,
    reuseAt,
    baseYear,
  };
}

export interface Intervention {
  action: string;
  detail: string;
  /** "built" = in AquaTrace now; "next" = the build for this horizon; "partner" = needs others. */
  status: "built" | "next" | "partner";
}

export interface HorizonCard {
  id: HorizonId;
  label: string;
  year: number;
  /** The event on our canvas trend line at this horizon. */
  event: string;
  expected: string;
  consequences: { market: string; industry: string; customers: string; businessModel: string };
  desired: string;
  interventions: Intervention[];
}

const p1 = (x: number | null, d = 1) => (x === null ? "–" : `${x >= 0 ? "+" : ""}${x.toFixed(d)}`);
const i0 = (x: number | null) => (x === null ? "–" : Math.round(x).toString());

/** Our Market Foresight Canvas: trend, drivers and milestones as agreed on the poster. */
export const CANVAS = {
  trend: "Circular water use in industry",
  vertical: "Mining is where it starts: the heaviest industrial water user, in the driest basins, supplying the battery and AI boom.",
  drivers: [
    { title: "AI boom and battery factories", detail: "Demand for copper, lithium, nickel and cobalt, and for water-hungry chip and battery plants, keeps rising." },
    { title: "Regulation on water use", detail: "ESRS E3, ISSB/SASB water metrics, EU Battery Regulation due diligence, Chile's 2022 water code reform." },
  ],
  milestones: [
    { year: 2028, text: "First water-positive plants" },
    { year: 2030, text: "Water-rights trading schemes" },
    { year: 2035, text: "Near-closed water loops are the norm" },
  ],
};

export function trendStatement(f: Facts) {
  return {
    headline: "Circular water use in industry: mining's water footprint keeps growing, and the evidence behind it is fragmented",
    body:
      `Across ${f.companies} mining companies and ${f.reports} reports (${f.firstYear}–${f.lastYear}), disclosed withdrawal grows a median ` +
      `${p1(f.withdrawalChange === null ? null : f.withdrawalChange * 100)}% a year (${f.withdrawalGrowing} of ${f.withdrawalCompanies} companies rising). ` +
      `Recycling has plateaued: the median reuse share is ${i0(f.reuseLatestMedian)}% and moves ${p1(f.reuseChangePts)} points a year. ` +
      `Only ${f.stressDisclosed} of ${f.companies} give a figure for withdrawal in water-stressed areas in their latest year, and ` +
      `${f.companiesWithHigh} of ${f.companies} have at least one figure that fails a basic consistency check. Meanwhile water tariffs are rising ` +
      `and regulation is coming. Circular water use has to be measured before it can be priced, traded or required.`,
  };
}

export function horizonCards(f: Facts): HorizonCard[] {
  const idx = (id: HorizonId) => i0(f.withdrawalIndex[id]);
  const reuse = (id: HorizonId) => i0(f.reuseAt[id]);
  return [
    {
      id: "now",
      label: "Now",
      year: HORIZONS[0].year,
      event: "Rising water tariffs",
      expected:
        `Water tariffs start to rise. Withdrawal index ${idx("now")} (${f.baseYear} = 100), reuse ~${reuse("now")}%. Water data lives in PDFs and ` +
        `one-off workbooks with each company's own definitions. ${f.siteLevel} of ${f.companies} publish site figures, and restatements, ` +
        `reclassifications and unit slips (all found in this corpus) go unflagged.`,
      consequences: {
        market: "Water risk is priced by guesswork: lenders and insurers load whole regions instead of pricing individual sites.",
        industry: "Early movers lock in long-term water contracts before tariffs climb further.",
        customers: "Metal buyers ask for water data in due-diligence questionnaires and get PDFs they can't compare or check.",
        businessModel: "Water is still an operating-cost line. A good water performer has no way to prove it.",
      },
      desired: "Every site's real water use is measured and traceable, and anyone can see whether a number adds up and whether it changed since last year.",
      interventions: [
        { action: "PoC water-use monitoring", detail: `AquaTrace itself: ${f.companies} companies and ${f.figures.toLocaleString("en-US")} figures on one schema, each linked to a page or cell.`, status: "built" },
        { action: "File fingerprints, consistency checks and audit log", detail: "SHA-256 of every report; restatement, balance, sum, jump, unit-error and digit tests; hash-chained log of every save.", status: "built" },
        { action: "One submission template for every company", detail: "Companies report once in the AquaTrace template and get their trend, peer rank and fixes back immediately.", status: "built" },
      ],
    },
    {
      id: "2y",
      label: "+2 years",
      year: HORIZONS[1].year,
      event: "Water tariffs +400%",
      expected:
        `Tariffs up about 400% in stressed basins (the ledger's Cost and regulation view shows the effect per site). Withdrawal index ${idx("2y")}, ` +
        `reuse ~${reuse("2y")}%. Reporting rules tighten but diverge: ESRS E3, ISSB/SASB water metrics, battery-regulation due diligence. ` +
        `Milestone: the first water-positive plants open (2028).`,
      consequences: {
        market: "Governments offer subsidies for technological adaptation (reuse, dry tailings, desalination) to soften the tariff shock.",
        industry: "Long-term water contracts become the standard way to secure supply; mid-tier miners without data teams fall behind.",
        customers: "Battery makers and automakers need site-level water data for due diligence. Company totals no longer pass.",
        businessModel: "Water turns from an operating cost into a contract and financing question, and verified data becomes worth paying for.",
      },
      desired: "Companies invest in circular plants because subsidies and contracts reward measured, verified reuse, not claims.",
      interventions: [
        { action: "Cheaper sensors, SCADA and IoT monitoring", detail: "Stream flow-meter and SCADA data straight into the ledger, signed at the device, so annual figures come from measurements.", status: "next" },
        { action: "Submission API and framework mapping", detail: "Accept data directly and generate GRI 303, ICMM Table 4, SASB EM-MM-140a and ESRS E3 outputs from the same record.", status: "next" },
        { action: "Basin stress attached automatically", detail: "Geolocate each site and attach WRI Aqueduct indicators, so 'water-stressed' no longer depends on each company's own definition.", status: "next" },
      ],
    },
    {
      id: "5y",
      label: "+5 years",
      year: HORIZONS[2].year,
      event: "Political stalemate",
      expected:
        `Political stalemate: rules lag behind the tariff shock and differ by country. Withdrawal index ${idx("5y")}, reuse ~${reuse("5y")}%, if nothing ` +
        `changes. Milestone: water-rights trading schemes start (2030). Chile's 2022 water code reform already makes new rights temporary and puts ` +
        `people first. Desalination becomes the marginal source, tying water cost to energy cost.`,
      consequences: {
        market: "Production relocates to non-regulated markets outside the EU, where water is cheaper and rules are weaker.",
        industry: "Monopolistic structures form around access to water infrastructure: whoever owns the pipeline, desalination plant or reuse network sets the terms.",
        customers: "Buyers need certified water figures to trade water rights and prove compliance, and uncertified supply is discounted.",
        businessModel: "Water becomes a tradable, audited asset, so certified use and reuse carry a price.",
      },
      desired:
        "Adaptive, real-time water management at every site. Reuse and greywater are the default for cooling, cleaning and many process uses, and trading rewards verified savings.",
      interventions: [
        { action: "Reliable certification of water use for the trading scheme", detail: "Signed submissions and assurer workspaces, so each traded volume is backed by metered, checked and audited data.", status: "next" },
        { action: "Anomaly models trained on the corpus", detail: "Learned expectations per process route replace fixed thresholds, so certification catches what humans miss.", status: "next" },
        { action: "Permit-aware scenarios", detail: "Link the tariff and cap scenarios to actual permit terms per site, showing output at risk under each rule.", status: "next" },
      ],
    },
    {
      id: "10y",
      label: "+10 years",
      year: HORIZONS[3].year,
      event: "50% intake reduction by law, tariffs +1,000%",
      expected:
        `A 50% legal cut in freshwater intake and tariffs up about 1,000%. If nothing changes the withdrawal index is ${idx("10y")} and reuse is stuck near ` +
        `${reuse("10y")}%, so the cap bites hard: output that depends on irreplaceable freshwater is curtailed. Milestone: near-closed water loops are ` +
        `the norm (2035) for those who invested.`,
      consequences: {
        market: "Water-constrained supply becomes a structural factor in metal prices; sites without credible water data can't be financed.",
        industry: "Monopolies on water-infrastructure access harden, and operators outside shared circular systems close or sell.",
        customers: "Procurement rules and product passports require water provenance for metals in batteries, cars and electronics.",
        businessModel: "Verified water data is infrastructure that regulators, buyers and financiers read directly.",
      },
      desired:
        "Near-closed loops everywhere, and SMEs plug into shared reuse infrastructure instead of each building their own. Each basin has one shared, verifiable water account.",
      interventions: [
        { action: "Basin-scale shared circular water infrastructure", detail: "Basin ledgers across companies show cumulative use against renewable supply and allocate shared reuse capacity, including to SMEs.", status: "partner" },
        { action: "Open standard, neutral governance", detail: "Hand the schema and check rules to a multi-stakeholder body, so no single operator of water infrastructure controls the evidence.", status: "partner" },
        { action: "Metal-level water provenance", detail: "Carry verified water per tonne from site to product, for passports and procurement.", status: "next" },
      ],
    },
  ];
}
