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
import { useTranslations } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";

function SkipLink() {
  const { t } = useTranslations();
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
    >
      {t.nav.skipToMain}
    </a>
  );
}

function getNavItems(t: ReturnType<typeof useTranslations>["t"]) {
  return [
    { href: "/dashboard", label: t.nav.dashboard, icon: LayoutDashboard },
    { href: "/profile", label: t.nav.profile, icon: User },
    { href: "/courses", label: t.nav.courses, icon: BookOpen },
    { href: "/checker", label: t.nav.checker, icon: Target },
    { href: "/universities", label: t.nav.universities, icon: Building2 },
    { href: "/careers", label: t.nav.careers, icon: Briefcase },
    { href: "/roadmap", label: t.nav.roadmap, icon: Map },
    { href: "/reviews", label: t.nav.reviews, icon: Star },
    { href: "/stories", label: t.nav.stories, icon: Trophy },
    { href: "/chat", label: t.nav.chat, icon: MessageSquare },
  ];
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
              <span className="text-sm text-muted-foreground hidden sm:inline">{t.nav.hi}, {user?.name}</span>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard">{t.nav.dashboard}</Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={logout}>
                <LogOut className="h-4 w-4 mr-1" /> {t.nav.logout}
              </Button>
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
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const logout = useAuthStore((s) => s.logout);
  const { t } = useTranslations();
  const navItems = getNavItems(t);

  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:flex w-64 flex-col border-r border-[hsl(var(--border))] bg-card">
        <div className="p-5 border-b border-[hsl(var(--border))] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-primary">
            <GraduationCap className="h-6 w-6" />
            SkillPath AI
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
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
        <div className="p-4 border-t border-[hsl(var(--border))]">
          {isAuthenticated ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              <Button variant="outline" size="sm" className="w-full" onClick={logout}>
                <LogOut className="h-4 w-4 mr-2" /> {t.nav.logout}
              </Button>
            </div>
          ) : (
            <Button size="sm" className="w-full" asChild>
              <Link href="/login">{t.nav.signIn}</Link>
            </Button>
          )}
        </div>
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
              <Button variant="ghost" size="sm" onClick={logout} className="lg:hidden">
                <LogOut className="h-4 w-4 mr-1" /> {t.nav.logout}
              </Button>
            ) : (
              <Button size="sm" asChild className="lg:hidden">
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
  const isAuthPage = location === "/login" || location === "/register";

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
