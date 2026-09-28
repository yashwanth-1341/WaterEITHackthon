import { balanceOf, freshwaterPerKoz, median } from "@/lib/metrics";
import type { Dataset } from "@/lib/types";

export type Severity = "fail" | "warn" | "info";

export interface Flag {
  id: string;
  siteId: string | null;
  severity: Severity;
  title: string;
  detail: string;
  reference?: string;
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

const FIELD_LABEL: Record<string, string> = {
  consumption: "total consumption",
  reuse: "recycled and reused water",
  deltaStorage: "change in on-site storage",
};

function fieldLabel(f: string) {
  if (FIELD_LABEL[f]) return FIELD_LABEL[f];
  const [metric, src, q] = f.split(".");
  const srcLabel = { surface: "surface water", ground: "groundwater", sea: "seawater", thirdParty: "third-party water" }[src] ?? src;
  return `${q}-quality ${srcLabel} ${metric}`;
}

export function validate(ds: Dataset, tolerancePct: number): Flag[] {
  const flags: Flag[] = [];

  if (ds.framework === "legacy-waf") {
    flags.push({
      id: "legacy-framework",
      siteId: null,
      severity: "info",
      title: "Reported on the older WAF Category 1/2/3 scheme",
      detail:
        "Volumes were mapped to ICMM 2021 high/low quality on import. The legacy scheme has no separate Other Managed Water (OMW) figure, so OMW cannot be reported.",
      reference: "ICMM 2021, section 2.4",
    });
  }

  const hist = ds.history.filter((h) => h.total !== null);
  if (hist.some((h) => h.lowQuality === null) && hist.some((h) => h.lowQuality !== null)) {
    const p = hist.find((h) => h.lowQuality === null)!;
    flags.push({
      id: "history-definition-change",
      siteId: null,
      severity: "warn",
      title: `${p.period} is not comparable with later years`,
      detail: `${p.period} reports all withdrawal as high quality with no low-quality split, so the apparent drop in freshwater use afterwards is partly a change of definition, not a change on site.`,
      reference: "GRI 303-3",
    });
  }

  const intensities = ds.sites.map(freshwaterPerKoz).filter((x): x is number => x !== null);
  const med = median(intensities);

  for (const s of ds.sites) {
    const b = balanceOf(s, tolerancePct);

    if (b.status === "gap" || b.status === "over") {
      flags.push({
        id: `balance-${s.id}`,
        siteId: s.id,
        severity: "fail",
        title: b.status === "gap" ? `${s.name}: ${fmt(b.gap!)} ML of water is unaccounted for` : `${s.name}: ${fmt(-b.gap!)} ML more water reported out than in`,
        detail: `Withdrawal of ${fmt(b.withdrawal!)} ML should equal discharge (${fmt(b.discharge!)}) + consumption (${fmt(b.consumption!)}) + change in storage (${fmt(b.deltaStorage ?? 0)}). The difference is ${Math.abs(b.gapPct!).toFixed(1)}%, above the ${tolerancePct}% tolerance.`,
        reference: "ICMM 2021, Figure 1 site water balance",
      });
    } else if (b.status === "unverifiable") {
      flags.push({
        id: `balance-unverifiable-${s.id}`,
        siteId: s.id,
        severity: "warn",
        title: `${s.name}: water balance cannot be checked`,
        detail: `Missing: ${b.missing.filter((m) => !m.startsWith("change in storage")).join(", ")}.`,
        reference: "ICMM 2021, Table 4",
      });
    }

    const unknownDischarge = s.unknownFields.filter((f) => f.startsWith("discharge."));
    if (b.status === "closes" && unknownDischarge.length) {
      flags.push({
        id: `closes-with-unknown-${s.id}`,
        siteId: s.id,
        severity: "warn",
        title: `${s.name}: balance closes only because a discharge is unknown`,
        detail: `${unknownDischarge.map(fieldLabel).join(", ")} is disclosed as unknown. Consumption appears to be calculated as withdrawal minus known discharge, so any water returned through that route is counted as consumed. Consumption may be overstated.`,
        reference: "ICMM 2021, section 2.4.5",
      });
    }

    for (const f of s.unknownFields) {
      flags.push({
        id: `unknown-${s.id}-${f}`,
        siteId: s.id,
        severity: "warn",
        title: `${s.name}: ${fieldLabel(f)} disclosed as unknown`,
        detail: "The site reports that this flow exists but does not quantify it. Metering or a modelled estimate is needed.",
      });
    }

    const missingBlocks: string[] = [];
    if (!s.withdrawal) missingBlocks.push("withdrawal");
    if (!s.discharge) missingBlocks.push("discharge");
    if (s.consumption === null && !s.unknownFields.includes("consumption")) missingBlocks.push("consumption");
    if (s.reuse === null && !s.unknownFields.includes("reuse")) missingBlocks.push("recycled and reused water");
    if (missingBlocks.length) {
      flags.push({
        id: `missing-${s.id}`,
        siteId: s.id,
        severity: "fail",
        title: `${s.name}: ${missingBlocks.join(", ")} not disclosed`,
        detail: "These are ICMM minimum reporting metrics. Without them the site cannot be compared or included in basin-level accounting.",
        reference: "ICMM 2021, Table 1 (1.2, 3.6)",
      });
    }

    if (s.deltaStorage === null && !s.unknownFields.includes("deltaStorage")) {
      flags.push({
        id: `storage-${s.id}`,
        siteId: s.id,
        severity: "info",
        title: `${s.name}: change in storage not reported`,
        detail: "Recommended by ICMM and required by ESRS E3. Treated as zero in the balance check.",
        reference: "ICMM 2021, Table 4; ESRS E3-4",
      });
    }

    if (!s.omwWithdrawal) {
      flags.push({
        id: `omw-${s.id}`,
        siteId: s.id,
        severity: "info",
        title: `${s.name}: no Other Managed Water figure`,
        detail: "ICMM 2021 asks for water that is actively managed without being used (for example dewatering pumped away) to be reported separately.",
        reference: "ICMM 2021, Table 1 (1.2b)",
      });
    }

    if (s.stressSource === "assumed" || s.stressSource === "unknown") {
      flags.push({
        id: `stress-${s.id}`,
        siteId: s.id,
        severity: "warn",
        title: `${s.name}: water-stress level is ${s.stressSource === "assumed" ? "an assumption" : "unknown"}`,
        detail: "The source file does not state whether the site is in a water-stressed area. Replace with a WRI Aqueduct baseline water stress value at the site coordinates.",
        reference: "ICMM 2021, Box 2 and Table 1 (2.6)",
      });
    }

    if (s.method === "not-disclosed") {
      flags.push({
        id: `method-${s.id}`,
        siteId: s.id,
        severity: "info",
        title: `${s.name}: measurement method not stated`,
        detail: "Buyers and auditors cannot tell whether volumes are metered, estimated or modelled.",
      });
    }

    const k = freshwaterPerKoz(s);
    if (k !== null && med !== null && intensities.length >= 3 && k > med * 2) {
      flags.push({
        id: `intensity-${s.id}`,
        siteId: s.id,
        severity: "warn",
        title: `${s.name}: freshwater intensity is ${(k / med).toFixed(1)}× the portfolio median`,
        detail: `${fmt(k)} ML of high-quality water per 1,000 oz gold-equivalent against a median of ${fmt(med)}. Worth explaining in the narrative (process route, climate, or a data issue).`,
      });
    }
  }

  const order: Record<Severity, number> = { fail: 0, warn: 1, info: 2 };
  return flags.sort((a, b) => order[a.severity] - order[b.severity]);
}
