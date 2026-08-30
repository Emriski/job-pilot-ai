import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadIdentities } from "./identity.server";
import { notify } from "./notify.server";
import { enforceRateLimit } from "./rate-limit.server";
import { cleanText } from "./security";
import { conversationSchema, messageSchema } from "./community-validation";

type Client = Parameters<typeof loadIdentities>[0];

/** Conversation rows are stored with a stable ordering so a pair only ever has one row. */
function pair(a: string, b: string): { user_a: string; user_b: string } {
  return a < b ? { user_a: a, user_b: b } : { user_a: b, user_b: a };
}

async function isBlocked(supabase: Client, a: string, b: string): Promise<boolean> {
  const { data } = await supabase.rpc("is_blocked", { _a: a, _b: b });
  return Boolean(data);
}

async function loadConversation(supabase: Client, conversationId: string, userId: string) {
  const { data } = await supabase
    .from("conversations")
    .select("id, user_a, user_b, last_message_at")
    .eq("id", conversationId)
    .maybeSingle();
  const row = data as { id: string; user_a: string; user_b: string } | null;
  if (!row || (row.user_a !== userId && row.user_b !== userId)) return null;
  return row;
}

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("conversations")
      .select("id, user_a, user_b, last_message_at")
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .order("last_message_at", { ascending: false })
      .limit(50);

    const rows = (data ?? []) as Array<{
      id: string;
      user_a: string;
      user_b: string;
      last_message_at: string;
    }>;
    const others = rows.map((row) => (row.user_a === userId ? row.user_b : row.user_a));
    const identities = await loadIdentities(supabase, others);

    const previews = await Promise.all(
      rows.map(async (row) => {
        const otherId = row.user_a === userId ? row.user_b : row.user_a;
        const [{ data: last }, { count }] = await Promise.all([
          supabase
            .from("messages")
            .select("body, created_at, sender_id")
            .eq("conversation_id", row.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", row.id)
            .neq("sender_id", userId)
            .is("read_at", null),
        ]);
        const lastRow = last as { body: string; created_at: string; sender_id: string } | null;
        return {
          id: row.id,
          lastMessageAt: row.last_message_at,
          unread: count ?? 0,
          preview: lastRow ? cleanText(lastRow.body, 140) : null,
          lastFromMe: lastRow ? lastRow.sender_id === userId : false,
          participant: identities.get(otherId) ?? {
            id: otherId,
            nickname: null,
            avatarUrl: null,
            headline: null,
          },
        };
      }),
    );

    return previews;
  });

export const getConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => conversationSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const conversation = await loadConversation(supabase, data.conversationId, userId);
    if (!conversation) return null;
    const otherId = conversation.user_a === userId ? conversation.user_b : conversation.user_a;

    const { data: rows } = await supabase
      .from("messages")
      .select("id, sender_id, body, created_at, read_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .limit(200);

    // Reading a thread marks the other person's messages as read.
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversation.id)
      .neq("sender_id", userId)
      .is("read_at", null);

    const identities = await loadIdentities(supabase, [otherId]);

    return {
      id: conversation.id,
      participant: identities.get(otherId) ?? {
        id: otherId,
        nickname: null,
        avatarUrl: null,
        headline: null,
      },
      blocked: await isBlocked(supabase, userId, otherId),
      messages: (
        (rows ?? []) as Array<{
          id: string;
          sender_id: string;
          body: string;
          created_at: string;
        }>
      ).map((row) => ({
        id: row.id,
        body: cleanText(row.body, 4000),
        createdAt: row.created_at,
        isMine: row.sender_id === userId,
      })),
    };
  });

export const startConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ recipientId: z.uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.recipientId === userId) throw new Error("You can't message yourself.");
    if (await isBlocked(supabase, userId, data.recipientId)) {
      throw new Error("You can't message this person.");
    }

    const key = pair(userId, data.recipientId);
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_a", key.user_a)
      .eq("user_b", key.user_b)
      .maybeSingle();
    if (existing) return { id: (existing as { id: string }).id };

    const { data: created, error } = await supabase
      .from("conversations")
      .insert(key)
      .select("id")
      .single();
    if (error || !created) {
      console.error("[messages] conversation failed", error?.message);
      throw new Error("We couldn't open that conversation. Please try again.");
    }
    return { id: (created as { id: string }).id };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => messageSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.recipientId === userId) throw new Error("You can't message yourself.");
    if (await isBlocked(supabase, userId, data.recipientId)) {
      throw new Error("You can't message this person.");
    }
    await enforceRateLimit(supabase, userId, "community_message");

    const key = pair(userId, data.recipientId);
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_a", key.user_a)
      .eq("user_b", key.user_b)
      .maybeSingle();

    let conversationId = (existing as { id: string } | null)?.id ?? null;
    if (!conversationId) {
      const { data: created, error } = await supabase
        .from("conversations")
        .insert(key)
        .select("id")
        .single();
      if (error || !created) {
        console.error("[messages] conversation failed", error?.message);
        throw new Error("We couldn't send that message. Please try again.");
      }
      conversationId = (created as { id: string }).id;
    }

    const body = cleanText(data.body, 4000);
    if (!body) throw new Error("Please write a message first.");

    const { error: insertError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: userId,
      body,
    });
    if (insertError) {
      console.error("[messages] send failed", insertError.message);
      throw new Error("We couldn't send that message. Please try again.");
    }

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    await notify({
      userId: data.recipientId,
      actorId: userId,
      kind: "message",
      title: "You have a new message",
      body: body.slice(0, 120),
      link: `/messages?c=${conversationId}`,
    });

    return { conversationId };
  });
