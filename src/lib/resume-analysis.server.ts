import { chatJson } from "./ai.server";
import { clampScore, cleanText, fenceUntrusted, toStringArray } from "./security";

export type ParsedResume = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  links: string[];
  summary: string | null;
  job_titles: string[];
  experience: Array<{
    title: string | null;
    company: string | null;
    start_date: string | null;
    end_date: string | null;
    location: string | null;
    highlights: string[];
  }>;
  education: Array<{ degree: string | null; institution: string | null; dates: string | null }>;
  skills: string[];
  certifications: string[];
  projects: Array<{ name: string | null; description: string | null }>;
  achievements: string[];
  languages: string[];
  total_years_experience: number | null;
  uncertain_fields: string[];
};

const EXTRACTION_SYSTEM = `Extract structured facts from a resume.
Return JSON exactly matching:
{"full_name":string|null,"email":string|null,"phone":string|null,"location":string|null,"links":string[],
"summary":string|null,"job_titles":string[],
"experience":[{"title":string|null,"company":string|null,"start_date":string|null,"end_date":string|null,"location":string|null,"highlights":string[]}],
"education":[{"degree":string|null,"institution":string|null,"dates":string|null}],
"skills":string[],"certifications":string[],
"projects":[{"name":string|null,"description":string|null}],
"achievements":string[],"languages":string[],
"total_years_experience":number|null,
"uncertain_fields":string[]}
Copy the person's real wording. Use null or [] for anything absent — never guess a value.
List any field you were unsure about in uncertain_fields.`;

export async function extractStructuredResume(resumeText: string): Promise<ParsedResume> {
  const raw = await chatJson<Record<string, unknown>>({
    model: "google/gemini-3.5-flash",
    system: EXTRACTION_SYSTEM,
    user: `Extract the resume below.\n\n${fenceUntrusted("RESUME", resumeText)}`,
  });

  const experience = Array.isArray(raw["experience"]) ? (raw["experience"] as Record<string, unknown>[]) : [];
  const education = Array.isArray(raw["education"]) ? (raw["education"] as Record<string, unknown>[]) : [];
  const projects = Array.isArray(raw["projects"]) ? (raw["projects"] as Record<string, unknown>[]) : [];

  const str = (value: unknown, max = 300) => {
    const text = cleanText(typeof value === "string" ? value : "", max);
    return text || null;
  };

  const years = Number(raw["total_years_experience"]);

  return {
    full_name: str(raw["full_name"], 120),
    email: str(raw["email"], 160),
    phone: str(raw["phone"], 60),
    location: str(raw["location"], 160),
    links: toStringArray(raw["links"], 8, 300),
    summary: str(raw["summary"], 1500),
    job_titles: toStringArray(raw["job_titles"], 15, 120),
    experience: experience.slice(0, 20).map((item) => ({
      title: str(item["title"], 160),
      company: str(item["company"], 160),
      start_date: str(item["start_date"], 40),
      end_date: str(item["end_date"], 40),
      location: str(item["location"], 120),
      highlights: toStringArray(item["highlights"], 12, 600),
    })),
    education: education.slice(0, 10).map((item) => ({
      degree: str(item["degree"], 160),
      institution: str(item["institution"], 160),
      dates: str(item["dates"], 60),
    })),
    skills: toStringArray(raw["skills"], 60, 60),
    certifications: toStringArray(raw["certifications"], 20, 160),
    projects: projects.slice(0, 10).map((item) => ({
      name: str(item["name"], 160),
      description: str(item["description"], 800),
    })),
    achievements: toStringArray(raw["achievements"], 20, 400),
    languages: toStringArray(raw["languages"], 12, 60),
    total_years_experience: Number.isFinite(years) && years >= 0 && years < 70 ? Math.round(years * 10) / 10 : null,
    uncertain_fields: toStringArray(raw["uncertain_fields"], 15, 80),
  };
}

export type ResumeAnalysis = {
  overall_score: number;
  verdict: "strong" | "competitive" | "needs work" | "weak";
  summary: string;
  category_scores: Record<string, number>;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  ats: {
    present_keywords: string[];
    missing_keywords: string[];
    weak_evidence: string[];
    formatting_issues: string[];
    parsing_risks: string[];
  };
};

