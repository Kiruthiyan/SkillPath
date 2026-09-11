import { useState, useRef, useEffect } from "react";
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
  Landmark,
  ShieldCheck,
  Users,
  LogOut,
  LogIn,
  Target,
  Settings,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/hooks/use-auth";
import { useTranslations } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getDashboardPath, getNavForRole } from "@/lib/rbac";

function SkipLink() {
  const { t } = useTranslations();
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-md"
    >
      {t.nav.skipToMain}
    </a>
  );
}

function UserMenu() {
  const [open, setOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { t } = useTranslations();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full p-1 hover:bg-muted/80 border border-border transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
        title={user?.name || "Profile"}
        aria-label="User menu"
      >
        <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-xs shrink-0 shadow-sm">
          {initials}
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground mr-1" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card p-1.5 shadow-lg z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-2 border-b border-border/60 mb-1">
            <p className="text-sm font-semibold text-foreground truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>

          <div className="space-y-0.5">
            <Link
              href="/settings?tab=profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              <User className="h-4 w-4 text-primary" />
              {t.settings.tabProfile}
            </Link>
            <Link
              href="/settings?tab=preferences"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Settings className="h-4 w-4 text-primary" />
              {t.settings.title}
            </Link>
          </div>

          <div className="border-t border-border/60 mt-1 pt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors text-left"
            >
              <LogOut className="h-4 w-4" />
              {t.nav.logout}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MarketingHeader() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const logout = useAuthStore((s) => s.logout);
  const { t } = useTranslations();

  return (
    <header className="border-b border-[hsl(var(--border))] bg-card/80 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary">
          <GraduationCap className="h-7 w-7" />
          SkillPath AI
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link href="/courses" className="text-muted-foreground hover:text-foreground">{t.nav.courses}</Link>
          <Link href="/checker" className="text-muted-foreground hover:text-foreground">{t.nav.checker}</Link>
          <Link href="/careers" className="text-muted-foreground hover:text-foreground">{t.nav.careers}</Link>
          <Link href="/stories" className="text-muted-foreground hover:text-foreground">{t.nav.stories}</Link>
        </nav>
        <div className="flex items-center gap-2.5">
          <LanguageSwitcher variant="select" />
          {isAuthenticated ? (
            <>
              <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
                <Link href={getDashboardPath(user?.role)}>{t.nav.dashboard}</Link>
              </Button>
              <UserMenu />
            </>
          ) : (
            <Button size="sm" asChild>
              <Link href="/login"><LogIn className="h-4 w-4 mr-1" /> {t.nav.signIn}</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const role = useAuthStore((s) => s.user?.role);
  const { t } = useTranslations();
  // Navigation follows the authenticated user's role, never the URL. A role's
  // items are its own; nothing is inherited from the student navigation.
  const navItems = getNavForRole(role, t);

  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:flex w-64 flex-col border-r border-[hsl(var(--border))] bg-card h-screen sticky top-0">
        <div className="p-5 border-b border-[hsl(var(--border))] flex items-center justify-between shrink-0">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-primary">
            <GraduationCap className="h-6 w-6" />
            SkillPath AI
          </Link>
        </div>
        <nav className="flex-1 min-h-0 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                location === href || location.startsWith(href + "/")
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-[hsl(var(--border))] bg-card px-4 md:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="lg:hidden font-bold text-primary flex items-center gap-1.5">
            <GraduationCap className="h-5 w-5" /> SkillPath AI
          </Link>
          <div className="hidden lg:block"></div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher variant="select" />
            {isAuthenticated ? (
              <UserMenu />
            ) : (
              <Button size="sm" asChild>
                <Link href="/login">{t.nav.signIn}</Link>
              </Button>
            )}
          </div>
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
  const { t } = useTranslations();
  const isHome = location === "/";
  // Pages that must render without app chrome. A user in the forced
  // password-change or invite-acceptance flow has no business seeing a sidebar.
  const isAuthPage =
    location === "/login" ||
    location === "/register" ||
    location === "/forgot-password" ||
    location === "/change-password" ||
    location === "/accept-invite";

  if (isHome) {
    return (
      <div className="min-h-screen flex flex-col">
        <SkipLink />
        <MarketingHeader />
        <main id="main-content" className="flex-1">{children}</main>
        <footer className="border-t border-[hsl(var(--border))] py-8 text-center text-sm text-muted-foreground">
          {t.home.footerText}
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
