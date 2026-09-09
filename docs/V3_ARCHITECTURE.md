# G4M37Z V3 ARCHITECTURE SPECIFICATION

**Version:** 0.1 (Draft)  
**Date:** September 9, 2026  
**Status:** Ready for Phase Planning

---

## 1. VISION

Transform G4M37Z from "Reddit for gamers" into **"THE GAMING SOCIAL ECOSYSTEM"** where users can:

- **DISCOVER** games, communities, players, content, events
- **DISCUSS** across communities and social feeds
- **CONNECT** with other gamers through social graph
- **FIND PLAYERS** via LFG (Looking For Group)
- **PLAY TOGETHER** via events and tournaments
- **CREATE** guides, reviews, clips, and communities
- **BUILD REPUTATION** through meaningful contributions
- **EVENTUALLY MONETIZE** their creative work (V3.5+)

---

## 2. CORE ARCHITECTURAL CONCEPT: THE GAMING GRAPH

All V3 features must strengthen interconnection through the **Gaming Graph**:

```
GAMER
  ↓ plays/follows
GAMES
  ↓ organizes
COMMUNITIES
  ↓ hosts
CONTENT (posts, guides, reviews, clips)
  ↓ attracts
PLAYERS
  ↓ organize into
EVENTS / LFG / TOURNAMENTS
  ↓ create
REPUTATION / ACHIEVEMENTS
  ↓ powers
DISCOVERY
  ↓ loops back to
GAMER
```

**Principle:** Every system should naturally connect to this graph. Avoid isolated features.

---

## 3. V3 PLATFORM DOMAINS

### 3.1 IDENTITY LAYER (Phases 1-3)

Evolve profiles into gaming identities.

**Entities:**
- Profile (extended: gaming_platforms, favorite_games, play_style, availability)
- Presence (online/offline/gaming)
- Achievement (unlocked badges for platform activities)
- Reputation (composite score: community, helpful, creator, competitive, trust)

**Relationships:**
- User → Games (many)
- User → Platforms (many)
- User → Reputation Events (many)

---

### 3.2 GAMING GRAPH LAYER (Phase 2)

Make games first-class platform entities.

**Entities:**
- Game (IGDB integration planned; initial manual entry)
- Genre
- Platform (PC, PS5, Xbox Series X, Nintendo Switch, Mobile)
- Developer / Publisher
- Game Metadata (release date, ratings, media)
- Game Community (auto-created or user-created)
- Game Discussion (posts about specific games)
- Game Events (scheduled streams, tournaments)
- Game Followers (users tracking a game)

**Relationships:**
- Game → Genres (many)
- Game → Platforms (many)
- Game → Communities (many)
- Game → Reviews (many)
- Game → Events (many)
- Game → Followers (many)

---

### 3.3 COMMUNITY LAYER (Phases 1-3, extends V2)

Strengthen community infrastructure.

**Entities:**
- Community (extends V2: game_id, auto-join settings, moderation rules)
- Community Member (with activity tracking)
- Community Role (member, moderator, admin, banned)
- Community Channel (optional subgroups)
- Community Event (community-hosted event)
- Community Moderation Action (audit trail)

**Relationships:**
- Community → Members (many)
- Community → Game (one, optional)
- Community → Roles (many)

---

### 3.4 CONTENT LAYER (Phases 1-5)

Extend content beyond posts to structured knowledge.

**Entities:**
- Post (V2 existing)
- Comment (V2 existing)
- Reaction (V2 database exists, needs UI)
- Share (social sharing)
- Guide (game-specific tutorial content)
- Review (game or community reviews)
- Clip (media excerpt, link)
- Media (central asset reference)

**Relationships:**
- Content → Creator (one)
- Content → Game (one, optional)
- Content → Community (one, optional)
- Content → Reactions (many)

---

### 3.5 SOCIAL LAYER (Phases 2-5)

Build the social graph.

**Entities:**
- Follow (user follows user)
- Block (user blocks user)
- Mute (user mutes user or community)
- Social Connection (mutual follow)

**Relationships:**
- User → Following (many)
- User → Followers (many)
- User → Blocked (many)
- User → Games (many, following)
- User → Communities (many, following)
- User → Creators (many, following)

---

### 3.6 PLAY LAYER (Phases 4-8)

Enable real player matching and competition.

