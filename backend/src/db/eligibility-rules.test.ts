import { describe, it, expect } from "vitest";
import {
  evaluateStreamStep,
  evaluateSubjectsStep,
  evaluateRulesStep,
  type SubjectRequirementRow,
  type AdmissionRuleRow,
} from "./eligibility-rules";

describe("evaluateStreamStep", () => {
  it("passes when streams match (case-insensitive)", () => {
    const result = evaluateStreamStep("Physical Science", "physical science");
    expect(result.status).toBe("pass");
  });

  it("fails when streams differ, with a clear reason", () => {
    const result = evaluateStreamStep("Physical Science", "Biological Science");
    expect(result.status).toBe("fail");
    expect(result.reason).toContain("Physical Science");
    expect(result.reason).toContain("Biological Science");
  });
});

describe("evaluateSubjectsStep", () => {
  it("is not_applicable when there are no requirements", () => {
    const result = evaluateSubjectsStep([], {});
    expect(result.status).toBe("not_applicable");
  });

  it("fails when a compulsory subject is missing", () => {
    const requirements: SubjectRequirementRow[] = [
      { requirementType: "compulsory", groupKey: "default", subjectName: "Combined Mathematics", minimumGrade: "C" },
    ];
    const result = evaluateSubjectsStep(requirements, {});
    expect(result.status).toBe("fail");
    expect(result.reason).toContain("Combined Mathematics");
  });

  it("fails when a compulsory subject's grade is below the minimum", () => {
    const requirements: SubjectRequirementRow[] = [
      { requirementType: "compulsory", groupKey: "default", subjectName: "Physics", minimumGrade: "B" },
    ];
    const result = evaluateSubjectsStep(requirements, { Physics: "S" });
    expect(result.status).toBe("fail");
  });

  it("passes when a compulsory subject's grade meets the minimum", () => {
    const requirements: SubjectRequirementRow[] = [
      { requirementType: "compulsory", groupKey: "default", subjectName: "Physics", minimumGrade: "B" },
    ];
    const result = evaluateSubjectsStep(requirements, { Physics: "A" });
    expect(result.status).toBe("pass");
  });

  it("passes a one_of group when any alternative is satisfied", () => {
    const requirements: SubjectRequirementRow[] = [
      { requirementType: "one_of", groupKey: "science-elective", subjectName: "Chemistry", minimumGrade: "C" },
      { requirementType: "one_of", groupKey: "science-elective", subjectName: "Biology", minimumGrade: "C" },
    ];
    const result = evaluateSubjectsStep(requirements, { Biology: "B" });
    expect(result.status).toBe("pass");
  });

  it("fails a one_of group when no alternative is satisfied", () => {
    const requirements: SubjectRequirementRow[] = [
      { requirementType: "one_of", groupKey: "science-elective", subjectName: "Chemistry", minimumGrade: "C" },
      { requirementType: "one_of", groupKey: "science-elective", subjectName: "Biology", minimumGrade: "C" },
    ];
    const result = evaluateSubjectsStep(requirements, { Chemistry: "S" });
    expect(result.status).toBe("fail");
    expect(result.reason).toContain("Chemistry or Biology");
  });

  it("never fails on a recommended-only subject", () => {
    const requirements: SubjectRequirementRow[] = [
      { requirementType: "recommended", groupKey: "default", subjectName: "ICT", minimumGrade: "C" },
    ];
    const result = evaluateSubjectsStep(requirements, {});
    expect(result.status).toBe("pass");
  });
});

describe("evaluateRulesStep", () => {
  it("is not_applicable when there are no blocking rules", () => {
    const rules: AdmissionRuleRow[] = [
      { ruleType: "district_quota_note", description: "Quota applies", blocksEligibility: false },
    ];
    const result = evaluateRulesStep(rules, {});
    expect(result.status).toBe("not_applicable");
  });

  it("surfaces non-machine-checkable blocking rules as not_applicable with the rule text", () => {
    const rules: AdmissionRuleRow[] = [
      { ruleType: "aptitude_test", description: "Requires passing an aptitude test.", blocksEligibility: true },
    ];
    const result = evaluateRulesStep(rules, {});
    expect(result.status).toBe("not_applicable");
    expect(result.reason).toContain("aptitude test");
  });

  it("fails a minimum_overall_grades rule when the student has too few passes", () => {
    const rules: AdmissionRuleRow[] = [
      {
        ruleType: "minimum_overall_grades",
        description: "Minimum overall grades: 3 subjects passed",
        blocksEligibility: true,
      },
    ];
    const result = evaluateRulesStep(rules, { Physics: "C", Chemistry: "F" });
    expect(result.status).toBe("fail");
  });

  it("passes a minimum_overall_grades rule when satisfied", () => {
    const rules: AdmissionRuleRow[] = [
      {
        ruleType: "minimum_overall_grades",
        description: "Minimum overall grades: 2 subjects passed",
        blocksEligibility: true,
      },
    ];
    const result = evaluateRulesStep(rules, { Physics: "C", Chemistry: "B" });
    expect(result.status).toBe("pass");
  });
});
