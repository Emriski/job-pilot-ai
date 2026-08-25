
create type public.app_role as enum ('admin','user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  onboarded boolean not null default false,
  target_titles text[] not null default '{}',
  employment_types text[] not null default '{}',
  work_modes text[] not null default '{}',
  countries text[] not null default '{}',
  min_salary numeric,
  salary_period text not null default 'monthly',
  salary_currency text not null default 'USD',
  experience_level text,
  industries text[] not null default '{}',
  skills text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile" on public.profiles for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.update_updated_at_column();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_path text not null,
  original_filename text,
  mime_type text,
  size_bytes integer,
  status text not null default 'processing',
  error_message text,
  raw_text text,
  parsed jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.resumes to authenticated;
grant all on public.resumes to service_role;
alter table public.resumes enable row level security;
create policy "own resumes" on public.resumes for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger trg_resumes_updated before update on public.resumes for each row execute function public.update_updated_at_column();
create index on public.resumes (user_id, created_at desc);

create table public.resume_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_id uuid not null references public.resumes(id) on delete cascade,
  target_role text not null,
  overall_score integer not null,
  verdict text,
  summary text,
  category_scores jsonb not null default '{}',
  strengths jsonb not null default '[]',
  weaknesses jsonb not null default '[]',
  improvements jsonb not null default '[]',
  ats jsonb not null default '{}',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.resume_analyses to authenticated;
grant all on public.resume_analyses to service_role;
alter table public.resume_analyses enable row level security;
create policy "own analyses" on public.resume_analyses for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.resume_analyses (user_id, created_at desc);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_job_id text not null,
  dedupe_key text not null unique,
  title text not null,
  company_name text not null,
  company_logo text,
  location text,
  country text,
  remote boolean not null default false,
  remote_type text,
  employment_type text,
  experience_level text,
  salary_min numeric,
  salary_max numeric,
  salary_currency text,
  salary_period text,
  description text,
  requirements text,
  skills text[] not null default '{}',
  posted_at timestamptz,
  application_url text not null,
  source_url text,
  company_url text,
  expired boolean not null default false,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.jobs to anon, authenticated;
grant all on public.jobs to service_role;
alter table public.jobs enable row level security;
create policy "jobs are public" on public.jobs for select to anon, authenticated using (true);
create trigger trg_jobs_updated before update on public.jobs for each row execute function public.update_updated_at_column();
create index on public.jobs (posted_at desc);
create index on public.jobs (source);

create table public.job_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  score integer not null,
  breakdown jsonb not null default '{}',
  reasons jsonb not null default '[]',
  gaps jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (user_id, job_id)
);
grant select, insert, update, delete on public.job_matches to authenticated;
grant all on public.job_matches to service_role;
alter table public.job_matches enable row level security;
create policy "own matches" on public.job_matches for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.saved_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, job_id)
);
grant select, insert, update, delete on public.saved_jobs to authenticated;
grant all on public.saved_jobs to service_role;
alter table public.saved_jobs enable row level security;
create policy "own saved" on public.saved_jobs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  company_name text not null,
  job_title text not null,
  application_url text,
  status text not null default 'saved',
  notes text,
  next_action text,
  follow_up_date date,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.applications to authenticated;
grant all on public.applications to service_role;
alter table public.applications enable row level security;
create policy "own applications" on public.applications for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger trg_applications_updated before update on public.applications for each row execute function public.update_updated_at_column();

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  doc_type text not null,
  title text,
  content text not null,
  changes jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.documents to authenticated;
grant all on public.documents to service_role;
alter table public.documents enable row level security;
create policy "own documents" on public.documents for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger trg_documents_updated before update on public.documents for each row execute function public.update_updated_at_column();

create table public.job_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  query text,
  remote_only boolean not null default false,
  min_salary numeric,
  salary_period text default 'monthly',
  countries text[] not null default '{}',
  employment_types text[] not null default '{}',
  active boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.job_alerts to authenticated;
grant all on public.job_alerts to service_role;
alter table public.job_alerts enable row level security;
create policy "own alerts" on public.job_alerts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.job_sources (
  slug text primary key,
  name text not null,
  status text not null default 'active',
  enabled boolean not null default true,
  notes text,
  config jsonb not null default '{}',
  job_count integer not null default 0,
  last_sync_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);
grant select on public.job_sources to anon, authenticated;
grant all on public.job_sources to service_role;
alter table public.job_sources enable row level security;
create policy "sources readable" on public.job_sources for select to anon, authenticated using (true);
create policy "admins manage sources" on public.job_sources for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.job_source_runs (
  id uuid primary key default gen_random_uuid(),
  source_slug text not null references public.job_sources(slug) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  fetched integer not null default 0,
  upserted integer not null default 0,
  error text
);
grant select on public.job_source_runs to authenticated;
grant all on public.job_source_runs to service_role;
alter table public.job_source_runs enable row level security;
create policy "admins read runs" on public.job_source_runs for select to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);
grant select on public.rate_limits to authenticated;
grant all on public.rate_limits to service_role;
alter table public.rate_limits enable row level security;
create policy "own rate limits" on public.rate_limits for select to authenticated using (auth.uid() = user_id);
create index on public.rate_limits (user_id, action, created_at desc);

insert into public.job_sources (slug, name, status, enabled, notes) values
 ('remoteok','Remote OK','active',true,'Public JSON feed'),
 ('weworkremotely','We Work Remotely','active',true,'Public RSS feeds'),
 ('remotejobs','RemoteJobs.org','active',true,'Public API feed'),
 ('arbeitnow','Arbeitnow','active',true,'Public job board API'),
 ('himalayas','Himalayas','active',true,'Public jobs API'),
 ('greenhouse','Greenhouse','active',true,'Public job boards for configured companies'),
 ('ashby','Ashby','active',true,'Public job postings for configured companies'),
 ('lever','Lever','active',true,'Public postings API for configured companies'),
 ('linkedin','LinkedIn','requires_configuration',false,'Requires official partner API access. Scraping is not permitted.'),
 ('indeed','Indeed','requires_configuration',false,'Requires official publisher API access. Scraping is not permitted.');

create policy "users read own resume files" on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users upload own resume files" on storage.objects for insert to authenticated
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete own resume files" on storage.objects for delete to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
