import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeading } from "@/components/AppShell";
import { LoadingState } from "@/components/States";
import { TagInput } from "@/components/TagInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { getMyContext, saveProfile } from "@/lib/profile.functions";
import {
  CURRENCIES,
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  SALARY_PERIODS,
  WORK_MODES,
  type ProfileInput,
} from "@/lib/validation";
import { titleCase } from "@/lib/formatters";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your job preferences — JobePilotAI" },
      { name: "description", content: "Tell JobePilotAI what roles, salary and work setup you're targeting." },
      { property: "og:title", content: "Set up your job preferences — JobePilotAI" },
      { property: "og:description", content: "Target roles, salary expectations and work preferences." },
    ],
  }),
  component: OnboardingPage,
});

const emptyForm: ProfileInput = {
  full_name: "",
  target_titles: [],
  employment_types: ["full-time"],
  work_modes: ["remote"],
  countries: [],
  min_salary: null,
  salary_period: "monthly",
  salary_currency: "USD",
  experience_level: null,
  industries: [],
  skills: [],
};

function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const loadContext = useServerFn(getMyContext);
  const persist = useServerFn(saveProfile);

  const contextQuery = useQuery({ queryKey: ["me"], queryFn: () => loadContext() });
  const [form, setForm] = useState<ProfileInput>(emptyForm);

  useEffect(() => {
    const profile = contextQuery.data?.profile;
    if (!profile) return;
    setForm({
      full_name: profile.full_name ?? "",
      target_titles: profile.target_titles ?? [],
      employment_types: (profile.employment_types ?? ["full-time"]) as ProfileInput["employment_types"],
      work_modes: (profile.work_modes ?? ["remote"]) as ProfileInput["work_modes"],
      countries: profile.countries ?? [],
      min_salary: profile.min_salary ?? null,
      salary_period: (profile.salary_period ?? "monthly") as ProfileInput["salary_period"],
      salary_currency: (profile.salary_currency ?? "USD") as ProfileInput["salary_currency"],
      experience_level: (profile.experience_level ?? null) as ProfileInput["experience_level"],
      industries: profile.industries ?? [],
      skills: profile.skills ?? [],
    });
  }, [contextQuery.data]);

  const mutation = useMutation({
    mutationFn: (values: ProfileInput) => persist({ data: values }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("Preferences saved.");
      navigate({ to: "/resume" });
    },
    onError: (error: Error) => toast.error(error.message || "We couldn't save your preferences. Please try again."),
  });

  function toggle<K extends "employment_types" | "work_modes">(key: K, value: string) {
    setForm((current) => {
      const list = current[key] as string[];
      const next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
      return { ...current, [key]: next } as ProfileInput;
    });
  }

  if (contextQuery.isLoading) {
    return (
      <AppShell>
        <LoadingState message="Loading your profile..." />
      </AppShell>
    );
  }

  return (
    <AppShell isAdmin={contextQuery.data?.isAdmin}>
      <PageHeading
        title="Tell us what you're looking for"
        description="We use this to score your resume against the right roles and to rank real job listings for you. You can change any of it later in Settings."
      />

      <form
        className="grid gap-6 lg:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!form.full_name.trim()) return toast.error("Please enter your name.");
          if (form.target_titles.length === 0) return toast.error("Add at least one target job title.");
          mutation.mutate(form);
        }}
      >
        <section className="surface-panel space-y-4 p-5">
          <h2 className="font-display text-base font-semibold">About you</h2>

          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              value={form.full_name}
              maxLength={120}
              onChange={(event) => setForm({ ...form, full_name: event.target.value })}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="experience">Experience level</Label>
            <Select
              value={form.experience_level ?? ""}
              onValueChange={(value) =>
                setForm({ ...form, experience_level: value as ProfileInput["experience_level"] })
              }
            >
              <SelectTrigger id="experience">
                <SelectValue placeholder="Select your level" />
              </SelectTrigger>
              <SelectContent>
                {EXPERIENCE_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {titleCase(level)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <TagInput
            label="Target job titles"
            hint="For example: Customer Support Representative"
            values={form.target_titles}
            onChange={(values) => setForm({ ...form, target_titles: values })}
          />

          <TagInput
            label="Key skills"
            hint="Add the skills you want to be matched on."
            values={form.skills}
            onChange={(values) => setForm({ ...form, skills: values })}
          />

          <TagInput
            label="Industries (optional)"
            values={form.industries}
            onChange={(values) => setForm({ ...form, industries: values })}
          />
        </section>

        <section className="surface-panel space-y-5 p-5">
          <h2 className="font-display text-base font-semibold">Work and pay preferences</h2>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">Work setup</legend>
            <div className="flex flex-wrap gap-4">
              {WORK_MODES.map((mode) => (
                <label key={mode} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.work_modes.includes(mode)} onCheckedChange={() => toggle("work_modes", mode)} />
                  {titleCase(mode)}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">Employment type</legend>
            <div className="flex flex-wrap gap-4">
              {EMPLOYMENT_TYPES.map((type) => (
                <label key={type} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.employment_types.includes(type)}
                    onCheckedChange={() => toggle("employment_types", type)}
                  />
                  {titleCase(type)}
                </label>
              ))}
            </div>
          </fieldset>

          <TagInput
            label="Preferred countries (optional)"
            hint="Leave empty if you're open to anywhere you're eligible to work."
            values={form.countries}
            onChange={(values) => setForm({ ...form, countries: values })}
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="min_salary">Minimum salary</Label>
              <Input
                id="min_salary"
                type="number"
                min={0}
                inputMode="numeric"
                value={form.min_salary ?? ""}
                onChange={(event) =>
                  setForm({ ...form, min_salary: event.target.value === "" ? null : Number(event.target.value) })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="salary_period">Per</Label>
              <Select
                value={form.salary_period}
                onValueChange={(value) => setForm({ ...form, salary_period: value as ProfileInput["salary_period"] })}
              >
                <SelectTrigger id="salary_period">
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
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={form.salary_currency}
                onValueChange={(value) =>
                  setForm({ ...form, salary_currency: value as ProfileInput["salary_currency"] })
                }
              >
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            We always store the period explicitly, so {form.salary_currency} {form.min_salary ?? "300"} means{" "}
            {form.salary_currency} {form.min_salary ?? "300"} per {form.salary_period.replace("ly", "")} — never a guess.
          </p>

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save and continue"}
          </Button>
        </section>
      </form>
    </AppShell>
  );
}
