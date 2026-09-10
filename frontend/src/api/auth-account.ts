import { useMutation } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      customFetch<{ message: string }>("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

export function useDeactivateAccount() {
  return useMutation({
    mutationFn: () =>
      customFetch<{ message: string }>("/api/auth/deactivate", {
        method: "POST",
      }),
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: (data: { password?: string }) =>
      customFetch<{ message: string }>("/api/auth/account", {
        method: "DELETE",
        body: JSON.stringify(data),
      }),
  });
}

export function useLinkGoogleAccount() {
  return useMutation({
    mutationFn: (data: { credential: string }) =>
      customFetch<{ message: string }>("/api/auth/google/link", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}
