"use client";

// src/components/post/BookmarkButton.tsx
// Optimistic bookmark toggle. Signed-out users get a link to login.

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bookmark, Loader2 } from "lucide-react";
import { addBookmarkAction, removeBookmarkAction } from "@/lib/bookmarks/actions";

interface Props {
  postId: string;
  initialSaved: boolean;
  signedIn: boolean;
}

export function BookmarkButton({ postId, initialSaved, signedIn }: Props) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <Link
        href={`/login?next=/post/${postId}`}
        className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-fg"
        aria-label="Sign in to save this post"
      >
        <Bookmark size={14} />
        Save
      </Link>
    );
  }

  function toggle() {
    const next = !saved;
    setSaved(next); // optimistic
    setError(null);
    startTransition(async () => {
      const res = next ? await addBookmarkAction(postId) : await removeBookmarkAction(postId);
      if (!res.ok) {
        setSaved(!next); // revert on failure
        setError("Couldn't update saved state. Try again.");
      }
    });
  }

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={saved}
        aria-label={saved ? "Remove bookmark" : "Save post"}
        className={`inline-flex items-center gap-1.5 text-xs transition-colors hover:text-fg disabled:opacity-60 ${
          saved ? "text-accent" : "text-text-muted"
        }`}
      >
        {pending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Bookmark size={14} fill={saved ? "currentColor" : "none"} />
        )}
        {saved ? "Saved" : "Save"}
      </button>
      {error && (
        <span role="alert" className="absolute left-0 top-full mt-1 whitespace-nowrap text-xs text-sale">
          {error}
        </span>
      )}
    </span>
  );
}
