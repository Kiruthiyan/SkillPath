import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import "../load-env";
import { db } from "./client";
import { extractionBatchesTable, extractedProgrammeRowsTable } from "./schema/index";
import { eq, and } from "drizzle-orm";
import { computeMatchedCanonicalKey } from "./matched-canonical-key";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STAGING_DIR = join(__dirname, "../../data/handbooks/staging");

interface StagedRow {
  // A row's own academic year, which can differ from the file's: Section 9
  // cutoff rows cover the *previous* academic year relative to the
  // handbook's own (Section 2) edition year. Falls back to the file-level
  // academicYear when absent (older single-year staging files).
  academicYear?: string;
  university: string;
  degreeName: string;
  faculty?: string;
  stream?: string;
  district?: string;
  minimumZScore?: number;
  zscoreMarker?: string;
  durationYears?: number;
  degreeType?: string;
  description?: string;
  subjectsRaw?: unknown;
  rulesRaw?: unknown;
  sourcePage?: number;
  uniCode?: string;
  sourceSection?: string;
  verificationStatus?: string;
}

interface StagedFile {
  academicYear: string;
  language: string;
  sourceFileName?: string;
  programmes: StagedRow[];
}

function normalizeVerificationStatus(status: string | undefined): "clean" | "needs_review" {
  return status === "needs_review" ? "needs_review" : "clean";
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function parseArgs(): { year?: string; lang?: string } {
  const args = process.argv.slice(2);
  let year: string | undefined;
  let lang: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--year" && args[i + 1]) year = args[++i];
    if (args[i] === "--lang" && args[i + 1]) lang = args[++i];
  }
  return { year, lang };
}

async function getOrCreateBatch(
  academicYear: string,
  language: string,
  sourceFileName: string,
): Promise<number> {
  // Keyed on sourceFileName too, not just (academicYear, language): a single
  // handbook PDF's Section 9 cutoffs share their academicYear (the previous
  // year) with a *different* PDF's own Section 2 catalog edition. Matching
  // on (academicYear, language) alone collided those into one batch and
  // silently deleted the other file's rows on restage.
  const [existingBatch] = await db
    .select()
    .from(extractionBatchesTable)
    .where(
      and(
        eq(extractionBatchesTable.academicYear, academicYear),
        eq(extractionBatchesTable.language, language),
        eq(extractionBatchesTable.sourceFileName, sourceFileName),
      ),
    );

  if (existingBatch) {
    await db
      .delete(extractedProgrammeRowsTable)
      .where(eq(extractedProgrammeRowsTable.batchId, existingBatch.id));
    await db
      .update(extractionBatchesTable)
      .set({ status: "pending_review", submittedAt: new Date() })
      .where(eq(extractionBatchesTable.id, existingBatch.id));
    return existingBatch.id;
  }

  const [inserted] = await db
    .insert(extractionBatchesTable)
    .values({ academicYear, language, sourceFileName })
    .returning({ id: extractionBatchesTable.id });
  return inserted.id;
}

async function stageFile(filePath: string, fileName: string) {
  const raw = readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw) as StagedFile;
  const { language, programmes } = data;
  const sourceFileName = data.sourceFileName ?? fileName;

  // A single handbook PDF can produce rows spanning two distinct academic
  // years (Section 2's own edition year and Section 9's previous-year
  // cutoffs) — group by each row's own academic year into separate batches
  // rather than assuming the whole file is one year.
  const rowsByYear = new Map<string, StagedRow[]>();
  for (const row of programmes) {
    const year = row.academicYear ?? data.academicYear;
    if (!rowsByYear.has(year)) rowsByYear.set(year, []);
    rowsByYear.get(year)!.push(row);
  }

  for (const [academicYear, rows] of rowsByYear) {
    const batchId = await getOrCreateBatch(academicYear, language, sourceFileName);
    const values = rows.map((row) => {
      const matchedCanonicalKey = computeMatchedCanonicalKey({
        academicYear,
        university: row.university,
        stream: row.stream ?? "",
        degreeName: row.degreeName,
        district: row.district ?? "All Island",
        minimumZScore: row.minimumZScore,
      });

      return {
        batchId,
        academicYear,
        rawUniversityName: row.university,
        rawDegreeName: row.degreeName,
        faculty: row.faculty ?? null,
        stream: row.stream ?? null,
        district: row.district ?? null,
        minimumZScore: row.minimumZScore ?? null,
        zscoreMarker: row.zscoreMarker ?? null,
        durationYears: row.durationYears ?? null,
        degreeType: row.degreeType ?? null,
        description: row.description ?? null,
        subjectsRaw: row.subjectsRaw ?? null,
        rulesRaw: row.rulesRaw ?? null,
        sourcePage: row.sourcePage ?? null,
        uniCode: row.uniCode ?? null,
        sourceSection: row.sourceSection ?? null,
        matchedCanonicalKey,
        verificationStatus: normalizeVerificationStatus(row.verificationStatus),
      };
    });

    for (const batch of chunks(values, 500)) {
      await db.insert(extractedProgrammeRowsTable).values(batch);
    }

    console.log(`Staged ${rows.length} rows from ${fileName} (batch ${batchId}, ${academicYear}/${language}).`);
  }
}

async function main() {
  const { year, lang } = parseArgs();

  if (!existsSync(STAGING_DIR)) {
    console.error(`Staging directory not found: ${STAGING_DIR}`);
    process.exit(1);
  }

  const files = readdirSync(STAGING_DIR).filter((f) => f.endsWith(".json"));
  const toStage = files.filter((f) => {
    if (year && !f.startsWith(`${year}_`)) return false;
    if (lang && !f.endsWith(`_${lang}.json`)) return false;
    return true;
  });

  if (toStage.length === 0) {
    console.error("No matching staging files found in", STAGING_DIR);
    process.exit(1);
  }

  for (const file of toStage.sort()) {
    await stageFile(join(STAGING_DIR, file), file);
  }

  console.log("Staging complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
