import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { chatJson } from "./ai.server";
import { enforceRateLimit } from "./rate-limit.server";
import { cleanText } from "./security";
import { loadProfile } from "./user-context.server";

function fence(label: string, value: string): string {
  return `<<<BEGIN_UNTRUSTED_${label}>>>\n${value}\n<<<END_UNTRUSTED_${label}>>>`;
}

export type FollowUpDraft = { subject: string; body: string };

/**
 * Drafts a polite follow-up email for one tracked application.
 * Only facts already stored on the application/profile are supplied to the
 * model, and untrusted text is fenced so it can never act as instructions.
 */
export async function buildFollowUpEmail(
  supabase: SupabaseClient<Database>,
  userId: string,
  applicationId: string,
): Promise<FollowUpDraft> {
  const { data: application } = await supabase
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!application) throw new Error("We couldn't find that application.");

  await enforceRateLimit(supabase, userId, "ai_document");

  const profile = await loadProfile(supabase, userId);
  const senderName = profile?.full_name?.trim() || "";
  const appliedAt = application.applied_at ?? application.created_at;
  const daysSince = appliedAt
    ? Math.max(0, Math.round((Date.now() - new Date(appliedAt).getTime()) / 86_400_000))
    : null;

  const result = await chatJson<FollowUpDraft>({
    system: [
      "You write short, professional job-application follow-up emails.",
      "Keep the body under 160 words, warm but concise, no flattery, no invented achievements, no salary talk.",
      "Never promise or request anything unreasonable. Sign off with the candidate's name when provided.",
      'Return JSON: {"subject": string, "body": string}.',
    ].join(" "),
    user: [
      fence("APPLICATION", JSON.stringify({
        company: application.company_name,
        role: application.job_title,
        status: application.status,
        days_since_applied: daysSince,
        notes: application.notes ?? null,
        next_action: application.next_action ?? null,
        previously_followed_up_at: application.last_followed_up_at ?? null,
      })),
      fence("CANDIDATE_NAME", senderName || "(not provided)"),
      "Write the follow-up email now.",
    ].join("\n\n"),
    maxTokens: 700,
  });

  const subject =
    cleanText(result?.subject ?? "", 160) ||
    `Following up on my ${application.job_title} application`;
  const body = cleanText(result?.body ?? "", 4000);
  if (!body) throw new Error("We couldn't draft that follow-up. Please try again.");

  return { subject, body };
}
