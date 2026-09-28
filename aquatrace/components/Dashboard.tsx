"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import preload from "@/lib/data/newcrest-fy20.json";
import type { Dataset, Site } from "@/lib/types";
import { balanceOf, type Balance } from "@/lib/metrics";
import { validate } from "@/lib/validation";
import { DEFAULT_SCENARIO, runScenario, type ScenarioParams } from "@/lib/scenario";
import { DEFAULT_LEGACY_MAPPING, type LegacyMapping } from "@/lib/importers/legacyGri";
import { readWorkbook } from "@/lib/importers/workbook";
import { cx } from "@/lib/format";
import BalanceStrip from "./BalanceStrip";
import BalanceView from "./views/BalanceView";
import ImportView from "./views/ImportView";
import ChecksView from "./views/ChecksView";
import ScenarioView from "./views/ScenarioView";
import MinedView from "./views/MinedView";
import ReadinessView from "./views/ReadinessView";
import AskView from "./views/AskView";
import SavedPanel from "./SavedPanel";

export type ViewId = "balance" | "import" | "checks" | "scenarios" | "mined" | "readiness" | "ask";

export interface Status {
  ai: boolean;
  model: string;
  supabase: boolean;
}

const SAMPLE_URL = "/samples/newcrest-fy20-gri.xlsx";
const SAMPLE_NAME = "newcrest-fy20-gri.xlsx";

