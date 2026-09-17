"use client";

// src/components/post/ShareButton.tsx
// Client-side "Share" action used inside PostCard and the post detail page.
// Uses the Web Share API when the platform exposes it (native sheet on mobile),
// and falls back to copying the canonical link to the clipboard.

import { useState } from "react";

export function ShareButton({
  postId,
  title,
}: {
  postId: string;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/post/${postId}`;

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: title ?? "G4M37Z Communities post",
          url,
        });
        return;
      } catch (err) {
        // A dismissed share sheet is a normal cancellation, not a failure.
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Anything else: fall through to clipboard.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (insecure context / denied): leave the label.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-fg"
      aria-label="Share post"
    >
      {copied ? "Copied" : "Share"}
    </button>
  );
}
