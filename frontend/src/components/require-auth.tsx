import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) {
      setLocation("/login");
    }
  }, [token, setLocation]);

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
