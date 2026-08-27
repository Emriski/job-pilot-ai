import { z } from "zod";

/** Community + identity inputs. Everything is trimmed, length-capped and typed. */

export const COMMUNITY_CATEGORIES = [
  "Jobs & Opportunities",
  "CV & Resume Help",
  "Interview Help",
  "Career Advice",
  "Remote Work",
  "Skills & Learning",
  "Salary & Compensation",
  "Success Stories",
] as const;

export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number];

export const RESERVED_NICKNAMES = [
  "admin",
  "administrator",
  "moderator",
  "mod",
  "support",
  "official",
  "jobepilotai",
  "jobepilot",
  "system",
  "security",
  "root",
  "staff",
  "help",
  "team",
];

export const NICKNAME_RULES = "3–30 characters. Letters, numbers and underscores only.";

/** Strips a leading @ and lowercases — the same rule the database uses. */
export function normalizeNickname(input: string): string {
  return input.trim().replace(/^@+/, "").toLowerCase();
}

export type NicknameProblem = "empty" | "length" | "charset" | "reserved" | null;

export function validateNickname(input: string): NicknameProblem {
  const value = normalizeNickname(input);
  if (!value) return "empty";
  if (value.length < 3 || value.length > 30) return "length";
  if (!/^[a-z0-9_]+$/.test(value)) return "charset";
  if (RESERVED_NICKNAMES.includes(value)) return "reserved";
  return null;
}

export function nicknameProblemMessage(problem: NicknameProblem): string | null {
  switch (problem) {
    case "empty":
      return "Please enter a nickname.";
    case "length":
      return "Nicknames must be between 3 and 30 characters.";
    case "charset":
      return "Use letters, numbers and underscores only.";
    case "reserved":
      return "That nickname is reserved. Please choose another.";
    default:
      return null;
  }
}

export const nicknameSchema = z.object({ nickname: z.string().trim().min(1).max(40) });

export const communityProfileSchema = z.object({
  headline: z.string().trim().max(160).nullable().default(null),
  career_interests: z.array(z.string().trim().min(1).max(60)).max(12).default([]),
  location: z.string().trim().max(120).nullable().default(null),
  show_location: z.boolean().default(false),
  public_profile: z.boolean().default(true),
});

export const avatarSchema = z.object({ path: z.string().trim().min(4).max(300) });

export const postInputSchema = z.object({
  category: z.enum(COMMUNITY_CATEGORIES),
  title: z.string().trim().min(4).max(160),
  body: z.string().trim().min(4).max(6000),
  link_url: z.string().trim().max(2048).nullable().default(null),
  shared_job_id: z.uuid().nullable().default(null),
});

export const postUpdateSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(4).max(160),
  body: z.string().trim().min(4).max(6000),
});

export const commentInputSchema = z.object({
  postId: z.uuid(),
  parentId: z.uuid().nullable().default(null),
  body: z.string().trim().min(1).max(3000),
});

export const feedQuerySchema = z.object({
  category: z.enum(["all", ...COMMUNITY_CATEGORIES]).default("all"),
  search: z.string().trim().max(120).default(""),
  page: z.number().int().min(1).max(50).default(1),
});

export const REPORT_REASONS = [
  "Spam",
  "Scam or fraud",
  "Harassment",
  "Misleading job posting",
  "Adult or offensive content",
  "Other",
] as const;

export const reportSchema = z.object({
  target_type: z.enum(["post", "comment", "user", "job"]),
  target_id: z.uuid(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1000).nullable().default(null),
});

export const targetUserSchema = z.object({ userId: z.uuid() });

export const messageSchema = z.object({
  recipientId: z.uuid(),
  body: z.string().trim().min(1).max(4000),
});

export const conversationSchema = z.object({ conversationId: z.uuid() });

export const careerProfileSchema = z.object({
  id: z.uuid().nullable().default(null),
  name: z.string().trim().min(2).max(80),
  target_titles: z.array(z.string().trim().min(1).max(120)).max(8).default([]),
  skills: z.array(z.string().trim().min(1).max(60)).max(40).default([]),
  employment_types: z.array(z.string().trim().max(40)).max(5).default([]),
  work_modes: z.array(z.string().trim().max(20)).max(3).default([]),
  countries: z.array(z.string().trim().max(80)).max(10).default([]),
  min_salary: z.number().min(0).max(100_000_000).nullable().default(null),
  salary_period: z.string().trim().max(20).default("monthly"),
  resume_id: z.uuid().nullable().default(null),
  is_default: z.boolean().default(false),
});

export const resumeLabelSchema = z.object({
  resumeId: z.uuid(),
  label: z.string().trim().min(1).max(80),
  is_master: z.boolean().default(false),
});

export const applicationIdSchema = z.object({ applicationId: z.uuid() });

export const mockAnswerSchema = z.object({
  applicationId: z.uuid(),
  question: z.string().trim().min(4).max(600),
  answer: z.string().trim().min(4).max(4000),
});
