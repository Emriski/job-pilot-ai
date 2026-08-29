export const SALARY_PERIOD_LABEL: Record<string, string> = {
  hourly: "hour",
  daily: "day",
  weekly: "week",
  monthly: "month",
  yearly: "year",
};

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString("en-US")}`;
  }
}

/** Never invents a figure — undisclosed salaries say so explicitly. */
export function formatSalary(job: {
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  salary_period?: string | null;
}): string {
  const min = job.salary_min ?? null;
  const max = job.salary_max ?? null;
  if (!min && !max) return "Salary not disclosed";
  const currency = job.salary_currency || "USD";
  const period = job.salary_period
    ? ` / ${SALARY_PERIOD_LABEL[job.salary_period] ?? job.salary_period}`
    : "";
  if (min && max && min !== max)
    return `${money(min, currency)} – ${money(max, currency)}${period}`;
  return `${money((min ?? max) as number, currency)}${period}`;
}

/** Never fabricates a date. */
export function formatPosted(value?: string | null): string {
  if (!value) return "Date not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not provided";
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  if (days < 60) return "1 month ago";
  return `${Math.floor(days / 30)} months ago`;
}

export function formatLocation(job: {
  location?: string | null;
  remote?: boolean;
  remote_type?: string | null;
}): string {
  if (job.location) return job.location;
  if (job.remote) return "Remote";
  return "Location not provided";
}

export function remoteBadge(job: { remote?: boolean; remote_type?: string | null }): string | null {
  if (job.remote_type === "hybrid") return "Hybrid";
  if (job.remote_type === "onsite") return "Onsite";
  if (job.remote) return "Remote";
  return null;
}

export function titleCase(value?: string | null): string {
  if (!value) return "";
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export const APPLICATION_STATUSES = [
  "saved",
  "preparing",
  "applied",
  "interview",
  "assessment",
  "offer",
  "rejected",
  "withdrawn",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
