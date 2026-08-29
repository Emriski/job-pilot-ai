import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { ensureFreshCatalogue, syncAllSources } from "./jobs-sync.server";
import { getJobRow, listCandidateJobs, type JobListItem } from "./jobs-query.server";
import { computeMatch, type MatchJob, type MatchResult } from "./matching";
import { enforceRateLimit } from "./rate-limit.server";
import { buildMatchProfile, loadActiveResume, loadProfile } from "./user-context.server";

function toMatchJob(job: JobListItem): MatchJob {
  return {
    title: job.title,
    description: job.description,
    requirements: job.requirements,
    skills: job.skills ?? [],
    location: job.location,
    country: job.country,
    remote: job.remote,
    remote_type: job.remote_type,
    employment_type: job.employment_type,
    experience_level: job.experience_level,
    salary_min: job.salary_min,
    salary_max: job.salary_max,
    salary_period: job.salary_period,
  };
}

export async function refreshCatalogue(supabase: SupabaseClient<Database>, userId: string) {
  await enforceRateLimit(supabase, userId, "job_sync");
  return syncAllSources();
}

export type Recommendation = { job: JobListItem; match: MatchResult };

export async function recommendJobs(
  supabase: SupabaseClient<Database>,
  userId: string,
  refresh: boolean,
) {
  await enforceRateLimit(supabase, userId, "job_search");

  const [profile, resume] = await Promise.all([
    loadProfile(supabase, userId),
    loadActiveResume(supabase, userId),
  ]);
  const matchProfile = buildMatchProfile(profile, resume);

  if (refresh) {
    await enforceRateLimit(supabase, userId, "job_sync");
    await syncAllSources();
  } else {
    await ensureFreshCatalogue();
  }

  const candidates = await listCandidateJobs(supabase, matchProfile.targetTitles);
  const scored: Recommendation[] = candidates
    .map((job) => ({ job, match: computeMatch(matchProfile, toMatchJob(job)) }))
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, 60);

  if (scored.length) {
    await supabase.from("job_matches").upsert(
      scored.slice(0, 40).map((item) => ({
        user_id: userId,
        job_id: item.job.id,
        score: item.match.score,
        breakdown: item.match.breakdown as never,
        reasons: item.match.reasons,
        gaps: item.match.gaps,
      })),
      { onConflict: "user_id,job_id" },
    );
  }

  return {
    scanned: candidates.length,
    strong: scored.filter((item) => item.match.score >= 70).length,
    recommendations: scored,
    hasResume: Boolean(resume?.raw_text),
  };
}

export async function matchForJob(
  supabase: SupabaseClient<Database>,
  userId: string,
  jobId: string,
) {
  const [profile, resume, job] = await Promise.all([
    loadProfile(supabase, userId),
    loadActiveResume(supabase, userId),
    getJobRow(jobId, supabase),
  ]);
  if (!job) return null;
  const match = computeMatch(buildMatchProfile(profile, resume), toMatchJob(job));
  return { job, match, hasResume: Boolean(resume?.raw_text) };
}
