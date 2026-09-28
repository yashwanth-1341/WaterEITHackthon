// Exports the preloaded dataset as a template, re-imports it, and checks nothing changed.
//   npm run verify-template
import * as XLSX from "xlsx";
import ds0 from "../lib/data/newcrest-fy20.json";
import { toTemplateRows, TEMPLATE_COLUMNS, TEMPLATE_SHEET } from "../lib/importers/template";
import { readWorkbook } from "../lib/importers/workbook";
import { totalWithdrawal, sumKnown } from "../lib/metrics";
import { validate } from "../lib/validation";
const ds: any = ds0;
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toTemplateRows(ds), { header: [...TEMPLATE_COLUMNS] }), TEMPLATE_SHEET);
const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
const { dataset, format } = readWorkbook(buf, "roundtrip.xlsx");
let ok = format === "icmm-template";
for (const s of ds.sites) {
  const t = dataset.sites.find((x) => x.id === s.id)!;
  const same = totalWithdrawal(t) === totalWithdrawal(s) && sumKnown(t.discharge) === sumKnown(s.discharge) && t.consumption === s.consumption && t.reuse === s.reuse && t.deltaStorage === s.deltaStorage && JSON.stringify([...t.unknownFields].sort()) === JSON.stringify([...s.unknownFields].sort()) && (t.discharge === null) === (s.discharge === null);
  ok &&= same; console.log(same ? "PASS" : "FAIL", s.name, totalWithdrawal(t), t.consumption, t.unknownFields, t.discharge === null);
}
console.log("fails:", validate(dataset, 2).filter(f=>f.severity==="fail").map(f=>f.title));
console.log(ok ? "ROUND TRIP OK" : "ROUND TRIP BROKEN");
if (!ok) process.exit(1);
