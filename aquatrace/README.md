# AquaTrace

A site-level water ledger for mining. It reads the water data mines already have (old sustainability spreadsheets or a standard template), converts it to the ICMM 2021 reporting metrics, checks whether each site's water actually adds up, and tests what tariff rises and intake caps would do to cost and output.

Two modes:

- **Landing** (`/`): what AquaTrace does, the key findings, risks and actions, in plain language.
- **Industry** (`/explore`): 16 mining companies, 24 published reports, 6,023 figures (2014–2024), each traced to its page or cell. Trends and projections to now, +2, +5 and +10 years, a market foresight canvas, peer benchmark, a regulator view by country, and data-integrity monitoring.
- **Site ledger** (`/ledger`): one company's sites in depth, preloaded with Newcrest Mining's FY20 GRI 303 disclosures (Lihir, Telfer, Cadia, Gosowong).

## Run it

Requires Node.js 20 or later.

```bash
npm install
cp .env.example .env.local   # then fill in the keys you want
npm run dev                  # http://localhost:3000
```

Everything works without any keys except the "Ask the data" view (needs OpenAI) and saving datasets (needs Supabase).

For the pitch, run the production build: it is faster and has no dev overlay.

```bash
npm run build && npm start
```

The font is bundled, so the app works on venue Wi-Fi or offline. Only "Ask the data" needs internet.

### OpenAI

Set `OPENAI_API_KEY` in `.env.local`. `OPENAI_MODEL` defaults to `gpt-4o-mini`; any chat-completions model your key can use works. The key is used only in `app/api/ai/route.ts` on the server and never reaches the browser. The model receives a compact summary of the figures, checks and scenario on screen (the view has a "See what is sent to the model" toggle), not the uploaded file.

### Supabase (optional)

1. Create a project and run `supabase/schema.sql`, then `supabase/002_integrity.sql`, in the SQL editor. The second adds dataset fingerprints and the append-only audit log.
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
3. Restart. "Save dataset" and "Open saved" appear at the bottom of the site list.

The table has row-level security on and no public policies. Only the server routes in `app/api/datasets` touch it, using the service role key. Add per-user auth and policies before exposing it to real users.

## Industry mode

### Data pipeline

```
data/reports/*.pdf|xlsx ──► extraction (one JSON per company, data/extracted/, schema in _SCHEMA.md)
                        ──► npm run build-corpus  ──► lib/data/corpus.json (+ SHA-256 of every report)
                        ──► npm run verify-corpus ──► every workbook figure re-read from its cell
```

Every record keeps `rawValue`, `rawUnit`, `sourceFile` and `location` (sheet and cell, or page), so conversions to ML can be audited. `data/extracted/_breaks.json` lists documented changes of basis (method changes, acquisitions, divestments, reclassifications) with their source. Trends are fitted only on comparable years, and projections start from the latest reported value.

To add a company: put its report in `data/reports/`, write `data/extracted/<company>.json` to the schema, add any breaks, then run `npm run build-corpus && npm run verify-corpus`.

### Views

| View | For | What it shows |
| --- | --- | --- |
| Foresight | Everyone | Trend statement from the data; for now, +2, +5 and +10 years: the expected trend, market consequences (market, industry, customers, business model), the desired future, and the developer interventions (built, next, needs partners). |
| Trends | Company, analysts | Seven indicators per company, the industry median trend, projections with 80% ranges at each horizon. |
| Peer benchmark | Investors, buyers, communities | Intensity, reuse, stressed-area share, disclosure completeness and integrity score, ranked. |
| Regulators | Government | Site figures regrouped by country, stressed sites, incidents and fines, and disclosure gaps a rule could close. |
| Data integrity | Auditors, everyone | See below. |
| Ask the data | Everyone | OpenAI answers from the corpus context; narrow it by picking a company. |

Deep links: `/explore?view=integrity&company=Teck%20Resources`.

### Tamper and integrity monitoring

1. **Source files**: `/api/integrity/files` re-hashes `data/reports/` and compares with the fingerprints taken at ingestion. "Check a file" hashes any copy in the browser and says whether it is an ingested original, a modified version, or unknown.
2. **Figures** (`lib/corpus/integrity.ts`): silent restatements between reports, sites vs company totals, sources vs total, water balance (tested with and without ICMM "other managed water"), subsets larger than the whole, negative volumes, year-on-year jumps (downgraded when they cross a documented break), ~1,000× unit errors, repeated non-round figures, Benford first-digit test, heavy rounding. The integrity score is weighted signals per 100 figures, so publishing more is not penalised.
3. **Saved data**: datasets are sealed with a SHA-256 fingerprint that is recomputed on every read, and each save goes into a hash-chained `audit_events` log. Updates and deletes are blocked by a trigger, and `/api/audit` recomputes the whole chain.

A signal is a reason to look, not proof of wrongdoing.

