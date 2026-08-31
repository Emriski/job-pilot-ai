import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeading } from "@/components/AppShell";
import { IdentityAvatar } from "@/components/community/CommunityBits";
import { ErrorState, LoadingState } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { NICKNAME_RULES } from "@/lib/community-validation";
import {
  claimNickname,
  getMyIdentity,
  removeAvatar,
  saveCommunityProfile,
  setAvatar,
} from "@/lib/identity.functions";
import { getMyContext } from "@/lib/profile.functions";

const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your community profile — JobePilotAI" },
      {
        name: "description",
        content:
          "Choose your unique nickname, upload a profile picture and control what other job seekers can see.",
      },
      { property: "og:title", content: "Your community profile — JobePilotAI" },
      {
        property: "og:description",
        content: "Manage your nickname, picture and community privacy settings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const loadContext = useServerFn(getMyContext);
  const loadIdentity = useServerFn(getMyIdentity);
  const claim = useServerFn(claimNickname);
  const saveProfile = useServerFn(saveCommunityProfile);
  const saveAvatar = useServerFn(setAvatar);
  const clearAvatar = useServerFn(removeAvatar);

  const contextQuery = useQuery({ queryKey: ["me"], queryFn: () => loadContext() });
  const identityQuery = useQuery({ queryKey: ["my-identity"], queryFn: () => loadIdentity() });
  const identity = identityQuery.data;

  const [nickname, setNickname] = useState("");
  const [headline, setHeadline] = useState("");
  const [interests, setInterests] = useState("");
  const [location, setLocation] = useState("");
  const [showLocation, setShowLocation] = useState(false);
  const [publicProfile, setPublicProfile] = useState(true);

  useEffect(() => {
    if (!identity) return;
    setNickname(identity.nickname ?? "");
    setHeadline(identity.headline ?? "");
    setInterests((identity.career_interests ?? []).join(", "));
    setLocation(identity.location ?? "");
    setShowLocation(identity.show_location);
    setPublicProfile(identity.public_profile);
  }, [identity]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["my-identity"] });

  const nicknameMutation = useMutation({
    mutationFn: () => claim({ data: { nickname: nickname.trim() } }),
    onSuccess: async () => {
      await refresh();
      toast.success("Nickname saved.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const profileMutation = useMutation({
    mutationFn: () =>
      saveProfile({
        data: {
          headline: headline.trim() ? headline.trim() : null,
          career_interests: interests
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 12),
          location: location.trim() ? location.trim() : null,
          show_location: showLocation,
          public_profile: publicProfile,
        },
      }),
    onSuccess: async () => {
      await refresh();
      toast.success("Profile updated.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
        throw new Error("Please upload a JPG, PNG or WebP image.");
      }
      if (file.size > MAX_AVATAR_BYTES) throw new Error("Images must be 5MB or smaller.");
      if (!identity) throw new Error("Your profile isn't ready yet. Please try again.");

      const extension =
        file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      // The filename is generated server-side style — the user's own name is never trusted.
      const path = `${identity.id}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw new Error("We couldn't upload that picture. Please try again.");
      return saveAvatar({ data: { path } });
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Profile picture updated.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeAvatarMutation = useMutation({
    mutationFn: () => clearAvatar(),
    onSuccess: async () => {
      await refresh();
      toast.success("Profile picture removed.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell isAdmin={Boolean(contextQuery.data?.isAdmin)}>
      <PageHeading
        title="Your community profile"
        description="This is what other job seekers see. Your email, resume and applications stay private."
        actions={
          identity?.nickname ? (
            <Button variant="outline" asChild>
              <Link to="/people/$nickname" params={{ nickname: identity.nickname }}>
                View public profile
              </Link>
            </Button>
          ) : undefined
        }
      />

      {identityQuery.isLoading ? <LoadingState message="Loading your profile…" /> : null}
      {identityQuery.isError ? (
        <ErrorState
          message={(identityQuery.error as Error).message}
          action={<Button onClick={() => identityQuery.refetch()}>Try again</Button>}
        />
      ) : null}

      {identity ? (
        <div className="space-y-6">
          <section className="surface-panel space-y-4 p-5" aria-label="Profile picture">
            <h2 className="text-sm font-semibold text-foreground">Profile picture</h2>
            <div className="flex flex-wrap items-center gap-4">
              <IdentityAvatar
                identity={{
                  id: identity.id,
                  nickname: identity.nickname,
                  avatarUrl: identity.avatarUrl,
                  headline: identity.headline,
                }}
                className="size-16"
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label="Choose a profile picture"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) avatarMutation.mutate(file);
                }}
              />
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={avatarMutation.isPending}
              >
                {avatarMutation.isPending ? "Uploading…" : "Upload picture"}
              </Button>
              {identity.avatarUrl ? (
                <Button
                  variant="ghost"
                  onClick={() => removeAvatarMutation.mutate()}
                  disabled={removeAvatarMutation.isPending}
                >
                  Remove
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">JPG, PNG or WebP. Maximum 5MB.</p>
          </section>

          <section className="surface-panel space-y-3 p-5" aria-label="Nickname">
            <h2 className="text-sm font-semibold text-foreground">Nickname</h2>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="nickname">Public nickname</Label>
                <Input
                  id="nickname"
                  value={nickname}
                  maxLength={30}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="your_nickname"
                />
              </div>
              <Button
                onClick={() => nicknameMutation.mutate()}
                disabled={nicknameMutation.isPending || nickname.trim().length < 3}
              >
                {nicknameMutation.isPending ? "Saving…" : "Save nickname"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{NICKNAME_RULES}</p>
          </section>

          <section className="surface-panel space-y-4 p-5" aria-label="About you">
            <h2 className="text-sm font-semibold text-foreground">About you</h2>
            <div className="space-y-1.5">
              <Label htmlFor="headline">Headline</Label>
              <Input
                id="headline"
                value={headline}
                maxLength={160}
                onChange={(event) => setHeadline(event.target.value)}
                placeholder="e.g. Data analyst looking for remote roles"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="interests">Career interests</Label>
              <Textarea
                id="interests"
                value={interests}
                rows={2}
                onChange={(event) => setInterests(event.target.value)}
                placeholder="Comma separated, e.g. Product design, Remote work, Fintech"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                maxLength={120}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="City, country"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="show-location">Show my location on my public profile</Label>
              <Switch id="show-location" checked={showLocation} onCheckedChange={setShowLocation} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="public-profile">Let other members find my profile</Label>
              <Switch
                id="public-profile"
                checked={publicProfile}
                onCheckedChange={setPublicProfile}
              />
            </div>
            <Button onClick={() => profileMutation.mutate()} disabled={profileMutation.isPending}>
              {profileMutation.isPending ? "Saving…" : "Save profile"}
            </Button>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
