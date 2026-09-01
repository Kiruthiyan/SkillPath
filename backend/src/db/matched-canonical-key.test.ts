import { describe, it, expect } from "vitest";
import { computeMatchedCanonicalKey } from "./matched-canonical-key";

describe("computeMatchedCanonicalKey", () => {
  it("groups the same row across languages when a Latin-script degree abbreviation is present", () => {
    const en = computeMatchedCanonicalKey({
      academicYear: "2024/25",
      university: "University of Moratuwa",
      stream: "Physical Science",
      degreeName: "B.Sc. Engineering",
      district: "Colombo",
    });
    const ta = computeMatchedCanonicalKey({
      academicYear: "2024/25",
      university: "University of Moratuwa",
      stream: "Physical Science",
      degreeName: "பொறியியல் B.Sc.",
      district: "Colombo",
    });
    expect(en).toBe(ta);
  });

  it("is case/whitespace insensitive", () => {
    const a = computeMatchedCanonicalKey({
      academicYear: "2024/25",
      university: "University of Moratuwa",
      stream: "Physical Science",
      degreeName: "BSc Engineering",
      district: "Colombo",
    });
    const b = computeMatchedCanonicalKey({
      academicYear: "2024/25",
      university: "  university of moratuwa  ",
      stream: "physical science",
      degreeName: "bsc engineering",
      district: "colombo",
    });
    expect(a).toBe(b);
  });

  it("falls back to a z-score-based key when no degree abbreviation is resolvable", () => {
    const en = computeMatchedCanonicalKey({
      academicYear: "2024/25",
      university: "University of Peradeniya",
      stream: "Arts",
      degreeName: "Some Degree",
      district: "Kandy",
      minimumZScore: 1.234,
    });
    const si = computeMatchedCanonicalKey({
      academicYear: "2024/25",
      university: "University of Peradeniya",
      stream: "Arts",
      degreeName: "වෙනත් උපාධියක්",
      district: "Kandy",
      minimumZScore: 1.234,
    });
    expect(en).toBe(si);
  });

  it("produces different keys for different districts", () => {
    const a = computeMatchedCanonicalKey({
      academicYear: "2024/25",
      university: "University of Colombo",
      stream: "Commerce",
      degreeName: "B.Com",
      district: "Colombo",
    });
    const b = computeMatchedCanonicalKey({
      academicYear: "2024/25",
      university: "University of Colombo",
      stream: "Commerce",
      degreeName: "B.Com",
      district: "Jaffna",
    });
    expect(a).not.toBe(b);
  });
});
