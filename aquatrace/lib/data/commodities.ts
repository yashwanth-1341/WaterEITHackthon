// Qualitative, indicative profiles to explain WHY some mined materials put more
// pressure on water than others. Not measured values: verify against literature
// and site data before quoting. "EU strategic" refers to the Critical Raw
// Materials Act (2024) strategic raw materials list (check the current list).

export type Pressure = "Very high" | "High" | "Medium" | "Low to medium";

export interface CommodityProfile {
  id: string;
  name: string;
  route: string;
  pressure: Pressure;
  drivers: string;
  mainLosses: string;
  euStrategic: boolean;
}

export const COMMODITIES: CommodityProfile[] = [
  {
    id: "gold",
    name: "Gold",
    route: "Milling + CIL/CIP, sometimes pressure oxidation",
    pressure: "Very high",
    drivers: "Grades of a few grams per tonne mean huge ore volumes per kilogram of metal.",
    mainLosses: "Tailings entrainment and evaporation; cooling where power is generated on site.",
    euStrategic: false,
  },
  {
    id: "copper-sulfide",
    name: "Copper (sulfide)",
    route: "Flotation to concentrate, then smelting and refining",
    pressure: "High",
    drivers: "Flotation needs large process-water volumes; low ore grades keep rising.",
    mainLosses: "Tailings dam evaporation and water locked in tailings pores.",
    euStrategic: true,
  },
  {
    id: "copper-oxide",
    name: "Copper (oxide)",
    route: "Heap leach + SX-EW",
    pressure: "Medium",
    drivers: "No flotation circuit, but leach solution is lost to evaporation from heaps and ponds.",
    mainLosses: "Evaporation from heaps and solution ponds.",
    euStrategic: true,
  },
  {
    id: "lithium-brine",
    name: "Lithium (brine)",
    route: "Evaporation ponds",
    pressure: "High",
    drivers: "Brine is pumped and evaporated; whether brine counts as 'water use' is debated, but it can draw down connected freshwater aquifers.",
    mainLosses: "Evaporation of pumped brine; freshwater for processing.",
    euStrategic: true,
  },
  {
    id: "lithium-rock",
    name: "Lithium (hard rock)",
    route: "Spodumene concentration, refining often elsewhere",
    pressure: "Medium",
    drivers: "Concentrator water similar to other flotation/dense-media plants; refining adds process water.",
    mainLosses: "Tailings and refinery effluent.",
    euStrategic: true,
  },
  {
    id: "nickel-laterite",
    name: "Nickel (laterite, HPAL)",
    route: "High-pressure acid leach",
    pressure: "High",
    drivers: "Leaching slurries and acid plants need large volumes; often coastal and seawater-cooled.",
    mainLosses: "Tailings, cooling, acid plant.",
    euStrategic: true,
  },
  {
    id: "nickel-sulfide",
    name: "Nickel (sulfide)",
    route: "Flotation + smelting",
    pressure: "Medium",
    drivers: "Similar pattern to copper sulfide flotation.",
    mainLosses: "Tailings dam.",
    euStrategic: true,
  },
  {
    id: "rare-earths",
    name: "Rare earths",
    route: "Concentration + chemical separation",
    pressure: "Medium",
    drivers: "Separation chemistry produces effluent that needs treatment; quality risk often matters more than volume.",
    mainLosses: "Process effluent, tailings.",
    euStrategic: true,
  },
  {
    id: "graphite",
    name: "Natural graphite",
    route: "Flotation + purification",
    pressure: "Low to medium",
    drivers: "Flotation water; chemical purification adds effluent.",
    mainLosses: "Tailings, purification effluent.",
    euStrategic: true,
  },
];

// Stages of sulfide copper processing, after COCHILCO (Figure 2.1:
// processing of sulfurated minerals by flotation and pyro-metallurgical processes).
export type StageRole = "input" | "recovery" | "loss" | "treatment";

export interface ProcessStage {
  id: string;
  name: string;
  group: "Concentrator" | "Smelter and refinery";
  role: StageRole;
  water: string;
  measure: string;
}

export const COPPER_STAGES: ProcessStage[] = [
  { id: "mine", name: "Mine", group: "Concentrator", role: "input", water: "Dust suppression, drilling; dewatering can create Other Managed Water.", measure: "Pumped dewatering volumes and where they go." },
  { id: "crushing", name: "Crushing and grinding", group: "Concentrator", role: "input", water: "Make-up water to form slurry.", measure: "Fresh make-up vs recovered water fed to the mills." },
  { id: "flotation", name: "Flotation", group: "Concentrator", role: "input", water: "Largest process-water demand on site.", measure: "Process water flow and its quality." },
  { id: "thickening", name: "Thickening", group: "Concentrator", role: "recovery", water: "Recovers water from tailings and concentrate for reuse.", measure: "Recovered water returned to the circuit (feeds reuse/recycle)." },
  { id: "tailings", name: "Tailings dam", group: "Concentrator", role: "loss", water: "Typically the largest loss: evaporation and water locked in tailings.", measure: "Evaporation, entrainment, seepage, pond volume changes (storage)." },
  { id: "filtering", name: "Filtering", group: "Concentrator", role: "recovery", water: "Removes water from concentrate; filtrate goes back to thickening.", measure: "Concentrate moisture leaving site." },
  { id: "drying", name: "Drying", group: "Smelter and refinery", role: "loss", water: "Remaining moisture leaves as vapour.", measure: "Moisture in dried concentrate." },
  { id: "smelting", name: "Fusion and conversion", group: "Smelter and refinery", role: "input", water: "Cooling water, mostly recirculated.", measure: "Cooling make-up and blowdown." },
  { id: "acid", name: "Sulfuric acid plant", group: "Smelter and refinery", role: "input", water: "Gas cleaning and process water.", measure: "Process water and effluent to treatment." },
  { id: "refinery", name: "Refinery", group: "Smelter and refinery", role: "input", water: "Electrolyte make-up and washing of cathodes.", measure: "Make-up water and bleed streams." },
  { id: "effluent", name: "Effluent treatment", group: "Smelter and refinery", role: "treatment", water: "Treats effluents; part returns to recirculation, solids to disposal.", measure: "Treated volume, quality, share recirculated." },
];
