import { z } from "zod";

/** Every server function input is parsed here before it reaches the database. */

const shortText = (max: number) => z.string().trim().max(max);

const stringArray = (maxItems: number, maxLength: number) =>
  z.array(z.string().trim().min(1).max(maxLength)).max(maxItems).default([]);

export const WORK_MODES = ["remote", "hybrid", "onsite"] as const;
export const EMPLOYMENT_TYPES = ["full-time", "part-time", "contract", "temporary", "internship"] as const;
export const EXPERIENCE_LEVELS = ["entry", "junior", "mid", "senior", "lead"] as const;
export const SALARY_PERIODS = ["hourly", "daily", "weekly", "monthly", "yearly"] as const;
export const CURRENCIES = ["USD", "EUR", "GBP", "NGN", "CAD", "AUD", "INR", "ZAR", "KES", "GHS", "PHP", "BRL"] as const;

export const profileInputSchema = z.object({
  full_name: shortText(120).min(1, "Please enter your name"),
  target_titles: stringArray(8, 120).refine((value) => value.length > 0, "Add at least one target job title"),
  employment_types: z.array(z.enum(EMPLOYMENT_TYPES)).max(5).default([]),
  work_modes: z.array(z.enum(WORK_MODES)).max(3).default([]),
  countries: stringArray(10, 80),
  min_salary: z.number().min(0).max(100_000_000).nullable().default(null),
  salary_period: z.enum(SALARY_PERIODS).default("monthly"),
  salary_currency: z.enum(CURRENCIES).default("USD"),
  experience_level: z.enum(EXPERIENCE_LEVELS).nullable().default(null),
  industries: stringArray(10, 80),
  skills: stringArray(40, 60),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;

export const idSchema = z.object({ id: z.uuid() });
export const jobIdSchema = z.object({ jobId: z.uuid() });

export const alertInputSchema = z.object({
  label: shortText(120).min(1),
  query: shortText(200).nullable().default(null),
  remote_only: z.boolean().default(false),
  min_salary: z.number().min(0).max(100_000_000).nullable().default(null),
  salary_period: z.enum(SALARY_PERIODS).default("monthly"),
  countries: stringArray(10, 80),
  employment_types: z.array(z.enum(EMPLOYMENT_TYPES)).max(5).default([]),
});

export const jobSearchSchema = z.object({
  query: shortText(160).default(""),
  location: shortText(120).default(""),
  workMode: z.enum(["any", ...WORK_MODES]).default("any"),
  employmentTypes: z.array(z.enum(EMPLOYMENT_TYPES)).max(5).default([]),
  experienceLevels: z.array(z.enum(EXPERIENCE_LEVELS)).max(5).default([]),
  minSalary: z.number().min(0).max(100_000_000).nullable().default(null),
  salaryPeriod: z.enum(SALARY_PERIODS).default("monthly"),
  postedWithinDays: z.union([z.literal(1), z.literal(3), z.literal(7), z.literal(14), z.literal(30), z.literal(0)]).default(0),
  sources: z.array(z.string().trim().max(40)).max(12).default([]),
  page: z.number().int().min(1).max(100).default(1),
  pageSize: z.number().int().min(6).max(48).default(12),
});

export type JobSearchInput = z.infer<typeof jobSearchSchema>;

export const processResumeSchema = z.object({
  filePath: z.string().trim().min(8).max(300),
  originalFilename: shortText(200),
  mimeType: shortText(120),
  sizeBytes: z.number().int().min(1).max(8 * 1024 * 1024),
});

export const reanalyseSchema = z.object({
  resumeId: z.uuid(),
  targetRole: shortText(120).min(2),
});

export const updateParsedSchema = z.object({
  resumeId: z.uuid(),
  parsed: z.record(z.string(), z.unknown()),
});

export const generateDocSchema = z.object({
  jobId: z.uuid(),
  docType: z.enum(["cover_letter", "tailored_resume"]),
});

export const documentUpdateSchema = z.object({
  id: z.uuid(),
  content: z.string().max(40000),
});

export const applicationInputSchema = z.object({
  jobId: z.uuid().nullable().default(null),
  company_name: shortText(160).min(1),
  job_title: shortText(200).min(1),
  application_url: z.string().trim().max(2048).nullable().default(null),
  status: z
    .enum(["saved", "preparing", "applied", "interview", "assessment", "offer", "rejected", "withdrawn"])
    .default("saved"),
  notes: z.string().trim().max(4000).nullable().default(null),
  next_action: shortText(300).nullable().default(null),
  follow_up_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
});

export const applicationUpdateSchema = applicationInputSchema.partial().extend({ id: z.uuid() });

export const savedJobSchema = z.object({ jobId: z.uuid(), notes: z.string().trim().max(2000).nullable().default(null) });

export const sourceUpdateSchema = z.object({
  slug: z.string().trim().min(2).max(40),
  enabled: z.boolean().optional(),
  boards: stringArray(20, 60).optional(),
});