export default function Dashboard() {
  const [dataset, setDataset] = useState<Dataset>(preload as Dataset);
  const [view, setView] = useState<ViewId>("balance");
  const [selected, setSelected] = useState<string | null>(null);
  const [tolerance, setTolerance] = useState(2);
  const [scenario, setScenario] = useState<ScenarioParams>(DEFAULT_SCENARIO);
  const [mapping, setMapping] = useState<LegacyMapping>(DEFAULT_LEGACY_MAPPING);
  const [lastFile, setLastFile] = useState<{ name: string; data: ArrayBuffer; isSample: boolean } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ ai: false, model: "", supabase: false });

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => undefined);
  }, []);

  const balances = useMemo(() => {
    const m = new Map<string, Balance>();
    dataset.sites.forEach((s) => m.set(s.id, balanceOf(s, tolerance)));
    return m;
  }, [dataset, tolerance]);
  const flags = useMemo(() => validate(dataset, tolerance), [dataset, tolerance]);
  const scenarioResults = useMemo(() => runScenario(dataset, scenario), [dataset, scenario]);

  const importBuffer = useCallback(
    (name: string, data: ArrayBuffer, isSample: boolean, map: LegacyMapping, keepContextFrom?: Dataset) => {
      try {
        const res = readWorkbook(data, name, { mapping: map, company: isSample ? "Newcrest Mining" : undefined });
        const ds = res.dataset;
        if (isSample) ds.sourceLabel = "Newcrest 2020 Sustainability Report, GRI supplementary data (FY20 data GRI 300-Environment)";
        // Keep any site context the user already edited (stress level, coastal, method).
        if (keepContextFrom) {
          ds.sites = ds.sites.map((s) => {
            const prev = keepContextFrom.sites.find((p) => p.id === s.id);
            return prev
              ? { ...s, waterStress: prev.waterStress, stressSource: prev.stressSource, coastal: prev.coastal, method: prev.method }
              : s;
          });
        }
        setDataset(ds);
        setLastFile({ name, data, isSample });
        setImportError(null);
        setImportNote(
          res.format === "legacy-gri"
            ? `Read ${ds.sites.length} sites from sheet "${res.sheetName}" and mapped ${ds.mappingLog.length} legacy entries to ICMM 2021.`
            : `Read ${ds.sites.length} sites from the AquaTrace template.`,
        );
        setSelected(null);
      } catch (e) {
        setImportError(e instanceof Error ? e.message : "The file could not be read.");
        setImportNote(null);
      }
    },
    [],
  );

  const importSample = useCallback(async () => {
    const res = await fetch(SAMPLE_URL);
    if (!res.ok) {
      setImportError(`Could not load the sample file (${res.status}).`);
      return;
    }
    importBuffer(SAMPLE_NAME, await res.arrayBuffer(), true, mapping);
  }, [importBuffer, mapping]);

  const importFile = useCallback(
    async (file: File) => importBuffer(file.name, await file.arrayBuffer(), false, mapping),
    [importBuffer, mapping],
  );

  const changeMapping = useCallback(
    async (next: LegacyMapping) => {
      setMapping(next);
      if (lastFile) {
        importBuffer(lastFile.name, lastFile.data, lastFile.isSample, next, dataset);
      } else {
        const res = await fetch(SAMPLE_URL);
        importBuffer(SAMPLE_NAME, await res.arrayBuffer(), true, next, dataset);
      }
    },
    [lastFile, importBuffer, dataset],
  );

  const updateSite = useCallback((id: string, patch: Partial<Site>) => {
    setDataset((ds) => ({ ...ds, sites: ds.sites.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  }, []);

  const loadDataset = useCallback((ds: Dataset) => {
    setDataset(ds);
    setLastFile(null);
    setSelected(null);
    setImportNote(`Opened saved dataset "${ds.company} ${ds.period}".`);
  }, []);

  const failCount = flags.filter((f) => f.severity === "fail").length;
  const warnCount = flags.filter((f) => f.severity === "warn").length;

  const views: { id: ViewId; label: string; badge?: string }[] = [
    { id: "balance", label: "Water balance" },
    { id: "import", label: "Import and mapping" },
    { id: "checks", label: "Checks", badge: `${failCount + warnCount}` },
    { id: "scenarios", label: "Cost and regulation" },
    { id: "mined", label: "What is mined" },
    { id: "readiness", label: "EU readiness" },
    { id: "ask", label: "Ask the data" },
  ];

  const shared = { dataset, balances, flags, tolerance, selected, setSelected };

  return (
    <div className="grid min-h-screen grid-cols-[17.5rem_1fr]">
      {/* Site ledger */}
      <aside className="flex flex-col border-r border-hairline bg-limestone">
        <div className="px-5 pt-6 pb-4">
          <Link href="/" className="text-[1.35rem] font-bold tracking-tight semi-cond hover:text-fresh">
            AquaTrace
          </Link>
          <p className="mt-1 text-[0.8rem] leading-snug text-shale">Site-level water ledger for mining</p>
          <div className="mt-3 flex gap-1 text-[0.78rem]" role="tablist" aria-label="Mode">
            <Link href="/explore" className="rounded-sm border border-hairline px-2 py-1 hover:border-shale">
              Industry
            </Link>
            <span className="rounded-sm bg-basalt px-2 py-1 font-medium text-white">Site ledger</span>
          </div>
        </div>

        <div className="border-t border-hairline px-5 py-4">
          <div className="text-[0.95rem] font-semibold">
            {dataset.company} <span className="font-normal text-shale">{dataset.period}</span>
          </div>
          <p className="mt-1 text-[0.75rem] leading-snug text-shale">{dataset.sourceLabel}</p>
        </div>

        <nav aria-label="Sites" className="flex-1 border-t border-hairline py-2">
          <button
            onClick={() => setSelected(null)}
            className={cx(
              "block w-full px-5 py-2 text-left text-[0.85rem]",
              selected === null ? "bg-paper font-semibold" : "text-shale hover:bg-paper/60",
            )}
          >
            All sites
          </button>
          {dataset.sites.map((s) => {
            const siteFlags = flags.filter((f) => f.siteId === s.id && f.severity !== "info");
            const fails = siteFlags.filter((f) => f.severity === "fail").length;
            return (
              <button
                key={s.id}
                onClick={() => setSelected(selected === s.id ? null : s.id)}
                aria-pressed={selected === s.id}
                className={cx(
                  "block w-full px-5 py-3 text-left",
                  selected === s.id ? "bg-paper" : "hover:bg-paper/60",
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[0.95rem] font-semibold">{s.name}</span>
                  <span className={cx("num text-[0.75rem]", fails ? "text-oxide font-semibold" : "text-shale")}>
                    {siteFlags.length === 0 ? "no issues" : `${siteFlags.length} ${siteFlags.length === 1 ? "issue" : "issues"}`}
                  </span>
                </div>
                <div className="mt-0.5 text-[0.75rem] text-shale">
                  {s.commodity.join(" and ")}, {s.country}
                </div>
                <div className="mt-2">
                  <BalanceStrip balance={balances.get(s.id)!} compact id={`rail-${s.id}`} />
                </div>
              </button>
            );
          })}
        </nav>

        <SavedPanel dataset={dataset} supabase={status.supabase} onOpen={loadDataset} />
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-col bg-paper">
        <nav aria-label="Views" className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-hairline bg-paper px-8">
          {views.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              aria-current={view === v.id ? "page" : undefined}
              className={cx(
                "relative whitespace-nowrap px-3 py-4 text-[0.9rem]",
                view === v.id ? "font-semibold text-basalt" : "text-shale hover:text-basalt",
              )}
            >
              {v.label}
              {v.badge && v.badge !== "0" && (
                <span className="num ml-1.5 rounded-sm bg-oxide/10 px-1.5 py-0.5 text-[0.72rem] font-semibold text-oxide">{v.badge}</span>
              )}
              {view === v.id && <span className="absolute inset-x-3 bottom-0 h-[3px] bg-fresh" />}
            </button>
          ))}
        </nav>

        <main className="flex-1 px-8 py-8">
          {view === "balance" && <BalanceView {...shared} />}
          {view === "import" && (
            <ImportView
              dataset={dataset}
              mapping={mapping}
              onMappingChange={changeMapping}
              onImportSample={importSample}
              onImportFile={importFile}
              onUpdateSite={updateSite}
              error={importError}
              note={importNote}
            />
          )}
          {view === "checks" && <ChecksView {...shared} setTolerance={setTolerance} />}
          {view === "scenarios" && (
            <ScenarioView dataset={dataset} params={scenario} setParams={setScenario} results={scenarioResults} selected={selected} />
          )}
          {view === "mined" && <MinedView dataset={dataset} selected={selected} />}
          {view === "readiness" && <ReadinessView dataset={dataset} tolerance={tolerance} selected={selected} />}
          {view === "ask" && (
            <AskView
              dataset={dataset}
              flags={flags}
              balances={balances}
              scenario={scenario}
              scenarioResults={scenarioResults}
              tolerance={tolerance}
              status={status}
            />
          )}
        </main>
      </div>
    </div>
  );
}
