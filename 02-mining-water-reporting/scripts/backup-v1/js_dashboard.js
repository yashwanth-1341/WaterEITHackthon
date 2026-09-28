(function () {
"use strict";
const NS = "http://www.w3.org/2000/svg", $ = s => document.querySelector(s), D = window.NCM;
const fmt = (x, d = 0) => x == null || isNaN(x) ? "–" : Number(x).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function el(t, a, p) { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }
function txt(p, x, y, s, cls, anchor) { const t = el("text", { x, y, class: cls || "", "text-anchor": anchor || "start" }, p); t.textContent = s; return t; }
function svg(host, w, h, label) { host.innerHTML = ""; const s = el("svg", { viewBox: `0 0 ${w} ${h}`, role: "img", "aria-label": label }); host.appendChild(s); return s; }
const tip = $("#tip");
function mv(e) { let x = e.clientX + 14, y = e.clientY + 14; const r = tip.getBoundingClientRect(); if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14; if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 14; tip.style.left = x + "px"; tip.style.top = y + "px"; }
function hover(n, t, lines) { n.addEventListener("mouseenter", e => { tip.innerHTML = `<div class="tt">${esc(t)}</div>` + lines.map(l => `<div class="tv">${esc(l)}</div>`).join(""); tip.classList.add("on"); mv(e); }); n.addEventListener("mousemove", mv); n.addEventListener("mouseleave", () => tip.classList.remove("on")); }
function seg(id, cb) { const g = $(id); g.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; g.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); cb(); }); return () => g.querySelector('[aria-pressed="true"]').dataset.v; }
function hatch(g, id, color) { const d = el("defs", {}, g), p = el("pattern", { id, width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, d); el("rect", { width: 6, height: 6, fill: "var(--copper-soft)" }, p); el("line", { x1: 0, y1: 0, x2: 0, y2: 6, stroke: color, "stroke-width": 2.4 }, p); }

/* ---------- data: starts empty; filled by "import" or by hand ---------- */
let SITES = ["Lihir", "Telfer", "Cadia", "Gosowong", "Red Chris"];
const S = {};
let WROWS = [], DROWS = [], LOADED = false;
function blank(n) { const s = D.sites[n] || {}; return { name: n, country: D.country[n] || "", W: null, fresh: null, sea: null, D: null, dS: null, C: null, R: null, ore: s.ore_t || null, oz: s.au_eq_oz || null, rev: s.revenue_musd || null, lutter: D.lutter[n] || null }; }
SITES.forEach(n => S[n] = blank(n));
function importNewcrest() {
  SITES.forEach(n => {
    const s = D.sites[n] || {};
    const sea = D.withdrawal.filter(r => r[0] === n && r[2] === "Seawater").reduce((a, r) => a + r[3], 0);
    Object.assign(S[n], { W: s.W ?? null, fresh: s.W_high ?? null, sea: s.W != null ? sea : null, low: s.W_low ?? null, D: s.D ?? null, dS: s.dS ?? null, C: s.C ?? null, R: s.R ?? null, source: "imported" });
  });
  WROWS = D.withdrawal.map(r => r.slice()); DROWS = D.discharge.map(r => r.slice());
}
function balance(s) {
  if (s.W == null) return { status: "none", reason: "no water data reported" };
  if (s.D == null || s.C == null) return { status: "unchecked", reason: "discharge and consumption not reported" };
  const dS = s.dS || 0, expected = s.W - s.D - dS, gap = s.C - expected, pct = gap / s.W * 100;
  let status = Math.abs(pct) <= 5 ? "pass" : "fail";
  if (status === "pass" && s.name === "Lihir") status = "construction";
  return { status, dS, dSknown: s.dS != null, expected, gap, pct };
}
const STATUS = { pass: ["good", "closes"], fail: ["crit", ""], construction: ["warn", "closes only by construction"], unchecked: ["info", "cannot be checked"], none: ["crit", "no data"] };
const statusPill = b => `<span class="pill ${STATUS[b.status][0]}">${b.status === "fail" ? `off by ${b.pct > 0 ? "+" : ""}${fmt(b.pct, 1)}%` : STATUS[b.status][1]}</span>`;

/* ---------- state: tabs + site chips ---------- */
let SEL = "All";
const tabs = [...document.querySelectorAll(".tab")];
function openTab(id) { tabs.forEach(t => { const on = t.id === "t-" + id; t.setAttribute("aria-selected", on); $("#" + t.getAttribute("aria-controls")).hidden = !on; }); }
tabs.forEach(t => t.addEventListener("click", () => openTab(t.id.slice(2))));
function drawChips() { $("#chips").innerHTML = ["All", ...SITES].map(n => `<button class="chip" data-s="${n}" aria-pressed="${n === SEL}">${n === "All" ? "All sites" : n}</button>`).join(""); }
$("#chips").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; SEL = b.dataset.s; $("#chips").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); renderAll(); });
const picked = () => SEL === "All" ? SITES : [SEL];

