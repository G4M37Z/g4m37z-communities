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
