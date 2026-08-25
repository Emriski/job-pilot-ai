import { chatJson } from "./ai.server";
import { cleanText, fenceUntrusted, toStringArray } from "./security";

type JobContext = {
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  requirements: string | null;
};

function jobBlock(job: JobContext): string {
  return fenceUntrusted(
    "JOB_POSTING",
    [
      `Job title: ${job.title}`,
      `Company: ${job.company}`,
      job.location ? `Location: ${job.location}` : "",
      job.description ? `Description:\n${job.description}` : "",
      job.requirements ? `Requirements:\n${job.requirements}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    12000,
  );
}

const COVER_LETTER_SYSTEM = `Write a specific, professional cover letter for ONE job using ONLY facts present in the candidate's resume.
Return JSON: {"content":string,"used_facts":string[],"omitted_claims":string[]}
Rules:
- Reference the actual company, role and 2-4 concrete requirements from the posting.
- Every claim must be traceable to the resume. Never invent employers, tools, metrics, certifications or dates.
- If the resume lacks something the job asks for, either omit it or frame transferable experience honestly. List anything you deliberately avoided claiming in omitted_claims.
- 250-400 words. Plain text with paragraph breaks. No markdown, no placeholders like [Your Name] unless the resume truly has no name.
- Never promise outcomes or guarantee performance.`;

export async function generateCoverLetter(resumeText: string, job: JobContext) {
  const raw = await chatJson<Record<string, unknown>>({
    model: "google/gemini-3.5-flash",
    system: COVER_LETTER_SYSTEM,
    user: `Write the cover letter.\n\n${jobBlock(job)}\n\n${fenceUntrusted("RESUME", resumeText)}`,
  });
  return {
    content: cleanText(raw["content"], 8000),
    usedFacts: toStringArray(raw["used_facts"], 12, 300),
    omittedClaims: toStringArray(raw["omitted_claims"], 12, 300),
  };
}

const TAILOR_SYSTEM = `Rewrite a resume so it aligns with ONE specific job, WITHOUT inventing anything.
Return JSON: {"content":string,"changes":[{"section":string,"change":string}],"not_added":string[]}
Rules:
- Keep every employer, job title, date and qualification exactly as in the original. You may reorder, re-emphasise and rephrase.
- Improve: professional summary, ordering and wording of skills, bullet strength, keyword alignment with the posting, and emphasis on relevant achievements.
- Only use keywords that the candidate's real experience supports. Never fabricate metrics.
- content must be a complete ATS-friendly plain-text resume with clear section headings.
- changes lists what you actually altered. not_added lists job requirements you could NOT support from the resume.`;

export async function generateTailoredResume(resumeText: string, job: JobContext) {
  const raw = await chatJson<Record<string, unknown>>({
    model: "google/gemini-3.5-flash",
    system: TAILOR_SYSTEM,
    user: `Tailor this resume for the job.\n\n${jobBlock(job)}\n\n${fenceUntrusted("RESUME", resumeText)}`,
  });
  const changesRaw = Array.isArray(raw["changes"]) ? (raw["changes"] as Record<string, unknown>[]) : [];
  return {
    content: cleanText(raw["content"], 20000),
    changes: changesRaw.slice(0, 20).map((item) => ({
      section: cleanText(item["section"], 80) || "Resume",
      change: cleanText(item["change"], 400),
    })),
    notAdded: toStringArray(raw["not_added"], 12, 300),
  };
}

const PREP_SYSTEM = `Produce an application preparation pack for ONE job based only on the candidate's real resume.
Return JSON: {"fit_summary":string,"checklist":string[],"talking_points":string[],"likely_questions":[{"question":string,"suggested_answer":string}],"risks":string[]}
Rules:
- suggested_answer must only use experience present in the resume; if the resume cannot support an answer, say what the candidate should prepare instead.
- checklist items are concrete pre-submit actions.
- risks are honest gaps between the resume and the posting.
- Never fabricate qualifications or guarantee outcomes.`;

export async function generatePrepPack(resumeText: string, job: JobContext) {
  const raw = await chatJson<Record<string, unknown>>({
    model: "google/gemini-3.5-flash",
    system: PREP_SYSTEM,
    user: `Prepare the application pack.\n\n${jobBlock(job)}\n\n${fenceUntrusted("RESUME", resumeText)}`,
  });
  const questionsRaw = Array.isArray(raw["likely_questions"]) ? (raw["likely_questions"] as Record<string, unknown>[]) : [];
  return {
    fitSummary: cleanText(raw["fit_summary"], 1500),
    checklist: toStringArray(raw["checklist"], 12, 300),
    talkingPoints: toStringArray(raw["talking_points"], 10, 400),
    likelyQuestions: questionsRaw.slice(0, 8).map((item) => ({
      question: cleanText(item["question"], 300),
      suggestedAnswer: cleanText(item["suggested_answer"], 1200),
    })),
    risks: toStringArray(raw["risks"], 10, 300),
  };
}
