import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Heart, MessageSquare, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { AppShell, PageHeading } from "@/components/AppShell";
import { AuthorLine, ReportDialog } from "@/components/community/CommunityBits";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createPost, getFeed, toggleReaction } from "@/lib/community.functions";
import { COMMUNITY_CATEGORIES } from "@/lib/community-validation";
import { getMyIdentity } from "@/lib/identity.functions";
import { getMyContext } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/community/")({
  head: () => ({
    meta: [
      { title: "Career community — JobePilotAI" },
      {
        name: "description",
        content:
          "Ask career questions, share opportunities and learn from other job seekers in the JobePilotAI community.",
      },
      { property: "og:title", content: "Career community — JobePilotAI" },
      { property: "og:description", content: "Career conversations with other job seekers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CommunityPage,
});

function CommunityPage() {
  const queryClient = useQueryClient();
  const loadContext = useServerFn(getMyContext);
  const loadIdentity = useServerFn(getMyIdentity);
  const loadFeed = useServerFn(getFeed);
  const submitPost = useServerFn(createPost);
  const react = useServerFn(toggleReaction);

  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [draftCategory, setDraftCategory] = useState<string>(COMMUNITY_CATEGORIES[0]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const contextQuery = useQuery({ queryKey: ["me"], queryFn: () => loadContext() });
  const identityQuery = useQuery({ queryKey: ["my-identity"], queryFn: () => loadIdentity() });
  const feedQuery = useQuery({
    queryKey: ["community-feed", category, search],
    queryFn: () => loadFeed({ data: { category, search, page: 1 } }),
  });

  const postMutation = useMutation({
    mutationFn: () =>
      submitPost({
        data: {
          category: draftCategory as (typeof COMMUNITY_CATEGORIES)[number],
          title: title.trim(),
          body: body.trim(),
          link_url: null,
          shared_job_id: null,
        },
      }),
    onSuccess: async () => {
      setTitle("");
      setBody("");
      await queryClient.invalidateQueries({ queryKey: ["community-feed"] });
      toast.success("Your post is live.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reactMutation = useMutation({
    mutationFn: (postId: string) => react({ data: { postId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["community-feed"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const hasNickname = Boolean(identityQuery.data?.nickname);
  const posts = feedQuery.data?.posts ?? [];

  return (
    <AppShell isAdmin={Boolean(contextQuery.data?.isAdmin)}>
      <PageHeading
        title="Community"
        description="Career conversations, shared opportunities and honest advice from other job seekers."
        actions={
          <Button variant="outline" asChild>
            <Link to="/profile">Your profile</Link>
          </Button>
        }
      />

      <section className="surface-panel mb-6 space-y-3 p-4" aria-label="Create a post">
        {hasNickname ? null : (
          <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            Choose a nickname on{" "}
            <Link to="/profile" className="font-medium text-foreground underline">
              your profile
            </Link>{" "}
            before posting.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="post-category">Category</Label>
            <Select value={draftCategory} onValueChange={setDraftCategory}>
              <SelectTrigger id="post-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMUNITY_CATEGORIES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="post-title">Title</Label>
            <Input
              id="post-title"
              value={title}
              maxLength={160}
              placeholder="What do you want to talk about?"
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="post-body">Post</Label>
          <Textarea
            id="post-body"
            value={body}
            rows={4}
            maxLength={6000}
            placeholder="Share your question, advice or opportunity."
            onChange={(event) => setBody(event.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() => postMutation.mutate()}
            disabled={
              postMutation.isPending || !hasNickname || title.trim().length < 4 || body.trim().length < 4
            }
          >
            {postMutation.isPending ? "Publishing..." : "Publish post"}
          </Button>
        </div>
      </section>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="sm:w-64">
          <Label htmlFor="filter-category" className="sr-only">
            Filter by category
          </Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="filter-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {COMMUNITY_CATEGORIES.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Label htmlFor="filter-search" className="sr-only">
            Search the community
          </Label>
          <Input
            id="filter-search"
            value={search}
            placeholder="Search posts"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {feedQuery.isLoading ? (
        <LoadingState message="Loading the community feed..." />
      ) : feedQuery.isError ? (
        <ErrorState
          message={(feedQuery.error as Error).message}
          action={<Button onClick={() => feedQuery.refetch()}>Try again</Button>}
        />
      ) : posts.length === 0 ? (
        <EmptyState
          title="No posts yet"
          description="Be the first to start a conversation in this category."
        />
      ) : (
        <ul className="space-y-4">
          {posts.map((post) => (
            <li key={post.id} className="surface-panel space-y-3 p-4">
              <AuthorLine
                identity={post.author}
                createdAt={post.createdAt}
                trailing={
                  post.isMine ? null : <ReportDialog targetType="post" targetId={post.id} />
                }
              />
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{post.category}</Badge>
                  {post.unverifiedOpportunity ? (
                    <Badge variant="outline" className="gap-1">
                      <ShieldAlert className="size-3" aria-hidden="true" />
                      Unverified opportunity
                    </Badge>
                  ) : null}
                </div>
                <Link
                  to="/community/$postId"
                  params={{ postId: post.id }}
                  className="font-display text-lg font-semibold text-foreground hover:underline"
                >
                  {post.title}
                </Link>
                <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">
                  {post.body}
                </p>
                {post.unverifiedOpportunity ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    This opportunity was shared by a member and has not been verified. Never pay to
                    apply and never share personal financial details.
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={post.hasReacted ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => reactMutation.mutate(post.id)}
                  aria-pressed={post.hasReacted}
                >
                  <Heart className="mr-1 size-4" aria-hidden="true" />
                  {post.reactionCount}
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/community/$postId" params={{ postId: post.id }}>
                    <MessageSquare className="mr-1 size-4" aria-hidden="true" />
                    {post.commentCount}
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
