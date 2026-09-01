export type ProgrammeMatchReason =
  | "formatting_difference"
  | "stream_suffix_prefix_difference"
  | "course_name_mismatch"
  | "duplicate_alias_candidate"
  | "manual_review";

export interface ProgrammeMatchCandidate {
  programmeId: number;
  universityId: number;
  academicYear: string;
  degreeName: string;
}

export interface ProgrammeMatchSuggestion {
  programmeId: number;
  aliasName: string;
  matchedName: string;
  confidence: number;
  matchReason: ProgrammeMatchReason;
}

export interface ProgrammeMatchResult {
  status: "high_confidence" | "medium_confidence" | "low_confidence" | "duplicate_alias_candidate";
  suggestion: ProgrammeMatchSuggestion | null;
  candidates: ProgrammeMatchSuggestion[];
  reason: ProgrammeMatchReason;
}

const MEDIUM_CONFIDENCE_THRESHOLD = 75;
const GENERIC_ALIASES = new Set([
  "architecture",
  "arts",
  "biologicalscience",
  "commerce",
  "engineering",
  "law",
  "management",
  "medicine",
  "music",
  "physicalscience",
  "science",
]);

const INITIAL_STOPWORDS = new Set(["a", "an", "and", "as", "for", "in", "of", "the"]);
const TRAILING_QUALIFIERS = new Set(["honours", "hons", "degree", "programme", "program"]);
const TRUSTED_ABBREVIATIONS = new Set(["bis", "bst", "et", "ict", "it", "tesl"]);

function normalizeBase(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\+/g, " and ")
    .replace(/\bfresh\s+water\b/g, "freshwater")
    .replace(/\bsri\s+lanaka\b/g, "sri lanka")
    .replace(/\binformation\s+communication\b/g, "information and communication")
    .replace(/\bhonours\b/g, "honours")
    .replace(/\bhonors\b/g, "honours");
}

function stripDegreePrefix(value: string) {
  return value
    .replace(/\bb\.?\s*sc\.?\s*(?:\(?hons?\)?|honours)?\s*(?:degree)?\s*(?:in)?\b/g, " ")
    .replace(/\bb\.?\s*a\.?\s*(?:\(?hons?\)?|honours)?\s*(?:degree)?\s*(?:in)?\b/g, " ")
    .replace(/\bb\.?\s*com\.?\s*(?:\(?hons?\)?|honours)?\s*(?:degree)?\s*(?:in)?\b/g, " ")
    .replace(/\bb\.?\s*tech\.?\s*(?:\(?hons?\)?|honours)?\s*(?:degree)?\s*(?:in)?\b/g, " ")
    .replace(/\bbachelor of science(?: honours?)?\s*(?:degree)?\s*(?:in)?\b/g, " ")
    .replace(/\bbachelor of arts(?: honours?)?\s*(?:degree)?\s*(?:in)?\b/g, " ")
    .replace(/\bbachelor of commerce(?: honours?)?\s*(?:degree)?\s*(?:in)?\b/g, " ")
    .replace(/\bbachelor of technology(?: honours?)?\s*(?:degree)?\s*(?:in)?\b/g, " ");
}

function extractBracketTerms(value: string): string[] {
  return Array.from(value.matchAll(/\(([^)]+)\)|\[([^\]]+)\]/g))
    .map((match) => normalizeWords(match[1] ?? match[2] ?? ""))
    .filter(Boolean);
}

function normalizeWords(value: string) {
  return normalizeBase(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function canonicalProgrammeTokens(value: string): string[] {
  const withoutDegree = stripDegreePrefix(normalizeBase(value));
  const withoutBrackets = withoutDegree.replace(/\([^)]+\)|\[[^\]]+\]/g, " ");
  return normalizeWords(withoutBrackets)
    .split(" ")
    .filter((token) => token && !TRAILING_QUALIFIERS.has(token));
}

function compact(tokens: string[]) {
  return tokens.join("");
}

function abbreviation(tokens: string[]) {
  return tokens
    .filter((token) => !INITIAL_STOPWORDS.has(token))
    .map((token) => token[0])
    .join("")
    .toUpperCase();
}

function isGenericAlias(tokens: string[]) {
  return GENERIC_ALIASES.has(compact(tokens));
}

function tokenOverlap(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.filter((token) => rightSet.has(token)).length;
}

function hasTrustedBracketEquivalence(
  aliasBracketTerms: string[],
  candidateBracketTerms: string[],
  aliasCompact: string,
  candidateCompact: string,
) {
  return (
    aliasBracketTerms.some((term) => TRUSTED_ABBREVIATIONS.has(term) && term === candidateCompact) ||
    candidateBracketTerms.some((term) => TRUSTED_ABBREVIATIONS.has(term) && term === aliasCompact)
  );
}

