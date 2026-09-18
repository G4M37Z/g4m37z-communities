// ============================================================================
// src/lib/tournaments/frameworks.ts
// Tournament Frameworks — PURE rules, types, and scoring/progression logic.
// NO server imports here: this module must stay importable from Client
// Components and tests. Data access lives in ./frameworks-service.ts.
// ============================================================================

export type ScoringType = "points" | "win_loss" | "rank";

export type MatchFormatMode = "single" | "best_of" | "multi_match" | "league" | "racing";

/**
 * Point awards for a framework. Descriptive metadata, rendered as human
 * guidance (see describeScoring); the platform never simulates standings.
 */
export interface ScoringSchedule {
  win?: number; // football league: points for a win
  draw?: number; // football league: points for a draw
  loss?: number; // football league: points for a loss
  win_points?: number; // series-based formats: points per series win
  loss_points?: number; // series-based formats: points per series loss
  placement?: number[]; // battle royale / racing: points by finish place (index 0 = 1st)
  kill_points?: number; // battle royale: bonus per elimination
  per_match?: boolean; // true => the schedule applies per match and is aggregated
  matches?: number; // matches / races in a session
  tiebreak?: string[]; // ordering tiebreaks, e.g. ['goal_difference','goals_for','head_to_head']
}

/** How individual matches are played inside the framework. */
export interface GameMatchFormat {
  mode: MatchFormatMode;
  games?: number; // best_of: number of games/maps needed to win a set
  finals_games?: number; // fighting: finals sets stretch to best-of-N
  matches?: number; // multi_match / racing: matches per session
  modes?: string[]; // fixed mode order, e.g. CDL map rotation
}

export interface Framework {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  scoring_type: ScoringType;
  description: string | null;
  game_id: string | null;
  scoring_schedule: ScoringSchedule | null;
  match_format: GameMatchFormat | null;
  created_by: string | null;
  created_at: string;
}

export interface Stage {
  id: string;
  framework_id: string;
  stage_order: number;
  stage_name: string;
  progression_rule: unknown;
  created_at: string;
}

export interface ScoreEntry {
  userId: string;
  points: number;
  rank: number;
}

export interface ProgressionRule {
  top_n?: number;
  min_points?: number;
  min_rank?: number;
}

/**
 * Calculate which users advance to the next stage based on the progression rule.
 * This is the core logic for Battle Royale / Point-based global stages.
 * Pure: sorts a copy of the input, never mutates it.
 */
export function calculateAdvancement(
  scores: ScoreEntry[],
  rule: ProgressionRule
): string[] {
  if (!rule || Object.keys(rule).length === 0) return [];

  // 1. Sort by points (desc) then rank (asc)
  const sorted = [...scores].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.rank - b.rank;
  });

  // 2. Apply filters (min points/rank)
  let filtered = sorted;
  if (rule.min_points !== undefined) {
    filtered = filtered.filter((s) => s.points >= (rule.min_points as number));
  }
  if (rule.min_rank !== undefined) {
    filtered = filtered.filter((s) => s.rank <= (rule.min_rank as number));
  }

  // 3. Apply cap (top N)
  if (rule.top_n !== undefined) {
    filtered = filtered.slice(0, rule.top_n);
  }

  return filtered.map((s) => s.userId);
}

// ---------------------------------------------------------------------------
// Human-readable renderers for a framework's "way of gaming". Pure; null-safe
// so a bare { scoring_schedule } or { match_format } object works in tests.
// ---------------------------------------------------------------------------

function ordinal(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

function tiebreakLabel(key: string): string {
  switch (key) {
    case "goal_difference":
      return "goal difference";
    case "goals_for":
      return "goals scored";
    case "head_to_head":
      return "head-to-head";
    default:
      return key.replace(/_/g, " ");
  }
}

export function describeScoring(fw: {
  scoring_schedule?: ScoringSchedule | null;
}): string | null {
  const s = fw.scoring_schedule;
  if (!s) return null;
  const parts: string[] = [];

  if (typeof s.win === "number") {
    let base = `Win ${s.win} pts`;
    if (typeof s.draw === "number") base += `, draw ${s.draw}`;
    if (typeof s.loss === "number") base += `, loss ${s.loss}`;
    parts.push(base);
  } else if (typeof s.win_points === "number") {
    parts.push(`${s.win_points} per series win`);
  }

  if (s.placement && s.placement.length > 0) {
    const head = s.placement
      .slice(0, 3)
      .map((p, i) => `${ordinal(i + 1)}: ${p}`)
      .join(", ");
    const tail =
      s.placement.length > 3
        ? ` · ${ordinal(s.placement.length)}: ${s.placement[s.placement.length - 1]}`
        : "";
    parts.push(`Placement ${head}${tail}`);
    if (typeof s.kill_points === "number") {
      parts.push(`${s.kill_points} per elimination`);
    }
  }

  if (s.matches && s.matches > 0) {
    parts.push(`over ${s.matches} match${s.matches === 1 ? "" : "es"}`);
  }
  if (s.tiebreak && s.tiebreak.length > 0) {
    parts.push(`ties broken by ${s.tiebreak.map(tiebreakLabel).join(", ")}`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

export function describeMatchFormat(fw: {
  match_format?: GameMatchFormat | null;
}): string | null {
  const m = fw.match_format;
  if (!m) return null;
  switch (m.mode) {
    case "best_of": {
      let s = `Best-of-${m.games ?? 3}`;
      if (m.modes && m.modes.length > 0) s += ` (${m.modes.join(" → ")})`;
      if (m.finals_games) s += ` · finals best-of-${m.finals_games}`;
      return s;
    }
    case "multi_match":
      return m.matches ? `${m.matches} matches per round` : "Multi-match";
    case "racing":
      return m.matches ? `${m.matches} races per round` : "Racing";
    case "league":
      return "League phase";
    default:
      return "Single-match / bracket";
  }
}

/**
 * The framework a tournament should start with: the user's current selection
 * if any, otherwise the selected game's default_framework_id (its "way of
 * gaming"). Returns null when nothing sensible is available.
 */
export function suggestedFramework(
  games: { id: string; default_framework_id: string | null }[],
  frameworks: Framework[],
  gameId: string | null,
  selectedId: string | null,
): Framework | null {
  if (selectedId) {
    return frameworks.find((f) => f.id === selectedId) ?? null;
  }
  if (!gameId) return null;
  const game = games.find((g) => g.id === gameId);
  if (!game?.default_framework_id) return null;
  const fw = frameworks.find((f) => f.id === game.default_framework_id);
  return fw && fw.game_id === gameId ? fw : null;
}

export const __frameworks = { calculateAdvancement };