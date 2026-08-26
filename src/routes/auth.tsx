import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BrandMark } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { safeInternalPath } from "@/lib/security";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string; mode?: "signin" | "signup" } => {
    const parsed: { redirect?: string; mode?: "signin" | "signup" } = {};
    if (typeof search["redirect"] === "string") parsed.redirect = search["redirect"];
    if (search["mode"] === "signup" || search["mode"] === "signin") parsed.mode = search["mode"];
    return parsed;
  },
  head: () => ({
    meta: [
      { title: "Sign in — JobePilotAI" },
      { name: "description", content: "Sign in or create your JobePilotAI account to score your resume and find matching jobs." },
      { property: "og:title", content: "Sign in — JobePilotAI" },
      { property: "og:description", content: "Access your resume score, job matches and applications." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const destination = safeInternalPath(search.redirect, "/dashboard");
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.replace(destination);
    });
  }, [destination]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/verified`,
            data: { full_name: fullName.trim().slice(0, 120) },
          },
        });
        if (error) throw error;
        setNotice("Check your inbox to verify your email address, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: destination as never, replace: true });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast.error(
        /invalid login/i.test(message)
          ? "That email and password combination didn't work."
          : message || "We couldn't complete that request. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    setNotice(null);
    try {
      try {
        window.sessionStorage.setItem("jobepilotai.oauth.redirect", destination);
      } catch {
        // Session storage may be unavailable; we fall back to /dashboard.
      }

      const host = window.location.hostname;
      const onLovableHost = host.endsWith("lovable.app") || host.endsWith("lovable.dev") || host === "localhost";

      if (onLovableHost) {
        // Lovable-hosted origins proxy the managed OAuth broker paths.
        const result = await lovable.auth.signInWithOAuth("google", {
          redirect_uri: `${window.location.origin}/oauth-callback`,
        });
        if (result.error) {
          toast.error("Google sign-in isn't available right now. Please use email and password.");
          return;
        }
        if (result.redirected) return;
        navigate({ to: destination as never, replace: true });
        return;
      }

      // Any other origin (e.g. a custom/Vercel domain) goes straight to the
      // auth provider's own OAuth endpoint — no broker path is involved.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/oauth-callback` },
      });
      if (error) {
        toast.error("Google sign-in isn't available right now. Please use email and password.");
      }
    } catch {
      toast.error("Google sign-in isn't available right now. Please use email and password.");
    } finally {
      setBusy(false);
    }
  }


  async function handleForgotPassword() {
    if (!email) {
      toast.error("Enter your email address first, then choose Forgot password.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast.error("We couldn't send that email. Please try again.");
      return;
    }
    setNotice("If an account exists for that address, a password reset link is on its way.");
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="container-page flex h-16 items-center">
        <Link to="/" aria-label="JobePilotAI home">
          <BrandMark />
        </Link>
      </header>

      <div className="container-page flex flex-1 items-start justify-center pb-16">
        <div className="surface-panel w-full max-w-md p-6 sm:p-8">
          <h1 className="font-display text-2xl font-semibold text-foreground">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Upload your resume once and get matched to real jobs."
              : "Sign in to continue your job search."}
          </p>

          <Tabs value={mode} onValueChange={(value) => setMode(value as "signin" | "signup")} className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value={mode} className="mt-6">
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {mode === "signup" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName">Full name</Label>
                    <Input
                      id="fullName"
                      autoComplete="name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      required
                      maxLength={120}
                    />
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    maxLength={255}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={8}
                    maxLength={72}
                  />
                  {mode === "signup" ? (
                    <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>
                  ) : null}
                </div>

                {notice ? (
                  <p className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground" role="status">
                    {notice}
                  </p>
                ) : null}

                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
                </Button>
              </form>

              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={busy}>
                Continue with Google
              </Button>

              {mode === "signin" ? (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="mt-4 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Forgot password?
                </button>
              ) : null}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
