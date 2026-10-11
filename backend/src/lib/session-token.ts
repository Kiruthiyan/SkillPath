/**
 * Pure helpers for session token validity. Kept out of the auth middleware so
 * they can be unit tested without a database connection.
 */

export interface VersionedTokenPayload {
  /**
   * Token version at issue time. Absent on tokens minted before this claim
   * existed; those count as version 0, matching the column default.
   */
  tv?: number;
}

/**
 * A token is stale when it was issued before the account's most recent password
 * change, which bumps `users.token_version`.
 */
export function isSessionTokenStale(
  payload: VersionedTokenPayload,
  currentVersion: number,
): boolean {
  return (payload.tv ?? 0) !== currentVersion;
}