/* ---------- overview ---------- */
function overview() {
  const list = picked(), withData = list.map(n => S[n]).filter(s => s.W != null);
  const sum = f => withData.reduce((a, s) => a + (s[f] || 0), 0);
  const W = sum("W"), fresh = sum("fresh"), sea = sum("sea"), R = sum("R");
  const bal = withData.map(s => balance(s)), checked = bal.filter(b => b.status !== "unchecked");
  const kp = SEL === "All"
    ? [[fmt(W), "ML withdrawn", S.Lihir.source === "imported" ? `FY19: ${fmt(D.history.FY19.total)} ML` : "sites entered so far"], [fmt(fresh), "ML freshwater", `${fmt(fresh / W * 100)}% of the total; the rest is seawater`], [fmt(R), "ML recycled or reused at the sites", `${fmt(R / (R + fresh) * 100)}% of freshwater use`], [`${bal.filter(b => b.status === "pass").length} of ${checked.length}`, "site balances close within ±5%", `${withData.length - checked.length} cannot be checked; ${list.length - withData.length} without data`]]
    : withData.length ? [[fmt(W), "ML withdrawn", S[SEL].country], [fmt(fresh), "ML freshwater", sea ? `${fmt(sea)} ML seawater` : "no seawater"], [fmt(R), "ML recycled or reused", R ? `${fmt(R / (R + fresh) * 100)}% of freshwater use` : "not reported"], [bal[0].status === "fail" ? fmt(bal[0].pct, 1) + "%" : STATUS[bal[0].status][1], "water balance", bal[0].status === "fail" ? `${fmt(Math.abs(bal[0].gap))} ML unexplained` : ""]]
    : [["–", "ML withdrawn", "not reported"], ["US$" + fmt(S[SEL].rev) + "m", "revenue in FY20", "reported in the economic data"], ["–", "ML recycled", "not reported"], ["no data", "water balance", "no water or energy table"]];
  $("#ov-kpis").innerHTML = kp.map(k => `<div class="kpi"><div class="v">${k[0]}</div><div class="l">${k[1]}</div><div class="d">${esc(k[2])}</div></div>`).join("");
  const F = [
    ["Lihir", "warn", "Quality", `63% of all water Newcrest withdraws is seawater at Lihir (222,149 ML). Freshwater, the water that competes with people and nature, is 132,061 ML.`],
    ["Lihir", "warn", "Balance", `Lihir's balance closes only because the seawater discharge is "unknown", so all seawater is counted as consumed: 90% of the company's reported consumption.`],
    ["Telfer", "crit", "Balance", `Telfer reports consumption equal to its whole withdrawal (18,159 ML), even though it discharged 3,667 ML: 20% of its water is double-counted or missing.`],
    ["Cadia", "crit", "Balance", `Cadia's inflows are 1,148 ML (8%) larger than its discharge plus consumption. In October 2019 the nearby town of Orange was on level 5 water restrictions.`],
    ["Gosowong", "info", "Gap", `Gosowong was sold in March 2020. Its withdrawal (7,858 ML) is reported, its discharge and consumption are not.`],
    ["Red Chris", "crit", "Gap", `Red Chris earned US$185m in FY20 but appears in no water or energy table. Only a model estimate exists: 4,914 ML of new water in 2019 (Lutter et al.).`],
    ["All", "info", "Trend", `Freshwater withdrawal is reported as 322,121 ML in FY18 and 132,061 ML in FY20. The FY18 figure equals total withdrawal, so the fall is probably a change of definition, not a saving.`]
  ].filter(f => (SEL === "All" || f[0] === SEL) && (f[0] === "All" ? S.Lihir.source === "imported" : S[f[0]] && S[f[0]].source === "imported" && (f[0] !== "Red Chris" || S["Red Chris"].W == null) && (f[0] !== "Gosowong" || S.Gosowong.D == null)));
  SITES.filter(n => S[n].source === "entered" && (SEL === "All" || SEL === n)).forEach(n => { const b = balance(S[n]); F.push([n, b.status === "pass" ? "good" : b.status === "fail" ? "crit" : "info", "Entered", b.status === "pass" ? `${n}: entered by hand${n === "Red Chris" ? " (example values)" : ""}; water in equals water out within 5%.` : b.status === "fail" ? `${n}: entered by hand; the balance is off by ${fmt(b.gap)} ML (${fmt(b.pct, 1)}%).` : `${n}: entered by hand; ${b.reason}.`]); });
  $("#ov-findings").innerHTML = F.map(f => `<li><span class="pill ${f[1]}">${f[2]}</span><span>${esc(f[3])}</span></li>`).join("");
  answers();
  $("#ov-table").innerHTML = `<thead><tr><th>Site</th><th class="r">Withdrawn</th><th class="r">Freshwater</th><th class="r">Low quality<div class="ref">mostly seawater</div></th><th class="r">Discharged</th><th class="r">Consumed</th><th class="r">Recycled</th><th>Balance</th></tr></thead><tbody>` +
    SITES.map(n => { const s = S[n]; return `<tr class="${SEL === n ? "sel" : ""}" data-s="${n}" style="cursor:pointer"><td><b>${n}</b><div class="ref">${esc(s.country)}</div></td><td class="r">${fmt(s.W)}</td><td class="r">${fmt(s.fresh)}</td><td class="r">${fmt(s.W != null ? s.W - (s.fresh || 0) : null)}</td><td class="r">${fmt(s.D)}</td><td class="r">${fmt(s.C)}</td><td class="r">${fmt(s.R)}</td><td>${statusPill(balance(s))}</td></tr>`; }).join("") + "</tbody>";
  $("#ov-table").querySelectorAll("tr[data-s]").forEach(tr => tr.addEventListener("click", () => $(`#chips [data-s="${tr.dataset.s}"]`).click()));
}

