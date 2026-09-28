# MineWater Passport — proposed minimum site-level water reporting standard (draft v0.1)

> Hackathon draft by the EIT Water Hackathon Munich 2026 team. Not an endorsed standard. It **reuses** existing definitions (ICMM 2021, MCA WAF v2.0, GRI 303) instead of inventing new ones — the contribution is the *site-level minimum set*, the *tiering*, the *quality/context flags* and the *machine-readable crosswalk*.

Machine-readable schema: [`mine-water-passport.schema.json`](mine-water-passport.schema.json) (JSON Schema 2020-12). Examples: [`example-passport.tier1.json`](example-passport.tier1.json), [`example-passport.tier2.json`](example-passport.tier2.json). Crosswalk (generated from the schema): [`crosswalk.md`](crosswalk.md).

---

## 1. Why a site-level passport

| Today | Consequence | Passport rule |
|---|---|---|
| Water reported at **company** level (sum of 20–50 sites) | Impossible to link use to a basin, to compare sites, or to model supply under scarcity | Unit of reporting = **one mine / processing site**, identified by stable ID + coordinates |
| "Water use" used loosely for withdrawal **or** consumption | 5–10× differences between sites that are really comparable (see Norrberg vs Cerro Andino in the demo: 28 GL vs 27 GL withdrawn, 6 GL vs 26 GL consumed) | Withdrawal, discharge, consumption and Δstorage are **separate, mandatory** fields; the balance must close |
| Seawater, hypersaline dewatering and brine lumped with freshwater | Brine lithium looks like the thirstiest or the least thirsty product depending on the author | Every flow carries a **WAF quality category** (Cat 1/2/3) + GRI freshwater flag |
| No basin context | 1 GL in a boreal catchment ≠ 1 GL in the Atacama | **Basin stress derived automatically** from coordinates (WRI Aqueduct 4.0) |
| Estimates presented like meter readings | False precision | **Data-quality tier on every figure**: measured / calculated / estimated |
| Voluntary regimes with different templates | Report fatigue, low coverage | **Crosswalk**: one passport answers GRI 303/14, ESRS E3-4, CDP module 9, IRMA 4.2.5 |

## 2. Design principles

1. **Comparability** — site-level; normalised intensities (m³/t ore, m³/t contained metal or t LCE); co-products handled by explicit **economic allocation share** per product (documented, overridable); consumption ≠ withdrawal always.
2. **Minimal burden** — **Tier 1 = 12 data points** a site can compile in a day from existing meters/permits. **Tier 2 = full WAF-style balance**. Context (basin stress) is *derived*, never asked of the reporter.
3. **Decision relevance** — basin stress, competing users, monthly seasonality, grievances/incidents turn totals into impact signals for buyers, basin authorities and researchers.
4. **Honesty about data quality** — each volume carries `dq` = measured / calculated / estimated; assurance level is a Tier-1 field; the mass balance is an automatic plausibility test.
5. **Open data** — open schema + open validator + CC-BY dataset; the passport is the data unit for open research datasets (e.g. global mining water-use modelling).

## 3. Tier 1 — the 12 must-report data points

| # | Data point | Schema path(s) | Notes |
|---|---|---|---|
| 1 | Site ID & name | `site.site_id`, `site.name` | ID pattern `MWP-<ISO2>-<4 digits>`, stable over time |
| 2 | Coordinates & country | `site.latitude`, `site.longitude`, `site.country` | WGS84; enables automatic basin lookup |
| 3 | Primary commodity | `site.primary_commodity` | Cu, Li, Ni, Co, Zn, Au, Fe, Mn, graphite, REE, other |
| 4 | Mine type & processing route | `site.mine_type`, `site.processing_route[]` | open pit / underground / brine / ISL…; flotation, heap leach SX-EW, HPAL, brine evaporation, DLE… |
| 5 | Reporting year | `period.year` | calendar or fiscal (dates optional) |
| 6 | Ore (or brine) processed | `production.ore_processed_t` **or** `production.brine_processed_m3` | intensity denominator |
| 7 | Contained metal / LCE produced | `production.products[].metal_content_t`, `.basis` | per co-product, with `allocation_share` |
| 8 | Withdrawal by source | `water.withdrawals[]` {source, volume_ml, dq} | surface / ground / sea / third-party |
| 9 | Discharge by destination | `water.discharges[]` {destination, volume_ml, dq} | empty array = zero discharge (explicit) |
| 10 | Consumption total | `water.consumption.total_ml`, `.total_dq` | evaporation + entrainment + other |
| 11 | Reused / recycled water | `water.reuse.reused_recycled_ml`, `.dq` | ICMM "required" metric |
| 12 | Assurance status | `assurance.level` | none / internal review / limited / reasonable |

## 4. Tier 2 — full site water balance

Adds (schema enforces via `if tier == tier2`):

- Withdrawal **sub-type** and **quality category** per flow: river/lake abstraction, *precipitation & runoff*, bore field, mine dewatering, *ore entrainment*, brine, direct/desalinated seawater, municipal, other operation, treated wastewater. (WAF v2.0 rolls precipitation into surface water and ore entrainment into groundwater — MWP keeps both visible as sub-types so they roll up correctly.)
- Discharge **quality** and treatment flag.
- **Consumption components**: evaporation, entrainment (tailings & product), other losses — each with its own `dq`.
- **Storage** opening/closing (Δstorage), task water, reuse/recycling incl. TSF return water, other managed water (WAF OMW).
- **Monthly profile** (withdrawal, consumption, discharge) — required for sites in high / extremely-high / arid basins.
- **Context**: competing users (agriculture, drinking water, Indigenous communities, ecosystems, hydropower, tourism…), seasonality, water-related grievances and incidents.

