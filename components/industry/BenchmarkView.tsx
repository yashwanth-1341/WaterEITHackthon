"use client";

import { useState } from "react";
import { CORE_LABEL, type CompanyProfile, type IndicatorId } from "@/lib/corpus/indicators";
import { integrityScore, type Signal } from "@/lib/corpus/integrity";
import type { Corpus } from "@/lib/corpus/types";
import { cx } from "@/lib/format";

interface Props {
  corpus: Corpus;
  profiles: CompanyProfile[];
  signals: Signal[];
  company: string | null;
  setCompany: (c: string | null) => void;
}

type SortKey = "company" | "disclosure" | "integrity" | IndicatorId;

const num = (v: number | undefined, d = 0) => (v === undefined ? "–" : v.toLocaleString("en-US", { maximumFractionDigits: d }));

export default function BenchmarkView({ corpus, profiles, signals, company, setCompany }: Props) {
  const [sort, setSort] = useState<SortKey>("disclosure");
  const rows = profiles.map((p) => ({ ...p, integrity: integrityScore(signals, p.company, corpus.records.filter((r) => r.company === p.company).length).score }));
  const val = (r: (typeof rows)[number], k: SortKey): number | string =>
    k === "company" ? r.company : k === "disclosure" ? r.disclosure : k === "integrity" ? r.integrity : (r.latest[k] ?? -Infinity);
  const lowerIsBetter: SortKey[] = ["intensity", "stressedShare", "withdrawal", "fresh"];
  const sorted = [...rows].sort((a, b) => {
    const x = val(a, sort);
    const y = val(b, sort);
    if (typeof x === "string") return x.localeCompare(y as string);
    // Put missing values last, best first.
    if (x === -Infinity) return 1;
    if (y === -Infinity) return -1;
    return lowerIsBetter.includes(sort) ? x - (y as number) : (y as number) - x;
  });

  const intensities = rows.map((r) => r.latest.intensity).filter((v): v is number => v !== undefined);
  const best = Math.min(...intensities);
  const coreKeys = Object.keys(CORE_LABEL);

  const Th = ({ k, children, right = true }: { k: SortKey; children: React.ReactNode; right?: boolean }) => (
    <th className={cx("py-2 pr-3 font-medium", right && "text-right")}>
      <button onClick={() => setSort(k)} className={cx("hover:text-basalt", sort === k && "font-semibold text-basalt underline underline-offset-4")}>
        {children}
      </button>
    </th>
  );

  return (
    <div className="max-w-6xl">
      <h1 className="text-[1.6rem] font-semibold tracking-tight">How do the companies compare?</h1>
      <p className="mt-2 max-w-3xl text-[0.95rem] leading-relaxed text-shale">
        What an investor, a metal buyer or a community group would ask first: how much water per tonne, how much is recycled, how much comes from
        stressed basins, how complete the disclosure is and how far the numbers hold up to checks. Click a column to rank, a row to focus.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-[0.84rem]">
          <thead>
            <tr className="border-b border-basalt text-left text-[0.76rem] text-shale">
              <Th k="company" right={false}>
                Company
              </Th>
              <th className="py-2 pr-3 text-right font-medium">Latest year</th>
              <Th k="withdrawal">Withdrawal (ML)</Th>
              <Th k="intensity">m³ per t ore</Th>
              <Th k="reuse">Reuse share</Th>
              <Th k="stressedShare">From stressed areas</Th>
              <Th k="disclosure">Disclosure</Th>
              <Th k="integrity">Integrity</Th>
            </tr>
          </thead>
          <tbody className="num">
            {sorted.map((r) => (
              <tr
                key={r.company}
                onClick={() => setCompany(company === r.company ? null : r.company)}
                className={cx("cursor-pointer border-b border-hairline align-top hover:bg-limestone/60", company && company !== r.company && "opacity-45")}
              >
                <td className="py-2.5 pr-3">
                  <div className="font-semibold">{r.company}</div>
                  <div className="text-[0.72rem] text-shale">
                    {r.sites} site{r.sites === 1 ? "" : "s"} · {r.countries.slice(0, 4).join(", ")}
                    {r.countries.length > 4 ? ` +${r.countries.length - 4}` : ""}
                  </div>
                </td>
                <td className="py-2.5 pr-3 text-right">{r.lastYear ?? "–"}</td>
                <td className="py-2.5 pr-3 text-right">{num(r.latest.withdrawal)}</td>
                <td className={cx("py-2.5 pr-3 text-right", r.latest.intensity === best && "font-semibold text-verdigris")}>{num(r.latest.intensity, 2)}</td>
                <td className="py-2.5 pr-3 text-right">{r.latest.reuse === undefined ? "–" : `${r.latest.reuse.toFixed(0)}%`}</td>
                <td className={cx("py-2.5 pr-3 text-right", (r.latest.stressedShare ?? 0) > 50 && "font-semibold text-oxide")}>
                  {r.latest.stressedShare === undefined ? "–" : `${r.latest.stressedShare.toFixed(0)}%`}
                </td>
                <td className="py-2.5 pr-3 text-right">
                  <div className="flex justify-end gap-[3px]" aria-label={`${Math.round(r.disclosure * 100)}% of core metrics disclosed`}>
                    {coreKeys.map((k) => (
                      <span key={k} title={`${CORE_LABEL[k]}: ${r.disclosed[k] ? "disclosed" : "missing"}`} className={cx("h-3 w-1.5 rounded-[1px]", r.disclosed[k] ? "bg-fresh" : "bg-hairline")} />
                    ))}
                  </div>
                  <div className="mt-0.5 text-[0.72rem] text-shale">{Math.round(r.disclosure * 100)}%</div>
                </td>
                <td className={cx("py-2.5 text-right font-semibold", r.integrity < 60 ? "text-oxide" : r.integrity < 85 ? "text-ochre" : "text-verdigris")}>{r.integrity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-6 text-[0.84rem] leading-relaxed md:grid-cols-3">
        <Note title="Why intensity, not volume">
          A company that grows output will withdraw more water even if it gets more efficient. Water per tonne of ore processed is the fairer peer
          comparison; it still depends on ore type and process route (heap leach and flotation use water very differently).
        </Note>
        <Note title="Disclosure bars">
          One bar per core ICMM metric in the latest year: {coreKeys.map((k) => CORE_LABEL[k].toLowerCase()).join(", ")}. A missing bar is
          a question to put to the company, not proof of poor performance.
        </Note>
        <Note title="Before you rank">
          Fiscal years differ (June year-ends for BHP, Newcrest and Evolution). Some companies report only corporate totals; some changed scope
          through acquisitions. The Data integrity view lists where that matters.
        </Note>
      </div>
    </div>
  );
}

function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-hairline pt-3">
      <div className="font-semibold">{title}</div>
      <p className="mt-1 text-shale">{children}</p>
    </div>
  );
}
