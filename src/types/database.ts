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
// ============================================================================

// ----------------------------------------------------------------------------
// profiles
// ----------------------------------------------------------------------------

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

// ----------------------------------------------------------------------------
// communities (added in Milestone 3)
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
}

export interface CommunityMember {
  community_id: string;
  user_id: string;
  role: CommunityMemberRole;
  joined_at: string;
}

// ----------------------------------------------------------------------------
// posts (added in Milestone 4)
// ----------------------------------------------------------------------------

export interface Post {
  id: string;
  community_id: string;
  author_id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

// ----------------------------------------------------------------------------
// comments (added in Milestone 5)
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
// votes (added in Milestone 5)
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
// notifications (added in Milestone 7)
// ----------------------------------------------------------------------------

export type NotificationType =
  | "comment_on_post"
  | "reply_to_comment"
  | "post_vote"
  | "comment_vote"
  | "moderation_action"
  | "report_resolved";

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
// reports (added in Milestone 8)
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
// community categories (gaming topics) — added in Milestone 3
// ----------------------------------------------------------------------------

export interface CommunityCategory {
  id: string;
  slug: string;
  name: string;
  created_at: string;
}
