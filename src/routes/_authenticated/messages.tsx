import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeading } from "@/components/AppShell";
import { IdentityAvatar, timeAgo } from "@/components/community/CommunityBits";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getConversation, listConversations, sendMessage } from "@/lib/messages.functions";
import { getMyContext } from "@/lib/profile.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: (search: Record<string, unknown>) => ({
    c: typeof search.c === "string" ? search.c : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Messages — JobePilotAI" },
      {
        name: "description",
        content: "Private conversations with other JobePilotAI community members.",
      },
      { property: "og:title", content: "Messages — JobePilotAI" },
      { property: "og:description", content: "Your private community conversations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const { c } = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();

  const loadContext = useServerFn(getMyContext);
  const loadList = useServerFn(listConversations);
  const loadThread = useServerFn(getConversation);
  const send = useServerFn(sendMessage);

  const [body, setBody] = useState("");

  const contextQuery = useQuery({ queryKey: ["me"], queryFn: () => loadContext() });
  const listQuery = useQuery({ queryKey: ["conversations"], queryFn: () => loadList() });
  const threadQuery = useQuery({
    queryKey: ["conversation", c],
    queryFn: () => loadThread({ data: { conversationId: c! } }),
    enabled: Boolean(c),
  });

  const thread = threadQuery.data;

  const sendMutation = useMutation({
    mutationFn: () =>
      send({ data: { recipientId: thread!.participant.id, body: body.trim() } }),
    onSuccess: async () => {
      setBody("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["conversation", c] }),
        queryClient.invalidateQueries({ queryKey: ["conversations"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell isAdmin={Boolean(contextQuery.data?.isAdmin)}>
      <PageHeading
        title="Messages"
        description="Private conversations with people you meet in the community."
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <section aria-label="Conversations" className="space-y-2">
          {listQuery.isLoading ? <LoadingState message="Loading conversations…" /> : null}
          {listQuery.isError ? (
            <ErrorState
              message={(listQuery.error as Error).message}
              action={<Button onClick={() => listQuery.refetch()}>Try again</Button>}
            />
          ) : null}
          {listQuery.data && listQuery.data.length === 0 ? (
            <EmptyState
              title="No conversations yet"
              description="Open someone's profile in the community and start a conversation."
            />
          ) : null}
          {(listQuery.data ?? []).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate({ search: { c: item.id } })}
              className={cn(
                "surface-panel flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-accent",
                c === item.id && "bg-accent",
              )}
            >
              <IdentityAvatar identity={item.participant} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    @{item.participant.nickname ?? "member"}
                  </span>
                  {item.unread > 0 ? <Badge>{item.unread}</Badge> : null}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {item.lastFromMe ? "You: " : ""}
                  {item.preview ?? "No messages yet"}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {timeAgo(item.lastMessageAt)}
                </span>
              </span>
            </button>
          ))}
        </section>

        <section aria-label="Conversation" className="surface-panel flex min-h-[420px] flex-col p-4">
          {!c ? (
            <EmptyState
              title="Select a conversation"
              description="Pick a conversation on the left to read and reply."
            />
          ) : threadQuery.isLoading ? (
            <LoadingState message="Loading conversation…" />
          ) : threadQuery.isError ? (
            <ErrorState
              message={(threadQuery.error as Error).message}
              action={<Button onClick={() => threadQuery.refetch()}>Try again</Button>}
            />
          ) : !thread ? (
            <EmptyState
              title="Conversation not found"
              description="This conversation is no longer available."
            />
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-border pb-3">
                <IdentityAvatar identity={thread.participant} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    @{thread.participant.nickname ?? "member"}
                  </p>
                  {thread.participant.headline ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {thread.participant.headline}
                    </p>
                  ) : null}
                </div>
              </header>

              <div className="flex-1 space-y-2 overflow-y-auto py-4">
                {thread.messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No messages yet — say hello.</p>
                ) : (
                  thread.messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                        message.isMine
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "bg-muted text-foreground",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.body}</p>
                      <p className="mt-1 text-[11px] opacity-70">{timeAgo(message.createdAt)}</p>
                    </div>
                  ))
                )}
              </div>

              {thread.blocked ? (
                <p className="border-t border-border pt-3 text-sm text-muted-foreground">
                  You can't message this person.
                </p>
              ) : (
                <form
                  className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (body.trim()) sendMutation.mutate();
                  }}
                >
                  <Textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    placeholder="Write a message…"
                    rows={2}
                    aria-label="Message"
                  />
                  <Button type="submit" disabled={!body.trim() || sendMutation.isPending}>
                    Send
                  </Button>
                </form>
              )}
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
