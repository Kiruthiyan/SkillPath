import { RequireRole } from "@/components/require-role";

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  return <RequireRole roles={["admin", "super_admin"]}>{children}</RequireRole>;
}
