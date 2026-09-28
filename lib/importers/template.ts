import {
  SOURCES,
  emptyMatrix,
  type Dataset,
  type Method,
  type Quality,
  type Site,
  type Source,
  type StressSource,
  type WaterStress,
} from "@/lib/types";
import { siteIdFrom } from "./legacyGri";

// AquaTrace template: one row per site x metric x source x quality.
// Mirrors ICMM 2021 Table 4 so any site can fill it in, from a spreadsheet
// by hand to an automated export from a meter historian.

export const TEMPLATE_SHEET = "water_data";
export const TEMPLATE_COLUMNS = [
  "site_id",
  "site_name",
  "country",
  "commodity",
  "process_route",
  "water_stress",
  "water_stress_source",
  "coastal",
  "measurement_method",
  "period",
  "metric",
  "source",
  "quality",
  "value",
  "note",
] as const;

export type TemplateRow = Partial<Record<(typeof TEMPLATE_COLUMNS)[number], string | number | boolean | null>>;

export const TEMPLATE_METRICS = [
  "withdrawal",
  "omw_withdrawal",
  "discharge",
  "consumption",
  "reuse",
  "delta_storage",
  "ore_milled_t",
  "production_oz_aueq",
] as const;

export const TEMPLATE_INSTRUCTIONS: string[][] = [
  ["AquaTrace water template (ICMM 2021, Table 4)"],
  [""],
  ["Units", "All water volumes in megalitres (ML). 1 ML = 1,000 m³. Ore in tonnes, production in troy oz gold-equivalent."],
  ["metric", TEMPLATE_METRICS.join(", ")],
  ["source", "surface, ground, sea, third_party (required for withdrawal and discharge; leave empty otherwise)"],
  ["quality", "high or low (required for withdrawal, omw_withdrawal and discharge)"],
  ["value", "A number, 'unknown' if the site knows the flow exists but cannot quantify it, or empty if not reported"],
  ["water_stress", "low, medium, high, extremely-high or unknown"],
  ["water_stress_source", "aqueduct, reported, assumed or unknown"],
  ["measurement_method", "metered, estimated, modelled or not-disclosed"],
  ["coastal", "true or false (used for seawater substitution scenarios)"],
];

const SRC_IN: Record<string, Source> = {
  surface: "surface",
  ground: "ground",
  groundwater: "ground",
  sea: "sea",
  seawater: "sea",
  third_party: "thirdParty",
  "third-party": "thirdParty",
  thirdparty: "thirdParty",
};
const SRC_OUT: Record<Source, string> = { surface: "surface", ground: "ground", sea: "sea", thirdParty: "third_party" };

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

export function isTemplate(rows: TemplateRow[]) {
  return rows.length > 0 && "metric" in rows[0] && "site_id" in rows[0];
}

