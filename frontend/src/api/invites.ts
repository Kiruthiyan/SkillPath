import { useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { User } from "./generated/api.schemas";

export function useInviteUniversityAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; universityId: number }) =>
      customFetch<{ message: string }>("/api/admin/university-admins/invite", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "university-admins"] }),
  });
}

export interface UniversityAdminAssignment {
  id: number;
  userId: number;
  universityId: number;
  createdAt: string;
  email: string;
  name: string;
}

export function useAcceptInvite() {
  return useMutation({
    mutationFn: (data: { token: string; name: string; password: string }) =>
      customFetch<{ token: string; user: User }>("/api/auth/accept-invite", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}