function scoreCandidate(aliasName: string, candidate: ProgrammeMatchCandidate): ProgrammeMatchSuggestion | null {
  const aliasTokens = canonicalProgrammeTokens(aliasName);
  const candidateTokens = canonicalProgrammeTokens(candidate.degreeName);
  if (aliasTokens.length === 0 || candidateTokens.length === 0) return null;

  const aliasCompact = compact(aliasTokens);
  const candidateCompact = compact(candidateTokens);
  const aliasBracketTerms = extractBracketTerms(aliasName);
  const candidateBracketTerms = extractBracketTerms(candidate.degreeName);
  const aliasAbbreviation = abbreviation(aliasTokens);
  const candidateAbbreviation = abbreviation(candidateTokens);

  let confidence = 0;
  let matchReason: ProgrammeMatchReason = "manual_review";

  if (isGenericAlias(aliasTokens)) {
    return null;
  }

  if (aliasCompact === candidateCompact) {
    confidence = 100;
    matchReason = "formatting_difference";
  } else if (
    ((aliasTokens.length >= 2 &&
      candidateTokens.length >= 2 &&
      (aliasBracketTerms.includes(candidateAbbreviation.toLowerCase()) ||
      candidateBracketTerms.includes(aliasAbbreviation.toLowerCase()) ||
      aliasBracketTerms.includes(candidateCompact) ||
        candidateBracketTerms.includes(aliasCompact))) ||
      hasTrustedBracketEquivalence(aliasBracketTerms, candidateBracketTerms, aliasCompact, candidateCompact))
  ) {
    confidence = 98;
    matchReason = "formatting_difference";
  } else if (candidateCompact.endsWith(aliasCompact) && aliasTokens.length >= 2) {
    confidence = 88;
    matchReason = "stream_suffix_prefix_difference";
  } else if (candidateCompact.includes(aliasCompact) && aliasTokens.length >= 2) {
    confidence = 82;
    matchReason = "stream_suffix_prefix_difference";
  } else if (aliasTokens.length >= 2 && candidateTokens.length >= 2) {
    const overlap = tokenOverlap(aliasTokens, candidateTokens);
    const coverage = overlap / Math.max(aliasTokens.length, candidateTokens.length);
    if (coverage >= 0.75) {
      confidence = 78;
      matchReason = "manual_review";
    }
  }

  if (confidence < MEDIUM_CONFIDENCE_THRESHOLD) return null;

  return {
    programmeId: candidate.programmeId,
    aliasName,
    matchedName: candidate.degreeName,
    confidence,
    matchReason,
  };
}

export function findHighConfidenceProgrammeMatch(
  aliasName: string,
  candidates: ProgrammeMatchCandidate[],
): ProgrammeMatchResult {
  const scored = candidates
    .map((candidate) => scoreCandidate(aliasName, candidate))
    .filter((candidate): candidate is ProgrammeMatchSuggestion => candidate != null)
    .sort((a, b) => b.confidence - a.confidence || a.matchedName.localeCompare(b.matchedName));

  if (scored.length === 0) {
    return {
      status: "low_confidence",
      suggestion: null,
      candidates: [],
      reason: "manual_review",
    };
  }

  const bestConfidence = scored[0].confidence;
  const best = scored.filter((candidate) => candidate.confidence === bestConfidence);
  if (best.length > 1) {
    return {
      status: "duplicate_alias_candidate",
      suggestion: null,
      candidates: best,
      reason: "duplicate_alias_candidate",
    };
  }

  if (scored[0].confidence < 90) {
    return {
      status: "medium_confidence",
      suggestion: scored[0],
      candidates: scored,
      reason: scored[0].matchReason,
    };
  }

  return {
    status: "high_confidence",
    suggestion: scored[0],
    candidates: scored,
    reason: scored[0].matchReason,
  };
}

export function classifyUniversityName(rawUniversityName: string, knownUniversityNames: Iterable<string>) {
  const raw = normalizeWords(rawUniversityName);
  for (const knownName of knownUniversityNames) {
    const known = normalizeWords(knownName);
    if (raw === known) return { status: "matched" as const, matchedName: knownName };
    if (raw.replace(/\bsri\b/g, "").replace(/\s+/g, " ").trim() === known.replace(/\bsri\b/g, "").replace(/\s+/g, " ").trim()) {
      return { status: "alias_candidate" as const, matchedName: knownName };
    }
  }
  return { status: "unmatched" as const, matchedName: null };
}
