"use client";

// Shared pieces for the passport views: data-set toggle, grade badge, stress dot, flag list.
import { SET_LABEL, type PassportSet } from "@/lib/passport/data";
import type { FlagLevel } from "@/lib/passport/metrics";
import { GRADES } from "@/lib/passport/metrics";
import { cx } from "@/lib/format";

export function SetToggle({ value, onChange }: { value: PassportSet; onChange: (s: PassportSet) => void }) {
  return (
    <div className="inline-flex rounded-md border border-hairline bg-white p-0.5" role="group" aria-label="Data set">
      {(["real", "demo"] as PassportSet[]).map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          aria-pressed={value === s}
          title={SET_LABEL[s].long}
          className={cx("rounded px-3 py-1.5 text-[0.8rem] font-medium", value === s ? (s === "demo" ? "bg-ochre text-white" : "bg-fresh text-white") : "text-shale hover:text-basalt")}
        >
          {SET_LABEL[s].short}
        </button>
      ))}
    </div>
  );
}

/** Banner that always says which data set is on screen. */
export function SetNote({ set }: { set: PassportSet }) {
  return (
    <p className={cx("mt-2 rounded-sm px-3 py-1.5 text-[0.78rem]", set === "demo" ? "bg-ochre/10 text-ochre" : "bg-fresh/5 text-shale")}>
      {set === "demo" ? "Fictional sites and figures, " : ""}
      {SET_LABEL[set].long}.
    </p>
  );
}

export function GradeBadge({ grade, size = "md" }: { grade: string; size?: "sm" | "md" | "lg" }) {
  const g = GRADES.find((x) => x.g === grade) ?? GRADES[4];
  const s = size === "lg" ? "h-20 w-20 text-[2.8rem]" : size === "sm" ? "h-6 w-6 text-[0.8rem]" : "h-9 w-9 text-[1.15rem]";
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center rounded-md font-bold text-white", s)} style={{ background: g.color }} title={`Grade ${g.g}: ${g.text}`} aria-label={`Grade ${g.g}, ${g.text}`}>
      {g.g}
    </span>
  );
}

export function StressDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}

const FLAG_STYLE: Record<FlagLevel, { mark: string; cls: string; label: string }> = {
  critical: { mark: "!", cls: "text-oxide", label: "Critical" },
  serious: { mark: "!", cls: "text-oxide", label: "Serious" },
  warning: { mark: "?", cls: "text-ochre", label: "Warning" },
  good: { mark: "✓", cls: "text-leaf", label: "OK" },
};

export function FlagList({ flags }: { flags: { lvl: FlagLevel; t: string }[] }) {
  return (
    <ul className="space-y-1.5">
      {flags.map((f, i) => (
        <li key={i} className="flex gap-2 rounded-sm bg-limestone/70 px-3 py-2 text-[0.84rem]">
          <span className={cx("w-3 font-bold", FLAG_STYLE[f.lvl].cls)} aria-hidden>
            {FLAG_STYLE[f.lvl].mark}
          </span>
          <span>
            <span className={cx("font-semibold", FLAG_STYLE[f.lvl].cls)}>{FLAG_STYLE[f.lvl].label}:</span> {f.t}
          </span>
        </li>
      ))}
    </ul>
  );
}

export const fmtN = (n: number | null | undefined, d = 0) => (n === null || n === undefined || Number.isNaN(n) ? "–" : n.toLocaleString("en-US", { maximumFractionDigits: d }));
