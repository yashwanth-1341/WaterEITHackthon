export const ml = (n: number | null | undefined, digits = 0) =>
  n === null || n === undefined ? "not disclosed" : `${n.toLocaleString("en-US", { maximumFractionDigits: digits })} ML`;

export const n0 = (n: number | null | undefined, digits = 0) =>
  n === null || n === undefined ? "–" : n.toLocaleString("en-US", { maximumFractionDigits: digits });

export const pct = (x: number | null | undefined, digits = 0) =>
  x === null || x === undefined ? "–" : `${(x * 100).toFixed(digits)}%`;

export const usdM = (usd: number) => `$${(usd / 1e6).toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}M`;

export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");
