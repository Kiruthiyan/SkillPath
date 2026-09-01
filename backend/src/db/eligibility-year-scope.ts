export interface YearScopedRow {
  programmeId: number;
  academicYear: string | null;
}

export function chooseApplicableYearRows<T extends { academicYear: string | null }>(
  rows: T[],
  academicYear?: string,
): T[] {
  if (!academicYear) {
    return rows;
  }

  const exactRows = rows.filter((row) => row.academicYear === academicYear);
  return exactRows.length > 0 ? exactRows : rows.filter((row) => row.academicYear == null);
}

export function groupApplicableYearRows<T extends YearScopedRow>(
  rows: T[],
  programmeIds: number[],
  academicYear: string,
): Map<number, T[]> {
  const grouped = new Map<number, T[]>();
  for (const programmeId of programmeIds) {
    const programmeRows = rows.filter((row) => row.programmeId === programmeId);
    grouped.set(programmeId, chooseApplicableYearRows(programmeRows, academicYear));
  }
  return grouped;
}
