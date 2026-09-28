import type { Corpus } from "./types";
import type { CompanyProfile } from "./indicators";
import { INDICATORS } from "./indicators";
import type { Signal } from "./integrity";
import { figureCounts, integrityScore } from "./integrity";
import { HORIZONS } from "./trends";

const r = (n: number | null | undefined, d = 1) => (n === null || n === undefined ? null : Math.round(n * 10 ** d) / 10 ** d);

/** Compact multi-company summary for the model: indicators, trends, projections, integrity. */
export function buildCorpusContext(args: { corpus: Corpus; profiles: CompanyProfile[]; signals: Signal[]; company: string | null }) {
  const { corpus, profiles, signals, company } = args;
  const focus = company ? profiles.filter((p) => p.company === company) : profiles;
  const counts = figureCounts(corpus);
  return {
    scope: company ? `Focus: ${company}` : `${profiles.length} mining companies`,
    units: "Volumes in ML (megalitres). Intensity in m3 per tonne of ore. Shares in %.",
    horizons: HORIZONS.map((h) => `${h.label} = ${h.year}`),
    projectionMethod: "Log-linear least squares on disclosed years (linear for %), extrapolated. 'If nothing changes', not a forecast.",
    companies: focus.map((p) => ({
      company: p.company,
      sites: p.sites,
      countries: p.countries,
      commodities: p.commodities,
      yearsDisclosed: p.years,
      siteLevelData: p.siteLevel,
      coreDisclosurePct: Math.round(p.disclosure * 100),
      integrityScore: integrityScore(signals, p.company, counts.get(p.company) ?? 0).score,
      indicators: Object.fromEntries(
        INDICATORS.filter((i) => p.series[i.id]).map((i) => {
          const t = p.trends[i.id];
          return [
            i.id,
            {
              history: p.series[i.id]!.map((pt) => [pt.year, r(pt.value, 2)]),
              annualChange: t ? (i.pct ? `${r(t.annualChange * 100)} pts/yr` : `${r(t.annualChange * 100)}%/yr`) : null,
              confidence: t?.confidence ?? null,
              projection: t ? Object.fromEntries(HORIZONS.map((h) => [h.year, r(t.project(h.year).mid, 2)])) : null,
            },
          ];
        }),
      ),
    })),
    integritySignals: signals
      .filter((s) => !company || s.company === company)
      .filter((s) => s.severity !== "low")
      .slice(0, 60)
      .map((s) => ({ severity: s.severity, kind: s.kind, company: s.company, site: s.site, year: s.year, title: s.title })),
    reportObservations: corpus.observations
      .filter((o) => !company || o.company === company)
      .slice(0, company ? 40 : 80)
      .map((o) => `${o.company}: ${o.text.slice(0, 300)}`),
  };
}