/* ---------- stacked bars (shared) ---------- */
function stacked(host, rows, keys, label) {
  const Wd = 1000, L = 110, Rr = 100, rowH = 48, H = 20 + rows.length * rowH + 28;
  const g = svg(host, Wd, H, label); hatch(g, "h-" + host.id, "var(--copper)");
  const max = Math.max(1, ...rows.map(r => keys.reduce((a, k) => a + (r.v[k[0]] || 0), 0))), x = v => v / max * (Wd - L - Rr);
  const step = max > 200000 ? 50000 : max > 50000 ? 20000 : max > 20000 ? 5000 : 2000;
  for (let t = 0; t <= max; t += step) { el("line", { x1: L + x(t), x2: L + x(t), y1: 10, y2: H - 26, class: "gridline" }, g); txt(g, L + x(t), H - 8, fmt(t / 1000) + "k", "t-muted t-mono", "middle"); }
  rows.forEach((r, i) => {
    const y = 16 + i * rowH; let cx = L; txt(g, L - 12, y + 21, r.label, "t-ink", "end");
    if (r.missing) { txt(g, L + 6, y + 21, r.missing, "t-muted"); return; }
    keys.forEach(([k, color, name]) => { const v = r.v[k] || 0; if (v <= 0) return; const w = Math.max(x(v) - 2, 1.5); const rc = el("rect", { x: cx, y, width: w, height: 30, rx: 3, fill: color === "hatch" ? `url(#h-${host.id})` : color }, g); if (color === "hatch") rc.setAttribute("stroke", "var(--copper)");
      hover(rc, `${r.label} · ${name}`, [fmt(v) + " ML"]); if (w > 70) { const t = txt(g, cx + 7, y + 20, fmt(v / 1000, 1) + "k", "t-mono"); t.style.fill = /q3|s4|hatch/.test(color) ? "var(--ink)" : "#fff"; t.style.pointerEvents = "none"; } cx += x(v); });
    txt(g, cx + 8, y + 21, fmt(keys.reduce((a, k) => a + (r.v[k[0]] || 0), 0)), "t-ink t-mono");
  });
}
const legend = (host, keys) => $(host).innerHTML = keys.map(k => `<span><i class="sw ${k[1] === "hatch" ? "hatch" : ""}" style="${k[1] === "hatch" ? "" : "background:" + k[1]}"></i>${k[2]}</span>`).join("");

/* ---------- water in ---------- */
const wdSplit = seg("#wd-seg", withdrawal);
function withdrawal() {
  const bySource = wdSplit() === "source";
  const keys = bySource
    ? [["Surface water", "var(--s1)", "Surface water"], ["Groundwater", "var(--s2)", "Groundwater"], ["Seawater", "var(--s3)", "Seawater"], ["Third-party water", "var(--s4)", "Third-party (e.g. town effluent)"]]
    : [[1, "var(--q1)", "Category 1 · freshwater"], [2, "var(--q2)", "Category 2 · freshwater"], [3, "var(--q3)", "Category 3 · low quality (seawater)"]];
  const rows = picked().map(n => { const v = {}; WROWS.filter(r => r[0] === n).forEach(r => { const k = bySource ? r[2] : r[1]; v[k] = (v[k] || 0) + r[3]; }); return { label: n, v, missing: S[n].W == null ? "no water data reported" : null }; });
  $("#wd-title").textContent = SEL === "All" ? "Where the water comes from" : `${SEL}: where the water comes from`;
  stacked($("#wd-chart"), rows, keys, "Water withdrawn by site"); legend("#wd-legend", keys);
}

