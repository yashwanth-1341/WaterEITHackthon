"use client";

import { useState } from "react";
import type { Status } from "../Dashboard";

interface Props {
  context: unknown;
  company: string | null;
  status: Status;
}

const SUGGESTIONS = (company: string | null) =>
  company
    ? [
        `Summarise ${company}'s water trend and what it means by 2031 if nothing changes.`,
        `Which of ${company}'s integrity signals should an auditor look at first, and why?`,
        `What would an EU battery-metal buyer ask ${company} before signing an offtake contract?`,
        `How does ${company} compare with its peers on water per tonne and reuse?`,
      ]
    : [
        "Which three companies face the biggest water risk by 2031 if nothing changes, and why?",
        "Summarise the industry's water trend for a government minister in five sentences.",
        "Which disclosure gaps most limit what regulators can see?",
        "Where do the integrity checks suggest restated or unreliable baselines?",
      ];

export default function IndustryAskView({ context, company, status }: Props) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showContext, setShowContext] = useState(false);

  const ask = async (q: string) => {
    if (!q.trim()) return;
    setQuestion(q);
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q, context }) });
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
      <h1 className="text-[1.6rem] font-semibold tracking-tight">Ask the data{company ? `: ${company}` : ""}</h1>
      <p className="mt-2 max-w-2xl text-[0.95rem] leading-relaxed text-shale">
        Answers come from the extracted figures, trends, projections and integrity signals, not from the model&apos;s general knowledge.
        {status.ai ? ` Model: ${status.model}.` : ""} Pick a company on the left to narrow the context.
      </p>
      {!status.ai && (
        <div className="mt-5 border-l-4 border-ochre bg-ochre/5 px-4 py-3 text-[0.88rem]">
          OpenAI is not connected. Add <code className="rounded-sm bg-limestone px-1">OPENAI_API_KEY</code> to <code className="rounded-sm bg-limestone px-1">.env.local</code> and restart.
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        {SUGGESTIONS(company).map((s) => (
          <button key={s} onClick={() => ask(s)} disabled={loading || !status.ai} className="rounded-sm border border-hairline px-3 py-1.5 text-left text-[0.82rem] hover:border-shale disabled:opacity-50">
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
        <label htmlFor="iq" className="text-[0.88rem] font-medium">
          Your question
        </label>
        <textarea id="iq" rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} className="mt-1 w-full rounded-sm border border-hairline bg-paper px-3 py-2 text-[0.92rem]" />
        <div className="mt-2 flex items-center gap-4">
          <button type="submit" disabled={loading || !question.trim() || !status.ai} className="rounded-sm border border-fresh bg-fresh px-4 py-2 text-[0.88rem] font-medium text-white hover:bg-fresh-3 disabled:opacity-50">
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
      {answer && <article className="mt-6 border-t border-hairline pt-5 text-[0.95rem] leading-[1.65] whitespace-pre-wrap">{answer}</article>}
      {showContext && <pre className="mt-6 max-h-96 overflow-auto rounded-sm bg-limestone p-4 text-[0.75rem] leading-relaxed">{JSON.stringify(context, null, 2)}</pre>}
    </div>
  );
}
