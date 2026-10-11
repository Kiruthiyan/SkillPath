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
  const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

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
  // Multi-model cascade: try gemini-3.6-flash first, fallback to gemini-3.5-flash-lite if 503 high demand
  const candidateModels = ["gemini-3.6-flash", "gemini-3.5-flash-lite"];

  const prompt = `${SYSTEM_PROMPT}

You are an expert Sri Lankan Higher Education and Career Advisory AI. 
Generate a comprehensive, highly realistic, and actionable academic and career execution plan for a Sri Lankan university student:

Degree Information:
- Degree Programme: ${params.degreeName}
- Discipline / Faculty: ${params.faculty || params.degreeType}
- University: ${params.universityName}
- Duration: ${params.durationYears} Years
${params.stream ? `- Student A/L Stream: ${params.stream}` : ""}
${params.zscore !== undefined ? `- Student A/L Z-Score: ${params.zscore}` : ""}

Provide deep, practical advice tailored specifically to the Sri Lankan context and global career pathways:
1. Academic progression year-by-year:
   - Specific foundational and advanced course modules taught in Sri Lankan universities for this degree
   - Critical technical software, lab instruments, programming languages, or analytical tools (e.g., R, SPSS, Python, MATLAB, HACCP/ISO standards, CAD, specialized tools)
   - Extracurricular involvement, student clubs (IEEE, Rotaract, Gavel, AIESEC, Science Society, agricultural/engineering societies), hackathons/competitions
   - Industry internship strategy: specific Sri Lankan industries, reputable companies (e.g. Mas, Brandix, Dialog, IFS, WSO2, Nestlé, Fonterra, Cargills, Hayleys, John Keells, state research institutes like CRI, RRI, SLINTEC, NARA, ITI, etc.)
   - Final-year research thesis ideas addressing real-world Sri Lankan or regional challenges
2. Career trajectory after graduation:
   - "After Graduation": Entry-level titles, graduate trainee programs, top employers in Sri Lanka, realistic starting salary range in LKR/month.
   - "3 Years Later": Mid-level role, key career advancements, industry certifications, expected salary range in LKR/month.
   - "5 Years Later": Senior specialist or managerial position, postgraduate pathways (MSc / MPhil / PhD in Sri Lanka or fully-funded scholarships abroad like Erasmus, Chevening, Australia Awards, DAAD, Canada, US).
   - "10 Years Later": Industry leader, executive director, entrepreneur, or international consultant role.

Return ONLY valid JSON matching this schema:
{
  "years": [
    {
      "year": 1,
      "milestones": [
        "Concise, highly specific milestone 1 with concrete skills & actions",
        "Milestone 2 with clubs/societies & academic focus",
        "Milestone 3 with practical tools & foundation building"
      ]
    }
  ],
  "afterGraduation": [
    {
      "timeframe": "After Graduation",
      "role": "Specific role and employer types in Sri Lanka (Salary: LKR XX,XXX - XX,XXX/month) with initial duties."
    },
    {
      "timeframe": "3 Years Later",
      "role": "Mid-level role and professional achievements (Salary: LKR XXX,XXX - XXX,XXX/month)."
    },
    {
      "timeframe": "5 Years Later",
      "role": "Senior role or postgraduate / overseas scholarship path (Salary: LKR XXX,XXX+ / month or overseas stipends)."
    },
    {
      "timeframe": "10 Years Later",
      "role": "Executive leadership, consultancy, or global entrepreneurship role."
    }
  ]
}

Provide exactly ${params.durationYears} year entries (years 1 to ${params.durationYears}), each containing 3 to 4 detailed and actionable milestones.`;

  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" },
      });

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/[\{\[][\s\S]*[\}\]]/);
      if (!jsonMatch) continue;
      const parsed = JSON.parse(jsonMatch[0]) as any;

      let rawYears: any[] = [];
      let rawAfter: any[] = [];

      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item.years || item.milestones) {
            rawYears.push(item);
          } else if (item.afterGraduation) {
            rawAfter = item.afterGraduation;
          }
        }
      } else {
        const data = parsed.careerRoadmap || parsed.roadmap || parsed;
        rawYears = Array.isArray(data.years) ? data.years : [];
        rawAfter = Array.isArray(data.afterGraduation) ? data.afterGraduation : [];
      }

      if (rawYears.length === 0) continue;

      const years = rawYears.map((y: any, idx: number) => {
        let yearNum = idx + 1;
        if (typeof y.year === "number") yearNum = y.year;
        else if (typeof y.years === "string") {
          const m = y.years.match(/\d+/);
          if (m) yearNum = parseInt(m[0], 10);
        }
        return {
          year: yearNum,
          milestones: Array.isArray(y.milestones)
            ? y.milestones.map((m: any) => (typeof m === "string" ? m : m.title || m.name || JSON.stringify(m)))
            : [],
        };
      });

      const afterGraduation = rawAfter.map((ag: any) => ({
        timeframe: ag.timeframe || ag.period || "After Graduation",
        role: ag.role || ag.title || "Specialist",
      }));

      return {
        years,
        afterGraduation,
      };
    } catch (error: any) {
      console.warn(`[gemini] Model ${modelName} attempt failed:`, error?.message || error);
    }
  }

  return null;
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
  const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

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

function getFallbackChatResponse(_message: string): string {
  return "AI guidance is temporarily unavailable. Please try again later, or continue with the course checker and official handbook data. (Configure GEMINI_API_KEY for full AI responses.)";
}
