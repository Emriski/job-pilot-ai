import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AppShell, PageHeading } from "@/components/AppShell";
import { JobCard, type JobCardJob } from "@/components/JobCard";
import { EmptyState, LoadingState } from "@/components/States";
import { Button } from "@/components/ui/button";
import { getMyContext } from "@/lib/profile.functions";
import { listSavedJobs, removeSavedJob } from "@/lib/jobs.functions";

export const Route = createFileRoute("/_authenticated/saved")({
  head: () => ({
    meta: [
      { title: "Saved jobs — JobePilotAI" },
      { name: "description", content: "The roles you've shortlisted, ready to prepare and apply for." },
      { property: "og:title", content: "Saved jobs — JobePilotAI" },
      { property: "og:description", content: "Your shortlisted roles in one place." },
    ],
  }),
  component: SavedPage,
});

function SavedPage() {
  const queryClient = useQueryClient();
  const loadContext = useServerFn(getMyContext);
  const loadSaved = useServerFn(listSavedJobs);
  const remove = useServerFn(removeSavedJob);

  const contextQuery = useQuery({ queryKey: ["me"], queryFn: () => loadContext() });
  const savedQuery = useQuery({ queryKey: ["saved-jobs"], queryFn: () => loadSaved() });

  const removeMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["saved-jobs"] });
      toast.success("Removed from saved jobs.");
    },
  });

  const items = savedQuery.data ?? [];

  return (
    <AppShell isAdmin={Boolean(contextQuery.data?.isAdmin)}>
      <PageHeading title="Saved jobs" description="Roles you've shortlisted. Prepare an application when you're ready." />

      {savedQuery.isLoading ? (
        <LoadingState message="Loading your saved jobs..." />
      ) : items.length === 0 ? (
        <EmptyState
          title="No saved jobs yet"
          description="Save jobs you're interested in and they'll appear here."
          action={
            <Button asChild>
              <Link to="/jobs">Browse jobs</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const job = item.job as JobCardJob | null;
            if (!job) return null;
            return (
              <JobCard
                key={item.id}
                job={job}
                saved
                onToggleSave={() => removeMutation.mutate(item.id)}
              />
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
