# Spec: Tournament Frameworks (Category-Aware Formats)

## Objective

Expand the tournament system from basic bracket formats (Single/Double Elim) to "Frameworks" that mirror how games are actually hosted on global stages.

Instead of a simple enum for `format`, tournaments will be linked to a **Framework**. A framework defines the high-level rules, stages, and progression logic for a specific gaming category.

### User Stories
- **As an Organiser**, I want to create a "Battle Royale" tournament where players progress through "Heats" and "Qualifiers" based on points, not just a binary win/loss.
- **As a Member**, I want to see that a tournament is following the "FNCS 2026" or "Champions League" style framework.
- **As a Developer**, I want the system to support diverse competition styles (Points-based, Bracket-based, Stage-based) without rewriting the core `tournaments` table for every new game.

## Tech Stack

Unchanged: Next.js 16.3, React 19, TypeScript, Supabase (Postgres + RLS), Tailwind v4.

## Commands

```
Check:  npm run check
Dev:    npm run dev
DB run: ~/.local/bin/run-sql docs/database/043_tournament_frameworks.sql
Test:   npm run test:unit
```

## Project Structure

```
docs/database/043_tournament_frameworks.sql     → New tables: tournament_frameworks, tournament_stages
src/lib/tournaments/frameworks.ts               → Framework definitions, point logic, and validators
src/lib/tournaments/service.ts                  → Update to support Framework-based creation
src/components/tournaments/FrameworkSelector.tsx → UI for choosing framework during creation
tests/tournaments-frameworks.test.ts            → Validating progression and point calculations
```

## Data Model

### 1. `tournament_frameworks` (The Template)
Defines the identity and high-level rules of a format.
- `id` (UUID, PK)
- `slug` (TEXT, Unique) — e.g., "battle-royale-points", "classic-bracket", "world-cup-style"
- `name` (TEXT) — e.g., "Battle Royale Points System"
- `category` (TEXT) — e.g., "Fortnite", "EA FC", "General"
- `scoring_type` (TEXT) — `points` | `win_loss` | `rank`
- `description` (TEXT)

### 2. `tournament_stages` (The Pipeline)
Defines the sequence of events within a framework.
- `id` (UUID, PK)
- `framework_id` (UUID, FK → tournament_frameworks)
- `stage_order` (INT) — Sequence (1, 2, 3...)
- `stage_name` (TEXT) — e.g., "Open Heats", "Semi-Finals", "Grand Final"
- `progression_rule` (JSONB) — Logic for how many advance (e.g. `{ "top_n": 16 }`)

### 3. `tournaments` (Modified)
- `format` (TEXT) → Change from Enum to FK referencing `tournament_frameworks(id)`.
- `current_stage_id` (UUID, FK → tournament_stages) — Tracks which stage the tournament is currently in.

## Code Style

Framework logic should be encapsulated in pure functions.

```ts
// Example: Calculate advancement for a Battle Royale Heat
export function calculateProgression(
  scores: { userId: string, points: number }[],
  rule: ProgressionRule
): string[] {
  return scores
    .sort((a, b) => b.points - a.points)
    .slice(0, rule.top_n)
    .map(s => s.userId);
}
```

## Testing Strategy

Vitest, `tests/tournaments-frameworks.test.ts`:
1. **Validation**: Framework slugs must be unique; stage orders must be sequential.
2. **Scoring Logic**: Ensure that point-based systems correctly rank players based on the provided scoring_type.
3. **Progression**: Test that `calculateProgression` correctly identifies the top N players for advancement to the next stage.

## Boundaries

- Always: use a `framework` instead of hardcoded format strings.
- Ask first: Changing the core `tournaments` table (requires a migration and potentially updating existing rows).
- Never: hardcode game-specific scoring logic inside the general `tournaments` service; keep it in the `frameworks.ts` module.

## Success Criteria

1. A tournament can be created linked to a specific **Framework** (e.g., a "Battle Royale" framework).
2. The tournament automatically knows its **Stages** (e.g., it starts at Stage 1: "Open Heats").
3. The system supports **Points-based scoring** as an alternative to simple win/loss match results.
4. `npm run check` is green.

## Open Questions

1. **Legacy Support**: Should we migrate existing tournaments (SINGLE_ELIMINATION, etc.) to a "Classic" framework automatically, or keep them as is for now? I recommend auto-migrating to a "Legacy Classic" framework to unify the API.
2. **Stage Transitions**: Should the system automatically advance the tournament to the next stage once a stage is "Completed", or is this a manual action by the Organiser? I recommend manual trigger for safety.

---

# Addendum: Per-Game "Way of Gaming" (043 → 044)

## Objective

