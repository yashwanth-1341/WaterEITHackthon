// Parses the real Newcrest FY20 workbook with the same importer the app uses,
// checks the result against the figures published in the sheet, and writes
// the preloaded dataset to lib/data/newcrest-fy20.json.
//   npm run verify-import
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { readWorkbook } from "../lib/importers/workbook";
import { balanceOf, totalDischarge, totalWithdrawal, freshwaterPerKoz, recycledShare, sumKnown } from "../lib/metrics";
import { validate } from "../lib/validation";

const file = resolve(__dirname, "../public/samples/newcrest-fy20-gri.xlsx");
const buf = readFileSync(file);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
const { dataset, format, sheetName } = readWorkbook(ab, "newcrest-fy20-gri.xlsx", { company: "Newcrest Mining" });
dataset.sourceLabel = "Newcrest 2020 Sustainability Report, GRI supplementary data (FY20 data GRI 300-Environment)";

// Published totals in the sheet, used as the acceptance test.
const expected: Record<string, { w: number; d: number | null; c: number | null; reuse: number | null }> = {
  lihir: { w: 314363, d: 38041, c: 276322, reuse: 17309 },
  telfer: { w: 18159, d: 3667.21, c: 18159, reuse: 4081 },
  cadia: { w: 14362, d: 638, c: 13056, reuse: 70455 },
  gosowong: { w: 7858, d: null, c: null, reuse: null },
};

let ok = true;
console.log(`format=${format} sheet="${sheetName}" period=${dataset.period} sites=${dataset.sites.map((s) => s.id).join(",")}`);
for (const s of dataset.sites) {
  const e = expected[s.id];
  const w = totalWithdrawal(s);
  const d = s.discharge ? sumKnown(s.discharge) : null;
  const pass =
    e && w === e.w && (e.d === null ? s.discharge === null : Math.abs((d ?? 0) - e.d) < 0.01) && s.consumption === e.c && s.reuse === e.reuse;
  ok &&= !!pass;
  const b = balanceOf(s, 2);
  console.log(
    `${pass ? "PASS" : "FAIL"} ${s.name.padEnd(9)} W=${w} D=${d} (complete=${totalDischarge(s) !== null}) C=${s.consumption} reuse=${s.reuse} dS=${s.deltaStorage}` +
      ` balance=${b.status} gap=${b.gap?.toFixed(1)} fw/koz=${freshwaterPerKoz(s)?.toFixed(1)} recycled=${((recycledShare(s) ?? 0) * 100).toFixed(1)}% unknown=[${s.unknownFields.join(",")}]`,
  );
}
console.log("history", JSON.stringify(dataset.history));
console.log("mapping entries", dataset.mappingLog.length);
const flags = validate(dataset, 2);
console.log(`flags: ${flags.filter((f) => f.severity === "fail").length} fail, ${flags.filter((f) => f.severity === "warn").length} warn, ${flags.filter((f) => f.severity === "info").length} info`);
flags.filter((f) => f.severity !== "info").forEach((f) => console.log(`  [${f.severity}] ${f.title}`));

if (!ok) {
  console.error("Importer output does not match the published figures.");
  process.exit(1);
}
writeFileSync(resolve(__dirname, "../lib/data/newcrest-fy20.json"), JSON.stringify(dataset, null, 2));
console.log("Wrote lib/data/newcrest-fy20.json");
