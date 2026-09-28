# MineWater Ledger v2 patch: generic header + shared top nav, 3 new tabs, download, multi-year data. Idempotent.
import io, re, sys, os
HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(sys.argv[1] if len(sys.argv) > 1 else '.')
def rd(p): return io.open(p, encoding='utf-8').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)
def rep(s, a, b, p):
    if a not in s: raise SystemExit(f'{p}: anchor not found: {a[:70]!r}')
    return s.replace(a, b, 1)
BRAND = '<a class="brand" href="index.html"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c3.6 4.6 6.5 8.2 6.5 11.6A6.5 6.5 0 0 1 5.5 14.1C5.5 10.7 8.4 7.1 12 2.5z" fill="currentColor"/></svg>MineWater Ledger</a>'
def topbar(cur):
    links = [('index.html#how', 'How it works', 'how'), ('dashboard.html', 'Dashboard', 'dash'), ('risk.html', 'Water-at-Risk', 'risk')]
    CUR = ' aria-current="page"'
    a = ''.join('<a href="%s"%s>%s</a>' % (h, CUR if k == cur else '', t) for h, t, k in links)
    return f'<nav class="topbar"><div class="wrap">\n  {BRAND}\n  <div class="toplinks">{a}</div>\n</div></nav>'

# ---------- dashboard.html
p = 'dashboard.html'; s = rd(p)
if 'id="co-name"' not in s:
    s = rep(s, '<title>Newcrest · MineWater Ledger</title>', '<title>Dashboard · MineWater Ledger</title>', p)
    s = rep(s, '<link rel="stylesheet" href="css/app.css?v=4">', '<link rel="stylesheet" href="css/app.css?v=4">\n<link rel="stylesheet" href="css/landing.css">\n<link rel="stylesheet" href="css/extras.css">', p)
    s = re.sub(r'<div class="register"><div class="wrap">.*?</div></div>', lambda m: topbar('dash') + '\n<div class="ctx-bar"><div class="wrap">\n  <span>Company <b id="reg-co">–</b></span>\n  <span>Period <b id="reg-period">–</b></span>\n  <span>Unit <b>ML</b> (1 ML = 1,000 m³)</span>\n  <span>Source <b id="reg-src">–</b></span>\n</div></div>', s, count=1, flags=re.S)
    s = rep(s, '<h1>Newcrest Mining</h1>', '<h1 id="co-name">Your company</h1>', p)
    s = rep(s, '<p class="lede">Gold and copper. Five operating mines: Lihir (Papua New Guinea), Telfer and Cadia (Australia), Gosowong (Indonesia, sold in March 2020) and Red Chris (Canada, bought in August 2019).</p>',
            '<p class="lede" id="co-lede">No report loaded yet. Import a sustainability data file or type a site\'s figures, and every tab fills in.</p>', p)
    s = rep(s, '<div class="row"><button class="btn primary" id="btn-import">Import report</button><button class="btn" id="btn-enter">Enter values</button></div>',
            '<div class="row"><button class="btn primary" id="btn-import">Import report</button><button class="btn" id="btn-enter">Enter values</button></div>\n    <div class="row" id="dl-row" hidden><button class="btn" id="btn-csv">Download CSV</button><button class="btn" id="btn-print">Print / save as PDF</button></div>', p)
    s = rep(s, "Bring Newcrest's figures in the way a mining company would: import its sustainability data file, or type a site's numbers into the form.",
            "Bring your figures in the way you already publish them: import your sustainability data file, or type a site's numbers into the form. A public sample report is ready to try.", p)
    s = s.replace('>Import the FY20 report<', '>Import a report<', 1)
    s = rep(s, 'Newcrest reports these ratios for energy but not for water.', 'Most reports give these ratios for energy, not for water.', p)
    s = rep(s, '<a href="risk.html" style="margin-left:auto;align-self:center;padding:10px 12px;font:600 14px/1 var(--f-body);color:var(--copper-ink);text-decoration:none;white-space:nowrap">Water-at-Risk →</a>',
            '<button class="tab" role="tab" id="t-years" aria-controls="p-years" aria-selected="false">Years &amp; output</button>\n  <button class="tab" role="tab" id="t-cost" aria-controls="p-cost" aria-selected="false">Water cost</button>\n  <button class="tab" role="tab" id="t-codes" aria-controls="p-codes" aria-selected="false">Source codes</button>\n  <a href="risk.html" style="margin-left:auto;align-self:center;padding:10px 12px;font:600 14px/1 var(--f-body);color:var(--copper-ink);text-decoration:none;white-space:nowrap">Water-at-Risk →</a>', p)
    panels = io.open(os.path.join(HERE, 'v2_panels.html'), encoding='utf-8').read()
    s = rep(s, '</div></section>\n</main>', '</div></section>\n' + panels + '</main>', p)
    s = rep(s, '<footer><div class="wrap">Data: Newcrest Mining 2020 Sustainability Report, GRI Content Index and supplementary data (GRI 200 and 300 sheets).',
            '<footer><div class="wrap">Sample data: Newcrest Mining 2020 Sustainability Report, GRI data file (GRI 200 and 300 sheets).', p)
    s = rep(s, "Use Newcrest's FY20 GRI data file", "Use the sample report (Newcrest FY20 GRI data file)", p)
    s = rep(s, '<script src="js/dashboard.js?v=4"></script>', '<script src="js/dashboard.js?v=4"></script>\n<script src="data/newcrest_years.js"></script>\n<script src="js/extras.js"></script>', p)
    wr(p, s); print(p, 'patched')
