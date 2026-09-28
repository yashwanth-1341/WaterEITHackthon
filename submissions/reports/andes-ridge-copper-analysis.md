# Water data analysis: Andes Ridge Copper (sample)

Files: `andes-ridge-copper-2023.xlsx` (SHA-256 4490728605d8029a…), `andes-ridge-copper-2024.xlsx` (SHA-256 cca7a0442f433a57…)
309 figures, 3 sites, years 2019, 2020, 2021, 2022, 2023, 2024. Integrity score 8/100.

## Findings

- ⚠️ Water withdrawn rises 5.4% a year (2019–2024). If nothing changes it reaches 160,383 ML by 2036, +86.9% on 2024.
- ⚠️ Water per tonne of ore is getting worse (+1.2% a year): the growth in water use is not only from mining more.
- ⚠️ Freshwater withdrawal rises 2.8% a year.
- ⚠️ 89% of its water comes from water-stressed areas, where caps and price rises will hit first.
- ⚠️ Reuse share is 64%, against a peer median of 71% (rank 9 of 13).
- ⚠️ 7 figures failed a consistency check and should be corrected before the data is published or audited.

## Trend and projection if nothing changes

| Indicator | Last reported | Trend | Now (2026) | +2 years (2028) | +5 years (2031) | +10 years (2036) |
| --- | --- | --- | --- | --- | --- | --- |
| Total water withdrawal (ML) | 85,795 (2024) | 5.4%/yr | 95,224 | 105,688 | 123,581 | 160,383 |
| Freshwater withdrawal (ML) | 74,939 (2024) | 2.8%/yr | 79,240 | 83,788 | 91,103 | 104,742 |
| Water per tonne of ore (m³/t) | 1.13 (2024) | 1.2%/yr | 1.16 | 1.19 | 1.23 | 1.31 |
| Reuse share of demand (%) | 64% (2024) | -0.7 pts/yr | 63% | 61% | 59% | 56% |
| Withdrawal in water-stressed areas (%) | 89% (2024) | 0.7 pts/yr | 90% | 92% | 94% | 98% |
| Discharge (ML) | 6,519 (2024) | 3.2%/yr | 6,948 | 7,405 | 8,148 | 9,555 |
| Consumption (ML) | 79,276 (2024) | 4.9%/yr | 87,199 | 95,913 | 110,645 | 140,396 |

## Compared with peers

- Total water withdrawal: 85,795 — rank 8 of 16 (peer median 117,327)
- Freshwater withdrawal: 74,939 — rank 6 of 11 (peer median 64,540)
- Water per tonne of ore: 1.13 — rank 3 of 6 (peer median 1.2)
- Reuse share of demand: 64% — rank 9 of 13 (peer median 71%)
- Withdrawal in water-stressed areas: 89% — rank 6 of 6 (peer median 11%)
- Discharge: 6,519 — rank 4 of 15 (peer median 37,388)
- Consumption: 79,276 — rank 4 of 10 (peer median 144,302)

## Integrity checks

- **high** · Restated between reports · Quebrada Seca · 2023: Withdrawal for Quebrada Seca 2023 changed by +12.0% between reports
- **high** · Restated between reports · Quebrada Seca · 2023: Stressed-area withdrawal for Quebrada Seca 2023 changed by +12.0% between reports
- **high** · Sites do not add up to the total · 2021: Withdrawal: 3 sites sum to 71,857 ML against a reported total of 78,325 ML (-8.3%)
- **high** · Sites do not add up to the total · 2023: Discharge: 3 sites sum to 4,331,696 ML against a reported total of 6,297 ML (+68689.8%)
- **high** · Water balance does not close · Laguna Verde · 2023: Withdrawal minus discharge and consumption leaves -4,325,399 ML (-45507% of withdrawal)
- **high** · Probable unit error · Laguna Verde · 2023: Discharge for Laguna Verde moves ×1,020 from 2022 to 2023
- **high** · Probable unit error · Laguna Verde · 2024: Discharge for Laguna Verde moves ÷980.5 from 2023 to 2024
- **medium** · Restated between reports · 2023: Withdrawal for company total 2023 changed by +2.6% between reports
- **medium** · Restated between reports · 2023: Stressed-area withdrawal for company total 2023 changed by +2.9% between reports
- **medium** · Water balance does not close · Cerro Blanco · 2022: Withdrawal minus discharge and consumption leaves 14,105 ML (29% of withdrawal)
- **medium** · Water balance does not close · 2022: Withdrawal minus discharge and consumption leaves 14,105 ML (19% of withdrawal)
- **medium** · Sources do not add up to the total · Quebrada Seca · 2023: Withdrawal by source sums to 17,548 ML, total says 19,654 ML (-10.7%)
- **medium** · Water balance does not close · Quebrada Seca · 2023: Withdrawal minus discharge and consumption leaves 2,106 ML (11% of withdrawal)
- **medium** · Identical figure repeated: 1,386 ML appears 2 times (2 sites, 2 years)
- **low** · Digit pattern unusual: First digits of 182 water figures deviate from Benford's law (MAD 0.039)

## Recommended actions

1. Check units at Laguna Verde: a figure moved about a thousandfold, which usually means m³ was entered as ML.
2. Make the water balance close at Laguna Verde, Cerro Blanco, company total, Quebrada Seca: water in should equal water out, consumed and stored.
3. Reconcile totals (company total, Quebrada Seca): the parts don't add up to the reported total.
4. Explain 4 restated figures from the previous submission in the note column.
5. Put water-stressed sites first: set a freshwater cap per site and a date to meet it.
6. Raise reuse from 64% towards the peer median of 71% (thickened tailings, closed circuits).
7. Reverse the rise in water per tonne before expanding output further.

_Projections extend the disclosed trend; they are not forecasts. Integrity signals are prompts for review, not proof of wrongdoing._
