# G4M37Z Communities — Data Source Registry

> Canonical source for every important piece of state. Never invent a
> duplicate source for information that already has one here. Add a row
> before adding a new table, endpoint, or cache.

| Data | Canonical source | Notes |
|---|---|---|
| Current user | `auth.uid()` (Supabase session via `@supabase/ssr` cookies) | Resolved server-side only; never trust a client-supplied id |
| Profile / username / display name / avatar / role | `public.profiles` | `role` guarded by `trg_guard_profile_role`; username unique on `lower()` |
| Communities | `public.communities` | FKs to `profiles` (embed targets must point at `profiles`, not `auth.users` — see DATABASE.md) |
| Community membership | `public.community_members` (PK `community_id, user_id`) | Soft-leave via `left_at` (migration 045); writes only via `join_community` / `leave_community` SECURITY DEFINER RPCs — role column never client-mutable |
| Posts / comments / reactions / votes | `public.posts`, `public.comments`, `public.post_votes` (+ reactions tables) | Post INSERT requires active membership of target community (045) |
| Reposts | `public.reposts` | Unique `(reposter_id, post_id)` (045); 23505 → idempotent "already" |
| Media | Supabase Storage buckets: `post-images`, `avatars`, `community-media`, `voice-recordings` | Folder = `auth.uid()`; 045 hardened UPDATE/WITH CHECK + voice-recordings owner-only read |
| Messaging threads | `public.conversations` (`type='direct'`) | Create/reuse via `create_direct_conversation` RPC (038, block-enforced per 045) |
| Conversation membership | `public.conversation_members` | Includes `last_read_at` (033) |
| Messages | `public.messages` | Sender identity resolved server-side from `auth.uid()` |
| Unread counts | `get_unread_counts` RPC (messages after the caller's `last_read_at` that they did not send) | Single canonical source for the bell/list badges |
| Read state | `conversation_members.last_read_at` via `markConversationRead` | RLS allows updating only `last_read_at` |
| Blocks | `public.blocks` (`blocker_id, blocked_id`) | Enforced in send/new-conversation paths; surfaced as P0002 to avoid leaking block state |
| Follows / social graph | `public.follows` | Powers recipient discovery (follows + reverse-follows + overlap) |
| Recipient suggestions | `listMessageSuggestions` (follows ∪ reverse ∪ existing partners) + `searchRecipients` fallback | Graph-first, never "user not found" for a reachable user |
| Notifications | `public.notifications` | Realtime subscription reconciles the bell count |
| Events / tournaments | `public.events`, `public.tournaments` (+ frameworks: 043/044) | Creator/mod-gated creation per community |
| WebRTC signaling | `public.webrtc_signals` | Sender must be a room participant (045 policy) |
| Voice rooms / participants | `public.voice_rooms`, `public.voice_room_participants` | Lock/capacity/membership enforced on join |
| Creator analytics | `public.creator_analytics` (033-era) | Do not derive elsewhere |
| Terms acceptance | Server-validated terms version (commit `44d7cde`) | Version bump invalidates stale acceptances |
| Rate limits | In-process by default (GAP-RATE-01, 2026-09-20) | Active per instance; shared via Vercel KV when configured — see SECURITY_MODEL |
| Live SQL access | `run-sql.cmd` (Windows host) / `~/.local/bin/run-sql` (Termux), creds in `~/.supabase_env` | Only authorized SQL interface; never print credentials |
| Game covers | `public.games.cover_url` (official CDN art; 051 = Steam `library_600x900` / IGDB `t_720p`) | Rendered 2:3 via `GameCover`; allowlist `src/lib/games/cover-url.ts` |
| GIF search | Tenor v2 API via `/api/gifs` (server proxy; key `TENOR_API_KEY`) | Optional: without a key the picker shows a setup notice; message rows only accept Tenor-host or first-party-bucket URLs |

## Tenor GIF search — setup (pending, user-run)

The GIF picker ships wired but dormant. To activate:

1. Get a free key: <https://developers.google.com/tenor/guides/quickstart>
   (Google account → Cloud project → enable **Tenor API** → Credentials →
   API key, starts with `AIza…`).
2. Local: add `TENOR_API_KEY=AIza…` to `.env.local`, restart the server.
3. Production: add `TENOR_API_KEY` in the host's env settings (Vercel:
   Settings → Environment Variables → Redeploy).
4. Server-only by design — `/api/gifs` proxies the search so the key never
   reaches the browser. No `NEXT_PUBLIC_` prefix.
