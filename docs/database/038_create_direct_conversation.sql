-- ============================================================================
-- 038_create_direct_conversation.sql
--
-- Fixes "Start a message" failing under RLS. The old client-side path did
-- three request-scoped writes that both depend on rows that RLS won't let the
-- request-bound client see yet:
--
--   1. INSERT INTO conversations ... RETURNING id — the member-only
--      conversations SELECT policy (an existing membership must match) filters
--      the just-inserted row out of RETURNING, so the clients gets no id and
--      throws "Could not start conversation."
--   2. A single-statement batch inserting BOTH conversation_members rows — the
--      invitee row's WITH CHECK needs EXISTS(inviter.user_id = auth.uid() in
--      the same conversation), but a statement can't see rows it is itself
--      inserting, so the whole statement is rejected (42501).
--   3. On thread reuse the first message was silently dropped (the old code
--      returned the existing thread id without inserting the body).
--
-- This RPC replaces all three steps with one atomic, server-side transaction
-- (SECURITY DEFINER): reuses an existing direct thread when present, otherwise
-- creates the conversation, BOTH member rows and the first message. Returns
-- the conversation id and whether it was reused.
--
-- Security review:
--   * SECURITY DEFINER, search_path pinned to public, pg_temp.
--   * Caller identity comes from auth.uid(), never a parameter.
--   * The recipient can only ever be a real profile row, never the caller
--     (p_other <> auth.uid()), and the caller can only ever be placed into a
--     thread whose membership is created by this same function.
--   * Body length re-validated server-side (1..4000 after trim).
--   * EXECUTE revoked from PUBLIC/anon; granted to authenticated only.
-- ============================================================================

create or replace function public.create_direct_conversation(p_other uuid, p_body text)
returns table (conversation_id uuid, reused boolean)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  conv_id uuid;
  was_reused boolean := false;
  clean_body text := btrim(coalesce(p_body, ''));
begin
  if uid is null then
    raise exception 'create_direct_conversation: not authenticated'
      using errcode = '28000';
  end if;

  if p_other is null or p_other = uid then
    raise exception 'create_direct_conversation: cannot message yourself'
      using errcode = '22023';
  end if;

  if length(clean_body) < 1 or length(clean_body) > 4000 then
    raise exception 'create_direct_conversation: message body out of range'
      using errcode = '22023';
  end if;

  if not exists (select 1 from public.profiles where id = p_other) then
    raise exception 'create_direct_conversation: recipient not found'
      using errcode = 'P0002';
  end if;

  -- Reuse an existing two-member direct thread when one already exists.
  conv_id := public.find_direct_conversation(p_other);
  if conv_id is not null then
    was_reused := true;
  else
    insert into public.conversations (type)
    values ('direct')
    returning id into conv_id;

    insert into public.conversation_members (conversation_id, user_id)
    values (conv_id, uid), (conv_id, p_other);
  end if;

  insert into public.messages (conversation_id, sender_id, body)
  values (conv_id, uid, clean_body);

  return query select conv_id, was_reused;
end $$;

revoke all on function public.create_direct_conversation(uuid, text) from public;
revoke all on function public.create_direct_conversation(uuid, text) from anon;
grant execute on function public.create_direct_conversation(uuid, text) to authenticated;