import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AppShell, PageHeading } from "@/components/AppShell";
import { IdentityAvatar, timeAgo } from "@/components/community/CommunityBits";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications.functions";
import { getMyContext } from "@/lib/profile.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — JobePilotAI" },
      {
        name: "description",
        content: "Replies, reactions, follows and moderation updates from your community activity.",
      },
      { property: "og:title", content: "Notifications — JobePilotAI" },
      { property: "og:description", content: "Your latest community activity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const queryClient = useQueryClient();
  const loadContext = useServerFn(getMyContext);
  const load = useServerFn(listNotifications);
  const markOne = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);

  const contextQuery = useQuery({ queryKey: ["me"], queryFn: () => loadContext() });
  const query = useQuery({ queryKey: ["notifications"], queryFn: () => load() });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });

  const readMutation = useMutation({
    mutationFn: (id: string) => markOne({ data: { id } }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const readAllMutation = useMutation({
    mutationFn: () => markAll(),
    onSuccess: async () => {
      await invalidate();
      toast.success("All notifications marked as read.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const items = query.data?.items ?? [];

  return (
    <AppShell isAdmin={Boolean(contextQuery.data?.isAdmin)}>
      <PageHeading
        title="Notifications"
        description="Everything happening around your community activity."
        actions={
          query.data && query.data.unread > 0 ? (
            <Button
              variant="outline"
              onClick={() => readAllMutation.mutate()}
              disabled={readAllMutation.isPending}
            >
              Mark all read
            </Button>
          ) : null
        }
      />

      {query.isLoading ? <LoadingState message="Loading notifications…" /> : null}
      {query.isError ? (
        <ErrorState
          message={(query.error as Error).message}
          action={<Button onClick={() => query.refetch()}>Try again</Button>}
        />
      ) : null}

      {query.data && items.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          description="When people react, comment, follow or message you, it will show up here."
          action={
            <Button asChild>
              <Link to="/community">Go to community</Link>
            </Button>
          }
        />
      ) : null}

      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn("surface-panel flex items-start gap-3 p-4", !item.read && "bg-accent/50")}
          >
            {item.actor ? (
              <IdentityAvatar identity={item.actor} />
            ) : (
              <span className="size-9 rounded-full bg-muted" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                {!item.read ? <Badge variant="secondary">New</Badge> : null}
              </div>
              {item.body ? (
                <p className="mt-1 break-words text-sm text-muted-foreground">{item.body}</p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">{timeAgo(item.createdAt)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.link ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={item.link}>Open</a>
                  </Button>
                ) : null}
                {!item.read ? (
                  <Button size="sm" variant="ghost" onClick={() => readMutation.mutate(item.id)}>
                    Mark read
                  </Button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
