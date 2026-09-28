"use client";

import { useState } from "react";
import type { Dataset } from "@/lib/types";

interface Saved {
  id: string;
  name: string;
  created_at: string;
  payload: Dataset;
  /** Server re-fingerprints each row on read: "modified" means it was edited outside AquaTrace. */
  integrity: "intact" | "modified" | "unsealed";
}

export default function SavedPanel({ dataset, supabase, onOpen }: { dataset: Dataset; supabase: boolean; onOpen: (d: Dataset) => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [list, setList] = useState<Saved[] | null>(null);
  const [busy, setBusy] = useState(false);

  if (!supabase) {
    return (
      <div className="border-t border-hairline px-5 py-4 text-[0.75rem] leading-snug text-shale">
        Saving is off. Add Supabase keys to .env.local to save and reopen datasets.
      </div>
    );
  }

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${dataset.company} ${dataset.period}`, payload: dataset }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg(data.fingerprint ? `Saved and sealed (SHA-256 ${data.fingerprint.slice(0, 12)}…).` : "Saved.");
      setList(null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Saving failed.");
    } finally {
      setBusy(false);
    }
  };

  const open = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/datasets");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setList(data.datasets);
      if (!data.datasets.length) setMsg("Nothing saved yet.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Loading failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-hairline px-5 py-4">
      <div className="flex gap-2">
        <button onClick={save} disabled={busy} className="rounded-sm border border-hairline bg-paper px-3 py-1.5 text-[0.8rem] font-medium hover:border-shale disabled:opacity-50">
          Save dataset
        </button>
        <button onClick={open} disabled={busy} className="rounded-sm border border-hairline bg-paper px-3 py-1.5 text-[0.8rem] font-medium hover:border-shale disabled:opacity-50">
          Open saved
        </button>
      </div>
      {msg && <p className="mt-2 text-[0.75rem] text-shale">{msg}</p>}
      {list && list.length > 0 && (
        <ul className="mt-2 max-h-40 space-y-1 overflow-auto">
          {list.map((d) => (
            <li key={d.id}>
              <button
                onClick={() => {
                  onOpen(d.payload);
                  setList(null);
                }}
                className="w-full text-left text-[0.78rem] hover:underline"
              >
                {d.name} <span className="text-shale">{new Date(d.created_at).toLocaleDateString()}</span>{" "}
                {d.integrity === "modified" && <span className="font-semibold text-oxide">modified outside AquaTrace</span>}
                {d.integrity === "intact" && <span className="text-verdigris">sealed</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
