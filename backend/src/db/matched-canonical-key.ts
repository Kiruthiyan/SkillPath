/**
 * Computes the key used to group the same admissions row extracted from
 * three different language handbooks (English/Sinhala/Tamil) into one
 * canonical record for admin review. Since all three PDFs describe the
 * same admissions table for a given year, rows align structurally even
 * when text fields are in different scripts.
 *
 * Primary key: academicYear + university + stream + degree abbreviation +
 * district — all fields expected to already be normalized to a canonical
 * English label by the extraction alias maps (stream-map.json,
 * district-map.json, university-map.json) before this is called.
 *
 * Fallback key: when the degree name can't be resolved to a comparable
 * abbreviation (e.g. spelled out only in Sinhala/Tamil script with no
 * Latin-script abbreviation present), fall back to matching on
 * (university, district, minimumZScore) — the Z-score for the same
 * programme/district/year is identical across all three language
 * handbooks, making it the strongest available cross-language signal.
 * This is a pragmatic heuristic, not entity resolution — the admin
 * review UI groups rows by this key so a human confirms the grouping
 * before anything is promoted to live data.
 */

const DEGREE_ABBREV_RE = /(B\.?Sc\.?|B\.?A\.?|B\.?Com\.?|B\.?Tech\.?|MBBS|B\.?Eng\.?)/i;

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function extractDegreeAbbreviation(degreeName: string): string | null {
  const match = degreeName.match(DEGREE_ABBREV_RE);
  if (!match) return null;
  return normalize(match[1]).replace(/\./g, "");
}

export interface CanonicalKeyInput {
  academicYear: string;
  university: string;
  stream: string;
  degreeName: string;
  district: string;
  minimumZScore?: number | null;
}

export function computeMatchedCanonicalKey(input: CanonicalKeyInput): string {
  const base = [normalize(input.academicYear), normalize(input.university), normalize(input.stream)];

  const degreeAbbrev = extractDegreeAbbreviation(input.degreeName);
  if (degreeAbbrev) {
    return [...base, degreeAbbrev, normalize(input.district)].join("|");
  }

  // Fallback: no comparable degree abbreviation found (e.g. degree name is
  // only present in local script) — match on university+district+z-score,
  // which is invariant across the three language handbooks for the same row.
  const zscoreKey =
    input.minimumZScore != null && !Number.isNaN(input.minimumZScore)
      ? input.minimumZScore.toFixed(3)
      : "unknown";
  return [...base, "zscore", normalize(input.district), zscoreKey].join("|");
}
