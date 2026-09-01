import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export interface ExtractionBatch {
  id: number;
  academicYear: string;
  language: string;
  sourceFileName: string;
  status: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedByUserId: number | null;
  notes: string | null;
}

export interface ExtractedProgrammeRow {
  id: number;
  batchId: number;
  rawUniversityName: string;
  rawDegreeName: string;
  faculty: string | null;
  stream: string | null;
  district: string | null;
  minimumZScore: number | null;
  durationYears: number | null;
  degreeType: string | null;
  description: string | null;
  subjectsRaw: unknown;
  rulesRaw: unknown;
  sourcePage: number | null;
  matchedCanonicalKey: string | null;
  status: string;
  verificationStatus: "clean" | "needs_review" | "verified" | "rejected";
  reviewNotes: string | null;
  correctedUniversityName: string | null;
  correctedDegreeName: string | null;
  correctedFaculty: string | null;
  correctedStream: string | null;
  correctedDistrict: string | null;
  correctedMinimumZScore: number | null;
}

export interface AdminUniversity {
  id: number;
  name: string;
  shortName: string;
  location: string;
  foundedYear: number;
  logoColor: string;
  ranking: number;
  description: string | null;
  translations: unknown;
}

export interface AdminProgramme {
  id: number;
  universityId: number;
  degreeName: string;
  faculty: string;
  degreeType: string;
  durationYears: number;
  stream: string;
  description: string | null;
  translations: unknown;
}

export interface AdminSubjectRequirement {
  id: number;
  programmeId: number;
  requirementType: string;
  groupKey: string;
  subjectName: string;
  minimumGrade: string | null;
  sourceEditionId: number | null;
  sourcePage: number | null;
}

export interface AdminAdmissionRule {
  id: number;
  programmeId: number;
  ruleType: string;
  description: string;
  blocksEligibility: boolean;
  sourceEditionId: number | null;
  sourcePage: number | null;
}

export interface AdminCutoff {
  id: number;
  programmeId: number;
  editionId: number;
  district: string;
  minimumZScore: number;
  sourcePage: number | null;
  verifiedStatus: string;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

// --- Extraction batches / review -----------------------------------------

export function useListHandbookBatches(status?: string) {
  return useQuery({
    queryKey: ["admin", "handbook-batches", status],
    queryFn: () => customFetch<ExtractionBatch[]>(`/api/admin/handbook-batches${buildQuery({ status })}`),
  });
}

export function useListExtractedRows(params: { batchId?: number; status?: string }) {
  return useQuery({
    queryKey: ["admin", "extracted-rows", params],
    queryFn: () => customFetch<ExtractedProgrammeRow[]>(`/api/admin/extracted-rows${buildQuery(params)}`),
  });
}

export function useApproveExtractedRow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, corrections }: { id: number; corrections?: Record<string, unknown> }) =>
      customFetch(`/api/admin/extracted-rows/${id}/approve`, {
        method: "POST",
        body: JSON.stringify(corrections ?? {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "extracted-rows"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "handbook-batches"] });
    },
  });
}

export function useRejectExtractedRow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) =>
      customFetch(`/api/admin/extracted-rows/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ notes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "extracted-rows"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "handbook-batches"] });
    },
  });
}

export function useBulkApproveBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (batchId: number) =>
      customFetch(`/api/admin/handbook-batches/${batchId}/bulk-approve`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "extracted-rows"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "handbook-batches"] });
    },
  });
}

// --- Universities / programmes --------------------------------------------

export function useListAdminUniversities() {
  return useQuery({
    queryKey: ["admin", "universities"],
    queryFn: () => customFetch<AdminUniversity[]>("/api/admin/universities"),
  });
}

export function useUpdateAdminUniversity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AdminUniversity> }) =>
      customFetch(`/api/admin/universities/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "universities"] }),
  });
}

export function useListAdminProgrammes() {
  return useQuery({
    queryKey: ["admin", "programmes"],
    queryFn: () => customFetch<AdminProgramme[]>("/api/admin/programmes"),
  });
}

export function useUpdateAdminProgramme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AdminProgramme> }) =>
      customFetch(`/api/admin/programmes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "programmes"] }),
  });
}

// --- Subject requirements / admission rules --------------------------------

export function useListAdminSubjectRequirements(programmeId?: number) {
  return useQuery({
    queryKey: ["admin", "subject-requirements", programmeId],
    queryFn: () =>
      customFetch<AdminSubjectRequirement[]>(`/api/admin/subject-requirements${buildQuery({ programmeId })}`),
  });
}

export function useCreateAdminSubjectRequirement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<AdminSubjectRequirement, "id">) =>
      customFetch("/api/admin/subject-requirements", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "subject-requirements"] }),
  });
}

export function useDeleteAdminSubjectRequirement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch(`/api/admin/subject-requirements/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "subject-requirements"] }),
  });
}

export function useListAdminAdmissionRules(programmeId?: number) {
  return useQuery({
    queryKey: ["admin", "admission-rules", programmeId],
    queryFn: () => customFetch<AdminAdmissionRule[]>(`/api/admin/admission-rules${buildQuery({ programmeId })}`),
  });
}

export function useCreateAdminAdmissionRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<AdminAdmissionRule, "id">) =>
      customFetch("/api/admin/admission-rules", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "admission-rules"] }),
  });
}

export function useDeleteAdminAdmissionRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch(`/api/admin/admission-rules/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "admission-rules"] }),
  });
}

// --- Z-score / cutoff data --------------------------------------------------

export function useListAdminCutoffs(programmeId?: number) {
  return useQuery({
    queryKey: ["admin", "cutoffs", programmeId],
    queryFn: () => customFetch<AdminCutoff[]>(`/api/admin/cutoffs${buildQuery({ programmeId })}`),
  });
}

export function useUpdateAdminCutoff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AdminCutoff> }) =>
      customFetch(`/api/admin/cutoffs/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "cutoffs"] }),
  });
}

// --- User role management ---------------------------------------------------

export function useSetUserRole() {
  return useMutation({
    mutationFn: ({ id, role }: { id: number; role: "user" | "admin" }) =>
      customFetch(`/api/admin/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
  });
}
