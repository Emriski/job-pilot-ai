import { cleanText, htmlToPlainText, safeExternalUrl } from "../security";
import type { NormalizedJob } from "./types";

const COMMON_SUFFIXES =
  /\b(inc|llc|ltd|limited|gmbh|bv|corp|corporation|co|plc|sa|ag|srl|pte|pty)\b\.?/g;

export function normalizeCompany(value: string): string {
  return cleanText(value, 120)
    .toLowerCase()
    .replace(COMMON_SUFFIXES, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const TITLE_NOISE =
  /\b(remote|worldwide|anywhere|urgent|hiring|now|m\/f\/d|m\/w\/d|f\/m\/d|full[- ]?time|part[- ]?time|contract|senior|jr|sr)\b/g;

export function normalizeTitle(value: string): string {
  return cleanText(value, 160)
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9+#. ]+/g, " ")
    .replace(TITLE_NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildDedupeKey(company: string, title: string, location: string | null): string {
  const loc = cleanText(location ?? "", 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
  return `${normalizeCompany(company)}|${normalizeTitle(title)}|${loc}`.slice(0, 300);
}

/** Direct employer ATS links beat aggregator links when merging duplicates. */
export const SOURCE_DIRECTNESS: Record<string, number> = {
  greenhouse: 100,
  ashby: 95,
  lever: 90,
  himalayas: 60,
  arbeitnow: 55,
  remotejobs: 50,
  remoteok: 45,
  weworkremotely: 40,
};

const EMPLOYMENT_MAP: Array<[RegExp, string]> = [
  [/\b(full[\s-]?time|fulltime|permanent|vollzeit)\b/i, "full-time"],
  [/\b(part[\s-]?time|parttime|teilzeit)\b/i, "part-time"],
  [/\b(contract|contractor|freelance|b2b)\b/i, "contract"],
  [/\b(intern|internship|praktikum)\b/i, "internship"],
  [/\b(temporary|temp|seasonal)\b/i, "temporary"],
];

export function detectEmploymentType(...values: Array<string | null | undefined>): string | null {
  const haystack = values.filter(Boolean).join(" ");
  for (const [pattern, label] of EMPLOYMENT_MAP) if (pattern.test(haystack)) return label;
  return null;
}

const LEVEL_MAP: Array<[RegExp, string]> = [
  [/\b(vp|head of|director|principal|staff|lead)\b/i, "lead"],
  [/\b(senior|sr\.?|experienced)\b/i, "senior"],
  [/\b(mid[\s-]?level|intermediate)\b/i, "mid"],
  [/\b(junior|jr\.?|associate)\b/i, "junior"],
  [/\b(entry[\s-]?level|graduate|intern|trainee|no experience)\b/i, "entry"],
];

export function detectExperienceLevel(...values: Array<string | null | undefined>): string | null {
  const haystack = values.filter(Boolean).join(" ");
  for (const [pattern, label] of LEVEL_MAP) if (pattern.test(haystack)) return label;
  return null;
}

/**
 * "Worldwide" is only claimed when the source says so explicitly.
 * Everything else keeps the literal location the source provided.
 */
export function describeRemote(
  location: string | null,
  raw?: string | null,
): { remote: boolean; remote_type: string | null } {
  const haystack = `${location ?? ""} ${raw ?? ""}`.toLowerCase();
  if (/\bhybrid\b/.test(haystack)) return { remote: false, remote_type: "hybrid" };
  if (/\b(remote|anywhere|worldwide|distributed)\b/.test(haystack))
    return { remote: true, remote_type: "remote" };
  if (/\b(on[\s-]?site|in[\s-]?office|in[\s-]?person)\b/.test(haystack))
    return { remote: false, remote_type: "onsite" };
  return { remote: false, remote_type: null };
}

export function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "number") {
    const ms = value > 1e12 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function positiveNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type BuildArgs = Omit<
  Partial<NormalizedJob>,
  "source" | "title" | "company_name" | "application_url"
> & {
  source: string;
  source_job_id: string;
  title: string;
  company_name: string;
  application_url: string;
  descriptionHtml?: string | null;
};

/** Returns null when a record is unusable (no title, company or safe apply URL). */
export function buildJob(args: BuildArgs): NormalizedJob | null {
  const title = cleanText(args.title, 200);
  const company = cleanText(args.company_name, 160);
  const applicationUrl = safeExternalUrl(args.application_url);
  if (!title || !company || !applicationUrl) return null;

  const description = args.descriptionHtml
    ? htmlToPlainText(args.descriptionHtml, 18000)
    : cleanText(args.description ?? "", 18000);

  const location = args.location ? cleanText(args.location, 160) : null;
  const remote = args.remote_type
    ? { remote: args.remote ?? args.remote_type === "remote", remote_type: args.remote_type }
    : describeRemote(location, description.slice(0, 1200));

  return {
    source: args.source,
    source_job_id: cleanText(args.source_job_id, 200) || applicationUrl,
    dedupe_key: buildDedupeKey(company, title, location),
    title,
    company_name: company,
    company_logo: safeExternalUrl(args.company_logo),
    location,
    country: args.country ? cleanText(args.country, 80) : null,
    remote: remote.remote,
    remote_type: remote.remote_type,
    employment_type:
      args.employment_type ?? detectEmploymentType(title, description.slice(0, 2000)),
    experience_level:
      args.experience_level ?? detectExperienceLevel(title, description.slice(0, 2000)),
    salary_min: args.salary_min ?? null,
    salary_max: args.salary_max ?? null,
    salary_currency: args.salary_currency ? cleanText(args.salary_currency, 8).toUpperCase() : null,
    salary_period: args.salary_period ?? null,
    description: description || null,
    requirements: args.requirements ? cleanText(args.requirements, 6000) : null,
    skills: (args.skills ?? [])
      .map((skill) => cleanText(skill, 60))
      .filter(Boolean)
      .slice(0, 25),
    posted_at: args.posted_at ?? null,
    application_url: applicationUrl,
    source_url: safeExternalUrl(args.source_url) ?? applicationUrl,
    company_url: safeExternalUrl(args.company_url),
  };
}

/** Merge duplicates across sources, keeping the most direct application link. */
export function dedupeJobs(jobs: NormalizedJob[]): NormalizedJob[] {
  const byKey = new Map<string, NormalizedJob>();
  for (const job of jobs) {
    const existing = byKey.get(job.dedupe_key);
    if (!existing) {
      byKey.set(job.dedupe_key, job);
      continue;
    }
    const currentRank = SOURCE_DIRECTNESS[job.source] ?? 0;
    const existingRank = SOURCE_DIRECTNESS[existing.source] ?? 0;
    const winner = currentRank > existingRank ? job : existing;
    const loser = winner === job ? existing : job;
    byKey.set(job.dedupe_key, {
      ...winner,
      description: winner.description ?? loser.description,
      salary_min: winner.salary_min ?? loser.salary_min,
      salary_max: winner.salary_max ?? loser.salary_max,
      salary_currency: winner.salary_currency ?? loser.salary_currency,
      salary_period: winner.salary_period ?? loser.salary_period,
      posted_at: winner.posted_at ?? loser.posted_at,
      company_logo: winner.company_logo ?? loser.company_logo,
      skills: Array.from(new Set([...winner.skills, ...loser.skills])).slice(0, 25),
    });
  }
  return [...byKey.values()];
}
