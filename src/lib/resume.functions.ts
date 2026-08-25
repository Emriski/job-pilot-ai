import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { processUploadedResume, runAnalysis, createSignedResumeUpload } from "./resume-flow.server";
import { idSchema, processResumeSchema, reanalyseSchema, updateParsedSchema } from "./validation";

export const createResumeUploadTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { extension: string }) => ({ extension: data.extension === "docx" ? "docx" : "pdf" }) as const)
  .handler(async ({ data, context }) => createSignedResumeUpload(context.userId, data.extension));

export const processResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => processResumeSchema.parse(data))
  .handler(async ({ data, context }) => processUploadedResume(context.supabase, context.userId, data));

export const reanalyseResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => reanalyseSchema.parse(data))
  .handler(async ({ data, context }) =>
    runAnalysis(context.supabase, context.userId, data.resumeId, data.targetRole),
  );

export const getResumeDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: resume } = await supabase
      .from("resumes")
      .select("id, original_filename, status, error_message, parsed, created_at, size_bytes")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!resume) return { resume: null, analyses: [] };

    const { data: analyses } = await supabase
      .from("resume_analyses")
      .select("*")
      .eq("user_id", userId)
      .eq("resume_id", resume.id)
      .order("created_at", { ascending: false });

    return { resume, analyses: analyses ?? [] };
  });

export const updateParsedResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateParsedSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("resumes")
      .update({ parsed: data.parsed as never })
      .eq("id", data.resumeId)
      .eq("user_id", context.userId);
    if (error) {
      console.error("[resume] update parsed failed", error.message);
      throw new Error("We couldn't save those changes. Please try again.");
    }
    return { ok: true };
  });

export const deleteResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: resume } = await supabase
      .from("resumes")
      .select("file_path")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (resume?.file_path) await supabase.storage.from("resumes").remove([resume.file_path]);
    await supabase.from("resumes").delete().eq("id", data.id).eq("user_id", userId);
    return { ok: true };
  });
