import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { FileText, Search, Bookmark, Briefcase } from "lucide-react";

import { AppShell, PageHeading } from "@/components/AppShell";
import { ScoreRing } from "@/components/ScoreRing";
import { EmptyState, LoadingState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getMyContext } from "@/lib/profile.functions";
import { listApplications } from "@/lib/applications.functions";
import { listSavedJobs } from "@/lib/jobs.functions";
import { APPLICATION_STATUSES, titleCase } from "@/lib/formatters";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your dashboard — JobePilotAI" },
      { name: "description", content: "Your resume score, recommended jobs, saved roles and application progress." },
      { property: "og:title", content: "Your dashboard — JobePilotAI" },
      { property: "og:description", content: "Track your resume score, matches and applications." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const loadContext = useServerFn(getMyContext);
  const loadApplications = useServerFn(listApplications);
  const loadSaved = useServerFn(listSavedJobs);

  const contextQuery = useQuery({ queryKey: ["me"], queryFn: () => loadContext() });
  const applicationsQuery = useQuery({ queryKey: ["applications"], queryFn: () => loadApplications() });
  const savedQuery = useQuery({ queryKey: ["saved-jobs"], queryFn: () => loadSaved() });

  const profile = contextQuery.data?.profile;

  useEffect(() => {
    if (contextQuery.data && profile && !profile.onboarded) navigate({ to: "/onboarding", replace: true });
  }, [contextQuery.data, profile, navigate]);

  if (contextQuery.isLoading) {
    return (
      <AppShell>
        <LoadingState message="Loading your dashboard..." />
      </AppShell>
    );
  }

  const analysis = contextQuery.data?.analysis as
    | { overall_score: number; target_role: string; verdict: string; summary: string }
    | null
    | undefined;
  const applications = applicationsQuery.data ?? [];
  const saved = savedQuery.data ?? [];
  const interviews = applications.filter((item) =>
    ["interview", "assessment", "offer"].includes(item.status),
  ).length;
  const applied = applications.filter((item) => item.status === "applied").length;

  return (
    <AppShell isAdmin={Boolean(contextQuery.data?.isAdmin)}>
      <PageHeading
        title={profile?.full_name ? `Welcome back, ${profile.full_name.split(" ")[0]}` : "Welcome back"}
        description="Everything you need to move your job search forward today."
        actions={
          <Button asChild>
            <Link to="/jobs">Find jobs for me</Link>
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="surface-panel p-5 lg:col-span-1">
          <h2 className="font-display text-base font-semibold">Resume score</h2>
          {analysis ? (
            <div className="mt-4 flex flex-col items-center gap-3 text-center">
              <ScoreRing score={analysis.overall_score} caption={`Scored for ${analysis.target_role}`} />
              <p className="text-sm text-muted-foreground">{analysis.summary}</p>
              <Button asChild variant="outline" size="sm">
                <Link to="/resume">See full analysis</Link>
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <p>Upload your resume to unlock personalized job matching.</p>
              <Button asChild size="sm">
                <Link to="/resume">
                  <FileText className="size-4" aria-hidden="true" />
                  Upload resume
                </Link>
              </Button>
            </div>
          )}
        </section>

        <section className="grid gap-5 sm:grid-cols-2 lg:col-span-2">
          <StatCard label="Target role" value={profile?.target_titles?.[0] ?? "Not set"} icon={<Briefcase className="size-4" />} to="/settings" />
          <StatCard label="Saved jobs" value={String(saved.length)} icon={<Bookmark className="size-4" />} to="/saved" />
          <StatCard label="Applications sent" value={String(applied)} icon={<Search className="size-4" />} to="/applications" />
          <StatCard label="Interviews & offers" value={String(interviews)} icon={<Briefcase className="size-4" />} to="/applications" />
        </section>
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="surface-panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Recent activity</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/applications">View all</Link>
            </Button>
          </div>
          {applications.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Prepare your first application to start tracking your progress.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {applications.slice(0, 6).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{item.job_title}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.company_name}</p>
                  </div>
                  <Badge variant="secondary">
                    {APPLICATION_STATUSES.includes(item.status as never) ? titleCase(item.status) : "Saved"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="surface-panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Saved jobs</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/saved">View all</Link>
            </Button>
          </div>
          {saved.length === 0 ? (
            <EmptyState
              title="No saved jobs yet"
              description="Save jobs you're interested in and they'll appear here."
              action={
                <Button asChild size="sm">
                  <Link to="/jobs">Browse jobs</Link>
                </Button>
              }
            />
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {saved.slice(0, 6).map((item) => {
                const job = item.job as { id: string; title: string; company_name: string } | null;
                if (!job) return null;
                return (
                  <li key={item.id} className="py-3">
                    <Link to="/jobs/$jobId" params={{ jobId: job.id }} className="text-sm font-medium hover:underline">
                      {job.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{job.company_name}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  icon,
  to,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  to: "/settings" | "/saved" | "/applications";
}) {
  return (
    <Link to={to} className="surface-panel flex flex-col gap-2 p-5 transition-colors hover:border-primary/40">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-display text-xl font-semibold text-foreground">{value}</span>
    </Link>
  );
}
