import { describe, expect, it } from "vitest";
import { isBulkApprovableExtractedRow } from "./admin-review-rules";

describe("isBulkApprovableExtractedRow", () => {
  it("allows only pending clean rows", () => {
    expect(isBulkApprovableExtractedRow({ status: "pending", verificationStatus: "clean" })).toBe(true);
  });

  it("blocks pending rows that need manual review", () => {
    expect(isBulkApprovableExtractedRow({ status: "pending", verificationStatus: "needs_review" })).toBe(false);
  });

  it("blocks clean rows that are no longer pending", () => {
    expect(isBulkApprovableExtractedRow({ status: "approved", verificationStatus: "clean" })).toBe(false);
  });
});