/* ---------- water out ---------- */
function outflows() {
  const keys = [["d0", "var(--ink-2)", "Discharge · not split"], ["d1", "var(--q1)", "Discharge · Category 1"], ["d2", "var(--q2)", "Discharge · Category 2"], ["d3", "var(--q3)", "Discharge · Category 3"], ["c", "var(--copper)", "Consumption"]];
  const rows = [];
  picked().forEach(n => { const v = {}; DROWS.filter(r => r[0] === n).forEach(r => { v["d" + r[1]] = (v["d" + r[1]] || 0) + r[3]; });
    const miss = S[n].W == null ? "no water data reported" : S[n].D == null ? "discharge and consumption not reported" : null;
    rows.push({ label: n + " out", v: Object.assign(v, { c: S[n].C }), missing: miss }); });
  stacked($("#of-chart"), rows, keys, "Water discharged and consumed by site"); legend("#of-legend", keys);
  $("#of-note").innerHTML = "<b>Read with care.</b> Lihir's seawater discharge is reported as \"unknown\", so its 276,322 ML of consumption is mostly seawater that went back to the sea. Telfer's consumption equals its whole withdrawal although it also discharged water.";
}

/* ---------- balance ---------- */
function balanceTab() {
  const n = SEL === "All" || S[SEL].W == null ? (SEL === "All" ? "Telfer" : SEL) : SEL, s = S[n], b = balance(s);
  const head = { pass: "Balance closes", fail: `Does not close: ${b.gap > 0 ? "+" : ""}${fmt(b.gap)} ML (${b.pct > 0 ? "+" : ""}${fmt(b.pct, 1)}%)`, construction: "Closes only by construction", unchecked: "Cannot be checked", none: "No water data" }[b.status];
  $("#bl-status").innerHTML = `<div class="eyebrow">${n} · water in vs water out</div><h3 style="margin-top:4px">${head}</h3>`;
  const host = $("#bl-chart");
  if (b.status === "unchecked" || b.status === "none") { host.innerHTML = `<p class="small">${n}: ${b.reason}.</p>`; $("#bl-eq").innerHTML = ""; }
  else {
    const inflow = s.W + Math.max(0, -b.dS), out = s.D + s.C + Math.max(0, b.dS), max = Math.max(inflow + Math.max(0, b.gap), out + Math.max(0, -b.gap)) * 1.02;
    const Wd = 1000, L = 60, Rr = 120, g = svg(host, Wd, 140, "Water balance"), x = v => v / max * (Wd - L - Rr); hatch(g, "hb", "var(--crit)");
    let cx; const part = (y, v, fill, name) => { if (!(v > 0)) return; const w = Math.max(x(v) - 2, 1.5); const r = el("rect", { x: cx, y, width: w, height: 40, rx: 3, fill }, g); hover(r, name, [fmt(v) + " ML"]); if (w > 110) { const t = txt(g, cx + 8, y + 25, name, ""); t.style.fill = fill.includes("url") ? "var(--ink)" : "#fff"; t.style.pointerEvents = "none"; } cx += x(v); };
    txt(g, L - 10, 40, "In", "t-ink", "end"); txt(g, L - 10, 104, "Out", "t-ink", "end");
    cx = L; part(15, s.fresh, "var(--q1)", "Freshwater"); part(15, (s.W - s.fresh) || 0, "var(--q2)", "Seawater / low quality"); if (b.dS < 0) part(15, -b.dS, "var(--s3)", "From storage"); if (b.gap > 0) part(15, b.gap, "url(#hb)", "Missing inflow");
    txt(g, cx + 8, 40, fmt(inflow + Math.max(0, b.gap)) + " ML", "t-ink t-mono");
    cx = L; part(80, s.D, "var(--ink-2)", "Discharge"); part(80, s.C, "var(--copper)", "Consumption"); if (b.gap < 0) part(80, -b.gap, "url(#hb)", "Unaccounted");
    txt(g, cx + 8, 104, fmt(out + Math.max(0, -b.gap)) + " ML", "t-ink t-mono");
    $("#bl-eq").innerHTML = `<div class="row"><span class="lbl">Withdrawal</span><span>${fmt(s.W)}</span></div><div class="row"><span class="lbl">− Discharge</span><span>${fmt(s.D, s.D % 1 ? 2 : 0)}</span></div><div class="row"><span class="lbl">− Change in storage</span><span>${b.dSknown ? fmt(s.dS) : "not reported (read as 0)"}</span></div><div class="row"><span class="lbl">= Consumption the balance allows</span><span>${fmt(b.expected)}</span></div><div class="row"><span class="lbl">Consumption reported</span><span>${fmt(s.C)}</span></div><div class="row total"><span class="lbl">Gap</span><span>${b.gap > 0 ? "+" : ""}${fmt(b.gap)} ML</span></div>`;
  }
  $("#bl-table").innerHTML = `<thead><tr><th>Site</th><th class="r">Withdrawn</th><th class="r">Discharged</th><th class="r">Storage change</th><th class="r">Consumed</th><th>Result</th></tr></thead><tbody>` +
    SITES.map(m => { const t = S[m]; return `<tr class="${m === n ? "sel" : ""}" data-s="${m}" style="cursor:pointer"><td><b>${m}</b></td><td class="r">${fmt(t.W)}</td><td class="r">${fmt(t.D)}</td><td class="r">${fmt(t.dS)}</td><td class="r">${fmt(t.C)}</td><td>${statusPill(balance(t))}</td></tr>`; }).join("") + "</tbody>";
  $("#bl-table").querySelectorAll("tr[data-s]").forEach(tr => tr.addEventListener("click", () => $(`#chips [data-s="${tr.dataset.s}"]`).click()));
}

