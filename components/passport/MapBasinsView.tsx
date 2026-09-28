"use client";

// Explorer: Leaflet map (colour = basin stress, size = consumption or withdrawal) +
// sortable comparison table + detail panel.
// Ported from 02-mining-water-reporting/prototype/js/app.js (initExplorer / renderTable / renderDetail).
import { useEffect, useMemo, useRef, useState } from "react";
import { passportsFor, type PassportSet } from "@/lib/passport/data";
import { buildRows, balanceNote, radius, sizeVal, summary, tooltipHtml, type Row, type SizeKey } from "./mapHelpers";
import { ddFlags, frameworkCoverage, STRESS, STRESS_UNKNOWN, type Passport } from "@/lib/passport/metrics";
import { cx } from "@/lib/format";
import { FlagList, fmtN, GradeBadge, SetNote, SetToggle, StressDot } from "./ui";
import { COMMODITY_NAME, shortName, siteDescriptor, coords, assuranceText } from "./cardHelpers";

// ---- types -----------------------------------------------------------------

interface Props {
  initialSet?: PassportSet;
  onOpenCard?: (siteId: string, set: PassportSet) => void;
}

type SortKey = "name" | "W" | "C" | "ratio" | "cPerOre" | "cPerMetal" | "stress" | "swc" | "balance" | "grade";

const COLS: { k: SortKey; label: string; num?: boolean }[] = [
  { k: "name", label: "Site" },
  { k: "W", label: "W (ML)", num: true },
  { k: "C", label: "C (ML)", num: true },
  { k: "ratio", label: "C/W", num: true },
  { k: "cPerOre", label: "m³/t ore", num: true },
  { k: "cPerMetal", label: "m³/t metal", num: true },
  { k: "stress", label: "Stress" },
  { k: "swc", label: "Stress-wtd C", num: true },
  { k: "balance", label: "Balance" },
  { k: "grade", label: "Grade" },
];

// ---- helpers ----------------------------------------------------------------

const COMMODITIES = ["Cu", "Li", "Ni", "Co", "Au", "Zn", "Ni"];

function sortVal(r: Row, k: SortKey): number | string {
  switch (k) {
    case "name": return r.p.site.name;
    case "W": return r.k.W || 0;
    case "C": return r.k.C || 0;
    case "ratio": return r.k.consumptionRatio || 0;
    case "cPerOre": return r.k.cPerOre || 0;
    case "cPerMetal": return r.k.cPerMetal || 0;
    case "stress": return r.k.stress.rank;
    case "swc": return r.k.stressWeightedC || 0;
    case "balance": return r.k.balance.known ? Math.abs(r.k.balance.pct) : 999;
    case "grade": return r.t.score;
    default: return 0;
  }
}

function comFilter(r: Row, com: string) {
  if (com === "all") return true;
  return (r.p.production.products ?? []).some((p) => p.commodity === com);
}

function fmtBal(r: Row) {
  const b = r.k.balance;
  if (!b.known) return <span className="text-ochre text-[0.78rem]">–</span>;
  const s = `${(b.pct * 100).toFixed(1)}%`;
  return b.ok
    ? <span className="rounded-sm bg-leaf/10 px-1.5 py-0.5 text-[0.75rem] text-leaf">{s}</span>
    : <span className="rounded-sm bg-oxide/10 px-1.5 py-0.5 text-[0.75rem] text-oxide">{s}</span>;
}

// ---- component --------------------------------------------------------------

