// Merges the per-company extractions in data/extracted/*.json into one corpus,
// attaches the SHA-256 fingerprint of every source file in data/reports/, and
// writes lib/data/corpus.json (bundled into the app).
//   npm run build-corpus
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Corpus, CorpusFile, CorpusRecord, CorpusSite, SeriesBreak } from "../lib/corpus/types";

const root = resolve(__dirname, "..");
const extractedDir = resolve(root, "data/extracted");
const reportsDir = resolve(root, "data/reports");

const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

interface Extract {
  company: string;
  files: Omit<CorpusFile, "company" | "sha256">[];
  sites: Omit<CorpusSite, "company">[];
  records: Omit<CorpusRecord, "company">[];
  observations?: string[];
}

const breaksPath = resolve(extractedDir, "_breaks.json");
const breaks: SeriesBreak[] = existsSync(breaksPath) ? JSON.parse(readFileSync(breaksPath, "utf8")) : [];
const corpus: Corpus = { builtAt: new Date().toISOString(), breaks, companies: [], files: [], sites: [], records: [], observations: [] };
const problems: string[] = [];

for (const name of readdirSync(extractedDir).filter((f) => f.endsWith(".json") && !f.startsWith("_")).sort()) {
  const ex = JSON.parse(readFileSync(resolve(extractedDir, name), "utf8")) as Extract;
  corpus.companies.push(ex.company);

  for (const f of ex.files ?? []) {
    const path = resolve(reportsDir, f.file);
    if (!existsSync(path)) problems.push(`${name}: file not found in data/reports: ${f.file}`);
    corpus.files.push({ ...f, company: ex.company, yearsCovered: f.yearsCovered ?? [], sha256: existsSync(path) ? sha256(path) : null });
  }
  for (const s of ex.sites ?? []) {
    corpus.sites.push({
      company: ex.company,
      site: s.site,
      country: s.country ?? null,
      commodity: s.commodity ?? [],
      waterStressReported: s.waterStressReported ?? null,
      status: s.status ?? null,
    });
  }
  for (const r of ex.records ?? []) {
    const value = typeof r.value === "string" ? Number(r.value) : r.value;
    if (!Number.isFinite(value) || !Number.isInteger(r.year) || !r.metric || !r.site) {
      problems.push(`${name}: dropped malformed record ${JSON.stringify(r).slice(0, 160)}`);
      continue;
    }
    corpus.records.push({ ...r, value, company: ex.company });
  }
  for (const o of ex.observations ?? []) corpus.observations.push({ company: ex.company, text: o });
}

for (const b of breaks) if (!corpus.companies.includes(b.company)) problems.push(`_breaks.json: unknown company "${b.company}"`);

writeFileSync(resolve(root, "lib/data/corpus.json"), JSON.stringify(corpus));

const years = corpus.records.map((r) => r.year);
console.log(
  `companies=${corpus.companies.length} files=${corpus.files.length} (relevant ${corpus.files.filter((f) => f.relevant).length}) ` +
    `sites=${corpus.sites.length} records=${corpus.records.length} years=${Math.min(...years)}-${Math.max(...years)}`,
);
for (const c of corpus.companies) {
  const rs = corpus.records.filter((r) => r.company === c);
  console.log(`  ${c.padEnd(28)} ${String(rs.length).padStart(5)} records, ${new Set(rs.map((r) => r.site)).size} sites, years ${[...new Set(rs.map((r) => r.year))].sort().join(",")}`);
}
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  problems.slice(0, 40).forEach((p) => console.log("  " + p));
}
