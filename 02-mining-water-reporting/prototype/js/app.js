/* MineWater Passport prototype - views. Offline, file:// friendly. */
(function () {
  var M = window.MWP, fmt = M.fmt;
  var SITES = window.MWP_SITES;
  var DATA = SITES.map(function (r) { return { r: r, k: M.kpis(r), t: M.transparency(r) }; });
  var byId = {}; DATA.forEach(function (d) { byId[d.r.site.site_id] = d; });
  var selected = DATA[0].r.site.site_id;
  var sizeKey = 'C';
  var comFilter = 'all';
  var sortKey = 'swc', sortDir = -1;
  var charts = {};
  var QCOL = { cat1: '#2a78d6', cat2: '#eb6834', cat3: '#1baf7a', unknown: '#b9b7b0' };
  var ROUTE = { flotation: 'Flotation', dense_media_separation: 'DMS', heap_leach_sx_ew: 'Heap leach SX-EW', agitated_leach_sx_ew: 'Agitated leach SX-EW', bioheap_leach: 'Bioheap leach', hpal: 'HPAL', brine_evaporation: 'Brine evaporation', direct_lithium_extraction: 'DLE', gravity: 'Gravity', smelting_refining: 'Smelting/refining', none_ore_shipped: 'None' };
  var MT = { open_pit: 'Open pit', underground: 'Underground', open_pit_and_underground: 'Open pit + UG', brine: 'Brine', in_situ_leach: 'In-situ leach', tailings_reprocessing: 'Tailings reprocessing' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function route(r) { return r.site.processing_route.map(function (x) { return ROUTE[x] || x; }).join(' + '); }
  function commodities(r) { return r.production.products.map(function (p) { return p.commodity; }); }
  function gradeHtml(t, cls) { return '<span class="grade ' + (cls || '') + '" style="background:' + t.grade.color + '" title="Transparency ' + t.score + '/100 - ' + esc(t.grade.text) + '">' + t.grade.g + '</span>'; }
  function stressHtml(k) { return k.stress ? '<span class="stress-dot" style="background:' + k.stress.color + '"></span>' + k.stress.label : '–'; }
  function isHot(d) { return d.k.stress && d.k.stress.rank >= 4 && d.k.C >= 3000; }

  if (window.Chart) {
    Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
    Chart.defaults.color = '#52514e';
    Chart.defaults.borderColor = '#e3e1da';
    Chart.defaults.animation = false;
  }

  /* ------------------------------------------------------------ tabs */
  var inited = {};
  function show(v) {
    document.querySelectorAll('#tabs button').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-view') === v); });
    document.querySelectorAll('.view').forEach(function (s) { s.classList.toggle('active', s.id === 'v-' + v); });
    if (!inited[v]) { inited[v] = true; (INIT[v] || function () {})(); }
    if (v === 'explorer' && map) setTimeout(function () { map.invalidateSize(); }, 30);
    try { history.replaceState(null, '', '#' + v); } catch (e) { /* file:// may block */ }
    window.scrollTo(0, 0);
  }
  $('tabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) show(b.getAttribute('data-view')); });

  /* ------------------------------------------------------------ explorer */
  var map, markers = {};
  function initExplorer() {
    var tot = DATA.reduce(function (a, d) { a.W += d.k.W; a.C += d.k.C; a.t2 += d.r.tier === 'tier2' ? 1 : 0; a.hs += (d.k.stress && d.k.stress.rank >= 4) ? d.k.C : 0; a.est += d.t.measuredShare < .4 ? 1 : 0; return a; }, { W: 0, C: 0, t2: 0, hs: 0, est: 0 });
    $('tiles').innerHTML = [
      ['Sites with a passport', DATA.length, '', tot.t2 + ' at Tier 2 (full balance)'],
      ['Water withdrawn', fmt(tot.W / 1000, 1), 'GL', 'all sources incl. seawater & brine'],
      ['Water consumed', fmt(tot.C / 1000, 1), 'GL', Math.round(tot.C / tot.W * 100) + '% of withdrawal not returned'],
      ['Consumption in high-stress basins', Math.round(tot.hs / tot.C * 100), '%', 'high / extremely high / arid basins'],
      ['Sites mostly on estimates', tot.est, '', '<40% of volume metered']
    ].map(function (t) { return '<div class="tile"><div class="k">' + t[0] + '</div><div class="v">' + t[1] + ' <small>' + t[2] + '</small></div><div class="s">' + t[3] + '</div></div>'; }).join('');

    map = L.map('map', { zoomSnap: 0.25, worldCopyJump: false, minZoom: 1.5, maxZoom: 8, attributionControl: true });
    map.fitBounds(DATA.map(function (d) { return [d.r.site.latitude, d.r.site.longitude]; }), { padding: [30, 30] });
    map.attributionControl.setPrefix('');
    map.attributionControl.addAttribution('Basemap: Natural Earth (public domain) &middot; offline');
    L.geoJSON(window.WORLD_GEOJSON, { style: { color: '#bdb9ad', weight: 0.6, fillColor: '#f8f6f0', fillOpacity: 1 }, interactive: false }).addTo(map);
    var bounds = [];
    DATA.forEach(function (d) {
      var s = d.r.site;
      var m = L.circleMarker([s.latitude, s.longitude], { radius: 8, color: isHot(d) ? '#111' : '#333', weight: isHot(d) ? 2.5 : 1, fillColor: d.k.stress.color, fillOpacity: 0.88 });
      m.bindTooltip('<div class="mtip"><b>' + esc(s.name) + '</b><br>' + commodities(d.r).join(', ') + ' &middot; ' + esc(route(d.r)) +
        '<br>Withdrawal ' + fmt(d.k.W) + ' ML &middot; Consumption ' + fmt(d.k.C) + ' ML<br>Basin stress: ' + d.k.stress.label + ' &middot; Grade ' + d.t.grade.g + '</div>', { direction: 'top', offset: [0, -6] });
      m.on('click', function () { select(s.site_id); });
      m.addTo(map); markers[s.site_id] = m; bounds.push([s.latitude, s.longitude]);
    });
    sizeMarkers();
    var leg = Object.keys(M.STRESS).map(function (k) { return '<span><span class="sw" style="background:' + M.STRESS[k].color + '"></span>' + M.STRESS[k].label + '</span>'; }).join('');
    $('mapLegend').innerHTML = '<strong style="color:#111">Basin water stress:</strong>' + leg + '<span class="muted">&#9679; size = ' + '<span id="sizeLbl">consumption</span> (ML) &middot; bold ring = hotspot</span>';
    $('sizeSeg').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      sizeKey = b.getAttribute('data-k');
      $('sizeSeg').querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
      $('sizeLbl').textContent = sizeKey === 'C' ? 'consumption' : 'withdrawal';
      sizeMarkers();
    });
    var coms = ['all', 'Cu', 'Li', 'Ni', 'Co'];
    $('comFilter').innerHTML = coms.map(function (c) { return '<button data-c="' + c + '"' + (c === comFilter ? ' class="on"' : '') + '>' + (c === 'all' ? 'All commodities' : c) + '</button>'; }).join('');
    $('comFilter').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return; comFilter = b.getAttribute('data-c');
      $('comFilter').querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); renderTable();
    });
    renderTable(); renderDetail();
  }
  function sizeMarkers() {
    var max = Math.max.apply(null, DATA.map(function (d) { return d.k[sizeKey]; }));
    DATA.forEach(function (d) { markers[d.r.site.site_id].setRadius(4 + Math.sqrt(d.k[sizeKey] / max) * 24); });
  }
  var COLS = [
    { k: 'name', l: 'Site', v: function (d) { return d.r.site.name; }, h: function (d) { return '<b>' + esc(d.r.site.name.replace(' (project)', '*')) + '</b> <span class="muted small">' + d.r.site.country + ' &middot; ' + commodities(d.r).filter(function (c) { return c !== 'other'; }).join(', ') + ' &middot; ' + (d.r.tier === 'tier2' ? 'T2' : 'T1') + '</span>'; } },
    { k: 'route', l: 'Route', v: function (d) { return route(d.r); }, h: function (d) { return '<span class="small">' + esc(route(d.r).replace(' + Smelting/refining', ' + SX')) + '</span>'; } },
    { k: 'W', l: 'Withdrawal ML', n: 1, v: function (d) { return d.k.W; }, h: function (d) { return fmt(d.k.W); } },
    { k: 'C', l: 'Consumption ML', n: 1, v: function (d) { return d.k.C; }, h: function (d) { return fmt(d.k.C); } },
    { k: 'ratio', l: 'Cons./withdr.', n: 1, v: function (d) { return d.k.consumptionRatio; }, h: function (d) { return Math.round(d.k.consumptionRatio * 100) + '%'; } },
    { k: 'wpo', l: 'W m³/t ore', n: 1, v: function (d) { return d.k.wPerOre; }, h: function (d) { return fmt(d.k.wPerOre, 2); } },
    { k: 'cpo', l: 'C m³/t ore', n: 1, v: function (d) { return d.k.cPerOre; }, h: function (d) { return fmt(d.k.cPerOre, 2); } },
    { k: 'cpm', l: 'C m³/t metal', n: 1, v: function (d) { return d.k.cPerMetal; }, h: function (d) { return fmt(d.k.cPerMetal) + (d.k.metalBasis === 'LCE' ? ' <span class="muted tiny">LCE</span>' : ''); } },
    { k: 'stress', l: 'Basin stress', v: function (d) { return d.k.stress.rank + (d.k.stressKey === 'arid_low_water_use' ? .1 : 0); }, h: function (d) { return stressHtml(d.k).replace('Arid &amp; low water use', 'Arid').replace('Arid & low water use', 'Arid'); } },
    { k: 'swc', l: 'Stress-wtd C ML', n: 1, v: function (d) { return d.k.stressWeightedC; }, h: function (d) { return (isHot(d) ? '<span class="hot">' : '<span>') + fmt(d.k.stressWeightedC) + '</span>'; } },
    { k: 'bal', l: 'Balance', n: 1, v: function (d) { return Math.abs(d.k.balance.pct); }, h: function (d) { return d.k.balance.ok ? '<span class="pill good">' + (d.k.balance.pct * 100).toFixed(1) + '%</span>' : '<span class="pill bad">' + (d.k.balance.pct * 100).toFixed(1) + '%</span>'; } },
    { k: 'grade', l: 'Grade', v: function (d) { return d.t.score; }, h: function (d) { return gradeHtml(d.t, 'sm'); } }
  ];
  function renderTable() {
    var rows = DATA.filter(function (d) { return comFilter === 'all' || commodities(d.r).indexOf(comFilter) >= 0; });
    var col = COLS.filter(function (c) { return c.k === sortKey; })[0];
    rows.sort(function (a, b) {
      var x = col.v(a), y = col.v(b);
      if (typeof x === 'number' && isNaN(x)) return 1; if (typeof y === 'number' && isNaN(y)) return -1;
      return (x > y ? 1 : x < y ? -1 : 0) * sortDir;
    });
    $('cmpTable').innerHTML = '<thead><tr>' + COLS.map(function (c) { return '<th data-k="' + c.k + '" class="' + (c.n ? 'num' : '') + '">' + c.l + (c.k === sortKey ? (sortDir > 0 ? ' &#9650;' : ' &#9660;') : '') + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (d) { return '<tr data-id="' + d.r.site.site_id + '"' + (d.r.site.site_id === selected ? ' class="sel"' : '') + '>' + COLS.map(function (c) { return '<td class="' + (c.n ? 'num' : '') + '">' + (c.h ? c.h(d) : esc(c.v(d))) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody>';
  }
  $('cmpTable').addEventListener('click', function (e) {
    var th = e.target.closest('th');
    if (th) { var k = th.getAttribute('data-k'); if (k === sortKey) sortDir *= -1; else { sortKey = k; sortDir = -1; } renderTable(); return; }
    var tr = e.target.closest('tr[data-id]'); if (tr) select(tr.getAttribute('data-id'));
  });
  function balanceBar(k) {
    var tot = Math.max(k.W, k.D + k.C + Math.max(0, k.dS));
    function seg(v, c, l) { return v > 0 ? '<div style="width:' + (v / tot * 100) + '%;background:' + c + '" title="' + l + ': ' + fmt(v) + ' ML">' + (v / tot > .12 ? l : '') + '</div>' : ''; }
    var ins = ['cat1', 'cat2', 'cat3', 'unknown'].map(function (q) { return seg(k.byQ[q], QCOL[q], q === 'unknown' ? 'n/a' : 'Cat ' + q.slice(3)); }).join('');
    var outs = seg(k.C, '#86270b', 'Consumed') + seg(k.D, '#2a78d6', 'Discharged') + seg(Math.max(0, k.dS), '#8d8a80', '+Storage') + seg(Math.max(0, k.balance.resid), '#e6a8a8', 'Unaccounted');
    return '<div class="small muted">Inputs by quality (ML)</div><div class="balbar">' + ins + '</div><div class="small muted">Outputs (ML)</div><div class="balbar">' + outs + '</div>';
  }
  function renderDetail() {
    var d = byId[selected], s = d.r.site, k = d.k;
    $('siteDetail').innerHTML = '<div class="row between"><div><h3 style="font-size:17px">' + esc(s.name) + '</h3><div class="small muted">' + esc(s.operator) + ' &middot; ' + s.country + ' &middot; ' + s.site_id + '</div></div>' + gradeHtml(d.t) + '</div>' +
      '<p class="small">' + esc(MT[s.mine_type]) + ' &middot; ' + esc(route(d.r)) + ' &middot; ' + esc(s.lifecycle_stage || '') + ' &middot; ' + d.r.tier.toUpperCase() + '</p>' +
      '<table class="kv"><tr><td>Withdrawal / consumption</td><td>' + fmt(k.W) + ' / ' + fmt(k.C) + ' ML</td></tr>' +
      '<tr><td>Consumption intensity</td><td>' + (isNaN(k.cPerOre) ? '' : fmt(k.cPerOre, 2) + ' m³/t ore &middot; ') + fmt(k.cPerMetal) + ' m³/t ' + (k.metalBasis === 'LCE' ? 'LCE' : s.primary_commodity) + '</td></tr>' +
      '<tr><td>Freshwater-grade (Cat 1) share</td><td>' + Math.round(k.cat1 / k.W * 100) + '%</td></tr>' +
      '<tr><td>Basin (' + esc(s.basin.name) + ')</td><td>' + stressHtml(k) + '</td></tr>' +
      '<tr><td>Mass balance residual</td><td>' + (k.balance.pct * 100).toFixed(1) + '% ' + (k.balance.ok ? '&#10003;' : '&#9888;') + '</td></tr>' +
      '<tr><td>Metered share of volume</td><td>' + Math.round(d.t.measuredShare * 100) + '%</td></tr></table>' +
      balanceBar(k) +
      '<div class="row" style="margin-top:12px"><button class="btn sm" id="dCard">Report card</button><button class="btn sm ghost" id="dForm">Open in form</button></div>';
    $('dCard').onclick = function () { $('cardSite').value = selected; show('card'); renderCard(); };
    $('dForm').onclick = function () { show('entry'); window.MWPForm.load(d.r); $('fExample').value = selected; };
  }
  function select(id) {
    selected = id; renderDetail(); renderTable();
    Object.keys(markers).forEach(function (k) { var d = byId[k]; markers[k].setStyle({ weight: k === id ? 4 : (isHot(d) ? 2.5 : 1), color: k === id ? '#1c5cab' : (isHot(d) ? '#111' : '#333') }); });
    if (markers[id]) markers[id].bringToFront();
  }

  /* ------------------------------------------------------------ hotspots */
  var labelPlugin = {
    id: 'mwpLabels',
    afterDatasetsDraw: function (chart, args, opts) {
      if (!opts || !opts.labels) return;
      var ctx = chart.ctx, area = chart.chartArea, placed = [];
      ctx.save(); ctx.font = '600 11px system-ui, Segoe UI, sans-serif'; ctx.fillStyle = '#222'; ctx.textBaseline = 'middle';
      var pts = [];
      chart.data.datasets.forEach(function (ds, i) { chart.getDatasetMeta(i).data.forEach(function (el, j) { pts.push({ el: el, raw: ds.data[j], pri: i === 0 ? 0 : 1 }); }); });
      pts.forEach(function (p) { placed.push({ x0: p.el.x - p.el.options.radius, x1: p.el.x + p.el.options.radius, y0: p.el.y - p.el.options.radius, y1: p.el.y + p.el.options.radius, bubble: true }); });
      pts.sort(function (a, b) { return a.pri - b.pri || b.raw.y - a.raw.y; });
      pts.forEach(function (p) {
        var w = ctx.measureText(p.raw.label).width, rad = p.el.options.radius, x = p.el.x, y = p.el.y;
        var cands = [[x + rad + 4, y, 'left'], [x - rad - 4 - w, y, 'left'], [x - w / 2, y - rad - 9, 'left'], [x - w / 2, y + rad + 9, 'left'], [x + rad + 4, y - 12, 'left'], [x + rad + 4, y + 12, 'left'], [x - rad - 4 - w, y - 12, 'left'], [x - rad - 4 - w, y + 12, 'left'], [x - w / 2, y - rad - 22, 'left'], [x - w / 2, y + rad + 22, 'left'], [x + rad + 4, y - 24, 'left'], [x + rad + 4, y + 24, 'left'], [x - rad - 4 - w, y - 24, 'left'], [x - rad - 4 - w, y + 24, 'left']];
        for (var i = 0; i < cands.length; i++) {
          var c = cands[i], r = { x0: c[0] - 1, x1: c[0] + w + 1, y0: c[1] - 7, y1: c[1] + 7, self: p };
          if (r.x0 < area.left || r.x1 > area.right + 60 || r.y0 < area.top || r.y1 > area.bottom) continue;
          var ok = !placed.some(function (q) { if (q.bubble && Math.abs((q.x0 + q.x1) / 2 - x) < .5 && Math.abs((q.y0 + q.y1) / 2 - y) < .5) return false; return !(r.x1 < q.x0 || r.x0 > q.x1 || r.y1 < q.y0 || r.y0 > q.y1); });
          if (ok) { ctx.fillText(p.raw.label, c[0], c[1]); placed.push(r); break; }
        }
      });
      ctx.restore();
    }
  };
  var quadPlugin = {
    id: 'mwpQuad',
    beforeDatasetsDraw: function (chart, args, opts) {
      if (!opts || !opts.on) return;
      var x = chart.scales.x, y = chart.scales.y, a = chart.chartArea, ctx = chart.ctx;
      var x0 = x.getPixelForValue(3), y0 = y.getPixelForValue(3000);
      ctx.save(); ctx.fillStyle = 'rgba(194,52,52,0.07)'; ctx.fillRect(x0, a.top, a.right - x0, y0 - a.top);
      ctx.strokeStyle = 'rgba(194,52,52,0.5)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x0, a.top); ctx.lineTo(x0, a.bottom); ctx.moveTo(a.left, y0); ctx.lineTo(a.right, y0); ctx.stroke();
      ctx.setLineDash([]); ctx.fillStyle = '#a52a2a'; ctx.font = '700 12px system-ui, Segoe UI, sans-serif'; ctx.textAlign = 'right'; ctx.fillText('HOTSPOT ZONE', a.right - 8, a.top + 16);
      ctx.restore();
    }
  };
  function initHotspots() {
    var maxI = Math.max.apply(null, DATA.map(function (d) { return isNaN(d.k.cPerOre) ? 0 : d.k.cPerOre; }));
    function pt(d) {
      var x = d.k.bws + (d.k.stressKey === 'arid_low_water_use' ? 0 : 0);
      return { x: x, y: d.k.C, r: isNaN(d.k.cPerOre) ? 9 : 5 + Math.sqrt(d.k.cPerOre / maxI) * 16, label: d.r.site.name.replace(/ \(project\)/, '').replace(/ HPAL$/, '').replace(/ DLE/, '').replace(/ (Copper|Lithium|Nickel|Cobalt)(-[A-Za-z]+)?$/, ''), id: d.r.site.site_id };
    }
    var hot = DATA.filter(isHot), rest = DATA.filter(function (d) { return !isHot(d); });
    charts.hot = new Chart($('hotChart'), {
      type: 'bubble',
      data: { datasets: [
        { label: 'Hotspot', data: hot.map(pt), backgroundColor: 'rgba(194,52,52,0.78)', borderColor: '#fcfcfb', borderWidth: 2 },
        { label: 'Other sites', data: rest.map(pt), backgroundColor: 'rgba(42,120,214,0.7)', borderColor: '#fcfcfb', borderWidth: 2 }
      ] },
      options: {
        maintainAspectRatio: false,
        layout: { padding: { right: 70 } },
        scales: {
          x: { min: 0, max: 5.3, title: { display: true, text: 'Basin baseline water stress score (0-5, illustrative; arid basins set to 4.5)' }, ticks: { stepSize: 1 }, grid: { color: '#eeede8' } },
          y: { type: 'logarithmic', min: 150, max: 80000, title: { display: true, text: 'Water consumption (ML/yr, log scale)' }, ticks: { callback: function (v) { return [200, 500, 1000, 2000, 5000, 10000, 20000, 50000].indexOf(v) >= 0 ? fmt(v) : ''; } }, grid: { color: '#eeede8' } }
        },
        plugins: {
          legend: { display: false },
          mwpLabels: { labels: true }, mwpQuad: { on: true },
          tooltip: { callbacks: { label: function (c) { var d = byId[c.raw.id]; return [d.r.site.name, 'Consumption ' + fmt(d.k.C) + ' ML · ' + (isNaN(d.k.cPerOre) ? 'brine op.' : fmt(d.k.cPerOre, 2) + ' m³/t ore'), 'Stress: ' + d.k.stress.label]; } } }
        },
        onClick: function (e, els) { if (els.length) { var raw = charts.hot.data.datasets[els[0].datasetIndex].data[els[0].index]; selected = raw.id; $('cardSite').value = raw.id; show('card'); renderCard(); } }
      },
      plugins: [labelPlugin, quadPlugin]
    });
    var rk = DATA.slice().sort(function (a, b) { return b.k.stressWeightedC - a.k.stressWeightedC; });
    var mx = rk[0].k.stressWeightedC;
    $('rankList').innerHTML = rk.map(function (d, i) {
      return '<li><span class="muted">' + (i + 1) + '</span><div><div class="' + (isHot(d) ? 'hot' : '') + '">' + esc(d.r.site.name) + '</div><div class="tiny muted">' + commodities(d.r).join(', ') + ' &middot; ' + stressHtml(d.k) + ' &middot; grade ' + d.t.grade.g + '</div></div>' +
        '<div><div class="bar"><div style="width:' + (d.k.stressWeightedC / mx * 100) + '%;background:' + d.k.stress.color + '"></div></div><div class="tiny num">' + fmt(d.k.stressWeightedC) + ' ML-eq</div></div></li>';
    }).join('');
  }

  /* ------------------------------------------------------------ supply chain */
  var supCom = 'Li', mixShares = {};
  function supSites() {
    return DATA.map(function (d) { return { d: d, f: M.footprint(d.r, supCom) }; }).filter(function (x) { return x.f; }).sort(function (a, b) { return b.f.c - a.f.c; });
  }
  function initSupply() {
    $('supCom').innerHTML = ['Cu', 'Li', 'Ni', 'Co'].map(function (c) { return '<button data-c="' + c + '"' + (c === supCom ? ' class="on"' : '') + '>' + { Cu: 'Copper', Li: 'Lithium (LCE)', Ni: 'Nickel', Co: 'Cobalt' }[c] + '</button>'; }).join('');
    $('supCom').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; supCom = b.getAttribute('data-c'); $('supCom').querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); mixShares = {}; renderSupply(); });
    $('supSite').addEventListener('change', renderFlags);
    $('supLegend').innerHTML = Object.keys(M.STRESS).map(function (k) { return '<span><span class="sq" style="background:' + M.STRESS[k].color + '"></span>' + M.STRESS[k].label + '</span>'; }).join('');
    renderSupply();
  }
  function renderSupply() {
    var ss = supSites();
    var labels = ss.map(function (x) { return x.d.r.site.name.replace(/ \(project\)/, '*'); });
    var unit = supCom === 'Li' ? 'm³/t LCE' : 'm³/t ' + supCom;
    if (charts.supC) charts.supC.destroy();
    charts.supC = new Chart($('supC'), {
      type: 'bar',
      data: { labels: labels, datasets: [{ label: 'Consumption ' + unit, data: ss.map(function (x) { return Math.round(x.f.c); }), backgroundColor: ss.map(function (x) { return x.d.k.stress.color; }), borderRadius: 4, barThickness: 16 }] },
      options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { var x = ss[c.dataIndex]; return fmt(x.f.c) + ' ' + unit + ' (allocation ' + Math.round(x.f.alloc * 100) + '%) · ' + x.d.k.stress.label + ' stress'; } } } },
        scales: { x: { title: { display: true, text: 'Water consumed per t (' + unit + ')' }, grid: { color: '#eeede8' } }, y: { grid: { display: false } } } }
    });
    if (charts.supW) charts.supW.destroy();
    charts.supW = new Chart($('supW'), {
      type: 'bar',
      data: { labels: labels, datasets: ['cat1', 'cat2', 'cat3', 'unknown'].map(function (q) {
        return { label: q === 'unknown' ? 'Not categorised' : 'Cat ' + q.slice(3), data: ss.map(function (x) { return Math.round(x.f.byQ[q]); }), backgroundColor: QCOL[q], borderColor: '#fcfcfb', borderWidth: { right: 2 }, barThickness: 16, borderSkipped: false };
      }).filter(function (ds) { return ds.data.some(function (v) { return v > 0; }); }) },
      options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 12 } } },
        scales: { x: { stacked: true, title: { display: true, text: 'Water withdrawn per t (' + unit + ')' }, grid: { color: '#eeede8' } }, y: { stacked: true, grid: { display: false } } } }
    });
    // mix
    ss.forEach(function (x) { if (mixShares[x.d.r.site.site_id] === undefined) mixShares[x.d.r.site.site_id] = Math.round(100 / ss.length); });
    $('mix').innerHTML = ss.map(function (x) { var id = x.d.r.site.site_id; return '<div class="mix"><span>' + esc(x.d.r.site.name) + ' <span class="tiny muted">' + fmt(x.f.c) + ' ' + unit + '</span></span><input type="range" min="0" max="100" value="' + mixShares[id] + '" data-id="' + id + '"><span class="num" id="ms-' + id + '">' + mixShares[id] + '</span></div>'; }).join('');
    $('mix').oninput = function (e) { var id = e.target.getAttribute('data-id'); if (!id) return; mixShares[id] = parseInt(e.target.value, 10); $('ms-' + id).textContent = mixShares[id]; renderMix(ss, unit); };
    renderMix(ss, unit);
    $('supSite').innerHTML = ss.map(function (x) { return '<option value="' + x.d.r.site.site_id + '">' + esc(x.d.r.site.name) + '</option>'; }).join('');
    renderFlags();
  }
  function renderMix(ss, unit) {
    var tot = ss.reduce(function (a, x) { return a + mixShares[x.d.r.site.site_id]; }, 0) || 1;
    var c = 0, sw = 0, hs = 0, ass = 0, ab = 0, fresh = 0;
    ss.forEach(function (x) {
      var w = mixShares[x.d.r.site.site_id] / tot;
      c += w * x.f.c; sw += w * x.f.c * x.d.k.stress.w; fresh += w * x.f.byQ.cat1;
      if (x.d.k.stress.rank >= 4) hs += w;
      var l = x.d.r.assurance.level; if (l === 'limited' || l === 'reasonable') ass += w;
      if (x.d.t.grade.g === 'A' || x.d.t.grade.g === 'B') ab += w;
    });
    $('mixRes').innerHTML = [
      ['Blended consumption', fmt(c), unit],
      ['Freshwater-grade withdrawal', fmt(fresh), unit],
      ['Volume from high-stress basins', Math.round(hs * 100), '%'],
      ['Offtake from assured / grade A-B sites', Math.round(ass * 100) + '% / ' + Math.round(ab * 100), '%']
    ].map(function (t) { return '<div class="tile"><div class="k">' + t[0] + '</div><div class="v">' + t[1] + ' <small>' + t[2] + '</small></div></div>'; }).join('');
  }
  function renderFlags() {
    var id = $('supSite').value, d = byId[id]; if (!d) return;
    var ic = { critical: '!', serious: '!', warning: '?', good: '&#10003;' };
    $('supFlags').innerHTML = M.ddFlags(d.r).map(function (f) { return '<li class="' + f.lvl + '"><span class="ic">' + ic[f.lvl] + '</span><span><b style="text-transform:capitalize">' + f.lvl + ':</b> ' + esc(f.t) + '</span></li>'; }).join('');
    var battery = ['Li', 'Ni', 'Co'].indexOf(supCom) >= 0;
    $('supReg').innerHTML = battery
      ? '<b>Why a buyer needs this:</b> the EU Batteries Regulation (EU) 2023/1542 requires battery due-diligence policies (Art. 47-48) covering cobalt, lithium, natural graphite and nickel; Annex X lists water-related environmental risks (incl. water use, water quantities and access to water). Obligations apply from 18 Aug 2027 (postponed by Reg. (EU) 2025/1561). A passport gives the site-level evidence those policies need.'
      : '<b>Why a buyer needs this:</b> copper is a strategic raw material under the Critical Raw Materials Act (EU) 2024/1252. Strategic projects must be implemented sustainably, incl. monitoring, prevention and minimisation of environmental impacts (Art. 6(1)(c)); CSRD/ESRS E3 asks buyers to understand water impacts in their value chain. A passport makes supplier water performance comparable.';
  }

  /* ------------------------------------------------------------ report card */
  function initCard() {
    $('cardSite').innerHTML = DATA.map(function (d) { return '<option value="' + d.r.site.site_id + '">' + esc(d.r.site.name) + ' (' + d.r.site.country + ')</option>'; }).join('');
    $('cardSite').value = selected;
    $('cardSite').addEventListener('change', function () { selected = $('cardSite').value; renderCard(); });
    $('printBtn').addEventListener('click', function () { window.print(); });
    renderCard();
  }
  function fwCoverage(r, t) {
    var w = r.water, has = function (x) { return x !== undefined && x !== null; };
    var srcOk = w.withdrawals.every(function (x) { return x.source; });
    var gri3 = srcOk ? (w.withdrawals.every(function (x) { return has(x.freshwater_gri); }) ? 'ok' : 'part') : 'no';
    var gri4 = w.discharges ? (w.discharges.every(function (x) { return has(x.quality); }) ? 'ok' : 'part') : 'no';
    var gri5 = has(w.consumption.total_ml) ? (w.storage ? 'ok' : 'part') : 'no';
    var esrs = has(w.consumption.total_ml) && has(w.reuse.reused_recycled_ml) ? (w.storage && r.context ? 'ok' : 'part') : 'no';
    var cdp = srcOk && w.discharges ? 'ok' : 'part';
    var icmm = w.withdrawals.every(function (x) { return x.quality; }) && has(w.reuse.reused_recycled_ml) ? (typeof w.consumption.evaporation_ml === 'number' ? 'ok' : 'part') : 'part';
    var irma = w.monthly && r.context ? 'ok' : 'part';
    return [['GRI 303-3', gri3], ['GRI 303-4', gri4], ['GRI 303-5', gri5], ['ESRS E3-4', esrs], ['CDP 9.2.x', cdp], ['ICMM 2021', icmm], ['IRMA 4.2.5', irma]];
  }
  function renderCard() {
    var d = byId[$('cardSite').value || selected], r = d.r, s = r.site, k = d.k, t = d.t;
    var cov = fwCoverage(r, t);
    $('rc').innerHTML =
      '<div class="rc-head">' + gradeHtml(t, 'xl') + '<div style="flex:1"><div class="small muted">MINEWATER PASSPORT &middot; SITE REPORT CARD &middot; ' + r.period.year + '</div><h2>' + esc(s.name) + '</h2>' +
      '<div class="small">' + esc(s.operator) + ' &middot; ' + s.country + ' &middot; ' + s.latitude.toFixed(2) + ', ' + s.longitude.toFixed(2) + ' &middot; ' + esc(MT[s.mine_type]) + ' &middot; ' + esc(route(r)) + ' &middot; ' + esc(s.lifecycle_stage) + '</div>' +
      '<div class="small" style="margin-top:4px">Transparency <b>' + t.score + '/100</b> &ndash; ' + esc(t.grade.text) + ' &middot; ' + r.tier.toUpperCase() + ' &middot; assurance: ' + esc(r.assurance.level.replace('_', ' ')) + ' &middot; method: ' + esc((r.assurance.methodology || '').replace(/_/g, ' ')) + '</div></div>' +
      '<div style="text-align:right"><div class="small muted">Basin stress</div><div style="font-size:18px;font-weight:700">' + stressHtml(k) + '</div><div class="tiny muted">' + esc(s.basin.name) + '</div></div></div>' +
      '<div class="rc-kpis">' +
      [['Withdrawal', fmt(k.W), 'ML'], ['Consumption', fmt(k.C), 'ML &middot; ' + Math.round(k.consumptionRatio * 100) + '%'], ['Intensity', isNaN(k.cPerOre) ? fmt(k.cPerMetal) : fmt(k.cPerOre, 2), isNaN(k.cPerOre) ? 'm³/t LCE' : 'm³ consumed / t ore'], ['Per t ' + (k.metalBasis === 'LCE' ? 'LCE' : s.primary_commodity), fmt(k.cPerMetal), 'm³ consumed (allocated)']]
        .map(function (x) { return '<div class="tile"><div class="k">' + x[0] + '</div><div class="v">' + x[1] + ' <small>' + x[2] + '</small></div></div>'; }).join('') + '</div>' +
      '<div class="rc-sec"><div><h3>Site water balance</h3>' + balanceBar(k) +
      '<p class="small">Balance residual <b>' + (k.balance.pct * 100).toFixed(1) + '%</b> of withdrawal ' + (k.balance.ok ? '(within &plusmn;5% tolerance)' : '<span class="bad-t">(outside &plusmn;5% tolerance &ndash; unreported flows?)</span>') + ' &middot; ' + Math.round(t.measuredShare * 100) + '% of volume metered</p>' +
      (r.water.monthly ? '<h3 style="margin-top:10px">Seasonality (monthly, ML)</h3><div class="chartbox xs"><canvas id="rcMonthly"></canvas></div>' : '<p class="small muted" style="margin-top:10px">No monthly profile reported (Tier 2 item) &ndash; seasonal stress cannot be assessed.</p>') +
      '</div><div><h3>Score breakdown</h3>' + t.parts.map(function (p) { return '<div class="sbar"><div class="row between small"><span>' + p.k + '</span><span>' + p.v + '/' + p.max + '</span></div><div class="track"><div style="width:' + (p.v / p.max * 100) + '%"></div></div><div class="tiny muted">' + esc(p.note) + '</div></div>'; }).join('') +
      '<h3 style="margin-top:10px">Tier 1 data points</h3><ul class="checks">' + t.tier1.map(function (x) { return '<li><span class="' + (x.ok ? 'y' : 'n') + '">' + (x.ok ? '&#10003;' : '&#10007;') + '</span> ' + x.no + '. ' + esc(x.label) + '</li>'; }).join('') + '</ul>' +
      '<h3 style="margin-top:10px">Framework coverage from this passport</h3><div class="fw">' + cov.map(function (c) { return '<span class="' + (c[1] === 'ok' ? 'ok' : c[1] === 'part' ? 'part' : '') + '">' + (c[1] === 'ok' ? '&#10003; ' : c[1] === 'part' ? '&#9680; ' : '&#10007; ') + c[0] + '</span>'; }).join('') + '</div>' +
      '<h3 style="margin-top:10px">Screening flags</h3><ul class="flags">' + M.ddFlags(r).map(function (f) { return '<li class="' + f.lvl + '"><span class="ic">' + (f.lvl === 'good' ? '&#10003;' : '!') + '</span>' + esc(f.t) + '</li>'; }).join('') + '</ul>' +
      '</div></div>' +
      '<div class="stamp"><b>Illustrative synthetic data.</b> Fictional site, operator and figures generated for the EIT Water Hackathon prototype. Basin stress is a placeholder, not an Aqueduct lookup. Scoring weights are a team proposal to be calibrated with WU Vienna.</div>';
    if (charts.rc) { charts.rc.destroy(); charts.rc = null; }
    if (r.water.monthly) {
      var mo = r.water.monthly, lab = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
      charts.rc = new Chart($('rcMonthly'), { type: 'line', data: { labels: lab, datasets: [
        { label: 'Withdrawal', data: mo.map(function (m) { return m.withdrawal_ml; }), borderColor: '#2a78d6', backgroundColor: '#2a78d6', borderWidth: 2, pointRadius: 0, tension: .3 },
        { label: 'Consumption', data: mo.map(function (m) { return m.consumption_ml; }), borderColor: '#eb6834', backgroundColor: '#eb6834', borderWidth: 2, pointRadius: 0, tension: .3 }] },
        options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'top', labels: { boxWidth: 12 } } }, scales: { y: { beginAtZero: true, grid: { color: '#eeede8' } }, x: { grid: { display: false } } } } });
    }
  }

  /* ------------------------------------------------------------ entry */
  function initEntry() {
    window.MWPForm.init($('formRoot'), $('formSide'));
    $('fExample').innerHTML = '<option value="">Load example site…</option>' + DATA.map(function (d) { return '<option value="' + d.r.site.site_id + '">' + esc(d.r.site.name) + ' (' + d.r.tier + ')</option>'; }).join('');
    $('fExample').value = DATA[4].r.site.site_id;
    $('fExample').addEventListener('change', function () { var d = byId[this.value]; if (d) window.MWPForm.load(d.r); });
    $('fBlank').addEventListener('click', function () { window.MWPForm.blank(); $('fExample').value = ''; });
    $('fDownload').addEventListener('click', function () {
      var rec = window.MWPForm.current();
      var blob = new Blob([JSON.stringify(rec, null, 2)], { type: 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = ((rec.site && rec.site.site_id) || 'passport') + '.mwp.json'; document.body.appendChild(a); a.click(); a.remove();
    });
    $('fImport').addEventListener('change', function () {
      var f = this.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () { try { window.MWPForm.load(JSON.parse(rd.result)); $('fMsg').textContent = 'Imported ' + f.name; } catch (e) { $('fMsg').textContent = 'Could not parse JSON: ' + e.message; } };
      rd.readAsText(f);
    });
  }

  /* ------------------------------------------------------------ extractor */
  var lastExtract = null;
  function initExtract() {
    var X = window.MWPExtractor;
    $('samples').innerHTML = X.SAMPLES.map(function (s, i) { return '<button class="btn sm ghost" data-i="' + i + '">Sample ' + (i + 1) + ': ' + esc(s.title) + '</button>'; }).join('');
    $('samples').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; $('exText').value = X.SAMPLES[+b.getAttribute('data-i')].text; runExtract(); });
    $('exRun').addEventListener('click', runExtract);
    $('exSend').addEventListener('click', function () {
      if (!lastExtract) runExtract();
      if (!inited.entry) { inited.entry = true; initEntry(); }
      window.MWPForm.load(X.toPassport(lastExtract)); $('fExample').value = ''; show('entry');
    });
    $('exText').value = X.SAMPLES[0].text; runExtract();
  }
  function runExtract() {
    var X = window.MWPExtractor, text = $('exText').value;
    var res = X.extract(text); lastExtract = res;
    var html = esc(text.replace(/\s+/g, ' '));
    res.items.slice().sort(function (a, b) { return b.raw.length - a.raw.length; }).forEach(function (it) {
      var r = esc(it.raw);
      html = html.split(r).join('\u0001' + (it.field || 'null') + '\u0002' + r + '\u0003');
    });
    html = html.replace(/\u0001([a-z_]+)\u0002/g, '<mark class="f-$1">').replace(/\u0003/g, '</mark>');
    $('exHl').innerHTML = html || '<span class="muted">No text.</span>';
    var LBL = { withdrawal: 'Withdrawal', consumption: 'Consumption', discharge: 'Discharge', reuse: 'Reuse / recycling', ambiguous_use: '"Water used" (ambiguous)', intensity: 'Intensity (skipped)', prior_year: 'Prior year (skipped)' };
    $('exTable').innerHTML = '<thead><tr><th>Field</th><th>Text</th><th class="num">ML</th><th>Confidence</th><th>Why</th></tr></thead><tbody>' +
      res.items.map(function (it) { return '<tr><td><b>' + (LBL[it.field] || 'Unassigned') + '</b></td><td><code>' + esc(it.raw) + '</code></td><td class="num">' + (it.ml == null ? '–' : fmt(it.ml, it.ml < 10 ? 2 : 0)) + '</td><td><span class="conf ' + it.conf + '">' + it.conf + '</span></td><td class="small" style="white-space:normal">' + esc(it.why.join('; ')) + '</td></tr>'; }).join('') +
      (res.shares.length ? res.shares.map(function (s) { return '<tr><td><b>Source share</b></td><td><code>' + s.pct + '% ' + esc(s.label) + '</code></td><td class="num">' + (function () { var w = res.items.filter(function (i) { return i.field === 'withdrawal'; })[0]; return w ? fmt(w.ml * s.pct / 100) : '–'; })() + '</td><td><span class="conf medium">medium</span></td><td class="small" style="white-space:normal">mapped to ' + s.source + ' / ' + s.subtype + ' (derived)</td></tr>'; }).join('') : '') + '</tbody>';
    var rec = X.toPassport(res), b = M.balance(rec);
    var notes = res.notes.slice();
    notes.unshift('Reporting year: <b>' + (res.year || 'not found') + '</b> (' + res.yearConf + ' confidence)' + (res.ore_t ? ' &middot; ore processed ' + fmt(res.ore_t / 1e6, 1) + ' Mt' : '') + (res.estimated ? ' &middot; text flags figures as <b>estimates</b>' : ''));
    if (b.known) notes.push('Mass-balance check on extracted figures: residual <b>' + (b.pct * 100).toFixed(1) + '%</b> of withdrawal ' + (b.ok ? '&#10003;' : '&ndash; <span class="bad-t">does not close; storage change or a flow is missing from the text</span>'));
    else notes.push('Mass balance cannot be checked &ndash; ' + (isNaN(b.C) ? 'consumption not stated' : 'withdrawal missing') + '. Typical of today&rsquo;s reporting.');
    $('exNotes').innerHTML = notes.map(function (n) { return '<div>&bull; ' + n + '</div>'; }).join('');
  }

  /* ------------------------------------------------------------ framework */
  function initFramework() {
    var rows = [];
    function walk(sch, path) {
      if (!sch) return;
      var x = sch['x-mwp'];
      if (x && (x.gri || x.esrs || x.cdp || x.irma || x.icmm || x.waf)) rows.push({ p: path, t: sch.title || path, x: x });
      if (sch.properties) Object.keys(sch.properties).forEach(function (k) { walk(sch.properties[k], path ? path + '.' + k : k); });
      if (sch.items && sch.items.properties) walk(sch.items, path + '[]');
    }
    walk(window.MWP_SCHEMA, '');
    $('fwTable').innerHTML = '<thead><tr><th>Field</th><th>Tier</th><th>GRI 303 / 14</th><th>ESRS E3</th><th>CDP (2024+)</th><th>ICMM 2021 / WAF</th><th>IRMA 4.2</th></tr></thead><tbody>' +
      rows.map(function (r) { var x = r.x; return '<tr><td><code>' + esc(r.p) + '</code><div class="tiny muted">' + esc(r.t) + '</div></td><td>' + (x.tier === 1 ? '<span class="tb t1">T1</span>' : x.tier === 2 ? '<span class="tb t2">T2</span>' : x.tier === 'derived' ? '<span class="tb td">auto</span>' : '') + '</td><td>' + esc(x.gri || '') + '</td><td>' + esc(x.esrs || '') + '</td><td>' + esc(x.cdp || '') + '</td><td>' + esc([x.icmm, x.waf].filter(Boolean).join(' / ')) + '</td><td>' + esc(x.irma || '') + '</td></tr>'; }).join('') + '</tbody>';
    $('t1List').innerHTML = M.TIER1.map(function (f) { return '<li>' + esc(f.label) + '</li>'; }).join('') ;
  }

  var INIT = { explorer: initExplorer, hotspots: initHotspots, supply: initSupply, card: initCard, entry: initEntry, extract: initExtract, framework: initFramework };
  var start = (location.hash || '#explorer').slice(1);
  inited.explorer = true; initExplorer();
  if (start !== 'explorer' && INIT[start]) show(start);
  window.MWPApp = { show: show };
})();
