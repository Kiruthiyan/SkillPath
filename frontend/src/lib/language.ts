const LANGUAGE_ALIASES: Record<string, string> = {
  english: "en",
  sinhala: "si",
  tamil: "ta",
};

/** Normalize legacy or display language values to ISO codes (en/si/ta). */
export function normalizeLanguage(value: string | null | undefined): string {
  if (!value) return "en";
  const lower = value.trim().toLowerCase();
  if (lower in LANGUAGE_ALIASES) return LANGUAGE_ALIASES[lower]!;
  if (["en", "si", "ta"].includes(lower)) return lower;
  return "en";
}
