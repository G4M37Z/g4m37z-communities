// lib/community-service.ts — V2 shared domain service
// Reusable community capability evaluation + permission check
// Uses existing SQL 009 schema (reactions, emoji, gif_refs, voice)
// No arbitrary new DB — extends existing public.communities + members

import { createClient } from "@/lib/supabase/server";

export interface CommunityContext {
  community: {
    id: string;
    name: string;
    slug: string;
    icon_url: string | null;
    banner_url: string | null;
    description: string | null;
    category_id: string | null;
    creator_id: string;
  } | null;
  capabilities: string[];
  role: string | null;
  isMember: boolean;
  canPost: boolean;
  canModerate: boolean;
}

export async function getCommunityContext(slug: string, userId?: string): Promise<CommunityContext> {
  const supabase = await createClient();
  const { data: community } = await supabase
    .from("communities")
    .select("id, name, slug, description, icon_url, banner_url, creator_id, category_id")
    .eq("slug", slug)
    .maybeSingle();

  let role: string | null = null;
  let isMember = false;
  let canPost = false;
  let canModerate = false;

  if (userId && community) {
    const { data: membership } = await supabase
      .from("community_members")
      .select("role")
      .eq("community_id", community.id)
      .eq("user_id", userId)
      .maybeSingle();
    role = membership?.role ?? null;
    isMember = Boolean(membership);
    canPost = isMember;
    canModerate = role === "moderator" || role === "admin" || community.creator_id === userId;
  }

  // Capability states — exists/enabled/visible/restricted (V2 spec §2)
  const capabilities = ["discussions", "media", "members", "voice"];
  if (community) {
    capabilities.push("events"); // V2 foundation, disabled by default until configured
  }

  return {
    community: community as CommunityContext["community"],
    capabilities,
    role,
    isMember,
    canPost,
    canModerate,
  };
}
