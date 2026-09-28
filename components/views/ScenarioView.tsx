"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Dataset, Source } from "@/lib/types";
import { SOURCE_LABEL } from "@/lib/types";
import { DEFAULT_SCENARIO, type ScenarioParams, type SiteScenario } from "@/lib/scenario";
import { cx, n0, pct, usdM } from "@/lib/format";

interface Props {
  dataset: Dataset;
  params: ScenarioParams;
  setParams: (p: ScenarioParams) => void;
  results: SiteScenario[];
  selected: string | null;
}

// Presets follow the Market Foresight Canvas trend line.
const PRESETS: { id: string; label: string; horizon: string; patch: Partial<ScenarioParams> }[] = [
  { id: "now", label: "Today", horizon: "Now", patch: { tariffIncreasePct: 0, reductionPct: 0 } },
  { id: "2y", label: "Tariffs +400%", horizon: "+2 years", patch: { tariffIncreasePct: 400, reductionPct: 0 } },
  { id: "10y", label: "Tariffs +1,000% and a 50% intake cut by law", horizon: "+10 years", patch: { tariffIncreasePct: 1000, reductionPct: 50 } },
];

export default function ScenarioView({ params: p, setParams, results, selected }: Props) {
  const set = (patch: Partial<ScenarioParams>) => setParams({ ...p, ...patch });
  const setPrice = (src: Source, v: number) => set({ price: { ...p.price, [src]: v } });

  const base = results.reduce((a, r) => a + r.baselineCost, 0);
  const scen = results.reduce((a, r) => a + r.scenarioCost, 0);
  const ozAtRisk = results.reduce((a, r) => a + (r.productionAtRiskOz ?? 0), 0);
  const cut = results.reduce((a, r) => a + r.requiredCut, 0);
  const shortfall = results.reduce((a, r) => a + r.shortfall, 0);
  const worst = [...results].sort((a, b) => b.productionAtRiskPct - a.productionAtRiskPct)[0];

  const chart = results.map((r) => ({ name: r.name, "Water cost today": r.baselineCost / 1e6, "Water cost in scenario": r.scenarioCost / 1e6 }));

  return (
    <div className="max-w-6xl">
      <h1 className="text-[1.6rem] font-semibold tracking-tight">What happens when water gets scarce, expensive or regulated?</h1>
      <p className="mt-2 max-w-3xl text-[0.95rem] leading-relaxed text-shale">
        Move the sliders to test tariff rises and a legal cap on freshwater intake. Sites close the gap with extra recycling first, then desalination
        if they are coastal. Whatever is left is water they cannot replace.
      </p>

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Scenario presets">
        {PRESETS.map((pr) => {
          const active = p.tariffIncreasePct === pr.patch.tariffIncreasePct && p.reductionPct === pr.patch.reductionPct;
          return (
            <button
              key={pr.id}
              onClick={() => set(pr.patch)}
              aria-pressed={active}
              className={cx("rounded-sm border px-3 py-2 text-left text-[0.82rem]", active ? "border-fresh bg-fresh text-white" : "border-hairline hover:border-shale")}
            >
              <span className="block font-semibold">{pr.label}</span>
              <span className={cx("block text-[0.75rem]", active ? "text-white/80" : "text-shale")}>{pr.horizon}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[20rem_1fr]">
        {/* Controls */}
        <div className="space-y-7">
          <Slider
            label="Freshwater tariff increase"
            value={p.tariffIncreasePct}
            display={`+${n0(p.tariffIncreasePct)}%`}
            min={0}
            max={1000}
            step={25}
            onChange={(v) => set({ tariffIncreasePct: v })}
          />
          <Scope value={p.tariffScope} onChange={(v) => set({ tariffScope: v })} label="Tariff applies to" />

          <Slider
            label="Legal cut in freshwater intake"
            value={p.reductionPct}
            display={`${p.reductionPct}%`}
            min={0}
            max={80}
            step={5}
            onChange={(v) => set({ reductionPct: v })}
          />
          <Scope value={p.reductionScope} onChange={(v) => set({ reductionScope: v })} label="Cut applies to" />

          <Slider
            label="Consumed water that extra recycling can recover"
            value={p.recoverablePct}
            display={`${p.recoverablePct}%`}
            min={0}
            max={80}
            step={5}
            onChange={(v) => set({ recoverablePct: v })}
            hint="For example with thickened tailings or covered ponds."
          />

          <label className="flex items-center gap-2 text-[0.88rem]">
            <input type="checkbox" checked={p.allowDesal} onChange={(e) => set({ allowDesal: e.target.checked })} className="h-4 w-4 accent-fresh" />
            Coastal sites may use desalination
          </label>

          <details className="border-t border-hairline pt-4">
            <summary className="cursor-pointer text-[0.88rem] font-medium">Price assumptions (USD per m³)</summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {(Object.keys(p.price) as Source[]).map((src) => (
                <NumberField key={src} label={SOURCE_LABEL[src]} value={p.price[src]} onChange={(v) => setPrice(src, v)} />
              ))}
              <NumberField label="Discharge treatment" value={p.dischargeTreatment} onChange={(v) => set({ dischargeTreatment: v })} />
              <NumberField label="Extra recycling" value={p.recyclingCost} onChange={(v) => set({ recyclingCost: v })} />
              <NumberField label="Desalination" value={p.desalCost} onChange={(v) => set({ desalCost: v })} />
            </div>
            <p className="mt-3 text-[0.78rem] leading-relaxed text-shale">Illustrative defaults, not sourced prices. Replace them with site contracts.</p>
            <button onClick={() => setParams(DEFAULT_SCENARIO)} className="mt-3 text-[0.82rem] font-medium text-fresh underline underline-offset-2">
              Reset all assumptions
            </button>
          </details>
        </div>

        {/* Results */}
        <div>
          <div className="grid gap-6 border-y border-hairline py-5 sm:grid-cols-3">
            <Result big={usdM(scen)} label={`annual water cost, against ${usdM(base)} today`} tone={scen > base * 1.5 ? "bad" : "neutral"} />
            <Result big={`${n0(cut)} ML`} label="of freshwater must be replaced to meet the cap" tone="neutral" />
            <Result
              big={`${n0(ozAtRisk)} oz`}
              label={shortfall > 0 ? `gold-equivalent at risk, ${n0(shortfall)} ML cannot be replaced` : "at risk: every site can close its gap"}
              tone={ozAtRisk > 0 ? "bad" : "good"}
            />
          </div>
          {worst && worst.productionAtRiskPct > 0 && (
            <p className="mt-3 text-[0.9rem] leading-relaxed">
              {worst.name} is most exposed: {pct(worst.productionAtRiskPct)} of its output depends on freshwater it could not replace.
            </p>
          )}

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-[0.86rem]">
              <thead>
                <tr className="border-b border-basalt text-left text-[0.78rem] text-shale">
                  <th className="py-2 pr-3 font-medium">Site</th>
                  <th className="py-2 pr-3 text-right font-medium">Cut required</th>
                  <th className="py-2 pr-3 text-right font-medium">By recycling</th>
                  <th className="py-2 pr-3 text-right font-medium">By desalination</th>
                  <th className="py-2 pr-3 text-right font-medium">Cannot replace</th>
                  <th className="py-2 pr-3 text-right font-medium">Cost today</th>
                  <th className="py-2 pr-3 text-right font-medium">Cost in scenario</th>
                  <th className="py-2 text-right font-medium">Output at risk</th>
                </tr>
              </thead>
              <tbody className="num">
                {results.map((r) => (
                  <tr key={r.siteId} className={cx("border-b border-hairline", selected && selected !== r.siteId && "opacity-45")}>
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold">{r.name}</div>
                      <div className="text-[0.72rem] text-shale">
                        {r.inScopeRegulation || r.inScopeTariff ? "in scope" : "out of scope"}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-right">{n0(r.requiredCut)} ML</td>
                    <td className="py-2.5 pr-3 text-right">{n0(r.byRecycling)} ML</td>
                    <td className="py-2.5 pr-3 text-right">{n0(r.byDesal)} ML</td>
                    <td className={cx("py-2.5 pr-3 text-right", r.shortfall > 0 && "font-semibold text-oxide")}>{n0(r.shortfall)} ML</td>
                    <td className="py-2.5 pr-3 text-right">{usdM(r.baselineCost)}</td>
                    <td className="py-2.5 pr-3 text-right">{usdM(r.scenarioCost)}</td>
                    <td className={cx("py-2.5 text-right", r.productionAtRiskPct > 0 && "font-semibold text-oxide")}>
                      {pct(r.productionAtRiskPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--color-hairline)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--color-shale)" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `$${v}M`} tick={{ fontSize: 12, fill: "var(--color-shale)" }} axisLine={false} tickLine={false} width={54} />
                <Tooltip formatter={(v) => `$${Number(v).toFixed(1)}M`} contentStyle={{ fontSize: 12, borderRadius: 2 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Water cost today" fill="var(--color-sea)" />
                <Bar dataKey="Water cost in scenario" fill="var(--color-fresh)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-[0.78rem] leading-relaxed text-shale">
            Simplifications: output at risk assumes production scales with freshwater use; recycling can only recover water that is currently
            consumed; seawater is not subject to the tariff or the cap. Water-stress levels come from the Import view and are assumptions until
            replaced.
          </p>
        </div>
      </div>
    </div>
  );
}

function Slider(props: { label: string; value: number; display: string; min: number; max: number; step: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <label className="block text-[0.88rem]">
      <span className="flex items-baseline justify-between gap-3 font-medium">
        {props.label}
        <span className="num cond text-[1.5rem] font-bold text-fresh">{props.display}</span>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="mt-1 w-full"
      />
      {props.hint && <span className="mt-1 block text-[0.78rem] text-shale">{props.hint}</span>}
    </label>
  );
}

function Scope({ value, onChange, label }: { value: "all" | "stressed"; onChange: (v: "all" | "stressed") => void; label: string }) {
  return (
    <fieldset className="-mt-4">
      <legend className="text-[0.78rem] text-shale">{label}</legend>
      <div className="mt-1 flex gap-1">
        {(["stressed", "all"] as const).map((v) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            aria-pressed={value === v}
            className={cx("rounded-sm border px-2.5 py-1 text-[0.78rem]", value === v ? "border-basalt bg-basalt text-white" : "border-hairline")}
          >
            {v === "stressed" ? "Water-stressed sites" : "All sites"}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="text-[0.78rem]">
      <span className="block text-shale">{label}</span>
      <input
        type="number"
        min={0}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="num mt-1 w-full rounded-sm border border-hairline bg-paper px-2 py-1"
      />
    </label>
  );
}

function Result({ big, label, tone }: { big: string; label: string; tone: "good" | "bad" | "neutral" }) {
  return (
    <div>
      <div className={cx("num cond text-[2.4rem] font-bold leading-none", tone === "bad" ? "text-oxide" : tone === "good" ? "text-verdigris" : "text-basalt")}>
        {big}
      </div>
      <div className="mt-1.5 text-[0.82rem] leading-snug text-shale">{label}</div>
    </div>
  );
}