export function parseTemplate(rows: TemplateRow[], sourceLabel: string): Dataset {
  const sites = new Map<string, Site>();
  let period = "";

  for (const r of rows) {
    const name = str(r.site_name) || str(r.site_id);
    if (!name) continue;
    const id = str(r.site_id) || siteIdFrom(name);
    if (!period && str(r.period)) period = str(r.period);

    if (!sites.has(id)) {
      sites.set(id, {
        id,
        name,
        country: str(r.country) || "Unknown",
        commodity: str(r.commodity) ? str(r.commodity).split(/[;,]/).map((s) => s.trim()) : ["Unknown"],
        processRoute: str(r.process_route) || "Not stated",
        waterStress: (str(r.water_stress) as WaterStress) || "unknown",
        stressSource: (str(r.water_stress_source) as StressSource) || "unknown",
        coastal: str(r.coastal).toLowerCase() === "true",
        method: (str(r.measurement_method) as Method) || "not-disclosed",
        oreMilledT: null,
        productionOzAuEq: null,
        withdrawal: null,
        omwWithdrawal: null,
        discharge: null,
        consumption: null,
        reuse: null,
        deltaStorage: null,
        unknownFields: [],
        notes: [],
      });
    }
    const s = sites.get(id)!;
    const metric = str(r.metric).toLowerCase();
    const raw = str(r.value).toLowerCase();
    const isUnknown = raw === "unknown";
    const value = raw === "" || isUnknown ? null : Number(raw.replace(/,/g, ""));
    if (value !== null && !Number.isFinite(value)) continue;
    const quality = str(r.quality).toLowerCase() as Quality;
    const src = SRC_IN[str(r.source).toLowerCase()];
    if (str(r.note)) s.notes.push(str(r.note));

    if (metric === "withdrawal" || metric === "discharge") {
      if (!src || (quality !== "high" && quality !== "low")) continue;
      // A blank cell means "not reported": it must never create a block of zeros.
      if (value === null && !isUnknown) continue;
      const key = metric === "withdrawal" ? "withdrawal" : "discharge";
      if (!s[key]) {
        s[key] = emptyMatrix();
        SOURCES.forEach((x) => (s[key]![x] = { high: 0, low: 0 }));
      }
      if (isUnknown) {
        s[key]![src][quality] = null;
        s.unknownFields.push(`${key}.${src}.${quality}`);
      } else if (value !== null) s[key]![src][quality] = value;
    } else if (metric === "omw_withdrawal") {
      if (quality !== "high" && quality !== "low") continue;
      if (value === null && !isUnknown) continue;
      s.omwWithdrawal ??= { high: 0, low: 0 };
      if (isUnknown) s.unknownFields.push(`omw.${quality}`);
      s.omwWithdrawal[quality] = value;
    } else {
      const field = (
        {
          consumption: "consumption",
          reuse: "reuse",
          delta_storage: "deltaStorage",
          ore_milled_t: "oreMilledT",
          production_oz_aueq: "productionOzAuEq",
        } as const
      )[metric as "consumption"];
      if (!field) continue;
      if (isUnknown) s.unknownFields.push(field);
      (s as unknown as Record<string, number | null>)[field] = value;
    }
  }

  if (sites.size === 0) throw new Error("The template has no rows with a site_id or site_name.");

  return {
    company: sourceLabel.replace(/\.[a-z]+$/i, "") || "Imported",
    period: period || "Unknown period",
    framework: "icmm-2021-template",
    sourceLabel,
    sites: [...sites.values()],
    history: [],
    mappingLog: [],
  };
}

/** Turn a dataset back into template rows, so a company can download it pre-filled. */
export function toTemplateRows(ds: Dataset): TemplateRow[] {
  const rows: TemplateRow[] = [];
  for (const s of ds.sites) {
    const base = {
      site_id: s.id,
      site_name: s.name,
      country: s.country,
      commodity: s.commodity.join("; "),
      process_route: s.processRoute,
      water_stress: s.waterStress,
      water_stress_source: s.stressSource,
      coastal: s.coastal ? "true" : "false",
      measurement_method: s.method,
      period: ds.period,
    };
    const unk = new Set(s.unknownFields);
    for (const key of ["withdrawal", "discharge"] as const) {
      for (const src of SOURCES) {
        for (const q of ["high", "low"] as Quality[]) {
          const f = `${key}.${src}.${q}`;
          const v = s[key]?.[src][q];
          rows.push({ ...base, metric: key, source: SRC_OUT[src], quality: q, value: unk.has(f) ? "unknown" : (v ?? "") });
        }
      }
    }
    for (const q of ["high", "low"] as Quality[]) {
      rows.push({ ...base, metric: "omw_withdrawal", source: "", quality: q, value: s.omwWithdrawal?.[q] ?? "" });
    }
    const singles: [string, number | null, string][] = [
      ["consumption", s.consumption, "consumption"],
      ["reuse", s.reuse, "reuse"],
      ["delta_storage", s.deltaStorage, "deltaStorage"],
      ["ore_milled_t", s.oreMilledT, "oreMilledT"],
      ["production_oz_aueq", s.productionOzAuEq, "productionOzAuEq"],
    ];
    for (const [metric, v, field] of singles) {
      rows.push({ ...base, metric, source: "", quality: "", value: unk.has(field) ? "unknown" : (v ?? "") });
    }
  }
  return rows;
}
