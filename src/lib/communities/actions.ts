// ============================================================================
// src/lib/communities/actions.ts
// Server Actions for the Communities feature (Milestone 3).
//
// All mutations run through the cookie-bound Supabase client so RLS continues
// to enforce ownership (auth.uid() = creator_id, auth.uid() = user_id).
// ============================================================================

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CommunityMember } from "@/types/database";

// ---------------------------------------------------------------------------
// Slug + name validation
// ---------------------------------------------------------------------------

function validateSlug(slug: string): string | null {
  const s = slug.trim().toLowerCase();
  if (s.length < 3) return "Slug must be at least 3 characters.";
  if (s.length > 40) return "Slug must be 40 characters or fewer.";
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(s)) {
    return "Slug may only contain lowercase letters, numbers, and hyphens, and must start and end with a letter or number.";
  }
  return null;
}

function validateName(name: string): string | null {
  const n = name.trim();
  if (n.length < 3) return "Name must be at least 3 characters.";
  if (n.length > 60) return "Name must be 60 characters or fewer.";
  return null;
}

function validateDescription(desc: string): string | null {
  const d = desc.trim();
  if (d.length > 500) return "Description must be 500 characters or fewer.";
  return null;
}

// ---------------------------------------------------------------------------
// createCommunity
// Creates a new community. The DB trigger handle_new_community adds the
// creator as an 'admin' member automatically.
// ---------------------------------------------------------------------------

export async function createCommunity(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const categoryIds = formData.getAll("categoryIds").map(String).filter(Boolean);

  const nameErr = validateName(name);
  if (nameErr) return { error: nameErr };
  const slugErr = validateSlug(slug);
  if (slugErr) return { error: slugErr };
  const descErr = validateDescription(description);
  if (descErr) return { error: descErr };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to create a community." };

  // Insert community — RLS WITH CHECK (auth.uid() = creator_id) enforces ownership.
  const { data: community, error } = await supabase
    .from("communities")
    .insert({
      name,
      slug,
      description: description || null,
      creator_id: user.id,
    })
    .select("id, slug")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return { error: "That slug is already taken. Try a different one." };
    }
    console.error("createCommunity insert failed:", error);
    return { error: error.message || "We couldn't create the community. Try again." };
  }

  if (!community) {
    return { error: "Community creation returned no data. Try again." };
  }

  // Tag the community with selected categories. The trigger already added
  // the creator as admin; categories are optional.
  if (categoryIds.length > 0) {
    const rows = categoryIds.map((categoryId) => ({
      community_id: community.id,
      category_id: categoryId,
    }));
    const { error: tagErr } = await supabase
      .from("community_category_links")
      .insert(rows);
    if (tagErr) {
      // Non-fatal — community exists, categories can be added later.
      console.error("createCommunity category tagging failed:", tagErr);
    }
  }

  revalidatePath("/communities");
  redirect(`/communities/${community.slug}`);
}

// ---------------------------------------------------------------------------
// joinCommunity / leaveCommunity
// Self-service membership management. RLS WITH CHECK (auth.uid() = user_id)
// keeps users from joining on behalf of others.
// ---------------------------------------------------------------------------

export async function joinCommunity(communityId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase.from("community_members").insert({
    community_id: communityId,
    user_id: user.id,
    role: "member",
  });

  if (error) {
    if (error.code === "23505") {
      // Already a member — treat as success.
      return { ok: true };
    }
    console.error("joinCommunity failed:", error);
    return { error: "Couldn't join the community. Try again." };
  }

  return { ok: true };
}

export async function leaveCommunity(communityId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // Refuse to leave if the user is the only admin of the community — that
  // would orphan the community with no one able to manage it. Admin can
  // promote someone else first (Milestone 8) or delete the community.
  const { data: membership } = await supabase
    .from("community_members")
    .select("role")
    .eq("community_id", communityId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership?.role === "admin") {
    const { count } = await supabase
      .from("community_members")
      .select("user_id", { count: "exact", head: true })
      .eq("community_id", communityId)
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return {
        error:
          "You're the only admin. Promote another member to admin first, or delete the community.",
      };
    }
  }

  const { error } = await supabase
    .from("community_members")
    .delete()
    .eq("community_id", communityId)
    .eq("user_id", user.id);

  if (error) {
    console.error("leaveCommunity failed:", error);
    return { error: "Couldn't leave the community. Try again." };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// getCommunityMembership
// Returns the current user's membership row for a community, or null.
// ---------------------------------------------------------------------------

export async function getCommunityMembership(
  communityId: string
): Promise<CommunityMember | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("community_members")
    .select("community_id, user_id, role, joined_at")
    .eq("community_id", communityId)
    .eq("user_id", user.id)
    .maybeSingle();
  return (data as CommunityMember | null) ?? null;
}

// ---------------------------------------------------------------------------
// checkSlugAvailability
// Used by the create form for live slug validation.
// ---------------------------------------------------------------------------

export async function checkSlugAvailability(slug: string) {
  const slugErr = validateSlug(slug);
  if (slugErr) return { available: false, reason: slugErr };
  const supabase = await createClient();
  const { data } = await supabase
    .from("communities")
    .select("slug")
    .eq("slug", slug.trim().toLowerCase())
    .maybeSingle();
  if (data) return { available: false, reason: "That slug is already taken." };
  return { available: true };
}
