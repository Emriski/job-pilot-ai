import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BrandMark } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset your password — JobePilotAI" },
      { name: "description", content: "Choose a new password for your JobePilotAI account." },
      { property: "og:title", content: "Reset your password — JobePilotAI" },
      { property: "og:description", content: "Choose a new password for your account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error("We couldn't update your password. Request a new reset link and try again.");
      return;
    }
    toast.success("Password updated.");
    navigate({ to: "/dashboard", replace: true });
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
          <h1 className="font-display text-2xl font-semibold text-foreground">Choose a new password</h1>
          {ready ? (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={72}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Updating..." : "Update password"}
              </Button>
            </form>
          ) : (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Open this page from the reset link in your email. The link signs you in so you can set a new password.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/auth">Back to sign in</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
