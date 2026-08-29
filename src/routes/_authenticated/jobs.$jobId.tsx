import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Copy, Download } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { ScoreBar } from "@/components/ScoreRing";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SOURCE_LABELS } from "@/lib/jobs/types";
import { formatLocation, formatPosted, formatSalary, titleCase } from "@/lib/formatters";
import { matchLabel } from "@/lib/matching";
import { getJobMatch, saveJob, unsaveJob, listSavedJobs } from "@/lib/jobs.functions";
import {
  generateDocument,
  getJobDocuments,
  prepareApplication,
  updateDocument,
} from "@/lib/documents.functions";
import { createApplication } from "@/lib/applications.functions";
import { getMyContext } from "@/lib/profile.functions";
import { safeExternalUrl } from "@/lib/security";

export const Route = createFileRoute("/_authenticated/jobs/$jobId")({
  validateSearch: (search: Record<string, unknown>): { prepare?: boolean } =>
    search["prepare"] ? { prepare: true } : {},
  head: () => ({
    meta: [
      { title: "Job details — JobePilotAI" },
      {
        name: "description",
        content:
          "See why this role fits your resume, prepare your application and apply at the source.",
      },
      { property: "og:title", content: "Job details — JobePilotAI" },
      {
        property: "og:description",
        content: "Match breakdown and application preparation for this role.",
      },
    ],
  }),
  component: JobDetailPage,
});

