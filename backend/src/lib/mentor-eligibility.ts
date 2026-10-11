/**
 * Student-visible / bookable mentors must satisfy ALL of:
 * - verificationStatus === "verified"
 * - isAcceptingStudents === true
 * - users.role === "mentor"
 * - users.isActive === true
 *
 * Suspended / rejected / pending never qualify (they are not "verified").
 */

export type MentorEligibilityInput = {
  verificationStatus: string;
  isAcceptingStudents: boolean;
  role: string;
  isActive: boolean;
};

export function isStudentVisibleMentor(row: MentorEligibilityInput): boolean {
  return (
    row.verificationStatus === "verified" &&
    row.isAcceptingStudents === true &&
    row.role === "mentor" &&
    row.isActive === true
  );
}

/** Allowed admin actions for a mentor profile row (UI + docs contract). */
export function adminMentorActions(row: {
  verificationStatus: string;
  isAcceptingStudents: boolean;
}): {
  canVerify: boolean;
  canActivate: boolean;
  canSuspend: boolean;
  canReject: boolean;
} {
  const status = row.verificationStatus;
  return {
    canVerify: status !== "verified",
    canActivate: status === "verified" && !row.isAcceptingStudents,
    canSuspend: status === "verified",
    canReject: status !== "rejected",
  };
}
