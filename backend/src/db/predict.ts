export type PredictionConfidence = "high" | "medium" | "low";
export type EligibilityTier = "likely" | "borderline" | "reach" | "unlikely";
export type YearMode = "official" | "predicted";

export interface CutoffHistoryPoint {
  academicYear: string;
  minimumZScore: number;
}

export interface CutoffPrediction {
  officialCutoff: number | null;
  officialAcademicYear: string | null;
  predictedCutoff: number | null;
  predictedAcademicYear: string | null;
  confidence: PredictionConfidence;
  dataSource: "official" | "predicted" | "trend";
  yearOverYearDeltas: number[];
}

export function nextAcademicYear(current: string): string {
  const match = current.match(/^(\d{4})\/(\d{2})$/);
  if (!match) return current;
  const start = parseInt(match[1], 10);
  const end = parseInt(match[2], 10);
  return `${start + 1}/${String(end + 1).padStart(2, "0")}`;
}

export function predictCutoff(
  history: CutoffHistoryPoint[],
  targetYear?: string,
): CutoffPrediction {
  const sorted = [...history].sort((a, b) =>
    a.academicYear.localeCompare(b.academicYear),
  );

  if (sorted.length === 0) {
    return {
      officialCutoff: null,
      officialAcademicYear: null,
      predictedCutoff: null,
      predictedAcademicYear: targetYear ?? null,
      confidence: "low",
      dataSource: "official",
      yearOverYearDeltas: [],
    };
  }

  const latest = sorted[sorted.length - 1];
  const predictedAcademicYear =
    targetYear ?? nextAcademicYear(latest.academicYear);

  if (sorted.length === 1) {
    return {
      officialCutoff: latest.minimumZScore,
      officialAcademicYear: latest.academicYear,
      predictedCutoff: latest.minimumZScore,
      predictedAcademicYear,
      confidence: "low",
      dataSource: "official",
      yearOverYearDeltas: [],
    };
  }

  const deltas: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    deltas.push(
      sorted[i].minimumZScore - sorted[i - 1].minimumZScore,
    );
  }

  const avgDelta = deltas.reduce((s, d) => s + d, 0) / deltas.length;
  const predictedCutoff = Math.round((latest.minimumZScore + avgDelta) * 1000) / 1000;

  let confidence: PredictionConfidence = "high";
  if (sorted.length === 2) confidence = "medium";
  if (sorted.length < 2) confidence = "low";

  return {
    officialCutoff: latest.minimumZScore,
    officialAcademicYear: latest.academicYear,
    predictedCutoff,
    predictedAcademicYear,
    confidence,
    dataSource: "trend",
    yearOverYearDeltas: deltas,
  };
}

export function eligibilityTier(
  studentZScore: number,
  cutoff: number,
): EligibilityTier {
  if (studentZScore >= cutoff + 0.05) return "likely";
  if (studentZScore >= cutoff - 0.05) return "borderline";
  if (studentZScore >= cutoff - 0.15) return "reach";
  return "unlikely";
}

export function effectiveCutoff(
  prediction: CutoffPrediction,
  yearMode: YearMode,
): number | null {
  if (yearMode === "official") {
    return prediction.officialCutoff;
  }
  return prediction.predictedCutoff ?? prediction.officialCutoff;
}
