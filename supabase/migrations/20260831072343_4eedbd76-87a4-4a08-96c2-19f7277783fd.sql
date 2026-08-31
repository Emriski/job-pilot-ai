-- Harden SECURITY DEFINER surface callable by signed-in users.

-- 1) claim_nickname no longer needs elevated rights: uniqueness is enforced by
--    the unique index on profiles.normalized_nickname, and the update is
--    already scoped to the caller's own row via RLS.
create or replace function public.claim_nickname(_nickname text)
returns text
language plpgsql
security invoker
set search_path = public
as $$
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
end
$$;

-- 2) has_role must stay SECURITY DEFINER (RLS policies rely on it reading
--    user_roles), but signed-in callers may only ask about themselves so it
--    cannot be used to probe other accounts' privileges.
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and _user_id is distinct from auth.uid() then
    return false;
  end if;
  return exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  );
end
$$;