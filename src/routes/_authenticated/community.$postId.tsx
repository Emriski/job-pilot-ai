import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Heart, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { AppShell, PageHeading } from "@/components/AppShell";
import { AuthorLine, ReportDialog } from "@/components/community/CommunityBits";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addComment, deletePost, getPost, toggleReaction } from "@/lib/community.functions";
import { getMyContext } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/community/$postId")({
  head: () => ({
    meta: [
      { title: "Community post — JobePilotAI" },
      {
        name: "description",
        content: "Read the discussion and share your own career advice with other job seekers.",
      },
      { property: "og:title", content: "Community post — JobePilotAI" },
      {
        property: "og:description",
        content: "Read the discussion and share your own career advice.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PostPage,
});

function PostPage() {
  const { postId } = Route.useParams();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();

  const loadContext = useServerFn(getMyContext);
  const loadPost = useServerFn(getPost);
  const comment = useServerFn(addComment);
  const react = useServerFn(toggleReaction);
  const removePost = useServerFn(deletePost);

  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const contextQuery = useQuery({ queryKey: ["me"], queryFn: () => loadContext() });
  const postQuery = useQuery({
    queryKey: ["community-post", postId],
    queryFn: () => loadPost({ data: { postId } }),
  });

  const commentMutation = useMutation({
    mutationFn: () =>
      comment({ data: { postId, parentId: replyTo, body: body.trim() } }),
    onSuccess: async () => {
      setBody("");
      setReplyTo(null);
      await queryClient.invalidateQueries({ queryKey: ["community-post", postId] });
      toast.success("Comment posted.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reactMutation = useMutation({
    mutationFn: () => react({ data: { postId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["community-post", postId] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => removePost({ data: { id: postId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["community-feed"] });
      toast.success("Post deleted.");
      navigate({ to: "/community" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const data = postQuery.data;

  return (
    <AppShell isAdmin={Boolean(contextQuery.data?.isAdmin)}>
      <PageHeading
        title="Community post"
        actions={
          <Button variant="outline" asChild>
            <Link to="/community">Back to feed</Link>
          </Button>
        }
      />

      {postQuery.isLoading ? <LoadingState message="Loading this discussion…" /> : null}
      {postQuery.isError ? (
        <ErrorState
          message={(postQuery.error as Error).message}
          action={<Button onClick={() => postQuery.refetch()}>Try again</Button>}
        />
      ) : null}

      {!postQuery.isLoading && !postQuery.isError && !data ? (
        <EmptyState
          title="Post unavailable"
          description="This post was removed or is no longer public."
          action={
            <Button asChild>
              <Link to="/community">Back to the feed</Link>
            </Button>
          }
        />
      ) : null}

      {data ? (
        <div className="space-y-6">
          <article className="surface-panel space-y-4 p-5">
            <AuthorLine
              identity={data.post.author}
              createdAt={data.post.createdAt}
              trailing={
                <>
                  {data.post.isMine ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate()}
                      disabled={deleteMutation.isPending}
                    >
                      Delete
                    </Button>
                  ) : (
                    <ReportDialog targetType="post" targetId={data.post.id} />
                  )}
                </>
              }
            />

            <div className="space-y-2">
              <Badge variant="secondary">{data.post.category}</Badge>
              <h2 className="font-display text-xl font-semibold text-foreground">
                {data.post.title}
              </h2>
              <p className="whitespace-pre-wrap text-sm text-foreground/90">{data.post.body}</p>
            </div>

            {data.post.unverifiedOpportunity ? (
              <p className="flex items-start gap-2 rounded-md bg-muted p-3 text-xs text-muted-foreground">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                This opportunity was shared by a member and is not verified by JobePilotAI. Never
                pay for a job offer or share personal financial details.
              </p>
            ) : null}

            {data.post.linkUrl ? (
              <a
                href={data.post.linkUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-sm font-medium text-primary underline"
              >
                Open shared link
              </a>
            ) : null}

            {data.post.sharedJob ? (
              <div className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium text-foreground">{data.post.sharedJob.title}</p>
                <p className="text-muted-foreground">
                  {data.post.sharedJob.company_name}
                  {data.post.sharedJob.location ? ` · ${data.post.sharedJob.location}` : ""}
                </p>
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <Button
                variant={data.post.hasReacted ? "default" : "outline"}
                size="sm"
                onClick={() => reactMutation.mutate()}
                disabled={reactMutation.isPending}
              >
                <Heart className="size-4" aria-hidden="true" />
                {data.post.reactionCount}
              </Button>
              <span className="text-sm text-muted-foreground">
                {data.comments.length} {data.comments.length === 1 ? "comment" : "comments"}
              </span>
            </div>
          </article>

          <section className="surface-panel space-y-3 p-5" aria-label="Add a comment">
            <label htmlFor="comment-body" className="text-sm font-medium text-foreground">
              {replyTo ? "Write a reply" : "Add a comment"}
            </label>
            <Textarea
              id="comment-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={3}
              maxLength={3000}
              placeholder="Share something useful from your own experience."
            />
            <div className="flex items-center gap-2">
              <Button
                onClick={() => commentMutation.mutate()}
                disabled={commentMutation.isPending || body.trim().length < 1}
              >
                {commentMutation.isPending ? "Posting…" : replyTo ? "Post reply" : "Post comment"}
              </Button>
              {replyTo ? (
                <Button variant="ghost" onClick={() => setReplyTo(null)}>
                  Cancel reply
                </Button>
              ) : null}
            </div>
          </section>

          <section className="space-y-3" aria-label="Comments">
            {data.comments.length === 0 ? (
              <EmptyState
                title="No comments yet"
                description="Be the first to share advice on this post."
              />
            ) : (
              data.comments.map((item) => (
                <div
                  key={item.id}
                  className={`surface-panel space-y-2 p-4 ${item.parentId ? "ml-6" : ""}`}
                >
                  <AuthorLine
                    identity={item.author}
                    createdAt={item.createdAt}
                    trailing={
                      item.isMine ? null : (
                        <ReportDialog targetType="comment" targetId={item.id} />
                      )
                    }
                  />
                  <p className="whitespace-pre-wrap text-sm text-foreground/90">{item.body}</p>
                  {item.parentId ? null : (
                    <Button variant="ghost" size="sm" onClick={() => setReplyTo(item.id)}>
                      Reply
                    </Button>
                  )}
                </div>
              ))
            )}
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
