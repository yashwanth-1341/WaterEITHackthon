import { balanceOf, freshwaterPerKoz, sumMatrix } from "@/lib/metrics";
import type { Site } from "@/lib/types";

// Indicative mapping of data points to reporting and due-diligence frameworks.
// ESRS E3 applies via CSRD; CRMA and the Battery Regulation push water
// transparency to non-EU suppliers through due diligence. Scope and timelines
// of CSRD/CSDDD/Battery Regulation were being revised (2025 Omnibus), so
// check the current legal status before relying on this mapping.

export type Status = "met" | "partial" | "missing";

export interface ReadinessItem {
  id: string;
  label: string;
  frameworks: string[];
  check: (s: Site, tolerancePct: number) => { status: Status; why: string };
}

const hasMatrix = (m: Site["withdrawal"]) => m !== null;

export const READINESS_ITEMS: ReadinessItem[] = [
  {
    id: "withdrawal-source",
    label: "Withdrawal by source",
    frameworks: ["ICMM 1.2a", "GRI 303-3"],
    check: (s) =>
      !hasMatrix(s.withdrawal)
        ? { status: "missing", why: "No withdrawal table." }
        : sumMatrix(s.withdrawal) === null
          ? { status: "partial", why: "Some sources are unknown." }
          : { status: "met", why: "All four source types reported." },
  },
  {
    id: "withdrawal-quality",
    label: "Withdrawal by quality (high/low)",
    frameworks: ["ICMM 1.2a"],
    check: (s) =>
      !hasMatrix(s.withdrawal)
        ? { status: "missing", why: "No withdrawal table." }
        : { status: "partial", why: "Mapped from WAF categories; confirm against ICMM 2021 definitions." },
  },
  {
    id: "omw",
    label: "Other managed water",
    frameworks: ["ICMM 1.2b"],
    check: (s) => (s.omwWithdrawal ? { status: "met", why: "Reported." } : { status: "missing", why: "Not in the source data." }),
  },
  {
    id: "discharge",
    label: "Discharge by destination and quality",
    frameworks: ["ICMM 1.2c", "GRI 303-4"],
    check: (s) =>
      !s.discharge
        ? { status: "missing", why: "No discharge table." }
        : s.unknownFields.some((f) => f.startsWith("discharge."))
          ? { status: "partial", why: "At least one destination is disclosed as unknown." }
          : { status: "met", why: "All destinations reported." },
  },
  {
    id: "consumption",
    label: "Total consumption",
    frameworks: ["ICMM 1.2d", "GRI 303-5", "ESRS E3-4"],
    check: (s) => (s.consumption !== null ? { status: "met", why: "Reported." } : { status: "missing", why: "Not disclosed." }),
  },
  {
    id: "consumption-stress",
    label: "Consumption in water-stressed areas",
    frameworks: ["ICMM 1.3", "ESRS E3-4"],
    check: (s) =>
      s.consumption === null
        ? { status: "missing", why: "No consumption figure." }
        : s.stressSource === "aqueduct" || s.stressSource === "reported"
          ? { status: "met", why: "Consumption and a sourced stress level." }
          : { status: "partial", why: "Stress level is an assumption." },
  },
  {
    id: "reuse",
    label: "Recycled and reused water",
    frameworks: ["ICMM 3.6", "ESRS E3-4"],
    check: (s) => (s.reuse !== null ? { status: "met", why: "Reported." } : { status: "missing", why: "Not disclosed." }),
  },
  {
    id: "storage",
    label: "Change in storage",
    frameworks: ["ICMM (recommended)", "ESRS E3-4"],
    check: (s) =>
      s.deltaStorage !== null
        ? { status: "met", why: "Reported." }
        : s.unknownFields.includes("deltaStorage")
          ? { status: "partial", why: "Disclosed as unknown." }
          : { status: "missing", why: "Not disclosed." },
  },
  {
    id: "intensity",
    label: "Water intensity",
    frameworks: ["ESRS E3-4 (m³ per € revenue)"],
    check: (s) =>
      freshwaterPerKoz(s) !== null
        ? { status: "partial", why: "Per-unit-of-metal intensity is computable; revenue-based intensity is not (no site revenue)." }
        : { status: "missing", why: "No production or withdrawal data." },
  },
  {
    id: "stress-assessment",
    label: "Site water-stress assessment",
    frameworks: ["ICMM 2.6", "CRMA / due diligence"],
    check: (s) =>
      s.stressSource === "aqueduct" || s.stressSource === "reported"
        ? { status: "met", why: "Sourced assessment." }
        : s.stressSource === "assumed"
          ? { status: "partial", why: "Assumed, not assessed." }
          : { status: "missing", why: "No assessment." },
  },
  {
    id: "method",
    label: "Measurement method disclosed",
    frameworks: ["Assurance", "Battery Reg. due diligence"],
    check: (s) => (s.method !== "not-disclosed" ? { status: "met", why: `Values are ${s.method}.` } : { status: "missing", why: "Not stated." }),
  },
  {
    id: "balance",
    label: "Water balance closes",
    frameworks: ["Data integrity"],
    check: (s, tol) => {
      const b = balanceOf(s, tol);
      if (b.status === "closes") {
        return s.unknownFields.some((f) => f.startsWith("discharge."))
          ? { status: "partial", why: "Closes, but relies on an unknown discharge." }
          : { status: "met", why: `Within ${tol}%.` };
      }
      if (b.status === "unverifiable") return { status: "missing", why: "Not enough data to check." };
      return { status: "missing", why: `Off by ${Math.abs(b.gapPct!).toFixed(1)}%.` };
    },
  },
];

export function readinessScore(s: Site, tol: number) {
  const results = READINESS_ITEMS.map((i) => ({ item: i, ...i.check(s, tol) }));
  const points = results.reduce((a, r) => a + (r.status === "met" ? 1 : r.status === "partial" ? 0.5 : 0), 0);
  return { results, score: Math.round((points / READINESS_ITEMS.length) * 100) };
}
