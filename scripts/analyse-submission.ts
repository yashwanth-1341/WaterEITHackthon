// Analyse one or more submission files from the same company against the corpus.
//   npm run analyse-submission -- submissions/examples/andes-ridge-copper-2023.xlsx submissions/examples/andes-ridge-copper-2024.xlsx
//   add --add to put the company into the corpus (data/extracted + data/reports), then run build-corpus.
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import * as XLSX from "xlsx";
import type { Corpus } from "../lib/corpus/types";
import { INDICATORS } from "../lib/corpus/indicators";
import { SIGNAL_LABEL } from "../lib/corpus/integrity";
import { HORIZONS } from "../lib/corpus/trends";
import { isSubmissionWorkbook, mergeSubmissions, parseSubmission } from "../lib/submission/format";
import { analyseSubmission } from "../lib/submission/analyse";

const root = resolve(__dirname, "..");
const args = process.argv.slice(2);
const add = args.includes("--add");
const paths = args.filter((a) => !a.startsWith("--"));
if (!paths.length) {
  console.error("Usage: npm run analyse-submission -- <file.xlsx> [more files from the same company] [--add]");
  process.exit(1);
}

const subs = paths.map((p) => {
  const buf = readFileSync(resolve(p));
  const wb = XLSX.read(buf);
  if (!isSubmissionWorkbook(wb)) throw new Error(`${p} is not an AquaTrace submission (needs 'Sites' and 'Data' sheets).`);
  return parseSubmission(wb, basename(p), createHash("sha256").update(buf).digest("hex"));
});
const sub = mergeSubmissions(subs);
const corpus = JSON.parse(readFileSync(resolve(root, "lib/data/corpus.json"), "utf8")) as Corpus;
const a = analyseSubmission(corpus, sub);

const fmt = (v: number, pct?: boolean) => (pct ? `${v.toFixed(0)}%` : v.toLocaleString("en-US", { maximumFractionDigits: v < 100 ? 2 : 0 }));
const L: string[] = [];
L.push(`# Water data analysis: ${a.company}`, "");
L.push(`Files: ${subs.map((s) => `\`${s.fileName}\` (SHA-256 ${s.sha256.slice(0, 16)}…)`).join(", ")}`);
L.push(`${sub.records.length} figures, ${sub.sites.length} sites, years ${a.profile.years.join(", ")}. Integrity score ${a.score}/100.`, "");
if (sub.issues.length) {
  L.push("## Problems in the file", "");
  sub.issues.forEach((i) => L.push(`- Row ${i.row}: ${i.message}`));
  L.push("");
}
L.push("## Findings", "");
a.findings.forEach((f) => L.push(`- ${f.tone === "bad" ? "⚠️" : f.tone === "good" ? "✅" : "•"} ${f.text}`));
L.push("", "## Trend and projection if nothing changes", "");
L.push(`| Indicator | Last reported | Trend | ${HORIZONS.map((h) => `${h.label} (${h.year})`).join(" | ")} |`);
L.push(`| --- | --- | --- | ${HORIZONS.map(() => "---").join(" | ")} |`);
for (const ind of INDICATORS) {
  const pts = a.profile.series[ind.id];
  if (!pts) continue;
  const t = a.profile.trends[ind.id];
  const last = pts.at(-1)!;
  const change = t ? (ind.pct ? `${(t.annualChange * 100).toFixed(1)} pts/yr` : `${(t.annualChange * 100).toFixed(1)}%/yr`) : "–";
  L.push(`| ${ind.label} (${ind.unit}) | ${fmt(last.value, ind.pct)} (${last.year}) | ${change} | ${HORIZONS.map((h) => (t ? fmt(t.project(h.year).mid, ind.pct) : "–")).join(" | ")} |`);
}
L.push("", "## Compared with peers", "");
a.ranks.forEach((r) => L.push(`- ${r.label}: ${fmt(r.value, r.id === "reuse" || r.id === "stressedShare")} — rank ${r.rank} of ${r.of} (peer median ${r.peerMedian === null ? "–" : fmt(r.peerMedian, r.id === "reuse" || r.id === "stressedShare")})`));
L.push("", "## Integrity checks", "");
if (!a.signals.length) L.push("No signals.");
a.signals.forEach((s) => L.push(`- **${s.severity}** · ${SIGNAL_LABEL[s.kind]}${s.site && s.site !== "_corporate" ? ` · ${s.site}` : ""}${s.year ? ` · ${s.year}` : ""}: ${s.title}`));
L.push("", "## Recommended actions", "");
a.actions.forEach((x, i) => L.push(`${i + 1}. ${x}`));
L.push("", "_Projections extend the disclosed trend; they are not forecasts. Integrity signals are prompts for review, not proof of wrongdoing._");

const report = L.join("\n");
console.log(report);
const slug = a.company.toLowerCase().replace(/\(.*?\)/g, "").trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
mkdirSync(resolve(root, "submissions/reports"), { recursive: true });
writeFileSync(resolve(root, `submissions/reports/${slug}-analysis.md`), report + "\n");
console.log(`\nSaved submissions/reports/${slug}-analysis.md`);

if (add) {
  for (const p of paths) copyFileSync(resolve(p), resolve(root, "data/reports", basename(p)));
  writeFileSync(
    resolve(root, `data/extracted/${slug}.json`),
    JSON.stringify(
      {
        company: sub.company,
        files: sub.files.map(({ company: _c, sha256: _h, ...f }) => f),
        sites: sub.sites.map(({ company: _c, ...s }) => s),
        records: sub.records.map(({ company: _c, ...r }) => r),
        observations: [],
      },
      null,
      2,
    ),
  );
  console.log(`Added to the corpus: data/extracted/${slug}.json. Now run: npm run build-corpus`);
}
