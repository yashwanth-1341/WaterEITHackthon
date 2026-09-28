"use client";

import type { Balance } from "@/lib/metrics";
import { n0 } from "@/lib/format";

// One horizontal strip per site. The withdrawal is the full width (marked by a
// tick); discharge, consumption and storage change fill it. Anything that does
// not add up shows as hatched iron oxide: inside the strip when water is
// missing, past the tick when more water is reported out than came in.

type Props = { balance: Balance; compact?: boolean; id: string };

export default function BalanceStrip({ balance: b, compact = false, id }: Props) {
  const h = compact ? 8 : 30;
  const patternId = `hatch-${id}`;

  if (b.status === "unverifiable" || b.withdrawal === null || b.accounted === null) {
    return (
      <svg width="100%" height={h} role="img" aria-label="Water balance cannot be checked: data not disclosed">
        <rect x="0" y="0" width="100%" height={h} fill="none" stroke="var(--color-shale)" strokeDasharray="3 3" rx="1" />
        {!compact && (
          <text x="10" y={h / 2 + 4} fontSize="12" fill="var(--color-shale)">
            Not enough data to draw the balance
          </text>
        )}
      </svg>
    );
  }

  const total = Math.max(b.withdrawal, b.accounted);
  const scale = (v: number) => (Math.max(0, v) / total) * 100;
  const d = b.discharge ?? 0;
  const c = b.consumption ?? 0;
  const s = b.deltaStorage ?? 0;
  const gap = b.gap ?? 0;
  const closes = b.status === "closes";

  // Negative storage change means water was drawn from storage: it offsets consumption visually.
  const segs: { key: string; w: number; fill: string; label: string }[] = [
    { key: "d", w: scale(d), fill: "var(--color-sea)", label: `Discharge ${n0(d)} ML` },
    { key: "c", w: scale(c + Math.min(0, s)), fill: "var(--color-fresh)", label: `Consumption ${n0(c)} ML` },
    { key: "s", w: scale(Math.max(0, s)), fill: "var(--color-hairline)", label: `Into storage ${n0(s)} ML` },
  ];
  let x = 0;
  const withdrawalX = (b.withdrawal / total) * 100;
  const gapW = closes ? 0 : scale(Math.abs(gap));
  const gapX = gap > 0 ? withdrawalX - gapW : withdrawalX;

  const aria = closes
    ? `Balance closes: withdrawal ${n0(b.withdrawal)} ML equals discharge plus consumption plus storage change`
    : gap > 0
      ? `${n0(gap)} ML of water unaccounted for out of ${n0(b.withdrawal)} ML withdrawn`
      : `${n0(-gap)} ML more water reported out than the ${n0(b.withdrawal)} ML withdrawn`;

  return (
    <svg width="100%" height={h + (compact ? 0 : 4)} role="img" aria-label={aria} preserveAspectRatio="none">
      <defs>
        <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#f3dcd6" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-oxide)" strokeWidth="3" />
        </pattern>
      </defs>
      {segs.map((sg) => {
        const el = sg.w > 0 && (
          <rect key={sg.key} x={`${x}%`} y="0" width={`${sg.w}%`} height={h} fill={sg.fill}>
            <title>{sg.label}</title>
          </rect>
        );
        x += sg.w;
        return el;
      })}
      {gapW > 0 && (
        <rect x={`${gapX}%`} y="0" width={`${gapW}%`} height={h} fill={`url(#${patternId})`}>
          <title>{gap > 0 ? `Unaccounted for: ${n0(gap)} ML` : `Reported out but never withdrawn: ${n0(-gap)} ML`}</title>
        </rect>
      )}
      {/* Withdrawal tick: where the strip should end if the balance closes. */}
      <line
        x1={`${withdrawalX}%`}
        x2={`${withdrawalX}%`}
        y1={compact ? 0 : -2}
        y2={h + (compact ? 0 : 4)}
        stroke="var(--color-basalt)"
        strokeWidth={compact ? 1.5 : 2}
      />
    </svg>
  );
}
