export interface AvailabilityStatus {
  programmeId: number;
  available: boolean;
}

export function buildCourseAvailabilityStatuses(
  programmeIds: number[],
  availableProgrammeIds: Iterable<number>,
): AvailabilityStatus[] {
  const available = new Set(availableProgrammeIds);
  return programmeIds.map((programmeId) => ({
    programmeId,
    available: available.has(programmeId),
  }));
}
