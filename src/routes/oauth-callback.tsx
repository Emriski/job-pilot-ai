import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { BrandMark } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { safeInternalPath } from "@/lib/security";

export const Route = createFileRoute("/oauth-callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signing you in — JobePilotAI" },
      { name: "description", content: "Completing your JobePilotAI sign-in." },
      { property: "og:title", content: "Signing you in — JobePilotAI" },
      { property: "og:description", content: "Completing your JobePilotAI sign-in." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OAuthCallbackPage,
});

const REDIRECT_KEY = "jobepilotai.oauth.redirect";

function OAuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const providerError =
        url.searchParams.get("error_description") ??
        url.searchParams.get("error") ??
        hash.get("error_description") ??
        hash.get("error");

      if (providerError) {
        setError("Google sign-in was not completed. Please try again or use email and password.");
        return;
      }

      // PKCE flow returns ?code=... and needs an explicit exchange.
      const code = url.searchParams.get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError && !cancelled) {
          setError("We couldn't complete that sign-in. Please try again.");
          return;
        }
      }

      // Implicit flow (or an already-restored session) resolves here.
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session) {
          let target = "/dashboard";
          try {
            const stored = window.sessionStorage.getItem(REDIRECT_KEY);
            window.sessionStorage.removeItem(REDIRECT_KEY);
            target = safeInternalPath(stored ?? undefined, "/dashboard");
          } catch {
            target = "/dashboard";
          }
          window.location.replace(target);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      if (!cancelled) setError("Your sign-in didn't complete. Please try signing in again.");
    }

    void finish();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="container-page flex h-16 items-center">
        <Link to="/" aria-label="JobePilotAI home">
          <BrandMark />
        </Link>
      </header>
      <div className="container-page flex flex-1 items-start justify-center pb-16">
        <div className="surface-panel w-full max-w-md p-6 text-center sm:p-8">
          {error ? (
            <>
              <h1 className="font-display text-xl font-semibold text-foreground">
                Sign-in didn't complete
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
              <Button asChild className="mt-6">
                <Link to="/auth" search={{}}>
                  Back to sign in
                </Link>
              </Button>
            </>
          ) : (
            <>
              <h1 className="font-display text-xl font-semibold text-foreground">
                Signing you in...
              </h1>
              <p className="mt-2 text-sm text-muted-foreground" role="status">
                Finishing your Google sign-in.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
