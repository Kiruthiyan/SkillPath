export type EligibilityStepName = "stream" | "subjects" | "rules" | "zscore";
export type EligibilityStepStatus = "pass" | "fail" | "not_applicable";

export interface EligibilityStepResult {
  step: EligibilityStepName;
  status: EligibilityStepStatus;
  reason: string;
  details?: unknown;
}

export interface SubjectRequirementRow {
  requirementType: string;
  groupKey: string;
  subjectName: string;
  minimumGrade: string | null;
}

export interface AdmissionRuleRow {
  ruleType: string;
  description: string;
  blocksEligibility: boolean;
}

const GRADE_ORDER = ["S", "C", "B", "A"];

function gradeIndex(grade: string): number {
  return GRADE_ORDER.indexOf(grade.toUpperCase());
}

function meetsMinimumGrade(actual: string | undefined, minimum: string | null): boolean {
  if (!minimum) return actual != null;
  if (!actual) return false;
  const actualIdx = gradeIndex(actual);
  const minIdx = gradeIndex(minimum);
  if (actualIdx === -1 || minIdx === -1) return false;
  return actualIdx >= minIdx;
}

export function evaluateStreamStep(
  programmeStream: string,
  studentStream: string,
): EligibilityStepResult {
  if (programmeStream.toLowerCase() === studentStream.toLowerCase()) {
    return { step: "stream", status: "pass", reason: `Matches required stream (${programmeStream}).` };
  }
  return {
    step: "stream",
    status: "fail",
    reason: `Requires ${programmeStream} stream; your profile has ${studentStream}.`,
  };
}

export function evaluateSubjectsStep(
  requirements: SubjectRequirementRow[],
  subjectGrades: Record<string, string>,
): EligibilityStepResult {
  if (requirements.length === 0) {
    return { step: "subjects", status: "not_applicable", reason: "No subject requirements on record." };
  }

  const compulsory = requirements.filter((r) => r.requirementType === "compulsory");
  const missingCompulsory = compulsory.filter(
    (r) => !meetsMinimumGrade(subjectGrades[r.subjectName], r.minimumGrade),
  );

  const groups = new Map<string, SubjectRequirementRow[]>();
  for (const r of requirements.filter((r) => r.requirementType === "one_of")) {
    if (!groups.has(r.groupKey)) groups.set(r.groupKey, []);
    groups.get(r.groupKey)!.push(r);
  }
  const unsatisfiedGroups: string[] = [];
  for (const [groupKey, alternatives] of groups) {
    const satisfied = alternatives.some((r) =>
      meetsMinimumGrade(subjectGrades[r.subjectName], r.minimumGrade),
    );
    if (!satisfied) unsatisfiedGroups.push(groupKey);
  }

  if (missingCompulsory.length === 0 && unsatisfiedGroups.length === 0) {
    return { step: "subjects", status: "pass", reason: "All required subjects satisfied." };
  }

  const reasons: string[] = [];
  for (const r of missingCompulsory) {
    reasons.push(
      r.minimumGrade
        ? `Requires ${r.subjectName} at grade ${r.minimumGrade} or better.`
        : `Requires ${r.subjectName}.`,
    );
  }
  for (const groupKey of unsatisfiedGroups) {
    const names = groups.get(groupKey)!.map((r) => r.subjectName).join(" or ");
    reasons.push(`Requires at least one of: ${names}.`);
  }

  return {
    step: "subjects",
    status: "fail",
    reason: reasons.join(" "),
    details: { missingCompulsory, unsatisfiedGroups },
  };
}

const MINIMUM_OVERALL_GRADES_RE = /minimum overall grade[s]?\s*:?\s*(\d+)/i;

export function evaluateRulesStep(
  rules: AdmissionRuleRow[],
  subjectGrades: Record<string, string>,
): EligibilityStepResult {
  const blocking = rules.filter((r) => r.blocksEligibility);
  if (blocking.length === 0) {
    return { step: "rules", status: "not_applicable", reason: "No blocking admission rules on record." };
  }

  const infoRules: string[] = [];
  for (const rule of blocking) {
    if (rule.ruleType === "minimum_overall_grades") {
      const match = rule.description.match(MINIMUM_OVERALL_GRADES_RE);
      if (match) {
        const required = Number(match[1]);
        const passCount = Object.values(subjectGrades).filter((g) => g.toUpperCase() !== "F").length;
        if (passCount < required) {
          return {
            step: "rules",
            status: "fail",
            reason: `Requires at least ${required} subjects passed; you have ${passCount}.`,
          };
        }
        continue;
      }
    }
    infoRules.push(rule.description);
  }

  if (infoRules.length > 0) {
    return {
      step: "rules",
      status: "not_applicable",
      reason: `Manual verification required: ${infoRules.join(" ")}`,
      details: { informationalRules: infoRules },
    };
  }

  return { step: "rules", status: "pass", reason: "Machine-checkable admission rules satisfied." };
}
