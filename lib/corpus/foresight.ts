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
  expected: string;
  consequences: { market: string; industry: string; customers: string; businessModel: string };
  desired: string;
  interventions: Intervention[];
}

const p1 = (x: number | null, d = 1) => (x === null ? "–" : `${x >= 0 ? "+" : ""}${x.toFixed(d)}`);
const i0 = (x: number | null) => (x === null ? "–" : Math.round(x).toString());

export function trendStatement(f: Facts) {
  return {
    headline: "Mining's water footprint keeps growing while the evidence behind it stays fragmented",
    body:
      `Across ${f.companies} companies and ${f.reports} reports (${f.firstYear}–${f.lastYear}), disclosed withdrawal grows a median ` +
      `${p1(f.withdrawalChange === null ? null : f.withdrawalChange * 100)}% a year (${f.withdrawalGrowing} of ${f.withdrawalCompanies} companies rising). ` +
      `Recycling has plateaued: the median reuse share is ${i0(f.reuseLatestMedian)}% and moves ${p1(f.reuseChangePts)} points a year. ` +
      `Only ${f.stressDisclosed} of ${f.companies} give a figure for withdrawal in water-stressed areas in their latest year, and ` +
      `${f.companiesWithHigh} of ${f.companies} have at least one figure that fails a basic consistency check. Demand for copper, ` +
      `gold and battery metals is rising at the same time, much of it from basins that are already short of water.`,
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
      expected:
        `Withdrawal index ${idx("now")} (${f.baseYear} = 100), reuse ~${reuse("now")}%. Water data lives in PDFs and one-off workbooks, ` +
        `each company with its own definitions. ${f.siteLevel} of ${f.companies} publish site figures; restatements, reclassifications and ` +
        `unit slips (all found in this corpus) go unflagged.`,
      consequences: {
        market: "Water risk is priced by rumour, not data. Lenders and insurers apply blanket loadings to 'dry' regions instead of pricing individual sites.",
        industry: "Companies spend on reporting rather than on water. Every framework (GRI 303, ICMM, SASB, CDP, ESRS E3) asks for similar numbers in a different shape.",
        customers: "Buyers of copper and battery metals ask for water data in due-diligence questionnaires and get PDFs they cannot compare or check.",
        businessModel: "Water is a line item under site operating cost. Nobody owns the basin-level picture, and a good water performer has no way to prove it to buyers.",
      },
      desired:
        "One comparable, traceable record per site and year. Any stakeholder can see where a number came from, whether it adds up and whether it changed since last year.",
      interventions: [
        { action: "Common schema with provenance on every figure", detail: `Done for ${f.companies} companies and ${f.figures.toLocaleString("en-US")} figures, each linked to a page or cell.`, status: "built" },
        { action: "File fingerprints and consistency checks", detail: "SHA-256 of every source report; restatement, balance, sum, jump, duplicate, unit-error and digit tests.", status: "built" },
        { action: "Hash-chained audit log", detail: "Saved datasets are sealed, and the log exposes any later edit to a saved record.", status: "built" },
        { action: "Importers for each major format", detail: "Make every company's workbook layout map to the schema without hand work, beginning with the formats in this corpus.", status: "next" },
      ],
    },
    {
      id: "2y",
      label: "+2 years",
      year: HORIZONS[1].year,
      expected:
        `Withdrawal index ${idx("2y")}, reuse ~${reuse("2y")}%. Disclosure rules tighten but diverge: ESRS E3 for EU-scoped companies (scope narrowed by the 2025 Omnibus package), ` +
        `ISSB/SASB water metrics where jurisdictions adopt them, battery-regulation due diligence for EU buyers. More numbers, still not comparable. AI-drafted ` +
        `sustainability reports multiply, and so does the risk of figures that were never measured.`,
      consequences: {
        market: "A price gap opens between metal with verifiable water data and metal without. Offtake contracts start to carry water clauses.",
        industry: "Mid-tier miners without data teams fall behind majors in financing and permitting. Consultants fill the gap with more manual reporting.",
        customers: "Battery makers and automakers need site-level water data for due diligence and later product passports. Company-level totals no longer pass.",
        businessModel: "Assurance of water data becomes a service in its own right. Whoever can supply checked, comparable data becomes the default source for buyers.",
      },
      desired:
        "Companies submit once, in a machine-readable form, and every framework's view is generated from it. Buyers and auditors query the same verified record instead of sending questionnaires.",
      interventions: [
        { action: "Submission API and framework mapping", detail: "Accept the schema directly (JSON/CSV/XBRL) and generate GRI 303, ICMM Table 4, SASB EM-MM-140a and ESRS E3 outputs from it.", status: "next" },
        { action: "Signed submissions", detail: "Companies and assurers sign each dataset with their own keys, so the log shows who vouched for which number, not only that it didn't change.", status: "next" },
        { action: "Basin stress attached automatically", detail: "Geolocate each site and attach WRI Aqueduct basin indicators, so 'water-stressed' no longer depends on each company's own definition.", status: "next" },
        { action: "Buyer and assurer workspaces", detail: "Role-based access: companies publish, buyers and auditors view and comment, and every question and answer is logged.", status: "partner" },
      ],
    },
    {
      id: "5y",
      label: "+5 years",
      year: HORIZONS[2].year,
      expected:
        `Withdrawal index ${idx("5y")}, reuse ~${reuse("5y")}%, if nothing changes. In stressed basins (Atacama, Andes, Western Australia, northern Mexico) ` +
        `governments limit or reprice water rights. Chile's 2022 water code reform already makes new rights temporary and puts human consumption first. ` +
        `Desalination becomes the marginal source, and its energy cost ties water risk to carbon cost.`,
      consequences: {
        market: "Supply of copper and battery metals from stressed basins becomes less reliable. Expansions are delayed by water permits, not ore grades, and price volatility rises.",
        industry: "Consolidation: operators who can cut water per tonne (thickened tailings, dry stacking, closed circuits) win the expansions, and others sell or close.",
        customers: "Buyers diversify away from sites with unverified or rising water intensity. Low-water metal is certified and sold at a premium.",
        businessModel: "Water turns from an operating cost into a capital constraint that shapes mine plans, valuations and closure liabilities. Metered data is now worth money.",
      },
      desired:
        "Water per tonne falls every year and reuse rises well above today's plateau, because a site's performance is visible to buyers, lenders and regulators. Permits reward verified improvement.",
      interventions: [
        { action: "Meter-to-ledger ingestion", detail: "Stream flow-meter data from sites and sign it at the device. Annual figures then come from measurements, not estimates, and gaps show up within days.", status: "next" },
        { action: "Basin ledgers across companies", detail: "Combine every operator in a catchment to show cumulative withdrawal against the basin's renewable supply, which is what a regulator permits against.", status: "partner" },
        { action: "Permit-aware scenarios", detail: "Link the cost and cap scenarios to actual permit terms and tariffs per site, and show output at risk under each rule change.", status: "next" },
        { action: "Anomaly models trained on the corpus", detail: "Move from fixed-threshold checks to learned expectations per process route, so a heap leach and a flotation mill are judged against their own peers.", status: "next" },
      ],
    },
    {
      id: "10y",
      label: "+10 years",
      year: HORIZONS[3].year,
      expected:
        `If nothing changes: withdrawal index ${idx("10y")}, reuse stuck near ${reuse("10y")}%. Legal caps bind in the driest basins, and output that depends on ` +
        `irreplaceable freshwater is curtailed. Community conflict over water becomes a main cause of lost licence to operate. Trust in company-reported ` +
        `water data erodes after high-profile discrepancies.`,
      consequences: {
        market: "Water-constrained supply becomes a structural factor in metal prices. Assets without credible water data are discounted or cannot be financed.",
        industry: "Water-positive or closed-loop operation becomes a precondition for new mines in stressed basins. Legacy sites face costly retrofits or early closure.",
        customers: "Product passports and procurement rules require water provenance for metals in batteries, cars and electronics, and self-declared figures stop being accepted.",
        businessModel: "Verified water data works as infrastructure: regulators, buyers and financiers read it directly. Reporting as a separate annual exercise disappears.",
      },
      desired:
        "Each basin has one shared, verifiable water account. Mines draw within what the basin can renew, prove it continuously and compete on water per tonne as openly as on grade and cost.",
      interventions: [
        { action: "Open standard, neutral governance", detail: "Hand the schema and check rules to a multi-stakeholder body (industry, regulators, communities), so no single vendor controls the evidence.", status: "partner" },
        { action: "Regulator and community access", detail: "Permit authorities read the ledger directly, and communities see their catchment's figures in their own language.", status: "partner" },
        { action: "Metal-level water provenance", detail: "Carry verified water per tonne from site to concentrate to product, for passports and procurement.", status: "next" },
        { action: "Predictive basin risk", detail: "Combine the ledger with climate projections to show which permits will bind, and when, years before they do.", status: "next" },
      ],
    },
  ];
}
