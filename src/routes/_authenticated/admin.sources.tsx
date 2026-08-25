import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AppShell, PageHeading } from "@/components/AppShell";
import { ErrorState, LoadingState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { getSourceDashboard, runSourceSync, updateSource } from "@/lib/admin.functions";
import { getMyContext } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/admin/sources")({
  head: () => ({
    meta: [
      { title: "Job sources — JobePilotAI admin" },
      { name: "description", content: "Monitor connected job sources, sync status and listing counts." },
      { property: "og:title", content: "Job sources — JobePilotAI admin" },
      { property: "og:description", content: "Source health, sync runs and configuration." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminSourcesPage,
});

function AdminSourcesPage() {
  const queryClient = useQueryClient();
  const loadContext = useServerFn(getMyContext);
  const load = useServerFn(getSourceDashboard);
  const patch = useServerFn(updateSource);
  const sync = useServerFn(runSourceSync);

  const contextQuery = useQuery({ queryKey: ["me"], queryFn: () => loadContext() });
  const dashboardQuery = useQuery({ queryKey: ["admin-sources"], queryFn: () => load(), retry: false });

  const toggleMutation = useMutation({
    mutationFn: (values: { slug: string; enabled: boolean }) => patch({ data: values }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-sources"] }),
    onError: () => toast.error("We couldn't update that source. Please try again."),
  });

  const syncMutation = useMutation({
    mutationFn: (slug?: string) => sync({ data: { slug } }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-sources"] });
      toast.success(`Sync finished — ${result.inserted} new, ${result.updated} updated.`);
    },
    onError: (error: Error) => toast.error(error.message || "The sync couldn't be completed."),
  });

  if (dashboardQuery.isLoading) {
    return (
      <AppShell isAdmin>
        <LoadingState message="Loading source status..." />
      </AppShell>
    );
  }

  if (dashboardQuery.isError) {
    return (
      <AppShell isAdmin={Boolean(contextQuery.data?.isAdmin)}>
        <ErrorState title="Admin access required" message="This area is only available to administrators." />
      </AppShell>
    );
  }

  const { sources, runs } = dashboardQuery.data!;

  return (
    <AppShell isAdmin>
      <PageHeading
        title="Job sources"
        description="Connected public job sources, their configuration and recent sync runs."
        actions={
          <Button onClick={() => syncMutation.mutate(undefined)} disabled={syncMutation.isPending}>
            {syncMutation.isPending ? "Syncing sources..." : "Sync all sources"}
          </Button>
        }
      />

      <div className="grid gap-4">
        {sources.map((source) => (
          <article key={source.slug} className="surface-panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-foreground">{source.label}</h2>
                <p className="text-xs text-muted-foreground">{source.slug}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={source.enabled ? "secondary" : "outline"}>
                  {source.requires_config ? "Requires configuration" : source.enabled ? "Enabled" : "Disabled"}
                </Badge>
                <Switch
                  checked={Boolean(source.enabled)}
                  disabled={Boolean(source.requires_config) || toggleMutation.isPending}
                  aria-label={`Enable ${source.label}`}
                  onCheckedChange={(checked) => toggleMutation.mutate({ slug: source.slug, enabled: checked })}
                />
              </div>
            </div>

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Live listings</dt>
                <dd className="text-foreground">{source.job_count ?? 0}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Last sync</dt>
                <dd className="text-foreground">
                  {source.last_synced_at ? new Date(source.last_synced_at).toLocaleString() : "Never"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Status</dt>
                <dd className="text-foreground">{source.last_status ?? "Unknown"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Last error</dt>
                <dd className="text-foreground">{source.last_error ?? "None"}</dd>
              </div>
            </dl>

            {source.requires_config ? (
              <p className="mt-3 text-xs text-muted-foreground">
                This source has no public, permitted API. JobePilotAI does not scrape it or bypass its access rules.
              </p>
            ) : (
              <Button
                className="mt-4"
                size="sm"
                variant="outline"
                disabled={syncMutation.isPending || !source.enabled}
                onClick={() => syncMutation.mutate(source.slug)}
              >
                Sync this source
              </Button>
            )}
          </article>
        ))}
      </div>

      <section className="surface-panel mt-8 p-5">
        <h2 className="font-display text-base font-semibold">Recent sync runs</h2>
        {runs.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-3xl text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4">Source</th>
                  <th className="py-2 pr-4">Started</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Fetched</th>
                  <th className="py-2 pr-4">New</th>
                  <th className="py-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-t border-border">
                    <td className="py-2 pr-4">{run.source_slug}</td>
                    <td className="py-2 pr-4">{new Date(run.started_at).toLocaleString()}</td>
                    <td className="py-2 pr-4">{run.status}</td>
                    <td className="py-2 pr-4">{run.fetched_count ?? 0}</td>
                    <td className="py-2 pr-4">{run.inserted_count ?? 0}</td>
                    <td className="py-2">{run.error ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No sync runs recorded yet.</p>
        )}
      </section>
    </AppShell>
  );
}
