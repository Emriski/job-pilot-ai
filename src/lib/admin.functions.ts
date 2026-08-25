import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdmin } from "./user-context.server";
import { sourceUpdateSchema } from "./validation";

async function assertAdmin(supabase: Parameters<typeof isAdmin>[0], userId: string) {
  if (!(await isAdmin(supabase, userId))) throw new Error("You don't have access to this area.");
}

export const getSourceDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const [{ data: sources }, { data: runs }] = await Promise.all([
      context.supabase.from("job_sources").select("*").order("label"),
      context.supabase.from("job_source_runs").select("*").order("started_at", { ascending: false }).limit(30),
    ]);
    return { sources: sources ?? [], runs: runs ?? [] };
  });

export const updateSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => sourceUpdateSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const patch: Record<string, unknown> = {};
    if (data.enabled !== undefined) patch["enabled"] = data.enabled;
    if (data.boards !== undefined) patch["config"] = { boards: data.boards };
    const { error } = await context.supabase
      .from("job_sources")
      .update(patch as never)
      .eq("slug", data.slug);
    if (error) {
      console.error("[admin] source update failed", error.message);
      throw new Error("We couldn't update that source. Please try again.");
    }
    return { ok: true };
  });

export const runSourceSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { slug?: string }) => ({ slug: typeof data?.slug === "string" ? data.slug.slice(0, 40) : undefined }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { syncAllSources } = await import("./jobs-sync.server");
    return syncAllSources(data.slug);
  });
