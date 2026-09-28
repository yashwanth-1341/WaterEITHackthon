"use client";

import { useMemo, useState } from "react";
import type { Dataset } from "@/lib/types";
import type { Balance } from "@/lib/metrics";
import type { Flag } from "@/lib/validation";
import type { ScenarioParams, SiteScenario } from "@/lib/scenario";
import { buildAiContext } from "@/lib/aiContext";
import type { Status } from "../Dashboard";

interface Props {
  dataset: Dataset;
  flags: Flag[];
  balances: Map<string, Balance>;
  scenario: ScenarioParams;
  scenarioResults: SiteScenario[];
  tolerance: number;
  status: Status;
}

const SUGGESTIONS = [
  "Summarise the three most important findings for a non-expert jury.",
  "Which site should this company fix first, and what should it measure?",
  "Write the ICMM narrative for 'material water risks' based only on this data.",
  "What would an EU battery-metal buyer ask this company before signing an offtake contract?",
  "Explain what the current scenario means for Telfer and Cadia.",
];

export default function AskView(p: Props) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showContext, setShowContext] = useState(false);

  const context = useMemo(
    () =>
      buildAiContext({
        dataset: p.dataset,
        balances: p.balances,
        flags: p.flags,
        scenario: p.scenario,
        scenarioResults: p.scenarioResults,
        tolerance: p.tolerance,
      }),
    [p.dataset, p.balances, p.flags, p.scenario, p.scenarioResults, p.tolerance],
  );

  const ask = async (q: string) => {
    if (!q.trim()) return;
    setQuestion(q);
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, context }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
      setAnswer(data.answer);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The request failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-[1.6rem] font-semibold tracking-tight">Ask the data</h1>
      <p className="mt-2 max-w-2xl text-[0.95rem] leading-relaxed text-shale">
        Questions are answered from the figures, checks and scenario on screen, not from the model&apos;s general knowledge.
        {p.status.ai ? ` Model: ${p.status.model}.` : ""}
      </p>

      {!p.status.ai && (
        <div className="mt-5 border-l-4 border-ochre bg-ochre/5 px-4 py-3 text-[0.88rem] leading-relaxed">
          OpenAI is not connected. Add <code className="rounded-sm bg-limestone px-1">OPENAI_API_KEY</code> to{" "}
          <code className="rounded-sm bg-limestone px-1">.env.local</code> and restart <code className="rounded-sm bg-limestone px-1">npm run dev</code>.
          Everything else in AquaTrace works without it.
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => ask(s)}
            disabled={loading || !p.status.ai}
            className="rounded-sm border border-hairline px-3 py-1.5 text-left text-[0.82rem] hover:border-shale disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        className="mt-5"
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
      >
        <label htmlFor="q" className="text-[0.88rem] font-medium">
          Your question
        </label>
        <textarea
          id="q"
          rows={3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="For example: how much freshwater would Cadia save if it matched Lihir's recycling rate?"
          className="mt-1 w-full rounded-sm border border-hairline bg-paper px-3 py-2 text-[0.92rem]"
        />
        <div className="mt-2 flex items-center gap-4">
          <button
            type="submit"
            disabled={loading || !question.trim() || !p.status.ai}
            className="rounded-sm border border-fresh bg-fresh px-4 py-2 text-[0.88rem] font-medium text-white hover:bg-fresh-3 disabled:opacity-50"
          >
            {loading ? "Asking…" : "Ask"}
          </button>
          <button type="button" onClick={() => setShowContext((v) => !v)} className="text-[0.82rem] text-fresh underline underline-offset-2">
            {showContext ? "Hide what is sent" : "See what is sent to the model"}
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" className="mt-5 border-l-4 border-oxide bg-oxide/5 px-3 py-2 text-[0.88rem] text-oxide">
          {error}
        </p>
      )}
      {answer && (
        <article className="mt-6 border-t border-hairline pt-5 text-[0.95rem] leading-[1.65] whitespace-pre-wrap">{answer}</article>
      )}
      {showContext && (
        <pre className="mt-6 max-h-96 overflow-auto rounded-sm bg-limestone p-4 text-[0.75rem] leading-relaxed">{JSON.stringify(context, null, 2)}</pre>
      )}
    </div>
  );
}
