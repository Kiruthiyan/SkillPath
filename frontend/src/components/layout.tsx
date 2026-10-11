import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
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
  Target,
  Settings,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/hooks/use-auth";
import { useTranslations } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getNavForRole } from "@/lib/rbac";
import { Logo } from "@/components/logo";

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
  const [, setLocation] = useLocation();
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
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 min-h-11 rounded-full p-1 hover:bg-muted/80 border border-border transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
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
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <User className="h-4 w-4 text-primary" />
              {t.settings.tabProfile}
            </Link>
            <Link
              href="/settings?tab=preferences"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
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
                setLocation("/login");
              }}
              className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors text-left"
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

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

function BottomNav({ items, location }: { items: NavItem[]; location: string }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (href: string) => location === href || location.startsWith(href + "/");
  const needsMore = items.length > 5;
  const primary = needsMore ? items.slice(0, 4) : items;
  const overflow = needsMore ? items.slice(4) : [];
  const overflowActive = overflow.some((i) => isActive(i.href));

  useEffect(() => {
    setMoreOpen(false);
  }, [location]);

  const tabClass = (active: boolean) =>
    cn(
      "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors active:scale-95",
      active ? "text-primary" : "text-muted-foreground",
    );

  return (
    <>
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40 animate-in fade-in"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[75dvh] overflow-y-auto rounded-t-3xl bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted" />
            <div className="grid grid-cols-3 gap-2">
              {overflow.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl p-2 text-center text-xs font-medium",
                    isActive(href) ? "bg-primary text-primary-foreground" : "bg-muted/60 text-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="line-clamp-2 break-words">{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
      <nav
        className="lg:hidden fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
        aria-label="Primary"
      >
        {primary.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={tabClass(isActive(href))}>
            <Icon className="h-5 w-5" />
            <span className="max-w-full truncate px-1">{label}</span>
          </Link>
        ))}
        {needsMore && (
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            className={tabClass(overflowActive || moreOpen)}
            aria-expanded={moreOpen}
          >
            {moreOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            <span>More</span>
          </button>
        )}
      </nav>
    </>
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
    <div className="min-h-dvh min-w-0 flex">
      <aside className="hidden lg:flex w-64 flex-col border-r border-[hsl(var(--border))] bg-card h-screen sticky top-0">
        <div className="p-5 border-b border-[hsl(var(--border))] flex items-center justify-between shrink-0">
          <Logo />
        </div>
        <nav className="flex-1 min-h-0 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                location === href || location.startsWith(href + "/")
                  ? "bg-primary text-primary-foreground font-medium shadow-sm"
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
        <header className="sticky top-0 z-30 border-b border-[hsl(var(--border))] bg-card/90 backdrop-blur pt-[calc(0.5rem+env(safe-area-inset-top))] px-4 md:px-6 pb-2.5 flex min-w-0 items-center justify-between gap-3">
          <Logo className="lg:hidden" markClassName="h-8 w-8" />
          <div className="hidden lg:block"></div>
          <div className="flex min-w-0 shrink-0 items-center gap-3">
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
        <main id="main-content" className="flex-1 min-w-0 p-4 md:p-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-8 max-w-6xl mx-auto w-full">{children}</main>
        <BottomNav items={navItems} location={location} />
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
    return <main id="main-content">{children}</main>;
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