Every games-catalogue title gets its own tournament framework that mirrors
how that game is actually hosted on global stages (PUBG ≠ eFootball ≠ Mortal
Kombat). Each new framework binds to a `game`, and each game names one
framework as its **default**, so the create-tournament form surfaces the
game's real format instead of a generic bracket.

Closed by migration `docs/database/044_game_frameworks.sql`.

## User Stories

- **As an Organiser**, choosing "Call of Duty" in the create-tournament
  form pre-selects the CDL best-of-5 series framework, not a generic bracket.
- **As a Member**, the tournament detail page explains *how* the game scores
  ("3 points for a win, tiebreak by goal difference…", "placement + kills
  over 6 matches", "best-of-5, Hardpoint → S&D → Control → Hardpoint → S&D").
- **As a Developer**, scoring metadata is data, not hardcoded branch logic:
  a framework carries `scoring_schedule` + `match_format` JSONB and pure
  render helpers turn them into human text. No new computing engines.

## Data Model Additions

### `tournament_frameworks` (modified)
- `game_id` (UUID, FK → games, ON DELETE SET NULL) — which game this format belongs to. NULL = general/starter frameworks.
- `scoring_schedule` (JSONB) — point awards: `win/draw/loss` (football 3-1-0), `placement[]` + `kill_points` + `per_match`/`matches` (battle royale / racing), `win_points` (series), `tiebreak[]`.
- `match_format` (JSONB) — `{ "mode": "single"|"best_of"|"multi_match"|"league"|"racing", games?, finals_games?, matches?, modes? }`. CHECK-bounded `mode`.

### `games` (modified)
- `default_framework_id` (UUID, FK → tournament_frameworks, ON DELETE SET NULL) — the tournament format this game is known for.

### `games` catalogue (seed, idempotent)
PUBG, Fortnite, Call of Duty, EA SPORTS FC, eFootball, Mortal Kombat, Grand
Theft Auto V, Roblox — each with genre/platform joins. A `Fighting` genre is
added (Mortal Kombat has no home in the current 8-genre taxonomy).

### Seeded frameworks (research-backed, one "way" per game)
| Game | Framework | Scoring | Stages |
|---|---|---|---|
| PUBG | `pubg-br-points` | placement 15/12/10/8/6/4/3/2/1 + 1 per kill, over 6 matches | Group (top16) → Grand Final |
| Fortnite | `fncs-style-points` | VR 65…2nd 2 + 2 per elim, over 12 games | Open Quals (top40) → Heats (top10) → Grand Finals |
| EA FC | `football-league-knockout` | 3-1-0, tiebreak GD/GF/H2H | League (top24) → Knockout |
| eFootball | `efootball-pro-cup` | 3-1-0, KO is best-of-3 | Groups (top4) → Semi → Final |
| Call of Duty | `cod-cdl-series` | best-of-5 series (win 3 maps) | Qualifiers (top8) → Bracket |
| Mortal Kombat | `mk-fighting-double-elim` | best-of-3, finals best-of-5 | Double-Elim pools (top8) → Top 8 |
| GTA | `gta-racing-cup` | F1-style finish points over 5 races | Qualifying (top16) → Grand Final |
| Roblox | `roblox-multi-experience` | cumulative points across experiences | R1-3 (top8) → Semi → Final |

## Model Scope Decisions

- Scores remain **organiser-entered totals** per stage; the engine sorts and
  cuts (`calculateAdvancement`) but does NOT simulate football standings,
  set legs, or race-by-race aggregation. `scoring_schedule`/`match_format`
  are descriptive metadata rendered as guidance; simulating them would be
  speculative code nobody has asked for.
- A framework binds to **one** game. EA FC and eFootball get separate
  frameworks (their real knockout rules differ: single KO vs best-of-3).

## Pure helpers (client-safe, tested)

In `src/lib/tournaments/frameworks.ts`:
- `describeScoring(framework)` → human "how it scores" line (null-safe).
- `describeMatchFormat(framework)` → "Best-of-5 (Hardpoint → S&D …)".
- `suggestedFramework(games, frameworks, gameId, selectedId)` → the framework
  a game's `default_framework_id` points at (or the current selection), so
  the form auto-selects the game's way of gaming.

## Testing Strategy

`tests/game-frameworks.test.ts`: describe helpers render each seeded format
correctly; `suggestedFramework` picks the game default; 044 regression regex
(unique framework slugs, idempotent seeds via WHERE NOT EXISTS / ON CONFLICT,
every seeded game gets a default, frameworks reference games, no
`tournaments.creator_id`).

## Success Criteria

1. 044 applies cleanly to the live DB and can be re-run (idempotent).
2. Seeding the catalogue makes the create form pre-select each game's own
   framework with its rules displayed.
3. Seeds are data: editing a framework's `scoring_schedule` changes the text
   on the detail page with no code change.
4. `npm run check` green, tests green.
