import type { Dataset } from "@/lib/types";
import type { Balance } from "@/lib/metrics";
import { freshwaterPerKoz, highQualityWithdrawal, recycledShare, totalWithdrawal } from "@/lib/metrics";
import type { Flag } from "@/lib/validation";
import type { ScenarioParams, SiteScenario } from "@/lib/scenario";
import { readinessScore } from "@/lib/readiness";

const r = (n: number | null | undefined, d = 1) => (n === null || n === undefined ? null : Math.round(n * 10 ** d) / 10 ** d);

/** Compact, model-friendly summary of everything on screen. */
export function buildAiContext(args: {
  dataset: Dataset;
  balances: Map<string, Balance>;
  flags: Flag[];
  scenario: ScenarioParams;
  scenarioResults: SiteScenario[];
  tolerance: number;
}) {
  const { dataset: ds, balances, flags, scenario, scenarioResults, tolerance } = args;
  return {
    company: ds.company,
    period: ds.period,
    source: ds.sourceLabel,
    framework: ds.framework === "legacy-waf" ? "Legacy WAF Category 1/2/3, mapped to ICMM 2021 high/low quality" : "ICMM 2021 template",
    units: "ML (megalitres)",
    balanceTolerancePct: tolerance,
    sites: ds.sites.map((s) => {
      const b = balances.get(s.id);
      return {
        name: s.name,
        country: s.country,
        commodity: s.commodity,
        processRoute: s.processRoute,
        waterStress: `${s.waterStress} (${s.stressSource})`,
        coastal: s.coastal,
        measurementMethod: s.method,
        withdrawalTotal: totalWithdrawal(s),
        withdrawalHighQuality: highQualityWithdrawal(s),
        withdrawalBySourceAndQuality: s.withdrawal,
        dischargeBySourceAndQuality: s.discharge,
        consumption: s.consumption,
        reuseRecycle: s.reuse,
        changeInStorage: s.deltaStorage,
        unknownFields: s.unknownFields,
        oreMilledTonnes: s.oreMilledT,
        productionOzGoldEq: s.productionOzAuEq,
        freshwaterMLPer1000ozAuEq: r(freshwaterPerKoz(s)),
        shareOfDemandMetByRecycling: r(recycledShare(s), 3),
        balance: b ? { status: b.status, gapML: r(b.gap), gapPct: r(b.gapPct) } : null,
        readinessScorePct: readinessScore(s, tolerance).score,
        notes: s.notes,
      };
    }),
    companyHistory: ds.history,
    flags: flags.map((f) => ({ severity: f.severity, title: f.title, detail: f.detail })),
    scenario: {
      assumptions: { ...scenario, note: "Prices in USD per m3 are illustrative assumptions." },
      results: scenarioResults.map((x) => ({
        site: x.name,
        requiredCutML: r(x.requiredCut, 0),
        byRecyclingML: r(x.byRecycling, 0),
        byDesalML: r(x.byDesal, 0),
        shortfallML: r(x.shortfall, 0),
        baselineCostUSD: r(x.baselineCost, 0),
        scenarioCostUSD: r(x.scenarioCost, 0),
        productionAtRiskPct: r(x.productionAtRiskPct * 100),
      })),
    },
  };
}
