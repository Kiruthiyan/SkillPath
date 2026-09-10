import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboardPath } from "@/lib/rbac";

function GuardSkeleton() {
  return (
    <div className="space-y-4 py-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

/**
 * Route-level authorization. This, not the sidebar, is what keeps a user out of
 * a page — typing the URL directly hits the same check. The backend enforces the
 * same rules independently; this only prevents the wrong page from painting.
 *
 * Three distinct states, so a slow or failed `/auth/me` can never leave the user
 * stuck on a skeleton forever:
 *   no token          → send to login, preserving where they were headed
 *   token, no user yet → skeleton while AuthBootstrap resolves the session
 *   user, wrong role   → send to that user's own dashboard
 */
export function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  // An expired token counts as no token, so a stale session goes to login
  // rather than sitting on a skeleton until the first request fails.
  const token = useAuthStore((s) => (s.isAuthenticated() ? s.token : null));
  const user = useAuthStore((s) => s.user);

  const sessionLoaded = !!token && !!user;
  const allowed = sessionLoaded && !!user.role && roles.includes(user.role);

  useEffect(() => {
    if (!token) {
      setLocation(`/login?redirect=${encodeURIComponent(location)}`, { replace: true });
      return;
    }
    if (sessionLoaded && !allowed) {
      // getDashboardPath always returns a route this role may render, so this
      // cannot bounce back here and loop.
      setLocation(getDashboardPath(user.role), { replace: true });
    }
    // `location` is intentionally omitted: it changes as we redirect, and
    // re-running on it would fight the navigation we just performed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, sessionLoaded, allowed, user?.role, setLocation]);

  if (!allowed) {
    return <GuardSkeleton />;
  }

  return <>{children}</>;
}
