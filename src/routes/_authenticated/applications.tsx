import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeading } from "@/components/AppShell";
import { EmptyState, LoadingState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { APPLICATION_STATUSES, titleCase } from "@/lib/formatters";
import {
  createApplication,
  deleteApplication,
  draftFollowUp,
  listApplications,
  markFollowedUp,
  updateApplication,
} from "@/lib/applications.functions";
import { getMyContext } from "@/lib/profile.functions";
import { safeExternalUrl } from "@/lib/security";


export const Route = createFileRoute("/_authenticated/applications")({
  head: () => ({
    meta: [
      { title: "Application tracker — JobePilotAI" },
      {
        name: "description",
        content: "Track every application from saved to offer, with notes and follow-up dates.",
      },
      { property: "og:title", content: "Application tracker — JobePilotAI" },
      {
        property: "og:description",
        content: "Every application, status and follow-up in one place.",
      },
    ],
  }),
  component: ApplicationsPage,
});

function ApplicationsPage() {
  const queryClient = useQueryClient();
  const loadContext = useServerFn(getMyContext);
  const load = useServerFn(listApplications);
  const create = useServerFn(createApplication);
  const update = useServerFn(updateApplication);
  const remove = useServerFn(deleteApplication);
  const drafter = useServerFn(draftFollowUp);
  const markSent = useServerFn(markFollowedUp);

  const contextQuery = useQuery({ queryKey: ["me"], queryFn: () => loadContext() });
  const applicationsQuery = useQuery({ queryKey: ["applications"], queryFn: () => load() });

  const [followUp, setFollowUp] = useState<{
    id: string;
    company: string;
    role: string;
    subject: string;
    body: string;
  } | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    company_name: "",
    job_title: "",
    application_url: "",
    notes: "",
  });

  const createMutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          jobId: null,
          company_name: form.company_name,
          job_title: form.job_title,
          application_url: form.application_url ? form.application_url : null,
          status: "saved" as const,
          notes: form.notes || null,
          next_action: null,
          follow_up_date: null,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["applications"] });
      setForm({ company_name: "", job_title: "", application_url: "", notes: "" });
      setShowForm(false);
      toast.success("Application added.");
    },
    onError: (error: Error) =>
      toast.error(error.message || "We couldn't add that application. Please try again."),
  });

  const updateMutation = useMutation({
    mutationFn: (values: {
      id: string;
      status?: string;
      notes?: string;
      next_action?: string;
      follow_up_date?: string | null;
    }) => update({ data: values as never }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["applications"] }),
    onError: () => toast.error("We couldn't update that application. Please try again."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["applications"] }),
  });

  const followUpMutation = useMutation({
    mutationFn: async (item: { id: string; company_name: string; job_title: string }) => {
      const draft = await drafter({ data: { id: item.id } });
      return { ...draft, id: item.id, company: item.company_name, role: item.job_title };
    },
    onSuccess: (draft) => setFollowUp(draft),
    onError: (error: Error) =>
      toast.error(error.message || "We couldn't draft that follow-up. Please try again."),
  });

  const sentMutation = useMutation({
    mutationFn: (id: string) => markSent({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast.success("Follow-up recorded.");
      setFollowUp(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });



  const applications = applicationsQuery.data ?? [];
  const counts = APPLICATION_STATUSES.map((status) => ({
    status,
    count: applications.filter((item) => item.status === status).length,
  }));

  return (
    <AppShell isAdmin={Boolean(contextQuery.data?.isAdmin)}>
      <PageHeading
        title="Application tracker"
        description="Every role you're pursuing, with status, notes and next steps."
        actions={
          <Button onClick={() => setShowForm((value) => !value)}>
            {showForm ? "Cancel" : "Add application"}
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {counts.map(({ status, count }) => (
          <Badge key={status} variant={count ? "secondary" : "outline"}>
            {titleCase(status)}: {count}
          </Badge>
        ))}
      </div>

      {showForm ? (
        <form
          className="surface-panel mb-6 grid gap-4 p-5 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!form.company_name.trim() || !form.job_title.trim()) {
              toast.error("Company and job title are required.");
              return;
            }
            if (form.application_url && !safeExternalUrl(form.application_url)) {
              toast.error("Enter a valid http or https link.");
              return;
            }
            createMutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              value={form.company_name}
              maxLength={160}
              onChange={(event) => setForm({ ...form, company_name: event.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="title">Job title</Label>
            <Input
              id="title"
              value={form.job_title}
              maxLength={200}
              onChange={(event) => setForm({ ...form, job_title: event.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="url">Application link (optional)</Label>
            <Input
              id="url"
              type="url"
              value={form.application_url}
              maxLength={2048}
              onChange={(event) => setForm({ ...form, application_url: event.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              maxLength={4000}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </div>
          <Button type="submit" disabled={createMutation.isPending} className="sm:col-span-2">
            Add application
          </Button>
        </form>
      ) : null}

      {applicationsQuery.isLoading ? (
        <LoadingState message="Loading your applications..." />
      ) : applications.length === 0 ? (
        <EmptyState
          title="No applications yet"
          description="Prepare your first application to start tracking your progress."
          action={
            <Button asChild>
              <Link to="/jobs">Find jobs</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-4">
          {applications.map((item) => {
            const url = safeExternalUrl(item.application_url);
            return (
              <li key={item.id} className="surface-panel p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-base font-semibold text-foreground">
                      {item.job_title}
                    </h2>
                    <p className="text-sm text-muted-foreground">{item.company_name}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={item.status}
                      onValueChange={(value) =>
                        updateMutation.mutate({ id: item.id, status: value })
                      }
                    >
                      <SelectTrigger className="w-40" aria-label={`Status for ${item.job_title}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {APPLICATION_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {titleCase(status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {url ? (
                      <Button asChild size="sm" variant="outline">
                        <a href={url} target="_blank" rel="noopener noreferrer nofollow">
                          Open listing
                        </a>
                      </Button>
                    ) : null}
                    {item.job_id ? (
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/jobs/$jobId" params={{ jobId: item.job_id }}>
                          Details
                        </Link>
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(item.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`next-${item.id}`}>Next action</Label>
                    <Input
                      id={`next-${item.id}`}
                      defaultValue={item.next_action ?? ""}
                      maxLength={300}
                      onBlur={(event) =>
                        updateMutation.mutate({ id: item.id, next_action: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`follow-${item.id}`}>Follow-up date</Label>
                    <Input
                      id={`follow-${item.id}`}
                      type="date"
                      defaultValue={item.follow_up_date ?? ""}
                      onBlur={(event) =>
                        updateMutation.mutate({
                          id: item.id,
                          follow_up_date: event.target.value || null,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor={`notes-${item.id}`}>Notes</Label>
                    <Textarea
                      id={`notes-${item.id}`}
                      defaultValue={item.notes ?? ""}
                      maxLength={4000}
                      onBlur={(event) =>
                        updateMutation.mutate({ id: item.id, notes: event.target.value })
                      }
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
