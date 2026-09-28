// Re-opens every source workbook and checks each extracted figure against the cell it cites.
// Catches extraction mistakes and any edit to the corpus or the source files after ingestion.
//   npm run verify-corpus
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import type { Corpus } from "../lib/corpus/types";

const root = resolve(__dirname, "..");
const corpus = JSON.parse(readFileSync(resolve(root, "lib/data/corpus.json"), "utf8")) as Corpus;

const books = new Map<string, XLSX.WorkBook>();
const book = (file: string) => {
  if (!books.has(file)) books.set(file, XLSX.read(readFileSync(resolve(root, "data/reports", file)), { cellFormula: false }));
  return books.get(file)!;
};
/** Parse a figure as printed: "12,345", "(37,479)" = negative, "64%", "-" = zero. */
const toNum = (v: unknown) => {
  if (typeof v === "number") return v;
  const t = String(v ?? "").trim();
  if (/^[-–—]$/.test(t)) return 0;
  const neg = /^\(.*\)$/.test(t);
  const n = Number(t.replace(/[(),\s]/g, "").replace(/%$/, ""));
  return neg ? -n : n;
};
const close = (a: number, b: number, tol: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
/** The raw string matches the cell if it is the cell's value, its printed text, or its value rounded as printed. */
function matches(cell: XLSX.CellObject, raw: string) {
  if (cell.w !== undefined && cell.w.trim() === raw.trim()) return true;
  const v = toNum(cell.v);
  const r = toNum(raw);
  const decimals = (raw.split(".")[1] ?? "").replace(/[^0-9]/g, "").length;
  const tol = Math.max(1e-6 * Math.abs(v), 0.5 * 10 ** -decimals + 1e-9);
  if (close(v, r, tol)) return true;
  if (/%\s*$/.test(raw) && close(v * 100, r, Math.max(0.5 * 10 ** -decimals, 1e-6))) return true;
  // Text cells holding a sentence with the number in it (e.g. "zero (0) significant fines").
  if (typeof cell.v === "string" && cell.v.includes(raw.trim())) return true;
  return false;
}

let checked = 0;
let skipped = 0;
const mismatches: string[] = [];
for (const r of corpus.records) {
  if (!/\.xls[xm]?$/i.test(r.sourceFile)) continue;
  const m = r.location.match(/sheet '([^']+)' cell ([A-Z]+\d+)/);
  if (!m || r.rawValue === undefined) {
    skipped++;
    continue;
  }
  const ws = book(r.sourceFile).Sheets[m[1]];
  const cell = ws?.[m[2]];
  checked++;
  if (!cell) {
    mismatches.push(`${r.company} ${r.site} ${r.year} ${r.metric}: ${m[1]}!${m[2]} is empty (raw "${r.rawValue}")`);
    continue;
  }
  if (!matches(cell, r.rawValue)) {
    mismatches.push(`${r.company} ${r.site} ${r.year} ${r.metric}: ${m[1]}!${m[2]} holds ${JSON.stringify(cell.v)}, corpus raw "${r.rawValue}"`);
  }
}

const pdf = corpus.records.filter((r) => /\.pdf$/i.test(r.sourceFile)).length;
console.log(`Workbook figures checked against their cells: ${checked} (${skipped} without a cell reference). PDF figures (page-cited, not machine-checked): ${pdf}.`);
if (mismatches.length) {
  console.log(`${mismatches.length} mismatch(es):`);
  mismatches.slice(0, 50).forEach((x) => console.log("  " + x));
  process.exitCode = 1;
} else console.log("All match.");
