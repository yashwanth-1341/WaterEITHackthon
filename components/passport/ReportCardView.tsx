"use client";

// Site report card: A–E grade, transparency score breakdown, mass balance, Tier-1 checklist,
// framework coverage, screening flags, and optional monthly profile.
// Ported from 02-mining-water-reporting/prototype/js/app.js (renderCard).
import { useMemo, useState } from "react";
import { Line, LineChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { passportsFor, type PassportSet } from "@/lib/passport/data";
import { balance, ddFlags, frameworkCoverage, kpis, QUALITY_COLOR, QUALITY_LABEL, TIER1, transparency } from "@/lib/passport/metrics";
import { cx } from "@/lib/format";
import { FlagList, fmtN, GradeBadge, SetNote, SetToggle, StressDot } from "./ui";
import { assuranceText, coords, siteDescriptor, COMMODITY_NAME } from "./cardHelpers";

interface Props {
  initialSet?: PassportSet;
  initialSiteId?: string | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function ScoreBar({ label, v, max, note }: { label: string; v: number; max: number; note: string }) {
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between text-[0.82rem]">
        <span>{label}</span>
        <span className="num text-shale">{v}/{max}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-limestone">
        <div className="h-2 rounded-full bg-fresh transition-all" style={{ width: `${(v / max) * 100}%` }} />
      </div>
      <div className="mt-0.5 text-[0.72rem] text-shale">{note}</div>
    </div>
  );
}

function BalanceBar({ W, D, C, dS, byQ }: { W: number; D: number; C: number; dS: number; byQ: Record<string, number> }) {
  const tot = Math.max(W, D + C + Math.max(0, dS));
  if (!tot) return null;
  const seg = (v: number, color: string, label: string) =>
    v > 0 ? { width: `${(v / tot) * 100}%`, color, label: v / tot > 0.12 ? label : "" } : null;

  const inputs = (["cat1", "cat2", "cat3", "unknown"] as const).map((q) =>
    seg(byQ[q] ?? 0, QUALITY_COLOR[q], q === "unknown" ? "n/a" : `Cat ${q.slice(3)}`)
  ).filter(Boolean);
  const resid = Math.max(0, W - D - C - Math.max(0, dS));
  const outputs = [
    seg(C, "#86270b", "Consumed"),
    seg(D, "#2a6fdb", "Discharged"),
    seg(Math.max(0, dS), "#8d8a80", "+Storage"),
    seg(resid, "#e6a8a8", "Unaccounted"),
  ].filter(Boolean);

  return (
    <div className="mt-3">
      <div className="mb-1 text-[0.72rem] text-shale">Inputs by quality (ML)</div>
      <div className="flex h-5 w-full overflow-hidden rounded-sm">
        {inputs.map((s, i) => (
          <div key={i} style={{ width: s!.width, background: s!.color }} className="flex items-center justify-center text-[0.65rem] font-semibold text-white/90">
            {s!.label}
          </div>
        ))}
      </div>
      <div className="mb-1 mt-2 text-[0.72rem] text-shale">Outputs (ML)</div>
      <div className="flex h-5 w-full overflow-hidden rounded-sm">
        {outputs.map((s, i) => (
          <div key={i} style={{ width: s!.width, background: s!.color }} className="flex items-center justify-center text-[0.65rem] font-semibold text-white/90">
            {s!.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReportCardView({ initialSet = "demo", initialSiteId = null }: Props) {
  const [set, setSet] = useState<PassportSet>(initialSet);
  const passports = useMemo(() => passportsFor(set), [set]);
  const [selId, setSelId] = useState<string | null>(initialSiteId ?? passports[0]?.site.site_id ?? null);

  const changeSet = (s: PassportSet) => {
    setSet(s);
    setSelId(null);
  };

  const passport = useMemo(() => {
    const id = selId ?? passports[0]?.site.site_id;
    return passports.find((p) => p.site.site_id === id) ?? passports[0] ?? null;
  }, [passports, selId]);

  const t = useMemo(() => (passport ? transparency(passport) : null), [passport]);
  const k = useMemo(() => (passport ? kpis(passport) : null), [passport]);
  const b = useMemo(() => (passport ? balance(passport) : null), [passport]);
  const cov = useMemo(() => (passport ? frameworkCoverage(passport) : []), [passport]);
  const flags = useMemo(() => (passport ? ddFlags(passport) : []), [passport]);
  const byQ = useMemo(() => k?.byQ ?? { cat1: 0, cat2: 0, cat3: 0, unknown: 0 }, [k]);

  const monthlyData = useMemo(() =>
    passport?.water.monthly?.map((m, i) => ({
      month: MONTHS[i] ?? String(m.month),
      withdrawal: m.withdrawal_ml,
      consumption: m.consumption_ml,
    })) ?? null,
    [passport]
  );

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.6rem] font-semibold tracking-tight">Site report card</h1>
          <p className="mt-2 max-w-3xl text-[0.95rem] leading-relaxed text-shale">
            One-page summary per mine: A–E transparency grade, mass balance, framework coverage and due-diligence screening flags.
          </p>
        </div>
        <SetToggle value={set} onChange={changeSet} />
      </div>
      <SetNote set={set} />

      {/* Site selector */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-[0.85rem] font-medium">Site:</label>
        <select
          value={passport?.site.site_id ?? ""}
          onChange={(e) => setSelId(e.target.value)}
          className="max-w-xs rounded-sm border border-hairline bg-white px-3 py-1.5 text-[0.85rem]"
          aria-label="Select site"
        >
          {passports.map((p) => (
            <option key={p.site.site_id} value={p.site.site_id}>
              {p.site.name} ({p.site.country})
            </option>
          ))}
        </select>
      </div>

      {passport && t && k && b ? (
        <div className="mt-6 rounded-xl border border-hairline bg-white p-6">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <GradeBadge grade={t.grade.g} size="lg" />
              <div>
                <div className="text-[0.72rem] font-semibold uppercase tracking-widest text-shale">
                  MineWater Passport · Site Report Card · {passport.period.year}
                </div>
                <h2 className="mt-1 text-[1.4rem] font-bold tracking-tight">{passport.site.name}</h2>
                <div className="mt-0.5 text-[0.85rem] text-shale">
                  {passport.site.operator} · {passport.site.country} · {coords(passport)}
                </div>
                <div className="mt-0.5 text-[0.82rem] text-shale">
                  {siteDescriptor(passport)} · {passport.tier.toUpperCase()} · Assurance: {assuranceText(passport)}
                </div>
                <div className="mt-1 text-[0.85rem]">
                  Transparency <span className="font-semibold">{t.score}/100</span>
                  <span className="text-shale"> – {t.grade.text}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[0.72rem] text-shale">Basin stress</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-block h-3.5 w-3.5 rounded-full" style={{ background: k.stress.color }} />
                <span className="text-[1rem] font-semibold">{k.stress.label}</span>
              </div>
              {passport.site.basin?.name && (
                <div className="mt-0.5 text-[0.72rem] text-shale">{passport.site.basin.name}</div>
              )}
            </div>
          </div>

          {/* KPI tiles */}
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-hairline pt-4 sm:grid-cols-4">
            <KPITile label="Withdrawal" value={fmtN(k.W)} unit="ML" />
            <KPITile label="Consumption" value={fmtN(k.C)} unit={`ML · ${isNaN(k.consumptionRatio) ? "–" : Math.round(k.consumptionRatio * 100) + "%"}`} />
            <KPITile
              label="Intensity"
              value={!isNaN(k.cPerOre) ? fmtN(k.cPerOre, 1) : fmtN(k.cPerMetal)}
              unit={!isNaN(k.cPerOre) ? "m³/t ore" : k.metalBasis === "LCE" ? "m³/t LCE" : "m³/t metal"}
            />
            <KPITile
              label={`Per t ${k.metalBasis === "LCE" ? "LCE" : passport.site.primary_commodity ?? "metal"}`}
              value={fmtN(k.cPerMetal)}
              unit="m³ consumed (alloc.)"
            />
          </div>

          {/* Main body: two columns */}
          <div className="mt-6 grid gap-8 border-t border-hairline pt-5 lg:grid-cols-2">
            {/* Left: balance + monthly */}
            <div>
              <h3 className="text-[0.95rem] font-semibold">Site water balance</h3>
              <BalanceBar
                W={k.W}
                D={b.D}
                C={b.C}
                dS={b.dS}
                byQ={byQ}
              />
              <p className="mt-2 text-[0.82rem] text-shale">
                Balance residual <span className="font-semibold">{b.known ? `${(b.pct * 100).toFixed(1)}%` : "–"}</span> of withdrawal{" "}
                {b.known
                  ? b.ok
                    ? <span className="text-leaf">(within ±5% tolerance ✓)</span>
                    : <span className="text-oxide">(outside ±5% tolerance — unreported flows?)</span>
                  : "(cannot close: a flow is missing)"}
                {" "}· <span className="font-semibold">{Math.round(t.measuredShare * 100)}%</span> of volume metered
              </p>

              {monthlyData ? (
                <>
                  <h3 className="mt-5 text-[0.95rem] font-semibold">Seasonality (monthly, ML)</h3>
                  <div className="mt-2 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="var(--color-hairline)" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--color-shale)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "var(--color-shale)" }} axisLine={false} tickLine={false} width={50} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 4 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line dataKey="withdrawal" name="Withdrawal" stroke="#2a6fdb" strokeWidth={2} dot={false} isAnimationActive={false} />
                        <Line dataKey="consumption" name="Consumption" stroke="#eb6834" strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <p className="mt-4 text-[0.82rem] text-shale">
                  No monthly profile reported (Tier 2 item) — seasonal stress cannot be assessed.
                </p>
              )}
            </div>

            {/* Right: score + tier1 + framework + flags */}
            <div>
              <h3 className="text-[0.95rem] font-semibold">Score breakdown</h3>
              {t.parts.map((p) => (
                <ScoreBar key={p.k} label={p.k} v={p.v} max={p.max} note={p.note} />
              ))}

              <h3 className="mt-6 text-[0.95rem] font-semibold">Tier 1 data points</h3>
              <ul className="mt-2 space-y-1">
                {t.tier1.map((x) => (
                  <li key={x.no} className="flex items-start gap-2 text-[0.82rem]">
                    <span className={cx("mt-0.5 shrink-0 font-bold", x.ok ? "text-leaf" : "text-oxide")}>
                      {x.ok ? "✓" : "✗"}
                    </span>
                    <span>
                      <span className="text-shale">{x.no}.</span> {x.label}
                    </span>
                  </li>
                ))}
              </ul>

              <h3 className="mt-6 text-[0.95rem] font-semibold">Framework coverage from this passport</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {cov.map((c) => (
                  <span
                    key={c.id}
                    className={cx(
                      "rounded-sm border px-2 py-1 text-[0.78rem] font-medium",
                      c.status === "ok"
                        ? "border-leaf/30 bg-leaf/10 text-leaf"
                        : c.status === "partial"
                        ? "border-ochre/30 bg-ochre/10 text-ochre"
                        : "border-oxide/30 bg-oxide/10 text-oxide"
                    )}
                  >
                    {c.status === "ok" ? "✓ " : c.status === "partial" ? "◑ " : "✗ "}
                    {c.id}
                  </span>
                ))}
              </div>

              <h3 className="mt-6 text-[0.95rem] font-semibold">Screening flags</h3>
              <div className="mt-2">
                <FlagList flags={flags} />
              </div>
            </div>
          </div>

          {/* Sources */}
          {passport.sources?.length ? (
            <div className="mt-5 border-t border-hairline pt-4 text-[0.75rem] text-shale">
              <span className="font-semibold">Sources: </span>
              {passport.sources.map((s, i) => (
                <span key={i}>
                  {i > 0 && " · "}
                  {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-fresh underline underline-offset-2">{s.title ?? s.url}</a> : (s.title ?? "unnamed")}
                  {s.page ? ` p.${s.page}` : ""}
                </span>
              ))}
            </div>
          ) : null}

          {passport.synthetic && (
            <div className="mt-4 rounded-sm border border-ochre/30 bg-ochre/5 px-3 py-2 text-[0.75rem] text-ochre">
              Illustrative synthetic data. Fictional site, operator and figures. Basin stress is a placeholder; scoring weights are a prototype proposal.
            </div>
          )}
        </div>
      ) : (
        <p className="mt-8 text-[0.9rem] text-shale">No passport selected.</p>
      )}
    </div>
  );
}

function KPITile({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-sm bg-limestone/60 px-3 py-2">
      <div className="text-[0.7rem] text-shale">{label}</div>
      <div className="num mt-0.5 text-[1.35rem] font-bold leading-none">{value}</div>
      <div className="mt-0.5 text-[0.7rem] text-shale">{unit}</div>
    </div>
  );
}
