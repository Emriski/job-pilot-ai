/**
 * JobePilotAI Match Score — a transparent, deterministic 0–100 comparison
 * between a person's resume/preferences and a specific job.
 *
 * This is NOT a probability of being hired and is never presented as one.
 * Every component is explainable and derived only from real data on both sides.
 */

export type MatchProfile = {
  targetTitles: string[];
  skills: string[];
  experienceLevel: string | null;
  workModes: string[];
  countries: string[];
  employmentTypes: string[];
  minSalary: number | null;
  salaryPeriod: string;
  resumeText: string;
  resumeTitles: string[];
  yearsExperience: number | null;
};

export type MatchJob = {
  title: string;
  description: string | null;
  requirements: string | null;
  skills: string[];
  location: string | null;
  country: string | null;
  remote: boolean;
  remote_type: string | null;
  employment_type: string | null;
  experience_level: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_period: string | null;
};

export type MatchResult = {
  score: number;
  breakdown: {
    role: number;
    skills: number;
    experience: number;
    keywords: number;
    location: number;
    salary: number;
    employment: number;
  };
  reasons: string[];
  gaps: string[];
  matchedSkills: string[];
  missingSkills: string[];
};

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "you",
  "your",
  "our",
  "are",
  "that",
  "this",
  "will",
  "have",
  "has",
  "from",
  "not",
  "all",
  "can",
  "who",
  "what",
  "their",
  "them",
  "they",
  "its",
  "was",
  "were",
  "been",
  "but",
  "any",
  "out",
  "use",
  "how",
  "into",
  "also",
  "job",
  "role",
  "work",
  "team",
  "company",
  "position",
  "experience",
  "years",
  "year",
  "new",
  "more",
  "other",
  "must",
  "about",
  "across",
  "within",
  "using",
  "strong",
  "good",
  "great",
  "plus",
  "etc",
  "per",
  "via",
  "able",
  "help",
  "make",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#. ]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#. ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Token-overlap similarity between two role titles (0–1). */
export function titleSimilarity(a: string, b: string): number {
  const left = new Set(tokens(normalise(a)));
  const right = new Set(tokens(normalise(b)));
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / Math.max(left.size, right.size);
}

const LEVEL_ORDER = ["entry", "junior", "mid", "senior", "lead"];

function levelIndex(value: string | null): number {
  if (!value) return -1;
  return LEVEL_ORDER.indexOf(value.toLowerCase());
}

/** Annualise so different salary periods can be compared honestly. */
export function toAnnual(amount: number, period: string | null | undefined): number {
  switch ((period ?? "yearly").toLowerCase()) {
    case "hourly":
      return amount * 40 * 52;
    case "daily":
      return amount * 5 * 52;
    case "weekly":
      return amount * 52;
    case "monthly":
      return amount * 12;
    default:
      return amount;
  }
}

