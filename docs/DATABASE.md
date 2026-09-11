# G4M37Z Communities — Database Reference

> Practical database reference for V3+ work. Source of truth is the live
> Postgres database; this document is a navigation aid for agents who have
> not yet inspected the live schema.

---

## Migration order (verified against `docs/database/`)

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

The migrations are designed to be idempotent (use `IF NOT EXISTS`,
`DROP POLICY IF EXISTS`, `DO $$ ... EXCEPTION WHEN duplicate_object`,
`ON CONFLICT DO NOTHING`). Re-running a migration is safe.

---

## Live database connection

- Credentials live in `~/.supabase_env` on this machine (NEVER committed).
- `C:/Users/KKF/bin/run-sql.cmd <path-to-sql-file>` is the only authorised
  SQL execution interface.
- The script invokes `psql` from `C:/Program Files/PostgreSQL/17/bin/psql.exe`.

---

## Tables by domain

### Profiles / auth
- `profiles(id uuid PK, username text UNIQUE, display_name, avatar_url, bio, role text, created_at, updated_at)`
- `role` is one of `'member' | 'moderator' | 'admin' | 'suspended'`.
- UPDATE policy uses `USING (auth.uid() = id)` with no `WITH CHECK` — this is
  **closed** by the `trg_guard_profile_role` trigger from
  `014_p0_security_containment.sql`. The trigger rejects role changes
  unless `auth.uid() IS NULL` (service-role path).

### Communities
- `communities(id, name, slug, description, icon_url, banner_url, creator_id FK→profiles, created_at, updated_at)`.
- `community_members(community_id, user_id, role text, joined_at)` PK
  `(community_id, user_id)`.
- `community_categories(id, slug, name, created_at)`.
- `community_category_links(community_id, category_id)` PK
  `(community_id, category_id)`.

### Posts / comments / votes
- `posts(id, author_id FK→profiles, community_id FK→communities, title,
  body?, image_url?, comment_count int DEFAULT 0, created_at, updated_at)`.
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
- `webrtc_signals(id, room_id FK→voice_rooms, from_user FK→profiles, to_user?,
  type text CHECK IN ('OFFER','ANSWER','ICE_CANDIDATE','PEER_JOIN','PEER_LEAVE'),
  payload jsonb, created_at)`.
- `webrtc_signals` is in the `supabase_realtime` publication
  (filter `room_id=eq.<id>`).

### Storage
- `storage.buckets` includes `avatars` (public), `voice-recordings`
  (private), `voice-recordings` policies per `009_v1_expression_voice.sql`.

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
| lfg_participants | idx_lfg_participants_room | room_id |
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

All tables have RLS enabled. Total policies: 90+ across all tables. The
following breakdown is approximate and should be re-verified with live SQL:

- V1 (`profiles`, `communities`, `community_members`, `community_categories`,
  `community_category_links`, `posts`, `post_votes`, `comments`,
  `comment_votes`, `notifications`, `reports`, `terms_acceptances`) — fully
  scoped per-CMD policies.
- Voice (`voice_rooms`, `voice_room_participants`, `voice_room_settings`,
  `voice_comments`) — scoped per-CMD policies.
- WebRTC (`webrtc_signals`) — SELECT scoped to room participants; INSERT /
  DELETE scoped to sender.
- V3.1 (`reputation_events`) — SELECT public; INSERT/UPDATE/DELETE require
  service_role.
- V3.2 (`achievements`, `user_achievements`) — SELECT public; writes require
  service_role.
- V3.3 (`games`, `genres`, `platforms`, `game_genres`, `game_platforms`,
  `game_followers`, `game_reviews`) — SELECT public; user-owned mutations
  scoped to `auth.uid() = user_id`.
- V3.4 (`lfg_sessions`, `lfg_participants`) — see `016_lfg_policies.sql`.
- V3.5 (`events`, `event_participants`) — see `017_events_policies.sql`.
- V3.6 (5 tournament tables) — see `018_tournaments_policies.sql`.

Tables with RLS enabled but no policies (defined in master_v3.sql but not
yet wired):
- `conversations`, `conversation_members`, `messages` (V3.8 Messaging)
- `follows`, `blocks`, `mutes` (V3.9 Social Graph)
- `notification_events` (V3.9 Notifications)
- `audit_logs`, `moderation_actions`
- `creator_profiles`, `creator_content`, `creator_followers` (V3.7 Creators)

For each of these tables, RLS blocks all reads until policies are added —
this is a deliberate gate, not a bug.

---

## SECURITY DEFINER functions

| Function | Used by | Grants |
|---|---|---|
| `create_notification` | trigger functions | service_role only (anon/auth revoked in P0) |
| `admin_set_user_role` | (admin tooling only) | service_role only |
| `notify_comment_on_post` | trigger on `comments` | implicit via trigger |
| `notify_post_vote` | trigger on `post_votes` | implicit via trigger |
| `notify_comment_vote` | trigger on `comment_votes` | implicit via trigger |
| `notify_report_resolved` | trigger on `reports` | implicit via trigger |
| `update_post_comment_count` | trigger on `comments` | implicit via trigger |
| `handle_new_community` | trigger on `communities` | implicit via trigger |
| `get_my_platform_role` | (utility) | public (read-only utility) |
| `rls_auto_enable` | DDL event trigger | implicit via event trigger |

---

## Realtime publication

`supabase_realtime` publication includes:
- `notifications`
- `profiles`
- `reactions`
- `reports`
- `voice_room_participants`
- `voice_rooms`
- `webrtc_signals`

Realtime is NOT yet enabled for V3 systems (reputation / achievements /
games / lfg / events / tournaments). Adding these is a future hardening
task.

---

## Important: live verification required before assuming anything

This document is a navigation aid. **Before any database work, run live
inspection queries via `run-sql.cmd`** and confirm column names, types,
indexes, constraints, and policy expressions match the current state of
the database. The schema evolves; this document may be stale.

## Termux interface (this session)
- Authorised SQL interface: `psql` via `~/.supabase_env`; file-only SQL execution.
- Windows `run-sql.cmd` is for Hermes only; Termux does NOT use it.
- SQL file inspection ≠ live DB application; verify with SELECT / information_schema only.
- Credentials: `.env.local` untouched; never expose DATABASE_URL or service role.
