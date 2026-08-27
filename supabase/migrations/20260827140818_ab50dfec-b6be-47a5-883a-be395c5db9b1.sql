-- ============ PROFILE IDENTITY ============
alter table public.profiles
  add column if not exists nickname text,
  add column if not exists normalized_nickname text,
  add column if not exists avatar_path text,
  add column if not exists headline text,
  add column if not exists career_interests text[] not null default '{}',
  add column if not exists public_profile boolean not null default true,
  add column if not exists show_location boolean not null default false,
  add column if not exists location text,
  add column if not exists last_visit_at timestamptz,
  add column if not exists previous_visit_at timestamptz;

create unique index if not exists profiles_normalized_nickname_key
  on public.profiles (normalized_nickname) where normalized_nickname is not null;

create or replace function public.normalize_nickname(_input text)
returns text language sql immutable set search_path = public as $$
  select nullif(lower(regexp_replace(coalesce(_input,''), '^@+', '')), '')
$$;

create or replace function public.profiles_set_normalized_nickname()
returns trigger language plpgsql set search_path = public as $$
begin
  new.normalized_nickname := public.normalize_nickname(new.nickname);
  return new;
end $$;

drop trigger if exists trg_profiles_nickname on public.profiles;
create trigger trg_profiles_nickname before insert or update of nickname on public.profiles
  for each row execute function public.profiles_set_normalized_nickname();

drop policy if exists "public identity readable" on public.profiles;
create policy "public identity readable" on public.profiles
  for select to authenticated using (public_profile = true and nickname is not null);

-- ============ CAREER PROFILES ============
create table if not exists public.career_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_titles text[] not null default '{}',
  skills text[] not null default '{}',
  employment_types text[] not null default '{}',
  work_modes text[] not null default '{}',
  countries text[] not null default '{}',
  min_salary numeric,
  salary_period text not null default 'monthly',
  resume_id uuid references public.resumes(id) on delete set null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.career_profiles to authenticated;
grant all on public.career_profiles to service_role;
alter table public.career_profiles enable row level security;
drop policy if exists "own career profiles" on public.career_profiles;
create policy "own career profiles" on public.career_profiles for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop trigger if exists trg_career_profiles_updated on public.career_profiles;
create trigger trg_career_profiles_updated before update on public.career_profiles
  for each row execute function public.update_updated_at_column();

-- ============ RESUME VERSIONS ============
alter table public.resumes
  add column if not exists label text,
  add column if not exists is_master boolean not null default false;

-- ============ APPLICATIONS ============
alter table public.applications
  add column if not exists interview_at timestamptz,
  add column if not exists strength_score integer,
  add column if not exists strength_details jsonb not null default '{}'::jsonb,
  add column if not exists last_followed_up_at timestamptz;

-- ============ BLOCKS / MUTES / FOLLOWS ============
create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, blocked_user_id)
);
grant select, insert, delete on public.user_blocks to authenticated;
grant all on public.user_blocks to service_role;
alter table public.user_blocks enable row level security;
drop policy if exists "own blocks" on public.user_blocks;
create policy "own blocks" on public.user_blocks for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.user_mutes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  muted_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, muted_user_id)
);
grant select, insert, delete on public.user_mutes to authenticated;
grant all on public.user_mutes to service_role;
alter table public.user_mutes enable row level security;
drop policy if exists "own mutes" on public.user_mutes;
create policy "own mutes" on public.user_mutes for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.user_follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);
grant select, insert, delete on public.user_follows to authenticated;
grant all on public.user_follows to service_role;
alter table public.user_follows enable row level security;
drop policy if exists "follows readable" on public.user_follows;
create policy "follows readable" on public.user_follows for select to authenticated using (true);
drop policy if exists "manage own follows" on public.user_follows;
create policy "manage own follows" on public.user_follows for insert to authenticated with check (auth.uid() = follower_id);
drop policy if exists "remove own follows" on public.user_follows;
create policy "remove own follows" on public.user_follows for delete to authenticated using (auth.uid() = follower_id);

create or replace function public.is_blocked(_a uuid, _b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_blocks
    where (user_id = _a and blocked_user_id = _b) or (user_id = _b and blocked_user_id = _a)
  )
$$;

-- ============ COMMUNITY POSTS ============
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  title text not null,
  body text not null,
  link_url text,
  shared_job_id uuid references public.jobs(id) on delete set null,
  shared_job jsonb,
  unverified_opportunity boolean not null default false,
  status text not null default 'published',
  comment_count integer not null default 0,
  reaction_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.community_posts to authenticated;
