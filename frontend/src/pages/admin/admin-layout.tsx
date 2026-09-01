import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  { href: "/admin/imports", label: "Handbook Imports" },
  { href: "/admin/review", label: "Extracted Data Review" },
  { href: "/admin/universities", label: "Universities" },
  { href: "/admin/courses", label: "Courses" },
  { href: "/admin/rules", label: "Rules" },
  { href: "/admin/zscore", label: "Z-Score Data" },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">Handbook data management — protected, admin-only.</p>
      </div>
      <nav className="flex flex-wrap gap-1 border-b border-[hsl(var(--border))] pb-2">
        {ADMIN_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              location === item.href
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div>{children}</div>
    </div>
  );
}
