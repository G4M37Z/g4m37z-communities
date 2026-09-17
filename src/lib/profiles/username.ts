// ============================================================================
// src/lib/profiles/username.ts
// Username canonicalization shared by every lookup / write path.
//
// Usernames are stored canonically lowercase (migration 036 enforces
// case-insensitive uniqueness via uq_profiles_lower_username). Any user input
// that refers to a handle — signup, profile links, recipient lookup, search —
// must be normalized the same way before it is compared or persisted:
//   - trim surrounding whitespace
//   - strip a leading "@" (people type handles with the prefix)
//   - lowercase (collapses @Derick / derick / DERICK onto the stored row)
// ============================================================================

/** Canonicalizes a user-entered handle for storage or lookup. */
export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

export type UsernameVerdict =
  | { ok: true; username: string }
  | { ok: false; error: string };

/**
 * Validates and canonicalizes a username being registered.
 * Mirrors the signup rules: 3–30 chars, letters/numbers/underscores, no
 * leading or trailing underscore.
 */
export function validateUsername(raw: string): UsernameVerdict {
  const username = normalizeUsername(raw);
  if (username.length < 3) return { ok: false, error: "Username must be at least 3 characters." };
  if (username.length > 30) return { ok: false, error: "Username must be 30 characters or fewer." };
  if (!/^[a-z0-9_]+$/.test(username)) {
    return { ok: false, error: "Username may only contain letters, numbers, and underscores." };
  }
  if (/^_|_$/.test(username)) {
    return { ok: false, error: "Username cannot start or end with an underscore." };
  }
  return { ok: true, username };
}
