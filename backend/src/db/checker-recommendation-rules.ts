import type { EstimateStatusLabel } from "./estimate";

export type CheckerResultGroup =
  | "strongMatches"
  | "competitiveOptions"
  | "nearHistoricalRange"
  | "notEligible";

const STRONG_OFFICIAL_MARGIN = 0.1;
const NEAR_OFFICIAL_MARGIN = 0.1;

export function officialGroup(studentZScore: number, officialCutoff: number): CheckerResultGroup {
  if (studentZScore >= officialCutoff + STRONG_OFFICIAL_MARGIN) return "strongMatches";
  if (studentZScore >= officialCutoff) return "competitiveOptions";
  if (studentZScore >= officialCutoff - NEAR_OFFICIAL_MARGIN) return "nearHistoricalRange";
  return "notEligible";
}

export function historicalGroup(statusLabel: EstimateStatusLabel | null): CheckerResultGroup {
  if (statusLabel === "strong_historical_position") return "strongMatches";
  if (statusLabel === "competitive_range") return "competitiveOptions";
  if (statusLabel === "near_range") return "nearHistoricalRange";
  return "notEligible";
}
