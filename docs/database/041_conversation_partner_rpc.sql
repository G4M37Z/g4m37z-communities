-- ============================================================================
-- 041_conversation_partner_rpc.sql — Fix sender's-profile-instead-of-recipient
--
-- Root cause (verified against live schema):
--   conversation_members has RLS: SELECT policy.user_id = auth.uid(). A request-
--   scoped client can therefore only ever see ITS OWN membership rows. The old
--   messages list query fetched conversation_members from the client, assumed
--   the "other" row was present, and (after the fallback relaxation) resolved
--   members[0] — which is the CALLER, not the counterpart. Result: the messages
--   list showed the signed-in user's own profile as the conversation partner.
--
-- Fix: a SECURITY DEFINER RPC, mirroring find_direct_conversation (037), that
-- returns the OTHER member profile for a direct conversation the caller belongs
-- to. Caller identity comes from auth.uid() only; a non-member gets no row.
-- ============================================================================

create or replace function public.get_conversation_partner(p_conv_id uuid)
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
  select p.id, p.username, p.display_name, p.avatar_url
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

-- ----------------------------------------------------------------------------
-- Drop the insecure ensure_conversation_membership RPC (introduced in 040).
-- It let ANY authenticated user insert a membership row for ANY conversation
-- (by guessing a uuid), defeating the invitee-only membership model. The send
-- path does not need it: create_direct_conversation (038) already creates both
-- member rows, and RLS grants messages INSERT only to actual members.
-- ----------------------------------------------------------------------------
drop function if exists public.ensure_conversation_membership(uuid);