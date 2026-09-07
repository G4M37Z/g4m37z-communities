"use client";
// Emoji picker — simple searchable picker for V1
// Uses native emoji set, no external provider needed for V1 foundation

import { useState } from "react";

const EMOJIS = [
  "👍","❤️","🔥","😮","😢","🎉","🤔","👏","💯","🎯","🚀","⭐","💥","🍩","🍕","🎮","🎲","🕹️","💻","🎧","🔊","👀","✈️","🏆","🎸","🎹","🎨","📸","🎬","📷","🎥","🎤"
];

interface EmojiPickerProps {
  onSelect?: (emoji: string) => void;
  onClose?: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [search, setSearch] = useState("");
  const filtered = EMOJIS.filter((e) => !search || e.toLowerCase().includes(search.toLowerCase()) || e === search);

  return (
    <div className="rounded-xl border border-border bg-surface p-3 shadow-xl w-72">
      <div className="mb-2 flex items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search emoji..."
          className="h-9 w-full rounded-md border border-border bg-bg px-2 text-sm text-fg placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30"
          aria-label="Search emoji"
        />
        <button type="button" onClick={onClose} className="text-xs text-text-muted hover:text-fg" aria-label="Close picker">✕</button>
      </div>
      <div className="grid grid-cols-8 gap-1 max-h-64 overflow-y-auto">
        {(search ? filtered : EMOJIS).map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => { onSelect?.(e); onClose?.(); }}
            className="h-9 w-9 rounded-md hover:bg-surface-subtle text-lg transition-colors"
            aria-label={`Select ${e}`}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
