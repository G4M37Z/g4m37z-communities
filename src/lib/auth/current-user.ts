// src/lib/auth/current-user.ts
// Single source of truth for "who is this request's user and what is their
// profile". Wrapped in React's cache() so the root layout, Header, and pages
// share ONE auth round-trip and ONE profiles query per request instead of each
// component re-fetching the same rows.

import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export interface CurrentUser {
  user: User | null;
  username: string | null;
  role: string;
  avatarUrl: string | null;
}

export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, username: null, role: "member", avatarUrl: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, role, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return {
    user,
    username: profile?.username ?? null,
    role: (profile?.role as string) ?? "member",
    avatarUrl: (profile?.avatar_url as string | null) ?? null,
  };
});
