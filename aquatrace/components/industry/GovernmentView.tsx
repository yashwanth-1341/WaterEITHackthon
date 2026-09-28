"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Corpus } from "@/lib/corpus/types";
import type { Series } from "@/lib/corpus/series";
import { countryRows, type CompanyProfile } from "@/lib/corpus/indicators";
import { cx } from "@/lib/format";

interface Props {
  corpus: Corpus;
  series: Series;
  profiles: CompanyProfile[];
}

const n0 = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });

export default function GovernmentView({ corpus, series, profiles }: Props) {
  const rows = useMemo(() => countryRows(corpus, series), [corpus, series]);
  const chart = rows.filter((r) => r.latestWithdrawal > 0).slice(0, 14).map((r) => ({ country: r.country, withdrawal: Math.round(r.latestWithdrawal), fresh: Math.round(r.latestFresh) }));
  const siteLevel = profiles.filter((p) => p.siteLevel).length;
  const noStressFigure = profiles.filter((p) => !p.disclosed["withdrawal_water_stressed"]).map((p) => p.company);
  const noConsumption = profiles.filter((p) => !p.disclosed["consumption_total"]).map((p) => p.company);
  const totalSites = rows.reduce((a, r) => a + r.sites, 0);
  const sitesWithData = rows.reduce((a, r) => a + r.sitesWithData, 0);

  return (
    <div className="max-w-6xl">
      <h1 className="text-[1.6rem] font-semibold tracking-tight">What a regulator can see, and what it can&apos;t</h1>
      <p className="mt-2 max-w-3xl text-[0.95rem] leading-relaxed text-shale">
        Permits and water rights are granted per country and basin, but companies report per company. This view regroups every disclosed site by
        jurisdiction and shows where the public record has holes a permit condition or a reporting rule could close.
      </p>

      <div className="mt-6 grid gap-6 border-y border-hairline py-5 sm:grid-cols-3">
        <Stat big={`${sitesWithData}/${totalSites}`} label="sites with a disclosed site-level withdrawal figure" tone={sitesWithData < totalSites * 0.7 ? "bad" : "neutral"} />
        <Stat big={`${siteLevel}/${profiles.length}`} label="companies report water per site, not only as a company total" tone="neutral" />
        <Stat big={`${noStressFigure.length}`} label="companies give no figure for withdrawal in water-stressed areas in their latest year" tone={noStressFigure.length ? "bad" : "good"} />
      </div>

      <h2 className="mt-8 text-[1.05rem] font-semibold">Latest disclosed withdrawal by country (ML, sum of site figures)</h2>
      <div className="mt-3 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart} margin={{ left: 8, right: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--color-hairline)" />
            <XAxis dataKey="country" tick={{ fontSize: 11, fill: "var(--color-shale)" }} axisLine={false} tickLine={false} interval={0} angle={-25} textAnchor="end" height={56} />
            <YAxis tick={{ fontSize: 12, fill: "var(--color-shale)" }} axisLine={false} tickLine={false} width={70} tickFormatter={(v) => n0(Number(v))} />
            <Tooltip formatter={(v) => `${n0(Number(v))} ML`} contentStyle={{ fontSize: 12, borderRadius: 2 }} />
            <Bar isAnimationActive={false} dataKey="withdrawal" name="Total withdrawal" fill="var(--color-sea)" />
            <Bar isAnimationActive={false} dataKey="fresh" name="Freshwater (where disclosed)" fill="var(--color-fresh)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-[0.84rem]">
          <thead>
            <tr className="border-b border-basalt text-left text-[0.76rem] text-shale">
              <th className="py-2 pr-3 font-medium">Country</th>
              <th className="py-2 pr-3 font-medium">Companies</th>
              <th className="py-2 pr-3 text-right font-medium">Sites</th>
              <th className="py-2 pr-3 text-right font-medium">With data</th>
              <th className="py-2 pr-3 text-right font-medium">Withdrawal (ML)</th>
              <th className="py-2 pr-3 text-right font-medium">Freshwater, where disclosed (ML)</th>
              <th className="py-2 pr-3 text-right font-medium">In stressed areas</th>
              <th className="py-2 text-right font-medium">Incidents · fines (all years)</th>
            </tr>
          </thead>
          <tbody className="num">
            {rows.map((r) => (
              <tr key={r.country} className="border-b border-hairline align-top">
                <td className="py-2 pr-3 font-semibold">{r.country}</td>
                <td className="py-2 pr-3 text-[0.78rem] text-shale">{r.companies.join(", ")}</td>
                <td className="py-2 pr-3 text-right">{r.sites}</td>
                <td className={cx("py-2 pr-3 text-right", r.sitesWithData < r.sites && "text-ochre")}>{r.sitesWithData}</td>
                <td className="py-2 pr-3 text-right">{r.latestWithdrawal ? n0(r.latestWithdrawal) : "–"}</td>
                <td className="py-2 pr-3 text-right">{r.latestFresh ? n0(r.latestFresh) : "–"}</td>
                <td className={cx("py-2 pr-3 text-right", r.stressedSites > 0 && "font-semibold text-oxide")}>{r.stressedSites ? `${r.stressedSites} site${r.stressedSites > 1 ? "s" : ""}` : "–"}</td>
                <td className="py-2 text-right">
                  {r.incidents || r.fines ? `${r.incidents || "–"} · ${r.fines ? `$${n0(r.fines)}` : "–"}` : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-[1.05rem] font-semibold">Gaps a rule could close</h2>
      <ul className="mt-3 space-y-3 text-[0.88rem] leading-relaxed">
        <Gap title="No site-level figure for water-stressed withdrawal">
          {noStressFigure.length ? noStressFigure.join(", ") : "None"}. Without it, a basin authority cannot tell how much of the licensed volume is taken where water is scarcest.
        </Gap>
        <Gap title="No consumption figure">
          {noConsumption.length ? noConsumption.join(", ") : "None"}. Consumption, not withdrawal, is what a basin loses; withdrawal alone overstates impact where water is returned and understates it where evaporation dominates.
        </Gap>
        <Gap title="Company totals only">
          {profiles.filter((p) => !p.siteLevel).map((p) => p.company).join(", ") || "None"}. Company totals across continents are not useful for a basin permit. ESRS E3 (EU) and ICMM already expect site-level data for sites in stressed areas.
        </Gap>
        <Gap title="Restatements without explanation">
          See Data integrity. Figures that change silently between reports make permit baselines unreliable; a rule requiring restatements to be flagged and reasoned costs little.
        </Gap>
      </ul>
      <p className="mt-6 text-[0.78rem] text-shale">
        Country totals only include sites that disclose their own figures; companies reporting only a corporate total are not allocated to countries.
        Stressed-area counts use the company&apos;s own classification or a disclosed stressed-area volume.
      </p>
    </div>
  );
}

function Gap({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="border-l-4 border-ochre pl-3">
      <div className="font-semibold">{title}</div>
      <div className="text-shale">{children}</div>
    </li>
  );
}

function Stat({ big, label, tone }: { big: string; label: string; tone: "good" | "bad" | "neutral" }) {
  return (
    <div>
      <div className={cx("num cond text-[2.4rem] font-bold leading-none", tone === "bad" ? "text-oxide" : tone === "good" ? "text-verdigris" : "text-basalt")}>{big}</div>
      <div className="mt-1.5 text-[0.82rem] leading-snug text-shale">{label}</div>
    </div>
  );
}
