import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadIdentities } from "./identity.server";
import { notify } from "./notify.server";
import { enforceRateLimit } from "./rate-limit.server";
import { cleanText, safeExternalUrl } from "./security";
import { isAdmin } from "./user-context.server";
import {
  commentInputSchema,
  feedQuerySchema,
  postInputSchema,
  postUpdateSchema,
  reportSchema,
  targetUserSchema,
} from "./community-validation";

const PAGE_SIZE = 20;

/** Anything the caller has blocked or muted never reaches their feed. */
async function hiddenUserIds(supabase: Parameters<typeof isAdmin>[0], userId: string): Promise<string[]> {
  const [{ data: blocks }, { data: mutes }] = await Promise.all([
    supabase.from("user_blocks").select("blocked_user_id").eq("user_id", userId),
    supabase.from("user_mutes").select("muted_user_id").eq("user_id", userId),
  ]);
  const ids = new Set<string>();
  for (const row of (blocks ?? []) as Array<{ blocked_user_id: string }>) ids.add(row.blocked_user_id);
  for (const row of (mutes ?? []) as Array<{ muted_user_id: string }>) ids.add(row.muted_user_id);
  return [...ids];
}

async function assertNotRestricted(
  supabase: Parameters<typeof isAdmin>[0],
  userId: string,
  kind: "post" | "comment" | "message",
) {
  const { data } = await supabase
    .from("user_restrictions")
    .select("kind, expires_at")
    .eq("user_id", userId);
  const now = Date.now();
  for (const row of (data ?? []) as Array<{ kind: string; expires_at: string | null }>) {
    const active = !row.expires_at || new Date(row.expires_at).getTime() > now;
    if (!active) continue;
    if (row.kind === "banned") throw new Error("Your community access has been suspended.");
    if (row.kind === "muted" && kind !== "message") {
      throw new Error("You can't post in the community right now.");
    }
  }
}

/** Concrete, serializable shape for a job attached to a community post. */
export type SharedJobSummary = {
  id: string;
  title: string;
  company_name: string;
  location: string | null;
  remote: boolean;
  application_url: string | null;
  source: string | null;
};

function toSharedJob(value: unknown): SharedJobSummary | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v['id'] !== "string" || typeof v['title'] !== "string") return null;
  return {
    id: v['id'],
    title: cleanText(v['title'], 160),
    company_name: cleanText(v['company_name'], 160),
    location: typeof v['location'] === "string" ? cleanText(v['location'], 160) : null,
    remote: Boolean(v['remote']),
    application_url: safeExternalUrl(v['application_url']),
    source: typeof v['source'] === "string" ? cleanText(v['source'], 60) : null,
  };
}

type PostRow = {
  id: string;
  user_id: string;
  category: string;
  title: string;
  body: string;
  link_url: string | null;
  shared_job_id: string | null;
  shared_job: unknown;
  unverified_opportunity: boolean;
  comment_count: number;
  reaction_count: number;
  created_at: string;
};

async function decoratePosts(
  supabase: Parameters<typeof isAdmin>[0],
  userId: string,
  rows: PostRow[],
) {
  const identities = await loadIdentities(supabase, rows.map((row) => row.user_id));
  const ids = rows.map((row) => row.id);
  const { data: myReactions } = ids.length
    ? await supabase.from("community_reactions").select("post_id").eq("user_id", userId).in("post_id", ids)
    : { data: [] };
  const reacted = new Set(
    ((myReactions ?? []) as Array<{ post_id: string | null }>).map((row) => row.post_id).filter(Boolean) as string[],
  );

  return rows.map((row) => ({
    id: row.id,
    category: row.category,
    title: cleanText(row.title, 160),
    body: cleanText(row.body, 6000),
    linkUrl: safeExternalUrl(row.link_url),
    sharedJobId: row.shared_job_id,
    sharedJob: (row.shared_job as Record<string, unknown> | null) ?? null,
    unverifiedOpportunity: row.unverified_opportunity,
    commentCount: row.comment_count,
    reactionCount: row.reaction_count,
    createdAt: row.created_at,
    isMine: row.user_id === userId,
    author: identities.get(row.user_id) ?? { id: row.user_id, nickname: null, avatarUrl: null, headline: null },
    hasReacted: reacted.has(row.id),
  }));
}

