-- ===================================================================
-- MASTER V3 DATABASE MIGRATION
-- All Phase 1–12 tables consolidated into a single runnable file.
-- Confirm execution: this creates ~30 tables across reputation,
-- gaming graph extensions, LFG, events, tournaments,
-- creators, messaging, social graph, notifications, and audit.
-- ===================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Reputation + Achievements
CREATE TABLE IF NOT EXISTS reputation_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, source_type TEXT NOT NULL, source_id UUID, event_type TEXT NOT NULL, weight INTEGER DEFAULT 1, timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_reputation_events_user ON reputation_events(user_id);
CREATE TABLE IF NOT EXISTS achievements (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT UNIQUE NOT NULL, description TEXT, icon_url TEXT, criteria JSONB DEFAULT '{}', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE IF NOT EXISTS user_achievements (user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE, earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), PRIMARY KEY (user_id, achievement_id));

-- Gaming Graph extensions
CREATE TABLE IF NOT EXISTS game_followers (game_id UUID REFERENCES games(id) ON DELETE CASCADE, user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, followed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), PRIMARY KEY (game_id, user_id));
CREATE INDEX IF NOT EXISTS idx_game_followers_user ON game_followers(user_id);
CREATE TABLE IF NOT EXISTS game_reviews (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), game_id UUID REFERENCES games(id) ON DELETE CASCADE, user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, gameplay_score INTEGER, graphics_score INTEGER, performance_score INTEGER, story_score INTEGER, audio_score INTEGER, value_score INTEGER, overall_score INTEGER, body TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_game_reviews_game ON game_reviews(game_id);
CREATE TABLE IF NOT EXISTS guides (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), game_id UUID REFERENCES games(id) ON DELETE CASCADE, user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, title TEXT NOT NULL, category TEXT, difficulty TEXT, body TEXT, version INTEGER DEFAULT 1, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_guides_game ON guides(game_id);
CREATE TABLE IF NOT EXISTS game_clips (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), game_id UUID REFERENCES games(id) ON DELETE CASCADE, user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, title TEXT, clip_url TEXT, thumbnail_url TEXT, duration INTEGER, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_clips_game ON game_clips(game_id);

-- LFG
CREATE TABLE IF NOT EXISTS lfg_sessions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), game_id UUID REFERENCES games(id) ON DELETE CASCADE, host_id UUID REFERENCES profiles(id) ON DELETE CASCADE, platform_id UUID REFERENCES platforms(id), mode TEXT, region TEXT, skill_level TEXT, players_required INTEGER DEFAULT 1, microphone_required BOOLEAN DEFAULT false, language TEXT, session_time TIMESTAMP WITH TIME ZONE, status TEXT DEFAULT 'CREATED', privacy TEXT DEFAULT 'public', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_lfg_sessions_status ON lfg_sessions(status);
CREATE INDEX IF NOT EXISTS idx_lfg_sessions_game ON lfg_sessions(game_id);
CREATE TABLE IF NOT EXISTS lfg_participants (session_id UUID REFERENCES lfg_sessions(id) ON DELETE CASCADE, user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), PRIMARY KEY (session_id, user_id));

-- Events
CREATE TABLE IF NOT EXISTS events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), community_id UUID REFERENCES communities(id) ON DELETE CASCADE, title TEXT NOT NULL, description TEXT, event_type TEXT DEFAULT 'event', start_time TIMESTAMP WITH TIME ZONE, end_time TIMESTAMP WITH TIME ZONE, capacity INTEGER, status TEXT DEFAULT 'DRAFT', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_events_community ON events(community_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE TABLE IF NOT EXISTS event_participants (event_id UUID REFERENCES events(id) ON DELETE CASCADE, user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), PRIMARY KEY (event_id, user_id));

