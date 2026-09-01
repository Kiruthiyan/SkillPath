import { describe, expect, it } from "vitest";
import { isPublicVerifiedCutoffStatus, VERIFIED_CUTOFF_STATUSES } from "./verified-cutoffs";

describe("verified cutoff statuses", () => {
  it("allows only cutoff statuses that can be used in public results", () => {
    expect(VERIFIED_CUTOFF_STATUSES).toEqual(["legacy_verified", "verified"]);
    expect(isPublicVerifiedCutoffStatus("legacy_verified")).toBe(true);
    expect(isPublicVerifiedCutoffStatus("verified")).toBe(true);
    expect(isPublicVerifiedCutoffStatus("rejected")).toBe(false);
    expect(isPublicVerifiedCutoffStatus("pending")).toBe(false);
  });
});
