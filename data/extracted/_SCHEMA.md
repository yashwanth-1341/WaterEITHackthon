# Extraction schema (one JSON file per company group)

Write `data/extracted/<company-slug>.json`:

```json
{
  "company": "Teck Resources",
  "files": [
    {
      "file": "Teck-2022_Sustainability-Performance-Data(2).xlsx",
      "relevant": true,
      "yearsCovered": [2019, 2020, 2021, 2022],
      "granularity": "site" ,
      "reason": "Site-level withdrawal by source, discharge, consumption, reuse 2019-2022"
    }
  ],
  "sites": [
    { "site": "Highland Valley Copper", "country": "Canada", "commodity": ["copper", "molybdenum"],
      "waterStressReported": "high|medium|low|null", "status": "operating|closed|divested|null" }
  ],
  "records": [
    {
      "site": "Highland Valley Copper",
      "year": 2022,
      "metric": "withdrawal_total",
      "value": 12345.6,
      "rawValue": "12,345,600",
      "rawUnit": "m3",
      "sourceFile": "Teck-2022_Sustainability-Performance-Data(2).xlsx",
      "location": "sheet 'Water' row 42 col F",
      "note": "optional: restated / reporting-year basis / scope caveats"
    }
  ],
  "observations": [
    "Short factual notes on things that matter for analysis: restatements, scope changes, methodology changes, divestments, drought events, data gaps, internal inconsistencies noticed."
  ]
}
```

## Rules
- `site`: the operation name as reported. Use `"_corporate"` for company-wide totals. Record BOTH site values and corporate totals when both exist (the totals let us check that sites sum to the total).
- `year`: the reporting year the value refers to (integer). For fiscal years (e.g. FY20 ending June 2020) use the end year and say so in `note`.
- `value`: converted to **megalitres (ML)** for all water volumes. 1 ML = 1,000 m³ = 1,000,000 L. 1 GL = 1,000 ML. 1 thousand m³ = 1 ML. 1 million m³ = 1,000 ML. Keep `rawValue` and `rawUnit` exactly as in the file so the conversion can be audited.
- Percentages stay as percentages (0-100). Production in the stated unit, converted to: tonnes (t) for ore/metal, troy ounces (oz) for gold/silver.
- Only numbers actually present in the file. Never estimate, interpolate or compute a value that the file doesn't state (except unit conversion). If a figure is blank/"n/a"/"not reported", omit it.
- If the same (site, year, metric) appears in several files (e.g. a 2019 value in both the 2019 and the 2020 report), record EVERY occurrence with its own sourceFile. Differences between them are restatements, which are important.
- `location`: sheet+row/cell for spreadsheets, page number for PDFs. Must be precise enough for a human to find the number.

## Metric vocabulary (use exactly these keys; skip what isn't disclosed)
Water (ML):
- withdrawal_total
- withdrawal_surface, withdrawal_ground, withdrawal_sea, withdrawal_third_party, withdrawal_rain_runoff, withdrawal_entrained_ore (water in ore / process water from ore), withdrawal_other
- withdrawal_fresh (freshwater / high quality / "Category 1" per ICMM), withdrawal_low_quality (other water / Category 2-3)
- withdrawal_water_stressed (withdrawal from areas with water stress)
- discharge_total, discharge_surface, discharge_ground, discharge_sea, discharge_third_party
- consumption_total (incl. evaporation/entrainment)
- reused_recycled (volume of water reused/recycled)
- reuse_rate_pct (%)
- water_stored_change (ML)
Production:
- ore_processed_t, copper_production_t, gold_production_oz, silver_production_oz, zinc_production_t, nickel_production_t, iron_ore_production_t, coal_production_t, molybdenum_production_t, other_production (put unit and commodity in note)
Intensity (as reported, don't compute):
- water_intensity_reported (put unit in note, e.g. "m3/t ore")
Governance / compliance:
- water_incidents_count (significant water-related incidents / non-compliances)
- water_fines_usd
If an important metric doesn't fit, use `other:<short_key>` and explain in note.

## Relevance
Mark `relevant: false` with a reason for files with no usable water data (e.g. an ore-reserves report). Still add its reserve/production figures if they help (e.g. copper reserves), but keep them few.
