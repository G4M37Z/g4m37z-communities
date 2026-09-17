// ============================================================================
// src/lib/profiles/platform-links.ts
// Manual, self-reported gaming-platform identities (042_platform_links.sql).
//
// Security model:
//   - Identity is resolved server-side from the cookie-bound session, never
//     from the client. Writes go through the caller's own RLS-scoped client,
//     so a user can only ever touch their own rows (policies pin
//     user_id = auth.uid()).
//   - verified_at is NEVER written here. A row is a declared handle, not a
//     verified account; a later Steam OpenID connector will set it.
//   - Reads use the table's public SELECT policy (links appear on profiles).
//
// Pure metadata/validators live in ./platforms so Client Components can import
// them without pulling in the server Supabase client.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import {
  cleanPlatform,
  cleanHandle,
  cleanUrl,
  PLATFORM_LABELS,
  type Platform,
  type PlatformLink,
  type PlatformLinkInput,
} from "@/lib/profiles/platforms";

export {
  PLATFORMS,
  PLATFORM_LABELS,
  cleanPlatform,
  cleanHandle,
  cleanUrl,
  type Platform,
  type PlatformLink,
  type PlatformLinkInput,
} from "@/lib/profiles/platforms";

export async function listPlatformLinks(userId: string): Promise<PlatformLink[]> {
  const client = await createClient();
  const { data, error } = await client
    .from("platform_links")
    .select("id, user_id, platform, handle, profile_url, verified_at, created_at, updated_at")
    .eq("user_id", userId);
  if (error || !data) return [];
  return data as PlatformLink[];
}

export async function savePlatformLinks(
  input: PlatformLinkInput[],
): Promise<{ ok: true }> {
  const supabase = await createClient();
  const { data: u, error: authErr } = await supabase.auth.getUser();
  if (authErr || !u?.user) throw new Error("Not authenticated");
  const userId = u.user.id;

  const now = new Date().toISOString();
  const rows: {
    user_id: string;
    platform: Platform;
    handle: string;
    profile_url: string | null;
    updated_at: string;
  }[] = [];

  for (const item of input ?? []) {
    const platform = cleanPlatform(item?.platform);
    if (!platform) throw new Error(`Unknown platform: ${String(item?.platform)}`);

    const rawHandle = String(item?.handle ?? "").trim();
    if (!rawHandle) continue; // empty input clears the link (deleted below)

    const handle = cleanHandle(rawHandle);
    if (!handle) throw new Error(`Invalid ${PLATFORM_LABELS[platform]} handle`);

    const rawUrl = String(item?.profile_url ?? "").trim();
    const profile_url = cleanUrl(rawUrl);
    if (rawUrl && !profile_url) throw new Error(`Invalid ${PLATFORM_LABELS[platform]} profile URL`);

    rows.push({ user_id: userId, platform, handle, profile_url, updated_at: now });
  }

  const kept = rows.map((r) => r.platform);

  const { data: existing, error: readErr } = await supabase
    .from("platform_links")
    .select("platform")
    .eq("user_id", userId);
  if (readErr) throw new Error(readErr.message);

  const stale = ((existing ?? []) as { platform: string }[])
    .map((r) => r.platform)
    .filter((p) => !kept.includes(p as Platform));

  if (stale.length > 0) {
    const { error } = await supabase
      .from("platform_links")
      .delete()
      .eq("user_id", userId)
      .in("platform", stale);
    if (error) throw new Error(error.message);
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from("platform_links")
      .upsert(rows, { onConflict: "user_id,platform" });
    if (error) throw new Error(error.message);
  }

  return { ok: true };
}

export const __platformLinks = { cleanPlatform, cleanHandle, cleanUrl };
