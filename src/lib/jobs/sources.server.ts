import { cleanText, htmlToPlainText, safeExternalUrl } from "../security";
import { buildJob, positiveNumber, toIsoDate } from "./normalize";
import type { NormalizedJob } from "./types";

export type SourceResult = {
  slug: string;
  jobs: NormalizedJob[];
  error: string | null;
};

const USER_AGENT = "JobePilotAI/1.0 (+https://jobepilotai.lovable.app)";
const TIMEOUT_MS = 12000;

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": USER_AGENT },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTextBody(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/rss+xml, text/xml, */*", "user-agent": USER_AGENT },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Remote OK — public JSON feed                                        */
/* ------------------------------------------------------------------ */
async function fetchRemoteOk(): Promise<NormalizedJob[]> {
  type Item = {
    id?: string | number;
    slug?: string;
    position?: string;
    company?: string;
    company_logo?: string;
    logo?: string;
    location?: string;
    description?: string;
    tags?: string[];
    salary_min?: number;
    salary_max?: number;
    date?: string;
    epoch?: number;
    url?: string;
    apply_url?: string;
    legal?: string;
  };
  const data = await fetchJson<Item[]>("https://remoteok.com/api");
  const items = Array.isArray(data) ? data.filter((item) => !item.legal && item.position) : [];
  return items
    .map((item) =>
      buildJob({
        source: "remoteok",
        source_job_id: String(item.id ?? item.slug ?? ""),
        title: item.position ?? "",
        company_name: item.company ?? "",
        company_logo: item.company_logo ?? item.logo ?? null,
        location: cleanText(item.location ?? "", 120) || "Remote",
        remote: true,
        remote_type: "remote",
        descriptionHtml: item.description ?? null,
        skills: item.tags ?? [],
        salary_min: positiveNumber(item.salary_min),
        salary_max: positiveNumber(item.salary_max),
        salary_currency: positiveNumber(item.salary_min) ? "USD" : null,
        salary_period: positiveNumber(item.salary_min) ? "yearly" : null,
        posted_at: toIsoDate(item.date ?? item.epoch),
        application_url: item.apply_url ?? item.url ?? "",
        source_url: item.url ?? null,
      }),
    )
    .filter((job): job is NormalizedJob => job !== null);
}

/* ------------------------------------------------------------------ */
/* We Work Remotely — public RSS feeds                                 */
/* ------------------------------------------------------------------ */
const WWR_FEEDS = [
  "https://weworkremotely.com/categories/remote-customer-support-jobs.rss",
  "https://weworkremotely.com/categories/remote-programming-jobs.rss",
  "https://weworkremotely.com/categories/remote-design-jobs.rss",
  "https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss",
  "https://weworkremotely.com/categories/remote-management-and-finance-jobs.rss",
  "https://weworkremotely.com/remote-jobs.rss",
];

function rssItems(xml: string): string[] {
  return xml
    .split(/<item>/i)
    .slice(1)
    .map((chunk) => chunk.split(/<\/item>/i)[0] ?? "");
}

function rssField(chunk: string, tag: string): string {
  const match = chunk.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!match?.[1]) return "";
  return match[1]
    .replace(/^<!\[CDATA\[/, "")
    .replace(/\]\]>$/, "")
    .trim();
}

async function fetchWeWorkRemotely(): Promise<NormalizedJob[]> {
  const results = await Promise.allSettled(WWR_FEEDS.map((feed) => fetchTextBody(feed)));
  const jobs: NormalizedJob[] = [];
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const chunk of rssItems(result.value)) {
      const rawTitle = htmlToPlainText(rssField(chunk, "title"), 240);
      const link = rssField(chunk, "link");
      const region = htmlToPlainText(rssField(chunk, "region"), 120);
      const category = htmlToPlainText(rssField(chunk, "category"), 120);
      // WWR titles are "Company: Job Title"
      const separator = rawTitle.indexOf(":");
      const company = separator > 0 ? rawTitle.slice(0, separator).trim() : "";
      const title = separator > 0 ? rawTitle.slice(separator + 1).trim() : rawTitle;
      if (!company) continue;
      const job = buildJob({
        source: "weworkremotely",
        source_job_id: link,
        title,
        company_name: company,
        location: region || "Remote",
        remote: true,
        remote_type: "remote",
        descriptionHtml: rssField(chunk, "description"),
        skills: category ? [category] : [],
        posted_at: toIsoDate(rssField(chunk, "pubDate")),
        application_url: link,
        source_url: link,
      });
      if (job) jobs.push(job);
    }
  }
  return jobs;
}

