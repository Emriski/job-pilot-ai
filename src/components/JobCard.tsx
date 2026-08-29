import { Link } from "@tanstack/react-router";
import { Bookmark, BookmarkCheck, Building2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SOURCE_LABELS } from "@/lib/jobs/types";
import {
  formatLocation,
  formatPosted,
  formatSalary,
  remoteBadge,
  titleCase,
} from "@/lib/formatters";
import { matchLabel } from "@/lib/matching";

export type JobCardJob = {
  id: string;
  title: string;
  company_name: string;
  source: string;
  location: string | null;
  remote: boolean;
  remote_type: string | null;
  employment_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  posted_at: string | null;
  skills: string[] | null;
};

export function JobCard({
  job,
  score,
  saved,
  onToggleSave,
}: {
  job: JobCardJob;
  score?: number;
  saved?: boolean;
  onToggleSave?: () => void;
}) {
  const remote = remoteBadge(job);
  const band = typeof score === "number" ? matchLabel(score) : null;

  return (
    <article className="surface-panel flex h-full flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-base font-semibold text-foreground">
            {job.title}
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Building2 className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{job.company_name}</span>
          </p>
        </div>
        {band ? (
          <div className="shrink-0 text-right">
            <div className="font-display text-lg font-semibold text-foreground">
              {Math.round(score!)}%
            </div>
            <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
              {band.label}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {remote ? <Badge variant="secondary">{remote}</Badge> : null}
        <Badge variant="outline">{formatLocation(job)}</Badge>
        {job.employment_type ? (
          <Badge variant="outline">{titleCase(job.employment_type)}</Badge>
        ) : null}
      </div>

      <dl className="grid gap-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Salary</dt>
          <dd className="text-right font-medium text-foreground">{formatSalary(job)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Posted</dt>
          <dd className="text-right text-foreground">{formatPosted(job.posted_at)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Source</dt>
          <dd className="text-right text-foreground">{SOURCE_LABELS[job.source] ?? job.source}</dd>
        </div>
      </dl>

      {job.skills?.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {job.skills.slice(0, 5).map((skill) => (
            <li key={skill}>
              <Badge variant="secondary" className="font-normal">
                {skill}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <Button asChild size="sm">
          <Link to="/jobs/$jobId" params={{ jobId: job.id }}>
            View job
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/jobs/$jobId" params={{ jobId: job.id }} search={{ prepare: true }}>
            Prepare application
          </Link>
        </Button>
        {onToggleSave ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={onToggleSave}
            aria-pressed={Boolean(saved)}
            aria-label={saved ? `Remove ${job.title} from saved jobs` : `Save ${job.title}`}
          >
            {saved ? (
              <BookmarkCheck className="size-4" aria-hidden="true" />
            ) : (
              <Bookmark className="size-4" aria-hidden="true" />
            )}
            <span className="ml-1">{saved ? "Saved" : "Save"}</span>
          </Button>
        ) : null}
      </div>
    </article>
  );
}