export const getFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => feedQuerySchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const hidden = await hiddenUserIds(supabase, userId);

    let query = supabase
      .from("community_posts")
      .select(
        "id, user_id, category, title, body, link_url, shared_job_id, shared_job, unverified_opportunity, comment_count, reaction_count, created_at",
      )
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .range((data.page - 1) * PAGE_SIZE, data.page * PAGE_SIZE - 1);

    if (data.category !== "all") query = query.eq("category", data.category);
    if (data.search) {
      const safe = data.search.replace(/[%,()]/g, " ").trim();
      if (safe) query = query.or(`title.ilike.%${safe}%,body.ilike.%${safe}%`);
    }
    if (hidden.length) query = query.not("user_id", "in", `(${hidden.join(",")})`);

    const { data: rows, error } = await query;
    if (error) {
      console.error("[community] feed failed", error.message);
      throw new Error("We couldn't load the community feed. Please try again.");
    }
    const posts = await decoratePosts(supabase, userId, (rows ?? []) as PostRow[]);
    return { posts, page: data.page, hasMore: posts.length === PAGE_SIZE };
  });

export const getPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ postId: z.uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("community_posts")
      .select(
        "id, user_id, category, title, body, link_url, shared_job_id, shared_job, unverified_opportunity, comment_count, reaction_count, created_at, status",
      )
      .eq("id", data.postId)
      .maybeSingle();
    if (!row || ((row as { status: string }).status !== "published" && (row as PostRow).user_id !== userId)) {
      return null;
    }

    const [post] = await decoratePosts(supabase, userId, [row as PostRow]);

    const { data: commentRows } = await supabase
      .from("community_comments")
      .select("id, user_id, parent_id, body, created_at")
      .eq("post_id", data.postId)
      .eq("status", "published")
      .order("created_at", { ascending: true })
      .limit(300);

    const comments = (commentRows ?? []) as Array<{
      id: string;
      user_id: string;
      parent_id: string | null;
      body: string;
      created_at: string;
    }>;
    const identities = await loadIdentities(supabase, comments.map((item) => item.user_id));

    return {
      post: post!,
      comments: comments.map((item) => ({
        id: item.id,
        parentId: item.parent_id,
        body: cleanText(item.body, 3000),
        createdAt: item.created_at,
        isMine: item.user_id === userId,
        author: identities.get(item.user_id) ?? {
          id: item.user_id,
          nickname: null,
          avatarUrl: null,
          headline: null,
        },
      })),
    };
  });

const OPPORTUNITY_CATEGORY = "Jobs & Opportunities";

export const createPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => postInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertNotRestricted(supabase, userId, "post");
    await enforceRateLimit(supabase, userId, "community_post");

    // Community members must have a public identity before they can post.
    const { data: profile } = await supabase.from("profiles").select("nickname").eq("id", userId).maybeSingle();
    if (!(profile as { nickname: string | null } | null)?.nickname) {
      throw new Error("Choose a nickname on your profile before posting.");
    }

    let sharedJob: Record<string, unknown> | null = null;
    if (data.shared_job_id) {
      const { data: job } = await supabase
        .from("jobs")
        .select("id, title, company_name, location, remote, application_url, source")
        .eq("id", data.shared_job_id)
        .maybeSingle();
      sharedJob = (job as Record<string, unknown> | null) ?? null;
    }

    const link = safeExternalUrl(data.link_url);
    const { data: row, error } = await supabase
      .from("community_posts")
      .insert({
        user_id: userId,
        category: data.category,
        title: cleanText(data.title, 160),
        body: cleanText(data.body, 6000),
        link_url: link,
        shared_job_id: sharedJob ? data.shared_job_id : null,
        shared_job: sharedJob as never,
        // Anything shared as an opportunity that is not one of our verified
        // listings is labelled so members treat it with caution.
        unverified_opportunity: data.category === OPPORTUNITY_CATEGORY && !sharedJob,
      })
      .select("id")
      .single();

    if (error || !row) {
      console.error("[community] post failed", error?.message);
      throw new Error("We couldn't publish that post. Please try again.");
    }
    return { id: (row as { id: string }).id };
  });

