import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!token) {
      setLocation("/login");
    } else if (user && !isAdmin) {
      setLocation("/");
    }
  }, [token, user, isAdmin, setLocation]);

  if (!token || !isAdmin) {
    return (
      <div className="space-y-4 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return <>{children}</>;
}
