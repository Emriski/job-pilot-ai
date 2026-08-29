import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadIdentities, signAvatar, verifyAvatarBytes } from "./identity.server";
import { cleanText } from "./security";
import {
  avatarSchema,
  communityProfileSchema,
  nicknameSchema,
  normalizeNickname,
  validateNickname,
  nicknameProblemMessage,
} from "./community-validation";
import { z } from "zod";

function suggestionsFor(base: string): string[] {
  const root = normalizeNickname(base).slice(0, 24) || "user";
  const year = new Date().getFullYear();
  return [`${root}1`, `${root}_official`, `${root}${year % 100}`, `${root}_hq`].slice(0, 4);
}

export const getMyIdentity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select(
        "id, nickname, avatar_path, headline, career_interests, location, show_location, public_profile, skills, target_titles",
      )
      .eq("id", context.userId)
      .maybeSingle();
    const row = data as {
      id: string;
      nickname: string | null;
      avatar_path: string | null;
      headline: string | null;
      career_interests: string[];
      location: string | null;
      show_location: boolean;
      public_profile: boolean;
      skills: string[];
      target_titles: string[];
    } | null;
    if (!row) return null;
    return { ...row, avatarUrl: await signAvatar(context.supabase, row.avatar_path) };
  });

export const checkNickname = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => nicknameSchema.parse(data))
  .handler(async ({ data, context }) => {
    const problem = validateNickname(data.nickname);
    if (problem) {
      return {
        available: false,
        message: nicknameProblemMessage(problem)!,
        suggestions: [] as string[],
      };
    }
    const normalized = normalizeNickname(data.nickname);
    const { data: existing } = await context.supabase
      .from("profiles")
      .select("id")
      .eq("normalized_nickname", normalized)
      .maybeSingle();
    if (existing && (existing as { id: string }).id !== context.userId) {
      return {
        available: false,
        message: `@${data.nickname.replace(/^@+/, "")} is taken. Please choose another.`,
        suggestions: suggestionsFor(normalized),
      };
    }
    return { available: true, message: "That nickname is available.", suggestions: [] as string[] };
  });

export const claimNickname = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => nicknameSchema.parse(data))
  .handler(async ({ data, context }) => {
    const problem = validateNickname(data.nickname);
    if (problem) throw new Error(nicknameProblemMessage(problem)!);

    // The database is the final authority: a unique index plus this function
    // means two people cannot claim the same nickname at the same time.
    const { error } = await context.supabase.rpc("claim_nickname", { _nickname: data.nickname });
    if (error) {
      const message = error.message || "";
      if (message.includes("nickname_taken")) {
        throw new Error("That nickname is already taken. Please choose another.");
      }
      if (message.includes("reserved_nickname"))
        throw new Error("That nickname is reserved. Please choose another.");
      if (message.includes("invalid_nickname"))
        throw new Error("Use 3–30 letters, numbers or underscores.");
      console.error("[identity] nickname claim failed", message);
      throw new Error("We couldn't save that nickname. Please try again.");
    }
    return { ok: true, nickname: data.nickname.replace(/^@+/, "") };
  });

export const saveCommunityProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => communityProfileSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({
        headline: data.headline ? cleanText(data.headline, 160) : null,
        career_interests: data.career_interests.map((item) => cleanText(item, 60)),
        location: data.location ? cleanText(data.location, 120) : null,
        show_location: data.show_location,
        public_profile: data.public_profile,
      })
      .eq("id", context.userId);
    if (error) {
      console.error("[identity] profile save failed", error.message);
      throw new Error("We couldn't save your profile. Please try again.");
    }
    return { ok: true };
  });

