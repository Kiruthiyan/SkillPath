import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import "../load-env";
import { db } from "./client";
import {
  universitiesTable,
  degreeProgrammesTable,
  admissionCutoffsTable,
  handbookEditionsTable,
  coursesTable,
} from "./schema/index";
import { eq, and } from "drizzle-orm";
import {
  finalizeCourseAvailabilityForYear,
  getOrCreateHandbookSourceForEdition,
  markCourseAvailable,
  upsertAcademicYearRecord,
} from "./year-modeling";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../data/handbooks");

interface HandbookRow {
  academicYear: string;
  university: string;
  universityShortName?: string;
  degreeName: string;
  faculty: string;
  stream: string;
  district: string;
  minimumZScore: number;
  durationYears: number;
  degreeType?: string;
  description?: string;
  sourcePage?: number;
}

interface HandbookFile {
  academicYear: string;
  sourceUrl?: string;
  programmes: HandbookRow[];
}

function parseArgs(): { year?: string; all: boolean } {
  const args = process.argv.slice(2);
  let year: string | undefined;
  let all = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--year" && args[i + 1]) {
      year = args[++i].replace(/-/g, "_");
    }
    if (args[i] === "--all") all = true;
  }
  return { year, all };
}

function loadHandbookFile(filename: string): HandbookFile {
  const raw = readFileSync(join(DATA_DIR, filename), "utf-8");
  const parsed = JSON.parse(raw) as HandbookFile | HandbookRow[];

  if (Array.isArray(parsed)) {
    const academicYear = parsed[0]?.academicYear ?? "unknown";
    return { academicYear, programmes: parsed };
  }
  return parsed;
}

async function upsertUniversity(
  name: string,
  shortName?: string,
): Promise<number> {
  const [existing] = await db
    .select()
    .from(universitiesTable)
    .where(eq(universitiesTable.name, name))
    .limit(1);

  if (existing) {
    if (shortName && existing.shortName !== shortName) {
      await db
        .update(universitiesTable)
        .set({ shortName })
        .where(eq(universitiesTable.id, existing.id));
    }
    return existing.id;
  }

  const [inserted] = await db
    .insert(universitiesTable)
    .values({
      name,
      shortName: shortName ?? name.split(" ").pop() ?? name,
      location: "Sri Lanka",
      foundedYear: 1970,
      logoColor: "#1e3a5f",
      ranking: 99,
      description: null,
    })
    .returning({ id: universitiesTable.id });

  return inserted.id;
}

