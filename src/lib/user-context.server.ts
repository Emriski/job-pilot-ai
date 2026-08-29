import type { SupabaseClient } from "@supabase/supabase-js";

import type { MatchProfile } from "./matching";
import type { ParsedResume } from "./resume-analysis.server";

export type ProfileRow = {
  id: string;
  full_name: string | null;
  onboarded: boolean;
  target_titles: string[];
  employment_types: string[];
  work_modes: string[];
  countries: string[];
  min_salary: number | null;
  salary_period: string;
  salary_currency: string;
  experience_level: string | null;
  industries: string[];
  skills: string[];
};

export type ActiveResume = {
  id: string;
  raw_text: string | null;
  parsed: ParsedResume | null;
  status: string;
  original_filename: string | null;
  created_at: string;
};

export async function loadProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileRow | null> {
  const { data } = await supabase.from("profiles").select("id, full_name, onboarded, target_titles, employment_types, work_modes, countries, min_salary, salary_period, salary_currency, experience_level, industries, skills").eq("id", userId).maybeSingle();
  return (data as ProfileRow | null) ?? null;
}

export async function loadActiveResume(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActiveResume | null> {
  const { data } = await supabase
    .from("resumes")
    .select("id, raw_text, parsed, status, original_filename, created_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ActiveResume | null) ?? null;
}

export function buildMatchProfile(
  profile: ProfileRow | null,
  resume: ActiveResume | null,
): MatchProfile {
  const parsed = resume?.parsed ?? null;
  const resumeSkills = parsed?.skills ?? [];
  return {
    targetTitles: profile?.target_titles ?? [],
    skills: [...new Set([...(profile?.skills ?? []), ...resumeSkills])],
    experienceLevel: profile?.experience_level ?? null,
    workModes: profile?.work_modes ?? [],
    countries: profile?.countries ?? [],
    employmentTypes: profile?.employment_types ?? [],
    minSalary: profile?.min_salary ?? null,
    salaryPeriod: profile?.salary_period ?? "monthly",
    resumeText: resume?.raw_text ?? "",
    resumeTitles: parsed?.job_titles ?? [],
    yearsExperience: parsed?.total_years_experience ?? null,
  };
}

export async function isAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return data === true;
}
