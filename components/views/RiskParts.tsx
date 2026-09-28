"use client";

import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cx, n0 } from "@/lib/format";
import { YEARS, type Reconciled, type SimResult } from "@/lib/risk";

export const Assumed = () => (
  <span className="ml-1.5 rounded-sm border border-ochre/40 px-1 py-px align-middle text-[0.66rem] font-medium uppercase tracking-wide text-ochre">assumption</span>
);

export const usd = (m: number) => `$${n0(m, m < 10 ? 1 : 0)}m`;

export function Slider(props: {
  label: string; value: number; display: string; min: number; max: number; step: number; onChange: (v: number) => void; hint?: string; assumed?: boolean;
}) {
  return (
    <label className="block text-[0.88rem]">
      <span className="flex items-baseline justify-between gap-3 font-medium">
        <span>{props.label}{props.assumed !== false && <Assumed />}</span>
        <span className="num cond text-[1.4rem] font-bold text-fresh">{props.display}</span>
      </span>
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))} className="mt-1 w-full" />
      {props.hint && <span className="mt-1 block text-[0.78rem] text-shale">{props.hint}</span>}
    </label>
  );
}

export function NumberField({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-[0.82rem]">
      <span className="block font-medium">{label}<Assumed /></span>
      <input type="number" min={0} step={step} value={value} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="num mt-1 w-full rounded-sm border border-hairline bg-paper px-2 py-1" />
    </label>
  );
}

export function Kpi({ big, label, sub, tone = "neutral" }: { big: string; label: string; sub?: string; tone?: "bad" | "good" | "neutral" }) {
  return (
    <div>
      <div className={cx("num cond text-[2.2rem] font-bold leading-none", tone === "bad" ? "text-oxide" : tone === "good" ? "text-verdigris" : "text-basalt")}>{big}</div>
      <div className="mt-1.5 text-[0.82rem] font-medium leading-snug">{label}</div>
      {sub && <div className="mt-0.5 text-[0.75rem] leading-snug text-shale">{sub}</div>}
    </div>
  );
}

export const STATUS: Record<Reconciled["status"], { label: string; cls: string }> = {
  agree: { label: "Sources agree", cls: "border-verdigris text-verdigris" },
  tension: { label: "Sources in tension", cls: "border-ochre text-ochre" },
  conflict: { label: "Sources conflict", cls: "border-oxide text-oxide" },
  single: { label: "Only one source", cls: "border-ochre text-ochre" },
};

/** Dot-and-whisker plot: each source with its 95% range, plus the fused estimate. */
export function RecChart({ rc }: { rc: Reconciled }) {
  const rows = [
    ...rc.src.map((x) => ({ label: x.label, v: x.v, lo: x.v * (1 - 1.96 * x.sd), hi: x.v * (1 + 1.96 * x.sd), use: x.use, fused: false, note: x.note })),
    { label: "Reconciled", v: rc.f, lo: rc.f - 1.96 * rc.sf, hi: rc.f + 1.96 * rc.sf, use: true, fused: true, note: "precision-weighted" },
  ];
  const max = Math.max(...rows.map((r) => r.hi)) * 1.05;
  const min = Math.max(0, Math.min(...rows.map((r) => r.lo)) * 0.9);
  const x = (v: number) => `${((Math.max(min, v) - min) / (max - min)) * 100}%`;
  const w = (a: number, b: number) => `${((Math.min(max, b) - Math.max(min, a)) / (max - min)) * 100}%`;
  const fusedLo = rc.f - 1.96 * rc.sf, fusedHi = rc.f + 1.96 * rc.sf;
  return (
    <div className="text-[0.82rem]" role="img" aria-label="Each source with its 95% range and the reconciled estimate">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[9.5rem_1fr_6.5rem] items-center gap-3 py-2">
          <div className={cx("text-right", r.fused ? "font-semibold" : !r.use && "text-shale")}>
            {r.label}
            {!r.use && <div className="text-[0.7rem] text-shale">not counted</div>}
          </div>
          <div className="relative h-5" title={`${n0(r.v)} ML, 95% range ${n0(r.lo)}–${n0(r.hi)}. ${r.note}`}>
            <div className="absolute inset-y-0 bg-leaf/10" style={{ left: x(fusedLo), width: w(fusedLo, fusedHi) }} />
            <div className={cx("absolute top-1/2 -translate-y-1/2 rounded-full", r.fused ? "h-1 bg-leaf" : r.use ? "h-0.5 bg-basalt" : "h-0.5 bg-shale/50")}
              style={{ left: x(r.lo), width: w(r.lo, r.hi) }} />
            <div className={cx("absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper", r.fused ? "h-3.5 w-3.5 bg-leaf" : r.use ? "h-3 w-3 bg-basalt" : "h-3 w-3 bg-paper outline outline-1 outline-shale")}
              style={{ left: x(r.v) }} />
          </div>
          <div className="num text-right">{n0(r.v)} ML</div>
        </div>
      ))}
      <div className="grid grid-cols-[9.5rem_1fr_6.5rem] gap-3 text-[0.72rem] text-shale">
        <div />
        <div className="flex justify-between"><span>{n0(min)}</span><span>{n0(max)} ML/yr</span></div>
        <div />
      </div>
    </div>
  );
}

