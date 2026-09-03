import { describe, expect, it, vi } from "vitest";
import { historicalGroup, officialGroup } from "./checker-recommendation-rules";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    selectDistinct: vi.fn(),
  },
}));

vi.mock("./client", () => ({
  db: mockDb,
}));

import { db } from "./client";
import {
  buildCheckerRecommendations,
  getModeForYear,
  getOfficialCutoff,
  getVerifiedHistoryBeforeYear,
  listCandidateProgrammes,
  type CandidateProgramme,
  type CheckerRecommendationEngineContext,
  type CheckerRecommendationRequest,
  type CutoffWithSource,
  type OfficialCutoff,
  type ProgrammeChecks,
} from "./checker-recommendations";
import type { ZScoreEstimate } from "./estimate";

function mockChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const method of ["select", "selectDistinct", "from", "innerJoin", "leftJoin", "where", "orderBy", "limit"]) {
    chain[method] = vi.fn(self);
  }
  chain.then = (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve);
  return chain;
}

function queueChains(...chains: Array<Record<string, unknown>>) {
  const mock = db as unknown as { select: ReturnType<typeof vi.fn>; selectDistinct: ReturnType<typeof vi.fn> };
  for (const chain of chains) {
    mock.select.mockImplementationOnce(() => chain);
  }
}

function safeStringify(value: unknown): string {
  const seen = new WeakSet();
  return JSON.stringify(value, (_key, val) => {
    if (typeof val === "object" && val !== null) {
      if (seen.has(val)) return "[circular]";
      seen.add(val);
    }
    return val;
  });
}

describe("officialGroup", () => {
  it("groups official results by cutoff distance", () => {
    expect(officialGroup(1.7, 1.5)).toBe("strongMatches");
    expect(officialGroup(1.5, 1.5)).toBe("competitiveOptions");
    expect(officialGroup(1.42, 1.5)).toBe("nearHistoricalRange");
    expect(officialGroup(1.39, 1.5)).toBe("notEligible");
  });
});

const input = (overrides: Partial<CheckerRecommendationRequest> = {}): CheckerRecommendationRequest => ({
  academicYear: "2025/26",
  district: "Colombo",
  stream: "Physical Science",
  subjectGrades: {
    "Combined Mathematics": "A",
    Physics: "B",
    Chemistry: "C",
  },
  zscore: 1.65,
  ...overrides,
});

const programme = (overrides: Partial<CandidateProgramme> = {}): CandidateProgramme => ({
  id: 1,
  universityId: 10,
  universityName: "University of Moratuwa",
  degreeName: "B.Sc. (Hons) in Information Technology",
  faculty: "Faculty of Information Technology",
  durationYears: 4,
  stream: "Physical Science",
  medium: "English",
  availabilitySourceHandbookId: 100,
  availabilitySourcePage: 42,
  ...overrides,
});

const checks = (overrides: Partial<ProgrammeChecks> = {}): ProgrammeChecks => ({
  requirements: [
    {
      requirementType: "compulsory",
      groupKey: "default",
      subjectName: "Combined Mathematics",
      minimumGrade: "S",
    },
  ],
  rules: [],
  ...overrides,
});

function context(overrides: Partial<CheckerRecommendationEngineContext> = {}): CheckerRecommendationEngineContext {
  return {
    mode: "official",
    editionId: 500,
    candidates: [programme()],
    requirementsByProgramme: new Map([[1, checks()]]),
    getOfficialCutoff: async (): Promise<OfficialCutoff | null> => ({
      district: "Colombo",
      minimumZScore: 1.5,
      sourcePage: 77,
    }),
    getVerifiedHistoryBeforeYear: async (): Promise<CutoffWithSource[]> => [],
    getHandbookLabel: async () => "UGC Handbook 2025/26",
    persistEstimate: async () => undefined,
    ...overrides,
  };
}