/* ------------------------------------------------------------------ */
/* RemoteJobs.org — public feed                                        */
/* ------------------------------------------------------------------ */
async function fetchRemoteJobsOrg(): Promise<NormalizedJob[]> {
  type Item = {
    id?: string | number;
    slug?: string;
    title?: string;
    company?: string | { name?: string; logo?: string; website?: string };
    company_name?: string;
    description?: string;
    location?: string;
    remote?: boolean;
    job_type?: string;
    employment_type?: string;
    salary?: string;
    salary_min?: number;
    salary_max?: number;
    salary_currency?: string;
    published_at?: string;
    created_at?: string;
    url?: string;
    apply_url?: string;
  };
  const payload = await fetchJson<{ jobs?: Item[]; data?: Item[] } | Item[]>(
    "https://remotejobs.org/api/jobs",
  );
  const items = Array.isArray(payload) ? payload : (payload.jobs ?? payload.data ?? []);
  return items
    .map((item) => {
      const company =
        typeof item.company === "string"
          ? item.company
          : (item.company?.name ?? item.company_name ?? "");
      return buildJob({
        source: "remotejobs",
        source_job_id: String(item.id ?? item.slug ?? item.url ?? ""),
        title: item.title ?? "",
        company_name: company,
        company_logo: typeof item.company === "object" ? (item.company?.logo ?? null) : null,
        company_url: typeof item.company === "object" ? (item.company?.website ?? null) : null,
        location: cleanText(item.location ?? "", 120) || "Remote",
        remote: item.remote ?? true,
        remote_type: item.remote === false ? null : "remote",
        descriptionHtml: item.description ?? null,
        employment_type: item.employment_type ?? item.job_type ?? null,
        salary_min: positiveNumber(item.salary_min),
        salary_max: positiveNumber(item.salary_max),
        salary_currency: item.salary_currency ?? (positiveNumber(item.salary_min) ? "USD" : null),
        salary_period: positiveNumber(item.salary_min) ? "yearly" : null,
        posted_at: toIsoDate(item.published_at ?? item.created_at),
        application_url: item.apply_url ?? item.url ?? "",
        source_url: item.url ?? null,
      });
    })
    .filter((job): job is NormalizedJob => job !== null);
}

/* ------------------------------------------------------------------ */
/* Arbeitnow — public job board API                                    */
/* ------------------------------------------------------------------ */
async function fetchArbeitnow(): Promise<NormalizedJob[]> {
  type Item = {
    slug?: string;
    company_name?: string;
    title?: string;
    description?: string;
    remote?: boolean;
    url?: string;
    tags?: string[];
    job_types?: string[];
    location?: string;
    created_at?: number;
  };
  const jobs: NormalizedJob[] = [];
  for (const page of [1, 2]) {
    const payload = await fetchJson<{ data?: Item[] }>(
      `https://www.arbeitnow.com/api/job-board-api?page=${page}`,
    );
    for (const item of payload.data ?? []) {
      const job = buildJob({
        source: "arbeitnow",
        source_job_id: item.slug ?? item.url ?? "",
        title: item.title ?? "",
        company_name: item.company_name ?? "",
        location: item.location ?? null,
        remote: Boolean(item.remote),
        remote_type: item.remote ? "remote" : "onsite",
        descriptionHtml: item.description ?? null,
        skills: item.tags ?? [],
        employment_type: item.job_types?.[0] ?? null,
        posted_at: toIsoDate(item.created_at),
        application_url: item.url ?? "",
        source_url: item.url ?? null,
      });
      if (job) jobs.push(job);
    }
  }
  return jobs;
}

