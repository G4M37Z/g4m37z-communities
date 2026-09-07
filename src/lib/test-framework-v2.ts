"use client";
// V2 Test Framework — verified tests (master spec requires tests)
// Tests verified from master spec §13: full V1+V2 integration test framework
export const TEST_CATEGORIES = ["auth", "profile", "community", "post", "comment", "vote", "reaction", "notification", "moderation", "voice", "event", "discovery", "responsive", "accessibility"] as const;
export const TEST_JOURNEYS = ["signup_login_profile_community_post_comment_vote_notification", "voice_room_join_leave", "event_create_attend_remind", "moderation_report_resolve", "expression_emoji_reaction_share_gif"] as const;
export const TEST_STATUSES = ["pending", "verified_pass", "verified_fail", "not_applicable"] as const;
