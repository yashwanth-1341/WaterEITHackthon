"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Corpus } from "@/lib/corpus/types";
import { LUTTER_CITATION, LUTTER_DOI, lutterTotals, modelComparisons } from "@/lib/research/lutter";
import { cx } from "@/lib/format";

const gl = (ml: number) => `${Math.round(ml / 1000).toLocaleString("en-US")} GL`;

/** Independent evidence from the challenge owner's research: modelled water use at 507 copper mines. */
export default function ResearchBenchmark({ corpus, company }: { corpus: Corpus; company: string | null }) {
  const t = useMemo(() => lutterTotals(), []);
  const rows = useMemo(() => modelComparisons(corpus).filter((r) => !company || r.company === company), [corpus, company]);
  const latest = useMemo(() => {
    // One row per site: the latest year compared.
    const m = new Map<string, (typeof rows)[number]>();
    for (const r of rows) if (!m.has(r.site) || m.get(r.site)!.year < r.year) m.set(r.site, r);
    return [...m.values()].sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
  }, [rows]);
  const independent = latest.filter((r) => !r.sameSource);

  return (
    <section className="mt-10 rounded-xl border border-hairline bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[1.05rem] font-semibold">Independent check: WU Vienna model of {t.mines} copper mines</h2>
        <a href={LUTTER_DOI} target="_blank" rel="noreferrer" className="text-[0.78rem] text-fresh underline underline-offset-2">
          Lutter et al. 2025
        </a>
      </div>
      <p className="mt-1 max-w-3xl text-[0.86rem] leading-relaxed text-shale">
        The challenge owner&apos;s own research estimates water use at copper mines worldwide from production and site data. It tells the same
        story as the reports: freshwater use at copper mines grew {Math.round(t.growth * 100)}% from 2015 to 2019 (
        {Math.round(t.likeForLikeGrowth * 100)}% at the {t.likeForLikeMines} mines modelled every year), about {(t.annual * 100).toFixed(1)}% a
        year across {t.countries} countries.
      </p>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_1.3fr]">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={t.byYear} margin={{ left: 0, right: 8, top: 18 }}>
              <CartesianGrid vertical={false} stroke="var(--color-hairline)" />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: "var(--color-shale)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "var(--color-shale)" }} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => `${Math.round(Number(v) / 1e6 * 10) / 10}M`} />
              <Tooltip formatter={(v) => [gl(Number(v)), "Modelled new water"]} contentStyle={{ fontSize: 12, borderRadius: 4 }} />
              <Bar isAnimationActive={false} dataKey="ml" fill="var(--color-fresh)" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="ml" position="top" formatter={(v) => gl(Number(v))} style={{ fontSize: 11, fill: "var(--color-shale)" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[0.72rem] text-shale">Modelled new (fresh) water at copper mines, ML per year.</p>
        </div>

        <div>
          <h3 className="text-[0.92rem] font-semibold">Reported vs modelled, {company ?? "all companies"}</h3>
          {latest.length === 0 ? (
            <p className="mt-2 text-[0.84rem] text-shale">No site of {company ?? "these companies"} matches a mine in the model (it covers copper mines only).</p>
          ) : (
            <table className="mt-2 w-full text-[0.82rem]">
              <thead>
                <tr className="border-b border-basalt text-left text-[0.74rem] text-shale">
                  <th className="py-1.5 pr-2 font-medium">Site</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Year</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Reported ML</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Model ML</th>
                  <th className="py-1.5 text-right font-medium">Verdict</th>
                </tr>
              </thead>
              <tbody className="num">
                {latest.slice(0, 10).map((r) => {
                  const verdict = r.sameSource ? "same source" : Math.abs(r.z) < 1 ? "agrees" : Math.abs(r.z) < 2 ? "tension" : "conflict";
                  return (
                    <tr key={r.site} className="border-b border-hairline">
                      <td className="py-1.5 pr-2">
                        <span className="font-medium">{r.site}</span> <span className="text-[0.72rem] text-shale">{r.company}</span>
                      </td>
                      <td className="py-1.5 pr-2 text-right">{r.year}</td>
                      <td className="py-1.5 pr-2 text-right">
                        {Math.round(r.reported).toLocaleString("en-US")}
                        <span className="text-[0.68rem] text-shale">{r.reportedMetric === "withdrawal_fresh" ? " fresh" : " total"}</span>
                      </td>
                      <td className="py-1.5 pr-2 text-right">{Math.round(r.modelled).toLocaleString("en-US")}</td>
                      <td className={cx("py-1.5 text-right font-semibold", verdict === "conflict" ? "text-oxide" : verdict === "tension" ? "text-ochre" : verdict === "agrees" ? "text-leaf" : "text-shale")}>{verdict}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-[0.72rem] leading-relaxed text-shale">
            {independent.length} independent comparisons. &quot;Same source&quot; means the model uses the company&apos;s own figure, so it can&apos;t
            confirm it. Model error is about ±35% per mine (R² 0.79); conflicts are listed under Data integrity.
          </p>
        </div>
      </div>
      <p className="mt-3 text-[0.7rem] text-shale">{LUTTER_CITATION}</p>
    </section>
  );
}