**Entities:**
- LFG Session (looking for group post)
- LFG Participant (member of session)
- Event (organized gaming event)
- Event Registration (user registration for event)
- Tournament (competitive structure)
- Tournament Team (roster)
- Tournament Match (competitive match)
- Tournament Result (outcome)
- Leaderboard (rankings)

**Relationships:**
- LFG Session → Participants (many)
- LFG Session → Game (one)
- Event → Registrations (many)
- Event → Matches (many)
- Tournament → Teams (many)
- Tournament → Matches (many)

---

### 3.7 CREATOR LAYER (Phases 6-9)

Support creators at scale.

**Entities:**
- Creator Profile (extended profile with monetization info)
- Creator Content (central reference for all creator work)
- Creator Follower (relationship)
- Creator Analytics (view counts, engagement)
- Creator Subscription (monetization foundation)

**Relationships:**
- Creator → Content (many)
- Creator → Followers (many)
- Creator → Subscribers (many)

---

### 3.8 DISCOVERY LAYER (Phase 5)

Personalize exploration.

**Entities:**
- Discover Section (curated content)
- Recommendation (algorithmically suggested)
- Trending (activity-based trending)
- Personalized Feed (user-specific)
- Search Result (indexed content)

**Services:**
- Ranking service (modular ranking system)
- Recommendation engine (future ML integration)
- Trending algorithm (activity-based or ML-based)

---

### 3.9 MODERATION LAYER (Phases 1-2, extends V2)

Strengthen moderation.

**Entities:**
- Report (V2 existing)
- Moderation Action (warnings, suspensions, bans)
- Moderation Queue (admin view of reports)
- Audit Log (all mod actions logged)

**Relationships:**
- Report → Actions (many)
- Report → Audit Logs (many)

---

### 3.10 COMMUNICATION LAYER (Phase 6)

Enable 1:1 and group messaging.

**Entities:**
- Conversation (1:1 or group)
- Conversation Member (participant)
- Message (text, with read state)
- Message Attachment (future: images, links)
- Conversation Metadata (mute, archive)

**Relationships:**
- Conversation → Members (many)
- Conversation → Messages (many)

---

### 3.11 NOTIFICATION LAYER (Phases 1-5, extends V2)

Centralize all event notifications.

**Entities:**
- Notification (V2 existing, extend for new domains)
- Notification Event (internal event that generates notification)
- Notification Preference (user settings)

**Relationships:**
- Notification Event → Notification (one)
- Notification → User (one)

---

### 3.12 ANALYTICS LAYER (Phases 2-5, foundation only)

Track product metrics.

**Entities:**
- Event (product event: view, click, create, etc.)
- Analytics Aggregate (counts, trends)

**Note:** Analytics infrastructure only; no sensitive PII collection.

---

## 4. DATABASE EXTENSION STRATEGY

### 4.1 Principles

- **No destructive migrations** unless absolutely necessary
- **Additive only** — new tables, new columns, new indexes
- **RLS-first** — all new tables have RLS policies
- **Foreign key integrity** — use explicit FKs, not denormalized IDs
- **Event sourcing for audit** — moderation, reputation, analytics

### 4.2 Priority 1: Gaming Graph (Phase 2)

```sql
-- games (core entity)
CREATE TABLE games (
  id UUID PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  igdb_id INTEGER, -- future: IGDB integration
  release_date DATE,
  cover_url TEXT,
  created_at TIMESTAMP
);

-- platforms
CREATE TABLE platforms (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP
);

-- genres
CREATE TABLE genres (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP
);

-- game_platforms (M:M)
CREATE TABLE game_platforms (
  game_id UUID FK,
  platform_id UUID FK,
  PRIMARY KEY (game_id, platform_id)
);

-- game_genres (M:M)
CREATE TABLE game_genres (
  game_id UUID FK,
  genre_id UUID FK,
  PRIMARY KEY (game_id, genre_id)
);

-- game_followers (track which users follow games)
CREATE TABLE game_followers (
  game_id UUID FK,
  user_id UUID FK,
  followed_at TIMESTAMP,
  PRIMARY KEY (game_id, user_id)
);
```

### 4.3 Priority 2: Social Graph (Phase 4)

```sql
CREATE TABLE follows (
  follower_id UUID FK → profiles,
  following_id UUID FK → profiles,
  followed_at TIMESTAMP,
  PRIMARY KEY (follower_id, following_id)
);

CREATE TABLE blocks (
  blocker_id UUID FK → profiles,
  blocked_id UUID FK → profiles,
  blocked_at TIMESTAMP,
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE mutes (
  user_id UUID FK → profiles,
  muted_id UUID FK → profiles,
  reason TEXT,
  muted_at TIMESTAMP,
  PRIMARY KEY (user_id, muted_id)
);
```

