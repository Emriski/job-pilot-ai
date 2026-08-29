import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Search } from "lucide-react";

import { AppShell, PageHeading } from "@/components/AppShell";
import { JobCard } from "@/components/JobCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { exampleRole } from "@/lib/professions";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { titleCase } from "@/lib/formatters";
import { getMyContext } from "@/lib/profile.functions";
import {
  getRecommendations,
  listSavedJobs,
  saveJob,
  searchJobs,
  unsaveJob,
} from "@/lib/jobs.functions";
import {
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  SALARY_PERIODS,
  WORK_MODES,
  type JobSearchInput,
} from "@/lib/validation";

export const Route = createFileRoute("/_authenticated/jobs/")({
  head: () => ({
    meta: [
      { title: "Find jobs — JobePilotAI" },
      {
        name: "description",
        content:
          "Search live listings from public job sources and see how well each one matches your resume.",
      },
      { property: "og:title", content: "Find jobs — JobePilotAI" },
      { property: "og:description", content: "Real listings, scored against your resume." },
    ],
  }),
  component: JobsPage,
});

const defaultFilters: JobSearchInput = {
  query: "",
  location: "",
  workMode: "any",
  employmentTypes: [],
  experienceLevels: [],
  minSalary: null,
  salaryPeriod: "monthly",
  postedWithinDays: 0,
  sources: [],
  page: 1,
  pageSize: 12,
};

function JobsPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<JobSearchInput>(defaultFilters);
  const [applied, setApplied] = useState<JobSearchInput>(defaultFilters);
  const [tab, setTab] = useState("recommended");

  const loadContext = useServerFn(getMyContext);
  const runSearch = useServerFn(searchJobs);
  const runRecommend = useServerFn(getRecommendations);
  const loadSaved = useServerFn(listSavedJobs);
  const save = useServerFn(saveJob);
  const unsave = useServerFn(unsaveJob);

  const contextQuery = useQuery({ queryKey: ["me"], queryFn: () => loadContext() });
  const savedQuery = useQuery({ queryKey: ["saved-jobs"], queryFn: () => loadSaved() });
  const savedIds = new Set(
    (savedQuery.data ?? [])
      .map((item) => (item.job as { id: string } | null)?.id)
      .filter(Boolean) as string[],
  );

  const searchQuery = useQuery({
    queryKey: ["job-search", applied],
    queryFn: () => runSearch({ data: applied }),
    enabled: tab === "search",
  });

  const recommendQuery = useQuery({
    queryKey: ["recommendations"],
    queryFn: () => runRecommend({ data: { refresh: false } }),
    enabled: tab === "recommended",
  });

  const refreshMutation = useMutation({
    mutationFn: () => runRecommend({ data: { refresh: true } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["recommendations"] });
      toast.success("Job sources refreshed.");
    },
    onError: (error: Error) =>
      toast.error(error.message || "We couldn't retrieve jobs right now. Please try again."),
  });

  const saveMutation = useMutation({
    mutationFn: async ({ jobId, isSaved }: { jobId: string; isSaved: boolean }) =>
      isSaved ? unsave({ data: { jobId } }) : save({ data: { jobId, notes: null } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-jobs"] }),
    onError: () => toast.error("We couldn't update your saved jobs. Please try again."),
  });

  function toggleList(key: "employmentTypes" | "experienceLevels", value: string) {
    setFilters((current) => {
      const list = current[key] as string[];
      const next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
      return { ...current, [key]: next } as JobSearchInput;
    });
  }

  const recommendations = recommendQuery.data?.recommendations ?? [];

  return (
    <AppShell isAdmin={Boolean(contextQuery.data?.isAdmin)}>
      <PageHeading
        title="Find jobs"
        description="Live listings pulled from public job sources, scored against your resume and preferences."
        actions={
          <Button
            variant="outline"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
          >
            <RefreshCw
              className={refreshMutation.isPending ? "size-4 animate-spin" : "size-4"}
              aria-hidden="true"
            />
            {refreshMutation.isPending ? "Refreshing sources..." : "Refresh sources"}
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="recommended">Recommended for you</TabsTrigger>
          <TabsTrigger value="search">Search all jobs</TabsTrigger>
        </TabsList>

        <TabsContent value="recommended" className="mt-6">
          {recommendQuery.isLoading || refreshMutation.isPending ? (
            <LoadingState message="Finding matching jobs..." />
          ) : recommendQuery.isError ? (
            <ErrorState
              message="We couldn't retrieve jobs right now. Please try again."
              action={<Button onClick={() => recommendQuery.refetch()}>Try again</Button>}
            />
          ) : !recommendQuery.data?.hasResume ? (
            <EmptyState
              title="Upload your resume to unlock personalized job matching"
              description="Once we can read your experience we score every listing against it and explain each match."
            />
          ) : recommendations.length === 0 ? (
            <EmptyState
              title="No matching jobs yet"
              description="Refresh the sources or widen your target roles in Settings to see more listings."
              action={<Button onClick={() => refreshMutation.mutate()}>Refresh sources</Button>}
            />
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground" role="status">
                Scanned {recommendQuery.data.scanned} active listings · {recommendQuery.data.strong}{" "}
                strong matches found.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {recommendations.map(({ job, match }) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    score={match.score}
                    saved={savedIds.has(job.id)}
                    onToggleSave={() =>
                      saveMutation.mutate({ jobId: job.id, isSaved: savedIds.has(job.id) })
                    }
                  />
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="search" className="mt-6">
          <form
            className="surface-panel mb-6 space-y-4 p-5"
            onSubmit={(event) => {
              event.preventDefault();
              setApplied({ ...filters, page: 1 });
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5 lg:col-span-2">
                <Label htmlFor="q">Job title, skill or company</Label>
                <Input
                  id="q"
                  value={filters.query}
                  maxLength={160}
                  placeholder={`e.g. ${exampleRole()}`}
                  onChange={(event) => setFilters({ ...filters, query: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loc">Location or country</Label>
                <Input
                  id="loc"
                  value={filters.location}
                  maxLength={120}
                  onChange={(event) => setFilters({ ...filters, location: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mode">Work setup</Label>
                <Select
                  value={filters.workMode}
                  onValueChange={(value) =>
                    setFilters({ ...filters, workMode: value as JobSearchInput["workMode"] })
                  }
                >
                  <SelectTrigger id="mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    {WORK_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {titleCase(mode)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="minsal">Minimum salary</Label>
                <Input
                  id="minsal"
                  type="number"
                  min={0}
                  value={filters.minSalary ?? ""}
                  onChange={(event) =>
                    setFilters({
                      ...filters,
                      minSalary: event.target.value === "" ? null : Number(event.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="period">Salary period</Label>
                <Select
                  value={filters.salaryPeriod}
                  onValueChange={(value) =>
                    setFilters({
                      ...filters,
                      salaryPeriod: value as JobSearchInput["salaryPeriod"],
                    })
                  }
                >
                  <SelectTrigger id="period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SALARY_PERIODS.map((period) => (
                      <SelectItem key={period} value={period}>
                        {titleCase(period)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="posted">Posted within</Label>
                <Select
                  value={String(filters.postedWithinDays)}
                  onValueChange={(value) =>
                    setFilters({
                      ...filters,
                      postedWithinDays: Number(value) as JobSearchInput["postedWithinDays"],
                    })
                  }
                >
                  <SelectTrigger id="posted">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Any time</SelectItem>
                    <SelectItem value="1">Today</SelectItem>
                    <SelectItem value="3">3 days</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset>
                <legend className="text-sm font-medium">Employment type</legend>
                <div className="mt-2 flex flex-wrap gap-3">
                  {EMPLOYMENT_TYPES.map((type) => (
                    <label key={type} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={filters.employmentTypes.includes(type)}
                        onCheckedChange={() => toggleList("employmentTypes", type)}
                      />
                      {titleCase(type)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-sm font-medium">Experience</legend>
                <div className="mt-2 flex flex-wrap gap-3">
                  {EXPERIENCE_LEVELS.map((level) => (
                    <label key={level} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={filters.experienceLevels.includes(level)}
                        onCheckedChange={() => toggleList("experienceLevels", level)}
                      />
                      {titleCase(level)}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit">
                <Search className="size-4" aria-hidden="true" />
                Search jobs
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setFilters(defaultFilters);
                  setApplied(defaultFilters);
                }}
              >
                Clear filters
              </Button>
            </div>
          </form>

          {searchQuery.isFetching ? (
            <LoadingState message="Searching active job sources..." />
          ) : searchQuery.isError ? (
            <ErrorState
              message="We couldn't retrieve jobs right now. Please try again."
              action={<Button onClick={() => searchQuery.refetch()}>Try again</Button>}
            />
          ) : (searchQuery.data?.jobs.length ?? 0) === 0 ? (
            <EmptyState
              title="No jobs matched those filters"
              description="Try a broader job title, remove the salary filter, or refresh the sources for newer listings."
            />
          ) : (
            <>
              <div
                className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
                role="status"
              >
                <Badge variant="secondary">Found {searchQuery.data!.total} jobs</Badge>
                <span>
                  Page {applied.page} of{" "}
                  {Math.max(1, Math.ceil(searchQuery.data!.total / applied.pageSize))}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {searchQuery.data!.jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    saved={savedIds.has(job.id)}
                    onToggleSave={() =>
                      saveMutation.mutate({ jobId: job.id, isSaved: savedIds.has(job.id) })
                    }
                  />
                ))}
              </div>
              <div className="mt-6 flex justify-center gap-2">
                <Button
                  variant="outline"
                  disabled={applied.page <= 1}
                  onClick={() => {
                    const next = { ...applied, page: applied.page - 1 };
                    setApplied(next);
                    setFilters(next);
                  }}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={applied.page * applied.pageSize >= (searchQuery.data?.total ?? 0)}
                  onClick={() => {
                    const next = { ...applied, page: applied.page + 1 };
                    setApplied(next);
                    setFilters(next);
                  }}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
