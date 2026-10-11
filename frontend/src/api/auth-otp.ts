import { useMutation } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export function useRequestPasswordOtp() {
  return useMutation({
    mutationFn: (data: { email: string }) =>
      customFetch<{ message: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

export function useVerifyPasswordOtp() {
  return useMutation({
    mutationFn: (data: { email: string; otp: string }) =>
      customFetch<{ resetToken: string }>("/api/auth/verify-reset-otp", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (data: { resetToken: string; newPassword: string }) =>
      customFetch<{ message: string }>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}
