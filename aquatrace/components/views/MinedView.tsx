"use client";

import { useState } from "react";
import type { Dataset } from "@/lib/types";
import { COMMODITIES, COPPER_STAGES, type ProcessStage, type StageRole } from "@/lib/data/commodities";
import { freshwaterPerKoz } from "@/lib/metrics";
import { cx, n0 } from "@/lib/format";

const ROLE: Record<StageRole, { label: string; border: string; dot: string }> = {
  input: { label: "Takes water in", border: "border-fresh", dot: "bg-fresh" },
  recovery: { label: "Recovers water", border: "border-verdigris", dot: "bg-verdigris" },
  loss: { label: "Loses water", border: "border-oxide", dot: "bg-oxide" },
  treatment: { label: "Treats and returns", border: "border-sea", dot: "bg-sea" },
};

const PRESSURE_WIDTH: Record<string, string> = { "Very high": "w-full", High: "w-3/4", Medium: "w-1/2", "Low to medium": "w-1/3" };

export default function MinedView({ dataset, selected }: { dataset: Dataset; selected: string | null }) {
  const [stage, setStage] = useState<ProcessStage>(COPPER_STAGES.find((s) => s.id === "tailings")!);
  const groups = ["Concentrator", "Smelter and refinery"] as const;
  const siteRows = dataset.sites
    .map((s) => ({ s, k: freshwaterPerKoz(s) }))
    .filter((r) => r.k !== null)
    .sort((a, b) => (b.k ?? 0) - (a.k ?? 0));
  const maxK = Math.max(...siteRows.map((r) => r.k ?? 0), 1);

  return (
    <div className="max-w-6xl">
      <h1 className="text-[1.6rem] font-semibold tracking-tight">Which materials and which steps drive water use?</h1>
      <p className="mt-2 max-w-3xl text-[0.95rem] leading-relaxed text-shale">
        How much water a metal needs depends on ore grade, the processing route and the climate, not on the metal alone. Knowing where in the
        process water enters and leaves tells a site what to measure first.
      </p>

      {/* Process flow */}
      <section aria-labelledby="flow" className="mt-8">
        <h2 id="flow" className="text-[1.2rem] font-semibold">Copper from sulfide ore, step by step</h2>
        <p className="mt-1 text-[0.82rem] text-shale">After COCHILCO, processing of sulfide minerals by flotation and pyrometallurgy. Select a step.</p>
        <div className="mt-4 flex flex-wrap gap-4 text-[0.78rem] text-shale">
          {(Object.keys(ROLE) as StageRole[]).map((r) => (
            <span key={r} className="flex items-center gap-1.5">
              <span className={cx("inline-block h-2.5 w-2.5 rounded-full", ROLE[r].dot)} />
              {ROLE[r].label}
            </span>
          ))}
        </div>

        <div className="mt-4 space-y-5">
          {groups.map((g) => (
            <div key={g}>
              <div className="mb-2 text-[0.82rem] font-medium text-shale">{g}</div>
              <ol className="flex flex-wrap items-stretch gap-y-3">
                {COPPER_STAGES.filter((s) => s.group === g).map((s, i, arr) => (
                  <li key={s.id} className="flex items-center">
                    <button
                      onClick={() => setStage(s)}
                      aria-pressed={stage.id === s.id}
                      className={cx(
                        "min-w-[8.5rem] rounded-sm border-2 px-3 py-2.5 text-left text-[0.85rem] font-medium",
                        ROLE[s.role].border,
                        stage.id === s.id ? "bg-basalt text-white" : "bg-paper hover:bg-limestone",
                      )}
                    >
                      {s.name}
                    </button>
                    {i < arr.length - 1 && (
                      <svg width="26" height="12" aria-hidden className="mx-1 shrink-0">
                        <path d="M1 6h20M17 2l5 4-5 4" fill="none" stroke="var(--color-shale)" strokeWidth="1.5" />
                      </svg>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-6 border-l-4 border-basalt bg-limestone/60 px-5 py-4 sm:grid-cols-2" aria-live="polite">
          <div>
            <div className="text-[0.78rem] text-shale">{ROLE[stage.role].label}</div>
            <div className="text-[1.05rem] font-semibold">{stage.name}</div>
            <p className="mt-1 text-[0.88rem] leading-relaxed">{stage.water}</p>
          </div>
          <div>
            <div className="text-[0.78rem] text-shale">What to measure</div>
            <p className="mt-1 text-[0.88rem] leading-relaxed">{stage.measure}</p>
          </div>
        </div>
        <p className="mt-3 max-w-3xl text-[0.82rem] leading-relaxed text-shale">
          Copper-gold mines such as Cadia and Telfer sell concentrate, so they own only the concentrator steps; smelting happens downstream and its
          water use sits with the smelter. A buyer tracing water through the supply chain needs both.
        </p>
      </section>

      {/* Commodities */}
      <section aria-labelledby="commodities" className="mt-12">
        <h2 id="commodities" className="text-[1.2rem] font-semibold">Transition materials and their water profile</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-[0.86rem]">
            <thead>
              <tr className="border-b border-basalt text-left text-[0.78rem] text-shale">
                <th className="py-2 pr-4 font-medium">Material and route</th>
                <th className="w-40 py-2 pr-4 font-medium">Relative water pressure</th>
                <th className="py-2 pr-4 font-medium">Why</th>
                <th className="py-2 pr-4 font-medium">Where it is lost</th>
                <th className="py-2 font-medium">EU strategic</th>
              </tr>
            </thead>
            <tbody>
              {COMMODITIES.map((c) => (
                <tr key={c.id} className="border-b border-hairline align-top">
                  <td className="py-3 pr-4">
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-[0.78rem] text-shale">{c.route}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="h-2 w-full bg-limestone">
                      <div className={cx("h-2 bg-fresh", PRESSURE_WIDTH[c.pressure])} />
                    </div>
                    <div className="mt-1 text-[0.78rem]">{c.pressure}</div>
                  </td>
                  <td className="py-3 pr-4 leading-relaxed text-shale">{c.drivers}</td>
                  <td className="py-3 pr-4 leading-relaxed text-shale">{c.mainLosses}</td>
                  <td className="py-3">{c.euStrategic ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[0.78rem] leading-relaxed text-shale">
          Qualitative and indicative, meant to explain the drivers rather than rank materials. Check the current CRMA strategic list and published
          water-footprint studies before quoting.
        </p>
      </section>

      {/* From this dataset */}
      {siteRows.length > 0 && (
        <section aria-labelledby="sites-k" className="mt-12">
          <h2 id="sites-k" className="text-[1.2rem] font-semibold">In this dataset: freshwater per 1,000 oz gold-equivalent</h2>
          <ul className="mt-4 space-y-3">
            {siteRows.map(({ s, k }) => (
              <li key={s.id} className={cx("grid grid-cols-[9rem_1fr_6rem] items-center gap-4", selected && selected !== s.id && "opacity-45")}>
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-[0.75rem] text-shale">{s.commodity.join(" and ")}</div>
                </div>
                <div>
                  <div className="h-3 bg-limestone">
                    <div className="h-3 bg-fresh" style={{ width: `${((k ?? 0) / maxK) * 100}%` }} />
                  </div>
                  <div className="mt-1 text-[0.75rem] text-shale">{s.processRoute}</div>
                </div>
                <div className="num text-right font-semibold">{n0(k)} ML</div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
