import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AppShell, PageHeading } from "@/components/AppShell";
import { timeAgo } from "@/components/community/CommunityBits";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listReports, moderateContent } from "@/lib/community.functions";
import { getMyContext } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/admin/moderation")({
  head: () => ({
    meta: [
      { title: "Moderation queue — JobePilotAI admin" },
      {
        name: "description",
        content: "Review reported community posts, comments and members.",
      },
      { property: "og:title", content: "Moderation queue — JobePilotAI admin" },
      { property: "og:description", content: "Reported community content awaiting review." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminModerationPage,
});

type ReportRow = {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
};

export function AdminModerationPage() {
  const queryClient = useQueryClient();
  const loadContext = useServerFn(getMyContext);
  const load = useServerFn(listReports);
  const moderate = useServerFn(moderateContent);

  const contextQuery = useQuery({ queryKey: ["me"], queryFn: () => loadContext() });
  const query = useQuery({ queryKey: ["moderation-reports"], queryFn: () => load(), retry: false });

  const actionMutation = useMutation({
    mutationFn: (values: {
      reportId: string;
      action: "remove_post" | "remove_comment" | "restrict_user" | "dismiss";
      targetId: string;
    }) => moderate({ data: { ...values, notes: null } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["moderation-reports"] });
      toast.success("Report handled.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reports = (query.data ?? []) as ReportRow[];

  return (
    <AppShell isAdmin={Boolean(contextQuery.data?.isAdmin)}>
      <PageHeading
        title="Moderation queue"
        description="Review reports from the community and take action."
      />

      {query.isLoading ? <LoadingState message="Loading reports…" /> : null}
      {query.isError ? (
        <ErrorState
          message={(query.error as Error).message}
          action={<Button onClick={() => query.refetch()}>Try again</Button>}
        />
      ) : null}

      {query.data && reports.length === 0 ? (
        <EmptyState title="Nothing to review" description="There are no open reports right now." />
      ) : null}

      <ul className="space-y-3">
        {reports.map((report) => (
          <li key={report.id} className="surface-panel space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{report.target_type}</Badge>
              <Badge variant="outline">{report.reason}</Badge>
              <Badge variant={report.status === "open" ? "default" : "outline"}>
                {report.status}
              </Badge>
              <span className="text-xs text-muted-foreground">{timeAgo(report.created_at)}</span>
            </div>
            {report.details ? (
              <p className="break-words text-sm text-muted-foreground">{report.details}</p>
            ) : null}
            <p className="break-all text-xs text-muted-foreground">Target: {report.target_id}</p>

            {report.status === "open" ? (
              <div className="flex flex-wrap gap-2">
                {report.target_type === "post" ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={actionMutation.isPending}
                    onClick={() =>
                      actionMutation.mutate({
                        reportId: report.id,
                        action: "remove_post",
                        targetId: report.target_id,
                      })
                    }
                  >
                    Remove post
                  </Button>
                ) : null}
                {report.target_type === "comment" ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={actionMutation.isPending}
                    onClick={() =>
                      actionMutation.mutate({
                        reportId: report.id,
                        action: "remove_comment",
                        targetId: report.target_id,
                      })
                    }
                  >
                    Remove comment
                  </Button>
                ) : null}
                {report.target_type === "user" ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={actionMutation.isPending}
                    onClick={() =>
                      actionMutation.mutate({
                        reportId: report.id,
                        action: "restrict_user",
                        targetId: report.target_id,
                      })
                    }
                  >
                    Restrict member
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actionMutation.isPending}
                  onClick={() =>
                    actionMutation.mutate({
                      reportId: report.id,
                      action: "dismiss",
                      targetId: report.target_id,
                    })
                  }
                >
                  Dismiss
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
