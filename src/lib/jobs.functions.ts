import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getJobRow, searchJobsQuery } from "./jobs-query.server";
import { recommendJobs, matchForJob, refreshCatalogue } from "./jobs-flow.server";
import { idSchema, jobIdSchema, jobSearchSchema, savedJobSchema } from "./validation";

export const searchJobs = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => jobSearchSchema.parse(data))
  .handler(async ({ data }) => searchJobsQuery(data));

export const getJob = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => jobIdSchema.parse(data))
  .handler(async ({ data }) => getJobRow(data.jobId));

export const getRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { refresh?: boolean }) => ({ refresh: Boolean(data?.refresh) }))
  .handler(async ({ data, context }) =>
    recommendJobs(context.supabase, context.userId, data.refresh),
  );

export const getJobMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => jobIdSchema.parse(data))
  .handler(async ({ data, context }) => matchForJob(context.supabase, context.userId, data.jobId));

export const refreshJobSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => refreshCatalogue(context.supabase, context.userId));

export const listSavedJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("saved_jobs")
      .select("id, notes, created_at, job:jobs(*)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const saveJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => savedJobSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("saved_jobs")
      .upsert(
        { user_id: context.userId, job_id: data.jobId, notes: data.notes },
        { onConflict: "user_id,job_id" },
      );
    if (error) {
      console.error("[jobs] save failed", error.message);
      throw new Error("We couldn't save that job. Please try again.");
    }
    return { ok: true };
  });

export const unsaveJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => jobIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("saved_jobs")
      .delete()
      .eq("user_id", context.userId)
      .eq("job_id", data.jobId);
    return { ok: true };
  });

export const removeSavedJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("saved_jobs")
      .delete()
      .eq("user_id", context.userId)
      .eq("id", data.id);
    return { ok: true };
  });

export const listSources = createServerFn({ method: "GET" }).handler(async () => {
  const { publicSupabase } = await import("./jobs-query.server");
  const { data } = await publicSupabase()
    .from("job_sources")
    .select("slug, name, status, enabled, job_count, last_sync_at")
    .order("name");
  return data ?? [];
});