### 4.4 Priority 3: LFG (Phase 6)

```sql
CREATE TABLE lfg_sessions (
  id UUID PRIMARY KEY,
  creator_id UUID FK → profiles,
  game_id UUID FK → games,
  title TEXT,
  description TEXT,
  platform TEXT,
  playstyle TEXT,
  skill_level TEXT,
  region TEXT,
  language TEXT,
  max_players INTEGER,
  microphone_required BOOLEAN,
  start_time TIMESTAMP,
  status TEXT CHECK (status IN ('open', 'full', 'active', 'completed', 'expired')),
  created_at TIMESTAMP,
  expires_at TIMESTAMP
);

CREATE TABLE lfg_participants (
  session_id UUID FK,
  user_id UUID FK,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMP,
  PRIMARY KEY (session_id, user_id)
);
```

### 4.5 Priority 4: Events (Phase 7)

```sql
CREATE TABLE events (
  id UUID PRIMARY KEY,
  creator_id UUID FK → profiles,
  game_id UUID FK → games,
  community_id UUID FK → communities,
  title TEXT,
  description TEXT,
  event_date TIMESTAMP,
  max_participants INTEGER,
  status TEXT CHECK (status IN ('draft', 'published', 'live', 'completed', 'cancelled')),
  created_at TIMESTAMP
);

CREATE TABLE event_registrations (
  event_id UUID FK,
  user_id UUID FK,
  registered_at TIMESTAMP,
  PRIMARY KEY (event_id, user_id)
);
```

### 4.6 Priority 5: Reputation (Phase 4)

```sql
CREATE TABLE reputation_events (
  id UUID PRIMARY KEY,
  user_id UUID FK → profiles,
  event_type TEXT, -- 'comment_helpful', 'guide_created', 'tournament_won', etc.
  source_id UUID,   -- reference to the action (comment_id, guide_id, tournament_id)
  weight INTEGER,   -- +1, +5, +10, etc.
  created_at TIMESTAMP
);

-- Composite reputation score view / cache table
CREATE TABLE user_reputation_cache (
  user_id UUID PK FK → profiles,
  community_score INTEGER,
  helpful_score INTEGER,
  creator_score INTEGER,
  competitive_score INTEGER,
  trust_score INTEGER,
  total_score INTEGER,
  updated_at TIMESTAMP
);
```

---

## 5. SERVICE LAYER ORGANIZATION

### 5.1 Existing Services (V2)

```
src/lib/
├── supabase/        -- Client init, auth actions
├── posts/           -- Post queries + actions
├── comments/        -- Comment queries + actions
├── communities/     -- Community queries + actions
├── notifications/   -- Notification queries + actions
├── search/          -- Search queries
├── reports/         -- Moderation actions
└── utils.ts         -- Helpers
```

### 5.2 V3 New Services (to be created)

```
src/lib/
├── games/           -- Game queries + follow actions
├── social/          -- Follow, block, mute actions + queries
├── lfg/             -- LFG session CRUD + discovery
├── events/          -- Event CRUD + registration
├── tournaments/     -- Tournament engine (Phase 8)
├── creators/        -- Creator profile + content
├── messaging/       -- DM conversations (Phase 6)
├── reputation/      -- Reputation queries + event logging
├── discovery/       -- Trending, recommendations, explore
├── realtime/        -- Subscription management (new)
└── moderation/      -- Strengthen moderation (Phase 2)
```

### 5.3 Shared Patterns

All services follow:

1. **Queries** (read-only, server-side)
   - Cache-friendly
   - Return typed DTO objects
   - No side effects

2. **Actions** (mutations, server-side)
   - Input validation
   - Auth check
   - RLS-enforced via Supabase client
   - Revalidate affected paths
   - Return `{ ok: true }` or `{ error: string }`

3. **RPCs** (Postgres functions for complex operations)
   - SECURITY DEFINER for admin-only operations
   - GRANT to authenticated role
   - Use for triggers, audit logging, aggregations

---

## 6. UI/UX ARCHITECTURE

### 6.1 Layout Structure

