import type { Role } from "./roles";

export type OpportunityStatus =
  | "draft"
  | "pending_verification"
  | "verified"
  | "published"
  | "unpublished"
  | "archived";

/**
 * Pure so the publish-workflow rules can be unit tested without touching Express or the DB.
 * admin/super_admin may move an opportunity through any status. A university_admin who owns
 * the opportunity may only submit it for review (draft -> pending_verification) — they can
 * never self-publish, matching the verification-gate pattern already used for universities.
 */
export function canTransitionOpportunityStatus(params: {
  role: Role;
  isOwner: boolean;
  from: OpportunityStatus;
  to: OpportunityStatus;
}): boolean {
  const { role, isOwner, from, to } = params;
  if (role === "admin" || role === "super_admin") return true;
  if (role === "university_admin" && isOwner) {
    return from === "draft" && to === "pending_verification";
  }
  return false;
}
