"use client";

// Supply-chain lens for buyers: water footprint per tonne of metal across candidate supplier sites,
// split by water quality and coloured by basin stress, plus a sourcing-mix simulator and supplier
// screening. Port of the MineWater Passport prototype, tab 3.
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { passportsFor, type PassportSet } from "@/lib/passport/data";
import { ddFlags, footprint, kpis, STRESS, STRESS_UNKNOWN, transparency, type Passport } from "@/lib/passport/metrics";
import { cx } from "@/lib/format";
import { FlagList, fmtN, GradeBadge, SetNote, SetToggle, StressDot } from "./ui";
import { BATTERY, COMMODITY_NAME, isFiniteNum, QUALITY_COLOR, QUALITY_KEYS, QUALITY_SHORT, shortName, unitFor } from "./cardHelpers";

interface Props {
  initialSet?: PassportSet;
  onOpenCard?: (siteId: string, set: PassportSet) => void;
}

const DEMO_COMMODITIES = ["Cu", "Li", "Ni", "Co"];
const tick = { fontSize: 12, fill: "var(--color-shale)" };

function commoditiesFor(set: PassportSet, ps: Passport[]) {
  if (set === "demo") return DEMO_COMMODITIES;
  const n: Record<string, number> = {};
  for (const p of ps) for (const pr of p.production.products ?? []) if (footprint(p, pr.commodity)) n[pr.commodity] = (n[pr.commodity] ?? 0) + 1;
  return Object.keys(n)
    .filter((c) => n[c] >= 2)
    .sort((a, b) => n[b] - n[a]);
}

