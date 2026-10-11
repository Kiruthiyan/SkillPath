import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export type OpportunityType = "scholarship" | "internship" | "competition" | "grant" | "other";
export type OpportunityStatus =
  | "draft"
  | "pending_verification"
  | "verified"
  | "published"
  | "unpublished"
  | "archived";

export interface Opportunity {
  id: number;
  type: OpportunityType;
  title: string;
  description: string;
  organization: string | null;
  universityId: number | null;
  eligibilityStream: string | null;
  eligibilityNotes: string | null;
  applicationUrl: string | null;
  applicationDeadline: string | null;
  amount: string | null;
  status: OpportunityStatus;
  createdByUserId: number;
  reviewedByUserId: number | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

// --- Public browse ------------------------------------------------------------

export function useListOpportunities(params: {
  type?: string;
  stream?: string;
  universityId?: number;
  activeOnly?: boolean;
} = {}) {
  return useQuery({
    queryKey: ["opportunities", "list", params],
    queryFn: () => customFetch<Opportunity[]>(`/api/opportunities${buildQuery(params)}`),
  });
}

export function useOpportunity(id: number | undefined) {
  return useQuery({
    queryKey: ["opportunities", "detail", id],
    queryFn: () => customFetch<Opportunity>(`/api/opportunities/${id}`),
    enabled: id != null,
  });
}

// --- Admin / university_admin management ---------------------------------------

export function useAdminOpportunities(status?: string) {
  return useQuery({
    queryKey: ["admin", "opportunities", status],
    queryFn: () => customFetch<Opportunity[]>(`/api/admin/opportunities${buildQuery({ status })}`),
  });
}

export function useCreateOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      data: Pick<Opportunity, "type" | "title" | "description"> &
        Partial<
          Pick<
            Opportunity,
            | "organization"
            | "universityId"
            | "eligibilityStream"
            | "eligibilityNotes"
            | "applicationUrl"
            | "applicationDeadline"
            | "amount"
          >
        >,
    ) => customFetch<Opportunity>("/api/admin/opportunities", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "opportunities"] }),
  });
}

export function useUpdateOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Opportunity> }) =>
      customFetch<Opportunity>(`/api/admin/opportunities/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "opportunities"] }),
  });
}

export function useDeleteOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch(`/api/admin/opportunities/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "opportunities"] }),
  });
}

export function useSetOpportunityStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: OpportunityStatus }) =>
      customFetch<Opportunity>(`/api/admin/opportunities/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "opportunities"] }),
  });
}
