import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "./client";
import { degreeProgrammesTable, subjectRequirementsTable, admissionRulesTable } from "./schema/index";
import { computeZScoreEstimate, type HistoricalCutoffPoint, type EstimateStatusLabel } from "./estimate";
import { getVerifiedCutoffHistory } from "./checker-query";
import {
  evaluateStreamStep,
  evaluateSubjectsStep,
  evaluateRulesStep,
  type EligibilityStepName,
  type EligibilityStepResult,
  type EligibilityStepStatus,
} from "./eligibility-rules";
import { chooseApplicableYearRows } from "./eligibility-year-scope";

export interface EligibilityResult {
  eligible: boolean;
  stoppedAtStep: EligibilityStepName | null;
  steps: EligibilityStepResult[];
  estimate: {
    hasSufficientData: boolean;
    historicalCutoffs: HistoricalCutoffPoint[];
    weightedEstimate: number | null;
    rangeLow: number | null;
    rangeHigh: number | null;
    confidence: "High" | "Medium" | "Low";
    statusLabel: EstimateStatusLabel | null;
  } | null;
}

export interface StudentAnswers {
  academicYear?: string;
  stream: string;
  subjectGrades: Record<string, string>;
  zscore: number;
  district: string;
}

export async function evaluateEligibility(
  programmeId: number,
  student: StudentAnswers,
): Promise<EligibilityResult | null> {
  const [programme] = await db
    .select({ stream: degreeProgrammesTable.stream })
    .from(degreeProgrammesTable)
    .where(eq(degreeProgrammesTable.id, programmeId));

  if (!programme) return null;

  const subjectConditions = [eq(subjectRequirementsTable.programmeId, programmeId)];
  if (student.academicYear) {
    subjectConditions.push(
      or(
        eq(subjectRequirementsTable.academicYear, student.academicYear),
        isNull(subjectRequirementsTable.academicYear),
      )!,
    );
  }

  const ruleConditions = [eq(admissionRulesTable.programmeId, programmeId)];
  if (student.academicYear) {
    ruleConditions.push(
      or(
        eq(admissionRulesTable.academicYear, student.academicYear),
        isNull(admissionRulesTable.academicYear),
      )!,
    );
  }

  const [requirementRows, ruleRows] = await Promise.all([
    db
      .select({
        academicYear: subjectRequirementsTable.academicYear,
        requirementType: subjectRequirementsTable.requirementType,
        groupKey: subjectRequirementsTable.groupKey,
        subjectName: subjectRequirementsTable.subjectName,
        minimumGrade: subjectRequirementsTable.minimumGrade,
      })
      .from(subjectRequirementsTable)
      .where(and(...subjectConditions)),
    db
      .select({
        academicYear: admissionRulesTable.academicYear,
        ruleType: admissionRulesTable.ruleType,
        description: admissionRulesTable.description,
        blocksEligibility: admissionRulesTable.blocksEligibility,
      })
      .from(admissionRulesTable)
      .where(and(...ruleConditions)),
  ]);

  const steps: EligibilityStepResult[] = [];
  let stoppedAtStep: EligibilityStepName | null = null;

  const streamResult = evaluateStreamStep(programme.stream, student.stream);
  steps.push(streamResult);
  if (streamResult.status === "fail") stoppedAtStep = "stream";

  if (stoppedAtStep) {
    steps.push({ step: "subjects", status: "not_applicable", reason: "Not evaluated: stream requirement not met." });
    steps.push({ step: "rules", status: "not_applicable", reason: "Not evaluated: stream requirement not met." });
    steps.push({ step: "zscore", status: "not_applicable", reason: "Not evaluated: stream requirement not met." });
    return { eligible: false, stoppedAtStep, steps, estimate: null };
  }

  const subjectsResult = evaluateSubjectsStep(
    chooseApplicableYearRows(requirementRows, student.academicYear),
    student.subjectGrades,
  );
  steps.push(subjectsResult);
  if (subjectsResult.status === "fail") stoppedAtStep = "subjects";

  if (stoppedAtStep) {
    steps.push({ step: "rules", status: "not_applicable", reason: "Not evaluated: subject requirements not met." });
    steps.push({ step: "zscore", status: "not_applicable", reason: "Not evaluated: subject requirements not met." });
    return { eligible: false, stoppedAtStep, steps, estimate: null };
  }

  const rulesResult = evaluateRulesStep(
    chooseApplicableYearRows(ruleRows, student.academicYear),
    student.subjectGrades,
  );
  steps.push(rulesResult);
  if (rulesResult.status === "fail") stoppedAtStep = "rules";

  if (stoppedAtStep) {
    steps.push({ step: "zscore", status: "not_applicable", reason: "Not evaluated: admission rules not met." });
    return { eligible: false, stoppedAtStep, steps, estimate: null };
  }

  const history = await getVerifiedCutoffHistory(programmeId, student.district);
  const estimate = computeZScoreEstimate(history, student.zscore);

  let zscoreStatus: EligibilityStepStatus;
  let zscoreReason: string;
  if (!estimate.hasSufficientData) {
    zscoreStatus = "not_applicable";
    zscoreReason = "Not enough historical cutoff data to assess Z-score fit for this district.";
  } else if (estimate.statusLabel === "below_recent_range") {
    zscoreStatus = "fail";
    zscoreReason = `Your Z-score (${student.zscore}) is below the recent historical range (${estimate.rangeLow}–${estimate.rangeHigh}).`;
  } else {
    zscoreStatus = "pass";
    zscoreReason = `Your Z-score (${student.zscore}) falls within or above the recent historical range (${estimate.rangeLow}–${estimate.rangeHigh}).`;
  }

  const zscoreResultStep: EligibilityStepResult = {
    step: "zscore",
    status: zscoreStatus,
    reason: zscoreReason,
  };
  steps.push(zscoreResultStep);
  if (zscoreStatus === "fail") stoppedAtStep = "zscore";

  return {
    eligible: stoppedAtStep === null,
    stoppedAtStep,
    steps,
    estimate: {
      hasSufficientData: estimate.hasSufficientData,
      historicalCutoffs: estimate.historicalCutoffs,
      weightedEstimate: estimate.weightedEstimate,
      rangeLow: estimate.rangeLow,
      rangeHigh: estimate.rangeHigh,
      confidence: estimate.confidence,
      statusLabel: estimate.statusLabel,
    },
  };
}
