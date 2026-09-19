-- ============================================================================
-- 046_read_receipts_rpc.sql — Partner read state for message receipts
--
-- Problem (verified against live schema):
--   conversation_members RLS restricts SELECT to user_id = auth.uid(), so the
--   request-scoped client can read its OWN last_read_at but never the
--   partner's. Message receipts ("two ticks turn blue when read") therefore
--   cannot be derived client-side: the sender must know WHEN the recipient
--   last read the thread. messages.read is legacy and never updated
--   (messages are append-only under 020), so last_read_at (033) is the
--   canonical read state — the same source the unread-count RPC uses.
--
-- Fix: a SECURITY DEFINER RPC mirroring get_conversation_partner (041) that
-- returns last_read_at for the caller AND the partner in a direct
-- conversation the caller belongs to. Caller identity comes from auth.uid()
-- only; a non-member gets no rows.
--
-- Security:
--   * SECURITY DEFINER but membership-gated on auth.uid() (041 precedent).
--   * Direct conversations only; the join on conversations type='direct'
--     keeps group-membership enumeration out of scope.
--   * Execute granted to authenticated only; revoked from public/anon.
-- ============================================================================

create or replace function public.get_conversation_read_state(p_conv_id uuid)
returns table (
  user_id uuid,
  last_read_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select cm.user_id, cm.last_read_at
  from public.conversation_members me
  join public.conversation_members cm
    on cm.conversation_id = me.conversation_id
  join public.conversations c
    on c.id = me.conversation_id
   and c.type = 'direct'
  where me.user_id = auth.uid()
    and me.conversation_id = p_conv_id
$$;

revoke all on function public.get_conversation_read_state(uuid) from public;
revoke all on function public.get_conversation_read_state(uuid) from anon;
grant execute on function public.get_conversation_read_state(uuid) to authenticated;
