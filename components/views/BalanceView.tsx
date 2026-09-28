"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Dataset } from "@/lib/types";
import type { Balance } from "@/lib/metrics";
import { freshM3PerTonneOre, freshwaterPerKoz, highQualityWithdrawal, recycledShare, sumKnown, totalWithdrawal } from "@/lib/metrics";
import type { Flag } from "@/lib/validation";
import { cx, ml, n0, pct } from "@/lib/format";
import BalanceStrip from "../BalanceStrip";

interface Props {
  dataset: Dataset;
  balances: Map<string, Balance>;
  flags: Flag[];
  tolerance: number;
  selected: string | null;
  setSelected: (id: string | null) => void;
}

const COLORS = {
  surface: "var(--color-fresh)",
  ground: "var(--color-fresh-2)",
  thirdParty: "var(--color-fresh-3)",
  low: "var(--color-sea)",
};

export default function BalanceView({ dataset, balances, tolerance, selected, setSelected }: Props) {
  const sites = dataset.sites;
  const total = sites.reduce((a, s) => a + (totalWithdrawal(s) ?? sumKnown(s.withdrawal)), 0);
  const fresh = sites.reduce((a, s) => a + (highQualityWithdrawal(s) ?? 0), 0);
  const largest = [...sites].sort((a, b) => (totalWithdrawal(b) ?? 0) - (totalWithdrawal(a) ?? 0))[0];
  const largestShare = largest && total ? (totalWithdrawal(largest) ?? 0) / total : 0;
  const notClosing = sites.filter((s) => balances.get(s.id)?.status !== "closes").length;

  const composition = sites.map((s) => ({
    name: s.name,
    "Surface (high quality)": s.withdrawal?.surface.high ?? 0,
    "Groundwater (high quality)": s.withdrawal?.ground.high ?? 0,
    "Third-party (high quality)": s.withdrawal?.thirdParty.high ?? 0,
    "Low quality, incl. seawater": sumKnown(s.withdrawal, "low"),
  }));

  const history = dataset.history.map((h) => ({
    period: h.period,
    "High quality": h.highQuality ?? 0,
    "Low quality": h.lowQuality ?? 0,
    split: h.lowQuality !== null,
  }));

  return (
    <div className="max-w-6xl">
      {/* Headline: the story in three numbers */}
      <section aria-labelledby="headline" className="max-w-4xl">
        <h1 id="headline" className="text-[1.05rem] font-medium leading-relaxed text-shale">
          <span className="num cond block text-[4.2rem] font-bold leading-[0.95] tracking-tight text-basalt">
            {n0(total)} ML
          </span>
          withdrawn across {sites.length} sites in {dataset.period}, of which {n0(fresh)} ML is high-quality freshwater.
        </h1>
        <div className="mt-6 grid grid-cols-2 gap-8 border-t border-hairline pt-5 sm:max-w-2xl">
          <p className="text-[0.95rem] leading-snug text-shale">
            <span className="num cond block text-[2.6rem] font-bold leading-none text-basalt">{pct(largestShare)}</span>
            of all withdrawal happens at {largest?.name}. Company totals hide where the water actually goes.
          </p>
          <p className="text-[0.95rem] leading-snug text-shale">
            <span className={cx("num cond block text-[2.6rem] font-bold leading-none", notClosing ? "text-oxide" : "text-verdigris")}>
              {notClosing} of {sites.length}
            </span>
            site water balances do not close within {tolerance}%, or cannot be checked at all.
          </p>
        </div>
      </section>

      {/* Balance strips */}
      <section aria-labelledby="strips" className="mt-12">
        <h2 id="strips" className="text-[1.25rem] font-semibold">Does each site&apos;s water add up?</h2>
        <p className="mt-1 max-w-2xl text-[0.9rem] leading-relaxed text-shale">
          Withdrawal should equal discharge plus consumption plus change in storage. The black tick marks the withdrawal; hatched areas are water the
          report cannot account for.
        </p>
        <div className="mt-4 flex flex-wrap gap-5 text-[0.8rem] text-shale">
          <Key color="var(--color-sea)" label="Discharge" />
          <Key color="var(--color-fresh)" label="Consumption" />
          <Key color="var(--color-hairline)" label="Into storage" />
          <span className="flex items-center gap-2">
            <svg width="14" height="14" aria-hidden>
              <defs>
                <pattern id="key-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="4" height="4" fill="#f3dcd6" />
                  <line x1="0" y1="0" x2="0" y2="4" stroke="var(--color-oxide)" strokeWidth="2" />
                </pattern>
              </defs>
              <rect width="14" height="14" fill="url(#key-hatch)" />
            </svg>
            Does not add up
          </span>
        </div>

        <div className="mt-5 divide-y divide-hairline border-y border-hairline">
          {sites.map((s) => {
            const b = balances.get(s.id)!;
            const verdict =
              b.status === "closes"
                ? s.unknownFields.some((f) => f.startsWith("discharge."))
                  ? { t: "Closes, but a discharge is unknown", c: "text-ochre" }
                  : { t: "Closes", c: "text-verdigris" }
                : b.status === "gap"
                  ? { t: `${n0(b.gap)} ML unaccounted for`, c: "text-oxide" }
                  : b.status === "over"
                    ? { t: `${n0(-(b.gap ?? 0))} ML more out than in`, c: "text-oxide" }
                    : { t: "Cannot be checked", c: "text-shale" };
            return (
              <button
                key={s.id}
                onClick={() => setSelected(selected === s.id ? null : s.id)}
                className={cx(
                  "grid w-full grid-cols-[9rem_1fr_13rem] items-center gap-6 py-4 text-left",
                  selected && selected !== s.id && "opacity-45",
                )}
              >
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="num text-[0.8rem] text-shale">{ml(totalWithdrawal(s))}</div>
                </div>
                <BalanceStrip balance={b} id={`main-${s.id}`} />
                <div className={cx("text-[0.9rem] font-medium", verdict.c)}>{verdict.t}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Efficiency ledger */}
      <section aria-labelledby="efficiency" className="mt-12">
        <h2 id="efficiency" className="text-[1.25rem] font-semibold">How efficiently is water used?</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-[0.9rem]">
            <thead>
              <tr className="border-b border-basalt text-left text-[0.8rem] text-shale">
                <th className="py-2 pr-4 font-medium">Site</th>
                <th className="py-2 pr-4 font-medium">Process route</th>
                <th className="py-2 pr-4 text-right font-medium">Freshwater per 1,000 oz Au-eq</th>
                <th className="py-2 pr-4 text-right font-medium">Freshwater per tonne ore</th>
                <th className="py-2 text-right font-medium">Water demand met by recycling</th>
              </tr>
            </thead>
            <tbody className="num">
              {sites.map((s) => (
                <tr key={s.id} className={cx("border-b border-hairline", selected && selected !== s.id && "opacity-45")}>
                  <td className="py-3 pr-4 font-semibold">{s.name}</td>
                  <td className="py-3 pr-4 text-[0.82rem] text-shale">{s.processRoute}</td>
                  <td className="py-3 pr-4 text-right">{freshwaterPerKoz(s) === null ? "–" : `${n0(freshwaterPerKoz(s))} ML`}</td>
                  <td className="py-3 pr-4 text-right">{freshM3PerTonneOre(s) === null ? "–" : `${n0(freshM3PerTonneOre(s), 2)} m³`}</td>
                  <td className="py-3 text-right">{recycledShare(s) === null ? "not disclosed" : pct(recycledShare(s))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[0.78rem] text-shale">
          Gold-equivalent for copper-gold sites uses the report&apos;s own conversion. ICMM does not require intensity metrics because a fair one is
          hard to define across commodities; treat these as a comparison aid, not a ranking.
        </p>
      </section>

      <div className="mt-12 grid gap-10 xl:grid-cols-[3fr_2fr]">
        <section aria-labelledby="composition">
          <h2 id="composition" className="text-[1.25rem] font-semibold">Where the water comes from</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={composition} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--color-hairline)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--color-shale)" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tick={{ fontSize: 12, fill: "var(--color-shale)" }} axisLine={false} tickLine={false} width={44} />
                <Tooltip formatter={(v) => `${n0(Number(v))} ML`} contentStyle={{ fontSize: 12, borderRadius: 2 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Surface (high quality)" stackId="a" fill={COLORS.surface} />
                <Bar dataKey="Groundwater (high quality)" stackId="a" fill={COLORS.ground} />
                <Bar dataKey="Third-party (high quality)" stackId="a" fill={COLORS.thirdParty} />
                <Bar dataKey="Low quality, incl. seawater" stackId="a" fill={COLORS.low} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {history.length > 0 && (
          <section aria-labelledby="history">
            <h2 id="history" className="text-[1.25rem] font-semibold">Company withdrawal over time</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={history} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid vertical={false} stroke="var(--color-hairline)" />
                  <XAxis dataKey="period" tick={{ fontSize: 12, fill: "var(--color-shale)" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tick={{ fontSize: 12, fill: "var(--color-shale)" }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip formatter={(v) => `${n0(Number(v))} ML`} contentStyle={{ fontSize: 12, borderRadius: 2 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="High quality" stackId="h" fill={COLORS.surface} />
                  <Bar dataKey="Low quality" stackId="h" fill={COLORS.low} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {history.some((h) => !h.split) && (
              <p className="mt-2 text-[0.78rem] text-shale">
                {history.filter((h) => !h.split).map((h) => h.period).join(", ")} has no low-quality split, so all of it shows as high quality.
                The drop that follows is partly a change of definition.
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="inline-block h-3.5 w-3.5" style={{ background: color }} />
      {label}
    </span>
  );
}
