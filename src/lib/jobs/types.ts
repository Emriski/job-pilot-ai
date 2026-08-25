export type SourceSlug =
  | "remoteok"
  | "weworkremotely"
  | "remotejobs"
  | "arbeitnow"
  | "himalayas"
  | "greenhouse"
  | "ashby"
  | "lever";

export const SOURCE_LABELS: Record<string, string> = {
  remoteok: "Remote OK",
  weworkremotely: "We Work Remotely",
  remotejobs: "RemoteJobs.org",
  arbeitnow: "Arbeitnow",
  himalayas: "Himalayas",
  greenhouse: "Greenhouse",
  ashby: "Ashby",
  lever: "Lever",
  linkedin: "LinkedIn",
  indeed: "Indeed",
};

export type NormalizedJob = {
  source: string;
  source_job_id: string;
  dedupe_key: string;
  title: string;
  company_name: string;
  company_logo: string | null;
  location: string | null;
  country: string | null;
  remote: boolean;
  remote_type: string | null;
  employment_type: string | null;
  experience_level: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  description: string | null;
  requirements: string | null;
  skills: string[];
  posted_at: string | null;
  application_url: string;
  source_url: string | null;
  company_url: string | null;
};

export type JobRow = NormalizedJob & {
  id: string;
  expired: boolean;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
};
