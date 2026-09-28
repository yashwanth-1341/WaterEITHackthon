# Submissions: analysing a new mining company

A company reports its water data to AquaTrace in one Excel template. AquaTrace reads it, fingerprints it, runs the same trend, projection, integrity and peer analysis as for the 16 companies already in the dataset, and returns findings and actions.

```
submissions/
├── template/
│   └── aquatrace-submission-template.xlsx   blank template to send to a company
├── examples/
│   ├── andes-ridge-copper-2023.xlsx         SAMPLE, fictional company, 2023 report (2019–2023)
│   ├── andes-ridge-copper-2024.xlsx         SAMPLE, same company, 2024 report (2022–2024)
│   └── hudbay-minerals-template.xlsx        real published Hudbay figures in template form
└── reports/
    └── <company>-analysis.md                written by the analyser
```

## The template

| Sheet | What goes in it |
| --- | --- |
| Instructions | How to fill it in |
| Company | Company name, month the reporting year ends, contact, who prepared and assured it |
| Sites | One row per operation: site, country, commodity, water_stress (low / medium / high / extremely-high), status |
| Data | One row per number: site, year, metric, value, unit, note. `_corporate` = company total |
| Metric list | The allowed metric keys, their units, and which ones are required |

Volumes can be in ML, m³, kL, thousand m³, Mm³ or GL, and are converted to megalitres. A figure that isn't available is left out, not entered as 0. When a past figure changes, the reason goes in the note column.

## Analysing a submission

**In the app (for the presentation):** open `/explore?view=submit`, then either upload the filled file(s) or click an example. Selecting two years of reports at once also checks for restatements. Nothing is stored.

Direct link with the sample already loaded: `http://localhost:3000/explore?view=submit&sample=andes`

**From the command line:**

```bash
npm run analyse-submission -- submissions/examples/andes-ridge-copper-2023.xlsx submissions/examples/andes-ridge-copper-2024.xlsx
```

This prints the report and saves it to `submissions/reports/`. Add `--add` to put the company into the main dataset, then run `npm run build-corpus`. Only do that for real data, never for the sample.

To regenerate the template and examples: `npm run make-submission-files`.

## The sample company (fictional)

**Andes Ridge Copper** is invented for demonstration: three copper sites, Cerro Blanco and Quebrada Seca in Chile and Laguna Verde in Peru, with a desalination plant from 2023. Its story: output grows, water grows faster, and almost all of it comes from water-stressed basins.

Four mistakes are planted on purpose so the checks have something to find:

| Planted mistake | What AquaTrace flags |
| --- | --- |
| Laguna Verde 2023 discharge typed in m³ but labelled ML | Probable unit error (×1,000), balance fails, sites don't add up |
| Cerro Blanco 2022 consumption understated by 30% | Water balance does not close |
| 2021 company total inflated by 9% | Sites do not add up to the total |
| 2024 report quietly raises Quebrada Seca's 2023 withdrawal by 12% | Restated between reports, with no explanation |

## Presentation talk track (3 minutes)

1. **"A new company reports."** Open *Analyse a submission* and show the three steps. "They fill one template, the same for every company."
2. **Load the sample.** Click *Sample: Andes Ridge Copper*. "Two annual reports, read in the browser and fingerprinted."
3. **The trend.** "Water is up 5.4% a year. If nothing changes it reaches about 160,000 ML by 2036, nearly double 2024. Water per tonne is getting worse too, so this isn't only growth."
4. **The risk.** "89% of its water comes from stressed basins, against a peer median of 11%. That is where caps and price rises hit first."
5. **The trust problem.** Scroll to *Figures to check*. "Seven figures would not survive an audit: a unit slip, a balance that doesn't close, a total that doesn't add up, and a 2023 figure changed in the 2024 report without saying why."
6. **The actions.** "AquaTrace turns that into a to-do list: fix the units, close the balance, explain the restatement, cap freshwater at stressed sites, raise reuse to the peer median."
7. **Real data.** Click *Hudbay Minerals*. "Same template, real published figures: an integrity score of 100 and falling withdrawal. Good data looks different."

The numbers in this script come from the current dataset. If the data is rebuilt they may shift slightly; the screen always shows the live values.
