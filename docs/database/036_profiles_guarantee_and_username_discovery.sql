-- ============================================================================
-- 036_profiles_guarantee_and_username_discovery.sql
--
-- Purpose
-- -------
-- Repairs the systemic root cause behind the reported V4 failures:
--   * "Could not join a community"           (community_members.user_id -> profiles FK)
--   * "Messaging returned user not found"    (no profile row / exact-case lookup)
--   * "Messaging crashed when sending"       (conversation_members/messages FK to profiles)
--   * username search failures               (case-sensitive exact match, no search index)
--
-- Root cause: public.profiles rows are created lazily on the auth callback and
-- the insert silently fails / is skipped in several paths. Every social table
-- (community_members, conversation_members, messages, posts) now foreign-keys
-- to public.profiles(id), so an authenticated user without a profile row cannot
-- join a community or send a message (FK 23503). The live DB currently has 6
-- authenticated users with no profile row.
--
-- This migration:
--   1. Backfills a REAL profile row for every existing auth user lacking one
--      (derived from their own metadata/email; unique, collision-safe).
--   2. Adds public.ensure_profile() — a SECURITY DEFINER, search_path-pinned RPC
--      that idempotently creates the CALLER's own profile row and returns it.
--      It takes no parameters and only ever writes auth.uid()'s own row.
--   3. Re-asserts the owner-membership trigger handle_new_community
--      (present in the live DB, but dropped from the migration tree in commit
--      3920fd4) with a pinned search_path and ON CONFLICT safety.
--   4. Makes usernames canonical (lowercase) and adds the indexes the search /
--      recipient-resolution paths actually need:
--         - unique lower(username)         (case-insensitive uniqueness)
--         - btree lower(username) pattern  (prefix search)
--         - pg_trgm GIN lower(username)    (contains search)
--         - pg_trgm GIN lower(display_name)(contains search)
--
-- Security review
--   * ensure_profile(): SECURITY DEFINER, no args, writes ONLY the caller's row,
--     search_path pinned, EXECUTE revoked from public/anon, granted to
--     authenticated. It never accepts an identity from the client.
--   * handle_new_community(): SECURITY DEFINER, writes only the row for the
--     community creator, search_path pinned.
--   * No table is made publicly writable; no RLS policy is weakened.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Canonicalize usernames to lowercase (idempotent; aborts safely on any
--    pre-existing case-duplicate rather than failing the migration).
-- ---------------------------------------------------------------------------
do $$
begin
  update public.profiles
     set username = lower(username)
   where username <> lower(username);
exception
  when unique_violation then
    raise notice 'mixed-case username normalization skipped: case-insensitive duplicates exist';
end $$;

-- ---------------------------------------------------------------------------
-- 2. Backfill profiles for existing auth users that lack one.
--    Derived from the user's OWN metadata / email. Collision-safe.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  base text;
  candidate text;
  n int;
begin
  for r in
    select u.id, u.email, u.raw_user_meta_data as meta
      from auth.users u
     where not exists (select 1 from public.profiles p where p.id = u.id)
     order by u.created_at
  loop
    base := lower(coalesce(
      nullif(r.meta->>'username', ''),
      nullif(r.meta->>'user_name', ''),
      nullif(split_part(coalesce(r.email, ''), '@', 1), ''),
      'user'
    ));
    base := regexp_replace(base, '[^a-z0-9_]', '_', 'g');
    base := trim(both '_' from base);
    if length(base) < 3 then base := 'user'; end if;
    base := left(base, 24);

    candidate := base;
    n := 0;
    while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
      n := n + 1;
      candidate := left(base, 24) || '_' || n::text;
      if n > 100 then
        candidate := 'user_' || substr(replace(r.id::text, '-', ''), 1, 8);
        exit;
      end if;
    end loop;

    insert into public.profiles (
      id, username, display_name, avatar_url, terms_version, terms_accepted_at
    ) values (
      r.id,
      candidate,
      coalesce(
        nullif(r.meta->>'display_name', ''),
        nullif(r.meta->>'full_name', ''),
        nullif(r.meta->>'name', ''),
        candidate
      ),
      coalesce(nullif(r.meta->>'avatar_url', ''), nullif(r.meta->>'picture', '')),
      nullif(r.meta->>'terms_version', ''),
      case
        when (r.meta->>'terms_accepted_at') ~ '^\d{4}-\d{2}-\d{2}'
          then (r.meta->>'terms_accepted_at')::timestamptz
        else null
      end
    )
    on conflict (id) do nothing;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. ensure_profile(): idempotent, self-only profile creation RPC.
