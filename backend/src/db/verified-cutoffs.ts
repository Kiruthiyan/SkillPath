export const VERIFIED_CUTOFF_STATUSES = ["legacy_verified", "verified"] as const;

export function isPublicVerifiedCutoffStatus(status: string) {
  return (VERIFIED_CUTOFF_STATUSES as readonly string[]).includes(status);
}