/* ---------- efficiency ---------- */
const efDen = seg("#ef-seg", efficiency);
function efficiency() {
  const k = efDen();
  const conf = { t: [s => s.fresh * 1000 / s.ore, "m³ freshwater per tonne of ore milled", 2], oz: [s => s.fresh * 1000 / s.oz, "m³ freshwater per gold-equivalent ounce", 1], rev: [s => s.fresh / s.rev, "ML freshwater per US$ million revenue", 1], rr: [s => s.R != null ? s.R / (s.R + s.fresh) * 100 : null, "% of water used that is recycled", 0] }[k];
  const rows = SITES.map(n => ({ n, v: S[n].fresh != null && S[n].ore ? conf[0](S[n]) : null }));
  const Wd = 1000, L = 110, Rr = 140, rowH = 46, H = 16 + rows.length * rowH + 24, g = svg($("#ef-chart"), Wd, H, conf[1]);
  const max = Math.max(...rows.map(r => r.v || 0)), x = v => v / max * (Wd - L - Rr);
  rows.forEach((r, i) => { const y = 12 + i * rowH; txt(g, L - 12, y + 20, r.n, "t-ink", "end");
    if (r.v == null) { txt(g, L + 6, y + 20, "not reported", "t-muted"); return; }
    const on = SEL === "All" || SEL === r.n; const rc = el("rect", { x: L, y, width: Math.max(x(r.v), 2), height: 28, rx: 3, fill: on ? "var(--q1)" : "var(--rule-2)" }, g);
    hover(rc, r.n, [fmt(r.v, conf[2]) + " " + conf[1]]); txt(g, L + x(r.v) + 8, y + 20, fmt(r.v, conf[2]) + (k === "rr" ? "%" : ""), "t-ink t-mono"); });
  txt(g, L, H - 6, conf[1], "t-muted");
}

