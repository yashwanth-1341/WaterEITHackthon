# v5: company dashboard layout - import/enter move to the top bar; the hero card holds filters + export only. Idempotent.
import io, sys, os, re
os.chdir(sys.argv[1] if len(sys.argv) > 1 else '.')
def rd(p): return io.open(p, encoding='utf-8').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)
p = 'dashboard.html'; s = rd(p)
if 'id="filter-card"' not in s:
    card_re = re.compile(r'<div class="card stack">\s*<div class="row" style="justify-content:space-between"><div class="eyebrow">Data</div>.*?<div class="chips" id="chips" role="group" aria-label="Site" hidden></div>\s*</div>', re.S)
    if not card_re.search(s): raise SystemExit('card not found')
    s = card_re.sub('''<div class="card stack" id="filter-card" hidden>
    <div class="row" style="justify-content:space-between"><div class="eyebrow">Filter</div><span class="small" id="data-state">No data yet</span></div>
    <div class="eyebrow" id="show-label" hidden>Mine</div>
    <div class="chips" id="chips" role="group" aria-label="Site" hidden></div>
    <div class="row small" id="dl-row" hidden><span class="eyebrow">Export</span><button class="btn" id="btn-csv">CSV</button><button class="btn" id="btn-print">Print / PDF</button></div>
  </div>''', s, count=1)
    a = '<a href="risk.html">Water-at-Risk</a></div>'
    if a not in s: raise SystemExit('topbar anchor not found')
    s = s.replace(a, '<a href="risk.html">Water-at-Risk</a><button class="btn" id="btn-enter">Enter values</button><button class="btn primary" id="btn-import">Import data</button></div>', 1)
    wr(p, s); print(p, 'patched')
else: print(p, 'already')
p = 'js/extras.js'; s = rd(p)
if 'filter-card' not in s:
    s = s.replace('  $("#dl-row").hidden = !loaded;', '  $("#dl-row").hidden = !loaded; $("#filter-card").hidden = !loaded;', 1)
    wr(p, s); print(p, 'patched')
else: print(p, 'already')
