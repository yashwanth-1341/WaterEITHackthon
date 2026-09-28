# MineWater Passport — 3-minute pitch

*Challenge 2 · Reporting on Water Use by Mining Actors (owner: Dr. F. Stephan Lutter, WU Vienna). All site data in the demo are illustrative synthetic data.*

## Script (≈ 420 words, 3:00)

**[0:00 — Hook]**
Every electric car needs copper, lithium, nickel and cobalt. Recycling can't cover the growth — so we need new mines. And more and more of them sit in basins where farmers, towns and wetlands are already fighting for water.

**[0:20 — Problem]**
So a simple question: which mine uses how much water? Today, nobody can answer it. Reporting is voluntary. It's added up at company level — twenty mines, one number. And the same words mean different things: "water used" can be what a mine pumps, or what it actually loses to evaporation and tailings. In our demo data that gap is almost five-fold for a single mine. Dr. Lutter's own research at WU Vienna found that copper's global water intensity is about twice what was previously assumed. That's what missing site data does.

**[0:50 — Solution]**
We built the **MineWater Passport**: one open, machine-readable page per mine.
Twelve must-report numbers — withdrawal by source, discharge, consumption, recycling, production, assurance. Every figure carries a flag — measured, calculated or estimated — and every flow a water-quality category. The basin context — water stress — is added automatically from the coordinates. We didn't invent definitions: it's built on ICMM and the Australian Water Accounting Framework, and every field maps to GRI, ESRS, CDP and IRMA. Report once, reuse everywhere.

**[1:25 — Demo]**
*(Explorer)* Seventeen fictional mines. Toggle withdrawal to consumption — this Swedish mine is one of the biggest withdrawers, but a small consumer. *(Hotspots)* Top right: high consumption in high-stress basins — where to look first. *(Supply chain)* A battery buyer compares water per tonne of lithium — and sees that brine sites mostly withdraw hypersaline water, not freshwater. *(Report card)* Grade E: estimates, no assurance, balance doesn't close. *(Extractor)* And to fill thousands of passports fast, we extract figures from existing reports — "used 3,800 megalitres" gets flagged as ambiguous, automatically.

**[2:10 — Why it matters, who pays]**
From August 2027 the EU Batteries Regulation requires due diligence on lithium, nickel and cobalt supply chains — including water. GRI's new mining standard asks for site-level water data. The format is missing; this is it.
The standard and data stay open — researchers and communities use it free. Buyers pay for the due-diligence workflow; rating agencies and banks license the reviewed dataset.

**[2:40 — Ask]**
Our ask: a 90-day pilot with WU Vienna — backfill 50 real copper and lithium sites from public reports, and test whether they become comparable. Then satellites as the independent check.
Water decides where the metals of the energy transition can come from. Let's make it visible — mine by mine.

## 7-slide outline

1. **Title** — MineWater Passport: site-level water reporting for mines. One line: *Who uses how much water — mine by mine.*
2. **Problem** — voluntary, company-level, withdrawal vs consumption confusion, no basin context; owner's finding (copper water intensity ~2× previously known). Visual: one company total vs 20 dots on a map.
3. **The passport** — Tier 1 (12 fields) / Tier 2 (full balance); quality categories; data-quality flags; auto basin stress; crosswalk logos-free table: GRI 303/14 · ESRS E3 · CDP · IRMA · ICMM/WAF.
4. **Live demo** — Explorer → Hotspots → Supply-chain lens → Report card (screenshots as backup).
5. **Backfill engine** — extractor pipeline (heuristic → LLM → cross-check → human review → publish); satellite verification in v2.
6. **Impact & business** — impact chain; open core; buyers (Batteries Reg. from Aug 2027), raters/banks; researchers free.
7. **Pilot & ask** — 90 days with WU Vienna: 50 sites, inter-comparability test, open dataset v1. Team roles.
