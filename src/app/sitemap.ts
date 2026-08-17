// src/app/sitemap.ts
// Dynamic sitemap for SEO. Lists public pages so search engines can index them.

import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const supabase = await createClient();

  // Fetch public communities + posts in parallel.
  const [
    { data: communities },
    { data: posts },
  ] = await Promise.all([
    supabase
      .from("communities")
      .select("slug, updated_at, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("posts")
      .select("id, updated_at, created_at, community_id")
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/communities`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const communityRoutes: MetadataRoute.Sitemap = (communities ?? []).map(
    (c: { slug: string; updated_at: string; created_at: string }) => ({
      url: `${baseUrl}/communities/${c.slug}`,
      lastModified: new Date(c.updated_at || c.created_at),
      changeFrequency: "daily",
      priority: 0.8,
    })
  );

  const postRoutes: MetadataRoute.Sitemap = (posts ?? []).map(
    (p: { id: string; updated_at: string; created_at: string }) => ({
      url: `${baseUrl}/post/${p.id}`,
      lastModified: new Date(p.updated_at || p.created_at),
      changeFrequency: "weekly",
      priority: 0.6,
    })
  );

  return [...staticRoutes, ...communityRoutes, ...postRoutes];
}