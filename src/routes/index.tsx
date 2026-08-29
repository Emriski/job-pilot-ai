import { createFileRoute, Link } from "@tanstack/react-router";
import { FileSearch, Radar, PenLine, ListChecks, ShieldCheck, Gauge } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SOURCE_LABELS } from "@/lib/jobs/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JobePilotAI — Find Better Jobs. Apply Smarter." },
      {
        name: "description",
        content:
          "Upload your resume, get an honest score, match against real job listings from public sources, and generate tailored applications you can actually send.",
      },
      { property: "og:title", content: "JobePilotAI — Find Better Jobs. Apply Smarter." },
      {
        property: "og:description",
        content: "Real jobs from public sources, honest resume scoring and tailored applications.",
      },
    ],
  }),
  component: Landing,
});

const STEPS = [
  {
    icon: FileSearch,
    title: "Upload your resume",
    body: "PDF or DOCX. We read the actual file, extract your real experience and let you correct anything we got wrong.",
  },
  {
    icon: Gauge,
    title: "Get an honest score",
    body: "A 0–100 score against the role you're targeting, with ATS keyword gaps, formatting risks and what to fix first.",
  },
  {
    icon: Radar,
    title: "Match with real jobs",
    body: "Live listings pulled from public job APIs and company boards, scored against your resume with reasons and gaps shown.",
  },
  {
    icon: PenLine,
    title: "Apply smarter",
    body: "Cover letters and tailored resumes written from your real experience and the exact job description — never invented.",
  },
];

export default function Landing() {
  const sources = Object.values(SOURCE_LABELS).slice(0, 8);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container-page flex h-16 items-center justify-between">
          <span className="font-display text-lg font-semibold tracking-tight text-foreground">
            JobePilotAI
          </span>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link to="/auth" search={{}}>
                Sign in
              </Link>
            </Button>
            <Button asChild>
              <Link to="/auth" search={{ mode: "signup" as const }}>
                Get started
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="ink-panel">
          <div className="container-page py-20 text-center sm:py-28">
            <Badge variant="secondary" className="mb-5">
              Real listings · Honest scoring · No fake data
            </Badge>
            <h1 className="mx-auto max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
              Find Better Jobs. Apply Smarter.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base opacity-80 sm:text-lg">
              JobePilotAI reads your real resume, scores it against the role you want, finds live
              openings from public job sources, and writes applications grounded in your actual
              experience.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link to="/auth" search={{ mode: "signup" as const }}>
                  Create your free account
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth" search={{}}>
                  I already have an account
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="container-page py-16 sm:py-24">
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            How it works
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Four steps, all backed by real data — your file, your preferences and live listings.
          </p>
          <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="surface-panel p-5">
                <step.icon className="size-5 text-primary" aria-hidden="true" />
                <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Step {index + 1}
                </p>
                <h3 className="mt-1 font-display text-base font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-y border-border bg-muted/40">
          <div className="container-page py-16 sm:py-20">
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Where the jobs come from
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              We only use public job APIs, feeds and company career boards that permit programmatic
              access. We never scrape sites that prohibit it, and every listing links back to the
              original posting.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {sources.map((source) => (
                <li key={source}>
                  <Badge variant="outline">{source}</Badge>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="container-page grid gap-5 py-16 sm:grid-cols-3 sm:py-24">
          <div className="surface-panel p-5">
            <ListChecks className="size-5 text-primary" aria-hidden="true" />
            <h3 className="mt-4 font-display text-base font-semibold">Transparent match scores</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Every score shows its breakdown, the reasons behind it and the gaps you'd need to
              close. It's a fit indicator, not a hiring prediction.
            </p>
          </div>
          <div className="surface-panel p-5">
            <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
            <h3 className="mt-4 font-display text-base font-semibold">Your data stays yours</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Resumes are stored privately and readable only by your account. You can delete
              everything at any time from settings.
            </p>
          </div>
          <div className="surface-panel p-5">
            <PenLine className="size-5 text-primary" aria-hidden="true" />
            <h3 className="mt-4 font-display text-base font-semibold">Nothing invented</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Generated documents use only what's in your resume. No fabricated employers, dates,
              metrics or certifications.
            </p>
          </div>
        </section>

        <section className="ink-panel">
          <div className="container-page py-16 text-center sm:py-20">
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Ready to stop guessing?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm opacity-80">
              Upload a resume and see your first matched roles in a couple of minutes.
            </p>
            <Button asChild size="lg" className="mt-7">
              <Link to="/auth" search={{ mode: "signup" as const }}>
                Get started free
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 py-8 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} JobePilotAI — Find Better Jobs. Apply Smarter.</p>
          <Link to="/auth" search={{}} className="underline">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
