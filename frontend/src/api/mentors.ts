import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export interface PublicMentor {
  id: number;
  userId: number;
  name: string;
  headline: string | null;
  bio: string | null;
  expertiseAreas: string[] | null;
  yearsExperience: number | null;
  availability: string | null;
}

export interface MentorProfile {
  id: number;
  userId: number;
  headline: string | null;
  bio: string | null;
  expertiseAreas: string[] | null;
  yearsExperience: number | null;
  availability: string | null;
  isAcceptingStudents: boolean;
  verificationStatus: string;
  createdAt: string;
}

export interface MentorIncomingRequest {
  id: number;
  studentUserId: number;
  studentName: string;
  status: string;
  message: string | null;
  requestedAt: string;
  respondedAt: string | null;
}

export interface MyMentorRequest {
  id: number;
  mentorUserId: number;
  mentorName: string;
  status: string;
  message: string | null;
  requestedAt: string;
  respondedAt: string | null;
}

export interface AdminMentorRow {
  id: number;
  userId: number;
  name: string;
  email: string;
  isActive: boolean;
  role: string;
  headline: string | null;
  bio: string | null;
  expertiseAreas: string[] | null;
  yearsExperience: number | null;
  availability: string | null;
  verificationStatus: string;
  isAcceptingStudents: boolean;
  verifiedByUserId: number | null;
  verifiedAt: string | null;
  createdAt: string;
}

export type AdminMentorCreateInput = {
  email: string;
  name: string;
  headline?: string | null;
  bio?: string | null;
  expertiseAreas?: string[];
  yearsExperience?: number | null;
  availability?: string | null;
  isAcceptingStudents?: boolean;
};

export type AdminMentorPatchInput = {
  name?: string;
  headline?: string | null;
  bio?: string | null;
  expertiseAreas?: string[];
  yearsExperience?: number | null;
  availability?: string | null;
  isAcceptingStudents?: boolean;
};

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

function invalidateMentorCaches(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["admin", "mentors"] });
  void queryClient.invalidateQueries({ queryKey: ["mentors"] });
  void queryClient.invalidateQueries({ queryKey: ["admin", "metrics"] });
}

// --- Public browse ------------------------------------------------------------

export function useListMentors(params: { stream?: string; search?: string } = {}) {
  return useQuery({
    queryKey: ["mentors", "list", params],
    queryFn: () => customFetch<PublicMentor[]>(`/api/mentors${buildQuery(params)}`),
  });
}

export function useMentor(id: number | undefined) {
  return useQuery({
    queryKey: ["mentors", "detail", id],
    queryFn: () => customFetch<PublicMentor>(`/api/mentors/${id}`),
    enabled: id != null,
  });
}

export function useRequestMentor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mentorId, message }: { mentorId: number; message?: string }) =>
      customFetch(`/api/mentors/${mentorId}/request`, { method: "POST", body: JSON.stringify({ message }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users", "me", "mentor-requests"] }),
  });
}

export function useMyOutgoingMentorRequests(enabled = true) {
  return useQuery({
    queryKey: ["users", "me", "mentor-requests"],
    queryFn: () => customFetch<MyMentorRequest[]>("/api/users/me/mentor-requests"),
    enabled,
  });
}

// --- Mentor's own profile / requests -------------------------------------------

export function useMyMentorProfile() {
  return useQuery({
    queryKey: ["mentor", "profile"],
    queryFn: () => customFetch<MentorProfile | null>("/api/mentor/profile"),
  });
}

export function useUpdateMyMentorProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Omit<MentorProfile, "id" | "userId" | "verificationStatus" | "createdAt">>) =>
      customFetch<MentorProfile>("/api/mentor/profile", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mentor", "profile"] }),
  });
}

export function useMentorIncomingRequests() {
  return useQuery({
    queryKey: ["mentor", "requests"],
    queryFn: () => customFetch<MentorIncomingRequest[]>("/api/mentor/requests"),
  });
}

export function useRespondToMentorRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: "accepted" | "declined" }) =>
      customFetch(`/api/mentor/requests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mentor", "requests"] });
      void queryClient.invalidateQueries({ queryKey: ["users", "me", "mentor-requests"] });
    },
  });
}

// --- Admin verification queue --------------------------------------------------

export function useAdminMentors(status?: string) {
  return useQuery({
    queryKey: ["admin", "mentors", status],
    queryFn: () => customFetch<AdminMentorRow[]>(`/api/admin/mentors${buildQuery({ status })}`),
  });
}

export function useAdminMentor(id: number | undefined) {
  return useQuery({
    queryKey: ["admin", "mentors", "detail", id],
    queryFn: () => customFetch<AdminMentorRow>(`/api/admin/mentors/${id}`),
    enabled: id != null,
  });
}

export function useCreateAdminMentor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AdminMentorCreateInput) =>
      customFetch<AdminMentorRow>("/api/admin/mentors", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => invalidateMentorCaches(queryClient),
  });
}

export function useUpdateAdminMentor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: AdminMentorPatchInput }) =>
      customFetch<AdminMentorRow>(`/api/admin/mentors/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => invalidateMentorCaches(queryClient),
  });
}

export function useVerifyMentor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      isAcceptingStudents,
    }: {
      id: number;
      status: "pending" | "verified" | "rejected" | "suspended";
      isAcceptingStudents?: boolean;
    }) =>
      customFetch(`/api/admin/mentors/${id}/verify`, {
        method: "PATCH",
        body: JSON.stringify({ status, isAcceptingStudents }),
      }),
    onSuccess: () => invalidateMentorCaches(queryClient),
  });
}

export function useInviteMentor() {
  return useMutation({
    mutationFn: (data: { email: string }) =>
      customFetch<{ message: string }>("/api/admin/mentors/invite", { method: "POST", body: JSON.stringify(data) }),
  });
}
