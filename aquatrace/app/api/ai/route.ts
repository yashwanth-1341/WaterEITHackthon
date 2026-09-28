import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SYSTEM = `You are a water-accounting analyst for mining and metals.
You answer questions about mining companies' water data as disclosed in their reports: either one company's site-level ledger standardised to the ICMM Water Reporting Good Practice Guide (2nd edition, 2021), or a multi-company corpus with trends, projections and data-integrity signals.
- Projections are extrapolations of disclosed history, not forecasts; say so. Integrity signals are prompts for review, never proof of manipulation; say so.
- Compare companies fairly: scopes, fiscal years and definitions differ between reports.
Rules:
- Use only the numbers in the provided context. If a number is not there, say it is not disclosed.
- All volumes are megalitres (ML). 1 ML = 1,000 m3.
- Clearly separate what the data shows from what you infer.
- Scenario costs use illustrative price assumptions; say so when you cite them.
- Water-stress levels marked "assumed" are not assessments; say so when relevant.
- When relevant, relate findings to ICMM minimum commitments, ESRS E3 (CSRD) and EU raw-material due diligence, but note that EU rules are being revised and should be checked.
- Be concise: short paragraphs, plain language, suitable for a non-expert jury. No markdown tables.`;

const MAX_CONTEXT_CHARS = 60000;

export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set. Add it to .env.local and restart the dev server." },
      { status: 501 },
    );
  }

  let body: { question?: string; context?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  const question = (body.question ?? "").toString().slice(0, 2000).trim();
  if (!question) return NextResponse.json({ error: "Ask a question first." }, { status: 400 });
  const context = JSON.stringify(body.context ?? {}).slice(0, MAX_CONTEXT_CHARS);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Context (JSON):\n${context}\n\nQuestion: ${question}` },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json(
      { error: `OpenAI returned ${res.status}. ${detail.slice(0, 300)}` },
      { status: 502 },
    );
  }
  const data = await res.json();
  const answer: string = data?.choices?.[0]?.message?.content ?? "";
  return NextResponse.json({ answer, model: data?.model });
}
