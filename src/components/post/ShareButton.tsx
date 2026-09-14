"use client";

// src/components/post/ShareButton.tsx
// Client-side "Share" action used inside PostCard. Server Components cannot
// pass inline onClick handlers to the client, so the copy-link action must
// live in a dedicated client component.

import { useState } from "react";

export function ShareButton({ postId }: { postId: string }) {
  const [copied, setCopied] = useState(false);

  function share() {
    navigator.clipboard
      ?.writeText(window.location.origin + `/post/${postId}`)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-fg"
      aria-label="Copy link to share"
    >
      {copied ? "Copied" : "Share"}
    </button>
  );
}