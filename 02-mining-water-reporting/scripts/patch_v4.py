# v4: company-page onboarding + explicit multi-source import + data lineage. Idempotent.
import io, sys, os, re
os.chdir(sys.argv[1] if len(sys.argv) > 1 else '.')
def rd(p): return io.open(p, encoding='utf-8').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)
def rep(s, a, b, p):
    if a not in s: raise SystemExit(p + ': anchor not found: ' + a[:80])
    return s.replace(a, b, 1)
p = 'dashboard.html'; s = rd(p)
if 'id="m-files"' not in s:
    s = rep(s, '<h1 id="co-name">Water across your mines</h1>', '<h1 id="co-name">Set up your company page</h1>\n    <div class="co-profile" id="co-profile" hidden></div>', p)
    s = rep(s, '<h2>No water data yet</h2>', '<h2>Your company page is empty</h2>', p)
    s = rep(s, '>Import a report</button><button class="btn big" id="empty-enter">Enter values by hand</button>', '>Import your reports</button><button class="btn big" id="empty-enter">Enter figures by hand</button>', p)
    s = re.sub(r'<div class="drop" id="m-drop" tabindex="0">.*?</div>\n    <ol class="progress" id="m-progress"></ol>\n    <p class="small">Demo:.*?</p>',
      '''<div class="drop" id="m-drop" tabindex="0">Drop your water reports here (.xlsx, .csv), one file per year<br><span class="small">or</span> <button class="btn" id="m-sample">Use the example company's files</button></div>
    <div class="eyebrow">Files in this import</div>
    <ul class="imp-files" id="m-files">
      <li><span class="ft">XLSX</span><div><b>Company report · FY20 GRI data file</b><span>201104_Newcrest 2020 Sustainability Report – GRI Content Index and supplementary data.xlsx</span><span class="got">FY20 water per mine · FY19 ore and gold (Restatements sheet) · company water totals FY18–FY20</span></div></li>
      <li><span class="ft">CSV</span><div><b>Public benchmark · WU Wien copper-mine dataset</b><span>Lutter et al 2025_final predictions.csv</span><span class="got">Water per mine 2015–2019 for 507 copper mines, matched by mine name (Telfer, Cadia East, Red Chris)</span></div></li>
      <li class="off"><span class="ft">+</span><div><b>Other years' company reports</b><span>FY19, FY21 … not added</span><span class="got">Would replace the benchmark values with the company's own numbers</span></div></li>
    </ul>
    <ol class="progress" id="m-progress"></ol>
    <p class="small">Demo: any file dropped here imports the example company's files above.</p>''', s, count=1, flags=re.S)
    if 'id="m-files"' not in s: raise SystemExit('drop block not replaced')
    s = rep(s, '<div id="ov-flows" class="stack"></div>', '<div id="ov-flows" class="stack"></div>\n  <div id="ov-sources"></div>', p)
    wr(p, s); print(p, 'patched')
else: print(p, 'already')
p = 'js/dashboard.js'; s = rd(p)
if 'Linking the public benchmark' not in s:
    a = s[s.index('const STEPS = ['):s.index('];', s.index('const STEPS = ['))+2]
    s = s.replace(a, '''const STEPS = [
  "Company report (FY20 GRI data file): 7 sheets opened",
  "Read FY20 water per mine from disclosures 303-3, 303-4, 303-5 and ICMM recycled · 161 values",
  "Read ore, gold and revenue per mine (302-3, 201-1), FY19 ore and gold (Restatements sheet), company water FY18–FY20",
  "Linking the public benchmark (WU Wien, Lutter et al. 2025): matched Telfer, Cadia East, Red Chris · 2015–2019",
  "Checked every mine against the ICMM water balance rule"
];''', 1)
    s = s.replace('toast("Imported 5 sites and 161 values. The dashboard is filled.")', 'toast("Imported 2 files: 5 mines, FY20 in full, history back to 2016. See where each number came from under Overview.")')
    wr(p, s); print(p, 'patched')
else: print(p, 'already')
p = 'index.html'; s = rd(p)
t = s.replace('Open the company page →', 'Set up your company page →').replace('<div class="eyebrow">Try it with a sample report</div><h2>A real GRI water report, imported in one click</h2>', '<div class="eyebrow">Try it with an example company</div><h2>A real mining company, set up in one click</h2>')
t = t.replace('Open the dashboard, choose Import, and use the sample file:', "Open the company page, choose Import, and use the example company's files:")
if t != s: wr(p, t); print(p, 'patched')
else: print(p, 'already')
