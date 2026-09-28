/* Report extractor demo: heuristic (regex) extraction of water figures from
   sustainability-report prose into MineWater Passport fields, with confidence
   flags. Seed of an LLM-assisted pipeline: in production an LLM does schema-
   constrained extraction and this deterministic layer cross-checks units,
   years and the mass balance. */
(function () {
  var SAMPLES = [
    { title: 'Copper, desal + groundwater (FY report)',
      text: 'FICTIONAL EXAMPLE - Aurora Ridge Copper Operation, Sustainability Report 2024. In FY2024 the Aurora Ridge operation withdrew a total of 18.6 GL of water, of which 58% was desalinated seawater, 35% groundwater from the regional bore field and 7% surface runoff captured on site. Water consumption, primarily evaporation from the tailings storage facility and entrainment in tailings, amounted to 16,950 ML. Discharges to third parties totalled 410 ML. The concentrator recycled 41.2 GL of process water. Ore processed during the year was 38.5 Mt.' },
    { title: 'Nordic nickel, m³ + prior-year figures',
      text: 'FICTIONAL EXAMPLE - Nordvik Nickel AB, Annual and Sustainability Report 2023. During calendar year 2023, total water intake was 7.3 million m³ (2022: 7.9 million m³), largely precipitation and runoff collected within the site. We discharged 5,640,000 m³ of treated water to the Nordvik river. Water consumption is calculated as the difference between intake and discharge and was 1.5 million m³. Our water intensity was 0.52 m³ per tonne of ore.' },
    { title: 'Cobalt project, vague community update',
      text: 'ILLUSTRATIVE EXAMPLE - Kasombo Cobalt Project (fictional), Community Update 2024. The project used approximately 3 800 megalitres of water last year, mainly pumped from the river and from pit dewatering. Around 40 per cent was returned to the river after settling. Water recycling was limited. Figures are estimates pending installation of flow meters.' }
  ];

  var UNIT_RE = '(gigalit(?:re|er)s?|GL|megalit(?:re|er)s?|ML|Ml|million\\s+(?:m³|m3|cubic\\s+met(?:re|er)s)|Mm³|Mm3|hm³|hm3|thousand\\s+(?:m³|m3|cubic\\s+met(?:re|er)s)|billion\\s+lit(?:re|er)s|million\\s+lit(?:re|er)s|m³|m3|cubic\\s+met(?:re|er)s)';
  var NUM_RE = '(\\d{1,3}(?:[,\\u202f\\u00a0 ]\\d{3})+(?:\\.\\d+)?|\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?|\\d+(?:[.,]\\d+)?)';
  var Q_RE = new RegExp(NUM_RE + '\\s*' + UNIT_RE + '(?![A-Za-z])', 'g');
  var ORE_RE = new RegExp('(?:ore|material)\\s+(?:processed|milled|treated)[^.]*?' + NUM_RE + '\\s*(Mt|million\\s+tonnes|kt|t)\\b', 'i');
  var PCT_RE = /(\d{1,3}(?:\.\d+)?)\s*(%|per\s*cent|percent)\s+(?:was\s+|were\s+|from\s+|of\s+)?([a-z\- ]{0,40})/gi;

  var TO_ML = [
    [/^(gigalit|GL$)/i, 1000], [/^(megalit|ML$|Ml$)/, 1], [/^million\s+(m|cubic)/i, 1000], [/^(Mm|hm)/, 1000],
    [/^thousand/i, 1], [/^billion\s+lit/i, 1000], [/^million\s+lit/i, 1], [/^(m³|m3|cubic)/i, 0.001]
  ];
  var FIELDS = [
    { f: 'withdrawal', re: /(withdr[ae]w|withdrawal|withdrawn|abstract|intake|sourced|water input)/i, path: 'water.withdrawals' },
    { f: 'consumption', re: /(consum|lost to evaporation)/i, path: 'water.consumption.total_ml' },
    { f: 'discharge', re: /(discharg|released|returned to)/i, path: 'water.discharges' },
    { f: 'reuse', re: /(recycl|reuse|re-use|reused)/i, path: 'water.reuse.reused_recycled_ml' },
    { f: 'ambiguous_use', re: /\b(used|uses|use of|required)\b/i, path: '?' }
  ];
  var SOURCES = [
    [/desal|sea ?water/i, 'seawater', 'desalinated_seawater'], [/ground ?water|bore|aquifer|dewater/i, 'groundwater', 'bore_field'],
    [/runoff|precip|rain/i, 'surface_water', 'precipitation_runoff'], [/surface|river|lake|dam/i, 'surface_water', 'river_lake_abstraction'],
    [/third|municipal|utility/i, 'third_party', 'municipal_supply']
  ];

  function parseNum(s) {
    s = s.replace(/[   ]/g, '');
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return parseFloat(s.replace(/\./g, '').replace(',', '.'));
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return parseFloat(s.replace(/,/g, ''));
    if (/^\d+,\d{1,2}$/.test(s)) return parseFloat(s.replace(',', '.'));
    return parseFloat(s.replace(/,/g, ''));
  }
  function factor(u) { for (var i = 0; i < TO_ML.length; i++) if (TO_ML[i][0].test(u.trim())) return TO_ML[i][1]; return null; }

  function sentences(text) {
    return text.replace(/\s+/g, ' ').match(/[^.!?]+(?:\.(?=\d)[^.!?]*)*[.!?]?/g) || [text];
  }

  function extract(text) {
    var out = { year: null, yearConf: 'low', items: [], notes: [], estimated: /\b(estimat|approximately|around|about)\w*/i.test(text), ore_t: null };
    var fy = text.match(/\b(?:FY|financial year\s*|fiscal year\s*)(20\d{2}|\d{2})\b/i);
    var cy = text.match(/\b(?:calendar year|in|during)\s+(20\d{2})\b/i);
    var rep = text.match(/\b(?:Report|Update)\s+(20\d{2})\b/i);
    if (fy) { out.year = fy[1].length === 2 ? 2000 + parseInt(fy[1], 10) : parseInt(fy[1], 10); out.yearConf = 'high'; }
    else if (cy) { out.year = parseInt(cy[1], 10); out.yearConf = 'high'; }
    else if (rep && /last year|previous year/i.test(text)) { out.year = parseInt(rep[1], 10) - 1; out.yearConf = 'low'; out.notes.push('Year inferred from "last year" relative to report date ' + rep[1] + '.'); }
    else if (rep) { out.year = parseInt(rep[1], 10); out.yearConf = 'medium'; }

    var ore = text.match(ORE_RE);
    if (ore) {
      var ov = parseNum(ore[1]), ou = ore[2].toLowerCase();
      out.ore_t = ou === 'mt' || ou.indexOf('million') === 0 ? ov * 1e6 : ou === 'kt' ? ov * 1e3 : ov;
    }

    sentences(text).forEach(function (s) {
      var m; Q_RE.lastIndex = 0;
      while ((m = Q_RE.exec(s)) !== null) {
        var raw = m[0], val = parseNum(m[1]), unit = m[2], f = factor(unit);
        var after = s.slice(m.index + raw.length, m.index + raw.length + 20);
        var before = s.slice(Math.max(0, m.index - 90), m.index);
        var ctx = s.slice(Math.max(0, m.index - 12), m.index);
        var item = { raw: raw, value: val, unit: unit.replace(/\s+/g, ' '), ml: f ? val * f : null, sentence: s.trim(), field: null, conf: 'low', why: [] };
        if (/^\s*(per|\/)\s*(tonne|t\b|ton)/i.test(after)) { item.field = 'intensity'; item.ml = null; item.why.push('intensity (per tonne) - not a volume, excluded'); item.conf = 'high'; out.items.push(item); continue; }
        var prior = ctx.match(/\((?:FY)?(20\d{2})\s*:\s*$/);
        if (prior && out.year && parseInt(prior[1], 10) !== out.year) { item.field = 'prior_year'; item.ml = null; item.why.push('comparative figure for ' + prior[1] + ' - ignored'); item.conf = 'high'; out.items.push(item); continue; }
        // nearest keyword before the number (fallback: anywhere in sentence)
        var best = null;
        FIELDS.forEach(function (F) {
          var re = new RegExp(F.re.source, 'ig'), mm, pos = -1;
          while ((mm = re.exec(before)) !== null) pos = mm.index;
          if (pos >= 0) { var dist = before.length - pos; if (!best || dist < best.dist) best = { F: F, dist: dist, pre: true }; }
        });
        if (/(calculated as|difference between|defined as|equal to)/i.test(s)) {
          var first = null;
          FIELDS.forEach(function (F) { var mm = s.search(F.re); if (mm >= 0 && mm < m.index && (!first || mm < first.pos)) first = { F: F, pos: mm }; });
          if (first && best && first.F !== best.F) { best = { F: first.F, dist: 999, pre: true, subj: true }; }
        }
        if (!best) FIELDS.forEach(function (F) { if (F.re.test(s) && !best) best = { F: F, dist: 999, pre: false }; });
        if (best) {
          item.field = best.F.f;
          if (best.F.f === 'ambiguous_use') { item.conf = 'low'; item.why.push('"used" is ambiguous - withdrawal or consumption? needs review'); }
          else if (best.pre && best.dist <= 70 && f) { item.conf = 'high'; item.why.push('keyword "' + best.F.f + '" ' + best.dist + ' chars before value; unambiguous unit'); }
          else if (best.subj) { item.conf = 'medium'; item.why.push('definition clause mentions several flows - took sentence subject "' + best.F.f + '"'); }
          else { item.conf = 'medium'; item.why.push('keyword found but distant or after value'); }
        } else item.why.push('no water-balance keyword in sentence');
        if (out.estimated && item.conf === 'high') { item.conf = 'medium'; item.why.push('text flags figures as estimates'); }
        out.items.push(item);
      }
    });

    // percentage shares -> source breakdown / derived discharge
    var W = out.items.filter(function (i) { return (i.field === 'withdrawal' || i.field === 'ambiguous_use') && i.ml; })[0];
    var m2; PCT_RE.lastIndex = 0;
    out.shares = [];
    while ((m2 = PCT_RE.exec(text)) !== null) {
      var pct = parseFloat(m2[1]), what = m2[3] || '';
      var tail = text.slice(m2.index, m2.index + 90);
      if (/returned|discharg/i.test(tail) && W) {
        out.items.push({ raw: m2[0].trim(), value: pct, unit: '% of use', ml: W.ml * pct / 100, sentence: tail, field: 'discharge', conf: 'low', why: ['derived: ' + pct + '% x ' + W.raw + ' (base itself ambiguous)'], derived: true });
        continue;
      }
      for (var i = 0; i < SOURCES.length; i++) {
        if (SOURCES[i][0].test(what)) { out.shares.push({ pct: pct, source: SOURCES[i][1], subtype: SOURCES[i][2], label: what.trim() }); break; }
      }
    }
    return out;
  }

  function toPassport(res) {
    var rec = { passport_version: '0.1', tier: 'tier1', site: { processing_route: [] }, period: {}, production: { products: [{}] },
      water: { withdrawals: [], discharges: [], consumption: {}, reuse: {} }, assurance: {},
      sources: [{ title: 'Pasted report paragraph', extraction: 'automated_extraction_unreviewed' }] };
    if (res.year) rec.period.year = res.year;
    if (res.ore_t) rec.production.ore_processed_t = res.ore_t;
    var dq = res.estimated ? 'estimated' : 'measured';
    var pick = function (f) { return res.items.filter(function (i) { return i.field === f && i.ml != null; })[0]; };
    var w = pick('withdrawal') || pick('ambiguous_use');
    if (w) {
      if (res.shares.length) {
        res.shares.forEach(function (s) { rec.water.withdrawals.push({ source: s.source, subtype: s.subtype, volume_ml: Math.round(w.ml * s.pct / 100 * 10) / 10, dq: 'calculated' }); });
      } else {
        var srcs = SOURCES.filter(function (s) { return s[0].test(w.sentence); });
        var distinct = srcs.map(function (s) { return s[1]; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
        var row = { volume_ml: Math.round(w.ml * 10) / 10, dq: dq };
        if (distinct.length === 1) { row.source = srcs[0][1]; row.subtype = srcs[0][2]; }
        else if (distinct.length > 1) res.notes.push('Several sources named (' + distinct.join(', ') + ') without split - source left for reviewer.');
        rec.water.withdrawals.push(row);
      }
    }
    var d = pick('discharge');
    if (d) { var dr = { volume_ml: Math.round(d.ml * 10) / 10, dq: d.derived ? 'estimated' : dq }; var txt = d.sentence; if (/third/i.test(txt)) dr.destination = 'third_party'; else if (/river|creek|lake|surface/i.test(txt)) dr.destination = 'surface_water'; else if (/sea|ocean/i.test(txt)) dr.destination = 'seawater'; rec.water.discharges.push(dr); }
    var c = pick('consumption');
    if (c) { rec.water.consumption.total_ml = Math.round(c.ml * 10) / 10; rec.water.consumption.total_dq = /calculated|difference/i.test(c.sentence) ? 'calculated' : dq; }
    var r = pick('reuse');
    if (r) { rec.water.reuse.reused_recycled_ml = Math.round(r.ml * 10) / 10; rec.water.reuse.dq = dq; }
    return rec;
  }

  window.MWPExtractor = { SAMPLES: SAMPLES, extract: extract, toPassport: toPassport };
})();