export const setAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => avatarSchema.parse(data))
  .handler(async ({ data, context }) => {
    // The uploaded name is never trusted — the path must sit inside the
    // caller's own folder and the bytes must really be an image.
    if (!data.path.startsWith(`${context.userId}/`) || data.path.includes("..")) {
      throw new Error("That upload isn't valid. Please try again.");
    }
    const ok = await verifyAvatarBytes(context.supabase, data.path);
    if (!ok) {
      await context.supabase.storage.from("avatars").remove([data.path]);
      throw new Error("That file isn't a supported image. Please upload a JPG, PNG or WebP.");
    }

    const { data: current } = await context.supabase
      .from("profiles")
      .select("avatar_path")
      .eq("id", context.userId)
      .maybeSingle();
    const previous = (current as { avatar_path: string | null } | null)?.avatar_path ?? null;

    const { error } = await context.supabase
      .from("profiles")
      .update({ avatar_path: data.path })
      .eq("id", context.userId);
    if (error) {
      console.error("[identity] avatar save failed", error.message);
      throw new Error("We couldn't save your picture. Please try again.");
    }
    if (previous && previous !== data.path) {
      await context.supabase.storage.from("avatars").remove([previous]);
    }
    return { avatarUrl: await signAvatar(context.supabase, data.path) };
  });

export const removeAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: current } = await context.supabase
      .from("profiles")
      .select("avatar_path")
      .eq("id", context.userId)
      .maybeSingle();
    const previous = (current as { avatar_path: string | null } | null)?.avatar_path ?? null;
    if (previous) await context.supabase.storage.from("avatars").remove([previous]);
    await context.supabase.from("profiles").update({ avatar_path: null }).eq("id", context.userId);
    return { ok: true };
  });

export const getPublicProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ nickname: z.string().trim().min(1).max(40) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const normalized = normalizeNickname(data.nickname);
    const { data: row } = await context.supabase
      .from("profiles")
      .select(
        "id, nickname, avatar_path, headline, skills, career_interests, target_titles, location, show_location, public_profile, created_at",
      )
      .eq("normalized_nickname", normalized)
      .maybeSingle();
    const profile = row as {
      id: string;
      nickname: string;
      avatar_path: string | null;
      headline: string | null;
      skills: string[];
      career_interests: string[];
      target_titles: string[];
      location: string | null;
      show_location: boolean;
      public_profile: boolean;
      created_at: string;
    } | null;
    if (!profile) return null;

    const [{ data: posts }, { count: followers }, { count: following }, { data: isFollowing }] =
      await Promise.all([
        context.supabase
          .from("community_posts")
          .select("id, title, category, created_at, comment_count, reaction_count")
          .eq("user_id", profile.id)
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .limit(20),
        context.supabase
          .from("user_follows")
          .select("id", { count: "exact", head: true })
          .eq("following_id", profile.id),
        context.supabase
          .from("user_follows")
          .select("id", { count: "exact", head: true })
          .eq("follower_id", profile.id),
        context.supabase
          .from("user_follows")
          .select("id")
          .eq("follower_id", context.userId)
          .eq("following_id", profile.id)
          .maybeSingle(),
      ]);

    return {
      id: profile.id,
      isSelf: profile.id === context.userId,
      nickname: profile.nickname,
      avatarUrl: await signAvatar(context.supabase, profile.avatar_path),
      headline: profile.headline,
      skills: profile.skills ?? [],
      careerInterests: profile.career_interests ?? [],
      targetTitles: profile.target_titles ?? [],
      location: profile.show_location ? profile.location : null,
      joinedAt: profile.created_at,
      posts: posts ?? [],
      followers: followers ?? 0,
      following: following ?? 0,
      isFollowing: Boolean(isFollowing),
    };
  });

export const searchPeople = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ query: z.string().trim().max(60).default("") }).parse(data),
  )
  .handler(async ({ data, context }) => {
    let request = context.supabase
      .from("profiles")
      .select("id, nickname, avatar_path, headline")
      .not("nickname", "is", null)
      .eq("public_profile", true)
      .limit(20);
    if (data.query) request = request.ilike("nickname", `%${data.query.replace(/[%_]/g, "")}%`);
    const { data: rows } = await request;
    const ids = (rows ?? []).map((row) => (row as { id: string }).id);
    const identities = await loadIdentities(context.supabase, ids);
    return ids.map((id) => identities.get(id)!).filter(Boolean);
  });
