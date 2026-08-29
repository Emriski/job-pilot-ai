import type { SupabaseClient } from "@supabase/supabase-js";

export type RateLimitAction =
  | "resume_upload"
  | "resume_analysis"
  | "job_search"
  | "job_sync"
  | "ai_document"
  | "application_prep"
  | "community_post"
  | "community_comment"
  | "community_message"
  | "community_report";

const LIMITS: Record<RateLimitAction, { max: number; windowMinutes: number }> = {
  resume_upload: { max: 10, windowMinutes: 60 },
  resume_analysis: { max: 20, windowMinutes: 60 },
  job_search: { max: 120, windowMinutes: 10 },
  job_sync: { max: 12, windowMinutes: 60 },
  ai_document: { max: 25, windowMinutes: 60 },
  application_prep: { max: 15, windowMinutes: 60 },
  community_post: { max: 15, windowMinutes: 60 },
  community_comment: { max: 60, windowMinutes: 60 },
  community_message: { max: 120, windowMinutes: 60 },
  community_report: { max: 20, windowMinutes: 60 },
};

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * Server-side throttle for every expensive or abusable action.
 * Counts are stored in the database so they survive across workers.
 */
export async function enforceRateLimit(
  supabase: SupabaseClient,
  userId: string,
  action: RateLimitAction,
): Promise<void> {
  const { max, windowMinutes } = LIMITS[action];
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();

  const { count, error } = await supabase
    .from("rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action", action)
    .gte("created_at", since);

  if (error) {
    console.error("[rate-limit] read failed", error.message);
    return;
  }

  if ((count ?? 0) >= max) {
    throw new RateLimitError(
      `You've reached the limit for this action. Please try again in about ${windowMinutes} minutes.`,
    );
  }

  const { error: insertError } = await supabase
    .from("rate_limits")
    .insert({ user_id: userId, action });
  if (insertError) console.error("[rate-limit] write failed", insertError.message);
}
