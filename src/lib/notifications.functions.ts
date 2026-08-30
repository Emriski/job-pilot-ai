import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadIdentities } from "./identity.server";
import { cleanText, safeInternalPath } from "./security";

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("notifications")
      .select("id, kind, title, body, link, actor_id, read_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[notifications] list failed", error.message);
      throw new Error("We couldn't load your notifications. Please try again.");
    }

    const rows = (data ?? []) as Array<{
      id: string;
      kind: string;
      title: string;
      body: string | null;
      link: string | null;
      actor_id: string | null;
      read_at: string | null;
      created_at: string;
    }>;
    const identities = await loadIdentities(
      supabase,
      rows.map((row) => row.actor_id),
    );

    return {
      unread: rows.filter((row) => !row.read_at).length,
      items: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        title: cleanText(row.title, 160),
        body: row.body ? cleanText(row.body, 400) : null,
        link: row.link ? safeInternalPath(row.link, "/community") : null,
        read: Boolean(row.read_at),
        createdAt: row.created_at,
        actor: row.actor_id ? (identities.get(row.actor_id) ?? null) : null,
      })),
    };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("read_at", null);
    return { ok: true };
  });
