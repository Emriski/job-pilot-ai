import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { toAnnual } from "./matching";
import type { JobSearchInput } from "./validation";

/** Publishable-key client for public reads (RLS applies as anon). */
export function publicSupabase(): SupabaseClient<Database> {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const url = process.env["SUPABASE_URL"]!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`)
          headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

const JOB_COLUMNS =
  "id, source, title, company_name, company_logo, location, country, remote, remote_type, employment_type, experience_level, salary_min, salary_max, salary_currency, salary_period, description, requirements, skills, posted_at, application_url, source_url, company_url, expired";

export type JobListItem = {
  id: string;
  source: string;
  title: string;
  company_name: string;
  company_logo: string | null;
  location: string | null;
  country: string | null;
  remote: boolean;
  remote_type: string | null;
  employment_type: string | null;
  experience_level: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  description: string | null;
  requirements: string | null;
  skills: string[];
  posted_at: string | null;
  application_url: string;
  source_url: string | null;
  company_url: string | null;
  expired: boolean;
};

function escapeLike(value: string): string {
  return value.replace(/[%,()]/g, " ").trim();
}

/** Server-side filtering and pagination — the browser never loads the catalogue. */
export async function searchJobsQuery(input: JobSearchInput, client?: SupabaseClient<Database>) {
  const supabase = client ?? publicSupabase();
  let query = supabase.from("jobs").select(JOB_COLUMNS, { count: "exact" }).eq("expired", false);

  const term = escapeLike(input.query);
  if (term) {
    query = query.or(
      `title.ilike.%${term}%,company_name.ilike.%${term}%,description.ilike.%${term}%,skills.cs.{${term.toLowerCase()}}`,
    );
  }

  const location = escapeLike(input.location);
  if (location) query = query.or(`location.ilike.%${location}%,country.ilike.%${location}%`);

  if (input.workMode === "remote") query = query.eq("remote", true);
  if (input.workMode === "hybrid") query = query.eq("remote_type", "hybrid");
  if (input.workMode === "onsite") query = query.eq("remote_type", "onsite");

  if (input.employmentTypes.length) query = query.in("employment_type", input.employmentTypes);
  if (input.experienceLevels.length) query = query.in("experience_level", input.experienceLevels);
  if (input.sources.length) query = query.in("source", input.sources);

  if (input.postedWithinDays > 0) {
    const since = new Date(Date.now() - input.postedWithinDays * 86_400_000).toISOString();
    query = query.gte("posted_at", since);
  }

  if (input.minSalary) {
    // Compare like-for-like by annualising both sides; undisclosed salaries are excluded
    // from a salary-filtered search rather than guessed at.
    const annual = toAnnual(input.minSalary, input.salaryPeriod);
    const yearly = annual;
    const monthly = annual / 12;
    const hourly = annual / (40 * 52);
    query = query.or(
      `and(salary_period.eq.yearly,salary_max.gte.${yearly}),and(salary_period.eq.monthly,salary_max.gte.${monthly}),and(salary_period.eq.hourly,salary_max.gte.${hourly}),and(salary_period.eq.weekly,salary_max.gte.${annual / 52})`,
    );
  }

  const from = (input.page - 1) * input.pageSize;
  query = query
    .order("posted_at", { ascending: false, nullsFirst: false })
    .range(from, from + input.pageSize - 1);

  const { data, error, count } = await query;
  if (error) {
    console.error("[jobs] search failed", error.message);
    throw new Error("We couldn't retrieve jobs right now. Please try again.");
  }

  return { jobs: (data ?? []) as unknown as JobListItem[], total: count ?? 0 };
}

export async function getJobRow(jobId: string, client?: SupabaseClient<Database>) {
  const supabase = client ?? publicSupabase();
  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_COLUMNS)
    .eq("id", jobId)
    .maybeSingle();
  if (error) {
    console.error("[jobs] fetch failed", error.message);
    throw new Error("We couldn't load this job right now. Please try again.");
  }
  return (data as unknown as JobListItem | null) ?? null;
}

export async function listCandidateJobs(
  supabase: SupabaseClient<Database>,
  titles: string[],
  limit = 300,
): Promise<JobListItem[]> {
  const terms = titles.map(escapeLike).filter(Boolean).slice(0, 4);
  const collected = new Map<string, JobListItem>();

  for (const term of terms) {
    const { data } = await supabase
      .from("jobs")
      .select(JOB_COLUMNS)
      .eq("expired", false)
      .ilike("title", `%${term}%`)
      .order("posted_at", { ascending: false, nullsFirst: false })
      .limit(120);
    for (const row of (data ?? []) as unknown as JobListItem[]) collected.set(row.id, row);
  }

  if (collected.size < 40) {
    const { data } = await supabase
      .from("jobs")
      .select(JOB_COLUMNS)
      .eq("expired", false)
      .order("posted_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    for (const row of (data ?? []) as unknown as JobListItem[]) collected.set(row.id, row);
  }

  return [...collected.values()];
}
