import type { Role } from "./roles";

/** Pure so ownership logic can be unit tested without touching Express or the DB. */
export function canAccessUniversity(params: {
  role: Role;
  ownedUniversityIds: number[];
  targetUniversityId: number;
}): boolean {
  const { role, ownedUniversityIds, targetUniversityId } = params;
  if (role === "admin" || role === "super_admin") return true;
  return ownedUniversityIds.includes(targetUniversityId);
}