/** P5–P95 bands of freshwater needed vs available, with medians. */
export function BandChart({ R, showCut, showAlt }: { R: SimResult; showCut: boolean; showAlt: boolean }) {
  const b = R.bands, avail = showAlt ? b.aL : b.aB;
  const data = YEARS.map((y, i) => ({
    year: y === 2020 ? "FY20" : String(y),
    needBand: [b.dB[i][0], b.dB[i][2]],
    need: b.dB[i][1],
    availBand: [avail[i][0], avail[i][2]],
    avail: avail[i][1],
    fix: showCut ? b.dL[i][1] : undefined,
  }));
  const tick = { fontSize: 12, fill: "var(--color-shale)" };
  const fmt = (v: unknown) => (Array.isArray(v) ? `${n0(Number(v[0]))} – ${n0(Number(v[1]))} ML` : `${n0(Number(v))} ML`);
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ left: 8, right: 16, top: 12 }}>
          <CartesianGrid vertical={false} stroke="var(--color-hairline)" />
          <XAxis dataKey="year" tick={tick} axisLine={false} tickLine={false} />
          <YAxis tick={tick} axisLine={false} tickLine={false} width={64} tickFormatter={(v) => n0(v)}
            label={{ value: "ML/yr", position: "insideTopLeft", offset: -6, fontSize: 11, fill: "var(--color-shale)" }} />
          <Tooltip formatter={fmt} contentStyle={{ fontSize: 12, borderRadius: 2 }} />
          <Area isAnimationActive={false} dataKey="availBand" name="Available, 5–95%" fill="var(--color-ochre)" fillOpacity={0.14} stroke="none" />
          <Area isAnimationActive={false} dataKey="needBand" name="Needed, 5–95%" fill="var(--color-fresh)" fillOpacity={0.16} stroke="none" />
          <Line isAnimationActive={false} dataKey="avail" name="Available (median)" stroke="var(--color-ochre)" strokeWidth={2.2} dot={false} />
          <Line isAnimationActive={false} dataKey="need" name="Needed (median)" stroke="var(--color-fresh)" strokeWidth={2.2} dot={false} />
          {showCut && <Line isAnimationActive={false} dataKey="fix" name="Needed with the cut (median)" stroke="var(--color-leaf)" strokeWidth={2.2} strokeDasharray="6 4" dot={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Legend({ showCut }: { showCut: boolean }) {
  const item = (cls: string, label: string, dashed = false) => (
    <span className="inline-flex items-center gap-1.5">
      <span className={cx("inline-block w-5 border-t-2", cls, dashed && "border-dashed")} />{label}
    </span>
  );
  return (
    <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[0.78rem] text-shale">
      {item("border-fresh", "Freshwater needed (median line, shaded 5–95%)")}
      {item("border-ochre", "Freshwater available (median line, shaded 5–95%)")}
      {showCut && item("border-leaf", "Needed with the cut from step 3", true)}
    </div>
  );
}
