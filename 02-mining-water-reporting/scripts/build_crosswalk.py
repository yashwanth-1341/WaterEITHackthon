"""Print the framework crosswalk table (markdown) from the schema's x-mwp annotations.
    python scripts/build_crosswalk.py > framework/crosswalk.md
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
S = json.loads((ROOT / "framework" / "mine-water-passport.schema.json").read_text(encoding="utf-8"))
rows = []


def walk(s, path):
    x = s.get("x-mwp")
    if x and any(k in x for k in ("gri", "esrs", "cdp", "icmm", "waf", "irma")):
        rows.append((path, s.get("title", path), x))
    for k, v in (s.get("properties") or {}).items():
        walk(v, f"{path}.{k}" if path else k)
    it = s.get("items")
    if isinstance(it, dict) and it.get("properties"):
        walk(it, path + "[]")


walk(S, "")
tier = {1: "T1", 2: "T2", "derived": "auto"}
print("| Field (JSON path) | Tier | GRI 303 / GRI 14 | ESRS E3 | CDP (2024+ module 9) | ICMM 2021 / MCA WAF | IRMA v1.0 ch. 4.2 |")
print("|---|---|---|---|---|---|---|")
for p, t, x in rows:
    icmm = " / ".join(v for v in (x.get("icmm"), x.get("waf")) if v)
    print(f"| `{p}` — {t} | {tier.get(x.get('tier'), '')} | {x.get('gri', '')} | {x.get('esrs', '')} | {x.get('cdp', '')} | {icmm} | {x.get('irma', '')} |")
