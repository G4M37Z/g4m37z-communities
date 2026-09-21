// ============================================================================
// src/components/gaming/GameStatusBadge.tsx
// Tiny presentational badge for a library status (server-safe).
// ============================================================================

import { GAME_STATUS_LABELS, type GameStatus } from "@/lib/gaming/types";

export function GameStatusBadge({ status }: { status: GameStatus }) {
  return (
    <span className="inline-flex items-center rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent-text">
      {GAME_STATUS_LABELS[status]}
    </span>
  );
}
