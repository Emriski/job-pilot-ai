import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeading } from "@/components/AppShell";
import { LoadingState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SALARY_PERIODS } from "@/lib/validation";
import { createAlert, deleteAlert, deleteMyData, getMyContext, listAlerts } from "@/lib/profile.functions";
import { supabase } from "@/integrations/supabase/client";
import { titleCase } from "@/lib/formatters";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — JobePilotAI" },
      { name: "description", content: "Manage your job preferences, job alerts, privacy and account data." },
      { property: "og:title", content: "Settings — JobePilotAI" },
      { property: "og:description", content: "Preferences, alerts and data controls for your JobePilotAI account." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const loadContext = useServerFn(getMyContext);
  const loadAlerts = useServerFn(listAlerts);
  const addAlert = useServerFn(createAlert);
  const removeAlert = useServerFn(deleteAlert);
  const wipe = useServerFn(deleteMyData);

  const contextQuery = useQuery({ queryKey: ["me"], queryFn: () => loadContext() });
  const alertsQuery = useQuery({ queryKey: ["alerts"], queryFn: () => loadAlerts() });

  const [alertForm, setAlertForm] = useState({
    label: "",
    query: "",
    remote_only: true,
    min_salary: "",
    salary_period: "monthly" as (typeof SALARY_PERIODS)[number],
  });
  const [confirmText, setConfirmText] = useState("");

  const createAlertMutation = useMutation({
    mutationFn: () =>
      addAlert({
        data: {
          label: alertForm.label,
          query: alertForm.query || null,
          remote_only: alertForm.remote_only,
          min_salary: alertForm.min_salary ? Number(alertForm.min_salary) : null,
          salary_period: alertForm.salary_period,
          countries: [],
          employment_types: [],
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["alerts"] });
      setAlertForm({ ...alertForm, label: "", query: "", min_salary: "" });
      toast.success("Alert saved.");
    },
    onError: (error: Error) => toast.error(error.message || "We couldn't create that alert. Please try again."),
  });

  const deleteDataMutation = useMutation({
    mutationFn: () => wipe(),
    onSuccess: async () => {
      queryClient.clear();
      toast.success("Your data has been deleted.");
      await navigate({ to: "/onboarding" });
    },
    onError: () => toast.error("We couldn't delete your data. Please try again."),
  });

  if (contextQuery.isLoading) {
    return (
      <AppShell>
        <LoadingState message="Loading your settings..." />
      </AppShell>
    );
  }

  const profile = contextQuery.data?.profile;
  const alerts = alertsQuery.data ?? [];

  return (
    <AppShell isAdmin={Boolean(contextQuery.data?.isAdmin)}>
      <PageHeading title="Settings" description="Your preferences, alerts, privacy and account controls." />

      <div className="space-y-6">
        <section className="surface-panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold">Job preferences</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                These drive your recommendations and match scores.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/onboarding">Edit preferences</Link>
            </Button>
          </div>

          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Name</dt>
              <dd className="text-sm text-foreground">{profile?.full_name || "Not set"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Target roles</dt>
              <dd className="text-sm text-foreground">{profile?.target_titles?.join(", ") || "Not set"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Work modes</dt>
              <dd className="text-sm text-foreground">
                {profile?.work_modes?.map(titleCase).join(", ") || "Not set"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Minimum salary</dt>
              <dd className="text-sm text-foreground">
                {profile?.min_salary
                  ? `${profile.salary_currency ?? "USD"} ${Number(profile.min_salary).toLocaleString()} per ${profile.salary_period ?? "month"}`
                  : "Not set"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="surface-panel p-5">
          <h2 className="font-display text-base font-semibold">Job alerts</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Saved searches you can re-run at any time. We only alert on real listings from connected sources.
          </p>

          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!alertForm.label.trim()) {
                toast.error("Give your alert a name.");
                return;
              }
              createAlertMutation.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="alert-label">Alert name</Label>
              <Input
                id="alert-label"
                value={alertForm.label}
                maxLength={120}
                onChange={(event) => setAlertForm({ ...alertForm, label: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alert-query">Keywords</Label>
              <Input
                id="alert-query"
                value={alertForm.query}
                maxLength={200}
                onChange={(event) => setAlertForm({ ...alertForm, query: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alert-salary">Minimum salary</Label>
              <Input
                id="alert-salary"
                type="number"
                min={0}
                value={alertForm.min_salary}
                onChange={(event) => setAlertForm({ ...alertForm, min_salary: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alert-period">Salary period</Label>
              <Select
                value={alertForm.salary_period}
                onValueChange={(value) =>
                  setAlertForm({ ...alertForm, salary_period: value as (typeof SALARY_PERIODS)[number] })
                }
              >
                <SelectTrigger id="alert-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SALARY_PERIODS.map((period) => (
                    <SelectItem key={period} value={period}>
                      Per {period.replace("ly", "")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Checkbox
                id="alert-remote"
                checked={alertForm.remote_only}
                onCheckedChange={(checked) => setAlertForm({ ...alertForm, remote_only: checked === true })}
              />
              <Label htmlFor="alert-remote">Remote roles only</Label>
            </div>
            <Button type="submit" disabled={createAlertMutation.isPending} className="sm:col-span-2">
              Save alert
            </Button>
          </form>

          {alerts.length ? (
            <ul className="mt-5 space-y-2">
              {alerts.map((alert) => (
                <li key={alert.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{alert.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {alert.query || "Any keywords"}
                      {alert.remote_only ? " · Remote only" : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/jobs">Run search</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        removeAlert({ data: { id: alert.id } }).then(() =>
                          queryClient.invalidateQueries({ queryKey: ["alerts"] }),
                        )
                      }
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">No alerts yet.</p>
          )}
        </section>

        <section className="surface-panel p-5">
          <h2 className="font-display text-base font-semibold">Privacy and your data</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Your resume file is stored privately and is only readable by your account.</li>
            <li>Resume text is used to score jobs and draft documents for you — nothing is shared publicly.</li>
            <li>Job listings come from public sources and always link back to the original posting.</li>
          </ul>
          {contextQuery.data?.isAdmin ? (
            <Badge className="mt-3" variant="secondary">
              Admin access enabled
            </Badge>
          ) : null}
        </section>

        <section className="surface-panel border-destructive/40 p-5">
          <h2 className="font-display text-base font-semibold text-destructive">Delete my data</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Permanently removes your resume files, analyses, matches, saved jobs, documents, applications and alerts.
            This cannot be undone. Type <span className="font-medium text-foreground">DELETE</span> to confirm.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Input
              className="max-w-48"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              aria-label="Type DELETE to confirm"
              placeholder="DELETE"
            />
            <Button
              variant="destructive"
              disabled={confirmText !== "DELETE" || deleteDataMutation.isPending}
              onClick={() => deleteDataMutation.mutate()}
            >
              {deleteDataMutation.isPending ? "Deleting..." : "Delete everything"}
            </Button>
          </div>
        </section>

        <section className="surface-panel p-5">
          <h2 className="font-display text-base font-semibold">Account</h2>
          <Button
            className="mt-3"
            variant="outline"
            onClick={async () => {
              await queryClient.cancelQueries();
              queryClient.clear();
              await supabase.auth.signOut();
              await navigate({ to: "/auth", search: {}, replace: true });
            }}
          >
            Sign out
          </Button>
        </section>
      </div>
    </AppShell>
  );
}
