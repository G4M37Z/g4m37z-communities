"use client";
// V2 Discovery — feed/recommendation service
// Uses verified V1 feed infrastructure (FeedSortTabs, Skeleton, PageEnter)
// No arbitrary new DB tables — uses existing posts/communities

export interface DiscoveryFeedConfig {
  type: "trending" | "recommended" | "related_community";
  communityId?: string;
  limit: number;
}