grant all on public.community_posts to service_role;
alter table public.community_posts enable row level security;
drop policy if exists "posts readable" on public.community_posts;
create policy "posts readable" on public.community_posts for select to authenticated
  using ((status = 'published' and not public.is_blocked(auth.uid(), user_id)) or auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
drop policy if exists "create own posts" on public.community_posts;
create policy "create own posts" on public.community_posts for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "update own posts" on public.community_posts;
create policy "update own posts" on public.community_posts for update to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'))
  with check (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
drop policy if exists "delete own posts" on public.community_posts;
create policy "delete own posts" on public.community_posts for delete to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
drop trigger if exists trg_posts_updated on public.community_posts;
create trigger trg_posts_updated before update on public.community_posts
  for each row execute function public.update_updated_at_column();

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.community_comments(id) on delete cascade,
  body text not null,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.community_comments to authenticated;
grant all on public.community_comments to service_role;
alter table public.community_comments enable row level security;
drop policy if exists "comments readable" on public.community_comments;
create policy "comments readable" on public.community_comments for select to authenticated
  using ((status = 'published' and not public.is_blocked(auth.uid(), user_id)) or auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
drop policy if exists "create own comments" on public.community_comments;
create policy "create own comments" on public.community_comments for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "update own comments" on public.community_comments;
create policy "update own comments" on public.community_comments for update to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'))
  with check (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
drop policy if exists "delete own comments" on public.community_comments;
create policy "delete own comments" on public.community_comments for delete to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
drop trigger if exists trg_comments_updated on public.community_comments;
create trigger trg_comments_updated before update on public.community_comments
  for each row execute function public.update_updated_at_column();

create table if not exists public.community_reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.community_posts(id) on delete cascade,
  comment_id uuid references public.community_comments(id) on delete cascade,
  kind text not null default 'like',
  created_at timestamptz not null default now(),
  check (num_nonnulls(post_id, comment_id) = 1)
);
create unique index if not exists community_reactions_post_key on public.community_reactions (user_id, post_id) where post_id is not null;
create unique index if not exists community_reactions_comment_key on public.community_reactions (user_id, comment_id) where comment_id is not null;
grant select, insert, delete on public.community_reactions to authenticated;
grant all on public.community_reactions to service_role;
alter table public.community_reactions enable row level security;
drop policy if exists "reactions readable" on public.community_reactions;
create policy "reactions readable" on public.community_reactions for select to authenticated using (true);
drop policy if exists "own reactions" on public.community_reactions;
create policy "own reactions" on public.community_reactions for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "remove own reactions" on public.community_reactions;
create policy "remove own reactions" on public.community_reactions for delete to authenticated using (auth.uid() = user_id);

create or replace function public.community_counts_refresh()
returns trigger language plpgsql security definer set search_path = public as $$
declare _post uuid;
begin
  _post := coalesce(new.post_id, old.post_id);
  if _post is not null then
    update public.community_posts p set
      reaction_count = (select count(*) from public.community_reactions r where r.post_id = p.id),
      comment_count = (select count(*) from public.community_comments c where c.post_id = p.id and c.status = 'published')
    where p.id = _post;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_reaction_counts on public.community_reactions;
create trigger trg_reaction_counts after insert or delete on public.community_reactions
  for each row execute function public.community_counts_refresh();
drop trigger if exists trg_comment_counts on public.community_comments;
create trigger trg_comment_counts after insert or delete or update on public.community_comments
  for each row execute function public.community_counts_refresh();

-- ============ REPORTS / MODERATION ============
create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  reason text not null,
  details text,
  status text not null default 'open',
  resolution text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.community_reports to authenticated;
grant all on public.community_reports to service_role;
alter table public.community_reports enable row level security;
drop policy if exists "own or admin reports" on public.community_reports;
create policy "own or admin reports" on public.community_reports for select to authenticated
  using (auth.uid() = reporter_id or public.has_role(auth.uid(),'admin'));
drop policy if exists "create reports" on public.community_reports;
create policy "create reports" on public.community_reports for insert to authenticated with check (auth.uid() = reporter_id);
drop policy if exists "admins resolve reports" on public.community_reports;
create policy "admins resolve reports" on public.community_reports for update to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  target_type text not null,
  target_id uuid not null,
  notes text,
  created_at timestamptz not null default now()
);
grant select, insert on public.moderation_actions to authenticated;
grant all on public.moderation_actions to service_role;
alter table public.moderation_actions enable row level security;
drop policy if exists "admins read moderation" on public.moderation_actions;
create policy "admins read moderation" on public.moderation_actions for select to authenticated
  using (public.has_role(auth.uid(),'admin'));
drop policy if exists "admins log moderation" on public.moderation_actions;
create policy "admins log moderation" on public.moderation_actions for insert to authenticated
  with check (public.has_role(auth.uid(),'admin') and auth.uid() = moderator_id);

create table if not exists public.user_restrictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  reason text,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.user_restrictions to authenticated;
grant all on public.user_restrictions to service_role;
alter table public.user_restrictions enable row level security;
drop policy if exists "see own restrictions" on public.user_restrictions;
create policy "see own restrictions" on public.user_restrictions for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
drop policy if exists "admins manage restrictions" on public.user_restrictions;
create policy "admins manage restrictions" on public.user_restrictions for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ============ NOTIFICATIONS ============
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  actor_id uuid references auth.users(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
drop policy if exists "own notifications" on public.notifications;
create policy "own notifications" on public.notifications for select to authenticated using (auth.uid() = user_id);
drop policy if exists "update own notifications" on public.notifications;
create policy "update own notifications" on public.notifications for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "delete own notifications" on public.notifications;
create policy "delete own notifications" on public.notifications for delete to authenticated using (auth.uid() = user_id);

create table if not exists public.notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  comments boolean not null default true,
  replies boolean not null default true,
  reactions boolean not null default true,
  follows boolean not null default true,
  mentions boolean not null default true,
  moderation boolean not null default true,
  job_alerts boolean not null default true,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.notification_settings to authenticated;
grant all on public.notification_settings to service_role;
alter table public.notification_settings enable row level security;
drop policy if exists "own notification settings" on public.notification_settings;
create policy "own notification settings" on public.notification_settings for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============ DIRECT MESSAGES ============
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);
grant select, insert, update on public.conversations to authenticated;
grant all on public.conversations to service_role;
alter table public.conversations enable row level security;
drop policy if exists "own conversations" on public.conversations;
create policy "own conversations" on public.conversations for select to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b);
drop policy if exists "start conversation" on public.conversations;
create policy "start conversation" on public.conversations for insert to authenticated
  with check ((auth.uid() = user_a or auth.uid() = user_b) and not public.is_blocked(user_a, user_b));
drop policy if exists "touch conversation" on public.conversations;
create policy "touch conversation" on public.conversations for update to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b) with check (auth.uid() = user_a or auth.uid() = user_b);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
drop policy if exists "conversation messages" on public.messages;
create policy "conversation messages" on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id and (c.user_a = auth.uid() or c.user_b = auth.uid())));
drop policy if exists "send messages" on public.messages;
create policy "send messages" on public.messages for insert to authenticated
  with check (auth.uid() = sender_id and exists (
    select 1 from public.conversations c where c.id = conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
      and not public.is_blocked(c.user_a, c.user_b)));
