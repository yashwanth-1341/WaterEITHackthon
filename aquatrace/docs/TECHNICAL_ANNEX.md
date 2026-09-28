# AquaTrace: technical annex

## Core components

| Component | Technology | Role |
| --- | --- | --- |
| Web app | Next.js 16, React 19, Tailwind CSS 4, Recharts | Landing page, industry dashboard, site ledger, submission analysis |
| Corpus | `lib/data/corpus.json`, 6,023 records | One record = one figure: company, site, year, metric, value in ML, raw value and unit, source file, page or cell |
| Analytics library | TypeScript, `lib/corpus/*`, runs in the browser and on the server | Series, trends, indicators, integrity checks, foresight |
| Submission pipeline | `lib/submission/*`, SheetJS | Template, parser, analysis of a new company |
| Server API | Next.js route handlers | `/api/ai` (OpenAI), `/api/datasets` (save/open), `/api/audit` (audit log), `/api/integrity/files` (file fingerprints) |
| Storage | Supabase (Postgres) | Saved datasets with a SHA-256 seal; append-only, hash-chained `audit_events` |
| AI | OpenAI `gpt-4o-mini`, server-side key | Q&A grounded only in the figures on screen; the context sent is shown to the user |

## Data flow

```
Published reports (PDF, XLSX, CDP)        Company submission (AquaTrace template)
        │ extraction to schema                     │ parse, validate, convert units to ML
        ▼                                          ▼
data/extracted/*.json ── build-corpus ──► corpus.json  ◄── merged in memory, not stored
        │ SHA-256 of every source file              │
        ▼                                           ▼
 verify-corpus: every workbook figure re-read from its cell
        ▼
 Series (one value per company/site/year/metric; latest report wins)
        ▼
 Trends ─ Indicators ─ Integrity signals ─ Foresight facts
        ▼
 Views: Foresight · Trends · Benchmark · Regulators · Integrity · Submission · Ask
```

## Critical algorithms

- **Unit normalisation.** Every volume is converted to megalitres (1 ML = 1,000 m³), and the raw value and unit are kept so the conversion can be audited.
- **Choosing one value.** When several reports state the same figure, the most recent report wins. Earlier values remain available to the restatement check.
- **Comparable segments.** Documented changes of basis (method changes, acquisitions, divestments, reclassifications) are listed in `data/extracted/_breaks.json` with their source. Trends are fitted only on the latest comparable stretch of three or more years.
- **Trend and projection.** Volumes use log-linear least squares, which gives a constant annual rate; percentages use a linear fit. Each projection starts from the latest reported value, and its 80% range comes from the residual spread, with a minimum so short series don't look over-precise. The horizons are 2026, 2028, 2031 and 2036.
- **Integrity checks**, each returned with evidence (value, file, page or cell):
  - silent restatements between reports;
  - sites vs company total;
  - sources vs total;
  - water balance (withdrawal = discharge + consumption + change in storage, tested with and without ICMM "other managed water");
  - subsets larger than the whole, and negative volumes;
  - jumps of ×2.5 or more, downgraded when they cross a documented break;
  - ≈1,000× unit errors;
  - repeated non-round figures;
  - Benford first-digit test (MAD > 0.015);
  - heavy rounding.
- **Integrity score.** Signals are weighted (high 8, medium 3, low 1) and counted per 100 disclosed figures, then mapped to a score as 100·e^(−density/10). Companies that publish more are not penalised.
- **Tamper evidence.** Source files and uploads are fingerprinted with SHA-256. Each saved dataset is sealed with a hash of its payload (keys sorted), which is recomputed on every read. Each audit event's hash covers the previous event's hash. A database trigger blocks UPDATE and DELETE, and `/api/audit` recomputes the whole chain.
- **Scenario engine (ledger).** Applies a tariff rise and a legal intake cut; each site closes the gap with extra recycling, then desalination if it is coastal. Whatever is left is output at risk.

## Proven today vs assumed

| Proven today | Assumed or experimental |
| --- | --- |
| Extraction: 4,387 workbook figures re-checked against their cells with 0 mismatches; 1,636 PDF figures found on the cited page | Projections extend disclosed trends; they are not forecasts |
| Checks catch every planted error in the sample (unit slip, balance, totals, silent restatement) | The foresight narrative (consequences, desired future) is analysis |
| Supabase save, fingerprinting and the OpenAI connection were tested live | Scenario prices (USD/m³) are illustrative |
| The ledger importer reproduces every published Newcrest site total | Water-stress levels come from each company's own classification, not WRI Aqueduct yet |
| | The sample company (Andes Ridge Copper) is fictional |

## Main technical risks

1. **Extraction at scale.** Report layouts differ for every company. Mitigations: the template for new submissions, and cell-level verification for workbooks. PDFs still need human review.
2. **Comparability.** Scopes, fiscal years and definitions differ between companies. Mitigation: documented breaks, intensity metrics, and caveats shown on screen.
3. **Self-reported data.** Checks show inconsistency, not truth. Metered data signed at the device is the next step (+2 years).
4. **Security.** There is no user authentication yet, the service-role key is server-only, and `xlsx` 0.18.5 has known advisories (use the SheetJS CDN build in production).
5. **The AI can be wrong.** Answers are limited to the figures supplied, and the context sent is visible to the user.

## Standards and sources

ICMM Water Reporting Good Practice Guide, 2nd ed. (2021) · GRI 303 Water and Effluents (2018) · SASB EM-MM-140a · CDP Water Security · ESRS E3 · EU Battery Regulation (EU) 2023/1542 · WRI Aqueduct (planned). Company reports: see `data/reports/`, with each figure's file and location in `lib/data/corpus.json`.
