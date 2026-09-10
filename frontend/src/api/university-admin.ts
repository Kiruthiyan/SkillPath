import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export interface OwnedUniversity {
  id: number;
  name: string;
  shortName: string;
  location: string;
  foundedYear: number;
  logoColor: string;
  ranking: number;
  description: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  address: string | null;
  status: string;
}

export interface UniversityAnnouncement {
  id: number;
  universityId: number;
  title: string;
  body: string;
  link: string | null;
  createdByUserId: number;
  publishedAt: string | null;
  createdAt: string;
}

export interface OwnedProgramme {
  id: number;
  universityId: number;
  degreeName: string;
  faculty: string;
  degreeType: string;
  durationYears: number;
  stream: string;
  description: string | null;
}

export function useMyUniversities() {
  return useQuery({
    queryKey: ["university-admin", "me", "universities"],
    queryFn: () => customFetch<OwnedUniversity[]>("/api/university-admin/me/universities"),
  });
}

export function useUpdateMyUniversity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<OwnedUniversity> }) =>
      customFetch<OwnedUniversity>(`/api/university-admin/universities/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["university-admin"] }),
  });
}

export function useMyProgrammes() {
  return useQuery({
    queryKey: ["university-admin", "programmes"],
    queryFn: () => customFetch<OwnedProgramme[]>("/api/university-admin/programmes"),
  });
}

export function useUpdateMyProgramme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<OwnedProgramme> }) =>
      customFetch<OwnedProgramme>(`/api/university-admin/programmes/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["university-admin", "programmes"] }),
  });
}

export function useMyAnnouncements(universityId?: number) {
  return useQuery({
    queryKey: ["university-admin", "announcements", universityId],
    queryFn: () =>
      customFetch<UniversityAnnouncement[]>(
        `/api/university-admin/announcements${universityId ? `?universityId=${universityId}` : ""}`,
      ),
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { universityId: number; title: string; body: string; link?: string | null }) =>
      customFetch<UniversityAnnouncement>("/api/university-admin/announcements", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["university-admin", "announcements"] }),
  });
}

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { title?: string; body?: string; link?: string | null } }) =>
      customFetch<UniversityAnnouncement>(`/api/university-admin/announcements/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["university-admin", "announcements"] }),
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch(`/api/university-admin/announcements/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["university-admin", "announcements"] }),
  });
}
