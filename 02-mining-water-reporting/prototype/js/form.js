/* Schema-driven site entry form with live validation, mass balance and score. */
(function () {
  var S = window.MWP_SCHEMA;
  var state = null;
  var root, side;
  var HIDE = { passport_version: 1 };
  var DQ_KEYS = /(^|_)dq$/;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pretty(s) { return String(s).replace(/_/g, ' '); }

  function getAt(path) {
    return path.split('/').filter(Boolean).reduce(function (a, k) { return a == null ? undefined : a[k]; }, state);
  }
  function setAt(path, val) {
    var ks = path.split('/').filter(Boolean), o = state;
    for (var i = 0; i < ks.length - 1; i++) {
      var k = ks[i];
      if (o[k] === undefined || o[k] === null) o[k] = /^\d+$/.test(ks[i + 1]) ? [] : {};
      o = o[k];
    }
    var last = ks[ks.length - 1];
    if (val === undefined) { if (Array.isArray(o)) o[last] = undefined; else delete o[last]; } else o[last] = val;
  }

  function tierOf(sch) { var x = sch && sch['x-mwp']; return x ? x.tier : undefined; }
  function badge(sch) {
    var t = tierOf(sch);
    if (t === 1) return '<span class="tb t1" title="Tier 1 must-report data point ' + ((sch['x-mwp'] || {}).tier1_no || '') + '">T1</span>';
    if (t === 2) return '<span class="tb t2" title="Tier 2 full balance">T2</span>';
    if (t === 'derived') return '<span class="tb td" title="Derived automatically from coordinates">auto</span>';
    return '';
  }
  function mapTip(sch) {
    var x = sch && sch['x-mwp']; if (!x) return '';
    var out = [];
    ['gri', 'esrs', 'cdp', 'icmm', 'waf', 'irma'].forEach(function (k) { if (x[k]) out.push(k.toUpperCase() + ' ' + x[k]); });
    return out.length ? '<span class="maps" title="' + esc(out.join('\n')) + '">&#8645; ' + out.length + ' framework' + (out.length > 1 ? 's' : '') + '</span>' : '';
  }

  function inputFor(sch, path, val, compact) {
    var dp = ' data-path="' + path + '"';
    if (sch['enum']) {
      var o = '<option value="">' + (compact ? '–' : 'select…') + '</option>' + sch['enum'].map(function (e) {
        return '<option value="' + esc(e) + '"' + (val === e ? ' selected' : '') + '>' + esc(pretty(e)) + '</option>';
      }).join('');
      return '<select' + dp + ' data-kind="enum">' + o + '</select>';
    }
    if (sch.type === 'number' || sch.type === 'integer') {
      return '<input type="number" step="any"' + dp + ' data-kind="' + sch.type + '" value="' + (typeof val === 'number' ? val : '') + '">';
    }
    if (sch.type === 'boolean') {
      return '<select' + dp + ' data-kind="bool"><option value="">–</option><option value="true"' + (val === true ? ' selected' : '') + '>yes</option><option value="false"' + (val === false ? ' selected' : '') + '>no</option></select>';
    }
    return '<input type="text"' + dp + ' data-kind="string" value="' + esc(val || '') + '">';
  }

  function renderField(key, sch, path) {
    var val = getAt(path);
    var cls = 'field' + (tierOf(sch) === 2 ? ' tier2only' : '') + (DQ_KEYS.test(key) ? ' dqfield' : '');
    if (sch.type === 'array' && sch.items && sch.items['enum']) {
      var cur = Array.isArray(val) ? val : [];
      return '<div class="' + cls + ' wide"><label>' + esc(sch.title || key) + ' ' + badge(sch) + mapTip(sch) + '</label><div class="chips" data-path="' + path + '" data-kind="multi">' +
        sch.items['enum'].map(function (e) { return '<label class="chip"><input type="checkbox" value="' + esc(e) + '"' + (cur.indexOf(e) >= 0 ? ' checked' : '') + '>' + esc(pretty(e)) + '</label>'; }).join('') +
        '</div><div class="err" data-err="' + path + '"></div></div>';
    }
    return '<div class="' + cls + '"><label>' + esc(sch.title || pretty(key)) + ' ' + badge(sch) + mapTip(sch) + '</label>' + inputFor(sch, path, val) + '<div class="err" data-err="' + path + '"></div></div>';
  }

  function renderArrayTable(key, sch, path) {
    var items = getAt(path) || [];
    var props = sch.items.properties, cols = Object.keys(props);
    var head = cols.map(function (c) { return '<th>' + esc(props[c].title || pretty(c)) + '</th>'; }).join('') + '<th></th>';
    var rows = items.map(function (it, i) {
      return '<tr>' + cols.map(function (c) {
        return '<td>' + inputFor(props[c], path + '/' + i + '/' + c, it ? it[c] : undefined, true) + '<div class="err" data-err="' + path + '/' + i + '/' + c + '"></div></td>';
      }).join('') + '<td><button class="icon-btn" data-del="' + path + '" data-idx="' + i + '" title="Remove row">&times;</button></td></tr>';
    }).join('');
    return '<div class="arr' + (tierOf(sch) === 2 ? ' tier2only' : '') + '"><div class="arr-h"><strong>' + esc(sch.title || key) + '</strong> ' + badge(sch) + mapTip(sch) +
      '<button class="btn sm ghost" data-add="' + path + '">+ add row</button></div>' +
      '<div class="tscroll"><table class="grid"><thead><tr>' + head + '</tr></thead><tbody>' + (rows || '<tr><td colspan="' + (cols.length + 1) + '" class="muted">No rows yet</td></tr>') + '</tbody></table></div><div class="err" data-err="' + path + '"></div></div>';
  }

  function renderObject(sch, path, depth) {
    var html = '';
    var props = sch.properties || {};
    var simple = [], complex = [];
    Object.keys(props).forEach(function (k) {
      if (HIDE[k] && depth === 0) return;
      var p = props[k];
      if (p.type === 'object' || (p.type === 'array' && p.items && p.items.type === 'object')) complex.push(k); else simple.push(k);
    });
    if (simple.length) html += '<div class="fgrid">' + simple.map(function (k) { return renderField(k, props[k], path + '/' + k); }).join('') + '</div>';
    complex.forEach(function (k) {
      var p = props[k], pp = path + '/' + k;
      if (p.type === 'array') { html += renderArrayTable(k, p, pp); return; }
      var tag = depth === 0 ? 'section' : 'div';
      html += '<' + tag + ' class="fs d' + depth + (tierOf(p) === 2 ? ' tier2only' : '') + '"><h4>' + esc(p.title || k) + ' ' + badge(p) + mapTip(p) + '</h4>' + renderObject(p, pp, depth + 1) + '</' + tag + '>';
    });
    return html;
  }

  function render() {
    root.innerHTML = renderObject(S, '', 0);
    root.classList.toggle('show-t2', state.tier === 'tier2');
    update();
  }

  function readInput(el) {
    var k = el.getAttribute('data-kind'), v = el.value;
    if (v === '') return undefined;
    if (k === 'number') return parseFloat(v);
    if (k === 'integer') return parseInt(v, 10);
    if (k === 'bool') return v === 'true';
    return v;
  }

  function prune(o) {
    if (Array.isArray(o)) return o.map(prune);
    if (o && typeof o === 'object') {
      var r = {};
      Object.keys(o).forEach(function (k) {
        var v = prune(o[k]);
        if (v === undefined || v === '') return;
        if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) return;
        r[k] = v;
      });
      return r;
    }
    return o;
  }

  function update() {
    var rec = prune(state);
    var errs = window.MWPValidator.validate(S, rec);
    var seen = {};
    errs = errs.filter(function (e) { var k = e.path + e.msg; if (seen[k]) return false; seen[k] = 1; return true; });
    root.querySelectorAll('.err').forEach(function (d) { d.textContent = ''; });
    root.querySelectorAll('.invalid').forEach(function (d) { d.classList.remove('invalid'); });
    errs.forEach(function (e) {
      var d = root.querySelector('[data-err="' + e.path + '"]');
      if (d) { d.textContent = e.msg; var inp = root.querySelector('[data-path="' + e.path + '"]'); if (inp) inp.classList.add('invalid'); }
    });
    var t = window.MWP.transparency(rec);
    var b = window.MWP.balance(rec);
    var k = rec.water ? window.MWP.kpis(rec) : null;
    var bPct = b.known ? b.pct * 100 : null;
    var gauge = b.known ? Math.max(-15, Math.min(15, bPct)) : 0;
    side.innerHTML =
      '<div class="panel-card"><div class="row between"><h4>Schema validation</h4>' +
      (errs.length ? '<span class="pill bad">&#10007; ' + errs.length + ' issue' + (errs.length > 1 ? 's' : '') + '</span>' : '<span class="pill good">&#10003; valid v0.1</span>') + '</div>' +
      (errs.length ? '<ul class="errlist">' + errs.slice(0, 8).map(function (e) { return '<li data-go="' + e.path + '"><code>' + esc(e.path || '/') + '</code> ' + esc(e.msg) + '</li>'; }).join('') + (errs.length > 8 ? '<li class="muted">+ ' + (errs.length - 8) + ' more</li>' : '') + '</ul>' : '<p class="muted small">Record conforms to mine-water-passport.schema.json (' + (rec.tier || '?') + ').</p>') + '</div>' +
      '<div class="panel-card"><div class="row between"><h4>Mass balance</h4>' +
      (b.known ? (b.ok ? '<span class="pill good">&#10003; closes</span>' : '<span class="pill bad">&#9888; open</span>') : '<span class="pill">incomplete</span>') + '</div>' +
      '<div class="eq">In <b>' + window.MWP.fmt(b.W) + '</b> &minus; Out <b>' + window.MWP.fmt(b.D + (isNaN(b.C) ? 0 : b.C)) + '</b> &minus; &Delta;S <b>' + window.MWP.fmt(b.dS) + '</b> = <b>' + (b.known ? window.MWP.fmt(b.resid) : '–') + '</b> ML</div>' +
      '<div class="gauge"><div class="gband" style="left:' + (50 - b.tol * 100 / 30 * 100) + '%;width:' + (b.tol * 100 / 15 * 100) + '%"></div>' + (b.known ? '<div class="gmark' + (b.ok ? '' : ' bad') + '" style="left:' + (50 + gauge / 30 * 100) + '%"></div>' : '') + '</div>' +
      '<div class="row between small muted"><span>&minus;15%</span><span>tolerance &plusmn;' + (b.tol * 100) + '%</span><span>+15%</span></div>' +
      (b.known ? '<p class="small">Residual ' + (bPct >= 0 ? '+' : '') + bPct.toFixed(1) + '% of withdrawal' + (b.compOk ? '' : ' &middot; <span class="bad-t">consumption components &ne; total</span>') + '</p>' : '') + '</div>' +
      '<div class="panel-card"><div class="row between"><h4>Transparency score</h4><span class="grade sm" style="background:' + t.grade.color + '">' + t.grade.g + '</span></div>' +
      '<div class="big">' + t.score + '<span class="muted">/100</span></div>' +
      t.parts.map(function (p) { return '<div class="sbar"><div class="row between small"><span>' + p.k + '</span><span>' + p.v + '/' + p.max + '</span></div><div class="track"><div style="width:' + (p.v / p.max * 100) + '%"></div></div><div class="tiny muted">' + esc(p.note) + '</div></div>'; }).join('') +
      '</div>' +
      (k ? '<div class="panel-card"><h4>Normalised KPIs</h4><table class="kv"><tr><td>Withdrawal</td><td>' + window.MWP.fmt(k.wPerOre, 2) + ' m³/t ore</td></tr><tr><td>Consumption</td><td>' + window.MWP.fmt(k.cPerOre, 2) + ' m³/t ore</td></tr><tr><td>Consumption</td><td>' + window.MWP.fmt(k.cPerMetal, 1) + ' m³/t ' + (k.metalBasis === 'LCE' ? 'LCE' : 'metal') + '</td></tr><tr><td>Consumed / withdrawn</td><td>' + (isNaN(k.consumptionRatio) ? '–' : Math.round(k.consumptionRatio * 100) + '%') + '</td></tr></table></div>' : '') +
      '<div class="panel-card"><div class="row between"><h4>Passport JSON</h4><span class="small muted">' + JSON.stringify(rec).length.toLocaleString() + ' bytes</span></div><pre class="json">' + esc(JSON.stringify(rec, null, 2)) + '</pre></div>';
  }

  function onInput(e) {
    var el = e.target;
    var chips = el.closest('[data-kind="multi"]');
    if (chips) {
      var vals = [].slice.call(chips.querySelectorAll('input:checked')).map(function (x) { return x.value; });
      setAt(chips.getAttribute('data-path'), vals.length ? vals : undefined);
      update(); return;
    }
    var p = el.getAttribute('data-path');
    if (!p) return;
    setAt(p, readInput(el));
    if (p === '/tier') root.classList.toggle('show-t2', state.tier === 'tier2');
    update();
  }

  function blank() {
    return { passport_version: '0.1', tier: 'tier1', site: { processing_route: [] }, period: { year: 2025 }, production: { products: [{}] },
      water: { withdrawals: [{}], discharges: [], consumption: {}, reuse: {} }, assurance: {} };
  }

  function load(rec) { state = clone(rec); state.passport_version = '0.1'; render(); }

  function init(rootEl, sideEl) {
    root = rootEl; side = sideEl;
    state = clone(window.MWP_SITES[4]);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onInput);
    root.addEventListener('click', function (e) {
      var a = e.target.getAttribute('data-add'), d = e.target.getAttribute('data-del');
      if (a) { var arr = getAt(a) || []; arr.push({}); setAt(a, arr); render(); }
      if (d) { var ar = getAt(d); ar.splice(parseInt(e.target.getAttribute('data-idx'), 10), 1); render(); }
    });
    side.addEventListener('click', function (e) {
      var li = e.target.closest('[data-go]'); if (!li) return;
      var el = root.querySelector('[data-path="' + li.getAttribute('data-go') + '"]') || root.querySelector('[data-err="' + li.getAttribute('data-go') + '"]');
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (el.focus) el.focus(); }
    });
    render();
  }

  window.MWPForm = {
    init: init, load: load, blank: function () { load(blank()); },
    current: function () { return prune(state); }
  };
})();
