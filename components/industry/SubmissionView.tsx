"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Corpus } from "@/lib/corpus/types";
import { INDICATORS, type IndicatorId } from "@/lib/corpus/indicators";
import { SIGNAL_LABEL } from "@/lib/corpus/integrity";
import { HORIZONS } from "@/lib/corpus/trends";
import { isSubmissionWorkbook, mergeSubmissions, parseSubmission, type Submission } from "@/lib/submission/format";
import { analyseSubmission, type Analysis } from "@/lib/submission/analyse";
import { cx } from "@/lib/format";

const SAMPLES = {
  andes: { label: "Sample: Andes Ridge Copper", detail: "Fictional copper miner, 2023 and 2024 reports", files: ["andes-ridge-copper-2023.xlsx", "andes-ridge-copper-2024.xlsx"] },
  hudbay: { label: "Hudbay Minerals", detail: "Real published figures in the template", files: ["hudbay-minerals-template.xlsx"] },
};

async function sha256Hex(buf: ArrayBuffer) {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const fmtVal = (v: number, pct?: boolean) => (pct ? `${v.toFixed(0)}%` : v.toLocaleString("en-US", { maximumFractionDigits: v < 100 ? 2 : 0 }));

export default function SubmissionView({ corpus }: { corpus: Corpus }) {
  const [sub, setSub] = useState<Submission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const analysis = useMemo(() => (sub ? analyseSubmission(corpus, sub) : null), [corpus, sub]);

  const load = async (files: { name: string; data: ArrayBuffer }[]) => {
    setBusy(true);
    setError(null);
    try {
      const subs: Submission[] = [];
      for (const f of files) {
        const wb = XLSX.read(f.data, { type: "array" });
        if (!isSubmissionWorkbook(wb)) throw new Error(`"${f.name}" is not an AquaTrace submission. Start from the blank template.`);
        subs.push(parseSubmission(wb, f.name, await sha256Hex(f.data)));
      }
      const names = new Set(subs.map((s) => s.company));
      if (names.size > 1) throw new Error(`These files are from different companies (${[...names].join(", ")}). Upload one company at a time.`);
      setSub(mergeSubmissions(subs));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The file could not be read.");
      setSub(null);
    } finally {
      setBusy(false);
    }
  };

  const loadSample = async (key: keyof typeof SAMPLES) => {
    const files = await Promise.all(
      SAMPLES[key].files.map(async (name) => {
        const res = await fetch(`/samples/${name}`);
        if (!res.ok) throw new Error(`Sample ${name} is missing. Run npm run make-submission-files.`);
        return { name, data: await res.arrayBuffer() };
      }),
    );
    await load(files);
  };

  // Presentation shortcut: /explore?view=submit&sample=andes opens with the sample loaded.
  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get("sample");
    if (k && k in SAMPLES) loadSample(k as keyof typeof SAMPLES).catch((e) => setError(String(e.message ?? e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-6xl">
      <h1 className="text-[1.6rem] font-semibold tracking-tight">Analyse a new submission</h1>
      <p className="mt-2 max-w-3xl text-[0.95rem] leading-relaxed text-shale">
        A mining company fills in the AquaTrace template and uploads it. In seconds it gets its trend, where that trend leads, how it compares
        with {corpus.companies.length} peers, which figures won&apos;t survive an audit, and what to do next. Nothing is stored; the file is read in
        your browser.
      </p>

      {/* Three steps */}
      <ol className="mt-6 grid gap-3 md:grid-cols-3">
        <StepCard n={1} title="Download the template">
          <a href="/samples/aquatrace-submission-template.xlsx" download className="mt-2 inline-block rounded-md border border-fresh px-3 py-1.5 text-[0.85rem] font-medium text-fresh hover:bg-fresh hover:text-white">
            Blank template (.xlsx)
          </a>
        </StepCard>
        <StepCard n={2} title="Upload the filled file">
          <label className="mt-2 inline-block cursor-pointer rounded-md bg-fresh px-3 py-1.5 text-[0.85rem] font-medium text-white hover:bg-fresh-3">
            {busy ? "Reading…" : "Choose file(s)"}
            <input
              type="file"
              multiple
              accept=".xlsx,.xls,.xlsm"
              className="sr-only"
              onChange={async (e) => {
                const fs = [...(e.target.files ?? [])];
                if (fs.length) await load(await Promise.all(fs.map(async (f) => ({ name: f.name, data: await f.arrayBuffer() }))));
                e.target.value = "";
              }}
            />
          </label>
          <span className="mt-1 block text-[0.75rem] text-shale">Several years? Select all files: restatements are checked.</span>
        </StepCard>
        <StepCard n={3} title="Or try an example">
          <div className="mt-2 flex flex-wrap gap-2">
            {(Object.keys(SAMPLES) as (keyof typeof SAMPLES)[]).map((k) => (
              <button key={k} onClick={() => loadSample(k).catch((e) => setError(String(e.message ?? e)))} disabled={busy} className="rounded-md border border-hairline bg-white px-3 py-1.5 text-left text-[0.82rem] hover:border-shale disabled:opacity-50">
                <span className="block font-medium">{SAMPLES[k].label}</span>
                <span className="block text-[0.72rem] text-shale">{SAMPLES[k].detail}</span>
              </button>
            ))}
          </div>
        </StepCard>
      </ol>

      {error && (
        <p role="alert" className="mt-5 border-l-4 border-oxide bg-oxide/5 px-3 py-2 text-[0.88rem] text-oxide">
          {error}
        </p>
      )}

      {analysis && sub && <Results a={analysis} sub={sub} />}
    </div>
  );
}

function Results({ a, sub }: { a: Analysis; sub: Submission }) {
  const [ind, setInd] = useState<IndicatorId>("withdrawal");
  const meta = INDICATORS.find((i) => i.id === ind)!;
  const w = a.profile.trends.withdrawal;
  const w36 = w?.project(HORIZONS[3].year).mid;
  const reuse = a.ranks.find((r) => r.id === "reuse");
  const high = a.signals.filter((s) => s.severity === "high").length;
  const isSample = /sample/i.test(a.company);

  const chart = useMemo(() => {
    const pts = a.profile.series[ind] ?? [];
    const t = a.profile.trends[ind];
    const rows: { year: number; reported?: number; mid?: number; band?: [number, number] }[] = pts.map((p) => ({ year: p.year, reported: p.value }));
    if (t && rows.length) {
      const last = rows[rows.length - 1];
      last.mid = last.reported;
      last.band = [last.reported!, last.reported!];
      for (let y = t.lastYear + 1; y <= HORIZONS[3].year; y++) {
        const p = t.project(y);
        rows.push({ year: y, mid: p.mid, band: [p.low, p.high] });
      }
    }
    return rows;
  }, [a, ind]);

  return (
    <section className="mt-10 border-t border-hairline pt-8" aria-live="polite">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-[1.4rem] font-semibold tracking-tight">{a.company}</h2>
        {isSample && <span className="rounded-sm bg-ochre/15 px-2 py-0.5 text-[0.72rem] font-semibold uppercase tracking-wide text-ochre">Fictional sample data</span>}
      </div>
      <p className="mt-1 text-[0.8rem] text-shale">
        {sub.records.length} figures · {sub.sites.length} sites · {a.profile.years[0]}–{a.profile.years.at(-1)} ·{" "}
        {sub.files.map((f) => (
          <span key={f.file} className="num mr-2 whitespace-nowrap" title={f.sha256 ?? ""}>
            {f.file} <span className="text-shale/80">#{f.sha256?.slice(0, 8)}</span>
          </span>
        ))}
      </p>

      {sub.issues.length > 0 && (
        <div className="mt-4 border-l-4 border-ochre bg-ochre/5 px-4 py-3 text-[0.84rem]">
          <div className="font-semibold">{sub.issues.length} row{sub.issues.length > 1 ? "s" : ""} could not be read</div>
          <ul className="mt-1 space-y-0.5 text-shale">
            {sub.issues.slice(0, 8).map((i, k) => (
              <li key={k}>
                Row {i.row}: {i.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Headline numbers */}
      <div className="mt-6 grid gap-6 border-y border-hairline py-5 sm:grid-cols-2 lg:grid-cols-4">
        <Big value={w ? `${w.annualChange >= 0 ? "+" : ""}${(w.annualChange * 100).toFixed(1)}%` : "–"} label="water withdrawn, change per year" tone={w && w.annualChange > 0 ? "bad" : "good"} />
        <Big value={w36 ? `${Math.round(w36).toLocaleString("en-US")} ML` : "–"} label={`by ${HORIZONS[3].year} if nothing changes`} tone="neutral" />
        <Big value={reuse ? `${Math.round(reuse.value)}%` : "–"} label={reuse ? `reused, peer median ${Math.round(reuse.peerMedian ?? 0)}% (rank ${reuse.rank} of ${reuse.of})` : "reuse not reported"} tone={reuse && reuse.peerMedian !== null && reuse.value < reuse.peerMedian ? "bad" : "good"} />
        <Big value={`${a.score}`} label={`integrity score out of 100 · ${high} high-severity issue${high === 1 ? "" : "s"}`} tone={a.score < 60 ? "bad" : a.score < 85 ? "neutral" : "good"} />
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        {/* Chart */}
        <div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Indicator">
            {INDICATORS.filter((i) => a.profile.series[i.id]).map((i) => (
              <button key={i.id} onClick={() => setInd(i.id)} aria-pressed={ind === i.id} className={cx("rounded-sm border px-2.5 py-1 text-[0.78rem]", ind === i.id ? "border-fresh bg-fresh text-white" : "border-hairline hover:border-shale")}>
                {i.label}
              </button>
            ))}
          </div>
          <h3 className="mt-4 text-[1rem] font-semibold">
            {meta.label} ({meta.unit}): reported, and where it goes if nothing changes
          </h3>
          <div className="mt-2 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart} margin={{ left: 8, right: 24, top: 20 }}>
                <CartesianGrid vertical={false} stroke="var(--color-hairline)" />
                <XAxis dataKey="year" type="number" domain={["dataMin", HORIZONS[3].year]} allowDecimals={false} tick={{ fontSize: 12, fill: "var(--color-shale)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "var(--color-shale)" }} axisLine={false} tickLine={false} width={70} tickFormatter={(v) => fmtVal(Number(v), meta.pct)} />
                <Tooltip formatter={(v) => (Array.isArray(v) ? `${fmtVal(Number(v[0]), meta.pct)} – ${fmtVal(Number(v[1]), meta.pct)}` : fmtVal(Number(v), meta.pct))} contentStyle={{ fontSize: 12, borderRadius: 4 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area isAnimationActive={false} dataKey="band" name="Likely range" fill="var(--color-sea)" fillOpacity={0.3} stroke="none" />
                <Line isAnimationActive={false} dataKey="reported" name="Reported" stroke="var(--color-basalt)" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line isAnimationActive={false} dataKey="mid" name="If nothing changes" stroke="var(--color-oxide)" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                {HORIZONS.map((h) => (
                  <ReferenceLine key={h.id} x={h.year} stroke="var(--color-hairline)" label={{ value: h.label, fontSize: 11, fill: "var(--color-shale)", position: "top" }} />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Findings */}
        <div>
          <h3 className="text-[1rem] font-semibold">What the data says</h3>
          <ul className="mt-3 space-y-3">
            {a.findings.map((f, i) => (
              <li key={i} className="flex gap-3 text-[0.9rem] leading-relaxed">
                <span className={cx("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", f.tone === "bad" ? "bg-oxide" : f.tone === "good" ? "bg-leaf" : "bg-sea")} aria-hidden />
                <span>
                  <span className="sr-only">{f.tone === "bad" ? "Concern: " : f.tone === "good" ? "Positive: " : ""}</span>
                  {f.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-10 rounded-xl border border-leaf/30 bg-leaf/5 p-5">
        <h3 className="text-[1rem] font-semibold">What {a.company.replace(/\s*\(.*\)/, "")} should do next</h3>
        <ol className="mt-3 grid gap-2 md:grid-cols-2">
          {a.actions.map((x, i) => (
            <li key={i} className="flex gap-3 text-[0.9rem] leading-relaxed">
              <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-leaf text-[0.75rem] font-bold text-white">{i + 1}</span>
              {x}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        {/* Peers */}
        <div>
          <h3 className="text-[1rem] font-semibold">Compared with {a.profiles.length - 1} peers (latest year)</h3>
          <table className="mt-3 w-full text-[0.84rem]">
            <thead>
              <tr className="border-b border-basalt text-left text-[0.75rem] text-shale">
                <th className="py-1.5 pr-3 font-medium">Indicator</th>
                <th className="py-1.5 pr-3 text-right font-medium">This company</th>
                <th className="py-1.5 pr-3 text-right font-medium">Peer median</th>
                <th className="py-1.5 text-right font-medium">Rank (1 = best)</th>
              </tr>
            </thead>
            <tbody className="num">
              {a.ranks.map((r) => {
                const pct = r.id === "reuse" || r.id === "stressedShare";
                const good = r.peerMedian === null ? null : r.better === "down" ? r.value <= r.peerMedian : r.value >= r.peerMedian;
                return (
                  <tr key={r.id} className="border-b border-hairline">
                    <td className="py-1.5 pr-3">{r.label}</td>
                    <td className={cx("py-1.5 pr-3 text-right font-semibold", good === false && "text-oxide", good === true && "text-leaf")}>{fmtVal(r.value, pct)}</td>
                    <td className="py-1.5 pr-3 text-right text-shale">{r.peerMedian === null ? "–" : fmtVal(r.peerMedian, pct)}</td>
                    <td className="py-1.5 text-right">
                      {r.rank} of {r.of}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[0.75rem] text-shale">Absolute volumes rank smaller as better; they mostly reflect company size. Intensity and shares are the fair comparison.</p>
        </div>

        {/* Integrity */}
        <div>
          <h3 className="text-[1rem] font-semibold">Figures to check before publishing</h3>
          <ul className="mt-3 divide-y divide-hairline border-y border-hairline">
            {a.signals.filter((s) => s.severity !== "low").slice(0, 12).map((s, i) => (
              <li key={i} className="grid grid-cols-[4.2rem_1fr] gap-2 py-2 text-[0.84rem]">
                <span className={cx("text-[0.72rem] font-semibold uppercase", s.severity === "high" ? "text-oxide" : "text-ochre")}>{s.severity}</span>
                <span>
                  <span className="text-shale">
                    {SIGNAL_LABEL[s.kind]}
                    {s.site && s.site !== "_corporate" ? ` · ${s.site}` : ""}
                    {s.year ? ` · ${s.year}` : ""}
                  </span>
                  <span className="block leading-snug">{s.title}</span>
                </span>
              </li>
            ))}
            {a.signals.length === 0 && <li className="py-3 text-[0.84rem] text-shale">No issues found.</li>}
          </ul>
        </div>
      </div>

      <p className="mt-8 text-[0.75rem] leading-relaxed text-shale">
        Analysed in the browser; not added to the AquaTrace dataset. To add it permanently:{" "}
        <code className="rounded-sm bg-limestone px-1">npm run analyse-submission -- &lt;files&gt; --add</code>, then{" "}
        <code className="rounded-sm bg-limestone px-1">npm run build-corpus</code>. Projections extend the reported trend; they are not forecasts.
      </p>
    </section>
  );
}

function StepCard({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-lg border border-hairline bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="num flex h-6 w-6 items-center justify-center rounded-full bg-fresh text-[0.75rem] font-bold text-white">{n}</span>
        <span className="text-[0.92rem] font-semibold">{title}</span>
      </div>
      {children}
    </li>
  );
}

function Big({ value, label, tone }: { value: string; label: string; tone: "good" | "bad" | "neutral" }) {
  return (
    <div>
      <div className={cx("num cond text-[2.2rem] leading-none font-bold", tone === "bad" ? "text-oxide" : tone === "good" ? "text-leaf" : "text-basalt")}>{value}</div>
      <div className="mt-1.5 text-[0.8rem] leading-snug text-shale">{label}</div>
    </div>
  );
}
