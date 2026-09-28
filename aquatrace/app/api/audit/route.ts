import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/server/supabase";
import { appendEvent, verifyChain } from "@/lib/server/ledger";

export const dynamic = "force-dynamic";

/** Verify the whole chain and return the latest events. */
export async function GET() {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Supabase is not configured." }, { status: 501 });
  const check = await verifyChain();
  if ("error" in check) {
    const missing = /audit_events/.test(check.error);
    return NextResponse.json(
      { error: missing ? "The audit log table does not exist yet. Run supabase/002_integrity.sql in the Supabase SQL editor." : check.error, setupNeeded: missing },
      { status: missing ? 501 : 500 },
    );
  }
  const { data } = await sb.from("audit_events").select("seq, created_at, kind, subject, content_sha256, detail, hash").order("seq", { ascending: false }).limit(25);
  return NextResponse.json({ check, recent: data ?? [] });
}

const ALLOWED = new Set(["file.imported", "file.verified", "corpus.reviewed"]);

/** Record a client-side event (e.g. a file was imported and its fingerprint). */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const kind = String(body?.kind ?? "");
  const subject = String(body?.subject ?? "").slice(0, 300);
  const hash = String(body?.sha256 ?? "");
  if (!ALLOWED.has(kind) || !subject || !/^[0-9a-f]{64}$/.test(hash)) {
    return NextResponse.json({ error: "Send { kind, subject, sha256 } with an allowed kind and a hex SHA-256." }, { status: 400 });
  }
  const detail = body?.detail && typeof body.detail === "object" ? body.detail : {};
  const res = await appendEvent(kind, subject, hash, detail);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });
  return NextResponse.json(res);
}
