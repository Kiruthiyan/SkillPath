import { eq, and, inArray, asc, or, isNull, sql } from "drizzle-orm";
import { db } from "./client";
import {
  degreeProgrammesTable,
  universitiesTable,
  subjectRequirementsTable,
  admissionRulesTable,
  admissionCutoffsTable,
  handbookEditionsTable,
  type DegreeProgrammeTranslations,
  type UniversityTranslations,
} from "./schema/index";
import type { HistoricalCutoffPoint } from "./estimate";
import { chooseApplicableYearRows } from "./eligibility-year-scope";
import { VERIFIED_CUTOFF_STATUSES } from "./verified-cutoffs";

export type CheckerLanguage = "en" | "si" | "ta";

export interface CheckerProgramme {
  id: number;
  universityId: number;
  universityName: string;
  degreeName: string;
  faculty: string;
  degreeType: string;
  durationYears: number;
  stream: string;
}

function translate(base: string, translations: unknown, field: string, lang: CheckerLanguage): string {
  if (lang === "en" || !translations || typeof translations !== "object") return base;
  const entry = (translations as Record<string, unknown>)[lang];
  if (!entry || typeof entry !== "object") return base;
  const value = (entry as Record<string, unknown>)[field];
  return typeof value === "string" && value.length > 0 ? value : base;
}

export async function listCheckerProgrammes(opts: {
  stream?: string;
  district?: string;
  universityId?: number;
  lang?: CheckerLanguage;
}): Promise<CheckerProgramme[]> {
  const lang = opts.lang ?? "en";
  const conditions = [];
  if (opts.stream) conditions.push(sql`lower(${degreeProgrammesTable.stream}) = lower(${opts.stream})`);
  if (opts.universityId) conditions.push(eq(degreeProgrammesTable.universityId, opts.universityId));

  let query = db
    .select({
      id: degreeProgrammesTable.id,
      universityId: degreeProgrammesTable.universityId,
      universityName: universitiesTable.name,
      universityTranslations: universitiesTable.translations,
      degreeName: degreeProgrammesTable.degreeName,
      faculty: degreeProgrammesTable.faculty,
      degreeType: degreeProgrammesTable.degreeType,
      durationYears: degreeProgrammesTable.durationYears,
      stream: degreeProgrammesTable.stream,
      translations: degreeProgrammesTable.translations,
    })
    .from(degreeProgrammesTable)
    .leftJoin(universitiesTable, eq(degreeProgrammesTable.universityId, universitiesTable.id))
    .orderBy(asc(degreeProgrammesTable.degreeName))
    .$dynamic();

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const rows = await query;

  return rows.map((row) => ({
    id: row.id,
    universityId: row.universityId,
    universityName: translate(row.universityName ?? "", row.universityTranslations, "name", lang),
    degreeName: translate(row.degreeName, row.translations, "degreeName", lang),
    faculty: translate(row.faculty, row.translations, "faculty", lang),
    degreeType: row.degreeType,
    durationYears: row.durationYears,
    stream: row.stream,
  }));
}

export async function getVerifiedCutoffHistory(
  programmeId: number,
  district: string,
): Promise<HistoricalCutoffPoint[]> {
  const rows = await db
    .select({
      academicYear: handbookEditionsTable.academicYear,
      minimumZScore: admissionCutoffsTable.minimumZScore,
    })
    .from(admissionCutoffsTable)
    .innerJoin(handbookEditionsTable, eq(admissionCutoffsTable.editionId, handbookEditionsTable.id))
    .where(
      and(
        eq(admissionCutoffsTable.programmeId, programmeId),
        eq(admissionCutoffsTable.district, district),
        inArray(admissionCutoffsTable.verifiedStatus, [...VERIFIED_CUTOFF_STATUSES]),
      ),
    )
    .orderBy(asc(handbookEditionsTable.academicYear));

  return rows;
}

export async function getCheckerProgrammeDetail(
  programmeId: number,
  lang: CheckerLanguage = "en",
  academicYear?: string,
) {
  const [row] = await db
    .select({
      id: degreeProgrammesTable.id,
      universityId: degreeProgrammesTable.universityId,
      universityName: universitiesTable.name,
      universityTranslations: universitiesTable.translations,
      degreeName: degreeProgrammesTable.degreeName,
      faculty: degreeProgrammesTable.faculty,
      degreeType: degreeProgrammesTable.degreeType,
      durationYears: degreeProgrammesTable.durationYears,
      stream: degreeProgrammesTable.stream,
      description: degreeProgrammesTable.description,
      translations: degreeProgrammesTable.translations,
    })
    .from(degreeProgrammesTable)
    .leftJoin(universitiesTable, eq(degreeProgrammesTable.universityId, universitiesTable.id))
    .where(eq(degreeProgrammesTable.id, programmeId));

  if (!row) return null;

  const subjectConditions = [eq(subjectRequirementsTable.programmeId, programmeId)];
  if (academicYear) {
    subjectConditions.push(
      or(
        eq(subjectRequirementsTable.academicYear, academicYear),
        isNull(subjectRequirementsTable.academicYear),
      )!,
    );
  }

  const subjectRequirements = await db
    .select({
      id: subjectRequirementsTable.id,
      academicYear: subjectRequirementsTable.academicYear,
      requirementType: subjectRequirementsTable.requirementType,
      groupKey: subjectRequirementsTable.groupKey,
      subjectName: subjectRequirementsTable.subjectName,
      minimumGrade: subjectRequirementsTable.minimumGrade,
      sourceEditionId: subjectRequirementsTable.sourceEditionId,
      sourceHandbookId: subjectRequirementsTable.sourceHandbookId,
      sourcePage: subjectRequirementsTable.sourcePage,
    })
    .from(subjectRequirementsTable)
    .where(and(...subjectConditions));

  const ruleConditions = [eq(admissionRulesTable.programmeId, programmeId)];
  if (academicYear) {
    ruleConditions.push(
      or(
        eq(admissionRulesTable.academicYear, academicYear),
        isNull(admissionRulesTable.academicYear),
      )!,
    );
  }

  const admissionRules = await db
    .select({
      id: admissionRulesTable.id,
      academicYear: admissionRulesTable.academicYear,
      ruleType: admissionRulesTable.ruleType,
      description: admissionRulesTable.description,
      translations: admissionRulesTable.translations,
      blocksEligibility: admissionRulesTable.blocksEligibility,
      sourceEditionId: admissionRulesTable.sourceEditionId,
      sourceHandbookId: admissionRulesTable.sourceHandbookId,
      sourcePage: admissionRulesTable.sourcePage,
    })
    .from(admissionRulesTable)
    .where(and(...ruleConditions));

  const applicableSubjectRequirements = chooseApplicableYearRows(subjectRequirements, academicYear);
  const applicableAdmissionRules = chooseApplicableYearRows(admissionRules, academicYear);

  return {
    id: row.id,
    universityId: row.universityId,
    universityName: translate(row.universityName ?? "", row.universityTranslations, "name", lang),
    degreeName: translate(row.degreeName, row.translations, "degreeName", lang),
    faculty: translate(row.faculty, row.translations, "faculty", lang),
    degreeType: row.degreeType,
    durationYears: row.durationYears,
    stream: row.stream,
    description: translate(row.description ?? "", row.translations, "description", lang),
    subjectRequirements: applicableSubjectRequirements,
    admissionRules: applicableAdmissionRules.map((rule) => ({
      ...rule,
      description:
        lang === "en" ? rule.description : rule.translations?.[lang] ?? rule.description,
    })),
  };
}

export type { DegreeProgrammeTranslations, UniversityTranslations };
