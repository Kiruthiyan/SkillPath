import { useEffect } from "react";
import { useGetMe, getGetMeQueryKey } from "@/api";
import { ApiError } from "@/api";
import { useAuthStore } from "@/hooks/use-auth";

/** Validates persisted JWT on app load and syncs user profile from the server. */
export function AuthBootstrap() {
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);

  const { data, error, isError } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled: !!token,
      retry: false,
      staleTime: 60_000,
    },
  });

  useEffect(() => {
    if (data && token) {
      setAuth(token, data);
    }
  }, [data, token, setAuth]);

  useEffect(() => {
    if (!isError || !error) return;
    if (error instanceof ApiError && error.status === 401) {
      logout();
    }
  }, [isError, error, logout]);

  return null;
}
