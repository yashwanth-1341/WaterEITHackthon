import { profileFor } from "@/lib/data/siteProfiles";
import {
  emptyMatrix,
  type Dataset,
  type HistoryPoint,
  type MappingEntry,
  type QMatrix,
  type Quality,
  type Site,
  type Source,
} from "@/lib/types";

// Reads sustainability spreadsheets that follow GRI 303 with the older
// Minerals Council of Australia Water Accounting Framework (WAF)
// Category 1 / 2 / 3 quality scheme, and maps them to ICMM 2021 high/low quality.

export type Cell = string | number | boolean | null | undefined;
export type Rows = Cell[][];

export interface LegacyMapping {
  cat1: Quality;
  cat2: Quality;
  cat3: Quality;
  producedWater: Source;
}

// ICMM 2021 treats WAF Category 1 and 2 as high quality and Category 3 as low quality.
export const DEFAULT_LEGACY_MAPPING: LegacyMapping = {
  cat1: "high",
  cat2: "high",
  cat3: "low",
  producedWater: "ground",
};

type Parsed = number | "unknown" | "na" | null;

const text = (c: Cell) => (c === null || c === undefined ? "" : String(c).trim());
const rowText = (r: Cell[] | undefined) => (r ?? []).map(text).join(" | ");

function parseValue(c: Cell): Parsed {
  if (c === null || c === undefined || c === "") return null;
  if (typeof c === "number") return c;
  const s = String(c).trim().toLowerCase();
  if (s === "-" || s === "–" || s === "unknown") return "unknown";
  if (s === "n/a" || s === "na") return "na";
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function siteIdFrom(name: string) {
  return name
    .replace(/\(.*?\)/g, "")
    .replace(/[§*^]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function cleanName(name: string) {
  return name.replace(/\(.*?\)/g, "").replace(/[§*^]/g, "").trim();
}

/** The descriptive label of a row: first cell that is not a GRI code or framework tag. */
function labelOf(r: Cell[] | undefined): string {
  for (const c of r ?? []) {
    const t = text(c);
    if (!t) continue;
    if (/^\d{3}-\d{1,2}$/.test(t) || /^ICMM/i.test(t) || /^MM\d/.test(t)) continue;
    return t;
  }
  return "";
}

function findRow(rows: Rows, pred: (r: Cell[], label: string) => boolean, start = 0) {
  for (let i = start; i < rows.length; i++) if (pred(rows[i] ?? [], labelOf(rows[i]))) return i;
  return -1;
}

/** Map column index -> site id for a header row like "Company | Lihir | Telfer | Cadia". */
function headerSites(r: Cell[]): Map<number, { id: string; name: string }> {
  const out = new Map<number, { id: string; name: string }>();
  let seenCompany = false;
  r.forEach((c, i) => {
    const t = text(c);
    if (!t) return;
    if (/^company/i.test(t)) {
      seenCompany = true;
      return;
    }
    if (seenCompany) out.set(i, { id: siteIdFrom(t), name: cleanName(t) });
  });
  return out;
}

function nextHeader(rows: Rows, from: number) {
  const i = findRow(rows, (r) => r.some((c) => /^company/i.test(text(c))), from);
  return i;
}

function prevHeader(rows: Rows, from: number) {
  for (let i = from; i >= 0; i--) if ((rows[i] ?? []).some((c) => /^company/i.test(text(c)))) return i;
  return -1;
}

function sourceFromLabel(label: string, mapping: LegacyMapping): Source | "skip" | null {
  const l = label.toLowerCase();
  if (l.includes("for organisational") || l.includes("for organizational")) return "skip";
  if (l.startsWith("surface")) return "surface";
  if (l.startsWith("ground")) return "ground";
  if (l.startsWith("sea")) return "sea";
  if (l.startsWith("third")) return "thirdParty";
  if (l.startsWith("produced")) return mapping.producedWater;
  return null;
}

const CAT_LABEL: Record<string, string> = {
  "1": "WAF Category 1",
  "2": "WAF Category 2",
  "3": "WAF Category 3",
};

interface BlockResult {
  bySite: Map<string, QMatrix>;
  sites: Map<string, string>;
  unknowns: Map<string, string[]>;
  log: MappingEntry[];
}

function readQualityBlock(
  rows: Rows,
  titlePred: (label: string, r: Cell[]) => boolean,
  endPred: (label: string) => boolean,
  metric: "withdrawal" | "discharge",
  mapping: LegacyMapping,
): BlockResult | null {
  const title = findRow(rows, (r, l) => titlePred(l, r));
  if (title < 0) return null;
  const h = nextHeader(rows, title + 1);
  if (h < 0) return null;
  const cols = headerSites(rows[h]);
  const bySite = new Map<string, QMatrix>();
  const unknowns = new Map<string, string[]>();
  const sites = new Map<string, string>();
  const log: MappingEntry[] = [];
  cols.forEach((s) => {
    bySite.set(s.id, emptyMatrix());
    unknowns.set(s.id, []);
    sites.set(s.id, s.name);
  });

  let cat: "1" | "2" | "3" | null = null;
  for (let i = h + 1; i < rows.length; i++) {
    const label = labelOf(rows[i]);
    if (!label) continue;
    if (endPred(label)) break;
    const m = label.match(/^category\s*([123])/i);
    if (m) {
      cat = m[1] as "1" | "2" | "3";
      continue;
    }
    if (!cat || /^total/i.test(label)) continue;
    const src = sourceFromLabel(label, mapping);
    if (!src || src === "skip") continue;
    const quality = mapping[`cat${cat}` as const];
    cols.forEach((s, col) => {
      const v = parseValue(rows[i][col]);
      const matrix = bySite.get(s.id)!;
      const cell = matrix[src];
      if (v === "unknown") {
        unknowns.get(s.id)!.push(`${metric}.${src}.${quality}`);
        return;
      }
      if (v === null || v === "na") return;
      cell[quality] = (cell[quality] ?? 0) + v;
      if (v > 0) {
        log.push({
          site: s.name,
          from: `${CAT_LABEL[cat!]} ${label.toLowerCase().replace(/\s*\(.*?\)/g, "")}`,
          to: `${quality === "high" ? "High" : "Low"}-quality ${src === "thirdParty" ? "third-party water" : src === "sea" ? "seawater" : `${src === "ground" ? "groundwater" : "surface water"}`} (${metric})`,
          volume: v,
        });
      }
    });
  }
  // Sources that were never populated become explicit zeros for both qualities
  // only if the site appears in the block (it was reported, just empty).
  // Disclosed unknowns stay null so they remain visible to the checks.
  bySite.forEach((m, siteId) => {
    const unk = new Set(unknowns.get(siteId) ?? []);
    (Object.keys(m) as Source[]).forEach((src) => {
      (["high", "low"] as Quality[]).forEach((q) => {
        if (m[src][q] === null && !unk.has(`${metric}.${src}.${q}`)) m[src][q] = 0;
      });
    });
  });
  return { bySite, sites, unknowns, log };
}

function readSingleRow(rows: Rows, titlePred: (label: string, r: Cell[]) => boolean) {
  const title = findRow(rows, (r, l) => titlePred(l, r));
  if (title < 0) return null;
  const h = nextHeader(rows, title + 1);
  if (h < 0) return null;
  const cols = headerSites(rows[h]);
  const valueRow = findRow(rows, (_r, l) => l.length > 0, h + 1);
  if (valueRow < 0) return null;
  const out = new Map<string, Parsed>();
  cols.forEach((s, col) => out.set(s.id, parseValue(rows[valueRow][col])));
  return out;
}

function readLabelledRow(rows: Rows, labelStarts: string) {
  const i = findRow(rows, (_r, l) => l.toLowerCase().startsWith(labelStarts.toLowerCase()));
  if (i < 0) return null;
  const h = prevHeader(rows, i - 1);
  if (h < 0) return null;
  const cols = headerSites(rows[h]);
  const out = new Map<string, Parsed>();
  cols.forEach((s, col) => out.set(s.id, parseValue(rows[i][col])));
  return out;
}

function readHistory(rows: Rows): HistoryPoint[] {
  const title = findRow(rows, (_r, l) => /withdrawal by source.*FY\d{2}\s*-\s*\d{2}/i.test(l));
  if (title < 0) return [];
  const header = rows[title + 1] ?? [];
  const periods = new Map<number, string>();
  header.forEach((c, i) => {
    const t = text(c);
    if (/^FY\d{2}/i.test(t)) periods.set(i, t.replace(/\s*\(.*?\)/g, ""));
  });
  const pts = new Map<string, HistoryPoint>();
  periods.forEach((p) => pts.set(p, { period: p, highQuality: null, lowQuality: null, total: null }));
  for (let i = title + 2; i < Math.min(rows.length, title + 8); i++) {
    const label = labelOf(rows[i]).toLowerCase();
    const key = label.includes("cat 1+2") || label.includes("high")
      ? "highQuality"
      : label.includes("cat 3") || label.includes("low")
        ? "lowQuality"
        : label.includes("total water withdrawn")
          ? "total"
          : null;
    if (!key) continue;
    periods.forEach((p, col) => {
      const v = parseValue(rows[i][col]);
      pts.get(p)![key] = typeof v === "number" ? v : null;
    });
    if (key === "total") break;
  }
  return [...pts.values()].reverse();
}

const num = (v: Parsed | undefined) => (typeof v === "number" ? v : null);

export function isLegacyGriSheet(rows: Rows) {
  return findRow(rows, (r, l) => /303-3/.test(rowText(r)) && /withdrawal/i.test(l)) >= 0;
}

export function parseLegacyGri(
  rows: Rows,
  opts: { company: string; sourceLabel: string; mapping?: LegacyMapping },
): Dataset {
  const mapping = opts.mapping ?? DEFAULT_LEGACY_MAPPING;

  const withdrawal = readQualityBlock(
    rows,
    (l, r) => /303-3/.test(rowText(r)) && /withdrawal by source/i.test(l) && !/FY\d{2}\s*-\s*\d{2}/.test(l),
    (l) => /^total water withdrawn/i.test(l),
    "withdrawal",
    mapping,
  );
  if (!withdrawal) throw new Error("No GRI 303-3 water withdrawal table was found in this sheet.");

  const discharge = readQualityBlock(
    rows,
    (l, r) => /303-4/.test(rowText(r)) && /discharge/i.test(l),
    (l) => /^total water discharge/i.test(l),
    "discharge",
    mapping,
  );
  const reuse = readSingleRow(rows, (l) => /recycled and reused/i.test(l));
  const storage = readSingleRow(rows, (l) => /change in total on-site water storage/i.test(l));
  const consumption = readSingleRow(rows, (l) => /total water consumption/i.test(l));
  const ore = readLabelledRow(rows, "Ore milled");
  const gold = readLabelledRow(rows, "Gold produced equivalent");

  const periodMatch = rows
    .map((r) => labelOf(r))
    .find((l) => /withdrawal by source/i.test(l))
    ?.match(/FY\d{2}/);
  const period = periodMatch ? periodMatch[0] : "Unknown period";

  const sites: Site[] = [];
  withdrawal.sites.forEach((name, id) => {
    const p = profileFor(id);
    const unknownFields = [...(withdrawal.unknowns.get(id) ?? [])];
    if (discharge?.unknowns.get(id)) unknownFields.push(...discharge.unknowns.get(id)!);
    const notes: string[] = [];
    if (p.note) notes.push(p.note);

    const inDischarge = discharge?.bySite.has(id) ?? false;
    if (!inDischarge) notes.push("Not included in the discharge table.");

    const pick = (m: Map<string, Parsed> | null, field: string, label: string) => {
      if (!m || !m.has(id)) {
        notes.push(`Not included in the ${label} table.`);
        return null;
      }
      const v = m.get(id);
      if (v === "unknown") {
        unknownFields.push(field);
        return null;
      }
      return num(v);
    };

    sites.push({
      id,
      name,
      country: p.country,
      commodity: p.commodity,
      processRoute: p.processRoute,
      waterStress: p.waterStress,
      stressSource: p.stressSource,
      coastal: p.coastal,
      method: p.method,
      oreMilledT: num(ore?.get(id)),
      productionOzAuEq: num(gold?.get(id)),
      withdrawal: withdrawal.bySite.get(id)!,
      omwWithdrawal: null,
      discharge: inDischarge ? discharge!.bySite.get(id)! : null,
      consumption: pick(consumption, "consumption", "consumption"),
      reuse: pick(reuse, "reuse", "recycled and reused"),
      deltaStorage: pick(storage, "deltaStorage", "change in storage"),
      unknownFields,
      notes,
    });
  });

  return {
    company: opts.company,
    period,
    framework: "legacy-waf",
    sourceLabel: opts.sourceLabel,
    sites,
    history: readHistory(rows),
    mappingLog: [...withdrawal.log, ...(discharge?.log ?? [])],
  };
}