export const updatePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => postUpdateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("community_posts")
      .update({ title: cleanText(data.title, 160), body: cleanText(data.body, 6000) })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error("We couldn't update that post. Please try again.");
    return { ok: true };
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await context.supabase.from("community_posts").delete().eq("id", data.id).eq("user_id", context.userId);
    return { ok: true };
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => commentInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertNotRestricted(supabase, userId, "comment");
    await enforceRateLimit(supabase, userId, "community_comment");

    const { data: post } = await supabase
      .from("community_posts")
      .select("id, user_id, title, status")
      .eq("id", data.postId)
      .maybeSingle();
    const postRow = post as { id: string; user_id: string; title: string; status: string } | null;
    if (!postRow || postRow.status !== "published") throw new Error("That post is no longer available.");

    let parentAuthor: string | null = null;
    if (data.parentId) {
      const { data: parent } = await supabase
        .from("community_comments")
        .select("user_id, post_id")
        .eq("id", data.parentId)
        .maybeSingle();
      const parentRow = parent as { user_id: string; post_id: string } | null;
      if (!parentRow || parentRow.post_id !== data.postId) throw new Error("That comment is no longer available.");
      parentAuthor = parentRow.user_id;
    }

    const { data: row, error } = await supabase
      .from("community_comments")
      .insert({
        post_id: data.postId,
        user_id: userId,
        parent_id: data.parentId,
        body: cleanText(data.body, 3000),
      })
      .select("id")
      .single();
    if (error || !row) {
      console.error("[community] comment failed", error?.message);
      throw new Error("We couldn't post that comment. Please try again.");
    }

    if (parentAuthor) {
      await notify({
        userId: parentAuthor,
        actorId: userId,
        kind: "reply",
        title: "Someone replied to your comment",
        body: postRow.title,
        link: `/community/${postRow.id}`,
      });
    }
    await notify({
      userId: postRow.user_id,
      actorId: userId,
      kind: "comment",
      title: "New comment on your post",
      body: postRow.title,
      link: `/community/${postRow.id}`,
    });

    return { id: (row as { id: string }).id };
  });

export const deleteComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await context.supabase.from("community_comments").delete().eq("id", data.id).eq("user_id", context.userId);
    return { ok: true };
  });

export const toggleReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ postId: z.uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("community_reactions")
      .select("id")
      .eq("user_id", userId)
      .eq("post_id", data.postId)
      .maybeSingle();

    if (existing) {
      await supabase.from("community_reactions").delete().eq("id", (existing as { id: string }).id);
      return { reacted: false };
    }

    const { error } = await supabase
      .from("community_reactions")
      .insert({ user_id: userId, post_id: data.postId, kind: "like" });
    if (error) throw new Error("We couldn't record that reaction. Please try again.");

    const { data: post } = await supabase
      .from("community_posts")
      .select("user_id, title")
      .eq("id", data.postId)
      .maybeSingle();
    const row = post as { user_id: string; title: string } | null;
    if (row) {
      await notify({
        userId: row.user_id,
        actorId: userId,
        kind: "reaction",
        title: "Someone liked your post",
        body: row.title,
        link: `/community/${data.postId}`,
      });
    }
    return { reacted: true };
  });

export const followUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => targetUserSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.userId === userId) throw new Error("You can't follow yourself.");
    const { error } = await supabase
      .from("user_follows")
      .upsert({ follower_id: userId, following_id: data.userId }, { onConflict: "follower_id,following_id" });
    if (error) throw new Error("We couldn't follow that person. Please try again.");
    await notify({
      userId: data.userId,
      actorId: userId,
      kind: "follow",
      title: "You have a new follower",
      link: "/community",
    });
    return { following: true };
  });

export const unfollowUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => targetUserSchema.parse(data))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("user_follows")
      .delete()
      .eq("follower_id", context.userId)
      .eq("following_id", data.userId);
    return { following: false };
  });

export const blockUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => targetUserSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.userId === userId) throw new Error("You can't block yourself.");
    await supabase.from("user_blocks").upsert(
      { user_id: userId, blocked_user_id: data.userId },
      { onConflict: "user_id,blocked_user_id" },
    );
    await supabase.from("user_follows").delete().eq("follower_id", userId).eq("following_id", data.userId);
    await supabase.from("user_follows").delete().eq("follower_id", data.userId).eq("following_id", userId);
    return { ok: true };
  });

