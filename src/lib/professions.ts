/**
 * Illustrative examples only. JobePilotAI supports ANY legitimate job title,
 * profession, skill or industry — nothing here is a default or a restriction.
 */
export const PROFESSION_EXAMPLES = [
  "Software Engineer",
  "Web Developer",
  "Data Analyst",
  "Accountant",
  "Sales Representative",
  "Virtual Assistant",
  "Graphic Designer",
  "Teacher",
  "Nurse",
  "Mechanical Engineer",
  "Marketing Specialist",
  "Project Manager",
  "HR Specialist",
  "Content Writer",
  "UI/UX Designer",
  "Cybersecurity Analyst",
  "Administrative Assistant",
  "Customer Support Representative",
] as const;

/** A rotating example so no single profession looks like the default. */
export function exampleRole(seed = Date.now()): string {
  const index = Math.abs(Math.floor(seed / 60000)) % PROFESSION_EXAMPLES.length;
  return PROFESSION_EXAMPLES[index] ?? "Software Engineer";
}

/** A few varied examples, e.g. for hint text or quick-pick chips. */
export function exampleRoles(count = 4, seed = Date.now()): string[] {
  const start = Math.abs(Math.floor(seed / 60000)) % PROFESSION_EXAMPLES.length;
  return Array.from({ length: Math.min(count, PROFESSION_EXAMPLES.length) }, (_, i) => {
    return PROFESSION_EXAMPLES[(start + i * 3) % PROFESSION_EXAMPLES.length] as string;
  });
}
