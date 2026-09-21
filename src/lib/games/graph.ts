// ============================================================================
// src/lib/games/graph.ts
// PHASE 2 — Game Graph reads. Aggregates the per-game fan-out:
// players (user_games), in-game identities (game_platform_identities),
// communities (communities.game_id), posts (posts.game_id).
//
// Every query runs through the caller's session, so the 052 gaming-
// visibility policies filter the player list at the database level —
// private gamers never appear, followers-only gamers only to followers.
// No service role, no broad reads (docs/GAME_GRAPH.md).
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuidLoose(v: string): boolean {
  return UUID_RE.test(v);
}

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

export interface GraphPlayer {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
  in_game_name: string | null;
}

export interface GraphCommunity {
  id: string;
  slug: string;
  name: string;
  icon_url: string | null;
  members: number | null;
}

export interface GraphPost {
  id: string;
  title: string;
  created_at: string;
  author_username: string | null;
}

export interface GameGraph {
  players: GraphPlayer[];
  communities: GraphCommunity[];
  posts: GraphPost[];
  stats: { players: number; communities: number; posts: number };
}

// ---------------------------------------------------------------------------
// Pure shaping helpers (unit-tested via __graph)
// ---------------------------------------------------------------------------

/**
 * Merge library rows and identity rows into a per-player view. A player may
 * hold several statuses; the identity's in-game name is attached when known.
 * Order: playing first, then favorite/owned/want_to_play/followed; ties by
 * username. Duplicates (same user twice) collapse to the highest-priority
 * status.
 */
export function shapePlayers(
  library: Array<{ user_id: string; status: string }>,
  profiles: Record<string, { username: string; display_name: string | null; avatar_url: string | null }>,
  identities: Record<string, string>,
): GraphPlayer[] {
  const PRIORITY = ["playing", "favorite", "owned", "want_to_play", "followed"];
  const byUser = new Map<string, string>();
  for (const row of library) {
    const cur = byUser.get(row.user_id);
    if (!cur || PRIORITY.indexOf(row.status) < PRIORITY.indexOf(cur)) {
      if (PRIORITY.includes(row.status)) byUser.set(row.user_id, row.status);
    }
  }
  const players: GraphPlayer[] = [];
  for (const [userId, status] of byUser) {
    const p = profiles[userId];
    if (!p) continue; // profile hidden/joined fan-out unavailable
    players.push({
      user_id: userId,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      status,
      in_game_name: identities[userId] ?? null,
    });
  }
  players.sort((a, b) => {
    const pa = PRIORITY.indexOf(a.status);
    const pb = PRIORITY.indexOf(b.status);
    if (pa !== pb) return pa - pb;
    return a.username.localeCompare(b.username);
  });
  return players;
}

export function shapeStats(
  players: number,
  communities: number,
  posts: number,
): GameGraph["stats"] {
  return { players, communities, posts };
}

// ---------------------------------------------------------------------------
// Queries (caller-scoped client)
// ---------------------------------------------------------------------------

const PLAYER_PRIORITY_SQL =
  "case status when 'playing' then 0 when 'favorite' then 1 when 'owned' then 2 when 'want_to_play' then 3 else 4 end";

/**
 * The full per-game fan-out. Safe to call with any slug — unknown games
 * return a graph with empty lists (the page renders its not-found state).
 */
export async function getGameGraph(
  supabase: SupabaseClient,
  gameId: string,
): Promise<GameGraph> {
  if (!isUuidLoose(gameId)) {
    return { players: [], communities: [], posts: [], stats: shapeStats(0, 0, 0) };
  }

  const [libraryRes, identityRes, communitiesRes, postsRes] = await Promise.all([
    // Library rows — RLS (052) filters to viewers the owners' visibility admits.
    supabase
      .from("user_games")
      .select("user_id, status")
      .eq("game_id", gameId)
      .order(
        PLAYER_PRIORITY_SQL,
        { foreignTable: "user_games", ascending: true } as never,
      ),
    // In-game names for the same game (same visibility gate).
    supabase
      .from("game_platform_identities")
      .select("user_id, in_game_name")
      .eq("game_id", gameId),
    // Communities rallied around this game.
    supabase
      .from("communities")
      .select("id, slug, name, icon_url")
      .eq("game_id", gameId)
      .order("name")
      .limit(24),
    // Recent posts about this game.
    supabase
      .from("posts")
      .select(
        "id, title, created_at, profiles:profiles!posts_author_id_fkey ( username )",
      )
      .eq("game_id", gameId)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const library = (libraryRes.data ?? []) as Array<{ user_id: string; status: string }>;
  const identitiesRaw = (identityRes.data ?? []) as Array<{
    user_id: string;
    in_game_name: string;
  }>;

  // Profiles for the visible players (world-readable table).
  const userIds = [...new Set(library.map((r) => r.user_id))];
  let profileMap: Record<
    string,
    { username: string; display_name: string | null; avatar_url: string | null }
  > = {};
  if (userIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", userIds);
    profileMap = Object.fromEntries(
      ((profs ?? []) as Array<{
        id: string;
        username: string;
        display_name: string | null;
        avatar_url: string | null;
      }>).map((p) => [p.id, { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url }]),
    );
  }

  const identityMap = Object.fromEntries(
    identitiesRaw.map((i) => [i.user_id, i.in_game_name]),
  );

  const players = shapePlayers(library, profileMap, identityMap);

  const communities = ((communitiesRes.data ?? []) as Array<{
    id: string;
    slug: string;
    name: string;
    icon_url: string | null;
  }>).map((c) => ({ ...c, members: null }));

  const posts = ((postsRes.data ?? []) as Array<{
    id: string;
    title: string;
    created_at: string;
    profiles: { username: string } | Array<{ username: string }> | null;
  }>).map((p) => {
    const author = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
    return {
      id: p.id,
      title: p.title,
      created_at: p.created_at,
      author_username: author?.username ?? null,
    };
  });

  return {
    players,
    communities,
    posts,
    stats: shapeStats(players.length, communities.length, posts.length),
  };
}

export const __graph = { shapePlayers, shapeStats };
