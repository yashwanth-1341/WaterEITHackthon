// Writes the submission template and example files:
//   submissions/template/aquatrace-submission-template.xlsx   blank template
//   submissions/examples/andes-ridge-copper-2023.xlsx          SAMPLE, fictional company, reporting year 2023
//   submissions/examples/andes-ridge-copper-2024.xlsx          SAMPLE, same company, reporting year 2024
//   submissions/examples/hudbay-minerals-template.xlsx         a real company's published figures in template form
// and copies them to public/samples/ so the app can load them.
//   npm run make-submission-files
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { blankTemplate, filledTemplate, METRICS } from "../lib/submission/format";
import type { Corpus } from "../lib/corpus/types";

const root = resolve(__dirname, "..");
const out = (p: string) => resolve(root, "submissions", p);
mkdirSync(out("template"), { recursive: true });
mkdirSync(out("examples"), { recursive: true });
mkdirSync(resolve(root, "public/samples"), { recursive: true });

const write = (wb: XLSX.WorkBook, rel: string) => {
  XLSX.writeFile(wb, out(rel));
  copyFileSync(out(rel), resolve(root, "public/samples", rel.split("/").pop()!));
  console.log(`wrote submissions/${rel}`);
};

write(blankTemplate(), "template/aquatrace-submission-template.xlsx");

/* ---------- Sample company: fictional, deterministic numbers ---------- */

const COMPANY = "Andes Ridge Copper (sample)";
const sites = [
  ["Cerro Blanco", "Chile", "copper", "extremely-high", "operating"],
  ["Quebrada Seca", "Chile", "copper, molybdenum", "high", "operating"],
  ["Laguna Verde", "Peru", "copper, gold", "medium", "operating"],
];

type Row = (string | number)[];
const r0 = (x: number) => Math.round(x);

/** Site figures for one year (ML, t). The story: growth, desalination at Cerro Blanco from 2023, stressed basins. */
function siteYear(site: string, y: number) {
  const t = y - 2019;
  if (site === "Cerro Blanco") {
    const desal = y >= 2023 ? 8000 + (y - 2023) * 1500 : 0;
    const ground = 30000 * 1.06 ** t - (y >= 2023 ? 5000 : 0);
    const surface = 6000 * 1.01 ** t;
    const third = 6000 * 1.03 ** t;
    const total = surface + ground + third + desal;
    const discharge = total * 0.03;
    return { surface, ground, sea: desal, third, rain: 0, total, fresh: surface + ground + third, stressed: total, discharge, consumption: total - discharge, reuse: 95000 * 1.03 ** t, ore: 38e6 * 1.05 ** t, cu: 38e6 * 1.05 ** t * 0.0045 };
  }
  if (site === "Quebrada Seca") {
    const ground = 12000 * 1.04 ** t;
    const third = 3000 * 1.04 ** t;
    const total = ground + third;
    const discharge = total * 0.02;
    return { surface: 0, ground, sea: 0, third, rain: 0, total, fresh: total, stressed: total, discharge, consumption: total - discharge, reuse: 22000 * 1.005 ** t, ore: 14e6 * 1.03 ** t, cu: 14e6 * 1.03 ** t * 0.005 };
  }
  const surface = 7500 * 1.02 ** t;
  const rain = 1500 * (1 + 0.1 * Math.sin(t));
  const total = surface + rain;
  const discharge = 4000 * 1.02 ** t;
  return { surface, ground: 0, sea: 0, third: 0, rain, total, fresh: surface, stressed: 0, discharge, consumption: total - discharge, reuse: 18000 * 1.01 ** t, ore: 10e6 * 1.02 ** t, cu: 10e6 * 1.02 ** t * 0.006 };
}

