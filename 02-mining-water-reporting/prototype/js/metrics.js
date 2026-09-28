/* MineWater Passport - KPI, mass-balance and transparency-score logic.
   All weights/thresholds here are design proposals of the hackathon team
   (illustrative, to be calibrated in the pilot). */
(function () {
  var BAL_TOL = 0.05; // |W - D - C - dS| / W tolerance (illustrative)
  var STRESS = {
    low: { label: 'Low', w: 0.1, color: '#f3cf9c', rank: 1 },
    low_medium: { label: 'Low-medium', w: 0.3, color: '#eca567', rank: 2 },
    medium_high: { label: 'Medium-high', w: 0.5, color: '#dd7438', rank: 3 },
    high: { label: 'High', w: 0.8, color: '#bb4a1d', rank: 4 },
    extremely_high: { label: 'Extremely high', w: 1.0, color: '#86270b', rank: 5 },
    arid_low_water_use: { label: 'Arid & low water use', w: 1.0, color: '#5a2d56', rank: 5 }
  };
  var DQW = { measured: 1, calculated: 0.6, estimated: 0.2 };
  var ASSW = { none: 0, internal_review: 4, limited: 11, reasonable: 16 };
  var GRADES = [
    { g: 'A', min: 90, color: '#0b8a0b', text: 'Transparent & comparable' },
    { g: 'B', min: 75, color: '#5f9e1f', text: 'Good, minor gaps' },
    { g: 'C', min: 58, color: '#c98500', text: 'Partial - key gaps' },
    { g: 'D', min: 45, color: '#d0632f', text: 'Weak - mostly estimates' },
    { g: 'E', min: -1, color: '#c23434', text: 'Not decision-grade' }
  ];
  var TIER1 = [
    { no: 1, label: 'Site ID & name', test: function (r) { return has(r, 'site.site_id') && has(r, 'site.name'); } },
    { no: 2, label: 'Coordinates & country', test: function (r) { return num(r, 'site.latitude') && num(r, 'site.longitude') && has(r, 'site.country'); } },
    { no: 3, label: 'Primary commodity', test: function (r) { return has(r, 'site.primary_commodity'); } },
    { no: 4, label: 'Mine type & processing route', test: function (r) { return has(r, 'site.mine_type') && arr(r, 'site.processing_route'); } },
    { no: 5, label: 'Reporting year', test: function (r) { return num(r, 'period.year'); } },
    { no: 6, label: 'Ore (or brine) processed', test: function (r) { return num(r, 'production.ore_processed_t') || num(r, 'production.brine_processed_m3'); } },
    { no: 7, label: 'Contained metal / LCE produced', test: function (r) { var p = get(r, 'production.products'); return !!(p && p.length && p.every(function (x) { return typeof x.metal_content_t === 'number'; })); } },
    { no: 8, label: 'Withdrawal by source', test: function (r) { var w = get(r, 'water.withdrawals'); return !!(w && w.length && w.every(function (x) { return x.source && typeof x.volume_ml === 'number' && x.dq; })); } },
    { no: 9, label: 'Discharge by destination', test: function (r) { var d = get(r, 'water.discharges'); return Array.isArray(d) && d.every(function (x) { return x.destination && typeof x.volume_ml === 'number' && x.dq; }); } },
    { no: 10, label: 'Consumption total', test: function (r) { return num(r, 'water.consumption.total_ml') && has(r, 'water.consumption.total_dq'); } },
    { no: 11, label: 'Reused / recycled water', test: function (r) { return num(r, 'water.reuse.reused_recycled_ml'); } },
    { no: 12, label: 'Assurance status', test: function (r) { return has(r, 'assurance.level'); } }
  ];

  function get(o, p) { return p.split('.').reduce(function (a, k) { return a == null ? undefined : a[k]; }, o); }
  function has(o, p) { var v = get(o, p); return v !== undefined && v !== null && v !== ''; }
  function num(o, p) { return typeof get(o, p) === 'number' && !isNaN(get(o, p)); }
  function arr(o, p) { var v = get(o, p); return Array.isArray(v) && v.length > 0; }
  function sum(a, f) { return (a || []).reduce(function (s, x) { var v = f(x); return s + (typeof v === 'number' && !isNaN(v) ? v : 0); }, 0); }

  function balance(r) {
    var w = (r && r.water) || {};
    var W = sum(w.withdrawals, function (x) { return x.volume_ml; });
    var D = sum(w.discharges, function (x) { return x.volume_ml; });
    var C = (w.consumption && typeof w.consumption.total_ml === 'number') ? w.consumption.total_ml : NaN;
    var st = w.storage || {};
    var dS = (typeof st.closing_ml === 'number' && typeof st.opening_ml === 'number') ? st.closing_ml - st.opening_ml : 0;
    var resid = W - D - C - dS;
    var pct = W ? resid / W : NaN;
    var comp = w.consumption || {};
    var compSum = ['evaporation_ml', 'entrainment_ml', 'other_ml'].every(function (k) { return typeof comp[k] === 'number'; })
      ? comp.evaporation_ml + comp.entrainment_ml + comp.other_ml : null;
    return {
      W: W, D: D, C: C, dS: dS, resid: resid, pct: pct,
      ok: !isNaN(pct) && Math.abs(pct) <= BAL_TOL, known: !isNaN(pct),
      compSum: compSum, compOk: compSum === null || isNaN(C) || Math.abs(compSum - C) <= Math.max(0.5, 0.01 * C),
      tol: BAL_TOL
    };
  }

  function primaryProduct(r, commodity) {
    var ps = get(r, 'production.products') || [];
    var c = commodity || get(r, 'site.primary_commodity');
    return ps.filter(function (p) { return p.commodity === c; })[0] || null;
  }

  function kpis(r) {
    var b = balance(r);
    var w = r.water || {};
    var ore = get(r, 'production.ore_processed_t');
    var cat = get(r, 'site.basin.bws_category');
    var s = STRESS[cat] || null;
    var byQ = { cat1: 0, cat2: 0, cat3: 0, unknown: 0 };
    (w.withdrawals || []).forEach(function (x) { byQ[x.quality || 'unknown'] += x.volume_ml || 0; });
    var pp = primaryProduct(r);
    var alloc = pp ? (typeof pp.allocation_share === 'number' ? pp.allocation_share : 1) : 1;
    return {
      W: b.W, D: b.D, C: b.C, dS: b.dS, balance: b,
      cat1: byQ.cat1, byQ: byQ,
      consumptionRatio: b.W ? b.C / b.W : NaN,
      wPerOre: ore ? b.W * 1000 / ore : NaN,
      cPerOre: ore ? b.C * 1000 / ore : NaN,
      cPerMetal: pp && pp.metal_content_t ? b.C * 1000 * alloc / pp.metal_content_t : NaN,
      metalBasis: pp ? pp.basis : null,
      stress: s, stressKey: cat, bws: get(r, 'site.basin.bws_score'),
      stressWeightedC: s ? b.C * s.w : NaN,
      reuseRate: (w.reuse && w.reuse.task_water_ml) ? w.reuse.reused_recycled_ml / w.reuse.task_water_ml : NaN
    };
  }

  /* per-commodity footprint (economic allocation) */
  function footprint(r, commodity) {
    var pp = primaryProduct(r, commodity);
    if (!pp || !pp.metal_content_t) return null;
    var b = balance(r);
    var alloc = typeof pp.allocation_share === 'number' ? pp.allocation_share : 1;
    var f = 1000 * alloc / pp.metal_content_t; // m3 per t metal, per ML
    var byQ = { cat1: 0, cat2: 0, cat3: 0, unknown: 0 };
    (r.water.withdrawals || []).forEach(function (x) { byQ[x.quality || 'unknown'] += (x.volume_ml || 0) * f; });
    return { c: b.C * f, w: b.W * f, byQ: byQ, basis: pp.basis, alloc: alloc, metal_t: pp.metal_content_t, form: pp.product_form };
  }

  function transparency(r) {
    var parts = [];
    // 1. Tier-1 completeness (36)
    var t1 = TIER1.map(function (f) { var ok = false; try { ok = !!f.test(r); } catch (e) { ok = false; } return { no: f.no, label: f.label, ok: ok }; });
    var n1 = t1.filter(function (x) { return x.ok; }).length;
    parts.push({ k: 'Tier-1 completeness', v: n1 * 2, max: 24, note: n1 + '/12 must-report data points' });
    // 2. Tier-2 depth (28)
    var w = r.water || {};
    var wd = w.withdrawals || [];
    var d2 = 0, notes = [];
    if (wd.length && wd.every(function (x) { return x.subtype && x.quality; })) { d2 += 4; notes.push('source sub-type & quality'); }
    var c = w.consumption || {};
    if (['evaporation_ml', 'entrainment_ml', 'other_ml'].every(function (k) { return typeof c[k] === 'number'; })) { d2 += 4; notes.push('consumption components'); }
    if (w.storage && typeof w.storage.opening_ml === 'number' && typeof w.storage.closing_ml === 'number') { d2 += 3; notes.push('storage'); }
    if (w.reuse && typeof w.reuse.task_water_ml === 'number') { d2 += 2; notes.push('task water'); }
    if (Array.isArray(w.monthly) && w.monthly.length === 12) { d2 += 4; notes.push('monthly profile'); }
    if (r.context && Array.isArray(r.context.competing_users) && r.context.competing_users.length) { d2 += 3; notes.push('basin context'); }
    parts.push({ k: 'Tier-2 depth', v: d2, max: 20, note: notes.length ? notes.join(', ') : 'none' });
    // 3. Data quality (20) - volume-weighted
    var vols = [];
    wd.forEach(function (x) { vols.push([x.volume_ml, x.dq]); });
    (w.discharges || []).forEach(function (x) { vols.push([x.volume_ml, x.dq]); });
    if (typeof c.total_ml === 'number') vols.push([c.total_ml, c.total_dq]);
    var tv = sum(vols, function (x) { return x[0]; });
    var q = tv ? sum(vols, function (x) { return (x[0] || 0) * (DQW[x[1]] || 0); }) / tv : 0;
    var measuredShare = tv ? sum(vols, function (x) { return x[1] === 'measured' ? x[0] : 0; }) / tv : 0;
    parts.push({ k: 'Data quality', v: Math.round(q * 30 * 10) / 10, max: 30, note: Math.round(measuredShare * 100) + '% of volume measured' });
    // 4. Assurance (10)
    var lvl = get(r, 'assurance.level');
    parts.push({ k: 'Assurance', v: ASSW[lvl] || 0, max: 16, note: lvl ? lvl.replace('_', ' ') : 'not stated' });
    // 5. Balance closure (6)
    var b = balance(r);
    var bv = !b.known ? 0 : (Math.abs(b.pct) <= 0.02 ? 10 : (Math.abs(b.pct) <= BAL_TOL ? 5 : 0));
    parts.push({ k: 'Balance closure', v: bv, max: 10, note: b.known ? ('residual ' + (b.pct * 100).toFixed(1) + '% of withdrawal') : 'cannot close' });
    var score = Math.round(parts.reduce(function (s, p) { return s + p.v; }, 0));
    var grade = GRADES.filter(function (g) { return score >= g.min; })[0];
    return { score: score, grade: grade, parts: parts, tier1: t1, n1: n1, measuredShare: measuredShare };
  }

  function ddFlags(r) {
    var k = kpis(r), t = transparency(r), flags = [];
    if (k.stress && k.stress.w >= 0.8) flags.push({ lvl: 'critical', t: 'Operates in a ' + k.stress.label.toLowerCase() + ' water-stress basin' });
    if (r.context && r.context.water_grievances >= 5) flags.push({ lvl: 'serious', t: r.context.water_grievances + ' water-related community grievances reported' });
    if (r.context && r.context.water_incidents >= 2) flags.push({ lvl: 'serious', t: r.context.water_incidents + ' water incidents / permit exceedances' });
    if (!k.balance.ok) flags.push({ lvl: 'serious', t: 'Water balance does not close (' + (isNaN(k.balance.pct) ? 'n/a' : (k.balance.pct * 100).toFixed(1) + '%') + ')' });
    if (t.measuredShare < 0.4) flags.push({ lvl: 'warning', t: 'Only ' + Math.round(t.measuredShare * 100) + '% of reported volume is metered' });
    var lvl = get(r, 'assurance.level');
    if (!lvl || lvl === 'none' || lvl === 'internal_review') flags.push({ lvl: 'warning', t: 'No independent assurance of water data' });
    if (r.context && r.context.competing_users && r.context.competing_users.indexOf('agriculture') >= 0 && k.stress && k.stress.w >= 0.5) flags.push({ lvl: 'warning', t: 'Competes with agriculture in a stressed basin' });
    if (!flags.length) flags.push({ lvl: 'good', t: 'No red flags on the MWP screening criteria' });
    return flags;
  }

  function fmt(n, d) {
    if (n === null || n === undefined || isNaN(n)) return '–';
    d = d === undefined ? 0 : d;
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  window.MWP = {
    STRESS: STRESS, GRADES: GRADES, TIER1: TIER1, BAL_TOL: BAL_TOL,
    get: get, balance: balance, kpis: kpis, footprint: footprint, transparency: transparency, ddFlags: ddFlags, fmt: fmt
  };
})();
