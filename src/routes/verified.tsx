import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

import { BrandMark } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/verified")({
  head: () => ({
    meta: [
      { title: "Email verified — JobePilotAI" },
      { name: "description", content: "Your JobePilotAI email address has been verified." },
      { property: "og:title", content: "Email verified — JobePilotAI" },
      { property: "og:description", content: "Your email address is confirmed." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifiedPage,
});

function VerifiedPage() {
  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="container-page flex h-16 items-center">
        <Link to="/" aria-label="JobePilotAI home">
          <BrandMark />
        </Link>
      </header>
      <div className="container-page flex flex-1 items-start justify-center pb-16">
        <div className="surface-panel w-full max-w-md p-8 text-center">
          <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden="true" />
          <h1 className="mt-4 font-display text-2xl font-semibold text-foreground">
            Email verified successfully.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You can continue in JobePilotAI whenever you're ready.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link to="/dashboard">Go to my dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/">Back to home</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
