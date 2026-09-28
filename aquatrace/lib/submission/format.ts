// AquaTrace submission template: how a mining company reports its water data to AquaTrace.
// One workbook, four sheets. The same parser runs in the browser (Analyse a submission view)
// and in scripts/analyse-submission.ts, and turns the workbook into the corpus record format.
import * as XLSX from "xlsx";
import type { CorpusFile, CorpusRecord, CorpusSite } from "@/lib/corpus/types";

export const SHEETS = { instructions: "Instructions", company: "Company", sites: "Sites", data: "Data", metrics: "Metric list" } as const;

export const DATA_COLUMNS = ["site", "year", "metric", "value", "unit", "note"] as const;
export const SITE_COLUMNS = ["site", "country", "commodity", "water_stress", "status"] as const;
export const COMPANY_FIELDS = ["Company name", "Reporting year ends (month)", "Contact email", "Prepared by", "Assured by (if any)"] as const;

/** What a company can report. `unit` is the canonical unit; volumes may be given in any unit in VOLUME_UNITS. */
export const METRICS: { key: string; label: string; unit: "ML" | "%" | "t" | "oz" | "USD" | "count"; required?: boolean }[] = [
  { key: "withdrawal_total", label: "Total water withdrawal", unit: "ML", required: true },
  { key: "withdrawal_surface", label: "Withdrawal: surface water", unit: "ML" },
  { key: "withdrawal_ground", label: "Withdrawal: groundwater", unit: "ML" },
  { key: "withdrawal_sea", label: "Withdrawal: seawater", unit: "ML" },
  { key: "withdrawal_third_party", label: "Withdrawal: third-party water", unit: "ML" },
  { key: "withdrawal_rain_runoff", label: "Withdrawal: rainfall and runoff", unit: "ML" },
  { key: "withdrawal_fresh", label: "Freshwater (high-quality) withdrawal", unit: "ML", required: true },
  { key: "withdrawal_water_stressed", label: "Withdrawal in water-stressed areas", unit: "ML", required: true },
  { key: "discharge_total", label: "Total discharge", unit: "ML", required: true },
  { key: "consumption_total", label: "Total consumption", unit: "ML", required: true },
  { key: "reused_recycled", label: "Water reused or recycled", unit: "ML", required: true },
  { key: "water_stored_change", label: "Change in water storage", unit: "ML" },
  { key: "ore_processed_t", label: "Ore processed", unit: "t", required: true },
  { key: "copper_production_t", label: "Copper produced", unit: "t" },
  { key: "gold_production_oz", label: "Gold produced", unit: "oz" },
  { key: "zinc_production_t", label: "Zinc produced", unit: "t" },
  { key: "water_incidents_count", label: "Significant water incidents", unit: "count" },
  { key: "water_fines_usd", label: "Water-related fines", unit: "USD" },
];
const METRIC_KEYS = new Set(METRICS.map((m) => m.key));

/** Volume units accepted, as a factor to megalitres. */
export const VOLUME_UNITS: Record<string, number> = {
  ml: 1,
  megalitres: 1,
  megaliters: 1,
  m3: 0.001,
  "m³": 0.001,
  kl: 0.001,
  "thousand m3": 1,
  "000 m3": 1,
  mm3: 1000,
  "million m3": 1000,
  gl: 1000,
};

export const INSTRUCTIONS: string[][] = [
  ["AquaTrace water data submission"],
  [""],
  ["1. Company sheet: fill in the company name and the month your reporting year ends."],
  ["2. Sites sheet: one row per operation. water_stress = low / medium / high / extremely-high (WRI Aqueduct if you have it)."],
  ["3. Data sheet: one row per number: site, year, metric, value, unit. Use the site name exactly as in the Sites sheet."],
  ["   Use site = _corporate for company-wide totals. Give both site figures and totals where you have them: AquaTrace checks that they add up."],
  ["   Metric keys are listed in the 'Metric list' sheet. Volumes may be in ML, m3, kL, thousand m3, Mm3 or GL; AquaTrace converts to megalitres."],
  ["   Leave a figure out if you don't have it. Don't enter 0 for 'not measured'."],
  ["   If a figure changes from a previous submission, say why in the note column (e.g. 'restated: meter recalibration')."],
  ["4. Upload the file in AquaTrace (Explore > Analyse a submission), or run: npm run analyse-submission -- <file>"],
  [""],
  ["The file is fingerprinted (SHA-256) when it is analysed, so any later change to it can be detected."],
];

export interface Submission {
  company: string;
  fileName: string;
  sha256: string;
  yearEndMonth: string | null;
  files: CorpusFile[];
  sites: CorpusSite[];
  records: CorpusRecord[];
  /** Problems with the file itself (unknown metric, bad unit, unknown site...). */
  issues: { row: number; message: string }[];
}

/** A blank template workbook. */
export function blankTemplate(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(INSTRUCTIONS), SHEETS.instructions);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Field", "Value"], ...COMPANY_FIELDS.map((f) => [f, ""])]), SHEETS.company);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[...SITE_COLUMNS]]), SHEETS.sites);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[...DATA_COLUMNS]]), SHEETS.data);
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([["metric", "what it is", "unit", "required"], ...METRICS.map((m) => [m.key, m.label, m.unit === "ML" ? "ML (or m3, kL, thousand m3, Mm3, GL)" : m.unit, m.required ? "yes" : ""])]),
    SHEETS.metrics,
  );
  wb.Sheets[SHEETS.instructions]["!cols"] = [{ wch: 130 }];
  wb.Sheets[SHEETS.company]["!cols"] = [{ wch: 30 }, { wch: 40 }];
  wb.Sheets[SHEETS.sites]["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 24 }, { wch: 16 }, { wch: 12 }];
  wb.Sheets[SHEETS.data]["!cols"] = [{ wch: 28 }, { wch: 8 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 50 }];
  wb.Sheets[SHEETS.metrics]["!cols"] = [{ wch: 28 }, { wch: 40 }, { wch: 36 }, { wch: 10 }];
  return wb;
}

