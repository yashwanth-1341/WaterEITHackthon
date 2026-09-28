import { highQualityWithdrawal, isStressed, sumKnown } from "@/lib/metrics";
import type { Dataset, Site, Source } from "@/lib/types";

// All prices are illustrative assumptions in USD per m³. Replace with site data.
export interface ScenarioParams {
  price: Record<Source, number>;
  dischargeTreatment: number;
  recyclingCost: number;
  desalCost: number;
  /** % increase on freshwater tariffs (surface, ground, third-party). */
  tariffIncreasePct: number;
  tariffScope: "all" | "stressed";
  /** Mandated % cut in high-quality (freshwater) withdrawal. */
  reductionPct: number;
  reductionScope: "all" | "stressed";
  /** Share of currently consumed water (evaporation, entrainment) that extra recycling could recover. */
  recoverablePct: number;
  allowDesal: boolean;
}

export const DEFAULT_SCENARIO: ScenarioParams = {
  price: { surface: 0.4, ground: 0.6, sea: 0.05, thirdParty: 1.2 },
  dischargeTreatment: 0.3,
  recyclingCost: 0.5,
  desalCost: 1.5,
  tariffIncreasePct: 0,
  tariffScope: "stressed",
  reductionPct: 0,
  reductionScope: "stressed",
  recoverablePct: 30,
  allowDesal: true,
};

export interface SiteScenario {
  siteId: string;
  name: string;
  inScopeTariff: boolean;
  inScopeRegulation: boolean;
  baselineCost: number;
  scenarioCost: number;
  freshwater: number;
  requiredCut: number;
  byRecycling: number;
  byDesal: number;
  shortfall: number;
  complianceCost: number;
  productionAtRiskOz: number | null;
  productionAtRiskPct: number;
}

const ML = 1000; // m³ per ML

function waterCost(s: Site, p: ScenarioParams, multiplier: number, freshScale = 1) {
  if (!s.withdrawal) return 0;
  let cost = 0;
  (Object.keys(s.withdrawal) as Source[]).forEach((src) => {
    const vol = (s.withdrawal![src].high ?? 0) + (s.withdrawal![src].low ?? 0);
    const isFresh = src !== "sea";
    cost += vol * (isFresh ? freshScale : 1) * ML * p.price[src] * (isFresh ? multiplier : 1);
  });
  cost += sumKnown(s.discharge) * ML * p.dischargeTreatment;
  return cost;
}

export function runScenario(ds: Dataset, p: ScenarioParams): SiteScenario[] {
  return ds.sites.map((s) => {
    const stressed = isStressed(s);
    const inScopeTariff = p.tariffScope === "all" || stressed;
    const inScopeRegulation = p.reductionScope === "all" || stressed;
    const mult = inScopeTariff ? 1 + p.tariffIncreasePct / 100 : 1;

    const baselineCost = waterCost(s, p, 1);
    const freshwater = highQualityWithdrawal(s) ?? sumKnown(s.withdrawal, "high");
    const requiredCut = inScopeRegulation ? freshwater * (p.reductionPct / 100) : 0;

    const recoverable = (s.consumption ?? 0) * (p.recoverablePct / 100);
    const byRecycling = Math.min(requiredCut, recoverable);
    const remaining = requiredCut - byRecycling;
    const byDesal = p.allowDesal && s.coastal ? remaining : 0;
    const shortfall = remaining - byDesal;

    // Freshwater bill after the cut, at scenario tariffs, plus the cost of replacement water.
    const freshScale = freshwater > 0 ? (freshwater - requiredCut) / freshwater : 1;
    const scenarioWater = waterCost(s, p, mult, freshScale);
    const complianceCost = byRecycling * ML * p.recyclingCost + byDesal * ML * p.desalCost;
    const scenarioCost = scenarioWater + complianceCost;

    const productionAtRiskPct = freshwater > 0 ? shortfall / freshwater : 0;
    const productionAtRiskOz = s.productionOzAuEq !== null ? s.productionOzAuEq * productionAtRiskPct : null;

    return {
      siteId: s.id,
      name: s.name,
      inScopeTariff,
      inScopeRegulation,
      baselineCost,
      scenarioCost,
      freshwater,
      requiredCut,
      byRecycling,
      byDesal,
      shortfall,
      complianceCost,
      productionAtRiskOz,
      productionAtRiskPct,
    };
  });
}