export const unblockUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => targetUserSchema.parse(data))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("user_blocks")
      .delete()
      .eq("user_id", context.userId)
      .eq("blocked_user_id", data.userId);
    return { ok: true };
  });

export const muteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => targetUserSchema.parse(data))
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) throw new Error("You can't mute yourself.");
    await context.supabase
      .from("user_mutes")
      .upsert({ user_id: context.userId, muted_user_id: data.userId }, { onConflict: "user_id,muted_user_id" });
    return { ok: true };
  });

export const unmuteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => targetUserSchema.parse(data))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("user_mutes")
      .delete()
      .eq("user_id", context.userId)
      .eq("muted_user_id", data.userId);
    return { ok: true };
  });

export const listBlockedAndMuted = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: blocks }, { data: mutes }] = await Promise.all([
      supabase.from("user_blocks").select("blocked_user_id").eq("user_id", userId),
      supabase.from("user_mutes").select("muted_user_id").eq("user_id", userId),
    ]);
    const blockIds = ((blocks ?? []) as Array<{ blocked_user_id: string }>).map((r) => r.blocked_user_id);
    const muteIds = ((mutes ?? []) as Array<{ muted_user_id: string }>).map((r) => r.muted_user_id);
    const identities = await loadIdentities(supabase, [...blockIds, ...muteIds]);
    return {
      blocked: blockIds.map((id) => identities.get(id)!).filter(Boolean),
      muted: muteIds.map((id) => identities.get(id)!).filter(Boolean),
    };
  });

export const reportContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => reportSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("community_reports").insert({
      reporter_id: context.userId,
      target_type: data.target_type,
      target_id: data.target_id,
      reason: data.reason,
      details: data.details ? cleanText(data.details, 1000) : null,
    });
    if (error) {
      console.error("[community] report failed", error.message);
      throw new Error("We couldn't send that report. Please try again.");
    }
    return { ok: true };
  });

/* ---------------------------------- moderation --------------------------------- */

async function assertModerator(supabase: Parameters<typeof isAdmin>[0], userId: string) {
  if (!(await isAdmin(supabase, userId))) throw new Error("You don't have access to this area.");
}

export const listReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertModerator(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("community_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const moderateContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        reportId: z.uuid().nullable().default(null),
        action: z.enum(["remove_post", "remove_comment", "restrict_user", "lift_restriction", "dismiss"]),
        targetId: z.uuid(),
        notes: z.string().trim().max(500).nullable().default(null),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertModerator(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.action === "remove_post") {
      await supabaseAdmin.from("community_posts").update({ status: "removed" }).eq("id", data.targetId);
      const { data: post } = await supabaseAdmin
        .from("community_posts")
        .select("user_id, title")
        .eq("id", data.targetId)
        .maybeSingle();
      if (post) {
        await notify({
          userId: (post as { user_id: string }).user_id,
          kind: "moderation",
          title: "A post was removed by moderators",
          body: data.notes ?? (post as { title: string }).title,
        });
      }
    } else if (data.action === "remove_comment") {
      await supabaseAdmin.from("community_comments").update({ status: "removed" }).eq("id", data.targetId);
    } else if (data.action === "restrict_user") {
      await supabaseAdmin.from("user_restrictions").insert({
        user_id: data.targetId,
        kind: "muted",
        reason: data.notes,
        created_by: userId,
      });
      await notify({
        userId: data.targetId,
        kind: "moderation",
        title: "Your community posting has been restricted",
        body: data.notes,
      });
    } else if (data.action === "lift_restriction") {
      await supabaseAdmin.from("user_restrictions").delete().eq("user_id", data.targetId);
    }

    await supabaseAdmin.from("moderation_actions").insert({
      moderator_id: userId,
      action: data.action,
      target_type: data.action.includes("comment") ? "comment" : data.action.includes("post") ? "post" : "user",
      target_id: data.targetId,
      notes: data.notes,
    });

    if (data.reportId) {
      await supabaseAdmin
        .from("community_reports")
        .update({
          status: data.action === "dismiss" ? "dismissed" : "actioned",
          resolution: data.action,
          resolved_by: userId,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", data.reportId);
    }

    return { ok: true };
  });
