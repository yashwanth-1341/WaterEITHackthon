| Field (JSON path) | Tier | GRI 303 / GRI 14 | ESRS E3 | CDP (2024+ module 9) | ICMM 2021 / MCA WAF | IRMA v1.0 ch. 4.2 |
|---|---|---|---|---|---|---|
| `site.site_id` — Site ID | T1 | GRI 14.7 (report by mine site) |  | 9.3.1 (facility reference) |  |  |
| `site.latitude` — Latitude (WGS84) | T1 |  |  | 9.3.1 (coordinates) |  | 4.2.2 (site characterisation) |
| `site.longitude` — Longitude (WGS84) | T1 |  |  | 9.3.1 (coordinates) |  |  |
| `site.basin.bws_score` — Aqueduct 4.0 baseline water stress score (0-5) | auto | 303-3-b / 303-5-b (areas with water stress) | E3-4 §28(b) (areas at water risk) | 9.2.4 | sites in water-stressed areas |  |
| `production.ore_processed_t` — Ore processed (t, dry) | T1 |  |  | 9.12 (intensity denominator) |  |  |
| `water.withdrawals` — Withdrawals (operational inputs) by source | T1 | 303-3-a/c | E3-4 AR 32 (may disclose) | 9.2.2, 9.2.7 | operational water withdrawal by source / Inputs | 4.2.5.1(b) volume extracted/pumped |
| `water.discharges` — Discharges (outputs returned) by destination | T1 | 303-4-a/b | E3-4 AR 32 (may disclose) | 9.2.2, 9.2.8 | discharge by destination / Outputs | 4.2.5.1(b) volume discharged |
| `water.consumption` — Consumption (not returned: evaporation, entrainment, other losses) | T1 | 303-5-a | E3-4 §28(a) | 9.2.2 | consumption (evaporation, entrainment, other) / Other (consumption) output |  |
| `water.storage` — Storage (ponds, TSF decant, pit water) | T2 | 303-5-c | E3-4 §28(d) |  | change in storage (recommended) / Change in storage |  |
| `water.reuse` — Reuse & recycling | T1 |  | E3-4 §28(c) |  | reuse/recycle (required) / Reuse & recycling efficiency |  |
| `water.other_managed_water_ml` — Other managed water (ML, WAF OMW) | T2 |  |  |  | other managed water withdrawal |  |
| `water.monthly` — Monthly profile (seasonality) | T2 |  |  |  |  | 4.2.4 (monitoring) |
| `context` — Context indicators | T2 | 303-1 / 303-3-d | E3-4 §28(e) |  |  | 4.2.1 (context & collaboration) |
| `context.water_incidents` — Water-related incidents / permit exceedances (count) |  | 303-4-d (non-compliance incidents) |  |  |  |  |
