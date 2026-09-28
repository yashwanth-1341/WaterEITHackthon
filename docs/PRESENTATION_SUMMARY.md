# AquaTrace: what each part shows, why it matters, and how it meets the brief

AquaTrace reads the water reports mining companies already publish, puts every figure on one scale (megalitres), checks it for errors and tampering, and shows where the trend leads in 2, 5 and 10 years. It is the first vertical of our trend, **circular water use in industry**: mining is the heaviest industrial water user in the driest basins, and it supplies the battery and AI-hardware boom that drives the trend.

## 1. What each part displays and why it is needed

### Landing page (`/`)

| Section | What it shows | Why it's needed |
| --- | --- | --- |
| Hero | One sentence on what AquaTrace does; 16 companies, 34 countries, 6,023 figures, 2014–2024 | The jury knows in ten seconds what this is and that it runs on real data |
| The problem | Metals come from dry basins; every report looks different (5 of 16 disclose stressed-area withdrawal); nobody checks the numbers (8 of 16 have figures that don't add up) | States the problem and who is affected: companies, buyers and regulators |
| How it works | Collect → Check → Explain | Makes the solution obvious before any chart |
| What the data shows | Withdrawal +3.5% a year (median), reuse 71% and slipping 1.3 points a year, and a chart where the index reaches 161 by 2036 if nothing changes vs 85 with action | The two or three key insights, on one screen |
| The risk if nothing changes | Now, +2, +5 and +10 years in one line each | Shows why the timing is now |
| What companies should do | Five actions: meter water, report per site, close the balance, explain restatements, cut water per tonne | Turns the analysis into decisions |
| Who it's for | Companies, investors and buyers, regulators, each linking to its view | One dataset, three markets |

### Industry dashboard (`/explore`)

| View | What it shows | Why it's needed |
| --- | --- | --- |
| **Foresight** | The Market Foresight Canvas, built from the data: trend line (expected vs desired), then for each horizon the expected trend, market consequences (market, industry, customers, business model), desired future, and interventions marked *Built*, *We build next* or *Needs partners* | The canvas, live and backed by numbers instead of sticky notes |
| **Trends** | Seven indicators per company (withdrawal, freshwater, water per tonne, reuse, stressed share, discharge, consumption); projections with 80% ranges at 2026, 2028, 2031, 2036; documented breaks (acquisitions, method changes) respected | The interactive "explore scenarios" piece: click an indicator or a company and the chart and projections change |
| **Peer benchmark** | Companies ranked on water per tonne, reuse, stressed-area share, disclosure completeness and integrity score | What investors and metal buyers compare before a contract |
| **Regulators** | Sites regrouped by country; stressed sites, incidents and fines; which disclosure gaps a rule could close | Governments permit per basin, while companies report per company |
| **Data integrity** | Source files fingerprinted (25/25 match); 191 signals such as silent restatements, balances that don't close, sites that don't add up, unit errors and repeated figures, each with its evidence and source cell or page; hash-chained audit log | Water data will soon be priced and traded, so it has to be trustworthy |
| **Analyse a submission** | A company uploads the template and immediately gets its trend, 2036 projection, peer rank, figures to fix and a to-do list | Shows how a new customer is onboarded; a live demo with fictional sample data |
| **Ask the data** | Plain-English Q&A (OpenAI) grounded only in the figures on screen; the context sent is visible | Makes the data usable for non-experts and the jury |

### Site ledger (`/ledger`)

One company in depth: the site water balance, the mapping of legacy reports to ICMM 2021, checks, and **Cost and regulation**. That view has presets for **tariffs +400% (+2 years)** and **tariffs +1,000% plus a 50% intake cut by law (+10 years)**, which are exactly the milestones on our canvas trend line, and shows cost and output at risk per site.

## 2. How AquaTrace meets the presentation expectations

| Expectation | How AquaTrace meets it | Where to show it |
| --- | --- | --- |
| **No PowerPoint** | The pitch is the running app: landing page, then dashboard, then a live submission | `/`, then `/explore` |
| **Explain the problem and who is affected** | Problem cards and three audiences: companies, investors/buyers, regulators | Landing: *The problem*, *Who it's for* |
| **Market growing or about to explode** | Withdrawal still rising; demand for battery and AI-hardware metals is growing; reporting rules are tightening (ESRS E3, ISSB/SASB water metrics, EU Battery Regulation due diligence, Chile's 2022 water code reform) | Foresight view; landing *Risk* timeline |
| **Why the timing is now** | Disclosure is fragmented today (5 of 16 disclose stressed withdrawal), while buyers and rules will demand site-level proof within about 2 years | Foresight *Now* and *+2 years* |
| **Real or well-constructed data** | Real: 24 public reports from 16 companies (BHP, Freeport, Anglo American, Teck, Newmont, Barrick…). Well-constructed sample: fictional Andes Ridge Copper, labelled as fictional, with four deliberate mistakes | Sidebar counts; *Analyse a submission* |
| **Explain where the data comes from** | Every figure links to its file and page or cell; all 4,387 workbook figures were re-checked against their cells; the 1,636 PDF figures were checked against the cited page | *Data integrity* → *Show evidence*; `npm run verify-corpus` |
| **2–3 key insights** | 1) Water use grows about 3.5% a year while reuse slips. 2) Half the companies publish figures that don't add up. 3) Most companies don't disclose water from stressed basins, which is where risk is highest | Landing *Findings*; Foresight headline |
| **At least one interactive visualisation** | Trends chart (indicator × company, projections); scenario sliders (tariff, intake cut); foresight horizons; submission analysis | *Trends*; ledger *Cost and regulation* |
| **Simple enough for non-experts** | Plain-language landing page, colour meaning explained, *Ask the data* | Landing, *Ask the data* |
| **Technical annex (1–2 pages)** | Components, data flow, algorithms, risks and assumptions | [`docs/TECHNICAL_ANNEX.md`](TECHNICAL_ANNEX.md) |
| **Evidence of feasibility** | Working prototype; reproducible pipeline (`build-corpus`, `verify-corpus`, `verify`); built on public standards (ICMM Water Reporting Guide 2021, GRI 303, SASB EM-MM-140a, CDP Water) | Repo, README *Sources* |
| **Proven vs assumed** | Proven: extraction accuracy, the checks, the trend fits. Assumed and labelled in the app: projections are extrapolations, scenario prices are illustrative, the foresight narrative is analysis, the sample company is fictional | Footers on every view |