export default function SupplyChainView({ initialSet = "demo", onOpenCard }: Props) {
  const [set, setSet] = useState<PassportSet>(initialSet);
  const passports = useMemo(() => passportsFor(set), [set]);
  const commodities = useMemo(() => commoditiesFor(set, passports), [set, passports]);
  const [com, setCom] = useState<string>(initialSet === "demo" ? "Li" : "");
  const commodity = commodities.includes(com) ? com : commodities[0] ?? "Cu";
  const [shares, setShares] = useState<Record<string, number>>({});
  const [sel, setSel] = useState<string | null>(null);

  const unit = unitFor(commodity);
  const sites = useMemo(() => {
    const rows = passports
      .map((r) => ({ r, f: footprint(r, commodity), k: kpis(r), t: transparency(r) }))
      .filter((x): x is typeof x & { f: NonNullable<typeof x.f> } => !!x.f);
    return rows.sort((a, b) => {
      const ca = isFiniteNum(a.f.c), cb = isFiniteNum(b.f.c);
      if (ca !== cb) return ca ? -1 : 1;
      return ca ? b.f.c - a.f.c : b.f.w - a.f.w;
    });
  }, [passports, commodity]);

  const changeSet = (s: PassportSet) => {
    setSet(s);
    setShares({});
    setSel(null);
  };
  const changeCom = (c: string) => {
    setCom(c);
    setShares({});
    setSel(null);
  };

  const cRows = sites.filter((x) => isFiniteNum(x.f.c)).map((x) => ({ name: shortName(x.r.site.name), c: Math.round(x.f.c), color: x.k.stress.color, stress: x.k.stress.label, alloc: x.f.alloc }));
  const noC = sites.length - cRows.length;
  const wRows = sites.map((x) => ({ name: shortName(x.r.site.name), ...Object.fromEntries(QUALITY_KEYS.map((q) => [q, Math.round(x.f.byQ[q])])) }));
  const qKeys = QUALITY_KEYS.filter((q) => sites.some((x) => x.f.byQ[q] > 0));
  const h = (n: number) => Math.max(180, n * 30 + 70);

  // Sourcing mix
  const def = sites.length ? Math.max(1, Math.round(100 / sites.length)) : 0;
  const share = (id: string) => shares[id] ?? def;
  const mix = useMemo(() => {
    const tot = sites.reduce((a, x) => a + (shares[x.r.site.site_id] ?? def), 0) || 1;
    let c = 0, cw = 0, fresh = 0, unkQ = 0, wAll = 0, hs = 0, unkS = 0, ass = 0, ab = 0;
    for (const x of sites) {
      const w = (shares[x.r.site.site_id] ?? def) / tot;
      if (isFiniteNum(x.f.c)) (c += w * x.f.c), (cw += w);
      fresh += w * x.f.byQ.cat1;
      unkQ += w * x.f.byQ.unknown;
      wAll += w * x.f.w;
      if (x.k.stress.rank >= 4) hs += w;
      if (!x.k.stress.rank) unkS += w;
      const l = x.r.assurance.level;
      if (l === "limited" || l === "reasonable") ass += w;
      if (x.t.grade.g === "A" || x.t.grade.g === "B") ab += w;
    }
    return { c: cw ? c / cw : NaN, cCover: cw, fresh, unkQ: wAll ? unkQ / wAll : 0, hs, unkS, ass, ab };
  }, [sites, shares, def]);

  const selected = sites.find((x) => x.r.site.site_id === sel) ?? sites[0];

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.6rem] font-semibold tracking-tight">Supply-chain lens for buyers</h1>
          <p className="mt-2 max-w-3xl text-[0.95rem] leading-relaxed text-shale">
            Pick a metal and compare the water footprint per tonne across candidate supplier sites: split by water quality, coloured by basin stress. Then
            test a sourcing mix and screen a supplier.
          </p>
        </div>
        <SetToggle value={set} onChange={changeSet} />
      </div>
      <SetNote set={set} />

      <div className="mt-5 flex flex-wrap items-center gap-1.5" role="group" aria-label="Commodity">
        {commodities.map((c) => (
          <button
            key={c}
            onClick={() => changeCom(c)}
            aria-pressed={commodity === c}
            className={cx("rounded-sm border px-3 py-1.5 text-[0.82rem]", commodity === c ? "border-fresh bg-fresh text-white" : "border-hairline hover:border-shale")}
          >
            {COMMODITY_NAME[c] ?? c}
          </button>
        ))}
        {set === "real" && (
          <span className="ml-2 text-[0.78rem] text-ochre">Co-product allocation not disclosed, full site water assigned to each metal.</span>
        )}
      </div>

      {!sites.length ? (
        <p className="mt-6 text-[0.9rem] text-shale">No site in this data set discloses production of {COMMODITY_NAME[commodity] ?? commodity}.</p>
      ) : (
        <>
          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            <section>
              <h2 className="text-[1.05rem] font-semibold">Consumption per t metal (allocated)</h2>
              <p className="text-[0.78rem] text-shale">Coloured by basin water stress. {unit}.</p>
              {cRows.length ? (
                <div className="mt-3" style={{ height: h(cRows.length) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cRows} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 16 }}>
                      <CartesianGrid horizontal={false} stroke="var(--color-hairline)" strokeDasharray="2 3" />
                      <XAxis type="number" tick={tick} axisLine={false} tickLine={false} tickFormatter={(v) => fmtN(v)} label={{ value: `Water consumed (${unit})`, position: "insideBottom", offset: -10, fontSize: 12, fill: "var(--color-shale)" }} />
                      <YAxis type="category" dataKey="name" width={190} tick={tick} axisLine={false} tickLine={false} interval={0} />
                      <Tooltip formatter={(v, _n, p) => [`${fmtN(Number(v))} ${unit} · ${p.payload.stress} stress · allocation ${Math.round(p.payload.alloc * 100)}%`, "Consumption"]} />
                      <Bar dataKey="c" isAnimationActive={false} barSize={16} radius={[0, 3, 3, 0]}>
                        {cRows.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="mt-3 text-[0.84rem] text-shale">No site discloses consumption.</p>
              )}
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[0.76rem] text-shale">
                {[...Object.values(STRESS), STRESS_UNKNOWN].map((s) => (
                  <StressDot key={s.label} color={s.color} label={s.label} />
                ))}
              </div>
              {noC > 0 && <p className="mt-2 text-[0.76rem] text-shale">{noC} more site{noC === 1 ? "" : "s"} report withdrawal but not consumption, so they are left out here.</p>}
            </section>

            <section>
              <h2 className="text-[1.05rem] font-semibold">Withdrawal per t metal by water quality</h2>
              <p className="text-[0.78rem] text-shale">MCA Water Accounting Framework categories. {unit}.</p>
              <div className="mt-3" style={{ height: h(wRows.length) + 24 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={wRows} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 16 }}>
                    <CartesianGrid horizontal={false} stroke="var(--color-hairline)" strokeDasharray="2 3" />
                    <XAxis type="number" tick={tick} axisLine={false} tickLine={false} tickFormatter={(v) => fmtN(v)} label={{ value: `Water withdrawn (${unit})`, position: "insideBottom", offset: -10, fontSize: 12, fill: "var(--color-shale)" }} />
                    <YAxis type="category" dataKey="name" width={190} tick={tick} axisLine={false} tickLine={false} interval={0} />
                    <Tooltip formatter={(v, n) => [`${fmtN(Number(v))} ${unit}`, QUALITY_SHORT[n as keyof typeof QUALITY_SHORT] ?? n]} />
                    <Legend verticalAlign="top" height={26} iconType="square" iconSize={10} formatter={(v) => <span className="text-[0.76rem] text-shale">{QUALITY_SHORT[v as keyof typeof QUALITY_SHORT]}</span>} />
                    {qKeys.map((q) => (
                      <Bar key={q} dataKey={q} stackId="w" fill={QUALITY_COLOR[q]} stroke="#fff" strokeWidth={1} isAnimationActive={false} barSize={16} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-[0.76rem] leading-relaxed text-shale">
                Brine sites withdraw a lot of Cat 3 (saline) water but little freshwater. A single litres-per-tonne number hides that; a passport reports both.
              </p>
            </section>
          </div>

          <div className="mt-8 grid gap-8 border-t border-hairline pt-6 lg:grid-cols-2">
            <section>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[1.05rem] font-semibold">Sourcing-mix simulator</h2>
                <button onClick={() => setShares({})} className="text-[0.82rem] text-fresh underline underline-offset-2">
                  Reset to equal
                </button>
              </div>
              <p className="text-[0.78rem] text-shale">Set the share of annual offtake from each site. Results update live.</p>
              <div className="mt-3 max-h-[26rem] space-y-1.5 overflow-y-auto pr-1">
                {sites.map((x) => {
                  const id = x.r.site.site_id;
                  return (
                    <label key={id} className="grid grid-cols-[1fr_8rem_2.2rem] items-center gap-3 text-[0.84rem]">
                      <span className="truncate">
                        {x.r.site.name} <span className="num text-[0.72rem] text-shale">{isFiniteNum(x.f.c) ? `${fmtN(x.f.c)} ${unit}` : "consumption n/a"}</span>
                      </span>
                      <input type="range" min={0} max={100} value={share(id)} onChange={(e) => setShares((s) => ({ ...s, [id]: Number(e.target.value) }))} className="accent-fresh" aria-label={`Offtake share from ${x.r.site.name}`} />
                      <span className="num text-right">{share(id)}</span>
                    </label>
                  );
                })}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Tile label="Blended consumption" value={fmtN(mix.c)} unit={unit} note={mix.cCover < 0.999 && mix.cCover > 0 ? `over the ${Math.round(mix.cCover * 100)}% of offtake with disclosed consumption` : undefined} />
                <Tile label="Freshwater-grade (Cat 1) withdrawal" value={fmtN(mix.fresh)} unit={unit} note={mix.unkQ > 0.01 ? `${Math.round(mix.unkQ * 100)}% of withdrawal has no stated quality` : undefined} />
                <Tile label="Volume from high-stress basins" value={String(Math.round(mix.hs * 100))} unit="%" tone={mix.hs > 0.5 ? "bad" : undefined} note={mix.unkS > 0.01 ? `${Math.round(mix.unkS * 100)}% from sites with no stress assessment` : undefined} />
                <Tile label="Offtake from assured / grade A–B sites" value={`${Math.round(mix.ass * 100)}% / ${Math.round(mix.ab * 100)}`} unit="%" />
              </div>
            </section>

            <section>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-[1.05rem] font-semibold">Supplier screening</h2>
                <select
                  value={selected?.r.site.site_id ?? ""}
                  onChange={(e) => setSel(e.target.value)}
                  aria-label="Supplier site"
                  className="max-w-[16rem] rounded-sm border border-hairline bg-white px-2 py-1.5 text-[0.84rem]"
                >
                  {sites.map((x) => (
                    <option key={x.r.site.site_id} value={x.r.site.site_id}>
                      {x.r.site.name}
                    </option>
                  ))}
                </select>
              </div>
              {selected && (
                <>
                  <div className="mt-3 flex items-center gap-3">
                    <GradeBadge grade={selected.t.grade.g} size="sm" />
                    {onOpenCard ? (
                      <button onClick={() => onOpenCard(selected.r.site.site_id, set)} className="text-left font-semibold text-fresh underline underline-offset-2" title="Open the site report card">
                        {selected.r.site.name}
                      </button>
                    ) : (
                      <span className="font-semibold">{selected.r.site.name}</span>
                    )}
                    <span className="text-[0.78rem] text-shale">
                      {selected.r.site.operator} · {selected.r.site.country}
                    </span>
                  </div>
                  <div className="mt-3">
                    <FlagList flags={ddFlags(selected.r)} />
                  </div>
                </>
              )}
              <div className="mt-4 rounded-sm border-l-2 border-fresh bg-fresh/5 px-4 py-3 text-[0.84rem] leading-relaxed">
                <span className="font-semibold">Why a buyer needs this: </span>
                {BATTERY.has(commodity)
                  ? "The EU Batteries Regulation (EU) 2023/1542 requires battery due-diligence policies (Art. 47–48) covering cobalt, lithium, natural graphite and nickel; Annex X lists water-related environmental risks. Obligations apply from 18 Aug 2027 (postponed by Reg. (EU) 2025/1561)."
                  : "Copper is a strategic raw material under the Critical Raw Materials Act (EU) 2024/1252, and ESRS E3 asks buyers' suppliers for water data in stressed areas."}{" "}
                A passport gives the site-level evidence those checks need.
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, unit, note, tone }: { label: string; value: string; unit: string; note?: string; tone?: "bad" }) {
  return (
    <div className="rounded-sm border border-hairline bg-white px-4 py-3">
      <div className="text-[0.78rem] text-shale">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className={cx("num cond text-[2.2rem] font-bold leading-none", tone === "bad" ? "text-oxide" : "text-basalt")}>{value}</span>
        <span className="text-[0.78rem] text-shale">{unit}</span>
      </div>
      {note && <div className="mt-1 text-[0.72rem] text-ochre">{note}</div>}
    </div>
  );
}
