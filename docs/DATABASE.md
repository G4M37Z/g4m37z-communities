# G4M37Z Communities — Database Reference

> Practical database reference for V3+ work. Source of truth is the live
> Postgres database; this document is a navigation aid for agents who have
> not yet inspected the live schema.

---

## Migration order (verified against `docs/database/`)

> The canonical migration tree is **001 → 054** (note: two files are numbered
> `031`, and there is no `039`). The table below covers the early splits; rows
> from 031 onward are compressed and their purpose is derived from the filename
> plus the live objects they produced.

| # | File | Purpose |
|---|---|---|
| 001 | `001_profiles.sql` | `profiles` table + RLS |
| 002 | `002_communities.sql` | communities initial |
| 002a | `002a_categories.sql` | community_categories |
| 002b | `002b_communities.sql` | communities + members |
| 002c | `002c_cleanup.sql` | cleanup pass |
| 003 | `003_posts.sql` | posts + post_votes + storage policies |
| 004 | `004_comments_and_votes.sql` | comments initial |
| 004a | `004_comments_and_votes_part1.sql` | comments |
| 004b | `004_comments_and_votes_part2.sql` | comments + RLS |
| 005 | `005_full_sync.sql` | consolidated V1 schema |
| 006 | `006_m7_m8_additions.sql` | notifications + reports |
| 007 | `007_terms_consent.sql` | terms_acceptances |
| 008 | `008_avatars_bucket.sql` | avatars storage bucket |
| 009 | `009_v1_expression_voice.sql` | voice tables + bucket |
| 010 | `010_webrtc_signaling.sql` | webrtc_signals |
| 011 | `011_webrtc_signaling_realtime.sql` | realtime publication update |
| 012 | `012_reputation_policies.sql` | reputation_events constraints + RLS |
| 013 | `013_achievements_policies.sql` | achievements + RLS + seed |
| 014 | `014_p0_security_containment.sql` | P0 security trigger + RPC revocations |
| 015 | `015_games_policies.sql` | games domain |
| 016 | `016_lfg_policies.sql` | LFG domain |
| 017 | `017_events_policies.sql` | events domain |
| 018 | `018_tournaments_policies.sql` | tournaments domain |
| 019 | `019_creators_policies.sql` | creators domain |
| 020 | `020_messaging_policies.sql` | conversations + messages + RLS |
| 021 | `021_social_graph_policies.sql` | follows / profiles:followed_by feeds |
| 022 | `022_v4_gaming_profiles.sql` | V4 gaming columns on `profiles` |
| 023 | `023_v4_lfg_session.sql` | V4 LFG session enrichment |
| 024 | `024_v4_events_lifecycle.sql` | V4 events lifecycle (`lifecycle_state`, `max_attendees`, `reminder_minutes`, `is_pinned`, `event_image_url`) |
| 025 | `025_v4_presence_state.sql` | `user_presence` table + realtime publication + RLS |
| 026 | `026_v4_community_capabilities.sql` | `communities.capabilities` TEXT[] + moderator update policy |
| 027 | `027_v4_notification_triggers.sql` | follow / @mention / event-RSVP notification triggers + `notifications.type` CHECK extension |
| 028 | `028_v4_private_communities.sql` | `communities.is_private` + private posts/communities RLS |
| 029 | `029_v4_notification_preferences.sql` | `profiles.notification_prefs` JSONB + `notification_enabled()` helper (honored by V4 triggers) |
| 030 | `030_fix_posts_profiles_relationship.sql` | renames `auth.users` FKs to `*_auth_users_fkey`; adds same-named FKs to `profiles(id)` for `posts.author_id`, `comments.author_id`, `reports.reporter_id`, `voice_room_participants.user_id` (fixes PostgREST embed hints `author:profiles!posts_author_id_fkey` et al.) |

