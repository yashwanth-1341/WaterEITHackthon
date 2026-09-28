# v3: company page wording + per-mine water flow container. Idempotent.
import io, sys, os
os.chdir(sys.argv[1] if len(sys.argv) > 1 else '.')
def rd(p): return io.open(p, encoding='utf-8').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)
def rep(s, a, b, p):
    if a not in s: raise SystemExit(p + ': anchor not found: ' + a[:70])
    return s.replace(a, b, 1)
p = 'dashboard.html'; s = rd(p)
if 'id="ov-flows"' not in s:
    s = rep(s, '<div class="eyebrow">Company overview</div>', '<div class="eyebrow" id="co-eyebrow">Company page</div>', p)
    s = rep(s, '<h1 id="co-name">Your company</h1>', '<h1 id="co-name">Water across your mines</h1>', p)
    s = rep(s, '<div class="answers" id="ov-answers"></div>', '<div id="ov-flows" class="stack"></div>\n  <div class="answers" id="ov-answers"></div>', p)
    s = s.replace('<a href="dashboard.html" aria-current="page">Dashboard</a>', '<a href="dashboard.html" aria-current="page">Company page</a>')
    s = s.replace('<title>Dashboard · MineWater Ledger</title>', '<title>Company page · MineWater Ledger</title>')
    wr(p, s); print(p, 'patched')
else: print(p, 'already')
for p in ['index.html', 'risk.html']:
    s = rd(p); t = s.replace('<a href="dashboard.html">Dashboard</a>', '<a href="dashboard.html">Company page</a>').replace('>Open dashboard</a>', '>Open company page</a>').replace('Open the dashboard →', 'Open the company page →')
    if t != s: wr(p, t); print(p, 'patched')
    else: print(p, 'already')