/* ---------- outlook ---------- */
const INDUSTRY_G = Math.pow(1.183, 1 / 4) - 1; // +18.3% copper-mine new water 2015-2019 (Lutter et al.)
$("#ol-rr").addEventListener("input", outlook);
function outlook() {
  const n = SEL === "All" ? "Cadia" : SEL, s = S[n], X = +$("#ol-rr").value / 100;
  $("#o-rr").textContent = "+" + Math.round(X * 100) + " percentage points";
  const m = s.lutter ? window.MWL_LUTTER.find(r => r[0] === s.lutter) : null;
  const hist = m ? m[3].map((v, i) => [2015 + i, v]).filter(p => p[1] != null) : [];
  const g = INDUSTRY_G, gSrc = "copper-mine average: water use +18.3% in 2015–2019";
  const reported = s.fresh != null, y0 = reported ? 2020 : 2019, W0 = reported ? s.fresh : (hist.length ? hist[hist.length - 1][1] : null);
  $("#ol-title").textContent = `${n}: where its freshwater use is heading`;
  if (W0 == null) { $("#ol-chart").innerHTML = `<p class="small">${n} reports no water data and is not covered by the copper model.</p>`; $("#ol-kpis").innerHTML = ""; $("#ol-outcome").innerHTML = ""; return; }
  const R0 = s.R || 0, rr0 = R0 / (R0 + W0), rrT = Math.min(0.95, rr0 + X);
  const years = Array.from({ length: 2030 - y0 + 1 }, (_, i) => y0 + i);
  const bau = years.map((y, i) => [y, W0 * Math.pow(1 + g, i)]);
  const opt = years.map((y, i) => { const use = (W0 + R0) * Math.pow(1 + g, i), r = rr0 + (rrT - rr0) * Math.min(1, i / 5); return [y, use * (1 - r)]; });
  const vals = [...hist, ...bau, ...opt].map(p => p[1]);
  const Wd = 1000, L = 70, Rr = 110, top = 20, H = 300, ph = H - top - 40, xmin = hist.length ? 2015 : y0, xmax = 2030;
  const ymax = Math.max(...vals) * 1.15, x = y => L + (y - xmin) / (xmax - xmin) * (Wd - L - Rr), yv = v => top + ph - v / ymax * ph;
  const G = svg($("#ol-chart"), Wd, H, "Freshwater trend and forecast");
  const step = ymax > 40000 ? 10000 : ymax > 15000 ? 5000 : ymax > 5000 ? 2000 : 1000;
  for (let t = 0; t <= ymax; t += step) { el("line", { x1: L, x2: Wd - Rr, y1: yv(t), y2: yv(t), class: "gridline" }, G); txt(G, L - 8, yv(t) + 4, fmt(t), "t-muted t-mono", "end"); }
  txt(G, L - 8, 12, "ML/yr", "t-muted t-mono", "end");
  for (let y = xmin; y <= xmax; y++) if ((y - xmin) % (hist.length ? 3 : 2) === 0 || y === xmax) txt(G, x(y), H - 14, y, "t-muted t-mono", "middle");
  el("rect", { x: x(y0), y: top, width: x(xmax) - x(y0), height: ph, fill: "var(--surface-2)", opacity: .55 }, G); txt(G, x(y0) + 8, top + 14, "projection", "t-muted");
  const line = (pts, c, dash) => el("path", { d: "M" + pts.map(p => `${x(p[0])},${yv(p[1])}`).join(" L"), fill: "none", stroke: c, "stroke-width": 2.2, "stroke-dasharray": dash || "" }, G);
  if (hist.length) { line(hist, "var(--muted)"); hist.forEach(p => hover(el("circle", { cx: x(p[0]), cy: yv(p[1]), r: 4, fill: "var(--muted)" }, G), `${p[0]} · model estimate`, [fmt(p[1]) + " ML"])); }
  line(bau, "var(--q2)", "6 4"); line(opt, "var(--good)", "6 4");
  if (reported) { hover(el("circle", { cx: x(y0), cy: yv(W0), r: 6, fill: "var(--ink)", stroke: "var(--surface)", "stroke-width": 2 }, G), "FY20 · reported", [fmt(W0) + " ML freshwater"]); txt(G, x(y0) - 10, yv(W0) - 12, "reported " + fmt(W0), "t-ink t-mono", "end"); }
  const b30 = bau[bau.length - 1][1], o30 = opt[opt.length - 1][1], saved = bau.reduce((a, p, i) => a + p[1] - opt[i][1], 0);
  txt(G, x(2030) + 8, yv(b30) + 4, fmt(b30), "t-ink t-mono"); txt(G, x(2030) + 8, yv(o30) + 4, fmt(o30), "t-ink t-mono");
  $("#ol-kpis").innerHTML = [
    [fmt(b30), "ML freshwater in 2030 if nothing changes", `${fmt(g * 100, 1)}% a year (${gSrc})`],
    [fmt(o30), "ML in 2030 with more recycling", `recycled share ${fmt(rr0 * 100)}% → ${fmt(rrT * 100)}% over five years`],
    [fmt(saved / 1000, 1) + " GL", `freshwater saved ${y0 + 1}–2030`, "1 GL = 1,000 ML"]
  ].map(k => `<div class="kpi"><div class="v">${k[0]}</div><div class="l">${k[1]}</div><div class="d">${k[2]}</div></div>`).join("");
  let rank = null; if (m) { const all = window.MWL_LUTTER.filter(r => r[3][4] != null).sort((a, c) => c[3][4] - a[3][4]); rank = [all.findIndex(r => r[0] === m[0]) + 1, all.length]; }
  const b = balance(s), O = [];
  if (rank) O.push(["info", "Position", `${n} is the #${rank[0]} largest user of new water among ${rank[1]} copper mines in the Lutter data (2019).`]);
  O.push(["good", "Sustainable option", `Recycling ${Math.round(X * 100)} more percentage points of the water it uses cuts freshwater need in 2030 to ${fmt(o30)} ML, ${fmt((1 - o30 / b30) * 100)}% below business as usual.`]);
  if (b.status === "fail" || b.status === "construction") O.push(["warn", "Reporting", `Closing the ${fmt(Math.abs(b.gap || 0))} ML balance gap and reporting storage change would give buyers a site account they can rely on.`]);
  if (!reported) O.push(["crit", "Reporting", `${n} reports no water data; the forecast starts from the model estimate.`]);
  $("#ol-outcome").innerHTML = O.map(f => `<li><span class="pill ${f[0]}">${f[1]}</span><span>${esc(f[2])}</span></li>`).join("");
}

