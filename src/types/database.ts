// ============================================================================
// database.ts — TypeScript shapes that mirror the G4M37Z Communities
// Supabase schema exactly. Keep this in lockstep with the SQL files
// in /docs/database/.
//
// Conventions (matching Postgres → JS):
//   uuid        → string
//   numeric     → number
//   timestamptz → string  (ISO-8601)
//   text/int    → string / number
//   boolean     → boolean
//   jsonb       → Record<string, unknown> | null
//   inet        → string | null
//
// Nullability follows the live DB: columns that are nullable and have no
// default are typed `| null`; columns with a NOT NULL constraint or a DB
// default (gen_random_uuid(), now(), literal defaults) are typed as present.
// Live-verified against the production schema (66 public tables, 2026-10-17).
// ============================================================================

// ----------------------------------------------------------------------------
// profiles (Milestone 1 + V4 gaming profile fields from 022_v4_gaming_profiles)
// ----------------------------------------------------------------------------

export type ProfileRole = "member" | "moderator" | "admin" | "suspended";

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: ProfileRole;
  created_at: string;
  updated_at: string;
  // 012_v4_core_v2.sql — terms acceptance tracking
  terms_accepted_at: string | null;
  terms_version: string | null;
  // 022_v4_gaming_profiles.sql
  gaming_handle: string | null;
  platforms: string[];
  favorite_games: string[];
  play_style: string | null;
  lfg_available: boolean;
  presence_state: string;
  // 029_v4_notification_preferences.sql
  notification_prefs: Record<string, unknown>;
  // 052_gaming_identity.sql
  gaming_visibility: string;
}

// ----------------------------------------------------------------------------
// platform_links (042_platform_links.sql) — manual, self-reported identities.
// verified_at stays NULL until a real connector exists.
// ----------------------------------------------------------------------------

export type PlatformLinkPlatform =
  | "steam"
  | "playstation"
  | "xbox"
  | "google_play"
  | "apple_game_center";

