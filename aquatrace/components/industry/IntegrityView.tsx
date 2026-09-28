"use client";

import { useEffect, useMemo, useState } from "react";
import type { Corpus } from "@/lib/corpus/types";
import { figureCounts, integrityScore, SIGNAL_LABEL, type Signal, type SignalKind } from "@/lib/corpus/integrity";
import { cx } from "@/lib/format";

interface Props {
  corpus: Corpus;
  signals: Signal[];
  company: string | null;
  supabase: boolean;
}

interface FileCheck {
  file: string;
  status: "match" | "changed" | "missing" | "not-in-corpus";
  expected: string | null;
  actual: string | null;
}
interface ChainState {
  check?: { ok: boolean; events: number; head: string | null; breaks: { seq: number; problem: string }[] };
  recent?: { seq: number; created_at: string; kind: string; subject: string; content_sha256: string }[];
  error?: string;
  setupNeeded?: boolean;
}

const SEV_TONE = { high: "text-oxide", medium: "text-ochre", low: "text-shale" } as const;
const SEV_BAR = { high: "bg-oxide", medium: "bg-ochre", low: "bg-sea" } as const;

async function sha256Hex(buf: ArrayBuffer) {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function IntegrityView({ corpus, signals, company, supabase }: Props) {
  const [kind, setKind] = useState<SignalKind | "all">("all");
  const [minSev, setMinSev] = useState<"high" | "medium" | "low">("medium");
  const [files, setFiles] = useState<FileCheck[] | null>(null);
  const [chain, setChain] = useState<ChainState | null>(null);
  const [upload, setUpload] = useState<{ name: string; hash: string; verdict: string; tone: "good" | "bad" | "neutral" } | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  const refreshChain = () =>
    fetch("/api/audit")
      .then((r) => r.json())
      .then(setChain)
      .catch(() => setChain({ error: "Could not reach the audit log." }));

  useEffect(() => {
    fetch("/api/integrity/files")
      .then((r) => r.json())
      .then((d) => setFiles(d.available ? d.files : []))
      .catch(() => setFiles([]));
    if (supabase) refreshChain();
  }, [supabase]);

  const scoped = company ? signals.filter((s) => s.company === company) : signals;
  const rank = { high: 0, medium: 1, low: 2 };
  const visible = scoped.filter((s) => (kind === "all" || s.kind === kind) && rank[s.severity] <= rank[minSev]);
  const kinds = useMemo(() => {
    const m = new Map<SignalKind, number>();
    scoped.forEach((s) => m.set(s.kind, (m.get(s.kind) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [scoped]);

  const counts = figureCounts(corpus);
  const scores = corpus.companies
    .map((c) => ({ company: c, ...integrityScore(signals, c, counts.get(c) ?? 0), records: counts.get(c) ?? 0 }))
    .sort((a, b) => a.score - b.score);

  const checkUpload = async (f: File) => {
    const hash = await sha256Hex(await f.arrayBuffer());
    const byHash = corpus.files.find((x) => x.sha256 === hash);
    const byName = corpus.files.find((x) => x.file === f.name);
    let verdict: string;
    let tone: "good" | "bad" | "neutral";
    if (byHash) {
      verdict = `Identical to the ingested report "${byHash.file}" (${byHash.company}). Every figure in AquaTrace from this file is traceable to it.`;
      tone = "good";
    } else if (byName) {
      verdict = `A file with this name was ingested, but its content differs. The figures in AquaTrace came from a different version of "${f.name}". Treat this copy as modified until the publisher confirms it.`;
      tone = "bad";
    } else {
      verdict = "Not one of the ingested reports. Nothing to compare it with yet; its fingerprint is recorded so later copies can be checked against it.";
      tone = "neutral";
    }
    setUpload({ name: f.name, hash, verdict, tone });
    if (supabase) {
      await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "file.verified", subject: f.name, sha256: hash, detail: { result: tone, size: f.size } }),
      }).catch(() => undefined);
      refreshChain();
    }
  };

  const changed = files?.filter((f) => f.status === "changed" || f.status === "missing") ?? [];

  return (
    <div className="max-w-6xl">
      <h1 className="text-[1.6rem] font-semibold tracking-tight">Can these numbers be trusted?{company ? ` ${company}` : ""}</h1>
      <p className="mt-2 max-w-3xl text-[0.95rem] leading-relaxed text-shale">
        Three layers. The source files are fingerprinted, so a swapped or edited report is caught. Every figure is cross-checked against the rest of
        the same report and against earlier reports, so a number that doesn&apos;t fit stands out. And anything saved in AquaTrace goes into a
        hash-chained log that shows any later edit. A signal is a reason to look, not proof of wrongdoing.
      </p>

      {/* Layer 1 and 3 status */}
      <div className="mt-6 grid gap-6 border-y border-hairline py-5 md:grid-cols-3">
        <Stat
          big={files === null ? "…" : files.length === 0 ? "n/a" : `${files.filter((f) => f.status === "match").length}/${corpus.files.length}`}
          label={
            files === null
              ? "checking source files"
              : files.length === 0
                ? "source folder not on this server"
                : changed.length
                  ? `source files match their fingerprint; ${changed.length} changed or missing`
                  : "source files match the fingerprint taken at ingestion"
          }
          tone={changed.length ? "bad" : files?.length ? "good" : "neutral"}
        />
        <Stat
          big={`${scoped.filter((s) => s.severity === "high").length}`}
          label={`high-severity signals across ${company ? "this company" : `${corpus.companies.length} companies`} (${scoped.length} in total)`}
          tone={scoped.some((s) => s.severity === "high") ? "bad" : "good"}
        />
        <Stat
          big={!supabase ? "off" : chain?.check ? (chain.check.ok ? "intact" : "broken") : chain?.error ? "setup" : "…"}
          label={
            !supabase
              ? "audit log needs Supabase"
              : chain?.check
                ? `audit log: ${chain.check.events} events, every hash recomputed${chain.check.breaks.length ? `, ${chain.check.breaks.length} break(s)` : ""}`
                : (chain?.error ?? "verifying audit log")
          }
          tone={chain?.check ? (chain.check.ok ? "good" : "bad") : "neutral"}
        />
      </div>

      {changed.length > 0 && (
        <div role="alert" className="mt-4 border-l-4 border-oxide bg-oxide/5 px-4 py-3 text-[0.88rem]">
          {changed.map((f) => (
            <div key={f.file}>
              <span className="font-semibold">{f.file}</span>: {f.status === "missing" ? "removed from the source folder" : "content changed since ingestion"}
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_19rem]">
        {/* Signals */}
        <section>
          <h2 className="text-[1.1rem] font-semibold">Signals in the reported figures</h2>
          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Signal type">
            <Chip active={kind === "all"} onClick={() => setKind("all")}>
              All <span className="num">{scoped.length}</span>
            </Chip>
            {kinds.map(([k, n]) => (
              <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
                {SIGNAL_LABEL[k]} <span className="num">{n}</span>
              </Chip>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5 text-[0.78rem]" role="group" aria-label="Minimum severity">
            <span className="self-center text-shale">Show</span>
            {(["high", "medium", "low"] as const).map((s) => (
              <Chip key={s} active={minSev === s} onClick={() => setMinSev(s)}>
                {s === "high" ? "high only" : s === "medium" ? "high and medium" : "everything"}
              </Chip>
            ))}
          </div>

          <ol className="mt-4 divide-y divide-hairline border-y border-hairline">
            {visible.slice(0, 150).map((s, i) => (
              <li key={i} className="grid grid-cols-[4px_1fr] gap-3 py-3">
                <span className={cx("rounded-full", SEV_BAR[s.severity])} aria-hidden />
                <div>
                  <div className="flex flex-wrap items-baseline gap-x-2 text-[0.75rem]">
                    <span className={cx("font-semibold uppercase tracking-wide", SEV_TONE[s.severity])}>{s.severity}</span>
                    <span className="text-shale">{SIGNAL_LABEL[s.kind]}</span>
                    <span className="text-shale">·</span>
                    <span className="font-medium">{s.company}</span>
                    {s.site && s.site !== "_corporate" && <span className="text-shale">{s.site}</span>}
                    {s.year && <span className="num text-shale">{s.year}</span>}
                  </div>
                  <div className="mt-0.5 text-[0.9rem] font-medium leading-snug">{s.title}</div>
                  <p className="mt-0.5 text-[0.82rem] leading-relaxed text-shale">{s.detail}</p>
                  {s.evidence.length > 0 && (
                    <button onClick={() => setOpen(open === i ? null : i)} className="mt-1 text-[0.78rem] text-fresh underline underline-offset-2">
                      {open === i ? "Hide evidence" : `Show evidence (${s.evidence.length})`}
                    </button>
                  )}
                  {open === i && (
                    <table className="mt-2 w-full text-[0.78rem]">
                      <tbody className="num">
                        {s.evidence.map((e, j) => (
                          <tr key={j} className="border-t border-hairline">
                            <td className="py-1 pr-3">{e.label}</td>
                            <td className="py-1 pr-3 text-right font-semibold">{e.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>
                            <td className="py-1 text-shale">
                              {e.source} · {e.location}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </li>
            ))}
            {visible.length === 0 && <li className="py-6 text-[0.88rem] text-shale">No signals at this level.</li>}
          </ol>
          {visible.length > 150 && <p className="mt-2 text-[0.78rem] text-shale">Showing the first 150 of {visible.length}.</p>}
        </section>

        {/* Side: scores, verify a file, ledger */}
        <aside className="space-y-8">
          <section>
            <h2 className="text-[1rem] font-semibold">Integrity score</h2>
            <p className="mt-1 text-[0.78rem] leading-snug text-shale">Signals per 100 disclosed figures (high counts 8, medium 3, low 1), so publishing more is not penalised. 100 = nothing found.</p>
            <table className="mt-3 w-full text-[0.82rem]">
              <tbody className="num">
                {scores.map((s) => (
                  <tr key={s.company} className={cx("border-b border-hairline", company && company !== s.company && "opacity-45")}>
                    <td className="py-1.5 pr-2">{s.company}</td>
                    <td className={cx("py-1.5 pr-2 text-right font-semibold", s.score < 60 ? "text-oxide" : s.score < 85 ? "text-ochre" : "text-verdigris")}>{s.score}</td>
                    <td className="py-1.5 text-right text-[0.72rem] text-shale">
                      {s.high} high · {s.records.toLocaleString("en-US")} figs
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-[1rem] font-semibold">Check a file</h2>
            <p className="mt-1 text-[0.78rem] leading-snug text-shale">
              Drop a copy of a report someone sent you. It is fingerprinted in your browser and compared with the ingested originals; the file is not uploaded.
            </p>
            <label className="mt-3 block cursor-pointer rounded-sm border border-dashed border-shale px-3 py-4 text-center text-[0.82rem] hover:bg-limestone">
              Choose a PDF or workbook
              <input type="file" className="sr-only" onChange={(e) => e.target.files?.[0] && checkUpload(e.target.files[0])} />
            </label>
            {upload && (
              <div className={cx("mt-3 border-l-4 px-3 py-2 text-[0.8rem] leading-relaxed", upload.tone === "good" ? "border-verdigris bg-verdigris/5" : upload.tone === "bad" ? "border-oxide bg-oxide/5" : "border-sea bg-sea/10")}>
                <div className="font-semibold">{upload.name}</div>
                <div className="num break-all text-[0.7rem] text-shale">SHA-256 {upload.hash}</div>
                <div className="mt-1">{upload.verdict}</div>
              </div>
            )}
          </section>

          <section>
            <h2 className="text-[1rem] font-semibold">Audit log</h2>
            {!supabase && <p className="mt-1 text-[0.78rem] text-shale">Connect Supabase to record and verify events.</p>}
            {chain?.setupNeeded && <p className="mt-1 text-[0.78rem] leading-snug text-ochre">{chain.error}</p>}
            {chain?.check && (
              <>
                <p className="mt-1 text-[0.78rem] leading-snug text-shale">
                  Each event&apos;s hash covers the one before it. Updates and deletes are blocked in the database; if anyone gets around that, the chain breaks here.
                </p>
                {chain.check.breaks.map((b) => (
                  <p key={`${b.seq}-${b.problem}`} className="mt-2 text-[0.78rem] font-medium text-oxide">
                    Event #{b.seq}: {b.problem}
                  </p>
                ))}
                <ol className="mt-3 space-y-2 text-[0.75rem]">
                  {chain.recent?.slice(0, 8).map((e) => (
                    <li key={e.seq} className="border-l-2 border-hairline pl-2">
                      <div>
                        <span className="num text-shale">#{e.seq}</span> <span className="font-medium">{e.kind}</span> {e.subject}
                      </div>
                      <div className="num text-shale">
                        {new Date(e.created_at).toLocaleString("en-GB")} · {e.content_sha256.slice(0, 12)}…
                      </div>
                    </li>
                  ))}
                  {chain.recent?.length === 0 && <li className="text-shale">No events yet. Save a dataset or check a file.</li>}
                </ol>
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cx("rounded-sm border px-2.5 py-1 text-[0.78rem]", active ? "border-basalt bg-basalt text-white" : "border-hairline hover:border-shale")}
    >
      {children}
    </button>
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