-- Tournaments
CREATE TABLE IF NOT EXISTS tournaments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), event_id UUID REFERENCES events(id), game_id UUID REFERENCES games(id) ON DELETE CASCADE, name TEXT NOT NULL, format TEXT DEFAULT 'SINGLE_ELIMINATION', status TEXT DEFAULT 'REGISTRATION', max_teams INTEGER DEFAULT 8, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_tournaments_event ON tournaments(event_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_game ON tournaments(game_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE TABLE IF NOT EXISTS tournament_teams (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE, name TEXT NOT NULL, captain_id UUID REFERENCES profiles(id), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_tournament_teams_tournament ON tournament_teams(tournament_id);
CREATE TABLE IF NOT EXISTS tournament_matches (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE, round INTEGER, team_a_id UUID REFERENCES tournament_teams(id) ON DELETE SET NULL, team_b_id UUID REFERENCES tournament_teams(id) ON DELETE SET NULL, winner_id UUID REFERENCES tournament_teams(id) ON DELETE SET NULL, status TEXT DEFAULT 'SCHEDULED', scheduled_time TIMESTAMP WITH TIME ZONE, completed_at TIMESTAMP WITH TIME ZONE, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON tournament_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_round ON tournament_matches(round);
CREATE TABLE IF NOT EXISTS tournament_results (match_id UUID REFERENCES tournament_matches(id) ON DELETE CASCADE PRIMARY KEY, verified BOOLEAN DEFAULT false, dispute_id UUID, verified_at TIMESTAMP WITH TIME ZONE, verified_by UUID REFERENCES profiles(id));
CREATE INDEX IF NOT EXISTS idx_tournament_results_verified ON tournament_results(verified);
CREATE TABLE IF NOT EXISTS tournament_disputes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), match_id UUID REFERENCES tournament_matches(id) ON DELETE CASCADE, raised_by UUID REFERENCES profiles(id) ON DELETE CASCADE, reason TEXT, status TEXT DEFAULT 'PENDING', resolved_at TIMESTAMP WITH TIME ZONE, resolved_by UUID REFERENCES profiles(id), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_tournament_disputes_match ON tournament_disputes(match_id);
CREATE INDEX IF NOT EXISTS idx_tournament_disputes_status ON tournament_disputes(status);

-- Creator platform
CREATE TABLE IF NOT EXISTS creator_profiles (user_id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY, display_name TEXT, bio TEXT, verified BOOLEAN DEFAULT false, follower_count INTEGER DEFAULT 0, total_content INTEGER DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_creator_profiles_verified ON creator_profiles(verified);
CREATE TABLE IF NOT EXISTS creator_content (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), creator_id UUID REFERENCES creator_profiles(user_id) ON DELETE CASCADE, content_type TEXT NOT NULL, title TEXT NOT NULL, game_id UUID REFERENCES games(id) ON DELETE CASCADE, body TEXT, media_url TEXT, published BOOLEAN DEFAULT true, view_count INTEGER DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_creator_content_creator ON creator_content(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_content_game ON creator_content(game_id);
CREATE TABLE IF NOT EXISTS creator_followers (creator_id UUID REFERENCES creator_profiles(user_id) ON DELETE CASCADE, user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, followed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), PRIMARY KEY (creator_id, user_id));
CREATE INDEX IF NOT EXISTS idx_creator_followers_user ON creator_followers(user_id);

-- Messaging
CREATE TABLE IF NOT EXISTS conversations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), type TEXT DEFAULT 'direct', name TEXT, context_type TEXT, context_id UUID, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_conversations_context ON conversations(context_type, context_id);
CREATE TABLE IF NOT EXISTS conversation_members (conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE, user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), last_read_at TIMESTAMP WITH TIME ZONE, PRIMARY KEY (conversation_id, user_id));
CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON conversation_members(user_id);
CREATE TABLE IF NOT EXISTS messages (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE, sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE, body TEXT NOT NULL, read BOOLEAN DEFAULT false, delivered BOOLEAN DEFAULT false, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

-- Social Graph
CREATE TABLE IF NOT EXISTS follows (follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE, followed_id UUID REFERENCES profiles(id) ON DELETE CASCADE, followed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), PRIMARY KEY (follower_id, followed_id));
CREATE INDEX IF NOT EXISTS idx_follows_followed ON follows(followed_id);
CREATE TABLE IF NOT EXISTS blocks (blocker_id UUID REFERENCES profiles(id) ON DELETE CASCADE, blocked_id UUID REFERENCES profiles(id) ON DELETE CASCADE, blocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), PRIMARY KEY (blocker_id, blocked_id));
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks(blocked_id);
CREATE TABLE IF NOT EXISTS mutes (muter_id UUID REFERENCES profiles(id) ON DELETE CASCADE, muted_id UUID REFERENCES profiles(id) ON DELETE CASCADE, muted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), PRIMARY KEY (muter_id, muted_id));
CREATE INDEX IF NOT EXISTS idx_mutes_muted ON mutes(muted_id);

-- Notification events + audit
CREATE TABLE IF NOT EXISTS notification_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, event_type TEXT NOT NULL, source_type TEXT, source_id UUID, payload JSONB DEFAULT '{}', delivered BOOLEAN DEFAULT false, read BOOLEAN DEFAULT false, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_notification_events_user ON notification_events(user_id, delivered, read);
CREATE TABLE IF NOT EXISTS moderation_actions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), moderator_id UUID REFERENCES profiles(id) ON DELETE CASCADE, target_type TEXT NOT NULL, target_id UUID, action_type TEXT NOT NULL, reason TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_moderation_target ON moderation_actions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_moderation_moderator ON moderation_actions(moderator_id);
CREATE TABLE IF NOT EXISTS audit_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL, action_type TEXT NOT NULL, resource_type TEXT, resource_id UUID, changes JSONB DEFAULT '{}', ip_address INET, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action_type);
