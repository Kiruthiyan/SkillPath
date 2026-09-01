import { describe, it, expect } from "vitest";
import { computeZScoreEstimate } from "./estimate";

describe("computeZScoreEstimate", () => {
  it("returns no estimate when fewer than 2 years of history exist", () => {
    const result = computeZScoreEstimate([{ academicYear: "2024/25", minimumZScore: 1.9 }]);
    expect(result.hasSufficientData).toBe(false);
    expect(result.weightedEstimate).toBeNull();
    expect(result.rangeLow).toBeNull();
    expect(result.rangeHigh).toBeNull();
    expect(result.confidence).toBe("Low");
    expect(result.statusLabel).toBeNull();
  });

  it("returns no estimate for empty history", () => {
    const result = computeZScoreEstimate([]);
    expect(result.hasSufficientData).toBe(false);
    expect(result.historicalCutoffs).toEqual([]);
  });

  it("computes a linearly recency-weighted estimate over up to 4 years", () => {
    const history = [
      { academicYear: "2021/22", minimumZScore: 2.1 },
      { academicYear: "2022/23", minimumZScore: 2.2 },
      { academicYear: "2023/24", minimumZScore: 2.3 },
      { academicYear: "2024/25", minimumZScore: 2.5 },
    ];
    // weights [1,2,3,4] oldest->newest, sum=10
    // (2.1*1 + 2.2*2 + 2.3*3 + 2.5*4) / 10 = (2.1+4.4+6.9+10)/10 = 23.4/10 = 2.34
    const result = computeZScoreEstimate(history);
    expect(result.hasSufficientData).toBe(true);
    expect(result.weightedEstimate).toBeCloseTo(2.34, 3);
    expect(result.yearsUsed).toBe(4);
    expect(result.confidence).toBe("High");
  });

  it("only uses the most recent 4 years when more are available", () => {
    const history = [
      { academicYear: "2019/20", minimumZScore: 99 },
      { academicYear: "2021/22", minimumZScore: 2.1 },
      { academicYear: "2022/23", minimumZScore: 2.2 },
      { academicYear: "2023/24", minimumZScore: 2.3 },
      { academicYear: "2024/25", minimumZScore: 2.5 },
    ];
    const result = computeZScoreEstimate(history);
    expect(result.yearsUsed).toBe(4);
    expect(result.weightedEstimate).toBeCloseTo(2.34, 3);
    // full history still returned for display purposes
    expect(result.historicalCutoffs).toHaveLength(5);
  });

  it("applies a floor to the range band when all years are identical", () => {
    const history = [
      { academicYear: "2023/24", minimumZScore: 2.0 },
      { academicYear: "2024/25", minimumZScore: 2.0 },
    ];
    const result = computeZScoreEstimate(history);
    expect(result.weightedEstimate).toBeCloseTo(2.0, 3);
    expect(result.rangeLow).toBeCloseTo(1.98, 3);
    expect(result.rangeHigh).toBeCloseTo(2.02, 3);
  });

  it("labels strong_historical_position when zscore comfortably exceeds the latest cutoff", () => {
    const history = [
      { academicYear: "2023/24", minimumZScore: 2.0 },
      { academicYear: "2024/25", minimumZScore: 2.1 },
    ];
    const result = computeZScoreEstimate(history, 2.25);
    expect(result.statusLabel).toBe("strong_historical_position");
  });

  it("labels competitive_range when zscore is within the band but below the strong margin", () => {
    const history = [
      { academicYear: "2023/24", minimumZScore: 2.0 },
      { academicYear: "2024/25", minimumZScore: 2.1 },
    ];
    // weighted = (2.0*1+2.1*2)/3 = 6.2/3 = 2.0667, spread=0.1, band=[2.0167,2.1167]
    const result = computeZScoreEstimate(history, 2.05);
    expect(result.statusLabel).toBe("competitive_range");
    expect(result.confidence).toBe("Medium");
  });

  it("labels near_range when zscore is just below the range band", () => {
    const history = [
      { academicYear: "2023/24", minimumZScore: 2.0 },
      { academicYear: "2024/25", minimumZScore: 2.1 },
    ];
    // rangeLow ~= 2.0167; near_range is [rangeLow-0.1, rangeLow)
    const result = computeZScoreEstimate(history, 1.95);
    expect(result.statusLabel).toBe("near_range");
  });

  it("labels below_recent_range when zscore is well below the range band", () => {
    const history = [
      { academicYear: "2023/24", minimumZScore: 2.0 },
      { academicYear: "2024/25", minimumZScore: 2.1 },
    ];
    const result = computeZScoreEstimate(history, 1.5);
    expect(result.statusLabel).toBe("below_recent_range");
  });

  it("returns null statusLabel when no student zscore is provided", () => {
    const history = [
      { academicYear: "2023/24", minimumZScore: 2.0 },
      { academicYear: "2024/25", minimumZScore: 2.1 },
    ];
    const result = computeZScoreEstimate(history);
    expect(result.statusLabel).toBeNull();
  });
});