## 5. Units, definitions, quality categories

- Volumes in **megalitres (ML)** (= 1,000 m³), as in GRI 303 and ICMM. Intensities in m³/t.
- **Withdrawal** = operational input from the environment or third parties (ICMM / WAF "input"). **Discharge** = water returned to surface, ground, sea or a third party. **Consumption** = water not returned (evaporation, entrainment, other losses).
- **Mass balance**: `Σ withdrawals − Σ discharges − consumption − Δstorage = residual`; MWP flags |residual| > 5 % of withdrawal (illustrative tolerance, to be calibrated in the pilot). If consumption is *calculated* as the residual, the `dq` flag says so — and the check is then only as good as the storage estimate.
- **Quality (MCA WAF)**: Cat 1 high quality (minimal treatment), Cat 2 medium (moderate treatment), Cat 3 low (high TDS, metals, extreme pH). MWP crosswalk: ICMM "high quality" = Cat 1; ICMM "low quality" = Cat 2 + 3 (our convention — to be confirmed against the ICMM guide). GRI 303 "freshwater" (≤ 1,000 mg/L TDS) is a separate boolean per flow.
- **Basin stress**: WRI Aqueduct 4.0 baseline water stress (score 0–5; categories low → extremely high, plus "arid & low water use"). MWP treats "arid & low water use" basins as ≥ high for prioritisation (design choice).

## 6. Normalised KPIs computed from a passport

| KPI | Formula | Use |
|---|---|---|
| Withdrawal intensity | Σ withdrawals × 1000 / ore t | pressure on sources |
| Consumption intensity | consumption × 1000 / ore t | comparable efficiency across sites |
| Water footprint per t metal | consumption × 1000 × allocation share / t contained metal (or t LCE) | buyer / due-diligence lens |
| Freshwater-grade share | Cat 1 withdrawals / total | substitution potential (seawater, recycled) |
| Consumed-to-withdrawn ratio | consumption / withdrawal | exposes the withdrawal-vs-consumption gap |
| Stress-weighted consumption | consumption × stress weight (low 0.1 … extremely high / arid 1.0; illustrative) | hotspot ranking |
| Balance residual | see §5 | data plausibility |

## 7. Transparency score (A–E) — team proposal, to be calibrated

| Component | Max | Rule |
|---|---|---|
| Tier-1 completeness | 24 | 2 points per data point present |
| Tier-2 depth | 20 | sub-type & quality 4, consumption components 4, storage 3, task water 2, monthly 4, context 3 |
| Data quality | 30 | volume-weighted: measured 1.0, calculated 0.6, estimated 0.2 |
| Assurance | 16 | none 0, internal 4, limited 11, reasonable 16 |
| Balance closure | 10 | ≤ 2 % → 10; ≤ 5 % → 5; else 0 |

Grades: **A ≥ 90, B ≥ 75, C ≥ 58, D ≥ 45, E < 45.** The score measures *reporting quality*, not *water performance* — a site in a stressed basin can be an A.

## 8. Crosswalk to existing frameworks

See [`crosswalk.md`](crosswalk.md) (generated from the schema annotations) for the per-field table. Summary:

| Framework | What the passport fills | Caveat |
|---|---|---|
| **GRI 303: Water and Effluents 2018** | 303-3 (withdrawal by source, freshwater/other, stressed areas), 303-4 (discharge by destination, non-compliance incidents), 303-5 (consumption, stressed areas, change in storage) | GRI 303 lists "produced water" as a source — relevant to oil & gas, rarely to mining; brine is mapped to groundwater Cat 3 |
| **GRI 14: Mining Sector 2024** (topic 14.7) | Sector guidance asks to report withdrawal, discharge and consumption **by mine site** — exactly the passport unit | Effective for reports from 1 Jan 2026 |
| **ESRS E3** (Delegated Reg. (EU) 2023/2772) | E3-4 §28(a) total consumption, (b) consumption in areas at water risk, (c) recycled & reused, (d) stored & changes in storage, (e) context; AR 32 withdrawals & discharges (voluntary) | ESRS are being simplified (EFRAG 2025 drafts); paragraph numbers may change. ESRS is company-level — the passport supplies the site-level evidence and the value-chain data |
| **CDP water (2024+ integrated questionnaire, module 9)** | 9.2.2 totals, 9.2.4 stressed-area withdrawals, 9.2.7 by source, 9.2.8 by destination, 9.3.1 facility coordinates & accounting, 9.12 intensity | Question numbers change between cycles |
| **IRMA Standard v1.0, ch. 4.2 Water Management** | 4.2.5.1 annual publication of volumes extracted/pumped and discharged; 4.2.2 site characterisation & water balance model; 4.2.1 context & collaboration; 4.2.4 monitoring | IRMA v2.0 in development |
| **ICMM Water Reporting Good Practice Guide (2nd ed., 2021)** | All operational metrics, high/low quality split, reuse/recycle, stressed-area reporting, Δstorage | ICMM applies to member companies; passport extends to non-members |
| **MCA Water Accounting Framework v2.0** | Input/output statement, Cat 1/2/3, task water, reuse/recycling efficiency, OMW | — |

## 9. Governance & versioning (proposal)

- Open repository; semantic versioning of the schema; every passport carries `passport_version`.
- `sources[]` with `extraction` provenance (reported directly / manual / automated-reviewed / automated-unreviewed) so backfilled data is never confused with reported data.
- Stewardship proposal: academic host (e.g. WU Vienna) + industry and civil-society advisory group; alignment talks with ICMM, GRI, EFRAG and IRMA before v1.0.
