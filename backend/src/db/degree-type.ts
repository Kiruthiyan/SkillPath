export function inferDegreeType(degreeName: string): string {
  const lower = degreeName.toLowerCase();
  if (lower.includes("b.sc") || lower.includes("bsc")) return "Science";
  if (lower.includes("b.com") || lower.includes("bcom")) return "Commerce";
  if (lower.includes("b.a") || lower.includes("ba ")) return "Arts";
  if (lower.includes("b.tech") || lower.includes("btech")) return "Technology";
  if (lower.includes("medicine") || lower.includes("mbbs")) return "Medicine";
  if (lower.includes("engineering")) return "Engineering";
  return "General";
}