function JobDetailPage() {
  const { jobId } = Route.useParams();
  const { prepare } = Route.useSearch();
  const queryClient = useQueryClient();

  const loadContext = useServerFn(getMyContext);
  const loadMatch = useServerFn(getJobMatch);
  const loadDocs = useServerFn(getJobDocuments);
  const loadSaved = useServerFn(listSavedJobs);
  const save = useServerFn(saveJob);
  const unsave = useServerFn(unsaveJob);
  const generate = useServerFn(generateDocument);
  const runPrep = useServerFn(prepareApplication);
  const editDoc = useServerFn(updateDocument);
  const addApplication = useServerFn(createApplication);

  const contextQuery = useQuery({ queryKey: ["me"], queryFn: () => loadContext() });
  const matchQuery = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => loadMatch({ data: { jobId } }),
  });
  const docsQuery = useQuery({
    queryKey: ["job-docs", jobId],
    queryFn: () => loadDocs({ data: { jobId } }),
  });
  const savedQuery = useQuery({ queryKey: ["saved-jobs"], queryFn: () => loadSaved() });

  const isSaved = (savedQuery.data ?? []).some(
    (item) => (item.job as { id: string } | null)?.id === jobId,
  );
  const [draft, setDraft] = useState<{ id: string; content: string } | null>(null);

  const prepMutation = useMutation({
    mutationFn: () => runPrep({ data: { jobId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["job-docs", jobId] });
      toast.success("Application plan ready.");
    },
    onError: (error: Error) =>
      toast.error(error.message || "We couldn't complete the analysis. Please try again."),
  });

  useEffect(() => {
    if (prepare && matchQuery.data?.hasResume && !prepMutation.isPending && !prepMutation.data) {
      prepMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepare, matchQuery.data?.hasResume]);

  const docMutation = useMutation({
    mutationFn: (docType: "cover_letter" | "tailored_resume") =>
      generate({ data: { jobId, docType } }),
    onSuccess: async (doc) => {
      await queryClient.invalidateQueries({ queryKey: ["job-docs", jobId] });
      setDraft({ id: doc.id, content: doc.content ?? "" });
      toast.success("Document generated.");
    },
    onError: (error: Error) =>
      toast.error(error.message || "We couldn't complete the analysis. Please try again."),
  });

  const saveDocMutation = useMutation({
    mutationFn: (values: { id: string; content: string }) => editDoc({ data: values }),
    onSuccess: () => toast.success("Saved."),
    onError: () => toast.error("We couldn't save your edits. Please try again."),
  });

  const trackMutation = useMutation({
    mutationFn: () => {
      const job = matchQuery.data!.job;
      return addApplication({
        data: {
          jobId: job.id,
          company_name: job.company_name,
          job_title: job.title,
          application_url: job.application_url,
          status: "preparing",
          notes: null,
          next_action: "Finish tailoring documents",
          follow_up_date: null,
        },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast.success("Added to your application tracker.");
    },
    onError: (error: Error) =>
      toast.error(error.message || "We couldn't add that application. Please try again."),
  });

  if (matchQuery.isLoading) {
    return (
      <AppShell>
        <LoadingState message="Comparing your resume with this job..." />
      </AppShell>
    );
  }

  if (matchQuery.isError) {
    return (
      <AppShell>
        <ErrorState action={<Button onClick={() => matchQuery.refetch()}>Try again</Button>} />
      </AppShell>
    );
  }

  if (!matchQuery.data) {
    return (
      <AppShell>
        <EmptyState
          title="This job is no longer listed"
          description="The listing may have been removed by the employer or the source."
          action={
            <Button asChild>
              <Link to="/jobs">Back to jobs</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const { job, match, hasResume } = matchQuery.data;
  const applyUrl = safeExternalUrl(job.application_url) ?? safeExternalUrl(job.source_url);
  const band = matchLabel(match.score);
  const documents = docsQuery.data ?? [];
  const prepPack = prepMutation.data?.pack;

  return (
    <AppShell isAdmin={Boolean(contextQuery.data?.isAdmin)}>
      <Button asChild variant="ghost" size="sm" className="mb-4 px-0">
        <Link to="/jobs">← Back to jobs</Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <header className="surface-panel p-5">
            <h1 className="font-display text-2xl font-semibold text-foreground">{job.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{job.company_name}</p>

            <div className="mt-4 flex flex-wrap gap-1.5">
              <Badge variant="outline">{formatLocation(job)}</Badge>
              {job.employment_type ? (
                <Badge variant="outline">{titleCase(job.employment_type)}</Badge>
              ) : null}
              {job.experience_level ? (
                <Badge variant="outline">{titleCase(job.experience_level)}</Badge>
              ) : null}
              <Badge variant="secondary">{formatSalary(job)}</Badge>
              <Badge variant="secondary">Posted {formatPosted(job.posted_at).toLowerCase()}</Badge>
              <Badge variant="outline">Source: {SOURCE_LABELS[job.source] ?? job.source}</Badge>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {applyUrl ? (
                <Button asChild>
                  <a href={applyUrl} target="_blank" rel="noopener noreferrer nofollow">
                    Apply now
                    <ExternalLink className="size-4" aria-hidden="true" />
                  </a>
                </Button>
              ) : (
                <Button disabled>Application link unavailable</Button>
              )}
              <Button
                variant="outline"
                onClick={() => prepMutation.mutate()}
                disabled={prepMutation.isPending || !hasResume}
              >
                {prepMutation.isPending
                  ? "Preparing your application..."
                  : "Prepare my application"}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  isSaved
                    ? unsave({ data: { jobId } }).then(() =>
                        queryClient.invalidateQueries({ queryKey: ["saved-jobs"] }),
                      )
                    : save({ data: { jobId, notes: null } }).then(() =>
                        queryClient.invalidateQueries({ queryKey: ["saved-jobs"] }),
                      )
                }
              >
                {isSaved ? "Saved" : "Save job"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => trackMutation.mutate()}
                disabled={trackMutation.isPending}
              >
                Track this application
              </Button>
            </div>
          </header>

          {!hasResume ? (
            <EmptyState
              title="Upload your resume to see your match"
              description="We score each job against your actual experience — no resume, no score."
              action={
                <Button asChild>
                  <Link to="/resume">Upload resume</Link>
                </Button>
              }
            />
          ) : (
            <section className="surface-panel p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-base font-semibold">JobePilotAI Match Score</h2>
                <span className="font-display text-2xl font-semibold">{match.score}%</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {band.label} match. This compares your resume and preferences with this listing. It
                is not a prediction of whether you'll be hired.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <ScoreBar label="Role match" value={match.breakdown.role} />
                <ScoreBar label="Skills match" value={match.breakdown.skills} />
                <ScoreBar label="Experience" value={match.breakdown.experience} />
                <ScoreBar label="Keywords" value={match.breakdown.keywords} />
                <ScoreBar label="Location / remote" value={match.breakdown.location} />
                <ScoreBar label="Salary preference" value={match.breakdown.salary} />
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Why you match</h3>
                  <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                    {match.reasons.length ? (
                      match.reasons.map((reason) => (
                        <li key={reason} className="flex gap-2">
                          <span aria-hidden="true">✓</span>
                          <span>{reason}</span>
                        </li>
                      ))
                    ) : (
                      <li>No strong overlap found with your resume.</li>
                    )}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Potential gaps</h3>
                  <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                    {match.gaps.length ? (
                      match.gaps.map((gap) => (
                        <li key={gap} className="flex gap-2">
                          <span aria-hidden="true">⚠</span>
                          <span>{gap}</span>
                        </li>
                      ))
                    ) : (
                      <li>No obvious gaps against the listed requirements.</li>
                    )}
                  </ul>
                </div>
              </div>
            </section>
          )}

          {prepPack ? (
            <section className="surface-panel p-5">
              <h2 className="font-display text-base font-semibold">Your application plan</h2>
              <p className="mt-2 text-sm text-foreground">{prepPack.fitSummary}</p>

              <h3 className="mt-4 text-sm font-semibold">Checklist</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                {prepPack.checklist.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden="true">□</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <h3 className="mt-4 text-sm font-semibold">Talking points</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {prepPack.talkingPoints.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              {prepPack.likelyQuestions.length ? (
                <>
                  <h3 className="mt-4 text-sm font-semibold">Questions to prepare for</h3>
                  <dl className="mt-2 space-y-3 text-sm">
                    {prepPack.likelyQuestions.map((item) => (
                      <div key={item.question}>
                        <dt className="font-medium text-foreground">{item.question}</dt>
                        <dd className="text-muted-foreground">{item.suggestedAnswer}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              ) : null}
            </section>
          ) : null}

          <section className="surface-panel p-5">
            <h2 className="font-display text-base font-semibold">Job description</h2>
            <div className="prose-plain mt-3 text-sm text-foreground">
              {job.description || "No description provided by the source."}
            </div>
            {job.requirements ? (
              <>
                <h3 className="mt-5 text-sm font-semibold">Requirements</h3>
                <div className="prose-plain mt-2 text-sm text-foreground">{job.requirements}</div>
              </>
            ) : null}
            {applyUrl ? (
              <p className="mt-5 text-xs text-muted-foreground">
                Listing provided by {SOURCE_LABELS[job.source] ?? job.source}.{" "}
                <a
                  href={applyUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="underline"
                >
                  View the original listing
                </a>
                .
              </p>
            ) : null}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="surface-panel p-5">
            <h2 className="font-display text-base font-semibold">Application documents</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Written from your real resume and this exact job description. Nothing is invented.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <Button
                onClick={() => docMutation.mutate("cover_letter")}
                disabled={docMutation.isPending || !hasResume}
              >
                {docMutation.isPending ? "Writing your cover letter..." : "Generate cover letter"}
              </Button>
              <Button
                variant="outline"
                onClick={() => docMutation.mutate("tailored_resume")}
                disabled={docMutation.isPending || !hasResume}
              >
                Tailor my resume
              </Button>
            </div>

            {documents.length ? (
              <ul className="mt-4 space-y-3">
                {documents.map((doc) => (
                  <li key={doc.id} className="rounded-md border border-border p-3">
                    <p className="text-sm font-medium text-foreground">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(doc.created_at).toLocaleString()}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDraft({ id: doc.id, content: doc.content ?? "" })}
                      >
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(doc.content ?? "");
                          toast.success("Copied to clipboard.");
                        }}
                      >
                        <Copy className="size-3.5" aria-hidden="true" /> Copy
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => downloadText(`${doc.title}.txt`, doc.content ?? "")}
                      >
                        <Download className="size-3.5" aria-hidden="true" /> Download
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                No documents yet for this job. Generate one to get started.
              </p>
            )}
          </section>

          {draft ? (
            <section className="surface-panel p-5">
              <h2 className="font-display text-base font-semibold">Edit document</h2>
              <Textarea
                className="mt-3 min-h-64"
                value={draft.content}
                onChange={(event) => setDraft({ ...draft, content: event.target.value })}
                aria-label="Document content"
              />
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => saveDocMutation.mutate(draft)}
                  disabled={saveDocMutation.isPending}
                >
                  Save changes
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
                  Close
                </Button>
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </AppShell>
  );
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.replace(/[^A-Za-z0-9 ._-]/g, "_");
  anchor.click();
  URL.revokeObjectURL(url);
}
