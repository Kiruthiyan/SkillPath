import { describe, it, expect } from "vitest";
import { checkNewPassword, PASSWORD_MIN_LENGTH } from "./password-policy";
import { isSessionTokenStale } from "./session-token";

describe("checkNewPassword", () => {
  it("accepts a password at the minimum length", () => {
    expect(checkNewPassword({ newPassword: "a".repeat(PASSWORD_MIN_LENGTH) }).ok).toBe(true);
  });

  it("rejects a password below the minimum length", () => {
    const result = checkNewPassword({ newPassword: "a".repeat(PASSWORD_MIN_LENGTH - 1) });
    expect(result.ok).toBe(false);
    expect(result.failure).toBe("too_short");
  });

  it("rejects a password longer than bcrypt's 72-byte limit", () => {
    const result = checkNewPassword({ newPassword: "a".repeat(73) });
    expect(result.ok).toBe(false);
    expect(result.failure).toBe("too_long");
  });

  it("counts bytes, not characters, against the maximum", () => {
    // 25 four-byte emoji = 100 bytes, but only 50 UTF-16 code units.
    const result = checkNewPassword({ newPassword: "😀".repeat(25) });
    expect(result.ok).toBe(false);
    expect(result.failure).toBe("too_long");
  });

  it("rejects reusing the current password", () => {
    const result = checkNewPassword({
      newPassword: "correct horse",
      currentPassword: "correct horse",
    });
    expect(result.ok).toBe(false);
    expect(result.failure).toBe("same_as_current");
  });

  it("rejects a confirmation that does not match", () => {
    const result = checkNewPassword({
      newPassword: "correct horse",
      confirmPassword: "correct horsr",
    });
    expect(result.ok).toBe(false);
    expect(result.failure).toBe("confirmation_mismatch");
  });

  it("accepts a valid change with current and confirmation supplied", () => {
    expect(
      checkNewPassword({
        newPassword: "correct horse",
        currentPassword: "battery staple",
        confirmPassword: "correct horse",
      }).ok,
    ).toBe(true);
  });
});

describe("isSessionTokenStale", () => {
  it("accepts a token whose version matches the account", () => {
    expect(isSessionTokenStale({ tv: 3 }, 3)).toBe(false);
  });

  it("rejects a token issued before the latest password change", () => {
    expect(isSessionTokenStale({ tv: 2 }, 3)).toBe(true);
  });

  it("treats a token minted before the claim existed as version 0", () => {
    expect(isSessionTokenStale({}, 0)).toBe(false);
    expect(isSessionTokenStale({}, 1)).toBe(true);
  });
});
