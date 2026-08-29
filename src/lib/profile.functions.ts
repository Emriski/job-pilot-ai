import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadActiveResume, loadProfile, isAdmin } from "./user-context.server";
import { profileInputSchema, alertInputSchema, idSchema } from "./validation";

export const getMyContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profile, resume, admin] = await Promise.all([
      loadProfile(supabase, userId),
      loadActiveResume(supabase, userId),
      isAdmin(supabase, userId),
    ]);

    const { data: analysis } = await supabase
      .from("resume_analyses")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      profile,
      resume: resume ? { ...resume, raw_text: null } : null,
      hasResume: Boolean(resume?.raw_text),
      analysis,
      isAdmin: admin,
    };
  });

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => profileInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ ...data, onboarded: true })
      .eq("id", userId);
    if (error) {
      console.error("[profile] save failed", error.message);
      throw new Error("We couldn't save your preferences. Please try again.");
    }
    return { ok: true };
  });

export const listAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("job_alerts")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const createAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => alertInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("job_alerts")
      .insert({ ...data, user_id: context.userId });
    if (error) {
      console.error("[alerts] create failed", error.message);
      throw new Error("We couldn't create that alert. Please try again.");
    }
    return { ok: true };
  });

export const deleteAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("job_alerts")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: true };
  });

/** Removes everything this person has stored, including their uploaded files. */
export const deleteMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: resumes } = await supabase
      .from("resumes")
      .select("file_path")
      .eq("user_id", userId);
    const paths = (resumes ?? []).map((row) => row.file_path).filter(Boolean);
    if (paths.length) await supabase.storage.from("resumes").remove(paths);

    await supabase.from("documents").delete().eq("user_id", userId);
    await supabase.from("applications").delete().eq("user_id", userId);
    await supabase.from("saved_jobs").delete().eq("user_id", userId);
    await supabase.from("job_matches").delete().eq("user_id", userId);
    await supabase.from("job_alerts").delete().eq("user_id", userId);
    await supabase.from("resume_analyses").delete().eq("user_id", userId);
    await supabase.from("resumes").delete().eq("user_id", userId);
    await supabase
      .from("profiles")
      .update({
        onboarded: false,
        full_name: null,
        target_titles: [],
        employment_types: [],
        work_modes: [],
        countries: [],
        industries: [],
        skills: [],
        min_salary: null,
        experience_level: null,
      })
      .eq("id", userId);

    return { ok: true };
  });
