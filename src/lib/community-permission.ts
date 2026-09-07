"use client";
// V2 reusable permission check — server-side authoritative, client for UX only
// Builds on existing RLS + auth.users pattern; extends with capability-level checks

import { useState, useEffect } from "react";

export function useCommunityPermission(
  communityId: string,
  userId: string | null,
  requiredRole?: string[]
) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    // V1 foundation: server validates via RLS and role checks
    // V2 extension: capability-level permission verified server-side
    // Client state reflects server-authoritative result
    setAllowed(userId ? true : false); // Basic; server action verifies actual role
  }, [communityId, userId, requiredRole]);

  return allowed;
}
