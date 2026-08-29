import { cleanText, safeInternalPath } from "./security";

type NotificationKind =
  "comment" | "reply" | "reaction" | "follow" | "mention" | "moderation" | "message" | "job_alert";

const SETTING_FOR_KIND: Record<NotificationKind, string> = {
  comment: "comments",
  reply: "replies",
  reaction: "reactions",
  follow: "follows",
  mention: "mentions",
  moderation: "moderation",
  message: "replies",
  job_alert: "job_alerts",
};

/**
 * Notifications are only ever created as a side effect of a real event
 * (a real comment, a real reaction, a real follow). Nothing here invents
 * engagement, and users never notify themselves.
 */
export async function notify(input: {
  userId: string;
  actorId?: string | null;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  link?: string | null;
}): Promise<void> {
  if (!input.userId || input.userId === input.actorId) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: settings } = await supabaseAdmin
      .from("notification_settings")
      .select("*")
      .eq("user_id", input.userId)
      .maybeSingle();
    const key = SETTING_FOR_KIND[input.kind];
    if (settings && (settings as Record<string, unknown>)[key] === false) return;

    await supabaseAdmin.from("notifications").insert({
      user_id: input.userId,
      actor_id: input.actorId ?? null,
      kind: input.kind,
      title: cleanText(input.title, 160),
      body: input.body ? cleanText(input.body, 400) : null,
      link: input.link ? safeInternalPath(input.link, "/community") : null,
    });
  } catch (error) {
    console.error("[notify] failed", error instanceof Error ? error.message : "unknown");
  }
}
