/**
 * Minimal JWT payload reader. This is a user-experience guard only: it lets the
 * app send an obviously expired session to the login page instead of flashing a
 * protected page and then failing every request. The server remains the only
 * authority on whether a token is valid — never trust these claims for access
 * decisions.
 */

function decodePayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Seconds-since-epoch expiry, or null when the token has no readable `exp`. */
export function getTokenExpiry(token: string): number | null {
  const payload = decodePayload(token);
  const exp = payload?.exp;
  return typeof exp === "number" ? exp : null;
}

/**
 * True only when the token is readable and its `exp` has passed. An
 * unparseable token returns false: the server rejects it anyway, and guessing
 * here would sign out users over a decoding quirk.
 */
export function isTokenExpired(token: string | null | undefined): boolean {
  if (!token) return false;
  const exp = getTokenExpiry(token);
  if (exp === null) return false;
  return exp * 1000 <= Date.now();
}