export interface PlatformLink {
  id: string;
  user_id: string;
  platform: PlatformLinkPlatform;
  handle: string;
  profile_url: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

// ----------------------------------------------------------------------------
// terms_acceptances
// ----------------------------------------------------------------------------

export interface TermsAcceptance {
  id: string;
  user_id: string;
  terms_version: string;
  accepted_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

// ----------------------------------------------------------------------------
// user_presence (025_v4_presence_state.sql)
// ----------------------------------------------------------------------------

export type UserPresenceStatus = "offline" | "online" | "away" | "in_voice";

export interface UserPresence {
  user_id: string;
  status: UserPresenceStatus;
  last_seen_at: string;
  activity_context: string | null;
  updated_at: string;
}

// ----------------------------------------------------------------------------
// communities (Milestone 3)
// ----------------------------------------------------------------------------

export type CommunityMemberRole = "member" | "moderator" | "admin";

export interface Community {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_url: string | null;
  banner_url: string | null;
  creator_id: string;
  created_at: string;
  updated_at: string;
  category_id: string | null;
  capabilities?: string[];
  is_private?: boolean;
  /** 053_game_graph.sql — optional primary game for the community. */
  game_id: string | null;
  /** Game Graph (053): optional primary game (joined when selected). */
  game?: { id: string; name: string; slug: string } | null;
}

export interface CommunityMember {
  community_id: string;
  user_id: string;
  role: CommunityMemberRole;
  joined_at: string;
  /** 045_launch_hardening.sql — soft-leave; NULL = active member. */
  left_at: string | null;
}

// ----------------------------------------------------------------------------
// community categories (gaming topics) — Milestone 3
// ----------------------------------------------------------------------------

export interface CommunityCategory {
  id: string;
  slug: string;
  name: string;
  created_at: string;
}

export interface CommunityCategoryLink {
  community_id: string;
  category_id: string;
}

// ----------------------------------------------------------------------------
// posts (Milestone 4)
// ----------------------------------------------------------------------------

export interface Post {
  id: string;
  community_id: string;
  author_id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  comment_count: number;
  created_at: string;
  updated_at: string;
  /** 053_game_graph.sql — optional game context on a post.
   *  Optional in TS because not every list query selects it. */
  game_id?: string | null;
  /** 055_notifications_and_messaging.sql — deduped per-user view count.
   *  Optional in TS because not every list query selects it. */
  view_count?: number | null;
}

// ----------------------------------------------------------------------------
// votes (post_votes M4; comment_votes M5)
// ----------------------------------------------------------------------------

export type VoteValue = -1 | 1;

export interface PostVote {
  post_id: string;
  user_id: string;
  value: VoteValue;
  created_at: string;
  updated_at: string;
}

export interface CommentVote {
  comment_id: string;
  user_id: string;
  value: VoteValue;
  created_at: string;
  updated_at: string;
}

// ----------------------------------------------------------------------------
// comments (Milestone 5)
// ----------------------------------------------------------------------------

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

// ----------------------------------------------------------------------------
// notifications (Milestone 7)
// ----------------------------------------------------------------------------

export type NotificationType =
  | "comment_on_post"
  | "reply_to_comment"
  | "post_vote"
  | "comment_vote"
  | "moderation_action"
  | "report_resolved"
  | "mention"
  | "community_invite"
  | "follow"
  | "event_rsvp"
  | "repost"
  /** 055 — new post in a community the recipient is a member of. */
  | "community_post"
  /** 055 — a call ended MISSED/DECLINED before being answered. */
  | "missed_call";

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: NotificationType;
  reference_id: string | null;
  read: boolean;
  created_at: string;
}

// ----------------------------------------------------------------------------
// reports (Milestone 8)
// ----------------------------------------------------------------------------

export type ReportTargetType = "post" | "comment" | "user";
export type ReportStatus = "open" | "resolved" | "dismissed";

export interface Report {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string | null;
  status: ReportStatus;
  resolved_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

// ----------------------------------------------------------------------------
// games (live DB table — referenced from master_v3.sql)
// ----------------------------------------------------------------------------

export interface Game {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  release_date: string | null;
  default_framework_id: string | null;
  created_at: string;
}

// ----------------------------------------------------------------------------
// genres / platforms taxonomy
// ----------------------------------------------------------------------------

export interface Genre {
  id: string;
  slug: string;
  name: string;
  created_at: string;
}

export interface Platform {
  id: string;
  slug: string;
  name: string;
  created_at: string;
}

export interface GameGenre {
  game_id: string;
  genre_id: string;
}

export interface GamePlatform {
  game_id: string;
  platform_id: string;
}

export interface GameFollower {
  game_id: string;
  user_id: string;
  followed_at: string;
}

// ----------------------------------------------------------------------------
// game reviews
// ----------------------------------------------------------------------------

export interface GameReview {
  id: string;
  game_id: string | null;
  user_id: string | null;
  gameplay_score: number | null;
  graphics_score: number | null;
  performance_score: number | null;
  story_score: number | null;
  audio_score: number | null;
  value_score: number | null;
  overall_score: number | null;
  body: string | null;
  created_at: string;
}

// ----------------------------------------------------------------------------
// guides
// ----------------------------------------------------------------------------

export interface Guide {
  id: string;
  game_id: string;
  user_id: string;
  title: string;
  category: string;
  difficulty: string;
  body: string;
  version: number;
  created_at: string;
  updated_at: string;
}

// ----------------------------------------------------------------------------
// game clips
// ----------------------------------------------------------------------------

export interface GameClip {
  id: string;
  game_id: string;
  user_id: string;
  title: string;
  clip_url: string;
  thumbnail_url: string | null;
  duration: number | null;
  created_at: string;
}

// ----------------------------------------------------------------------------
// reactions / emoji / gifs
// ----------------------------------------------------------------------------

export type ReactionType = "like" | "love" | "laugh" | "wow" | "sad" | "angry";

export interface Reaction {
  id: string;
  post_id: string;
  user_id: string;
  reaction_type: ReactionType;
  created_at: string;
}

export interface EmojiUsage {
  id: string;
  user_id: string;
  post_id: string;
  comment_id: string | null;
  emoji_char: string;
  created_at: string;
}

export interface GifRef {
  id: string;
  post_id: string;
  provider: string;
  gif_url: string;
  preview_url: string | null;
  created_at: string;
}

// ----------------------------------------------------------------------------
// voice comments
// ----------------------------------------------------------------------------

export interface VoiceComment {
  id: string;
  post_id: string;
  comment_id: string | null;
  user_id: string;
  storage_path: string;
  duration_seconds: number;
  created_at: string;
}

// ----------------------------------------------------------------------------
// voice rooms (real-time voice chat)
// ----------------------------------------------------------------------------

export interface VoiceRoomSettings {
  community_id: string;
  enabled: boolean;
  allow_member_create: boolean;
  max_participants: number;
  default_listener_mode: boolean;
  updated_at: string;
}

export interface VoiceRoom {
  id: string;
  community_id: string;
  name: string;
  created_by: string; // profiles.id
  is_active: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

export type VoiceRoomParticipantRole = "listener" | "speaker" | "moderator";

export interface VoiceRoomParticipant {
  room_id: string;
  user_id: string;
  role: VoiceRoomParticipantRole;
  is_muted: boolean;
  joined_at: string;
}

export type WebRtcSignalType =
  | "OFFER"
  | "ANSWER"
  | "ICE_CANDIDATE"
  | "PEER_JOIN"
  | "PEER_LEAVE";

export interface WebRtcSignal {
  id: string;
  room_id: string | null;
  /** 049_dm_calls.sql — DM calls reuse this transport addressed by conversation. */
  conversation_id: string | null;
  from_user: string;
  to_user: string | null;
  type: WebRtcSignalType;
  payload: Record<string, unknown> | null;
  created_at: string;
}

// ----------------------------------------------------------------------------
// reputation / achievements
// ----------------------------------------------------------------------------

export interface ReputationEvent {
  id: string;
  user_id: string;
  source_type: string;
  source_id: string;
  event_type: string;
  weight: number;
  timestamp: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  criteria: Record<string, unknown> | null;
  created_at: string;
}

export interface UserAchievement {
  user_id: string;
  achievement_id: string;
  earned_at: string;
}

// ----------------------------------------------------------------------------
// LFG sessions (live DB = V3 shape) + participants
// ----------------------------------------------------------------------------

export type LfgSessionStatus = "CREATED" | "OPEN" | "FULL" | "CLOSED" | "CANCELLED" | "COMPLETED" | "EXPIRED";
export type LfgSessionPrivacy = "public" | "private";

export interface LfgSession {
  id: string;
  game_id: string | null;
  host_id: string | null;
  platform_id: string | null;
  mode: string | null;
  region: string | null;
  skill_level: string | null;
  players_required: number;
  microphone_required: boolean;
  language: string | null;
  session_time: string | null;
  status: LfgSessionStatus;
  privacy: LfgSessionPrivacy;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface LfgParticipant {
  session_id: string;
  user_id: string;
  joined_at: string;
}

// ----------------------------------------------------------------------------
// events (V3 + V4 lifecycle from 024_v4_events_lifecycle.sql)
// ----------------------------------------------------------------------------

// event_type is free-form TEXT, length-capped at 64 (017_events_policies.sql).
export interface CommunityEvent {
  id: string;
  community_id: string | null;
  title: string;
  description: string | null;
  event_type: string | null;
  start_time: string | null;
  end_time: string | null;
  capacity: number | null;
  status: string | null; // V3 status column (nullable in live DB)
  created_at: string;
  updated_at: string;
  // 024_v4_events_lifecycle.sql
  lifecycle_state: string;
  max_attendees: number;
  reminder_minutes: number;
  is_pinned: boolean;
  event_image_url: string | null;
  // 031_events_created_by_and_insert_policy.sql
  created_by: string | null;
}

export interface EventParticipant {
  event_id: string;
  user_id: string;
  registered_at: string;
}

// ----------------------------------------------------------------------------
// tournaments
// ----------------------------------------------------------------------------

export interface Tournament {
  id: string;
  event_id: string | null;
  game_id: string | null;
  name: string;
  format: string;
  status: string;
  max_teams: number | null;
  framework_id: string | null;
  current_stage_id: string | null;
  created_at: string;
}

export interface TournamentTeam {
  id: string;
  tournament_id: string | null;
  name: string;
  captain_id: string | null;
  created_at: string;
}

export interface TournamentMatch {
  id: string;
  tournament_id: string | null;
  round: number | null;
  team_a_id: string | null;
  team_b_id: string | null;
  winner_id: string | null;
  status: string;
  scheduled_time: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface TournamentResult {
  match_id: string;
  verified: boolean;
  dispute_id: string | null;
  verified_at: string | null;
  verified_by: string | null;
}

export interface TournamentDispute {
  id: string;
  match_id: string;
  raised_by: string;
  reason: string | null;
  status: string;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

// ----------------------------------------------------------------------------
// creator economy
// ----------------------------------------------------------------------------

export interface CreatorProfile {
  user_id: string;
  display_name: string;
  bio: string | null;
  verified: boolean;
  follower_count: number;
  total_content: number;
  created_at: string;
}

export type CreatorContentType = "post" | "clip" | "guide" | "review";

export interface CreatorContent {
  id: string;
  creator_id: string;
  content_type: CreatorContentType;
  title: string;
  game_id: string | null;
  body: string | null;
  media_url: string | null;
  published: boolean;
  view_count: number;
  created_at: string;
}

export interface CreatorFollower {
  creator_id: string;
  user_id: string;
  followed_at: string;
}

// ----------------------------------------------------------------------------
// direct messaging
// ----------------------------------------------------------------------------

export type ConversationType = "direct" | "group";

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string | null;
  context_type: string | null;
  context_id: string | null;
  created_at: string;
}

export interface ConversationMember {
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string | null;
  /** 055_notifications_and_messaging.sql — per-user archive flag for the
   *  conversation list. */
  is_archived?: boolean | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read: boolean;
  delivered: boolean;
  created_at: string;
  attachment_url: string | null;
  attachment_type: "image" | "gif" | "sticker" | null;
  /** 055_notifications_and_messaging.sql — soft delete tombstone; null while
   *  the message is live, a timestamp once the sender deletes it. */
  deleted_at?: string | null;
}

// ----------------------------------------------------------------------------
// follows / blocks / mutes
// ----------------------------------------------------------------------------

export interface Follow {
  follower_id: string;
  followed_id: string;
  followed_at: string;
}

export interface Block {
  blocker_id: string;
  blocked_id: string;
  blocked_at: string;
}

export interface Mute {
  muter_id: string;
  muted_id: string;
  muted_at: string;
}

// ----------------------------------------------------------------------------
// notification_events (event-stream variant of notifications)
// ----------------------------------------------------------------------------

export interface NotificationEvent {
  id: string;
  user_id: string;
  event_type: string;
  source_type: string;
  source_id: string;
  payload: Record<string, unknown> | null;
  delivered: boolean;
  read: boolean;
  created_at: string;
}

// ----------------------------------------------------------------------------
// moderation_actions / audit_logs
// ----------------------------------------------------------------------------

export interface ModerationAction {
  id: string;
  moderator_id: string;
  target_type: string;
  target_id: string;
  action_type: string;
  reason: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action_type: string;
  resource_type: string;
  resource_id: string;
  changes: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

// ----------------------------------------------------------------------------
// bookmarks (032_v5_bookmarks_and_polls.sql) — private saved posts
// ----------------------------------------------------------------------------

export interface Bookmark {
  user_id: string;
  post_id: string;
  created_at: string;
}

// ----------------------------------------------------------------------------
// polls / options / votes (032_v5_bookmarks_and_polls.sql)
// ----------------------------------------------------------------------------

export interface Poll {
  id: string;
  post_id: string;
  question: string;
  multiple: boolean;
  expires_at: string | null;
  created_by: string;
  created_at: string;
}

export interface PollOption {
  id: string;
  poll_id: string;
  label: string;
  position: number;
  created_at: string;
}

export interface PollVote {
  poll_id: string;
  user_id: string;
  option_id: string;
  voted_at: string;
}

// ----------------------------------------------------------------------------
// reposts (033_v5_messaging_readstate_reposts.sql)
// ----------------------------------------------------------------------------

export interface Repost {
  id: string;
  reposter_id: string;
  post_id: string;
  original_author_id: string;
  comment: string | null;
  created_at: string;
}

// ----------------------------------------------------------------------------
// call_sessions (049_dm_calls.sql) — 1:1 DM call lifecycle
// ----------------------------------------------------------------------------

export type CallMedia = "audio" | "video";
export type CallStatus = "ringing" | "active" | "ended";

export interface CallSession {
  id: string;
  conversation_id: string;
  caller_id: string;
  media: CallMedia;
  status: CallStatus;
  started_at: string;
  ended_at: string | null;
  ended_by: string | null;
  callee_id: string;
  outcome: string | null;
  answered_at: string | null;
  created_at: string;
}

// ----------------------------------------------------------------------------
// user_games (052_gaming_identity.sql) — personal game library
// ----------------------------------------------------------------------------

export interface UserGame {
  id: string;
  user_id: string;
  game_id: string;
  status: string;
  note: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ----------------------------------------------------------------------------
// game_platform_identities (052_gaming_identity.sql) — per-game gamertags
// ----------------------------------------------------------------------------

export interface GamePlatformIdentity {
  id: string;
  user_id: string;
  game_id: string;
  platform_slug: string | null;
  in_game_name: string;
  rank_label: string | null;
  region: string | null;
  created_at: string;
  updated_at: string;
}

// ----------------------------------------------------------------------------
// tournament frameworks / stages / scores (043/044_tournament_frameworks.sql)
// ----------------------------------------------------------------------------

export interface TournamentFramework {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  scoring_type: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  game_id: string | null;
  is_official: boolean;
  scoring_schedule: Record<string, unknown> | null;
  match_format: Record<string, unknown> | null;
}

export interface TournamentStage {
  id: string;
  framework_id: string;
  stage_order: number;
  stage_name: string;
  progression_rule: Record<string, unknown>;
  created_at: string;
}

export interface TournamentScore {
  id: string;
  tournament_id: string;
  stage_id: string;
  user_id: string;
  score: number;
  created_at: string;
  updated_at: string;
}