describe("buildCheckerRecommendations", () => {
  it("returns official handbook results with grouped and top-level arrays", async () => {
    const response = await buildCheckerRecommendations(input(), context());

    expect(response.mode).toBe("official");
    expect(response.resultModeLabel).toBe("Official Handbook Based Result");
    expect(response.strongMatches).toBe(response.groups.strongMatches);
    expect(response.groups.strongMatches).toHaveLength(1);
    expect(response.groups.strongMatches[0]).toMatchObject({
      programmeId: 1,
      university: "University of Moratuwa",
      officialCutoff: 1.5,
      estimatedCenter: null,
      sourceHandbook: "UGC Handbook 2025/26",
      sourcePage: 77,
    });
  });

  it("evaluates all available programmes and returns stream failure reasons", async () => {
    const response = await buildCheckerRecommendations(
      input(),
      context({
        candidates: [programme({ id: 2, stream: "Biological Science" })],
        requirementsByProgramme: new Map([[2, checks()]]),
      }),
    );

    expect(response.groups.notEligible).toHaveLength(1);
    expect(response.groups.notEligible[0].reasons[0]).toContain("Requires Biological Science stream");
  });

  it("blocks missing verified subject requirements as insufficient verified data", async () => {
    const response = await buildCheckerRecommendations(
      input(),
      context({
        requirementsByProgramme: new Map([[1, checks({ requirements: [] })]]),
      }),
    );

    expect(response.message).toBe("Insufficient verified data");
    expect(response.groups.notEligible[0].reasons).toContain(
      "Insufficient verified data: no verified subject requirements found for this programme and academic year.",
    );
  });

  it("returns subject failure reasons before cutoff placement", async () => {
    const response = await buildCheckerRecommendations(
      input({ subjectGrades: { Physics: "A" } }),
      context(),
    );

    expect(response.groups.notEligible).toHaveLength(1);
    expect(response.groups.notEligible[0].reasons.join(" ")).toContain("Requires Combined Mathematics");
  });

  it("ignores unverified official cutoff rows by accepting only the verified cutoff selected by the data layer", async () => {
    const response = await buildCheckerRecommendations(
      input({ zscore: 1.55 }),
      context({
        getOfficialCutoff: async () => ({
          district: "Colombo",
          minimumZScore: 1.5,
          sourcePage: 77,
        }),
      }),
    );

    expect(response.groups.competitiveOptions).toHaveLength(1);
    expect(response.groups.notEligible).toHaveLength(0);
  });

  it("uses historical mode when official handbook data is unavailable and persists sufficient estimates", async () => {
    const persisted: Array<{ programmeId: number; estimate: ZScoreEstimate }> = [];
    const response = await buildCheckerRecommendations(
      input({ academicYear: "2026/27", zscore: 1.8 }),
      context({
        mode: "historical_estimate",
        editionId: null,
        getVerifiedHistoryBeforeYear: async () => [
          { academicYear: "2023/24", minimumZScore: 1.4, editionId: 1, sourcePage: 90 },
          { academicYear: "2024/25", minimumZScore: 1.5, editionId: 2, sourcePage: 91 },
        ],
        persistEstimate: async (programmeId, _district, _targetYear, estimate) => {
          persisted.push({ programmeId, estimate });
        },
      }),
    );

    expect(response.mode).toBe("historical_estimate");
    expect(response.resultModeLabel).toBe("Historical Estimate");
    expect(response.groups.strongMatches).toHaveLength(1);
    expect(response.groups.strongMatches[0].estimatedCenter).toBe(1.467);
    expect(persisted).toHaveLength(1);
    expect(persisted[0].programmeId).toBe(1);
    expect(persisted[0].estimate.hasSufficientData).toBe(true);
  });

  it("handles insufficient historical data without persisting an estimate", async () => {
    let persisted = false;
    const response = await buildCheckerRecommendations(
      input({ academicYear: "2026/27" }),
      context({
        mode: "historical_estimate",
        editionId: null,
        getVerifiedHistoryBeforeYear: async () => [
          { academicYear: "2024/25", minimumZScore: 1.5, editionId: 2, sourcePage: 91 },
        ],
        persistEstimate: async () => {
          persisted = true;
        },
      }),
    );

    expect(response.message).toBe("Insufficient historical data");
    expect(response.groups.notEligible[0].reasons.join(" ")).toContain("Insufficient historical data");
    expect(persisted).toBe(false);
  });

  it("keeps the same course in different universities separated by programme id", async () => {
    const response = await buildCheckerRecommendations(
      input({ zscore: 1.59 }),
      context({
        candidates: [
          programme({ id: 1, universityId: 10, universityName: "University A", degreeName: "Computer Science" }),
          programme({ id: 2, universityId: 11, universityName: "University B", degreeName: "Computer Science" }),
        ],
        requirementsByProgramme: new Map([[1, checks()], [2, checks()]]),
        getOfficialCutoff: async (programmeId) => ({
          district: "Colombo",
          minimumZScore: programmeId === 1 ? 1.5 : 1.75,
          sourcePage: programmeId,
        }),
      }),
    );

    expect(response.groups.competitiveOptions.map((result) => result.programmeId)).toEqual([1]);
    expect(response.groups.notEligible.map((result) => result.programmeId)).toEqual([2]);
  });

  it("sorts results by smallest absolute difference to the entered Z-score", async () => {
    const response = await buildCheckerRecommendations(
      input({ zscore: 1.6 }),
      context({
        candidates: [
          programme({ id: 1, degreeName: "Course Far Low" }),
          programme({ id: 2, degreeName: "Course Closest" }),
          programme({ id: 3, degreeName: "Course Medium" }),
          programme({ id: 4, degreeName: "Competitive Very Close" }),
          programme({ id: 5, degreeName: "Competitive Farther" }),
          programme({ id: 6, degreeName: "Competitive Middle" }),
        ],
        requirementsByProgramme: new Map([
          [1, checks()],
          [2, checks()],
          [3, checks()],
          [4, checks()],
          [5, checks()],
          [6, checks()],
        ]),
        getOfficialCutoff: async (programmeId) => {
          const cutoffs: Record<number, number> = {
            1: 1.2,  // diff = 0.40 (strongMatches)
            2: 1.48, // diff = 0.12 (strongMatches, closest)
            3: 1.35, // diff = 0.25 (strongMatches)
            4: 1.58, // diff = 0.02 (competitiveOptions, closest)
            5: 1.52, // diff = 0.08 (competitiveOptions)
            6: 1.55, // diff = 0.05 (competitiveOptions, middle)
          };
          return {
            district: "Colombo",
            minimumZScore: cutoffs[programmeId] ?? 1.5,
            sourcePage: programmeId,
          };
        },
      }),
    );

    const strong = response.groups.strongMatches;
    expect(strong.map((r) => r.programmeId)).toEqual([2, 3, 1]);

    const competitive = response.groups.competitiveOptions;
    expect(competitive.map((r) => r.programmeId)).toEqual([4, 6, 5]);
  });
});

