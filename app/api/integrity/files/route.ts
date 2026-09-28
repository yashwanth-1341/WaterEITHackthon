import { NextResponse } from "next/server";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import corpus from "@/lib/data/corpus.json";
import type { Corpus } from "@/lib/corpus/types";
import { sha256 } from "@/lib/server/ledger";

export const dynamic = "force-dynamic";

/**
 * Re-hash the source reports on disk and compare them with the fingerprints taken when the
 * corpus was built. A changed hash means the file on disk is no longer the one the figures came from.
 */
export async function GET() {
  const dir = resolve(process.cwd(), "data/reports");
  if (!existsSync(dir)) return NextResponse.json({ available: false, files: [] });
  const baseline = new Map((corpus as Corpus).files.map((f) => [f.file, f.sha256]));
  const onDisk = new Set(readdirSync(dir).filter((f) => !f.startsWith(".")));
  const files = [...new Set([...baseline.keys(), ...onDisk])].sort().map((file) => {
    const expected = baseline.get(file) ?? null;
    const actual = onDisk.has(file) ? sha256(readFileSync(resolve(dir, file))) : null;
    const status = expected === null ? "not-in-corpus" : actual === null ? "missing" : actual === expected ? "match" : "changed";
    return { file, status, expected, actual };
  });
  return NextResponse.json({ available: true, checkedAt: new Date().toISOString(), files });
}
