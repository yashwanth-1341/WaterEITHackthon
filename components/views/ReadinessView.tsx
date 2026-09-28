"use client";

import type { Dataset } from "@/lib/types";
import { READINESS_ITEMS, readinessScore, type Status } from "@/lib/readiness";
import { downloadIcmmTable4 } from "@/lib/importers/workbook";
import { cx } from "@/lib/format";

const GLYPH: Record<Status, { label: string; cls: string; shape: React.ReactNode }> = {
  met: {
    label: "Met",
    cls: "text-verdigris",
    shape: <circle cx="7" cy="7" r="6" fill="currentColor" />,
  },
  partial: {
    label: "Partly met",
    cls: "text-ochre",
    shape: (
      <>
        <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 1.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" />
      </>
    ),
  },
  missing: {
    label: "Missing",
    cls: "text-oxide",
    shape: <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />,
  },
};

export default function ReadinessView({ dataset, tolerance, selected }: { dataset: Dataset; tolerance: number; selected: string | null }) {
  const scores = dataset.sites.map((s) => ({ s, ...readinessScore(s, tolerance) }));

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.6rem] font-semibold tracking-tight">Could these sites supply an EU buyer today?</h1>
          <p className="mt-2 max-w-3xl text-[0.95rem] leading-relaxed text-shale">
            EU rules put water transparency on the supply chain: ESRS E3 for reporting companies, and due diligence expectations under the Critical
            Raw Materials Act and the Battery Regulation. This matrix shows which data points each site can already provide.
          </p>
        </div>
        <button
          onClick={() => downloadIcmmTable4(dataset)}
          className="rounded-sm border border-fresh bg-fresh px-4 py-2 text-[0.88rem] font-medium text-white hover:bg-fresh-3"
        >
          Download ICMM Table 4
        </button>
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full text-[0.86rem]">
          <thead>
            <tr className="border-b border-basalt text-left text-[0.78rem] text-shale">
              <th className="py-2 pr-4 font-medium">Data point</th>
              <th className="py-2 pr-4 font-medium">Needed for</th>
              {scores.map(({ s }) => (
                <th key={s.id} className={cx("py-2 pr-2 text-center font-semibold text-basalt", selected && selected !== s.id && "opacity-45")}>
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {READINESS_ITEMS.map((item) => (
              <tr key={item.id} className="border-b border-hairline">
                <td className="py-2.5 pr-4 font-medium">{item.label}</td>
                <td className="py-2.5 pr-4 text-[0.78rem] text-shale">{item.frameworks.join(", ")}</td>
                {scores.map(({ s, results }) => {
                  const r = results.find((x) => x.item.id === item.id)!;
                  const g = GLYPH[r.status];
                  return (
                    <td key={s.id} className={cx("py-2.5 pr-2 text-center", selected && selected !== s.id && "opacity-45")}>
                      <span className={cx("inline-flex", g.cls)} title={`${g.label}: ${r.why}`}>
                        <svg width="14" height="14" role="img" aria-label={`${s.name}, ${item.label}: ${g.label}. ${r.why}`}>
                          {g.shape}
                        </svg>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td className="pt-4 pr-4 font-semibold">Readiness</td>
              <td className="pt-4 pr-4 text-[0.78rem] text-shale">Met counts 1, partly met counts half</td>
              {scores.map(({ s, score }) => (
                <td key={s.id} className={cx("pt-4 pr-2 text-center", selected && selected !== s.id && "opacity-45")}>
                  <span className={cx("num cond text-[2rem] font-bold", score >= 75 ? "text-verdigris" : score >= 50 ? "text-ochre" : "text-oxide")}>
                    {score}%
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex flex-wrap gap-5 text-[0.8rem] text-shale">
        {(Object.keys(GLYPH) as Status[]).map((k) => (
          <span key={k} className={cx("flex items-center gap-1.5", GLYPH[k].cls)}>
            <svg width="14" height="14" aria-hidden>
              {GLYPH[k].shape}
            </svg>
            <span className="text-shale">{GLYPH[k].label}</span>
          </span>
        ))}
        <span>Hover a mark to see why.</span>
      </div>

      <p className="mt-6 max-w-3xl text-[0.8rem] leading-relaxed text-shale">
        The framework mapping is indicative. CSRD scope, the CSDDD and the Battery Regulation due-diligence timeline were revised through the 2025
        Omnibus process; check the current legal text before using this for compliance decisions.
      </p>
    </div>
  );
}
