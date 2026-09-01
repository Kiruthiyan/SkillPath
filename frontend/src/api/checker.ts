import { useQuery, useMutation, type UseMutationOptions } from "@tanstack/react-query";
import { customFetch, type ErrorType } from "./custom-fetch";

export type CheckerLanguage = "en" | "si" | "ta";

export interface CheckerProgramme {
  id: number;
  universityId: number;
  universityName: string;
  degreeName: string;
  faculty: string;
  degreeType: string;
  durationYears: number;
  stream: string;
}

export interface CheckerAcademicYear {
  academicYear: string;
  handbookAvailable: boolean;
}

export interface SubjectRequirement {
  id: number;
  requirementType: "compulsory" | "one_of" | "recommended";
  groupKey: string;
  subjectName: string;
  minimumGrade: string | null;
  sourcePage: number | null;
}

export interface AdmissionRule {
  id: number;
  ruleType: string;
  description: string;
  blocksEligibility: boolean;
  sourcePage: number | null;
}

export interface HistoricalCutoffPoint {
  academicYear: string;
  minimumZScore: number;
}

export interface CheckerProgrammeDetail extends CheckerProgramme {
  description: string;
  subjectRequirements: SubjectRequirement[];
  admissionRules: AdmissionRule[];
  district: string;
  historicalCutoffs: HistoricalCutoffPoint[];
}

export type EstimateStatusLabel =
  | "strong_historical_position"
  | "competitive_range"
  | "near_range"
  | "below_recent_range";

export interface ZScoreEstimate {
  hasSufficientData: boolean;
  historicalCutoffs: HistoricalCutoffPoint[];
  weightedEstimate: number | null;
  rangeLow: number | null;
  rangeHigh: number | null;
  yearsUsed: number;
  statusLabel: EstimateStatusLabel | null;
}

export type EligibilityStepName = "stream" | "subjects" | "rules" | "zscore";
export type EligibilityStepStatus = "pass" | "fail" | "not_applicable";

export interface EligibilityStepResult {
  step: EligibilityStepName;
  status: EligibilityStepStatus;
  reason: string;
  details?: unknown;
}

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
  stream: string;
  subjectGrades: Record<string, string>;
  zscore: number;
  district: string;
}

export type CheckerResultMode = "official" | "historical_estimate";
export type CheckerResultGroup =
  | "strongMatches"
  | "competitiveOptions"
  | "nearHistoricalRange"
  | "notEligible";

export interface CheckerRecommendation {
  programmeId: number;
  universityId: number;
  university: string;
  courseName: string;
  faculty: string;
  degreeDuration: number;
  medium: string | null;
  studentZScore: number;
  officialCutoff: number | null;
  estimatedMin: number | null;
  estimatedMax: number | null;
  estimatedCenter: number | null;
  confidence: "High" | "Medium" | "Low" | null;
  academicYear: string;
  sourceHandbook: string;
  sourcePage: number | null;
  requiredStream: string;
  requiredSubjects: { subjectName: string; requirementType: string; minimumGrade: string | null }[];
  reasons: string[];
}

export interface CheckerRecommendationsResponse {
  mode: CheckerResultMode;
  resultModeLabel: "Official Handbook Based Result" | "Historical Estimate";
  academicYear: string;
  district: string;
  disclaimer: string;
  groups: Record<CheckerResultGroup, CheckerRecommendation[]>;
}

export interface CheckerRecommendationInput extends StudentAnswers {
  academicYear: string;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export async function listCheckerStreams(): Promise<string[]> {
  return customFetch<string[]>("/api/checker/streams");
}

export async function listCheckerSubjects(): Promise<string[]> {
  return customFetch<string[]>("/api/checker/subjects");
}

export async function listCheckerAcademicYears(): Promise<CheckerAcademicYear[]> {
  return customFetch<CheckerAcademicYear[]>("/api/checker/academic-years");
}

export async function listCheckerProgrammes(params: {
  stream?: string;
  district?: string;
  universityId?: number;
  lang?: CheckerLanguage;
}): Promise<{ district: string | null; programmes: CheckerProgramme[] }> {
  return customFetch(`/api/checker/programmes${buildQuery(params)}`);
}

export async function getCheckerProgrammeDetail(
  id: number,
  params: { district?: string; lang?: CheckerLanguage },
): Promise<CheckerProgrammeDetail> {
  return customFetch(`/api/checker/programmes/${id}${buildQuery(params)}`);
}

export async function getCheckerEstimate(
  id: number,
  params: { district?: string; zscore?: number },
): Promise<ZScoreEstimate> {
  return customFetch(`/api/checker/programmes/${id}/estimate${buildQuery(params)}`);
}

export async function checkEligibility(id: number, body: StudentAnswers): Promise<EligibilityResult> {
  return customFetch(`/api/checker/programmes/${id}/eligibility`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getCheckerRecommendations(
  body: CheckerRecommendationInput,
): Promise<CheckerRecommendationsResponse> {
  return customFetch("/api/checker/recommendations", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function useListCheckerStreams() {
  return useQuery({ queryKey: ["checker", "streams"], queryFn: listCheckerStreams });
}

export function useListCheckerSubjects() {
  return useQuery({ queryKey: ["checker", "subjects"], queryFn: listCheckerSubjects });
}

export function useListCheckerAcademicYears() {
  return useQuery({ queryKey: ["checker", "academic-years"], queryFn: listCheckerAcademicYears });
}

export function useListCheckerProgrammes(params: {
  stream?: string;
  district?: string;
  universityId?: number;
  lang?: CheckerLanguage;
}) {
  return useQuery({
    queryKey: ["checker", "programmes", params],
    queryFn: () => listCheckerProgrammes(params),
  });
}

export function useGetCheckerProgrammeDetail(
  id: number | undefined,
  params: { district?: string; lang?: CheckerLanguage },
) {
  return useQuery({
    queryKey: ["checker", "programme", id, params],
    queryFn: () => getCheckerProgrammeDetail(id as number, params),
    enabled: id != null,
  });
}

export function useGetCheckerEstimate(
  id: number | undefined,
  params: { district?: string; zscore?: number },
) {
  return useQuery({
    queryKey: ["checker", "estimate", id, params],
    queryFn: () => getCheckerEstimate(id as number, params),
    enabled: id != null,
  });
}

export function useCheckEligibility(
  options?: UseMutationOptions<EligibilityResult, ErrorType<unknown>, { id: number; data: StudentAnswers }>,
) {
  return useMutation({
    mutationFn: ({ id, data }) => checkEligibility(id, data),
    ...options,
  });
}

export function useCheckerRecommendations(
  options?: UseMutationOptions<CheckerRecommendationsResponse, ErrorType<unknown>, CheckerRecommendationInput>,
) {
  return useMutation({
    mutationFn: getCheckerRecommendations,
    ...options,
  });
}