-- ---------------------------------------------------------------------------
create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  meta jsonb;
  email_addr text;
  base text;
  candidate text;
  n int := 0;
  row_out public.profiles;
begin
  if uid is null then
    raise exception 'ensure_profile: not authenticated' using errcode = '28000';
  end if;

  select * into row_out from public.profiles where id = uid;
  if found then
    return row_out;
  end if;

  select u.raw_user_meta_data, u.email into meta, email_addr
    from auth.users u where u.id = uid;

  base := lower(coalesce(
    nullif(meta->>'username', ''),
    nullif(meta->>'user_name', ''),
    nullif(split_part(coalesce(email_addr, ''), '@', 1), ''),
    'user'
  ));
  base := regexp_replace(base, '[^a-z0-9_]', '_', 'g');
  base := trim(both '_' from base);
  if length(base) < 3 then base := 'user'; end if;
  base := left(base, 24);

  candidate := base;
  while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
    n := n + 1;
    candidate := left(base, 24) || '_' || n::text;
    if n > 100 then
      candidate := 'user_' || substr(replace(uid::text, '-', ''), 1, 8);
      exit;
    end if;
  end loop;

  insert into public.profiles (
    id, username, display_name, avatar_url, terms_version, terms_accepted_at
  ) values (
    uid,
    candidate,
    coalesce(
      nullif(meta->>'display_name', ''),
      nullif(meta->>'full_name', ''),
      nullif(meta->>'name', ''),
      candidate
    ),
    coalesce(nullif(meta->>'avatar_url', ''), nullif(meta->>'picture', '')),
    nullif(meta->>'terms_version', ''),
    case
      when (meta->>'terms_accepted_at') ~ '^\d{4}-\d{2}-\d{2}'
        then (meta->>'terms_accepted_at')::timestamptz
      else null
    end
  )
  on conflict (id) do nothing
  returning * into row_out;

  if row_out.id is null then
    select * into row_out from public.profiles where id = uid;
  end if;
  return row_out;
end $$;

revoke all on function public.ensure_profile() from public;
revoke all on function public.ensure_profile() from anon;
grant execute on function public.ensure_profile() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. handle_new_community(): owner membership on community create.
--    (Present live since the original M3 migration; recreate idempotently with
--    a pinned search_path and conflict safety so fresh environments match.)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_community()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.community_members (community_id, user_id, role)
  values (new.id, new.creator_id, 'admin')
  on conflict (community_id, user_id) do update set role = 'admin';
  return new;
end $$;

drop trigger if exists on_community_created on public.communities;
create trigger on_community_created
  after insert on public.communities
  for each row execute function public.handle_new_community();

-- ---------------------------------------------------------------------------
-- 5. Username discovery indexes.
-- ---------------------------------------------------------------------------
create unique index if not exists uq_profiles_lower_username
  on public.profiles (lower(username));

create index if not exists idx_profiles_lower_username_prefix
  on public.profiles (lower(username) text_pattern_ops);

create extension if not exists pg_trgm;

create index if not exists idx_profiles_username_trgm
  on public.profiles using gin (lower(username) gin_trgm_ops);

create index if not exists idx_profiles_display_name_trgm
  on public.profiles using gin (lower(display_name) gin_trgm_ops);

-- ============================================================================
-- End 036.
-- ============================================================================