/* ------------------------------------------------------------------ */
/* Himalayas — public jobs API                                         */
/* ------------------------------------------------------------------ */
async function fetchHimalayas(): Promise<NormalizedJob[]> {
  type Item = {
    guid?: string;
    title?: string;
    companyName?: string;
    companyLogo?: string;
    excerpt?: string;
    description?: string;
    pubDate?: number | string;
    applicationLink?: string;
    locationRestrictions?: string[];
    seniority?: string[];
    employmentType?: string;
    minSalary?: number;
    maxSalary?: number;
    salaryCurrency?: string;
    categories?: string[];
    timezones?: string[];
  };
  const payload = await fetchJson<{ jobs?: Item[] }>("https://himalayas.app/jobs/api?limit=100");
  return (payload.jobs ?? [])
    .map((item) =>
      buildJob({
        source: "himalayas",
        source_job_id: String(item.guid ?? item.applicationLink ?? ""),
        title: item.title ?? "",
        company_name: item.companyName ?? "",
        company_logo: item.companyLogo ?? null,
        location: item.locationRestrictions?.length
          ? item.locationRestrictions.join(", ")
          : "Remote",
        remote: true,
        remote_type: "remote",
        descriptionHtml: item.description ?? item.excerpt ?? null,
        skills: item.categories ?? [],
        employment_type: item.employmentType ?? null,
        experience_level: item.seniority?.[0]?.toLowerCase() ?? null,
        salary_min: positiveNumber(item.minSalary),
        salary_max: positiveNumber(item.maxSalary),
        salary_currency: item.salaryCurrency ?? (positiveNumber(item.minSalary) ? "USD" : null),
        salary_period: positiveNumber(item.minSalary) ? "yearly" : null,
        posted_at: toIsoDate(item.pubDate),
        application_url: item.applicationLink ?? "",
        source_url: item.applicationLink ?? null,
      }),
    )
    .filter((job): job is NormalizedJob => job !== null);
}

/* ------------------------------------------------------------------ */
/* Greenhouse / Ashby / Lever — public company job boards              */
/* ------------------------------------------------------------------ */
export const DEFAULT_GREENHOUSE_BOARDS = ["gitlab", "duolingo", "airtable", "figma", "webflow"];
export const DEFAULT_ASHBY_BOARDS = ["ramp", "linear", "vanta", "posthog"];
export const DEFAULT_LEVER_BOARDS = ["netflix", "spotify", "plaid"];

async function fetchGreenhouse(boards: string[]): Promise<NormalizedJob[]> {
  type Item = {
    id?: number;
    title?: string;
    content?: string;
    absolute_url?: string;
    updated_at?: string;
    location?: { name?: string };
    metadata?: unknown;
  };
  const jobs: NormalizedJob[] = [];
  const results = await Promise.allSettled(
    boards.map(async (board) => ({
      board,
      payload: await fetchJson<{ jobs?: Item[] }>(
        `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`,
      ),
    })),
  );
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const company = result.value.board
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    for (const item of result.value.payload.jobs ?? []) {
      const job = buildJob({
        source: "greenhouse",
        source_job_id: String(item.id ?? item.absolute_url ?? ""),
        title: item.title ?? "",
        company_name: company,
        location: item.location?.name ?? null,
        descriptionHtml: item.content ?? null,
        posted_at: toIsoDate(item.updated_at),
        application_url: item.absolute_url ?? "",
        source_url: item.absolute_url ?? null,
      });
      if (job) jobs.push(job);
    }
  }
  return jobs;
}

async function fetchAshby(boards: string[]): Promise<NormalizedJob[]> {
  type Item = {
    id?: string;
    title?: string;
    location?: string;
    isRemote?: boolean;
    descriptionPlain?: string;
    descriptionHtml?: string;
    employmentType?: string;
    department?: string;
    team?: string;
    jobUrl?: string;
    applyUrl?: string;
    publishedAt?: string;
    compensation?: {
      compensationTierSummary?: string;
      summaryComponents?: Array<{
        compensationType?: string;
        interval?: string;
        currencyCode?: string;
        minValue?: number;
        maxValue?: number;
      }>;
    };
  };
  const jobs: NormalizedJob[] = [];
  const results = await Promise.allSettled(
    boards.map(async (board) => ({
      board,
      payload: await fetchJson<{ jobs?: Item[]; name?: string }>(
        `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}?includeCompensation=true`,
      ),
    })),
  );
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const company =
      result.value.payload.name ?? result.value.board.replace(/\b\w/g, (c) => c.toUpperCase());
    for (const item of result.value.payload.jobs ?? []) {
      const salary = item.compensation?.summaryComponents?.find(
        (component) => component.compensationType === "Salary" && component.minValue,
      );
      const intervalMap: Record<string, string> = {
        YEAR: "yearly",
        MONTH: "monthly",
        WEEK: "weekly",
        HOUR: "hourly",
      };
      const job = buildJob({
        source: "ashby",
        source_job_id: String(item.id ?? item.jobUrl ?? ""),
        title: item.title ?? "",
        company_name: company,
        location: item.location ?? null,
        remote: Boolean(item.isRemote),
        remote_type: item.isRemote ? "remote" : null,
        description: item.descriptionPlain ?? null,
        descriptionHtml: item.descriptionPlain ? null : (item.descriptionHtml ?? null),
        employment_type: item.employmentType ?? null,
        skills: [item.department, item.team].filter((value): value is string => Boolean(value)),
        salary_min: positiveNumber(salary?.minValue),
        salary_max: positiveNumber(salary?.maxValue),
        salary_currency: salary?.currencyCode ?? null,
        salary_period: salary?.interval
          ? (intervalMap[salary.interval.replace("PER_", "")] ?? null)
          : null,
        posted_at: toIsoDate(item.publishedAt),
        application_url: item.applyUrl ?? item.jobUrl ?? "",
        source_url: item.jobUrl ?? null,
      });
      if (job) jobs.push(job);
    }
  }
  return jobs;
}

