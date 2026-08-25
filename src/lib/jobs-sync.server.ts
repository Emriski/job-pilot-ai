import { dedupeJobs } from "./jobs/normalize";
import { runSource } from "./jobs/sources.server";
import type { NormalizedJob } from "./jobs/types";

export type SyncSummary = {
  sources: Array<{ slug: string; fetched: number; error: string | null }>;
  upserted: number;
};

/**
 * Refresh the shared job catalogue from every enabled public source.
 * One failing source never breaks the rest — errors are recorded per source
 * and surfaced in the admin dashboard.
 */
export async function syncAllSources(onlySlug?: string): Promise<SyncSummary> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let query = supabaseAdmin.from("job_sources").select("slug, config, enabled, status").eq("enabled", true);
  if (onlySlug) query = query.eq("slug", onlySlug);
  const { data: sources, error } = await query;
  if (error) throw new Error(error.message);

  const runnable = (sources ?? []).filter((source) => source.status !== "requires_configuration");
  const startedAt = new Date().toISOString();

  const results = await Promise.allSettled(
    runnable.map((source) =>
      runSource({ slug: source.slug, config: (source.config as Record<string, unknown>) ?? {} }),
    ),
  );

  const collected: NormalizedJob[] = [];
  const summary: SyncSummary["sources"] = [];

  for (let index = 0; index < results.length; index += 1) {
    const source = runnable[index];
    if (!source) continue;
    const result = results[index];
    if (result?.status === "fulfilled") {
      collected.push(...result.value.jobs);
      summary.push({ slug: source.slug, fetched: result.value.jobs.length, error: result.value.error });
    } else {
      summary.push({ slug: source.slug, fetched: 0, error: "Source request failed." });
    }
  }

  const deduped = dedupeJobs(collected);
  let upserted = 0;

  for (let offset = 0; offset < deduped.length; offset += 200) {
    const batch = deduped.slice(offset, offset + 200).map((job) => ({ ...job, last_synced_at: startedAt, expired: false }));
    const { error: upsertError, count } = await supabaseAdmin
      .from("jobs")
      .upsert(batch, { onConflict: "dedupe_key", count: "exact" });
    if (upsertError) {
      console.error("[jobs] upsert failed", upsertError.message);
      continue;
    }
    upserted += count ?? batch.length;
  }

  for (const item of summary) {
    const fetchedOk = item.error === null && item.fetched > 0;

    if (fetchedOk) {
      // Listings this source no longer returns are treated as expired.
      await supabaseAdmin
        .from("jobs")
        .update({ expired: true })
        .eq("source", item.slug)
        .lt("last_synced_at", startedAt);
    }

    const { count } = await supabaseAdmin
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("source", item.slug)
      .eq("expired", false);

    await supabaseAdmin
      .from("job_sources")
      .update({
        status: item.error ? "error" : "active",
        last_error: item.error,
        last_sync_at: new Date().toISOString(),
        job_count: count ?? 0,
        updated_at: new Date().toISOString(),
      })
      .eq("slug", item.slug);

    await supabaseAdmin.from("job_source_runs").insert({
      source_slug: item.slug,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      fetched: item.fetched,
      upserted: item.fetched,
      error: item.error,
    });
  }

  return { sources: summary, upserted };
}

/** Trigger a background refresh when the catalogue is stale, without blocking the user. */
export async function ensureFreshCatalogue(maxAgeMinutes = 180): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60_000).toISOString();
  const { count } = await supabaseAdmin
    .from("job_sources")
    .select("slug", { count: "exact", head: true })
    .eq("enabled", true)
    .or(`last_sync_at.is.null,last_sync_at.lt.${cutoff}`);
  return (count ?? 0) > 0;
}
