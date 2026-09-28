"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import rawCorpus from "@/lib/data/corpus.json";
import type { Corpus } from "@/lib/corpus/types";
import { Series } from "@/lib/corpus/series";
import { companyProfiles } from "@/lib/corpus/indicators";
import { figureCounts, integritySignals, integrityScore } from "@/lib/corpus/integrity";
import { buildCorpusContext } from "@/lib/corpus/aiContext";
import { cx } from "@/lib/format";
import type { Status } from "../Dashboard";
import TrendsView from "./TrendsView";
import BenchmarkView from "./BenchmarkView";
import GovernmentView from "./GovernmentView";
import IntegrityView from "./IntegrityView";
import ForesightView from "./ForesightView";
import IndustryAskView from "./IndustryAskView";
import SubmissionView from "./SubmissionView";
import MapBasinsView from "../passport/MapBasinsView";
import HotspotsView from "../passport/HotspotsView";
import SupplyChainView from "../passport/SupplyChainView";
import ReportCardView from "../passport/ReportCardView";
import type { PassportSet } from "@/lib/passport/data";

type ViewId =
  | "foresight"
  | "trends"
  | "benchmark"
  | "government"
  | "integrity"
  | "submit"
  | "ask"
  | "passport-explorer"
  | "passport-hotspots"
  | "passport-supply"
  | "passport-card";

const corpus = rawCorpus as Corpus;

const PASSPORT_VIEWS: ViewId[] = ["passport-explorer", "passport-hotspots", "passport-supply", "passport-card"];
const ALL_VIEWS: ViewId[] = ["foresight", "trends", "benchmark", "government", "integrity", "submit", "ask", ...PASSPORT_VIEWS];