```
<RootLayout>
  <Header>
    <Logo />
    <SearchBar />
    <CommandPalette />
    <NotificationBell />
    <UserMenu />
  </Header>
  
  <main>
    <SidebarNav /> (on desktop; drawer on mobile)
    <MainContent />
  </main>
  
  <Footer />
  <BottomNav /> (mobile only)
</RootLayout>
```

### 6.2 Navigation Hierarchy

**Primary Routes:**
- `/` — Landing/home feed
- `/games` — Game discovery
- `/communities` — Community discovery
- `/creators` — Creator discovery
- `/events` — Event calendar
- `/lfg` — Looking for group
- `/search` — Unified search
- `/profile/[username]` — User profile
- `/settings` — User settings
- `/notifications` — Notification feed
- `/messages` — DM conversations
- `/admin` — Moderation (admin-only)
- `/creator-studio` — Creator tools (Phase 9)

**Secondary Routes:**
- `/games/[slug]` — Game detail + hub
- `/communities/[slug]` — Community detail
- `/post/[id]` — Post detail + comments
- `/events/[id]` — Event detail
- `/tournaments/[id]` — Tournament detail
- `/creator/[username]` — Creator profile

### 6.3 Component Library

Extend existing shadcn primitives with V3 components:

- `GameCard` — Game discovery card
- `PlayerCard` — Player profile card in LFG
- `EventCard` — Event listing
- `LFGSessionCard` — LFG session details
- `CreatorCard` — Creator discovery
- `ReputationBadge` — Reputation display
- `EventRegistration` — Join/leave button
- `ConversationThread` — DM UI
- `SearchResultsGrid` — Multi-type results

---

## 7. REALTIME STRATEGY

### 7.1 Subscription Discipline

Every subscription must have:

```typescript
// Clear lifecycle
const subscription = supabase
  .channel(`post:${postId}`)
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` },
    (payload) => {
      // Handle update
    }
  )
  .subscribe();

// Cleanup on unmount
useEffect(() => {
  return () => {
    supabase.removeChannel(subscription);
  };
}, []);
```

### 7.2 Realtime Points

Build realtime subscriptions for:

1. **Notifications** — Live new notification arrival
2. **Comments** — Live comment feed on post detail
3. **LFG Participants** — Participants joining session
4. **Event Updates** — Registration changes, status updates
5. **Presence** — Who's online in community
6. **Messages** — New DM arrival

### 7.3 Avoid Realtime For

- Feed listings (pagination makes realtime noisy)
- Search results (user-initiated, not continuous)
- Admin dashboards (polling is fine)

---

## 8. SECURITY ARCHITECTURE

### 8.1 RLS-First

**Every table must have RLS policies** covering:

- SELECT (who can read)
- INSERT (who can create)
- UPDATE (who can modify)
- DELETE (who can remove)

**Pattern:**

```sql
CREATE POLICY "Users can read public posts" ON posts
  FOR SELECT USING (true); -- public

CREATE POLICY "Users can create their own posts" ON posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Admins can delete any post" ON posts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### 8.2 Rate Limiting

Implement rate limits for:

- Form submissions (3 per minute per user)
- Report creation (1 per target per day)
- Comment creation (10 per minute)
- LFG session creation (2 per day)
- Tournament creation (1 per day)

### 8.3 Content Moderation

Add server-side filters for:

- Spam detection (repeated patterns)
- Profanity filtering (passive flag, not censoring)
- Link validation (prevent malware URLs)
- Rate limit abuse detection

---

## 9. TESTING STRATEGY

### 9.1 Test Pyramid

```
E2E Tests (critical user journeys)
  ↑
Integration Tests (API endpoints, RLS)
  ↑
Unit Tests (utilities, validation)
  ↑
Database Tests (migrations, constraints)
```

### 9.2 Critical Journeys to Test

1. **User Signup → Profile → Join Community → Create Post → Comment → Notification**
2. **Discover Game → Follow → View Game Hub → Create LFG → Join Event**
3. **Admin Report Flow → Review Report → Moderation Action → User Notification**
4. **Creator Create Guide → Publish → Receive Followers → Analytics**

### 9.3 Test Tools

- **Vitest** — Unit tests
- **Playwright** — E2E tests
- **Supabase Local** — Database testing

---

## 10. PERFORMANCE TARGETS

### 10.1 Core Metrics

- **Largest Contentful Paint (LCP)** < 2.5s
- **First Input Delay (FID)** < 100ms
- **Cumulative Layout Shift (CLS)** < 0.1
- **API Response Time** < 500ms p95
- **Database Query Time** < 200ms p95

