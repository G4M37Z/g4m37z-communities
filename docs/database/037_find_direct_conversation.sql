-- ============================================================================
-- 037_find_direct_conversation.sql
--
-- Reuse detection for direct messages used to require the service-role client,
-- because conversation_members SELECT is RLS-scoped to user_id = auth.uid() and
-- the counterpart's membership row is therefore invisible to the request-bound
-- client. createAdminClient() throws when SUPABASE_SERVICE_ROLE_KEY is unset,
-- which turned "start a conversation" into an unhandled server error.
--
-- This RPC returns the id of an existing direct conversation that contains BOTH
-- the caller and the other user, using SECURITY DEFINER so it can see the
-- counterpart's row — but only ever a thread the caller is already a member of.
-- No service-role key is needed anywhere in the messaging path.
--
-- Security review:
--   * SECURITY DEFINER, search_path pinned to public, pg_temp.
--   * Caller identity comes from auth.uid(), never a parameter.
--   * The caller-membership EXISTS makes a non-member caller resolve to NULL
--     (it can never probe arbitrary conversation ids).
--   * EXECUTE revoked from PUBLIC/anon; granted to authenticated only.
-- ============================================================================

create or replace function public.find_direct_conversation(p_other uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id
  from public.conversations c
  where c.type = 'direct'
    and exists (
      select 1
      from public.conversation_members m_self
      where m_self.conversation_id = c.id
        and m_self.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.conversation_members m_other
      where m_other.conversation_id = c.id
        and m_other.user_id = p_other
    )
  order by c.created_at desc nulls last
  limit 1
$$;

revoke all on function public.find_direct_conversation(uuid) from public;
revoke all on function public.find_direct_conversation(uuid) from anon;
grant execute on function public.find_direct_conversation(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- list_message_partners()
-- People the caller already has a direct conversation with, for the "new
-- message" picker. conversation_members SELECT is RLS-scoped to the caller, so
-- the counterpart rows are invisible to the request-bound client; this returns
-- only partners of the caller's own direct threads.
-- ----------------------------------------------------------------------------

create or replace function public.list_message_partners()
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select distinct p.id, p.username, p.display_name, p.avatar_url
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