| 031 | `031_events_created_by_and_insert_policy.sql` | `events.created_by` + insert policy |
| 031 | `031_fix_community_members_profiles_fk.sql` | `community_members.user_id` FK → `profiles(id)` (PostgREST embed) |
| 032 | `032_v5_bookmarks_and_polls.sql` | `bookmarks`, `polls`, `poll_options`, `poll_votes` |
| 033 | `033_v5_messaging_readstate_reposts.sql` | `conversation_members.last_read_at`, `messages.delivered`, `reposts` |
| 034 | `034_community_media_and_deletion.sql` | `community-media` bucket + community deletion |
| 035 | `035_notification_deleted_content_cleanup.sql` | BEFORE DELETE cleanup triggers on `posts`/`comments` |
| 036 | `036_profiles_guarantee_and_username_discovery.sql` | `ensure_profile` RPC + username discovery |
| 037 | `037_find_direct_conversation.sql` | `find_direct_conversation` RPC |
| 038 | `038_create_direct_conversation.sql` | `create_direct_conversation` RPC |
| 040 | `040_messaging_optimizations.sql` | messaging indexes/RPCs |
| 041 | `041_conversation_partner_rpc.sql` | `get_conversation_partner` RPC |
| 042 | `042_platform_links.sql` | `platform_links` table |
| 043 | `043_tournament_frameworks.sql` | `tournament_frameworks`, `tournament_stages`, `tournament_scores` |
| 044 | `044_game_frameworks.sql` | `games.default_framework_id`, framework seeds |
| 045 | `045_launch_hardening.sql` | `join_community`/`leave_community` RPCs, soft-leave (`left_at`), membership-gated posting, storage hardening |
| 046 | `046_read_receipts_rpc.sql` | `get_conversation_read_state`, `list_message_partners` |
| 047 | `047_message_attachments.sql` | `messages.attachment_url`/`attachment_type` + `message-attachments` bucket |
| 048 | `048_game_covers.sql` | `games.cover_url` seed |
| 049 | `049_dm_calls.sql` | `call_sessions`, DM-call RPCs, `webrtc_signals.conversation_id` |
| 050 | `050_dm_video_calls.sql` | `call_sessions.media` video support |
| 051 | `051_cover_quality.sql` | cover URL quality pass |
| 052 | `052_gaming_identity.sql` | `user_games`, `game_platform_identities`, `profiles.gaming_visibility` |
| 053 | `053_game_graph.sql` | `communities.game_id`, `posts.game_id` |
| 054 | `054_lfg_join_rpc.sql` | `lfg_join` RPC + caller-scoped LFG mutations |

### PostgREST embed-relationship warning (root cause of migration 030)

