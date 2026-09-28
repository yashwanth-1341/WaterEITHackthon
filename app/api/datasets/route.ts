import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/server/supabase";
import { appendEvent, sha256, stableStringify } from "@/lib/server/ledger";

export const dynamic = "force-dynamic";

const NOT_CONFIGURED = {
  error: "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local, run supabase/schema.sql, then restart.",
};

export async function GET() {
  const sb = getSupabase();
  if (!sb) return NextResponse.json(NOT_CONFIGURED, { status: 501 });
  // "*" so this works before supabase/002_integrity.sql adds the fingerprint column.
  const res = await sb.from("water_datasets").select("*").order("created_at", { ascending: false }).limit(20);
  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
  // Re-fingerprint every row: a payload edited directly in the database no longer matches.
  const datasets = (res.data as Record<string, unknown>[]).map((d) => {
    const stored = (d.payload_sha256 as string | null | undefined) ?? null;
    const actual = sha256(stableStringify(d.payload));
    return { ...d, integrity: stored === null ? "unsealed" : stored === actual ? "intact" : "modified" };
  });
  return NextResponse.json({ datasets });
}

export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json(NOT_CONFIGURED, { status: 501 });
  const body = await req.json().catch(() => null);
  const payload = body?.payload;
  if (!payload || !Array.isArray(payload.sites)) {
    return NextResponse.json({ error: "Send { name, payload } where payload is an AquaTrace dataset." }, { status: 400 });
  }
  const row = {
    name: String(body.name ?? `${payload.company} ${payload.period}`).slice(0, 200),
    company: String(payload.company ?? "").slice(0, 200),
    period: String(payload.period ?? "").slice(0, 50),
    payload,
  };
  const fingerprint = sha256(stableStringify(payload));
  let res = await sb.from("water_datasets").insert({ ...row, payload_sha256: fingerprint }).select("id, name, created_at").single();
  if (res.error?.message.includes("payload_sha256")) res = await sb.from("water_datasets").insert(row).select("id, name, created_at").single();
  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
  const audit = await appendEvent("dataset.saved", res.data.id, fingerprint, { name: row.name, company: row.company, period: row.period, sites: payload.sites.length });
  return NextResponse.json({ saved: res.data, fingerprint, audited: audit.ok });
}
