/**
 * Kept as a re-export so existing imports keep working. The role-to-route map
 * now lives in `@/lib/rbac` alongside the per-role navigation, so a role can
 * only be added in one place.
 */
export { ROLE_DASHBOARD_PATH, getDashboardPath, UNKNOWN_ROLE_PATH } from "@/lib/rbac";
export type { Role } from "@/lib/rbac";