async function fetchLever(boards: string[]): Promise<NormalizedJob[]> {
  type Item = {
    id?: string;
    text?: string;
    descriptionPlain?: string;
    description?: string;
    hostedUrl?: string;
    applyUrl?: string;
    createdAt?: number;
    categories?: { location?: string; commitment?: string; team?: string; department?: string };
    workplaceType?: string;
  };
  const jobs: NormalizedJob[] = [];
  const results = await Promise.allSettled(
    boards.map(async (board) => ({
      board,
      payload: await fetchJson<Item[]>(
        `https://api.lever.co/v0/postings/${encodeURIComponent(board)}?mode=json`,
      ),
    })),
  );
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const company = result.value.board.replace(/\b\w/g, (c) => c.toUpperCase());
    for (const item of Array.isArray(result.value.payload) ? result.value.payload : []) {
      const job = buildJob({
        source: "lever",
        source_job_id: String(item.id ?? item.hostedUrl ?? ""),
        title: item.text ?? "",
        company_name: company,
        location: item.categories?.location ?? null,
        remote: item.workplaceType === "remote",
        remote_type: item.workplaceType ?? null,
        description: item.descriptionPlain ?? null,
        descriptionHtml: item.descriptionPlain ? null : (item.description ?? null),
        employment_type: item.categories?.commitment ?? null,
        skills: [item.categories?.team, item.categories?.department].filter((v): v is string =>
          Boolean(v),
        ),
        posted_at: toIsoDate(item.createdAt),
        application_url: item.applyUrl ?? item.hostedUrl ?? "",
        source_url: item.hostedUrl ?? null,
      });
      if (job) jobs.push(job);
    }
  }
  return jobs;
}

/* ------------------------------------------------------------------ */

type SourceConfig = { slug: string; config: Record<string, unknown> };

function boardList(config: Record<string, unknown>, key: string, fallback: string[]): string[] {
  const value = config[key];
  if (Array.isArray(value) && value.length) {
    return value
      .map((item) => cleanText(String(item), 60).toLowerCase())
      .filter(Boolean)
      .slice(0, 20);
  }
  return fallback;
}

/**
 * Fetch one source. A failure here never breaks the others — the caller runs
 * every source with Promise.allSettled and records per-source errors.
 */
export async function runSource({ slug, config }: SourceConfig): Promise<SourceResult> {
  try {
    let jobs: NormalizedJob[] = [];
    switch (slug) {
      case "remoteok":
        jobs = await fetchRemoteOk();
        break;
      case "weworkremotely":
        jobs = await fetchWeWorkRemotely();
        break;
      case "remotejobs":
        jobs = await fetchRemoteJobsOrg();
        break;
      case "arbeitnow":
        jobs = await fetchArbeitnow();
        break;
      case "himalayas":
        jobs = await fetchHimalayas();
        break;
      case "greenhouse":
        jobs = await fetchGreenhouse(boardList(config, "boards", DEFAULT_GREENHOUSE_BOARDS));
        break;
      case "ashby":
        jobs = await fetchAshby(boardList(config, "boards", DEFAULT_ASHBY_BOARDS));
        break;
      case "lever":
        jobs = await fetchLever(boardList(config, "boards", DEFAULT_LEVER_BOARDS));
        break;
      default:
        return { slug, jobs: [], error: "Source has no connector implementation." };
    }
    return { slug, jobs, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[jobs] source ${slug} failed:`, message);
    return { slug, jobs: [], error: message.slice(0, 300) };
  }
}

export { safeExternalUrl };