const CATEGORIES = [
  "ats_compatibility",
  "formatting",
  "clarity",
  "relevant_experience",
  "skills",
  "achievements",
  "quantifiable_results",
  "keyword_usage",
  "role_relevance",
  "professional_summary",
  "education",
  "consistency",
];

const ANALYSIS_SYSTEM = `You are a blunt, expert technical recruiter and ATS specialist reviewing a resume AGAINST ONE SPECIFIC TARGET ROLE.
Score honestly and role-specifically: the same resume must score differently for different target roles.
Return JSON exactly matching:
{"overall_score":0-100,"verdict":"strong"|"competitive"|"needs work"|"weak","summary":string,
"category_scores":{"ats_compatibility":0-100,"formatting":0-100,"clarity":0-100,"relevant_experience":0-100,"skills":0-100,"achievements":0-100,"quantifiable_results":0-100,"keyword_usage":0-100,"role_relevance":0-100,"professional_summary":0-100,"education":0-100,"consistency":0-100},
"strengths":string[],"weaknesses":string[],"improvements":string[],
"ats":{"present_keywords":string[],"missing_keywords":string[],"weak_evidence":string[],"formatting_issues":string[],"parsing_risks":string[]}}

Rules:
- Be direct. If the resume is weak for this role, say so plainly in summary (e.g. "This resume is weak for the X role and is unlikely to compete against well-optimised applicants.").
- Criticise the document, never the person. No insults. No employment guarantees.
- missing_keywords must be genuinely relevant to the target role only. Never suggest keyword stuffing.
- improvements must be concrete, rewritable actions the person can take with their real experience.
- Never invent experience, employers, dates, degrees or certifications.`;

export async function analyseResume(resumeText: string, targetRole: string): Promise<ResumeAnalysis> {
  const raw = await chatJson<Record<string, unknown>>({
    model: "google/gemini-3.5-flash",
    system: ANALYSIS_SYSTEM,
    user: `Target role: ${cleanText(targetRole, 120)}\n\nEvaluate this resume for that role.\n\n${fenceUntrusted("RESUME", resumeText)}`,
  });

  const scoresRaw = (raw["category_scores"] ?? {}) as Record<string, unknown>;
  const category_scores: Record<string, number> = {};
  for (const key of CATEGORIES) category_scores[key] = clampScore(scoresRaw[key]);

  const atsRaw = (raw["ats"] ?? {}) as Record<string, unknown>;
  const verdictRaw = cleanText(raw["verdict"], 30).toLowerCase();
  const verdict: ResumeAnalysis["verdict"] =
    verdictRaw === "strong" || verdictRaw === "competitive" || verdictRaw === "weak" ? verdictRaw : "needs work";

  const average = Math.round(
    CATEGORIES.reduce((sum, key) => sum + (category_scores[key] ?? 0), 0) / CATEGORIES.length,
  );
  const stated = clampScore(raw["overall_score"]);
  // Keep the headline number consistent with the category detail shown to users.
  const overall_score = stated > 0 ? Math.round(stated * 0.6 + average * 0.4) : average;

  return {
    overall_score,
    verdict,
    summary: cleanText(raw["summary"], 1500) || "We couldn't summarise this resume.",
    category_scores,
    strengths: toStringArray(raw["strengths"], 8, 400),
    weaknesses: toStringArray(raw["weaknesses"], 8, 400),
    improvements: toStringArray(raw["improvements"], 10, 500),
    ats: {
      present_keywords: toStringArray(atsRaw["present_keywords"], 30, 60),
      missing_keywords: toStringArray(atsRaw["missing_keywords"], 30, 60),
      weak_evidence: toStringArray(atsRaw["weak_evidence"], 10, 300),
      formatting_issues: toStringArray(atsRaw["formatting_issues"], 10, 300),
      parsing_risks: toStringArray(atsRaw["parsing_risks"], 10, 300),
    },
  };
}

export function verdictBand(score: number): string {
  if (score >= 80) return "STRONG";
  if (score >= 65) return "COMPETITIVE";
  if (score >= 45) return "NEEDS WORK";
  return "WEAK";
}