export function computeMatch(profile: MatchProfile, job: MatchJob): MatchResult {
  const reasons: string[] = [];
  const gaps: string[] = [];

  const jobText = `${job.title}\n${job.description ?? ""}\n${job.requirements ?? ""}`;
  const jobTokens = new Set(tokens(jobText));
  const resumeTokens = new Set(tokens(profile.resumeText));

  /* Role similarity ------------------------------------------------ */
  const candidateTitles = [...profile.targetTitles, ...profile.resumeTitles].filter(Boolean);
  const roleSimilarity = candidateTitles.reduce(
    (best, title) => Math.max(best, titleSimilarity(title, job.title)),
    0,
  );
  const role = Math.round(roleSimilarity * 100);
  if (role >= 55) reasons.push(`Job title closely matches your target role (${job.title}).`);
  else if (role >= 30) reasons.push("Job title partially overlaps with your target role.");
  else gaps.push("This job title is different from the roles you're targeting.");

  /* Skills --------------------------------------------------------- */
  const profileSkills = profile.skills.map(normalise).filter(Boolean);
  const jobSkills = job.skills.map(normalise).filter(Boolean);
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const skill of jobSkills) {
    const inResume =
      profileSkills.includes(skill) || profile.resumeText.toLowerCase().includes(skill);
    if (inResume) matchedSkills.push(skill);
    else missingSkills.push(skill);
  }
  // Also credit profile skills explicitly named in the job description.
  for (const skill of profileSkills) {
    if (!matchedSkills.includes(skill) && jobText.toLowerCase().includes(skill))
      matchedSkills.push(skill);
  }

  const skillDenominator = Math.max(jobSkills.length, Math.min(profileSkills.length, 8), 1);
  const skills = Math.round(Math.min(1, matchedSkills.length / skillDenominator) * 100);
  if (matchedSkills.length) reasons.push(`Shared skills: ${matchedSkills.slice(0, 6).join(", ")}.`);
  if (missingSkills.length)
    gaps.push(`Not found in your resume: ${missingSkills.slice(0, 5).join(", ")}.`);

  /* Experience ----------------------------------------------------- */
  const userLevel = levelIndex(profile.experienceLevel);
  const jobLevel = levelIndex(job.experience_level);
  let experience = 65;
  if (userLevel >= 0 && jobLevel >= 0) {
    const distance = Math.abs(userLevel - jobLevel);
    experience = distance === 0 ? 100 : distance === 1 ? 75 : distance === 2 ? 45 : 20;
    if (distance === 0) reasons.push(`Seniority matches your ${profile.experienceLevel} level.`);
    else if (userLevel < jobLevel)
      gaps.push(`This role targets a ${job.experience_level} level, above your stated level.`);
  }

  /* Keyword coverage ----------------------------------------------- */
  let sharedKeywords = 0;
  for (const token of jobTokens) if (resumeTokens.has(token)) sharedKeywords += 1;
  const keywords = jobTokens.size
    ? Math.round(Math.min(1, sharedKeywords / Math.min(jobTokens.size, 80)) * 100)
    : 0;

  /* Location / remote ---------------------------------------------- */
  let location = 60;
  const wantsRemote = profile.workModes.includes("remote");
  if (job.remote) {
    location = wantsRemote ? 100 : 80;
    if (wantsRemote) reasons.push("This role is remote, which matches your work preference.");
  } else if (job.remote_type === "hybrid") {
    location = profile.workModes.includes("hybrid") ? 90 : 50;
  } else {
    location = profile.workModes.includes("onsite") ? 85 : 35;
    if (wantsRemote) gaps.push("This role is not listed as remote.");
  }
  if (profile.countries.length && job.country) {
    const countryMatch = profile.countries.some((country) =>
      normalise(job.country ?? "").includes(normalise(country)),
    );
    if (countryMatch) {
      location = Math.min(100, location + 10);
      reasons.push(`Location includes ${job.country}, one of your preferred countries.`);
    }
  }

  /* Salary --------------------------------------------------------- */
  let salary = 60;
  if (profile.minSalary && job.salary_min) {
    const wanted = toAnnual(profile.minSalary, profile.salaryPeriod);
    const offered = toAnnual(job.salary_max ?? job.salary_min, job.salary_period);
    if (offered >= wanted) {
      salary = 100;
      reasons.push("The published salary meets your minimum.");
    } else if (offered >= wanted * 0.8) {
      salary = 65;
      gaps.push("The published salary is slightly below your minimum.");
    } else {
      salary = 25;
      gaps.push("The published salary is below your minimum.");
    }
  } else if (!job.salary_min) {
    salary = 55; // Salary not disclosed — neither rewarded nor punished.
  }

  /* Employment type ------------------------------------------------ */
  let employment = 70;
  if (profile.employmentTypes.length && job.employment_type) {
    const matchesType = profile.employmentTypes.some((type) =>
      normalise(job.employment_type ?? "").includes(normalise(type)),
    );
    employment = matchesType ? 100 : 40;
    if (matchesType)
      reasons.push(`Employment type matches your preference (${job.employment_type}).`);
    else gaps.push(`Employment type is ${job.employment_type}, which isn't in your preferences.`);
  }

  const breakdown = { role, skills, experience, keywords, location, salary, employment };

  const score = Math.round(
    role * 0.3 +
      skills * 0.22 +
      experience * 0.12 +
      keywords * 0.12 +
      location * 0.12 +
      salary * 0.06 +
      employment * 0.06,
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    breakdown,
    reasons: reasons.slice(0, 6),
    gaps: gaps.slice(0, 6),
    matchedSkills: [...new Set(matchedSkills)].slice(0, 12),
    missingSkills: [...new Set(missingSkills)].slice(0, 12),
  };
}

export function matchLabel(score: number): {
  label: string;
  tone: "strong" | "good" | "fair" | "weak";
} {
  if (score >= 80) return { label: "Strong match", tone: "strong" };
  if (score >= 65) return { label: "Good match", tone: "good" };
  if (score >= 45) return { label: "Fair match", tone: "fair" };
  return { label: "Weak match", tone: "weak" };
}