The app embeds related rows through foreign-key hints such as
`?select=*,author:profiles!posts_author_id_fkey`. PostgREST only honours a
hint if a foreign key **with exactly that name** exists pointing at the
embedded table. A bare inline `REFERENCES auth.users(id)`
silently auto-names the constraint after the column (`posts_author_id_fkey`)
but targets `auth.users`, not `public.profiles` — so the hint mismatches and
every such query fails with `PGRST200` ("Could not find a relationship … no
matches were found"). Keep user-facing FKs pointed at `public.profiles(id)`
(with `ON DELETE CASCADE`; `profiles.id` itself references `auth.users`).

The migrations are designed to be idempotent (use `IF NOT EXISTS`,
`DROP POLICY IF EXISTS`, `DO $$ ... EXCEPTION WHEN duplicate_object`,
`ON CONFLICT DO NOTHING`). Re-running a migration is safe.

---

## Live database connection

- Credentials live in `~/.supabase_env` on this machine (NEVER committed).
- `~/.local/bin/run-sql <path-to-sql-file>` is the only authorised SQL
  execution interface on the current Termux host.
- The script sources `~/.supabase_env` and invokes `psql`; never invoke
  `psql` directly with credentials on the command line.
- Windows host: `C:/Users/KKF/bin/run-sql.cmd` (wraps `run-sql.ps1`, same
  contract — sources `~/.supabase_env`, no credentials on the command line,
  `psql -v ON_ERROR_STOP=1`, executes exactly once). Hermes uses this path.

---

## Tables by domain

### Profiles / auth
- `profiles(id uuid PK, username text UNIQUE, display_name, avatar_url, bio, role text, created_at, updated_at, terms_accepted_at?, terms_version?, gaming_handle?, platforms text[], favorite_games text[], play_style?, lfg_available bool, presence_state text, notification_prefs jsonb NOT NULL, gaming_visibility text NOT NULL)`.
- `role` is one of `'member' | 'moderator' | 'admin' | 'suspended'`.
- UPDATE policy uses `USING (auth.uid() = id)` with no `WITH CHECK` — this is
  **closed** by the `trg_guard_profile_role` trigger from
  `014_p0_security_containment.sql`. The trigger rejects role changes
  unless `auth.uid() IS NULL` (service-role path).

### Communities
- `communities(id, name, slug, description, icon_url, banner_url, creator_id FK→profiles, created_at, updated_at, category_id?, capabilities text[] NOT NULL, is_private bool NOT NULL, game_id? FK→games)`.
- `community_members(community_id, user_id, role text, joined_at, left_at?)` PK
  `(community_id, user_id)`. `left_at IS NULL` = active membership (soft-leave).
- `community_categories(id, slug, name, created_at)`.
- `community_category_links(community_id, category_id)` PK
  `(community_id, category_id)`.

### Posts / comments / votes
- `posts(id, author_id FK→profiles, community_id FK→communities, title,
  body?, image_url?, comment_count int DEFAULT 0, created_at, updated_at, game_id? FK→games)`.
- `post_votes(post_id, user_id, vote SMALLINT CHECK IN (-1, 1), created_at)`
  PK `(post_id, user_id)`.
- `comments(id, post_id, author_id, body, parent_id?, created_at,
  updated_at)`.
- `comment_votes(comment_id, user_id, vote SMALLINT, created_at)` PK
  `(comment_id, user_id)`.

### Notifications / reports / moderation
- `notifications(id, user_id, actor_id?, type, reference_id?, read bool,
  created_at)`.
- `notification_events` — defined in master schema, 0 policies, deferred.
- `reports(id, reporter_id, target_type text, target_id, reason?, status
  text, resolved_by?, created_at, resolved_at?)`.
- `moderation_actions` — defined in master schema, 0 policies, deferred.
- `audit_logs` — defined in master schema, 0 policies, deferred.
- `terms_acceptances(user_id, accepted_at)` PK `(user_id)`.

### Voice / WebRTC
- `voice_rooms(id, community_id?, name, created_by FK→profiles, is_active,
  is_locked, created_at, updated_at)`.
- `voice_room_participants(room_id, user_id, role text, is_muted, joined_at)`
  PK `(room_id, user_id)`.
- `voice_room_settings(community_id PK, enabled, allow_member_create,
  max_participants, default_listener_mode, updated_at)`.
- `voice_comments(id, post_id?, comment_id?, user_id, storage_path,
  duration_seconds, created_at)`.
- `webrtc_signals(id, room_id? FK→voice_rooms, conversation_id? FK→conversations,
  from_user FK→auth.users, to_user?, type text CHECK IN
  ('OFFER','ANSWER','ICE_CANDIDATE','PEER_JOIN','PEER_LEAVE'),
  payload jsonb NOT NULL, created_at)`. Dual-target: `room_id` for community
  voice rooms, `conversation_id` for DM calls (049).
- `webrtc_signals` is in the `supabase_realtime` publication
  (filter `room_id=eq.<id>`).

### Storage
- `storage.buckets` (live): `avatars` (public), `post-images` (public),
  `community-media` (public, 5 MB, image MIME only), `message-attachments`
  (public, no limits — flagged), `voice-recordings` (private, owner-only).
  See the full table under "Storage buckets" below.

### Games domain (V3.3)
- `games(id, name UNIQUE, slug UNIQUE, description?, release_date?, cover_url?,
  created_at)`.
- `genres(id, name UNIQUE, slug UNIQUE, created_at)`.
- `platforms(id, name UNIQUE, slug UNIQUE, created_at)`.
- `game_genres(game_id, genre_id)` PK `(game_id, genre_id)`.
- `game_platforms(game_id, platform_id)` PK `(game_id, platform_id)`.
- `game_followers(game_id, user_id, followed_at)` PK `(game_id, user_id)`.
- `game_reviews(id, game_id?, user_id?, gameplay_score int 1..10, graphics_score
  int 1..10, performance_score int 1..10, story_score int 1..10,
  audio_score int 1..10, value_score int 1..10, overall_score int 0..100,
  body?, created_at)`.
- CHECK constraints from `015_games_policies.sql`.

### Reputation (V3.1)
- `reputation_events(id, user_id FK→profiles, source_type CHECK IN
  (post, comment, community, event, lfg_session, tournament, review,
  game, achievement, message, profile), source_id, event_type CHECK IN
  (POST_CREATED, POST_UPVOTED, POST_DOWNVOTED, COMMENT_CREATED,
  COMMENT_UPVOTED, COMMENT_DOWNVOTED, COMMUNITY_JOINED, COMMUNITY_CREATED,
  EVENT_CREATED, EVENT_PARTICIPATED, LFG_HOSTED, LFG_PARTICIPATED,
  TOURNAMENT_REGISTERED, TOURNAMENT_COMPLETED, REVIEW_POSTED,
  GAME_FOLLOWED, ACHIEVEMENT_EARNED, MESSAGE_SENT), weight int
  -1000..1000, timestamp)`.
- UNIQUE `(user_id, source_type, source_id, event_type)`.

### Achievements (V3.2)
- `achievements(id, name UNIQUE, description?, icon_url?, criteria jsonb,
  created_at)`.
- `user_achievements(user_id, achievement_id, earned_at)` PK
  `(user_id, achievement_id)`.
- 8 seeded achievements in `013_achievements_policies.sql`.

### LFG (V3.4)
- `lfg_sessions(id, game_id?, host_id?, platform_id?, mode?, region?,
  skill_level?, players_required int 1..100, microphone_required bool,
  language?, session_time?, status CHECK IN (CREATED, OPEN, FULL, CLOSED,
  CANCELLED, COMPLETED, EXPIRED), privacy CHECK IN ('public','private'),
  created_at, updated_at)`.
- `lfg_participants(session_id, user_id, joined_at)` PK
  `(session_id, user_id)`.

### Events (V3.5)
- `events(id, community_id?, title 1..200, description?, event_type
  length-capped ≤64, start_time?, end_time?, capacity? int 1..1000,
  status CHECK IN (DRAFT, PUBLISHED, FULL, CANCELLED, COMPLETED, EXPIRED),
  created_at, updated_at)`.
- `event_participants(event_id, user_id, registered_at)` PK
  `(event_id, user_id)`.

### Tournaments (V3.6)
- `tournaments(id, event_id? FK→events, game_id? FK→games, name 1..200,
  format CHECK IN (SINGLE_ELIMINATION, DOUBLE_ELIMINATION, ROUND_ROBIN,
  SWISS), status CHECK IN (REGISTRATION, IN_PROGRESS, COMPLETED, CANCELLED),
  max_teams int 2..128 DEFAULT 8, created_at)`.
- `tournament_teams(id, tournament_id FK→tournaments, name 1..64,
  captain_id FK→profiles, created_at)`.
- `tournament_matches(id, tournament_id, round int ≥0, team_a_id? FK→teams,
  team_b_id? FK→teams, winner_id? FK→teams, status CHECK IN (SCHEDULED,
  IN_PROGRESS, COMPLETED, CANCELLED), scheduled_time?, completed_at?,
  created_at)` — CHECK `team_a_id <> team_b_id`.
- `tournament_results(match_id PK FK→matches, verified bool,
  dispute_id? FK→disputes, verified_at?, verified_by? FK→profiles)`.
- `tournament_disputes(id, match_id FK→matches, raised_by FK→profiles,
  reason? ≤4000, status CHECK IN (PENDING, RESOLVED, REJECTED, WITHDRAWN),
  resolved_at?, resolved_by? FK→profiles, created_at)`.

### V5/V6 additions (032–054)

- `bookmarks(user_id FK→profiles, post_id FK→posts, created_at)` PK
  `(user_id, post_id)` — private saved posts.
- `polls(id, post_id FK→posts, question, multiple bool, expires_at?,
  created_by FK→profiles, created_at)`.
- `poll_options(id, poll_id FK→polls, label, position smallint, created_at)`.
- `poll_votes(poll_id, user_id, option_id, voted_at)` PK `(poll_id, user_id)`.
- `reposts(id, reposter_id, post_id, original_author_id, comment?, created_at)`.
- `platform_links(id, user_id, platform text, handle, profile_url?,
  verified_at?, created_at, updated_at)` — manual self-reported identities.
- `user_presence(user_id PK, status text, last_seen_at?, activity_context?,
  updated_at?)`.
- `user_games(id, user_id, game_id, status text, note?, started_at?,
  completed_at?, created_at, updated_at)` (052).
- `game_platform_identities(id, user_id, game_id, platform_slug?, in_game_name,
  rank_label?, region?, created_at, updated_at)` (052).
- `tournament_frameworks(id, slug, name, category?, scoring_type, description?,
  created_by?, created_at, game_id?, scoring_schedule jsonb?,
  match_format jsonb?)` (043/044).
- `tournament_stages(id, framework_id, stage_order, stage_name,
  progression_rule jsonb, created_at)` (043).
- `tournament_scores(id, tournament_id, stage_id, user_id, score numeric,
  created_at, updated_at)` (043).
- `call_sessions(id, conversation_id, caller_id, media text, status text,
  started_at, ended_at?, ended_by?, callee_id, outcome?, answered_at?,
  created_at)` (049/050) — DM call lifecycle; mutations via SECURITY DEFINER
  RPCs only.
- `events` additionally carries `created_by? FK→profiles`, `lifecycle_state`,
  `max_attendees`, `reminder_minutes`, `is_pinned`, `event_image_url`
  (024/031).

---

## Indexes

| Table | Index | Columns |
|---|---|---|
| profiles | username UNIQUE | username |
| communities | name / slug UNIQUE | name / slug |
| posts | (author_id, created_at DESC) | via FKs |
| comments | (post_id, created_at) | via FKs |
| post_votes | PK (post_id, user_id) | |
| comment_votes | PK (comment_id, user_id) | |
| reputation_events | idx_reputation_events_user | user_id |
| reputation_events | dedup_key UNIQUE | user_id, source_type, source_id, event_type |
| user_achievements | PK (user_id, achievement_id) | |
| game_followers | idx_game_followers_user | user_id |
| game_reviews | idx_game_reviews_game | game_id |
| webrtc_signals | idx_webrtc_signals_room | (room_id, created_at DESC) |
| lfg_sessions | idx_lfg_sessions_game | game_id |
| lfg_sessions | idx_lfg_sessions_status | status |
| lfg_participants | idx_lfg_participants_room | session_id |
| events | idx_events_community | community_id |
| events | idx_events_status | status |
| tournaments | idx_tournaments_event | event_id |
| tournaments | idx_tournaments_game | game_id |
| tournaments | idx_tournaments_status | status |
| tournament_matches | idx_tournament_matches_round | round |
| tournament_matches | idx_tournament_matches_tournament | tournament_id |
| tournament_teams | idx_tournament_teams_tournament | tournament_id |
| tournament_disputes | idx_tournament_disputes_match | match_id |
| tournament_disputes | idx_tournament_disputes_status | status |
| tournament_results | idx_tournament_results_verified | verified |

Other tables have implicit indexes from primary keys / unique constraints.

---

## RLS policy inventory

> Live-verified 2026-10-17: **66 public tables, all RLS-enabled, 195 policies.**

- V1 (`profiles`, `communities`, `community_members`, `community_categories`,
  `community_category_links`, `posts`, `post_votes`, `comments`,
  `comment_votes`, `notifications`, `reports`, `terms_acceptances`) — fully
  scoped per-CMD policies; world-readable SELECT for catalogue/profile data,
  ownership (`auth.uid()`) for mutations. `profiles` UPDATE has no `WITH CHECK`
  and is closed by `trg_guard_profile_role`.
- Voice (`voice_rooms`, `voice_room_participants`, `voice_room_settings`,
  `voice_comments`) — scoped per-CMD policies.
- WebRTC (`webrtc_signals`) — SELECT/INSERT scoped to room participants **or**
  conversation members (049); DELETE scoped to sender.
- V3.1 (`reputation_events`) — SELECT public; writes require service_role.
- V3.2 (`achievements`, `user_achievements`) — SELECT public; writes require
  service_role.
- V3.3 (`games`, `genres`, `platforms`, `game_genres`, `game_platforms`,
  `game_followers`, `game_reviews`) — SELECT public; user-owned mutations
  scoped to `auth.uid() = user_id`.
- V3.4 (`lfg_sessions`, `lfg_participants`) — see `016_lfg_policies.sql` +
  `054_lfg_join_rpc.sql` (caller-scoped mutations, `lfg_join` RPC).
- V3.5 (`events`, `event_participants`) — see `017_events_policies.sql`.
- V3.6 (`tournaments`, `tournament_teams`, `tournament_matches`,
  `tournament_results`, `tournament_disputes`) — see `018_*`. Later
  `tournament_frameworks`/`tournament_stages`/`tournament_scores` (043/044)
  use `authenticated` roles.
- V3.7 (`creator_profiles`, `creator_content`, `creator_followers`) — full
  INSERT/SELECT/UPDATE (creators) / DELETE (followers) policies.
- V3.8 (`conversations`, `conversation_members`, `messages`) — full policies;
  `messages` is immutable to clients (UPDATE/DELETE `WITH CHECK false`).
- V3.9 (`notification_events`) — full CRUD policies.
- Social graph (`follows`, `blocks`, `mutes`) — full SELECT/INSERT/DELETE
  policies (021).
- V5 (`bookmarks`, `polls`, `poll_options`, `poll_votes`, `reposts`) —
  `authenticated`-scoped; bookmarks strictly private to the owner; polls inherit
  post visibility; one vote per user per poll enforced by PK.
- Gaming (`user_games`, `game_platform_identities`, `platform_links`,
  `user_presence`, `call_sessions`) — owner-scoped (`authenticated`);
  `call_sessions` exposes SELECT only, lifecycle via RPCs.

Tables with RLS enabled but **zero** policies (blocked reads until policies are
added — a deliberate gate, not a bug):

- `audit_logs`
- `moderation_actions`
- `game_clips`
- `guides`

> Historical note: the earlier "no policies" list also named `conversations`,
> `conversation_members`, `messages`, `notification_events`, and the creator
> tables. All five have had full policies since V3.7/V3.8 and 2026-09 audits;
> that note was stale and has been removed.

---

## SECURITY DEFINER functions (live, 2026-10-17)

| Function | Notes |
|---|---|
| `create_notification` | trigger helper; service_role only (anon/auth revoked in P0) |
| `admin_set_user_role` | admin tooling; service_role only (anon/auth revoked in P0) |
| `guard_profile_role` | `trg_guard_profile_role` on `profiles` (P0) |
| `notify_comment_on_post`, `notify_post_vote`, `notify_comment_vote`, `notify_report_resolved` | trigger callbacks |
| `notify_follow`, `notify_mention_on_post`, `notify_mention_on_comment`, `notify_event_rsvp`, `notify_on_repost`, `notify_mentions` | notification triggers (027 etc.) |
| `update_post_comment_count` | `comments` trigger |
| `handle_new_community` | `communities` trigger |
| `cleanup_notifications_for_deleted_content` | BEFORE DELETE on `posts`/`comments` (035) |
| `ensure_profile` | profile guarantee (036); `authenticated` |
| `join_community`, `leave_community` | membership (045); `authenticated` |
| `lfg_join`, `lfg_participant_count` | LFG (054); `authenticated` |
| `create_direct_conversation` | (038) `authenticated` |
| `find_direct_conversation`, `get_conversation_partner`, `get_conversation_read_state`, `list_message_partners`, `get_unread_counts` | messaging utilities; `authenticated` |
| `start_dm_call`, `answer_dm_call`, `decline_dm_call`, `cancel_dm_call`, `end_dm_call`, `timeout_dm_call` | DM call lifecycle (049/050); `authenticated` |
| `_call_pair_blocked`, `_log_call_event`, `_call_duration_text` | internal call helpers; service_role/postgres only |
| `can_write_webrtc_signal`, `can_manage_community_media` | RLS/storage helpers (callable by `anon`/`authenticated`; boolean-only) |
| `get_my_platform_role` | read-only utility |
| `rls_auto_enable` | DDL event trigger (auto-enables RLS on new public tables) |

---

## Realtime publication

`supabase_realtime` publication includes (live, 2026-10-17):
- `messages`
- `notifications`
- `profiles`
- `reactions`
- `reports`
- `call_sessions`
- `user_presence`
- `voice_rooms`
- `voice_room_participants`
- `webrtc_signals`

Realtime is NOT enabled for the V3 systems (reputation / achievements /
games / lfg / events / tournaments). Adding these is a future hardening task.

---

## Storage buckets (live, 2026-10-17)

| Bucket | Public | Limits |
|---|---|---|
| `avatars` | yes | none |
| `post-images` | yes | none |
| `community-media` | yes | 5 MB; image/jpeg,png,webp,gif |
| `message-attachments` | yes | **none — flagged for hardening** |
| `voice-recordings` | no | none (owner-only read) |

> Security note: `message-attachments` is public with no size or MIME
> restriction. Tracked for pre-launch hardening.

---

## Important: live verification required before assuming anything

This document is a navigation aid. **Before any database work, run live
inspection queries via `run-sql`** and confirm column names, types,
indexes, constraints, and policy expressions match the current state of
the database. The schema evolves; this document may be stale.

## Termux interface (this session)
- Authorised SQL interface: `psql` via `~/.supabase_env`; file-only SQL execution.
- Windows `run-sql.cmd` is for Hermes only; Termux does NOT use it.
- SQL file inspection ≠ live DB application; verify with SELECT / information_schema only.
- Credentials: `.env.local` untouched; never expose DATABASE_URL or service role.
