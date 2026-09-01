export type EstimateStatusLabel =
  | "strong_historical_position"
  | "competitive_range"
  | "near_range"
  | "below_recent_range";

export interface HistoricalCutoffPoint {
  academicYear: string;
  minimumZScore: number;
}

export interface ZScoreEstimate {
  hasSufficientData: boolean;
  historicalCutoffs: HistoricalCutoffPoint[];
  weightedEstimate: number | null;
  rangeLow: number | null;
  rangeHigh: number | null;
  confidence: "High" | "Medium" | "Low";
  yearsUsed: number;
  statusLabel: EstimateStatusLabel | null;
}

const ESTIMATE_WINDOW_YEARS = 4;
const MIN_YEARS_REQUIRED = 2;
const RANGE_FLOOR = 0.02;
const STRONG_POSITION_MARGIN = 0.1;
const NEAR_RANGE_MARGIN = 0.1;

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Simple recent-year weighted historical estimate + variation range.
 * NOT a statistical prediction — linear recency weighting over up to the
 * last 4 years, band width from the min/max spread of that window.
 * Returns no estimate at all when fewer than 2 years of history exist.
 */
export function computeZScoreEstimate(
  history: HistoricalCutoffPoint[],
  studentZScore?: number,
): ZScoreEstimate {
  const sorted = [...history].sort((a, b) =>
    a.academicYear.localeCompare(b.academicYear),
  );

  const window = sorted.slice(-ESTIMATE_WINDOW_YEARS);

  if (window.length < MIN_YEARS_REQUIRED) {
    return {
      hasSufficientData: false,
      historicalCutoffs: sorted,
      weightedEstimate: null,
      rangeLow: null,
      rangeHigh: null,
      confidence: "Low",
      yearsUsed: window.length,
      statusLabel: null,
    };
  }

  const weights = window.map((_, i) => i + 1);
  const weightSum = weights.reduce((s, w) => s + w, 0);
  const weightedSum = window.reduce(
    (s, point, i) => s + point.minimumZScore * weights[i],
    0,
  );
  const weightedEstimate = round3(weightedSum / weightSum);

  const zscores = window.map((p) => p.minimumZScore);
  const spread = Math.max(...zscores) - Math.min(...zscores);
  const halfBand = Math.max(spread / 2, RANGE_FLOOR);
  const rangeLow = round3(weightedEstimate - halfBand);
  const rangeHigh = round3(weightedEstimate + halfBand);

  const latestCutoff = window[window.length - 1].minimumZScore;
  const confidence = window.length >= 4 ? "High" : window.length >= 2 ? "Medium" : "Low";

  let statusLabel: EstimateStatusLabel | null = null;
  if (studentZScore != null && !Number.isNaN(studentZScore)) {
    if (studentZScore >= latestCutoff + STRONG_POSITION_MARGIN) {
      statusLabel = "strong_historical_position";
    } else if (studentZScore >= rangeLow) {
      statusLabel = "competitive_range";
    } else if (studentZScore >= rangeLow - NEAR_RANGE_MARGIN) {
      statusLabel = "near_range";
    } else {
      statusLabel = "below_recent_range";
    }
  }

  return {
    hasSufficientData: true,
    historicalCutoffs: sorted,
    weightedEstimate,
    rangeLow,
    rangeHigh,
    confidence,
    yearsUsed: window.length,
    statusLabel,
  };
}