export default function MapBasinsView({ initialSet = "demo", onOpenCard }: Props) {
  const [set, setSet] = useState<PassportSet>(initialSet);
  const passports = useMemo(() => passportsFor(set), [set]);
  const rows = useMemo(() => buildRows(passports), [passports]);
  const sum = useMemo(() => summary(rows), [rows]);

  const [sizeKey, setSizeKey] = useState<SizeKey>("C");
  const [com, setCom] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("swc");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [selId, setSelId] = useState<string | null>(rows[0]?.id ?? null);

  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafRef = useRef<{
    map: L.Map;
    markers: Record<string, L.CircleMarker>;
  } | null>(null);

  // ---- filtered + sorted table rows -----------------------------------------
  const filtered = useMemo(() => {
    const f = rows.filter((r) => comFilter(r, com));
    return [...f].sort((a, b) => {
      const x = sortVal(a, sortKey), y = sortVal(b, sortKey);
      if (typeof x === "string") return sortDir * x.localeCompare(y as string);
      const nx = x as number, ny = y as number;
      if (isNaN(nx)) return 1; if (isNaN(ny)) return -1;
      return sortDir * (nx - ny);
    });
  }, [rows, com, sortKey, sortDir]);

  const selected = rows.find((r) => r.id === selId) ?? rows[0];

  // ---- Leaflet map -----------------------------------------------------------
  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !mapRef.current) return;

      // Destroy previous instance if any
      if (leafRef.current) {
        leafRef.current.map.remove();
        leafRef.current = null;
      }

      const mapRows = rows.filter((r) => r.onMap);
      if (!mapRows.length) return;

      const map = L.map(mapRef.current, {
        zoomSnap: 0.25,
        worldCopyJump: false,
        minZoom: 1.5,
        maxZoom: 8,
        attributionControl: true,
      });

      map.fitBounds(
        mapRows.map((r) => [r.p.site.latitude!, r.p.site.longitude!] as L.LatLngTuple),
        { padding: [30, 30] }
      );
      map.attributionControl.setPrefix("");
      map.attributionControl.addAttribution("Basemap: Natural Earth (public domain)");

      // Basemap
      try {
        const res = await fetch("/geo/world-50m.json");
        if (!cancelled && res.ok) {
          const geo = await res.json();
          if (!cancelled) {
            L.geoJSON(geo, {
              style: { color: "#bdb9ad", weight: 0.6, fillColor: "#f8f6f0", fillOpacity: 1 },
              interactive: false,
            }).addTo(map);
          }
        }
      } catch { /* basemap optional */ }

      if (cancelled) { map.remove(); return; }

      const markers: Record<string, L.CircleMarker> = {};
      const maxVal = Math.max(...rows.map((r) => sizeVal(r, sizeKey)));

      for (const r of mapRows) {
        const hot = r.hot;
        const m = L.circleMarker([r.p.site.latitude!, r.p.site.longitude!], {
          radius: radius(sizeVal(r, sizeKey), maxVal),
          color: hot ? "#111" : "#333",
          weight: hot ? 2.5 : 1,
          fillColor: r.k.stress.color,
          fillOpacity: 0.88,
        });
        m.bindTooltip(tooltipHtml(r), { direction: "top", offset: [0, -6] });
        m.on("click", () => setSelId(r.id));
        m.addTo(map);
        markers[r.id] = m;
      }

      leafRef.current = { map, markers };
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  // Resize markers when sizeKey changes
  useEffect(() => {
    const ref = leafRef.current;
    if (!ref) return;
    const maxVal = Math.max(...rows.map((r) => sizeVal(r, sizeKey)));
    for (const r of rows) {
      if (ref.markers[r.id]) {
        ref.markers[r.id].setRadius(radius(sizeVal(r, sizeKey), maxVal));
      }
    }
  }, [sizeKey, rows]);

  // Highlight selected marker
  useEffect(() => {
    const ref = leafRef.current;
    if (!ref) return;
    for (const r of rows) {
      const m = ref.markers[r.id];
      if (!m) continue;
      const hot = r.hot;
      m.setStyle({
        weight: r.id === selId ? 4 : hot ? 2.5 : 1,
        color: r.id === selId ? "#1c5cab" : hot ? "#111" : "#333",
      });
      if (r.id === selId) m.bringToFront();
    }
  }, [selId, rows]);

  // ---- available commodities for filter -------------------------------------
  const availComs = useMemo(() => {
    const present = new Set<string>();
    for (const r of rows) for (const p of r.p.production.products ?? []) present.add(p.commodity);
    return ["all", ...COMMODITIES.filter((c) => present.has(c)), ...[...present].filter((c) => !COMMODITIES.includes(c))];
  }, [rows]);

  const handleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === -1 ? 1 : -1));
    else { setSortKey(k); setSortDir(-1); }
  };

  const changeSet = (s: PassportSet) => {
    setSet(s);
    setSelId(null);
  };

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.6rem] font-semibold tracking-tight">Site explorer</h1>
          <p className="mt-2 max-w-3xl text-[0.95rem] leading-relaxed text-shale">
            {sum.sites} mine sites. Colour = basin water stress. Size = water {sizeKey === "C" ? "consumed" : "withdrawn"} (ML).
            Bold ring = hotspot (high stress × high consumption).
          </p>
        </div>
        <SetToggle value={set} onChange={changeSet} />
      </div>
      <SetNote set={set} />

      {/* Summary tiles */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Sites with a passport" value={String(sum.sites)} sub={`${sum.tier2} at Tier 2 (full balance)`} />
        <Tile label="Water withdrawn" value={fmtN(sum.W / 1000, 1)} unit="GL" sub="all sources incl. seawater & brine" />
        <Tile label="Water consumed" value={fmtN(sum.C / 1000, 1)} unit="GL" sub={`${Math.round(sum.notReturned * 100)}% of withdrawal not returned`} />
        <Tile label="In high-stress basins" value={`${Math.round(sum.highStressShare * 100)}%`} sub="of consumption in high / extremely high / arid basins" />
      </div>

      {/* Map controls */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border border-hairline bg-white p-0.5" role="group" aria-label="Marker size">
          {(["C", "W"] as SizeKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setSizeKey(k)}
              aria-pressed={sizeKey === k}
              className={cx("rounded px-3 py-1.5 text-[0.8rem] font-medium", sizeKey === k ? "bg-fresh text-white" : "text-shale hover:text-basalt")}
            >
              Size: {k === "C" ? "Consumption" : "Withdrawal"}
            </button>
          ))}
        </div>
        <div className="inline-flex flex-wrap gap-1" role="group" aria-label="Commodity filter">
          {availComs.map((c) => (
            <button
              key={c}
              onClick={() => setCom(c)}
              aria-pressed={com === c}
              className={cx("rounded-sm border px-2.5 py-1 text-[0.78rem]", com === c ? "border-fresh bg-fresh text-white" : "border-hairline hover:border-shale")}
            >
              {c === "all" ? "All" : COMMODITY_NAME[c] ?? c}
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="mt-4 overflow-hidden rounded-xl border border-hairline" style={{ height: 380 }}>
        <div ref={mapRef} style={{ height: "100%", width: "100%" }} />
      </div>

      {/* Map legend */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.76rem] text-shale">
        <span className="font-semibold">Basin stress:</span>
        {[...Object.values(STRESS), STRESS_UNKNOWN].map((s) => (
          <StressDot key={s.label} color={s.color} label={s.label} />
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Table */}
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full text-[0.82rem]">
            <thead>
              <tr className="border-b border-basalt text-left text-[0.72rem] text-shale">
                {COLS.map((c) => (
                  <th
                    key={c.k}
                    onClick={() => handleSort(c.k)}
                    className={cx("cursor-pointer whitespace-nowrap py-2 pr-3 font-medium hover:text-fresh", c.num ? "text-right" : "")}
                  >
                    {c.label}
                    {sortKey === c.k ? (sortDir === -1 ? " ▼" : " ▲") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelId(r.id)}
                  className={cx("cursor-pointer border-b border-hairline", r.id === selId ? "bg-sea/10" : "hover:bg-limestone/60")}
                >
                  <td className="py-2 pr-3">
                    <span className={cx("font-semibold", r.hot ? "text-oxide" : "")}>{shortName(r.p.site.name)}</span>
                    <span className="ml-1.5 text-[0.72rem] text-shale">{r.p.site.country}</span>
                  </td>
                  <td className="num py-2 pr-3 text-right">{fmtN(r.k.W)}</td>
                  <td className="num py-2 pr-3 text-right">{fmtN(r.k.C)}</td>
                  <td className="num py-2 pr-3 text-right">
                    {isNaN(r.k.consumptionRatio) ? "–" : `${Math.round(r.k.consumptionRatio * 100)}%`}
                  </td>
                  <td className="num py-2 pr-3 text-right">{fmtN(r.k.cPerOre, 1)}</td>
                  <td className="num py-2 pr-3 text-right">{fmtN(r.k.cPerMetal)}</td>
                  <td className="py-2 pr-3">
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.k.stress.color }} />
                      <span className="text-[0.72rem]">{r.k.stress.label.replace("Arid & low water use", "Arid")}</span>
                    </span>
                  </td>
                  <td className="num py-2 pr-3 text-right">
                    {isNaN(r.k.stressWeightedC) ? "–" : <span className={r.hot ? "font-semibold text-oxide" : ""}>{fmtN(r.k.stressWeightedC)}</span>}
                  </td>
                  <td className="py-2 pr-3">{fmtBal(r)}</td>
                  <td className="py-2 pr-3">
                    <GradeBadge grade={r.t.grade.g} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {selected && (
          <aside className="rounded-xl border border-hairline bg-white p-5 text-[0.84rem]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[1.05rem] font-semibold">{selected.p.site.name}</div>
                <div className="mt-0.5 text-[0.78rem] text-shale">
                  {selected.p.site.operator} · {selected.p.site.country}
                </div>
              </div>
              <GradeBadge grade={selected.t.grade.g} />
            </div>

            <p className="mt-2 text-[0.78rem] text-shale">{siteDescriptor(selected.p)}</p>

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[0.82rem]">
              <div>
                <dt className="text-[0.72rem] text-shale">Withdrawal</dt>
                <dd className="num font-semibold">{fmtN(selected.k.W)} ML</dd>
              </div>
              <div>
                <dt className="text-[0.72rem] text-shale">Consumption</dt>
                <dd className="num font-semibold">{fmtN(selected.k.C)} ML</dd>
              </div>
              <div>
                <dt className="text-[0.72rem] text-shale">m³/t ore</dt>
                <dd className="num font-semibold">{fmtN(selected.k.cPerOre, 1)}</dd>
              </div>
              <div>
                <dt className="text-[0.72rem] text-shale">m³/t metal</dt>
                <dd className="num font-semibold">{fmtN(selected.k.cPerMetal)}</dd>
              </div>
              <div>
                <dt className="text-[0.72rem] text-shale">Basin stress</dt>
                <dd className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: selected.k.stress.color }} />
                  {selected.k.stress.label}
                </dd>
              </div>
              <div>
                <dt className="text-[0.72rem] text-shale">Balance</dt>
                <dd>{fmtBal(selected)}</dd>
              </div>
              <div>
                <dt className="text-[0.72rem] text-shale">Coordinates</dt>
                <dd className="text-[0.78rem]">{coords(selected.p)}</dd>
              </div>
              <div>
                <dt className="text-[0.72rem] text-shale">Assurance</dt>
                <dd className="capitalize">{assuranceText(selected.p)}</dd>
              </div>
            </dl>

            {selected.hot && (
              <p className="mt-3 rounded-sm bg-oxide/10 px-2 py-1.5 text-[0.78rem] font-semibold text-oxide">
                Hotspot: high stress × high consumption (≥ 3,000 ML)
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {onOpenCard && (
                <button
                  onClick={() => onOpenCard(selected.id, set)}
                  className="rounded-sm border border-fresh px-2.5 py-1.5 text-[0.8rem] font-medium text-fresh hover:bg-fresh hover:text-white"
                >
                  Report card
                </button>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-white p-4">
      <div className="text-[0.72rem] text-shale">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="num cond text-[1.8rem] font-bold leading-none">{value}</span>
        {unit && <span className="text-[0.78rem] text-shale">{unit}</span>}
      </div>
      <div className="mt-1 text-[0.72rem] text-shale">{sub}</div>
    </div>
  );
}
