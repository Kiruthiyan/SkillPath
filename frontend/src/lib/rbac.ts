import {
  BookOpen,
  Briefcase,
  Building2,
  ClipboardCheck,
  FileSearch,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  Map,
  MessageSquare,
  Megaphone,
  Scale,
  Settings,
  Star,
  Target,
  Trophy,
  Upload,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { useTranslations } from "@/lib/i18n";

/**
 * Single source of truth for roles, per-role landing pages and per-role
 * navigation. Mirrors the backend contract in `backend/src/lib/roles.ts` —
 * these five strings must stay in sync with it.
 *
 * Navigation is presentation only. Authorization lives in the route guards
 * (`RequireAuth` / `RequireRole`) and, authoritatively, in the backend.
 * Never rely on an item being absent from a sidebar to keep a user out of a page.
 */
export const ROLES = ["student", "mentor", "university_admin", "admin", "super_admin"] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

type Translations = ReturnType<typeof useTranslations>["t"];

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Where each role lands after login, and where an unauthorized navigation
 * attempt is redirected to. Every path here must be a route that role is
 * actually allowed to render, otherwise guards would bounce in a loop.
 */
export const ROLE_DASHBOARD_PATH: Record<Role, string> = {
  super_admin: "/admin/overview",
  admin: "/admin/overview",
  university_admin: "/university-admin",
  mentor: "/mentor",
  student: "/dashboard",
};

/**
 * Fallback for a session whose role is missing or unrecognised. It must not be
 * `/dashboard`, which is restricted to the `student` role and would bounce back.
 */
export const UNKNOWN_ROLE_PATH = "/";

export function getDashboardPath(role: string | null | undefined): string {
  return isRole(role) ? ROLE_DASHBOARD_PATH[role] : UNKNOWN_ROLE_PATH;
}

function adminNav(t: Translations): NavItem[] {
  return [
    { href: "/admin/overview", label: t.nav.overview, icon: LayoutDashboard },
    { href: "/admin/users", label: t.nav.users, icon: Users },
    { href: "/admin/imports", label: t.nav.imports, icon: Upload },
    { href: "/admin/review", label: t.nav.review, icon: FileSearch },
    { href: "/admin/universities", label: t.nav.universities, icon: Building2 },
    { href: "/admin/mentors", label: t.nav.mentors, icon: GraduationCap },
    { href: "/admin/opportunities", label: t.nav.opportunities, icon: Megaphone },
    { href: "/admin/courses", label: t.nav.courses, icon: BookOpen },
    { href: "/admin/rules", label: t.nav.rules, icon: Scale },
  ];
}

function studentNav(t: Translations): NavItem[] {
  return [
    { href: "/dashboard", label: t.nav.dashboard, icon: LayoutDashboard },
    { href: "/courses", label: t.nav.courses, icon: BookOpen },
    { href: "/checker", label: t.nav.checker, icon: Target },
    { href: "/universities", label: t.nav.universities, icon: Building2 },
    { href: "/mentors", label: t.nav.mentors, icon: Users },
    { href: "/opportunities", label: t.nav.opportunities, icon: Megaphone },
    { href: "/careers", label: t.nav.careers, icon: Briefcase },
    { href: "/roadmap", label: t.nav.roadmap, icon: Map },
    { href: "/reviews", label: t.nav.reviews, icon: Star },
    { href: "/stories", label: t.nav.stories, icon: Trophy },
    { href: "/chat", label: t.nav.chat, icon: MessageSquare },
    { href: "/settings", label: t.nav.settings, icon: Settings },
  ];
}

function mentorNav(t: Translations): NavItem[] {
  return [
    { href: "/mentor", label: t.nav.mentorDashboard, icon: LayoutDashboard },
    { href: "/settings", label: t.nav.settings, icon: Settings },
  ];
}

function universityAdminNav(t: Translations): NavItem[] {
  return [
    { href: "/university-admin", label: t.nav.universityDashboard, icon: Landmark },
    { href: "/admin/opportunities", label: t.nav.opportunities, icon: ClipboardCheck },
    { href: "/settings", label: t.nav.settings, icon: Settings },
  ];
}

/**
 * The navigation for one role. Roles never inherit another role's items — an
 * admin gets the admin list and nothing else.
 */
export function getNavForRole(role: string | null | undefined, t: Translations): NavItem[] {
  switch (role) {
    case "admin":
    case "super_admin":
      return adminNav(t);
    case "mentor":
      return mentorNav(t);
    case "university_admin":
      return universityAdminNav(t);
    case "student":
    default:
      return studentNav(t);
  }
}
