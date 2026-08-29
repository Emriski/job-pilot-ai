import type { SupabaseClient } from "@supabase/supabase-js";

import { enforceRateLimit } from "./rate-limit.server";
import { analyseResume, extractStructuredResume } from "./resume-analysis.server";
import {
  assertUsableText,
  extractResumeText,
  validateUpload,
  ResumeFileError,
} from "./resume-parse.server";
import { displayFilename, safeStorageName } from "./security";
import { loadProfile } from "./user-context.server";

/** Server-generated storage path — the uploaded filename never becomes a path. */
export async function createSignedResumeUpload(userId: string, extension: "pdf" | "docx") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const path = safeStorageName(userId, extension);
  const { data, error } = await supabaseAdmin.storage.from("resumes").createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[resume] signed upload failed", error?.message);
    throw new Error("We couldn't start the upload. Please try again.");
  }
  return { path: data.path, token: data.token };
}

type ProcessArgs = {
  filePath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
};

export async function processUploadedResume(
  supabase: SupabaseClient,
  userId: string,
  args: ProcessArgs,
) {
  await enforceRateLimit(supabase, userId, "resume_upload");

  // The client can only ever act inside its own folder.
  if (!args.filePath.startsWith(`${userId}/`) || !/^[A-Za-z0-9/_.-]+$/.test(args.filePath)) {
    throw new Error("That upload isn't valid. Please try again.");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const download = await supabaseAdmin.storage.from("resumes").download(args.filePath);
  if (download.error || !download.data) {
    console.error("[resume] download failed", download.error?.message);
    throw new Error("We couldn't read the uploaded file. Please try again.");
  }

  const bytes = new Uint8Array(await download.data.arrayBuffer());

  let rawText: string;
  try {
    const kind = validateUpload(bytes, args.mimeType, args.originalFilename);
    rawText = await extractResumeText(bytes, kind);
    assertUsableText(rawText);
  } catch (error) {
    await supabaseAdmin.storage.from("resumes").remove([args.filePath]);
    if (error instanceof ResumeFileError) throw new Error(error.message);
    console.error("[resume] validation failed", error);
    throw new Error("We couldn't safely read this file. Please upload a valid PDF or DOCX.");
  }

  await supabase
    .from("resumes")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("is_active", true);

  const { data: inserted, error: insertError } = await supabase
    .from("resumes")
    .insert({
      user_id: userId,
      file_path: args.filePath,
      original_filename: displayFilename(args.originalFilename),
      mime_type: args.mimeType.slice(0, 120),
      size_bytes: args.sizeBytes,
      status: "extracting",
      raw_text: rawText,
      is_active: true,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    console.error("[resume] insert failed", insertError?.message);
    throw new Error("We couldn't save your resume. Please try again.");
  }

  const resumeId = inserted.id as string;

  let detectedTitle: string | null = null;
  try {
    const parsed = await extractStructuredResume(rawText);
    detectedTitle = parsed.job_titles?.[0] ?? null;
    await supabase
      .from("resumes")
      .update({ parsed, status: "ready" })
      .eq("id", resumeId)
      .eq("user_id", userId);
  } catch (error) {
    console.error("[resume] extraction failed", error);
    await supabase
      .from("resumes")
      .update({ status: "text_only", error_message: "Structured extraction unavailable" })
      .eq("id", resumeId)
      .eq("user_id", userId);
  }

  const profile = await loadProfile(supabase, userId);
  // The target role is always the user's own choice, falling back to the role
  // detected in their resume. No profession is ever hard-coded here.
  const targetRole =
    profile?.target_titles?.[0] ?? detectedTitle ?? "the role this resume is written for";
  const analysis = await runAnalysis(supabase, userId, resumeId, targetRole, rawText);

  return { resumeId, analysisId: analysis.id, targetRole };
}

export async function runAnalysis(
  supabase: SupabaseClient,
  userId: string,
  resumeId: string,
  targetRole: string,
  knownText?: string,
) {
  await enforceRateLimit(supabase, userId, "resume_analysis");

  let text = knownText;
  if (!text) {
    const { data } = await supabase
      .from("resumes")
      .select("raw_text")
      .eq("id", resumeId)
      .eq("user_id", userId)
      .maybeSingle();
    text = (data?.raw_text as string | undefined) ?? "";
  }
  if (!text) throw new Error("We couldn't find the text of that resume. Please upload it again.");

  const analysis = await analyseResume(text, targetRole);

  const { data: saved, error } = await supabase
    .from("resume_analyses")
    .insert({
      user_id: userId,
      resume_id: resumeId,
      target_role: targetRole,
      overall_score: analysis.overall_score,
      verdict: analysis.verdict,
      summary: analysis.summary,
      category_scores: analysis.category_scores,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      improvements: analysis.improvements,
      ats: analysis.ats,
    })
    .select("*")
    .single();

  if (error || !saved) {
    console.error("[resume] analysis save failed", error?.message);
    throw new Error("We couldn't save the analysis. Please try again.");
  }

  return saved;
}
