/**
 * Shared password rules. Kept as pure functions so both the API routes and the
 * unit tests can use them without a database.
 */

export const PASSWORD_MIN_LENGTH = 8;

/** bcrypt silently ignores bytes past 72, so anything longer is a false sense of strength. */
export const PASSWORD_MAX_LENGTH = 72;

export type PasswordPolicyFailure =
  | "too_short"
  | "too_long"
  | "same_as_current"
  | "confirmation_mismatch";

export interface PasswordPolicyResult {
  ok: boolean;
  failure?: PasswordPolicyFailure;
  message?: string;
}

const MESSAGES: Record<PasswordPolicyFailure, string> = {
  too_short: `New password must be at least ${PASSWORD_MIN_LENGTH} characters long.`,
  too_long: `New password must be at most ${PASSWORD_MAX_LENGTH} characters long.`,
  same_as_current: "New password must be different from your current password.",
  confirmation_mismatch: "New password and confirmation do not match.",
};

function fail(failure: PasswordPolicyFailure): PasswordPolicyResult {
  return { ok: false, failure, message: MESSAGES[failure] };
}

export function checkNewPassword(input: {
  newPassword: string;
  currentPassword?: string;
  confirmPassword?: string;
}): PasswordPolicyResult {
  const { newPassword, currentPassword, confirmPassword } = input;

  if (newPassword.length < PASSWORD_MIN_LENGTH) return fail("too_short");
  if (Buffer.byteLength(newPassword, "utf8") > PASSWORD_MAX_LENGTH) return fail("too_long");
  if (currentPassword !== undefined && newPassword === currentPassword) {
    return fail("same_as_current");
  }
  if (confirmPassword !== undefined && newPassword !== confirmPassword) {
    return fail("confirmation_mismatch");
  }

  return { ok: true };
}
