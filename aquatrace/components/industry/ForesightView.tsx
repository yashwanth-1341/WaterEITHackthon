"use client";

import { useMemo, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Corpus } from "@/lib/corpus/types";
import type { CompanyProfile } from "@/lib/corpus/indicators";
import type { Signal } from "@/lib/corpus/integrity";
import { CANVAS, computeFacts, horizonCards, trendStatement, type Intervention } from "@/lib/corpus/foresight";
import { HORIZONS, type HorizonId } from "@/lib/corpus/trends";
import { cx } from "@/lib/format";

interface Props {
  corpus: Corpus;
  profiles: CompanyProfile[];
  signals: Signal[];
}

const STATUS: Record<Intervention["status"], { label: string; cls: string }> = {
  built: { label: "Built", cls: "bg-verdigris text-white" },
  next: { label: "We build next", cls: "bg-fresh text-white" },
  partner: { label: "Needs partners", cls: "border border-shale text-shale" },
};

export default function ForesightView({ corpus, profiles, signals }: Props) {
  const facts = useMemo(() => computeFacts(corpus, profiles, signals), [corpus, profiles, signals]);
  const cards = useMemo(() => horizonCards(facts), [facts]);
  const trend = trendStatement(facts);
  const [active, setActive] = useState<HorizonId>("now");
  const card = cards.find((c) => c.id === active)!;

  // Trend line: "if nothing changes" vs the desired path (withdrawal index falling 3%/yr from now).
  const chart = useMemo(() => {
    const rows = [];
    const g = facts.withdrawalChange ?? 0;
    for (let y = facts.baseYear; y <= HORIZONS[3].year; y++) {
      const expected = 100 * (1 + g) ** (y - facts.baseYear);
      const atNow = 100 * (1 + g) ** (HORIZONS[0].year - facts.baseYear);
      const desired = y <= HORIZONS[0].year ? expected : atNow * 0.97 ** (y - HORIZONS[0].year);
      rows.push({ year: y, expected, desired, gap: [Math.min(expected, desired), Math.max(expected, desired)] as [number, number] });
    }
    return rows;
  }, [facts]);

  return (
    <div className="max-w-6xl">
      <p className="text-[0.78rem] font-semibold uppercase tracking-wide text-fresh">Market foresight canvas · Trend: {CANVAS.trend}</p>
      <h1 className="mt-1 text-[1.6rem] font-semibold leading-tight tracking-tight">{trend.headline}</h1>
      <p className="mt-3 max-w-4xl text-[0.95rem] leading-relaxed">{trend.body}</p>
      <p className="mt-2 max-w-4xl text-[0.85rem] leading-relaxed text-shale">{CANVAS.vertical}</p>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {CANVAS.drivers.map((d) => (
          <div key={d.title} className="rounded-md border border-hairline bg-white px-4 py-3">
            <div className="text-[0.72rem] font-semibold uppercase tracking-wide text-shale">Driver</div>
            <div className="text-[0.95rem] font-semibold">{d.title}</div>
            <p className="mt-0.5 text-[0.82rem] leading-relaxed text-shale">{d.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 border-y border-hairline py-5 sm:grid-cols-4">
        <Stat big={facts.withdrawalChange === null ? "–" : `${facts.withdrawalChange >= 0 ? "+" : ""}${(facts.withdrawalChange * 100).toFixed(1)}%`} label="median annual change in disclosed withdrawal" tone="bad" />
        <Stat big={facts.reuseLatestMedian === null ? "–" : `${facts.reuseLatestMedian.toFixed(0)}%`} label={`median reuse share, ${facts.reuseChangePts === null ? "–" : `${facts.reuseChangePts >= 0 ? "+" : ""}${facts.reuseChangePts.toFixed(1)}`} pts a year`} tone="neutral" />
        <Stat big={`${facts.stressDisclosed}/${facts.companies}`} label="disclose withdrawal in water-stressed areas" tone="bad" />
        <Stat big={`${facts.companiesWithHigh}/${facts.companies}`} label="companies with at least one figure failing a consistency check" tone="bad" />
      </div>

      {/* Trend line with horizons */}
      <div className="mt-6 flex items-baseline justify-between gap-4">
        <h2 className="text-[1.05rem] font-semibold">Industry withdrawal index ({facts.baseYear} = 100)</h2>
        <div className="flex gap-4 text-[0.78rem] text-shale">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-[3px] w-5 bg-oxide" /> If nothing changes (median trend)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-[3px] w-5 bg-verdigris" /> Desired: −3% a year from now
          </span>
        </div>
      </div>
      <div className="mt-2 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chart} margin={{ left: 8, right: 40, top: 20 }}>
            <CartesianGrid vertical={false} stroke="var(--color-hairline)" />
            <XAxis dataKey="year" type="number" domain={["dataMin", "dataMax"]} allowDecimals={false} tick={{ fontSize: 12, fill: "var(--color-shale)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "var(--color-shale)" }} axisLine={false} tickLine={false} width={44} />
            <Tooltip formatter={(v) => (Array.isArray(v) ? null : Number(v).toFixed(0))} contentStyle={{ fontSize: 12, borderRadius: 2 }} />
            <Area dataKey="gap" fill="var(--color-ochre)" fillOpacity={0.12} stroke="none" isAnimationActive={false} />
            <Line isAnimationActive={false} dataKey="expected" name="If nothing changes" stroke="var(--color-oxide)" strokeWidth={2.5} dot={false} />
            <Line isAnimationActive={false} dataKey="desired" name="Desired" stroke="var(--color-verdigris)" strokeWidth={2.5} dot={false} />
            {CANVAS.milestones.map((m) => (
              <ReferenceLine key={m.year} x={m.year} stroke="var(--color-leaf)" strokeDasharray="2 3" label={{ value: `${m.year}`, fontSize: 10, fill: "var(--color-leaf)", position: "insideBottomRight" }} />
            ))}
            {HORIZONS.map((h) => (
              <ReferenceLine
                key={h.id}
                x={h.year}
                stroke={active === h.id ? "var(--color-fresh)" : "var(--color-hairline)"}
                strokeWidth={active === h.id ? 2 : 1}
                label={{ value: h.label, fontSize: 11, fill: active === h.id ? "var(--color-fresh)" : "var(--color-shale)", position: "top" }}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ol className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[0.8rem]" aria-label="Observed and expected milestones">
        {CANVAS.milestones.map((m) => (
          <li key={m.year} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-0 border-l-2 border-dashed border-leaf" aria-hidden />
            <span className="num font-semibold text-leaf">{m.year}</span> {m.text}
          </li>
        ))}
      </ol>
      <p className="mt-1 text-[0.75rem] text-shale">
        The shaded gap is what the interventions have to close. The median trend comes from {facts.withdrawalCompanies} companies with three or more
        disclosed years and includes acquisitions and method changes. Treat it as a direction, not a number to plan with.
      </p>

      {/* Horizon selector */}
      <div className="mt-8 grid grid-cols-4 gap-1" role="tablist" aria-label="Horizon">
        {cards.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={active === c.id}
            onClick={() => setActive(c.id)}
            className={cx("rounded-sm border px-3 py-2.5 text-left", active === c.id ? "border-fresh bg-fresh text-white" : "border-hairline hover:border-shale")}
          >
            <span className="block text-[0.95rem] font-semibold">{c.label}</span>
            <span className={cx("num block text-[0.75rem]", active === c.id ? "text-white/80" : "text-shale")}>{c.year}</span>
            <span className={cx("mt-1 block text-[0.78rem] leading-snug", active === c.id ? "text-white" : "text-basalt")}>{c.event}</span>
          </button>
        ))}
      </div>

      <section className="mt-6" role="tabpanel" aria-label={card.label}>
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="text-[0.78rem] font-semibold uppercase tracking-wide text-oxide">Expected trend if nothing changes · {card.event}</h3>
            <p className="mt-2 text-[0.92rem] leading-relaxed">{card.expected}</p>
          </div>
          <div>
            <h3 className="text-[0.78rem] font-semibold uppercase tracking-wide text-verdigris">Desired future</h3>
            <p className="mt-2 text-[0.92rem] leading-relaxed">{card.desired}</p>
          </div>
        </div>

        <h3 className="mt-8 text-[0.78rem] font-semibold uppercase tracking-wide text-shale">Market consequences if the trend unfolds as expected</h3>
        <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["Market", card.consequences.market],
              ["Industry", card.consequences.industry],
              ["Customers", card.consequences.customers],
              ["Business model", card.consequences.businessModel],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="border-t-2 border-basalt pt-2">
              <div className="text-[0.88rem] font-semibold">{k}</div>
              <p className="mt-1 text-[0.84rem] leading-relaxed text-shale">{v}</p>
            </div>
          ))}
        </div>

        <h3 className="mt-8 text-[0.78rem] font-semibold uppercase tracking-wide text-fresh">Interventions: what we as developers do at {card.label.toLowerCase()}</h3>
        <ol className="mt-3 divide-y divide-hairline border-y border-hairline">
          {card.interventions.map((iv) => (
            <li key={iv.action} className="grid gap-2 py-3 sm:grid-cols-[9rem_1fr]">
              <span className={cx("h-fit w-fit rounded-sm px-2 py-0.5 text-[0.72rem] font-semibold", STATUS[iv.status].cls)}>{STATUS[iv.status].label}</span>
              <div>
                <div className="text-[0.92rem] font-semibold">{iv.action}</div>
                <p className="mt-0.5 text-[0.84rem] leading-relaxed text-shale">{iv.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-6 max-w-4xl text-[0.75rem] leading-relaxed text-shale">
        The numbers are computed from the disclosed figures in this app and update when the data does. The consequences, desired future and
        interventions are analysis built on those numbers. References to regulation (ESRS E3, ISSB/SASB EM-MM-140a, the EU Battery Regulation, Chile&apos;s
        2022 water code reform) describe direction, not legal advice; check current status before relying on them.
      </p>
    </div>
  );
}

function Stat({ big, label, tone }: { big: string; label: string; tone: "good" | "bad" | "neutral" }) {
  return (
    <div>
      <div className={cx("num cond text-[2.2rem] font-bold leading-none", tone === "bad" ? "text-oxide" : tone === "good" ? "text-verdigris" : "text-basalt")}>{big}</div>
      <div className="mt-1.5 text-[0.8rem] leading-snug text-shale">{label}</div>
    </div>
  );
}
