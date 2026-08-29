import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildDocument, buildPrepPack } from "./documents-flow.server";
import { documentUpdateSchema, generateDocSchema, idSchema, jobIdSchema } from "./validation";

export const generateDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => generateDocSchema.parse(data))
  .handler(async ({ data, context }) =>
    buildDocument(context.supabase, context.userId, data.jobId, data.docType),
  );

export const prepareApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => jobIdSchema.parse(data))
  .handler(async ({ data, context }) =>
    buildPrepPack(context.supabase, context.userId, data.jobId),
  );

export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("documents")
      .select("id, doc_type, title, content, changes, job_id, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const getJobDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => jobIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: docs } = await context.supabase
      .from("documents")
      .select("id, doc_type, title, content, changes, created_at")
      .eq("user_id", context.userId)
      .eq("job_id", data.jobId)
      .order("created_at", { ascending: false });
    return docs ?? [];
  });

export const updateDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => documentUpdateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("documents")
      .update({ content: data.content })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) {
      console.error("[documents] update failed", error.message);
      throw new Error("We couldn't save your edits. Please try again.");
    }
    return { ok: true };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("documents")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: true };
  });