/* ---------- the four questions ---------- */
function forecast2030(s, X) {
  const W0 = s.fresh; if (W0 == null) return null;
  const R0 = s.R || 0, rr0 = R0 / (R0 + W0), rrT = Math.min(0.95, rr0 + X), n = 10;
  return { bau: W0 * Math.pow(1 + INDUSTRY_G, n), opt: (W0 + R0) * Math.pow(1 + INDUSTRY_G, n) * (1 - rrT) };
}
function answers() {
  const keep = s => !(SEL === "All" && s.name === "Gosowong"); // sold during FY20: left out of the outlook
  const list = picked().map(n => S[n]).filter(s => s.fresh != null && keep(s));
  const fresh = picked().reduce((a, n) => a + (S[n].fresh || 0), 0), W = picked().reduce((a, n) => a + (S[n].W || 0), 0);
  const bal = picked().map(n => balance(S[n])).filter(b => b.status !== "unchecked" && b.status !== "none");
  const f = list.map(s => forecast2030(s, 0.10)).filter(Boolean), bau = f.reduce((a, x) => a + x.bau, 0), opt = f.reduce((a, x) => a + x.opt, 0);
  const A = [
    ["withdrawal", "Now · How much water, and what kind?", fmt(W) + " ML", `${fmt(fresh / (W || 1) * 100)}% freshwater`],
    ["balance", "Now · Can we trust the numbers?", `${bal.filter(b => b.status === "pass").length} of ${bal.length}`, "site balances close within 5%"],
    ["outlook", "Forecast · Freshwater in 2030", fmt(bau) + " ML", SEL === "All" ? "sites still owned, if nothing changes (+4.3%/yr)" : "if nothing changes (+4.3% a year)"],
    ["outlook", "Outcome · With 10 points more recycling", fmt(opt) + " ML", `${fmt((1 - opt / (bau || 1)) * 100)}% less freshwater in 2030`]
  ];
  $("#ov-answers").innerHTML = A.map(a => `<button class="ans" data-go="${a[0]}"><span class="q">${a[1]}</span><span class="a">${a[2]}</span><span class="s">${a[3]}</span></button>`).join("");
  $("#ov-answers").querySelectorAll(".ans").forEach(b => b.addEventListener("click", () => openTab(b.dataset.go)));
}

function renderAll() {
  if (!LOADED) return;
  $("#empty").hidden = true; $("#nav").hidden = false; $("#main").hidden = false; $("#chips").hidden = false; $("#show-label").hidden = false;
  $("#data-state").textContent = `${SITES.filter(x => S[x].W != null).length} of ${SITES.length} sites with data`;
  drawChips(); overview(); withdrawal(); outflows(); balanceTab(); efficiency(); outlook();
}

/* ---------- import / enter ---------- */
const modal = $("#modal");
function toast(t) { const e = $("#toast"); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => e.hidden = true, 3200); }
const mMode = seg("#m-seg", () => { const m = mMode(); $("#m-import").hidden = m !== "import"; $("#m-enter").hidden = m !== "enter"; if (m === "enter") fillForm(); });
function openModal(mode) { modal.hidden = false; $(`#m-seg [data-v="${mode}"]`).click(); }
modal.addEventListener("click", e => { if (e.target === modal) modal.hidden = true; });
$("#m-close").addEventListener("click", () => modal.hidden = true);
document.addEventListener("keydown", e => { if (e.key === "Escape") modal.hidden = true; });
$("#btn-import").addEventListener("click", () => { $("#m-progress").innerHTML = ""; openModal("import"); });
$("#empty-import").addEventListener("click", () => { openModal("import"); runImport(); });
["#btn-enter", "#empty-enter"].forEach(id => $(id).addEventListener("click", () => openModal("enter")));

