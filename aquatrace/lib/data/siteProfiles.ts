import type { Method, StressSource, WaterStress } from "@/lib/types";

// Context that legacy sustainability spreadsheets usually do NOT contain.
// Water-stress levels here are indicative assumptions for the demo and are
// flagged as such by the checks. Replace them with WRI Aqueduct values
// (baseline water stress at the site coordinates) before relying on them.
export interface SiteProfile {
  country: string;
  commodity: string[];
  processRoute: string;
  waterStress: WaterStress;
  stressSource: StressSource;
  coastal: boolean;
  method: Method;
  note?: string;
}

export const SITE_PROFILES: Record<string, SiteProfile> = {
  lihir: {
    country: "Papua New Guinea",
    commodity: ["Gold"],
    processRoute: "Pressure oxidation + CIL, geothermal power, seawater cooling",
    waterStress: "low",
    stressSource: "assumed",
    coastal: true,
    method: "not-disclosed",
    note: "Tropical island with high rainfall; most withdrawal is seawater for cooling.",
  },
  telfer: {
    country: "Australia (WA)",
    commodity: ["Gold", "Copper"],
    processRoute: "Flotation + CIL, dump leach",
    waterStress: "high",
    stressSource: "assumed",
    coastal: false,
    method: "not-disclosed",
    note: "Arid inland site; relies almost entirely on groundwater.",
  },
  cadia: {
    country: "Australia (NSW)",
    commodity: ["Gold", "Copper"],
    processRoute: "Block cave, flotation to concentrate",
    waterStress: "high",
    stressSource: "assumed",
    coastal: false,
    method: "not-disclosed",
    note: "Drought-exposed inland catchment; high internal recycling.",
  },
  gosowong: {
    country: "Indonesia",
    commodity: ["Gold"],
    processRoute: "Underground, CIL",
    waterStress: "low",
    stressSource: "assumed",
    coastal: false,
    method: "not-disclosed",
    note: "Divested 4 March 2020; FY20 data is partial.",
  },
};

export const DEFAULT_PROFILE: SiteProfile = {
  country: "Unknown",
  commodity: ["Unknown"],
  processRoute: "Not stated",
  waterStress: "unknown",
  stressSource: "unknown",
  coastal: false,
  method: "not-disclosed",
};

export function profileFor(siteId: string): SiteProfile {
  return SITE_PROFILES[siteId] ?? DEFAULT_PROFILE;
}
