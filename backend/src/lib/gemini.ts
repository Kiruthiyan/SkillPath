import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `You are SkillPath AI, an expert career mentor for Sri Lankan Advanced Level (A/L) students. 
You help students choose university courses based on their Z-score and stream, understand career paths, 
salary expectations in Sri Lanka (LKR), and opportunities abroad. 
Be encouraging, practical, and specific to the Sri Lankan education system.
Respond in the language the student prefers when specified.`;

export async function generateChatResponse(
  message: string,
  context?: string | null,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return getFallbackChatResponse(message);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = context
    ? `${SYSTEM_PROMPT}\n\nStudent context: ${context}\n\nStudent question: ${message}`
    : `${SYSTEM_PROMPT}\n\nStudent question: ${message}`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function generateRoadmapWithAI(params: {
  degreeName: string;
  degreeType: string;
  faculty: string;
  universityName: string;
  durationYears: number;
  stream?: string;
  zscore?: number;
}): Promise<{
  years: Array<{ year: number; milestones: string[] }>;
  afterGraduation: Array<{ timeframe: string; role: string }>;
} | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `${SYSTEM_PROMPT}

Generate a personalized career roadmap for a Sri Lankan student studying:
- Degree: ${params.degreeName}
- Type: ${params.degreeType}
- Faculty: ${params.faculty}
- University: ${params.universityName}
- Duration: ${params.durationYears} years
${params.stream ? `- A/L Stream: ${params.stream}` : ""}
${params.zscore !== undefined ? `- Z-Score: ${params.zscore}` : ""}

Return ONLY valid JSON with this exact structure:
{
  "years": [
    { "year": 1, "milestones": ["...", "..."] }
  ],
  "afterGraduation": [
    { "timeframe": "After Graduation", "role": "..." },
    { "timeframe": "3 Years Later", "role": "..." },
    { "timeframe": "5 Years Later", "role": "..." },
    { "timeframe": "10 Years Later", "role": "..." }
  ]
}

Include ${params.durationYears} year entries. Each year should have 3-4 milestones covering learning, internships (year 3+), portfolio building, and job preparation.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]) as {
      years: Array<{ year: number; milestones: string[] }>;
      afterGraduation: Array<{ timeframe: string; role: string }>;
    };
  } catch {
    return null;
  }
}

export async function explainCutoffPrediction(params: {
  programme: {
    id: number;
    degreeName: string;
    universityName: string | null;
    stream: string;
    faculty: string;
  };
  district: string;
  history: Array<{ academicYear: string; minimumZScore: number }>;
  predicted: {
    officialCutoff: number | null;
    officialAcademicYear: string | null;
    predictedCutoff: number | null;
    predictedAcademicYear: string | null;
    confidence: string;
    dataSource: string;
    yearOverYearDeltas: number[];
  };
  studentZscore?: number;
  eligibility?: string | null;
  handbookAttribution: string;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const dataBlock = JSON.stringify(params, null, 2);

  if (!apiKey) {
    return getFallbackPredictionExplanation(params);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `${SYSTEM_PROMPT}

You are explaining UGC university admission cutoff predictions to a Sri Lankan A/L student.

CRITICAL RULES:
- Use ONLY the numbers provided in the structured data below. Do NOT invent or estimate any cutoff values.
- Clearly state that official past cutoffs come from the UGC handbook; predicted values are statistical estimates.
- Mention uncertainty when confidence is medium or low.
- Keep the response to 3-5 sentences, practical and encouraging.

Structured data:
${dataBlock}`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch {
    return getFallbackPredictionExplanation(params);
  }
}

function getFallbackPredictionExplanation(params: {
  programme: { degreeName: string; universityName: string | null };
  district: string;
  predicted: {
    officialCutoff: number | null;
    predictedCutoff: number | null;
    predictedAcademicYear: string | null;
    confidence: string;
  };
  studentZscore?: number;
  eligibility?: string | null;
  handbookAttribution: string;
}): string {
  const { programme, district, predicted, studentZscore, eligibility } = params;
  const official = predicted.officialCutoff?.toFixed(3) ?? "N/A";
  const next = predicted.predictedCutoff?.toFixed(3) ?? "N/A";
  const year = predicted.predictedAcademicYear ?? "next year";

  let text = `For ${programme.degreeName} at ${programme.universityName ?? "the university"} (${district} quota), the latest official UGC cutoff is ${official}. Based on past trends, the estimated ${year} cutoff is ${next} (${predicted.confidence} confidence).`;

  if (studentZscore != null && eligibility) {
    text += ` With your Z-score of ${studentZscore.toFixed(3)}, this programme is classified as "${eligibility}".`;
  }

  text +=
    " Predictions are estimates based on past UGC cutoffs, not official admissions.";

  return text;
}

function getFallbackChatResponse(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("it") || lower.includes("computer")) {
    return "IT and Computer Science degrees from universities like Moratuwa and Colombo open excellent career paths in Sri Lanka's growing tech industry. Starting salaries range from LKR 60,000–120,000/month. Consider your Z-score when choosing between state and private universities.";
  }
  if (lower.includes("abroad") || lower.includes("overseas")) {
    return "Many Sri Lankan graduates find opportunities in Australia, UK, Canada, and Singapore. IT and engineering graduates have the best prospects. Build strong portfolios and consider certifications like AWS or CIMA to improve your chances.";
  }
  return `Thank you for your question. As SkillPath AI, I can help with university course selection, career paths, salary expectations, and opportunities abroad for Sri Lankan A/L students. Please ask a more specific question about degrees, careers, or Z-scores. (Note: Set GEMINI_API_KEY for full AI responses.)`;
}
