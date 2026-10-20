-- docs/database/060_partner_verified.sql
-- Verification badge in messaging surfaces (059 follow-up): the partner RPCs
-- return the account identity rendered next to badge-eligible names, so both
-- gain `verified`. Postgres cannot change an OUT-parameter row type in place,
-- so the functions are dropped and recreated with identical bodies
-- (+verified) and identical grants (037/041).

drop function if exists public.get_conversation_partner(uuid);

create or replace function public.get_conversation_partner(p_conv_id uuid)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  verified boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.verified
  from public.conversation_members me
  join public.conversation_members other
    on other.conversation_id = me.conversation_id
   and other.user_id <> me.user_id
  join public.conversations c
    on c.id = me.conversation_id
   and c.type = 'direct'
  join public.profiles p
    on p.id = other.user_id
  where me.user_id = auth.uid()
    and me.conversation_id = p_conv_id
  limit 1
$$;

revoke all on function public.get_conversation_partner(uuid) from public;
revoke all on function public.get_conversation_partner(uuid) from anon;
grant execute on function public.get_conversation_partner(uuid) to authenticated;

drop function if exists public.list_message_partners();

create or replace function public.list_message_partners()
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  verified boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select distinct p.id, p.username, p.display_name, p.avatar_url, p.verified
  from public.conversation_members me
  join public.conversation_members other
    on other.conversation_id = me.conversation_id
   and other.user_id <> me.user_id
  join public.conversations c
    on c.id = me.conversation_id
   and c.type = 'direct'
  join public.profiles p
    on p.id = other.user_id
  where me.user_id = auth.uid()
  order by p.username
  limit 20
$$;

revoke all on function public.list_message_partners() from public;
revoke all on function public.list_message_partners() from anon;
grant execute on function public.list_message_partners() to authenticated;
