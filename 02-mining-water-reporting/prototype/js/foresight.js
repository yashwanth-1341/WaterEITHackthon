/* MineWater Passport - Foresight & impact views (tabs 8 and 9).
   Projects the passports in data/sites.js forward to 2036 under three futures,
   re-scoring every site each year with the tool's own transparency engine (metrics.js).
   Published figures are cited; every model assumption is labelled and adjustable. */
(function () {
  var M = window.MWP, SITES = window.MWP_SITES;
  if (!M || !SITES) return;
  function $(id) { return document.getElementById(id); }
  function fmt(n, d) { return M.fmt(n, d); }
  var BASE_YEAR = 2025, YEARS = []; for (var y = 2026; y <= 2036; y++) YEARS.push(y);
  var COL = { none: '#2a78d6', reg: '#eb6834', pass: '#1baf7a' };
  var EU = { SE: 1, FI: 1, AT: 1, PT: 1, ES: 1, DE: 1, PL: 1, FR: 1, IT: 1, IE: 1, CZ: 1, SK: 1, BG: 1, RO: 1, GR: 1 };
  var BATT_DD = { Li: 1, Ni: 1, Co: 1, graphite: 1 }; // Reg. (EU) 2023/1542 Annex X raw materials

  var S = { g: 2.0, k: 1.5, speed: 0.4, year: 2031, metric: 'unver', sc: 'pass', stress: 50, t0: 20 };

  var SCEN = [
    { id: 'none', name: 'Nothing changes', rate: function () { return 0.03; }, start: 2026, assure: function () { return null; } },
    { id: 'reg', name: 'Regulation only', start: 2027,
      rate: function (r) { return inReach(r) ? 0.15 : 0.03; },
      assure: function (r, t) { return inReach(r) && t >= 2029 ? 'limited' : null; } },
    { id: 'pass', name: 'Regulation + passport', start: 2027,
      rate: function () { return S.speed; },
      assure: function (r, t, k) { if (t >= 2031 && k.stress && k.stress.rank >= 4) return 'reasonable'; return t >= 2028 ? 'limited' : null; } }
  ];
  function inReach(r) { return !!(BATT_DD[r.site.primary_commodity] || EU[r.site.country]); }
  var ASSURE_RANK = { none: 0, internal_review: 1, limited: 2, reasonable: 3 };

  /* ---------- projection engine: clone a passport and apply a scenario for year t */
  function project(r, sc, t) {
    var c = JSON.parse(JSON.stringify(r));
    var yrs = t - sc.start;
    if (yrs > 0) {
      var p = 1 - Math.pow(1 - sc.rate(r), yrs);
      var w = c.water || {};
      // withdrawals and discharges: split each un-metered flow, share p becomes metered
      ['withdrawals', 'discharges'].forEach(function (key) {
        var out = [];
        (w[key] || []).forEach(function (x) {
          if (x.dq === 'measured' || !(x.volume_ml > 0)) { out.push(x); return; }
          var m = JSON.parse(JSON.stringify(x)); m.volume_ml = x.volume_ml * p; m.dq = 'measured';
          x.volume_ml = x.volume_ml * (1 - p); out.push(x); out.push(m);
        });
        if (w[key]) w[key] = out;
      });
      // consumption is one figure: it counts as metered once most inputs are metered
      if (w.consumption && w.consumption.total_dq !== 'measured' && p >= 0.5) w.consumption.total_dq = 'measured';
      var a = sc.assure(r, t, M.kpis(r));
      c.assurance = c.assurance || {};
      if (a && (ASSURE_RANK[a] > (ASSURE_RANK[c.assurance.level] || 0))) c.assurance.level = a;
    }
    return c;
  }

  // metered share of the flows a site can meter (withdrawals + discharges), volume-weighted
  function meteredShare(r) {
    var w = r.water || {}, tot = 0, m = 0;
    (w.withdrawals || []).concat(w.discharges || []).forEach(function (x) { var v = x.volume_ml || 0; tot += v; if (x.dq === 'measured') m += v; });
    return tot ? m / tot : 0;
  }
  var BASE = SITES.map(function (r) { return { r: r, k: M.kpis(r), t: M.transparency(r) }; });
  var cache = {};
  function run() {
    var key = [S.g, S.k, S.speed].join('|');
    if (cache.key === key) return cache.res;
    var grow = function (t) { return Math.pow(1 + S.g * S.k / 100, t - BASE_YEAR); };
    var res = {};
    SCEN.forEach(function (sc) {
      res[sc.id] = YEARS.map(function (t) {
        var sites = BASE.map(function (b) {
          var pr = project(b.r, sc, t), tr = M.transparency(pr);
          return { id: b.r.site.site_id, name: b.r.site.name, C: b.k.C * grow(t), stress: b.k.stress, tr: tr, met: meteredShare(pr) };
        });
        var C = 0, met = 0, unver = 0, sC = 0, score = 0, grades = { A: 0, B: 0, C: 0, D: 0, E: 0 };
        sites.forEach(function (s) {
          C += s.C; score += s.tr.score; grades[s.tr.grade.g]++;
          met += s.C * s.met;
          if (s.stress && s.stress.rank >= 4) { unver += s.C * (1 - s.met); sC += s.C; }
        });
        return { t: t, C: C, metered: met / C * 100, unver: unver / 1000, stressMet: sC ? (1 - unver / sC) * 100 : 100, meanScore: score / sites.length, grades: grades, sites: sites };
      });
    });
    cache = { key: key, res: res };
    return res;
  }

  /* ---------- global (published-data) model, km3 */
  var W2017 = 2.72; // 13.6 km3 over 2015-19 (Lutter et al. 2025) / 5
  function Wg(t) { return W2017 * Math.pow(1 + S.g * S.k / 100, t - 2017); }
  var GSC = [{ id: 'none', cap: 35, r: .15, start: 2026 }, { id: 'reg', cap: 60, r: .30, start: 2027 }, { id: 'pass', cap: 90, r: null, start: 2027 }];
  function Tg(sc, t) { var r = sc.r == null ? S.speed + 0.05 : sc.r, cap = Math.max(sc.cap, S.t0); return t <= sc.start ? S.t0 : S.t0 + (cap - S.t0) * (1 - Math.exp(-r * (t - sc.start))); }
  function blindG(sc, t) { return Wg(t) * S.stress / 100 * (1 - Tg(sc, t) / 100); }

  /* ---------- charts */
  var charts = {};
  function lineChart(id, datasets, yTitle, suffix, max) {
    if (charts[id]) { charts[id].data.datasets = datasets; charts[id].options.scales.y.max = max; charts[id].update(); return; }
    charts[id] = new Chart($(id), {
      type: 'line',
      data: { labels: YEARS.map(function (y) { return y === 2026 ? 'NOW' : String(y); }), datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return ' ' + c.dataset.label + ': ' + fmt(c.parsed.y, suffix === '%' ? 0 : 2) + suffix; } } } },
        elements: { point: { radius: 0, hoverRadius: 5, hitRadius: 12 }, line: { borderWidth: 2, tension: 0.25 } },
        scales: { y: { beginAtZero: true, max: max, title: { display: true, text: yTitle }, grid: { color: '#ecebe5' } }, x: { grid: { display: false } } }
      }
    });
  }
  function ds(id, name, data, dash) { return { label: name, data: data, borderColor: COL[id], backgroundColor: COL[id], borderDash: dash ? [6, 5] : [] }; }

  /* ---------- render: foresight tab */
  function renderSites() {
    var res = run();
    var metric = S.metric;
    var sets = SCEN.map(function (sc) {
      return ds(sc.id, sc.name, res[sc.id].map(function (p) { return metric === 'met' ? p.metered : metric === 'unver' ? p.unver : p.meanScore; }));
    });
    var lbl = metric === 'met' ? '% of water volume metered (not estimated)' : metric === 'unver' ? 'GL/yr unmetered in high-stress basins' : 'mean transparency score (0-100)';
    lineChart('fsChart', sets, lbl, metric === 'met' ? '%' : metric === 'unver' ? ' GL' : '', metric === 'unver' ? undefined : 100);

    var i = S.year - 2026, base = BASE, now = res.none[0];
    var tiles = SCEN.map(function (sc) {
      var p = res[sc.id][i];
      return '<div class="tile fs-t" style="border-top:3px solid ' + COL[sc.id] + '"><div class="k">' + sc.name + ' &middot; ' + S.year + '</div>' +
        '<div class="v">' + fmt(p.unver, 1) + ' <small>GL/yr unmetered in stressed basins</small></div>' +
        '<div class="s">' + fmt(p.metered, 0) + '% of all water metered &middot; mean score ' + fmt(p.meanScore, 0) + ' &middot; sites by grade:</div>' + gradeBar(p.grades) + '</div>';
    }).join('');
    $('fsTiles').innerHTML = tiles;
    $('fsYearOut').textContent = S.year;

    // site table: grade now vs selected year for chosen scenario
    var sc = S.sc, p = res[sc][i];
    $('fsSiteHead').textContent = 'Site grades: today vs ' + S.year + ' (' + SCEN.filter(function (x) { return x.id === sc; })[0].name + ')';
    $('fsSites').innerHTML = '<thead><tr><th>Site</th><th>Basin stress</th><th>In EU reach 2027</th><th class="num">Score now</th><th>Now</th><th></th><th>' + S.year + '</th><th class="num">Score ' + S.year + '</th></tr></thead><tbody>' +
      base.map(function (b, j) {
        var f = p.sites[j], up = f.tr.score - b.t.score;
        return '<tr><td>' + esc(b.r.site.name) + ' <span class="muted tiny">' + b.r.site.primary_commodity + ' &middot; ' + b.r.site.country + '</span></td>' +
          '<td>' + (b.k.stress ? '<span class="stress-dot" style="background:' + b.k.stress.color + '"></span>' + b.k.stress.label : '–') + '</td>' +
          '<td>' + (inReach(b.r) ? '<span class="pill good">yes</span>' : '<span class="pill">no</span>') + '</td>' +
          '<td class="num">' + b.t.score + '</td><td>' + g(b.t.grade) + '</td><td class="muted">&rarr;</td><td>' + g(f.tr.grade) + '</td>' +
          '<td class="num">' + f.tr.score + (up > 0 ? ' <span class="fs-up">+' + up + '</span>' : '') + '</td></tr>';
      }).join('') + '</tbody>';
    var outReach = base.filter(function (b) { return !inReach(b.r); });
    $('fsGapNote').innerHTML = '<b>' + outReach.length + ' of ' + base.length + ' sites</b> (' + outReach.map(function (b) { return b.r.site.primary_commodity; }).filter(uniq).join(', ') +
      ' outside the EU) fall outside both the battery due-diligence list (Co, Li, Ni, natural graphite) and EU reporting. Copper is not on the battery list. Regulation alone leaves these sites where they are; a voluntary, buyer-driven passport reaches them.';
    renderTrend(res);
  }
  function gradeBar(gr) {
    var tot = 0; Object.keys(gr).forEach(function (k) { tot += gr[k]; });
    return '<div class="fs-gbar" title="Sites by grade">' + M.GRADES.map(function (G) {
      var n = gr[G.g]; return n ? '<div style="flex:' + n + ';background:' + G.color + '">' + G.g + (n > 1 ? '&times;' + n : '') + '</div>' : '';
    }).join('') + '</div>';
  }
  function g(G) { return '<span class="grade sm" style="background:' + G.color + '">' + G.g + '</span>'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function uniq(v, i, a) { return a.indexOf(v) === i; }

  function renderGlobal() {
    var sets = GSC.map(function (sc) { return ds(sc.id, SCEN.filter(function (x) { return x.id === sc.id; })[0].name, YEARS.map(function (t) { return blindG(sc, t); })); });
    lineChart('fsGlobal', sets, 'km³/yr invisible to buyers', ' km³');
    var reg = GSC[1], pas = GSC[2], cum = 0;
    for (var t = 2027; t <= 2036; t++) cum += blindG(reg, t) - blindG(pas, t);
    $('fsG1').innerHTML = fmt(Wg(2026), 2) + ' &rarr; ' + fmt(Wg(2036), 2) + ' <small>km³/yr</small>';
    $('fsG2').innerHTML = fmt(blindG(reg, 2036), 2) + ' &rarr; ' + fmt(blindG(pas, 2036), 2) + ' <small>km³</small>';
    $('fsG3').innerHTML = fmt(cum, 1) + ' <small>km³</small>';
    ['g', 'k', 'stress', 't0'].forEach(function (id) { var o = $('fs_' + id + 'Out'); if (o) o.textContent = id === 'g' ? S.g.toFixed(1) + '%' : id === 'k' ? S.k.toFixed(2) + '×' : S[id] + '%'; });
  }

  /* canvas trend line, drawn from the passport projection */
  function renderTrend(res) {
    var svg = $('fsTrend'); if (!svg) return;
    var x = function (t) { return 40 + (t - 2026) / 10 * 560; }, yv = function (v) { return 200 - (v - 60) / 40 * 175; };
    function path(id) { return res[id].map(function (p, j) { return (j ? 'L' : 'M') + x(p.t).toFixed(1) + ',' + yv(p.meanScore).toFixed(1); }).join(' '); }
    var h = '<line x1="40" y1="200" x2="600" y2="200" stroke="#cfcdc5"/>';
    [[2026, 'NOW'], [2028, '+2 years'], [2031, '+5 years'], [2036, '+10 years']].forEach(function (a) { h += '<line x1="' + x(a[0]) + '" x2="' + x(a[0]) + '" y1="196" y2="204" stroke="#9a978f"/><text x="' + x(a[0]) + '" y="220" text-anchor="' + (a[0] === 2026 ? 'start' : a[0] === 2036 ? 'end' : 'middle') + '">' + a[1] + '</text>'; });
    h += '<path d="' + path('reg') + '" fill="none" stroke="' + COL.reg + '" stroke-width="2.5"/>';
    h += '<path d="' + path('pass') + '" fill="none" stroke="' + COL.pass + '" stroke-width="2.5" stroke-dasharray="6 5"/>';
    var e = res.reg[10], d = res.pass[10];
    h += '<text x="604" y="' + (yv(e.meanScore) + 4) + '" style="font-weight:700">' + Math.round(e.meanScore) + '</text><text x="604" y="' + (yv(d.meanScore) + 4) + '" style="font-weight:700">' + Math.round(d.meanScore) + '</text>';
    h += '<text x="' + (x(2027) + 4) + '" y="' + (yv(res.pass[2].meanScore) - 12) + '">2027: EU buyer duties start</text>';
    [60, 80, 100].forEach(function (v) { h += '<text x="34" y="' + (yv(v) + 4) + '" text-anchor="end">' + v + '</text>'; });
    h += '<text x="' + (x(2026) + 4) + '" y="' + (yv(res.none[0].meanScore) + 18) + '">today ' + Math.round(res.none[0].meanScore) + '</text>';
    svg.innerHTML = h;
  }

  /* ---------- business tab */
  function renderBiz() {
    var n = +$('fb_n').value, h1 = +$('fb_h1').value, h2 = +$('fb_h2').value, rate = +$('fb_rate').value, price = +$('fb_price').value;
    $('fb_nOut').textContent = n; $('fb_h1Out').textContent = h1 + ' h'; $('fb_h2Out').textContent = h2 + ' h'; $('fb_rateOut').textContent = '€' + rate; $('fb_priceOut').textContent = '€' + fmt(price);
    var hs = n * Math.max(0, h1 - h2), es = hs * rate, pay = n * price;
    $('fbH').innerHTML = fmt(hs) + ' <small>h</small>'; $('fbE').innerHTML = '€' + fmt(es); $('fbP').innerHTML = '€' + fmt(pay);
    $('fbR').textContent = 'Buyer ROI ' + (es / pay).toFixed(1) + '× (cost saved ÷ price)';
  }

  /* ---------- wiring (lazy, because charts need a visible container) */
  var inited = {};
  function init(v) {
    if (v === 'foresight' && !inited.f) {
      inited.f = true;
      [['fs_g', 'g'], ['fs_k', 'k'], ['fs_stress', 'stress'], ['fs_t0', 't0']].forEach(function (a) {
        $(a[0]).addEventListener('input', function (e) { S[a[1]] = parseFloat(e.target.value); if (a[1] === 'g' || a[1] === 'k') renderSites(); renderGlobal(); });
      });
      $('fs_year').addEventListener('input', function (e) { S.year = +e.target.value; renderSites(); });
      seg('fsSpeed', function (b) { S.speed = parseFloat(b.getAttribute('data-v')); renderSites(); renderGlobal(); });
      seg('fsMetric', function (b) { S.metric = b.getAttribute('data-v'); renderSites(); });
      seg('fsScen', function (b) { S.sc = b.getAttribute('data-v'); renderSites(); });
      renderSites(); renderGlobal(); renderIcmm();
    }
    if (v === 'impact' && !inited.b) {
      inited.b = true;
      ['fb_n', 'fb_h1', 'fb_h2', 'fb_rate', 'fb_price'].forEach(function (id) { $(id).addEventListener('input', renderBiz); });
      renderBiz();
    }
  }
  function seg(id, fn) { $(id).addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; $(id).querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); fn(b); }); }
  function renderIcmm() {
    var D = [['At least one high water-risk indicator', 65.7], ['High / extremely high baseline water stress or arid', 38.2], ['High / extremely high baseline water depletion', 27.4], ['High drought risk', 27.0], ['High / extremely high interannual variability', 16.2], ['High / extremely high flood risk', 14.0], ['Three or more indicators at once', 4.9]];
    $('fsIcmm').innerHTML = D.map(function (d) { return '<div class="fs-bar" title="' + d[0] + ': ' + d[1] + '%"><span>' + d[0] + '</span><span class="fs-track"><span style="width:' + d[1] + '%"></span></span><b>' + d[1].toFixed(1) + '%</b></div>'; }).join('');
  }
  document.getElementById('tabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) setTimeout(function () { init(b.getAttribute('data-view')); }, 0); });
  var h = (location.hash || '').replace('#', '');
  if (h === 'foresight' || h === 'impact') setTimeout(function () { if (window.MWPApp) window.MWPApp.show(h); init(h); }, 50);
  window.MWP_FORESIGHT = { run: run, project: project, S: S };
})();
