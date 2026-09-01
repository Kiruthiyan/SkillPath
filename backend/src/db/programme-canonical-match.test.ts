import { describe, expect, it } from "vitest";
import {
  classifyUniversityName,
  findHighConfidenceProgrammeMatch,
  type ProgrammeMatchCandidate,
} from "./programme-canonical-match";

const baseCandidate = (degreeName: string, programmeId = 1): ProgrammeMatchCandidate => ({
  programmeId,
  universityId: 10,
  academicYear: "2024/25",
  degreeName,
});

describe("findHighConfidenceProgrammeMatch", () => {
  it("matches BSc degree prefixes safely", () => {
    const result = findHighConfidenceProgrammeMatch("Information Technology", [
      baseCandidate("BSc (Hons) in Information Technology"),
    ]);

    expect(result.status).toBe("high_confidence");
    expect(result.suggestion?.programmeId).toBe(1);
  });

  it("matches B.Sc degree prefixes safely", () => {
    const result = findHighConfidenceProgrammeMatch("Information Technology", [
      baseCandidate("B.Sc. (Hons) in Information Technology"),
    ]);

    expect(result.status).toBe("high_confidence");
    expect(result.suggestion?.programmeId).toBe(1);
  });

  it("matches Bachelor of Science prefixes and Honours variants", () => {
    const result = findHighConfidenceProgrammeMatch("Statistics", [
      baseCandidate("Bachelor of Science Honours Degree in Statistics"),
    ]);

    expect(result.status).toBe("high_confidence");
  });

  it("handles bracket abbreviations", () => {
    const result = findHighConfidenceProgrammeMatch("Teaching English as a Second Language (TESL)", [
      baseCandidate("Teaching English as Second Language"),
    ]);

    expect(result.status).toBe("high_confidence");
  });

  it("handles trusted candidate abbreviations in bracket content", () => {
    const result = findHighConfidenceProgrammeMatch("Teaching English as a Second Language (TESL)", [
      baseCandidate("Bachelor of Arts Honours in TESL"),
    ]);

    expect(result.status).toBe("high_confidence");
  });

  it("handles common Sri Lankan abbreviation variants", () => {
    const result = findHighConfidenceProgrammeMatch("Biosystems Technology (BST)", [
      baseCandidate("B.Tech. (Hons) in Biosystems Technology"),
    ]);

    expect(result.status).toBe("high_confidence");
  });

  it("normalizes and versus ampersand", () => {
    const result = findHighConfidenceProgrammeMatch("Computing and Information Systems", [
      baseCandidate("Computing & Information Systems"),
    ]);

    expect(result.status).toBe("high_confidence");
  });

  it("normalizes hyphen punctuation spacing differences", () => {
    const result = findHighConfidenceProgrammeMatch("Marine and Freshwater Sciences", [
      baseCandidate("Marine and Fresh Water Sciences"),
    ]);

    expect(result.status).toBe("high_confidence");
  });

  it("keeps unique partial matches as medium-confidence review candidates", () => {
    const result = findHighConfidenceProgrammeMatch("Technology Management", [
      baseCandidate("Food Production & Technology Management"),
    ]);

    expect(result.status).toBe("medium_confidence");
    expect(result.suggestion?.confidence).toBeLessThan(90);
  });

  it("rejects generic ambiguous aliases", () => {
    const result = findHighConfidenceProgrammeMatch("Management", [
      baseCandidate("Food Business Management", 1),
      baseCandidate("Tourism & Hospitality Management", 2),
    ]);

    expect(result.status).toBe("low_confidence");
    expect(result.suggestion).toBeNull();
  });

  it("rejects generic multi-word aliases", () => {
    const result = findHighConfidenceProgrammeMatch("Physical Science", [
      baseCandidate("Physical Science", 1),
    ]);

    expect(result.status).toBe("low_confidence");
    expect(result.suggestion).toBeNull();
  });

  it("reports duplicate high-confidence candidates", () => {
    const result = findHighConfidenceProgrammeMatch("Business Information Systems", [
      baseCandidate("Business Information Systems (Honours) (BIS)", 1),
      baseCandidate("B.Sc. (Hons) in Business Information Systems", 2),
    ]);

    expect(result.status).toBe("duplicate_alias_candidate");
    expect(result.suggestion).toBeNull();
  });
});

describe("classifyUniversityName", () => {
  it("detects university aliases without auto-applying them", () => {
    expect(
      classifyUniversityName("University of Jayewardenepura", [
        "University of Sri Jayewardenepura",
      ]),
    ).toEqual({
      status: "alias_candidate",
      matchedName: "University of Sri Jayewardenepura",
    });
  });
});