async function upsertProgramme(
  universityId: number,
  row: HandbookRow,
): Promise<number> {
  const degreeType = row.degreeType ?? inferDegreeType(row.degreeName);

  const [existing] = await db
    .select()
    .from(degreeProgrammesTable)
    .where(
      and(
        eq(degreeProgrammesTable.universityId, universityId),
        eq(degreeProgrammesTable.degreeName, row.degreeName),
        eq(degreeProgrammesTable.stream, row.stream),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(degreeProgrammesTable)
      .set({
        faculty: row.faculty,
        degreeType,
        durationYears: row.durationYears,
        description: row.description ?? existing.description,
      })
      .where(eq(degreeProgrammesTable.id, existing.id));
    return existing.id;
  }

  const [inserted] = await db
    .insert(degreeProgrammesTable)
    .values({
      universityId,
      degreeName: row.degreeName,
      faculty: row.faculty,
      degreeType,
      durationYears: row.durationYears,
      stream: row.stream,
      description: row.description ?? null,
    })
    .returning({ id: degreeProgrammesTable.id });

  return inserted.id;
}

function inferDegreeType(degreeName: string): string {
  const lower = degreeName.toLowerCase();
  if (lower.includes("b.sc") || lower.includes("bsc")) return "Science";
  if (lower.includes("b.com") || lower.includes("bcom")) return "Commerce";
  if (lower.includes("b.a") || lower.includes("ba ")) return "Arts";
  if (lower.includes("b.tech") || lower.includes("btech")) return "Technology";
  if (lower.includes("medicine") || lower.includes("mbbs")) return "Medicine";
  if (lower.includes("engineering")) return "Engineering";
  return "General";
}

async function syncCourseAdapter(
  programmeId: number,
  universityId: number,
  row: HandbookRow,
  minimumZScore: number,
) {
  const degreeType = row.degreeType ?? inferDegreeType(row.degreeName);

  const [existing] = await db
    .select()
    .from(coursesTable)
    .where(eq(coursesTable.programmeId, programmeId))
    .limit(1);

  const values = {
    universityId,
    degreeName: row.degreeName,
    faculty: row.faculty,
    degreeType,
    durationYears: row.durationYears,
    minimumZScore,
    stream: row.stream,
    description: row.description ?? null,
    programmeId,
  };

  if (existing) {
    await db
      .update(coursesTable)
      .set(values)
      .where(eq(coursesTable.id, existing.id));
    return existing.id;
  }

  const [inserted] = await db
    .insert(coursesTable)
    .values(values)
    .returning({ id: coursesTable.id });

  return inserted.id;
}

async function importEdition(file: HandbookFile) {
  const { academicYear, sourceUrl, programmes } = file;

  const [existingEdition] = await db
    .select()
    .from(handbookEditionsTable)
    .where(eq(handbookEditionsTable.academicYear, academicYear))
    .limit(1);

  let editionId: number;
  if (existingEdition) {
    editionId = existingEdition.id;
    await db
      .delete(admissionCutoffsTable)
      .where(eq(admissionCutoffsTable.editionId, editionId));
  } else {
    const [inserted] = await db
      .insert(handbookEditionsTable)
      .values({
        academicYear,
        sourceUrl: sourceUrl ?? null,
      })
      .returning({ id: handbookEditionsTable.id });
    editionId = inserted.id;
  }

  const sourceHandbookId = await getOrCreateHandbookSourceForEdition({
    editionId,
    academicYear,
    sourceUrl,
  });

  await upsertAcademicYearRecord(academicYear, sourceHandbookId, true);

  let imported = 0;
  const programmeCache = new Map<string, number>();
  const availableProgrammeIds = new Set<number>();
  const sourcePageByProgrammeId = new Map<number, number | null>();

  for (const row of programmes) {
    const uniKey = row.university;
    let universityId: number;
    if (programmeCache.has(`uni:${uniKey}`)) {
      universityId = programmeCache.get(`uni:${uniKey}`)!;
    } else {
      universityId = await upsertUniversity(
        row.university,
        row.universityShortName,
      );
      programmeCache.set(`uni:${uniKey}`, universityId);
    }

    const progKey = `${universityId}:${row.degreeName}:${row.stream}`;
    let programmeId: number;
    if (programmeCache.has(progKey)) {
      programmeId = programmeCache.get(progKey)!;
    } else {
      programmeId = await upsertProgramme(universityId, row);
      programmeCache.set(progKey, programmeId);
    }

    await db.insert(admissionCutoffsTable).values({
      programmeId,
      editionId,
      district: row.district,
      minimumZScore: row.minimumZScore,
    });

    await markCourseAvailable(programmeId, academicYear, sourceHandbookId, row.sourcePage ?? null);
    availableProgrammeIds.add(programmeId);
    sourcePageByProgrammeId.set(programmeId, row.sourcePage ?? null);

    if (row.district === "All Island") {
      await syncCourseAdapter(programmeId, universityId, row, row.minimumZScore);
    }

    imported++;
  }

  await finalizeCourseAvailabilityForYear({
    academicYear,
    availableProgrammeIds,
    sourceHandbookId,
    sourcePageByProgrammeId,
  });

  console.log(
    `Imported ${imported} cutoff rows for handbook ${academicYear} (edition ${editionId})`,
  );
}

async function main() {
  const { year, all } = parseArgs();

  if (!existsSync(DATA_DIR)) {
    console.error(`Handbook data directory not found: ${DATA_DIR}`);
    process.exit(1);
  }

  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));

  if (files.length === 0) {
    console.error("No handbook JSON files found in", DATA_DIR);
    process.exit(1);
  }

  const toImport = all
    ? files
    : year
      ? files.filter((f) => f.replace(".json", "") === year)
      : [files.sort().reverse()[0]];

  if (toImport.length === 0) {
    console.error(`No handbook file found for year: ${year}`);
    process.exit(1);
  }

  for (const file of toImport.sort()) {
    console.log(`Importing ${file}...`);
    const data = loadHandbookFile(file);
    await importEdition(data);
  }

  console.log("Handbook import complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
