import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { safeExternalUrl } from "./security";
import { applicationInputSchema, applicationUpdateSchema, idSchema } from "./validation";

export const listApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("applications")
      .select("*")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    return data ?? [];
  });

export const createApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => applicationInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const payload = {
      user_id: context.userId,
      job_id: data.jobId,
      company_name: data.company_name,
      job_title: data.job_title,
      application_url: safeExternalUrl(data.application_url),
      status: data.status,
      notes: data.notes,
      next_action: data.next_action,
      follow_up_date: data.follow_up_date,
      applied_at: data.status === "applied" ? new Date().toISOString() : null,
    };
    const { data: row, error } = await context.supabase
      .from("applications")
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      console.error("[applications] create failed", error.message);
      throw new Error("We couldn't add that application. Please try again.");
    }
    return row;
  });

export const updateApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => applicationUpdateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { id, jobId, application_url, ...rest } = data;
    const patch: Record<string, unknown> = { ...rest };
    if (application_url !== undefined) patch["application_url"] = safeExternalUrl(application_url);
    if (rest.status === "applied") patch["applied_at"] = new Date().toISOString();

    const { error } = await context.supabase
      .from("applications")
      .update(patch as never)
      .eq("id", id)
      .eq("user_id", context.userId);
    if (error) {
      console.error("[applications] update failed", error.message);
      throw new Error("We couldn't update that application. Please try again.");
    }
    return { ok: true };
  });

export const deleteApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("applications")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const draftFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { buildFollowUpEmail } = await import("./followup.server");
    return buildFollowUpEmail(context.supabase, context.userId, data.id);
  });

export const markFollowedUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("applications")
      .update({ last_followed_up_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) {
      console.error("[applications] follow-up mark failed", error.message);
      throw new Error("We couldn't record that follow-up. Please try again.");
    }
    return { ok: true };
  });