/** Fill a template from rows (used to build the sample and the "existing company" example). */
export function filledTemplate(company: Record<string, string>, sites: string[][], data: (string | number)[][]): XLSX.WorkBook {
  const wb = blankTemplate();
  wb.Sheets[SHEETS.company] = XLSX.utils.aoa_to_sheet([["Field", "Value"], ...COMPANY_FIELDS.map((f) => [f, company[f] ?? ""])]);
  wb.Sheets[SHEETS.sites] = XLSX.utils.aoa_to_sheet([[...SITE_COLUMNS], ...sites]);
  wb.Sheets[SHEETS.data] = XLSX.utils.aoa_to_sheet([[...DATA_COLUMNS], ...data]);
  wb.Sheets[SHEETS.company]["!cols"] = [{ wch: 30 }, { wch: 40 }];
  wb.Sheets[SHEETS.sites]["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 24 }, { wch: 16 }, { wch: 12 }];
  wb.Sheets[SHEETS.data]["!cols"] = [{ wch: 28 }, { wch: 8 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 50 }];
  return wb;
}

export const isSubmissionWorkbook = (wb: XLSX.WorkBook) => wb.SheetNames.includes(SHEETS.data) && wb.SheetNames.includes(SHEETS.sites);

/** Parse a filled template into corpus records. `sha256` is the file's fingerprint. */
export function parseSubmission(wb: XLSX.WorkBook, fileName: string, sha256: string): Submission {
  const issues: Submission["issues"] = [];
  const kv = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[SHEETS.company] ?? {}, { header: 1, defval: "" });
  const field = (name: string) => String(kv.find((r) => String(r[0]).trim() === name)?.[1] ?? "").trim();
  const company = field("Company name") || fileName.replace(/\.[^.]+$/, "");

  const siteRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[SHEETS.sites], { defval: "" });
  const sites: CorpusSite[] = siteRows
    .filter((r) => String(r.site ?? "").trim())
    .map((r) => ({
      company,
      site: String(r.site).trim(),
      country: String(r.country ?? "").trim() || null,
      commodity: String(r.commodity ?? "")
        .split(/[,;/]/)
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean),
      waterStressReported: String(r.water_stress ?? "").trim().toLowerCase() || null,
      status: String(r.status ?? "").trim() || null,
    }));
  const siteNames = new Set(sites.map((s) => s.site));

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[SHEETS.data], { defval: "" });
  const records: CorpusRecord[] = [];
  rows.forEach((r, i) => {
    const rowNo = i + 2; // header is row 1
    const site = String(r.site ?? "").trim();
    const metric = String(r.metric ?? "").trim();
    const year = Number(r.year);
    const raw = r.value;
    if (!site && !metric && raw === "") return;
    if (!site) return issues.push({ row: rowNo, message: "site is empty" });
    if (site !== "_corporate" && !siteNames.has(site)) issues.push({ row: rowNo, message: `site "${site}" is not in the Sites sheet` });
    if (!METRIC_KEYS.has(metric)) return issues.push({ row: rowNo, message: `unknown metric "${metric}" (see the Metric list sheet)` });
    if (!Number.isInteger(year) || year < 1990 || year > 2100) return issues.push({ row: rowNo, message: `year "${r.year}" is not a year` });
    const num = typeof raw === "number" ? raw : Number(String(raw).replace(/[,\s]/g, ""));
    if (raw === "" || !Number.isFinite(num)) return issues.push({ row: rowNo, message: `value "${raw}" is not a number` });

    const def = METRICS.find((m) => m.key === metric)!;
    const unitRaw = String(r.unit ?? "").trim();
    let value = num;
    if (def.unit === "ML") {
      const f = VOLUME_UNITS[unitRaw.toLowerCase()];
      if (f === undefined) return issues.push({ row: rowNo, message: `unit "${unitRaw}" is not a volume unit (use ML, m3, kL, thousand m3, Mm3 or GL)` });
      value = num * f;
    }
    records.push({
      company,
      site,
      year,
      metric: metric as CorpusRecord["metric"],
      value,
      rawValue: String(raw),
      rawUnit: unitRaw || def.unit,
      sourceFile: fileName,
      location: `sheet '${SHEETS.data}' row ${rowNo}`,
      note: String(r.note ?? "").trim() || undefined,
    });
  });

  const years = [...new Set(records.map((r) => r.year))].sort();
  return {
    company,
    fileName,
    sha256,
    yearEndMonth: field("Reporting year ends (month)") || null,
    files: [{ file: fileName, company, relevant: true, yearsCovered: years, granularity: "site", reason: "Submitted via the AquaTrace template", sha256 }],
    sites,
    records,
    issues,
  };
}

/** Several submissions from the same company (e.g. two reporting years) merged into one. */
export function mergeSubmissions(subs: Submission[]): Submission {
  const [first, ...rest] = subs;
  const company = first.company;
  const sites = new Map(first.sites.map((s) => [s.site, s]));
  for (const s of rest) for (const site of s.sites) if (!sites.has(site.site)) sites.set(site.site, { ...site, company });
  return {
    ...first,
    fileName: subs.map((s) => s.fileName).join(" + "),
    files: subs.flatMap((s) => s.files.map((f) => ({ ...f, company }))),
    sites: [...sites.values()],
    records: subs.flatMap((s) => s.records.map((r) => ({ ...r, company }))),
    issues: subs.flatMap((s) => s.issues.map((i) => ({ ...i, message: `${s.fileName}: ${i.message}` }))),
  };
}