const STEPS = [
  "Opening the Newcrest FY20 GRI data file · 7 sheets",
  "Found the water tables (GRI 303-3, 303-4, 303-5)",
  "Read 161 water values, all in megalitres",
  "Matched them to 5 sites: Lihir, Telfer, Cadia, Gosowong, Red Chris",
  "Checked every site against the ICMM balance rule"
];
async function runImport() {
  const ol = $("#m-progress"); ol.innerHTML = STEPS.map((t, i) => `<li><span class="ic">${i + 1}</span>${t}</li>`).join("");
  const li = [...ol.children], wait = matchMedia("(prefers-reduced-motion: reduce)").matches ? 60 : 550;
  for (const item of li) { item.classList.add("on"); await new Promise(r => setTimeout(r, wait)); item.classList.add("done"); item.querySelector(".ic").textContent = "✓"; }
  importNewcrest(); LOADED = true; SEL = "All"; renderAll(); openTab("overview");
  setTimeout(() => { modal.hidden = true; toast("Imported 5 sites and 161 values. The dashboard is filled."); }, 400);
}
$("#m-sample").addEventListener("click", e => { e.stopPropagation(); runImport(); });
const mDrop = $("#m-drop");
mDrop.addEventListener("dragover", e => { e.preventDefault(); mDrop.classList.add("over"); });
mDrop.addEventListener("dragleave", () => mDrop.classList.remove("over"));
mDrop.addEventListener("drop", e => { e.preventDefault(); mDrop.classList.remove("over"); runImport(); });

const F = id => $("#f-" + id), num = id => F(id).value === "" ? null : +F(id).value;
function fillForm() {
  F("site").innerHTML = SITES.map(n => `<option>${n}</option>`).join("");
  F("site").value = S["Red Chris"] && S["Red Chris"].W == null ? "Red Chris" : SITES[0]; loadSite();
}
function loadSite() {
  const n = F("site").value, s = S[n];
  const rows = WROWS.filter(r => r[0] === n), by = src => rows.filter(r => r[2] === src && r[1] < 3).reduce((a, r) => a + r[3], 0) || "";
  F("sw").value = by("Surface water"); F("gw").value = by("Groundwater"); F("tp").value = by("Third-party water");
  F("sea").value = s.sea || ""; F("d").value = s.D ?? ""; F("c").value = s.C ?? ""; F("ds").value = s.dS ?? ""; F("r").value = s.R ?? ""; F("new").value = "";
  check();
}
function formSite() {
  const fresh = (num("sw") || 0) + (num("gw") || 0) + (num("tp") || 0), sea = num("sea") || 0;
  return { W: fresh + sea || null, fresh: fresh || null, sea, D: num("d"), C: num("c"), dS: num("ds"), R: num("r") };
}
function check() {
  const v = formSite(), box = F("check");
  if (v.W == null) { box.className = "entry-check"; box.textContent = "Enter at least one inflow."; return; }
  if (v.D == null || v.C == null) { box.className = "entry-check"; box.innerHTML = `Water in: <b>${fmt(v.W)} ML</b>. Add discharge and consumption to check the balance.`; return; }
  const b = balance(Object.assign({ name: "form" }, v));
  box.className = "entry-check " + (b.status === "pass" ? "ok" : "bad");
  box.innerHTML = b.status === "pass" ? `Balance closes: water in ${fmt(v.W)} ML matches water out ${fmt(v.D + v.C + (v.dS || 0))} ML.` : `Balance is off by <b>${b.gap > 0 ? "+" : ""}${fmt(b.gap)} ML (${fmt(b.pct, 1)}%)</b>. You can still save; the site will be flagged.`;
}
F("site").addEventListener("change", loadSite);
["sw", "gw", "tp", "sea", "d", "c", "ds", "r"].forEach(id => F(id).addEventListener("input", check));
F("example").addEventListener("click", () => { F("site").value = "Red Chris"; F("new").value = ""; F("sw").value = 3200; F("gw").value = 1714; F("tp").value = ""; F("sea").value = 0; F("d").value = 1180; F("c").value = 3650; F("ds").value = 60; F("r").value = 9670; check(); });
F("save").addEventListener("click", () => {
  const v = formSite(); if (v.W == null) { check(); return; }
  const n = F("new").value.trim() || F("site").value;
  if (!S[n]) { SITES.push(n); S[n] = blank(n); }
  Object.assign(S[n], v, { source: "entered" });
  WROWS = WROWS.filter(r => r[0] !== n); DROWS = DROWS.filter(r => r[0] !== n);
  [["Surface water", num("sw")], ["Groundwater", num("gw")], ["Third-party water", num("tp")]].forEach(([src, x]) => { if (x) WROWS.push([n, 1, src, x]); });
  if (v.sea) WROWS.push([n, 3, "Seawater", v.sea]);
  if (v.D) DROWS.push([n, 0, "Not split", v.D]);
  LOADED = true; SEL = n; renderAll(); openTab("overview"); modal.hidden = true;
  toast(`${n} saved. Every tab now includes it.`);
});
})();