## 3. How the app maps to our Market Foresight Canvas

The *Foresight* view is our canvas, live. Every sticky note is on screen, and the numbers underneath come from the data.

| Canvas box | Our sticky notes | Where it is in AquaTrace |
| --- | --- | --- |
| **1. Trend** | Circular water use in industry | Foresight header; mining is the first vertical |
| Trend line | Rising water tariffs → +400% → political stalemate → 50% intake reduction by law, +1,000% | The event on each horizon tab (Now, +2, +5, +10). The measured withdrawal index is drawn as a line. The ledger's *Cost and regulation* presets run +400% and +1,000% with a 50% cut per site |
| Drivers | AI boom and battery factories; regulation on water use | Two driver cards under the headline |
| Milestones | 2028 first water-positive plants; 2030 water-rights trading schemes; 2035 near-closed loops are the norm | Dashed green markers on the chart, with the legend below it, and repeated in the horizon text |
| **2. Market consequences** | Relocation of production to non-regulated markets; subsidies for technological adaptation; long-term water contracts; monopolies built on water-infrastructure access | Now: long-term contracts. +2 years: subsidies, contracts become the standard. +5 years: relocation outside the EU, monopolies around water infrastructure. +10 years: those monopolies harden |
| **3. Desired future** | Investment in circular plants; reuse and greywater as the default; adaptive real-time water management; SMEs plug into shared reuse infrastructure | +2 years: circular plants. +5 years: real-time management, reuse and greywater as default. +10 years: SMEs on shared reuse infrastructure, near-closed loops |
| **4. Interventions: Now** | PoC water-use monitoring | *Built*: AquaTrace itself, plus fingerprints, checks, audit log and the submission template |
| +2 years | Cheaper sensors, SCADA and IoT monitoring | *We build next*: meter and SCADA data signed at the device, straight into the ledger |
| +5 years | Reliable certification of water use for the trading scheme | *We build next*: signed submissions, assurer workspaces, anomaly models |
| +10 years | Basin-scale shared circular water infrastructure | *Needs partners*: basin ledgers that allocate shared reuse capacity, including to SMEs; open governance |

## 4. Suggested 5-minute live flow

1. **Landing** (45 s): the problem, the three insights, why now.
2. **Foresight** (60 s): the canvas, backed by data. Click through Now, +2, +5, +10.
3. **Trends** (45 s): pick BHP or Teck and show the projection and its range.
4. **Ledger → Cost and regulation** (45 s): click *Tariffs +400%*, then *+1,000% and a 50% cut*; show the output at risk.
5. **Analyse a submission** (60 s): load Andes Ridge Copper and show the four planted errors being caught, with the to-do list.
6. **Data integrity** (30 s): every number traced, every file fingerprinted. "Proven today vs assumed" is on screen.

Direct links: `/`, `/explore?view=foresight`, `/explore?view=trends&company=BHP`, `/ledger`, `/explore?view=submit&sample=andes`, `/explore?view=integrity`.
