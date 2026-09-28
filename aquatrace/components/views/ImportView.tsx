"use client";

import { useRef, useState } from "react";
import type { Dataset, Method, Quality, Site, Source, StressSource, WaterStress } from "@/lib/types";
import type { LegacyMapping } from "@/lib/importers/legacyGri";
import { downloadTemplate } from "@/lib/importers/workbook";
import { cx, n0 } from "@/lib/format";

interface Props {
  dataset: Dataset;
  mapping: LegacyMapping;
  onMappingChange: (m: LegacyMapping) => void;
  onImportSample: () => Promise<void>;
  onImportFile: (f: File) => Promise<void>;
  onUpdateSite: (id: string, patch: Partial<Site>) => void;
  error: string | null;
  note: string | null;
}

const btn = "rounded-sm border px-4 py-2 text-[0.88rem] font-medium disabled:opacity-50";
const primary = `${btn} border-fresh bg-fresh text-white hover:bg-fresh-3`;
const secondary = `${btn} border-hairline bg-paper text-basalt hover:border-shale`;

export default function ImportView(p: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const setCat = (key: "cat1" | "cat2" | "cat3", q: Quality) => p.onMappingChange({ ...p.mapping, [key]: q });

  return (
    <div className="max-w-5xl">
      <h1 className="text-[1.6rem] font-semibold tracking-tight">Bring your water data in</h1>
      <p className="mt-2 max-w-2xl text-[0.95rem] leading-relaxed text-shale">
        Most mines have no structured water reporting. AquaTrace reads what exists today, whether that is an old sustainability spreadsheet or a
        filled-in template, and converts it to the ICMM 2021 reporting metrics.
      </p>

      {/* Step 1 */}
      <Step n={1} title="Choose a source">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) run(() => p.onImportFile(f));
          }}
          className={cx(
            "flex flex-wrap items-center gap-3 rounded-sm border border-dashed p-5",
            dragOver ? "border-fresh bg-fresh/5" : "border-hairline",
          )}
        >
          <button className={primary} disabled={busy} onClick={() => run(p.onImportSample)}>
            Import the Newcrest FY20 workbook
          </button>
          <button className={secondary} disabled={busy} onClick={() => fileRef.current?.click()}>
            Upload a workbook
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) run(() => p.onImportFile(f));
              e.target.value = "";
            }}
          />
          <span className="text-[0.82rem] text-shale">or drop an .xlsx file here</span>
        </div>
        <p className="mt-3 text-[0.82rem] leading-relaxed text-shale">
          Accepted: sustainability workbooks with a GRI 303-3 withdrawal table (the sheet is found automatically), or the AquaTrace template.
        </p>
        {p.error && (
          <p role="alert" className="mt-3 border-l-4 border-oxide bg-oxide/5 px-3 py-2 text-[0.88rem] text-oxide">
            {p.error}
          </p>
        )}
        {p.note && !p.error && (
          <p role="status" className="mt-3 border-l-4 border-verdigris bg-verdigris/5 px-3 py-2 text-[0.88rem] text-verdigris">
            {p.note}
          </p>
        )}
      </Step>

      {/* Step 2 */}
      <Step n={2} title="Check how legacy categories were mapped">
        {p.dataset.framework === "legacy-waf" ? (
          <>
            <p className="max-w-2xl text-[0.9rem] leading-relaxed text-shale">
              This file uses the older Water Accounting Framework Category 1, 2 and 3. ICMM 2021 uses two quality classes. The default follows ICMM:
              Categories 1 and 2 are high quality, Category 3 is low quality. Change a mapping to see how every figure moves.
            </p>
            <div className="mt-4 grid max-w-3xl grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
              {(["cat1", "cat2", "cat3"] as const).map((k, i) => (
                <label key={k} className="text-[0.85rem]">
                  <span className="block font-medium">Category {i + 1}</span>
                  <select
                    className="mt-1 w-full rounded-sm border border-hairline bg-paper px-2 py-1.5"
                    value={p.mapping[k]}
                    onChange={(e) => setCat(k, e.target.value as Quality)}
                  >
                    <option value="high">High quality</option>
                    <option value="low">Low quality</option>
                  </select>
                </label>
              ))}
              <label className="text-[0.85rem]">
                <span className="block font-medium">Produced water</span>
                <select
                  className="mt-1 w-full rounded-sm border border-hairline bg-paper px-2 py-1.5"
                  value={p.mapping.producedWater}
                  onChange={(e) => p.onMappingChange({ ...p.mapping, producedWater: e.target.value as Source })}
                >
                  <option value="ground">Groundwater</option>
                  <option value="surface">Surface water</option>
                </select>
              </label>
            </div>

            <div className="mt-5 max-h-80 overflow-auto border-y border-hairline">
              <table className="w-full text-[0.85rem]">
                <thead className="sticky top-0 bg-paper">
                  <tr className="border-b border-basalt text-left text-[0.78rem] text-shale">
                    <th className="py-2 pr-4 font-medium">Site</th>
                    <th className="py-2 pr-4 font-medium">In the source file</th>
                    <th className="py-2 pr-4 font-medium">In ICMM 2021</th>
                    <th className="py-2 text-right font-medium">Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {p.dataset.mappingLog.map((m, i) => (
                    <tr key={i} className="border-b border-hairline">
                      <td className="py-1.5 pr-4 font-medium">{m.site}</td>
                      <td className="py-1.5 pr-4 text-shale">{m.from}</td>
                      <td className="py-1.5 pr-4">{m.to}</td>
                      <td className="num py-1.5 text-right">{n0(m.volume, 2)} ML</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-[0.9rem] text-shale">This dataset is already in the ICMM 2021 structure, so no mapping was needed.</p>
        )}
      </Step>

      {/* Step 3 */}
      <Step n={3} title="Add the context the report does not contain">
        <p className="max-w-2xl text-[0.9rem] leading-relaxed text-shale">
          Legacy reports rarely say whether a site is in a water-stressed area or how volumes were measured. The values below start as assumptions
          and are flagged in Checks until you replace them.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-[0.85rem]">
            <thead>
              <tr className="border-b border-basalt text-left text-[0.78rem] text-shale">
                <th className="py-2 pr-3 font-medium">Site</th>
                <th className="py-2 pr-3 font-medium">Water stress</th>
                <th className="py-2 pr-3 font-medium">Stress source</th>
                <th className="py-2 pr-3 font-medium">Measurement</th>
                <th className="py-2 font-medium">Coastal</th>
              </tr>
            </thead>
            <tbody>
              {p.dataset.sites.map((s) => (
                <tr key={s.id} className="border-b border-hairline">
                  <td className="py-2 pr-3">
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-[0.75rem] text-shale">{s.country}</div>
                  </td>
                  <td className="py-2 pr-3">
                    <Select
                      label={`Water stress for ${s.name}`}
                      value={s.waterStress}
                      options={["low", "medium", "high", "extremely-high", "unknown"]}
                      onChange={(v) => p.onUpdateSite(s.id, { waterStress: v as WaterStress })}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <Select
                      label={`Stress source for ${s.name}`}
                      value={s.stressSource}
                      options={["assumed", "aqueduct", "reported", "unknown"]}
                      onChange={(v) => p.onUpdateSite(s.id, { stressSource: v as StressSource })}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <Select
                      label={`Measurement method for ${s.name}`}
                      value={s.method}
                      options={["not-disclosed", "metered", "estimated", "modelled"]}
                      onChange={(v) => p.onUpdateSite(s.id, { method: v as Method })}
                    />
                  </td>
                  <td className="py-2">
                    <input
                      type="checkbox"
                      aria-label={`${s.name} is coastal`}
                      checked={s.coastal}
                      onChange={(e) => p.onUpdateSite(s.id, { coastal: e.target.checked })}
                      className="h-4 w-4 accent-fresh"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Step>

      {/* Step 4 */}
      <Step n={4} title="Send the template to sites" last>
        <p className="max-w-2xl text-[0.9rem] leading-relaxed text-shale">
          The template has one row per site, metric, source and quality, matching ICMM Table 4. The pre-filled version shows each site exactly which
          cells are missing or unknown.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className={primary} onClick={() => downloadTemplate(p.dataset)}>
            Download pre-filled template
          </button>
          <button className={secondary} onClick={() => downloadTemplate(null)}>
            Download blank template
          </button>
        </div>
      </Step>
    </div>
  );
}

function Step({ n, title, children, last = false }: { n: number; title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <section className={cx("grid grid-cols-[2.5rem_1fr] gap-4 pt-8", !last && "pb-2")}>
      <div className="num cond text-[2rem] font-bold leading-none text-fresh">{n}</div>
      <div>
        <h2 className="text-[1.1rem] font-semibold">{title}</h2>
        <div className="mt-3">{children}</div>
      </div>
    </section>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select
      aria-label={label}
      className="w-full rounded-sm border border-hairline bg-paper px-2 py-1.5"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o.replace("-", " ")}
        </option>
      ))}
    </select>
  );
}
