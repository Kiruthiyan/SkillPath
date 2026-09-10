import { z } from "zod/v4";

export const ROLES = ["user", "mentor", "university_admin", "admin", "super_admin"] as const;
export type Role = (typeof ROLES)[number];
export const roleSchema = z.enum(ROLES);

/** Roles a plain "admin" (not super_admin) is permitted to assign to another user. */
export const ADMIN_ASSIGNABLE_ROLES = ["user", "mentor", "university_admin"] as const;
