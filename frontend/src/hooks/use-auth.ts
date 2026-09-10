import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setAuthTokenGetter } from "@/api";
import type { User } from "@/api";
import { isTokenExpired } from "@/lib/jwt";

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
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
      isAuthenticated: () => {
        const { token } = get();
        return !!token && !isTokenExpired(token);
      },
    }),
    { name: "skillpath-auth" },
  ),
);

setAuthTokenGetter(() => useAuthStore.getState().token);
