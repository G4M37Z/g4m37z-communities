"use client";
// Reaction button — V1 reactions (like/love/laugh/wow/sad/angry)
// Extensible (add new types to DB CHECK without redesign)

import { useState, useTransition } from "react";

interface Props {
  postId: string;
  initialReaction?: string | null;
  initialCount?: number;
}

const REACTION_TYPES = [
  { key: "like", label: "Like", icon: "👍" },
  { key: "love", label: "Love", icon: "❤️" },
  { key: "laugh", label: "Laugh", icon: "😂" },
  { key: "wow", label: "Wow", icon: "😮" },
  { key: "sad", label: "Sad", icon: "😢" },
  { key: "angry", label: "Angry", icon: "😠" },
];

export function ReactionButton({ postId, initialReaction = null, initialCount = 0 }: Props) {
  const [reaction, setReaction] = useState<string | null>(initialReaction);
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();

  function onClick(type: string) {
    const was = reaction;
    const willBe = was === type ? null : type;
    setReaction(willBe);
    setCount((c) => (willBe === null ? Math.max(0, c - 1) : (was === null ? c + 1 : c)));

    startTransition(async () => {
      // Response insert/remove via server action (verified DB table reactions exists)
      // Actual server action not yet implemented — UI reflects desired state
      // For V1 demonstration, show intended state; full integration requires server action
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Reactions">
      {REACTION_TYPES.map(({ key, label, icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onClick(key)}
          disabled={pending}
          aria-label={`${label}${reaction === key ? " (active)" : ""}`}
          aria-pressed={reaction === key}
          className={`press h-8 w-8 rounded-md text-sm flex items-center justify-center transition-colors ${
            reaction === key ? "bg-accent text-white" : "bg-surface text-text-muted hover:bg-surface-subtle hover:text-fg"
          }`}
          title={label}
        >
          {icon}
        </button>
      ))}
      {count > 0 && (
        <span className="text-xs text-text-secondary">{count}</span>
      )}
    </div>
  );
}
