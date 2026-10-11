export function UniversityAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">University Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Manage your university's profile, programmes, and announcements.
        </p>
      </div>
      <div>{children}</div>
    </div>
  );
}