### 10.2 Optimization Strategies

1. **Route-level code splitting** — Pages load only what they need
2. **Image optimization** — Next.js Image with WebP
3. **Query optimization** — Proper indexes, pagination
4. **Caching strategy** — ISR for discovery pages, SWR for user data
5. **Lazy loading** — Below-fold content loads on demand

---

## 11. DEPLOYMENT & MONITORING

### 11.1 CI/CD Pipeline

```
Code Push → typecheck → lint → test → build → deploy
```

### 11.2 Deployment Targets

- **Dev** — `localhost:3000` (local Supabase)
- **Staging** — `staging.g4m37z-communities.vercel.app` (test data)
- **Production** — `g4m37z-communities.vercel.app` (live)

### 11.3 Monitoring

- **Vercel Analytics** — Performance metrics
- **Supabase Logs** — Database queries, RLS issues
- **Error Tracking** — Console errors, API failures
- **Realtime Health** — Subscription failures

---

## 12. PHASE BREAKDOWN

### Phase 0 (Current)
- Complete V2 baseline audit ✅
- Document architecture ✅
- Complete YELLOW items (reactions UI, admin UI, test setup)

### Phase 1 (Foundation)
- Gaming graph foundation (games table, genres, platforms)
- Extend profiles (favorite_games, platforms, play_style)
- Realtime subscription management
- Complete moderation UI
- Establish test framework

### Phase 2 (Game Graph)
- Game discovery pages
- Game pages as hubs
- Game communities
- Game following

### Phase 3 (Player Identity 2.0)
- Extended profiles with gaming identity
- Reputation system foundation
- Achievements foundation
- Activity tracking

### Phase 4 (Reputation + Achievements)
- Reputation event logging
- Reputation scoring
- Achievement unlocking
- Social graph (follow/block/mute)

### Phase 5 (Discovery 2.0)
- Explore page
- Trending system
- Recommendations foundation
- Personalized feed

### Phase 6 (LFG)
- LFG session creation
- Session discovery
- Participant management
- Session lifecycle

### Phase 7 (Events 2.0)
- Event creation
- Event registration
- Event notifications
- Event lifecycle

### Phase 8 (Tournament Engine)
- Tournament creation
- Bracket generation
- Match management
- Result verification
- Leaderboards

### Phase 9 (Creator Platform)
- Creator profiles
- Creator content organization
- Creator analytics foundation

### Phase 10 (Reviews + Guides)
- Structured reviews
- Guides with versioning
- Community voting

### Phase 11 (Messaging)
- Direct conversations
- Group conversations
- Message history
- Read state

### Phase 12 (Social Graph)
- Followers/Following
- Mutual connections
- Relationship-aware features

### Phase 13-15
- Recommendation engine
- Creator economy foundation
- Marketplace foundation

### Phase 16-17
- Platform application architecture
- UI/UX evolution

### Phase 18+
- Advanced features, scaling

---

## 13. SUCCESS CRITERIA

V3 is successful when:

1. ✅ **Gaming Graph Connected** — Every major feature strengthens the gaming graph
2. ✅ **Performance Maintained** — LCP, FID, CLS targets met
3. ✅ **Security Hardened** — RLS covers all new tables, no authorization bypasses
4. ✅ **Realtime Scalable** — Subscription discipline prevents zombie connections
5. ✅ **Mobile First** — Responsive across 320px–1920px
6. ✅ **Accessible** — WCAG AA compliance, keyboard navigation, screen reader support
7. ✅ **Tested** — Unit, integration, E2E test coverage for critical paths
8. ✅ **Documented** — Architecture, schema, API patterns documented

---

## 14. KNOWN UNKNOWNS

1. **IGDB Integration** — Should we license IGDB for game data?
2. **Voice/WebRTC** — Complete in V3 or defer to V3.5?
3. **AI Recommendations** — Simple ranking first, then ML later?
4. **Payments** — Stripe integration for monetization (defer to V3.5)?
5. **Mobile App** — Web-first for V3, native later?
6. **CDN Strategy** — Vercel edge caching sufficient or add Cloudflare?

---

## NEXT STEPS

1. ✅ Complete PHASE 0 audit (current)
2. 📋 Review architecture with team
3. 🎯 Prioritize Phase 1 systems
4. 🚀 Begin Phase 1 implementation
5. 📊 Establish metrics dashboard

---

**END OF V3 ARCHITECTURE SPECIFICATION**

