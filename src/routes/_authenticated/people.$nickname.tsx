import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AppShell, PageHeading } from "@/components/AppShell";
import { IdentityAvatar, ReportDialog, timeAgo } from "@/components/community/CommunityBits";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { blockUser, followUser, muteUser, unfollowUser } from "@/lib/community.functions";
import { getPublicProfile } from "@/lib/identity.functions";
import { getMyContext } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/people/$nickname")({
  head: () => ({
    meta: [
      { title: "Member profile — JobePilotAI" },
      {
        name: "description",
        content: "See a JobePilotAI community member's public career profile and recent posts.",
      },
      { property: "og:title", content: "Member profile — JobePilotAI" },
      {
        property: "og:description",
        content: "A community member's public career profile and posts.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PersonPage,
});

function PersonPage() {
  const { nickname } = Route.useParams();
  const queryClient = useQueryClient();

  const loadContext = useServerFn(getMyContext);
  const loadProfile = useServerFn(getPublicProfile);
  const follow = useServerFn(followUser);
  const unfollow = useServerFn(unfollowUser);
  const block = useServerFn(blockUser);
  const mute = useServerFn(muteUser);

  const contextQuery = useQuery({ queryKey: ["me"], queryFn: () => loadContext() });
  const profileQuery = useQuery({
    queryKey: ["public-profile", nickname],
    queryFn: () => loadProfile({ data: { nickname } }),
  });

  const profile = profileQuery.data;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["public-profile", nickname] });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (profile?.isFollowing) await unfollow({ data: { userId: profile.id } });
      else await follow({ data: { userId: profile!.id } });
    },
    onSuccess: async () => {
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const blockMutation = useMutation({
    mutationFn: () => block({ data: { userId: profile!.id } }),
    onSuccess: async () => {
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ["community-feed"] });
      toast.success("Blocked. You won't see their content anymore.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const muteMutation = useMutation({
    mutationFn: () => mute({ data: { userId: profile!.id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["community-feed"] });
      toast.success("Muted. Their posts are hidden from your feed.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell isAdmin={Boolean(contextQuery.data?.isAdmin)}>
      <PageHeading
        title={`@${nickname}`}
        actions={
          <Button variant="outline" asChild>
            <Link to="/community">Back to community</Link>
          </Button>
        }
      />

      {profileQuery.isLoading ? <LoadingState message="Loading this profile…" /> : null}
      {profileQuery.isError ? (
        <ErrorState
          message={(profileQuery.error as Error).message}
          action={<Button onClick={() => profileQuery.refetch()}>Try again</Button>}
        />
      ) : null}

      {!profileQuery.isLoading && !profileQuery.isError && !profile ? (
        <EmptyState
          title="Profile not found"
          description="No community member uses that nickname."
          action={
            <Button asChild>
              <Link to="/community">Back to the feed</Link>
            </Button>
          }
        />
      ) : null}

      {profile ? (
        <div className="space-y-6">
          <section className="surface-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
            <IdentityAvatar
              identity={{
                id: profile.id,
                nickname: profile.nickname,
                avatarUrl: profile.avatarUrl,
                headline: profile.headline,
              }}
              className="size-16"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <h2 className="font-display text-xl font-semibold text-foreground">
                @{profile.nickname}
              </h2>
              {profile.headline ? (
                <p className="text-sm text-muted-foreground">{profile.headline}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {profile.location ? `${profile.location} · ` : ""}
                {profile.followers} followers · {profile.following} following · Joined{" "}
                {new Date(profile.joinedAt).toLocaleDateString()}
              </p>
              {profile.targetTitles.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {profile.targetTitles.map((title) => (
                    <Badge key={title} variant="secondary">
                      {title}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {profile.skills.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {profile.skills.slice(0, 15).map((skill) => (
                    <Badge key={skill} variant="outline">
                      {skill}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>

            {profile.isSelf ? (
              <Button variant="outline" asChild>
                <Link to="/profile">Edit your profile</Link>
              </Button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => followMutation.mutate()}
                  disabled={followMutation.isPending}
                  variant={profile.isFollowing ? "outline" : "default"}
                >
                  {profile.isFollowing ? "Following" : "Follow"}
                </Button>
                <Button variant="outline" onClick={() => muteMutation.mutate()}>
                  Mute
                </Button>
                <Button variant="outline" onClick={() => blockMutation.mutate()}>
                  Block
                </Button>
                <ReportDialog targetType="user" targetId={profile.id} />
              </div>
            )}
          </section>

          <section className="space-y-3" aria-label="Recent posts">
            <h3 className="text-sm font-semibold text-foreground">Recent posts</h3>
            {profile.posts.length === 0 ? (
              <EmptyState
                title="No posts yet"
                description="This member hasn't shared anything in the community."
              />
            ) : (
              profile.posts.map((post) => (
                <Link
                  key={post.id}
                  to="/community/$postId"
                  params={{ postId: post.id }}
                  className="surface-panel block p-4 transition-colors hover:bg-accent"
                >
                  <Badge variant="secondary">{post.category}</Badge>
                  <p className="mt-2 text-sm font-medium text-foreground">{post.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {timeAgo(post.created_at)} · {post.comment_count} comments ·{" "}
                    {post.reaction_count} reactions
                  </p>
                </Link>
              ))
            )}
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
