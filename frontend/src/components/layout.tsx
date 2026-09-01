import { Link, useLocation } from "wouter";
import {
  GraduationCap,
  LayoutDashboard,
  User,
  BookOpen,
  Briefcase,
  Map,
  MessageSquare,
  Star,
  Trophy,
  Building2,
  LogOut,
  LogIn,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/hooks/use-auth";

function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
    >
      Skip to main content
    </a>
  );
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/checker", label: "Z-Score Checker", icon: Target },
  { href: "/universities", label: "Universities", icon: Building2 },
  { href: "/careers", label: "Careers", icon: Briefcase },
  { href: "/roadmap", label: "Roadmap", icon: Map },
  { href: "/reviews", label: "Reviews", icon: Star },
  { href: "/stories", label: "Success Stories", icon: Trophy },
  { href: "/chat", label: "AI Mentor", icon: MessageSquare },
];

function MarketingHeader() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const logout = useAuthStore((s) => s.logout);

  return (
    <header className="border-b border-[hsl(var(--border))] bg-card/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary">
          <GraduationCap className="h-7 w-7" />
          SkillPath AI
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link href="/courses" className="text-muted-foreground hover:text-foreground">Courses</Link>
          <Link href="/checker" className="text-muted-foreground hover:text-foreground">Z-Score Checker</Link>
          <Link href="/careers" className="text-muted-foreground hover:text-foreground">Careers</Link>
          <Link href="/stories" className="text-muted-foreground hover:text-foreground">Stories</Link>
        </nav>
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <span className="text-sm text-muted-foreground hidden sm:inline">Hi, {user?.name}</span>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={logout}>
                <LogOut className="h-4 w-4 mr-1" /> Logout
              </Button>
            </>
          ) : (
            <Button size="sm" asChild>
              <Link href="/login"><LogIn className="h-4 w-4 mr-1" /> Sign In</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:flex w-64 flex-col border-r border-[hsl(var(--border))] bg-card">
        <div className="p-6 border-b border-[hsl(var(--border))]">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-primary">
            <GraduationCap className="h-6 w-6" />
            SkillPath AI
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                location === href || location.startsWith(href + "/")
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-[hsl(var(--border))]">
          {isAuthenticated ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              <Button variant="outline" size="sm" className="w-full" onClick={logout}>
                <LogOut className="h-4 w-4 mr-2" /> Logout
              </Button>
            </div>
          ) : (
            <Button size="sm" className="w-full" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
          )}
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden border-b border-[hsl(var(--border))] bg-card px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-bold text-primary">SkillPath AI</Link>
          {isAuthenticated ? (
            <Button variant="ghost" size="sm" onClick={logout}>Logout</Button>
          ) : (
            <Button size="sm" asChild><Link href="/login">Sign In</Link></Button>
          )}
        </header>
        <nav className="lg:hidden flex gap-1 overflow-x-auto border-b border-[hsl(var(--border))] bg-card px-2 py-2">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                location === href || location.startsWith(href + "/")
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          ))}
        </nav>
        <main id="main-content" className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">{children}</main>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const isHome = location === "/";
  const isAuthPage = location === "/login" || location === "/register";

  if (isHome) {
    return (
      <div className="min-h-screen flex flex-col">
        <SkipLink />
        <MarketingHeader />
        <main id="main-content" className="flex-1">{children}</main>
        <footer className="border-t border-[hsl(var(--border))] py-8 text-center text-sm text-muted-foreground">
          SkillPath AI — Navigate your university and career journey
        </footer>
      </div>
    );
  }

  if (isAuthPage) {
    return (
      <>
        <SkipLink />
        <main id="main-content" className="min-h-screen">{children}</main>
      </>
    );
  }

  return (
    <>
      <SkipLink />
      <AppShell>{children}</AppShell>
    </>
  );
}