function sampleData(years: number[], opts: { restate2023?: boolean }): Row[] {
  const rows: Row[] = [];
  for (const y of years) {
    const corp = { total: 0, fresh: 0, stressed: 0, discharge: 0, consumption: 0, reuse: 0, ore: 0, cu: 0 };
    for (const [site] of sites) {
      const v = siteYear(site, y);
      let total = v.total;
      let consumption = v.consumption;
      let discharge = v.discharge;
      let dischargeNote = "";
      // Planted issue 3: the 2024 report silently restates Quebrada Seca's 2023 withdrawal (+12%).
      if (opts.restate2023 && site === "Quebrada Seca" && y === 2023) total *= 1.12;
      // Planted issue 2: Cerro Blanco 2022 consumption understated, so the balance doesn't close.
      if (site === "Cerro Blanco" && y === 2022) consumption *= 0.7;
      // Planted issue 1: Laguna Verde 2023 discharge typed in m3 but labelled ML (x1000).
      const dischargeValue = site === "Laguna Verde" && y === 2023 ? discharge * 1000 : discharge;
      if (site === "Laguna Verde" && y === 2023) dischargeNote = "from site water register";
      const push = (metric: string, value: number, unit = "ML", note = "") => value > 0 && rows.push([site, y, metric, r0(value), unit, note]);
      push("withdrawal_surface", v.surface);
      push("withdrawal_ground", v.ground);
      push("withdrawal_sea", v.sea, "ML", y === 2023 ? "desalination plant commissioned" : "");
      push("withdrawal_third_party", v.third);
      push("withdrawal_rain_runoff", v.rain);
      push("withdrawal_total", total);
      push("withdrawal_fresh", v.fresh);
      if (v.stressed) push("withdrawal_water_stressed", total);
      push("discharge_total", dischargeValue, "ML", dischargeNote);
      push("consumption_total", consumption);
      push("reused_recycled", v.reuse);
      push("ore_processed_t", v.ore, "t");
      push("copper_production_t", v.cu, "t");
      corp.total += total;
      corp.fresh += v.fresh;
      corp.stressed += v.stressed ? total : 0;
      corp.discharge += discharge;
      corp.consumption += consumption;
      corp.reuse += v.reuse;
      corp.ore += v.ore;
      corp.cu += v.cu;
    }
    // Planted issue 4: the 2021 company total double-counts part of Laguna Verde (+9%).
    const corpTotal = y === 2021 ? corp.total * 1.09 : corp.total;
    const c = (metric: string, value: number, unit = "ML") => rows.push(["_corporate", y, metric, r0(value), unit, ""]);
    c("withdrawal_total", corpTotal);
    c("withdrawal_fresh", corp.fresh);
    c("withdrawal_water_stressed", corp.stressed);
    c("discharge_total", corp.discharge);
    c("consumption_total", corp.consumption);
    c("reused_recycled", corp.reuse);
    c("ore_processed_t", corp.ore, "t");
    c("copper_production_t", corp.cu, "t");
    if (y === 2023) rows.push(["_corporate", y, "water_incidents_count", 1, "count", "Laguna Verde: turbidity exceedance, reported to regulator"]);
  }
  return rows;
}

const sampleCompany = (year: number) => ({
  "Company name": COMPANY,
  "Reporting year ends (month)": "December",
  "Contact email": "sustainability@example.com",
  "Prepared by": `SAMPLE DATA - fictional company for demonstration (${year} report)`,
  "Assured by (if any)": "",
});

write(filledTemplate(sampleCompany(2023), sites, sampleData([2019, 2020, 2021, 2022, 2023], {})), "examples/andes-ridge-copper-2023.xlsx");
write(filledTemplate(sampleCompany(2024), sites, sampleData([2022, 2023, 2024], { restate2023: true })), "examples/andes-ridge-copper-2024.xlsx");

/* ---------- A real company's published figures in template form ---------- */

const corpus = JSON.parse(readFileSync(resolve(root, "lib/data/corpus.json"), "utf8")) as Corpus;
const REAL = "Hudbay Minerals";
const keys = new Set(METRICS.map((m) => m.key));
const unitOf = (k: string) => METRICS.find((m) => m.key === k)!.unit;
const realRows: Row[] = corpus.records
  .filter((r) => r.company === REAL && keys.has(r.metric))
  .sort((a, b) => a.site.localeCompare(b.site) || a.year - b.year || a.metric.localeCompare(b.metric))
  .map((r) => [r.site, r.year, r.metric, r.value, unitOf(r.metric), `from ${r.sourceFile}, ${r.location}`]);
const realSites = corpus.sites.filter((s) => s.company === REAL && s.site !== "_corporate").map((s) => [s.site, s.country ?? "", s.commodity.join(", "), s.waterStressReported ?? "", s.status ?? ""]);
write(
  filledTemplate(
    { "Company name": REAL, "Reporting year ends (month)": "December", "Prepared by": "AquaTrace, from the published Hudbay 2022 Performance Data (figures as reported)" },
    realSites,
    realRows,
  ),
  "examples/hudbay-minerals-template.xlsx",
);
console.log(`${REAL}: ${realRows.length} rows from the published report`);
