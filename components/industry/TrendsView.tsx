"use client";

import { useMemo, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { HORIZONS, NOW_YEAR } from "@/lib/corpus/trends";
import { INDICATORS, industryTrend, type CompanyProfile, type IndicatorId } from "@/lib/corpus/indicators";
import { cx } from "@/lib/format";
import type { Corpus } from "@/lib/corpus/types";
import ResearchBenchmark from "./ResearchBenchmark";

interface Props {
  corpus: Corpus;
  profiles: CompanyProfile[];
  company: string | null;
  setCompany: (c: string | null) => void;
}

const PALETTE = ["#1f5c7a", "#a33a2a", "#2f7a6b", "#8a5f0f", "#6b4c9a", "#3d7fa0", "#b05f8a", "#4f6168", "#7a8f2f", "#c07a2a", "#0f3b52", "#8db1be", "#5a3a2a", "#2a5a7a", "#9a2f4f"];

const fmtVal = (v: number, pct?: boolean) => (pct ? `${v.toFixed(0)}%` : v >= 100 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : v.toLocaleString("en-US", { maximumFractionDigits: 2 }));
const fmtChange = (c: number, pct?: boolean) => (pct ? `${c >= 0 ? "+" : ""}${(c * 100).toFixed(1)} pts/yr` : `${c >= 0 ? "+" : ""}${(c * 100).toFixed(1)}%/yr`);

export default function TrendsView({ corpus, profiles, company, setCompany }: Props) {
  const [ind, setInd] = useState<IndicatorId>("withdrawal");
  const [indexed, setIndexed] = useState(true);
  const meta = INDICATORS.find((i) => i.id === ind)!;
  const withData = profiles.filter((p) => p.series[ind]?.length);
  const focus = company ? withData.find((p) => p.company === company) : null;
  const industry = industryTrend(profiles, ind);

  // Multi-company chart: history only, optionally indexed to each company's first year = 100 (scopes differ hugely).
  const chart = useMemo(() => {
    const years = new Set<number>();
    withData.forEach((p) => p.series[ind]!.forEach((pt) => years.add(pt.year)));
    return [...years].sort().map((y) => {
      const row: Record<string, number | null> = { year: y };
      for (const p of withData) {
        const pts = p.series[ind]!;
        const pt = pts.find((x) => x.year === y);
        row[p.company] = pt ? (indexed && !meta.pct ? (100 * pt.value) / pts[0].value : pt.value) : null;
      }
      return row;
    });
  }, [withData, ind, indexed, meta.pct]);

  // Single-company chart: history + projection band to +10 years.
  const projection = useMemo(() => {
    if (!focus) return [];
    const t = focus.trends[ind];
    const pts = focus.series[ind]!;
    const rows: { year: number; reported?: number; mid?: number; band?: [number, number] }[] = pts.map((p) => ({ year: p.year, reported: p.value }));
    if (t) {
      const last = rows[rows.length - 1];
      last.mid = last.reported;
      last.band = [last.reported!, last.reported!];
      for (let y = t.lastYear + 1; y <= HORIZONS[3].year; y++) {
        const pr = t.project(y);
        rows.push({ year: y, mid: pr.mid, band: [pr.low, pr.high] });
      }
    }
    return rows;
  }, [focus, ind]);

  return (
    <div className="max-w-6xl">
      <h1 className="text-[1.6rem] font-semibold tracking-tight">Where is the industry&apos;s water heading?</h1>
      <p className="mt-2 max-w-3xl text-[0.95rem] leading-relaxed text-shale">
        Disclosed history for every company, fitted as a constant annual rate and carried forward to {HORIZONS.map((h) => h.year).join(", ")}. The
        projection is what happens if nothing changes. It is not a forecast of what companies plan.
      </p>

      <div className="mt-5 flex flex-wrap gap-1.5" role="group" aria-label="Indicator">
        {INDICATORS.map((i) => {
          const n = profiles.filter((p) => p.series[i.id]?.length).length;
          return (
            <button
              key={i.id}
              onClick={() => setInd(i.id)}
              aria-pressed={ind === i.id}
              disabled={n === 0}
              className={cx("rounded-sm border px-3 py-1.5 text-left text-[0.82rem] disabled:opacity-40", ind === i.id ? "border-fresh bg-fresh text-white" : "border-hairline hover:border-shale")}
            >
              {i.label} <span className={cx("num text-[0.72rem]", ind === i.id ? "text-white/75" : "text-shale")}>{n}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[0.82rem] text-shale">{meta.explain}</p>

      {/* Industry headline */}
      <div className="mt-6 grid gap-6 border-y border-hairline py-5 sm:grid-cols-3">
        <Headline
          big={industry.medianChange === null ? "–" : fmtChange(industry.medianChange, meta.pct)}
          label={`median trend across ${industry.companies} companies with 3+ years`}
          tone={industry.medianChange === null ? "neutral" : (meta.better === "down") === industry.medianChange < 0 ? "good" : "bad"}
        />
        <Headline big={`${industry.improving}/${industry.companies}`} label={`companies moving the right way (${meta.better === "down" ? "falling" : "rising"})`} tone="neutral" />
        <Headline
          big={focus?.trends[ind] ? fmtChange(focus.trends[ind]!.annualChange, meta.pct) : `${withData.length}`}
          label={focus ? `${focus.company}, ${focus.trends[ind]?.confidence ?? "no"} confidence (${focus.trends[ind]?.n ?? 0} years)` : "companies disclose this indicator"}
          tone="neutral"
        />
      </div>

      {!focus && (
        <>
          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-[1.05rem] font-semibold">Disclosed history{indexed && !meta.pct ? ", first year = 100" : ` (${meta.unit})`}</h2>
            {!meta.pct && (
              <label className="flex items-center gap-2 text-[0.82rem]">
                <input type="checkbox" checked={indexed} onChange={(e) => setIndexed(e.target.checked)} className="h-4 w-4 accent-fresh" />
                Index to first year (companies differ 1,000-fold in size)
              </label>
            )}
          </div>
          <div className="mt-3 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart} margin={{ left: 8, right: 40, top: 20 }}>
                <CartesianGrid vertical={false} stroke="var(--color-hairline)" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: "var(--color-shale)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "var(--color-shale)" }} axisLine={false} tickLine={false} width={64} tickFormatter={(v) => fmtVal(Number(v), meta.pct)} scale={indexed || meta.pct ? "auto" : "log"} domain={["auto", "auto"]} />
                <Tooltip formatter={(v) => fmtVal(Number(v), meta.pct)} contentStyle={{ fontSize: 12, borderRadius: 2 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {indexed && !meta.pct && <ReferenceLine y={100} stroke="var(--color-shale)" strokeDasharray="3 3" />}
                {withData.map((p, i) => (
                  <Line isAnimationActive={false} key={p.company} dataKey={p.company} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {focus && (
        <>
          <div className="mt-6 flex items-baseline justify-between">
            <h2 className="text-[1.05rem] font-semibold">
              {focus.company}: {meta.label.toLowerCase()} ({meta.unit}), reported and if nothing changes
            </h2>
            <button onClick={() => setCompany(null)} className="text-[0.82rem] text-fresh underline underline-offset-2">
              Compare all companies
            </button>
          </div>
          <div className="mt-3 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={projection} margin={{ left: 8, right: 40, top: 20 }}>
                <CartesianGrid vertical={false} stroke="var(--color-hairline)" />
                <XAxis dataKey="year" type="number" domain={["dataMin", HORIZONS[3].year]} tick={{ fontSize: 12, fill: "var(--color-shale)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis tick={{ fontSize: 12, fill: "var(--color-shale)" }} axisLine={false} tickLine={false} width={70} tickFormatter={(v) => fmtVal(Number(v), meta.pct)} />
                <Tooltip formatter={(v) => (Array.isArray(v) ? `${fmtVal(Number(v[0]), meta.pct)} – ${fmtVal(Number(v[1]), meta.pct)}` : fmtVal(Number(v), meta.pct))} contentStyle={{ fontSize: 12, borderRadius: 2 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area isAnimationActive={false} dataKey="band" name="80% range" fill="var(--color-sea)" fillOpacity={0.35} stroke="none" />
                <Line isAnimationActive={false} dataKey="reported" name="Reported" stroke="var(--color-basalt)" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line isAnimationActive={false} dataKey="mid" name="If nothing changes" stroke="var(--color-fresh)" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                {HORIZONS.map((h) => (
                  <ReferenceLine key={h.id} x={h.year} stroke="var(--color-hairline)" label={{ value: h.label, fontSize: 11, fill: "var(--color-shale)", position: "top" }} />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Projection table */}
      <h2 className="mt-8 text-[1.05rem] font-semibold">Projection at each horizon ({meta.unit})</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-[0.84rem]">
          <thead>
            <tr className="border-b border-basalt text-left text-[0.76rem] text-shale">
              <th className="py-2 pr-3 font-medium">Company</th>
              <th className="py-2 pr-3 text-right font-medium">Last reported</th>
              <th className="py-2 pr-3 text-right font-medium">Trend</th>
              {HORIZONS.map((h) => (
                <th key={h.id} className="py-2 pr-3 text-right font-medium">
                  {h.label} <span className="num">({h.year})</span>
                </th>
              ))}
              <th className="py-2 text-right font-medium">Confidence</th>
            </tr>
          </thead>
          <tbody className="num">
            {withData.map((p) => {
              const t = p.trends[ind];
              const last = p.series[ind]!.at(-1)!;
              const good = t ? (meta.better === "down") === t.annualChange < 0 : null;
              return (
                <tr
                  key={p.company}
                  onClick={() => setCompany(company === p.company ? null : p.company)}
                  className={cx("cursor-pointer border-b border-hairline hover:bg-limestone/60", company && company !== p.company && "opacity-45")}
                >
                  <td className="py-2 pr-3 font-semibold">{p.company}</td>
                  <td className="py-2 pr-3 text-right">
                    {fmtVal(last.value, meta.pct)} <span className="text-[0.72rem] text-shale">{last.year}</span>
                  </td>
                  <td className={cx("py-2 pr-3 text-right font-semibold", good === true && "text-verdigris", good === false && "text-oxide")}>{t ? fmtChange(t.annualChange, meta.pct) : "–"}</td>
                  {HORIZONS.map((h) => {
                    const pr = t?.project(h.year);
                    return (
                      <td key={h.id} className="py-2 pr-3 text-right">
                        {pr ? fmtVal(pr.mid, meta.pct) : "–"}
                        {pr && h.year > NOW_YEAR && <div className="text-[0.68rem] text-shale">{`${fmtVal(pr.low, meta.pct)}–${fmtVal(pr.high, meta.pct)}`}</div>}
                      </td>
                    );
                  })}
                  <td className={cx("py-2 text-right text-[0.78rem]", t?.confidence === "low" ? "text-ochre" : "text-shale")}>{t ? `${t.confidence} (${t.n} yrs)` : "1 year only"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[0.78rem] leading-relaxed text-shale">
        Where a company publishes no total, the sum of its reported sites is used. Scope changes (acquisitions, divestments, closures) move these
        series; they are listed under Data integrity as jumps. Confidence reflects the number of years and how well a constant rate fits them.
      </p>
      <ResearchBenchmark corpus={corpus} company={company} />
    </div>
  );
}

function Headline({ big, label, tone }: { big: string; label: string; tone: "good" | "bad" | "neutral" }) {
  return (
    <div>
      <div className={cx("num cond text-[2.2rem] font-bold leading-none", tone === "bad" ? "text-oxide" : tone === "good" ? "text-verdigris" : "text-basalt")}>{big}</div>
      <div className="mt-1.5 text-[0.82rem] leading-snug text-shale">{label}</div>
    </div>
  );
}
