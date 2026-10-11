import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation(`/login?redirect=${encodeURIComponent(location)}`, { replace: true });
    }
    // `location` is intentionally omitted so the redirect does not re-fire
    // against the path we just navigated to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, setLocation]);

  if (!isAuthenticated) {
    return (
      <div className="space-y-4 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return <>{children}</>;
}
