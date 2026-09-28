"use client";

import { useState } from "react";
import type { Dataset } from "@/lib/types";
import type { Balance } from "@/lib/metrics";
import type { Flag, Severity } from "@/lib/validation";
import { cx } from "@/lib/format";

interface Props {
  dataset: Dataset;
  balances: Map<string, Balance>;
  flags: Flag[];
  tolerance: number;
  setTolerance: (n: number) => void;
  selected: string | null;
  setSelected: (id: string | null) => void;
}

const SEV: Record<Severity, { label: string; bar: string; text: string }> = {
  fail: { label: "Fails", bar: "bg-oxide", text: "text-oxide" },
  warn: { label: "Needs attention", bar: "bg-ochre", text: "text-ochre" },
  info: { label: "For information", bar: "bg-sea", text: "text-shale" },
};

export default function ChecksView({ dataset, flags, tolerance, setTolerance, selected, setSelected }: Props) {
  const [showInfo, setShowInfo] = useState(false);
  const visible = flags.filter((f) => (selected ? f.siteId === selected || f.siteId === null : true)).filter((f) => showInfo || f.severity !== "info");
  const count = (s: Severity) => flags.filter((f) => f.severity === s && (!selected || f.siteId === selected || f.siteId === null)).length;
  const siteName = dataset.sites.find((s) => s.id === selected)?.name;

  return (
    <div className="max-w-5xl">
      <h1 className="text-[1.6rem] font-semibold tracking-tight">Checks{siteName ? ` for ${siteName}` : ""}</h1>
      <p className="mt-2 max-w-2xl text-[0.95rem] leading-relaxed text-shale">
        Every import runs the same checks: does the water balance close, are the ICMM minimum metrics present, and is the context needed for due
        diligence there.
      </p>

      <div className="mt-6 grid gap-6 border-y border-hairline py-5 sm:grid-cols-[1fr_auto]">
        <div className="flex flex-wrap gap-10">
          {(["fail", "warn", "info"] as Severity[]).map((s) => (
            <div key={s}>
              <div className={cx("num cond text-[2.6rem] font-bold leading-none", SEV[s].text)}>{count(s)}</div>
              <div className="mt-1 text-[0.85rem] text-shale">{SEV[s].label}</div>
            </div>
          ))}
        </div>
        <label className="block w-72 text-[0.85rem]">
          <span className="flex justify-between font-medium">
            Balance tolerance <span className="num">{tolerance}%</span>
          </span>
          <input type="range" min={0} max={25} step={0.5} value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))} className="mt-2 w-full" />
          <span className="mt-1 block text-[0.78rem] text-shale">How far a site&apos;s balance may be off before it fails.</span>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelected(null)}
          className={cx("rounded-sm border px-3 py-1 text-[0.82rem]", !selected ? "border-basalt bg-basalt text-white" : "border-hairline")}
        >
          All sites
        </button>
        {dataset.sites.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelected(s.id)}
            className={cx("rounded-sm border px-3 py-1 text-[0.82rem]", selected === s.id ? "border-basalt bg-basalt text-white" : "border-hairline")}
          >
            {s.name}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-[0.82rem] text-shale">
          <input type="checkbox" checked={showInfo} onChange={(e) => setShowInfo(e.target.checked)} className="accent-fresh" />
          Show information items
        </label>
      </div>

      <ul className="mt-5 divide-y divide-hairline border-y border-hairline">
        {visible.length === 0 && <li className="py-6 text-[0.9rem] text-shale">No issues for this selection. Try showing information items.</li>}
        {visible.map((f) => (
          <li key={f.id} className="grid grid-cols-[4px_1fr] gap-4 py-4">
            <span className={cx("rounded-full", SEV[f.severity].bar)} aria-hidden />
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <h3 className="font-semibold">{f.title}</h3>
                <span className={cx("text-[0.78rem] font-medium", SEV[f.severity].text)}>{SEV[f.severity].label}</span>
              </div>
              <p className="mt-1 max-w-3xl text-[0.88rem] leading-relaxed text-shale">{f.detail}</p>
              {f.reference && <p className="mt-1 text-[0.78rem] text-shale">Reference: {f.reference}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
