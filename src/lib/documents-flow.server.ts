import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { generateCoverLetter, generatePrepPack, generateTailoredResume } from "./documents.server";
import { getJobRow } from "./jobs-query.server";
import { computeMatch } from "./matching";
import { enforceRateLimit } from "./rate-limit.server";
import { buildMatchProfile, loadActiveResume, loadProfile } from "./user-context.server";

async function requireContext(supabase: SupabaseClient<Database>, userId: string, jobId: string) {
  const [profile, resume, job] = await Promise.all([
    loadProfile(supabase, userId),
    loadActiveResume(supabase, userId),
    getJobRow(jobId, supabase),
  ]);
  if (!job) throw new Error("We couldn't find that job. It may no longer be listed.");
  if (!resume?.raw_text) throw new Error("Upload your resume first so we can tailor this to your experience.");
  return { profile, resume, job };
}

export async function buildDocument(
  supabase: SupabaseClient<Database>,
  userId: string,
  jobId: string,
  docType: "cover_letter" | "tailored_resume",
) {
  await enforceRateLimit(supabase, userId, "ai_document");
  const { resume, job } = await requireContext(supabase, userId, jobId);

  const jobContext = {
    title: job.title,
    company: job.company_name,
    location: job.location,
    description: job.description,
    requirements: job.requirements,
  };

  const result =
    docType === "cover_letter"
      ? await generateCoverLetter(resume.raw_text!, jobContext)
      : await generateTailoredResume(resume.raw_text!, jobContext);

  const title =
    docType === "cover_letter"
      ? `Cover letter — ${job.title} at ${job.company_name}`
      : `Tailored resume — ${job.title} at ${job.company_name}`;

  const { content, ...meta } = result as { content: string } & Record<string, unknown>;

  const { data, error } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      job_id: jobId,
      doc_type: docType,
      title,
      content,
      changes: meta as never,
    } as never)
    .select("id, doc_type, title, content, changes, created_at")
    .single();

  if (error || !data) {
    console.error("[documents] insert failed", error?.message);
    throw new Error("We couldn't save that document. Please try again.");
  }
  return data;
}

export async function buildPrepPack(supabase: SupabaseClient<Database>, userId: string, jobId: string) {
  await enforceRateLimit(supabase, userId, "application_prep");
  const { profile, resume, job } = await requireContext(supabase, userId, jobId);

  const match = computeMatch(buildMatchProfile(profile, resume), {
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
  });

  const pack = await generatePrepPack(resume.raw_text!, {
    title: job.title,
    company: job.company_name,
    location: job.location,
    description: job.description,
    requirements: job.requirements,
  });

  const { data } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      job_id: jobId,
      doc_type: "prep_pack",
      title: `Application plan — ${job.title} at ${job.company_name}`,
      content: pack.fitSummary,
      changes: pack as never,
    } as never)
    .select("id, doc_type, title, content, changes, created_at")
    .single();

  return { pack, match, job, document: data };
}
