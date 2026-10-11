/**
 * Heading wrapper for mentor pages, matching AdminLayout. Navigation comes from
 * the role-aware sidebar (`@/lib/rbac`), not from here.
 */
export function MentorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mentor Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Manage your mentor profile and respond to student requests.
        </p>
      </div>
      <div>{children}</div>
    </div>
  );
}
