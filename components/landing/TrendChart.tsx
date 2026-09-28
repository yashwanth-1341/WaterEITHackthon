"use client";

import { CartesianGrid, LabelList, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface TrendRow {
  year: number;
  expected: number;
  desired: number;
}

const OXIDE = "var(--color-oxide)";
const LEAF = "var(--color-leaf)";

/** Two series, direct-labelled at the end, one axis, crosshair tooltip. */
export default function TrendChart({ rows, nowYear }: { rows: TrendRow[]; nowYear: number }) {
  const last = rows.at(-1)!;
  const endLabel = (key: "expected" | "desired", color: string) =>
    function EndLabel(props: { x?: unknown; y?: unknown; index?: number }) {
      if (props.index !== rows.length - 1) return null;
      return (
        <text x={Number(props.x) + 8} y={Number(props.y) + 4} fontSize={13} fontWeight={600} fill="var(--color-basalt)">
          <tspan fill={color}>●</tspan> {Math.round(last[key])}
        </text>
      );
    };

  return (
    <figure>
      <div className="h-64 sm:h-72" role="img" aria-label={`Industry water withdrawal index. If nothing changes it reaches ${Math.round(last.expected)} by ${last.year}; on the desired path it falls to ${Math.round(last.desired)}.`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ left: 0, right: 56, top: 12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-hairline)" strokeDasharray="2 4" />
            <XAxis dataKey="year" type="number" domain={["dataMin", "dataMax"]} ticks={[rows[0].year, nowYear, nowYear + 5, nowYear + 10]} tick={{ fontSize: 12, fill: "var(--color-shale)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "var(--color-shale)" }} axisLine={false} tickLine={false} width={36} domain={[60, "auto"]} />
            <Tooltip
              formatter={(v, name) => [Math.round(Number(v)), name]}
              labelFormatter={(y) => `Year ${y}`}
              contentStyle={{ fontSize: 12, borderRadius: 4, border: "1px solid var(--color-hairline)" }}
              cursor={{ stroke: "var(--color-shale)", strokeDasharray: "3 3" }}
            />
            <Legend verticalAlign="top" align="left" height={28} iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine x={nowYear} stroke="var(--color-shale)" strokeDasharray="3 3" label={{ value: "Today", fontSize: 11, fill: "var(--color-shale)", position: "insideTopLeft" }} />
            <Line isAnimationActive={false} name="If nothing changes" dataKey="expected" stroke={OXIDE} strokeWidth={2.5} dot={false}>
              <LabelList content={endLabel("expected", OXIDE)} />
            </Line>
            <Line isAnimationActive={false} name="With action (−3% a year)" dataKey="desired" stroke={LEAF} strokeWidth={2.5} dot={false} strokeDasharray="6 3">
              <LabelList content={endLabel("desired", LEAF)} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 text-[0.8rem] leading-relaxed text-shale">
        Index of water withdrawn by the companies in AquaTrace, latest common year = 100. The red line carries today&apos;s median trend forward;
        the green dashed line is the path if companies cut 3% a year from now.
      </figcaption>
    </figure>
  );
}
