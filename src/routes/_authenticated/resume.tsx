import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Upload } from "lucide-react";

import { AppShell, PageHeading } from "@/components/AppShell";
import { ScoreBar, ScoreRing } from "@/components/ScoreRing";
import { EmptyState, LoadingState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getMyContext } from "@/lib/profile.functions";
import { createResumeUploadTarget, deleteResume, getResumeDetail, processResume, reanalyseResume } from "@/lib/resume.functions";
import { titleCase } from "@/lib/formatters";

export const Route = createFileRoute("/_authenticated/resume")({
  head: () => ({
    meta: [
      { title: "Resume analysis — JobePilotAI" },
      { name: "description", content: "Upload your resume and get an honest 0-100 score with ATS feedback for your target role." },
      { property: "og:title", content: "Resume analysis — JobePilotAI" },
      { property: "og:description", content: "Honest resume scoring and ATS feedback." },
    ],
  }),
  component: ResumePage,
});

const STEPS = [
  "Reading your resume...",
  "Extracting your experience...",
  "Analyzing ATS compatibility...",
  "Scoring against your target role...",
];

function ResumePage() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState("");

  const loadContext = useServerFn(getMyContext);
  const loadDetail = useServerFn(getResumeDetail);
  const createTarget = useServerFn(createResumeUploadTarget);
  const process = useServerFn(processResume);
  const reanalyse = useServerFn(reanalyseResume);
  const remove = useServerFn(deleteResume);

  const contextQuery = useQuery({ queryKey: ["me"], queryFn: () => loadContext() });
  const detailQuery = useQuery({ queryKey: ["resume"], queryFn: () => loadDetail() });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const extension = file.name.toLowerCase().endsWith(".docx") ? "docx" : "pdf";
      setStep(STEPS[0]!);
      const target = await createTarget({ data: { extension } });
      const upload = await supabase.storage.from("resumes").uploadToSignedUrl(target.path, target.token, file);
      if (upload.error) throw new Error("We couldn't upload that file. Please try again.");
      setStep(STEPS[1]!);
      const result = await process({
        data: {
          filePath: target.path,
          originalFilename: file.name,
          mimeType: file.type || (extension === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
          sizeBytes: file.size,
        },
      });
      setStep(STEPS[3]!);
      return result;
    },
    onSuccess: async () => {
      setStep(null);
      await queryClient.invalidateQueries();
      toast.success("Resume analyzed.");
    },
    onError: (error: Error) => {
      setStep(null);
      toast.error(error.message || "We couldn't safely read this file. Please upload a valid PDF or DOCX.");
    },
  });

  const reanalyseMutation = useMutation({
    mutationFn: (values: { resumeId: string; targetRole: string }) => reanalyse({ data: values }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["resume"] });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("Scored against that role.");
    },
    onError: (error: Error) => toast.error(error.message || "We couldn't complete the analysis. Please try again."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Resume deleted.");
    },
  });

  function handleFile(file: File | undefined) {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
      toast.error("We couldn't safely read this file. Please upload a valid PDF or DOCX.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("That file is larger than 8MB. Please upload a smaller PDF or DOCX.");
      return;
    }
    uploadMutation.mutate(file);
  }

  const resume = detailQuery.data?.resume;
  const analyses = detailQuery.data?.analyses ?? [];
  const latest = analyses[0] as
    | {
        id: string;
        overall_score: number;
        target_role: string;
        verdict: string;
        summary: string;
        category_scores: Record<string, number>;
        strengths: string[];
        weaknesses: string[];
        improvements: string[];
        ats: {
          present_keywords: string[];
          missing_keywords: string[];
          weak_evidence: string[];
          formatting_issues: string[];
          parsing_risks: string[];
        };
      }
    | undefined;

  const parsed = resume?.parsed as
    | { name?: string; email?: string; skills?: string[]; job_titles?: string[]; uncertain_fields?: string[] }
    | null
    | undefined;

  return (
    <AppShell isAdmin={Boolean(contextQuery.data?.isAdmin)}>
      <PageHeading
        title="Your resume"
        description="Upload a PDF or DOCX. We extract the content, score it out of 100 for your target role and tell you exactly what to fix."
      />

      {step ? (
        <div className="surface-panel mb-6 p-5">
          <LoadingState message={step} />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          {detailQuery.isLoading ? (
            <LoadingState message="Loading your resume..." />
          ) : !resume ? (
            <EmptyState
              title="Upload your resume to get your JobePilotAI score"
              description="PDF or DOCX up to 8MB. We validate every file before reading it, and nothing inside a document is ever executed."
              icon={<Upload className="size-6" aria-hidden="true" />}
              action={
                <Button onClick={() => inputRef.current?.click()} disabled={uploadMutation.isPending}>
                  Upload resume
                </Button>
              }
            />
          ) : (
            <>
              <section className="surface-panel p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-base font-semibold">{resume.original_filename}</h2>
                    <p className="text-sm text-muted-foreground">
                      Uploaded {new Date(resume.created_at).toLocaleDateString()} · {Math.round((resume.size_bytes ?? 0) / 1024)} KB
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                      Replace
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(resume.id)}
                      disabled={deleteMutation.isPending}
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                {parsed ? (
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Detail label="Name detected" value={parsed.name || "Not detected"} />
                    <Detail label="Recent titles" value={parsed.job_titles?.slice(0, 3).join(", ") || "Not detected"} />
                    <div className="sm:col-span-2">
                      <dt className="text-sm text-muted-foreground">Skills found</dt>
                      <dd className="mt-1 flex flex-wrap gap-1.5">
                        {parsed.skills?.length ? (
                          parsed.skills.slice(0, 18).map((skill) => (
                            <Badge key={skill} variant="secondary" className="font-normal">
                              {skill}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-foreground">Not detected</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                ) : null}

                {parsed?.uncertain_fields?.length ? (
                  <p className="mt-4 flex items-start gap-2 rounded-md bg-warning/10 p-3 text-sm text-foreground">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                    <span>
                      We weren't fully confident about: {parsed.uncertain_fields.join(", ")}. Double-check these before
                      applying.
                    </span>
                  </p>
                ) : null}
              </section>

              {latest ? (
                <section className="surface-panel p-5">
                  <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                    <ScoreRing score={latest.overall_score} caption={`For ${latest.target_role}`} />
                    <div className="flex-1 space-y-2 text-center sm:text-left">
                      <Badge variant="secondary">{latest.verdict}</Badge>
                      <p className="text-sm text-foreground">{latest.summary}</p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {Object.entries(latest.category_scores ?? {}).map(([key, value]) => (
                      <ScoreBar key={key} label={titleCase(key.replace(/_/g, " "))} value={value} />
                    ))}
                  </div>

                  <div className="mt-6 grid gap-5 sm:grid-cols-2">
                    <FeedbackList title="What's working" items={latest.strengths} tone="good" />
                    <FeedbackList title="What's holding it back" items={latest.weaknesses} tone="bad" />
                  </div>

                  <div className="mt-5">
                    <h3 className="text-sm font-semibold text-foreground">Do these next</h3>
                    <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
                      {latest.improvements.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ol>
                  </div>
                </section>
              ) : null}

              {latest?.ats ? (
                <section className="surface-panel p-5">
                  <h2 className="font-display text-base font-semibold">ATS check for {latest.target_role}</h2>
                  <div className="mt-4 grid gap-5 sm:grid-cols-2">
                    <KeywordBlock title="Keywords already present" items={latest.ats.present_keywords} tone="good" />
                    <KeywordBlock title="Important keywords missing" items={latest.ats.missing_keywords} tone="bad" />
                    <FeedbackList title="Needs stronger evidence" items={latest.ats.weak_evidence} tone="warn" />
                    <FeedbackList
                      title="Formatting and parsing risks"
                      items={[...latest.ats.formatting_issues, ...latest.ats.parsing_risks]}
                      tone="warn"
                    />
                  </div>
                </section>
              ) : null}

              {analyses.length > 1 ? (
                <section className="surface-panel p-5">
                  <h2 className="font-display text-base font-semibold">Scores by role</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    The same resume scores differently depending on the role you're targeting.
                  </p>
                  <ul className="mt-3 divide-y divide-border">
                    {analyses.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                        <span className="text-foreground">{item.target_role}</span>
                        <span className="font-display font-semibold">{item.overall_score}/100</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </div>

        <aside className="space-y-5">
          <section className="surface-panel p-5">
            <h2 className="font-display text-base font-semibold">Score for another role</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter a target job title to re-score this resume for that specific role.
            </p>
            <form
              className="mt-3 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!resume) {
                  toast.error("Upload a resume first.");
                  return;
                }
                if (targetRole.trim().length < 2) {
                  toast.error("Enter a job title.");
                  return;
                }
                reanalyseMutation.mutate({ resumeId: resume.id, targetRole: targetRole.trim() });
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="target-role">Target role</Label>
                <Input
                  id="target-role"
                  value={targetRole}
                  maxLength={120}
                  placeholder="Customer Support Representative"
                  onChange={(event) => setTargetRole(event.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={reanalyseMutation.isPending}>
                {reanalyseMutation.isPending ? "Analyzing..." : "Analyze for this role"}
              </Button>
            </form>
          </section>

          <section className="surface-panel p-5 text-sm text-muted-foreground">
            <h2 className="font-display text-base font-semibold text-foreground">How we handle your file</h2>
            <ul className="mt-3 space-y-2">
              <li>Your resume is private to your account and never published.</li>
              <li>We check the extension, MIME type and the real file signature before reading anything.</li>
              <li>Nothing inside a document is ever executed — we only read text.</li>
              <li>You can delete your resume and all generated documents at any time.</li>
            </ul>
            <Button asChild variant="ghost" size="sm" className="mt-3 px-0">
              <Link to="/settings">Manage your data</Link>
            </Button>
          </section>
        </aside>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="sr-only"
        aria-label="Upload your resume"
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </AppShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function FeedbackList({ title, items, tone }: { title: string; items: string[]; tone: "good" | "bad" | "warn" }) {
  if (!items?.length) return null;
  const marker = tone === "good" ? "✓" : tone === "bad" ? "✗" : "⚠";
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden="true">{marker}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function KeywordBlock({ title, items, tone }: { title: string; items: string[]; tone: "good" | "bad" }) {
  return (
    <div>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        {tone === "good" ? (
          <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
        ) : (
          <AlertTriangle className="size-4 text-warning" aria-hidden="true" />
        )}
        {title}
      </h3>
      {items?.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {items.map((item) => (
            <li key={item}>
              <Badge variant={tone === "good" ? "secondary" : "outline"} className="font-normal">
                {item}
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">None found.</p>
      )}
    </div>
  );
}
