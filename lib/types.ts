// Canonical data model, aligned to ICMM Water Reporting Good Practice Guide (2nd ed., 2021), Table 4.
// All water volumes are in megalitres (ML). 1 ML = 1,000 m³.
// `null` always means "not disclosed". Explicitly disclosed unknowns are listed in `unknownFields`.

export type Source = "surface" | "ground" | "sea" | "thirdParty";
export type Quality = "high" | "low";

export const SOURCES: Source[] = ["surface", "ground", "sea", "thirdParty"];
export const SOURCE_LABEL: Record<Source, string> = {
  surface: "Surface water",
  ground: "Groundwater",
  sea: "Seawater",
  thirdParty: "Third-party water",
};

export type QualityPair = { high: number | null; low: number | null };
export type QMatrix = Record<Source, QualityPair>;

export type WaterStress = "low" | "medium" | "high" | "extremely-high" | "unknown";
export type StressSource = "assumed" | "aqueduct" | "reported" | "unknown";
export type Method = "metered" | "estimated" | "modelled" | "not-disclosed";

export interface Site {
  id: string;
  name: string;
  country: string;
  commodity: string[];
  processRoute: string;
  waterStress: WaterStress;
  stressSource: StressSource;
  coastal: boolean;
  method: Method;
  oreMilledT: number | null;
  productionOzAuEq: number | null;
  withdrawal: QMatrix | null;
  omwWithdrawal: QualityPair | null;
  discharge: QMatrix | null;
  consumption: number | null;
  reuse: number | null;
  deltaStorage: number | null;
  unknownFields: string[];
  notes: string[];
}

export interface HistoryPoint {
  period: string;
  highQuality: number | null;
  lowQuality: number | null;
  total: number | null;
}

export interface MappingEntry {
  site: string;
  from: string;
  to: string;
  volume: number | null;
}

export type Framework = "legacy-waf" | "icmm-2021-template";

export interface Dataset {
  company: string;
  period: string;
  framework: Framework;
  sourceLabel: string;
  sites: Site[];
  history: HistoryPoint[];
  mappingLog: MappingEntry[];
}

export function emptyMatrix(): QMatrix {
  return {
    surface: { high: null, low: null },
    ground: { high: null, low: null },
    sea: { high: null, low: null },
    thirdParty: { high: null, low: null },
  };
}
