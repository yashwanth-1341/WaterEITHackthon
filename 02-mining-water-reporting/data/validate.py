"""Validate the synthetic MineWater Passport dataset against the JSON Schema
and run the MWP plausibility checks (mass balance, component sums).

Usage (Windows or Linux):
    python -m pip install -r requirements.txt
    python data/validate.py                 # validates data/sites.json
    python data/validate.py my_site.json    # validates one passport or a list
Exit code 0 = all schema checks pass (balance warnings are reported, not fatal).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = json.loads((ROOT / "framework" / "mine-water-passport.schema.json").read_text(encoding="utf-8"))
BALANCE_TOLERANCE = 0.05  # illustrative: |W - D - C - dS| / W <= 5 %


def balance(rec: dict) -> tuple[float, float]:
    w = rec["water"]
    W = sum(x["volume_ml"] for x in w["withdrawals"])
    D = sum(x["volume_ml"] for x in w.get("discharges", []))
    C = w["consumption"]["total_ml"]
    st = w.get("storage") or {}
    dS = st.get("closing_ml", 0) - st.get("opening_ml", 0)
    resid = W - D - C - dS
    return resid, (resid / W if W else 0.0)


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data" / "sites.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    recs = data if isinstance(data, list) else [data]
    Draft202012Validator.check_schema(SCHEMA)
    v = Draft202012Validator(SCHEMA)
    n_err = 0
    for rec in recs:
        sid = rec.get("site", {}).get("site_id", "?")
        errs = sorted(v.iter_errors(rec), key=lambda e: list(e.path))
        for e in errs:
            n_err += 1
            print(f"  SCHEMA  {sid}: /{'/'.join(map(str, e.path))}: {e.message}")
        resid, pct = balance(rec)
        flag = "OK  " if abs(pct) <= BALANCE_TOLERANCE else "WARN"
        c = rec["water"]["consumption"]
        comp = [c.get(k) for k in ("evaporation_ml", "entrainment_ml", "other_ml")]
        comp_msg = ""
        if all(x is not None for x in comp) and abs(sum(comp) - c["total_ml"]) > 0.5:
            comp_msg = "  components != total"
            n_err += 1
        print(f"{'PASS' if not errs else 'FAIL'}  {sid:<12} {rec['tier']}  balance {flag} residual {resid:9.1f} ML ({pct*100:+5.1f} %){comp_msg}")
    print(f"\n{len(recs)} passports, {n_err} schema/consistency errors")
    return 1 if n_err else 0


if __name__ == "__main__":
    sys.exit(main())