describe("listCandidateProgrammes", () => {
  it("filters official-mode candidates by stream in the SQL query, not just in-memory", async () => {
    const chain = mockChain([]);
    const mock = db as unknown as { select: ReturnType<typeof vi.fn> };
    mock.select.mockImplementationOnce(() => chain);

    await listCandidateProgrammes("2025/26", "official", "Physical Science");

    const whereArg = (chain.where as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const serialized = safeStringify(whereArg);
    expect(serialized.toLowerCase()).toContain("lower");
    expect(serialized).toContain("Physical Science");
  });

  it("filters historical-mode candidates by stream in the SQL query, not just in-memory", async () => {
    const chain = mockChain([]);
    const mock = db as unknown as { selectDistinct: ReturnType<typeof vi.fn> };
    mock.selectDistinct.mockImplementationOnce(() => chain);

    await listCandidateProgrammes("2025/26", "historical_estimate", "Biological Science");

    const whereArg = (chain.where as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const serialized = safeStringify(whereArg);
    expect(serialized.toLowerCase()).toContain("lower");
    expect(serialized).toContain("Biological Science");
  });
});

describe("historicalGroup", () => {
  it("maps estimate labels to checker result groups", () => {
    expect(historicalGroup("strong_historical_position")).toBe("strongMatches");
    expect(historicalGroup("competitive_range")).toBe("competitiveOptions");
    expect(historicalGroup("near_range")).toBe("nearHistoricalRange");
    expect(historicalGroup("below_recent_range")).toBe("notEligible");
  });
});

describe("getModeForYear", () => {
  it("selects official mode when a handbook edition exists and the year is marked available", async () => {
    queueChains(mockChain([{ handbookAvailable: true }]), mockChain([{ id: 500 }]));

    const result = await getModeForYear("2025/26");

    expect(result).toEqual({ mode: "official", editionId: 500 });
  });

  it("selects historical mode when the academic year has no handbook available, even if an edition row exists", async () => {
    queueChains(mockChain([{ handbookAvailable: false }]), mockChain([{ id: 500 }]));

    const result = await getModeForYear("2026/27");

    expect(result).toEqual({ mode: "historical_estimate", editionId: null });
  });

  it("selects historical mode when no handbook edition row exists for the year", async () => {
    queueChains(mockChain([]), mockChain([]));

    const result = await getModeForYear("2027/28");

    expect(result).toEqual({ mode: "historical_estimate", editionId: null });
  });
});

describe("getOfficialCutoff", () => {
  it("prefers the district-specific verified cutoff over an All Island row", async () => {
    const chain = mockChain([
      { district: "All Island", minimumZScore: 1.4, sourcePage: 10 },
      { district: "Colombo", minimumZScore: 1.55, sourcePage: 11 },
    ]);
    queueChains(chain);

    const result = await getOfficialCutoff(1, 500, "Colombo");

    expect(result).toEqual({ district: "Colombo", minimumZScore: 1.55, sourcePage: 11 });
  });

  it("falls back to the All Island verified cutoff when no district row exists", async () => {
    const chain = mockChain([{ district: "All Island", minimumZScore: 1.4, sourcePage: 10 }]);
    queueChains(chain);

    const result = await getOfficialCutoff(1, 500, "Colombo");

    expect(result).toEqual({ district: "All Island", minimumZScore: 1.4, sourcePage: 10 });
  });

  it("returns null when no verified cutoff row exists for the district or All Island", async () => {
    queueChains(mockChain([]));

    const result = await getOfficialCutoff(1, 500, "Colombo");

    expect(result).toBeNull();
  });

  it("queries only verified cutoff statuses, excluding rejected/unverified rows", async () => {
    const chain = mockChain([{ district: "Colombo", minimumZScore: 1.55, sourcePage: 11 }]);
    queueChains(chain);

    await getOfficialCutoff(1, 500, "Colombo");

    const whereArg = (chain.where as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const serialized = safeStringify(whereArg);
    expect(serialized).toContain("legacy_verified");
    expect(serialized).toContain("verified");
    expect(serialized).not.toContain("rejected");
  });
});

describe("getVerifiedHistoryBeforeYear", () => {
  it("returns verified historical cutoffs in ascending academic-year order", async () => {
    const rows: CutoffWithSource[] = [
      { academicYear: "2022/23", minimumZScore: 1.4, editionId: 1, sourcePage: 20 },
      { academicYear: "2023/24", minimumZScore: 1.45, editionId: 2, sourcePage: 21 },
    ];
    queueChains(mockChain(rows));

    const result = await getVerifiedHistoryBeforeYear(1, "Colombo", "2024/25");

    expect(result).toEqual(rows);
  });

  it("queries only verified cutoff statuses, excluding rejected/unverified rows", async () => {
    const chain = mockChain([]);
    queueChains(chain);

    await getVerifiedHistoryBeforeYear(1, "Colombo", "2024/25");

    const whereArg = (chain.where as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const serialized = safeStringify(whereArg);
    expect(serialized).toContain("legacy_verified");
    expect(serialized).toContain("verified");
    expect(serialized).not.toContain("rejected");
  });
});
