import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setAuthTokenGetter } from "@/api";
import type { User } from "@/api";
import { isTokenExpired } from "@/lib/jwt";
import { queryClient } from "@/lib/query-client";
import { useProfileStore } from "@/hooks/use-profile";

/**
 * The single source of truth for the authenticated session. `AuthBootstrap`
 * reconciles `user` against `GET /api/auth/me` on every load, so the persisted
 * copy is a cache for first paint, not an authority on the user's role.
 */
interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setAuth: (token, user) => {
        const prev = get().user;
        // Clear per-user client caches whenever the account changes (including
        // login-without-logout on the same device) so the previous user's
        // React Query data and persisted profile never leak across sessions.
        if (!prev || prev.id !== user.id) {
          queryClient.clear();
          useProfileStore.getState().resetProfile();
        }
        set({ token, user });
      },
      // Every per-user client-side cache must be cleared here, not just the
      // token: react-query's cache (dashboard data, profile, etc. keyed
      // without a user id) and the persisted profile store (`use-profile.ts`,
      // localStorage) would otherwise carry the previous account's data into
      // the next account that logs in on this tab/device.
      logout: () => {
        set({ token: null, user: null });
        queryClient.clear();
        useProfileStore.getState().resetProfile();
      },
      isAuthenticated: () => {
        const { token } = get();
        return !!token && !isTokenExpired(token);
      },
    }),
    { name: "skillpath-auth" },
  ),
);

setAuthTokenGetter(() => useAuthStore.getState().token);