## Five-minute demo script

1. **Water balance** (opening screen). "354,742 megalitres, and 89% of it at one site. Company totals hide where water goes." Point at the strips: "Three of four sites do not add up. Telfer reports 3,667 ML more water leaving than entering. This is a verified report from an ICMM member. Most mines publish nothing."
2. **Import and mapping.** Click "Import the Newcrest FY20 workbook" to show the real file being read. Switch Category 2 to "Low quality" and go back to Water balance: every figure moves. "The reporting framework itself changes the answer." Switch it back.
3. **Checks.** Drag the tolerance slider up: failures turn into passes. "What counts as 'close enough' should be a disclosed choice, not a hidden one."
4. **Cost and regulation.** Click the presets in order: Today, Tariffs +400%, then +1,000% with a 50% intake cut. "Telfer and Cadia cannot replace a fifth of their freshwater; that output is at risk."
5. **EU readiness.** "Could these sites supply an EU battery-metal buyer? At best 58% of the data points exist." Click "Download ICMM Table 4".
6. **Ask the data.** Pick "Summarise the three most important findings for a non-expert jury."

## How it works

```
Excel/CSV upload ─┐
Sample workbook ──┼─► format detection ─► legacy GRI importer ──┐
Template ─────────┘                    └► template importer ───┤
                                                                ▼
                                       canonical model (ICMM 2021 Table 4, per site)
                                                                │
                     ┌───────────────┬──────────────┬───────────┼──────────────┐
                     ▼               ▼              ▼           ▼              ▼
               balance and      validation      scenario    readiness     AI context
               intensities      flags           engine      matrix        (OpenAI)
```

| Path | What it does |
| --- | --- |
| `lib/types.ts` | Canonical model. `null` means not disclosed; explicit unknowns are tracked separately. |
| `lib/importers/legacyGri.ts` | Finds GRI 303-3/4/5 tables by label, reads columns from the header row, maps WAF Category 1/2/3 to ICMM high/low. |
| `lib/importers/template.ts` | AquaTrace template import and export, one row per site × metric × source × quality. |
| `lib/importers/workbook.ts` | Format detection, pre-filled template download, ICMM Table 4 export. |
| `lib/metrics.ts` | Water balance (withdrawal = discharge + consumption + change in storage), intensities, recycled share. |
| `lib/validation.ts` | Checks: balance closure, disclosed unknowns, missing ICMM metrics, OMW, storage, assumed stress levels, measurement method, intensity outliers, definition changes over time. |
| `lib/scenario.ts` | Tariff and intake-cap scenarios; gap closed by recycling, then desalination (coastal only); remainder is output at risk. |
| `lib/readiness.ts` | Site × data-point matrix for ICMM, GRI, ESRS E3 and due diligence. |
| `lib/data/siteProfiles.ts` | Context the legacy file lacks (stress, coastal, method). Assumptions, editable in the app. |
| `lib/data/commodities.ts` | Commodity water profiles and the COCHILCO copper process stages. |

### Tests

```bash
npm run verify
```

`verify-import` parses the real workbook and checks every site's withdrawal, discharge, consumption and reuse against the figures published in the sheet, then regenerates `lib/data/newcrest-fy20.json`. `verify-template` exports the dataset as a template, re-imports it and checks nothing changed, including that undisclosed values stay undisclosed.

## What is proven and what is assumed

Proven on real data: the legacy import and mapping, the balance checks and the flags. The importer reproduces all published site totals.

Assumed, and labelled as such in the app:

- **Water-stress levels** in `siteProfiles.ts` are indicative. Replace them with WRI Aqueduct baseline water stress at each site's coordinates.
- **Prices** in the scenario (USD per m³) are illustrative defaults.
- **Output at risk** assumes production scales with freshwater use.
- **Commodity profiles** are qualitative and meant to explain drivers, not rank materials.
- **EU framework mapping** is indicative. CSRD scope, CSDDD and the Battery Regulation due-diligence timeline were revised through the 2025 Omnibus process; check the current legal text.

## Known limitations

- `xlsx` 0.18.5 from npm has published security advisories. That is acceptable for a demo with trusted files. For production, install the maintained build from SheetJS: `npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`.
- The legacy importer is tuned for GRI 303 tables laid out like Newcrest's (labels in one column, sites across the header row). Other layouts need either the template or an extra mapping rule.
- No authentication. Add it before storing real company data.
- Desktop-first layout.

## Sources

- ICMM, Water Reporting: Good Practice Guide, 2nd edition (2021), Tables 1 and 4, Figure 1.
- Newcrest Mining, 2020 Sustainability Report, GRI content index and supplementary data.
- COCHILCO, processing of sulfide minerals by flotation and pyrometallurgy (Figure 2.1).
- GRI 303: Water and Effluents (2018); ESRS E3 Water and marine resources.