drop policy if exists "mark read" on public.messages;
create policy "mark read" on public.messages for update to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id and (c.user_a = auth.uid() or c.user_b = auth.uid())))
  with check (exists (select 1 from public.conversations c where c.id = conversation_id and (c.user_a = auth.uid() or c.user_b = auth.uid())));

-- ============ NICKNAME CLAIM (race-safe) ============
create or replace function public.claim_nickname(_nickname text)
returns text language plpgsql security definer set search_path = public as $$
declare _norm text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  _norm := public.normalize_nickname(_nickname);
  if _norm is null or length(_norm) < 3 or length(_norm) > 30 then
    raise exception 'invalid_nickname';
  end if;
  if _norm !~ '^[a-z0-9_]+$' then raise exception 'invalid_nickname'; end if;
  if _norm in ('admin','administrator','moderator','mod','support','official','jobepilotai','jobepilot','system','security','root','staff','help','team') then
    raise exception 'reserved_nickname';
  end if;
  if exists (select 1 from public.profiles where normalized_nickname = _norm and id <> auth.uid()) then
    raise exception 'nickname_taken';
  end if;
  update public.profiles set nickname = regexp_replace(_nickname,'^@+','') where id = auth.uid();
  return _norm;
exception when unique_violation then
  raise exception 'nickname_taken';
end $$;

revoke all on function public.claim_nickname(text) from public;
grant execute on function public.claim_nickname(text) to authenticated;

-- ============ AVATAR STORAGE POLICIES ============
drop policy if exists "avatars readable" on storage.objects;
create policy "avatars readable" on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
drop policy if exists "own avatar upload" on storage.objects;
create policy "own avatar upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own avatar update" on storage.objects;
create policy "own avatar update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own avatar delete" on storage.objects;
create policy "own avatar delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
