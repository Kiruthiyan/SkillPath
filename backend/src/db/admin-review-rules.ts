export type ExtractedRowApprovalState = {
  status: string;
  verificationStatus: string;
};

export function isBulkApprovableExtractedRow(row: ExtractedRowApprovalState) {
  return row.status === "pending" && row.verificationStatus === "clean";
}
