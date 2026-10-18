"use client";

// src/components/post/PostViewTracker.tsx
// View metrics (055): one deduped view row per (post, user). The tracking
// insert runs after a 4s dwell (bounce visits don't count), and
// sessionStorage dedupes repeat mounts in the same tab. The upsert
// (onConflict post_id,user_id + ignoreDuplicates) never double-fires the
// bump_post_views trigger; the DB trigger itself skips the author's own views.

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const DWELL_MS = 4_000;

export function PostViewTracker({ postId }: { postId: string }) {
  useEffect(() => {
    const dedupeKey = `g4m37z-viewed-${postId}`;
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(dedupeKey)) {
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        sessionStorage.setItem(dedupeKey, "1");
        await supabase
          .from("post_views")
          .upsert(
            { post_id: postId, user_id: user.id },
            { onConflict: "post_id,user_id", ignoreDuplicates: true },
          );
      } catch {
        // Metrics are best-effort; never surface tracking failures in the UI.
      }
    }, DWELL_MS);
    return () => clearTimeout(timer);
  }, [postId]);

  return null;
}
