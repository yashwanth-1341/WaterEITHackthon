import "server-only";
import { createHash } from "node:crypto";
import { getSupabase } from "./supabase";

export const GENESIS = "0".repeat(64);

export const sha256 = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");

/** JSON with sorted keys, so the hash doesn't depend on key order (jsonb reorders keys). */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(",")}}`;
}

export interface AuditEvent {
  seq?: number;
  created_at: string;
  kind: string;
  subject: string;
  content_sha256: string;
  detail: Record<string, unknown>;
  prev_hash: string;
  hash: string;
}

export const eventHash = (e: Omit<AuditEvent, "seq" | "hash">) =>
  sha256([e.prev_hash, new Date(e.created_at).toISOString(), e.kind, e.subject, e.content_sha256, stableStringify(e.detail)].join("\n"));

/** Append an event to the chain. Retries if another writer got there first. */
export async function appendEvent(kind: string, subject: string, contentSha256: string, detail: Record<string, unknown> = {}) {
  const sb = getSupabase();
  if (!sb) return { ok: false as const, error: "Supabase is not configured." };
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: last, error: e1 } = await sb.from("audit_events").select("hash").order("seq", { ascending: false }).limit(1).maybeSingle();
    if (e1) return { ok: false as const, error: e1.message };
    const base = { created_at: new Date().toISOString(), kind, subject, content_sha256: contentSha256, detail, prev_hash: last?.hash ?? GENESIS };
    const row = { ...base, hash: eventHash(base) };
    const { data, error } = await sb.from("audit_events").insert(row).select("seq, hash").single();
    if (!error) return { ok: true as const, event: data };
    if (error.code !== "23505") return { ok: false as const, error: error.message }; // not a unique-violation race
  }
  return { ok: false as const, error: "Could not append to the audit log after several attempts." };
}

export interface ChainCheck {
  ok: boolean;
  events: number;
  head: string | null;
  breaks: { seq: number; problem: string }[];
}

/** Recompute every hash from the first event. Any edit, deletion or reordering shows up as a break. */
export async function verifyChain(): Promise<ChainCheck | { error: string }> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase is not configured." };
  const all: AuditEvent[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("audit_events").select("*").order("seq", { ascending: true }).range(from, from + 999);
    if (error) return { error: error.message };
    all.push(...(data as AuditEvent[]));
    if (!data || data.length < 1000) break;
  }
  const breaks: ChainCheck["breaks"] = [];
  let prev = GENESIS;
  for (const e of all) {
    if (e.prev_hash !== prev) breaks.push({ seq: e.seq!, problem: "Link broken: the previous event was changed or deleted." });
    const { seq: _seq, hash, ...rest } = e;
    if (eventHash(rest) !== hash) breaks.push({ seq: e.seq!, problem: "Content changed after it was recorded." });
    prev = hash;
  }
  return { ok: breaks.length === 0, events: all.length, head: all.at(-1)?.hash ?? null, breaks };
}
