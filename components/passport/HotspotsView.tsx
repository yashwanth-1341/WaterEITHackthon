"use client";

// Hotspot view: bubble scatter chart (consumption × basin stress) + ranked list.
// Ported from 02-mining-water-reporting/prototype/js/app.js (initHotspots).
import { useMemo, useState } from "react";
import { CartesianGrid, Cell, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { passportsFor, type PassportSet } from "@/lib/passport/data";
import { buildRows, hotspotPoints, summary, type Row } from "./mapHelpers";
import { cx } from "@/lib/format";
import { fmtN, GradeBadge, SetNote, SetToggle, StressDot } from "./ui";
import { STRESS, STRESS_UNKNOWN } from "@/lib/passport/metrics";
import { shortName } from "./cardHelpers";

interface Props {
  initialSet?: PassportSet;
  onOpenCard?: (siteId: string, set: PassportSet) => void;
}

const X_THRESHOLD = 3;   // stress score threshold for "hotspot zone"
const Y_THRESHOLD = 3000; // consumption ML threshold

const tick = { fontSize: 11, fill: "var(--color-shale)" };

export default function HotspotsView({ initialSet = "demo", onOpenCard }: Props) {
  const [set, setSet] = useState<PassportSet>(initialSet);
  const passports = useMemo(() => passportsFor(set), [set]);
  const rows = useMemo(() => buildRows(passports), [passports]);
  const sum = useMemo(() => summary(rows), [rows]);
  const { pts, skipped, useScore } = useMemo(() => hotspotPoints(rows), [rows]);

  const changeSet = (s: PassportSet) => setSet(s);

  // Ranked list: all sites with a consumption figure, sorted by stress-weighted C descending
  const ranked = useMemo(
    () =>
      rows
        .filter((r) => typeof r.k.C === "number" && r.k.C > 0)
        .sort((a, b) => (b.k.stressWeightedC || 0) - (a.k.stressWeightedC || 0)),
    [rows]
  );
  const maxSwc = ranked[0]?.k.stressWeightedC || 1;

  const xLabel = useScore
    ? "Basin baseline water stress score (0–5, WRI Aqueduct)"
    : "Basin water stress (rank 0 = unknown, 5 = extremely high / arid)";

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.6rem] font-semibold tracking-tight">Hotspot map</h1>
          <p className="mt-2 max-w-3xl text-[0.95rem] leading-relaxed text-shale">
            Sites in the top-right corner — high consumption in high-stress basins — are where regulators, buyers and researchers should look first.
            {skipped > 0 && ` ${skipped} site${skipped > 1 ? "s" : ""} without a consumption figure are excluded.`}
          </p>
        </div>
        <SetToggle value={set} onChange={changeSet} />
      </div>
      <SetNote set={set} />

      {/* Summary */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SumTile label="Sites shown" value={String(pts.length)} sub={`of ${rows.length} in the data set`} />
        <SumTile label="Hotspots" value={String(pts.filter((p) => p.hot).length)} sub="high stress × ≥ 3,000 ML consumption" tone="bad" />
        <SumTile
          label="High-stress share"
          value={`${Math.round(sum.highStressShare * 100)}%`}
          sub="of total consumption in high or extremely-high stress basins"
          tone={sum.highStressShare > 0.3 ? "bad" : undefined}
        />
        <SumTile label="Open balances" value={String(sum.open + sum.noClose)} sub={`${sum.open} missing a flow · ${sum.noClose} outside ±5%`} />
      </div>

      {/* Bubble chart */}
      <div className="mt-6 rounded-xl border border-hairline bg-white p-5">
        <div className="h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 80, bottom: 40, left: 16 }}>
              <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="2 3" />

              <XAxis
                type="number"
                dataKey="x"
                domain={[0, useScore ? 5.3 : 5.5]}
                label={{ value: xLabel, position: "insideBottom", offset: -28, fontSize: 11, fill: "var(--color-shale)" }}
                tick={tick}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="number"
                dataKey="y"
                scale="log"
                domain={[150, 80000]}
                label={{ value: "Water consumption (ML/yr, log scale)", angle: -90, position: "insideLeft", offset: 12, fontSize: 11, fill: "var(--color-shale)" }}
                tickFormatter={(v: number) => [200, 500, 1000, 2000, 5000, 10000, 20000, 50000].includes(v) ? fmtN(v) : ""}
                tick={tick}
                axisLine={false}
                tickLine={false}
                width={60}
              />

              {/* Hotspot zone background */}
              <ReferenceArea
                x1={X_THRESHOLD}
                x2={useScore ? 5.3 : 5.5}
                y1={Y_THRESHOLD}
                y2={80000}
                fill="rgba(194,52,52,0.07)"
                stroke="none"
              />
              <ReferenceLine x={X_THRESHOLD} stroke="rgba(194,52,52,0.4)" strokeDasharray="4 4" />
              <ReferenceLine y={Y_THRESHOLD} stroke="rgba(194,52,52,0.4)" strokeDasharray="4 4" />

              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const pt = payload[0]?.payload;
                  if (!pt) return null;
                  const row = rows.find((r) => r.id === pt.id);
                  if (!row) return null;
                  return (
                    <div className="rounded-md border border-hairline bg-white px-3 py-2 text-[0.8rem] shadow-md">
                      <div className="font-semibold">{row.p.site.name}</div>
                      <div className="text-shale">{row.p.site.operator} · {row.p.site.country}</div>
                      <div className="mt-1">
                        Consumption <span className="num font-semibold">{fmtN(row.k.C)} ML</span>
                      </div>
                      <div>Stress: {row.k.stress.label}</div>
                      {row.hot && <div className="font-semibold text-oxide">Hotspot</div>}
                    </div>
                  );
                }}
              />

              <Scatter
                data={pts}
                isAnimationActive={false}
              >
                {pts.map((pt, i) => (
                  <Cell
                    key={i}
                    fill={pt.color}
                    fillOpacity={0.82}
                    stroke={pt.hot ? "#86270b" : "#fff"}
                    strokeWidth={pt.hot ? 2 : 1}
                    r={pt.hot ? 9 : 6}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Hotspot zone label + site labels */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.76rem] text-shale">
          <span className="inline-flex items-center gap-1.5 font-semibold text-oxide">
            <span className="inline-block h-3 w-3 rounded-full bg-oxide/30" /> Hotspot zone (stress ≥ 3 × consumption ≥ 3,000 ML)
          </span>
          {[...Object.values(STRESS), STRESS_UNKNOWN].map((s) => (
            <StressDot key={s.label} color={s.color} label={s.label} />
          ))}
        </div>

        {/* Site name labels for hotspots */}
        {pts.filter((p) => p.hot).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {pts.filter((p) => p.hot).map((p) => (
              <span key={p.id} className="rounded-sm bg-oxide/10 px-2 py-0.5 text-[0.76rem] font-medium text-oxide">
                {p.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Ranked list */}
      <div className="mt-8">
        <h2 className="text-[1.05rem] font-semibold">Ranked by stress-weighted consumption</h2>
        <p className="mt-1 text-[0.82rem] text-shale">
          Stress-weighted consumption = consumption × basin stress weight (arid / extremely high = 1.0, high = 0.8, … low = 0.1).
          A higher number means more consumption is at risk.
        </p>
        <ol className="mt-4 space-y-2">
          {ranked.map((r, i) => (
            <li key={r.id} className="flex items-center gap-4 rounded-lg border border-hairline bg-white px-4 py-3">
              <span className="num w-7 shrink-0 text-[0.88rem] font-semibold text-shale">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cx("text-[0.9rem] font-semibold", r.hot ? "text-oxide" : "")}>{shortName(r.p.site.name)}</span>
                  {r.hot && <span className="rounded-sm bg-oxide/10 px-1.5 py-0.5 text-[0.7rem] font-semibold text-oxide">Hotspot</span>}
                  <GradeBadge grade={r.t.grade.g} size="sm" />
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.75rem] text-shale">
                  <span>{(r.p.production.products ?? []).filter((p) => p.commodity !== "other").map((p) => p.commodity).join(", ") || r.p.site.primary_commodity}</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: r.k.stress.color }} />
                    {r.k.stress.label}
                  </span>
                  <span className="num">{fmtN(r.k.C)} ML consumed</span>
                </div>
              </div>
              <div className="flex min-w-[140px] flex-col items-end gap-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-limestone">
                  <div
                    className="h-2 rounded-full"
                    style={{ width: `${Math.round((r.k.stressWeightedC / maxSwc) * 100)}%`, background: r.k.stress.color }}
                  />
                </div>
                <span className="num text-[0.78rem]">{fmtN(r.k.stressWeightedC)} ML-eq</span>
              </div>
              {onOpenCard && (
                <button
                  onClick={() => onOpenCard(r.id, set)}
                  className="shrink-0 rounded-sm border border-hairline px-2 py-1 text-[0.75rem] text-shale hover:border-fresh hover:text-fresh"
                >
                  Card
                </button>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function SumTile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "bad" }) {
  return (
    <div className="rounded-xl border border-hairline bg-white p-4">
      <div className="text-[0.72rem] text-shale">{label}</div>
      <div className={cx("num cond mt-1 text-[1.8rem] font-bold leading-none", tone === "bad" ? "text-oxide" : "text-basalt")}>{value}</div>
      <div className="mt-1 text-[0.72rem] text-shale">{sub}</div>
    </div>
  );
}