else: print(p, 'already')

# ---------- js/dashboard.js
p = 'js/dashboard.js'; s = rd(p)
if 'MWL_STATE' not in s:
    s = rep(s, '  drawChips(); overview(); withdrawal(); outflows(); balanceTab(); efficiency(); outlook();\n}',
            '  drawChips(); overview(); withdrawal(); outflows(); balanceTab(); efficiency(); outlook();\n  document.dispatchEvent(new Event("mwl:render"));\n}', p)
    s = rep(s, '  "Checked every site against the ICMM balance rule"\n];',
            '  "Mapped disclosure codes 303-3, 303-4, 303-5, 302-3 and 201-1 to water, output and revenue",\n  "Found history: company withdrawal FY18–FY20, site output FY19",\n  "Checked every site against the ICMM balance rule"\n];', p)
    i = s.rstrip().rfind('})();')
    s = s[:i] + 'window.MWL_STATE = { S, sites: () => SITES, SEL: () => SEL, wrows: () => WROWS, loaded: () => LOADED };\n' + s[i:]
    wr(p, s); print(p, 'patched')
else: print(p, 'already')

# ---------- index.html (generic)
p = 'index.html'; s = rd(p)
if 'Try it with a sample report' not in s:
    s = rep(s, '<a href="risk.html">Water-at-Risk</a>', '<a href="dashboard.html">Dashboard</a><a href="risk.html">Water-at-Risk</a>', p)
    s = rep(s, 'See the Newcrest example →', 'Open the dashboard →', p)
    s = rep(s, '<span class="pv-title">Newcrest · Telfer · FY20</span>', '<span class="pv-title">Example site · FY20</span>', p)
    s = re.sub(r'<div><div class="eyebrow">Worked example</div><h2>Newcrest Mining, FY20</h2><p>.*?</p></div>',
               '<div><div class="eyebrow">Try it with a sample report</div><h2>A real GRI water report, imported in one click</h2><p>Open the dashboard, choose Import, and use the sample file: a gold and copper miner with five sites on three continents and several years of history.</p></div>', s, count=1, flags=re.S)
    s = rep(s, '· Data: Newcrest Mining 2020 Sustainability Report ·', '· Sample data: a public 2020 GRI water report ·', p)
    wr(p, s); print(p, 'patched')
else: print(p, 'already')

# ---------- risk.html (same top nav)
p = 'risk.html'; s = rd(p)
if 'class="topbar"' not in s:
    s = rep(s, '<link rel="stylesheet" href="css/app.css">', '<link rel="stylesheet" href="css/app.css">\n<link rel="stylesheet" href="css/landing.css">', p)
    s = re.sub(r'<div class="register"><div class="wrap">.*?</div></div>', lambda m: topbar('risk') + '\n<div class="register"><div class="wrap">\n  <span>Company <b>Newcrest Mining (sample) · FY20</b></span>\n  <span>Unit <b>ML</b> · money <b>US$</b></span>\n</div></div>', s, count=1, flags=re.S)
    wr(p, s); print(p, 'patched')
else: print(p, 'already')
