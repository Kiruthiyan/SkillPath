/**
 * Heading wrapper for admin pages. Navigation deliberately lives only in the
 * role-aware sidebar (`@/lib/rbac`), so there is one nav definition, not two.
 */
export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Platform overview, users, and handbook data — protected, admin-only.
        </p>
      </div>
      <div>{children}</div>
    </div>
  );
}
