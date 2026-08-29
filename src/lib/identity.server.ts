import type { SupabaseClient } from "@supabase/supabase-js";

import { cleanText } from "./security";

export type PublicIdentity = {
  id: string;
  nickname: string | null;
  avatarUrl: string | null;
  headline: string | null;
};

const AVATAR_TTL = 60 * 60; // one hour

/** Signs private avatar paths so pictures render without making the bucket public. */
export async function signAvatar(
  supabase: SupabaseClient,
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, AVATAR_TTL);
  return data?.signedUrl ?? null;
}

async function signMany(supabase: SupabaseClient, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return out;
  const { data } = await supabase.storage.from("avatars").createSignedUrls(unique, AVATAR_TTL);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) out.set(item.path, item.signedUrl);
  }
  return out;
}

/**
 * Resolves the *public* community identity of a set of users. Only nickname,
 * picture and headline ever leave this function — never email, resume or
 * application data.
 */
export async function loadIdentities(
  supabase: SupabaseClient,
  userIds: Array<string | null | undefined>,
): Promise<Map<string, PublicIdentity>> {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  const map = new Map<string, PublicIdentity>();
  if (!ids.length) return map;

  const { data } = await supabase
    .from("profiles")
    .select("id, nickname, avatar_path, headline")
    .in("id", ids);

  const rows = (data ?? []) as Array<{
    id: string;
    nickname: string | null;
    avatar_path: string | null;
    headline: string | null;
  }>;
  const signed = await signMany(
    supabase,
    rows.map((row) => row.avatar_path).filter((p): p is string => Boolean(p)),
  );

  for (const row of rows) {
    map.set(row.id, {
      id: row.id,
      nickname: row.nickname ? cleanText(row.nickname, 40) : null,
      avatarUrl: row.avatar_path ? (signed.get(row.avatar_path) ?? null) : null,
      headline: row.headline ? cleanText(row.headline, 160) : null,
    });
  }

  for (const id of ids) {
    if (!map.has(id)) map.set(id, { id, nickname: null, avatarUrl: null, headline: null });
  }
  return map;
}

const IMAGE_SIGNATURES: Array<{ ext: string; test: (bytes: Uint8Array) => boolean }> = [
  { ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    ext: "png",
    test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    ext: "webp",
    test: (b) =>
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45,
  },
];

/** Confirms the uploaded bytes really are a JPEG/PNG/WebP image. */
export async function verifyAvatarBytes(supabase: SupabaseClient, path: string): Promise<boolean> {
  const { data, error } = await supabase.storage.from("avatars").download(path);
  if (error || !data) return false;
  if (data.size > 5 * 1024 * 1024) return false;
  const bytes = new Uint8Array(await data.slice(0, 16).arrayBuffer());
  return IMAGE_SIGNATURES.some((sig) => sig.test(bytes));
}
