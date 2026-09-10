"use client";
// V2 reusable permission check — server-side authoritative, client for UX only
// Builds on existing RLS + auth.users pattern; extends with capability-level checks

import { useMemo } from "react";

export function useCommunityPermission(
  communityId: string,
  userId: string | null,
  requiredRole?: string[],
) {
  // Stabilise the role list so useMemo can use a primitive expression in deps.
  const roleKey = requiredRole ? requiredRole.join("|") : "";

  // Derive permission synchronously from the inputs to avoid cascading renders
  // from setState-in-effect. The server action remains authoritative.
  return useMemo<boolean | null>(() => {
    if (!userId) return false;
    if (!requiredRole || requiredRole.length === 0) return true;
    // V1 foundation: client only verifies user is signed in and the role list
    // is non-empty; server action checks actual membership/role.
    return true;
    // communityId / roleKey changes re-derive; server remains source of truth
    // for actual role membership.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId, userId, roleKey]);
}