export default function IndustryDashboard() {
  const [view, setView] = useState<ViewId>("foresight");
  const [company, setCompany] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ ai: false, model: "", supabase: false });
  const [passportSet, setPassportSet] = useState<PassportSet>("demo");
  const [passportCardId, setPassportCardId] = useState<string | null>(null);

  const openCard = (siteId: string, set: PassportSet) => {
    setPassportCardId(siteId);
    setPassportSet(set);
    setView("passport-card");
  };

  // Deep links: /explore?view=integrity&company=Teck%20Resources
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const v = q.get("view") as ViewId | null;
    if (v && ALL_VIEWS.includes(v)) setView(v);
    const c = q.get("company");
    if (c && corpus.companies.includes(c)) setCompany(c);
  }, []);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => undefined);
  }, []);

  const series = useMemo(() => new Series(corpus), []);
  const profiles = useMemo(() => companyProfiles(corpus, series), [series]);
  const signals = useMemo(() => integritySignals(corpus), []);
  const counts = useMemo(() => figureCounts(corpus), []);
  const aiContext = useMemo(() => buildCorpusContext({ corpus, profiles, signals, company }), [profiles, signals, company]);

  const highSignals = (company ? signals.filter((s) => s.company === company) : signals).filter((s) => s.severity === "high").length;
  const years = corpus.records.map((r) => r.year);

  const views: { id: ViewId; label: string; badge?: number; group?: string }[] = [
    { id: "foresight", label: "Foresight" },
    { id: "trends", label: "Trends" },
    { id: "benchmark", label: "Peer benchmark" },
    { id: "government", label: "Regulators" },
    { id: "integrity", label: "Data integrity", badge: highSignals },
    { id: "submit", label: "Analyse a submission" },
    { id: "ask", label: "Ask the data" },
    { id: "passport-explorer", label: "Site explorer", group: "passport" },
    { id: "passport-hotspots", label: "Hotspots", group: "passport" },
    { id: "passport-supply", label: "Supply chain", group: "passport" },
    { id: "passport-card", label: "Report card", group: "passport" },
  ];

  return (
    <div className="grid min-h-screen grid-cols-[17.5rem_1fr]">
      <aside className="flex flex-col border-r border-hairline bg-limestone">
        <div className="px-5 pt-6 pb-4">
          <Link href="/" className="text-[1.35rem] font-bold tracking-tight semi-cond hover:text-fresh">
            AquaTrace
          </Link>
          <p className="mt-1 text-[0.8rem] leading-snug text-shale">Mine water intelligence across companies</p>
          <div className="mt-3 flex gap-1 text-[0.78rem]" role="tablist" aria-label="Mode">
            <span className="rounded-sm bg-basalt px-2 py-1 font-medium text-white">Industry</span>
            <Link href="/ledger" className="rounded-sm border border-hairline px-2 py-1 hover:border-shale">
              Site ledger
            </Link>
          </div>
        </div>

        <div className="border-t border-hairline px-5 py-4 text-[0.78rem] leading-snug text-shale">
          <span className="num font-semibold text-basalt">{corpus.companies.length}</span> companies,{" "}
          <span className="num font-semibold text-basalt">{corpus.files.filter((f) => f.relevant).length}</span> reports,{" "}
          <span className="num font-semibold text-basalt">{corpus.records.length.toLocaleString("en-US")}</span> figures, {Math.min(...years)}–{Math.max(...years)}. Every figure traced to its page or cell.
        </div>

        <nav aria-label="Companies" className="flex-1 overflow-y-auto border-t border-hairline py-2">
          <button
            onClick={() => setCompany(null)}
            className={cx("block w-full px-5 py-2 text-left text-[0.85rem]", company === null ? "bg-paper font-semibold" : "text-shale hover:bg-paper/60")}
          >
            All companies
          </button>
          {[...profiles]
            .sort((a, b) => a.company.localeCompare(b.company))
            .map((p) => {
              const sc = integrityScore(signals, p.company, counts.get(p.company) ?? 0);
              return (
                <button
                  key={p.company}
                  onClick={() => setCompany(company === p.company ? null : p.company)}
                  aria-pressed={company === p.company}
                  className={cx("block w-full px-5 py-2.5 text-left", company === p.company ? "bg-paper" : "hover:bg-paper/60")}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[0.9rem] font-semibold">{p.company}</span>
                    <span className={cx("num text-[0.72rem]", sc.high ? "font-semibold text-oxide" : "text-shale")}>{sc.high ? `${sc.high} high` : "ok"}</span>
                  </div>
                  <div className="mt-0.5 text-[0.72rem] text-shale">
                    {p.commodities.slice(0, 3).join(", ") || "–"} · {p.years.length ? `${p.years[0]}–${p.years.at(-1)}` : "no years"}
                  </div>
                </button>
              );
            })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col bg-paper">
        <nav aria-label="Views" className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-hairline bg-paper px-8">
          {views.map((v, i) => (
            <>
              {v.group === "passport" && views[i - 1]?.group !== "passport" && (
                <span key="sep" className="mx-1 my-auto h-5 w-px shrink-0 bg-hairline" aria-hidden />
              )}
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                aria-current={view === v.id ? "page" : undefined}
                className={cx(
                  "relative whitespace-nowrap px-3 py-4 text-[0.9rem]",
                  view === v.id ? "font-semibold text-basalt" : "text-shale hover:text-basalt",
                  v.group === "passport" && "text-[0.85rem]"
                )}
              >
                {v.label}
                {!!v.badge && <span className="num ml-1.5 rounded-sm bg-oxide/10 px-1.5 py-0.5 text-[0.72rem] font-semibold text-oxide">{v.badge}</span>}
                {view === v.id && <span className={cx("absolute inset-x-3 bottom-0 h-[3px]", v.group === "passport" ? "bg-ochre" : "bg-fresh")} />}
              </button>
            </>
          ))}
        </nav>
        <main className="flex-1 px-8 py-8">
          {view === "foresight" && <ForesightView corpus={corpus} profiles={profiles} signals={signals} />}
          {view === "trends" && <TrendsView corpus={corpus} profiles={profiles} company={company} setCompany={setCompany} />}
          {view === "benchmark" && <BenchmarkView corpus={corpus} profiles={profiles} signals={signals} company={company} setCompany={setCompany} />}
          {view === "government" && <GovernmentView corpus={corpus} series={series} profiles={profiles} />}
          {view === "integrity" && <IntegrityView corpus={corpus} signals={signals} company={company} supabase={status.supabase} />}
          {view === "submit" && <SubmissionView corpus={corpus} />}
          {view === "ask" && <IndustryAskView context={aiContext} company={company} status={status} />}
          {view === "passport-explorer" && <MapBasinsView onOpenCard={openCard} />}
          {view === "passport-hotspots" && <HotspotsView onOpenCard={openCard} />}
          {view === "passport-supply" && <SupplyChainView onOpenCard={openCard} />}
          {view === "passport-card" && <ReportCardView initialSet={passportSet} initialSiteId={passportCardId} />}
        </main>
      </div>
    </div>
  );
}
